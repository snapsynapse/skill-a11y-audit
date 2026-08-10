# Google Search Console evidence, 2026-08-09

Property: `sc-domain:skilla11y.dev`

Canonical production origin: `https://skilla11y.dev/`

Evidence source: authenticated Google Search Console UI in the shared Comet property tab. No CSV, Google Sheets, or other console export was captured.

## Property identity

- The page URL used `resource_id=sc-domain%3Askilla11y.dev`.
- The visible property selector showed `skilla11y.dev`.
- An initially stale URL Inspection accessibility label named another property while both authoritative surfaces named `skilla11y.dev`; it was disregarded. Subsequent navigation refreshed the label to `skilla11y.dev`.

## Page indexing

- Report filter: All known pages.
- Report last update: 2026-08-06.
- Visible chart ticks spanned 2026-05-11 through 2026-07-27. The UI did not expose exact report-window endpoints in the captured view, so the precise range is unknown.
- Indexed: 1 page, `https://skilla11y.dev/`; example last crawled 2026-07-17.
- Not indexed: 3 pages, one reason.
- `Page with redirect`: 3 pages, validation `Not Started`, first detected 2026-04-13.
  - `http://www.skilla11y.dev/`, last crawled 2026-07-17.
  - `http://skilla11y.dev/`, last crawled 2026-07-16.
  - `https://www.skilla11y.dev/`, last crawled 2026-07-16.
- Classification: expected policy-consistent exclusions. All three sources resolve to `https://skilla11y.dev/`; do not start `Validate fix`.

## URL Inspection

Inspected URL: `https://skilla11y.dev/`

- Stored result: URL is on Google; page is indexed.
- Discovery sitemap: `https://skilla11y.dev/sitemap.xml`.
- Referring pages shown: `https://sam-rogers.com/` and `http://skilla11y.dev/`.
- Last crawl: 2026-07-17 11:19:26 AM, Googlebot smartphone.
- Crawl allowed: Yes.
- Page fetch: Successful.
- Indexing allowed: Yes.
- User-declared canonical: `https://skilla11y.dev/`.
- Google-selected canonical: Inspected URL.
- No indexing request was made because the only canonical HTML page is already indexed.

## Sitemap

- `https://skilla11y.dev/sitemap.xml`
- Type: Sitemap.
- Submitted: 2026-04-09.
- Last read: 2026-08-05.
- Status: Success.
- Discovered pages: 1.
- Discovered videos: 0.
- The sitemap inventory is complete but its last read predates the 2026-08-09 site revision. Refresh only after the repaired sitemap is deployed and production validation passes.

## HTTPS and Core Web Vitals

- HTTPS report last update: 2026-08-08.
- HTTPS URLs: 1.
- Non-HTTPS URLs: 0, no critical issues.
- HTTPS report: no issues detected in the last 90 days.
- Core Web Vitals last update: 2026-08-07, source Chrome UX Report.
- Mobile: not enough usage data in the last 90 days.
- Desktop: not enough usage data in the last 90 days.
- Classification: Core Web Vitals state is unknown due to insufficient field data. No poor URL groups were reported, so the performance-audit skill was not invoked.

## Manual actions, security, removals, and enhancements

- Manual actions: no issues detected.
- Security issues: no issues detected.
- Temporary removals: no requests submitted in the last 6 months.
- Outdated content: no requests submitted in the last 6 months.
- SafeSearch filtering: no requests submitted in the last 6 months.
- Structured-data and video reports: no report was exposed in property navigation or URL Inspection. This is absent evidence, not a claim of zero issues.
- Active validation batches: none. The redirect group is `Not Started` by policy.

## Console actions

- Before deployment: none.
- After deployment: pending production validation and sitemap refresh reconciliation.

## Evidence classification

| Observation | Classification | Disposition |
|---|---|---|
| Sitemap, Open Graph, and `TechArticle` modification dates disagree in production | Site defect requiring repair | Synchronize dates and deploy the deterministic contract |
| One indexed canonical page | Healthy console observation | No indexing request |
| Three protocol or alternate-host redirects | Expected policy-consistent exclusion | No `Validate fix` |
| Sitemap last read predates current revision | Console action justified after production validation | Refresh the existing healthy sitemap after deployment |
| Core Web Vitals lacks mobile and desktop field data | Unknown because evidence is insufficient | Wait for sufficient Chrome UX Report data |
| Console report dates lag the audit date | Pending recrawl or reporting latency | Reconcile after sitemap refresh and Google recrawl |
