# Skill A11y Audit

[![Validate Skill](https://github.com/snapsynapse/skill-a11y-audit/actions/workflows/validate-skill.yml/badge.svg)](https://github.com/snapsynapse/skill-a11y-audit/actions/workflows/validate-skill.yml)
[![Product release](https://img.shields.io/github/v/release/snapsynapse/skill-a11y-audit?filter=v*)](https://github.com/snapsynapse/skill-a11y-audit/releases/tag/v2.8.0)
[![skills.sh](https://skills.sh/b/snapsynapse/skill-a11y-audit)](https://skills.sh/snapsynapse/skill-a11y-audit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Open, self-hosted accessibility regression evidence for large web
estates. Discover representative templates, preserve selector-level
findings, and prevent AI-generated changes from introducing new barriers
without requiring a legacy site to reach zero violations first.

## Who this is for

Maintainers and coding agents working on public, documentation, government, and content-heavy sites with many URLs and a smaller set of shared templates.

## What problem it solves

Most scanners operate one URL at a time, while strict CI gates are impractical on sites with existing debt. Skill A11y Audit samples large sites by template, produces deterministic evidence, and can fail CI only on newly introduced findings.

## Where it fits

| Layer | Best for | What this project adds |
|---|---|---|
| Storybook, Playwright, axe | Components, states, and authored journeys | Site-wide discovery and deterministic template representatives |
| Accessibility agent suites | Guidance, remediation, and broad orchestration | A small executable evidence pipeline agents can invoke |
| Enterprise platforms | Hosted monitoring, dashboards, and managed programs | Open, self-hosted artifacts and CI policy stored with the repository |

This project does not certify conformance, modify application source,
generate VPATs, simulate screen readers, or provide a hosted dashboard.

## Canonical URL

https://skilla11y.dev/

## Why

Most accessibility tools require manual setup, produce raw violation
dumps, and leave you to figure out what to fix first. This skill:

- **Discovers your site structure automatically** — reads your sitemap
  (or crawls navigation links) and identifies which page templates
  exist, so a 700-page site gets audited by scanning ~20 representative
  pages instead of all of them.
- **Tells you what to fix and where** — groups violations by shared
  template, so you know that fixing one `<nav>` element resolves the
  issue across 200 pages, not just the one you scanned.
- **Installs its own dependencies** — axe-core and Puppeteer are
  resolved automatically. No `npm install` required in your project.
- **Tracks progress over time** — pass a previous audit and the report
  shows what's fixed, what's new, and what changed.
- **Maps evidence to the standard you answer to** — WCAG 2.1 AA by
  default (cited by ADA Title II and EN 301 549), with WCAG 2.2 AA and
  EN 301 549 clause-9 matrices selectable via `--standard`.

## What You Get

A structured report with:

| Section | What it contains |
|---------|-----------------|
| Executive Summary | Total issues by severity, pages scanned |
| Findings by Rule | Each violation with impact, instance count, affected pages, WCAG mapping |
| Quick Fixes | One-liner remediation guidance for each detected rule |
| Color Contrast Details | Exact selectors, ratios, and expected thresholds |
| Standards Evidence Matrix | Automated pass/fail/manual evidence per criterion; WCAG 2.1 AA (50 criteria, default), WCAG 2.2 AA (55 criteria), or EN 301 549 clause 9 via `--standard`; not certification |
| Delta from Previous | Fixed, new, changed, and unchanged rules since last audit |
| Remediation Priority | Violations ranked by severity |
| Sampling Strategy | Template groups, page counts, selection rationale |
| Shared Template Patterns | Which template groups have identical issues |

Output modes:

| Mode | Output | Use case |
|------|--------|----------|
| `markdown` | Markdown report | Human review, docs, PRs |
| `markdown+json` | Report + JSON data file | CI, dashboards, trend tracking |
| `markdown+issues` | Report + issue tracker tickets | GitHub, GitLab, Linear, Jira |

## Install

Options in order of end-user simplicity.

**1. Reviewed assistant install (recommended).** Paste this into any coding
agent:

```text
Fetch and verify https://skilla11y.dev/.well-known/assistant-guide.txt
with GuideCheck (https://guidecheck.org/verify), report the achieved
level and SHA-256, then follow its install action with my approval.
```

The guide is a GuideCheck Level 3 plain-text instruction surface: the text
you review is the text the assistant executes, every action requires your
approval, and each bundled script it runs is SHA-256 pinned.

**2. Skills CLI.** Install from GitHub with the open Skills CLI:

```sh
npx skills add snapsynapse/skill-a11y-audit --skill a11y-audit
```

To try the skill without a persistent install:

```sh
npx skills use snapsynapse/skill-a11y-audit --skill a11y-audit
```

The interactive flow detects supported agents and lets you choose project or
global scope. To select an agent non-interactively:

```sh
# Claude Code, current project (.claude/skills/)
npx skills add snapsynapse/skill-a11y-audit --skill a11y-audit --agent claude-code --yes

# Codex, current project (.agents/skills/)
npx skills add snapsynapse/skill-a11y-audit --skill a11y-audit --agent codex --yes
```

Add `--global` for a personal install. Manual fallback locations are
`~/.claude/skills/a11y-audit/` for Claude Code and
`~/.agents/skills/a11y-audit/` for Codex. Review the skill before installing.

## Quick Start

Ask your agent:

```
Run an accessibility audit on this project.
```

The skill will discover your site structure, scan representative pages,
and generate a report. For large sites, it runs the discover → scan →
report pipeline automatically.

You can also run the scripts directly:

```bash
# 1. Discover site structure and select pages to scan
node a11y-audit/scripts/discover.js \
  --url http://localhost:3000 \
  --output /tmp/discover.json

# 2. Scan the selected pages
node a11y-audit/scripts/scan.js \
  --discover /tmp/discover.json \
  --output /tmp/scan.json \
  --summary

# 3. Generate the report
node a11y-audit/scripts/report.js \
  --input /tmp/scan.json \
  --output-dir ./audits \
  --project-name "My Project" \
  --discover /tmp/discover.json
```

No prior setup needed. scan.js auto-installs axe-core and Puppeteer on
first run if they aren't already available. Add `--standard wcag22-aa`
or `--standard en301549` to the report step to switch the evidence
matrix (default: `wcag21-aa`).

### Invoke the complete pipeline through one process

CI runners and external agent systems can use the vendor-neutral JSON adapter
instead of coordinating each helper separately. It preserves the native
discovery, selection, scan, and report artifacts and records every stage exit
code in a stable run envelope.

Replace: REQUEST_JSON -> path to a reviewed adapter request
Customize
```text
node a11y-audit/scripts/run-audit.js --config REQUEST_JSON
```

Use `--dry-run` to inspect the normalized execution plan without network,
browser, or artifact writes. The complete request and result contract is in
[`references/interoperability.md`](a11y-audit/references/interoperability.md).

### Adopt on a site with existing accessibility debt

Create an accepted baseline after reviewing the current findings:

```bash
node a11y-audit/scripts/scan.js \
  --urls http://127.0.0.1:3000/ \
  --write-baseline .a11y-audit/baseline.json
```

Then fail only on newly introduced findings:

```bash
node a11y-audit/scripts/scan.js \
  --urls http://127.0.0.1:3000/ \
  --baseline .a11y-audit/baseline.json \
  --fail-on new
```

Baseline changes are explicit acceptance decisions. Review and commit
them; never refresh the baseline automatically in CI.

### Adopt in GitHub Actions

The reusable Action can serve a static build, discover representative templates,
apply a reviewed route-group map, prioritize mapped changed surfaces including
directly changed pages, compare against reviewed debt, and upload the scan,
discovery plan, and selection evidence:

```yaml
- uses: snapsynapse/skill-a11y-audit/.github/actions/scan@v2.8.0
  with:
    serve-path: dist
    discover-url: http://127.0.0.1:8088/
    discover-group-map: .a11y-audit/route-group-map.json
    surface-map: .a11y-audit/surface-map.json
    changed-base: ${{ github.event.pull_request.base.sha }}
    changed-head: ${{ github.event.pull_request.head.sha }}
    baseline: .a11y-audit/baseline.json
    fail-on: new
    install-timeout-ms: 120000
    output: artifacts/a11y-scan.json
    discover-output: artifacts/a11y-discover.json
    selection-output: artifacts/a11y-selection.json
```

Adapt `serve-path` to the repository's build output. Pin the Action to the
full release commit SHA where organizational policy requires immutable Action
references.

Discovery reads the site's sitemap by default. Add `discover-no-sitemap: true`
when the served build has no sitemap and should be crawled from
`discover-url` instead.

Copy the route-group and surface-map examples from
`a11y-audit/assets/ci/github-actions/` into `.a11y-audit/`. Route patterns are
project-owned, exact routes outrank wildcards, and schema-v2 surface rules can
derive a same-origin changed page only when it already appears in discovery.
An invalid, incomplete, or ambiguous route-group map records why and scans
every discovered URL. Separately, an unsafe changed-surface map, unavailable
Git history, unmapped file, or shared-code rule retains the complete
representative scan plan. Neither path silently reduces scope. Fetch full Git
history before supplying base and head SHAs; the bundled workflow starter
configures checkout accordingly.

The repository tests this exact consumer path against a served fixture. CI
also runs actionlint for workflow semantics and zizmor for GitHub Actions
security regressions before a release is published. Dependabot maintains
immutable Action and root npm pins. The versioned scanner graph accepts
security updates only; routine upgrades require synchronized eval and manifest
changes.

## Assistant Guide

This repository publishes a GuideCheck `assistant-guide.txt` for bounded
assistant use:

- Web: https://skilla11y.dev/.well-known/assistant-guide.txt
- Repository copy: [assistant-guide.txt](assistant-guide.txt)

The guide is a plain-text instruction surface for installing the skill and
running bounded audits. The GuideCheck 0.7.0 reference verifier currently
reports Level 3 with no blockers. This form claim does not make the guide safe
or make audit results a legal conformance certification.

## How It Works

### Template-Aware Sampling

Large sites have hundreds of pages but only a handful of distinct
templates. `discover.js` classifies every URL by its path pattern and
selects representatives from each group:

```
746 pages found via sitemap
→ 16 template groups identified
→ 22 pages selected for scanning

  regulation/*  (25 regulations): 34 pages → 2 selected (by DOM complexity)
  requires/*/*  (81 provisions):  82 pages → 2 selected (by DOM complexity)
  compare/*:                     561 pages → 2 selected (by DOM complexity)
  ...plus all 9 unique top-level pages
```

For flat or irregular sites, a reviewed route-group map replaces path-depth
classification. Invalid, ambiguous, or incomplete maps expand to one exact
group per discovered URL so configuration errors cannot reduce coverage.

Within each group, pages are ranked by structural complexity (count of
tables, forms, interactive elements) so the scan covers the most and
least complex variants.

### Shared Template Detection

After scanning, the report cross-references violation fingerprints with
template groups:

```
Shared issues on `regulation/*`, `requires/*/*`, `authority/*`: dlitem
→ Fix the shared build template once → resolves across 144 pages
```

### Dependency Resolution

scan.js resolves axe-core and Puppeteer in this order. Auto-install uses the
versions validated by this release; project or global packages can still take
precedence and their resolved versions are recorded:

1. **Skill-local** `deps/` (auto-installed, gitignored)
2. **Target project** `node_modules/`
3. **Global** npm modules
4. **Auto-install** to skill-local `deps/` if not found anywhere

### Version Model

This repository has three release identifiers because the published
surfaces move at different compatibility levels:

- `package.json` uses the public repository release line, currently 2.x.
- `a11y-audit/MANIFEST.yaml` uses the internal bundle inventory version,
  incremented whenever the skill bundle changes.
- `assistant-guide.txt` uses the GuideCheck guide version, incremented
  only when the assistant guide contract changes.

Release notes should mention each identifier when more than one surface
changes.

Current product boundaries and prioritized follow-up work live in
[`a11y-audit/ROADMAP.md`](a11y-audit/ROADMAP.md).

### Delta Tracking

Pass a previous audit JSON to see progress:

```bash
node a11y-audit/scripts/report.js \
  --input /tmp/scan.json \
  --previous ./audits/audit-2026-03-01.json \
  --output-dir ./audits
```

Output:

```
## Delta from Previous Audit
| Metric   | Previous | Current | Change |
|----------|----------|---------|--------|
| Total    | 130      | 33      | -97    |

Fixed: ~~landmark-one-main~~, ~~region~~
Changed: color-contrast 26 → 2 (↓24)
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/discover.js` | Sitemap-first discovery with reviewed route grouping and conservative fallback |
| `scripts/select-changed-surfaces.js` | Maps changed sources to groups and optional direct routes with full-sample fallback |
| `scripts/scan.js` | axe-core scanning with self-contained dependency resolution |
| `scripts/report.js` | Deterministic report generation (markdown + JSON) |
| `scripts/run-audit.js` | Vendor-neutral JSON adapter for the complete audit pipeline |
| `scripts/bootstrap-context.js` | Create workspace-local project configuration |
| `scripts/plan-issues.js` | Dry-run issue planning for tracker integration |

Detailed map contracts live in
[`references/route-grouping.md`](a11y-audit/references/route-grouping.md) and
[`references/changed-surfaces.md`](a11y-audit/references/changed-surfaces.md).

## Tested Against

| Site | Pages | Groups | Scanned | Violations | Key findings |
|------|-------|--------|---------|------------|-------------|
| AI Regulation Reference | 746 | 16 | 22 | 12 | dlitem, nested-interactive, color-contrast on detail templates |
| Virtual Meeting Reference | 449 | 15 | 20 | 130 | color-contrast on group badges, missing landmarks site-wide |
| sam-rogers.com (Zola blog) | 206 | 12 | 15 | 33 | list structure in theme nav, landmark-unique on every page |

## Skill Provenance

This bundle follows the
[Skill Provenance](https://github.com/snapsynapse/skill-provenance)
open standard. Every file carries embedded version metadata
(`skill_bundle`, `file_role`, `version`, `version_date`,
`previous_version`, `change_summary`), and `MANIFEST.yaml` tracks the
full bundle inventory with versioned hashes. This means any agent or
human can verify which version of which file produced a given audit
report, trace changes across sessions, and detect drift between
installed copies and the canonical source.

## Repository Layout

```
a11y-audit/
  SKILL.md              # Core skill instructions (read by agents)
  MANIFEST.yaml         # Bundle inventory with versioned hashes
  CHANGELOG.md          # Version history
  ROADMAP.md            # Durable product boundary and prioritized work
  scripts/              # Reusable Node.js helpers
  references/           # Output contract, platform notes, templates
  evals/                # Eval definitions and recorded results
  assets/               # Sample outputs, CI starter assets
```

## Sponsor

Skill A11y Audit is free and open. If your team uses this skill, consider [sponsoring its development](https://github.com/sponsors/snapsynapse). See [SPONSORS.md](SPONSORS.md).

## About

Skill A11y Audit is an open skill under [Snap Synapse LLC](https://snapsynapse.com/) stewardship, authored by [Sam Rogers](https://www.linkedin.com/in/samrogers). It is used in every public web page across the [PAICE portfolio](https://paice.foundation/) and is MIT-licensed for any use.

## License

MIT
