---
skill_bundle: a11y-audit
file_role: reference
version: 2
version_date: 2026-09-05
previous_version: 1
change_summary: >
  Promotes verified scan-time dependency resilience work from the processed
  handoff into the prioritized durable roadmap.
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

## Next priorities

1. Scan-time dependency resilience. Make dependency acquisition atomic and
   deterministic on fresh runners: distinguish timeouts from non-zero exits,
   retry transient installs with bounded backoff, avoid rewriting the committed
   dependency manifest, expose the install timeout as configuration, and fetch
   `http-server` before starting the readiness clock. Acceptance requires tests
   for a slow or failing registry, a consumer that supplies only `axe-core`, and
   an empty `deps/node_modules` consumer run.
2. Authenticated deterministic journeys. Accept a Playwright storage state or
   bounded journey file as scan input. Do not expand into an unconstrained
   browser agent.
3. SARIF output. Add a repository-native emitter for organizations using
   GitHub code scanning while preserving the existing JSON contract as the
   universal CI surface.
4. First-class Playwright execution. Add it only where it improves
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
- Re-review `GHSA-jmr9-qjv8-65gv` by 2026-11-30, when GitHub closes the alert,
  or when the supported Node range permits a fixed browser dependency graph.

## Explicit non-goals

- Broad accessibility-agent suite.
- Automated code remediation.
- Generic axe MCP wrapper.
- Hosted dashboard or enterprise monitoring service.
- VPAT generation or conformance certification.
- Screen-reader simulation.
