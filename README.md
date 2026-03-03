# a11y-audit

Portable accessibility-audit skill bundle for Claude Code and Codex.

This repository packages a reusable agent skill for auditing web
projects with `axe-core`, optional Lighthouse checks, WCAG 2.1 AA
mapping, manual follow-up guidance, and configurable output modes.

## Repository Layout

- `a11y-audit/SKILL.md`: core skill instructions
- `a11y-audit/references/`: focused reference material
- `a11y-audit/scripts/`: reusable helper scripts
- `a11y-audit/evals/evals.json`: eval cases and recorded results
- `a11y-audit/assets/`: sample outputs and CI starter assets
- `a11y-audit/MANIFEST.yaml`: bundle inventory and versioned hashes
- `a11y-audit/CHANGELOG.md`: bundle change history
- `a11y-audit/HANDOFF.md`: current validation status and next steps

## What It Supports

- Workspace-local `.a11y-audit/PROJECT_CONTEXT.md` configuration
- `markdown`, `markdown+json`, and `markdown+issues` output modes
- Runtime URL reconciliation when the expected local port is wrong
- Explicit degraded-mode behavior when Lighthouse is unavailable
- Reusable helper scripts for first-run context creation and scanning

## Install

### Codex

Copy or symlink the `a11y-audit/` folder into your Codex skills
directory.

### Claude Code

Copy the `a11y-audit/` folder into `.claude/skills/` in the target
project.

## Use

Typical prompts:

- `Run an accessibility audit on this project.`
- `Audit this app for WCAG 2.1 AA issues and generate a markdown report.`
- `Use $a11y-audit to scan the homepage, about page, and contact page.`

For project-specific setup, create `.a11y-audit/PROJECT_CONTEXT.md` in
the target workspace or use `a11y-audit/scripts/bootstrap-context.js`.

## Validation

This repo includes:

- bundled eval definitions in `a11y-audit/evals/evals.json`
- sample output artifacts in `a11y-audit/assets/sample-output/`
- a lightweight GitHub Actions validation workflow in
  `.github/workflows/validate-skill.yml`

## Status

The bundle has been structurally validated and exercised in Codex and Claude Code for:

- core audit execution
- runtime URL reconciliation
- Lighthouse-unavailable degraded mode

Still pending as direct end-to-end runs:

- issue creation and deduplication
- missing browser automation handling
- first-run context creation in a real project

## License

MIT
