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

## Sitemap before refresh

- `https://skilla11y.dev/sitemap.xml`
- Type: Sitemap.
- Submitted: 2026-04-09.
- Last read: 2026-08-05.
- Status: Success.
- Discovered pages: 1.
- Discovered videos: 0.
- The sitemap inventory was complete but its last read predated the 2026-08-09 site revision.

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
- After deployment and independent production validation, the existing sitemap was refreshed once by submitting the full canonical URL `https://skilla11y.dev/sitemap.xml`.
- GSC confirmed `Sitemap submitted successfully` and retained status `Success`, 1 discovered page, and 0 discovered videos.
- The submitted date changed to 2026-08-09. The last-read date remained 2026-08-05 immediately after submission, so processing is pending provider latency.
- An initial relative-path entry, `sitemap.xml`, was rejected as an invalid sitemap address. It did not mutate the property. The accepted full canonical submission was not repeated.
- No URL indexing request was made because `https://skilla11y.dev/` is already indexed.
- No `Validate fix` action was started because the three redirect examples exactly match policy.

## Deployment and production reconciliation

- Deployed commit: `7e952ff249dec07b7e04f55aa8ff0d5e29bba839`.
- GitHub Pages workflow `31349420921`: passed, including generated artifact staging, offline search validation, deployment, and the release-triggered production validator.
- Repository validation workflow `31349420885`: passed.
- Independent post-deployment offline result: 1 sitemap page, 0 defects, 0 infrastructure failures.
- Independent post-deployment production result: 1 sitemap page, 0 defects, 0 infrastructure failures.
- Repository and deployed sitemap URL sets matched exactly: `https://skilla11y.dev/`.
- Raw deployed HTML, sitemap, both `.well-known` files, and generated schema matched the staged artifact byte-for-byte.
- Live modification signals agreed on 2026-08-09: sitemap `lastmod`, Open Graph `article:modified_time`, and `TechArticle.dateModified`.

## Evidence classification

| Observation | Classification | Disposition |
|---|---|---|
| Sitemap, Open Graph, and `TechArticle` modification dates disagree in production | Site defect requiring repair | Synchronize dates and deploy the deterministic contract |
| One indexed canonical page | Healthy console observation | No indexing request |
| Three protocol or alternate-host redirects | Expected policy-consistent exclusion | No `Validate fix` |
| Sitemap last read predates current revision | Pending provider processing after justified console action | Existing healthy sitemap refreshed once on 2026-08-09; wait for a new last-read date |
| Core Web Vitals lacks mobile and desktop field data | Unknown because evidence is insufficient | Wait for sufficient Chrome UX Report data |
| Console report dates lag the audit date | Pending recrawl or reporting latency | Reconcile after sitemap refresh and Google recrawl |
