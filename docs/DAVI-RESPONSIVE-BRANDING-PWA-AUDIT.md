# DAVI responsive UI, tenant branding and PWA architecture audit

Date: 26 October 2026. Checkpoint: Phase 1 of the responsive/branding/PWA request. This is an architecture and source audit, not a deployed PWA or browser acceptance report.

## Current state and scope

The prior Phase 1 work is preserved: globals.css imports additive design-tokens.css, and DAVI-UI-PHASE-1.md plus DAVI-UI-ROUTES.json inventory all 52 page files. This execution extends that audit to tenant identity, settings, login, assets, caching and installation. No application code, API or database changes are made in this execution. No synthetic records are inserted into a real database.

Inspected: app route tree/root/admin layouts; app-shell; academic/report navigation; globals and design tokens; Tailwind/Next/package configuration; login page; auth context and API client; platform school creation; school profile/settings UI; School and SchoolSetting Prisma models; school/settings DTOs, services/controllers; auth service, JWT/permission guards and main bootstrap. Existing frontend suites and prior verification results inform the test plan, not a claim of runtime coverage.

## Existing foundations and exact gaps

| Area | Existing implementation | Missing / implication |
|---|---|---|
| Routes | 52 page files; full companion inventory in DAVI-UI-ROUTES.json | Keep existing deep links and query contexts; do not introduce duplicate module routes |
| Shell | app-shell.tsx: fixed sidebar, topbar, collapse, mobile scrim, focus loop/Escape and return focus for drawer | Duplicate cover link; seven-area regrouping pending; no school logo, scoped global search or persisted shell collapse state |
| Responsive layout | Drawer through 1000px, stacked forms/tables, module-specific breakpoints | 76px header, 30px desktop content padding, 80px collapsed sidebar; targets differ from proposed compact foundation; no safe-area/dynamic viewport rules found in inspected shell CSS |
| Tokens | Existing palette and additive davi semantic tokens | New layout tokens are not yet consumed by screen rules; later overrides must be consolidated carefully |
| Tailwind | tailwind.config.js, tw- prefix, preflight disabled | Content discovery currently includes selected report/command-center components only; new utility users require explicit content coverage |
| School identity | School.name, shortName and unique slug | shortName currently determines slug at creation; no independently editable requested slug in DTO |
| Existing login URL | /school/[schoolSlug]/login delegates to common login page | /s/[schoolSlug]/login does not exist; public branding resolution and invalid-school preflight do not exist |
| Authentication | Login submits schoolSlug; backend filters users by normalized school slug and validates credentials; JWT guard reloads active user | Stored session is origin-wide. Visiting another school login with an existing session redirects to that session's dashboard; no explicit school mismatch choice |
| Session lifecycle | AuthProvider refreshes /auth/me; logout clears davi_session and React session, routes to /login | No cross-tab logout listener; school-branded logout landing and unmount/reset of all school context need verification before theme/PWA rollout |
| School creation | Platform modal accepts name/shortName; service normalizes slug and prechecks uniqueness; database @unique on slug | No availability endpoint, debounce, reserved-name validation, checked alternatives, length policy or mapped unique-race conflict; school/admin/role creation uses separate writes |
| Settings | SchoolSetting.schoolName and logoUrl; settings endpoints check actor school; profile renders logo URL | No primary/secondary/accent colors, tagline, icon/banner, validated public branding projection or Appearance preview/reset |
| Branding assets | Logo URL text input in settings | No dedicated brand upload pipeline found; domain-specific admissions/migration upload routes are not interchangeable public asset upload APIs |
| PWA | No manifest/service-worker registration/worker references found in application source; no public directory | Manifest, icons, offline document, lifecycle UI and installation verification all absent |
| Caching | API client uses bearer headers; selected requests use no-store; existing private downloads use protected routes | No service-worker caching policy. Do not infer that ordinary browser/proxy caches are fully audited from the absence of a worker |

## Risks ranked by impact

