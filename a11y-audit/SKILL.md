---
name: a11y-audit
description: >
  Run accessibility audits on web projects combining automated scanning
  (axe-core, Lighthouse) with WCAG 2.1 AA compliance mapping, manual check
  guidance, and structured reporting. Output is configurable: markdown
  report only, markdown plus machine-readable JSON, or markdown plus issue
  tracker integration. Use this skill whenever the user mentions
  "accessibility audit", "a11y audit", "WCAG audit", "accessibility check",
  "compliance scan", or asks to check a web project for accessibility
  issues. Also trigger when the user wants to verify WCAG conformance or
  map findings to a specific standard (CAN-ASC-6.2, EN 301 549, ADA/AODA).
---

# Accessibility Audit

## Architecture

This skill operates as a single layer. It reads the project environment,
runs automated accessibility tools, maps findings to compliance standards,
and produces output in a configurable format. No external skill dependency
is required.

Store project-specific audit state in the target workspace, not in the
installed skill directory. Default path:
`.a11y-audit/PROJECT_CONTEXT.md` at the workspace root. When that file
exists, use it for project-specific configuration: output mode,
additional compliance standards, issue tracker settings, route lists,
color palettes, and cross-references to existing documentation. When
absent, use WCAG 2.1 AA as the sole standard, `markdown` as the output
mode, and generic defaults for everything else.

Use `references/project-context-template.md` as the canonical schema for
that file, including minimal and `markdown+issues` examples.

Prefer bundled helpers over ad hoc generation when they fit:

- `scripts/bootstrap-context.js` creates a workspace-local
  `.a11y-audit/PROJECT_CONTEXT.md` from simple inputs.
- `scripts/scan.js` runs reusable axe-based scans and records optional
  Lighthouse execution intent.

### Platform-Specific References

- If running in Claude Code, read `references/claude-code.md` for
  `.claude/launch.json` handling and Preview tool usage.
- If running in Codex, read `references/codex.md` for workspace-local
  state handling and execution assumptions.
- Read `references/output-contract.md` when generating markdown or JSON.
- Read `references/output-schema.json` when writing machine-readable
  output.
- Read `references/issue-trackers.md` only when `output_mode` is
  `markdown+issues`.
- If the user wants to operationalize recurring audits in CI, start from
  `assets/ci/github-actions/accessibility-audit.yml`.
- Prefer `scripts/plan-issues.js` before live ticket creation when you
  need a safe review and deduplication pass.

**The skill does not modify source code.** It is an auditor, not a fixer.
Findings are reported with remediation guidance; the user decides what to
act on.

### Output Modes

The skill supports three output modes, configured via the `output_mode`
field in `.a11y-audit/PROJECT_CONTEXT.md`:

| Mode | Output | Use Case |
|------|--------|----------|
| `markdown` | Markdown report only | Human review, documentation |
| `markdown+json` | Markdown report + JSON data file | CI integration, dashboards, trend tracking |
| `markdown+issues` | Markdown report + issue tracker tickets | Active remediation workflow |

On first run, if no `output_mode` is set in
`.a11y-audit/PROJECT_CONTEXT.md`, ask the user which mode they prefer
and persist their choice by appending an `## Output Configuration`
section to that file. If no context file exists, create it at the
default path following `references/project-context-template.md`. Prefer
`scripts/bootstrap-context.js` for first-run context creation when a
simple generated file is sufficient.

The `markdown+json` mode writes a companion file alongside the report:
`audit-YYYY-MM-DD.json` containing the raw axe-core results, Lighthouse
scores, and the compliance matrix as structured data. This file is
machine-readable and can be consumed by CI pipelines, dashboards, or
trend-tracking tools.

The `markdown+issues` mode requires additional configuration in the
context file (see Phase 6).

---

## Pipeline

An accessibility audit moves through six phases. Each phase produces data
the next phase consumes. Phases 1-4 always run. Phase 5 produces output
based on the configured output mode. Phase 6 runs only in
`markdown+issues` mode and requires explicit user confirmation.

