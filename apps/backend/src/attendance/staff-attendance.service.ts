import {attendanceDefaults,effectiveAttendancePolicy} from './attendance-policy';
import { operationsTransaction } from './operations-transaction';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OperationsAccessService } from '../auth/operations-access.service';
import { CoverageService, attendanceDate, localClock } from '../timetable/coverage.service';
export const staffStatuses = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'ON_DUTY', 'NOT_MARKED', 'HOLIDAY', 'WEEKLY_OFF', 'PERMISSION'];
export const defaultOperationsPolicy = { ...attendanceDefaults,selfAttendanceEnabled: false, departmentOptionId: null as string | null, workingDays: [1, 2, 3, 4, 5], halfDayBoundary: '13:00', leaveTypes: ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Emergency Leave', 'Half-Day Leave', 'Unpaid Leave', 'Compensatory Off', 'Other'], leaveApproverIds: [] as string[] };
export const snapshot = (row: any) => row ? JSON.parse(JSON.stringify(row)) : null;
@Injectable()
export class StaffAttendanceService {
    private async absenceNotifications(tx:any,s:string,userId:string,rows:any[],records:any[]) {
        if(!records.length)return;
        const policy=await this.coverage.policy(s,tx);
        const admins=await tx.userRole.findMany({where:{schoolId:s,role:{isActive:true,code:'SCHOOL_ADMIN'},user:{status:'ACTIVE'}},select:{userId:true}});
        for(const recipientId of new Set<string>([...admins.map((r:any)=>r.userId),...(policy.inChargeUserIds||[])])) {
            let actor:any;
            try{actor=await this.access.actor(s,recipientId,'staff.attendance.view',tx);}catch{continue;}
            for(const record of records) {
                const staff=rows.find(r=>r.id===record.staffId);
                if(!staff||!this.access.matchesStaff(actor,staff))continue;
                const dedupeKey='STAFF_ABSENCE:'+record.id+':'+record.version+':'+recipientId;
                await tx.notification.upsert({where:{schoolId_dedupeKey:{schoolId:s,dedupeKey}},create:{schoolId:s,recipientId,dedupeKey,channel:'IN_APP',title:'Staff unavailability confirmed',message:staff.user.firstName+' '+staff.user.lastName+' - '+record.status+' on '+record.date.toISOString().slice(0,10)+'. Review attendance and any affected duties.',status:'SENT',sentAt:new Date()},update:{}});
            }
        }
    }
    constructor(private readonly db: PrismaService, private readonly access: OperationsAccessService, private readonly coverage: CoverageService) { }
    async policy(s:string,client:any=this.db){const setting=await client.schoolSetting.findUnique({where:{schoolId:s}});const stored=(setting?.operationsPolicy||{}) as any;const legacy=(setting?.coveragePolicy||{}) as any;return{...defaultOperationsPolicy,...(!stored.checkInTime&&legacy.checkInDeadline?{checkInTime:legacy.checkInDeadline,lateGraceMinutes:0}:{}),...stored};}
    async calendar(s: string, dateValue: string, client: any = this.db) { const date = attendanceDate(dateValue), policy = await this.coverage.policy(s), ops = await this.policy(s, client); const events = await client.schoolEvent.findMany({ where: { schoolId: s, status: 'ACTIVE', eventType: { in: ['HOLIDAY', 'SCHOOL_CLOSURE'], mode: 'insensitive' } } }); const holiday = events.some((event: any) => { const start = localClock(event.startsAt, policy.timeZone).date, end = localClock(event.endsAt || event.startsAt, policy.timeZone).date; return start <= dateValue && dateValue <= end; }); return { date, holiday, weeklyOff: !ops.workingDays.includes(date.getUTCDay() || 7), policy: ops, timeZone: policy.timeZone }; }
    async roster(s: string, userId: string, dateValue: string) { const { rows } = await this.access.staff(s, userId, 'staff.attendance.view'); const calendar = await this.calendar(s, dateValue); const [records, day, leaves, punches] = await Promise.all([this.db.staffAttendance.findMany({ where: { schoolId: s, date: calendar.date, staffId: { in: rows.map((r: any) => r.id) } } }), this.db.staffAttendanceDay.findUnique({ where: { schoolId_date: { schoolId: s, date: calendar.date } } }), this.db.staffLeaveRequest.findMany({ where: { schoolId: s, status: 'APPROVED', staffId: { in: rows.map((r: any) => r.id) }, startDate: { lte: calendar.date }, endDate: { gte: calendar.date } } }),this.db.attendancePunch.findMany({where:{schoolId:s,date:calendar.date,staffId:{in:rows.map((r:any)=>r.id)},kind:'CHECK_OUT',earlyDeparture:true},select:{staffId:true}})]); return { date: dateValue, timeZone: calendar.timeZone, locked: day?.locked || false, calendarStatus: calendar.holiday ? 'HOLIDAY' : calendar.weeklyOff ? 'WEEKLY_OFF' : 'WORKING', rows: rows.map((staff: any) => { const stored = records.find(r => r.staffId === staff.id),record=stored&&['AUTO_CHECKIN','AUTO_EXPECTED_ARRIVAL'].includes(stored.source)?{...stored,status:'NOT_MARKED'}:stored, leave = leaves.find(r => r.staffId === staff.id), availableDays = (staff.user.teacher?.timetableWorkload as any)?.availableDays, off = !effectiveAttendancePolicy(calendar.policy,staff).workingDays.includes(calendar.date.getUTCDay()||7) || (availableDays?.length && !availableDays.includes(calendar.date.getUTCDay() || 7)); return { staffId: staff.id, staffCategory:staff.staffCategory, userId: staff.userId, employeeId: staff.employeeId, designation: staff.user.profileOptions?.find((p:any)=>p.optionId===calendar.policy.designationOptionId)?.value||null, department: staff.user.profileOptions?.find((p: any) => p.optionId === calendar.policy.departmentOptionId)?.value || null, name: staff.user.firstName + ' ' + staff.user.lastName, approvedLeave: leave || null, earlyDeparture:punches.some(p=>p.staffId===staff.id), attendance: leave && !calendar.holiday && !off ? { ...record, status: leave.halfDay ? 'HALF_DAY' : 'ON_LEAVE', version: record?.version || 0 } : record || { status: calendar.holiday ? 'HOLIDAY' : off ? 'WEEKLY_OFF' : 'NOT_MARKED', version: 0 } }; }) }; }
    async bulk(s: string, userId: string, data: any, source = 'MANUAL', transactionClient?:any) {
        if (!data || !Array.isArray(data.records) || !data.records.length || data.records.length > 1000)
            throw new BadRequestException('Provide 1 to 1000 staff attendance records.');
        const isSelf = source.startsWith('SELF_');
        const date = attendanceDate(data.date), ids = data.records.map((r: any) => r?.staffId);
        if (ids.some((id: any) => typeof id !== 'string') || new Set(ids).size !== ids.length)
            throw new BadRequestException('Each staff ID must be unique.');
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const persist = async (tx:any) => {
                    const { actor, rows } = await this.access.staff(s, userId, isSelf ? undefined as any : 'staff.attendance.mark', tx);
                    if (ids.some((id: string) => !rows.some((r: any) => r.id === id) && !(isSelf && actor.userId === rows.find((r: any) => r.id === id)?.userId)))
                        throw new ForbiddenException('Attendance is outside your assigned scope.');
                    if (isSelf && source === 'SELF_CHECKIN') {
                        const cal = await this.calendar(s, data.date, tx);
                        const selfPolicy=effectiveAttendancePolicy(await this.policy(s,tx),rows.find((r:any)=>r.id===ids[0]));
                        if (cal.holiday || !selfPolicy.workingDays.includes(cal.date.getUTCDay()||7))
                            throw new ConflictException('Self attendance is unavailable on school holidays or weekly offs.');
                        const leaves = await tx.staffLeaveRequest.findMany({ where: { schoolId: s, staffId: { in: ids }, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } } });
                        const clock = localClock(new Date(data.records[0].checkIn), cal.timeZone);
                        if (leaves.some((l: any) => !l.halfDay || (l.halfDay === 'MORNING' ? clock.time < cal.policy.halfDayBoundary : clock.time >= cal.policy.halfDayBoundary)))
                            throw new ConflictException('Approved leave blocks check-in during this interval.');
                    }
                    const day = await tx.staffAttendanceDay.findUnique({ where: { schoolId_date: { schoolId: s, date } } });
                    if (day?.locked)
                        throw new ConflictException('Attendance is locked. An authorized manager must reopen it with a reason.');
                    const saved = [], confirmedAbsences:any[]=[];
                    for (const item of data.records) {
                        if((item.remarks!=null&&typeof item.remarks!=='string')||(item.reason!=null&&typeof item.reason!=='string')||(data.reason!=null&&typeof data.reason!=='string'))throw new BadRequestException('Remarks and reasons must be text.');
                        if (!staffStatuses.includes(item.status))
                            throw new BadRequestException('Invalid staff attendance status.');
                        const member=rows.find((r:any)=>r.id===item.staffId);const staffPolicy=effectiveAttendancePolicy(await this.policy(s,tx),member);
                        if(!isSelf&&staffPolicy.attendanceMode==='STAFF_SELF'){if(!staffPolicy.adminOverridesEnabled)throw new ForbiddenException('Manual overrides are disabled by school policy.');await this.access.actor(s,userId,'staff.attendance.override',tx);if(!String(item.reason||data.reason||'').trim())throw new BadRequestException('A reason is required for a manual exception to self attendance.');}
                        const previous = await tx.staffAttendance.findUnique({ where: { staffId_date: { staffId: item.staffId, date } } });
                        if (item.version != null && item.version !== (previous?.version || 0))
                            throw new ConflictException('Attendance changed. Refresh before saving.');
                        const reason = String(item.reason || data.reason || '').trim();
                        if(previous&&!isSelf&&!staffPolicy.adminOverridesEnabled)throw new ForbiddenException('Attendance corrections are disabled by school policy.');
                        if (previous && !isSelf) {
                            await this.access.actor(s, userId, 'staff.attendance.override', tx);
                            if (!reason)
                                throw new BadRequestException('A correction reason is required.');
                        }
                        if (isSelf && previous && ['ABSENT', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'].includes(previous.status) && !['AUTO_CHECKIN', 'AUTO_EXPECTED_ARRIVAL'].includes(previous.source))
                            throw new ConflictException('Ask an attendance manager to correct your confirmed status.');
                        const checkIn = item.checkIn === undefined ? previous?.checkIn || null : item.checkIn ? new Date(item.checkIn) : null, checkOut = item.checkOut === undefined ? previous?.checkOut || null : item.checkOut ? new Date(item.checkOut) : null;
                        if ((checkIn && isNaN(+checkIn)) || (checkOut && isNaN(+checkOut)) || (checkOut && (!checkIn || checkOut < checkIn)))
                            throw new BadRequestException('Check-out must follow a valid check-in.');
                        for (const stamp of [checkIn, checkOut])
                            if (stamp && localClock(stamp, (await this.coverage.policy(s)).timeZone).date !== data.date)
                                throw new BadRequestException('Check-in and check-out must fall on the school attendance date.');
                        if (item.expectedArrivalTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.expectedArrivalTime))
                            throw new BadRequestException('Invalid expected arrival time.');
                        if (item.status === 'HALF_DAY' && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.unavailableFrom) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.unavailableUntil) || item.unavailableFrom >= item.unavailableUntil))
                            throw new BadRequestException('Half-day attendance needs a confirmed unavailable interval.');
                        const values = { unavailableFrom: item.status === 'HALF_DAY' ? item.unavailableFrom : null, unavailableUntil: item.status === 'HALF_DAY' ? item.unavailableUntil : null, status: item.status, checkIn, checkOut, source, remarks: item.remarks ?? previous?.remarks ?? null, expectedArrivalTime: item.expectedArrivalTime ?? previous?.expectedArrivalTime ?? null, markedById: userId, markedAt: new Date() };
                        const record = await tx.staffAttendance.upsert({ where: { staffId_date: { staffId: item.staffId, date } }, create: { schoolId: s, staffId: item.staffId, date, ...values }, update: { ...values, version: { increment: 1 } } });
                        await tx.staffAttendanceAudit.create({ data: { schoolId: s, staffId: item.staffId, date, actorId: userId, reason: reason || (isSelf ? source === 'SELF_CHECKOUT' ? 'Staff self check-out' : 'Staff self check-in' : 'Initial attendance marking'), ...(previous ? { before: snapshot(previous) } : {}), after: snapshot(record) } });
                        saved.push(record);
                        if(['ABSENT','HALF_DAY','ON_LEAVE'].includes(record.status)&&(!previous||previous.status!==record.status||previous.unavailableFrom!==record.unavailableFrom||previous.unavailableUntil!==record.unavailableUntil))confirmedAbsences.push(record);
                    }
                    await this.absenceNotifications(tx,s,userId,rows,confirmedAbsences);
                    return saved;
                };
                const result=transactionClient?await persist(transactionClient):await operationsTransaction(this.db,persist,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
                if(transactionClient)return{records:result,coverage:{status:'PENDING_RETRY'}};
                let coverage: any;
                try {
                    coverage = await this.coverage.reconcile(s, data.date);
                }
                catch {
                    coverage = { status: 'PENDING_RETRY', message: 'Attendance saved; cover reassessment will retry.' };
                }
                return { records: result, coverage };
            }
            catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 2)
                    continue;
                throw error;
            }
        }
    }
    async lock(s: string, userId: string, data: any) { const actor = await this.access.actor(s, userId, 'staff.attendance.manage'); if (!actor.admin)
        throw new ForbiddenException('Daily school-wide locking requires a school administrator.'); const date = attendanceDate(data.date); if (typeof data.locked !== 'boolean' || !String(data.reason || '').trim())
        throw new BadRequestException('A lock state and reason are required.'); return operationsTransaction(this.db, async (tx) => { const before = await tx.staffAttendanceDay.findUnique({ where: { schoolId_date: { schoolId: s, date } } }); const after = await tx.staffAttendanceDay.upsert({ where: { schoolId_date: { schoolId: s, date } }, create: { schoolId: s, date, locked: data.locked, actorId: userId, reason: data.reason }, update: { locked: data.locked, actorId: userId, reason: data.reason } }); await tx.auditLog.create({ data: { schoolId: s, actorId: userId, action: data.locked ? 'ATTENDANCE_LOCK' : 'ATTENDANCE_REOPEN', method: 'POST', path: '/attendance/staff/lock', entityType: 'StaffAttendanceDay', entityId: after.id, metadata: { before: snapshot(before), after: snapshot(after) } } }); return after; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    async history(s: string, userId: string, staffId: string, from: string, to: string) { const { rows } = await this.access.staff(s, userId, 'staff.attendance.view'); if (!rows.some((r: any) => r.id === staffId))
        throw new ForbiddenException('Staff member outside your scope.'); const start = attendanceDate(from), end = attendanceDate(to); if (end < start || +end - +start > 366 * 86400000)
        throw new BadRequestException('Choose a range of up to one year.'); return this.db.staffAttendanceAudit.findMany({ where: { schoolId: s, staffId, date: { gte: start, lte: end } }, orderBy: { createdAt: 'desc' }, take: 1000 }); }
}
