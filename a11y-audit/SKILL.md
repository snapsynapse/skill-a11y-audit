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
  version: 1
  version_date: 2026-03-02
  previous_version: null
  change_summary: >
    v1 initial build. Six-phase pipeline: environment discovery, automated
    scanning, compliance mapping, manual check guidance, report generation,
    issue creation. Generic for any web project; project-specific standards
    configured via PAICE_CONTEXT.md.
---

# Accessibility Audit

## Architecture

This skill operates as a single layer. It reads the project environment,
runs automated accessibility tools, maps findings to compliance standards,
and produces a structured report. No external skill dependency is required.

When a `PAICE_CONTEXT.md` file exists in the skill directory, the skill
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

5. **Project context**: Look for `PAICE_CONTEXT.md` in the skill
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

The 50 Level A and AA success criteria, grouped by principle:

**Perceivable (Principle 1)**
- 1.1.1 Non-text Content (A)
- 1.2.1 Audio-only and Video-only (A)
- 1.2.2 Captions (A)
- 1.2.3 Audio Description or Media Alternative (A)
- 1.2.4 Captions (Live) (AA)
- 1.2.5 Audio Description (AA)
- 1.3.1 Info and Relationships (A)
- 1.3.2 Meaningful Sequence (A)
- 1.3.3 Sensory Characteristics (A)
- 1.3.4 Orientation (AA)
- 1.3.5 Identify Input Purpose (AA)
- 1.4.1 Use of Color (A)
- 1.4.2 Audio Control (A)
- 1.4.3 Contrast (Minimum) (AA)
- 1.4.4 Resize Text (AA)
- 1.4.5 Images of Text (AA)
- 1.4.10 Reflow (AA)
- 1.4.11 Non-text Contrast (AA)
- 1.4.12 Text Spacing (AA)
- 1.4.13 Content on Hover or Focus (AA)

**Operable (Principle 2)**
- 2.1.1 Keyboard (A)
- 2.1.2 No Keyboard Trap (A)
- 2.1.4 Character Key Shortcuts (A)
- 2.2.1 Timing Adjustable (A)
- 2.2.2 Pause, Stop, Hide (A)
- 2.3.1 Three Flashes or Below Threshold (A)
- 2.4.1 Bypass Blocks (A)
- 2.4.2 Page Titled (A)
- 2.4.3 Focus Order (A)
- 2.4.4 Link Purpose (In Context) (A)
- 2.4.5 Multiple Ways (AA)
- 2.4.6 Headings and Labels (AA)
- 2.4.7 Focus Visible (AA)
- 2.5.1 Pointer Gestures (A)
- 2.5.2 Pointer Cancellation (A)
- 2.5.3 Label in Name (A)
- 2.5.4 Motion Actuation (A)

**Understandable (Principle 3)**
- 3.1.1 Language of Page (A)
- 3.1.2 Language of Parts (AA)
- 3.2.1 On Focus (A)
- 3.2.2 On Input (A)
- 3.2.3 Consistent Navigation (AA)
- 3.2.4 Consistent Identification (AA)
- 3.3.1 Error Identification (A)
- 3.3.2 Labels or Instructions (A)
- 3.3.3 Error Suggestion (AA)
- 3.3.4 Error Prevention (Legal, Financial, Data) (AA)

**Robust (Principle 4)**
- 4.1.1 Parsing (A) -- deprecated in WCAG 2.2 but still in 2.1
- 4.1.2 Name, Role, Value (A)
- 4.1.3 Status Messages (AA)

#### axe Rule to WCAG Mapping

axe-core includes WCAG tags on each rule. When processing results, group
violations by their WCAG tags. A single axe rule may map to multiple
criteria (e.g., `color-contrast` maps to 1.4.3). A single criterion may
be covered by multiple axe rules.

Criteria with no axe rule coverage (require manual review):
- 1.2.1-1.2.5 (media alternatives -- axe checks for presence of tracks
  but cannot verify content quality)
- 1.3.2 (meaningful sequence -- partially automated)
- 1.3.3 (sensory characteristics -- not automatable)
- 1.4.1 (use of color -- not fully automatable)
- 1.4.2 (audio control -- not automatable)
- 2.1.4 (character key shortcuts -- not automatable)
- 2.2.1, 2.2.2 (timing -- not automatable)
- 2.4.3 (focus order -- partially automated)
- 2.4.5 (multiple ways -- not automatable)
- 2.5.1-2.5.4 (pointer/motion -- not automatable)
- 3.1.2 (language of parts -- partially automated)
- 3.2.1-3.2.4 (predictability -- not automatable)
- 3.3.3, 3.3.4 (error handling -- partially automated)

