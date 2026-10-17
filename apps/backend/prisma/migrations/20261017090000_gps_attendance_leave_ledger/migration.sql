BEGIN;


-- AlterTable
ALTER TABLE "StaffLeaveBalance" ADD COLUMN     "manualAllocation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "periodEnd" DATE,
ADD COLUMN     "periodKey" TEXT,
ADD COLUMN     "periodStart" DATE,
ADD COLUMN     "policySnapshot" JSONB;

UPDATE "StaffLeaveBalance" SET "periodKey"='CALENDAR:'||"year"::text,"periodStart"=make_date("year",1,1),"periodEnd"=make_date("year",12,31);
ALTER TABLE "StaffLeaveBalance" ALTER COLUMN "periodKey" SET NOT NULL;
ALTER TABLE "StaffLeaveBalance" DROP CONSTRAINT "StaffLeaveBalance_nonnegative_check";
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_nonnegative_check" CHECK ("entitlement">=0 AND "used">=0);

-- AlterTable
ALTER TABLE "StaffScopeAssignment" ADD COLUMN     "schoolWide" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AttendancePunch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "distance" DOUBLE PRECISION,
    "locationVerified" BOOLEAN NOT NULL DEFAULT false,
    "locationExpiresAt" TIMESTAMP(3),
    "earlyDeparture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceExceptionRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedStatus" TEXT NOT NULL DEFAULT 'PRESENT',
    "requestedCheckIn" TIMESTAMP(3),
    "requestedCheckOut" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceExceptionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveLedger" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "leaveRequestId" TEXT,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendancePunch_schoolId_date_idx" ON "AttendancePunch"("schoolId", "date");

-- CreateIndex
CREATE INDEX "AttendancePunch_locationExpiresAt_idx" ON "AttendancePunch"("locationExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePunch_staffId_date_kind_key" ON "AttendancePunch"("staffId", "date", "kind");

-- CreateIndex
CREATE INDEX "AttendanceExceptionRequest_schoolId_status_date_idx" ON "AttendanceExceptionRequest"("schoolId", "status", "date");

-- CreateIndex
CREATE INDEX "AttendanceExceptionRequest_staffId_date_idx" ON "AttendanceExceptionRequest"("staffId", "date");

-- CreateIndex
CREATE INDEX "LeaveLedger_schoolId_balanceId_effectiveDate_idx" ON "LeaveLedger"("schoolId", "balanceId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveLedger_schoolId_dedupeKey_key" ON "LeaveLedger"("schoolId", "dedupeKey");

-- CreateIndex
CREATE INDEX "StaffLeaveBalance_schoolId_staffId_year_idx" ON "StaffLeaveBalance"("schoolId", "staffId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "StaffLeaveBalance_schoolId_staffId_leaveType_periodKey_key" ON "StaffLeaveBalance"("schoolId", "staffId", "leaveType", "periodKey");

-- AddForeignKey
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExceptionRequest" ADD CONSTRAINT "AttendanceExceptionRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExceptionRequest" ADD CONSTRAINT "AttendanceExceptionRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExceptionRequest" ADD CONSTRAINT "AttendanceExceptionRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedger" ADD CONSTRAINT "LeaveLedger_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedger" ADD CONSTRAINT "LeaveLedger_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "StaffLeaveBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedger" ADD CONSTRAINT "LeaveLedger_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "StaffLeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedger" ADD CONSTRAINT "LeaveLedger_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


DROP INDEX "StaffLeaveBalance_schoolId_staffId_leaveType_year_key";
CREATE UNIQUE INDEX "AttendanceExceptionRequest_pending_unique" ON "AttendanceExceptionRequest" ("schoolId","staffId","date") WHERE "status"='PENDING';
INSERT INTO "LeaveLedger" ("id","schoolId","balanceId","kind","days","effectiveDate","dedupeKey","reason") SELECT gen_random_uuid()::text,"schoolId","id",'OPENING',"entitlement","periodStart",'LEGACY_OPENING:'||"id",'Imported existing entitlement; no balance changed' FROM "StaffLeaveBalance";
INSERT INTO "LeaveLedger" ("id","schoolId","balanceId","kind","days","effectiveDate","dedupeKey","reason") SELECT gen_random_uuid()::text,"schoolId","id",'DEDUCTION',-"used","periodStart",'LEGACY_USED:'||"id",'Imported existing leave usage; no balance changed' FROM "StaffLeaveBalance" WHERE "used">0;
INSERT INTO "Permission" ("id","code","module","action","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'staff.attendance.policy.manage','staff.attendance.policy','manage',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "Permission" ("id","code","module","action","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'staff.leave.policy.manage','staff.leave.policy','manage',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code"='SCHOOL_ADMIN' AND p."code" IN ('staff.attendance.policy.manage','staff.leave.policy.manage') ON CONFLICT DO NOTHING;

COMMIT;