1. Tenant context: origin-wide session and redirect behavior must be reconciled before a school-branded login can reliably represent the school in its URL. A URL is a presentation/resolution hint, never authority to access that school's records.
2. PWA privacy: a generic cache-first strategy for navigation, RSC requests, APIs, exports or private files could retain student data or a previous user's HTML. Implement an explicit allowlist and network-only policy for everything sensitive.
3. Slug races: database uniqueness exists, but precheck plus creation is not enough for friendly conflicts. Handle Prisma uniqueness errors and avoid partial school provisioning with a transaction in the specific slug/provisioning phase.
4. Brand trust: arbitrary logo URLs are currently accepted through DTO/service persistence; new public rendering must validate permitted asset origins/schemes and must not perform unrestricted server fetches.
5. Accessibility: ui.tsx Modal lacks title linkage and complete focus management; shared loading/error announcements and global reduced-motion support need work. Shell has useful drawer keyboard behavior to retain.
6. Responsive acceptance: source media queries are not proof against clipping or page-level overflow, especially at 320px, zoom, keyboard-open heights and with long school names.
7. Existing blockers: attendance individual/group denominator mismatch remains a separate correctness defect; 12 existing report rendering assertions failed in the previous checkpoint. Do not present inconsistent attendance comparisons as trusted.

## Shared architecture and reuse plan

Keep AppShell as the authenticated composition point. Extract a SchoolHeader only if this makes its context/overflow behavior easier to maintain. Reuse AcademicYearSelector, NotificationBell, TeacherCheckIn, AcademicBreadcrumbs, AcademicNavigation and ReportsNavigation. Retain existing capability checks and backend guards; regrouping must preserve compound rules, not simply rename headings.

Use ui.tsx PageHeader, Field, FormActions, StatusBadge, Modal, ConfirmDialog, PermissionGate and distinct loading/error/empty states. Extend these in place. Reuse report filters/tables/export menu and native-dialog drawers where their snapshot semantics apply. Do not replace all tables or introduce a new UI dependency.

Phase 2 consumes davi tokens for 60px header, 232px expanded/68px collapsed sidebar, 24px desktop/16px mobile inset, 12–16px cards/gaps and 44px control targets. Keep complex matrices locally scrollable with visible affordances, and use content-driven wrapping/minmax layouts. Add safe-area insets and dynamic viewport limits for drawers/dialogs with fallbacks. Provide a skip link and a clear main target. Keep academic-year selection reachable on mobile rather than merely hiding it.

Seven navigation areas: Dashboard, Admissions, Students & People, Academics (Daily Work / Setup), Staff Operations, Reports, Settings. Preserve platform navigation separately, every existing URL and the six report workspaces. Payments remain application-detail actions. Do not add a nonfunctional search icon; initially omit search until a scoped implementation exists, or provide actual navigation search over already-authorized links.

## Slug and login architecture: Phase 3 proposal

- Keep /school/{slug}/login as a supported existing URL. Add /s/{slug}/login as a thin alias using the same resolver/form; update AuthProvider login-path recognition before enabling it. Preserve old dashboard links and existing slugs without backfilling or renaming them.
- Accept an optional explicit slug in CreateSchoolDto. When absent, retain the existing shortName-derived behavior for compatibility. Define one shared normalization/format policy: lowercase ASCII letters/digits with single internal hyphens; bounded length; reserved-name set. Existing unusual legacy slugs continue resolving, even if new creation policy is stricter.
- Add a platform-authorized availability API, avoiding public enumeration where not needed. Return only normalized candidate, validity, availability and checked alternatives; never account/admin/contact details. Apply server-side throttling before rollout (no throttling was found in the inspected bootstrap/auth/school paths).
- Generate alternatives deterministically from the candidate and optional city/suffix, cap work, and check every returned alternative in the database. Debounce valid client input, cancel/ignore stale responses, and display unavailable/error independently from invalid. Revalidate on submit and map a lost uniqueness race to 409. Availability is advisory, never a reservation.
- Wrap school/admin/role/permission assignment provisioning in a transaction as part of the reviewed creation change. Keep temporary credential handling restricted to existing authorized flows and out of availability/public branding responses.
- Public branding resolution accepts only a slug and returns an explicit minimal DTO: supported display name/short name, sanitized approved logo reference and validated theme values. Unknown slug returns a generic unavailable-school state. Authentication still resolves actual membership from credentials/JWT.
- An existing session belonging to a different school must not silently adopt URL branding. Show a clear current-school context with an explicit sign-out/sign-in choice; preserve unsaved work and never silently switch authorization context. Test parent membership behavior separately from ordinary staff schoolId assumptions.

