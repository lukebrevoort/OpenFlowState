---
name: pull-canvas
description: Pull Canvas assignments, courses, and details correctly.
---

## Pull Canvas assignments, courses, and details correctly

Accurate Canvas data starts with following the MCP workflow and validating every step. These reminders keep pulls trustworthy:

1. **Always run the Canvas MCP tooling** (listings, courses, assignments, etc.) to stay aligned with the freshest data.
2. **Validate every field you consume.** Dates, submission types, assignment types, and weights are often changing—cross-check with Canvas before reporting changes.
3. **Slow down on review.** Double-check edge cases before sharing output so you don’t accidentally surface stale or partial information.

## Assignment Submission Status

Canvas’s `list_assignments` endpoint can be misleading when `includeSubmission=true` because it returns `"submitted": true` regardless of the actual status. Instead, always inspect the nested `submission` object; its `status` field shows the real state. Example:

```json
{
  "status": "unsubmitted",
  "submittedAt": "Not submitted",
  "score": null,
  "grade": null,
  "late": false,
  "missing": false,
  "excused": null,
  "attempt": null
}
```

Use this object as the source of truth for submission state, timestamps, and grades.

## Course Grades

When reporting course grades, rely on `currentGrade` and `currentScore` rather than final fields—`finalGrade` may default to `F` or `0%` until anything is graded. For example:

```json
{
  "course": "2026S CS 496-A",
  "currentGrade": "N/A",
  "currentScore": "N/A",
  "finalGrade": "F",
  "finalScore": "0%"
}
```

In this case the course shows `F/0%` because nothing is graded yet; rely on `current*` values to convey the student’s latest standing.

## Handling Session Timeouts

Canvas sessions occasionally time out even after a successful init/finish cycle. When the agent detects a timeout, always run a quick connection test (e.g., fetch current user or list a lightweight endpoint) before reporting data. This confirms the session is active and prevents outdated responses.

## Using the MCP Re-Auth Tool

If a session expires or Canvas rejects requests, run the MCP Re-Auth tool immediately. Follow these steps:

1. Trigger the MCP Re-Auth flow and complete any interactive prompts.
2. After the flow finishes, run the same connection test mentioned above to validate the new session.
3. Only resume data collection once the re-authenticated session is confirmed to succeed.

Consistently testing the connection post-reauth ensures the agent only uses fresh credentials and minimizes downstream errors.
