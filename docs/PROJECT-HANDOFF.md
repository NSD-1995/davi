# DAVI project handoff

Prepared: 5 October 2026. Source: inspection of the current local workspace, including uncommitted files.

This is an implementation inventory and development handoff, not a production certification. The application, database migrations, builds, tests and live AI calls were not executed for this review. “Present” means code exists; it does not mean the entire user journey has been validated.

## 1. Product and present stage

DAVI means Dynamic AI for Visionary Institutions. The product vision is an AI-assisted school operating system for administrators, teachers, academic coordinators and parents, with a DAVI super administrator managing schools.

The current implementation is a substantial school-administration and classroom-management MVP. Its strongest journey is school onboarding, academic setup, enrollment and daily classroom operations. It includes text-based AI lesson generation. Parent-facing APIs exist, while the dedicated parent client and mobile application remain incomplete.

## 2. Main user journey

1. Super admin creates a school and its administrator account.
2. School admin receives initial credentials and a school-specific login URL.
3. School admin logs in and changes the initial password.
4. Admin configures the school, academic year, classes, sections and subjects.
5. Admin creates staff/teacher accounts, assigns roles and allocates teaching responsibilities.
6. Students are admitted, linked to parents and enrolled in the relevant year/class/section.
7. Users open the section workspace for attendance, timetable, homework, lessons, exam results, calendar, announcements and analysis.
8. Authorized school admins/teachers can review syllabi and generate AI lesson drafts.
9. Parent APIs expose linked children, enrollment dashboards and attendance; a complete parent-facing client is still needed.

## 3. Features present

| Area | Existing implementation | Practical limit |
|---|---|---|
| Platform administration | School creation, school search/list, administrator provisioning, initial credentials and login URL, basic counts | Subscription and advanced platform operations are not established by this review |
| Authentication | Login, registration API, current-user API, JWT guard, password change and first-login enforcement | Full recovery/session lifecycle has not been verified |
| Authorization | Roles, permissions, guarded endpoints, permission-filtered navigation, school-scoped service checks | Requires end-to-end tenant and role testing; guards alone do not establish complete isolation |
| School configuration | School profile and settings UI/API | Full settings behavior not exercised |
| Academic structure | Years, classes, sections, subjects, year/class subject mappings | Migration and year-transition behavior not exercised |
| People | Student, parent, staff and teacher records; list pages; student/parent/teacher detail pages | Dedicated parent/student experience remains incomplete |
| Admissions | Admission endpoint, student identity, parent links and enrollment records | Validate full admission-to-roster flow with real local data |
| Teaching | Class teachers, subject allocation and academic teaching assignments | Verify each teacher sees and edits only authorized classes |
| Attendance | Student register UI, student and staff attendance APIs, summaries | Staff-specific attendance UI not established |
| Timetable | Period templates, requirements, planner, generation, saved plans and publish endpoint | Algorithmic scheduling, not generative AI; constraint behavior needs runtime validation |
| Homework | Create/list UI, update API, submission records initialized for active enrollments | Complete student submission and teacher review UI not established |
| Classroom lesson plans | Create/list UI, schedule, objectives, syllabus unit, coverage and status/approval update API | Separate from AI-generation records |
| Exams and marks | Exam/subject creation APIs, marks entry API, results API, classroom results viewer | Full exam creation and grading UI not established |
| Calendar | Aggregated events, exams, homework deadlines and lessons | Complete event editing UI not established |
| Communication | Create/list class announcements, publish/status backend operations | External delivery not established |
| Reports | Student attendance percentages, average marks, student/staff reporting APIs | Basic computed reporting; not AI prediction |
| Audit | Audit module, interceptor and records | Completeness of audit coverage not verified |
| Notifications | Create/list records, read and sent-state updates | Marking sent does not itself deliver email/SMS/push |
| Syllabus | Upload, text extraction, review/edit, approval, versions and duplicate detection | Text parser, not AI extraction; extraction needs human review |
| AI lesson generation | Provider call, validation, academic authorization, saved output and usage metadata, generation UI | Requires configured provider and credits; no live call tested |

## 4. Web navigation and classroom workspace

