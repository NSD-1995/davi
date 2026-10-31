CREATE TYPE "SchoolProgramCode" AS ENUM ('MONTESSORI', 'PRE_PRIMARY', 'PRIMARY', 'MIDDLE_SCHOOL', 'SECONDARY', 'HIGHER_SECONDARY');

CREATE TABLE "SchoolProgramEntitlement" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "code" "SchoolProgramCode" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enabledBy" TEXT,
  CONSTRAINT "SchoolProgramEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolOnboarding" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolProgramEntitlement_schoolId_code_key" ON "SchoolProgramEntitlement"("schoolId", "code");
CREATE INDEX "SchoolProgramEntitlement_schoolId_idx" ON "SchoolProgramEntitlement"("schoolId");
CREATE UNIQUE INDEX "SchoolOnboarding_schoolId_key" ON "SchoolOnboarding"("schoolId");
ALTER TABLE "SchoolProgramEntitlement" ADD CONSTRAINT "SchoolProgramEntitlement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolOnboarding" ADD CONSTRAINT "SchoolOnboarding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
