---
skill_bundle: a11y-audit
file_role: reference
version: 8
version_date: 2026-09-23
previous_version: 7
change_summary: >
  Adds the open hosted GuideCheck guide finding as maintenance work.
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

## v3.1.0 shipped

v3.1.0 shipped on 2026-09-07. The [publication receipt](../ops/v3.1.0-publication-receipt.json) identifies the released commit and verified assets and live files.

The release adds an explicit total-current-findings gate for teams whose acceptance bar is
zero critical or serious standards findings. `--fail-on major` preserves all
reported findings, treats moderate, minor, and explicitly best-practice-only
rules as nonblocking, and never lets a baseline suppress an existing major
finding. Unknown severity and high-impact incomplete candidates remain
inconclusive until reviewed. See `../ops/dependency-readiness-2026-09-07.md`.

The same release includes an experimental `posix-json-v1` adapter contract. It
separates operational status from gate outcomes, defines terminal JSON, and
retains legacy behavior. See `references/cli-contract.md`. GuideCheck and
Portfolio CLI adoption remain separate consumer work, evaluated against their
own evidence rather than inferred from A11y release acceptance.

## Next priorities

1. Authenticated deterministic journeys. Accept a Playwright storage state or
   bounded journey file as scan input. Do not expand into an unconstrained
   browser agent.
2. SARIF output. Add a repository-native emitter for organizations using
   GitHub code scanning while preserving the existing JSON contract as the
   universal CI surface.
3. First-class Playwright execution. Add it only where it improves
   deterministic state coverage or reuses an existing project dependency.

## Open maintenance

### Assistant guide fails the hosted GuideCheck verifier

Observed 2026-09-07 and reproduced 2026-09-24: the hosted GuideCheck 0.7.1
verifier, within the guide's declared `>=0.7.0, <0.8.0` range, returns
Level 2 for guide SHA-256
`5336f01caff74893df033b4cfc8676631de24eb2c1c7526ac8523ad1a628ea35`.
The blocking `action-block.malformed` finding says `exec-opaque` is permitted
only for exempt dependency commands, identifying `install-skill`. An advisory
also reports a missing `X-Content-Type-Options: nosniff` header, which GitHub
Pages cannot set. GuideCheck's 2.0.0 candidate preview returned the same
result, so this is not a corrected-profile regression. The release's pinned
GuideCheck 0.7.0 Level 3 result remains valid evidence for that evaluator
only. Since 2026-09-23 the README and website state the hosted result and
recommend the Skills CLI.

Next step: reproduce the finding, inspect the installer action and the
versioned opacity rules, then propose either a narrowly scoped guide
correction or an explicit verifier-compatibility policy. Do not weaken
GuideCheck, change frozen reports, rotate anchors, or adopt profile 2.0.0
solely to hide the finding. Changed guide bytes need their own manifest and
anchor plan, consumer validation, and independent review before publication.
Acceptance: the hosted verifier reports Level 3 with no blocking findings for
the published guide hash, and the README and website claims are restored in
the same change.

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
