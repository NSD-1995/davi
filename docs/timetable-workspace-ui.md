# Timetable workspace UI refactor

## Audit and scope

The old `/academics/timetables` page rendered one `TimetablePlanner` for every visible section. Each planner rendered its own controls, metadata, full matrix and inline older-version grids. The same planner also appears in Class Workspace.

This refactor changes presentation only. No backend services, database models, scheduling rules, tenant filters or stored timetables were modified.

## New workspace

- One compact toolbar: academic year, academic group, class, search, Generate and More.
- A grouped section navigator with Draft/Published/Missing labels, selected section state, collapsible class groups and detected issue indicators.
- Exactly one selected section planner. On tablets the navigator collapses; on mobile an optgroup class/section selector replaces it.
- Weekly Timetable and Daily Cover views share a detail panel.
- Version metadata is displayed once. Historical versions are listed in a native-dialog drawer; Preview switches the single matrix to that version.
- Missing sections show a small generation state rather than an empty weekly grid.
- Full-screen mode supports Escape and keyboard focus confinement.

## Reusable presentation

- `timetable-navigator.tsx`: class/section selection and status display.
- `timetable-matrix.tsx`: period matrix, sticky labels/headers and readable wrapping names.
- `timetable-drawer.tsx`: version and batch-selection drawers with native modal focus handling.
- `timetable-presentation.ts`: presentation-only filtering, slot/day lookup, issue deduplication and CSV serialization.
- `timetable-export.tsx`: selected/filtered CSV and temporary print-only PDF sheets.
- `timetable-planner.tsx`: existing section APIs, validation/publication, Daily Cover and history selection.
- `timetable-workspace.css`: token-based compact styles, responsive layouts, full-screen and print styles.

## Behavior preserved

- Existing `latestSectionPlans` and `timetableConflicts` helpers remain the source of latest-version selection and local overlap detection.
- Absence of local overlap does not claim full validity. Full validation is labeled only after the validation endpoint returns a valid result.
- Academic group, class and search define the visible batch scope. Generate and class-selection batch generation send those exact section IDs to the existing batch engine.
- Publish all sends the latest filtered draft IDs in one call to the existing atomic endpoint. Existing teacher/template validation remains server-enforced.
- Delete-this-version confirms the exact version. Delete-all explicitly confirms that the entire academic year across all groups is affected, regardless of filters.
- Generation creates a new draft using existing APIs. Published versions and history remain until the existing publish/delete operations act on them. There is no local timetable editor whose changes could be discarded by section navigation.
- Every template working day is shown, including Sunday when configured. No holiday/working-day assumptions are introduced.
- Slots follow template sequence, timings, type and applicable days. Inapplicable day/period cells say Not scheduled; empty teaching allocations say Flexible/free. Breaks and assemblies remain distinct and supervision names are retained.
- Daily Cover uses the effective-timetable API and its school clock, published schedule, substitutions, cancellations, holidays and existing own-view permission behavior. It never substitutes the newest draft for the published schedule.
- Only the selected section fetches effective daily cover. Section-provided plans reuse the page's existing all-plans response.
- Print/Download PDF retains the browser print-dialog Save as PDF behavior. Filtered printing mounts temporary sheets only when requested, then removes them after printing or failure. The normal workspace does not retain hidden weekly matrices.
- CSV includes configured periods, timings, activities and teachers; spreadsheet formula prefixes are escaped.
- Embedded Class Workspace passes its actual class/section/year labels into printing.

## Verification

- Frontend suite with the live timetable check enabled: 155 passed.
- Existing backend scheduling/template/deletion/publication suites: 77 passed.
- Frontend production build and backend build passed.
- Actual Kidzee current academic year 2026–2027 was tested read-only: Play School, Nursery, LKG and UKG; 9 sections; 7/8/9 configured period counts; Missing/Draft/Published states. Stored version IDs, statuses, version numbers and generated timestamps were checked unchanged afterward.
- Frontend action tests cover generation section IDs, single-draft publication, one-call atomic batch publication, destructive confirmation and selected/filtered export scope.
- Print tests cover on-demand sheet creation, afterprint cleanup, errors and empty scopes.

Manual visual/keyboard/print-dialog verification remains pending: browser inventory was empty and the native Computer Use connection was unavailable. Before release, inspect desktop/tablet/mobile layouts, full-screen focus, version drawer focus, actual print preview and Daily Cover substitutions in a connected browser.
