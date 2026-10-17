-- AlterTable
ALTER TABLE "SchoolSetting" ADD COLUMN     "operationsPolicy" JSONB;

-- AlterTable
ALTER TABLE "StaffAttendance" ADD COLUMN     "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "StaffAttendanceDay" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendanceAudit" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAttendanceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffScopeAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "classIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "staffIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffScopeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceDay_schoolId_date_key" ON "StaffAttendanceDay"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendanceAudit_schoolId_date_staffId_idx" ON "StaffAttendanceAudit"("schoolId", "date", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffScopeAssignment_schoolId_userId_key" ON "StaffScopeAssignment"("schoolId", "userId");

-- AddForeignKey
ALTER TABLE "StaffAttendanceDay" ADD CONSTRAINT "StaffAttendanceDay_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceDay" ADD CONSTRAINT "StaffAttendanceDay_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceAudit" ADD CONSTRAINT "StaffAttendanceAudit_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceAudit" ADD CONSTRAINT "StaffAttendanceAudit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceAudit" ADD CONSTRAINT "StaffAttendanceAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffScopeAssignment" ADD CONSTRAINT "StaffScopeAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffScopeAssignment" ADD CONSTRAINT "StaffScopeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'staff.attendance.view','staff.attendance','view','staff.attendance.view',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'staff.attendance.mark','staff.attendance','mark','staff.attendance.mark',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'staff.attendance.override','staff.attendance','override','staff.attendance.override',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'staff.attendance.manage','staff.attendance','manage','staff.attendance.manage',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'staff.leave.request','staff.leave','request','staff.leave.request',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'staff.leave.approve','staff.leave','approve','staff.leave.approve',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'timetable.substitution.view','timetable.substitution','view','timetable.substitution.view',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'timetable.substitution.generate','timetable.substitution','generate','timetable.substitution.generate',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'timetable.substitution.approve','timetable.substitution','approve','timetable.substitution.approve',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'timetable.substitution.cancel','timetable.substitution','cancel','timetable.substitution.cancel',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'operations.dashboard.view','operations.dashboard','view','operations.dashboard.view',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("id","code","module","action","description","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'operations.tasks.manage','operations.tasks','manage','operations.tasks.manage',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code"='SCHOOL_ADMIN' ON CONFLICT DO NOTHING;
