# Admissions CRM and flexible section allocation

## Bulk student upload

Students > Student Import > Upload students & sections creates enrollments directly
in the Student Directory after preview and explicit approval. It creates no
admission enquiry, application or follow-up. The commit rechecks student creation
permissions and capacity, creates approved sections and students atomically, and
records a school-scoped audit. Repeating the same approved payload returns the
previous result without adding duplicate students. Manual enquiries use the
separate workflow below.

## Current admission workflow

Register an enquiry and its follow-ups, then choose **Create admission** to reuse
the enquiry's student, parent, contact, class and academic-year details. Complete
the admission details and required documents/fees, then choose **Confirm admission**.
No separate admission decision or joined/not-joined action is required.
The confirmation validates permissions, versions, duplicates and section capacity,
creates the enrollment and marks its enquiry converted in one serializable transaction.
Blank admission numbers use the configured school short name. The endpoint is
`POST /api/v1/admissions/applications/:id/confirm` and uses the existing
`ADMISSIONS_JOIN` permission. Legacy decision/joining records and endpoints remain
compatible; their navigation URLs redirect to Admissions.


## Workflow and existing integrations

The existing StudentAdmissionsModule now owns enquiries, append-only interactions,
applications, verified application-fee records, private admission documents and
joining. Joining reuses StudentAdmissionsService to create the student, guardians,
parent memberships and enrollment in the same serializable transaction. Existing
student, parent, academic-year and class models remain the source of truth.

StudentEnrollment.sectionId was already nullable. It remains optional during an
application and by default at joining and promotion. Admission Settings can require
a section when a confirmed enrollment is created. Approval and an enquiry do not
create an enrollment. NOT_JOINED records also create no student or enrollment.
Joining requires an approved application, a unique admission number and actual
joining date, configured documents, and sufficient verified payment or an authorized
waiver when the application fee is mandatory. Existing student profiles must use
the promotion workflow rather than being recreated through Admissions.

The existing POST /student-admissions URL remains available for authorized direct
admission requests. It now records an application and an authorized approval before
running joining; it requires admission-management, decision, joining and the legacy
student-create permissions. When fees or documents are outstanding, staff complete
the pending application through Admissions instead of bypassing those requirements.

Enquiries deduplicate the same student name, primary mobile, class and year within a
school, ignoring name case. A repeat submission appends an interaction and returns
the existing record. Different children sharing a guardian may have separate records.
Every follow-up preserves its occurrence time, method, remarks, outcome, actor,
assigned staff, next schedule and resulting status. Application conversion and
CONVERTED statuses are controlled by application/joining services.

## Navigation

Admissions provides Overview, Enquiries, Follow-ups, Applications, Admission
Decisions, Joined / Not Joined and Admission Settings. Applications may be submitted
directly or started from an enquiry. Unjoined applications under review, waitlisted
or rejected can be amended and returned to review. Approved applications must return
to review before amendment. Joined records use student/enrollment workflows.

Students provides the existing Student Directory and profile URLs, Unassigned
Students, Class & Section Allocation, Transfers & Swaps and Promotions. Directory
enrollment data follows the selected academic year. Class Workspace includes
unassigned students in its confirmed class totals and provides allocation guidance;
unassigned students are excluded from section attendance and timetable rosters.

The admissions dashboard separately counts enquiries, applications, approvals and
joining outcomes. Class counts come from ACTIVE enrollments, never from offers or
enquiries. Application-fee collections exclude unverified payments, waivers and
refunded records. All dashboard and list queries are school scoped and support
academic-year/class filters; enquiry/application lists use server pagination.

## Fees, form configuration and documents

Admission Settings configures the school-branded form title/description, additional
required/optional fields, required document types, section-at-joining rule and
class/year fee policies. Each class/year can have one fee rule. Application fee
amounts use integer minor units (INR paise) and are distinct from admission fees or
tuition. No tuition ledger or payment gateway existed in this project, so no online
payment success or external accounting integration is simulated.

Cash, bank-transfer and manually verified UPI records start PENDING. A user with
fee-verification permission records an explicit verification/rejection and reason.
Only VERIFIED records count as collected. Receipts are generated on the server
after verification and are viewable/printable from the application. Refunds preserve
the original verification and receipt and append a reasoned history event. Staff
must review the displayed refund policy before recording a refund. Waivers require
the configured eligibility, an authorized verifier and a recorded decision reason;
waived balances do not count as cash collections. Existing applications retain a
snapshot of their fee policy when settings change.

