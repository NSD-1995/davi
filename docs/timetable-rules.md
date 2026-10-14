# Period-template timetable generation

Academic group selectors follow the active classes in the selected academic year. A Montessori-only setup shows Montessori in Academic Groups, Timetables, Subjects and teacher responsibility editors. Subjects restricted to other groups are hidden from setup choices; school-wide subjects remain available. Existing assignments are preserved. Quick Academic Setup retains the complete catalog so another group can be added later; group choices refresh after class changes and navigation.

Generation now uses the active period template and class subject/teacher assignments. No advanced school rules or subject/teacher exception setup is required.

- Working days, school hours, teaching periods, assembly and breaks come from the assigned active template.
- Every teaching slot is filled automatically. Subject frequency distributes the available time proportionally, with at least one lesson per subject.
- Assembly, breaks and other reserved slots retain their template times without automatic teacher supervision assignments.
- Legacy Custom mode, school workload limits, class teacher mandates, subject period preferences and teacher workload/availability exceptions do not restrict generation. Stored configuration is preserved.
- Active teacher status, subject and academic group eligibility, teacher/section overlaps, fixed lessons and published timetables outside the batch are still checked. Generation and publication validate using the same template-based policy; incomplete or conflicting drafts are never saved.

The Timetables page lists each class and section's latest created version, creation time (India time), status and detected overlaps. All latest class and section schedules are displayed directly in a list grouped by class, with a heading for each section; older versions remain collapsed and load into the view when opened. Check all timetables also validates each latest draft against current subject/template configuration. Cross-section draft overlaps identify the shared teacher, both sections, weekday and time, and highlight affected cells. Generation coordinates shared teachers at common period boundaries using bounded deterministic subject swaps and teacher matching, followed by full validation before transactionally saving all drafts.

Workflow: activate and assign **Period Templates**, configure **Subjects & Teachers** for the classes, then **Generate**, review and **Publish**. Existing plans remain unchanged until regenerated; old plans may fail validation under the new policy.

The advanced settings and exception editors have been removed from Timetable setup. The sections below record the earlier implementation and other academic setup features; descriptions of configurable generation rules are superseded by the policy above.

## Earlier configurable timetable generation

Workflow: **Create teacher → set capable subjects → assign subjects to classes → optionally choose preferred teachers → generate timetable**. Capable subjects are configured on teacher details and are independent of classes and academic years.

Use **Academics → Timetable Settings** to configure school rules, weekly subject requirements, eligible/preferred allocated teachers, teacher workload and availability. Select an academic year for subject and teacher configuration.

Use **Academics → Timetables** to select sections, check staffing, add optional fixed lessons and generate a batch. Generating sections together lets the solver coordinate shared teachers. Existing per-section generation remains available. Validate a draft before publishing; publishing validates again against current settings and other published timetables.

## Rules

Teacher and section overlaps, allocation/eligibility, unavailable slots, working days, school hours, normal-subject break protection, weekly requirements and daily/weekly teacher workload are always mandatory. Additional preferences can be Mandatory, Preferred, Optional or Disabled. First period by the class teacher defaults to Preferred; an eligible substitute is chosen if needed.

The generator uses deterministic candidate scoring and bounded backtracking. Hard violations are excluded before scoring. Exhausting the search limit is reported as a search limit, not proof that no solution exists. No partial or conflicting draft is saved. Generation saves the batch in a serializable transaction and revalidates current allocations inside that transaction. Publication is also serializable.

Weekly subject counts come from the existing ClassSubject.requiredPeriodsPerWeek field; the configuration API exposes this as weeklyPeriodsRequired. Generation no longer increases subject counts automatically to fill every school period. Teaching slots beyond required counts remain flexible/free. The result’s unassigned count is outstanding required lessons, not intentionally free slots.

School settings are stored in the existing SchoolSetting.timetableRules field. Teacher-specific overrides use Teacher.timetableWorkload. TeacherAvailability is reused for day/slot exceptions. ClassSubject stores subject period/teacher preferences. An empty eligibleTeacherIds list allows all active teachers with the subject in Teacher.capableSubjectIds, plus existing subject-specific class/section allocations for backward compatibility. Preferred teachers are optional and do not override availability or workload.

Special period types can require supervision. Eligible allocated staff are scheduled into these duties, with availability, overlap and workload checks. Duties are stored separately in TimetablePlan.supervisionEntries so reserved activities are not represented as normal subject lessons. Normal lessons remain in TimetableEntry.

