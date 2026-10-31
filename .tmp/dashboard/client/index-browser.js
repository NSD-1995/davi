
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.SchoolScalarFieldEnum = {
  id: 'id',
  name: 'name',
  shortName: 'shortName',
  slug: 'slug',
  address: 'address',
  city: 'city',
  state: 'state',
  country: 'country',
  phone: 'phone',
  email: 'email',
  website: 'website',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  code: 'code',
  description: 'description',
  isSystem: 'isSystem',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  code: 'code',
  module: 'module',
  action: 'action',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RolePermissionScalarFieldEnum = {
  roleId: 'roleId',
  permissionId: 'permissionId'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  email: 'email',
  username: 'username',
  passwordHash: 'passwordHash',
  firstName: 'firstName',
  lastName: 'lastName',
  phone: 'phone',
  avatarUrl: 'avatarUrl',
  status: 'status',
  mustChangePassword: 'mustChangePassword',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserRoleScalarFieldEnum = {
  userId: 'userId',
  roleId: 'roleId',
  schoolId: 'schoolId',
  assignedAt: 'assignedAt'
};

exports.Prisma.SchoolSettingScalarFieldEnum = {
  branding: 'branding',
  analyticsPolicy: 'analyticsPolicy',
  assessmentAiPolicy: 'assessmentAiPolicy',
  studentImportPolicy: 'studentImportPolicy',
  sectionCapacityPolicy: 'sectionCapacityPolicy',
  admissionsPolicy: 'admissionsPolicy',
  id: 'id',
  schoolId: 'schoolId',
  schoolName: 'schoolName',
  timezone: 'timezone',
  language: 'language',
  gradingSystem: 'gradingSystem',
  timetableRules: 'timetableRules',
  attendancePolicy: 'attendancePolicy',
  examPolicy: 'examPolicy',
  notificationEmail: 'notificationEmail',
  logoUrl: 'logoUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  operationsPolicy: 'operationsPolicy',
  coveragePolicy: 'coveragePolicy'
};

exports.Prisma.AnalyticsSnapshotScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  actorId: 'actorId',
  permissionKey: 'permissionKey',
  filters: 'filters',
  data: 'data',
  asOf: 'asOf',
  expiresAt: 'expiresAt'
};

exports.Prisma.AnalyticsExportJobScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  actorId: 'actorId',
  snapshotId: 'snapshotId',
  format: 'format',
  template: 'template',
  options: 'options',
  status: 'status',
  fileKey: 'fileKey',
  size: 'size',
  error: 'error',
  leaseToken: 'leaseToken',
  leaseUntil: 'leaseUntil',
  attempts: 'attempts',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  expiresAt: 'expiresAt'
};

exports.Prisma.AnalyticsAttentionCaseScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  enrollmentId: 'enrollmentId',
  indicator: 'indicator',
  evidence: 'evidence',
  severity: 'severity',
  ownerId: 'ownerId',
  status: 'status',
  dueDate: 'dueDate',
  revision: 'revision',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AnalyticsCaseEventScalarFieldEnum = {
  id: 'id',
  caseId: 'caseId',
  actorId: 'actorId',
  action: 'action',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.AcademicYearScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  startDate: 'startDate',
  endDate: 'endDate',
  isCurrent: 'isCurrent',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SchoolClassScalarFieldEnum = {
  academicGroup: 'academicGroup',
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  name: 'name',
  code: 'code',
  capacity: 'capacity',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SectionScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  name: 'name',
  capacity: 'capacity',
  room: 'room',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubjectScalarFieldEnum = {
  academicGroups: 'academicGroups',
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  code: 'code',
  description: 'description',
  type: 'type',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  userId: 'userId',
  employeeId: 'employeeId',
  staffCategory: 'staffCategory',
  staffCategoryId: 'staffCategoryId',
  joiningDate: 'joiningDate',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffCategoryDefinitionScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  classification: 'classification',
  createdAt: 'createdAt'
};

exports.Prisma.AcademicYearSubjectScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  subjectId: 'subjectId',
  createdAt: 'createdAt'
};

exports.Prisma.ClassSubjectScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  subjectId: 'subjectId',
  isMandatory: 'isMandatory',
  requiredPeriodsPerWeek: 'requiredPeriodsPerWeek',
  preferredPeriod: 'preferredPeriod',
  preferredTimeOfDay: 'preferredTimeOfDay',
  maxPeriodsPerDay: 'maxPeriodsPerDay',
  maxConsecutive: 'maxConsecutive',
  requiresConsecutive: 'requiresConsecutive',
  displayOrder: 'displayOrder',
  effectiveFrom: 'effectiveFrom',
  effectiveTo: 'effectiveTo',
  isActive: 'isActive',
  configVersion: 'configVersion',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  preferredPeriods: 'preferredPeriods',
  avoidPeriods: 'avoidPeriods',
  allowConsecutive: 'allowConsecutive',
  preferredTeacherIds: 'preferredTeacherIds',
  eligibleTeacherIds: 'eligibleTeacherIds'
};

