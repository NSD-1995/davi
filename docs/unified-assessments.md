# Unified assessments and progress cards

Configure patterns in **Academic Setup → Assessment Setup**. This page contains
patterns, **Apply to classes** and school AI settings; there is no separate
assessment preparation or subject scheduling step.
Teachers open **Class Workspace → Exams & Marks**, choose a configured term from
the ascending term list and select **Edit marks** or **Edit observations**. Opening
a term reuses its existing assessment or starts a draft once for that section.
Listing terms is read-only and does not create assessments.
The unified flow extends `Exam`, `ExamSubject` and `StudentMark`. Legacy exam APIs cannot modify a versioned unified assessment. The Class Workspace
no longer displays the separate Earlier exam records panel.

## Configure and assess

1. Configure a pattern and select one or more classes under **Apply to classes**.
   Each selected class receives its own immutable configuration version, saved
   together in one transaction. Default scope is not required. Class selections
   must belong to the current school and academic year. Earlier school/group
   defaults remain readable for compatibility; class configurations take priority.
2. Choose OBSERVATION, COMPETENCY, GRADE, MARKS or MIXED. Configure custom terms,
   component maxima/weights, grade boundaries, optional pass percentage and
   subject-specific component overrides. Presets include 20+80, 25+75 and 40+60.
3. For developmental assessment, configure domains, competencies, outcomes,
   materials/activities and rating labels. Schools choose the assessment type for
   every class, including marks-based or mixed assessment for UKG/Montessori.
   Observation/competency patterns remain descriptive, without numeric marks,
   percentages, pass/fail or ranks.
4. Open a configured term in Class Workspace. Its assessment is reused or started
   without another name, pattern or scheduling form. Configuration, student
   identity and class/section/year labels are captured with its roster. Later
   configuration changes, transfers and promotions do not rewrite saved results.
5. Enter subject marks in an Excel-style sheet: students are rows, subjects form
   grouped column headers, and each subject shows only its grade or marks
   components. State and Remarks columns are omitted from the sheet. Tab, Enter and arrow keys move between cells; rectangular Excel paste
   is supported. Save marks sheet validates and saves all changed subjects in one
   transaction. Class teachers can edit all subjects for their assigned class and
   section; subject teachers can edit only their assigned subjects there. Bulk class observations
   remain descriptive. Multiple dated observations
   per competency are preserved. Evidence is an optional text/document reference;
   this module does not create a separate public evidence-file store.
6. Click **Save as draft** to retain entered values. The Class Workspace no longer
   displays CSV/Excel import or separate review/approval controls. Draft saves can retain
   incomplete component scores or a cleared grade, without turning missing values
   into zero or calculating a percentage from incomplete evidence.

PRESENT, ABSENT and EXEMPT are explicit marks states. Absent/exempt records have no
scores, percentage or pass/fail result. Missing marks block submission rather than
becoming zero. Grade-only records retain the selected grade without a percentage.
Weighted percentages are the sum of `component score / maximum × weight`;
grade and pass boundaries use the unrounded result, with display rounded to two
decimals. Developmental ratings are never converted to numeric scores.

## Draft saves and change history

The current Class Workspace flow is **Choose term → Edit → Save as draft**.
Saving retains a draft. Authorized staff use **Publish** once entries are final;
publication validates completeness, locks results and creates report snapshots.
Selecting a configured term opens or reuses its assessment. Edit and Publish
are beside the term buttons; there is no Add new button.
Terms appear in ascending order with Annual last; the earlier-assessment dropdown
has been removed. Change history shows the
teacher's name, timestamp and a summary of affected students and subjects, with
one entry per save. A shared save identifier groups changes across subjects.
Detailed previous/new values remain in the underlying audit records.
Names are captured at save time and also resolved through the audit actor record.
Changes across subjects save transactionally with revision checks.

Earlier submitted, approved or published assessments and their report snapshots
remain protected. The existing backend review/publication APIs are retained for
compatibility; separate review/approval controls are not displayed in the marks-entry screen.
Publish supports complete drafts directly, using the existing publication permission.

Published report snapshots and pattern versions are immutable, including at the
database level. Corrections create new report versions; previously published
versions remain available. Every marks save records before/after data and an actor
in the audit log. Observation additions, scheduling and decisions are audited.
Writes use serializable transactions and revision comparisons. Only complete
results can pass the retained publication validation.

An annual term is an aggregation of published term cards, preserving each term's
actual observations and results. Every configured non-annual term must be
published for each child first. Annual cards do not invent missing evidence,
average developmental ratings or rank children.

