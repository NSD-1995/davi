export class CreateExamDto { academicYearId!: string; name!: string; type!: string; startDate?: string; endDate?: string; }
export class AddExamSubjectDto { classId!: string; subjectId!: string; examDate?: string; maximumMarks!: number; passingMarks!: number; }
export class MarkItemDto { enrollmentId!: string; marksObtained?: number; isAbsent?: boolean; remarks?: string; }
export class EnterMarksDto { records!: MarkItemDto[]; }
