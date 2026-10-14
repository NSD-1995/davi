ALTER TABLE "SchoolSetting" ADD COLUMN "timetableRules" JSONB;
ALTER TABLE "Teacher" ADD COLUMN "timetableWorkload" JSONB;
ALTER TABLE "ClassSubject" ADD COLUMN "preferredPeriods" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[], ADD COLUMN "avoidPeriods" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[], ADD COLUMN "allowConsecutive" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "preferredTeacherIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "eligibleTeacherIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "TimetablePlan" ADD COLUMN "supervisionEntries" JSONB NOT NULL DEFAULT '[]';
