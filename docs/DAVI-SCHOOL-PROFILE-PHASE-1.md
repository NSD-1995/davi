# School Profile consolidation: Phase 1 audit

Date: 26 October 2026. Scope: latest four-tab School Profile request. This document supplements DAVI-UI-PHASE-1.md, DAVI-UI-ROUTES.json and DAVI-RESPONSIVE-BRANDING-PWA-AUDIT.md. Its six-phase execution order supersedes earlier phase numbering for this module. Phase 1 only: no application, database or API changes.

## Existing functionality reused

- /school/profile already loads current-school identity through schoolApi.current, offers SCHOOL_PROFILE_UPDATE-gated editing, refreshes the session after save, and reads the settings logo. Its default display is disabled inputs rather than read-only details.
- /school/settings exposes schoolName, timezone, language, gradingSystem, attendancePolicy, examPolicy, notificationEmail and logoUrl. SchoolSettingsService checks actor school for reads/writes. Settings are separate from identity and must not be overwritten by a partial profile form.
- Existing school routes and AuthProvider support /school/{slug}/login. School.slug is database-unique. Creation normalizes shortName into slug; current DTOs do not accept an independent requested slug. /s/{slug}/login does not exist.
- Shared PageHeader, Field, FormActions, loading/error states, Modal, permission checks, CSS palette and additive davi tokens are available. Reuse these, not a replacement UI framework.
- School dashboard uses settings.logoUrl; published assessment snapshots capture school identity/logo and report PDF rendering consumes that snapshot. Branding edits must not rewrite published reports.
- User is the shared identity; Staff and Teacher reference unique userId. StaffScopeAssignment, TeacherAcademicAssignment and timetableEligibility responsibilities serve different authorization/scheduling purposes; keep their semantics intact.

## School fields: evidence and disposition

| Requested value | Existing storage | Decision for later implementation |
|---|---|---|
| Official name | School.name | Primary identity; reuse current endpoint |
| Short name | School.shortName | Exists, but updateCurrent allowlist does not currently persist it; add explicit validated support without changing slug |
| School type | No dedicated School field | Do not invent enum/options; propose nullable field only when actual allowed values and migration are specified |
| School code | School.id is an internal identifier; no school-code field | Do not relabel internal UUID as official code |
| Email/phone/website/address/city/state/country | Existing School columns | Reuse and validate; read-only details until Edit |
| District / PIN | No dedicated School columns | Additional optional storage requires a minimal migration; do not parse structured values from free-form address or fabricate fields |
| Display name | SchoolSetting.schoolName | Preserve existing value; label as display override rather than duplicate official name |
| Logo | SchoolSetting.logoUrl | Reuse; validate safe assets before public branding/upload support |
| Colors / favicon | No dedicated validated brand configuration | Proposed nullable versioned branding JSON; not migrated in Phase 1 |
| Slug | School.slug @unique | Preserve existing values and URLs; separate shortName editing from slug change |

Country currently defaults to Kenya in Prisma, while platform school creation UI defaults to India. Do not rewrite saved country values when consolidating UI. New Indian-school defaults must be aligned deliberately in the create service and schema default without backfilling existing rows.

## Settings value usage and preservation map

| Existing setting | Observed usage | Consolidation handling |
|---|---|---|
| schoolName | Persisted through settings; current shell uses School.name | Preserve as optional display override, explicitly distinguish from official name |
| logoUrl | Profile, dashboard command response, assessment publication snapshots/PDF | Branding tab; retain old published snapshot identity |
| timezone | Coverage policy fallback and report-period calculation; other policy overrides exist | Remove configurable profile control only after compatibility plan below; retain column |
| language | Stored through settings DTO/service | Preserve existing value; compatibility settings access if no new localization UI |
| gradingSystem | Stored string; no domain calculation consumer found by repository search | Preserve legacy preference; authoritative assessments stay in existing assessment module |
| attendancePolicy / examPolicy | Stored legacy text; no operative consumer of these exact settings fields found beyond CRUD/UI | Preserve legacy values, label as legacy notes rather than actual policy controls; link to authoritative modules |
| notificationEmail | Stored by settings CRUD; no delivery consumer found in apps/packages source search | Legacy notification contact, not proof of live external email delivery. Preserve/edit as optional compatibility contact; do not rename to school email or delete |
| Other settings JSON | Operational, coverage, analytics, admissions, assessment/import/capacity/timetable policies | Leave in their authoritative modules; profile saves must not reset these |

No-usage findings describe repository source search, not a guarantee that external clients never consume fields. Keep API compatibility.

