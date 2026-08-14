-- CreateTable
CREATE TABLE "SchoolProfileOption" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolProfileOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSchoolProfileOption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSchoolProfileOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolProfileOption_schoolId_key_key" ON "SchoolProfileOption"("schoolId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "UserSchoolProfileOption_userId_optionId_key" ON "UserSchoolProfileOption"("userId", "optionId");

-- AddForeignKey
ALTER TABLE "SchoolProfileOption" ADD CONSTRAINT "SchoolProfileOption_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchoolProfileOption" ADD CONSTRAINT "UserSchoolProfileOption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchoolProfileOption" ADD CONSTRAINT "UserSchoolProfileOption_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchoolProfileOption" ADD CONSTRAINT "UserSchoolProfileOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SchoolProfileOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
