-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "assessmentConfig" JSONB,
ADD COLUMN     "assessmentPatternId" TEXT,
ADD COLUMN     "assessmentRoster" JSONB,
ADD COLUMN     "assessmentScope" JSONB,
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "termKey" TEXT;

-- AlterTable
ALTER TABLE "StudentMark" ADD COLUMN     "assessmentState" TEXT NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "componentScores" JSONB,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "AssessmentPattern" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentObservation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "competencyKey" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "observedOn" DATE NOT NULL,
    "remarks" TEXT NOT NULL,
    "evidence" TEXT,
    "actorId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentPattern_schoolId_academicYearId_idx" ON "AssessmentPattern"("schoolId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPattern_id_schoolId_academicYearId_key" ON "AssessmentPattern"("id", "schoolId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPattern_schoolId_academicYearId_scopeKey_version_key" ON "AssessmentPattern"("schoolId", "academicYearId", "scopeKey", "version");

-- CreateIndex
CREATE INDEX "AssessmentObservation_schoolId_academicYearId_enrollmentId__idx" ON "AssessmentObservation"("schoolId", "academicYearId", "enrollmentId", "competencyKey", "observedOn");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentObservation_examId_requestKey_key" ON "AssessmentObservation"("examId", "requestKey");

-- CreateIndex
CREATE INDEX "AssessmentReport_schoolId_academicYearId_enrollmentId_publi_idx" ON "AssessmentReport"("schoolId", "academicYearId", "enrollmentId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentReport_examId_enrollmentId_version_key" ON "AssessmentReport"("examId", "enrollmentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_id_schoolId_academicYearId_key" ON "StudentEnrollment"("id", "schoolId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_id_schoolId_academicYearId_key" ON "Exam"("id", "schoolId", "academicYearId");

-- AddForeignKey
ALTER TABLE "AssessmentPattern" ADD CONSTRAINT "AssessmentPattern_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPattern" ADD CONSTRAINT "AssessmentPattern_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentObservation" ADD CONSTRAINT "AssessmentObservation_examId_schoolId_academicYearId_fkey" FOREIGN KEY ("examId", "schoolId", "academicYearId") REFERENCES "Exam"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentObservation" ADD CONSTRAINT "AssessmentObservation_enrollmentId_schoolId_academicYearId_fkey" FOREIGN KEY ("enrollmentId", "schoolId", "academicYearId") REFERENCES "StudentEnrollment"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReport" ADD CONSTRAINT "AssessmentReport_examId_schoolId_academicYearId_fkey" FOREIGN KEY ("examId", "schoolId", "academicYearId") REFERENCES "Exam"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReport" ADD CONSTRAINT "AssessmentReport_enrollmentId_schoolId_academicYearId_fkey" FOREIGN KEY ("enrollmentId", "schoolId", "academicYearId") REFERENCES "StudentEnrollment"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_assessmentPatternId_schoolId_academicYearId_fkey" FOREIGN KEY ("assessmentPatternId", "schoolId", "academicYearId") REFERENCES "AssessmentPattern"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Assessment permissions are school scoped; assign review/approval roles explicitly.
INSERT INTO "Permission" ("id","code","module","action","createdAt","updatedAt")
SELECT gen_random_uuid()::text,code,'ASSESSMENT',split_part(code,'_',2),NOW(),NOW()
FROM (VALUES ('ASSESSMENT_CONFIGURE'),('ASSESSMENT_REVIEW'),('ASSESSMENT_APPROVE'),('ASSESSMENT_PUBLISH'),('ASSESSMENT_CORRECT')) AS codes(code) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE r.code='SCHOOL_ADMIN' AND p.code LIKE 'ASSESSMENT_%' ON CONFLICT DO NOTHING;

CREATE FUNCTION protect_assessment_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Assessment patterns and published reports are immutable. Create a new version.'; END;
$$;
CREATE TRIGGER assessment_pattern_immutable BEFORE UPDATE OR DELETE ON "AssessmentPattern" FOR EACH ROW EXECUTE FUNCTION protect_assessment_snapshot();
CREATE TRIGGER assessment_report_immutable BEFORE UPDATE OR DELETE ON "AssessmentReport" FOR EACH ROW EXECUTE FUNCTION protect_assessment_snapshot();
ALTER TABLE "AssessmentPattern" ADD CONSTRAINT assessment_pattern_version_positive CHECK (version>0);
ALTER TABLE "AssessmentReport" ADD CONSTRAINT assessment_report_version_positive CHECK (version>0);