Staffing checks report a lower bound for simultaneous staffing, using matching of eligible available teachers. Fully occupied sections and required supervised reserved periods count as unavoidable demand; sections with flexible/free capacity can move lessons. A passing staffing check is not proof of feasibility: the solver also checks weekly capacities, workload, fixed lessons and other constraints.

Generation also checks shared weekly teacher capacity before backtracking. It matches required lessons (including supervised reserved periods) to eligible teachers, respecting weekly workload limits and existing published lessons outside the batch. If capacity is insufficient, generation immediately reports required periods, the eligible weekly capacity and the shortage. Review subject/class eligibility, teacher workload limits and which reserved periods require supervision. Passing this check still requires the solver to satisfy timing and daily constraints.

## API routes (under /api/v1)

- GET/PUT /timetable-planning/settings
- GET/PUT /timetable-planning/teachers/:teacherId/config (GET academicYearId query; PUT academicYearId body)
- GET /timetable-planning/subjects/config?academicYearId=...&classId=...
- PUT /timetable-planning/subjects/:subjectId/config
- POST /timetable-planning/staffing
- POST /timetable-planning/generate-batch
- POST /timetable-planning/plans/:id/validate

Existing /timetable-planning/generate, requirements, plans, publish and delete APIs remain supported. Configuration and validation require TIMETABLE_VIEW; changing configuration requires TIMETABLE_UPDATE; generation requires TIMETABLE_GENERATE; publication requires TIMETABLE_PUBLISH. All queries use the authenticated school.

Batch generation accepts academicYearId, sectionIds, date and optional fixedEntries. Each fixed entry contains classId, sectionId, subjectId, teacherId, weekday (1–7) and periodSlotId. Subject configuration accepts weeklyPeriodsRequired, maxPeriodsPerDay, preferredPeriods, avoidPeriods, allowConsecutive, preferredTeacherIds and eligibleTeacherIds. Period number preferences use the timing template’s sequence numbers.

## Validation and rollout

Migration 20261011160000_configurable_timetable_rules adds configuration fields and supervision storage without duplicate timetable models. It has been applied to the local PostgreSQL database. Restart the backend if it is not running in watch mode; refresh the frontend.

The tests cover overlaps, unavailable/unallocated teachers, relaxed first-period preference, daily/weekly/consecutive workload, weekly distribution, fixed lessons, reserved slots, staffing shortages, deterministic eight-section/eight-teacher generation, no persistence on failure, atomic service-level batch saving and existing endpoint compatibility.

## Simplified daily design

1. **Period Templates:** configure school hours, breaks and class timing assignments once.
2. **Class Workspace → Subjects & Teachers:** use one table with Subject, Teacher, Periods per week and Setup. Save all changes with **Save class setup**. Capable teachers are filtered by subject; blank means automatic selection. Teacher selections are section-specific preferences, while weekly counts apply to all sections in the class. Teachers and counts save atomically.
3. **Timetables:** select sections, generate, review, validate and publish.

**Copy matching subjects** copies teacher preferences and weekly counts from another section into the current draft for review. It does not copy the class teacher. Unmatched subjects remain unchanged.

**Timetable Settings** opens with a summary and links to the daily workflow. School rules and exceptions are collapsed by default. Teacher/subject exceptions load only when opened. Existing settings are retained, and the built-in defaults apply when no school override exists.

## Final simple workflow

Use **Timetable Settings → Timetable setup** to select each subject’s capable teachers and classes. Select multiple classes directly or use the Montessori / Pre-primary shortcut. Choose Less, Normal or More frequency.

Automatic mode fills the available teaching slots, distributing time proportionally to subject frequency, with at least one weekly lesson per subject. It still rejects impossible staffing or workload constraints. Custom mode retains exact weekly counts for advanced use.

Class teacher first period is visible on the main setup screen: Mandatory, Preferred, Optional or Disabled. Mandatory requires an eligible class teacher and enough lessons for one first-period lesson each working day.

On **Timetables**, click Generate all classes, choose a class/section from the selector, review and Publish. Only the latest draft (or the active published timetable) is expanded; older schedules are under Older versions. Extra actions are collapsed.

Period Templates now supports changing applicable classes while editing an existing template. Select classes, save and activate the template before generation.

## Teacher-first attendance and cover

