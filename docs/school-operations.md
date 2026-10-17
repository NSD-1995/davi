# Staff attendance and daily school operations

## Codebase audit and implementation plan

The existing AttendanceModule already owned student/staff attendance and teacher
self check-in. StaffAttendance had a unique staff/date key and school/date index.
TimetableModule already owned CoverageService, deterministic coverage ranking,
date-specific TimetableSubstitution records, published weekly plans, school-time
conversion, a recurring reconciliation worker and serializable assignment checks.
Notifications and AuditLog were already available. Teachers already supported
subject capabilities, class restrictions and multiple academic-group responsibilities.
RBAC used Permission, RolePermission and UserRole with JWT authentication.

The main gaps were all-staff rosters, delegated scopes, correction reasons and
audits, locks, approved leave, daily duties and an approval-first cover workflow.
The old cutoff worker inferred absence from missing check-ins; that behavior has
been removed. No duplicate attendance, weekly timetable or notification module
has been introduced.

Implementation order: extend and test attendance controls; add manager scopes;
connect leave/balances and duties to coverage; add reviewed substitutions and a
shared effective timetable; add operations/My Day screens; run database,
concurrency, regression and frontend checks.

## Service boundaries

- `StaffAttendanceService`, in the existing AttendanceModule: virtual daily roster,
  calendar, all-staff bulk marking, correction audit, locking and history.
- `OperationsAccessService`, exported by AuthModule: active tenant membership,
  granular permission checks and delegated staff/lesson scopes.
- `SchoolOperationsService`, in AttendanceModule: leave, balances, duties, policy,
  delegation, daily overrides, effective timetable, My Day and overview.
- Existing `CoverageService`: confirmed unavailability, proposed cover,
  transactional approval, cancellation, acknowledgement and background retries.
- Existing deterministic coverage engine: hard eligibility/availability/overlap
  checks, ranked candidates and coordinated proposals. The weekly generator is
  unchanged by this module.

## Attendance behavior

The daily roster reads active teaching and non-teaching staff. Re-reading it does
not create attendance rows. Missing rows are NOT_MARKED, HOLIDAY or WEEKLY_OFF,
according to the school calendar and configured working days. Teacher available-day
restrictions also apply to unmarked roster rows. Approved leave is displayed as
ON_LEAVE or HALF_DAY without overwriting attendance history.

Statuses include PRESENT, ABSENT, LATE, HALF_DAY, ON_LEAVE, ON_DUTY, NOT_MARKED,
HOLIDAY and WEEKLY_OFF. Legacy PERMISSION remains accepted. HALF_DAY requires
explicit unavailableFrom/unavailableUntil clock times. Bulk marking is limited
to 1,000 distinct staff records and is atomic. Existing records require override
permission and a non-empty correction reason. Versions reject stale updates.
Every saved row has an actor, markedAt, source and a before/after audit.

Staff Attendance and Teacher Attendance offer **Mark unmarked present**, followed
by **Save all changes**. Existing absence, leave, holiday, weekly-off and edited
statuses are preserved. Staff filters restrict the rows filled by the shortcut.
Individual saves remain available and preserve other pending edits and versions.
Corrections require a reason and override permission; the bulk save is atomic.

School-wide day locks are controlled by school administrators; reopening requires
a reason. Lock and reopen actions are audited. Self attendance defaults to off,
supports non-teaching staff, records server check-in/out timestamps, is idempotent
and cannot bypass locks or confirmed absence/leave. All staff/date keys represent
school-local calendar dates, stored as UTC date keys. Check-in/out timestamps are
instants and must belong to that local date.

The cutoff worker sends deduplicated in-app reminders. It never creates an ABSENT
record, including when an expected late arrival is missed. Historical AUTO_CHECKIN
and AUTO_EXPECTED_ARRIVAL records are treated as unconfirmed when determining
coverage; a manager must confirm an actual absence. Reconciliation after an
attendance save can report PENDING_RETRY without losing the attendance change.

## Permissions and scopes

New permission codes are seeded through migrations and the existing permission
seed. Assign them using Roles & Permissions:

