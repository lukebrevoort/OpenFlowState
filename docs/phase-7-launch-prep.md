# Phase 7 Launch Prep

This guide covers the minimum launch-prep artifacts for Phase 7: an unsigned macOS DMG and a reproducible beta demo capture flow.

## 1) Build Unsigned DMG (Desktop)

Source of truth: `packages/desktop/package.json` scripts and `build` config.

### Command

From repo root:

```bash
pnpm --filter @flowstate/desktop run package:mac
```

Equivalent from `packages/desktop/`:

```bash
npm run package:mac
```

What this does (per script):

1. Runs `npm run build` (main + preload + renderer).
2. Runs `electron-builder --mac`.
3. Produces macOS targets configured in package metadata (`dmg` and `zip`).

### Expected Artifacts and Locations

All packaging outputs are written to:

`packages/desktop/out/`

Expected files:

- `FlowState-0.1.0*.dmg` (unsigned installer image)
- `FlowState-0.1.0*.zip` (unsigned zip target)
- `mac*/FlowState.app` (packaged app bundle used to create installer artifacts)

Notes:

- `*` varies by architecture/build host (for example arm64/x64 suffixes).
- Version comes from `packages/desktop/package.json` (`0.1.0` at time of writing).

### Quick Validation Checklist

- Command exits successfully with no Electron Builder errors.
- `packages/desktop/out/` contains at least one `.dmg` and one `.zip`.
- DMG mounts on macOS and contains `FlowState.app`.
- `FlowState.app` launches locally from mounted DMG or extracted app bundle.
- Basic smoke check passes (open app, start a session, no immediate crash).

## 2) Reproducible Demo Capture (Beta Readiness)

Use this same flow for every beta demo capture so output is consistent across runs.

### Capture Setup

1. Use the latest local `main` branch state intended for beta demo.
2. Build/package once first (`pnpm --filter @flowstate/desktop run package:mac`).
3. Launch desktop app from packaged output (`packages/desktop/out/mac*/FlowState.app`) for realistic behavior.
4. Prepare a single scripted demo prompt/workflow in advance (do not improvise).

### Demo Recording Flow (Suggested Order)

1. Open app and show clean start state.
2. Run onboarding/connect step(s) required for the chosen workflow.
3. Execute one end-to-end workflow run.
4. Show at least one approval interaction.
5. Show final saved output/result state.
6. End with app still responsive (no pending errors/crashes).

### Demo Capture Checklist

- Recording includes the full flow in one continuous take.
- Any credentials or personal data are masked/redacted before sharing.
- UI text is readable at normal playback resolution.
- Timeline/progress state is visible during execution.
- Final state clearly proves success (completed run + output present).
- Store final video with date/version in filename for traceability.

## 3) Phase 7 Deliverable Snapshot

Before marking launch-prep complete, ensure all three exist:

- Unsigned DMG in `packages/desktop/out/`
- Unsigned ZIP companion artifact in `packages/desktop/out/`
- One reproducible demo recording following the checklist above
