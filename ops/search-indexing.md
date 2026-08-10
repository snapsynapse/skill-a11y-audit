<!-- Upstream template: portfolio-search-indexing-audit contract v4 -->
---
title: "Search indexing"
purpose: "Property-specific index policy, validation commands, deployment gate, and console follow-up."
status: active
updated: 2026-08-09
owner: "Snap Synapse LLC"
open_tasks: []
---
# Search indexing

Canonical origin: `https://skilla11y.dev/`

Generated output: `_site`

## Index policy

| Surface | Policy | Reason |
|---|---|---|
| `https://skilla11y.dev/` | Index and include in `sitemap.xml` | The sole canonical HTML reader destination |
| Unknown routes and GitHub Pages hosted 404 responses | Return HTTP 404 and omit from sitemap | Not content destinations; no custom `404.html` is published |
| `/robots.txt`, `/llms.txt`, `/schema/audit-v1.json`, `/favicon.svg`, and `/imgs/og.png` | Crawlable machine or media surfaces; omit from HTML sitemap | Discovery, validation, or presentation assets rather than HTML destinations |
| `/.well-known/assistant-guide.txt` and `/.well-known/assistant-guide-manifest.txt` | Crawlable machine surfaces; omit from HTML sitemap | Agent installation and integrity surfaces, not HTML destinations |
| GitHub repository, LinkedIn, and other external copies | Omit from sitemap | Distribution or reference surfaces are not site-canonical pages |

There are no intentional HTML `noindex` routes. JSON-LD is required on `/`; all JSON-LD must parse, and the `TechArticle.dateModified`, Open Graph `article:modified_time`, and sitemap `lastmod` dates must agree.

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

## Current baseline

The current dated Google Search Console evidence is recorded under `ops/search/GoogleSearchConsole/2026-08-09/`. Repository and production validation must pass before any console mutation.