The school sidebar includes Dashboard; School Profile; Settings; Academic Years; Classes & Sections; Class Workspace; Subjects; Syllabus & AI Plans; Period Templates; Roles & Permissions; Staff; Teachers; Students; Parents.

Super admins instead see platform school administration. The main school shell is an administration interface, even though permissions and teacher assignments support teacher access.

Every section workspace contains these tabs:

| Tab | Current behavior |
|---|---|
| Overview | Student count, present/absent totals, attendance percentage, missing-attendance alerts, class teacher and upcoming activities |
| Students | Roster, admission and roll numbers, parent/contact details |
| Subjects & Teachers | Subject and teacher allocation component |
| Attendance | Student attendance register |
| Timetable | Timetable planner |
| Homework | Create and list subject homework, descriptions and due dates |
| Lesson Plans | Create and list scheduled classroom plans, objectives and coverage |
| Exams & Marks | Select exams and display results |
| Events & Calendar | Combined activities and deadlines |
| Communication | Create/list announcements |
| Reports & Analysis | Per-student attendance, average marks and status |
| Class Settings | Section name, room, capacity, status and teaching assignments |

## 5. AI: exact current scope

The implemented AI feature is text-based lesson-plan generation. There is no established voice, image, video, chatbot, automatic grading, predictive analytics or personalized-learning implementation in the reviewed code.

### Input and output

Inputs: school, academic year, class, subject, topic, duration in minutes and language; optionally an approved syllabus-topic reference.

Outputs: objectives, materials, introduction, teaching steps, activities, assessment, homework, differentiation and safety notes.

### Implementation

- `apps/backend/src/ai/ai-provider.service.ts` calls the OpenAI Chat Completions endpoint.
- Model comes from `OPENAI_MODEL`; the code default is `gpt-5.6-luna`. This is an inventory of the code, not a model recommendation.
- Provider credentials come from `OPENAI_API_KEY`.
- The request asks for a JSON object and validates the returned lesson-plan structure.
- The implementation uses a 20-second timeout per attempt and up to two attempts for selected failures.
- Academic scope checks validate the school, year, active class/subject and class-subject relationship. School admins are allowed; other users must satisfy active teacher-assignment checks, in addition to endpoint permissions.
- A supplied syllabus topic must match an approved syllabus and the requested topic.
- Results are saved as `AiGeneration` drafts, including input/output, model, prompt version and token counts.
- The UI displays the latest generated result. A complete saved-generation library/history interface was not established.
- The provider receives class/subject names, topic, duration and language. It does not receive the entire uploaded syllabus in the inspected request.
- Free-text topics are supported; choosing an approved syllabus topic is optional.

### Syllabus workflow

Select year/class/subject/term; upload TXT, PDF or DOCX (up to 10 MB); extract text; review/edit lessons/topics; approve; use topics for generation. Replacement uploads are versioned and duplicate files are detected with a hash. Files are stored under `PRIVATE_UPLOAD_DIR` or the backend process's `private-uploads` directory.

Extraction uses `pdf-parse`, `mammoth` and line/heading parsing. It is not an AI extraction pipeline and no OCR was found in this path.

### Important integration gap

`AiGeneration` and classroom `LessonPlan` are separate records. The reviewed flow does not establish conversion of a generated draft into a scheduled classroom plan. Implement an explicit review/edit/save-to-classroom operation with traceability to the generation.

## 6. Architecture and repository map

```text
apps/
  web/        Next.js 14 / React / TypeScript admin client
  backend/    NestJS / TypeScript REST API and Prisma
  mobile/     Expo / React Native starter
packages/
  api-client/ Shared client scaffold; health response is currently hardcoded
  types/      Shared package
  constants/  Shared package
  config/     Shared package
  utils/      Shared package
docs/         Vision, PRD, architecture, database, roadmap and user-flow documents
.github/      CI workflow
docker-compose.yml  Local PostgreSQL and Redis services
turbo.json    Monorepo build/lint task configuration
```

Web requests use `apps/web/lib/api.ts`, plus direct requests in the AI/syllabus page. The default API URL is `http://localhost:3001/api/v1`. NestJS applies the `api/v1` prefix and listens on port 3001. Next.js development convention is port 3000.

