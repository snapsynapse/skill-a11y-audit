---
skill_bundle: a11y-audit
file_role: reference
version: 3
version_date: 2026-03-03
previous_version: 2
change_summary: >
  Decoupled output from GitHub Issues. Configurable output modes
  (markdown, markdown+json, markdown+issues) with preference persistence.
---

# Changelog

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
