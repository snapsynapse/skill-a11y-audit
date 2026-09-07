---
skill_bundle: a11y-audit
file_role: reference
version: 5
version_date: 2026-09-07
previous_version: 4
change_summary: >
  Reconciles the v3 release and scopes the v3.1 major-findings gate.
---

# Accessibility Audit Roadmap

## Product boundary

skill-a11y-audit is an open, self-hosted accessibility regression gate for
large web estates. Its durable advantage is deterministic template-aware
sampling, selector-level evidence, stable baseline comparison, and
repository-native CI adoption.

It complements broader accessibility agent systems, component testing, manual
assistive-technology practice, and enterprise monitoring. It does not certify
conformance or automatically remediate application code.

## Shipped foundation

- Sitemap-first discovery with reviewed route grouping and conservative
  full-coverage fallback.
- Source-to-surface ownership maps with direct changed-page inclusion and a
  complete representative-plan fallback.
- Reviewed accepted baselines with stable finding fingerprints and
  `fail-on: new` regression gating.
- Pluggable WCAG 2.1 AA, WCAG 2.2 AA, and EN 301 549 evidence matrices.
- A reusable GitHub Action with hosted consumer validation for pull-request
  base and head objects.
- A vendor-neutral JSON process adapter that composes discovery, selection,
  scanning, and report generation without changing the native artifacts.
- Atomic locked scanner and Action dependency acquisition with bounded retries,
  actionable timeout diagnostics, and readiness timing isolated from fetches.

## v3 runtime contract

The Node 22.12+ and Puppeteer 25 migration removes `extract-zip` from the
managed dependency graph. Existing stale skill-local Puppeteer installations
are replaced through a locked reinstall before scanning. Project/global
fallbacks remain externally managed.
See `references/runtime-compatibility.md` for the compatibility contract and
`../ops/v3.0.0-release-preparation.md` for validation evidence and release gates.

v3.0.0 shipped on 2026-09-05. GitHub automatically marked Dependabot alert 2
for `GHSA-jmr9-qjv8-65gv` fixed at 2026-09-05T20:19:03Z after the migrated
dependency graph reached `main`; no manual dismissal occurred.

## v3.1 candidate

Add an explicit total-current-findings gate for teams whose acceptance bar is
zero critical or serious standards findings. `--fail-on major` preserves all
reported findings, treats moderate, minor, and explicitly best-practice-only
rules as nonblocking, and never lets a baseline suppress an existing major
finding. Unknown severity and high-impact incomplete candidates remain
inconclusive until reviewed. See `../ops/dependency-readiness-2026-09-07.md`.

## Next priorities

1. Authenticated deterministic journeys. Accept a Playwright storage state or
   bounded journey file as scan input. Do not expand into an unconstrained
   browser agent.
2. SARIF output. Add a repository-native emitter for organizations using
   GitHub code scanning while preserving the existing JSON contract as the
   universal CI surface.
3. First-class Playwright execution. Add it only where it improves
   deterministic state coverage or reuses an existing project dependency.

## Standing validation work

- Exercise the issue-planning path against a real authenticated tracker before
  describing live ticket creation as validated.
- Use `scripts/plan-issues.js` as the default dry-run step before creating any
  external issue.
- Keep new regression fixes covered by `npm run validate` before updating
  bundle metadata.
- Continue field validation of ownership-map ergonomics, targeted scan timing,
  and conservative fallback evidence on large production sites.
- After the upstream resilience work ships, reassess whether consumers still
  need project-level `http-server` pins. Keep exact `axe-core` pins wherever
  baseline compatibility depends on the scanner version.

## Explicit non-goals

- Broad accessibility-agent suite.
- Automated code remediation.
- Generic axe MCP wrapper.
- Hosted dashboard or enterprise monitoring service.
- VPAT generation or conformance certification.
- Screen-reader simulation.
