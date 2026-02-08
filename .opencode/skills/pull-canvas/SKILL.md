---
name: pull-cavas
description: Pull Canvas assignments, courses, and details correctly.
---

# Pull Canvas assignments, courses, and details correctly

The key for pulling canvas assignments, courses, and details correctly is to use the Canvas MCP tools effectively. Here are some steps to ensure you pull the correct data:

1. ALWAYS use the Canvas MCP tools to pull data. This ensures that you are getting the most accurate and up-to-date information from Canvas.
2. CHECK every piece of data you pull, particularly assignments, courses, and details. Make sure that the data matches what is currently in Canvas. Big details are Dates, Submissions types, and Assignment Types.
3. Take your time to review the data you pull. Don't rush through it, as this can lead to mistakes. Double-check your work to ensure that everything is correct.

## Assignment Submission Status

When pulling assignment data, pay special attention to the submission status. This includes:
To pull the correct status of a submission:
Avoid The API Inconsistency
When you call list_assignments with includeSubmission=true, Canvas returns:

"submitted": true
This is INCORRECT. It does not reflect the actual submission status of the assignment.
you need to instead check within the Submission object for the correct status. The correct status will be one of the following:

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

## Course Grades

When pulling course grades, make sure to be as accurate as possible. This includes checking the grade details and ensuring that they match what is in Canvas. Pay attention to any grade changes or updates that may have occurred. For Example:

{
"course": "2026S CS 496-A",
"currentGrade": "N/A",
"currentScore": "N/A",
"finalGrade": "F",
"finalScore": "0%"
}

While this class says F and 0% that is because nothing has been graded yet! Go off of currentGrade and currentScore for the most accurate information. Make sure to take both into consideration. We don't want to incorrectly assess a students grade in classes!
