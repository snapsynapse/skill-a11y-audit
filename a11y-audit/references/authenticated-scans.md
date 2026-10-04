---
skill_bundle: a11y-audit
file_role: reference
version: 2
version_date: 2026-10-03
previous_version: null
change_summary: >
  Records local guide preparation and remaining publication boundaries.
---

# Authenticated scan inputs

This local implementation accepts Playwright-format storage state in the
existing Puppeteer scanner. It does not log in, execute journeys, or certify
that an account has the correct privileges. Obtain fresh state outside the
scanner, using a dedicated test account, and keep it outside version control.

## Inputs

Pass both `--storage-state` and `--auth-targets`, each followed by a local JSON
file path. In the process adapter, use `scan.storage_state` and
`scan.auth_targets` with paths relative to the configured workspace. The
reusable Action exposes `storage-state` and `auth-targets` with the same meaning.

The storage-state object contains `cookies` and `origins` arrays. Cookies use
Playwright's `name`, `value`, `domain`, `path`, `expires`, `httpOnly`, `secure`,
and `sameSite` fields. Session expiry is `-1`. Origins contain an exact origin
and a `localStorage` array of name/value pairs. IndexedDB, session storage,
partitioned cookies, unknown fields, and origins not declared by a target are
rejected. Each input is limited to 1 MiB.

The target file is an array of objects with these required fields:

| Field | Meaning |
|---|---|
| `url` | Exact scan URL, also present in the explicit URL list or selected discovery plan |
| `expected_url` | Exact final URL on the same origin |
| `ready_selector` | CSS selector for a visible element that identifies the authenticated page |

Every selected scan URL needs an assertion. Duplicate target URLs are rejected.
URLs with credentials, queries, or fragments are outside this initial contract.
Assertions should identify protected content, not a shared navigation element.
A successful HTML response, exact final URL, and visible selector are required
before axe runs. The selector wait is bounded to five seconds; navigation
retains the existing thirty-second limit. A navigation during axe also fails.

## Isolation and evidence

Each target gets a fresh browser context initialized from the original state.
Cookie domains must match a declared target hostname (a leading dot is
accepted); imported cookies are narrowed to that hostname. Local storage is
initialized only on the target origin. Cross-origin requests intercepted on the scanned page are
blocked, including redirects and subresources. This is not a network sandbox
for hostile applications, workers, or popups. This intentionally excludes
SSO navigation and sites that require external assets. Use a self-contained
fixture or preview for this first slice; blocked dependencies can affect what
is rendered. Data and blob resources remain available.

Authentication failures are operational failures even with `--fail-on none`.
They produce no successful result for that target and never write an accepted
baseline. Existing unauthenticated defaults and finding fingerprints remain
unchanged. The process adapter retains its gate/operational distinction.

Cookie and local-storage values are redacted from page-derived axe evidence, including HTML
snippets, before findings and reports are derived. Per-target failures use a
fixed diagnostic. This protects supplied values, not arbitrary sensitive page
content or transformed credentials; use synthetic accounts and treat reports
as potentially private. State paths are visible in adapter plans, but state
contents are not included. Input/output aliases are rejected. The Action
checks all uploaded artifact paths before discovery and prevents upload if
that check fails. Do not replace inputs or outputs concurrently during a run.

Discovery remains unauthenticated. Use explicit URLs or a reviewed discover
plan with the scanner, explicit `urls` in the Action, or publicly discoverable
routes in the adapter. This does not yet add authenticated crawling.

## Validation and remaining work

`npm run eval:auth` exercises real cookies and local storage, repeatability,
per-target isolation, expired sessions, wrong destinations, missing readiness,
blocked cross-origin requests, and terminal adapter success/failure.
`npm run validate` includes input-validation and artifact-alias regressions.

Bounded journeys, state-specific baseline identity, and native Playwright
execution remain separate roadmap work. Guide 0.3.16 is prepared locally with refreshed scanner pins and a draft
sidecar. The scanner verifies both local executable dependencies before loading
them. Guide actions remain public-only; authenticated scans need separate user
authorization. Publication and immutable release anchoring remain pending.
