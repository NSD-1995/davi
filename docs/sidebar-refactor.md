# Montessori-first school sidebar

**Latest revision:** [Navigation and daily automation](navigation-and-jobs.md) supersedes the original organization below: separate Admissions/Students, direct Dashboard/Class Workspace/Daily Operations, School Configuration naming, dashboard year selection, no sidebar search, unique icons and Scheduled Jobs.

Implemented 30 October 2026. This is a navigation/presentation change only: no backend, API, database, role grants or business workflow changes.

## Structure and behavior

The eight requested groups are defined in `apps/web/lib/sidebar-navigation.ts` and rendered by `components/sidebar-navigation.tsx`. Breadcrumbs use the same destination registry. The old academic/report sidebar renderers and academic-only configuration were retired; their behavior is covered by the new sidebar tests.

Only the current route's group opens by default. Users can toggle other groups. Route or report-query changes reset manual expansion and reveal the current group. Search reveals matching authorized destinations, including matches on group names and legacy aliases. Search clears on selection. Empty groups are hidden.

Desktop compact mode shows one accessible icon link per permitted destination, with labels available as tooltips/accessible names. Returning to expanded mode restores the tree. Compact preference does not force every group open in the mobile drawer. The existing drawer, focus trap, Escape dismissal, overlay and focus restoration remain in the shell. School logo, short name (full name as fallback), account, logout and authorized academic-year selector are retained/shown. Parent-only and platform accounts retain their separate menus.

Existing `school-navigation` Link/router helpers still add `/school/<schoolSlug>` to canonical paths. No page was added, removed, renamed or redirected by this change. All old URLs and query parameters remain available under the existing routing behavior.

## Complete menu movement and route mapping

All route mappings are **old URL → same URL**. The table uses canonical paths; school-prefixed URLs continue to wrap these paths.

| Previous location / label | New group / label | Unchanged route |
|---|---|---|
| Dashboard | Dashboard / Dashboard | `/dashboard` |
| School / School Profile | School Setup / School Profile & Branding | `/school/profile` |
| Academic Setup / Academic Years | School Setup / Academic Years | `/academics/academic-years` |
| Academic Setup / Classes & Sections | School Setup / Classes & Sections | `/academics/classes` |
| Academic Setup / Academic Groups | School Setup / Academic Groups | `/academics/groups` |
| Academic Setup / Subjects | School Setup / Subjects | `/academics/subjects` |
| Academic Setup / Teaching Staff | School Setup / Teaching Assignments | `/people/teachers` |
| Academic Setup / Assessment Setup | School Setup / Assessment Settings | `/academics/assessments` |
| School Operations / Attendance Settings | School Setup / Attendance Settings | `/operations/attendance-settings` |
| Admissions / Admissions Overview | Admissions & Students / Admissions Overview | `/admissions/dashboard` |
| Admissions / Enquiries, Follow-ups | Admissions & Students / Enquiries & Follow-ups | `/admissions/enquiries`; `/admissions/follow-ups` stays a contextual tab/bookmark |
| Admissions / Admissions | Admissions & Students / Applications & Admissions | `/admissions/applications` |
| Students / Student Directory | Admissions & Students / Student Directory | `/people/students` |
| Students / Student Import | Admissions & Students / Student Imports | `/students/import-migration` |
| Students and Academic Setup / Section Capacity & Allocation | Admissions & Students / Section Allocation (one entry) | `/students/allocation`; `/academics/section-capacity` remains a bookmark alias |
| Students / Transfers & Swaps | Admissions & Students / Transfers & Swaps | `/students/transfers` |
| Students / Promotions | Admissions & Students / Promotions | `/students/promotions` |
| People / Parents | Admissions & Students / Parent Directory | `/people/parents` |
| Admissions / Admission Settings | Admissions & Students / Admission Settings | `/admissions/settings` |
| Academics / Class Workspace | Academics / Class Workspace | `/academics/workspace` |
| Academics / Timetables | Academics / Timetables | `/academics/timetables` |
| Timetables / Timetable Settings | Academics / Timetable Settings | `/academics/timetable-settings` |
| Timetables / Period Templates | Academics / Period Templates | `/academics/period-templates` |
| Academic Planning / Academic Planner | Academics / Academic Planner | `/academics/academic-planner` |
| Academic Planning / Syllabus & AI Plans | Academics / Syllabus & AI Plans | `/academics/ai-lesson-plans` |
| School Operations / Daily Overview | Staff & Operations / Daily Overview | `/operations` |
| Access Management / Staff | Staff & Operations / Staff Directory | `/people/staff` |
| School Operations / Staff Attendance | Staff & Operations / Staff Attendance | `/operations/attendance` |
| School Operations / Leave Management | Staff & Operations / Leave Management | `/operations/leave` |
| School Operations / Leave Policies | Staff & Operations / Leave Policies | `/operations/leave-policies` |
| School Operations / Daily Duties | Staff & Operations / Daily Duties | `/operations/duties` |
| School Operations / Substitution Planner | Staff & Operations / Substitution Planner | `/people/teacher-attendance` |
| School Operations / Attendance Reports | Staff & Operations / Attendance Reports | `/operations/reports` |
| Academic Setup / Announcements | Communication / Announcements | `/academics/announcements` |
| Academic Setup / Holidays & Important Events | Communication / Holidays & Events | `/academics/holidays-events` |
| Reports & Analytics / Overview | Reports & Analytics / School Overview | `/reports/analytics?view=overview` |
| Reports & Analytics / Class & Section Analytics | Same | `/reports/analytics?view=classes` |
| Reports & Analytics / Academic Performance | Same | `/reports/analytics?view=academic` |
| Reports & Analytics / Engagement Analytics | Same | `/reports/analytics?view=engagement` (permitted attendance/homework subview selected) |
| Reports & Analytics / Student Attention Center | Same | `/reports/analytics?view=attention` |
| Reports & Analytics / School Operations | Same | `/reports/analytics?view=operations` (first permitted operational subview selected) |
| Access Management / Roles & Permissions | Administration / Roles & Permissions | `/access/roles` |

