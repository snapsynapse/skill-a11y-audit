---
skill_bundle: a11y-audit
file_role: reference
version: 1
version_date: 2026-03-02
previous_version: null
change_summary: >
  Bootstrap under skill-provenance system. Initial six-phase pipeline.
---

# Changelog

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
