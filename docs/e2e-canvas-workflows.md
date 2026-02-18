# E2E: Canvas MCP + Workflows (Manual Smoke)

This is a manual smoke test for the Phase 3.75 wiring:

- Canvas Integration (token OR browser-session auth)
- Canvas MCP configuration into OpenCode (Electron main process)
- Workflows listing + running (OpenCode commands and/or `workflows/*/SKILL.md`)
- NL -> SKILL generation and persistence

## Preconditions

- From repo root, install deps: `pnpm install`
- Ensure the desktop app can start: `pnpm dev:desktop`

## Test A: Connect Canvas (API token)

1. Open the desktop app.
2. Go to `Integrations`.
3. Find `Canvas LMS` and click `Connect`.
4. Choose `API Token`.
5. Enter:
   - Canvas Instance URL (example: `https://your-school.instructure.com`)
   - Canvas API Token
6. Submit.

Expected:
- Canvas shows `Connected`.

## Test B: Connect Canvas (Browser Login / no token)

This uses the Integrations browser-login flow to create a Playwright storage state file.

1. Open the desktop app.
2. Go to `Integrations`.
3. Find `Canvas LMS` and click `Connect`.
4. Choose `Browser Login (No token)`.
5. Enter:
    - Canvas Instance URL
    - Storage State Path (absolute path)
6. Submit and complete login in the opened browser window.
7. Click the confirmation button once you are on the Canvas dashboard.

Expected:
- Canvas shows `Connected`.

## Test C: Workflows list

1. Open `Workflows`.
2. Verify the list includes workflows from:
   - Repo: `workflows/*/SKILL.md`
   - User data: `~/Library/Application Support/FlowState/workflows/*/SKILL.md` (generated workflows)
   - OpenCode commands (if any are available and listed)

Quick check in DevTools console:

```js
await window.flowstate.workflows.list()
```

Expected:
- Returns `{ ok: true, data: [...] }`.
- Includes at least the seeded workflows:
  - `pull-canvas-assignments`
  - `clean-desktop`
  - `email-triage-draft-replies`

## Test D: Run a seeded workflow (Canvas assignments)

Note: the workflow body is read-only; it should never submit or modify Canvas.

1. In `Workflows`, run `pull-canvas-assignments`.
2. If you don’t yet have a UI "Run" result surface, run from DevTools:

```js
await window.flowstate.workflows.run('pull-canvas-assignments')
```

Expected:
- Returns `{ ok: true, data: { status: 'completed' | 'failed', ... } }`.
- If Canvas is connected properly and MCP is functional, you should see assignment info in output.

## Test E: NL -> workflow generation

1. In `Workflows`, use the "Build a workflow" card.
2. Enter an intent like:
   - "Every Monday morning, pull my Canvas assignments due this week and summarize them."
3. Click `Generate`.

Expected:
- A generated `SKILL.md` preview appears.
- The preview indicates it was saved as an id.
- A new workflow is persisted to:
  `~/Library/Application Support/FlowState/workflows/<id>/SKILL.md`

Verify via DevTools:

```js
await window.flowstate.workflows.list()
```

## Observability hints

- Approvals appear as timeline events of kind `approval_request` with an inline card.
- Titlebar shows a minimal status dot and an activity pill.
