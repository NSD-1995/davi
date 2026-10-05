# DAVI Figma Handoff: User Flows and Business Requirements

## 1. Document Purpose

This document is the source of truth for designing DAVI screens in Figma. It defines the product context, users, navigation, primary user flows, business rules, screen requirements, system states, and expected Figma deliverables.

Designers should preserve the workflows and rules in this document while improving usability, visual hierarchy, accessibility, responsiveness, and consistency.

## 2. Product Overview

**Product:** DAVI — Dynamic AI for Visionary Institutions  
**Category:** Multi-school administration and classroom-management platform  
**Primary objective:** Give schools one place to manage people, academics, attendance, teaching, timetables, examinations, communication, and reporting.

The product has two operational levels:

1. **Platform level:** DAVI Super Administrators manage schools across the platform.
2. **School level:** School users manage only the data and operations belonging to their school.

## 3. User Types

### 3.1 DAVI Super Administrator

Responsible for platform-wide school administration.

Key needs:

- View all schools and platform summary information.
- Create and manage schools.
- Activate or deactivate a school.
- Open school-level details without becoming a member of that school.
- Never see one school's data mixed with another school's data.

### 3.2 School Administrator

Responsible for school setup and day-to-day administration.

Key needs:

- Configure school profile and settings.
- Create academic years, subjects, classes, and sections.
- Manage roles and permissions.
- Create and manage staff, teachers, students, and parents.
- Assign class teachers and subject teachers.
- Configure periods and generate timetables.
- Monitor attendance and school operations.

### 3.3 Academic Coordinator

Responsible for academic configuration and oversight, subject to assigned permissions.

Key needs:

- Manage classes, sections, subjects, teacher allocations, period templates, timetables, examinations, and reports.
- Review lesson plans and classroom performance.
- Identify missing assignments and scheduling conflicts.

### 3.4 Teacher

Responsible for assigned classes and subjects.

Key needs:

- View only assigned classes, sections, and subjects.
- Open a class workspace when permitted.
- Mark daily attendance.
- Create homework, lesson plans, and announcements.
- View timetables, examinations, marks, events, and class insights.

### 3.5 Parent or Guardian

Responsible for monitoring linked children.

Key needs:

- View linked children across valid school relationships.
- Select a child or enrollment.
- View attendance, academic context, and relevant updates.
- Never access an unlinked child.

### 3.6 Staff Member

A school employee with a user account and assigned role. A staff member may also have a teacher profile. Available features depend on permissions.

## 4. Global Navigation and Information Architecture

### School portal

- Dashboard
- School
  - School Profile
  - Settings
- Academics
  - Academic Years
  - Classes & Sections
  - Class Workspace
  - Subjects
  - Period Templates
- Access Management
  - Roles & Permissions
  - Staff
  - Teachers
- People
  - Students
  - Parents

### Platform portal

- Schools dashboard
- School creation and management

### Global interface elements

- DAVI branding and current portal type.
- Permission-aware side navigation.
- Current school identity.
- Current academic-year selector for school users.
- Signed-in user's name, role, and avatar.
- Logout action.
- Responsive navigation drawer on smaller screens.
- Toast or inline feedback for success and failure.

## 5. Global Business Requirements

### BR-G01 — Tenant isolation

All school data must be scoped to the signed-in user's school. A school user must never view or modify another school's records.

### BR-G02 — Permission-based access

Navigation, actions, and data access are controlled by permissions. Hidden buttons alone are not sufficient; the interface must also provide a clear permission-denied state when a protected route is opened directly.

### BR-G03 — Academic-year context

Academic screens must clearly show the selected academic year. Data for different academic years must not be visually mixed. If no year is selected, the interface must ask the user to select one before showing year-dependent actions.

### BR-G04 — Record status

Status must be visible using text and color. Color must not be the only status indicator.

### BR-G05 — Inactive people

- Inactive staff, users, or teachers must not appear in assignment selectors.
- Inactive staff must not be offered when creating a teacher profile.
- Existing historical records may still display the person's name with an Inactive label where audit context is necessary.
- Deactivation must not silently delete historical data.

### BR-G06 — Validation and feedback

- Required fields must be marked.
- Field-level validation should appear close to the affected input.
- Form-level or server errors should appear in a visible alert or toast.
- Successful writes should show confirmation.
- Save actions must show a progress state and prevent duplicate submission.
- Unsaved changes should be evident and protected when leaving a complex form.

### BR-G07 — Destructive and consequential actions

Deactivation, removal, publishing, and replacement actions require clear confirmation when they affect other records. The confirmation should explain the result rather than use generic wording.

