# Ervis SaaS Builder (Current Phase)

## What now works
- Full CRUD style flows for Organization, Team, Employee (create + update + archive).
- Canvas-first creation for teams/employees plus properties inspector editing.
- Context source management with inheritance visualization.
- Capability registry + assignment at team and employee level.
- Edge semantics with typed edges and editable metadata.
- Expanded audit log events and in-panel filtering.
- Tightened server-side ownership checks for org/team/employee/context/capability/edge APIs.
- Authentication with email/password credentials plus optional Google OAuth.

## Authentication
### Supported sign-in flows
- **Email/password registration** at `/register`.
- **Email/password login** at `/login`.
- **Google login** at `/login` only when Google OAuth env variables are configured.

### Auth behavior and safety
- Passwords are hashed with Node.js `crypto.scrypt` + per-user random salt before persistence.
- Password hashes are stored in `User.passwordHash` and never returned from the register API.
- Public registration always creates users with default role `USER`; admin bootstrap remains separate via `ADMIN_EMAIL` seed/upsert flow.
- Existing session handling stays in Auth.js with Prisma adapter and `database` sessions.
- Existing role propagation (`session.user.role`) remains intact.

### Required and optional environment variables
#### Required for app auth/session
- `DATABASE_URL`
- One of: `AUTH_SECRET` or `NEXTAUTH_SECRET` (or legacy `JWT_SECRET_KEY` via startup script)

#### Optional for URL configuration
- `AUTH_URL` or `NEXTAUTH_URL`

#### Optional for Google provider
Google login is enabled only if both values are present (either naming style):
- `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`
- or `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`

If Google vars are missing, the app still starts and credentials auth works normally.

#### Optional bootstrap/admin seed
- `ADMIN_EMAIL` (needed for seeding an admin user via `prisma/seed.ts`)

## CRUD flows
- **Organization**: create from dashboard, edit/archive from org cards.
- **Team**: create from organization canvas, edit/archive in properties panel.
- **Employee**: create from team canvas, edit/archive in properties panel.
- All mutation endpoints validate payloads with **Zod**.

## Context inheritance rules
- `organization` context applies to teams and employees.
- `team` context applies to employees on that team.
- `employee` context is direct only.
- Inspector labels context as:
  - inherited from organization
  - inherited from team
  - direct to employee

## Capability assignment rules
- Capability registry is seeded (`web_search`, `summarize_text`, `classify_content`, `route_task`, `write_analysis`, `review_output`, `send_email`).
- Team can define default capabilities.
- Employee can define direct capabilities.
- Effective employee capabilities = direct employee caps + optional team defaults (resolved via domain service).

## Edge types
Supported edge enum values for team and employee edges:
- `HIERARCHY`
- `HANDOFF`
- `APPROVAL`
- `FEEDBACK_LOOP`
- `ESCALATION`

Each edge supports label, description, condition note and can be edited/deleted.

## Access control rules
- Users can only access organizations they own.
- Team/employee/context/edge/capability access is validated server-side through ownership traversal.
- Admin-only settings page remains protected.

## Seed data included
- 1 organization
- Multiple teams
- Hierarchical team edges
- Multiple employees
- Employee workflow edges
- Context inheritance examples (org/team/employee)
- Capability assignments (team defaults + employee direct)

## Still unimplemented
- Runtime OpenAI execution/orchestration.
- Full document embedding/vector ingestion pipeline.
- Rich modal/sheet design system (current UI is pragmatic inline forms).
- Full automated test coverage across all APIs.

## Prisma migration recovery (PostgreSQL)
- The initial migration (`202604020001_init`) creates the `vector` extension, so PostgreSQL must include `pgvector`.
- `docker-compose.yml` uses `pgvector/pgvector:pg16` and runs migrations in a one-shot `migrator` service before the frontend starts.
- The frontend startup script skips `migrate deploy` by default to avoid restart loops. Set `APPLY_MIGRATIONS_ON_STARTUP=true` only when intentionally running migrations inside app startup.

If migration history is in a failed state (`P3009`) and data must be preserved:
1. Inspect failed entries:
   - `SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM "_prisma_migrations" ORDER BY started_at DESC;`
2. Check whether migration SQL effects exist in the schema.
3. Resolve based on reality:
   - Mark rolled back if SQL did not apply: `npx prisma migrate resolve --rolled-back 202604020001_init`
   - Mark applied if SQL already exists: `npx prisma migrate resolve --applied 202604020001_init`
4. Re-run deploy: `npx prisma migrate deploy`
