BEGIN;
CREATE UNIQUE INDEX "StudentImportFile_id_jobId_schoolId_academicYearId_key" ON "StudentImportFile"("id","jobId","schoolId","academicYearId");
ALTER TABLE "StudentImportRow" DROP CONSTRAINT "StudentImportRow_fileId_schoolId_academicYearId_fkey";
ALTER TABLE "StudentImportRow" ADD CONSTRAINT "StudentImportRow_fileId_jobId_schoolId_academicYearId_fkey" FOREIGN KEY ("fileId","jobId","schoolId","academicYearId") REFERENCES "StudentImportFile"("id","jobId","schoolId","academicYearId") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
