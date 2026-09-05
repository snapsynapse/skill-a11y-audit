<!-- Upstream template: portfolio-search-indexing-audit contract v4 -->
---
title: "Search indexing"
purpose: "Property-specific index policy, validation commands, deployment gate, and console follow-up."
status: active
updated: 2026-08-20
owner: "Snap Synapse LLC"
open_tasks: []
---
# Search indexing

Canonical origin: `https://skilla11y.dev/`

Provider property: Google Search Console `sc-domain:skilla11y.dev`

Property type: website

Generated output: `_site`

Source boundary: `docs/`, plus `a11y-audit/references/output-schema.json` for the published schema.

Deployment boundary: `npm run build:site` stages the reviewed GitHub Pages artifact in `_site`; `.github/workflows/pages.yml` uploads that exact directory and preserves only the reviewed hidden files.

## Index policy

| Surface | Policy | Reason |
|---|---|---|
| `https://skilla11y.dev/` | Index and include in `sitemap.xml` | The sole canonical HTML reader destination |
| Unknown routes and GitHub Pages hosted 404 responses | Return HTTP 404 and omit from sitemap | Not content destinations; no custom `404.html` is published |
| `/robots.txt`, `/llms.txt`, `/schema/audit-v1.json`, `/favicon.svg`, and `/imgs/og.png` | Crawlable machine or media surfaces; omit from HTML sitemap | Discovery, validation, or presentation assets rather than HTML destinations |
| `/.well-known/assistant-guide.txt` and `/.well-known/assistant-guide-manifest.txt` | Crawlable machine surfaces; omit from HTML sitemap | Agent installation and integrity surfaces, not HTML destinations |
| GitHub repository, LinkedIn, and other external copies | Omit from sitemap | Distribution or reference surfaces are not site-canonical pages |

There are no intentional HTML `noindex` routes. JSON-LD is required on `/`; all JSON-LD must parse, and the `TechArticle.dateModified`, Open Graph `article:modified_time`, and sitemap `lastmod` dates must agree.

The canonical HTML surface is English-only. There are no alternate-language routes or `hreflang` relationships to govern.

## Redirect policy

- The protocol redirect from the bare HTTP origin must finish at `https://skilla11y.dev/`.
- Both protocol variants of the alternate `www` host must finish at `https://skilla11y.dev/`.
- These redirect sources are expected exclusions and must not be submitted for indexing or treated as defects in the GSC `Page with redirect` category.

## Validation lanes

- Offline: `node scripts/check-search.mjs`
- Production after deployment: `node scripts/check-production-search.mjs`
- Machine-readable output: add `--json`
- Local HTTP test: add `--base=http://127.0.0.1:8765/` after starting the static server on port 8765

Exit code `0` is pass, `1` is a site defect, and `2` is configuration or infrastructure failure.

## Deployment and console sequence

1. Run the normal build and offline search contract.
2. Ensure repository-wide checks include newly scaffolded files, including checks based on `git ls-files`.
3. Deploy through the repository's normal release path.
4. Wait for the deployment to complete.
5. Run the production search contract.
6. Confirm the deployed sitemap URL set matches the repository sitemap.
7. Submit or refresh discovery surfaces only after the production check passes.
8. Inspect or request indexing for canonical HTML pages.
9. Start issue-group validation only when matching production behavior is live.
10. Record console state under `ops/search/<provider>/YYYY-MM-DD/`.

## Expected noise

- Intentional protocol and alternate-host redirects.
- Machine surfaces and first-party media omitted from the HTML sitemap.
- GitHub Pages hosted 404 crawl noise for unknown routes.
- Insufficient Core Web Vitals field data is unknown, not a pass or defect.

## Evidence governance

- Sanitized dated observations belong under `ops/search/<provider>/YYYY-MM-DD/audit.md`; historical observations are append-only evidence and are not rewritten when provider state changes.
- Raw exports, screenshots, traces, authenticated URLs, browser state, and unreviewed downloads must remain outside Git or under ignored `.search-evidence-private/` or `.playwright-mcp/` paths.
- Private evidence must never be placed under the publicly deployed `docs/` tree.
- Missing, stale, insufficient, unknown, and zero are distinct states. Do not substitute one for another.
- The current dated record is [`ops/search/GoogleSearchConsole/2026-08-09/audit.md`](search/GoogleSearchConsole/2026-08-09/audit.md). No provider export was captured.

## Current classified state

| Observation | Classification | Current disposition |
|---|---|---|
| Repository, staged artifact, and production contract passed for the one canonical page | Healthy verified state | Preserve the contract and rerun it only for relevant changes or release verification |
| Canonical page is indexed | Healthy console observation | No indexing request |
| Three protocol or alternate-host sources are excluded as redirects | Expected noise | Do not start `Validate fix` |
| Accepted sitemap refresh still had the prior last-read date at observation time | Pending recrawl or reporting latency | Wait for Google to read the accepted sitemap |
| Core Web Vitals had insufficient field data | Unknown because evidence is insufficient | Do not treat as a pass, failure, or performance-remediation trigger |
| Structured-data and video reports were not exposed in the observed property surfaces | Unknown because evidence is absent | Do not report zero issues from absent reports |

## Action ledger

| Provider and property | Action and target | Accepted time | Visible confirmation | Result class | Repeat policy | Next-review condition |
|---|---|---|---|---|---|---|
| Google Search Console `sc-domain:skilla11y.dev` | Refreshed existing `https://skilla11y.dev/sitemap.xml` | 2026-08-09; exact time not captured | `Sitemap submitted successfully`; Submitted changed to 2026-08-09 and status remained `Success` | Pending recrawl | Never repeat solely because Last read remains stale | Recheck when Last read advances beyond 2026-08-05 or newer provider evidence contradicts the accepted state |
| Google Search Console `sc-domain:skilla11y.dev` | Relative entry `sitemap.xml` | 2026-08-09 | Rejected as an invalid sitemap address | External limitation, non-mutating attempt | Do not retry the relative form; use the full canonical URL | None unless the provider changes its domain-property submission behavior |

Active validation batches: none. The redirect group remained `Not Started` by policy.

## Do not repeat

- Do not resubmit `https://skilla11y.dev/sitemap.xml` while the accepted 2026-08-09 refresh is awaiting a newer last-read date.
- Do not retry the rejected relative sitemap entry `sitemap.xml`.
- Do not request indexing for `https://skilla11y.dev/` while it remains indexed.
- Do not request indexing for machine files, media, redirect sources, alternate-host sources, or unknown routes.
- Do not start `Validate fix` for the three policy-consistent redirect exclusions.
- Do not invoke performance remediation solely because Core Web Vitals field data is insufficient.

## Next review

Commit `7e952ff` passed repository, CI, deployment, and production validation for the repaired contract. Reconcile the property again only when the sitemap Last read advances beyond 2026-08-05, the Page indexing report updates beyond 2026-08-06, Google reports a new reason group or failed validation, or a relevant repository or deployment change creates newer evidence. Until then, the remaining work is provider recrawl and reporting latency.
