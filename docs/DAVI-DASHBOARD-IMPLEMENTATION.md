# School Operations Command Center

## Command Center redesign revision — 30 October 2026

The operational view now follows the school day: compact controls, four primary KPIs, the action queue and timeline, then attendance/workforce health and secondary activity/communication summaries. It replaces the earlier viewport-locked presentation with normal page scrolling, so smaller screens retain every authorized panel rather than switching or hiding them.

| Area | Current behaviour | Source and access |
|---|---|---|
| Header | School identity, selected school-local date, working-day state, academic-year selector, Today, refresh and Reports | Existing command-center context and existing permission checks |
| Primary KPIs | Students, Staff, Coverage and Actions due | Existing scoped attendance, staff, coverage and pending-action summaries; unknown sources show an em dash rather than zero |
| Needs your attention | Grouped action queue with All, Urgent, Today and Overdue filters; severity, current state, owner, deadline and direct drill-down links | Existing actionGroups/actions; an item is overdue only when the source explicitly says so, and undated records remain pending |
| Timeline | Selected-day events, notices and explicitly recorded classroom activities, ordered chronologically; tomorrow preview is retained | Existing calendar sources and DailyActivity, subject to the viewer's permissions |
| Health panels | Student attendance and workforce/coverage use recorded statuses and unmarked counts; student exceptions link to the register | Existing attendance, leave and coverage services |
| Secondary summaries | Classroom execution progress and parent communications remain compact and permission-filtered | Existing engagement records; their unavailable state is shown independently |

The browser bell remains the single fixed bottom-right notification control. Reading a notification continues to affect only notification state; it does not alter task, coverage, query or attendance state. The desktop action queue is wider than the timeline, tablet uses two columns, and mobile uses one naturally scrolling column. Detail drawers remain scrollable.

No routes, business workflows, APIs or schema were replaced by this presentation revision. `DashboardOperationsService` enriches existing authorized records with action metadata and selected-day activity/timeline fields; clients retain the legacy response fields. The engagement migration described below is still required in environments where the DailyActivity and ParentQuery tables have not yet been deployed.

Revision verification: focused command-center rendering tests passed (16/16); the complete web suite passed (216 passed, 1 skipped); explicit web type checking and the production web build passed; the backend suite passed (333 passed, 33 skipped). The root lint command completed with zero configured Turbo lint tasks, so it is not evidence of a static lint run.

## Pre-implementation audit and dependency map — 30 October 2026

The existing routes `/dashboard` and `/school/[schoolSlug]/dashboard` render SchoolCommandCenter. GET `/api/v1/dashboard/command-center` uses DashboardCommandService; preserve these paths and its existing response fields.

| Widget | Reused source / dependency | Gap |
|---|---|---|
| Students and completion | StudentEnrollment, StudentAttendance, period templates, published plans, SchoolEvent calendars, command-center-metrics | Selected date; grouped pending sections; deadline semantics |
| Staff | StaffAttendanceService.roster, operations policy, GPS/punch records | Compact summary; selected date |
| Coverage | SchoolOperationsService.effective, CoverageService, TimetableSubstitution | Aggregate acknowledgedAt; reuse existing acknowledge endpoint and conflict prevention |
| Activities | AcademicTeachingSession has teaching execution; SchoolEvent and LessonPlan contain plans | No general preschool daily activity execution registry; add isolated DailyActivity |
| Parent queries | ParentSchoolMembership/StudentParent authorize family access; Notification supports dedupe | No conversation/resolution lifecycle; add isolated ParentQuery + messages |
| Actions | Existing homework submissions, lesson approvals, missing marks, leave approvals, duties | Group/dedupe; priority metadata; no duplicate task persistence |
| Events | SchoolEvent, published exams and announcements | Keep separate from executed activities |
| Tomorrow | Approved leave, effective timetable, events | Add bounded next-day aggregation |
| UI | DAVI command-center CSS/components, school branding, shared bell, academic-year provider | Six KPI families, compact layout/date controls |

