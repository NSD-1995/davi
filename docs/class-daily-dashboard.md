# Class daily dashboard

The section workspace Overview reuses the existing authenticated school/class/year/section endpoints. Daily attendance and effective timetable reads run concurrently and refresh on date changes, Overview remount, explicit refresh, or a successful attendance save. Volatile API reads bypass browser caches. Obsolete responses are ignored on scope/date changes; optional source failures have independent error states. No schema change or new dependency is required.

The school clock supplies the default date and timezone. Period states use that timezone and update every 30 seconds. Approved dated cover is displayed through the existing effective timetable resolver; permanent timetable entries are never written. Users without substitution-view permission see only their own applicable lessons through the existing resolver authorization.

Attendance uses the existing student reporting convention: PRESENT divided by recorded attendance, with LATE, EXCUSED and ON_DUTY retained as separate recorded statuses. The current project has no configurable student attendance weighting policy. No recorded attendance yields an unavailable percentage, not zero. Enrollment totals describe the current active section roster; this page is not a historical enrollment census. The selected date carries into the attendance register.

Quick actions retain existing mutation permissions. Activities use the existing event API with a section-specific audience (`CLASS:<sectionId>`). The class calendar includes school-wide/staff events, the selected section's activities, class-specific published exams, and the existing scoped homework/lesson plans. The dashboard derives alerts from these sources rather than copying general notifications, avoiding duplicate delivery records. Homework and lesson plan actions open their existing workspace tabs.

There is no saved class AI-insight model or endpoint. The optional collapsed panel therefore reports no saved insights, makes no model request and invents no learning gaps. A future persisted insight source can be connected here with its generation timestamp.

Validation includes frontend calculations and rendered permission/cover states, timezone boundaries, and backend service scope tests. Browser visual acceptance at desktop/tablet/mobile sizes remains a manual check; no browser automation dependency was added.
