# Navigation and daily automation revision — 30 October 2026

This supersedes the earlier eight-group sidebar organization in `sidebar-refactor.md`.

## Current navigation

- **Dashboard** — direct link, no nested duplicate.
- **School Configuration** — renamed from School Setup; existing school and academic configuration pages remain available.
- **Admissions** — overview, enquiries/follow-ups, applications/admissions and admission settings.
- **Students** — directory, imports, allocation, transfers/swaps, promotions and parent directory.
- **Class Workspace** — direct link outside Academics.
- **Academics** — timetables, timetable settings, period templates, academic planner, syllabus/AI plans.
- **Daily Operations** — direct link to the existing `/operations` page, separate from staff management.
- **Staff Management** — staff directory, attendance, leave, duties, substitution planner and attendance reports.
- **Automation & Jobs** — school-admin access to Scheduled Jobs.
- **Communication**, **Reports & Analytics**, **Administration** — existing destinations and permission checks retained.

The sidebar no longer contains Find a Page/search or the academic-year selector. Academic-year selection now appears in the dashboard header, subject to ACADEMIC_YEAR_VIEW. The Academic Years management page stays available under School Configuration. Every sidebar destination has its own distinct module icon; group disclosure icons also differ from destination icons. Dashboard, Class Workspace and Daily Operations each render a single direct link. Other groups remain collapsible, with the active group expanded by default. Compact desktop and mobile drawer behavior are retained. Existing URLs, school prefixes, bookmarks and permission strings remain unchanged.

## Scheduled substitution processing

CoverageService already owned an every-minute backend timer, so this revision reuses that worker rather than starting a competing scheduler. It checks configured missing-check-in reminders and reconciles substitutions against actual published teaching periods, approved leave and confirmed attendance. A missing check-in does not imply absence. Automatic assignment remains opt-in and respects eligibility, availability, working days, holidays and workload/conflict rules.

The existing settings route now supports `/operations/settings?tab=automation`. This renders a Scheduled Jobs workspace; `/operations/settings` retains its original settings/scopes functionality. Daily Operations also links to Scheduled Jobs.

- GET `/api/v1/teacher-cover/automation`: real worker status, school timezone, existing policy and last school-job run on this process.
- POST `/api/v1/teacher-cover/automation/run`: school-admin Run Now action using the same reminder/reconciliation code, with an initiating-actor audit event.
- Both endpoints enforce existing JWT authentication, active school access, staff.attendance.manage and an explicit school-admin requirement.
- Overlapping runs for one school are rejected within the process. Existing substitution transactions and uniqueness/deduplication behavior remain authoritative across processes.
- The page edits existing coverage policy through the existing policy endpoint. No automatic-assignment option was silently enabled, and no new database migration or duplicate substitution engine was introduced.
- Run status is in memory, scoped to the requesting school, and resets on backend restart. The worker runs every minute while the API process is running. This is not a durable cron-expression editor, cross-process job queue or persistent job-history service.

## Verification

- Navigation/shell/dashboard tests cover direct links, absent search/year sidebar controls, separate Admissions/Students, unique destination icons, permission profiles, compact/mobile navigation and dashboard year context.
- Backend unit tests cover administrator-only access, worker lifecycle, real run summaries/audit, overlapping runs and observable failures.
- An isolated PostgreSQL/Nest HTTP integration test exercised status and Run Now, denied a non-admin teacher, checked a successful last-run state and verified the audit event. The application database was not changed.
- Full web suite: 216 passed, 1 gated live test skipped, 0 failed.
- Backend default suite: 333 passed, 33 gated integrations skipped, 0 failed. The new database-backed HTTP check was run separately and passed.
- Type checking, both application builds and `git diff --check` passed. Logs are in `outputs/navigation-*.log`.
- No browser/device interaction was performed in this revision; responsive behavior was checked through existing component tests and CSS structure.

The earlier dashboard migration remains necessary for parent queries and classroom activity execution in an application database. This navigation/job revision does not apply that migration to existing school data.