New records need explicit school/enrollment/section/teacher relations, validation, transactional auditing, participant access, optimistic concurrency, bounded lists and indexes. Existing permission codes are reused; no school role is granted new permissions automatically. Read notifications do not mutate domain state. Missing/error sources remain unknown rather than zero. No AI/syllabus changes are planned.

## Implemented modules and routes

The command center still uses the existing dashboard routes. Today is the default operational view; Overview retains setup, configuration and higher-level counts. The old fields of the command-center API remain available. New optional summaries and actionGroups extend the response rather than replacing actions or changing legacy consumers.

- `DashboardOperationsService` composes the existing DashboardCommandService, effective coverage, engagement records, past incomplete duties and tomorrow preparation. GET `/api/v1/dashboard/command-center?academicYearId=<id>&date=YYYY-MM-DD` accepts an optional validated date; omitted date means today in the configured school timezone.
- `EngagementModule` is isolated from academic AI and syllabus logic. `DailyActivity` records real classroom execution; it does not infer completion from a lesson, teaching session, timetable or event.
- `ParentQuery` and immutable `ParentQueryMessage` records provide participant conversations and explicit resolution, backed by existing parent memberships, linked enrollments, staff identity, notifications and audit infrastructure.
- Teachers retain their existing dashboard and gain activity/query controls, plus a link to existing My Day for duties and substitute confirmation. Parents retain learning reports and gain queries for the selected linked child. No new navigation page was created.
- The existing notification bell is portaled into the dashboard header, retaining a single instance; other pages retain its existing placement. Verified global parents can read their own personal notifications across their active school memberships.

## Database changes and deployment

Migration: `apps/backend/prisma/migrations/202610300001_operations_engagement/migration.sql` creates **DailyActivity, ParentQuery and ParentQueryMessage**, with foreign keys and indexes for school/date/year/section, teacher/date, school/status/deadline, assigned staff/status, parent/enrollment and query message history. Optimistic version fields protect activity and query transitions. Existing tables gain no new scalar fields; Prisma inverse relations describe the new foreign keys.

All 59 migrations were applied successfully to a newly initialized, loopback-only PostgreSQL 18 test instance under `.tmp/dashboard/pgdata`, port 55439. Its permission registry was seeded before running existing database suites. **The existing school/development database was not migrated or seeded.** Before enabling these features in another environment, deploy the reviewed migration and regenerate its Prisma client:

```powershell
cd apps/backend
npx.cmd prisma migrate deploy --schema prisma/schema.prisma
npm.cmd run prisma:generate
```

The application initially held the Windows Prisma engine DLL open. For local verification the client was generated to a temporary output and generated source/types were copied while preserving the existing engine binary; no running user application was terminated. A normal stopped-service deployment can use the commands above.

## Added API capabilities

All paths below are relative to `/api/v1/engagement`. JWT is required; service-level access checks run on every request and inside transactional mutations.

| Method / path | Behavior and access |
|---|---|
| GET `/context` | School-local date/timezone and current year for authorized academic/communication staff |
| GET `/activities?date=&academicYearId=` | Up to 100 school activities; non-admin users see their own assigned activities |
| GET `/activity-options?academicYearId=` | Up to 500 active teaching assignments available for activity creation |
| POST `/activities` | Validated section/year/teacher relation, assigned actor or school admin, audit record |
| PATCH `/activities/:id` | Explicit execution transition with version check and atomic audit |
| GET `/queries?enrollmentId=&page=` | Parent sees only verified linked-child queries they authored; staff sees assigned queries; school admin sees school queries; pages of 100 |
| POST `/queries` | Verified active family relationship; school derived from enrollment; assign eligible class teacher or leave NEW for school admin triage |
| GET `/queries/:id?before=` | Authorized conversation with latest 100 messages; cursor pagination loads earlier history |
| PATCH `/queries/:id` | Reply, assigned staff transition, explicit resolution/escalation, or admin reassignment; version-protected transaction |
| GET `/query-assignees` | School admins select up to 500 active school staff with active communication access |
| GET/PUT `/query-response-policy` | School admin reads/sets response hours and optional student attendance marking deadline |
| GET `/alerts` | Up to 100 personal in-app notifications; parents require active verified school memberships |
| PATCH `/alerts/:id/read` | Exact recipient/membership check; changes notification readAt only |

