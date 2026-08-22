export type ResponsibilityType = 'LEAD_TEACHER' | 'ASSISTANT_TEACHER' | 'SUBJECT_TEACHER' | 'ACTIVITY_TEACHER' | 'CO_TEACHER' | 'VISITING_TEACHER' | 'SUBSTITUTE_TEACHER';
export type SubjectAssignmentRole = 'PRIMARY' | 'SUPPORT' | 'SUBSTITUTE';
export class ReplaceTeachingTeamDto { members!: Array<{ staffId: string; responsibilityType: ResponsibilityType }>; }
export class ReplaceSubjectTeachersDto { assignments!: Array<{ subjectId: string; staffId: string; assignmentRole: SubjectAssignmentRole }>; }
