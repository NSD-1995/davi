-- Change only the default for new settings rows. Preserve every existing saved timezone.
ALTER TABLE "SchoolSetting" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';