exports.Prisma.SchoolProfileOptionScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  key: 'key',
  label: 'label',
  type: 'type',
  description: 'description',
  isRequired: 'isRequired',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserSchoolProfileOptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  schoolId: 'schoolId',
  optionId: 'optionId',
  value: 'value',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  studentCode: 'studentCode',
  gradeLevel: 'gradeLevel',
  birthDate: 'birthDate',
  gender: 'gender',
  status: 'status',
  createdAt: 'createdAt'
};

exports.Prisma.StudentEnrollmentScalarFieldEnum = {
  address: 'address',
  admissionDate: 'admissionDate',
  version: 'version',
  id: 'id',
  schoolId: 'schoolId',
  studentId: 'studentId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  rollNumber: 'rollNumber',
  admissionNumber: 'admissionNumber',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentAttendanceScalarFieldEnum = {
  classIdSnapshot: 'classIdSnapshot',
  sectionIdSnapshot: 'sectionIdSnapshot',
  id: 'id',
  schoolId: 'schoolId',
  enrollmentId: 'enrollmentId',
  date: 'date',
  status: 'status',
  remarks: 'remarks',
  markedById: 'markedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffAttendanceScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  staffId: 'staffId',
  date: 'date',
  status: 'status',
  checkIn: 'checkIn',
  checkOut: 'checkOut',
  remarks: 'remarks',
  source: 'source',
  unavailableFrom: 'unavailableFrom',
  unavailableUntil: 'unavailableUntil',
  markedAt: 'markedAt',
  version: 'version',
  expectedArrivalTime: 'expectedArrivalTime',
  markedById: 'markedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TeacherScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  schoolId: 'schoolId',
  teacherCode: 'teacherCode',
  specialization: 'specialization',
  qualification: 'qualification',
  hireDate: 'hireDate',
  status: 'status',
  createdAt: 'createdAt',
  timetableEligibility: 'timetableEligibility',
  capableSubjectIds: 'capableSubjectIds',
  timetableWorkload: 'timetableWorkload'
};

exports.Prisma.TeacherAcademicAssignmentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  teacherId: 'teacherId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  subjectId: 'subjectId',
  isClassTeacher: 'isClassTeacher',
  responsibilityType: 'responsibilityType',
  assignmentRole: 'assignmentRole',
  isActive: 'isActive',
  startDate: 'startDate',
  endDate: 'endDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TimePeriodScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  startTime: 'startTime',
  endTime: 'endTime',
  sortOrder: 'sortOrder',
  isBreak: 'isBreak',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TimetableEntryScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  subjectId: 'subjectId',
  teacherId: 'teacherId',
  periodId: 'periodId',
  periodSlotId: 'periodSlotId',
  timetableDate: 'timetableDate',
  timetablePlanId: 'timetablePlanId',
  conflictCode: 'conflictCode',
  isAffected: 'isAffected',
  weekday: 'weekday',
  room: 'room',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubjectTimetableRequirementScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  subjectId: 'subjectId',
  primaryTeacherId: 'primaryTeacherId',
  weeklyPeriods: 'weeklyPeriods',
  preferredSequences: 'preferredSequences',
  maxConsecutive: 'maxConsecutive',
  requiresConsecutive: 'requiresConsecutive',
  configVersion: 'configVersion',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TeacherAvailabilityScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  teacherId: 'teacherId',
  weekday: 'weekday',
  periodSlotId: 'periodSlotId',
  isAvailable: 'isAvailable',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TimetablePlanScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  templateId: 'templateId',
  status: 'status',
  version: 'version',
  supervisionEntries: 'supervisionEntries',
  subjectConfigFingerprint: 'subjectConfigFingerprint',
  generatedAt: 'generatedAt',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PeriodTimingTemplateScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  familyId: 'familyId',
  name: 'name',
  description: 'description',
  workingDays: 'workingDays',
  schoolStartTime: 'schoolStartTime',
  schoolEndTime: 'schoolEndTime',
  effectiveFrom: 'effectiveFrom',
  effectiveTo: 'effectiveTo',
  status: 'status',
  version: 'version',
  createdById: 'createdById',
  updatedById: 'updatedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PeriodTimingSlotScalarFieldEnum = {
  id: 'id',
  templateId: 'templateId',
  name: 'name',
  type: 'type',
  sequence: 'sequence',
  startTime: 'startTime',
  endTime: 'endTime',
  applicableDays: 'applicableDays',
  shortCode: 'shortCode',
  attendanceEnabled: 'attendanceEnabled',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PeriodTemplateAssignmentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  templateId: 'templateId',
  classId: 'classId',
  sectionId: 'sectionId',
  effectiveFrom: 'effectiveFrom',
  effectiveTo: 'effectiveTo',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.HomeworkScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  subjectId: 'subjectId',
  title: 'title',
  description: 'description',
  dueAt: 'dueAt',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.HomeworkSubmissionScalarFieldEnum = {
  id: 'id',
  homeworkId: 'homeworkId',
  enrollmentId: 'enrollmentId',
  status: 'status',
  submittedAt: 'submittedAt',
  score: 'score',
  feedback: 'feedback',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LessonPlanScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  subjectId: 'subjectId',
  title: 'title',
  objectives: 'objectives',
  content: 'content',
  scheduledDate: 'scheduledDate',
  syllabusUnit: 'syllabusUnit',
  coveragePercent: 'coveragePercent',
  status: 'status',
  approvalComment: 'approvalComment',
  syllabusTopicId: 'syllabusTopicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AiGenerationScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  userId: 'userId',
  feature: 'feature',
  model: 'model',
  promptVersion: 'promptVersion',
  input: 'input',
  output: 'output',
  status: 'status',
  inputTokens: 'inputTokens',
  outputTokens: 'outputTokens',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SyllabusScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  subjectId: 'subjectId',
  termId: 'termId',
  version: 'version',
  status: 'status',
  storageKey: 'storageKey',
  fileName: 'fileName',
  fileHash: 'fileHash',
  extractionWarning: 'extractionWarning',
  uploadedById: 'uploadedById',
  approvedById: 'approvedById',
  approvedAt: 'approvedAt',
  reviewedAt: 'reviewedAt',
  supersededById: 'supersededById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SchoolTermScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  name: 'name',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt'
};

exports.Prisma.SyllabusLessonScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  subjectId: 'subjectId',
  termId: 'termId',
  syllabusId: 'syllabusId',
  title: 'title',
  sortOrder: 'sortOrder'
};

