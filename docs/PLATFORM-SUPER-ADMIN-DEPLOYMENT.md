# DAVI Super Admin Platform deployment

## Scope

The Super Admin platform uses the `/davi` web routes and the authenticated `/platform` API. Platform accounts are global (`User.schoolId = null`) and must have the `SUPER_ADMIN` role. School accounts must use their own school login and cannot access platform endpoints.

## Database rollout

The following migrations are required, in order:

1. `202610300002_school_program_onboarding`
2. `202610300003_platform_subscriptions`
3. `202610300004_platform_support`
4. `202610300005_platform_password_resets`
5. `202610300006_platform_settings`

From the repository root, with the target database deliberately set in `DATABASE_URL`:

```powershell
npx.cmd prisma generate --schema apps/backend/prisma/schema.prisma
npx.cmd prisma migrate deploy --schema apps/backend/prisma/schema.prisma
```

Do not use `migrate dev` against a deployed database. It can prompt for drift remediation.

## Required configuration

- `DATABASE_URL`: PostgreSQL connection string for the selected environment.
- `JWT_SECRET`: a unique production signing secret.
- `NEXT_PUBLIC_API_URL`: public backend API base URL for the web deployment.
- `OPENAI_API_KEY`: required only when AI generation is enabled.

## Post-deployment smoke test

1. Sign in at `/davi/login` with a global Super Admin.
2. Verify a school account cannot sign in there and is redirected to its school path.
3. Open `/davi/dashboard`, `/davi/schools`, `/davi/subscriptions`, `/davi/billing`, `/davi/usage`, `/davi/users`, `/davi/support`, `/davi/reports`, and `/davi/settings`.
4. Initialize plans once, create a test school, assign a trial subscription, then confirm no invoice was created.
5. Assign an active plan to a separate test school and confirm the first invoice exists.
6. Record a test payment, verify it, and confirm the invoice status changes.
7. Create a password-reset link for a test platform user, complete it once, then confirm re-use fails.
8. Confirm a tenant school user receives `403` from `/api/v1/platform/*`.

## Current verification evidence

- Prisma schema validation passed.
- Backend production build passed.
- Web production build passed.
- Backend tests: 337 passed, 33 database integration tests skipped because no disposable PostgreSQL integration target was configured.
