# DAVI API testing workflow

Import `postman-school-api.json` into Postman. The collection defaults to `http://localhost:3001/api/v1` and applies `Authorization: Bearer {{token}}` globally. Requests that require the parent account override this with `{{parentToken}}`.

## Start the API

1. Configure PostgreSQL and `DATABASE_URL`.
2. Back up any existing database.
3. Generate Prisma Client and apply migrations, including the school-state and global-parent/student-identity migrations.
4. Run the Prisma seed so permission records exist.
5. Start the backend and confirm `GET {{baseUrl}}` responds.

From the repository root:

```powershell
npm.cmd --workspace apps/backend run prisma:generate
npm.cmd --workspace apps/backend run prisma:migrate
npm.cmd --workspace apps/backend run start:dev
```

## First school setup

Run **00 — Setup workflow** in order:

1. Register the platform Super Admin.
2. Create a school. The test script stores its ID and one-time School Admin password.
3. Login as School Admin and change the temporary password.
4. Create settings. Do not send `schoolId`; it is derived from the authenticated user.
5. Create the academic year, class, sections, and subjects.

School Admins should read and update their own profile using:

```http
GET /schools/me/profile
PATCH /schools/me/profile
```

The `/schools/:id` CRUD routes are platform Super Admin routes. School Admin clients must not use them for their own profile.

## Authentication and authorization

Protected routes require a JWT, the appropriate permission, and a valid school context. School operations derive school identity from the authenticated user wherever possible. Supplying another school's ID does not change the scope and cross-school records return `403` or `404`.

New staff, School Admin, and newly created parent accounts must change their temporary password before accessing normal protected operations.

## Academic and admission workflow

The main operating sequence is:

1. Academic Year
2. Subjects and Academic-Year Subjects
3. Classes and Sections
4. Class Subjects and Teaching Team
5. Student Admission
6. Parent Relationships
7. Attendance, timetable, exams, events, reports, notifications, and audit

Student identity is global. School placement belongs to `StudentEnrollment`, which contains school, academic year, class, section, admission number, and roll number. Admission numbers are unique per school and academic year.

The **Student Admissions** request stores `studentId`, `enrollmentId`, `parentEnrollmentId`, and the primary `parentId` for later requests.

## Global parent and multi-school workflow

One mobile number represents one global parent login. A parent may own multiple child relationships and those children may have enrollments in different schools.

### New parent

Run **Create or Reuse Global Parent Login** with an unused mobile number. The response contains:

```json
{
  "parent": {
    "id": "...",
    "verificationStatus": "VERIFIED"
  },
  "credentials": {
    "username": "9876543211",
    "temporaryPassword": "..."
  },
  "verificationRequired": false
}
```

The Postman test stores the parent ID and temporary password. Login using **Parent Login**, change the first-time password when required, and store the returned token in `parentToken`.

### Existing parent at another school

When another school submits the same mobile number, DAVI reuses the global `User` and `Parent` profile. The new school membership is created as `PENDING`:

```json
{
  "credentials": null,
  "verificationRequired": true,
  "parent": {
    "verificationStatus": "PENDING"
  }
}
```

The existing password remains unchanged. Linking through `POST /parents/:parentId/students` returns `403` until consent verification is complete. OTP delivery and confirmation are not implemented yet, so do not manually mark production memberships verified.

### Relationship permissions

The link request supports:

```json
{
  "studentId": "{{studentId}}",
  "relationshipType": "FATHER",
  "isPrimary": true,
  "canPickup": true,
  "canViewAcademics": true,
  "canPayFees": false
}
```

The student must have an active enrollment in the authenticated staff user's school. Duplicate links return `409 Conflict`.

### Isolation checks

Use **List School-Visible Parents** and verify that it includes only children/enrollments belonging to the current school. It must never expose another school's enrollment data.

Use **Reject Unowned Enrollment** with a parent token and confirm `403 Forbidden`.

## Parent portal workflow

The parent endpoints use the parent token, not the School Admin token:

```http
GET /parent/me/children
GET /parent/enrollments/:enrollmentId/dashboard
GET /parent/enrollments/:enrollmentId/attendance
```

`GET /parent/me/children` returns active child relationships across schools. Its Postman test stores the first active enrollment as `parentEnrollmentId`.

Every enrollment request verifies:

- The JWT belongs to a Parent profile.
- The requested enrollment belongs to a linked child.
- The relationship is active.
- `canViewAcademics` is enabled.

Future homework, results, fees, events, and messages endpoints should use the same enrollment-scoped authorization pattern.

## Destructive requests

Delete and unlink requests are included for coverage. Run them only after dependent tests. Removing a parent from a school deletes the school membership, not the global parent identity or relationships owned by other schools.

## Expected validation responses

- `400` — malformed mobile, academic mismatch, duplicate input in one request, or invalid marks/times.
- `401` — missing, invalid, or expired JWT.
- `403` — missing permission, cross-school access, unowned parent enrollment, or pending consent verification.
- `404` — school-scoped record does not exist.
- `409` — duplicate mobile/email, parent code, admission number, enrollment, or parent-child link.

Email, SMS, WhatsApp, OTP delivery, homework, fees, and the remaining parent dashboard modules still require their provider/domain implementations.