## Branding architecture: Phase 4 proposal

Reuse School.name, shortName, slug, SchoolSetting.schoolName and logoUrl. Do not misuse attendancePolicy or unrelated JSON policies as theme storage.

Minimal proposed migration, not executed: add nullable branding Json? to SchoolSetting. The document is versioned and strictly validated against a bounded allowlist (primary, secondary, accent, tagline, optional approved icon/banner references). Keep logoUrl and schoolName in their existing columns. No new display-name column is needed. Omitted values use DAVI defaults; reset clears only branding overrides, not school identity or other settings. Nullable addition supports existing rows and rolling deployment; generate/review migration SQL and test rollback compatibility before applying it. No database migration is required for unique slugs, which already exist.

Use a pure shared branding validator and contrast calculator plus a school-keyed provider. Never interpolate raw CSS/HTML or accept arbitrary custom property names. Permit only validated color syntax, compute foreground by measured contrast, and provide safe fallbacks for text/actions/focus. Validate action text at 4.5:1 and non-text indicators at applicable 3:1 thresholds; preserve explicit focus and status text. Separate semantic success/error/warning from decorative brand accent.

Public login resolves branding on the server using the route slug; serialize the same sanitized DTO into initial client state. Initially use request-scoped/no-store resolution to avoid cross-tenant cache mistakes. Authenticated pages currently obtain session on the client from localStorage: render a neutral default shell until /me confirms identity, then load branding keyed to verified school identity. Do not read the previously visited school from browser storage. Perfect server-rendered authenticated branding would require a separate cookie/session architecture decision; do not claim it is solved by a client theme provider.

Scope CSS variables to the active school wrapper; remove/reset on logout or identity change, clear school-specific query state and ignore late old-school responses. Apply identical validated values to login, shell and previews. Update theme metadata deliberately; browser-installed names/icons may update on different schedules.

Appearance UI extends existing /school/settings with authorized save/reset, read-only behavior, real desktop/mobile/header previews and persisted validation errors. Reuse SCHOOL_PROFILE_UPDATE and actor school checks. A brand asset endpoint needs its own restricted image type/size/dimension policy, tenant ownership, scanner integration where appropriate and safe public derivatives. Never make admissions/migration private documents public or blindly proxy external URLs. External custom domains and store applications are outside this plan.

## PWA architecture: Phase 5 proposal

Initial installation identity: one DAVI app per origin, with a stable manifest id, scope /, start_url /login and standalone display. This matches shared authenticated routes (/dashboard, /academics, /people, etc.). School branding appears after secure school resolution/session verification; installed name/icon remain DAVI initially.

Separate school installs are deferred: a /s/{slug}/ scope would exclude most current authenticated routes. Distinct manifest ids alone do not provide tenant isolation or establish reliable separate installations on every browser. Full per-school path routing/scope and real iOS/Android/desktop tests are prerequisites. No route rewrite is justified solely to claim branded installation support.

Use Next App Router manifest support, verified against installed 14.2.15 types/build rather than assuming every current documentation example works on this version. Add actual 192px/512px icons, maskable-safe artwork and Apple touch icon. Provide appropriate metadata/viewport, theme/background colors and offline fallback. Prefer a small explicit worker and registration component without new dependencies for this limited policy.

Caching policy:

| Resource | Planned worker behavior |
|---|---|
| Auth/API, POST/PUT/PATCH/DELETE, exports, tickets, uploads, private images/files | Network only; never cache responses or queue writes |
| RSC/flight requests and authenticated navigation documents | Network only; on network failure return a generic offline document only for navigation requests |
| Generic offline document and DAVI public install icons | Explicit versioned precache allowlist; no tenant or user content |
| Public branding and dynamic manifests | Initially no-store/network only; do not mix school resolution into static caches |
| Other assets/routes | Network by default; expand allowlist only after privacy review |

Offline fallback says connection is required, offers retry and contains no school/user data. Exclude it from AuthProvider redirect loops (prefer standalone static document). No offline attendance, background sync, private report viewing or cached account data.

