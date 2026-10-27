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
| SEC-001 | Medium | New | Dependency security gate accepts structured npm failures as clean results |
| SEC-002 | Medium | New | Sitemap targets cross the declared same-origin discovery boundary |
| SEC-003 | Medium | New | Chromium sandbox disabled for all scans |
| SEC-004 | Medium | New | Temporary Action web server binds all network interfaces |
| SEC-005 | Low | New | Direct sitemap loader lacks explicit response size and deadline bounds |
| SEC-006 | Low | New | Main ruleset does not require PR review or passing checks |
| DEP-001 | Moderate | Resolved on current main candidate | fast-uri updated to 3.1.9 |
| DEP-002 | High | Resolved on current main candidate | follow-redirects updated to 1.16.1 |
| DEP-003 | High | Resolved on current main candidate | Puppeteer 25.16.0 graph includes Zod 4.6.7 |

The dependency resolutions apply to the maintenance tree, not the immutable v3.2.0 release. No code finding is accepted risk merely because it remains open in this report.
