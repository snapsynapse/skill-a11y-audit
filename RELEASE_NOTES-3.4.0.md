# v3.4.0: Trustworthy accessibility gates

Product version 3.4.0, skill bundle 63, and assistant guide 0.3.19 are separate identifiers. Publication, asset and hosted verification evidence belongs in the release state and later publication receipt.

## What changed

- Every scan gate now requires a successful HTML response from each target. A 404, 500, non-HTML response, or missing response is an operational failure, including with `--fail-on none`. Successful pages remain in partial evidence when another target fails.
- Required sitemap-index children and cycles fail discovery explicitly. The planner retains partial diagnostics, deduplicates child fetches, and enforces aggregate document, byte, target and deadline budgets. Scanner and selector consumers reject incomplete plans.
- Native and adapter output preflights protect baselines, requests and authentication inputs from direct, symlink, hardlink and ancestor aliases. The POSIX adapter retains shaped partial failure artifacts without a passing gate claim.
- The Action uploads only generated regular artifact files from enabled stages and revalidates them before collection. Its loopback server rejects symlink and special-file aliases. Site staging rejects those aliases and excludes local `.DS_Store` metadata.
- Report generation verifies scanner bytes before importing them. The scanner verifies its local executable dependencies. Managed dependency reuse checks the committed lock digest, installed graph and top-level versions before scanning.
- Npm advisory checks resolve reference graphs and reject dangling, advisory-free cyclic and inconsistent reports. The scanner lock updates `follow-redirects` to 1.16.2 and `qs` to 6.16.1. The reviewed advisory allowlist and high/critical gate threshold are unchanged.
- XML locations and canonical comparisons decode entities once across discovery and both search validators. The README includes a measured synthetic baseline example with native unchanged/new/restored exits `0/2/0`.
- The Pages workflow checks staged guide, executable and provenance bytes against the selected release tag and checks its local verifier hash before use.

## Compatibility and adoption

Node.js 22.12.0 or later, Puppeteer 25.16.0 and axe-core 4.12.1 remain the supported managed runtime. Existing accepted baselines are not regenerated. `--fail-on new` still compares new selector-level findings with a reviewed baseline; `--fail-on major` evaluates all current critical and serious standards findings, including accepted debt. The stricter operational checks can turn a previously green incomplete run red, which is the intended correction. Project and global dependency fallbacks remain externally managed.

Guide 0.3.19 acquires v3.4.0 source and pins the release's discover, select, scan and report executable bytes. Its earlier human `last-reviewed` date is preserved; local hash checks do not renew human verification or establish hosted GuideCheck acceptance. The public guide's deployed identity is verified separately.

## Verification and residuals

The [November 18 remediation record](ops/security/remediation-2026-11-18.md) maps each finding to behavior and local evidence. The candidate passed 42/42 bundle checks, 19 CLI contract checks, a three-state real-browser baseline demonstration, real-browser readiness, authenticated browser and adapter checks, seven security regression groups, and site/search checks. Earlier integrated candidate runs covered warm-cache Action consumers. This local environment could not reach the npm advisory endpoint on the final candidate; exact-head hosted dependency checks must pass before merge. The release state records hosted CI, merge and publication evidence separately.

Fresh empty-cache Chrome acquisition stalled in local consumer attempts and was not established by that lane; hosted consumer results should be read in the release state. Existing Pages `nosniff` acceptance remains in place. Automated results do not certify accessibility or legal conformance; production baseline acceptance and manual assistive-technology testing remain human decisions.

Release assets: `skill-a11y-audit-v3.4.0.tar.gz`, `skill-a11y-audit-v3.4.0.zip`, and `SHA256SUMS`. Package metadata remains private; no npm registry publication is planned.
