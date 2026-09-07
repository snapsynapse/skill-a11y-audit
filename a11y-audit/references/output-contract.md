---
skill_bundle: a11y-audit
file_role: reference
version: 4
version_date: 2026-09-07
previous_version: 3
change_summary: >
  Adds major-gate acceptance and incomplete-review evidence.
---

# Output Contract

Read this file when generating audit deliverables.

## Markdown Report

Write a markdown report with these sections in order:

1. Header
2. Executive Summary
3. Automated Scan Results
4. Configured Standard Automated Evidence Matrix
5. Delta from Previous Audit
6. Project-Specific Standard
7. Manual Testing Recommendations
8. Remediation Priority
9. Issues Created
10. Methodology

Rules:

- Use valid GFM tables.
- Reference WCAG criteria as `SC X.X.X`.
- Use axe `helpUrl` links when available.
- Omit sections that are truly empty.
- If Lighthouse was skipped, say why in both Executive Summary and Methodology.
- If the runtime URL differs from the expected URL, record both.
- Phrase compliance status conservatively: this is an automation-assisted audit view, not a conformance certification.
- When a major-findings gate was evaluated, report `pass`, `fail`, or
  `inconclusive` separately from the severity table. A pass is scoped automated
  evidence only.
- List axe `incomplete` counts as review candidates, not confirmed violations.
- In the criteria matrix, use `Fail` when confirmed failure evidence exists;
  otherwise use `Needs review` when axe returned an incomplete candidate, even
  if another automated rule for that criterion passed.

## JSON Output

When `output_mode` is `markdown+json` or `markdown+issues`, write a JSON
file alongside the markdown report. Use the versioned schema in
`references/output-schema.json`, whose canonical id is
`https://skilla11y.dev/schema/audit-v1.json`.

The additive `audit_evidence` object retains violation and incomplete counts by
impact. When `--fail-on major` was used, `acceptance` records the result and its
reasons. `criterion_review` carries `needs-review` criteria separately so the
published v1 `matrix` vocabulary remains unchanged; the corresponding v1
matrix value is `manual`, never an unqualified `pass`. Existing consumers may
continue to read the original required fields.

## Delta Section

- Include this section only if a prior audit output exists.
- Show new violations, resolved violations, and score changes when you
  have enough evidence to compare runs.
- If comparison data is missing or non-comparable, omit the section
  rather than inventing a weak delta.

## Degraded Modes

- If Lighthouse is missing, write `lighthouse.status: "skipped"` in the
  JSON output and explain the reason.
- If browser automation is blocked entirely, do not generate a fake
  report. Summarize the blocker and produce the highest-value partial
  output the workspace supports.
