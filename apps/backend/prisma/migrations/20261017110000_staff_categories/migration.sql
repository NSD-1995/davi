ALTER TABLE "Staff" ADD COLUMN "staffCategory" TEXT NOT NULL DEFAULT 'NON_TEACHING';
UPDATE "Staff" s SET "staffCategory"='ADMIN' WHERE EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id=ur."roleId" WHERE ur."userId"=s."userId" AND r.code IN ('SCHOOL_ADMIN','SUPER_ADMIN'));
UPDATE "Staff" s SET "staffCategory"='TEACHING' WHERE EXISTS (SELECT 1 FROM "Teacher" t WHERE t."userId"=s."userId" AND t."schoolId"=s."schoolId");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_category_check" CHECK ("staffCategory" IN ('TEACHING','NON_TEACHING','ADMIN'));