Documents use authenticated multipart upload and download, with PDF/PNG/JPEG magic
byte validation, a 5 MB limit and at most 20 files per application. Files use random
storage keys under private-uploads/admissions, are never publicly served, and their
paths are excluded from API responses. Back up this directory with the database.
The application records original names, document type, size and uploading actor.

## Section planning, movements and historical records

The allocation planner shows confirmed class enrollments, existing sections and
unassigned students. Staff choose a desired section count and actual capacities.
Preview calculates a balanced distribution while treating existing section
occupants as fixed. Proposed new sections are not written during preview. Staff
can change each proposed destination, then explicitly confirm section creation and
allocation. Confirming rechecks enrollment versions, section configuration,
unassigned-roster membership, tenant/class/year relationships and final capacity.
Creating or changing section configuration requires the corresponding existing
SECTION_CREATE / SECTION_UPDATE permission in addition to allocation permission.

Individual/bulk moves and same-class or cross-class swaps share the transactional
movement service. Final occupancy checks allow swaps between full sections. Target
sections need configured capacity. Competing reservations lock section rows in a
stable order, run at SERIALIZABLE isolation and surface deferred constraint errors
before returning success. Conflicts require a refresh and new preview. A database
constraint trigger also protects capacity through older enrollment/configuration
write paths. Class/year and cross-school destinations are validated server-side.

Each move stores the previous/current class and section, reason, actor and time.
Roll numbers are cleared for reassignment; previous rolls are retained in movement
notes. Attendance stores class/section snapshots and marks store section snapshots.
Legacy facts are backfilled during migration and protected with restrictive foreign
keys. Historical attendance queries and exam results resolve those locations rather
than relabeling old facts with the student's new section. Monthly registers also
include historical records of students who moved out. Promotions create a separate
enrollment in a later, explicitly dated academic year and mark the old enrollment
PROMOTED without moving or deleting its attendance/marks.

## Permissions and migration

Existing RBAC remains in use. New admission endpoints restrict role lookup to an
active membership in the authenticated school; roles in another school cannot
authorize access. No request body may select a different school.

| Permission | Purpose |
| --- | --- |
| ADMISSIONS_VIEW | Read CRM, dashboard, forms, fees and private documents |
| ADMISSIONS_MANAGE | Enquiries, follow-ups, applications/amendments and documents |
| ADMISSIONS_DECIDE | Approve, reject, waitlist, withdraw or return to review |
| ADMISSIONS_JOIN | Confirm joined / not joined and create approved enrollment |
| ADMISSIONS_FEES_RECORD | Record pending application payments |
| ADMISSIONS_FEES_VERIFY | Verify/reject/refund payments or authorize eligible waivers |
| ADMISSIONS_SETTINGS_MANAGE | Configure admission form, documents and fee policies |
| ENROLLMENT_ALLOCATE | Preview/confirm section allocation |
| ENROLLMENT_MOVE | Individual/bulk assignments, class transfers and swaps |
| ENROLLMENT_PROMOTE | Create the next academic-year enrollment |

Read access to the student tools uses STUDENT_VIEW. Grant the view permission with
the relevant management permissions. The migration grants all new permissions to
existing SCHOOL_ADMIN roles; refresh sessions after deploying it. Legacy enrollment
URLs delegate to the new promotion/movement services and require those permissions.

Migration 20261018120000_admissions_crm_allocation adds the CRM/payment/document
and movement records, admission settings, enrollment versions and historical
location snapshots. It retains assigned sections and existing enrollments.
20261018130000_admissions_reference_integrity protects application/enquiry and
movement references with restrictive foreign keys. Both migrations have
been applied to the local database. Other environments must deploy them and regenerate
Prisma Client before starting the updated backend.

## API overview

All paths below are under /api/v1 and require JWT school authentication and the
appropriate permissions.

| Path | Operations |
| --- | --- |
| admissions/lookups, admissions/dashboard | GET school-scoped configuration and counts |
| admissions/settings | GET / PUT settings |
| admissions/enquiries | GET paginated list / POST enquiry |
| admissions/enquiries/:id | GET enquiry and interaction history |
| admissions/enquiries/:id/followups | POST interaction and next schedule |
| admissions/applications | GET paginated list / POST direct or enquiry application |
| admissions/applications/:id | GET application, payments, documents and history |
| admissions/applications/:id/amendment | POST versioned form amendment |
| admissions/applications/:id/decision | POST versioned admission decision |
| admissions/applications/:id/joining | POST versioned joined / not-joined confirmation |
| admissions/applications/:id/payments | POST pending payment record |
| admissions/payments/:id/verification | POST reasoned verification/rejection/refund |
| admissions/applications/:id/waiver | POST eligible outstanding-fee waiver |
| admissions/applications/:id/documents | POST authenticated multipart document |
| admissions/applications/:id/documents/:documentId | GET authenticated download |
| enrollment-planning/lookups | GET tenant academic years/classes/sections |
| enrollment-planning?academicYearId=&classId= | GET confirmed roster and planning data |
| enrollment-planning/preview, enrollment-planning/confirm | POST allocation plan |
| enrollment-planning/moves | POST transactional assignments/transfers/swaps |
| enrollment-planning/promotions | POST transactional academic-year promotion |
| enrollment-planning/:id/history | GET enrollment movement history |

