BEGIN;


-- AlterTable
ALTER TABLE "SchoolSetting" ADD COLUMN     "studentImportPolicy" JSONB;

-- CreateTable
CREATE TABLE "StudentImportJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "options" JSONB NOT NULL DEFAULT '{}',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "approvedById" TEXT,
    "decisionReason" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "error" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMinor" INTEGER NOT NULL DEFAULT 0,
    "retainUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentImportFile" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUARANTINED',
    "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "scanMessage" TEXT,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentImportRow" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "matches" JSONB NOT NULL DEFAULT '[]',
    "action" TEXT NOT NULL DEFAULT 'CREATE',
    "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "targetEnrollmentId" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentImportJob_status_leaseUntil_createdAt_idx" ON "StudentImportJob"("status", "leaseUntil", "createdAt");

-- CreateIndex
CREATE INDEX "StudentImportJob_schoolId_academicYearId_createdAt_idx" ON "StudentImportJob"("schoolId", "academicYearId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentImportJob_schoolId_academicYearId_idempotencyKey_key" ON "StudentImportJob"("schoolId", "academicYearId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentImportJob_id_schoolId_academicYearId_key" ON "StudentImportJob"("id", "schoolId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentImportFile_fileKey_key" ON "StudentImportFile"("fileKey");

-- CreateIndex
CREATE INDEX "StudentImportFile_schoolId_jobId_idx" ON "StudentImportFile"("schoolId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentImportFile_id_schoolId_academicYearId_key" ON "StudentImportFile"("id", "schoolId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentImportFile_jobId_sha256_key" ON "StudentImportFile"("jobId", "sha256");

-- CreateIndex
CREATE INDEX "StudentImportRow_schoolId_academicYearId_jobId_status_idx" ON "StudentImportRow"("schoolId", "academicYearId", "jobId", "status");

-- CreateIndex
CREATE INDEX "StudentImportRow_jobId_targetEnrollmentId_idx" ON "StudentImportRow"("jobId", "targetEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentImportRow_jobId_fileId_sourceRef_key" ON "StudentImportRow"("jobId", "fileId", "sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_id_schoolId_key" ON "AcademicYear"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "StudentImportJob" ADD CONSTRAINT "StudentImportJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentImportJob" ADD CONSTRAINT "StudentImportJob_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentImportFile" ADD CONSTRAINT "StudentImportFile_jobId_schoolId_academicYearId_fkey" FOREIGN KEY ("jobId", "schoolId", "academicYearId") REFERENCES "StudentImportJob"("id", "schoolId", "academicYearId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentImportRow" ADD CONSTRAINT "StudentImportRow_jobId_schoolId_academicYearId_fkey" FOREIGN KEY ("jobId", "schoolId", "academicYearId") REFERENCES "StudentImportJob"("id", "schoolId", "academicYearId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentImportRow" ADD CONSTRAINT "StudentImportRow_fileId_schoolId_academicYearId_fkey" FOREIGN KEY ("fileId", "schoolId", "academicYearId") REFERENCES "StudentImportFile"("id", "schoolId", "academicYearId") ON DELETE CASCADE ON UPDATE CASCADE;

;

INSERT INTO "Permission" ("id","code","module","action","createdAt","updatedAt")
SELECT gen_random_uuid()::text,code,'students.import',split_part(code,'.',3),NOW(),NOW()
FROM (VALUES ('students.import.view'),('students.import.manage'),('students.import.commit'),('students.import.rollback')) AS codes(code) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE r.code='SCHOOL_ADMIN' AND p.code LIKE 'students.import.%' ON CONFLICT DO NOTHING;
ALTER TABLE "StudentImportFile" ADD CONSTRAINT "import_file_size_check" CHECK(size>0 AND size<=20971520);
ALTER TABLE "StudentImportRow" ADD CONSTRAINT "import_row_page_check" CHECK(page>0);

COMMIT;
