CREATE TABLE "AiGeneration" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "feature" TEXT NOT NULL, "model" TEXT NOT NULL, "promptVersion" TEXT NOT NULL,
  "input" JSONB NOT NULL, "output" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "inputTokens" INTEGER, "outputTokens" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiGeneration_schoolId_userId_createdAt_idx" ON "AiGeneration"("schoolId", "userId", "createdAt");

CREATE TABLE "SchoolTerm" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolTerm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolTerm_schoolId_academicYearId_name_key" ON "SchoolTerm"("schoolId", "academicYearId", "name");
CREATE INDEX "SchoolTerm_schoolId_academicYearId_idx" ON "SchoolTerm"("schoolId", "academicYearId");

CREATE TABLE "Syllabus" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "termId" TEXT NOT NULL,
  "version" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "storageKey" TEXT NOT NULL, "fileName" TEXT NOT NULL, "fileHash" TEXT NOT NULL,
  "extractionWarning" TEXT, "uploadedById" TEXT NOT NULL, "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3), "supersededById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Syllabus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Syllabus_schoolId_academicYearId_classId_subjectId_termId_version_key" ON "Syllabus"("schoolId","academicYearId","classId","subjectId","termId","version");
CREATE INDEX "Syllabus_schoolId_academicYearId_classId_subjectId_termId_status_idx" ON "Syllabus"("schoolId","academicYearId","classId","subjectId","termId","status");

CREATE TABLE "SyllabusLesson" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "termId" TEXT NOT NULL,
  "syllabusId" TEXT NOT NULL, "title" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "SyllabusLesson_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyllabusLesson_syllabusId_sortOrder_key" ON "SyllabusLesson"("syllabusId","sortOrder");
CREATE INDEX "SyllabusLesson_schoolId_academicYearId_classId_subjectId_termId_idx" ON "SyllabusLesson"("schoolId","academicYearId","classId","subjectId","termId");

CREATE TABLE "SyllabusTopic" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "termId" TEXT NOT NULL,
  "syllabusId" TEXT NOT NULL, "lessonId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyllabusTopic_lessonId_sortOrder_key" ON "SyllabusTopic"("lessonId","sortOrder");
CREATE INDEX "SyllabusTopic_schoolId_academicYearId_classId_subjectId_termId_idx" ON "SyllabusTopic"("schoolId","academicYearId","classId","subjectId","termId");
ALTER TABLE "LessonPlan" ADD COLUMN "syllabusTopicId" TEXT;
ALTER TABLE "SyllabusLesson" ADD CONSTRAINT "SyllabusLesson_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "Syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "SyllabusLesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "Syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_syllabusTopicId_fkey" FOREIGN KEY ("syllabusTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
