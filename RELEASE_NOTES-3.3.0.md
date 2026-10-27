# v3.3.0: Security execution defaults

Security release, 2026-10-26. Published tag, asset and hosting evidence is maintained in the repository release record.

## Security fixes

- SEC-001: Dependency checks reject unavailable, malformed and inconsistent npm audit reports. Valid reports remain usable when npm's configured severity threshold produces exit 0 with nonblocking advisories.
- SEC-002: Discovery excludes unapproved sitemap targets; direct sitemap scanning rejects unapproved leaves, child documents and redirects. Scanner top-level navigation and redirects are confined to approved origins. Plan metadata cannot grant new permission.
- SEC-003: Chromium sandboxing is enabled by default. An explicit override is available for a separately isolated runner; there is no silent fallback.
- SEC-004: The temporary Action server binds to loopback, disables directory listings and refuses dotfiles.
- SEC-005: Sitemap reads enforce response, aggregate-byte, document, target-count, redirect and total deadline budgets. Compressed responses are decoded within byte/deadline limits; discarded redirect/error bodies are closed.
- SEC-006: The repository's active main ruleset now requires PRs, resolved review threads and all ten existing GitHub Actions checks on an up-to-date branch. Sam selected zero mandatory approvals. Existing history protections remain, with no bypass actors. This setting is already applied and verified on GitHub independently of candidate publication.

## Compatibility and configuration

The Node floor remains 22.12.0. Managed dependencies are Puppeteer 25.16.0, axe-core 4.12.1, Zod 4.6.7, follow-redirects 1.16.1 and fast-uri 3.1.9 in their respective lockfile graphs. The scanner manifest permits only the pinned Puppeteer lifecycle script under npm's explicit script policy.

Default execution policy is tighter than v3.2.0. Additional target/navigation origins require a reviewed `--allow-origin` list, the Action's `allow-origin` input, or the adapter's `discovery.allowed_origins` array. The legacy cross-origin sitemap-document option does not approve page origins. Explicit URL lists and preview-host rewriting remain supported.

An isolated incompatible runner can explicitly select `--no-sandbox`, Action `no-sandbox: true`, or adapter `scan.no_sandbox: true`. The default remains false and the override emits a warning. Repository Ubuntu fixture jobs opt in explicitly; local verification also exercises sandbox-enabled Chromium.

Direct sitemap limits are 2 MiB per response, 10 MiB total, 50 documents, 10,000 distinct targets, five redirects per document, and thirty seconds for the complete load. Discovery reads use the same bounded HTTP helper with a ten-second absolute deadline per resource. Read [network and browser policy](a11y-audit/references/network-policy.md) before migrating.

## Review and verification

The [release record](ops/v3.3.0-release-preparation.md) owns current test results, source fingerprints, archive digests, independent review and the exact publication boundary. The [remediation record](ops/security/remediation-2026-10-26.md) maps each original finding to its proof and regression coverage.

Guide 0.3.18 binds the released executable bytes and local helper integrity checks. Root and hosted-copy source bytes are identical; the sidecar identifies the published release. The GuideCheck metadata vocabulary uses `status: active`, distinct from release publication status. The prior human `last-reviewed` date is preserved. Local verification does not establish hosted acceptance or independent release anchoring.

## Residual scope

Approved origins and main-frame navigation restrictions are not a network sandbox for arbitrary page subresources, workers, popups, DNS rebinding or browser compromise. Use a suitable isolated runner/network for untrusted sites. Authenticated outputs can still contain sensitive page content despite supplied credential-value redaction. Project/global package fallbacks need separate dependency review.

Automated checks do not certify WCAG or legal conformance. Release assets are built from the approved release commit after exact-head CI. Pages waits for its release tag and named assets before deploying the guide.