| Permission | Responsibility |
| --- | --- |
| staff.attendance.view | Managed roster and audit history |
| staff.attendance.mark | Initial/manual/bulk marking |
| staff.attendance.override | Corrections to existing records |
| staff.attendance.manage | Policy and delegation; school-wide locks require admin |
| staff.leave.request | Own leave requests |
| staff.leave.approve | Scoped decisions and emergency requests for staff |
| timetable.substitution.view | Scoped daily lessons and cover |
| timetable.substitution.generate | Generate cover proposals |
| timetable.substitution.approve | Review/approve or change a replacement |
| timetable.substitution.cancel | Cancel cover or a date-specific lesson |
| operations.dashboard.view | Operations overview |
| operations.tasks.manage | Scoped duties |

School admins retain school-wide access. Legacy attendance/cover permission
combinations remain accepted at existing endpoints, but non-admin managers must
also receive a delegated scope. A permission alone grants no managed staff.
Scope can contain academic groups, classes, sections, individual staff or department
values. Empty scope grants no managed records. A teacher can match several groups;
there is no single fixed teacher compartment. Lesson access uses the target class
and section, so a shared teacher does not grant access to all their classes.

Departments reuse an administrator-selected existing school profile field. Select
it in Operations Settings, then assign department values to manager scopes. No
duplicate department catalog or staff profile has been created. Self endpoints
derive identity from the authenticated user rather than accepting another user ID.

The overview requires its dashboard permission plus the underlying attendance,
substitution-view, leave-approval and duty-management permissions for the data it
shows. Give a delegated in-charge these read/management permissions as appropriate
and a scope. My Day requires an active staff profile, and shows only that staff
member's attendance, leave, duties, notifications and applicable lessons.

## Generate daily substitutions

On Substitution Planner, select the school date, save attendance changes, then
press **Generate daily substitutions** in the Daily substitutions section.
The existing refresh/reconciliation API creates reviewed proposals for published
lessons affected by confirmed unavailability. The button requires substitution
generation permission (or its existing legacy permission combination). Generation
is blocked in the interface while attendance drafts are unsaved. A result message
shows proposed, approved/completed and uncovered counts within the user's scope.
Select or accept the proposed eligible substitute, then approve the assignment.
Generation never replaces coordinator approval or changes the weekly timetable.
A date without confirmed unavailability, published affected lessons or remaining
periods may correctly produce no proposals. The empty state explains these inputs.

### Troubleshooting an absence with no substitution

An absence does not create new lessons. For example, an absence saved on Saturday
2026-10-17 has no cover requirements when the published template works Monday to
Friday. The planner now returns per-teacher published timetable, working-day,
scheduled lesson and remaining affected lesson diagnostics with the scoped roster.
It explains off-day/no-lesson cases, holidays, missing published assignments and
already-ended periods, and displays the configured school timezone. These checks
do not move attendance, change school settings or add weekend lessons.

For a working-day absence, select the correct date and save attendance for that
date. If Saturday is genuinely a teaching day, update the period template, generate
and publish the regular timetable first. New cover cannot be approved retroactively
after the affected lesson ends. Review an unexpected school timezone in the existing
automation settings; device timezone is not used to override school policy.

## Staff categories and substitution order

Staff management stores a job category separately from access roles: Teaching,
Non-teaching or Admin/accounts. Administrators can edit it through the existing
staff form. Migration 20261017110000_staff_categories backfills existing teacher
profiles as Teaching, other school-admin staff as Admin, and remaining staff as
Non-teaching. Accounts/office staff should be reviewed and categorized explicitly;
custom role names are not used to guess a job category.

The attendance/cover screen defaults to Teaching and offers category tabs plus a
link to the full staff roster, where staff without teaching/cover profiles are
also included. Bulk present applies to the visible category. All pending edits
can still be saved together.

Substitution matching is configurable in Substitution Planner automation settings.
The default Subject-qualified mode preserves subject eligibility. Same-compartment
free-period mode allows cover without the specific subject responsibility, but
requires the candidate's compartment membership plus class eligibility. Explicit
group responsibilities take precedence over broad academic groups; legacy profiles
can establish compartment membership through their published teaching timetable.
An explicitly empty responsibility list still excludes the teacher. Kidzee uses
the same-compartment rule. Non-teaching profiles must explicitly enable substitution
and belong to the compartment. Admin/accounts remain excluded. The visible
compartment filter organizes review; generation still checks the selected day.
Candidates show the exact free interval, and manual approval revalidates the same
rules. Free time alone does not waive daily/weekly workload, minimum-free-time,
leave, attendance, class restrictions or overlapping duties/cover. Shortages remain
uncovered with rejection reasons rather than forcing an invalid assignment.