The existing `/teacher-cover/:id/acknowledge` endpoint remains the substitute confirmation workflow. It now notifies the approving coordinator (or school administrators for automatic assignments), once per assignment version/recipient. Existing assignment, conflict checks, one-day scope, cancellation, duty and leave notifications are preserved.

## Widget sources and business rules

| Widget | Real source and semantics |
|---|---|
| Students | Active enrollments in selected year/scope; expected attendance excludes not-yet-admitted records, unassigned sections, holidays, weekly off, unknown calendars and dates outside the year |
| Student attendance | Existing records and calendar/template policy. Present/absent/late are recorded statuses; unmarked is never inferred absence. Overall recording completion and marked/working sections are shown separately from attendance percentage |
| Staff | Existing roster with recorded punches, leave overlay and working-day policy. Missing check-in remains NOT_MARKED |
| Substitutions | Actual effective dated timetable targets. Required = covered + genuinely uncovered affected periods, not absent staff. Confirmed uses acknowledgedAt; urgency requires an uncovered period that has not ended |
| Activities | Explicit DailyActivity states PLANNED, IN_PROGRESS, COMPLETED, CANCELLED. Completion requires a start transition. Planned records with a configured end time before the selected school clock are delayed |
| Parent queries | Authorized current-state query queue; NEW, assignment, awaiting staff, awaiting parent, resolved and escalated are distinct. KPI summaries contain counts, not family messages |
| Pending actions | Existing attendance, scoped leave approvals, review/mark queues, duties plus queries/coverage/activities. Source keys deduplicate records; section attendance is one group with section drilldowns |
| Priority | Uncovered classroom periods first, then overdue/escalated concerns and urgent duties, then attendance/academic work and routine follow-up. A configured student marking deadline is required before attendance becomes overdue |
| Events | Existing school events, published exams and announcements stay separate from classroom execution. Staff-only holidays no longer cancel the student attendance calendar |
| Tomorrow | Approved scoped leave, effective uncovered teaching periods, planned classroom activity count, upcoming calendar preview and outstanding setup |

Pending totals count distinct underlying work units (for example, unmarked student records, affected teaching periods, individual duties and queries), not the number of cards. Different work units are not interchangeable performance scores. The action list is a prioritized summary and bounded drilldown, not a second task database.

Query lifecycle rules:

- Parent identity, active enrollment, academic visibility link and VERIFIED school membership are checked on creation and every subsequent read/reply.
- Automatic assignment uses the active class teacher only if that teacher has communication access. Otherwise a school administrator triages the NEW query.
- Parents can reply; they cannot assign, escalate or resolve. Assigned staff can respond, request clarification, escalate or explicitly resolve. Only school administrators reassign.
- A normal staff reply leaves the lifecycle state unchanged. A parent answer to AWAITING_PARENT returns it to IN_PROGRESS and renews the configured response deadline. Awaiting-parent records do not count as overdue staff responses.
- Resolved conversations remain readable and cannot be reopened by a reply. A new concern uses a new query.
- Every change writes its audit event and deduplicated recipient notification in the same serializable transaction. Messages are immutable and paginated. Escalation also notifies active school administrators.
- Reading a notification never completes a duty, confirms cover, completes an activity or resolves a query.

## Permissions and isolation

Existing permission codes are reused: DASHBOARD_VIEW, STUDENT_VIEW, ATTENDANCE_VIEW/MARK, staff attendance/leave and substitution permissions, operations.tasks.manage, CLASS_VIEW, LESSON_PLAN_VIEW/MANAGE, COMMUNICATION_VIEW/MANAGE and existing report permissions. No role grants or permission names were introduced.

