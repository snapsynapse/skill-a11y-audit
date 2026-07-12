---
skill_bundle: a11y-audit
file_role: handoff
version: 15
version_date: 2026-07-11
previous_version: 14
change_summary: >
  Recorded the 2026-07-11 durability review: axe-core version pinning
  and cross-version delta guards implemented, the stale no-CI claims
  corrected, and the durability/relevance/value roadmap logged.
---

# Accessibility Audit Skill -- Handoff Document

## What This Is

A portable accessibility-audit skill bundle for Claude Code and Codex.
The core workflow lives in `SKILL.md`; platform-specific notes live in
`references/claude-code.md` and `references/codex.md`.

## Current State: bundle v20 (release v2.2.0), self-contained and executable-eval validated

The workflow has been run successfully in Claude Code for eval-1. Codex
eval-1 has been exercised against PAICE2. The bundle now includes
reusable scripts, focused reference files, expanded eval coverage,
sample output artifacts, and a CI template. The direct degraded paths
for Lighthouse-unavailable, runtime URL reconciliation, first-run
context creation, and missing-browser-automation handling have been
validated. The repo now has a deterministic offline eval runner wired to
`npm run validate`, which is also the GitHub Actions validation command.

The three most recent correctness issues are now resolved:

- `discover.js` preserves published sitemap URLs across `robots.txt`,
  sitemap indexes, nested sitemap files, and redirects instead of
  rewriting them onto the runtime origin.
- Representative page selection is deterministic across repeated runs.
- `report.js` delta comparison is page-aware and reports rule movement
  even when total instance counts stay flat.

Those fixes now have runnable local regression fixtures:

- `eval-2` covers context-aware issue planning, standards carry-through,
  configured labels, thresholding, and duplicate skipping in dry-run mode
- `eval-3` covers quick-scan summary behavior without report generation
- `eval-4` covers skipped-Lighthouse markdown and JSON report contracts
- `eval-9` covers cross-origin sitemap preservation
- `eval-10` covers deterministic discovery across repeated runs
- `eval-11` covers page-aware delta reporting

