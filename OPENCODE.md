# OPENCODE.md (FlowState)

This document explains how FlowState wires OpenCode configuration and how model selection currently behaves in the Desktop (Electron) app.

---

## 1) Configs that exist in this repo

### Repo-level OpenCode config (TUI / CLI-oriented)

- `opencode.json`
  - OpenCode config file (schema: `https://opencode.ai/config.json`).
  - Currently used to declare:
    - `theme`: `./themes/flowstate.json`
    - `mcp`: local MCP server commands for the monorepo packages.
  - Important: the Desktop app does **not** currently read `opencode.json` when starting OpenCode; it constructs MCP config dynamically from auth state in `packages/desktop/src/main/process-manager.ts`.

### FlowState “app config” (repo-level, not the Electron persisted config)

- `flowstate.config.json`
  - FlowState-specific metadata and agent registry.
  - Includes:
    - `agents.primary`: `./agents/flowstate.md`
    - `agents.subagents`: `./agents/subagents/*.md`
    - `preferences.defaultProvider`: currently `opencode/zen` (legacy placeholder)
  - Important: this is not the Desktop app’s runtime config file. In Desktop, runtime config is persisted under Electron `userData`.

### Agent instruction files

- `agents/flowstate.md` and `agents/subagents/*.md`
  - Prompt content + optional frontmatter.
  - The repo convention (see `agents/README.md`) supports frontmatter like:
    - `model: provider/model`
    - `temperature: ...`
  - Desktop headless OpenCode now loads `agents/flowstate.md` and injects it as the `system` prompt for each message, so the runtime prompt matches the FlowState persona.

### Desktop persisted config (Electron userData)

- `packages/desktop/src/main/config-store.ts`
  - Persists a JSON config file at `app.getPath('userData')/config.json`.
  - On macOS this typically resolves to:
    - `~/Library/Application Support/FlowState/config.json`
  - This file includes:
    - `provider.default` (string)
    - `provider.apiKeys` (map)
    - `mcpServers` (enabled servers, command, env)
    - `preferences` (timezone, working hours, notifications)
    - `onboardingComplete` (boolean)
  - The Desktop renderer reads/updates it via IPC:
    - `packages/desktop/src/main/index.ts` (`config:get`, `config:set`)
    - `packages/desktop/src/preload/index.ts` exposes `window.flowstate.config.get/set`

### Web dashboard preferences (core memory)

(Separate from the Desktop config store)

- `packages/core/src/memory/index.ts`
  - Stores preferences in SQLite at `~/.flowstate/memory.db`.
  - Includes `defaultLLMProvider` (defaults to `opencode/zen`).
- `packages/web-config/src/pages/Preferences.tsx` and `packages/web-config/server/index.ts`
  - Read/write `defaultLLMProvider` via the API (`/api/preferences`).

Important: this web-config preference does not currently feed into Desktop’s OpenCode runtime model either.

---

## 2) Model selection precedence in Desktop “headless OpenCode”

In the Desktop app, OpenCode is started from the Electron main process in:

- `packages/desktop/src/main/process-manager.ts`

The OpenCode server is created via `createOpencode({ config: { model: ... }})` with:

- `config.model` **hardcoded** to `opencode/grok-code`

That persisted value now drives the Desktop runtime model.

### What the persisted Desktop config contains

The Desktop persisted config contains a “default provider/model” string at:

- `config.provider.default`
  - default value in code: `opencode/grok-code` (from `DEFAULT_CONFIG` in `packages/desktop/src/main/config-store.ts`)
  - updated by onboarding (see below)

### Actual precedence today (Desktop)

1. **Runtime model from config**: `packages/desktop/src/main/process-manager.ts` reads `configStore.get().provider.default` and passes it to `createOpencode({ config: { model }})`.
2. **Persisted config** (`~/Library/Application Support/FlowState/config.json`): `provider.default` is the source of truth for Desktop model selection.
3. **Repo config**: `flowstate.config.json` / `opencode.json` / `agents/*.md` are not consulted for Desktop model selection.

This means:
- The UI can say “Provider: openai/…” or “Provider: github-copilot/…” but the OpenCode runtime still uses `opencode/grok-code`.

---

## 3) Onboarding model selection: where it’s stored, and why it doesn’t affect runtime

### Where onboarding selection lives during onboarding

- `packages/desktop/src/renderer/stores/providerStore.ts`
  - Holds `selectedProviderId` + `selectedModel` in a Zustand store.
  - This is **in-memory** UI state during onboarding.

### Where onboarding persists the selection

On finishing onboarding:

- `packages/desktop/src/renderer/App.tsx` (`handleOnboardingFinish`)
  - Calls `updateConfig({ provider: { default: selectedModel, apiKeys: ... }, onboardingComplete: true })`.

That `updateConfig()` writes to:

- `~/Library/Application Support/FlowState/config.json`
  - via IPC `config:set` in `packages/desktop/src/main/index.ts`
  - implemented by `packages/desktop/src/main/config-store.ts`

### Why it currently does not change runtime model

The OpenCode server is started *before* onboarding completes and reads the model from config at startup:

- `packages/desktop/src/main/index.ts` calls `processManager.start()` during app initialization.
- `packages/desktop/src/main/process-manager.ts` now reads `configStore.get().provider.default` and passes it to `createOpencode`.

That means onboarding selections only take effect after the next OpenCode restart (or app restart), because the model is read at startup.

