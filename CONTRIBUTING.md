# Contributing

## Scope

This repository packages a public agent skill bundle. Keep changes
focused on:

- skill behavior
- bundled references
- bundled helper scripts
- eval coverage
- sample artifacts
- repository validation and publishing support

## Before Opening a PR

Run the same validation command used in the GitHub Actions workflow:

```bash
npm run validate
```

If you update bundle files, also keep these in sync:

- `a11y-audit/MANIFEST.yaml`
- `a11y-audit/CHANGELOG.md`
- `a11y-audit/HANDOFF.md`

## Editing Rules

- Keep `a11y-audit/SKILL.md` portable across Claude Code and Codex.
- Put detailed or variant-specific guidance in `references/` rather than
  bloating `SKILL.md`.
- Prefer updating bundled scripts in `scripts/` over reintroducing large
  inline code templates.
- Keep mutable project state out of the skill directory. Use
  workspace-local `.a11y-audit/PROJECT_CONTEXT.md`.

## Validation Philosophy

- Structural validation is not enough when behavior changes.
- If you change runtime behavior, add or update an executable eval in
  `a11y-audit/evals/run-evals.js` and record the expectation in
  `a11y-audit/evals/evals.json`.
- If you add a new helper or output mode, include at least one sample
  artifact or explicit eval expectation.

## Pull Requests

Include:

- what changed
- why it changed
- how it was validated
- any remaining gaps or unvalidated paths
