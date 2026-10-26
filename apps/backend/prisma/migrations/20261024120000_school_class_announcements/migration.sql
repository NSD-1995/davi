-- NULL class and section target the whole school; NULL section targets all class sections.
ALTER TABLE "ClassAnnouncement" ALTER COLUMN "classId" DROP NOT NULL;
ALTER TABLE "ClassAnnouncement" ALTER COLUMN "sectionId" DROP NOT NULL;
