---
name: a11y-audit
description: >
  Run accessibility audits on web projects combining automated scanning
  (axe-core, Lighthouse) with WCAG 2.1 AA compliance mapping, manual check
  guidance, and structured reporting. Produces a markdown report and
  optionally creates GitHub Issues for findings. Use this skill whenever the
  user mentions "accessibility audit", "a11y audit", "WCAG audit",
  "accessibility check", "compliance scan", or asks to check a web project
  for accessibility issues. Also trigger when the user wants to verify WCAG
  conformance, map findings to a specific standard (CAN-ASC-6.2, EN 301 549,
  ADA/AODA), or generate accessibility issues for their tracker.
metadata:
  skill_bundle: a11y-audit
  file_role: skill
  version: 2
  version_date: 2026-03-03
  previous_version: 1
  change_summary: >
    v2 token efficiency, portability, and usefulness pass. Removed static
    WCAG criteria enumeration (model knows these). Condensed report and
    issue templates to structural specs. Removed redundant axe coverage
    list. Renamed context file to PROJECT_CONTEXT.md. Added Playwright
    alternative and multi-tracker support. Added delta/comparison for
    repeat audits. Made Phase 4 checklists dynamic based on scan results.
---

# Accessibility Audit

## Architecture

This skill operates as a single layer. It reads the project environment,
runs automated accessibility tools, maps findings to compliance standards,
and produces a structured report. No external skill dependency is required.

When a `PROJECT_CONTEXT.md` file exists in the skill directory, the skill
uses it for project-specific configuration: additional compliance standards,
GitHub label schemes, route lists, color palettes, and cross-references to
existing documentation. When absent, the skill uses WCAG 2.1 AA as the
sole standard and generic defaults for everything else.

**The skill does not modify source code.** It is an auditor, not a fixer.
Findings are reported with remediation guidance; the user decides what to
act on.

---

## Pipeline

An accessibility audit moves through six phases. Each phase produces data
the next phase consumes. Phases 1-5 always run. Phase 6 (Issue Creation)
is opt-in and requires explicit user confirmation before executing.

The user can request a partial run. Common patterns:
- "Quick scan": Phases 1-2 only, results summarized in conversation
- "Full audit": Phases 1-5, markdown report generated
- "Audit with issues": Phases 1-6, report plus GitHub Issues

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
   Look for `.claude/launch.json` or a `dev` script in `package.json`.
   Use `preview_start` if the Claude Preview MCP tools are available.

5. **Project context**: Look for `PROJECT_CONTEXT.md` in the skill
   directory. If found, load project-specific standards, routes, labels,
   and color palette.

**Output:** A structured summary reported to the user before proceeding.
The skill asks before installing any missing dependencies (axe-core,
lighthouse).

### Phase 2 -- Automated Scanning

**Purpose:** Run automated accessibility checks against live pages.

**Prerequisite:** A running dev server (or production URL provided by
the user).

#### axe-core Scanning

Write and execute a Node.js script that:

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
5. Writes raw results to a temporary JSON file

The script template:

```javascript
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const axeSource = readFileSync(
  resolve(__dirname, 'node_modules/axe-core/axe.min.js'),
  'utf8'
);

const urls = process.argv.slice(2);
const results = [];

const browser = await puppeteer.launch({ headless: true });

for (const url of urls) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(axeSource);
  const axeResults = await page.evaluate(() => axe.run());
  results.push({ url, ...axeResults });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
```

**Adapt the script to the project.** If `axe-core` is not in
`node_modules`, check the frontend subdirectory (e.g.,
`frontend/node_modules/axe-core`). If Puppeteer is in a subdirectory,
adjust the import path or run from that directory.

**Common mistake:** Do not use `require()` in an ES module project. Check
`package.json` for `"type": "module"`. If present, use `import` syntax
and the `__dirname` workaround shown above. If absent, `require()` is
fine.

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
it and note the gap in the report. axe-core results alone are sufficient
for a valid audit.

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

If `PROJECT_CONTEXT.md` specifies additional standards (e.g., CAN-ASC-6.2),
build a secondary mapping. Cross-reference automated findings where the
standard maps to WCAG criteria. For requirements that go beyond WCAG
(equity, organizational processes, transparency), note them as manual
review items referencing the project's existing conformance documentation.

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

If `PROJECT_CONTEXT.md` references an existing testing guide, cross-link
to it rather than duplicating procedures.

### Phase 5 -- Report Generation

**Purpose:** Produce a structured markdown report.

Write the report to the output path. Default location:
`docs/accessibility/audits/audit-YYYY-MM-DD.md`. If `PROJECT_CONTEXT.md`
specifies a different path, use that.

#### Report Structure

The report is a markdown file with these sections in order:

1. **Header**: project name, date, standard(s), tool version
2. **Executive Summary**: table of key metrics (Lighthouse score, axe
   violation counts by severity, WCAG criteria evaluated/passing/failing/
   manual, pages scanned) plus 1-2 sentence posture summary
3. **Automated Scan Results**: axe findings by severity (table), axe
   findings by WCAG criterion (table), Lighthouse score by page (table,
   omit if Lighthouse was skipped)
4. **WCAG 2.1 AA Compliance Matrix**: all 50 criteria, status
   (Pass/Fail/Manual/N-A), evidence column citing axe rule or manual note
5. **Delta from Previous Audit**: if a prior audit report exists at the
   output path, diff the results. Show new violations, resolved
   violations, and score changes. Omit this section on first audit.
6. **Project-Specific Standard**: only if PROJECT_CONTEXT.md specifies
   additional standards
7. **Manual Testing Recommendations**: from Phase 4
8. **Remediation Priority**: table with priority (P0-P3), issue, WCAG SC,
   pages, effort estimate (Low/Med/High). P0 = blocks core functionality.
   P1 = significantly impairs experience. P2 = barriers with workarounds.
   P3 = beyond AA requirements.
9. **Issues Created**: table of created issues (or note that creation was
   not requested)
10. **Methodology**: tool versions, browser, viewport, pages scanned, date

#### Report Rules

- Valid GitHub-flavored markdown tables throughout
- WCAG references as `SC X.X.X` or just `X.X.X`
- axe-core `helpUrl` for documentation links
- Plain technical prose; no marketing language
- Omit empty sections rather than showing empty tables

### Phase 6 -- Issue Creation (Opt-In)

**Purpose:** Create GitHub Issues for findings.

**This phase requires explicit user confirmation.** Before creating any
issues, show the user how many issues will be created, at what priority
levels, and ask for approval.

#### Deduplication

Before creating issues, search for existing ones:

```bash
gh issue list --label accessibility --state open --json title,body,number --limit 200
```

Parse the returned bodies for the deduplication key:
```
<!-- a11y-audit-key: [axe-rule-id]::[page-path] -->
```

If a match is found, skip that issue and note it in the report as
"existing issue #N".

#### Issue Structure

Each issue body contains these fields: WCAG criterion, axe-core rule ID,
severity, affected page(s), description (from axe), impact, affected
elements (CSS selectors from axe `nodes[].target`), suggested fix (from
axe `help` text), references (axe `helpUrl` + WCAG Understanding doc),
and audit metadata (date, tool version, environment).

**Title format:** `[A11y] [Severity] [Page]: [Brief description]`

**Deduplication key:** Append as an HTML comment at the end of every
issue body: `<!-- a11y-audit-key: [rule-id]::[page-path] -->`

#### Issue Creation

Create issues using `gh issue create` (or the project's tracker CLI;
see Portability below). Default severity threshold: P0 and P1.

#### Label Mapping

**Generic defaults** (when no PROJECT_CONTEXT.md):
- Priority: `a11y-critical`, `a11y-high`, `a11y-medium`, `a11y-low`
- Status: `a11y-new`

**Project-specific** (from PROJECT_CONTEXT.md):
- Override label names and add component/AT labels as configured

#### axe Impact to Priority Mapping

| axe Impact | Default Priority | Label |
|------------|-----------------|-------|
| critical | P0 | `a11y-critical` |
| serious | P1 | `a11y-high` |
| moderate | P2 | `a11y-medium` |
| minor | P3 | `a11y-low` |

#### Portability

Phase 6 uses `gh issue create` by default (GitHub). Adapt to the
project's tracker:
- **GitLab:** `glab issue create` with equivalent flags
- **Linear:** `linear issue create` or Linear API via curl
- **Jira:** `jira issue create` via go-jira CLI or Jira REST API

The deduplication key pattern (`<!-- a11y-audit-key: ... -->`) works
in any tracker that preserves HTML comments in issue bodies. For
trackers that strip HTML comments, store the key as a custom field or
label instead.

---

## Verification

After completing an audit, verify these quality checks:

1. **axe results valid**: Compare violation count against a manual
   axe DevTools browser extension run on the same page. Counts should
   match within tolerance (axe versions may differ slightly).

2. **Lighthouse score consistent**: Compare against a manual Chrome
   DevTools Lighthouse run. Should be within 5 points.

3. **WCAG matrix complete**: All 50 AA criteria appear in the compliance
   matrix. No criterion is missing.

4. **Report structure**: All required sections present. Tables render
   correctly in a markdown viewer.

5. **Issue deduplication**: If Phase 6 ran, run the skill again. The
   second run should create zero duplicate issues.

6. **Issue labels**: Verify created issues have the correct labels.

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
  A separate GitHub Actions workflow would be needed for CI integration.
- **Third-party auditing**: only audits the project's own frontend,
  not embedded third-party services.