### BR-G08 — Standard page states

Every data-driven screen must include designs for:

- Initial loading
- Empty data
- No search results
- Success
- Validation error
- Server or network error with retry
- Permission denied
- Disabled or unavailable action
- Responsive/mobile layout

### BR-G09 — Accessibility

- Target WCAG 2.1 AA contrast.
- All controls require visible labels.
- Keyboard focus states must be designed.
- Modal focus and dismissal behavior must be clear.
- Tables need a usable small-screen alternative or horizontal overflow treatment.
- Touch targets should be at least 44 × 44 px where practical.

## 6. Core User Flows

## UF-01 — Sign In and Enter the Correct Portal

**Actors:** All users

**Preconditions:** User has an active account and valid credentials.

**Happy path:**

1. User opens the DAVI login page or school-specific login page.
2. User enters mobile/username or email and password.
3. System validates credentials and account status.
4. If a temporary password is in use, the user is sent to Change Password.
5. System resolves the user's role, permissions, and school context.
6. Super Administrator lands on the platform dashboard.
7. School Administrator lands on the school dashboard.
8. Teacher lands on the teacher dashboard.
9. Parent lands on the parent experience.

**Exception states:** Invalid credentials, inactive account, inactive school, required password change, unavailable service.

**Required screens:** Login, change password, role-appropriate dashboard, forbidden page.

## UF-02 — Select an Academic Year

**Actors:** School Administrator, Academic Coordinator, Teacher

1. User opens an academic module.
2. User selects an academic year from the global selector.
3. The application refreshes year-dependent data.
4. Current selection remains visible while navigating academic screens.
5. If the selected year is inactive or unavailable, the user is prompted to choose another year.

**Business rules:** Only years belonging to the school are available. Current year should be the default where possible.

## UF-03 — Set Up an Academic Year

**Actors:** School Administrator

1. Open Academic Years.
2. Review existing years and statuses.
3. Choose Create Academic Year.
4. Enter name, dates, current-year status, and other required values.
5. Save and receive confirmation.
6. Add active subjects to the academic year.
7. Remove an academic-year subject only when business dependencies allow it.

**Key states:** No academic years, current year, inactive year, duplicate name, invalid date range, subject already assigned, referenced subject cannot be removed.

## UF-04 — Configure Subjects, Classes, and Sections

**Actors:** School Administrator, Academic Coordinator

1. Create or select an academic year.
2. Create subjects in the school's subject catalogue.
3. Create a class and its sections.
4. Open the class's subject configuration.
5. Select active subjects available for that academic year.
6. Save the complete subject set.
7. Open the Class Workspace list to confirm class and section readiness.

**Business rules:**

- Subject codes and names must be unique within a school where required.
- A section belongs to one class.
- A class belongs to the selected academic-year context.
- Only active subjects may be newly assigned.
- Removing a referenced subject must be blocked or require dependency resolution.

## UF-05 — Create Staff and Teacher Profiles

**Actors:** School Administrator

1. Open Staff.
2. Choose Add Staff.
3. Enter identity, employee ID, contact information, role, and joining date.
4. System creates the login account and staff profile.
5. Temporary credentials are shown once in a secure success state.
6. If the role is a teaching role, a teacher profile may be created automatically or from Teachers.
7. In Teachers, choose Add Teacher.
8. Select an eligible active staff member without an existing teacher profile.
9. Add teacher code, specialization, qualification, and hire date.
10. Save and confirm.

**Business rules:**

- Employee ID is unique within a school.
- Mobile/email login identity must be unique.
- Only active roles can be assigned.
- Only active staff with active user accounts can become teachers.
- Inactive staff must not appear in the Staff Member selector.
- Staff already linked to a teacher profile must not appear in that selector.

## UF-06 — Deactivate a Staff Member

**Actors:** School Administrator

1. Open Staff and locate the member.
2. Open actions and choose Deactivate.
3. System shows a confirmation explaining access and assignment impact.
4. User confirms.
5. Staff and linked user account become inactive.
6. The person disappears from all new-assignment selectors.
7. Existing historical records remain readable where needed.

**Design note:** If active class, subject, or timetable responsibilities exist, show them in the confirmation and offer a route to reassign them.

## UF-07 — Assign or Reassign a Class Teacher

**Actors:** School Administrator, authorized Academic Coordinator

1. Select academic year.
2. Open Class Workspace.
3. Choose a class and section.
4. On Overview, review current class teacher.
5. If none exists, select an eligible active teacher and assign.
6. If one exists, choose Replace or Remove.
7. Confirm a consequential replacement/removal if dependencies exist.
8. Refresh the workspace and show the new assignment.

