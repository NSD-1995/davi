ALTER TABLE "School" ADD COLUMN "slug" TEXT;

UPDATE "School"
SET "slug" = CONCAT('school-', SUBSTRING("id" FROM 1 FOR 8));

ALTER TABLE "School" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");