Teacher details now combines capable subjects, allowed/preferred classes and substitute opt-in in one teaching setup. Timetable setup may select teachers automatically from these profiles. Daily attendance changes produce dated cover rather than rewriting weekly timetables. See [Teacher attendance & cover](teacher-attendance-cover.md) for deadline configuration, late/permission handling, in-charge notifications and the daily cover view.

## Quick academic setup

Quick academic setup offers Montessori (Play School, Nursery, LKG, UKG), Pre-primary (1-2), Primary (3-5), Middle School (6-8), Secondary (9-10), and Senior Secondary (11-12). Class 8 belongs to Middle School to avoid overlap. Choose groups, sections per class and optional capacity. Existing classes remain unchanged; groups containing existing classes are rejected to prevent duplicates. The class group also controls teacher and subject eligibility as described below.

## Group-based teaching responsibilities

The six academic groups are shared by classes, teachers and subjects. Quick setup stores each class group; existing standard class names are backfilled by the migration. Custom classes can choose a group in Edit class.

In Teachers, open Groups, subjects / assignments or the teacher profile. Select one or more teaching responsibility groups, then responsible subjects. Allowed classes and preferred classes further narrow responsibility. These academic responsibilities do not change login permissions. Multiple groups support shared staff such as sports and language teachers. All current and future classes in those groups are eligible unless explicit allowed-class restrictions are set.

In Subjects, create or edit a subject and select its academic groups. A subject can belong to several groups; no group selection means a shared school-wide subject. Existing subjects and teachers retain school-wide eligibility until configured. Group filters are available on both master lists.

Class Workspace shows subjects belonging to the class group and filters teachers by that group, subject capability, active status and allowed classes. Class-teacher choices and teacher-profile class assignments respect groups too. Server-side assignment checks, timetable generation and daily substitute selection enforce the same group restrictions. Cross-group staff still share one availability and workload schedule, preventing overlaps. Existing timetables are not rewritten: review assignments and regenerate after changing responsibilities.

## Compartment workspace and shared teachers

Academics > Academic Groups is the compartment setup hub. Choose one of the six groups to view classes, subjects, a teacher assignment table and setup readiness. Add teachers from any other compartment, choose responsible subjects and optional classes, and save the whole group table atomically. Other group responsibilities are preserved. Clearing a teacher row's subjects removes that group responsibility on save. Substitution opt-in remains a teacher-wide setting.

Teacher profiles now store separate groupResponsibilities rows in the existing timetableEligibility JSON: groupId, subjectIds and classIds (null means all current and future classes in that group). For example, a teacher may teach English in Pre-primary and Mathematics in Primary. The capable subject list is the union of these rows; a capability alone does not grant responsibility for that subject in every group. An explicitly empty responsibility list disables automatic teaching and substitution. Legacy profiles retain their existing behavior until reviewed and saved. Existing allowed-class restrictions remain an additional limit; teacher setup offers an explicit option to replace them with the group-row class selections.

The workspace checks missing sections, subjects, eligible teachers, class teachers, active timings and custom weekly capacity. Optional class-teacher gaps are warnings. Readiness is a basic setup check, not proof of scheduling feasibility. The generator still checks availability, shared staff capacity and all timing constraints. Class Workspace explains why other teachers are excluded.

Generate a single compartment from its workspace or choose a compartment on Timetables. Whole-school generation coordinates all new drafts together. Group-only generation still respects published lessons outside the group. Teachers shared across compartments use one teacher identity, availability and daily/weekly workload; substitutions check subject responsibility for the target compartment and all existing bookings. Existing drafts in different groups should be generated together or published and revalidated before use.

Existing setup to review lists broad teacher profiles and ungrouped subjects. Select ungrouped subjects and assign them to the current compartment in bulk, or edit a subject to choose several groups. Bulk classification replaces school-wide subject scope; existing class mappings and timetables are preserved for review. Group membership itself does not grant login permissions.

API additions: GET/PUT /api/v1/timetable-planning/group-workspace (GET academicYearId and groupId; PUT academicYearId, groupId, assignments). GET requires TIMETABLE_VIEW; saving the teacher table requires STAFF_UPDATE and TIMETABLE_UPDATE. PUT /api/v1/timetable-planning/group-subjects accepts subjectIds and academicGroups and requires SUBJECT_UPDATE. Generation accepts optional groupId and rejects invalid groups or groups without eligible sections.
