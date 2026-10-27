-- AlterTable
ALTER TABLE "School" ALTER COLUMN "country" SET DEFAULT 'India';

-- AlterTable
ALTER TABLE "SchoolSetting" ADD COLUMN     "branding" JSONB;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTeamAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "groupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "classIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startDate" DATE,
    "endDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTeamAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolSlugAlias" (
    "slug" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolSlugAlias_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_schoolId_ownerUserId_category_status_idx" ON "MediaAsset"("schoolId", "ownerUserId", "category", "status");

-- CreateIndex
CREATE INDEX "AcademicTeamAssignment_schoolId_status_idx" ON "AcademicTeamAssignment"("schoolId", "status");

-- CreateIndex
CREATE INDEX "SchoolSlugAlias_schoolId_idx" ON "SchoolSlugAlias"("schoolId");

-- Enforce one namespace for current and historic school slugs, including races.
CREATE FUNCTION "davi_school_slug_namespace"() RETURNS trigger AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('davi-school-slugs'));
 IF TG_TABLE_NAME = 'School' THEN
  IF EXISTS (SELECT 1 FROM "SchoolSlugAlias" WHERE slug = NEW.slug AND "schoolId" <> NEW.id) THEN
   RAISE EXCEPTION 'School slug is reserved by a historic URL' USING ERRCODE = '23505';
  END IF;
 ELSE
  IF EXISTS (SELECT 1 FROM "School" WHERE slug = NEW.slug AND id <> NEW."schoolId") THEN
   RAISE EXCEPTION 'School slug already exists' USING ERRCODE = '23505';
  END IF;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "School_slug_namespace" BEFORE INSERT OR UPDATE OF slug ON "School" FOR EACH ROW EXECUTE FUNCTION "davi_school_slug_namespace"();
CREATE TRIGGER "SchoolSlugAlias_namespace" BEFORE INSERT OR UPDATE ON "SchoolSlugAlias" FOR EACH ROW EXECUTE FUNCTION "davi_school_slug_namespace"();
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE RESTRICT;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "AcademicTeamAssignment" ADD CONSTRAINT "AcademicTeamAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE RESTRICT;
ALTER TABLE "AcademicTeamAssignment" ADD CONSTRAINT "AcademicTeamAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"(id) ON DELETE RESTRICT;
ALTER TABLE "SchoolSlugAlias" ADD CONSTRAINT "SchoolSlugAlias_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE RESTRICT;
