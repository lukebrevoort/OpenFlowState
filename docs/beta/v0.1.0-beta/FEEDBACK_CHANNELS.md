# Feedback Channels

Version: v0.1.0-beta
Build: b20260223.1eefaa4
Last Updated: 2026-02-23
Owner: FlowState PM
Applies To: beta feedback collection

## Primary Channel
- In-app action: `Send Beta Feedback`
- Placement: `Settings > Help` and onboarding completion screen.
- Prefill metadata: app version, build id, macOS version, active integrations, timestamp.
- Excluded data: secrets, OAuth codes, token values, raw email bodies.

## Fallback Channel
- Trigger: primary submission path fails.
- UI behavior: show `Fallback: Email Feedback` with one-click copy of sanitized payload.
- Destination: `flowstate-beta@proton.me`
- Subject format: `FlowState Beta Feedback - v<version>+<build>`