## Validation

Validated: backend and production web builds, TypeScript, Prisma schema/migration
status, 244 backend tests (including all database integration suites), and 26 web
tests passed without failures or skipped tests.

The admissions integration suite uses uniquely named, non-login test schools and
removes only its own fixture records and files. It covers enquiry deduplication and
history, enquiry/direct applications, document isolation, verified fees/waivers,
approval, not-joined/joined outcomes, nullable sections, workspace counts, capacity
rejection, explicit new-section confirmation, swaps, class transfers, historical
attendance/marks, promotion, cross-school denial, authenticated HTTP endpoints and
genuinely concurrent joining/last-seat assignments. Pure tests include the
125-student/five-section allocation example and input/permission validation.

```powershell
npm.cmd run build --workspace apps/backend
$env:ADMISSIONS_DB_TEST='1'
node --env-file=apps/backend/.env --test --test-concurrency=1 apps/backend/test/admissions*.test.js
node --test apps/web/test/*.test.js
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/web/tsconfig.json
npm.cmd run build --workspace apps/web
```

Browser/mobile visual acceptance still requires a signed-in browser session. The
repository has no configured ESLint script or ESLint installation.

## Section Capacity & Allocation

Academic Setup > Section Capacity & Allocation reuses the existing enrollment
planner and `/enrollment-planning` routes. The legacy Students allocation route
continues to render the same component. Quick academic setup now links to the
planner and creates classes only. Sections and capacities are configured later;
Quick academic setup does not display or submit section count or capacity.

Set the maximum students per section for the selected academic group, then choose
**Generate sections from group norms**. The calculation includes ACTIVE enrollment
and pending applications, subtracts existing usable seats, and divides any shortage
by the saved effective group capacity, rounding up. Manual section plans remain
available as an advanced alternative. Existing sections and their heterogeneous capacities are preserved.
The suggestion creates no database records. Preview balances student counts (or
percentage utilization) and shows proposed placements. Approve Allocation requires
a reason and confirmation; SECTION_CREATE is additionally required for new
sections, and SECTION_UPDATE for changed capacities. ENROLLMENT_MOVE authorizes
reviewed single/bulk movement, rebalancing and atomic two-student swaps through
the existing transfer screen.

School capacity policy is stored in SchoolSetting.sectionCapacityPolicy. Rules
can target an academic year plus academic level, grade, existing room label or
section. All applicable maxima are ceilings: the smallest wins. The largest
applicable reservation is deducted once; reservations are not additive. A school
maximum is optional. Existing Section.capacity remains the manually configured
physical capacity. Classroom identity reuses Section.room; equal room labels share
a ceiling, but this does not create a room timetable or pooled room-seat model.
The policy editor supports school defaults, scoped limits/reservations, near-full
percentage, balancing preference and student allowed/preferred sections. Empty
allowed-section lists explicitly prevent automatic placement. More constrained
students are considered first, with augmenting paths among proposed placements
before reporting a shortage. Existing placements are fixed. Stable enrollment
order and section IDs resolve ties. Preferences are soft; allowed sections and
capacity are hard constraints.

Unplaced ACTIVE enrollments are the persistent placement waitlist; no duplicate
student or enrollment identity is created. Preview reports which students cannot
be placed and why. Approval can assign available students and leave the reviewed
remainder unassigned. This is a placement waitlist for confirmed enrollments, not
a separate pre-admission application queue. New sections do not automatically gain
class teachers or published timetable entries. Use the existing teacher allocation
and timetable validation/publishing workflows after approving a new section.

Admission confirmation, promotion and withdrawal already write the common active
enrollment source. Summary and previews therefore reflect those changes on reload;
there is no background reassignment or implicit movement on a year switch. When
autoAssignOnJoin is enabled, a new confirmed admission with no manually selected
section receives an available section inside its joining transaction. School
requireSectionOnJoin policy continues to reject joining without a section; schools
using a confirmed-enrollment placement waitlist must allow unassigned enrollment.
Capacity reporting and placement remain scoped to school and academic year.

