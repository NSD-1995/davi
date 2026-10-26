# Reports & Analytics presentation migration

## Information architecture

The route remains `/reports/analytics`; `view` selects one of six primary destinations and `subview` selects an internal report. Existing links and Class Workspace continue to use the same workspace and APIs.

| Previous tab | New destination | Canonical query |
|---|---|---|
| Overview Dashboard | Overview | `view=overview` |
| Class & Section Analysis | Class & Section Analytics | `view=classes` |
| Academic Performance | Academic Performance / Achievement | `view=academic` |
| Exams & Marks | Academic Performance / Exam completeness | `view=academic&subview=exams` |
| Subject Analysis | Academic Performance / Subjects | `view=academic&subview=subjects` |
| Attendance Reports | Engagement Analytics / Attendance | `view=engagement&subview=attendance` |
| Homework Reports | Engagement Analytics / Homework | `view=engagement&subview=homework` |
| Student Attention Center | Student Attention Center | `view=attention` |
| Teacher & Staff Reports | School Operations / Staff workload | `view=operations&subview=teachers` |
| Admissions & Enrollment | School Operations / Admissions | `view=operations&subview=admissions` |
| Syllabus & Lesson Plans | School Operations / Lesson plans | `view=operations&subview=syllabus` |
| Student Progress / 360 | Student drill-down, including embedded Class Workspace | `view=students&enrollmentId=...` |
| AI Insights & Comparisons | Contextual AI panel; relevant pages retain period comparison | Legacy `view=insights` opens Overview with the AI panel available |
| Report Export Center | Per-report Export action; Export history utility | `view=overview&utility=exports`; legacy `view=exports` supported |

Fees & Collections remains explicitly unavailable. No unavailable finance module was created or relabeled from admission payments.

## Metrics preserved

- Attendance: engine-provided weighted credit, missing student-days, completeness, absence streaks and daily trend. Trend gaps remain gaps; a missing day is not drawn as zero.
- Homework: assigned, completed/reviewed, pending, overdue subset, excused, completion and review backlog. The composition chart uses mutually exclusive completed/pending/excused categories.
- Assessments: numeric achievement distributions, expected and recorded attempts, completion, missing/grade-only/absent/exempt states, grouped by the existing engine's comparable patterns. No combined school score or new calculation model.
- Comparisons: historical student participation remains separate from current active enrollment/capacity. Section drill-down retains the academic year and report filters.
- Student 360: attendance, homework, exams, observations, enrollment history, comparable progress, interventions, follow-ups and movements. Empty detail sections collapse; individual results are not repeated in a second aggregate exam table.
- Operations: teaching workload, staff attendance permission, applications, admission payments in minor units, scheduled plans and recorded coverage.
- Attention: evidence review, private notes, case owner, due date, status, optimistic revisions and history. Existing cases persist across date periods; the UI explains the year/class case scope and 500-case server boundary. Evidence student pagination remains available.
- AI: aggregate-only generation, deterministic fallback, draft/approval permissions and approved insight inclusion in exports remain unchanged.
- Exports: all existing templates, formats, signatures, chart choice, parent-friendly individual report, approved insights, job actions and private download tickets remain.

## Presentation architecture

- `analytics-navigation.ts`: six primary pages, independent leaf permissions, legacy resolver and canonical query construction.
- `report-components.tsx`: ReportShell, MetricCard, ReportDataTable, ReportSubviews, ReportState, InsightPanel and native-dialog DrilldownDrawer.
- `report-filters.tsx`: shared global toolbar, advanced filters, applied scope summary and reset. Class/section dependencies reset consistently.
- `report-charts.tsx`: line chart with missing-data gaps and accessible exact values, homework composition donut, comparable assessment ranges.
- `report-overview.tsx`: page-specific engine-provided KPIs, current section enrollment bars and exam recording progress.
- `analytics-workspace.tsx`: shared API orchestration, paged datasets and case workflow. `report-export-menu.tsx` and `report-attention-case.tsx` hold the reusable utility and case editing components. Remains embedded in Class Workspace.
- `reports.css`: compact token-based presentation and desktop/tablet/mobile layouts. Tailwind 3 utilities are prefixed `tw-` and preflight is disabled, avoiding resets on existing DAVI screens.

No backend endpoint, business calculation, authorization rule, tenant filter, snapshot schema or export worker was changed by this presentation migration.

## Snapshot and fetch behavior

Snapshot requests use the existing server-side cache, which includes tenant, actor, permissions/assignments, normalized filters and latest source write. Client in-flight requests are deduplicated within the mounted workspace by identity, token, permissions, role and active filters. Completed sensitive report data is not persisted in browser storage or a shared client cache.

Switching internal subviews reuses the selected snapshot. Filter or identity changes hide the old snapshot immediately; late snapshot, comparison, AI and dataset responses cannot replace the current context. Display, comparison anchor, case evidence and exports use snapshot IDs, never independently recalculated client metrics. Comparison creates a separate previous-period snapshot without replacing the screen/export snapshot.

Table search and sort operate on loaded rows and are explicitly labeled when the server dataset exceeds 50 rows. Local table pages show 10 rows; existing server dataset controls remain available. This avoids presenting a partial search as a school-wide search. Global student lookup remains server-scoped and debounced. Whole-dataset search/sort would require extending the existing paging API.

## Automated verification

- Production Next.js build, including all 48 static pages and the dynamic Class Workspace route.
- Report UI regression tests: six-page mapping, legacy URLs, independent permissions, filter preservation, accessible table controls, pagination boundaries, missing/zero values, distinct charts, AI draft/approval states, full workspace rendering for all legacy datasets and restricted export actions.
- Existing academic navigation regression tests.
- Existing analytics calculation/export tests: dates, weighting, missing data, historical transfers, developmental assessments, authorization, CSV safety and XLSX/PDF rendering.
- Real PostgreSQL integration test: tenant isolation, scoped teachers, permission-change rejection, snapshot cache invalidation, attention-case revisions, concurrent export jobs, PDF/XLSX/CSV content and private download tickets. Synthetic test tenants and files are cleaned by the test.

## Manual checks still required

The session's browser inventory was empty and the native Computer Use pipe was unavailable. Visual interaction and actual keyboard/focus behavior could not be manually verified. Native dialogs provide focus confinement and Escape handling, but this is not a substitute for browser verification.

Before release, check at 1440px, 1024px, 768px and 390px:

1. Admin sees six destinations; scoped teacher sees only permitted pages/subviews.
2. Apply/reset year, custom range, class and section; reload a copied URL and verify the applied summary.
3. Open a section, select a student, return to class analytics; repeat inside Class Workspace.
4. Search/sort loaded rows and move local/server dataset pages with keyboard only.
5. Exercise empty, missing-data, denied, request-error and expired-snapshot states.
6. Open export/history drawers, use Tab/Shift+Tab/Escape and confirm focus returns to the trigger.
7. Generate an AI draft, approve with the appropriate role and export from the same snapshot.
8. Open and update an attention case, change owner/status/due date and inspect follow-up history.

### Final automated results

- Frontend regression suite: 114 passed, including 30 report-specific tests.
- Backend analytics suite: 12 passed.
- Real-database analytics integration: 1 passed (including all three export formats).
- Production frontend build and backend build: passed.
- Strict UTF-8 validation: passed for all reporting source/style files.

Contextual AI findings are filtered to the active evidence category on academic, attendance, homework and lesson-plan subviews; Overview retains the full finding set. Export history is independent of a successful current snapshot. Case editing is collapsed until requested, and support cases paginate in groups of twelve.
