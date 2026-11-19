# Security audit context

## Scope

This record configures security audits of this repository's Node CLI, reusable Action, validation tooling, dependency graphs, and static public site. It is separate from the accessibility audit context in `.a11y-audit/PROJECT_CONTEXT.md`.

## Output Configuration

- output_mode: markdown
- output_path: ops/security/audit-YYYY-MM-DD.md
- previous_audit: ops/security/audit-2026-11-18.md
- Preference selected by Sam on 2026-10-26.
- Preserve audit evidence under `ops/security/evidence/`. The public `docs/` tree is not the audit output location.

## Known Finding IDs

| ID | Severity | Status | Description |
|---|---|---|---|
| SEC-001 | Medium | Fixed in released v3.3.0 | Dependency audit validates complete responses and fails closed; residual reference-graph gap is tracked as SEC-010 |
| SEC-002 | Medium | Fixed in released v3.3.0 | Approved target/navigation origins enforced across discovery, scanner and adapter |
| SEC-003 | Medium | Fixed in released v3.3.0 | Chromium sandbox enabled by default with explicit override |
| SEC-004 | Medium | Fixed in released v3.3.0 | Loopback and lexical hidden-path/listing protections remain; residual symlink escape is tracked as SEC-007 |
| SEC-005 | Low | Fixed in released v3.3.0 | Direct sitemap and decoded response work bounded by tested budgets |
| SEC-006 | Low | Fixed on GitHub | PR plus ten strict Actions checks required; zero mandatory approvals chosen by Sam |
| DEP-001 | Moderate | Resolved on main at 2c21b9a | fast-uri updated to 3.1.9 |
| DEP-002 | High | Resolved on main at 2c21b9a | follow-redirects updated to 1.16.1 |
| DEP-003 | High | Resolved on main at 2c21b9a | Puppeteer 25.16.0 graph includes Zod 4.6.7 |
| SEC-007 | Medium | Open from November 18 audit | Preview server followed outward/hidden-target symlinks |
| SEC-008 | Medium | Open from November 18 audit | Authenticated artifact directories could contain nested input aliases |
| SEC-009 | Medium | Open from November 18 audit | Guide-pinned report entry executed unpinned imported scanner code |
| SEC-010 | Medium | Open from November 18 audit | Missing/cyclic audit advisory references could return a clean gate |
| SEC-011 | Low | Open from November 18 audit | Site staging permitted links outside reviewed docs |
| SEC-012 | Low | Open from November 18 audit | Discovery lacked aggregate work budgets and child-document deduplication |
| DEP-004 | Moderate | Open from November 18 audit | qs 6.16.0 advisory GHSA-6pq8-jhm2-2vcw; reachable stringify exposure not demonstrated |
| RV-001 | Medium | Open from November 18 audit | New-findings gate accepted accessible HTTP 404 response as a scan success |
| RV-002 | Medium | Open from November 18 audit | Native scanner and legacy adapter could overwrite accepted inputs via output aliases |
| RV-003 | Medium | Open from November 18 audit | Required sitemap-child failure silently reduced discovered coverage |
| RV-004 | Medium | Open from November 18 audit | Runtime discovery left XML entities literal and dropped multiline locations |
| RV-005 | Medium | Open from November 18 audit | Bare fail-on flag silently disabled gate selection |
| RV-006 | Low | Open from November 18 audit | Malformed relative href escaped extraction error guard |
| RV-007 | Low | Open from November 18 audit | Search checker chained entity decode was incorrect |

The dependency resolutions are delivered in v3.3.0. The immutable v3.2.0 release retains its original graph. No code finding is accepted risk merely because it remains open in this report.

## October 26 remediation

See `remediation-2026-10-26.md` and `../v3.3.0-release-preparation.md`. All six findings are remediated: source fixes are delivered in v3.3.0 and the selected GitHub ruleset is active. Provider, asset and live evidence is retained in `../v3.3.0-publication-receipt.json`; the original full audit remains historical evidence.

## Accepted hosting limitation

Sam explicitly accepted the missing `X-Content-Type-Options: nosniff` response header on 2026-10-26 and chose to retain GitHub Pages and the current DNS without migration. The warning remains visible in verification results. The decision, rationale, scope and review triggers are recorded in [the remediation record](remediation-2026-10-26.md#accepted-hosting-limitation-missing-nosniff-header); no migration or header-remediation task is open.


## November 18 review

Full code review and security audit of local commit `44328e4786592540575d2ecf97a6103fe890f4eb` is recorded in [audit-2026-11-18.md](audit-2026-11-18.md), with synthetic reproducers and scan evidence in `evidence/2026-11-18/`. Six security-boundary findings, seven correctness/robustness findings and one dependency advisory remain open; no confirmed high/critical finding. All predate the handoff commit. This pass implemented no runtime fixes and granted no release, deployment, baseline or source acceptance. Historical GitHub ruleset and hosted identities were not freshly re-audited.

Later remediation belongs in a separate stack PR. This record preserves the finding state at the November 18 audit.