Prisma connects the backend to PostgreSQL. Docker Compose provisions PostgreSQL 16 and Redis 7, not the complete web/backend application. Active Redis caching or worker integration was not established.

The web session is persisted in browser local storage. Backend guards verify JWTs and reload the user. The reviewed JWT configuration uses seven-day expiry and a fallback secret if `JWT_SECRET` is absent.

## 7. Data model

The schema is at `apps/backend/prisma/schema.prisma`. Main model groups:

| Domain | Models |
|---|---|
| School and identity | School, User, SchoolSetting, SchoolProfileOption, UserSchoolProfileOption |
| Access | Role, Permission, RolePermission, UserRole |
| Academic structure | AcademicYear, SchoolClass, Section, Subject, AcademicYearSubject, ClassSubject |
| People | Staff, Teacher, Student, Parent, ParentSchoolMembership, StudentParent |
| Enrollment/teaching | StudentEnrollment, TeacherAcademicAssignment |
| Attendance | StudentAttendance, StaffAttendance |
| Scheduling | TimePeriod, TimetableEntry, SubjectTimetableRequirement, TeacherAvailability, TimetablePlan, TimetableSubstitution |
| Period configuration | PeriodTimingTemplate, PeriodTimingSlot, PeriodTemplateAssignment |
| Teaching content | Homework, HomeworkSubmission, LessonPlan, AiGeneration |
| Syllabus | SchoolTerm, Syllabus, SyllabusLesson, SyllabusTopic |
| Assessment | Exam, ExamSubject, StudentMark |
| Communication/operations | ClassAnnouncement, SchoolEvent, Notification, AuditLog |

Preserve the separation between student identity and annual enrollment. Preserve school/year/class/section scope when extending classroom features. Parent identity, school membership and student relationships are separate concepts.

## 8. API orientation

All paths below are relative to `/api/v1`; this is a useful subset, not a complete API specification.

| Area | Representative endpoints |
|---|---|
| Authentication | POST /auth/login, POST /auth/register, GET /auth/me, POST /auth/change-password |
| Admissions | POST /student-admissions |
| Attendance | GET/POST /attendance/students, GET/POST /attendance/staff |
| Classroom | /academic-years/:yearId/classes/:classId/sections/:sectionId, followed by homework, lesson-plans, announcements, calendar, analysis or settings |
| Scheduling | GET/PUT /timetable-planning/requirements, POST /timetable-planning/generate, GET /timetable-planning/plans, POST /timetable-planning/plans/:id/publish |
| AI | POST /ai/lesson-plans/generate |
| Syllabus | GET/POST /syllabi/terms, POST /syllabi/upload, GET /syllabi, GET /syllabi/topics, GET /syllabi/:id, PATCH /syllabi/:id/review, POST /syllabi/:id/approve, DELETE /syllabi/:id |
| Exams | GET/POST /exams, POST /exams/:id/subjects, POST /exams/subjects/:examSubjectId/marks, GET /exams/:id/results |
| Parents | GET /parent/me/children, GET /parent/enrollments/:enrollmentId/dashboard, GET /parent/enrollments/:enrollmentId/attendance |

Also inspect `apps/backend/postman-school-api.json` and `apps/backend/POSTMAN-TESTING.md`. Their completeness against recent changes is not verified.

## 9. Local setup and commands

These are existing commands or a suggested setup sequence, not commands executed during this handoff. Use a disposable development database for migration and seed validation. Do not overwrite an existing environment file or reset an existing database.

1. Install dependencies from the repository root with `npm install`. CI currently uses Node 20; verify local compatibility, particularly for the mobile dependency set.
2. Start the local database services with `npm run docker:up`.
3. If absent, create `apps/backend/.env` from `.env.example`, then configure environment values.
4. Generate Prisma Client with `npm --workspace apps/backend run prisma:generate`.
5. Inspect migration status from `apps/backend` with `npx prisma migrate status`. Apply the committed migration history to the intended development database only after checking its state. The existing `prisma:migrate` script invokes `prisma migrate dev` and can prompt about drift/reset.
6. Review the seed scripts and bootstrap/account requirements before running a seed. Do not assume the default seed provisions a usable super-admin account.
7. Start backend and web in separate terminals with `npm run dev:backend` and `npm run dev:web`.

