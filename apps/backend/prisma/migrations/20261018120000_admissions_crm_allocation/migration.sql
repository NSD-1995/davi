-- AlterTable
ALTER TABLE "SchoolSetting" ADD COLUMN     "admissionsPolicy" JSONB;

-- AlterTable
ALTER TABLE "StudentEnrollment" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "StudentAttendance" ADD COLUMN     "classIdSnapshot" TEXT,
ADD COLUMN     "sectionIdSnapshot" TEXT;

-- AlterTable
ALTER TABLE "StudentMark" ADD COLUMN     "locationSnapshotted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sectionIdSnapshot" TEXT;

-- CreateTable
CREATE TABLE "AdmissionEnquiry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedStaffId" TEXT,
    "enquiryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextFollowUpAt" TIMESTAMP(3),
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionApplication" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "enquiryId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "studentName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "formData" JSONB NOT NULL,
    "feePolicy" JSONB NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
    "joiningStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIRMED',
    "offerDate" TIMESTAMP(3),
    "joiningConfirmedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "notJoinedReason" TEXT,
    "enrollmentId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionPayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recordedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionActivity" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "applicationId" TEXT,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDocument" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentMovement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromClassId" TEXT,
    "fromSectionId" TEXT,
    "toClassId" TEXT NOT NULL,
    "toSectionId" TEXT,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_schoolId_academicYearId_classId_status_idx" ON "AdmissionEnquiry"("schoolId", "academicYearId", "classId", "status");

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_schoolId_nextFollowUpAt_idx" ON "AdmissionEnquiry"("schoolId", "nextFollowUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionEnquiry_schoolId_number_key" ON "AdmissionEnquiry"("schoolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionEnquiry_schoolId_academicYearId_classId_mobile_stu_key" ON "AdmissionEnquiry"("schoolId", "academicYearId", "classId", "mobile", "studentName");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_enrollmentId_key" ON "AdmissionApplication"("enrollmentId");

