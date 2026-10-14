ALTER TABLE "SchoolClass" ADD COLUMN "academicGroup" TEXT;
ALTER TABLE "Subject" ADD COLUMN "academicGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "SchoolClass" SET "academicGroup" = 'MONTESSORI' WHERE "name" ~* '(montessori|play\s*school|nursery|\mlkg\M|\mukg\M)';
UPDATE "SchoolClass" SET "academicGroup" = CASE
 WHEN substring("name" from '[0-9]+')::int BETWEEN 1 AND 2 THEN 'PRE_PRIMARY'
 WHEN substring("name" from '[0-9]+')::int BETWEEN 3 AND 5 THEN 'PRIMARY'
 WHEN substring("name" from '[0-9]+')::int BETWEEN 6 AND 8 THEN 'MIDDLE'
 WHEN substring("name" from '[0-9]+')::int BETWEEN 9 AND 10 THEN 'SECONDARY'
 WHEN substring("name" from '[0-9]+')::int BETWEEN 11 AND 12 THEN 'SENIOR_SECONDARY' END
WHERE "academicGroup" IS NULL AND "name" ~* '^(class\s*|grade\s*)?[0-9]{1,2}(st|nd|rd|th)?(\s*(standard|class|grade))?$';
