ALTER TABLE "SchoolSetting" ADD COLUMN IF NOT EXISTS "sectionCapacityPolicy" JSONB;
CREATE INDEX IF NOT EXISTS "enrollment_capacity_lookup" ON "StudentEnrollment" ("schoolId", "academicYearId", "classId", "sectionId") WHERE "status"='ACTIVE';

CREATE FUNCTION davi_effective_capacity(target text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE s record; p jsonb; r jsonb; cap integer; reserved integer:=0;
BEGIN
 SELECT sec.*, c."academicYearId" AS yr,c."academicGroup" AS grp INTO s FROM "Section" sec JOIN "SchoolClass" c ON c.id=sec."classId" WHERE sec.id=target;
 SELECT "sectionCapacityPolicy" INTO p FROM "SchoolSetting" WHERE "schoolId"=s."schoolId";
 cap:=s.capacity;
 IF p->>'defaultCapacity' IS NOT NULL THEN cap:=LEAST(cap,(p->>'defaultCapacity')::integer); END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(COALESCE(p->'rules','[]'::jsonb)) LOOP
  IF r->>'academicYearId'=s.yr AND r->>'target'=(CASE r->>'level' WHEN 'ACADEMIC_LEVEL' THEN s.grp WHEN 'GRADE' THEN s."classId" WHEN 'CLASSROOM' THEN s.room WHEN 'SECTION' THEN s.id END) THEN
   cap:=LEAST(cap,(r->>'maximum')::integer);reserved:=GREATEST(reserved,COALESCE((r->>'reserved')::integer,0));
  END IF;
 END LOOP;
 RETURN CASE WHEN cap IS NULL THEN NULL ELSE GREATEST(0,cap-reserved) END;
END $$;
CREATE OR REPLACE FUNCTION "admissions_check_capacity"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target text; cap integer; exceeded boolean;
BEGIN
 IF TG_TABLE_NAME='Section' THEN target:=NEW.id;
 ELSE
  IF NEW.status<>'ACTIVE' OR NEW."sectionId" IS NULL THEN RETURN NEW; END IF;
  target:=NEW."sectionId";
  IF NOT EXISTS(SELECT 1 FROM "SchoolClass" c JOIN "Section" s ON s."classId"=c.id WHERE s.id=target AND c.id=NEW."classId" AND c."schoolId"=NEW."schoolId" AND s."schoolId"=NEW."schoolId" AND c."academicYearId"=NEW."academicYearId") THEN
   RAISE EXCEPTION 'Enrollment class/year/section must belong to its school' USING ERRCODE='23514';
  END IF;
 END IF;
 PERFORM 1 FROM "Section" WHERE id=target FOR UPDATE;
 cap:=davi_effective_capacity(target);
 IF cap IS NOT NULL THEN
  SELECT EXISTS(SELECT 1 FROM "StudentEnrollment" WHERE "sectionId"=target AND status='ACTIVE' GROUP BY "academicYearId" HAVING count(*)>cap) INTO exceeded;
  IF exceeded THEN RAISE EXCEPTION 'Section capacity exceeded' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION davi_policy_capacity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s record;
BEGIN
 FOR s IN SELECT id FROM "Section" WHERE "schoolId"=NEW."schoolId" ORDER BY id LOOP
  PERFORM 1 FROM "Section" WHERE id=s.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM "StudentEnrollment" WHERE "sectionId"=s.id AND status='ACTIVE' GROUP BY "academicYearId" HAVING count(*)>davi_effective_capacity(s.id)) THEN
   RAISE EXCEPTION 'Capacity policy exceeds occupied section seats' USING ERRCODE='23514';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER capacity_policy_guard AFTER INSERT OR UPDATE ON "SchoolSetting" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION davi_policy_capacity_guard();