Substitution ranking uses strict category order before suitability: qualified,
available Teaching staff first, then qualified Non-teaching staff. Admin/accounts
staff are excluded, including from manual substitution approval. Roles do not
change this ordering. Attendance, leave, overlaps, qualifications, class eligibility
and workload limits remain mandatory for both categories. Coordinators may select
an eligible fallback manually; the first proposal always follows category order.

Non-teaching staff need an existing teaching/cover profile to hold a substitution,
because substitutions reference Teacher. Reuse Teachers & cover profiles to add
that profile, configure subject/class eligibility and enable substitution. Creating
a staff account alone never makes someone a qualified replacement. No duplicate
staff identity or substitution table is introduced.

### Custom school categories

Admins and users granted STAFF_CATEGORY_MANAGE can use **Staff > Add/Edit >
Create staff category**. Enter a school-specific name and map it to Teaching,
Non-teaching or Admin/accounts. The category is saved immediately, selected in
the staff form, and assigned when the staff changes are saved. Category creation
is audited. Assigning an existing category requires the usual STAFF_CREATE or
STAFF_UPDATE permission; creating a category grants no staff access or login role.

Names are unique per school ignoring case. Categories cannot be assigned across
schools. Classification is fixed at creation so category edits cannot silently
change substitution priority for many employees. The existing three built-ins
remain available. Custom labels do not replace RBAC roles or the substitution
classification. The migration 20261017120000_custom_staff_categories preserves
all staff assignments and adds the management permission to existing school-admin
roles. Refresh sessions after permission changes.

## GPS attendance and exceptions

Attendance Settings at /operations/attendance-settings configures Admin Only,
Staff Self Check-in or Both, working days, check-in/out times, grace minutes,
early departure rules, correction requests and admin overrides. Department and
individual shifts can override working days and punch times; explicit staff
assignments take precedence over department assignments. Department/designation
reuse existing school profile options, not new department tables. Holidays reuse
SchoolEvent. Leave Policies at /operations/leave-policies configures each type.

Self punches request browser geolocation once after an explicit button press,
when verification is enabled. The server calculates Haversine distance and checks
accuracy, mode, own active staff account, calendar, leave, locks and prior punches.
Client timestamps and distances are ignored. Punches and attendance/audits commit
in one serializable transaction. Concurrent duplicate punches either reuse the
saved result or return a refresh/retry conflict; there is one punch of each kind
per staff/date. Checkout requires check-in. Late self punches remain arrival
records and do not alone confirm an original teacher's unavailability.

Geofence radius, maximum uncertainty and precise-location retention are school
settings. Retention 0 validates without storing coordinates. The existing minute
worker nulls expired coordinates, accuracy and distance, preserving punch time,
verification outcome and audits. No raw coordinate history is exposed by the new
staff/manager APIs. There is no continuous tracking, external geolocation service
or fingerprint hardware integration. Browser geolocation requires HTTPS outside
localhost. GPS may be inaccurate or spoofed and is not proof of physical presence.

Denied permission, unavailable location, timeout, outside radius and low accuracy
produce clear errors with a request-for-exception path. My Day accepts missed
check-in, location, correction and early-departure requests with school-local
clock times. Scoped managers review the proposed times/status and approve or
reject with a reason. Self approval is forbidden. One pending request per
staff/date is enforced by a partial unique index. Approval uses the existing
attendance/audit/lock path; it cannot bypass disabled overrides. Early departure
can be allowed, saved with a flag, or require an approved exception.

The daily roster includes total, present, late, approved leave, confirmed absent,
pending review and checked out counts, plus department/designation/status filters.
Flags are shown alongside check-out times. Missing punches remain unconfirmed;
the existing cutoff worker sends review reminders instead of inferring absence.

Policy writes require staff.attendance.policy.manage or staff.leave.policy.manage
for the corresponding fields, with school-admin access. Scope delegation remains
admin-only and can explicitly grant school-wide scope; scope alone grants no
permissions. Refresh existing sessions after migration to load new permissions.

Additional endpoints:

| Endpoint | Purpose |
| --- | --- |
| GET attendance/staff/self-policy | Own public punch policy and today's attendance |
| POST attendance/staff/check-in or check-out | Optional location payload, server timestamps |
| GET/POST attendance/staff/exceptions | Own requests; manage=true for scoped reviewers |
| POST attendance/staff/exceptions/:id/decision | Reasoned approval/rejection/cancellation |
| GET school-operations/leave-ledger | Own ledger; staffId for scoped approvers |