exports.Prisma.SyllabusTopicScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  subjectId: 'subjectId',
  termId: 'termId',
  syllabusId: 'syllabusId',
  lessonId: 'lessonId',
  title: 'title',
  sortOrder: 'sortOrder'
};

exports.Prisma.ClassAnnouncementScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  title: 'title',
  message: 'message',
  audience: 'audience',
  status: 'status',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TimetableSubstitutionScalarFieldEnum = {
  approvedById: 'approvedById',
  approvedAt: 'approvedAt',
  acknowledgedAt: 'acknowledgedAt',
  notifiedAt: 'notifiedAt',
  version: 'version',
  id: 'id',
  schoolId: 'schoolId',
  timetableEntryId: 'timetableEntryId',
  timetablePlanId: 'timetablePlanId',
  periodSlotId: 'periodSlotId',
  targetKey: 'targetKey',
  originalTeacherId: 'originalTeacherId',
  date: 'date',
  substituteTeacherId: 'substituteTeacherId',
  source: 'source',
  candidateTeacherIds: 'candidateTeacherIds',
  reason: 'reason',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AssessmentPatternScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  scopeKey: 'scopeKey',
  name: 'name',
  version: 'version',
  config: 'config',
  createdBy: 'createdBy',
  createdAt: 'createdAt'
};

