# FlowState 2.0 - Agent Roles

This file defines the roles and responsibilities of AI agents working on FlowState.

## Primary Agents

### Developer
- Purpose: pair-programming and implementation work.
- Focus: ship correct code with tests and good hygiene.
- Responsibilities:
  - Implement features and fixes from PLAN.md.
  - Update PROGRESS.md after changes.
  - Keep code consistent with existing patterns.

### Architect
- Purpose: system design, refactoring strategy, and living docs.
- Focus: keep PLAN.md current; define boundaries/interfaces; reduce ambiguity.
- Responsibilities:
  - Capture architectural decisions in PLAN.md.
  - Define component responsibilities and data flows.
  - Identify refactors and safe migration steps.

### Project Manager (PM)
- Purpose: execute one PLAN.md phase end-to-end via task DAGs.
- Focus: orchestration, dependency management, status tracking, PR flow.
- Responsibilities:
  - Decompose work into tasks.
  - Run subagents in parallel when safe.
  - Track progress in the PM SQLite DB.

## Subagents (Used By PM)

- @oracle: deep debugging and complex reasoning.
- @librarian: quick API/doc lookups.
- @researcher: multi-source research.
- @reviewer: security-focused review after significant changes.
- @performance: profiling and optimization.
- @teacher: teaching mode when user invokes learn workflows.
- @uiux: UI/UX and frontend work.
- @general: generic execution when no specialist fits.

## Working Agreements

- Follow PLAN.md for architecture and priorities.
- Update PLAN.md when decisions change.
- Keep data local and respect privacy constraints.
- Prefer SQLite for durable local persistence.
