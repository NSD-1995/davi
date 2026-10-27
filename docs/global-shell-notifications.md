# Shared shell and in-app notifications implementation

26 October 2026. Implemented globally through AppShell rather than module-specific redesigns. Existing school-prefixed routing and all earlier local work are preserved.

## Changes

- Removed the authenticated desktop topbar. Main content starts with page-level breadcrumbs/header. Shared mobile header remains through 1000px; larger widths use the collapsible sidebar.
- Sidebar identity uses approved HTTPS settings logo when readable, initials when missing/failed, and DAVI for platform users. Logo state is keyed to actor/school; identity links to School Profile only with SCHOOL_PROFILE_VIEW. School theme colors are not persisted by existing backend models, so current DAVI tokens remain authoritative.
- Moved existing AcademicYearSelector below identity, retaining existing state/service and current labels. Collapsed mode retains the actual native selector. Added an explicit accessible label. Academic-year provider now clears/keys state by actor/school and rejects late old-session responses.
- Retained TeacherCheckIn in sidebar. Added bottom account footer with user, role, keyboard-accessible disclosure and existing logout action. Collapse preference is persisted; no sensitive data is stored there.
- Removed duplicate cover navigation, preserving the union of existing permission paths. Added shared parent layout with child-learning navigation; parent content reuses the same shell without staff navigation or global academic-year selection. Public login remains unchanged.
- Exactly one NotificationBell is mounted. CSS places it by desktop school identity, visibly in collapsed sidebar, or in mobile header. A native modal dialog supplies focus containment, Escape handling and return focus. No worker, push or real-time infrastructure was introduced.
- Notification list refreshes every 60 seconds while visible and on window focus, with identity and request-generation guards. Read mutation invalidates pending fetches; local read status changes only after backend success. Read history remains, only eight recent items are initially shown, and Show more history expands the loaded list.
- Unread count uses all rows returned by the API before display limiting. Zero has no badge; above 99 displays 99+. Loading/error have distinct accessible labels. Existing coverage-alert fallback is limited by the backend to 30 personal alerts and is labelled as recent, not a complete account unread total.
- No bulk-read endpoint exists, so no Mark all action was fabricated. Payload URLs are ignored; only a known coverage destination with existing permission checks is offered. No notification-history page exists; history expands in the panel.
- Added safe-area/dynamic-height rules, long-label truncation, touch targets, independent navigation scrolling and sidebar footer. Timetable sticky offset now accounts for removed desktop topbar.

## Files changed in this execution

- components/app-shell.tsx, notification-bell.tsx, academic-year-selector.tsx
- lib/academic-year-context.tsx; new lib/notification-presentation.ts
- app/layout.tsx; new app/app-shell.css and app/parent/layout.tsx
- app/parent/learning/page.tsx: wrapper/header integration only; child workflow preserved
- new test/app-shell.test.js and test/notification-bell.test.js
- this implementation record

No API, database, authentication grant or backend business-rule changes. Existing backend notification readAt semantics are reused unchanged, including school-wide notification records; per-recipient read receipts are not added here.

## Validation

- Production frontend build passed, including Next lint/type stage and static generation. Final independent tsc passed after accessible-label/account-focus refinements.
- 64 targeted checks passed: shell, notification read/count/failure/navigation, school routes, School Profile, academic navigation, dashboard and timetable workspaces.
- Broader frontend run before the five shell tests were added: 186 tests, 173 passed, 12 failed, 1 skipped. Failures are the same previously recorded reports-ui snapshot-label assertions, not new notification/shell failures.
- git diff --check passed. No separate lint script exists in web package.
- Browser acceptance at 320/375/390/430/768/1024/1280/1440/1920px, landscape/zoom, real keyboard/screen-reader interaction and installed PWA behavior were NOT performed. CSS and rendered-component tests do not establish visual acceptance.

## Remaining acceptance and limitations

Verify real logo fallback, long school/user/role names, collapsed selector, mobile drawer focus, academic-year navigation, notification read failure/retry, refresh races, logout/two-school identity change and parent child selection in authenticated browsers. Verify safe-area and keyboard-open heights on devices. Installed-PWA testing remains pending because no installable manifest/service worker has been implemented by earlier work. In-app notification support does not imply operating-system push support. Colors remain DAVI defaults until the separate validated branding backend is implemented.
