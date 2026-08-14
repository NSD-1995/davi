export class CreateSchoolSettingDto {
  schoolId?: string;
  schoolName?: string;
  timezone?: string;
  language?: string;
  gradingSystem?: string;
  attendancePolicy?: string;
  examPolicy?: string;
  notificationEmail?: string;
  logoUrl?: string;
}

export class UpdateSchoolSettingDto {
  schoolName?: string;
  timezone?: string;
  language?: string;
  gradingSystem?: string;
  attendancePolicy?: string;
  examPolicy?: string;
  notificationEmail?: string;
  logoUrl?: string;
}