exports.Prisma.AssessmentObservationScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  examId: 'examId',
  enrollmentId: 'enrollmentId',
  competencyKey: 'competencyKey',
  rating: 'rating',
  observedOn: 'observedOn',
  remarks: 'remarks',
  evidence: 'evidence',
  actorId: 'actorId',
  requestKey: 'requestKey',
  createdAt: 'createdAt'
};

exports.Prisma.AssessmentReportScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  examId: 'examId',
  enrollmentId: 'enrollmentId',
  version: 'version',
  snapshot: 'snapshot',
  publishedAt: 'publishedAt'
};

exports.Prisma.ExamScalarFieldEnum = {
  assessmentSectionId: 'assessmentSectionId',
  assessmentPatternId: 'assessmentPatternId',
  assessmentConfig: 'assessmentConfig',
  assessmentScope: 'assessmentScope',
  assessmentRoster: 'assessmentRoster',
  termKey: 'termKey',
  revision: 'revision',
  reviewedBy: 'reviewedBy',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  name: 'name',
  type: 'type',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ExamSubjectScalarFieldEnum = {
  id: 'id',
  examId: 'examId',
  classId: 'classId',
  subjectId: 'subjectId',
  examDate: 'examDate',
  maximumMarks: 'maximumMarks',
  passingMarks: 'passingMarks',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentMarkScalarFieldEnum = {
  componentScores: 'componentScores',
  assessmentState: 'assessmentState',
  revision: 'revision',
  locationSnapshotted: 'locationSnapshotted',
  sectionIdSnapshot: 'sectionIdSnapshot',
  id: 'id',
  examSubjectId: 'examSubjectId',
  enrollmentId: 'enrollmentId',
  marksObtained: 'marksObtained',
  isAbsent: 'isAbsent',
  remarks: 'remarks',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdmissionEnquiryScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  number: 'number',
  studentName: 'studentName',
  parentName: 'parentName',
  mobile: 'mobile',
  email: 'email',
  academicYearId: 'academicYearId',
  classId: 'classId',
  source: 'source',
  status: 'status',
  assignedStaffId: 'assignedStaffId',
  enquiryDate: 'enquiryDate',
  nextFollowUpAt: 'nextFollowUpAt',
  remarks: 'remarks',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdmissionApplicationScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  number: 'number',
  enquiryId: 'enquiryId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  studentName: 'studentName',
  mobile: 'mobile',
  formData: 'formData',
  feePolicy: 'feePolicy',
  decision: 'decision',
  joiningStatus: 'joiningStatus',
  offerDate: 'offerDate',
  joiningConfirmedAt: 'joiningConfirmedAt',
  joinedAt: 'joinedAt',
  notJoinedReason: 'notJoinedReason',
  enrollmentId: 'enrollmentId',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdmissionPaymentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  applicationId: 'applicationId',
  amountMinor: 'amountMinor',
  method: 'method',
  reference: 'reference',
  receiptNumber: 'receiptNumber',
  status: 'status',
  recordedById: 'recordedById',
  verifiedById: 'verifiedById',
  verifiedAt: 'verifiedAt',
  reason: 'reason',
  version: 'version',
  createdAt: 'createdAt'
};

exports.Prisma.AdmissionActivityScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  enquiryId: 'enquiryId',
  applicationId: 'applicationId',
  actorId: 'actorId',
  kind: 'kind',
  details: 'details',
  createdAt: 'createdAt'
};

exports.Prisma.AdmissionDocumentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  applicationId: 'applicationId',
  name: 'name',
  kind: 'kind',
  fileKey: 'fileKey',
  mimeType: 'mimeType',
  size: 'size',
  uploadedById: 'uploadedById',
  createdAt: 'createdAt'
};

