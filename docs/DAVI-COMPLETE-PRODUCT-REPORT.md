# DAVI complete product and workflow report

Audit date: 25 October 2026. Scope: current local repository, its frontend routes, backend modules, schema and implementation documentation. This is a product inventory, not a production certification. Existing local changes have not been committed by this audit.

## 1. Product summary

DAVI is a web-first, multi-school administration and academic operations platform. Its main connected domains are school configuration, admissions, student enrollment, people management, classroom operations, scheduling, assessment, academic planning, staff operations, parent access and school intelligence.

The current web application is substantially implemented. The mobile application is an Expo/React Native starter displaying “DAVI Mobile”; it does not yet provide equivalent workflows. AI, malware scanning, OCR and other deployment-dependent capabilities require their respective services and configuration. In-app notifications exist; external email, push and WhatsApp delivery have an adapter contract, rather than a completed delivery implementation.

## 2. Roles and access model

- Platform/Super Admin: platform-level school administration under separate role checks.
- School administrator: authorized school setup, staff, admissions, academics and operations.
- Academic coordinators and other staff: capabilities determined by permissions and academic scope, rather than job title alone.
- Teachers: assigned classes, subjects, teaching records, attendance and authorized assessment actions.
- Parents: verified school membership, linked children, consent and child-specific academic access; published information only where required.

Authentication uses JWT, school-aware login and password-change flows. APIs apply school/tenant and role/permission checks. Sensitive workflows additionally use revisions, transactions, audit records, private file access and publication checks. Exact visibility depends on assigned permissions. This inventory does not constitute an independent security audit.

## 3. Main modules and locations

| Module | Principal location | Current capabilities |
|---|---|---|
| School Command Center | /dashboard | Today and Overview, school context, setup progress, attendance completion, authorized actions, activities and quick links |
| School configuration | /school/profile, /school/settings | School identity, settings and configuration |
| Roles and access | /access/roles | Role and permission administration |
| Academic structure | /academics/academic-years, /academics/classes, /academics/groups, /academics/subjects | Years, classes, sections, groups, subjects and assignments |
| Capacity and allocation | /academics/section-capacity, /students/allocation | Capacity policies, allocation previews, approvals and enrollment placement |
| People | /people/students, /people/teachers, /people/staff, /people/parents | Directories, profiles, assignments, relationships and enrollment history |
| Admissions | /admissions/[view] | Enquiries, follow-ups, applications, configured requirements, confirmation, admission payments and documents |
| Student import | /students/import-migration | Staged import, extraction/OCR, mapping, review, matching, validation, commit and safe rollback |
| Enrollment movements | /students/unassigned, /students/transfers, /students/promotions | Unassigned students, placement, moves, swaps and next-year progression |
| Class Workspace | /academics/workspace | Class-grouped section directory and section-level daily academic operations |
| Timetables | /academics/timetables | Master-detail schedules, generation, validation, drafts, publication, history, print and exports |
| Timetable configuration | /academics/timetable-settings, /academics/period-templates | Period timings, working days, subject needs and scheduling rules |
| Assessment | /academics/assessments and Class Workspace | Assessment patterns, term entry, marks/observations, drafts, publication and report cards |
| Academic planning | /academics/academic-planner, /academics/ai-lesson-plans | Curriculum planning, sessions, reviewed lesson plans, papers, evidence and interventions |
| Calendar and communication | /academics/holidays-events, /academics/announcements | Events, holidays, announcements and classroom communication |
| Staff operations | /operations and subpages, /my-day | Attendance, policies, leave, duties, substitutions, self-service and operational reports |
| Reports and analytics | /reports/analytics | Six primary workspaces, snapshots, drill-down, attention cases, comparisons, AI drafts and export history |
| Parent learning | /parent/learning | Authorized child learning information, published academic insights and progress |

## 4. End-to-end operating model

### School onboarding

Create school -> configure profile and settings -> create academic year -> configure classes/sections/groups -> configure subjects and roles -> add staff and teaching assignments -> configure periods, attendance and assessment policies -> begin daily operations.

The dashboard reuses the existing seven-step setup checklist. Known incomplete setup remains prominent but compact. Completed configuration moves into Overview so Today can focus on operations. A permission-restricted or failed check is not automatically treated as an incomplete step.

### Admissions to active student

Enquiry -> follow-ups -> admission application -> configured field/document/payment checks -> authorized confirmation -> student and guardian links -> academic-year enrollment -> section allocation if needed.

Direct applications can bypass the enquiry stage. Pending applications are not active students. Confirmation is transactional and prevents duplicate joining. Some schools can enroll without a section and allocate later; configured policies can require placement earlier.

Admission payments support manual recording, verification/rejection, receipts and reasoned adjustments such as waivers/refunds. These are admission application payments, not a complete tuition-fee accounting system or a live payment gateway.

### Import and migration

