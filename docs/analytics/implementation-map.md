# Central reports implementation map

Audit: existing Nest Reports exposes three raw school-wide endpoints. Class workspace separately computes unweighted marks averages. Existing AssessmentService and assessment-rules define weighted, grade-only and developmental assessment semantics; reuse them. StudentEnrollment is the identity/cohort source; EnrollmentMovement and attendance/marks snapshots preserve transfers. StudentAttendance records calendar dates at UTC midnight. Homework stores assignment snapshots; it has no per-student due-date extensions or formal excusal UI. General fees/collections do not exist; AdmissionPayment is available and must not be called fee collections. SchoolTerm has no date boundaries: term filters apply only to assessment termKey, not inferred attendance dates. Redis/queue dependencies are absent.

Implementation: extend ReportsModule with shared analytics authorization, validated URL filters, metrics registry, server snapshot engine, attention cases and export worker. Add one shared report workspace for school sidebar and existing section workspace. Preserve legacy APIs and source modules. Shared Student 360 uses enrollment IDs; no student copies.

Dependencies: existing Prisma/PostgreSQL, PDFKit, ExcelJS, assessment rules, school settings/working calendar, JWT/RBAC, private filesystem. Optional Redis via a small RESP adapter, failure falls back to uncached reads. Durable PostgreSQL jobs are the worker queue; multi-process claims use leases. Additive snapshot/job/attention tables, analytics policy and supporting indexes only. No new business entities for grades, fees or attendance.

Delivery checks and known boundaries are recorded in README.md.
