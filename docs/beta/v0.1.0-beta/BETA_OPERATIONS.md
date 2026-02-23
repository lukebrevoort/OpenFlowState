# Beta Operations Playbook

Version: v0.1.0-beta
Build: b20260223.1eefaa4
Last Updated: 2026-02-23
Owner: FlowState PM
Applies To: phase.beta.4 operations

## Severity + SLA
- P0: acknowledge <= 30m, owner <= 1h, mitigation decision <= 4h
- P1: acknowledge <= 2h, owner <= 4h, fix/workaround <= 24h
- P2: acknowledge <= 1 business day, triage <= 2 business days
- P3: acknowledge <= 2 business days, weekly backlog prioritization

## Required Issue Fields
- Severity (`P0`-`P3`)
- Owner
- Status
- Next update time
- Build and macOS version
- Device architecture

## Cadence
- Daily 15m triage standup during active beta weeks
- Weekly ops review reporting P0/P1 volume and response metrics

## Hotfix Trigger
- Any P0 issue or repeated P1 issue with no safe workaround triggers hotfix path.

## Evidence References
- Hotfix dry-run evidence: `HOTFIX_DRY_RUN.md`
- Rollback communication template: `ROLLBACK_TEMPLATE.md`