#### Project-Specific Standards

If `PAICE_CONTEXT.md` specifies additional standards (e.g., CAN-ASC-6.2),
build a secondary mapping. Cross-reference automated findings where the
standard maps to WCAG criteria. For requirements that go beyond WCAG
(equity, organizational processes, transparency), note them as manual
review items referencing the project's existing conformance documentation.

### Phase 4 -- Manual Check Guidance

**Purpose:** Generate checklists for what automation cannot verify.

For each WCAG criterion marked "Cannot be determined" in Phase 3,
generate a manual testing item. Organize by testing method:

#### Keyboard Navigation
- Tab through all interactive elements; verify logical order (SC 2.4.3)
- Confirm no keyboard traps: every element reachable and escapable (SC 2.1.2)
- Verify skip links present and functional (SC 2.4.1)
- Test all custom widgets (dropdowns, modals, tabs) with keyboard only
  (SC 2.1.1)
- Verify focus indicator visible with minimum 2px outline, 3:1 contrast
  (SC 2.4.7)

#### Screen Reader
- Verify heading hierarchy (h1-h6 in logical order) (SC 1.3.1)
- Confirm all images have meaningful alt text (SC 1.1.1)
- Test form labels announced correctly (SC 3.3.2)
- Verify ARIA live regions announce dynamic content (SC 4.1.3)
- Check landmark regions present and labeled (SC 1.3.1)
- Test error messages announced on form validation (SC 3.3.1)

#### Visual Inspection
- Verify no information conveyed by color alone (SC 1.4.1)
- Test at 200% browser zoom: no horizontal scroll, no overlap (SC 1.4.4)
- Check text spacing override (letter-spacing 0.12em, word-spacing 0.16em,
  line-height 1.5, paragraph spacing 2em): no content loss (SC 1.4.12)
- Verify content reflows to single column at 320px width (SC 1.4.10)
- Test hover/focus popups: dismissible, hoverable, persistent (SC 1.4.13)

#### Cognitive
- Confirm consistent navigation across pages (SC 3.2.3)
- Verify consistent identification of UI components (SC 3.2.4)
- Test error suggestions provided for invalid input (SC 3.3.3)
- Check error prevention for legal/financial actions: reversible,
  checked, or confirmed (SC 3.3.4)

#### Timing and Motion
- Verify users can extend or disable time limits (SC 2.2.1)
- Check auto-updating content can be paused/stopped/hidden (SC 2.2.2)
- Confirm no content flashes more than 3 times per second (SC 2.3.1)
- Test `prefers-reduced-motion` media query respected (SC 2.3.1)

Each checklist item should specify which pages or components to test,
based on Phase 1 route discovery and Phase 2 scan results (focus manual
testing on pages where automated issues were found).

If `PAICE_CONTEXT.md` references an existing testing guide, cross-link
to it rather than duplicating all procedures.

### Phase 5 -- Report Generation

**Purpose:** Produce a structured markdown report.

Write the report to the output path. Default location:
`docs/accessibility/audits/audit-YYYY-MM-DD.md`. If `PAICE_CONTEXT.md`
specifies a different path, use that.

#### Report Template

