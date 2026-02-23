# Cohort Execution Kit

Version: v0.1.0-beta
Build: b20260223.1eefaa4
Last Updated: 2026-02-23
Owner: FlowState PM
Applies To: phase.beta.5 live cohort execution

## Required Coverage
- 2 Apple Silicon testers
- 1 Intel tester
- At least 2 macOS versions total

## Per-Session Protocol (T1-T5)
1. Confirm clean state (`/Applications/FlowState.app` reinstall + support dir reset).
2. Start timer at first launch.
3. Complete one guided action (chat response or bundled workflow terminal run).
4. Submit feedback via primary/fallback channel.
5. Record duration, assistance level, blockers, and feedback path.

## Evidence Collection
- Update `FIRST_RUN_VALIDATION.md` row for each tester.
- Save screenshot of successful app launch and feedback submission.
- Record architecture + macOS version for each tester.

## Completion Workflow
1. Fill all T1-T5 rows.
2. Compute rubric outcomes in `FIRST_RUN_VALIDATION.md`.
3. Update `LAUNCH_CHECKLIST.md` cohort matrix and rubric checkboxes.
4. Request UX sign-off after rubric summary is complete.
5. Send invite packet and mark launch checklist release action complete.
