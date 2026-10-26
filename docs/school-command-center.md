# School Administration Command Center

## UI organization

`/dashboard` retains its original platform/teacher/student dispatch. School administrators and authorized school staff receive the compact School Command Center.

- Header: real school name/logo (initials fallback), selected year, school-local date/timezone, Refresh and permission-gated Reports.
- Today: primary metrics, real Action Center, class attendance completion and staff/leave/substitution/timetable summaries.
- Overview: original Classes/Sections/Subjects/Staff counts, profile status, configuration shortcuts and the original seven-step setup checklist.
- Fully configured schools default to Today. Known outstanding setup defaults to Overview and shows a compact direct-link banner. Unknown permission-restricted checks do not falsely report missing configuration.
- A collapsible 300px desktop rail holds upcoming activities and configuration navigation. Mobile uses a native-dialog drawer. It does not repeat Action Center records.
- Only this dashboard expands to the available content width; existing teacher/student/platform presentation is preserved.

## Data/API changes

Added read-only `GET /dashboard/command-center?academicYearId=...`, guarded by JWT, `DASHBOARD_VIEW`, active school membership and server-side authorization. The original `/dashboard/me` and `/dashboard/summary` endpoints remain available.

The endpoint reuses:

- OperationsAccessService for active role permissions and class/staff scope.
- CoverageService school timezone, localClock and zonedInstant.
- StaffAttendanceService roster and leave policy, preserving existing staff calendar, shift, leave and automatic/unconfirmed check-in semantics.
- SchoolOperationsService effective timetable and administrative duties.
- Existing attendance rate rounding and configured period-template working days.

AttendanceModule exports its existing staff/operations services for DashboardModule to reuse. No database schema, scheduling engine, attendance write path or stored data model changed.

## Accuracy boundaries

Academic records are school- and selected-year scoped. Student cohorts contain active enrollments admitted by the school-local date; records outside the cohort are ignored. Requests for another school's academic year are rejected.

Student working days follow active section/class period-template assignments, then a published template, then explicitly stored school working days. Sunday is never assumed off. Holidays/closures and academic-year boundaries suppress expected attendance. Missing calendar configuration is explicit and does not produce pending-marking actions.

Attendance credit is PRESENT + LATE + ON_DUTY + half of HALF_DAY, divided by recorded non-excused attendance. Missing/NOT_MARKED records are not absence, are excluded from the percentage and remain visible in completion coverage. No recorded denominator means unavailable, while a genuine recorded-zero rate remains 0%.

Staff/leave records describe today's school-local date and are not academic-year entities; the UI labels this distinction. Staff categories remain separate, with teacher counts included in the staff total.

Action Center includes only authorized real records: expected student marking, section allocation, eligible leave approvals (excluding self-approval), active recorded substitution requests matching an uncovered published lesson, current administrative duties, stored timetable conflict flags, submitted homework reviews, explicitly submitted lesson approvals and explicit missing-mark records. Draft lesson plans and hypothetical absent mark rows are not invented as approval queues. The module pages continue to enforce permissions and validations when actions are taken.

Timetable issue counts are stored flags, not a claim that all schedules were fully validated. Dashboard loading never regenerates or republishes schedules.

Calendar activities cover today/the next 14 days; recent published announcements cover the previous 14 days. Activity counts are labeled as items shown, not school-wide totals. Timetable/cover engine candidate-ranking is not run for dashboard display.

## Loading and query behavior

One frontend dashboard request loads optional sources concurrently. Failures remain isolated and are reported in data-availability notes; unavailable values do not become zero. Refresh retains the last successful data if the new request fails and labels that state.

Request identity includes user/token/permissions/year. Old data is hidden on identity/year changes, and late requests cannot replace the current context. Users without academic-year browsing permission use the server's current-year fallback. A minute clock check refreshes only at school-local date rollover; there is no continuous heavy operational polling.

Student roster/attendance reads are bounded at 20,000 records, and oversized sources become unavailable rather than silently truncated. Homework/lesson/explicit-missing-mark action previews are limited to 20 records each and documented in the UI. Class attendance initially shows 10 sections, with an explicit Show all control. Action groups initially show eight. These are preview boundaries, not fabricated global totals.

## Verification

- Backend command-center tests cover new/incomplete and configured setup, full/partial/missing attendance, recorded zeros, credit/excused handling, holidays, configured Sundays, missing calendars, year boundaries, optional-source failure, approver restrictions and scoped roles.
- Frontend tests cover Today/Overview defaults, compact setup behavior, preserved configuration steps, attendance/year/tab links, partial/denied/error states, activities separation and legacy teacher/student/platform dispatch.
- Existing attendance, coverage and operational regression suites pass.
- Real PostgreSQL/module integration verifies the current school's nine sections, an isolated newly created school, module dependency wiring and foreign-year rejection. Existing records remain unchanged; the synthetic test school is verified by its test slug and removed afterward.
- Next.js production build, backend build and strict UTF-8 validation pass.

Manual browser visual/keyboard verification is still required. This session had no connected browsers and the native Computer Use pipe was unavailable. Check desktop/tablet/mobile layouts, setup links, permission combinations, the activity drawer's focus/Escape behavior and a school-local date rollover before release.

Final automated results: 169 frontend tests passed; 60 backend dashboard/attendance/coverage/operations checks passed, including the live database/module integration. Production frontend and backend builds passed. The live integration uses an isolated synthetic new school and removes it after validation; current-school records are read-only.
