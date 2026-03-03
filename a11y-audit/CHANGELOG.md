---
skill_bundle: a11y-audit
file_role: reference
version: 9
version_date: 2026-03-03
previous_version: 8
change_summary: >
  Validated first-run context creation and missing-browser-automation
  paths directly, and added a non-destructive issue-planning helper.
---

# Changelog

## v9 -- 2026-03-03

- **First-run context validation:** Recorded a passing result for eval-6
  by creating a workspace-local context file in `/tmp` with the bundled
  bootstrap helper.
- **Missing-browser-automation validation:** Recorded a passing result
  for eval-7 by exercising the scanner against a workspace with
  `axe-core` present but no Puppeteer dependency, confirming a clear
  blocker message.
- **Issue planning mitigation:** Added `scripts/plan-issues.js` and a
  sample issue plan artifact so `markdown+issues` mode has a safe dry-run
  path before live tracker writes.
- **Validation stance:** Reduced the remaining publish-time runtime gap
  to the live authenticated tracker path rather than the whole issue-mode
  workflow.

## v8 -- 2026-03-03

- **Direct degraded-path validation:** Ran the bundled `scripts/scan.js`
  helper against PAICE2 and recorded passing results for eval-4
  (Lighthouse unavailable but report still generated) and eval-5
  (expected URL wrong but runtime URL reconciled and persisted).
- **Eval results updated:** Added concrete `results` entries for eval-4
  and eval-5 in `evals/evals.json`.
- **CI discoverability:** Updated `SKILL.md` so the GitHub Actions
  starter in `assets/ci/github-actions/accessibility-audit.yml` is part
  of the visible operating guidance rather than a hidden asset.
- **Execution stance:** Kept the bundled scanner Puppeteer-first for
  now. Playwright remains a documented fallback path but is not yet a
  first-class helper implementation.

## v7 -- 2026-03-03

- **Reusable scripts:** Added `scripts/scan.js` for reusable axe-based
  scanning and `scripts/bootstrap-context.js` for first-run workspace
  context creation.
- **Reference decomposition:** Split detailed output rules into
  `references/output-contract.md`, issue creation rules into
  `references/issue-trackers.md`, and the JSON contract into
  `references/output-schema.json`.
- **Eval expansion:** Added explicit eval coverage for missing
  Lighthouse, runtime URL reconciliation, first-run context creation,
  missing browser automation, and issue deduplication.
- **Operational assets:** Added sample markdown/JSON output artifacts and
  a GitHub Actions workflow template for scheduled or on-demand audits.
- **Core skill cleanup:** Updated `SKILL.md` to prefer bundled helpers
  and focused references over repeated inline detail.

## v6 -- 2026-03-03

- **Runtime URL handling:** Updated `SKILL.md` so a local port mismatch
  is treated as a normal adaptation path. The skill now switches to the
  live URL, records the mismatch in methodology, and updates the
  workspace-local `base_url`.
- **Lighthouse degraded mode:** Clarified that missing or failing
  Lighthouse is a documented partial-audit path, not a failure. The
  report must now state the skip reason explicitly in the executive
  summary and methodology.
- **Eval alignment:** Updated `evals/evals.json` so eval-1 allows URL
  reconciliation and Lighthouse-optional execution instead of assuming a
  fixed port and guaranteed Lighthouse score.
- **Handoff update:** Recorded the Codex eval-1 findings from PAICE2 so
  the next session starts from observed runtime behavior rather than
  inferred gaps.

## v5 -- 2026-03-03

- **Configuration contract:** Added
  `references/project-context-template.md` as the canonical schema for
  `.a11y-audit/PROJECT_CONTEXT.md`.
- **Examples:** Included one minimal example and one
  `markdown+issues` example to reduce ambiguity around route lists,
  standards, output paths, and issue-tracker settings.
- **Core skill cleanup:** Updated `SKILL.md` to point to the template as
  the field contract and removed the inline issue-tracker config block.