**Business rules:** One section can have only one active lead/class teacher. Only active, teaching-eligible staff from the same school may be selected.

## UF-08 — Assign or Reassign Subject Teachers

**Actors:** School Administrator, authorized Academic Coordinator

1. Open a section's Class Workspace.
2. Select Subjects & Teachers.
3. System displays every active subject assigned to the class.
4. Existing primary teacher selections are prefilled.
5. User selects or changes a teacher for one or more subjects.
6. Modified rows and the overall unsaved state are visually identified.
7. User saves all assignments together.
8. System validates teachers and subject eligibility.
9. Existing timetable entries for a reassigned subject move to the replacement primary teacher atomically.
10. Updated assignments are shown with a success message.

**Business rules:**

- Only active subjects assigned to the class may be allocated.
- Only active staff with active users and active teacher profiles may appear.
- A subject may have only one active primary teacher per section.
- Duplicate subject/teacher/role combinations are invalid.
- Reassignment deactivates the old assignment; it does not erase history.
- When an assignment is replaced, matching timetable entries move to the new teacher.
- If the replacement teacher already teaches during an affected period, show a scheduling-conflict error and make no partial changes.
- Removing a timetable-referenced assignment without a replacement is blocked until dependencies are resolved.

**Required Figma states:** Initial loading, assigned, unassigned, changed/unsaved, saving, saved, no eligible teachers, scheduling conflict, permission denied.

## UF-09 — Configure Period Templates

**Actors:** School Administrator, Academic Coordinator

1. Open Period Templates within an academic year.
2. Create a template or open an existing template.
3. Define school start/end time and working days.
4. Configure teaching periods, lunch, breaks, and activities.
5. Preview the generated schedule.
6. Resolve overlaps, out-of-hours slots, or insufficient-time warnings.
7. Save as Draft.
8. Assign to one or more classes, optionally with a section override.
9. Activate the template.
10. Create a new version when an active structure needs revision.

**Business rules:** Time slots cannot overlap or extend outside school hours. A class cannot have conflicting active template assignments for the same effective date range.

## UF-10 — Generate and Publish a Timetable

**Actors:** School Administrator, Academic Coordinator

**Preconditions:** Active year, class subjects, primary subject teachers, subject weekly-period requirements, and active period template exist.

1. Open Class Workspace > Timetable.
2. Review total weekly slots, allocated periods, flexible periods, and excess demand.
3. Configure weekly subject requirements if required.
4. Choose Generate Timetable.
5. System creates a draft and displays the weekly grid.
6. Conflicts are shown on affected cells and summarized.
7. User corrects teacher, capacity, or configuration issues and regenerates.
8. When conflict-free, user chooses Publish.
9. Confirm publication.
10. Published timetable becomes the active schedule.

**Business rules:** A teacher cannot occupy overlapping periods. A section cannot receive two subjects in one period. Published plans with unresolved conflicts cannot be published. Configuration changes should flag an existing published timetable as outdated without silently replacing it.

## UF-11 — Mark Student Attendance

**Actors:** Teacher, School Administrator, authorized staff

1. Open assigned section > Attendance.
2. Select a date; today is the default.
3. Existing marks for the date are loaded.
4. Mark individual students or apply a bulk status.
5. Available statuses are Present, Absent, Late, On Duty, and Excused.
6. Save attendance.
7. Dashboard metrics and monthly register refresh.

**Business rules:** Only active enrollments in the selected section are shown. Each enrollment has one attendance status per date. Users without mark permission may view but not edit.

## UF-12 — Manage Classroom Work

**Actors:** Teacher, Academic Coordinator

1. Open an authorized section workspace.
2. Choose Homework, Lesson Plans, Communication, Events, Exams, or Reports.
3. Review records or create a new record where authorized.
4. Select only subjects belonging to the class.
5. Save and show updated list.
6. Coordinators may review or approve lesson plans where permitted.

**Key states:** No records, draft, published, overdue, approved/rejected where relevant, validation error, permission denied.

## UF-13 — Admit a Student and Link a Parent

**Actors:** School Administrator, admissions staff

1. Open Students and choose Add/Admit Student.
2. Enter student identity and admission details.
3. Select academic year, class, and matching section.
4. Save the student and active enrollment.
5. Open Parents and create or locate a parent.
6. Link the parent to the student and identify the primary relationship where applicable.
7. Confirm the student detail shows enrollment and guardian information.

**Business rules:** Class and section must match the selected academic year and school. Duplicate enrollment within the same academic year is not allowed. Parent/student links must remain school-safe while supporting a parent relationship across schools where explicitly valid.

