# Student Import & Migration

Students > Import & Migration (`/students/import-migration`) is the durable
migration wizard. The existing Students > Upload Students & Sections flow remains
available for creating admission applications and follow-up records. The migration
wizard is an explicitly approved import of student/enrollment records; it does not
pretend that extracted documents are approved admissions applications.

## Workflow

1. Select an academic year and upload CSV, XLSX, PDF, JPG/JPEG or PNG files. The
   server derives school identity from authentication. Files use random private
   keys and are not served statically.
2. Queue extraction. Every source must pass malware scanning. Deterministic CSV
   and ExcelJS parsing handles spreadsheets; PDF.js extracts positioned text.
   Opt-in local Tesseract OCR handles scanned PDFs/images, including rotation
   trials. Extraction never queues a commit.
3. Review automatically suggested column mappings. Ambiguous heading suggestions
   are left unmapped. Use per-file overrides when the same heading has different
   meanings in different files. Applying a mapping resets corrections/review for
   that scope while retaining original evidence.
4. Review class/section groups and filter/search the paginated staging table.
   Inspect a row to edit target values, inspect its original source values,
   confidence, page/table/row reference, and confirm human review.
5. Calculate section proposals from effective school/group/class/room/section
   capacity and current active enrollment. Missing classes can be approved through
   the existing class API with an explicitly selected academic group. Proposed
   sections require SECTION_CREATE and ENROLLMENT_ALLOCATE approval. Published
   timetables and class teachers are not changed. Revalidate after setup changes.
6. Resolve exact admission-number matches and possible secondary matches. Choose
   Create New, Update Existing, Skip or Resolve Conflict. Names alone never select
   an existing student for an update.
7. Revalidate, review the final operation counts and enter a decision reason.
   Explicit commit approval queues background writes. Each student operation and
   its staging success marker commit atomically. Successful rows are not repeated
   when failed rows are corrected and retried.
8. Inspect history, download error CSVs and run a rollback dry-run. Approved safe
   rollback withdraws unchanged newly created enrollments or restores the prior
   demographic/enrollment values of unchanged updates. Identities, parent accounts,
   created classes/sections and existing academic facts are never deleted.

## Mapping and validation

The Excel template has one Students sheet with text-formatted identifiers and
header notes; no instruction sheet is mistakenly imported as student data.
CSV parsing recognizes comma, semicolon, tab and pipe separators outside quotes.
XLSX supports multiple sheets, repeated headers and dates. Formula results are
not evaluated/imported; their original formula is retained for review. ZIP entry
counts, expanded sizes and embedded executable content are checked before inflate.

Fields include admission number, first/last or intact full name, date of birth,
gender, class, section, guardian name/mobile/email, address, admission date and an
explicit verified parent ID. Missing required values are never invented. Full
names remain intact unless an administrator explicitly splits/corrects them.
Dates use YYYY-MM-DD. Parent mobile validation follows the existing DAVI Indian
mobile rules. Address/admission date are saved on the school/year enrollment.

A class must belong to the selected school/year. Source class names, not age
inference, determine the target class. A section must be active and belong to that
class. Explicit sections and automatic suggestions are checked as a staged batch,
then checked again transactionally during commit. If another import takes a seat,
the affected operation fails safely and needs revalidation; overbooking is blocked.
Imported updates never implicitly promote students between academic years.

Exact school/year admission numbers take priority. Configurable NAME_DOB and
PARENT_MOBILE matches create review warnings. Split and intact full names are
compared consistently. Secondary results are candidates, never automatic merges.
Update Existing requires explicit selection of the matching admission record and
checks a snapshot of the current student/enrollment before writing. A school
cannot use migration to change a student identity shared with another school.

Parent registration reuses StudentAdmissionsService. A shared phone number is
insufficient to reuse a parent during migration: the row must explicitly select
an active, already VERIFIED parent membership in the same school. If verification
is pending, Parents > Verify consent records the authorized user's documentary
reference with a stale-membership check and audit. No pending student links are
silently activated. Shared parent profile corrections use the existing Parents
workflow; importing an existing student's demographic/enrollment update does not
silently rewrite another person's account.

## Storage, workers and permissions

StudentImportJob, StudentImportFile and StudentImportRow retain statuses, mappings,
corrections, evidence, validation issues, operation choices, snapshots and results.
Composite foreign keys bind year to school and each row to its exact job/file/
school/year. Unique job idempotency keys and source references, plus existing
school/year admission-number uniqueness, prevent repeated successful writes.

The existing project has a Redis service definition but no installed BullMQ queue
integration or available Docker/Redis runtime in this environment. The wizard
therefore follows DAVI's existing PostgreSQL worker pattern rather than adding a
second required queue service. A worker polls every 10 seconds, claims jobs with
conditional leases, renews its lease and recovers interrupted work. Validation
above 200 staging rows is queued as VALIDATING and processed in the background
with a bounded two-minute transaction; smaller corrections validate immediately. It processes
at most four selected jobs serially per tick. Set STUDENT_MIGRATION_WORKER=0 in
fixture-only processes. All runtime instances may poll safely; PostgreSQL leases
and transactional row status checks coordinate them.

Permissions are students.import.view, students.import.manage,
students.import.commit and students.import.rollback. Existing STUDENT_CREATE,
STUDENT_UPDATE, ENROLLMENT_MOVE and academic creation permissions are rechecked
for their underlying operations, including the approver's current active role at
commit time. School-admin roles receive the new permissions through migration and
seed. Refresh sessions to refresh navigation permissions. Explicit consent
verification uses the existing PARENT_UPDATE permission.