Migration 20261017090000_gps_attendance_leave_ledger adds punch/exception/ledger
records and balance period fields, backfills annual keys and opening ledger
transactions, and grants policy permissions to existing school-admin roles.
No production rows are dropped. Apply it with Prisma migrate deploy and regenerate
the client before starting the backend. It is applied to the local database.

### Workload-free daily cover

Coverage policy enforceWorkloadLimits controls workload gates for daily cover.
Existing schools default to true. Kidzee has it disabled at the user's request,
with COMPARTMENT matching. When disabled, daily/weekly period caps, minimum free
periods and consecutive-period limits do not exclude an otherwise available
substitute. Period-template times, unavailable weekdays/periods, attendance,
approved leave, class/compartment eligibility, substitute opt-in, staff category
and timed lesson/duty/cover overlaps remain enforced. Ranking still distributes
cover with preference for less occupied teachers. Generation proposes assignments
for review; it does not auto-approve them. The automation settings include an
admin-only switch for this policy. Weekly timetable generation settings remain
separate from this daily-cover switch.

### Direct assignment and compact actions

Kidzee enables autoAssign. Reconciliation directly saves an eligible free
substitute as APPROVED, with a system audit record and a private in-app staff
notification; staff acknowledgement in My Day remains available. Other schools
keep the existing default autoAssign=false unless an administrator enables it.
The policy endpoint now respects this explicit school setting. Normal assignment
still uses transactional candidate checks and coordinated bookings, with teaching
staff prioritized and overlap prevention enforced.

Assigned/completed rows show no approval control or staff rejection list. Only
uncovered periods show Teacher unavailable, one short summary (for example busy
or absent staff), and Take action for authorized users. Workload exceptions, when
workload limits are enabled, remain inside this manual action. Detailed lists of
all rejected staff are no longer expanded in the main timetable table. The
original recurring timetable is unchanged. Stale proposals are reassessed against
existing approved cover before new assignments are saved.

## Manual substitution intervention

The Action column lists free alternates blocked only by workload limits and their
specific exceeded rules. If no ordinary candidate is available it shows Manual
intervention required. Other staff display the reasons they cannot be assigned;
when no free alternate exists these reasons are expanded automatically.

Staff with timetable.substitution.approve plus timetable.substitution.override
(and the matching lesson scope) may select a free alternate, enter a 3-2000
character decision reason and approve a workload exception. School admins have
access. The exception may waive daily/weekly workload, consecutive-period and
minimum-free-period limits only. It cannot bypass attendance/leave, overlap,
class/compartment/subject eligibility, substitute opt-in or admin-staff exclusions.
The API rechecks all constraints inside a serializable transaction.

Approval stores source MANUAL_WORKLOAD_OVERRIDE, the decision reason, actor and
an audit entry containing the exceeded rules, before/after assignment and time.
Existing private notification/acknowledgement flows are reused. Automatic
reconciliation preserves a valid workload exception but reassesses hard conflicts
and attendance changes. Historical/ended periods cannot receive new assignments.
Migration 20261018090000_substitution_workload_override grants the new permission
to school-admin roles. Delegate it through existing RBAC and refresh the session.
No current live assignments are automatically approved by this UI change.

## Leave and balances

Leave types, a morning/afternoon boundary, working days and designated approvers
are configurable. Requests support a single date, multiple dates, morning or
afternoon half days. Opposite half-day requests may coexist; overlapping sessions
are rejected. A request spans at most 366 days and can cross leave periods.
The configurable approval workflow is one authorized
approver from the selected set, with school-admin fallback. Self approval and self
rejection are forbidden. Pending/approved leave can be cancelled with a reason.

Approval deducts days atomically, using each type's holiday/weekly-off rules and
the staff shift schedule. Pending requests do not reserve balance. Cancellation
refunds each period's deduction once. Paid policies enforce available balance
unless negative balances are allowed; unpaid leave needs no positive balance.
Unconfigured types preserve legacy uncapped approvals. Existing manual
entitlements remain manual, with no duplicate scheduled credits.