## v4 -- 2026-03-03

- **Portable core:** Removed the `metadata` block from `SKILL.md` so the
  main skill file uses minimal frontmatter and remains Codex-compatible.
- **Platform branches:** Added `references/claude-code.md` and
  `references/codex.md` so Claude-specific guidance stays explicit
  without leaking into the shared operating path.
- **Workspace state:** Moved mutable project context out of the skill
  install directory. The default path is now
  `.a11y-audit/PROJECT_CONTEXT.md` in the audited workspace.
- **Bundle sync:** Updated `HANDOFF.md`, `evals/evals.json`, and the
  manifest to match the portable layout. Added `agents/openai.yaml` for
  Codex skill-list metadata.

## v3 -- 2026-03-03

- **Output modes:** Replaced hardcoded GitHub Issue creation with three
  configurable output modes: `markdown` (report only), `markdown+json`
  (report + machine-readable JSON), `markdown+issues` (report + issue
  tracker tickets). Mode is stored in PROJECT_CONTEXT.md and persisted
  across runs.
- **Self-configuring:** On first run, if no output_mode is set, the skill
  asks the user to choose and persists the preference. Subsequent runs
  use the saved preference without asking.
- **JSON schema:** Defined structured JSON output format for CI
  integration, dashboards, and trend tracking.
- **Tracker-agnostic:** Issue tracker configuration (GitHub, GitLab,
  Linear, Jira) moved to PROJECT_CONTEXT.md alongside the output mode.
  The skill no longer assumes any specific tracker.
- **Phase rename:** Phase 5 renamed from "Report Generation" to "Output
  Generation". Phase 6 renamed from "Issue Creation (Opt-In)" to "Issue
  Creation (conditional)"; runs only in markdown+issues mode.
- `gh` CLI removed as a top-level dependency; now conditional on
  markdown+issues mode with GitHub tracker selection.

## v2 -- 2026-03-03

- **Token efficiency:** Removed static WCAG 2.1 criteria enumeration
  (57 lines); model generates matrix from its own knowledge. Removed
  hardcoded "no axe coverage" list (15 lines); coverage determined at
  runtime from axe results. Condensed report template from full markdown
  mock (115 lines) to structural spec (30 lines). Condensed issue
  template from full mock (30 lines) to field list (10 lines). Net
  reduction: 632 to 441 lines (~30%).
- **Portability:** Renamed context file from PAICE_CONTEXT.md to
  PROJECT_CONTEXT.md. Added Playwright as alternative to Puppeteer.
  Added multi-tracker support in Phase 6 (GitLab, Linear, Jira).
- **Usefulness:** Added delta/comparison section in report for repeat
  audits (diff new vs. resolved violations). Made Phase 4 manual
  checklists dynamic based on Phase 2 automated findings rather than
  static.
- Validated via eval-1 against PAICE2 (3 pages, Lighthouse 93, 76
  violations, 5 unique rules, report generated successfully).

## v1 -- 2026-03-02

- Bootstrap under skill-provenance system. All files versioned, manifest
  and changelog created.
- SKILL.md v1: Six-phase accessibility audit pipeline
  - Phase 1: Environment Discovery (tech stack, routes, existing tooling)
  - Phase 2: Automated Scanning (axe-core via Puppeteer, Lighthouse CLI)
  - Phase 3: Compliance Mapping (WCAG 2.1 AA matrix, project-specific standards)
  - Phase 4: Manual Check Guidance (checklists by testing method)
  - Phase 5: Report Generation (structured markdown with tables)
  - Phase 6: Issue Creation (opt-in, deduplication via HTML comments)
- WCAG 2.1 AA criteria reference embedded (50 Level A and AA criteria)
- axe-core scanning script template with ES module support
- GitHub Issue template with deduplication key pattern
- evals/evals.json: 3 eval cases defined, pending first run
- HANDOFF.md: Bootstrap context with known limitations