The user can request a partial run. Common patterns:
- "Quick scan": Phases 1-2 only, results summarized in conversation
- "Full audit": Phases 1-5, output per configured mode
- "Audit with issues": Phases 1-6, report plus tracker tickets

### Phase 1 -- Environment Discovery

**Purpose:** Understand the project before scanning.

Read the project to determine:

1. **Tech stack**: Read `package.json` (or equivalent) for the frontend
   framework (React, Vue, Angular, Svelte, plain HTML), component library
   (Radix UI, Material UI, Headless UI, Chakra), CSS approach (Tailwind,
   CSS Modules, styled-components), and test framework.

2. **Routes/pages**: Read the router configuration to build a list of
   scannable URLs. For React Router, read the file containing `<Route>`
   elements. For Next.js, read the `pages/` or `app/` directory. For plain
   HTML, glob for `.html` files.

3. **Existing a11y tooling**: Check `package.json` for `@axe-core/cli`,
   `axe-core`, `pa11y`, `eslint-plugin-jsx-a11y`, `jest-axe`. Check
   `.github/workflows/` for accessibility-related CI jobs.

4. **Dev server**: Check if a dev server is running or can be started.
   Check package scripts, repo docs, and any platform-specific reference
   file for launch hints. Do not assume Claude-only tools are available
   unless the current agent matches that environment.
   If the expected URL or port is unavailable but the app starts on a
   different local URL, switch to the live URL, record the mismatch in
   the report methodology, and update `.a11y-audit/PROJECT_CONTEXT.md`
   to the working `base_url`.

5. **Project context**: Look for `PROJECT_CONTEXT.md` at the workspace
   path `.a11y-audit/PROJECT_CONTEXT.md`. If found, load
   project-specific standards, routes, labels, and color palette using
   `references/project-context-template.md` as the field contract.

**Output:** A structured summary reported to the user before proceeding.
The skill asks before installing any missing dependencies (axe-core,
lighthouse).

### Phase 2 -- Automated Scanning

**Purpose:** Run automated accessibility checks against live pages.

**Prerequisite:** A running dev server (or production URL provided by
the user).

#### axe-core Scanning

Prefer the bundled `scripts/scan.js` before writing a throwaway scan
script. Use an ad hoc script only when the workspace needs behavior that
the bundled script does not yet support.

The reusable scanner should:

1. Imports `puppeteer` and `axe-core`
2. Launches a headless browser
3. For each target URL:
   a. Navigates to the page
   b. Waits for network idle (`waitUntil: 'networkidle0'`)
   c. Injects axe-core: reads the axe-core source file from
      `node_modules/axe-core/axe.min.js` and injects it via
      `page.evaluate()`
   d. Runs the audit: `page.evaluate(() => axe.run())`
   e. Collects the results JSON
4. Closes the browser
5. Writes raw results to JSON

Example invocation:

```bash
node a11y-audit/scripts/scan.js \
  --root . \
  --urls http://127.0.0.1:3000/,http://127.0.0.1:3000/about \
  --output /tmp/a11y-scan.json
```

**Adapt to the project.** If dependencies live in a frontend
subdirectory, point `--root` at the workspace root; the bundled script
already checks common frontend paths. If that still fails, fall back to
an ad hoc script or run from the frontend directory directly.

**Common mistake:** Do not use `require()` in an ES module project. Check
`package.json` for `"type": "module"`. If present, use `import` syntax
and the `__dirname` workaround in any ad hoc script. If absent,
`require()` is fine.

**Playwright alternative:** If the project uses Playwright instead of
Puppeteer, adapt the script: replace `puppeteer.launch()` with
`chromium.launch()`, use `page.goto()` the same way, and inject
axe-core via `page.evaluate()`. The axe-core injection pattern is
identical. Use whichever browser automation library the project already
has installed.

#### Lighthouse Scanning

Run Lighthouse CLI against each target URL:

```bash
npx lighthouse <url> \
  --output=json \
  --output-path=stdout \
  --only-categories=accessibility \
  --chrome-flags="--headless --no-sandbox" \
  --quiet
```

Parse the JSON output. Extract:
- `categories.accessibility.score` (0-1, multiply by 100)
- `audits` where `score !== 1` (failed or partial audits)
- Each audit's `description` and `details.items`

If Lighthouse is unavailable or fails (common in CI environments), skip
it and note the gap in the report. In the executive summary and
methodology, explicitly say whether Lighthouse was skipped because the
CLI was missing, Chrome launch failed, or another runtime error
occurred. axe-core results alone are sufficient for a valid audit.

#### Scope Control

- Default: scan routes discovered in Phase 1
- If more than 10 routes exist, ask the user which to scan or whether to
  scan all
- The user can provide a specific URL list to override discovery
- For SPAs: navigate via the router, not by reloading the page (some
  routes may not work as direct URLs)

#### Result Structure

For each page, collect:
- `url`: the scanned URL
- `violations`: array of axe violations, each with `id`, `impact`
  (critical/serious/moderate/minor), `description`, `help`, `helpUrl`,
  `tags` (WCAG criteria), `nodes` (affected elements with selectors)
- `passes`: count of passing rules
- `incomplete`: rules that could not be fully evaluated
- `lighthouseScore`: 0-100 (if available)
- `lighthouseAudits`: failed audit details (if available)

### Phase 3 -- Compliance Mapping

**Purpose:** Map automated findings to WCAG 2.1 AA success criteria and
any project-specific standards.

#### WCAG 2.1 AA Matrix

Build a compliance matrix covering all 50 Level A and AA success criteria.
For each criterion, determine status:

- **Pass**: axe-core has rules covering this criterion and all passed
- **Fail**: axe-core found violations mapped to this criterion
- **Cannot be determined**: no automated test covers this criterion
  (requires manual review)
- **Not applicable**: criterion does not apply to this content type

axe-core maps violations to WCAG criteria via the `tags` array on each
rule. Tags follow the format `wcag2a`, `wcag2aa`, `wcag111` (for SC
1.1.1), etc.

#### WCAG Criteria Reference

The compliance matrix covers all 50 WCAG 2.1 Level A and AA success
criteria (Principles 1-4: Perceivable, Operable, Understandable,
Robust). Do not enumerate them in the skill; use your knowledge of WCAG
2.1 to build the matrix at generation time.

#### axe Rule to WCAG Mapping

axe-core maps violations to WCAG criteria via the `tags` array on each
rule. Tags follow the format `wcag2a`, `wcag2aa`, `wcag111` (for SC
1.1.1), etc. Group violations by these tags to populate the matrix.

For criteria where axe found no violations AND has rules that cover
the criterion, mark as Pass. For criteria with no axe rule coverage,
mark as Manual. Determine coverage at runtime from the axe results
`passes` and `inapplicable` arrays rather than a hardcoded list.

#### Project-Specific Standards

If `.a11y-audit/PROJECT_CONTEXT.md` specifies additional standards
(e.g., CAN-ASC-6.2), build a secondary mapping. Cross-reference
automated findings where the standard maps to WCAG criteria. For
requirements that go beyond WCAG (equity, organizational processes,
transparency), note them as manual review items referencing the
project's existing conformance documentation.

### Phase 4 -- Manual Check Guidance

**Purpose:** Generate targeted checklists for what automation cannot
verify, prioritized by the automated findings.

For each WCAG criterion marked "Manual" in the Phase 3 matrix, generate
a testing item. Organize by testing method: Keyboard Navigation, Screen
Reader, Visual Inspection, Cognitive, and Timing/Motion.

**Dynamic prioritization:** Do not produce a static checklist. Use the
Phase 2 results to focus manual effort:

- If axe found color-contrast violations, prioritize visual inspection
  items (SC 1.4.1, 1.4.11, 1.4.10, 1.4.12, 1.4.13)