## India-local time compatibility

Requested target: Asia/Kolkata for school-local business calculations, UTC timestamps, consistent en-IN dates and INR currency. No configurable timezone in the final four-tab profile.

Current backend settings create defaults to Africa/Nairobi; settings UI defaults Asia/Kolkata; coverage.policy merges settings.timezone and then coveragePolicy overrides; analytics chooses coveragePolicy.timeZone, then settings.timezone, then UTC. Therefore hiding the input alone does not implement India-local correctness. Changing a saved timezone silently may change attendance day boundaries, deadlines, leave eligibility and report periods.

Plan a separate focused compatibility change: enumerate timezone sources/policy overrides; inventory non-India settings without exposing real data in logs; add a shared India-local clock/format policy for Indian-school operations; test UTC-to-India boundary days, date-only fields and historical report snapshots. Preserve stored timezone columns and old snapshots. Do not bulk-update records or modify published evidence. Flag conflicting existing policy values explicitly rather than “fixing” them as a side effect of a profile save.

## Academic responsibility and authorization audit

| Existing model/service | Actual purpose | Reuse boundary |
|---|---|---|
| Staff / User | School employment and shared person identity | Reference existing staff/user; no duplicate principal identity |
| TeacherAcademicAssignment | Teacher + academic year + required class; optional section/subject; responsibilityType, assignmentRole, active and effective dates | Reuse for teaching assignments; unsuitable as a school-wide principal record or for non-teaching leaders because teacher/class are required |
| Teacher.timetableEligibility.groupResponsibilities | Group-specific subject/class teaching eligibility; validated by teaching-responsibilities.ts | Reuse to display teaching scope, never infer principal permission from it |
| StaffScopeAssignment | One scope record per school/user; group/class/section/staff/department scope | Keep operational scope authoritative; not a multi-position designation table |
| OperationsAccessService | Active school membership, role grants/legacy capabilities and explicit staff/target scope | Use existing approval scope checks; never replace with a designation lookup |
| AcademicScopeService | Validates school/year/class/subject assignment and actor academic access | Preserve checks for AI/planning; leadership metadata alone cannot satisfy them |
| ClassroomManagementController | Lesson changes require LESSON_PLAN_APPROVE | Reuse existing workflow, do not create a parallel approval engine |
| SchoolOperationsService / coverage | Leave and daily task/cover workflows with scoped actor checks | Keep independent from title/display; preserve self-approval and eligibility rules |

No dedicated multi-position academic leadership/designation model was found in the inspected schema. StaffCategoryDefinition is an employment category, not an academic designation system. Do not overload it.

Proposed Phase 5 persistence, not implemented: school-scoped designation records (including unassigned positions) plus separate assignment records referencing existing staff. Support multiple compatible assignments, explicit group/class/section/subject references, active/effective dates and optional reporting contact. Validate every referenced entity against the actor school and academic year where relevant; reject cycles if supervisor links are supported. Avoid a required hierarchy. Return only directory-approved identity/scope data, not private staff contact payloads.

Add a narrowly defined academic-management permission through existing role/permission machinery. Do not grant it to coordinators/principals by title, and do not let an assignment editor change role grants or StaffScopeAssignment implicitly. Effective access remains existing permission grants intersected with the applicable workflow scope. A proposed leadership scope is metadata until explicit, reviewed integration with each domain scope exists. Permission changes remain in Roles & Permissions.

## Four-tab module architecture and compatibility

1. School Information: compact identity summary and semantic definition-list details, explicit Edit/Save/Cancel, optional display override kept distinct, India default only for genuinely new values. No timezone control.
2. Branding & Appearance: validated persisted logo/color controls, accessible foregrounds, desktop/mobile/login/header previews and reset of branding overrides only. Preserve semantic success/warning/error colors. Existing secure private workflow uploads are not automatically suitable public brand uploads.
3. School URL & PWA: read/copy actual existing login URL; separate slug from short name. Add normalization/reserved names, authorized debounced availability and database-checked alternatives, submit revalidation/409 race mapping. Public resolution returns only approved branding projection. Keep legacy /school route alongside preferred /s alias. Installation scope limitations must be visible and accurate.
4. Academic Management: compact directory/cards from existing staff with designation, scope and active/effective status. Unassigned designations show no fake person. Reuse authoritative contextual workflow links only when permitted.