-- CreateIndex
CREATE INDEX "AdmissionApplication_schoolId_academicYearId_classId_decisi_idx" ON "AdmissionApplication"("schoolId", "academicYearId", "classId", "decision", "joiningStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_schoolId_number_key" ON "AdmissionApplication"("schoolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_schoolId_enquiryId_key" ON "AdmissionApplication"("schoolId", "enquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_schoolId_academicYearId_studentName_mo_key" ON "AdmissionApplication"("schoolId", "academicYearId", "studentName", "mobile");

-- CreateIndex
CREATE INDEX "AdmissionPayment_schoolId_applicationId_status_idx" ON "AdmissionPayment"("schoolId", "applicationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPayment_schoolId_method_reference_key" ON "AdmissionPayment"("schoolId", "method", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPayment_schoolId_receiptNumber_key" ON "AdmissionPayment"("schoolId", "receiptNumber");

-- CreateIndex
CREATE INDEX "AdmissionActivity_schoolId_enquiryId_createdAt_idx" ON "AdmissionActivity"("schoolId", "enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionActivity_schoolId_applicationId_createdAt_idx" ON "AdmissionActivity"("schoolId", "applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionDocument_schoolId_applicationId_idx" ON "AdmissionDocument"("schoolId", "applicationId");

-- CreateIndex
CREATE INDEX "EnrollmentMovement_schoolId_enrollmentId_createdAt_idx" ON "EnrollmentMovement"("schoolId", "enrollmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_classIdSnapshot_fkey" FOREIGN KEY ("classIdSnapshot") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_sectionIdSnapshot_fkey" FOREIGN KEY ("sectionIdSnapshot") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMark" ADD CONSTRAINT "StudentMark_sectionIdSnapshot_fkey" FOREIGN KEY ("sectionIdSnapshot") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionEnquiry" ADD CONSTRAINT "AdmissionEnquiry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPayment" ADD CONSTRAINT "AdmissionPayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPayment" ADD CONSTRAINT "AdmissionPayment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionActivity" ADD CONSTRAINT "AdmissionActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionActivity" ADD CONSTRAINT "AdmissionActivity_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionActivity" ADD CONSTRAINT "AdmissionActivity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentMovement" ADD CONSTRAINT "EnrollmentMovement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentMovement" ADD CONSTRAINT "EnrollmentMovement_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve historical locations before any enrollment movement.
UPDATE "StudentAttendance" a SET "classIdSnapshot"=e."classId", "sectionIdSnapshot"=e."sectionId" FROM "StudentEnrollment" e WHERE e."id"=a."enrollmentId";
UPDATE "StudentMark" m SET "sectionIdSnapshot"=e."sectionId", "locationSnapshotted"=true FROM "StudentEnrollment" e WHERE e."id"=m."enrollmentId";

CREATE UNIQUE INDEX "AdmissionEnquiry_contact_casefold" ON "AdmissionEnquiry" ("schoolId","academicYearId","classId","mobile",lower("studentName"));
CREATE UNIQUE INDEX "AdmissionApplication_contact_casefold" ON "AdmissionApplication" ("schoolId","academicYearId","mobile",lower("studentName"));
ALTER TABLE "AdmissionPayment" ADD CONSTRAINT "AdmissionPayment_amount_check" CHECK ("amountMinor">0);
ALTER TABLE "AdmissionPayment" ADD CONSTRAINT "AdmissionPayment_status_check" CHECK ("status" IN ('PENDING','VERIFIED','REJECTED','REFUNDED','WAIVED'));
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_join_check" CHECK (("joiningStatus"='JOINED')=("enrollmentId" IS NOT NULL));

-- Deferred checks validate final occupancy, allowing an atomic swap at capacity.
CREATE FUNCTION "admissions_check_capacity"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target text; cap integer; exceeded boolean;
BEGIN
  IF TG_TABLE_NAME='Section' THEN target:=NEW."id";
  ELSE
    IF NEW."status"<>'ACTIVE' OR NEW."sectionId" IS NULL THEN RETURN NEW; END IF;
    target:=NEW."sectionId";
    IF NOT EXISTS (SELECT 1 FROM "SchoolClass" c WHERE c."id"=NEW."classId" AND c."schoolId"=NEW."schoolId" AND c."academicYearId"=NEW."academicYearId") OR
       NOT EXISTS (SELECT 1 FROM "Section" s WHERE s."id"=target AND s."schoolId"=NEW."schoolId" AND s."classId"=NEW."classId") THEN
      RAISE EXCEPTION 'Enrollment class/year/section must belong to its school' USING ERRCODE='23514';
    END IF;
  END IF;
  SELECT "capacity" INTO cap FROM "Section" WHERE "id"=target FOR UPDATE;
  IF cap IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM "StudentEnrollment" WHERE "sectionId"=target AND "status"='ACTIVE' GROUP BY "academicYearId" HAVING count(*)>cap) INTO exceeded;
    IF exceeded THEN RAISE EXCEPTION 'Section capacity exceeded' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "enrollment_capacity_guard" AFTER INSERT OR UPDATE ON "StudentEnrollment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "admissions_check_capacity"();
CREATE CONSTRAINT TRIGGER "section_capacity_guard" AFTER UPDATE ON "Section" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "admissions_check_capacity"();

INSERT INTO "Permission" ("id","code","module","action","createdAt","updatedAt")
SELECT gen_random_uuid()::text,code,split_part(code,'_',1),regexp_replace(code,'^[^_]+_',''),NOW(),NOW()
FROM (VALUES ('ADMISSIONS_VIEW'),('ADMISSIONS_MANAGE'),('ADMISSIONS_DECIDE'),('ADMISSIONS_JOIN'),('ADMISSIONS_FEES_RECORD'),('ADMISSIONS_FEES_VERIFY'),('ADMISSIONS_SETTINGS_MANAGE'),('ENROLLMENT_ALLOCATE'),('ENROLLMENT_MOVE'),('ENROLLMENT_PROMOTE')) AS codes(code)
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code"='SCHOOL_ADMIN' AND (p."code" LIKE 'ADMISSIONS_%' OR p."code" IN ('ENROLLMENT_ALLOCATE','ENROLLMENT_MOVE','ENROLLMENT_PROMOTE')) ON CONFLICT DO NOTHING;
