-- AlterTable
ALTER TABLE "TimetableSubstitution" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "halfDay" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "chargedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveBalance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitlement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDailyTask" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "actorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTimetableOverride" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "timetableEntryId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CANCELLED',
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTimetableOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_schoolId_status_startDate_endDate_idx" ON "StaffLeaveRequest"("schoolId", "status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_staffId_startDate_endDate_idx" ON "StaffLeaveRequest"("staffId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffLeaveBalance_schoolId_staffId_leaveType_year_key" ON "StaffLeaveBalance"("schoolId", "staffId", "leaveType", "year");

-- CreateIndex
CREATE INDEX "StaffDailyTask_schoolId_date_status_idx" ON "StaffDailyTask"("schoolId", "date", "status");

-- CreateIndex
CREATE INDEX "StaffDailyTask_staffId_date_idx" ON "StaffDailyTask"("staffId", "date");

-- CreateIndex
CREATE INDEX "DailyTimetableOverride_schoolId_date_idx" ON "DailyTimetableOverride"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTimetableOverride_schoolId_timetableEntryId_date_key" ON "DailyTimetableOverride"("schoolId", "timetableEntryId", "date");

-- AddForeignKey
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDailyTask" ADD CONSTRAINT "StaffDailyTask_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDailyTask" ADD CONSTRAINT "StaffDailyTask_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDailyTask" ADD CONSTRAINT "StaffDailyTask_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTimetableOverride" ADD CONSTRAINT "DailyTimetableOverride_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTimetableOverride" ADD CONSTRAINT "DailyTimetableOverride_timetableEntryId_fkey" FOREIGN KEY ("timetableEntryId") REFERENCES "TimetableEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTimetableOverride" ADD CONSTRAINT "DailyTimetableOverride_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code" IN ('TEACHER','STAFF') AND p."code"='staff.leave.request' ON CONFLICT DO NOTHING;