Use query-backed tab state such as /school/profile?tab=branding and preserve reload/back navigation. Keep /school/settings functional until all legacy values have a deliberate reachable home. Proposed compatibility path: render the same module with an explicit “Existing preferences” disclosure reached by the old settings link, containing language, legacy grading/policy notes and notification contact; omit timezone editing. Do not redirect the old route until this mapping and a values-preservation test pass. This disclosure is compatibility data, not a duplicate operational configuration screen. Remove only the duplicate sidebar item after that gate.

Schools with missing branding/assignment support should receive honest availability states, not enabled Save buttons against nonexistent APIs. Partial load failures remain errors with retry; they must not become blank forms saved over existing records. Do not allow saving a profile to create/reset a settings row with defaults. Preserve unsaved data across tab switches or ask before discarding.

## PWA and theme boundary

Existing source has no manifest, worker registration or public asset directory; no installation feature is implemented. The earlier PWA audit remains applicable: shared authenticated routes lie outside a proposed /s/{slug}/ scope. Start with one DAVI install identity per origin; school themes within the application do not establish separate native apps. School-specific manifests need a separately tested routing/scope strategy and browser matrix before being advertised.

Keep authenticated APIs/documents, RSC responses, uploads/downloads and exports network-only in any future worker. Cache only explicitly approved generic offline/install assets. No offline writes. Theme must be keyed to verified school identity, with neutral loading state, late-response rejection and reset on logout; public URL branding cannot switch authorization context. Safe public brand assets need validated type/size/origin and ownership; no raw CSS/HTML or unrestricted server-side URL proxy.

## Decisions, file plan and acceptance gates

| Phase | Focus / proposed files | Required validation |
|---|---|---|
| 1, this execution | This audit only | Static evidence, preservation map and model gaps documented |
| 2 | school/profile and settings pages, shared school-profile component/CSS, app-shell navigation, explicit updateCurrent DTO allowlist if shortName editing included | Both routes work; every existing value preserved; denied edits hidden/rejected; initial read-only details; no duplicate configuration |
| 3 | Settings schema minimal branding migration, typed DTO/service validation, theme provider, branding preview/asset endpoint | Review migration compatibility first; two-school refresh/logout tests, contrast, malicious inputs and uploads |
| 4 | Slug policy/service/API, public brand resolver, platform creation, /s alias/auth path recognition, manifest/worker/install UI | Legacy URLs; races/reserved names/checked alternatives; safe caches; actual browser install/update/offline tests |
| 5 | Reviewed designation/assignment schema and endpoints, directory/editor, explicit permissions | Existing staff references, multiple responsibilities, unassigned positions; no title-based grants or cross-tenant reference |
| 6 | Relevant existing suites and focused integration/browser tests | Responsive, security, academic/operations regression matrix |

No Prisma migration, field addition, permission grant or endpoint was implemented in Phase 1. Storage proposals require concrete reviewed schema/SQL in their phase; no uncontrolled migration runs.

## Validation and limitations

- This execution adds documentation only. git diff --check is the applicable file check; application builds/tests are not rerun for unchanged code.
- Prior checkpoint results only: frontend production build and independent TypeScript passed; 156 frontend tests passed, 12 report assertions failed, 1 skipped. The same report failures reproduced with original CSS. This is not a fresh test result for this module.
- Responsive acceptance at 320/375/390/430/768/1024/1280/1440/1920px: not performed. Keyboard/screen-reader, mobile keyboard, zoom, contrast, upload and installation acceptance: not performed. No before/after screen claim is made.
- Phase 2 tests must seed distinct profile/settings values, save one field/tab, and assert every unrelated value remains unchanged. Cover missing settings, failed logo/settings fetch, readonly users, cancelled edits, refresh/back navigation and old URL behavior.
- Phase 3–6 isolated fixtures must use two synthetic schools with distinct branding, private staff/parent data and overlapping names. Assert cross-school read/write/reference denial, theme cleanup, no private Cache Storage entries and immutable published snapshots.
- Assignment tests must cover multiple compatible responsibilities, invalid/inactive/cross-school staff, scope/year mismatches, overlapping dates, unassigned designations and an ordinary user with a principal designation but no grants. Such a title must not enable approval or broader reports.
- Existing attendance denominator mismatch remains a separate correctness blocker; this profile module must not silently change that calculation.

## Phase 1 outcome

Existing identity/settings and academic scope machinery can be reused. Gaps are now mapped to specific later-phase work without changing current records. Modified file in this execution: docs/DAVI-SCHOOL-PROFILE-PHASE-1.md only. Prior uncommitted token/audit work is preserved. Next phase: consolidate School Profile UI and compatibility settings with route/data preservation tests; no wholesale rewrite or unrelated screen changes.
