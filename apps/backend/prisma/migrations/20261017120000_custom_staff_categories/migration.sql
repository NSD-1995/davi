CREATE TABLE "StaffCategoryDefinition" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE,
 "name" TEXT NOT NULL,
 "classification" TEXT NOT NULL CHECK ("classification" IN ('TEACHING','NON_TEACHING','ADMIN')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StaffCategoryDefinition_schoolId_name_key" ON "StaffCategoryDefinition"("schoolId","name");
CREATE UNIQUE INDEX "StaffCategoryDefinition_schoolId_name_ci_key" ON "StaffCategoryDefinition"("schoolId",lower("name"));
ALTER TABLE "Staff" ADD COLUMN "staffCategoryId" TEXT;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_staffCategoryId_fkey" FOREIGN KEY ("staffCategoryId") REFERENCES "StaffCategoryDefinition"("id") ON DELETE RESTRICT;
INSERT INTO "Permission" ("id","code","module","action","createdAt","updatedAt") VALUES (gen_random_uuid()::text,'STAFF_CATEGORY_MANAGE','STAFF_CATEGORY','MANAGE',NOW(),NOW()) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code"='SCHOOL_ADMIN' AND p."code"='STAFF_CATEGORY_MANAGE' ON CONFLICT DO NOTHING;
