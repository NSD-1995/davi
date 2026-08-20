export class CreateTimePeriodDto { name!: string; startTime!: string; endTime!: string; sortOrder!: number; isBreak?: boolean; }
export class CreateTimetableEntryDto { academicYearId!: string; classId!: string; sectionId!: string; subjectId!: string; teacherId!: string; periodId!: string; weekday!: number; room?: string; }