exports.Prisma.EnrollmentMovementScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  enrollmentId: 'enrollmentId',
  kind: 'kind',
  fromClassId: 'fromClassId',
  fromSectionId: 'fromSectionId',
  toClassId: 'toClassId',
  toSectionId: 'toSectionId',
  reason: 'reason',
  actorId: 'actorId',
  createdAt: 'createdAt'
};

exports.Prisma.SchoolEventScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  title: 'title',
  description: 'description',
  eventType: 'eventType',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  audience: 'audience',
  location: 'location',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  recipientId: 'recipientId',
  dedupeKey: 'dedupeKey',
  channel: 'channel',
  title: 'title',
  message: 'message',
  status: 'status',
  sentAt: 'sentAt',
  readAt: 'readAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  actorId: 'actorId',
  method: 'method',
  path: 'path',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  metadata: 'metadata',
  ipAddress: 'ipAddress',
  createdAt: 'createdAt'
};

exports.Prisma.AcademicProgramScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  subjectId: 'subjectId',
  syllabusId: 'syllabusId',
  name: 'name',
  status: 'status',
  curriculum: 'curriculum',
  calendar: 'calendar',
  revision: 'revision',
  reviewedAt: 'reviewedAt',
  approvedAt: 'approvedAt',
  approvedById: 'approvedById',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AcademicTeachingSessionScalarFieldEnum = {
  id: 'id',
  programId: 'programId',
  topicCode: 'topicCode',
  title: 'title',
  scheduledDate: 'scheduledDate',
  startTime: 'startTime',
  minutes: 'minutes',
  status: 'status',
  progressNotes: 'progressNotes',
  lessonContent: 'lessonContent',
  generationId: 'generationId',
  lessonPlanId: 'lessonPlanId',
  lessonStatus: 'lessonStatus',
  revision: 'revision',
  reviewedAt: 'reviewedAt',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AcademicPaperScalarFieldEnum = {
  id: 'id',
  programId: 'programId',
  kind: 'kind',
  content: 'content',
  dueDate: 'dueDate',
  status: 'status',
  revision: 'revision',
  generationId: 'generationId',
  homeworkId: 'homeworkId',
  examSubjectId: 'examSubjectId',
  reviewedAt: 'reviewedAt',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AcademicPaperResultScalarFieldEnum = {
  id: 'id',
  paperId: 'paperId',
  enrollmentId: 'enrollmentId',
  absent: 'absent',
  scores: 'scores',
  recordedById: 'recordedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AcademicInterventionScalarFieldEnum = {
  id: 'id',
  programId: 'programId',
  enrollmentId: 'enrollmentId',
  topicCode: 'topicCode',
  action: 'action',
  dueDate: 'dueDate',
  status: 'status',
  outcome: 'outcome',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AcademicInsightScalarFieldEnum = {
  id: 'id',
  programId: 'programId',
  audience: 'audience',
  enrollmentId: 'enrollmentId',
  content: 'content',
  evidence: 'evidence',
  generationId: 'generationId',
  status: 'status',
  revision: 'revision',
  reviewedAt: 'reviewedAt',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ParentScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  relationshipToStudent: 'relationshipToStudent',
  createdAt: 'createdAt'
};

exports.Prisma.ParentSchoolMembershipScalarFieldEnum = {
  id: 'id',
  parentId: 'parentId',
  schoolId: 'schoolId',
  parentCode: 'parentCode',
  occupation: 'occupation',
  status: 'status',
  verificationStatus: 'verificationStatus',
  verifiedAt: 'verifiedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentParentScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  parentId: 'parentId',
  relationshipType: 'relationshipType',
  isPrimary: 'isPrimary',
  canPickup: 'canPickup',
  canViewAcademics: 'canViewAcademics',
  canPayFees: 'canPayFees',
  status: 'status',
  createdAt: 'createdAt'
};

exports.Prisma.StaffAttendanceDayScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  date: 'date',
  locked: 'locked',
  actorId: 'actorId',
  reason: 'reason',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffAttendanceAuditScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  staffId: 'staffId',
  date: 'date',
  actorId: 'actorId',
  reason: 'reason',
  before: 'before',
  after: 'after',
  createdAt: 'createdAt'
};

exports.Prisma.StaffScopeAssignmentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  userId: 'userId',
  schoolWide: 'schoolWide',
  departmentValues: 'departmentValues',
  groupIds: 'groupIds',
  classIds: 'classIds',
  sectionIds: 'sectionIds',
  staffIds: 'staffIds',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffLeaveRequestScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  staffId: 'staffId',
  leaveType: 'leaveType',
  startDate: 'startDate',
  endDate: 'endDate',
  halfDay: 'halfDay',
  reason: 'reason',
  status: 'status',
  approverId: 'approverId',
  decisionReason: 'decisionReason',
  decidedAt: 'decidedAt',
  balanceDebited: 'balanceDebited',
  chargedDays: 'chargedDays',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffLeaveBalanceScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  staffId: 'staffId',
  leaveType: 'leaveType',
  year: 'year',
  periodKey: 'periodKey',
  periodStart: 'periodStart',
  periodEnd: 'periodEnd',
  manualAllocation: 'manualAllocation',
  policySnapshot: 'policySnapshot',
  entitlement: 'entitlement',
  used: 'used',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffDailyTaskScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  staffId: 'staffId',
  date: 'date',
  startTime: 'startTime',
  endTime: 'endTime',
  title: 'title',
  description: 'description',
  priority: 'priority',
  status: 'status',
  actorId: 'actorId',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DailyTimetableOverrideScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  timetableEntryId: 'timetableEntryId',
  date: 'date',
  status: 'status',
  reason: 'reason',
  actorId: 'actorId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AttendancePunchScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  staffId: 'staffId',
  date: 'date',
  kind: 'kind',
  recordedAt: 'recordedAt',
  latitude: 'latitude',
  longitude: 'longitude',
  accuracy: 'accuracy',
  distance: 'distance',
  locationVerified: 'locationVerified',
  locationExpiresAt: 'locationExpiresAt',
  earlyDeparture: 'earlyDeparture'
};

exports.Prisma.AttendanceExceptionRequestScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  staffId: 'staffId',
  date: 'date',
  kind: 'kind',
  reason: 'reason',
  requestedStatus: 'requestedStatus',
  requestedCheckIn: 'requestedCheckIn',
  requestedCheckOut: 'requestedCheckOut',
  status: 'status',
  decidedById: 'decidedById',
  decisionReason: 'decisionReason',
  decidedAt: 'decidedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeaveLedgerScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  balanceId: 'balanceId',
  leaveRequestId: 'leaveRequestId',
  actorId: 'actorId',
  kind: 'kind',
  days: 'days',
  effectiveDate: 'effectiveDate',
  dedupeKey: 'dedupeKey',
  reason: 'reason',
  createdAt: 'createdAt'
};

