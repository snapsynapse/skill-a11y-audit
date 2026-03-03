---
skill_bundle: a11y-audit
file_role: handoff
version: 1
version_date: 2026-03-02
previous_version: null
change_summary: >
  Bootstrap under skill-provenance system. Initial design context,
  known constraints, and next steps.
---

# Accessibility Audit Skill -- Handoff Document

## What This Is

A Claude Code skill for running accessibility audits on web projects,
combining automated scanning with WCAG 2.1 AA compliance mapping and
structured reporting.

## Current State: v1, untested

The skill has been designed and documented but not yet run against a
real project. All eval cases are pending.

### Files in this directory

| File | Purpose |
|------|---------|
| SKILL.md | Six-phase audit pipeline (main skill) |
| MANIFEST.yaml | Bundle metadata, dependencies, file inventory |
| CHANGELOG.md | Append-only change history |
| HANDOFF.md | This file -- bootstrap context |
| evals/evals.json | 3 eval cases, pending first run |

### Downstream copies

| Location | Status |
|----------|--------|
| `PAICE2/.claude/skills/a11y-audit/` | Synced + PAICE_CONTEXT.md |

## Where to Put the Skill

- **Upstream (generic):** `/Users/snap/Git/skill-a11y-audit/`
- **Downstream (project-specific):** `.claude/skills/a11y-audit/` in the target project
- Add a `PAICE_CONTEXT.md` in the downstream copy for project-specific configuration

## Dependencies

| Dependency | Required? | Check |
|------------|-----------|-------|
| `axe-core` (npm) | Yes | `ls node_modules/axe-core` |
| `puppeteer` (npm) | Yes | `ls node_modules/puppeteer` |
| `lighthouse` (npm/CLI) | Recommended | `npx lighthouse --version` |
| `gh` (CLI) | Phase 6 only | `gh --version` |

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

5. **No CI integration.** The skill runs on demand via Claude Code. A
   separate GitHub Actions workflow would be needed for continuous
   accessibility monitoring.

6. **Label creation.** Phase 6 assumes GitHub labels already exist. It
   does not create labels. If a label does not exist, `gh issue create`
   will create it automatically, but the label will lack a description
   and color.

## Suggested Next Steps

1. Run eval-1 against the PAICE2 project with dev server running
2. Iterate on SKILL.md based on eval results (scanning script may need
   path adjustments, report format may need refinement)
3. Run eval-2 testing CAN-ASC-6.2 mapping and GitHub Issue creation
4. Add CI workflow template generation as a follow-on feature
5. Consider adding color contrast spot-checking against a project's
   design token palette (from PAICE_CONTEXT.md)
