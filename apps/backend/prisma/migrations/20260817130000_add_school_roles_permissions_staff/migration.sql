ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "Role_name_key";
ALTER TABLE "Role" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Role" ADD COLUMN "code" TEXT;
ALTER TABLE "Role" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Role" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Role"
SET "code" = UPPER(REGEXP_REPLACE(BTRIM("name"), '[^A-Za-z0-9]+', '_', 'g')),
    "isSystem" = LOWER("name") IN ('super-admin', 'school-admin');

CREATE UNIQUE INDEX "Role_schoolId_code_key" ON "Role"("schoolId", "code");
CREATE INDEX "Role_code_idx" ON "Role"("code");

-- Convert each legacy global role assignment for a school user into a school-owned role.
INSERT INTO "Role" ("id", "schoolId", "name", "code", "description", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, scoped."schoolId", scoped."name", scoped."code", scoped."description",
       scoped."code" = 'SCHOOL_ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT u."schoolId", r."name", r."code", r."description"
  FROM "UserRole" ur
  JOIN "User" u ON u."id" = ur."userId"
  JOIN "Role" r ON r."id" = ur."roleId"
  WHERE u."schoolId" IS NOT NULL
) scoped
ON CONFLICT ("schoolId", "code") DO NOTHING;

UPDATE "UserRole" ur
SET "roleId" = school_role."id"
FROM "User" u, "Role" legacy_role, "Role" school_role
WHERE u."id" = ur."userId"
  AND legacy_role."id" = ur."roleId"
  AND u."schoolId" IS NOT NULL
  AND school_role."schoolId" = u."schoolId"
  AND school_role."code" = legacy_role."code";

DELETE FROM "Role" r
WHERE r."schoolId" IS NULL AND r."code" <> 'SUPER_ADMIN'
  AND NOT EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur."roleId" = r."id");

ALTER TABLE "Role" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Role" ADD CONSTRAINT "Role_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "UserRole" ADD COLUMN "schoolId" TEXT;
UPDATE "UserRole" ur SET "schoolId" = u."schoolId" FROM "User" u WHERE u."id" = ur."userId";
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "module" TEXT NOT NULL, "action" TEXT NOT NULL,
  "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

CREATE TABLE "RolePermission" ("roleId" TEXT NOT NULL, "permissionId" TEXT NOT NULL, CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId"));
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Staff" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "userId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "joiningDate" TIMESTAMP(3), "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");
CREATE UNIQUE INDEX "Staff_schoolId_employeeId_key" ON "Staff"("schoolId", "employeeId");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
