---
skill_bundle: a11y-audit
file_role: reference
version: 1
version_date: 2026-10-26
previous_version: null
change_summary: >
  Defines approved origins, sitemap budgets, sandbox configuration and local serving defaults.
---

# Network and browser policy

v3.3.0 enables Chromium sandboxing and bounds automatic target selection. These are tighter execution defaults than v3.2.0. Use only authorized sites and test accounts.

## Approved origins

Discovery admits page targets only on the origin supplied to `--url`. A direct scanner sitemap is anchored to its URL after applying the operator's optional `--sitemap-find` / `--sitemap-replace` mapping. Child documents, leaf targets and redirects must remain on approved origins. Explicit `--urls` entries are operator-selected targets; their origins are approved for that scan.

Add reviewed origins with `--allow-origin https://docs.example.test,https://preview.example.test`. Each value must be an HTTP(S) origin with no credentials, path, query or fragment. Matching uses parsed origins, including scheme and port; lookalike hostnames do not match. Loopback and internal hosts are allowed when explicitly selected, so local previews work.

The Action exposes the same comma-separated `allow-origin` input. The process adapter accepts a `discovery.allowed_origins` array and forwards it to both discovery and scanning. Discovery-plan `allowedOrigins` and `originPolicy` fields are evidence, not permission grants. The scanner validates plan targets against the plan's runtime origin plus the operator's explicit additional origins. Older hand-authored plans without `runtimeUrl` use the first selected target as their base origin; review such files as trusted operator inputs.

The existing `--allow-cross-origin-sitemaps` option permits additional sitemap documents. It does not approve their page targets or change scan navigation permission. Add each target origin explicitly with `--allow-origin`. Discovery records excluded leaves under `blockedFetches`, with `cross-origin-target` or `invalid-target` reasons. Direct scanning rejects an unapproved sitemap target instead of presenting a partial scan as complete.

Top-level navigation and redirects on the scanned page are restricted to approved origins, including script-initiated navigation during scanning. Ordinary third-party subresources remain available for unauthenticated rendering. Authenticated scans retain their stricter per-target origin interception and exact final URL/readiness assertions.

This is a target/navigation policy, not a hostile-page network sandbox. It does not isolate DNS rebinding, same-origin services, browser popups, workers, arbitrary subresources or a compromised browser. Use an isolated network and runner when scanning untrusted applications; do not place production credentials or sensitive internal services in that environment.

## Fetch budgets

Discovery HTTP reads have a 2 MiB response cap, five redirects and a ten-second absolute deadline covering redirects and body streaming. A continuous trickle of bytes cannot reset the deadline.

Direct scanner sitemap loading is bounded to 2 MiB per response, 10 MiB in total, 50 documents, 10,000 distinct targets and thirty seconds for the complete load. Each document has at most five redirects. Budgets include child sitemap documents and rewritten URLs are validated before fetching. Incomplete, oversized, timed-out and disallowed fetches are operational failures. Operators should split larger estates into deliberate bounded runs.

## Chromium sandbox

Sandboxing is enabled by default. The scanner never silently retries without it. An incompatible host must be repaired or deliberately configured using `--no-sandbox`; the Action accepts `no-sandbox: true`, and the adapter accepts `scan.no_sandbox: true`. This override emits a warning and requires external isolation appropriate to the targets. The default Action input is `false`.

The repository's Ubuntu browser CI explicitly opts into the override only in its self-contained loopback fixture harnesses. Local verification also exercises the default sandbox-enabled path. A hosted fixture override does not establish that a consumer's host supports Chromium sandboxing.

## Temporary Action server

When `serve-path` is supplied, the Action binds the temporary HTTP server to `127.0.0.1`, disables directory listings, and refuses dotfiles. Existing index pages remain available. Select a public build directory; other processes on the same runner can still access a loopback server. No server starts when `serve-path` is empty.
