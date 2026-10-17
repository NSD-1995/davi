ALTER TABLE "StaffScopeAssignment" ADD COLUMN "departmentValues" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "StaffLeaveRequest" ADD COLUMN "balanceDebited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DailyTimetableOverride" DROP CONSTRAINT "DailyTimetableOverride_timetableEntryId_fkey";
ALTER TABLE "DailyTimetableOverride" ADD CONSTRAINT "DailyTimetableOverride_timetableEntryId_fkey" FOREIGN KEY ("timetableEntryId") REFERENCES "TimetableEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
