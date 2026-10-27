# DAVI Phase 1: UI inventory and design foundation

26 October 2026. Source audit and additive token implementation only. Initial git status was clean. No AGENTS.md files were found. No browser acceptance or security certification is claimed. Later phases have not started.

## Inspection and conventions

Inspected README, architecture, current product report, analytics UI documentation, package scripts, root/admin layouts, auth context, shared UI, academic/report navigation, web API contracts and report controller/calculations. Every page file was read for imports, gates, API calls and presentation evidence; the machine-readable companion records those findings. This is a static inventory; delegated components and runtime states need workflow acceptance during their phases.

Actual web API contracts live in apps/web/lib/api.ts; packages/api-client is a health stub. Nest services/guards remain authoritative for tenant, scope and publication checks. Existing CSS is layered across globals, academics, dashboard, command-center, reports and timetable-workspace. Tailwind uses tw- utilities without preflight. Tests use node:test. Web scripts provide build/dev/start; no lint or test script exists.

## Screen / route / capability inventory

School staff audiences are capability-based, including administrators, teachers, coordinators and non-teaching staff. Gate below is the admin layout prefix check, not a complete backend authorization statement. Parent routes require linked-child membership; platform admins are restricted to dashboard by AdminLayout. Public/auth pages retain their existing redirects.