`POST /enrollment-planning/capacity-policy` uses SECTION_UPDATE, validates school/year
relationships and current occupancy, compares the expected policy, and audits the
before/after decision. Preview returns expectedPolicy and section timestamps;
approval revalidates them and enrollment versions. Admission, promotion and
movement checks use the effective policy capacity. Migration
20261019120000_section_capacity_policy adds the JSON policy, a partial active-seat
lookup index, and PostgreSQL guards enforcing effective capacity even on older
write paths. Policy changes cannot reduce usable seats below active occupancy.
Serializable transactions and final-state deferred checks protect concurrent seat
reservations and allow full-section swaps. Allocation approval stores the reviewed
plan, waitlist, old section configuration and reason in school audit logs; movements
also retain existing enrollment movement history and add school audit entries.

Validation: backend and frontend builds and web TypeScript checks passed. Added
unit coverage for scoped maxima, reservations, heterogeneous capacities, deterministic
waitlists, constrained/preferred placement, utilization balancing and augmenting
paths. PostgreSQL admission integration tests cover reviewed partial allocation,
policy conflict detection and concurrent competition for one seat, alongside the
existing admission/promotion/swap fixtures. Browser/mobile visual acceptance has
not been performed. Restart the backend after deployment to load the new schema.

## Student upload and norm-based intake

Use **Students > Upload Students & Sections** (`/students/upload`). Set the maximum
students per section for each academic group in Section Capacity & Allocation;
these are school-entered norms, not hard-coded regulatory assumptions. Quick
academic setup creates classes without section counts or capacities.

Download the CSV template and supply firstName, className, parentName and mobile.
Optional columns are lastName, dateOfBirth (YYYY-MM-DD), gender and extra.fieldKey
for existing configured application fields. The class must match an active class
name in the selected academic year. Class eligibility is explicitly taken from
the record; the system does not infer it from age. CSV input is limited to 500
students and 1 MB, supports quoted cells and rejects ambiguous headers or malformed
rows. Backend validation normalizes parent mobile numbers and rejects unknown
classes, repeated students, existing applications and missing required fields.

Preview (`POST /enrollment-planning/intake-preview`) groups uploaded applicants by
class, includes existing confirmed students and pending applications, and generates
proposed section counts from saved effective capacities. Existing placements stay
fixed. For 76 incoming students, no current occupants and a group maximum of 30,
three sections are proposed with a balanced projected distribution of 26, 25, 25.
Individual section/room caps and reservations still restrict usable seats. There
is no default guess when capacity norms are missing.

The review shows each class, required/retained sections, current occupancy,
projected counts and student suggestions. Import confirmation
(`POST /enrollment-planning/intake-confirm`) rechecks the exact preview against
current school/year policy, enrollment versions, pending applications and section
configuration. It creates sections and applications atomically and records a
school audit. ADMISSIONS_MANAGE is required; creating proposed sections additionally
requires SECTION_CREATE and ENROLLMENT_ALLOCATE. Each application links to an
enquiry with a follow-up scheduled 24 hours after import. These are in-app CRM
records; no external messages are sent. A repeated import is rejected instead of
creating duplicate applications.

Uploaded applications do not create enrollments, reserve seats or bypass required
documents, verified fees, admission decisions or joining confirmation. Suggested
sections are provisional. With automatic assignment enabled in capacity policy,
joining selects an available eligible section using the saved balancing preference,
locks sections in stable order and rechecks effective capacity inside the same
serializable transaction. The application stores the section actually assigned.
A manually chosen section is validated rather than silently replaced. When no seat
is available, confirmed enrollment remains on the placement waitlist if the school
allows unassigned joining; requireSectionOnJoin continues to block joining without
a seat. Concurrent conflicts require refresh/retry. Existing students, published
timetables and class-teacher assignments are not changed.

The normal application form supports the same automatic-at-joining choice. The
allocation planner's norm-based generation now counts pending manual applications
as well as confirmed enrollment, so sections can be reviewed before those students
join. Existing transfer/swap and promotion workflows remain available.

Additional validation includes deterministic 76/30 section generation, reserved
capacity arithmetic, quoted CSV parsing, duplicate/stale intake rejection, import
rollback without approval, scheduled follow-up links and concurrent automatic
joining for the final seat. Browser/mobile visual acceptance remains outstanding.

## Durable migration wizard

For CSV/XLSX/PDF/images, persisted staging, OCR, explicit student/enrollment commit,
import history, verified parent identity and safe rollback, use **Students > Import
& Migration**. See [Student Import & Migration](student-import-migration.md) for the
workflow, permissions, scanner/OCR setup, API routes and validation limits. The
simple CSV intake above remains the admission-application/follow-up workflow.
