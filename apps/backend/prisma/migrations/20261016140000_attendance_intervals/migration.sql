ALTER TABLE "StaffAttendance" ADD COLUMN "unavailableFrom" TEXT, ADD COLUMN "unavailableUntil" TEXT;
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_date_range_check" CHECK ("endDate" >= "startDate");
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_nonnegative_check" CHECK ("entitlement" >= 0 AND "used" >= 0 AND "used" <= "entitlement");
ALTER TABLE "StaffDailyTask" ADD CONSTRAINT "StaffDailyTask_interval_check" CHECK ("startTime" < "endTime");
