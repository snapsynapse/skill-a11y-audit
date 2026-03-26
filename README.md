# a11y-audit

[![Validate Skill](https://github.com/snapsynapse/skill-a11y-audit/actions/workflows/validate-skill.yml/badge.svg)](https://github.com/snapsynapse/skill-a11y-audit/actions/workflows/validate-skill.yml)
[![GitHub release](https://img.shields.io/github/release/snapsynapse/skill-a11y-audit.svg)](https://github.com/snapsynapse/skill-a11y-audit/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Drop-in accessibility audit for AI coding agents. Point it at any web
project and get a WCAG 2.1 AA compliance report with prioritized
findings, actionable fix suggestions, and progress tracking — without
the target project needing any accessibility tooling installed.

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

## What You Get

A structured report with:

| Section | What it contains |
|---------|-----------------|
| Executive Summary | Total issues by severity, pages scanned |
| Findings by Rule | Each violation with impact, instance count, affected pages, WCAG mapping |
| Quick Fixes | One-liner remediation guidance for each detected rule |
| Color Contrast Details | Exact selectors, ratios, and expected thresholds |
| WCAG 2.1 AA Matrix | Pass/fail/manual status for all 50 success criteria |
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

### Claude Code

Copy the `a11y-audit/` folder into `.claude/skills/` in the target project:

```bash
cp -r a11y-audit/ /path/to/your-project/.claude/skills/a11y-audit/
```

### Codex

Copy or symlink into your Codex skills directory.

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
  --urls $(node -e "const d=require('/tmp/discover.json'); console.log(d.scanList.join(','))") \
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
first run if they aren't already available.

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

scan.js resolves axe-core and Puppeteer in this order:

1. **Skill-local** `deps/` (auto-installed, gitignored)
2. **Target project** `node_modules/`
3. **Global** npm modules
4. **Auto-install** to skill-local `deps/` if not found anywhere

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
| `scripts/discover.js` | Sitemap-first page discovery with template-aware sampling |
| `scripts/scan.js` | axe-core scanning with self-contained dependency resolution |
| `scripts/report.js` | Deterministic report generation (markdown + JSON) |
| `scripts/bootstrap-context.js` | Create workspace-local project configuration |
| `scripts/plan-issues.js` | Dry-run issue planning for tracker integration |

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
  HANDOFF.md            # Current state and next steps
  scripts/              # Reusable Node.js helpers
  references/           # Output contract, platform notes, templates
  evals/                # Eval definitions and recorded results
  assets/               # Sample outputs, CI starter assets
```

## License

MIT
