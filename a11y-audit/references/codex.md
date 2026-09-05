---
skill_bundle: a11y-audit
file_role: reference
version: 2
version_date: 2026-09-05
previous_version: 1
change_summary: >
  Adds v3 runtime and managed browser installation guidance.
---

# Codex Notes

Use this file only when running the skill in Codex.

## Runtime and installation

Verify Node.js 22.12.0 or later before invoking the bundled helpers. Read
`runtime-compatibility.md` when installing or upgrading the skill, changing
browser caches, or using skip-download settings. Installation may replace
stale skill-local Puppeteer and download Chrome; establish that scope before
running a scan. The bundled scanner supports Puppeteer only.

## Dev Server Discovery

- Check `package.json`, repo docs, and existing running processes first.
- Treat `.claude/launch.json` as an optional repo artifact if it exists;
  do not assume Claude Preview tooling is available.
- If the workspace contains multiple frontend apps, identify the target
  app before scanning or state the assumption explicitly.

## Workspace-Local Context

- Store mutable audit preferences in the target workspace, not in the
  installed skill directory.
- Default path: `.a11y-audit/PROJECT_CONTEXT.md` at the workspace root.
- Reuse an existing project-local context file when present; otherwise,
  create the default file only after confirming the audit scope.

## Practical Guidance

- Use existing installation authority for missing packages or stale managed
  Puppeteer replacement; ask if that scope is not yet authorized.
- Prefer project-local commands and dependencies over global tooling.
- If browser automation is blocked by missing dependencies or a missing
  running app, summarize the blocker and continue with the highest-value
  partial audit the workspace supports.
