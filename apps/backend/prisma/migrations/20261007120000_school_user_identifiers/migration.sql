DROP INDEX "User_email_key";
DROP INDEX "User_username_key";
CREATE UNIQUE INDEX "User_schoolId_email_key" ON "User"("schoolId", "email");
CREATE UNIQUE INDEX "User_schoolId_username_key" ON "User"("schoolId", "username");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_username_idx" ON "User"("username");
CREATE UNIQUE INDEX "User_platform_email_key" ON "User"("email") WHERE "schoolId" IS NULL;
CREATE UNIQUE INDEX "User_platform_username_key" ON "User"("username") WHERE "schoolId" IS NULL;