## UF-14 — Parent Views a Child

**Actors:** Parent or Guardian

1. Sign in.
2. View linked children.
3. Select a child/enrollment.
4. View school, academic year, class, section, attendance summary, and recent attendance.
5. Navigate to relevant updates when available.

**Business rules:** Parent can access only active relationships and enrollments linked to their account. No other child's data may be exposed.

## UF-15 — Manage Roles and Permissions

**Actors:** School Administrator

1. Open Roles & Permissions.
2. Create or select a role.
3. Edit name, code, description, and active status.
4. Review permissions grouped by module.
5. Select or clear permissions.
6. Save the complete permission set.
7. Assign the role to staff.

**Business rules:** Role codes are unique within a school. Protected system roles cannot be deleted. Only active roles may be newly assigned. Users immediately lose unavailable navigation and actions after permission changes.

## UF-16 — Maintain School Profile and Settings

**Actors:** School Administrator

1. Open School Profile.
2. Review and edit school identity, contact, address, logo, and administrative fields allowed for the role.
3. Save and receive confirmation.
4. Open Settings to configure timezone, language, grading, attendance, examination, and notification policies.
5. Save settings.

**Business rules:** Platform-controlled fields cannot be changed by a school administrator. Settings apply only to the current school.

## 7. Screen Requirements

| ID | Screen | Primary content and actions | Critical states |
|---|---|---|---|
| S01 | Login | School identity, username/email/mobile, password, sign in | Invalid credentials, inactive account, loading |
| S02 | Change Password | Current/new/confirm password, password rules | Mismatch, weak password, success |
| S03 | Platform Schools Dashboard | School metrics, school list, create/manage school | Empty, inactive school, filters |
| S04 | School Dashboard | Operational metrics, alerts, quick links | No academic year, incomplete setup |
| S05 | Teacher Dashboard | Assigned sections, attendance status, assigned subjects | No assignments, access restriction |
| S06 | Academic Years | Year table/cards, create/edit, current status | Empty, duplicate, inactive |
| S07 | Subjects | Subject catalogue, create/edit/deactivate | Duplicate, referenced record |
| S08 | Classes & Sections | Class list, section management, class subjects | No year, no sections, unsaved subjects |
| S09 | Class Workspace List | Classes, sections, student counts, teacher readiness | Missing class teacher, empty year |
| S10 | Class Workspace Detail | Header, 12 tabs, metrics, actions | Per-tab loading/error/empty |
| S11 | Subject Teacher Allocation | Subject rows, active-teacher selector, save/reset | Unsaved, no teachers, conflict |
| S12 | Attendance | Daily editor and monthly register | No students, view-only, saving |
| S13 | Timetable | Capacity metrics, weekly grid, draft/publish | No template, excess periods, conflicts |
| S14 | Period Templates | Template list/editor/preview/assignment/versioning | Overlap, insufficient time, affected timetable |
| S15 | Staff | Staff list, add/edit/deactivate, credentials success | Active/inactive, duplicate identity |
| S16 | Teachers | Active teacher list, add teacher, workload | No eligible staff, no assignments |
| S17 | Students | Student list/admission/detail | No enrollment, duplicate enrollment |
| S18 | Parents | Parent list/onboarding/detail/child links | No children, duplicate relationship |
| S19 | Roles & Permissions | Role list/editor, grouped permission matrix | Protected role, inactive role |
| S20 | School Profile | Identity and contact form | Read-only platform fields, save error |
| S21 | School Settings | Operational policy fields | Validation, save success |
| S22 | Forbidden | Explanation and safe navigation action | Direct unauthorized route |

## 8. Class Workspace Detailed Layout

The Class Workspace is the main operational hub and requires the strongest information hierarchy.

### Header

- Class name and section name
- Academic year
- Back to workspace list
- Optional readiness/status indicators

### Tabs

1. Overview
2. Students
3. Subjects & Teachers
4. Attendance
5. Timetable
6. Homework
7. Lesson Plans
8. Exams & Marks
9. Events & Calendar
10. Communication
11. Reports & Analysis
12. Class Settings

For desktop, tabs may be horizontally scrollable or grouped. On mobile, use a dropdown, segmented navigation, or another compact pattern that keeps the active section obvious.

### Overview

- Total students
- Present today
- Absent today
- Attendance percentage
- Attendance-not-marked alert
- Missing class-teacher alert
- Quick actions
- Upcoming activities
- Current class teacher with Assign/Replace action

### Student roster

- Student name
- Admission number
- Roll number
- Primary parent/guardian
- Contact
- Row link to student detail

### Class settings

