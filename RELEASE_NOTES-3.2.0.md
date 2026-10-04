# v3.2.0: Authenticated scan inputs

This release adds bounded authenticated scans to the existing Puppeteer engine.
Supply Playwright-format cookies and local storage together with per-target
expected URLs and visible readiness selectors. The scanner, JSON adapter and
reusable Action accept the same paired inputs. Each target receives a fresh
context, and authentication failures remain operational failures even when
accessibility gating is disabled.

Supplied state values are redacted from page-derived axe evidence while rule
IDs, severities and tags retain their meaning. Authentication files are
protected against output aliases, and the Action guards upload paths.

The validation lockfile updates fast-uri to fix GHSA-hrr3-gc8f-f4qj.
The scanner verifies its local executable dependencies before loading them.
Guide 0.3.17 replaces third-party installer dispatch with release-specific
source acquisition. Acquiring source does not register an agent-client skill;
the Skills CLI remains documented separately.

## Compatibility and limits

- Node.js 22.12.0 or later; managed Puppeteer 25.10.0 and axe-core 4.12.1 are unchanged.
- Existing unauthenticated behavior, baseline semantics and experimental CLI contract are preserved.
- Authentication supports cookies and local storage only. Queries/fragments, IndexedDB, partitioned cookies, authenticated discovery and bounded journeys are outside this slice.
- Intercepted cross-origin page requests are blocked. This is not a sandbox for hostile applications, workers or popups.
- Reports can contain private page content. Use synthetic accounts and handle artifacts accordingly.
- Guide actions remain public-only. Authenticated scans require separate explicit authorization.

## Validation

See `ops/v3.2.0-release-preparation.md` for candidate tests, exact verifier
identities, artifact readback and outstanding publication gates. Local
conformance is not hosted verification or accessibility certification.
