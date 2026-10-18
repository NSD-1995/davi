# Admissions CRM and flexible section allocation

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