Upload -> private storage and malware scan -> spreadsheet/PDF extraction or OCR -> map columns -> review staged rows and evidence -> resolve identity matches and conflicts -> review class/section placement -> validate -> explicitly commit -> monitor job/history -> export errors or request safe rollback.

Migration does not silently turn uncertain name matches into existing students. Existing identities, shared parent accounts and academic facts are protected during rollback. Scanner/OCR availability affects supported extraction; missing dependencies must be handled explicitly. Direct intake and migration are separate workflows; imported existing students should not be represented as new enquiries merely to fit the CRM.

### Enrollment lifecycle

Active enrollment -> allocate to section -> transfer/move/swap when authorized -> promote into next academic year -> retain previous-year enrollment and historical facts.

Capacity, current occupancy, reservations, school/year and record revisions are checked around placement. Transfers preserve historical attendance and marks context rather than moving old facts into a new class. Roll numbers can require reassignment after a move.

### Teacher and class day

Open Class Workspace -> select class/section -> review daily signals -> mark attendance -> follow timetable/effective cover -> manage homework and submissions -> maintain lesson plans -> enter assessments -> communicate and review analytics.

Section tabs include Overview, Students, Subjects & Teachers, Attendance, Timetable, Homework, Lesson Plans, Exams & Marks, AI Drafting, Events & Calendar, Communication and Analytics. Visibility remains permission-dependent.

The listing groups sections beneath each class and offers search, compact cards/table, group collapse and correct section links. Cards include teacher, student/capacity information and attendance state. Missing attendance is shown as Not marked, not absence. Missing teacher/capacity information remains explicit.

### Timetable lifecycle

Configure working days, period templates, subject requirements and teacher constraints -> generate draft -> inspect one section -> validate -> regenerate or revise draft as needed -> publish -> use published schedule for daily teaching -> manage dated substitutions separately.

A grouped navigator exposes missing, draft and published sections. The main area shows one selected section, with Weekly Timetable and Daily Cover views. Version history is in a drawer. Generation and publication reuse the existing engine. Batch publication retains atomic validation. Deletion requires confirmation.

Timings and working days come from configuration; Sunday is not assumed to be working or non-working. Breaks, assembly, free periods, teachers and timing rules remain visible. Print/PDF uses the existing print workflow; selected and filtered CSV exports are available. Daily Cover follows the published timetable even when a newer draft exists.

### Staff attendance, leave and substitution

Configured roster/shift -> self punch or authorized marking -> recorded attendance and exceptions -> correction/lock workflows -> operational reporting.

Leave request -> eligible approver decision -> balance/ledger update -> identify affected published lessons -> find available qualified cover -> approve/acknowledge substitution -> show effective teacher for that date.

Duties and availability participate in cover eligibility. Substitutions do not overwrite the permanent timetable. Missing punches and unmarked attendance are distinct from absence. The system supports teaching and non-teaching staff; an eligible non-teaching fallback is subject to existing rules.

### Assessment to parent report

Configure assessment pattern and class applicability -> choose term/section -> capture roster/configuration -> enter marks, grades or observations -> save draft -> authorized publish -> immutable published report -> parent access and permitted exports.

Patterns support marks, grades, observations, competencies and mixed structures. The current marks interface uses draft and publish actions; older review-state APIs should not be mistaken for mandatory additional visible steps. Absent, exempt, missing and developmental outcomes remain distinct. Missing marks are not zero; descriptive observations are not fabricated numeric ranks.

Corrections create new versions. Annual cards aggregate published term evidence; a separate weighted annual-term numeric policy is not implemented. Individual PDF and consolidated CSV use published records with access checks.

### Academic planning and reviewed AI

Curriculum/syllabus -> analysis -> human review -> approved calendar -> planned sessions -> progress evidence -> drafted lesson/material -> review/approval -> existing homework/exam workflows -> results and topic evidence -> interventions -> reviewed insights.

AI requires school policy, permissions, provider configuration and explicit generation. Available assessment draft actions include rubrics, question papers, worksheets, answer keys, child comments and aggregate observation insights. AI does not directly write marks or observations. Draft recommendations and text need review; parent-visible outputs follow publication/access rules. An unconfigured provider must not be presented as successful generation.

### School intelligence and follow-through

Authorized records + selected filters -> shared calculation engine -> report snapshot -> comparison/drill-down -> attention case or reviewed AI draft -> permitted export -> export history.

Current and historical enrollment are handled separately. Screens and exports should use the same selected reporting snapshot. Student Attention Center provides owner, due date, status, evidence and follow-up history, rather than only another report table.

## 5. Reports information architecture

| Previous destination | Current location |
|---|---|
| Overview | Overview |
| Class & Section | Class & Section Analytics |
| Academic Performance | Academic Performance |
| Exams & Marks | Academic Performance: exam/completeness subview |
| Subject Analysis | Academic Performance: subject subview |
| Attendance | Engagement Analytics: Attendance |
| Homework | Engagement Analytics: Homework |
| Student Attention Center | Student Attention Center case workflow |
| Teacher & Staff | School Operations: Staff |
| Admissions & Enrollment | School Operations: Admissions |
| Syllabus & Lesson Plans | School Operations: Lesson Plans |
| Student Progress / 360 | Student drill-down and Class Workspace |
| AI Insights & Comparisons | Contextual insights and utility entry |
| Export Center | Export actions and centralized export-history utility |
| Fees & Collections | Explicitly unavailable; no complete fee-ledger module |