---

## 4) How to change the model flow safely (recommended approach)

The core issue is **multiple sources of “default model”** without a single authoritative runtime source.

### Recommended: one source of truth for Desktop runtime

For Desktop, the most direct single source of truth should be:

- `~/Library/Application Support/FlowState/config.json` → `provider.default`

Then Desktop startup should:

1. Load config (`configStore.load()` already happens in `packages/desktop/src/main/index.ts`).
2. Read `configStore.get().provider.default`.
3. Pass that to `createOpencode({ config: { model: providerDefault }})`.

This makes onboarding and later settings changes actually affect runtime.

### Restart strategy (because the model is chosen at OpenCode start)

Changing model safely should be treated like changing a server startup config:

- Update persisted config first (atomic write is already done by `config-store.ts`).
- Then restart the OpenCode server instance:
  - call `processManager.stop()`
  - call `processManager.start()`

Practical restart options:

- **Simple dev workflow**: restart the whole Electron app.
  - This guarantees a clean OpenCode restart and avoids “half updated” state.
- **Preferred product workflow**: add an IPC action like `opencode:restart` that:
  - stops OpenCode
  - re-reads config
  - restarts OpenCode with the new model

Avoid “hot swapping” the model without restarting OpenCode unless the SDK explicitly supports it (this repo currently does not implement a model hot-swap API).

### What to do about `flowstate.config.json` and Web preferences

To avoid future confusion:

- Treat `flowstate.config.json` as **repo metadata** (agents registry) unless/until you wire it into runtime.
- Treat `packages/core` `defaultLLMProvider` as **daemon/web-dashboard preference** unless/until you unify Desktop + core preference storage.

If you want a larger unification later:
- choose either Electron `userData/config.json` or core SQLite as the global preference store
- build a synchronization path (explicitly, not implicitly)

---

## 5) Debugging checklist (effective model + where to add logs)

### A) Verify what the UI *thinks* the model is

1. Open Desktop → Chat.
2. Look at the provider label:
   - `packages/desktop/src/renderer/modes/ChatMode.tsx` renders `Provider: ${config.provider.default}`.
3. Confirm what’s stored in the persisted config:
   - macOS: `~/Library/Application Support/FlowState/config.json`
   - key path: `provider.default`

If those differ, the renderer is not reading the same config file you edited, or the config update didn’t persist.

### B) Verify what OpenCode runtime is *actually using*

1. Check the main process logs (devtools or terminal):
   - `packages/desktop/src/main/process-manager.ts` logs `Using OpenCode model: <model>` at startup.
2. Compare that log with `provider.default` to confirm parity.

If they differ, restart the OpenCode server or the app.

### C) Instrumentation (optional)

Because `opencode:status` does not include model information (see `packages/desktop/src/main/index.ts`), you can’t confirm the effective model from the UI alone.

Recommended instrumentation:

- Add a log just before `createOpencode(...)` in `packages/desktop/src/main/process-manager.ts`:
  - log the model string being passed
  - log whether it came from config or a fallback
- Extend the status payload returned by:
  - `ipcMain.handle('opencode:status', ...)` in `packages/desktop/src/main/index.ts`
  - to include something like `{ model: this.instanceModel }` stored in `ProcessManager` when starting.

### D) Confirm onboarding persisted the selection

1. Finish onboarding with a non-default model.
2. Confirm `provider.default` updated in:
   - `~/Library/Application Support/FlowState/config.json`
3. Confirm onboarding set:
   - `onboardingComplete: true`

If not persisted:
- add logs in `packages/desktop/src/renderer/App.tsx` around `updateConfig(...)` in `handleOnboardingFinish`.
- add logs in `packages/desktop/src/main/config-store.ts` inside `update()` / `save()`.

### D) Confirm OpenCode is restarting when expected

If you implement a restart flow:

- Add logs in `packages/desktop/src/main/index.ts` around any new IPC handler.
- Add logs in `packages/desktop/src/main/process-manager.ts` inside `start()` and `stop()`.

You should see a clean sequence:

- “Stopping OpenCode server…”
- “OpenCode server stopped”
- “Starting OpenCode server…”
- “OpenCode server started at …”

### E) Common failure points

- **Mismatch between “provider string” formats**:
  - Desktop uses strings like `openai/gpt-5.2` and `opencode/grok-code`.
  - Desktop default config currently uses `zen/claude-sonnet` (note: no `opencode/` prefix).
  - If you unify, define a single canonical format and validate it before passing to OpenCode.

- **Settings page confusion**:
  - `packages/desktop/src/renderer/components/SettingsPage.tsx` contains a local-only “AI Model” UI that currently does not write to persisted config.
  - For debugging model issues, rely on onboarding + persisted config, not this Settings UI.

---

## Quick reference

- Desktop runtime model + agent prompt wired at:
  - `packages/desktop/src/main/process-manager.ts`
- Desktop persisted config file implementation:
  - `packages/desktop/src/main/config-store.ts`
- Desktop persisted config file location:
  - `app.getPath('userData')/config.json` (macOS: `~/Library/Application Support/FlowState/config.json`)
- Onboarding persistence:
  - `packages/desktop/src/renderer/App.tsx` (`handleOnboardingFinish`)
- Repo OpenCode config (TUI/CLI oriented):
  - `opencode.json`
- Repo FlowState config (agents registry / metadata):
  - `flowstate.config.json`