```markdown
# Accessibility Audit Report

**Project:** [name from package.json or user input]
**Date:** [YYYY-MM-DD]
**Standard:** WCAG 2.1 Level AA [+ project-specific standards]
**Tool:** a11y-audit skill v1

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Lighthouse Accessibility Score | [X]/100 (average across pages) |
| axe-core Violations | [N] total ([C] critical, [S] serious, [M] moderate, [m] minor) |
| WCAG 2.1 AA Criteria Evaluated | [X]/50 |
| Criteria Passing | [N] |
| Criteria Failing | [N] |
| Criteria Requiring Manual Review | [N] |
| Pages Scanned | [N] |

[1-2 sentence summary of overall posture and top priority items]

---

## Automated Scan Results

### axe-core Findings by Severity

| Severity | Count | Top Issues |
|----------|-------|------------|
| Critical | [N] | [brief descriptions] |
| Serious | [N] | [brief descriptions] |
| Moderate | [N] | [brief descriptions] |
| Minor | [N] | [brief descriptions] |

### axe-core Findings by WCAG Criterion

| WCAG SC | Description | Impact | Violations | Pages Affected |
|---------|-------------|--------|------------|----------------|
| [1.4.3] | [Contrast] | [serious] | [N] | [list] |
| ... | ... | ... | ... | ... |

### Lighthouse Accessibility Score by Page

| Page | Score | Failed Audits |
|------|-------|---------------|
| [/] | [95] | [list or "none"] |
| ... | ... | ... |

---

## WCAG 2.1 AA Compliance Matrix

| SC | Description | Level | Status | Evidence |
|----|-------------|-------|--------|----------|
| 1.1.1 | Non-text Content | A | [Pass/Fail/Manual/N-A] | [axe rule or manual note] |
| ... | ... | ... | ... | ... |

Status key: Pass = automated tests confirm compliance. Fail = violations
found. Manual = requires manual verification. N/A = not applicable.

---

## [Project-Specific Standard] Compliance

[Only included if PAICE_CONTEXT.md specifies additional standards.
Format depends on the standard.]

---

## Manual Testing Recommendations

[Checklists from Phase 4, organized by testing method]

---

## Remediation Priority

| Priority | Issue | WCAG SC | Pages | Effort |
|----------|-------|---------|-------|--------|
| P0 | [description] | [SC] | [pages] | [Low/Med/High] |
| P1 | [description] | [SC] | [pages] | [Low/Med/High] |
| ... | ... | ... | ... | ... |

Priority definitions:
- **P0 (Critical):** Prevents core functionality for users with disabilities
- **P1 (High):** Significantly impairs user experience
- **P2 (Medium):** Barriers exist but workarounds available
- **P3 (Low):** Enhancements beyond AA requirements

---

## GitHub Issues Created

| Issue # | Title | Priority | WCAG SC | Link |
|---------|-------|----------|---------|------|
| [N] | [title] | [P0-P3] | [SC] | [URL] |

[Only populated if Phase 6 was executed. Otherwise: "Issue creation was
not requested for this audit."]

---

## Methodology

- **axe-core version:** [from node_modules/axe-core/package.json]
- **Lighthouse version:** [from npx lighthouse --version]
- **Browser:** Chromium (headless) via Puppeteer
- **Viewport:** 1280x800
- **Pages scanned:** [list]
- **Date:** [YYYY-MM-DD]
- **Skill version:** a11y-audit v1
```

#### Report Writing Rules

- Tables must be valid GitHub-flavored markdown (pipe-delimited, header
  separator row)
- All WCAG criterion references use the format `SC X.X.X` or just the
  number `X.X.X`
- Links to axe-core documentation use the `helpUrl` from axe results
- The report is a working document, not a polished deliverable. Write
  in plain technical prose. No marketing language.
- If Lighthouse was skipped, omit the Lighthouse sections entirely
  rather than showing empty tables

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

#### Issue Template

```markdown
## Accessibility Issue

**WCAG Criterion:** [e.g., 1.4.3 Contrast (Minimum)]
**axe-core Rule:** [e.g., color-contrast]
**Severity:** [Critical/Serious/Moderate/Minor]
**Page(s):** [e.g., /results, /individual]

### Description
[axe-core violation description]

### Impact
[Who is affected and how]

### Elements Affected
[CSS selector(s) from axe-core results]

### Suggested Fix
[axe-core help text and remediation guidance]

### References
- [axe-core rule documentation](helpUrl)
- [WCAG Understanding document](https://www.w3.org/WAI/WCAG21/Understanding/[sc-slug])

### Audit Metadata
- Audit date: [YYYY-MM-DD]
- Tool: axe-core [version] via a11y-audit skill v1
- Environment: Chromium headless, 1280x800

<!-- a11y-audit-key: [rule-id]::[page-path] -->
```

#### Issue Creation

For each finding at the configured severity threshold (default: P0 and
P1):

```bash
gh issue create \
  --title "[A11y] [Severity] [Page]: [Brief description]" \
  --label "[priority-label],[status-label],[wcag-principle-label]" \
  --body "[body from template]"
```

#### Label Mapping

**Generic defaults** (when no PAICE_CONTEXT.md):
- Priority: `a11y-critical`, `a11y-high`, `a11y-medium`, `a11y-low`
- Status: `a11y-new`

**Project-specific** (from PAICE_CONTEXT.md):
- Override label names and add component/AT labels as configured

#### axe Impact to Priority Mapping

| axe Impact | Default Priority | Label |
|------------|-----------------|-------|
| critical | P0 | `a11y-critical` |
| serious | P1 | `a11y-high` |
| moderate | P2 | `a11y-medium` |
| minor | P3 | `a11y-low` |

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