Changed landing-page headings now match the sidebar, including school profile, teachers, assessment settings, timetable settings, imports, allocation, admissions, directories and operational pages. Detail pages retain record-specific headings.

## Legacy and contextual destinations

- `/academics/section-capacity` still renders the same EnrollmentPlanner as `/students/allocation`; it highlights the single Section Allocation entry.
- `/students/unassigned` remains available through the Class Workspace list's existing link and a contextual link in Student Directory, including for read-only users without allocation or class permissions. It highlights Section Allocation when the user has allocation access. It is no longer a separate sidebar leaf.
- `/admissions/follow-ups` remains a real view. Enquiries and Follow-ups now have contextual links in their shared workspace so consolidating the sidebar does not hide the follow-up queue.
- `/admissions/decisions` and `/admissions/joining` retain their existing redirect to applications; no duplicate sidebar leaves.
- `/students/upload` retains its existing redirect to the import workspace.
- `/school/settings` retains its legacy settings component and highlights School Profile & Branding. School preferences are also exposed in the profile workspace.
- `/operations/settings` and `/my-day` remain existing contextual operation routes. They were not promoted into additional sidebar leaves because the requested menu does not include them. The existing School Operations contextual navigation remains unchanged.
- Teacher, parent, student and section detail URLs highlight their parent destination. Old report leaves (`exams`, `subjects`, `attendance`, `homework`, `students`, `teachers`, `admissions`, `syllabus`) map to the appropriate six report destinations through existing reportLocation logic. Export/insight utilities retain their existing report behavior.

## RBAC verification and inaccessible modules

Navigation checks existing permission strings; it never grants access based on a displayed role name. Backend guards, school scope checks and frontend layout authorization are unchanged. Principal is a custom permission profile, with no universal Principal grant set in the inspected seeds; the tests use a representative academic/staff/report Principal profile, not an assertion about a deployed account.

| Profile exercised | Result |
|---|---|
| School Admin (all granted permissions) | All eight groups and 42 unique leaf destinations |
| Principal example: class/staff/report/marks/attendance/communication/configuration permissions | Academic/staff/report destinations appear; no automatic roles or admission settings access |
| Actual default Montessori Teacher permission codes from seed script | Classroom, timetable, syllabus/planning, directory and communication destinations; administrative controls hidden |
| Admissions clerk: ADMISSIONS_VIEW + ADMISSIONS_MANAGE + STUDENT_VIEW | Enquiries/applications and student directory; no automatic allocation/settings/role access |
| No module permissions | Dashboard only, matching existing dashboard navigation behavior |
| Parent-only / platform | Child learning / Schools menus remain separate |

Known access limitations exposed during inspection:

- Student Imports requires `students.import.view` as well as the existing student-directory prerequisite. The old sidebar also showed it to ADMISSIONS_MANAGE-only users, but the unchanged layout blocks that route without `students.import.view`. The new menu hides that dead-end rather than changing authorization. Account administrators must grant the existing permission when appropriate.
- Section Allocation retains ENROLLMENT_ALLOCATE + STUDENT_VIEW. Read-only unassigned roster access remains through Class Workspace and Student Directory; readers do not get a new allocation grant.
- Admission Settings retains ADMISSIONS_SETTINGS_MANAGE + ADMISSIONS_VIEW. Merely having a settings permission does not bypass the admissions prerequisite.
- Substitution Planner preserves its alternative: `timetable.substitution.view` OR (`ATTENDANCE_VIEW` AND `STAFF_VIEW`). No new permission code is introduced.
- Reports retain REPORT_VIEW plus their existing leaf-specific permissions. School-wide operational report scope can still be denied by backend capabilities even where a user has a view permission; sidebar visibility does not replace record/scope authorization.
- Fees & Collections remains unavailable/unimplemented and has no sidebar link. No billing, mobile-only or other unimplemented destination was added.
- Staff Directory and Teaching Assignments have distinct existing implementations and both stay reachable; they are not duplicate links to one page.

These are source/permission-profile checks, not live logins to production School Admin/Principal/Teacher accounts. No school database was accessed to infer actual assigned permissions.

## Validation

- Full web test suite: **212 passed, 1 skipped, 0 failed**. The skipped test requires a live timetable environment. New coverage includes eight-group uniqueness, real route existence, seeded Montessori Teacher permissions, Principal/admin/clerk profiles, prerequisites, substitution alternatives, alias/deep-route matching, report query matching, search filtering, active expansion, compact/mobile rendering, read-only unassigned-roster discoverability and shared breadcrumbs.
- TypeScript: `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false` passed.
- Production web build: passed, including production route generation and type checking.
- Lint: `npm.cmd run lint` exits successfully but Turbo reports **zero tasks** because no workspace lint scripts are configured. This is not a completed static lint check. No unrelated lint toolchain was installed.
- `git diff --check`: passed (Git emits Windows line-ending conversion notices).
- Browser/device interaction was not exercised; responsive structure and states were verified through component rendering tests and existing shell/routing tests.

Logs: `outputs/sidebar-tests.log`, `outputs/sidebar-typecheck.log`, `outputs/sidebar-build.log`, `outputs/sidebar-lint.log`.
