# Maintenance queue
Repo scope. Reconciled 2026-11-19 after the separately reviewed remediation stack. Product direction is owned by [the roadmap](../a11y-audit/ROADMAP.md). This is a work queue, not a release receipt.
## Delivered to main
- PR #39 updated the scanner lock to `follow-redirects` 1.16.2 and `qs` 6.16.1. PR #44 added managed installed-graph identity checks, including actual transitive package versions. The lock and main checks do not alter older published assets.
- PR #38 delivered the root search entity decoder, site staging containment, npm audit graph checks, and Pages release-byte verification. PRs #40 through #43 delivered scanner readiness, discovery completeness, output and authentication containment, and loopback server containment. PR #45 pinned report generation to reviewed scanner bytes. Each PR passed its exact-head protected checks before normal merge. The historical [verification record](maintenance-verification-2026-11-18.md) describes the earlier evidence base.
- The v3.4.0 release candidate adds a synthetic baseline-first README demonstration and local proof. Its baseline is not a human-accepted production baseline. See [the demonstration plan](baseline-demonstration-plan.md) and [release preparation](v3.4.0-release-preparation.md).
## Publication and remaining checks
- v3.4.0 PR #46 passed all ten exact-head checks and merged. The signed tag, three assets and Pages deployment were verified; hosted production search found zero defects and infrastructure failures. See the [publication receipt](v3.4.0-publication-receipt.md). The accepted Pages `nosniff` limitation remains disclosed.
- Local GuideCheck 0.7.1 reached Level 3 with zero blockers and warnings using a separately fetched immutable repository guide copy. Its local-file mode does not establish hosted Level 4.
- Revisit PR #36 as a likely duplicate and PR #35 as separate setup-uv work. Their old failed runs do not describe the new main. Neither is part of v3.4.0.
- Fresh empty-cache Chrome acquisition stalled in prior local consumer attempts. Hosted Action consumer checks passed on each remediation PR, but a fresh local acquisition claim remains open.
- Production baseline acceptance, manual assistive-technology testing, real consumer adoption and hosted GuideCheck Level 4 require separate evidence.
## Standing boundaries
- Keep `fail-on new` regression and `fail-on major` total-current acceptance separate. A passing gate does not certify conformance.
- Authenticated storage-state inputs have shipped; deterministic journeys and state-aware baseline identity remain pending. Preserve authorization, redaction, reviewed origins, sandboxing and exact axe-version baseline checks.
- External issue planning is dry-run only; real authenticated tracker creation is not established.
- Future consumer upgrades require exact published-pin and baseline compatibility evidence. Never automatically refresh accepted baselines.