A full audit was run 2026-03-26 against the AI Regulation Reference
(10-page static HTML site, http://127.0.0.1:8081). The audit found
3 rules / 69 instances (color-contrast, landmark-one-main, region),
all of which were remediated to zero violations. This run revealed
four token-efficiency improvements, all now implemented in v10.

### Files in this directory

| File | Purpose |
|------|---------|
| SKILL.md | Portable six-phase audit pipeline (main skill) |
| MANIFEST.yaml | Bundle metadata, dependencies, file inventory |
| CHANGELOG.md | Append-only change history |
| HANDOFF.md | This file -- current state and next steps |
| evals/evals.json | 11 eval cases with passing results recorded for eval-1 through eval-11 where deterministic or prior runtime validation exists |
| evals/run-evals.js | Offline executable eval and validation runner |
| references/claude-code.md | Claude-specific launch and Preview notes |
| references/codex.md | Codex-specific execution notes |
| references/output-contract.md | Markdown/JSON output rules |
| references/issue-trackers.md | Issue creation and deduplication rules |
| references/output-schema.json | Stable JSON output schema |
| references/project-context-template.md | Canonical context-file contract |
| scripts/scan.js | Reusable axe-based scanning helper (--summary flag) |
| scripts/bootstrap-context.js | First-run context bootstrap helper |
| scripts/discover.js | Template-aware page discovery and sampling |
| scripts/report.js | Deterministic report generator for Phases 3+5 |
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

3. **axe-core version coupling — now mitigated.** Results depend on the
   installed axe-core version. As of v2.2.0, auto-install pins a
   known-good version (`--axe-version` overrides), scan output records
   the resolved `axe_version`, and report.js flags deltas computed
   across different axe-core versions instead of presenting rule-set
   drift as regressions or fixes. Residual coupling: a project-resolved
   axe-core still wins the lookup, so version can vary per target
   project (recorded, and flagged on comparison).

4. **Lighthouse variance.** Lighthouse scores vary between runs due to
   rendering timing. The skill runs once per page and reports the result;
   it does not average multiple runs.

5. **Lighthouse optionality is real.** Some projects will have
   `axe-core` and browser automation installed but no runnable
   Lighthouse CLI. The skill now treats this as a normal degraded mode
   and requires the report to state the skip reason explicitly.

6. **No hosted continuous monitoring.** CI gating exists — the composite
   action at `.github/actions/scan` (v2.1.0) runs the scanner on push/PR
   and fails on violations, and `assets/ci/github-actions/` has a
   workflow starter — but there is no scheduled scanning service,
   dashboard, or trend store beyond the `markdown+json` artifacts.

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

## Completed: Token-Efficiency Improvements (v10)

All four improvements from the 2026-03-26 audit are now implemented:

1. **`scripts/report.js`** (~3000 tokens saved): Deterministic report
   generator with hardcoded 50 WCAG 2.1 AA criteria, axe tag mapping,
   violation aggregation, color-contrast detail extraction, and output
   generation per output-contract.md and output-schema.json.
2. **`--summary` flag on scan.js** (~500 tokens saved): Strips node
   detail from passes/inapplicable arrays, adds per-page counts.
3. **Phase 1 condensed** (~500 tokens saved): Replaced ~30-line
   enumeration with ~10 focused lines.
4. **Reference reads removed** (~800 tokens saved): Phase 5 invokes
   report.js directly; agent no longer reads output-contract.md or
   output-schema.json during normal runs.

## Roadmap (2026-07-11 durability review)

A review of the skill against the current tool/skill landscape found it
*more* load-bearing than at creation: `audit-orchestrator` dispatches to
it, `canonical-spec-page` depends on it for its WCAG pass, and
`gh-notifications` treats the composite action as the canonical fix for
hand-rolled a11y CI. The moat is deterministic, CI-gateable, selector-
level evidence (exact ratios, instance counts, template grouping) that a
model reading source cannot reliably reproduce. The roadmap below keeps
that moat sharp.

### Done in v2.2.0

- axe-core version pinning + `axe_version` recording (scan.js v6)
- Cross-version delta guard in report.js v3 (mismatch caution in
  markdown + `axeVersionMismatch` in JSON)
- Stale "does not run in CI" claims corrected in SKILL.md and this file

### Next, in priority order

1. **Pluggable standards data (durability + relevance).** report.js
   hardcodes the 50 WCAG 2.1 AA criteria. Extract criteria matrices to
   data files (`standards/wcag21-aa.json`, `wcag22-aa.json`,
   `en301549.json`) selected via `PROJECT_CONTEXT.md`. Keep WCAG 2.1 AA
   the default — ADA Title II and current EN 301 549 cite it — but add
   WCAG 2.2 AA (six new A/AA criteria: 2.4.11, 2.5.7, 2.5.8, 3.2.6,
   3.3.7, 3.3.8) and an EN 301 549 mapping. Regulatory context is the
   demand engine: EAA enforced since June 2025; ADA Title II deadline
   for large US public entities passed April 2026 (small entities April
   2027). Lead positioning (README, skilla11y.dev) with the deadlines.
2. **SARIF emitter (value, small effort).** One more output format in
   report.js unlocks GitHub Code Scanning: violations as PR annotations,
   trend tracking in the Security tab, no dashboard to build. Makes the
   composite action dramatically stickier.
3. **CI baseline — `fail-on: new` (adoption unlock).** The action
   currently fails on any violation, so legacy sites can never enable
   the gate. Add an accepted-violations baseline file (à la ESLint/
   Semgrep) so CI fails only on violations not in the baseline.
4. **First-class Playwright support in scan.js.** Playwright is now the
   majority choice; the documented "adapt it yourself" path invites the
   ad hoc scripts the bundled scanner exists to prevent.
5. **Remediation handoff artifact.** Keep the auditor/fixer boundary,
   but emit an optional `fix-plan.json` (violation → selector → file
   hint → remediation recipe, ordered by template-group impact) that a
   downstream coding agent can consume as a work order.
6. **Authenticated pages.** Cookie/header injection or a storage-state
   file for scan.js opens everything behind a login wall — where most
   real app surface lives (see Known Limitation 2).
7. **MCP server packaging.** Wrap scan/discover/report as MCP tools
   (see the portfolio `mcp-server-publish` skill) for a second
   distribution channel independent of skill-format churn.

### Standing hygiene

- Run eval-2 against a real authenticated tracker for full live
  issue-mode validation (still pending)
- Use `scripts/plan-issues.js` as the default dry-run step before any
  live ticket creation
- Copy updated skill back to `.claude/skills/a11y-audit/` in target
  projects
- Keep new regression fixes covered by `npm run validate` before
  updating bundle metadata
