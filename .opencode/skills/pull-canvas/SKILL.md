---
name: pull-canvas
description: Pull Canvas courses/files/assignments accurately with correct file ID resolution and safe reauthentication guidance.
---

## Pull Canvas data accurately

Accurate Canvas responses require strict tool sequencing and ID hygiene.

1. Always use Canvas MCP tools for fresh data.
2. Never infer IDs from URL patterns.
3. Verify each critical field before final output.

## Required file-reading sequence

When the user asks for lecture/slides/doc text, follow this exact flow:

1. Resolve course scope:
   - `canvas_list_courses` -> confirm target course ID.
2. Resolve file IDs (authoritative):
   - `canvas_list_course_files(courseId)` -> map `display_name`/`filename` to `id`.
3. Read file text with real file IDs only:
   - `canvas_read_file_text(fileId)`.
4. If needed, enrich with assignment context:
   - `canvas_get_assignment`, `canvas_get_submission`, `canvas_read_submission_attachment_text`.

Do not pass module item IDs to `canvas_read_file_text`. Module item IDs are not Canvas file IDs.

## Module items and IDs

- `canvas_get_module_items` returns module item IDs for module navigation.
- Treat module item IDs as non-file IDs unless a file ID field is explicitly present.
- If file ID mapping is unclear, fall back to `canvas_list_course_files` before attempting any file read.

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

## Handling session timeouts

If Canvas auth fails (`unauthorized`, `expired session`, or repeated file-read failures):

1. Stop retrying credential-refresh actions inside the agent.
2. Tell the user to reauthenticate from Integrations -> Canvas.
3. After the user confirms, run a lightweight tool check:
   - `canvas_list_courses` or `canvas_get_upcoming`.
4. Resume document pulls only after the check succeeds.

Do not attempt or mention `canvas_auth_browser_login` in agent execution.

## Output truthfulness rule

Never claim document access succeeded unless at least one `canvas_read_file_text`/`canvas_read_submission_attachment_text` call returned extracted content.

If all reads fail, explicitly report the failure and the next recovery step.
