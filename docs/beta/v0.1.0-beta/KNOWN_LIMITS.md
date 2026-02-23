# Known Limits

Version: v0.1.0-beta
Build: b20260223.1eefaa4
Last Updated: 2026-02-23
Owner: FlowState PM
Applies To: v0.1.0-beta private cohort

## Active Limits
- `P1` Intel/macOS-matrix validation is pending until cohort testing window (phase.beta.5).
  - Workaround: prioritize Apple Silicon testers for first wave.
- `P2` App is unsigned, requiring first-launch Gatekeeper bypass.
  - Workaround: Finder Open flow documented in `BETA_GUIDE.md`.
- `P3` Lint pipeline currently has zero runnable tasks in turbo.
  - Workaround: rely on typecheck + test + package gate; lint task setup tracked post-beta.