Defaults: 5 files, 10 MB per file, 50 total pages/sheets, 5,000 extracted rows,
10 new jobs per school per hour and 7 days of source retention. Administrators can
configure bounded limits in the wizard. Hard upload ceiling is 20 MB per file and
10 files. OCR/raster input is capped at 20 megapixels; image dimensions are checked
before decode. Failed/infected/unavailable-scanner files cannot validate or commit.

Sources are stored under private-uploads/student-migrations relative to the backend
working directory, using exclusive writes. Downloads require job/file tenant access
and a clean scanner verdict; responses are attachment-only and no-store. The worker
removes expired source bytes and records a purge audit while retaining import
history. Database staging/evidence and rollback snapshots remain protected PII in
the database: use the deployment's existing database encryption, backups, access
policy and archival/deletion process for those records. Source-file TTL does not
claim to be a database PII-erasure policy.

Audit logs record uploads, mapping changes, corrections, validation, approval,
per-row commit, section approval, rollback and source expiry. Logs contain job/row
IDs and error categories, not source text. Error reports protect CSV formula cells.
API usage totals are school scoped. Extraction is local-only: no cloud AI provider
is enabled, documents are never sent to an LLM, and inputTokens/outputTokens/costMinor
remain zero. Local OCR requires explicit opt-in for each extraction request.

## Deployment

Migrations 20261019160000_student_migration,
20261019163000_student_migration_contact_details and
20261019170000_student_migration_file_scope are applied locally. Deploy migrations,
regenerate Prisma Client, build and restart the backend for other environments.

Configure a real ClamAV daemon before accepting production imports. The optional
Compose profile provides the official image with a persistent signature volume
and loopback-only port. It is not started by ordinary docker compose up.

```powershell
docker compose --profile student-migration up -d clamav
```

Backend environment:

```dotenv
MIGRATION_CLAMD_HOST=127.0.0.1
MIGRATION_CLAMD_PORT=3310
MIGRATION_OCR_LANG_PATH=/absolute/private/path/to/ocr-models
# Optional: STUDENT_MIGRATION_WORKER=0 only for fixture/test processes
```

Place official eng.traineddata in the OCR model directory. The local development
model is installed under the ignored private-uploads/ocr-models directory and its
path is configured in the ignored backend .env. No model or student document is
committed to git. The scanner uses the ClamAV INSTREAM protocol and never shells
out with source filenames. Use loopback or a trusted private scanner network;
the ClamAV TCP protocol itself does not provide transport encryption.

ClamAV needs sufficient memory and current signatures. The optional service allows up to
4 GB and defaults to the official stable_base image; set CLAMAV_IMAGE to an approved
version/digest for your deployment. See the [official ClamAV container documentation](https://docs.clamav.net/manual/Installing/Docker.html)
for image tags, signature persistence and memory requirements.

After the backend build, check readiness:

```powershell
npm.cmd run migration:check --workspace apps/backend
```

The command checks the database/schema, local OCR model and a real scanner verdict
using synthetic text. It exits nonzero when scanning is unavailable. It does not
mark unscanned files clean. In this execution environment the database, schema and
OCR checks pass; the scanner check is blocked because neither ClamAV nor Docker is
installed. The source quarantine must remain enforced until a daemon is configured.

## API under /api/v1

All routes use JWT authentication and active school RBAC.

| Route | Purpose |
| --- | --- |
| GET/POST student-migrations | School/year history or idempotent job creation |
| GET student-migrations/lookups, capabilities, usage | Scoped setup, readiness flags and token/cost totals |
| GET/PUT student-migrations/policy | Bounded import policy |
| GET student-migrations/template | Excel template |
| GET student-migrations/:id | Status, files, counts and class/section groups |
| POST student-migrations/:id/files | Private multipart upload |
| POST student-migrations/:id/extract | Explicit extraction/retry queue |
| GET student-migrations/:id/files/:fileId/source | Authorized clean-source download |
| GET/PATCH student-migrations/:id/rows[/rowId] | Filtered staging or versioned correction |
| PUT student-migrations/:id/mapping | Global or file-specific mapping |
| POST student-migrations/:id/validate | Revalidation and final operation summary |
| GET student-migrations/:id/allocation | Effective-capacity proposals |
| POST student-migrations/:id/sections | Explicit proposal approval |
| POST student-migrations/:id/commit | Versioned, reasoned commit approval |
| GET student-migrations/:id/error-report | Safe error CSV |
| GET student-migrations/:id/rollback-impact | Dry-run impact and blocked records |
| POST student-migrations/:id/rollback | Approved safe rollback subset |
| POST parents/:id/consent-verification | Reasoned, version-checked consent evidence |

## Validation and remaining environment checks

Tests cover heading variants, quoted/delimited CSV, XLSX formula/date handling,
multi-class text PDFs, scanned PDFs, rotated/blurred synthetic OCR images, blank
positioned columns, tenant/RBAC denial, private download quarantine, duplicate
admission numbers, parent consent, per-file mappings, missing setup, staged
capacity, concurrent imports, row idempotency, retries, worker lease recovery,
source TTL, safe restoration/withdrawal and independently modified rollback blocks.
Verified result: 273 backend tests and 38 frontend tests passed, with one unrelated
opt-in academic workflow test skipped. Frontend rendering tests cover wizard states,
commit authorization, required reasons and blocked rollback. Both builds, TypeScript,
Prisma schema validation and local migration status pass.

A real scanner deployment and browser/mobile visual acceptance remain environment
checks. No browser was exposed by the computer-use tooling in this session; a
browser tab could not be opened. Render tests are not a substitute for that check.
No thousand-school or large-document load benchmark is claimed.
