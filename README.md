# Ervis SaaS Builder (Current Phase)

## What now works
- Full CRUD style flows for Organization, Team, Employee (create + update + archive).
- Canvas-first creation for teams/employees plus properties inspector editing.
- Context source management with inheritance visualization.
- Capability registry + assignment at team and employee level.
- Edge semantics with typed edges and editable metadata.
- Expanded audit log events and in-panel filtering.
- Tightened server-side ownership checks for org/team/employee/context/capability/edge APIs.

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