Monthly/annual policies support credit day (clamped to month end), new-joiner
proration, half days, paid/unpaid classification, approvers, negative balances,
carry-forward and maximum caps, with calendar or academic-year periods.
Academic years need explicit start/end dates. Earned credits are calculated
lazily when balances are read or leave is approved, up to today's school-local
date; there is no separate accrual job and future credits cannot be spent early.
Carry-forward comes from an existing prior-period balance, not invented
historical allocations. Balance periods retain their policy snapshot; edits
apply to newly created periods. The ledger records openings, credits,
carry-forward, adjustments, deductions and refunds with unique deduplication
keys. Legacy balances/usage are backfilled without changing their amounts.
Serializable transactions prevent concurrent approvals overspending a balance.
Decisions, entitlements and delegation changes are audited.

Approved leave contributes date/interval-specific unavailability, regardless of a
stored PRESENT attendance row. Approval/cancellation reassesses every affected
date and reports pending coverage retries. In-app notifications go to scoped
approvers and the applicant.

## Substitute workflow and effective timetable

Only published weekly lessons and supervision duties are eligible for daily cover.
An unmarked original teacher is not automatically considered absent. Confirmed
absence, approved leave, a confirmed half-day interval, arrival/departure times and
blocked availability determine affected lessons. Holidays/closures suppress lessons.

Generation creates PROPOSED assignments or UNCOVERED requests, never active cover.
Even an old autoAssign setting cannot bypass coordinator approval. Proposals do
not change the effective teacher. The approval transaction rebuilds the current
context, checks the manager's lesson scope, verifies that coverage is still needed,
and checks the replacement against subject/group eligibility, attendance, leave,
duties, regular lessons, approved substitutions and workload limits.

Eligible teachers are ranked using group responsibility, primary/backup allocation
roles, preferred classes, daily workload, consecutive lessons and weekly substitution
load. Capability is always subject-specific. Opting into substitution never grants
eligibility for unrelated subjects or compartments.

New active assignments use APPROVED. Existing SCHEDULED records remain compatible.
Notification and acknowledgement timestamps are separate from assignment status.
Approved replacements are privately notified and can acknowledge their own cover.
Ended approved lessons become COMPLETED; unresolved ended lessons use the legacy
MISSED history state. Manual cancellation remains cancelled until explicit proposal
regeneration or another reviewed assignment. Cancellation and automatic state
changes are audited, and replaced teachers are notified when cover changes.

Serializable PostgreSQL transactions prevent concurrent overlapping approvals;
conflicts return HTTP 409 and require refresh/retry. Each date/target retains the
existing unique substitution key. Approved substitutions and cancellations only
affect their date. TimetableEntry and TimetablePlan are never overwritten for a
temporary absence.

`GET /school-operations/effective-timetable` resolves the published schedule,
approved dated replacements, confirmed unavailability, calendar closures and
explicit cancelled/restored lessons. It returns effective and original teachers,
approval information and cancelled lesson reasons. My Day, Operations Overview
and the timetable's Daily Cover view use this resolver. Weekly views still show
the permanent timetable.

## API routes under /api/v1

| Routes | Behavior |
| --- | --- |
| GET attendance/staff/roster?date= | Scoped virtual daily roster |
| POST attendance/staff, attendance/staff/bulk | Audited single/bulk marking |
| POST attendance/staff/lock | Lock/reopen with reason |
| GET attendance/staff/history?staffId=&from=&to= | Up to one year; latest 1,000 audits |
| GET/POST attendance/staff/check-in | Own status / check-in |
| POST attendance/staff/check-out | Own checkout |
| GET school-operations/clock | School-local date and leave type choices |
| GET/PUT school-operations/policy, scopes | Administrator policy and delegation |
| GET school-operations/lookups | Existing configurable profile fields |
| GET/POST school-operations/leaves | Own requests; manage=true for scoped managers |
| POST school-operations/leaves/:id/decision | Approve/reject/cancel with reason/version |
| GET/PUT school-operations/balances | Own entitlements / administrator allocation |
| GET/POST school-operations/tasks | Own/scoped tasks and duty creation |
| POST school-operations/tasks/:id/status | Acknowledge/complete/cancel a duty |
| GET school-operations/effective-timetable?date=&classId=&sectionId= | Scoped daily resolution; own=true for own lessons |
| GET school-operations/my-day?date= | Own daily workspace |
| GET school-operations/overview?date= | Scoped summary, leave and duties |
| GET school-operations/reports?from=&to= | Scoped attendance totals over up to 31 days |
| POST school-operations/overrides | Cancel/restore a lesson on one date |
| GET teacher-cover?date= | Existing scoped planner with ranked candidates |
| POST teacher-cover/refresh | Explicit proposal regeneration |
| PUT teacher-cover/:id/assign | Transactionally approve the selected teacher |
| POST teacher-cover/:id/cancel | Cancel with a mandatory reason |
| POST teacher-cover/:id/acknowledge | Assigned teacher's acknowledgement |

