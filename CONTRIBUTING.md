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

Use Node.js 22.12.0 or later. The CI matrix includes the exact minimum.

Run the same validation command used in the GitHub Actions workflow:
Literal
```bash
npm run validate
```

For scanner runtime or dependency changes, also run `npm run eval:browser`
and `npm run eval:consumer`. The consumer check needs Ruby, npm, network,
and loopback access; it downloads Chrome into a temporary cache and executes
the Action shell steps from a separate workspace. Hosted CI still validates
setup-node, artifact uploads, and actual pull-request base/head objects.

If you update bundle files, also keep these in sync:

- `a11y-audit/MANIFEST.yaml`
- `a11y-audit/CHANGELOG.md`
- `a11y-audit/ROADMAP.md` when priorities or product boundaries change

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