- Section name
- Room
- Capacity
- Status
- Teaching-team summary

## 9. Data and Interaction Rules for Figma Components

### Selectors

- Provide searchable selectors when the list may exceed approximately 10 items.
- Show name plus a secondary identifier such as employee ID, subject code, class, or section.
- Do not show inactive options as selectable values.
- If an existing historical value becomes inactive, show it as unavailable and require a replacement when editing.

### Tables

- Support sorting/search where lists are long.
- Keep the primary identity column visible and visually dominant.
- Put secondary actions in a row menu.
- Use pagination or incremental loading patterns for large datasets.
- Provide a compact mobile presentation.

### Forms

- Use persistent labels, helper text where rules are not obvious, and inline errors.
- Distinguish Save, Cancel, Delete/Deactivate, Publish, and Replace actions by consequence.
- Disable Save until valid or changed, but still explain why the action is unavailable.

### Status badges

Create reusable variants for:

- Active / Inactive
- Draft / Published / Archived
- Present / Absent / Late / On Duty / Excused / Not Marked
- Success / Warning / Conflict / Error
- Assigned / Unassigned

### Confirmations

Use a confirmation dialog for deactivation, removal, replacement with dependencies, and timetable publication. Include the record name, effect, and primary/secondary actions.

## 10. Responsive Requirements

Design at minimum:

- Desktop: 1440 px canvas
- Tablet: 768 px canvas
- Mobile: 390 px canvas

On smaller screens:

- Sidebar becomes a drawer.
- Academic-year selector remains accessible.
- Tables either scroll horizontally with clear affordance or become structured cards.
- Class Workspace tabs remain navigable without wrapping into an unreadable block.
- Primary save actions remain easy to reach.
- Modals become near-full-screen sheets when needed.

## 11. Figma File Structure

The requested Figma file should contain these pages:

1. `00 Cover & Notes`
2. `01 Product Flows`
3. `02 Foundations`
4. `03 Components`
5. `04 Platform Admin — Desktop`
6. `05 School Admin — Desktop`
7. `06 Teacher — Desktop`
8. `07 Parent — Desktop`
9. `08 Tablet`
10. `09 Mobile`
11. `10 Prototypes`
12. `11 Archive`

## 12. Required Figma Deliverables

- Sitemap and user-flow diagrams before high-fidelity screens.
- Foundations for color, typography, spacing, elevation, radius, iconography, and grid.
- Reusable components built with Auto Layout.
- Component properties and variants for sizes, statuses, interaction states, and permissions.
- Desktop screens for all items in the screen inventory.
- Responsive designs for priority workflows.
- Clickable prototypes for UF-01, UF-05, UF-08, UF-10, UF-11, UF-13, and UF-14.
- Empty, loading, error, validation, success, disabled, and forbidden states.
- Developer-ready naming, measurements, tokens, and annotations.

## 13. Priority and Review Plan

### Phase 1 — Direction approval

- Sitemap
- User flows
- Visual mood board
- Foundations
- Dashboard concept

### Phase 2 — Core administration

- Academic Years
- Subjects
- Classes & Sections
- Staff
- Teachers
- Roles & Permissions

### Phase 3 — Academic operations

- Class Workspace
- Subject Teacher Allocation
- Attendance
- Period Templates
- Timetable

### Phase 4 — People and role experiences

- Students and admissions
- Parents and parent detail
- Teacher dashboard
- Parent dashboard
- Responsive versions

### Phase 5 — Prototype and handoff

- Complete interaction states
- Clickable prototypes
- Accessibility review
- Developer annotations
- Final component-library audit

## 14. Acceptance Criteria for Design Approval

A design is ready for development when:

- The user can identify where they are, which school they are managing, and which academic year is active.
- Every action is consistent with role permissions.
- Active and inactive records are unmistakable.
- Inactive staff and teachers are absent from assignment selectors.
- Teacher reassignment clearly communicates timetable impact and scheduling conflicts.
- Required loading, empty, error, success, and permission states exist.
- The same components are reused consistently across modules.
- Desktop, tablet, and mobile behaviors are documented.
- The prototype covers the primary task without unexplained dead ends.
- Developers can inspect component states, spacing, typography, and behavior without guessing.

## 15. Notes for the Designer

- Treat the current application as a functional reference, not a visual constraint.
- Do not remove actions or data fields without documenting the proposed workflow change.
- Prefer progressive disclosure over placing every action on the first screen.
- Keep frequent teacher tasks fast, especially attendance and classroom work.
- Keep administrative tables compact but readable.
- Highlight missing setup and dependencies with actionable guidance.
- Ask for clarification before changing any business rule marked in this document.