Overview supports academicYearId, groupId, classId, sectionId, teacherId and
department filters. Leave history is capped at the latest 200 requests; notifications
at 30. No endpoint changes authenticated school identity from a request body.

## Database changes and rollout

Migrations 20261016120000 through 20261016150000 add operations policy, attendance
versions/timestamps/intervals, attendance day locks/audits, scoped delegation,
leave/balances, duties, daily overrides, substitute approval/acknowledgement metadata,
permissions, indexes, foreign keys and balance/date/interval checks. Existing tables,
records and weekly schedules are retained. The override-to-entry foreign key uses
CASCADE so existing explicitly authorized timetable deletion remains compatible.

The migrations have been applied to the local database and Prisma Client regenerated.
For other environments, deploy these migrations and regenerate the client through
the usual release process. Restart the backend and refresh the session to load
new permission codes. Configure working days, self attendance, leave approvers,
department field and entitlements before delegating managers.

The existing worker pages through schools in batches of 100 and processes at most
four schools concurrently. Coverage transactions retry serialization races and
notifications use school-scoped deduplication keys. In-app notification delivery is
the transactional database record. A delivery-adapter interface documents future
email/push/WhatsApp integration; no external messages are sent.

## Validation and manual checks

Backend tests use the repository's existing node:test convention rather than adding
a second test runner. PostgreSQL fixture tests roll back their data; the concurrency
fixture creates a uniquely named test school and removes only its own fixture.

Verified result: 235 backend tests and 14 frontend tests passed, no failures, and one unrelated opt-in academic
workflow database test skipped. Backend and production frontend builds, TypeScript,
Prisma schema validation and local migration status passed. The concurrency test
verified concurrent substitution conflicts, duplicate punches and leave-balance
spending, including idempotent approval/cancellation retries. GPS tests cover
inside/outside radius, accuracy, permission denial and server timestamps. Leave
tests cover monthly/annual credits, academic periods, carry-forward, half-day
deductions, unpaid leave, policy snapshots and refunds.

```powershell
npm.cmd run build --workspace apps/backend
$env:OPERATIONS_DB_TEST='1'
$env:COVERAGE_DB_TEST='1'
node --env-file=apps/backend/.env --test --test-concurrency=1 apps/backend/test/*.test.js
node --test apps/web/test/*.test.js
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/web/tsconfig.json
npm.cmd run build --workspace apps/web
```

Database coverage includes roster idempotency, bulk audit/corrections/locking,
cross-school denial, fail-closed manager scopes, departments, non-teacher self
check-in/out, timezone holidays, absence/proposal/approval/acknowledgement/cancellation,
administrative duty conflicts, half-day and multi-day leave, overlapping leave,
balance debit/refund, daily cancellation, recurring timetable preservation and
two genuinely concurrent conflicting approvals. The existing timetable generation
and eligibility suites remain part of regression testing. Nest application
initialization and authenticated read requests to roster, overview, policy and
coverage have also been checked. Attendance Reports includes a CSV download;
text cells are protected against spreadsheet formula interpretation.

Manual acceptance: open School Operations as an administrator, set policy/scopes,
mark selected staff, correct with a reason, lock/reopen, request/approve leave,
generate and approve a cover, acknowledge in My Day, assign/cancel a duty, and
inspect Daily Cover on the affected date and the following week. Repeat as a
scoped in-charge and an ordinary staff member to confirm restricted access.

## Remaining production validation and limits

Browser visual/mobile acceptance and a 1,000-school load test have not been run.
The interfaces use existing responsive components; offline mutation queues,
service-worker installation, external notification delivery, multi-stage leave
approvals and advanced report-builder screens are not included. Special events can
use the existing calendar plus explicit daily lesson cancellation; they do not
automatically invent replacement schedules. History limits currently have no
load-more controls. These limits should be resolved or accepted before calling
the complete deployment production-ready.