## Reports and parents

Authorized staff can download individual PDF cards and a consolidated CSV of the
latest published versions. Parents use **Your child's learning → Published
progress cards**. An active parent link with academic access and a verified active
membership in the child's school is required. Report access is checked again for
PDF downloads. Draft assessments are not exposed through these parent APIs.

PDFs include school name/address, captured student/year/class identity,
subject results or competency histories, teacher remarks, approval date and
revision. School logos, student avatars and optional principal signature images
are embedded when supplied as bounded PNG/JPEG data URLs. Arbitrary remote image
URLs are not fetched by the export server. Configure `ASSESSMENT_PDF_FONT` with
a deployment-owned font supporting the school's scripts when using non-Latin
names. Principal name/signature can be saved in the pattern's branding settings.

## Permissions and isolation

The module reuses EXAM_CREATE, EXAM_UPDATE, MARKS_VIEW, MARKS_UPDATE and REPORT_VIEW.
New permissions are ASSESSMENT_CONFIGURE, ASSESSMENT_REVIEW, ASSESSMENT_APPROVE,
ASSESSMENT_PUBLISH and ASSESSMENT_CORRECT. School admins have access; grant
review/approval permissions to the school's authorized reviewer/principal roles.
Refresh sessions after adding permissions.

Assignment checks use active teacher profiles, staff membership and the exact
school/year/class/section. Class teachers can update all subjects in their assigned
class/section; other teachers require the corresponding active subject assignment.
Approval permission alone does not grant subject-editing access. General developmental observations and class-level decisions
require a class teacher, school admin or authorized assessment approver. Composite
foreign keys bind observations/reports to the same school/year as their assessment
and enrollment. Lists are bounded. Student grids show the entire roster in one scrollable sheet,
without student pagination; dated observation history remains paginated.

## AI drafting in Class Workspace

AI drafting is a separate **AI Drafting** tab in Class Workspace, outside Exams & Marks.
Select an existing assessment to provide context for question papers, worksheets,
answer keys and other drafts. Opening this tab does not create an assessment.

No dashboard or assessment load triggers generation. AI starts disabled. A school
admin can enable it, set a monthly token budget, school requests-per-minute limit
and separate writing/reasoning model routes. It uses the existing provider and
AiGeneration records. Short PostgreSQL advisory locks coordinate cached responses,
rate limits and conservative token reservations across application instances.
Unknown-cost failures retain their reservation; paid generation is not retried
automatically by this assessment feature.

Available explicit draft actions are rubric, question paper, worksheet, answer
key, child comment and aggregated observation insights. The request confirms
teacher review of the source observations. Comments require recorded evidence
and valid evidence references; insight prompts contain aggregate counts.
Generated outputs cannot write scores or observations. Teachers edit and explicitly
approve draft text. Reviewed child comments enter published cards only if the
observation evidence is unchanged. Rubrics and teaching materials remain reviewed
drafts for educators to use; they do not automatically overwrite configuration.

## Deployment and checks

Three additive migrations were applied to the local database:

- `20261022090000_unified_assessment`
- `20261022100000_assessment_class_names`
- `20261022110000_assessment_ai_policy`

For another environment, deploy migrations, regenerate Prisma Client, install
dependencies (PDFKit is added), build and restart the backend/web applications.
Do not run the optional AI tests against a paid provider: the integration suite
injects a deterministic provider stub.

```powershell
node --env-file=apps/backend/.env node_modules/prisma/build/index.js migrate deploy --schema apps/backend/prisma/schema.prisma
node --env-file=apps/backend/.env node_modules/prisma/build/index.js generate --schema apps/backend/prisma/schema.prisma
npm.cmd run build --workspace apps/backend
$env:ASSESSMENT_DB_TEST='1'
node --env-file=apps/backend/.env --test apps/backend/test/assessment*.test.js
node --test apps/web/test/assessment*.test.js
```

The PostgreSQL integration fixture rolls back all test data. It covers marks and
observations, absent students, term/annual publication, parent isolation, exact
teacher/subject authorization, promotions, section transfers, stale revisions,
corrections, immutable snapshots, HTTP/JWT routes and budgeted/cached AI drafts.
PDFs are parsed in tests and synthetic multi-page cards were visually inspected.
No live paid AI call or large-school load benchmark is claimed. Browser acceptance
remains a deployment check: no browser was exposed by this session's UI tooling.