exports.Prisma.StudentImportJobScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  actorId: 'actorId',
  idempotencyKey: 'idempotencyKey',
  status: 'status',
  revision: 'revision',
  mapping: 'mapping',
  options: 'options',
  summary: 'summary',
  approvedById: 'approvedById',
  decisionReason: 'decisionReason',
  leaseToken: 'leaseToken',
  leaseUntil: 'leaseUntil',
  error: 'error',
  inputTokens: 'inputTokens',
  outputTokens: 'outputTokens',
  costMinor: 'costMinor',
  retainUntil: 'retainUntil',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentImportFileScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  jobId: 'jobId',
  name: 'name',
  fileKey: 'fileKey',
  sha256: 'sha256',
  mimeType: 'mimeType',
  size: 'size',
  status: 'status',
  scanStatus: 'scanStatus',
  scanMessage: 'scanMessage',
  pages: 'pages',
  error: 'error',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt'
};

exports.Prisma.StudentImportRowScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  jobId: 'jobId',
  fileId: 'fileId',
  sourceRef: 'sourceRef',
  page: 'page',
  raw: 'raw',
  values: 'values',
  evidence: 'evidence',
  issues: 'issues',
  matches: 'matches',
  action: 'action',
  status: 'status',
  reviewed: 'reviewed',
  revision: 'revision',
  targetEnrollmentId: 'targetEnrollmentId',
  result: 'result',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MediaAssetScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  ownerUserId: 'ownerUserId',
  uploadedBy: 'uploadedBy',
  provider: 'provider',
  storageKey: 'storageKey',
  category: 'category',
  mimeType: 'mimeType',
  size: 'size',
  width: 'width',
  height: 'height',
  originalName: 'originalName',
  sha256: 'sha256',
  visibility: 'visibility',
  status: 'status',
  createdAt: 'createdAt'
};