Legacy report view URLs are retained for compatibility. The navigation contains six primary destinations, not six duplicated engines. Each page has relevant filters, tables/charts, missing-data handling, snapshot status and permission-restricted exports. Attention rules include attendance, homework and assessment signals; coverage and evidence matter before interpreting them.

## 6. Dashboard working model

Today shows active enrollment, recorded student attendance, staff presence, unmarked records, actionable authorized tasks and upcoming activity. Overview holds structural counts, configuration shortcuts and setup progress. The activity rail is compact and responsive.

The Action Center uses real records such as attendance pending, allocation, eligible leave approvals, cover, duties, submitted homework, submitted lesson plans and explicitly missing marks. Draft records are not automatically pending approvals. Failed sources are unavailable, not fabricated zero. Calendar inference requires configured school-local working-day/holiday information.

## 7. Technical architecture

- Monorepo: npm workspaces and Turbo; apps/web, apps/backend, apps/mobile and shared packages.
- Web: Next.js 14.2.15, React 18, TypeScript, existing DAVI CSS tokens and Tailwind utilities.
- API: NestJS, shared domain services and /api/v1 endpoints.
- Database: PostgreSQL through Prisma; academic-year enrollment separates student identity from yearly placement.
- Background work: durable database-backed jobs/leases for relevant import/export workflows. Redis is optional for analytics caching; its presence in architecture documents does not prove every envisioned queue exists.
- Files: authenticated/private uploads and exports with workflow-specific checks and expiry.
- Audit: actions and important revisions retain actor/reason/history where implemented.
- Notifications: in-app records and read status; external-channel adapters are future integration points.

Core data connects School -> Academic Year -> Class -> Section -> Enrollment -> attendance/homework/assessment facts. Staff and teacher assignments connect subjects, timetable entries, sessions and cover. Guardian identity and school membership connect authorized parents to children. Published versions and reporting snapshots preserve historical interpretation.

## 8. Recent UI work and verification status

The repository contains the six-page reports organization, grouped Class Workspace listing, master-detail Timetable Workspace and compact School Command Center. Shared navigation, missing-data states and reusable presentation pieces support these screens.

Earlier recorded checks include successful frontend/backend builds, 169 frontend tests, a 60-check backend dashboard/attendance/coverage/operations run, timetable/template/publication checks, and analytics integration checks. These are different recorded suite runs, not a single total of unique platform tests. This inventory did not rerun the full regression suite.

Current sample-school checks previously exercised Play School, Nursery, LKG and UKG, including nine sections and missing/draft/published schedules. Manual browser, keyboard, print and device visual acceptance remains outstanding. Do not describe the whole product as fully production-certified on these results alone.

## 9. Known gaps and priorities

1. Reconcile attendance calculations: the individual-student analytics percentage currently includes missing eligible days in its denominator, while grouped comparisons subtract missing days. These views can disagree; review the intended policy and add a focused regression before relying on cross-view comparisons.
2. Finish visual and interaction acceptance on desktop, tablet and mobile, including keyboard navigation, drawers, exports and print.
3. Deploy and verify required migrations, private storage, workers, fonts and configured scanner/OCR/AI services in each target environment.
4. Mobile remains a starter application. External email/push/WhatsApp delivery and live payment gateway integration are not complete.
5. A complete tuition fee ledger, payroll, library, transport, hostel and inventory system are not present as complete modules in the inspected code. Admission payment support must not be advertised as those broader capabilities.
6. Annual weighted-term numeric assessment policy and some specialized reporting measures remain unavailable; missing data must stay explicit.
7. Older documentation includes roadmap features and earlier navigation/workflows. Use current code and current module documentation when preparing training or release notes.
8. Many local modifications and new files are currently uncommitted. Implementation present locally does not establish that it has been reviewed, released or deployed.

## 10. Practical daily workflow

Administrator: open Today -> resolve authorized action rows -> check attendance completion and cover -> review upcoming activities -> drill into the relevant class or operations page -> compare reports -> export a selected snapshot if permitted.

Teacher: open My Day/Class Workspace -> record attendance -> follow timetable and effective cover -> manage homework and lessons -> save/publish assessments with required permission -> review student evidence and support follow-ups.

Admissions staff: manage enquiry/application -> verify requirements -> confirm enrollment -> allocate section -> hand over the active student to Class Workspace.

Parent: sign in through the school -> access authorized linked child -> view published learning/progress information and permitted downloads.

Year-end administrator: verify current-year evidence -> prepare next-year configuration -> promote enrollments -> allocate sections -> preserve historical records and published reports.
