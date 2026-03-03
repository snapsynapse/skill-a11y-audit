---
skill_bundle: a11y-audit
file_role: handoff
version: 6
version_date: 2026-03-03
previous_version: 5
change_summary: >
  Validated first-run context creation and missing-browser-automation
  handling directly, and added a non-destructive issue-planning helper.
---

# Accessibility Audit Skill -- Handoff Document

## What This Is

A portable accessibility-audit skill bundle for Claude Code and Codex.
The core workflow lives in `SKILL.md`; platform-specific notes live in
`references/claude-code.md` and `references/codex.md`.

## Current State: v9, mostly validated

The workflow has been run successfully in Claude Code for eval-1. Codex
eval-1 has been exercised against PAICE2. The bundle now includes
reusable scripts, focused reference files, expanded eval coverage,
sample output artifacts, and a CI template. The main unvalidated areas
are now live tracker execution and deduplication against a real
authenticated issue system. The direct degraded paths for
Lighthouse-unavailable, runtime URL reconciliation, first-run context
creation, and missing-browser-automation handling have been validated.

### Files in this directory

| File | Purpose |
|------|---------|
| SKILL.md | Portable six-phase audit pipeline (main skill) |
| MANIFEST.yaml | Bundle metadata, dependencies, file inventory |
| CHANGELOG.md | Append-only change history |
| HANDOFF.md | This file -- current state and next steps |
| evals/evals.json | 8 eval cases with direct results for eval-1, eval-4, and eval-5 |
| references/claude-code.md | Claude-specific launch and Preview notes |
| references/codex.md | Codex-specific execution notes |
| references/output-contract.md | Markdown/JSON output rules |
| references/issue-trackers.md | Issue creation and deduplication rules |
| references/output-schema.json | Stable JSON output schema |
| references/project-context-template.md | Canonical context-file contract |
| scripts/scan.js | Reusable axe-based scanning helper |
| scripts/bootstrap-context.js | First-run context bootstrap helper |
| scripts/plan-issues.js | Non-destructive issue planning helper |
| assets/sample-output/ | Sample markdown and JSON artifacts |
| assets/ci/github-actions/accessibility-audit.yml | CI workflow starter |
| agents/openai.yaml | Codex UI metadata |

## Where to Put the Skill

- **Upstream (generic):** `/Users/snap/Git/skill-a11y-audit/`
- **Claude install:** `.claude/skills/a11y-audit/` in the target project
- **Codex install:** `$CODEX_HOME/skills/a11y-audit/` or equivalent skill import path
- **Project-specific mutable state:** `.a11y-audit/PROJECT_CONTEXT.md` in the target workspace

## Dependencies

| Dependency | Required? | Check |
|------------|-----------|-------|
| `axe-core` (npm) | Yes | `ls node_modules/axe-core` |
| `puppeteer` or `playwright` (npm) | Yes | `ls node_modules/puppeteer` or `ls node_modules/playwright` |
| `lighthouse` (npm/CLI) | Recommended | `npx lighthouse --version` |
| issue tracker CLI | Phase 6 only | `gh --version`, `glab --version`, or tracker equivalent |

## Known Limitations

1. **No real AT testing.** The skill runs headless Chromium only. Screen
   reader, voice control, and mobile AT testing require manual procedures.
   Phase 4 generates checklists for this.

2. **SPA navigation.** For single-page applications, the scanning script
   navigates via direct URL. Pages that require client-side routing state
   (e.g., post-login pages, multi-step flows) may not render correctly in
   headless mode. The user may need to provide authenticated session
   cookies or skip those routes.

3. **axe-core version coupling.** Results depend on the installed
   axe-core version. Different versions may report different violations.
   The report records the version used.

4. **Lighthouse variance.** Lighthouse scores vary between runs due to
   rendering timing. The skill runs once per page and reports the result;
   it does not average multiple runs.

5. **Lighthouse optionality is real.** Some projects will have
   `axe-core` and browser automation installed but no runnable
   Lighthouse CLI. The skill now treats this as a normal degraded mode
   and requires the report to state the skip reason explicitly.

6. **No CI integration.** The skill runs on demand via an interactive agent. A
   separate GitHub Actions workflow would be needed for continuous
   accessibility monitoring.

7. **Label creation.** Phase 6 assumes GitHub labels already exist. It
   does not create labels. If a label does not exist, `gh issue create`
   will create it automatically, but the label will lack a description
   and color.

8. **Expected URL drift.** Local dev servers may bind to a different
   port than the prompt or context file expects. The skill now updates
   the workspace-local context to the working URL and records the
   mismatch in the report methodology.

9. **Puppeteer-first scanner.** The bundled scanner currently supports
   Puppeteer directly. Playwright remains a documented fallback path in
   the skill, but the helper script has not been expanded to first-class
   Playwright support yet.

10. **Live issue tracker path still pending.** The skill now has
   explicit issue-tracker reference guidance, a non-destructive issue
   planner, and deduplication keys, but the end-to-end authenticated
   ticket creation path has not yet been re-run after the refactor.

## Suggested Next Steps

1. Run eval-2 against a real authenticated tracker if you want full live issue-mode validation before or after publishing
2. Keep `scripts/scan.js` Puppeteer-first unless a Playwright-native project forces expansion
3. Use `scripts/plan-issues.js` as the default dry-run step before any live ticket creation
4. The CI template is now referenced directly from `SKILL.md`; use it as the default starting point for operationalized audits
