# Ervis SaaS Foundation (Phase 1)

## Architecture overview
This first pass implements a production-minded vertical slice for a multi-tenant SaaS app with:
- Next.js App Router + TypeScript + Tailwind UI shell
- Prisma + PostgreSQL schema (with pgvector extension enabled)
- NextAuth/Auth.js foundation with Google provider placeholders
- Multi-tenant ownership model (user owns organizations)
- Organization and Team canvases powered by React Flow
- Basic audit log pipeline for creation, edge linking, and node moves
- Seed/bootstrap path using environment variables (no hardcoded credentials)

Layering:
- `app/`: routes, layouts, API handlers
- `components/`: reusable UI and canvas components
- `features/`: domain-level querying/audit logic
- `lib/`: environment validation, logging, shared utilities
- `server/`: auth guard + access policy helpers
- `db/`: Prisma client singleton
- `prisma/`: schema, migrations, seed script

## Folder structure
```
frontend/
  app/
    (app)/dashboard
    (app)/org/[organizationId]
    (app)/team/[teamId]
    (app)/settings
    login
    api/
  components/
    layout/
    canvas/
  features/
    org/
    team/
    audit/
  lib/
  server/
  db/
  prisma/
```

## Setup instructions
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Copy env template and fill in values:
   ```bash
   cp .env.example .env
   ```
3. Ensure PostgreSQL has `pgvector` extension support.
4. Generate Prisma client + run migration + seed:
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
5. Start app:
   ```bash
   npm run dev
   ```

## Environment variables
- `DATABASE_URL`: PostgreSQL connection
- `NEXTAUTH_SECRET`: session signing secret
- `NEXTAUTH_URL`: base app URL
- `GOOGLE_CLIENT_ID`: Google OAuth client id
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `ADMIN_EMAIL`: bootstrap admin user email for seed/upsert

## Implemented now
- Core schema + initial migration for:
  - User, Organization, Team, Employee, ContextSource, Capability,
    TeamEdge, EmployeeEdge, AuditLog (+ NextAuth support tables)
- Multi-tenant access checks (user can only access owned org/team data)
- Auth foundation with Google provider placeholders and custom login page
- Admin bootstrap seed strategy via `ADMIN_EMAIL`
- Pages:
  - `/login`
  - `/dashboard`
  - `/org/[organizationId]`
  - `/team/[teamId]`
  - `/settings` (admin-only placeholder)
- Reusable UI components:
  - app sidebar, top bar, organization card, team/employee nodes,
    properties panel, activity log panel
- Basic canvas interactions:
  - render nodes/edges from DB
  - drag node and persist position
  - connect nodes to create edge and persist
- Minimal audit logging for:
  - organization/team/employee created
  - edge created
  - node moved
- Placeholder interfaces for future agent runtime:
  - model provider, embedding provider, tool execution, orchestration engine

## Planned next (not yet implemented)
- Full orchestration runtime and worker queueing
- Context inheritance evaluator and runtime context resolution
- Vector similarity queries and embedding ingestion pipeline
- Fine-grained agent capability policy UI and enforcement hooks
- Rich CRUD interactions in canvas (inline creation forms, deletion, editing)
- Deeper admin console (system settings + user management)
