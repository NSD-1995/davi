-- CreateTable
CREATE TABLE "AcademicProgram" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "curriculum" JSONB NOT NULL,
    "calendar" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTeachingSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "topicCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "progressNotes" TEXT,
    "lessonContent" JSONB,
    "generationId" TEXT,
    "lessonPlanId" TEXT,
    "lessonStatus" TEXT NOT NULL DEFAULT 'EMPTY',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTeachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicPaper" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "generationId" TEXT,
    "homeworkId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicPaperResult" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "scores" JSONB NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicPaperResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicIntervention" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "topicCode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicInsight" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "content" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "generationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicProgram_schoolId_academicYearId_classId_sectionId_s_idx" ON "AcademicProgram"("schoolId", "academicYearId", "classId", "sectionId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTeachingSession_lessonPlanId_key" ON "AcademicTeachingSession"("lessonPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTeachingSession_programId_scheduledDate_startTime_key" ON "AcademicTeachingSession"("programId", "scheduledDate", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicPaper_homeworkId_key" ON "AcademicPaper"("homeworkId");

-- CreateIndex
CREATE INDEX "AcademicPaper_programId_status_idx" ON "AcademicPaper"("programId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicPaperResult_paperId_enrollmentId_key" ON "AcademicPaperResult"("paperId", "enrollmentId");

-- CreateIndex
CREATE INDEX "AcademicIntervention_programId_enrollmentId_idx" ON "AcademicIntervention"("programId", "enrollmentId");

-- CreateIndex
CREATE INDEX "AcademicInsight_programId_audience_enrollmentId_status_idx" ON "AcademicInsight"("programId", "audience", "enrollmentId", "status");

-- AddForeignKey
ALTER TABLE "AcademicTeachingSession" ADD CONSTRAINT "AcademicTeachingSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicPaper" ADD CONSTRAINT "AcademicPaper_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicPaperResult" ADD CONSTRAINT "AcademicPaperResult_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "AcademicPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicIntervention" ADD CONSTRAINT "AcademicIntervention_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicInsight" ADD CONSTRAINT "AcademicInsight_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
