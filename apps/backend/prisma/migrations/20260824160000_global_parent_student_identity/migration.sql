-- Preserve school-specific parent metadata while promoting parent/student identities globally.
CREATE TABLE "ParentSchoolMembership" (
  "id" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "parentCode" TEXT NOT NULL,
  "occupation" TEXT,
  "status" "ParentStatus" NOT NULL DEFAULT 'ACTIVE',
  "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentSchoolMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParentSchoolMembership_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParentSchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ParentSchoolMembership" ("id", "parentId", "schoolId", "parentCode", "occupation", "status", "verificationStatus", "verifiedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "schoolId", "parentCode", "occupation", "status", 'VERIFIED', CURRENT_TIMESTAMP, "createdAt", CURRENT_TIMESTAMP FROM "Parent";

ALTER TABLE "StudentEnrollment" ADD COLUMN "admissionNumber" TEXT;
UPDATE "StudentEnrollment" e SET "admissionNumber" = COALESCE(s."admissionNumber", s."studentCode") FROM "Student" s WHERE e."studentId" = s."id";
ALTER TABLE "StudentEnrollment" ALTER COLUMN "admissionNumber" SET NOT NULL;

ALTER TABLE "StudentParent" ADD COLUMN "canPickup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "canViewAcademics" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "canPayFees" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

UPDATE "User" SET "schoolId" = NULL WHERE "id" IN (SELECT "userId" FROM "Parent" UNION SELECT "userId" FROM "Student");

ALTER TABLE "Parent" DROP CONSTRAINT IF EXISTS "Parent_schoolId_fkey";
ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_schoolId_fkey";
ALTER TABLE "Parent" DROP COLUMN "schoolId", DROP COLUMN "parentCode", DROP COLUMN "occupation", DROP COLUMN "status";
ALTER TABLE "Student" DROP COLUMN "schoolId", DROP COLUMN "admissionNumber";

DROP INDEX IF EXISTS "Student_schoolId_admissionNumber_key";
DROP INDEX IF EXISTS "StudentEnrollment_studentId_academicYearId_key";
CREATE UNIQUE INDEX "ParentSchoolMembership_parentId_schoolId_key" ON "ParentSchoolMembership"("parentId", "schoolId");
CREATE UNIQUE INDEX "ParentSchoolMembership_schoolId_parentCode_key" ON "ParentSchoolMembership"("schoolId", "parentCode");
CREATE INDEX "ParentSchoolMembership_schoolId_status_idx" ON "ParentSchoolMembership"("schoolId", "status");
CREATE UNIQUE INDEX "StudentEnrollment_studentId_schoolId_academicYearId_key" ON "StudentEnrollment"("studentId", "schoolId", "academicYearId");
CREATE UNIQUE INDEX "StudentEnrollment_schoolId_academicYearId_admissionNumber_key" ON "StudentEnrollment"("schoolId", "academicYearId", "admissionNumber");
