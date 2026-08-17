# DAVI API testing workflow

Import `postman-school-api.json` into Postman. It defaults to `http://localhost:3001/api/v1`; change the collection's `baseUrl` variable if the API runs elsewhere. The collection applies `Authorization: Bearer {{token}}` globally.

## Start the API

1. Start PostgreSQL and configure `DATABASE_URL` for the backend.
2. From the repository root, run `npm run prisma:generate --workspace=@davi/backend`, then apply migrations with `npm run prisma:migrate --workspace=@davi/backend` when needed.
3. Run `npm run start:dev --workspace=@davi/backend`.
4. Confirm `GET {{baseUrl}}` responds before starting the workflow.

## First-run order

1. Run **Register platform super-admin**. It stores its JWT in `token`.
2. Run **Create school**. It requires that super-admin JWT and stores `schoolId` and the generated school-admin temporary password.
3. Run **Login as school admin**, then **Change school admin password**. Login stores the school-admin JWT.
4. Run the remaining setup requests: settings, academic year, class, section, and subject. Their response scripts store dependent IDs.
5. Use each resource folder for the full CRUD and lookup endpoints.

## Authorization currently implemented

Only these endpoints enforce authorization in the current backend:

- `POST /schools` — `super-admin`
- All `/schools/:schoolId/profile-options` and `/schools/:schoolId/users/:userId/profile-options` endpoints — `super-admin` or `school-admin`
- `POST /auth/change-password` — any valid JWT
- All `/academic-years` endpoints — `school-admin`, restricted to the admin's assigned school
- All `/classes` and `/sections` endpoints — `school-admin`, restricted to the admin's assigned school

Other endpoints are currently public. The collection preserves that behavior; this is an implementation status, not a recommended production permission model.

## Important testing notes

- School creation produces a unique, random temporary password and returns it once. The collection captures it automatically.
- `POST /users` expects an already hashed `passwordHash`; use `POST /auth/register` for normal user creation with a plaintext password.
- A user can be only one of student, teacher, or parent because each profile has a unique `userId`. Create distinct users before exercising all three People flows.
- Creating a class requires an `academicYearId` from the school admin's school. Add `numberOfSections` to create numbered sections automatically; for example, `3` creates sections `1`, `2`, and `3`. Deleting a class cascades to its sections.
- For onboarding, use `POST /classes/bulk` to create class groups for one academic year in one request. Enable any of `montessori` (Play School, Nursery, LKG, UKG), `primary` (1st–5th), `secondary` (6th–10th), and `seniorSecondary` (11th–12th). Send one `numberOfSections` value and every created class receives that many numbered sections. Use the normal class and section CRUD endpoints later to edit or delete a specific class or section from the dashboard.
- Classes accept only `ACTIVE` or `INACTIVE` status. The dashboard can call `GET /classes?status=ACTIVE` for its default list and `GET /classes?status=INACTIVE` for archived classes. Inactive classes cannot receive new sections until reactivated.
- The destructive requests are intentionally present for coverage. Run them only after dependent data checks; deleting a school cascades to its related records.

## Subject management sequence

Subject and academic-year subject endpoints require a school-admin JWT and are restricted to that admin's school. Run **Create Subject**, **Assign Subjects**, **Get Subjects By Academic Year**, and **Remove Subject From Academic Year** in that order. Removing an assignment leaves the master subject intact; a master subject cannot be deleted while any academic-year assignment remains. Valid subject statuses are `ACTIVE` and `INACTIVE`; valid types are `CORE`, `ELECTIVE`, and `OPTIONAL`.

## Roles, permissions, and staff sequence

1. Apply the roles/permissions migration and run the Prisma seed before testing.
2. Login as the school admin; the protected `SCHOOL_ADMIN` role has full school access.
3. Run **List Permissions**, then **Create Role** and **Update Role Permissions**.
4. Run **Create Staff**. The response stores the one-time temporary password and staff ID in collection variables.
5. Run **Staff Login** using the mobile username. DAVI returns `requiresPasswordChange: true` and blocks other protected features until **Change First-Time Password** succeeds.
6. Run **Current User / Permissions** and confirm the assigned role and permission codes.
7. Test permitted and non-permitted endpoints. Missing permissions return `403 Forbidden`, and School A users cannot manage School B paths.

Staff academic-year, class, section, and subject responsibilities are intentionally separate from access roles and are not part of this workflow.