exports.Prisma.AcademicTeamAssignmentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  staffId: 'staffId',
  designation: 'designation',
  groupIds: 'groupIds',
  classIds: 'classIds',
  sectionIds: 'sectionIds',
  subjectIds: 'subjectIds',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  revision: 'revision',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SchoolSlugAliasScalarFieldEnum = {
  slug: 'slug',
  schoolId: 'schoolId',
  createdAt: 'createdAt'
};

exports.Prisma.DailyActivityScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  classId: 'classId',
  sectionId: 'sectionId',
  teacherId: 'teacherId',
  title: 'title',
  category: 'category',
  description: 'description',
  date: 'date',
  startTime: 'startTime',
  endTime: 'endTime',
  status: 'status',
  version: 'version',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ParentQueryScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  enrollmentId: 'enrollmentId',
  parentId: 'parentId',
  assignedToId: 'assignedToId',
  category: 'category',
  subject: 'subject',
  status: 'status',
  dueAt: 'dueAt',
  resolvedAt: 'resolvedAt',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ParentQueryMessageScalarFieldEnum = {
  id: 'id',
  queryId: 'queryId',
  authorId: 'authorId',
  message: 'message',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.UserStatus = exports.$Enums.UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED'
};

exports.Gender = exports.$Enums.Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER'
};

exports.StudentStatus = exports.$Enums.StudentStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  GRADUATED: 'GRADUATED'
};

exports.TeacherStatus = exports.$Enums.TeacherStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ON_LEAVE: 'ON_LEAVE'
};

exports.ParentStatus = exports.$Enums.ParentStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
};