| Existing route | Layout gate / audience | Workflow implementation | Static presentation evidence |
|---|---|---|---|
| `/academics/academic-planner` | LESSON_PLAN_VIEW | ../../../../components/ui | 25 inline styles; 1 tables; 0 forms |
| `/academics/academic-years` | ACADEMIC_YEAR_VIEW | ../../../../components/ui | 0 inline styles; 1 tables; 1 forms |
| `/academics/ai-lesson-plans` | LESSON_PLAN_VIEW | ../../../../components/ui | 6 inline styles; 0 tables; 2 forms |
| `/academics/announcements` | COMMUNICATION_VIEW | ../../../../components/ui | 1 inline styles; 1 tables; 1 forms |
| `/academics/assessments` | Page/component and API checks | ../../../../components/assessment-workspace, ../../../../components/assessment-assistance, ../../../../components/ui | 0 inline styles; 0 tables; 0 forms |
| `/academics/classes` | CLASS_VIEW | ../../../../components/classes-table, ../../../../components/ui | 0 inline styles; 0 tables; 3 forms |
| `/academics/groups` | TIMETABLE_VIEW | ../../../../components/ui, ../../../../components/group-responsibility-table, ../../../../components/timetable-result | 0 inline styles; 1 tables; 0 forms |
| `/academics/holidays-events` | Page/component and API checks | ../../../../components/ui, ../../../../components/event-import | 0 inline styles; 1 tables; 2 forms |
| `/academics/period-templates` | PERIOD_TEMPLATE_VIEW | Inline page / redirect; see source | 0 inline styles; 2 tables; 1 forms |
| `/academics/section-capacity` | Page/component and API checks | ../../../../components/enrollment-planner | 0 inline styles; 0 tables; 0 forms |
| `/academics/subjects` | SUBJECT_VIEW | ../../../../components/academic-group-picker, ../../../../components/ui | 0 inline styles; 0 tables; 1 forms |
| `/academics/timetable-settings` | TIMETABLE_VIEW | ../../../../components/ui | 0 inline styles; 1 tables; 0 forms |
| `/academics/timetables` | TIMETABLE_VIEW | ../../../../components/ui, ../../../../components/timetable-planner, ../../../../components/timetable-navigator, ../../../../components/timetable-drawer, ../../../../components/timetable-result | 0 inline styles; 0 tables; 0 forms |
| `/academics/workspace` | CLASS_VIEW | ../../../../components/workspace-loading, ../../../../components/workspace-class-list, ../../../../components/ui | 0 inline styles; 0 tables; 0 forms |
| `/academics/workspace/[classId]/sections/[sectionId]` | CLASS_VIEW | ../../../../../../../components/analytics-workspace, ../../../../../../../components/homework-analysis, ../../../../../../../components/class-assessment-assistance, ../../../../../../../components/assessment-workspace, ../../../../../../../components/section-roll-numbers, ../../../../../../../components/class-daily-dashboard, ../../../../../../../components/workspace-loading, ../../../../../../../components/workspace-tabs, ../../../../../../../components/class-teacher-editor | 0 inline styles; 1 tables; 1 forms |
| `/access/roles` | ROLE_VIEW | Inline page / redirect; see source | 0 inline styles; 1 tables; 1 forms |
| `/admissions` | ADMISSIONS_VIEW | Inline page / redirect; see source | 0 inline styles; 0 tables; 0 forms |
| `/admissions/[view]` | ADMISSIONS_VIEW | ../../../../components/admissions-workspace | 0 inline styles; 0 tables; 0 forms |
| `/dashboard` | Page/component and API checks | ../../../components/ui, ../../../components/school-command-center, ../../../components/platform-dashboard | 0 inline styles; 1 tables; 0 forms |
| `/my-day` | Page/component and API checks | ../../../components/school-operations | 0 inline styles; 0 tables; 0 forms |
| `/operations/attendance` | Page/component and API checks | ../../../../components/school-operations | 0 inline styles; 0 tables; 0 forms |
| `/operations/attendance-settings` | Page/component and API checks | ../../../../components/attendance-policy-editor | 0 inline styles; 0 tables; 0 forms |
| `/operations/duties` | Page/component and API checks | ../../../../components/school-operations | 0 inline styles; 0 tables; 0 forms |
| `/operations/leave` | Page/component and API checks | ../../../../components/school-operations | 0 inline styles; 0 tables; 0 forms |
| `/operations/leave-policies` | Page/component and API checks | ../../../../components/attendance-policy-editor | 0 inline styles; 0 tables; 0 forms |
| `/operations` | Page/component and API checks | ../../../components/school-operations | 0 inline styles; 0 tables; 0 forms |
| `/operations/reports` | Page/component and API checks | ../../../../components/school-operations | 0 inline styles; 0 tables; 0 forms |
| `/operations/settings` | Page/component and API checks | ../../../../components/school-operations | 0 inline styles; 0 tables; 0 forms |
| `/people/parents` | PARENT_VIEW | ../../../../components/ui | 0 inline styles; 1 tables; 2 forms |
| `/people/parents/[parentId]` | PARENT_VIEW | ../../../../../components/ui | 0 inline styles; 0 tables; 0 forms |
| `/people/staff` | STAFF_VIEW | ../../../../components/staff-category-picker | 0 inline styles; 1 tables; 1 forms |
| `/people/students` | STUDENT_VIEW | ../../../../components/ui | 0 inline styles; 1 tables; 1 forms |
| `/people/students/[studentId]` | STUDENT_VIEW | ../../../../../components/ui | 0 inline styles; 0 tables; 0 forms |
| `/people/teacher-attendance` | Page/component and API checks | ../../../../components/substitution-action, ../../../../components/ui | 5 inline styles; 2 tables; 0 forms |
| `/people/teachers` | STAFF_VIEW | ../../../../components/teacher-class-eligibility, ../../../../components/teacher-capabilities, ../../../../components/teacher-subject-assignments, ../../../../components/ui | 0 inline styles; 1 tables; 1 forms |
| `/people/teachers/[teacherId]` | STAFF_VIEW | ../../../../../components/teacher-class-eligibility, ../../../../../components/teacher-capabilities, ../../../../../components/teacher-subject-assignments, ../../../../../components/ui | 0 inline styles; 2 tables; 0 forms |
| `/reports/analytics` | REPORT_VIEW | ../../../../components/analytics-workspace, ../../../../components/workspace-loading | 0 inline styles; 0 tables; 0 forms |
| `/school/profile` | SCHOOL_PROFILE_VIEW | ../../../../components/ui | 0 inline styles; 0 tables; 1 forms |
| `/school/settings` | SCHOOL_PROFILE_VIEW | ../../../../components/ui | 0 inline styles; 0 tables; 1 forms |
| `/school/[schoolSlug]/dashboard` | Page/component and API checks | ../../../../../components/ui | 0 inline styles; 0 tables; 0 forms |
| `/students/allocation` | ENROLLMENT_ALLOCATE | ../../../../components/enrollment-planner | 0 inline styles; 0 tables; 0 forms |
| `/students/import-migration` | students.import.view | ../../../../components/student-import-workspace | 0 inline styles; 0 tables; 0 forms |
| `/students/promotions` | ENROLLMENT_PROMOTE | ../../../../components/enrollment-planner | 0 inline styles; 0 tables; 0 forms |
| `/students/transfers` | ENROLLMENT_MOVE | ../../../../components/enrollment-planner | 0 inline styles; 0 tables; 0 forms |
| `/students/unassigned` | STUDENT_VIEW | ../../../../components/enrollment-planner | 0 inline styles; 0 tables; 0 forms |
| `/students/upload` | ADMISSIONS_MANAGE | Inline page / redirect; see source | 0 inline styles; 0 tables; 0 forms |
| `/change-password` | Public/auth entry | Inline page / redirect; see source | 0 inline styles; 0 tables; 1 forms |
| `/forbidden` | Public/auth entry | Inline page / redirect; see source | 0 inline styles; 0 tables; 0 forms |
| `/login` | Public/auth entry | Inline page / redirect; see source | 0 inline styles; 0 tables; 1 forms |
| `/` | Public/auth entry | Inline page / redirect; see source | 0 inline styles; 0 tables; 0 forms |
| `/parent/learning` | Parent membership / published access | ../../../components/parent-assessment-reports | 3 inline styles; 0 tables; 0 forms |
| `/school/[schoolSlug]/login` | Public/auth entry | Inline page / redirect; see source | 0 inline styles; 0 tables; 0 forms |