| Configuration | Purpose |
|---|---|
| DATABASE_URL | PostgreSQL connection |
| JWT_SECRET | Signing secret; code currently has a fallback |
| CORS_ORIGINS | Comma-separated allowed frontend origins |
| OPENAI_API_KEY | AI-provider authentication |
| OPENAI_MODEL | Override the code's default AI model |
| PRIVATE_UPLOAD_DIR | Persistent private syllabus-file location |
| NEXT_PUBLIC_API_URL | Web API URL; configure in the web environment |
| DEVELOPMENT_DEFAULT_PASSWORD | Local-only account creation behavior |

The backend `.env.example` includes OPENAI_API_KEY and OPENAI_MODEL; it does not document all of the other variables above. Explicit startup loading of all backend environment variables was not established: ensure they are present in the process environment before boot. One built-backend option on a compatible Node version, from `apps/backend`, is `node --env-file=.env dist/main.js`; first build and verify the output path. Do not assume Prisma's CLI environment loading covers NestJS configuration.

Useful existing commands:

```text
npm run dev:web
npm run dev:backend
npm run dev:mobile
npm run docker:up
npm run docker:down
npm run build
npm --workspace apps/backend test
npm --workspace apps/backend run prisma:generate
npm --workspace apps/backend run prisma:studio
```

The root lint command delegates to workspace lint tasks; complete lint coverage was not established. The mobile package has a start script but no build script, so a root build is not mobile release validation.

## 10. Verification already available

Eight backend test files exist:

- academic-operations.test.js
- role-permission-staff.test.js
- subject-management.test.js
- school-parent-workflow.test.js
- play-school-workflow.test.js
- period-templates.test.js
- timetable-planning.test.js
- ai-syllabus.test.js

The backend test script builds and then runs Node's test runner against `test/*.test.js`. Inspected AI tests use service doubles and schema checks; their existence is not evidence of a live database/provider test.

GitHub CI currently installs dependencies and runs the monorepo build. It does not explicitly run the backend test command. No successful build/test/runtime result is asserted by this document.

## 11. Concrete issues to investigate before expanding scope

These are code-review observations, not reproduced runtime failures.

1. **Class workspace permissions:** the section page fetches many feature endpoints together with `Promise.all`, including reports, exams, communication and settings. A user missing one permission may fail the whole workspace load. Fetch permitted tabs independently and provide per-tab error states.
2. **Homework submission ownership:** `updateHomework` checks the requested homework's classroom scope, but the subsequent submission update uses the supplied submission ID without visibly tying it to that homework/enrollment/school. Add relational ownership validation and a regression test before exposing submission editing broadly.
3. **Classroom payload validation:** several classroom endpoints accept `any`; strengthen DTO/schema validation and validate subject membership in the selected class/year before creating content.
4. **Environment configuration:** document missing AI/JWT/upload variables and make backend startup loading explicit. Production startup should not silently accept the development JWT fallback.
5. **AI-to-classroom handoff:** provide a reviewed conversion from AiGeneration to LessonPlan instead of leaving the generated draft separate from the operational schedule.
6. **Session lifecycle:** document current local-storage JWT handling and decide the production session/recovery strategy before public release.
7. **Reporting semantics:** current classroom average marks are an arithmetic mean of raw marks, not a normalized percentage across different maximum marks. Agree on the intended interpretation and label it accurately.
8. **Documentation and change preservation:** the README/roadmap lag the implementation. Many recent files are untracked or modified; include them deliberately when creating a reviewed checkpoint, without overwriting local work.

## 12. Recommended development sequence

### Phase A: establish a reliable baseline

- Preserve and review local changes, including migrations and recent AI/classroom files.
- Verify dependency installation, Prisma generation, migration history on a disposable database, backend tests and web/backend builds.
- Make environment loading and first-super-admin provisioning repeatable.
- Fix scoped homework submission updates and permission-dependent workspace loading.
- Add backend tests to CI; document actual verification results.

Completion criterion: a fresh development setup can create a school, log in, configure a year/class/section, admit a student and mark attendance; restricted users cannot access unrelated records.

### Phase B: complete the daily classroom loop

