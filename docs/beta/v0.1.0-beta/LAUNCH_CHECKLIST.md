# Launch Checklist

Version: v0.1.0-beta
Build: b20260223.1eefaa4
Last Updated: 2026-02-23
Owner: FlowState PM
Applies To: phase.beta.5 launch gate

## Artifact Completeness
- [x] DMG + ZIP staged in `packages/desktop/out/release/` for arm64 and x64
- [x] `SHA256SUMS.txt` present and verified
- [x] `artifact-manifest.json` present and verified

## Cohort Coverage Matrix
- [ ] Apple Silicon tester #1 completed
- [ ] Apple Silicon tester #2 completed
- [ ] Intel tester completed
- [ ] At least 2 macOS versions represented

## First-Run Rubric (T1-T5)
- [ ] 4/5 complete in <=15 minutes
- [ ] 4/5 require no more than one minor hint
- [ ] 0 reproducible P0/P1 onboarding blockers
- [ ] 5/5 feedback submissions captured

## Reviewer Sign-Off
- [x] Quality (release owner) - packaging pipeline + artifact integrity verified
- [x] Security/Privacy (verifier owner) - redaction and telemetry-default policies documented/verified
- [ ] UX readiness (product owner) - pending completion of live T1-T5 cohort runs

## Release Actions
- [x] Draft GitHub release created (`v0.1.0-beta+b20260223.1eefaa4`)
- [x] Release assets uploaded (arm64+x64 DMG/ZIP, SHA256SUMS, artifact manifest)
- [x] Invite packet prepared (`INVITE_PACKET.md`)
- [ ] Invite packet sent to approved cohort

## Remaining Manual Prerequisites (Launch GO Blockers)
- [ ] Execute and record live T1-T5 non-technical first-run sessions
- [ ] Complete cohort matrix with 2 Apple Silicon + 1 Intel across >=2 macOS versions
- [ ] Product owner UX sign-off after reviewing cohort outcomes
- [ ] Send tester invite packet to approved private cohort