### Aliases, subviews and deep links

- Preserve school-specific login and /school/[schoolSlug]/dashboard alongside /dashboard. Platform schools administration remains separate.
- /admissions and /admissions/[view] retain overview, enquiries, applications, follow-ups, decisions, joining and settings. Admission payments stay in application detail; no standalone tuition or payment route is proposed.
- /students/upload redirects to /students/import-migration; retain that legacy alias. Direct intake and migration remain distinct workflow semantics.
- Preserve /operations/settings, attendance-settings, leave-policies and reports. Cover stays at /people/teacher-attendance. /my-day remains self service.
- Preserve /academics/workspace/[classId]/sections/[sectionId] and current tabs: Overview, Students, Subjects & Teachers, Attendance, Timetable, Homework, Lesson Plans, Exams & Marks, AI Drafting, Events & Calendar, Communication and Analytics. Their capabilities remain permission-dependent.
- /reports/analytics retains view/subview/filter parameters. Primary pages: overview, classes, academic (exams/subjects), engagement (attendance/homework), attention, operations (teachers/admissions/syllabus). Keep legacy students, insights, exports and leaf-view resolution through analytics-navigation.ts. Fees remains unavailable.

## Problems ranked by impact

| Priority | Evidence | Response / phase |
|---|---|---|
| P0 correctness blocker | analytics.service.ts:78 individual denominator excludes excused but includes missing. :95 grouped denominator excludes both. analytics-metrics.ts:20 summary also excludes missing. Eight present, one absent, one missing yields 80% individual vs 88.9% grouped. | Separate domain fix with agreed policy and regressions for missing/excused/half days, zero records and historical moves. Block trusted cross-view attendance comparisons; no formula change in this phase. |
| P1 accessibility | ui.tsx Modal has aria-modal but lacks title association, initial/return focus, focus containment and Escape handling. | Extend existing Modal/ConfirmDialog in Phase 2; verify nested and busy dialog behavior. |
| P1 navigation | app-shell.tsx lists /people/teacher-attendance twice under different gates; teachers live in Academic Setup; current shell exceeds seven logical areas. | Regroup in Phase 2, preserve compound gates and legacy links. |
| P1 responsive | Default table cells use nowrap; assessment sheet hides scrollbars; topbar holds attendance, notifications, year and identity. | Validate 360/390/768/1024/1280 widths and 200% zoom; retain matrix-local overflow and expose scroll affordance. Runtime impact is not yet verified. |
| P1 states | Shared LoadingState lacks status semantics; ErrorState lacks alert semantics. | Improve shared announcements in Phase 2, retain retries and unavailable vs empty distinction. |
| P2 density | globals.css has 76px header, 30px page inset, 22px cards and repeated sidebar overrides. | Adopt spacing/layout tokens incrementally; preserve mobile and print overrides. |
| P2 consistency | Inline-style counts above; report-components contains specialized table/metric/state patterns alongside ui.tsx. | Align styles and reuse domain adapters before extracting generic components. |
| P2 motion/contrast | Reduced-motion rules cover selected components but global spinner and button motion remain; teal usage needs pair-specific contrast checks. | Validate contrast, focus and motion in Phase 2. Token definitions alone do not establish WCAG compliance. |

## Shared design-system proposal

Phase 1 adds davi-prefixed semantic tokens referencing the existing palette plus spacing, radii, typography, layout, control targets and motion. Existing palette and visual rules remain unchanged. Proposed #123F52 primary, #168B79 accent and #F5F7F9 canvas require a later adoption/contrast review. Use existing darker teal-dark for small text and solid action backgrounds when adopting; every status also needs text.

Desktop target: 232px sidebar / 68px collapsed, 60px header, 24px page inset, 12?16px gaps, 14?16px body and 44px rows/controls. Tablet uses drawer/collapsed navigation; mobile uses drawer, 16px inset and stacked actions. Validate actual touch target spacing and WCAG 2.2 AA behavior. Focus target is a visible 3px outline; reduce nonessential motion when requested. No global restyling is included in Phase 1.