exports.Prisma.ModelName = {
  School: 'School',
  Role: 'Role',
  Permission: 'Permission',
  RolePermission: 'RolePermission',
  User: 'User',
  UserRole: 'UserRole',
  SchoolSetting: 'SchoolSetting',
  AnalyticsSnapshot: 'AnalyticsSnapshot',
  AnalyticsExportJob: 'AnalyticsExportJob',
  AnalyticsAttentionCase: 'AnalyticsAttentionCase',
  AnalyticsCaseEvent: 'AnalyticsCaseEvent',
  AcademicYear: 'AcademicYear',
  SchoolClass: 'SchoolClass',
  Section: 'Section',
  Subject: 'Subject',
  Staff: 'Staff',
  StaffCategoryDefinition: 'StaffCategoryDefinition',
  AcademicYearSubject: 'AcademicYearSubject',
  ClassSubject: 'ClassSubject',
  SchoolProfileOption: 'SchoolProfileOption',
  UserSchoolProfileOption: 'UserSchoolProfileOption',
  Student: 'Student',
  StudentEnrollment: 'StudentEnrollment',
  StudentAttendance: 'StudentAttendance',
  StaffAttendance: 'StaffAttendance',
  Teacher: 'Teacher',
  TeacherAcademicAssignment: 'TeacherAcademicAssignment',
  TimePeriod: 'TimePeriod',
  TimetableEntry: 'TimetableEntry',
  SubjectTimetableRequirement: 'SubjectTimetableRequirement',
  TeacherAvailability: 'TeacherAvailability',
  TimetablePlan: 'TimetablePlan',
  PeriodTimingTemplate: 'PeriodTimingTemplate',
  PeriodTimingSlot: 'PeriodTimingSlot',
  PeriodTemplateAssignment: 'PeriodTemplateAssignment',
  Homework: 'Homework',
  HomeworkSubmission: 'HomeworkSubmission',
  LessonPlan: 'LessonPlan',
  AiGeneration: 'AiGeneration',
  Syllabus: 'Syllabus',
  SchoolTerm: 'SchoolTerm',
  SyllabusLesson: 'SyllabusLesson',
  SyllabusTopic: 'SyllabusTopic',
  ClassAnnouncement: 'ClassAnnouncement',
  TimetableSubstitution: 'TimetableSubstitution',
  AssessmentPattern: 'AssessmentPattern',
  AssessmentObservation: 'AssessmentObservation',
  AssessmentReport: 'AssessmentReport',
  Exam: 'Exam',
  ExamSubject: 'ExamSubject',
  StudentMark: 'StudentMark',
  AdmissionEnquiry: 'AdmissionEnquiry',
  AdmissionApplication: 'AdmissionApplication',
  AdmissionPayment: 'AdmissionPayment',
  AdmissionActivity: 'AdmissionActivity',
  AdmissionDocument: 'AdmissionDocument',
  EnrollmentMovement: 'EnrollmentMovement',
  SchoolEvent: 'SchoolEvent',
  Notification: 'Notification',
  AuditLog: 'AuditLog',
  AcademicProgram: 'AcademicProgram',
  AcademicTeachingSession: 'AcademicTeachingSession',
  AcademicPaper: 'AcademicPaper',
  AcademicPaperResult: 'AcademicPaperResult',
  AcademicIntervention: 'AcademicIntervention',
  AcademicInsight: 'AcademicInsight',
  Parent: 'Parent',
  ParentSchoolMembership: 'ParentSchoolMembership',
  StudentParent: 'StudentParent',
  StaffAttendanceDay: 'StaffAttendanceDay',
  StaffAttendanceAudit: 'StaffAttendanceAudit',
  StaffScopeAssignment: 'StaffScopeAssignment',
  StaffLeaveRequest: 'StaffLeaveRequest',
  StaffLeaveBalance: 'StaffLeaveBalance',
  StaffDailyTask: 'StaffDailyTask',
  DailyTimetableOverride: 'DailyTimetableOverride',
  AttendancePunch: 'AttendancePunch',
  AttendanceExceptionRequest: 'AttendanceExceptionRequest',
  LeaveLedger: 'LeaveLedger',
  StudentImportJob: 'StudentImportJob',
  StudentImportFile: 'StudentImportFile',
  StudentImportRow: 'StudentImportRow',
  MediaAsset: 'MediaAsset',
  AcademicTeamAssignment: 'AcademicTeamAssignment',
  SchoolSlugAlias: 'SchoolSlugAlias',
  DailyActivity: 'DailyActivity',
  ParentQuery: 'ParentQuery',
  ParentQueryMessage: 'ParentQueryMessage'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