OperationsAccessService enforces active school actors and staff/section scope. New activity access is limited to school administrators or the responsible teacher; creating activities also verifies active teaching assignment, class, section and year ownership. Query access is deliberately narrower than a generic school-wide communication permission: staff must be assigned participants; school administrators manage the school queue. A Principal/custom role gets only its configured grants and assignments, without a hardcoded role-name bypass. Parent data is scoped by the linked enrollment and verified membership, not by a client-supplied school ID.

## Refresh, bounds and failure states

The API performs no persistent aggregate caching. Refresh and focus reload the command center; successful query/activity changes dispatch `davi:operations-updated`, refreshing both dashboard and bell. The existing bell also polls every minute. Existing attendance/leave/substitution modules remain authoritative and can be refreshed when returning to the dashboard.

New aggregate reads reject over-limit datasets rather than counting truncation as a complete result: activities 500, query queue 5,000 and overdue duties 500. UI query pages have 100 records (up to 101 pages), conversations use cursor pages of 100 messages, activity lists show up to 100 and assignment options up to 500. Existing source preview bounds remain documented in API notes. Optional errors do not zero unrelated metrics and are surfaced in source availability. Records from another tenant or an obsolete request context are not reused.

## Verification results

- Prisma schema validation: passed.
- Migration deployment: all 59 migrations passed against the isolated PostgreSQL instance.
- Backend build: passed, including migration from deprecated `moduleResolution: node` to matching `module: Node16` / `moduleResolution: Node16`. Installed compiler is TypeScript 5.9.3; unsupported `ignoreDeprecations: 6.0` was not added. CommonJS package output remains supported.
- Backend suite with OPERATIONS_DB_TEST, COVERAGE_DB_TEST, ASSESSMENT_DB_TEST and DAVI_ENGAGEMENT_TEST_DATABASE_URL enabled: **338 passed, 25 skipped, 0 failed** (363 total). Suites ran serially to isolate shared permission fixtures; individual concurrency tests still exercise concurrent transactions.
- The new PostgreSQL test executes activity ownership/transitions, query family and tenant isolation, HTTP JWT/participant access, module wiring, transactional audit, deduplicated notifications, explicit resolution, real competing query writes, selected-date aggregation, deadline handling, holidays and unread-state independence.
- Frontend suite: **215 passed, 1 skipped, 0 failed** (216 total), including six KPI families, role filtering, query notification destination allowlisting, responsive CSS breakpoints and existing route/shell checks.
- Final backend build, web production build and explicit web type check: passed after all changes. `git diff --check` also passed.
- Root lint command ran; Turbo reported **zero tasks** because the repository has no configured lint scripts. This is not a completed static lint analysis.
- Earlier broad parallel database run exposed transaction conflicts between suites; serial rerun eliminated those. Assessment initially required the permission seed on the blank database; the seeded rerun passed. These failed attempts are retained in logs rather than reported as passing.

Logs are under `outputs/dashboard-*.log`; `outputs/typescript-config-build.log` records the compiler configuration verification.

## Known limits and release requirements

- Browser/device interaction and a production deployment were not exercised. Responsive layout is covered by rendered components/CSS checks; this does not certify real device behavior.
- The remaining skipped checks include live Kidzee command-center/timetable, OCR, and other separately gated integration suites. No external AI call, email, push or WhatsApp delivery was performed or added.
- The migration must be deployed to the intended application database before the new persistent features work there. The dashboard reports unavailable engagement sources until that is done.
- Date selection applies to attendance, coverage, activity execution and calendar records. Query/duty statuses are current persisted lifecycle states; historical status-at-time reconstruction is not claimed. Resolution counts use the selected school-local day.
- Existing homework/approval/missing-mark previews are bounded; exceeding those preview windows does not constitute a full-school work inventory. New aggregate bounds surface errors rather than fabricated totals.
- Activity photos were optional and are not introduced; existing approved media infrastructure remains unchanged.
- Existing security findings in `AUDIT-2026-10-30.md`, including public privileged registration and fallback JWT configuration, are outside this dashboard refactor and remain release blockers. Passing tests is not production security certification.
