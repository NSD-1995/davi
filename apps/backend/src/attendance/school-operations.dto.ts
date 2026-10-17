import {MarkStaffAttendanceDto} from './attendance.dto';
export class BulkStaffAttendanceDto {
  date!: string;
  reason?: string;
  records!: Omit<MarkStaffAttendanceDto, 'date'>[];
}
export class AttendanceLockDto {
  date!: string;
  locked!: boolean;
  reason!: string;
}
export class StaffLeaveRequestDto {
  staffId?: string;
  leaveType!: string;
  startDate!: string;
  endDate!: string;
  halfDay?: 'MORNING' | 'AFTERNOON';
  reason!: string;
}
export class LeaveDecisionDto {
  status!: 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason!: string;
  version?: number;
}
export class DailyTaskDto {
  staffId!: string;
  date!: string;
  title!: string;
  description?: string;
  startTime!: string;
  endTime!: string;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
}
export class DailyOverrideDto {
  date!: string;
  timetableEntryId!: string;
  status!: 'CANCELLED' | 'RESTORED';
  reason!: string;
}
