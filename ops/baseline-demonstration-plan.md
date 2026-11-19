# Baseline-first README demonstration
Repo-scoped adoption plan, transferred from the October 11 temporary handoff on 2026-11-18. The local synthetic trial and README candidate were implemented on 2026-11-18; hosted consumer red/green proof and delivery remain pending. This is an adoption hypothesis, not evidence of improved conversion or stars.
## Reader outcome
Rework the root README opening so a maintainer first sees existing accessibility findings retained in a reviewed baseline, then one new violation failing a regression comparison, then a short trial they can repeat. Keep title and compact badges; move template sampling, standards matrices, authenticated inputs and methodology after that payoff.
Suggested lead: Keep existing accessibility problems visible. Stop the next change from adding another one. Explain that an axe scan compares against a reviewed baseline and that existing findings stay in the report.
## Reproducible evidence
Use a disposable synthetic local preview page with stable route and IDs: an existing image missing alternative text and an initially named button. Review and baseline the image finding; remove only the button's accessible name to introduce `button-name`; restore the name. Preserve the original element, route and selector. Simplify the fixture if axe reports extra findings rather than editing output or suppressing rules.
Reuse patterns from `a11y-audit/evals/run-browser-eval.js` and `evals/fixtures/eval-3/index.html`. Preserve their existing real button-name scan, unchanged-baseline and missing-route coverage. Add only the missing proof.
| Comparison | Existing findings | New findings | Native result |
|---|---|---|---|
| Unchanged against reviewed baseline | Measured nonzero count | 0 | Exit 0 |
| Button name removed | Same existing fingerprints | Measured button-name count | Exit 2 |
| Button name restored | Same existing fingerprints | 0 | Exit 0 |
These are acceptance targets, not captured results. Replace descriptions with measured counts only after running. Distinguish rule counts from selector-level findings. Show the new rule, route, selector and relevant `baseline.new_findings` entry beside the actual process exit. Verify the same baseline bytes and digest across all comparisons.
## Trial sequence
1. Provide exact source/Skills acquisition and working-directory instructions. The root package is private; do not present it as a published npm CLI. Refresh the exact published pin before writing executable guidance. At reconciliation, the latest release is v3.3.0; main pins Puppeteer 25.16.0 and axe-core 4.12.1.
2. State prerequisites beside the trial: Node >=22.12.0, npm and Puppeteer's matching Chrome. Locked installation can download packages and a browser. Use the same browser cache for install and scan. Verify setup from a clean checkout and retain acquisition time and failures.
3. Install the committed scanner graph with `npm ci --prefix a11y-audit/deps` from the repository root. The owned disposable preview must already be running. Keep artifacts outside its served directory.
4. Scan the one target with `--write-baseline` to a candidate file and `--fail-on none`. Operational errors still fail. Inspect rule, route, selector and impact before explicit human acceptance; writing a candidate is not acceptance.
5. Compare unchanged, changed and restored versions using that accepted baseline and `--fail-on new`. Save each output and exit separately. Do not use `--write-baseline` during comparisons, change baseline bytes, or bypass an axe-version mismatch.
6. Follow the local trial with the CI adoption path. Adapt `a11y-audit/assets/ci/github-actions/accessibility-audit.yml`, preserving permissions and reviewed pins. Use `snapsynapse/skill-a11y-audit/.github/actions/scan` at the selected published pin, after checkout and build, with serve-path, fixed port/route, `.a11y-audit/baseline.json`, fail-on new and a retained output artifact. One page does not require ownership maps or grouping.
7. Before presenting a hosted CI failure/success as observed, obtain an actual failing job attributable to the new finding and a successful corrected rerun against the same baseline. Retain consumer commit/run identity, JSON and baseline digest. The Action never creates or refreshes the accepted baseline. Its always-upload behavior remains subject to authentication artifact protection.
Hosted execution, commit/push, publication and deployment require their own authority. If only local execution is authorized, finish and label the local evidence accurately and leave hosted proof pending.
## Acceptance boundaries
- Place this qualification beside the result: A passing regression check means no new findings in the scanned scope. Existing violations still need remediation; this is not accessibility conformance certification.
- A baseline records debt; it does not accept that debt under another accessibility policy. `fail-on major` evaluates all current critical/serious standards findings including baseline debt. Unknown severity, unresolved possible major findings and missing required coverage must remain inconclusive.
- Installation, browser, authentication and page-load failures are operational failures, not demonstrated accessibility regressions.
- Explain expansion to representative templates and changed surfaces only after the one-page payoff. Disclose sampling limits and unscanned states; automated evidence does not replace manual assistive-technology checks or establish full-site coverage.
- Root README prose alone needs no release or bundle bump. Manifest-listed examples/helpers require normal metadata and hash updates. Edit site source and regenerate staging if the website becomes separately authorized scope.
- Run documentation checks for prose and focused real-browser/example and consumer checks for executable changes. Do not change scanner behavior, finding identity, gate semantics or release policy as part of this adoption tranche.
## Context
The initial opening order came from the October 11 GitHub discovery/adoption review. Presentation remains a hypothesis. The repo roadmap and publication records own implementation and release facts. The cross-portfolio accessibility acceptance policy keeps no-current-major acceptance independent of regression debt; this plan does not activate portfolio-wide gates.