- Complete homework submission/review controls and status transitions.
- Add missing exam setup/marks-entry UI using existing APIs.
- Finish lesson-plan review/approval interactions.
- Connect reviewed AI output to scheduled classroom plans; add saved draft/history access.
- Exercise timetable requirements, generation, conflict reporting and publishing with representative data.

Completion criterion: an authorized teacher can complete a normal classroom day without manual database or API operations.

### Phase C: deliver the parent experience

- Build a parent web experience around existing linked-child and attendance endpoints.
- Extend scoped parent access for published homework and announcements where required.
- Choose a notification delivery channel, then implement delivery, retries and observable status.
- Verify parent access across linked children and schools.

Completion criterion: a parent can log in, select a linked child and see relevant published information without seeing another family's records.

### Phase D: pilot and mobile

- Use a small school pilot to validate workflow fit and data accuracy.
- Configure hosting, migration deployment, private file persistence, backup/restore and operational logs.
- Implement the agreed teacher/parent mobile journeys in the existing scaffold after checking dependency compatibility.

Completion criterion: a documented release can be deployed, monitored and restored, and the selected mobile journeys work against the same API.

### Optional later text-AI extensions

These are proposed features, not existing implementation: AI homework/question drafts, syllabus summaries, teacher-approved parent-message drafts and grounded help over approved school content. Prioritize completing the current lesson workflow before adding multiple AI surfaces.

## 13. Suggested pilot acceptance checks

1. Super admin creates a school; the new admin changes the initial password and enters the correct school workspace.
2. Admin creates an academic year, class, section, subjects and teaching assignments.
3. Admission produces the expected student, parent relationship and enrollment without duplicate identities.
4. Teacher views the assigned class and records attendance; unauthorized class operations are denied.
5. Homework creates submission records for the intended active enrollments; unrelated submission IDs cannot be updated.
6. Timetable generation reports unmet requirements and publishing produces the intended schedule.
7. A syllabus upload can be reviewed and approved; a valid AI draft can be generated and invalid academic scope is rejected.
8. Parent endpoints return only linked children and authorized enrollment information.
9. One unavailable or forbidden workspace tab does not block unrelated authorized tabs.
10. An existing-database upgrade and backup restoration are rehearsed before a real school depends on the service.

## 14. Context to give the next developer or AI session

> Continue DAVI in this existing npm/Turborepo repository. Read docs/PROJECT-HANDOFF.md and inspect current local changes before editing. The web app is Next.js, the API is NestJS, and PostgreSQL uses Prisma. School onboarding, academic structure, people/admissions, class workspaces, attendance, timetable, homework, lesson plans, exam results, announcements, basic reporting, syllabus review and text AI lesson generation already have implementations. Do not recreate them. Mobile is a scaffold and parent access currently has backend endpoints without a complete dedicated client. Start by establishing build/test/migration results, fixing classroom permission loading and scoped homework-submission updates, and making setup repeatable. Preserve student identity versus enrollment and school/year/class/section boundaries. AI generation records are separate from classroom lesson plans; connect them through an explicit reviewed workflow. Report verified behavior separately from code presence.

## 15. Starting files

- `apps/web/components/app-shell.tsx`: navigation.
- `apps/web/components/platform-dashboard.tsx`: school onboarding.
- `apps/web/app/(admin)/academics/workspace/[classId]/sections/[sectionId]/page.tsx`: classroom tabs and loading.
- `apps/web/app/(admin)/academics/ai-lesson-plans/page.tsx`: syllabus/AI UI.
- `apps/web/lib/api.ts`: frontend API helpers.
- `apps/web/lib/auth-context.tsx`: session behavior.
- `apps/backend/src/app.module.ts`: registered backend features.
- `apps/backend/src/classroom-management/`: homework, lessons, announcements and class analysis.
- `apps/backend/src/ai/`: generation and academic authorization.
- `apps/backend/src/syllabus/`: document ingestion and review.
- `apps/backend/src/timetable/`: timetable operations and planning.
- `apps/backend/src/parents/`: parent relationships and portal APIs.
- `apps/backend/prisma/schema.prisma`: current data model.
- `apps/backend/test/`: existing regression checks.
- `apps/backend/package.json`: backend commands.
- `.github/workflows/ci.yml`: current automation.
