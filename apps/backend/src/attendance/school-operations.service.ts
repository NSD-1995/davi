import {LeaveBalanceService} from './leave-balance.service';
import {StaffPunchService} from './staff-punch.service';
import {validateAttendancePolicy,effectiveAttendancePolicy} from './attendance-policy';
import {validateLeavePolicies,defaultLeavePolicy} from './leave-policy';
import { operationsTransaction } from './operations-transaction';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OperationsAccessService } from '../auth/operations-access.service';
import { StaffAttendanceService, snapshot } from './staff-attendance.service';
import { CoverageService, attendanceDate, localClock } from '../timetable/coverage.service';
import { unavailableForLesson, overlaps } from '../timetable/coverage-engine';
import { academicGroup, validGroups } from '../academic-groups';
@Injectable()
export class SchoolOperationsService {
    async report(s: string, userId: string, fromValue: string, toValue: string) {
        const { rows, actor } = await this.access.staff(s, userId, 'staff.attendance.view');
        const from = attendanceDate(fromValue), to = attendanceDate(toValue);
        if (to < from || +to - +from > 30 * 86400000)
            throw new BadRequestException('Choose a report range of up to 31 days.');
        const [records, leaves, events, policy, clock] = await Promise.all([
            this.db.staffAttendance.findMany({ where: { schoolId: s, staffId: { in: rows.map((r: any) => r.id) }, date: { gte: from, lte: to } } }),
            this.db.staffLeaveRequest.findMany({ where: { schoolId: s, staffId: { in: rows.map((r: any) => r.id) }, status: 'APPROVED', startDate: { lte: to }, endDate: { gte: from } } }),
            this.db.schoolEvent.findMany({ where: { schoolId: s, status: 'ACTIVE', eventType: { in: ['HOLIDAY', 'SCHOOL_CLOSURE'], mode: 'insensitive' } } }),
            this.attendance.policy(s), this.coverage.policy(s)
        ]);
        const recordsByKey = new Map(records.map(r => [r.staffId + ':' + r.date.toISOString().slice(0, 10), r]));
        const statuses = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'ON_DUTY', 'NOT_MARKED', 'HOLIDAY', 'WEEKLY_OFF', 'PERMISSION'];
        return { from: fromValue, to: toValue, statuses, rows: rows.map((staff: any) => {
                const counts = Object.fromEntries(statuses.map(status => [status, 0]));
                for (let day = new Date(from); day <= to; day = new Date(+day + 86400000)) {
                    if (staff.joiningDate && staff.joiningDate > day)
                        continue;
                    const date = day.toISOString().slice(0, 10), weekday = day.getUTCDay() || 7;
                    const holiday = events.some(e => localClock(e.startsAt, clock.timeZone).date <= date && date <= localClock(e.endsAt || e.startsAt, clock.timeZone).date);
                    const availableDays = (staff.user.teacher?.timetableWorkload as any)?.availableDays;
                    const off = !effectiveAttendancePolicy(policy,staff).workingDays.includes(weekday) || (availableDays?.length && !availableDays.includes(weekday));
                    const leave = leaves.find(l => l.staffId === staff.id && l.startDate <= day && l.endDate >= day);
                    const record = recordsByKey.get(staff.id + ':' + date);
                    const confirmed = record && !['AUTO_CHECKIN', 'AUTO_EXPECTED_ARRIVAL'].includes(record.source);
                    const status = leave && !holiday && !off ? (leave.halfDay ? 'HALF_DAY' : 'ON_LEAVE') : confirmed ? record.status : holiday ? 'HOLIDAY' : off ? 'WEEKLY_OFF' : 'NOT_MARKED';
                    counts[status] = (counts[status] || 0) + 1;
                }
                return { staffId: staff.id, employeeId: staff.employeeId, name: staff.user.firstName + ' ' + staff.user.lastName, department: staff.user.profileOptions.find((p: any) => p.optionId === actor.departmentOptionId)?.value || '', counts };
            }) };
    }
    constructor(private readonly db: PrismaService, private readonly access: OperationsAccessService, private readonly attendance: StaffAttendanceService, private readonly coverage: CoverageService,private readonly leaveBalances?:LeaveBalanceService,private readonly punches?:StaffPunchService) { }
    async audit(tx: any, s: string, userId: string, action: string, entityType: string, id: string, before: any, after: any, reason: string) { await tx.auditLog.create({ data: { schoolId: s, actorId: userId, method: 'POST', path: '/school-operations', action, entityType, entityId: id, metadata: { before: snapshot(before), after: snapshot(after), reason } } }); }
    async notify(tx: any, s: string, userId: string, key: string, title: string, message: string) {
        if (!await tx.user.findFirst({ where: { id: userId, schoolId: s, status: 'ACTIVE' }, select: { id: true } }))
            return;
        await tx.notification.upsert({ where: { schoolId_dedupeKey: { schoolId: s, dedupeKey: key + ':' + userId } }, create: { schoolId: s, recipientId: userId, dedupeKey: key + ':' + userId, channel: 'IN_APP', title, message, status: 'SENT', sentAt: new Date() }, update: {} });
    }
    async managers(tx: any, s: string, staff: any, leaveType?:string) {
        const rows = await tx.userRole.findMany({ where: { schoolId: s, role: { isActive: true, code: 'SCHOOL_ADMIN' }, user: { status: 'ACTIVE' } }, select: { userId: true } });
        const policy = await this.attendance.policy(s, tx);
        const typeApprovers=policy.leavePolicies.find((p:any)=>p.leaveType===leaveType)?.approverIds;
        const ids = [...new Set<string>([...rows.map((r: any) => r.userId), ...(typeApprovers?.length?typeApprovers:policy.leaveApproverIds)])], allowed: string[] = [];
        for (const id of ids) {
            try {
                const scoped = await this.access.staff(s, id, 'staff.leave.approve', tx);
                if (scoped.rows.some((r: any) => r.id === staff.id))
                    allowed.push(id);
            }
            catch { }
        }
        return allowed;
    }
    async own(s: string, userId: string, tx: any = this.db) {
        await this.access.actor(s, userId, undefined, tx);
        const staff = await tx.staff.findFirst({ where: { schoolId: s, userId, status: 'ACTIVE' } });
        if (!staff)
            throw new NotFoundException('An active staff profile is required.');
        return staff;
    }
    async lookups(s: string, userId: string) {
        const actor = await this.access.actor(s, userId);
        if (!actor.admin&&!actor.permissions.has('staff.attendance.policy.manage'))
            throw new ForbiddenException('Attendance policy management permission required.');
        return this.db.schoolProfileOption.findMany({ where: { schoolId: s, isActive: true }, select: { id: true, label: true } });
    }
    async clock(s: string, userId: string) { await this.access.actor(s, userId); const policy = await this.coverage.policy(s); return { ...localClock(new Date(), policy.timeZone), timeZone: policy.timeZone, leaveTypes: (await this.attendance.policy(s)).leaveTypes }; }
    async settings(s: string, userId: string, data?: any) {
        const actor = await this.access.actor(s, userId);
        const attendanceManager=actor.admin||actor.permissions.has('staff.attendance.policy.manage'),leaveManager=actor.admin||actor.permissions.has('staff.leave.policy.manage');
        if(!attendanceManager&&!leaveManager)throw new ForbiddenException('Attendance or leave policy management permission is required.');
        if(data)for(const key of Object.keys(data)){const leaveKey=['leavePolicies','leaveTypes','leaveApproverIds'].includes(key);if(leaveKey?!leaveManager:!attendanceManager)throw new ForbiddenException('You cannot change this policy setting.');}
        if (!data)
            return this.attendance.policy(s);
        const current=await this.attendance.policy(s),policy={...current,...data};
        if(data.attendanceMode!=null)policy.selfAttendanceEnabled=data.attendanceMode!=='ADMIN_ONLY';else if(data.selfAttendanceEnabled!=null)policy.attendanceMode=data.selfAttendanceEnabled?'BOTH':'ADMIN_ONLY';
        validateAttendancePolicy(policy);validateLeavePolicies(policy.leavePolicies,policy.leaveTypes);
        if(!Array.isArray(policy.attendanceShifts)||policy.attendanceShifts.length>50)throw new BadRequestException('Provide up to 50 attendance shifts.');
        const shiftStaff=new Set<string>(),shiftDepartments=new Set<string>();
        for(const shift of policy.attendanceShifts){if(typeof shift.name!=='string'||!shift.name.trim()||!Array.isArray(shift.staffIds)||!Array.isArray(shift.departmentValues)||(!shift.staffIds.length&&!shift.departmentValues.length)||!shift.policy||typeof shift.policy!=='object')throw new BadRequestException('Shifts need a name, assigned staff or departments, and a schedule.');for(const id of shift.staffIds){if(typeof id!=='string'||shiftStaff.has(id))throw new BadRequestException('A staff member can belong to only one explicit shift.');shiftStaff.add(id);}for(const value of shift.departmentValues){if(typeof value!=='string'||shiftDepartments.has(value))throw new BadRequestException('A department can belong to only one shift.');shiftDepartments.add(value);}if(shift.policy.workingDays&&(!Array.isArray(shift.policy.workingDays)||!shift.policy.workingDays.length||shift.policy.workingDays.some((d:any)=>!Number.isInteger(d)||d<1||d>7)))throw new BadRequestException('Choose valid shift working days.');validateAttendancePolicy({...policy,...shift.policy});}
        if(await this.db.staff.count({where:{schoolId:s,id:{in:[...shiftStaff]}}})!==shiftStaff.size)throw new BadRequestException('Shift staff must belong to this school.');
        const typeApprovers=[...new Set<string>(policy.leavePolicies.flatMap((p:any)=>p.approverIds||[]))];if(await this.db.user.count({where:{schoolId:s,status:'ACTIVE',id:{in:typeApprovers}}})!==typeApprovers.length)throw new BadRequestException('Leave approvers must be active school users.');
        policy.leavePolicies=policy.leavePolicies.map((p:any)=>({...defaultLeavePolicy,...p}));
        if (typeof policy.selfAttendanceEnabled !== 'boolean' || !Array.isArray(policy.workingDays) || !policy.workingDays.length || policy.workingDays.some((d: any) => !Number.isInteger(d) || d < 1 || d > 7) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(policy.halfDayBoundary))
            throw new BadRequestException('Invalid working schedule or half-day boundary.');
        if (!Array.isArray(policy.leaveTypes) || !policy.leaveTypes.length || policy.leaveTypes.some((v: any) => typeof v !== 'string' || !v.trim()) || !Array.isArray(policy.leaveApproverIds) || policy.leaveApproverIds.some((id: any) => typeof id !== 'string'))
            throw new BadRequestException('Invalid leave policy.');
        for(const key of ['departmentOptionId','designationOptionId'])if(policy[key]!=null&&(typeof policy[key]!=='string'||!await this.db.schoolProfileOption.findFirst({where:{id:policy[key],schoolId:s,isActive:true}})))throw new BadRequestException('Choose a profile field from this school.');
        if(policy.departmentOptionId!=null&&typeof policy.departmentOptionId!=='string')throw new BadRequestException('Invalid department profile field.'); if (policy.departmentOptionId && !await this.db.schoolProfileOption.findFirst({ where: { id: policy.departmentOptionId, schoolId: s, isActive: true } }))
            throw new BadRequestException('Choose a department profile field from this school.');
        const users = await this.db.user.count({ where: { schoolId: s, status: 'ACTIVE', id: { in: policy.leaveApproverIds } } });
        if (users !== new Set(policy.leaveApproverIds).size)
            throw new BadRequestException('Approvers must be active users in this school.');
        const clean = Object.fromEntries(Object.keys(current).map(k => [k, policy[k]]));
        return operationsTransaction(this.db, async (tx) => { await tx.schoolSetting.upsert({ where: { schoolId: s }, create: { schoolId: s, operationsPolicy: clean }, update: { operationsPolicy: clean } }); await this.audit(tx, s, userId, 'OPERATIONS_POLICY', 'SchoolSetting', s, current, clean, 'Policy updated'); return clean; });
    }
    async scopes(s: string, userId: string, data?: any) {
        const actor = await this.access.actor(s, userId, 'staff.attendance.manage');
        if (!actor.admin)
            throw new ForbiddenException('Only school administrators can delegate scopes.');
        if (!data)
            return this.db.staffScopeAssignment.findMany({ where: { schoolId: s } });
        if (typeof data.userId !== 'string' || !await this.db.user.findFirst({ where: { id: data.userId, schoolId: s, status: 'ACTIVE' } }))
            throw new BadRequestException('Choose an active school user.');
        for (const key of ['groupIds', 'classIds', 'sectionIds', 'staffIds', 'departmentValues'])
            if (!Array.isArray(data[key]) || data[key].some((v: any) => typeof v !== 'string'))
                throw new BadRequestException('Scope fields must be arrays.');
        if (data.groupIds.some((g: string) => !validGroups([g])))
            throw new BadRequestException('Invalid compartment.');
        for (const [key, model] of [['classIds', 'schoolClass'], ['sectionIds', 'section'], ['staffIds', 'staff']])
            if (await (this.db as any)[model].count({ where: { schoolId: s, id: { in: data[key] } } }) !== new Set(data[key]).size)
                throw new BadRequestException('Scope must reference this school.');
        const values = {...Object.fromEntries(['groupIds', 'classIds', 'sectionIds', 'staffIds','departmentValues'].map(k => [k, [...new Set(data[k])]])),schoolWide:data.schoolWide===true} as any;
        return operationsTransaction(this.db, async (tx) => { const before = await tx.staffScopeAssignment.findUnique({ where: { schoolId_userId: { schoolId: s, userId: data.userId } } }); const after = await tx.staffScopeAssignment.upsert({ where: { schoolId_userId: { schoolId: s, userId: data.userId } }, create: { schoolId: s, userId: data.userId, ...values }, update: values }); await this.audit(tx, s, userId, 'STAFF_SCOPE', 'StaffScopeAssignment', after.id, before, after, 'Delegation updated'); return after; });
    }
    async leaves(s: string, userId: string, manage = false) {
        let ids: string[];
        if (manage) {
            const { rows } = await this.access.staff(s, userId, 'staff.leave.approve');
            ids = rows.map((r: any) => r.id);
        }
        else
            ids = [(await this.own(s, userId)).id];
        return this.db.staffLeaveRequest.findMany({ where: { schoolId: s, staffId: { in: ids } }, include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' }, take: 200 });
    }
    async requestLeave(s: string, userId: string, data: any) {
        await this.access.actor(s, userId, 'staff.leave.request');
        const own = data.staffId ? null : await this.own(s, userId);
        let staff: any = own;
        if (data.staffId) {
            const { rows } = await this.access.staff(s, userId, 'staff.leave.approve');
            staff = rows.find((r: any) => r.id === data.staffId);
            if (!staff)
                throw new ForbiddenException('Staff member outside your scope.');
        }
        const startDate = attendanceDate(data.startDate), endDate = attendanceDate(data.endDate);
        if (endDate < startDate || +endDate - +startDate > 365 * 86400000)
            throw new BadRequestException('Choose a leave range of up to 366 days.');
        const policy = await this.attendance.policy(s);
        if (!policy.leaveTypes.includes(data.leaveType) || (typeof data.reason !== 'string' || !data.reason.trim()))
            throw new BadRequestException('A configured leave type and reason are required.');
        if (data.halfDay && (!['MORNING', 'AFTERNOON'].includes(data.halfDay) || +startDate !== +endDate))
            throw new BadRequestException('Half-day leave must use one date and a morning/afternoon session.');
        return operationsTransaction(this.db, async (tx) => {
            const existing = await tx.staffLeaveRequest.findMany({ where: { schoolId: s, staffId: staff.id, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: endDate }, endDate: { gte: startDate } } });
            if (existing.some((r: any) => !r.halfDay || !data.halfDay || r.halfDay === data.halfDay))
                throw new ConflictException('A leave request already overlaps these dates.');
            const leave = await tx.staffLeaveRequest.create({ data: { schoolId: s, staffId: staff.id, startDate, endDate, leaveType: data.leaveType, halfDay: data.halfDay || null, reason: data.reason.trim() } });
            await this.audit(tx, s, userId, 'LEAVE_REQUEST', 'StaffLeaveRequest', leave.id, null, leave, data.reason);
            for (const id of await this.managers(tx, s, staff,data.leaveType))
                await this.notify(tx, s, id, 'LEAVE_REQUEST:' + leave.id, 'Leave approval requested', staff.employeeId + ' requested ' + data.leaveType + ' from ' + data.startDate + ' to ' + data.endDate + '.');
            return leave;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    async decideLeave(s: string, userId: string, id: string, data: any) {
        if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(data.status) || !String(data.reason || '').trim())
            throw new BadRequestException('A decision and reason are required.');
        const leave = await operationsTransaction(this.db, async (tx) => {
            const before = await tx.staffLeaveRequest.findFirst({ where: { id, schoolId: s }, include: { staff: true } });
            if (!before)
                throw new NotFoundException('Leave request not found.');
            const actor = await this.access.actor(s, userId, data.status === 'CANCELLED' && before.staff.userId === userId ? undefined : 'staff.leave.approve', tx);
            if (before.staff.userId !== userId && !this.access.matchesStaff(actor, before.staff)) {
                const { rows } = await this.access.staff(s, userId, 'staff.leave.approve', tx);
                if (!rows.some((r: any) => r.id === before.staffId))
                    throw new ForbiddenException('Leave request outside your scope.');
            }
            if (data.status !== 'CANCELLED' && before.staff.userId === userId)
                throw new ForbiddenException('You cannot approve or reject your own leave.');
            const policy = await this.attendance.policy(s, tx);
            const typePolicy=policy.leavePolicies.find((p:any)=>p.leaveType===before.leaveType);const approvers=typePolicy?.approverIds?.length?typePolicy.approverIds:policy.leaveApproverIds;
            if (data.status !== 'CANCELLED' && !actor.admin && approvers.length && !approvers.includes(userId))
                throw new ForbiddenException('You are not in the configured approval workflow.');
            if(before.status===data.status&&['APPROVED','CANCELLED'].includes(data.status))return before;
            if (!['PENDING', 'APPROVED'].includes(before.status) || (before.status === 'APPROVED' && data.status !== 'CANCELLED'))
                throw new ConflictException('Leave already decided.');
            if (data.version != null && data.version !== before.version)
                throw new ConflictException('Leave changed. Refresh.');
            const accounting=this.leaveBalances||new LeaveBalanceService(this.db,this.attendance,this.access,this.coverage);
            const {chargedDays,balanceDebited}=await accounting.applyDecision(tx,s,before,data.status,userId);
            const after = await tx.staffLeaveRequest.update({ where: { id }, data: { status: data.status, approverId: userId, decisionReason: data.reason, decidedAt: new Date(), chargedDays, balanceDebited, version: { increment: 1 } } });
            await this.audit(tx, s, userId, 'LEAVE_' + data.status, 'StaffLeaveRequest', id, before, after, data.reason);
            await this.notify(tx, s, before.staff.userId, 'LEAVE_' + data.status + ':' + id, 'Leave ' + data.status.toLowerCase(), data.reason);
            return after;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
        let retry = false;
        for (let date = new Date(leave.startDate); date <= leave.endDate; date = new Date(+date + 86400000)) {
            try {
                await this.coverage.reconcile(s, date.toISOString().slice(0, 10));
            }
            catch {
                retry = true;
            }
        }
        return { ...leave, coveragePendingRetry: retry };
    }
    async balances(s:string,userId:string,data?:any){const accounting=this.leaveBalances||new LeaveBalanceService(this.db,this.attendance,this.access,this.coverage);return data?accounting.allocate(s,userId,data):accounting.own(s,userId);}
    async leaveLedger(s:string,userId:string,staffId?:string){return(this.leaveBalances||new LeaveBalanceService(this.db,this.attendance,this.access,this.coverage)).ledger(s,userId,staffId);}
    async tasks(s: string, userId: string, dateValue: string, manage = false) { const date = attendanceDate(dateValue), ids = manage ? (await this.access.staff(s, userId, 'operations.tasks.manage')).rows.map((r: any) => r.id) : [(await this.own(s, userId)).id]; return this.db.staffDailyTask.findMany({ where: { schoolId: s, date, staffId: { in: ids } }, include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { startTime: 'asc' } }); }
    async saveTask(s: string, userId: string, data: any) {
        const date = attendanceDate(data.date);
        if ((typeof data.title !== 'string' || !data.title.trim()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.endTime) || data.startTime >= data.endTime || !['NORMAL', 'HIGH', 'URGENT'].includes(data.priority || 'NORMAL'))
            throw new BadRequestException('A title, valid interval and priority are required.');
        return operationsTransaction(this.db, async (tx) => {
            const { rows } = await this.access.staff(s, userId, 'operations.tasks.manage', tx), staff = rows.find((r: any) => r.id === data.staffId);
            if (!staff)
                throw new ForbiddenException('Duty is outside your staff scope.');
            const leaves = await tx.staffLeaveRequest.findMany({ where: { schoolId: s, staffId: staff.id, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } } });
            if (leaves.length) {
                const boundary = (await this.attendance.policy(s, tx)).halfDayBoundary;
                if (leaves.some((leave: any) => overlaps({ startTime: leave.halfDay === 'AFTERNOON' ? boundary : '00:00', endTime: leave.halfDay === 'MORNING' ? boundary : '24:00' }, data)))
                    throw new ConflictException('Staff member is on approved leave during this duty.');
            }
            const c = await this.coverage.context(s, data.date, tx), teacher = c.teachers.find((t: any) => t.staffId === staff.id);
            if (c.holiday)
                throw new ConflictException('School is closed on this date.');
            if (teacher && (unavailableForLesson(c.attendance[teacher.id], data, false) || teacher?.workload?.availableDays?.length && !teacher.workload.availableDays.includes(c.weekday) || teacher && c.availability.some((a: any) => a.teacherId === teacher.id && !a.isAvailable && a.startTime && overlaps(a, data)) || c.unavailable.some((a: any) => a.teacherId === teacher.id && overlaps(a, data)) || c.all.some((lesson: any) => lesson.teacherId === teacher.id && overlaps(lesson, data)) || c.substitutions.some((sub: any) => ['APPROVED', 'SCHEDULED'].includes(sub.status) && sub.substituteTeacherId === teacher.id && c.all.some((t: any) => (t.key === sub.targetKey || t.entryId === sub.timetableEntryId) && overlaps(t, data)))))
                throw new ConflictException('Teacher is absent, unconfirmed, or teaching during this duty.');
            const existing = await tx.staffDailyTask.findMany({ where: { schoolId: s, staffId: staff.id, date, status: { not: 'CANCELLED' } } });
            if (existing.some((task: any) => overlaps(task, data)))
                throw new ConflictException('Duty overlaps another assigned task.');
            const after = await tx.staffDailyTask.create({ data: { schoolId: s, staffId: staff.id, date, title: data.title.trim(), description: data.description || null, priority: data.priority || 'NORMAL', startTime: data.startTime, endTime: data.endTime, actorId: userId } });
            await this.audit(tx, s, userId, 'TASK_ASSIGN', 'StaffDailyTask', after.id, null, after, 'Duty assigned');
            await this.notify(tx, s, staff.userId, 'TASK:' + after.id, 'Daily duty assigned', data.title + ' on ' + data.date + ' ' + data.startTime + '-' + data.endTime);
            return after;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    async taskStatus(s: string, userId: string, id: string, data: any) {
        if (!['COMPLETED', 'CANCELLED', 'ACKNOWLEDGED'].includes(data.status))
            throw new BadRequestException('Invalid task status.');
        return operationsTransaction(this.db, async (tx) => {
            const before = await tx.staffDailyTask.findFirst({ where: { schoolId: s, id }, include: { staff: true } });
            if (!before)
                throw new NotFoundException('Task not found.');
            if (before.staff.userId !== userId || data.status === 'CANCELLED') {
                const { rows } = await this.access.staff(s, userId, 'operations.tasks.manage', tx);
                if (!rows.some((r: any) => r.id === before.staffId))
                    throw new ForbiddenException('Task outside your scope.');
            }
            if (['CANCELLED', 'COMPLETED'].includes(before.status))
                throw new ConflictException('Task already closed.');
            const after = await tx.staffDailyTask.update({ where: { id }, data: { status: data.status, version: { increment: 1 } } });
            await this.audit(tx, s, userId, 'TASK_' + data.status, 'StaffDailyTask', id, before, after, String(data.reason || data.status));
            await this.notify(tx, s, before.staff.userId, 'TASK_' + data.status + ':' + id, 'Duty ' + data.status.toLowerCase(), before.title);
            return after;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    async effective(s: string, userId: string, dateValue: string, q: any = {}) { const actor = await this.access.actor(s, userId, q.own ? undefined : 'timetable.substitution.view'), c = await this.coverage.context(s, dateValue); const teacher = q.own ? c.teachers.find((t: any) => t.userId === userId) : null; return { date: dateValue, holiday: c.holiday, cancelledLessons: c.scheduled.filter((t: any) => c.overrides.some((o: any) => o.timetableEntryId === t.entryId) && (!q.classId || q.classId === t.classId) && (!q.sectionId || q.sectionId === t.sectionId) && (q.own ? teacher?.id === t.teacherId : this.access.matchesTarget(actor, t))).map((t: any) => ({ ...t, status: 'CANCELLED', reason: c.overrides.find((o: any) => o.timetableEntryId === t.entryId)?.reason })), lessons: c.all.filter((t: any) => (!q.classId || q.classId === t.classId) && (!q.sectionId || q.sectionId === t.sectionId) && (!q.academicYearId || q.academicYearId === t.academicYearId) && (!q.groupId || q.groupId === academicGroup({ name: t.className, academicGroup: t.academicGroup })) && (!q.teacherId || q.teacherId === t.teacherId || c.substitutions.some((sub: any) => sub.substituteTeacherId === q.teacherId && sub.targetKey === t.key && ['APPROVED', 'SCHEDULED', 'COMPLETED'].includes(sub.status))) && (q.own ? !!teacher && (t.teacherId === teacher.id || c.substitutions.some((sub: any) => ['APPROVED', 'SCHEDULED', 'COMPLETED'].includes(sub.status) && sub.substituteTeacherId === teacher.id && (sub.targetKey === t.key || sub.timetableEntryId === t.entryId))) : this.access.matchesTarget(actor, t))).map((t: any) => { const sub = c.substitutions.find((sub: any) => ['APPROVED', 'SCHEDULED', 'COMPLETED'].includes(sub.status) && (sub.targetKey === t.key || sub.timetableEntryId === t.entryId)); const unavailable = c.targets.some((x: any) => x.key === t.key); return { ...t, originalTeacherId: t.teacherId, originalTeacherName: c.teacherNames[t.teacherId], teacherId: sub?.substituteTeacherId || t.teacherId, teacherName: c.teacherNames[sub?.substituteTeacherId || t.teacherId], substitutionId: sub?.id, substitutionStatus: sub?.status, acknowledgedAt: sub?.acknowledgedAt, reason: sub?.reason, approvedById: sub?.approvedById, approvedAt: sub?.approvedAt, status: sub ? 'COVERED' : unavailable ? 'UNCOVERED' : 'REGULAR' }; }) }; }
    async myDay(s: string, userId: string, dateValue?: string) { const own = await this.own(s, userId), policy = await this.coverage.policy(s), date = dateValue || localClock(new Date(), policy.timeZone).date; const [effective, attendance, tasks, leaves, notifications, balances] = await Promise.all([this.effective(s, userId, date, { own: true }), this.db.staffAttendance.findUnique({ where: { staffId_date: { staffId: own.id, date: attendanceDate(date) } } }), this.tasks(s, userId, date), this.leaves(s, userId), this.db.notification.findMany({ where: { schoolId: s, OR: [{ recipientId: userId }, { recipientId: null }] }, orderBy: { createdAt: 'desc' }, take: 30 }), this.balances(s, userId)]); const c = await this.coverage.context(s, date), teacher = c.teachers.find((t: any) => t.userId === userId); const intervals = teacher ? [...new Map(c.plans.filter((p: any) => c.all.some((t: any) => t.planId === p.id && t.teacherId === teacher.id)).flatMap((p: any) => p.template.slots.filter((slot: any) => slot.applicableDays.includes(c.weekday) && ['TEACHING', 'SUBJECT'].includes(slot.type)).map((slot: any) => [slot.startTime + ':' + slot.endTime, { startTime: slot.startTime, endTime: slot.endTime }]))).values()] : []; return { timeZone: policy.timeZone, selfAttendanceEnabled:effectiveAttendancePolicy(await this.attendance.policy(s),{...own,user:{profileOptions:await this.db.userSchoolProfileOption.findMany({where:{userId,schoolId:s},select:{optionId:true,value:true}})}}).attendanceMode!=='ADMIN_ONLY', leaveTypes: (await this.attendance.policy(s)).leaveTypes, attendance: effective.holiday ? { ...attendance, status: 'HOLIDAY' } : leaves.some(l => l.status === 'APPROVED' && l.startDate <= attendanceDate(date) && l.endDate >= attendanceDate(date)) ? { ...attendance, status: leaves.some(l => l.status === 'APPROVED' && !l.halfDay && l.startDate <= attendanceDate(date) && l.endDate >= attendanceDate(date)) ? 'ON_LEAVE' : 'HALF_DAY' } : attendance || { status: 'NOT_MARKED' }, ...effective, tasks, leaves, notifications, balances, freePeriods: intervals.filter((slot: any) => !c.unavailable.some((a: any) => a.teacherId === teacher?.id && overlaps(a, slot)) && !unavailableForLesson(c.attendance[teacher?.id], slot, false) && !effective.lessons.some((lesson: any) => lesson.teacherId === teacher?.id && overlaps(slot, lesson)) && !tasks.some(task => task.status !== 'CANCELLED' && overlaps(slot, task))) }; }
    async overview(s: string, userId: string, date: string, q: any = {}) { const actor = await this.access.actor(s, userId, 'operations.dashboard.view'); const roster = await this.attendance.roster(s, userId, date), c = await this.coverage.list(s, date), effective = await this.effective(s, userId, date, q); const departments = [...new Set(roster.rows.map((r: any) => r.department).filter(Boolean))]; const memberships = (await this.access.staff(s, userId, 'operations.dashboard.view')).rows; const filteredRows = roster.rows.filter((r: any) => { const profile = memberships.find((m: any) => m.id === r.staffId)?.user?.teacher; const allocations = (profile?.academicAssignments || []).filter((a: any) => !q.academicYearId || a.academicYearId === q.academicYearId); return (!q.department || r.department === q.department) && (!q.teacherId || profile?.id === q.teacherId) && (!q.classId || allocations.some((a: any) => a.classId === q.classId) || (profile?.timetableEligibility as any)?.groupResponsibilities?.some((row: any) => row.classIds?.includes(q.classId))) && (!q.sectionId || allocations.some((a: any) => a.sectionId === q.sectionId)) && (!q.groupId || (profile?.timetableEligibility as any)?.groupResponsibilities?.some((row: any) => row.groupId === q.groupId && row.subjectIds.length) || allocations.some((a: any) => academicGroup(a.schoolClass) === q.groupId)); }); const allowedIds = new Set(filteredRows.map((r: any) => r.staffId)), teachers = c.teachers.filter((t: any) => allowedIds.has(t.staffId)), covers = c.covers.filter((sub: any) => sub.target && this.access.matchesTarget(actor, sub.target) && (!q.department || teachers.some((t: any) => t.id === sub.originalTeacherId)) && (!q.academicYearId || q.academicYearId === sub.target.academicYearId) && (!q.classId || q.classId === sub.target.classId) && (!q.sectionId || q.sectionId === sub.target.sectionId) && (!q.groupId || q.groupId === academicGroup({ name: sub.target.className, academicGroup: sub.target.academicGroup })) && (!q.teacherId || q.teacherId === sub.originalTeacherId || q.teacherId === sub.substituteTeacherId)); return { date, departments, attendance: Object.fromEntries(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'ON_DUTY', 'NOT_MARKED', 'HOLIDAY', 'WEEKLY_OFF'].map(status => [status, filteredRows.filter((r: any) => r.attendance.status === status).length])), totalStaff: filteredRows.length, teachers, covers, lessons: effective.lessons, pendingLeaves: (await this.leaves(s, userId, true)).filter((l: any) => allowedIds.has(l.staffId)), tasks: (await this.tasks(s, userId, date, true)).filter((t: any) => allowedIds.has(t.staffId)) }; }
    async override(s: string, userId: string, data: any) {
        const reason = typeof data.reason === 'string' ? data.reason.trim() : '', date = attendanceDate(data.date);
        if (!reason || !['CANCELLED', 'RESTORED'].includes(data.status))
            throw new BadRequestException('A cancellation/restoration state and reason are required.');
        return operationsTransaction(this.db, async (tx) => {
            const actor = await this.access.actor(s, userId, 'timetable.substitution.cancel', tx), entry = await tx.timetableEntry.findFirst({ where: { id: data.timetableEntryId, schoolId: s, timetablePlan: { status: 'PUBLISHED' } }, include: { schoolClass: true } });
            if (!entry || !this.access.matchesTarget(actor, { classId: entry.classId, sectionId: entry.sectionId, className: entry.schoolClass.name, academicGroup: entry.schoolClass.academicGroup }))
                throw new ForbiddenException('Published lesson outside your scope.');
            const where = { schoolId_timetableEntryId_date: { schoolId: s, timetableEntryId: entry.id, date } }, before = await tx.dailyTimetableOverride.findUnique({ where }), after = await tx.dailyTimetableOverride.upsert({ where, create: { schoolId: s, timetableEntryId: entry.id, date, status: data.status, reason, actorId: userId }, update: { status: data.status, reason, actorId: userId } });
            await this.audit(tx, s, userId, 'DAILY_OVERRIDE', 'DailyTimetableOverride', after.id, before, after, reason);
            return after;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
}
