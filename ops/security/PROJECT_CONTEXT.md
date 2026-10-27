# Security audit context

## Scope

This record configures security audits of this repository's Node CLI, reusable Action, validation tooling, dependency graphs, and static public site. It is separate from the accessibility audit context in `.a11y-audit/PROJECT_CONTEXT.md`.

## Output Configuration

- output_mode: markdown
- output_path: ops/security/audit-YYYY-MM-DD.md
- previous_audit: ops/security/audit-2026-10-26.md
- Preference selected by Sam on 2026-10-26.
- Preserve audit evidence under `ops/security/evidence/`. The public `docs/` tree is not the audit output location.

## Known Finding IDs

| ID | Severity | Status | Description |
|---|---|---|---|
| SEC-001 | Medium | Fixed in released v3.3.0 | Dependency audit validates complete responses and fails closed |
| SEC-002 | Medium | Fixed in released v3.3.0 | Approved target/navigation origins enforced across discovery, scanner and adapter |
| SEC-003 | Medium | Fixed in released v3.3.0 | Chromium sandbox enabled by default with explicit override |
| SEC-004 | Medium | Fixed in released v3.3.0 | Temporary Action server restricted to loopback without dotfiles/listings |
| SEC-005 | Low | Fixed in released v3.3.0 | Direct sitemap and decoded response work bounded by tested budgets |
| SEC-006 | Low | Fixed on GitHub | PR plus ten strict Actions checks required; zero mandatory approvals chosen by Sam |
| DEP-001 | Moderate | Resolved on main at 2c21b9a | fast-uri updated to 3.1.9 |
| DEP-002 | High | Resolved on main at 2c21b9a | follow-redirects updated to 1.16.1 |
| DEP-003 | High | Resolved on main at 2c21b9a | Puppeteer 25.16.0 graph includes Zod 4.6.7 |

The dependency resolutions are delivered in v3.3.0. The immutable v3.2.0 release retains its original graph. No code finding is accepted risk merely because it remains open in this report.

## Latest remediation

See `remediation-2026-10-26.md` and `../v3.3.0-release-preparation.md`. All six findings are remediated: source fixes are delivered in v3.3.0 and the selected GitHub ruleset is active. Provider, asset and live evidence is retained in `../v3.3.0-publication-receipt.json`; the original full audit remains historical evidence.

## Accepted hosting limitation

Sam explicitly accepted the missing `X-Content-Type-Options: nosniff` response header on 2026-10-26 and chose to retain GitHub Pages and the current DNS without migration. The warning remains visible in verification results. The decision, rationale, scope and review triggers are recorded in [the remediation record](remediation-2026-10-26.md#accepted-hosting-limitation-missing-nosniff-header); no migration or header-remediation task is open.
