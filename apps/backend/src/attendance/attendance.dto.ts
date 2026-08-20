export class StudentAttendanceItemDto { enrollmentId!: string; status!: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; remarks?: string; }
export class MarkStudentAttendanceDto { date!: string; records!: StudentAttendanceItemDto[]; }
export class MarkStaffAttendanceDto { staffId!: string; date!: string; status!: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE'; checkIn?: string; checkOut?: string; remarks?: string; }
