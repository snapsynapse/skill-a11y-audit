---
skill_bundle: a11y-audit
file_role: handoff
version: 18
version_date: 2026-07-13
previous_version: 17
change_summary: >
  Records v2.4.0 pluggable standards data (wcag21-aa default, wcag22-aa,
  en301549) and reprioritizes the roadmap accordingly.
---

# Accessibility Audit Skill -- Handoff Document

## What This Is

A portable accessibility-audit skill bundle for Claude Code and Codex.
The core workflow lives in `SKILL.md`; platform-specific notes live in
`references/claude-code.md` and `references/codex.md`.

## Current State: bundle v23 (release v2.4.0), self-contained and executable-eval validated

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

## Roadmap (2026-07-11 external landscape refresh)

The category changed materially after this skill launched. Community
Access Accessibility Agents now covers broad agent guidance, Playwright
behavioral scanning, remediation, re-verification, WCAG 2.2, SARIF, MCP,
VPATs, and multiple coding-agent platforms. A11y MCP exposes axe scans
directly to agents, while Playwright, Storybook, Lighthouse CI, and paid
platforms already provide mature runtime and CI surfaces.

Do not compete on breadth. This project's defensible position is an
**open, self-hosted accessibility regression gate for large web estates**:
deterministic template-aware sampling, selector-level evidence, stable
comparison, and legacy-friendly CI adoption. It complements broader agent
systems and manual accessibility practice; it does not certify conformance,
remediate code, or replace enterprise monitoring.

### Done in v2.2.0

- axe-core version pinning + `axe_version` recording (scan.js v6)
- Cross-version delta guard in report.js v3 (mismatch caution in
  markdown + `axeVersionMismatch` in JSON)
- Stale "does not run in CI" claims corrected in SKILL.md and this file

### Done in v2.3.0

- Accepted baseline artifact with stable finding fingerprints
- `--baseline <path> --fail-on new` legacy-friendly regression gate
- `--write-baseline <path>` explicit baseline creation workflow
- axe-core version guard during baseline comparison
- GitHub composite Action inputs for baseline mode
- Repository-local `.a11y-audit/PROJECT_CONTEXT.md` recording audit scope
  and the narrower product boundary
- Generated-report terminology changed from compliance matrix to automated
  evidence matrix
- Codex skill frontmatter returned to the minimal `name` + `description`
  contract
- Public web page now explains product fit, baseline adoption, and explicit
  non-claims; Claude Code and Codex installation paths are both documented
- Agent entry points (SKILL description, OpenAI UI metadata, llms surfaces,
  and assistant guide v0.3.2) now use the same regression-gate contract

### Done in v2.3.1

- Public installation now starts from the GitHub repository with
  `npx skills add`; it no longer assumes a clone already exists
- Claude Code paths remain `.claude/skills`; current Codex paths are
  `.agents/skills`, replacing the stale `.codex/skills` instruction
- Assistant guide v0.3.3 now targets GuideCheck profile 0.7.0, fits the
  8 KiB and 120-byte-line envelope, and hash-pins local script entry points
- The pinned GuideCheck 0.7.0 reference verifier is a CI release gate
- Eval-14 prevents install-surface, hosted-guide, manifest, byte-profile,
  and executable-hash drift

### Done in v2.4.0

- Criteria matrices extracted from report.js into
  `references/standards/*.json`, selected via `--standard <id>` with
  strict id validation
- `wcag21-aa` remains the default (behavior-identical); `wcag22-aa`
  adds the six new A/AA criteria and removes 4.1.1 Parsing; `en301549`
  renders V3.2.1 clause-9 numbers over the one-to-one WCAG 2.1 mapping
- Report header, matrix heading, and audit JSON record the configured
  standard; matrix keys stay WCAG SC identifiers across standards
- Eval-15 covers default compatibility, the 2.2 add/remove set, clause
  rendering, and invalid-id rejection
- WCAG 2.2 is offered as data, not presented as the legally incorporated
  target where WCAG 2.1 remains controlling (ADA Title II deadlines were
  extended in April 2026 to April 26, 2027 for entities serving 50,000+
  people and April 26, 2028 for smaller entities and special districts)
- Assistant guide v0.3.4 re-pins report.js; sidecar manifest synced

### Next, in priority order

1. **Bring template-aware selection into the CI Action.** The Action's
   sitemap path currently scans every URL, bypassing the project's strongest
   capability. Add a deterministic discover → scan mode and retain the scan
   plan as an artifact.
2. **Changed-surface auditing.** Map a PR's changed files to affected route
   or template groups, then prioritize their representative pages. Keep a
   conservative full-sample fallback when ownership cannot be inferred.
3. **Interoperability adapter.** Make discover/scan/report easy to invoke
   from broader ecosystems, including a Community Access extension if its
   contract remains stable. Prefer this over a competing general-purpose
   agent suite.
4. **Authenticated deterministic journeys.** Accept a Playwright storage
   state or bounded journey file as a scan input. Do not expand into an
   unconstrained browser agent.
5. **SARIF emitter.** Useful for public repositories and organizations
   with GitHub Code Security, but secondary to baseline and template-aware
   adoption. Preserve repository-native JSON for universal CI use.
6. **First-class Playwright execution.** Add only where it improves
   deterministic state coverage or reuses an existing project dependency.

### v2.3 field validation

The first post-release tests should measure the regression contract rather
than broad scan recall:

- whether selector normalization produces noisy "new" findings after
  harmless markup or origin changes
- whether the baseline review step makes accepted debt understandable and
  deliberate
- whether `baseline` + `fail-on: new` is sufficient in real consumer Action
  workflows without custom shell parsing
- whether users expect template-aware discovery inside the Action after
  seeing it as the primary product differentiator

Use those results to set v2.4 scope. Do not add breadth merely to match the
feature lists of larger agent suites or hosted platforms.

### Explicit non-goals

- Broad accessibility-agent suite
- Automated code remediation
- Generic axe MCP wrapper
- Hosted dashboard or enterprise monitoring service
- VPAT generation or conformance certification
- Screen-reader simulation

### Standing hygiene

- Run eval-2 against a real authenticated tracker for full live
  issue-mode validation (still pending)
- Use `scripts/plan-issues.js` as the default dry-run step before any
  live ticket creation
- Install or update from GitHub with `npx skills add`; use manual copies only
  as a documented fallback
- Keep new regression fixes covered by `npm run validate` before
  updating bundle metadata