## Component reuse plan

| Pattern | Existing implementation / next action |
|---|---|
| AppShell, Sidebar, Topbar | app-shell.tsx; preserve auth/context and split only if useful |
| Breadcrumbs, SectionTabs | academic-breadcrumbs.tsx, workspace-tabs.tsx; extend existing route/context behavior |
| Headers, badges, forms, permissions, confirmation | ui.tsx PageHeader, StatusBadge, Field, SimpleForm, FormActions, PermissionGate, Modal, ConfirmDialog; improve in place |
| Loading, empty, error, skeleton | ui.tsx, workspace-loading.tsx, report-components.tsx; retain domain distinctions |
| Metrics, sections, ActionCenter | school-command-center-parts.tsx, school-command-center.tsx, report-components.tsx; retain real-record calculations |
| Tables, search, toolbar, filters, dates | classes-table.tsx, report-components.tsx, report-filters.tsx; align before extracting |
| Drawers, exports | timetable-drawer.tsx, report-components.tsx DrilldownDrawer, report-export-menu.tsx; preserve native-dialog and snapshot behavior |
| Workflow progress | student-migration-wizard.tsx and migration-steps/progress CSS; no invented states |
| Notifications | notification-bell.tsx; retain in-app records/read status and external adapter limits |

## Proposed navigation map (not applied)

| Area | Existing destinations |
|---|---|
| Dashboard | /dashboard Today and Overview, school slug alias |
| Admissions | Existing dashboard, enquiries, applications, follow-ups; application-detail payments; settings retained |
| Students & People | Students, allocation, unassigned, import-migration, transfers, promotions; teachers, staff, parents |
| Academics | Daily: workspace, timetables, assessments, academic-planner, ai-lesson-plans, holidays-events, announcements. Setup: academic-years, classes, groups, subjects, section-capacity, period-templates, timetable-settings |
| Staff Operations | /operations, attendance, leave, duties, /people/teacher-attendance, /my-day; retain policy/settings/report utilities |
| Reports | Existing six reportPages; contextual exports and export-history utility |
| Settings | /school/profile, /school/settings, /access/roles; authorized configuration utilities |

Platform navigation stays separate. Do not duplicate cover links. Preserve each link's permission rules, including additional admission/student prerequisites. Persist only non-sensitive sidebar expansion preferences. Preserve query context; never persist child/report data as navigation state.

## File change plan and before/after

Implemented: this document, docs/DAVI-UI-ROUTES.json, apps/web/app/design-tokens.css and one import in globals.css. No dependency, API, schema, security or business-rule changes.

Before: palette variables existed without a semantic layout/spacing/control foundation or complete page-file inventory. After: additive tokens are loaded and all 52 page files have traceable inventory entries. Existing screen appearance is preserved at this checkpoint.

Phase 2 candidates: app-shell, academic-navigation, reports-navigation, academic-breadcrumbs, ui, workspace-tabs and their existing targeted tests. Later module changes must first inspect delegated workflow components and run relevant permission/workflow checks.

## Next phase readiness

- [x] Initial working tree clean; existing work preserved.
- [x] Source routes, aliases, layout gates, shared patterns and scripts inventoried.
- [x] Attendance correctness blocker documented with separate tested fix scope.
- [x] Additive shared token foundation implemented.
- [ ] Authenticated browser checks: desktop/tablet/mobile, keyboard, zoom, focus, dialogs, print and parent multi-child access. Not performed in Phase 1.
- [x] Automated validation recorded below; report-suite failures remain an open readiness blocker.
- [ ] Stop at Phase 1 checkpoint; Phase 2 has not started.

## Validation results

- Production build: passed with npm.cmd --workspace apps/web run build, including Next type/lint stage and generation of 48 static pages. PowerShell blocks npm.ps1, so the installed npm.cmd entry point was used.
- Independent TypeScript check: passed with node node_modules/typescript/bin/tsc --project apps/web/tsconfig.json --noEmit --incremental false.
- Existing frontend tests: 169 total; 156 passed, 12 failed, 1 skipped. All failures are reports-ui.test.js:83 workspace-render assertions expecting ?Snapshot ready?. Repeating that suite with the original HEAD globals.css restored produced the same 12 failures (18 passed out of 30). The additive stylesheet was restored afterward. These pre-existing failures are recorded, not masked or repaired by this foundation-only change.
- git diff --check passed. No new tests were added for passive token declarations; existing builds validate CSS integration.
- No authenticated browser, visual regression, live permission workflow or performance profiling was performed. Phase 1 artifacts are ready for review; the all-green validation acceptance criterion remains unmet. Phase 2 has not started.