- If axe found ARIA or landmark violations, prioritize screen reader
  items (SC 1.3.1, 4.1.3, 3.3.1, 3.3.2)
- If axe found heading or structure violations, prioritize keyboard
  navigation items (SC 2.4.3, 2.4.7, 2.1.1)
- If no form-related violations were found, deprioritize form testing
  (SC 3.3.3, 3.3.4) with a note that automated checks passed
- Always include timing items (SC 2.2.1, 2.2.2, 2.3.1) since these
  cannot be automated at all

Each checklist item specifies: the WCAG criterion, what to test, how
to test it, and which pages to focus on (pages where automated issues
were found get priority).

If `.a11y-audit/PROJECT_CONTEXT.md` references an existing testing guide,
cross-link to it rather than duplicating procedures.

### Phase 5 -- Output Generation

**Purpose:** Produce output based on the configured output mode.

Write output to the configured path. Default:
`docs/accessibility/audits/audit-YYYY-MM-DD.md` (and `.json` if
applicable). `.a11y-audit/PROJECT_CONTEXT.md` can override the path.

Read `references/output-contract.md` for report section order, degraded
mode rules, and JSON output requirements. Use
`references/output-schema.json` as the stable machine-readable contract
for `markdown+json` and `markdown+issues` modes.

If the user wants a recurring or on-demand CI job, adapt
`assets/ci/github-actions/accessibility-audit.yml` to the target
workspace instead of inventing a workflow from scratch.

### Phase 6 -- Issue Creation (conditional)

**Purpose:** Create issue tracker tickets for findings. Runs only when
the output mode is `markdown+issues`.

**This phase requires explicit user confirmation.** Before creating any
tickets, show the user how many will be created, at what priority levels,
and ask for approval.

Read `references/issue-trackers.md` for tracker configuration,
deduplication, priority mapping, and ticket structure. Use the tracker
settings from `.a11y-audit/PROJECT_CONTEXT.md`.

---

## Verification

After completing an audit, verify these quality checks:

1. **axe results valid**: Compare violation count against a manual
   axe DevTools browser extension run on the same page. Counts should
   match within tolerance (axe versions may differ slightly).

2. **Lighthouse score consistent**: Compare against a manual Chrome
   DevTools Lighthouse run when Lighthouse was actually executed. Should
   be within 5 points.

3. **WCAG matrix complete**: All 50 AA criteria appear in the compliance
   matrix. No criterion is missing.

   Treat the matrix as evidence-oriented status reporting. Do not frame
   it as proof of full conformance, because many WCAG criteria remain
   manual even in a strong automated run.

4. **Report structure**: All required sections present. Tables render
   correctly in a markdown viewer.

5. **JSON validity** (`markdown+json` mode): JSON file parses without
   error. Violation counts match the markdown report.

6. **Issue deduplication** (`markdown+issues` mode): Run the skill
   twice. The second run should create zero duplicate tickets.

7. **Output mode persistence**: After first run, verify the output mode
   is saved to `.a11y-audit/PROJECT_CONTEXT.md` and used automatically
   on next run.

8. **Runtime URL reconciliation**: If the app started on a different
   local URL than expected, verify the report records the mismatch and
   the context file reflects the actual working `base_url`.

---

## What This Skill Does NOT Do

- **Visual regression testing**: does not compare screenshots between
  runs. Use Percy, Chromatic, or BackstopJS for that.
- **PDF accessibility**: does not audit PDF documents for tagged
  structure, reading order, or alternative text.
- **Real device/AT testing**: runs in headless Chromium only. Cannot
  test on real iOS/Android or with real screen readers. Phase 4
  generates manual checklists for this.
- **Code fixes**: reports findings but does not modify source code.
- **VPAT generation**: does not produce Voluntary Product Accessibility
  Templates (specific legal format).
- **Continuous monitoring**: runs on demand, not as a CI pipeline.
  The `markdown+json` output mode provides structured data for building
  CI integrations, but the skill itself does not run in CI.
- **Third-party auditing**: only audits the project's own frontend,
  not embedded third-party services.