Worker updates should wait for user acceptance or next clean startup. Avoid automatic skipWaiting/controller reload while forms may be dirty. Use an update prompt with a deliberate reload and obsolete-cache cleanup restricted to DAVI-owned cache names. Logout clears all in-memory school state and coordinates cross-tab sign-out; it must not depend on clearing an HTTP cache for security. HTTPS is required in deployed environments; localhost is for development. Verify actual response headers/CDN behavior, registration scope, fallback MIME types and update behavior in staging.

## Exact implementation sequence / file plan

| Phase | Proposed files / changes | Exit criteria |
|---|---|---|
| 1, this execution | docs/DAVI-RESPONSIVE-BRANDING-PWA-AUDIT.md | Source findings, architecture and limitations documented; previous work preserved |
| 2 | app-shell.tsx, ui.tsx, academic/report navigation, globals/design-tokens, relevant existing tests | Compact shell and semantic states; permissions/deep links intact; measured responsive/keyboard checks |
| 3 | schools DTO/controller/service, shared slug policy, platform-dashboard, API types, new /s alias and auth-path recognition | Availability/reserved names/races tested; legacy slugs/URLs preserved; no schema change required |
| 4 | SchoolSetting schema/additive migration proposal, settings DTO/service, public brand DTO/resolver, validated theme/provider, login/settings/header | Migration reviewed before execution; two-school isolation, contrast, safe assets and SSR/client consistency verified |
| 5 | app/manifest.ts, metadata/viewport, public icons/offline/worker, registration/update UI, Next headers | Network-only sensitive data; install/update/offline behavior verified |
| 6 | Existing test suites plus targeted tenant/theme/worker and viewport tests | Security/responsive/accessibility matrix passes or has explicit blockers |
| 7 | School Dashboard only | Begin only after shared foundation validation; preserve Today/Overview and truthful metrics |
| 8 | One remaining module at a time | Reviewable, tested checkpoints |

## Validation and honest limitations

This execution changes documentation only; build/type checks are not repeated without application changes. Previous checkpoint: production frontend build and independent tsc passed; existing node:test run had 156 passed, 12 failed, 1 skipped (169 total). All 12 report assertions reproduced against original globals.css. These are previous results, not a new pass for PWA functionality.

Responsive matrix: 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px, plus landscape/zoom/keyboard-open heights: NOT executed in this audit. Source layout risks are documented; no before/after screenshots exist because no screen redesign occurred. Screen-reader, measured contrast, keyboard interaction and authenticated mobile acceptance: NOT executed. Installation/uninstall, offline, service-worker updates and installed-platform compatibility: NOT testable yet because no PWA implementation exists. No claim of iOS/Android/browser support is made from architecture alone.

Phase 6 fixtures must provision two synthetic schools in an isolated test database (blue and green), with separate staff, parents and linked children. Assert route resolution, public projection field allowlist, independent theme refresh, late-response rejection, reset/logout/cross-tab behavior, unauthorized brand writes, cross-school record denial, cache contents and exported/private download access. Check reserved/invalid/duplicate/concurrent slug creation, stale availability requests and legacy URLs. Do not run destructive fixture setup on a real school database.

Existing targeted suites to reuse: academic-navigation, reports-ui, school-command-center, timetable workspace/print, assessment-workspace and migration tests; backend school-parent-workflow and school-staff-identity plus new slug/theme guard tests. Browser acceptance must include long names, missing/broken logos, invalid colors, empty/error/loading states, focus containment/return, reduced motion, 200% zoom, file input and unsaved-form update prompts.

## Sources and compatibility boundaries

Architecture references checked against official documentation on 26 October 2026:

- Next manifest support: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
- Next PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- MDN installability: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN worker scope: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Service-Worker-Allowed
- MDN worker lifecycle/cache: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

These references describe platform capabilities, not successful DAVI compatibility tests. Current Next documentation may include features beyond repository version 14.2.15; use installed APIs and builds as the implementation check.

## Checkpoint

Phase 1 architecture audit is complete. Only this document was added by this execution. Database/API changes: none. Existing components are identified for reuse; no duplicate components were added. Next implementation phase: shared responsive tokens/layout/header/navigation (Phase 2). Branding, slug availability, PWA and Dashboard redesign remain unimplemented, with their prerequisites above.
