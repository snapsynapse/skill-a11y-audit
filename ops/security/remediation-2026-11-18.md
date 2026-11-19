# November 18 remediation record, reconciled November 19

Repo scope: `skill-a11y-audit`. This records the fixes traced to [the historical audit](audit-2026-11-18.md). The audit observations and their original evidence remain unchanged. The merged source changes do not change the published v3.3.0 release or guide 0.3.18. Sam chose to keep that guide pinned to published tag bytes; local validation checks it against `v3.3.0` while the candidate bundle receives separate integrity tests.

## Findings disposition

| ID | Local disposition | Verification |
|---|---|---|
| RV-001 | Fixed: successful HTML target readiness is required for every gate mode; operational failures retain partial scan results. | Real Chromium 404, 500, non-HTML, missing-response and successful-HTML matrix for `new`, `errors`, `none`, `major`; 19 CLI contract controls. |
| RV-002 | Fixed: native and both adapter modes preflight output/input collisions; native JSON publication is atomic; contract temporary files are rechecked before publication. | Same-path, symlink, hardlink, ancestor and protected temporary-symlink controls; accepted input digest preserved. |
| RV-003 | Fixed: accepted sitemap-index children and cycles fail incomplete with partial diagnostics, and published incomplete plans cannot be reused for scanning or selection. | 200+503, timeout, oversized, invalid compression, nested failure, self/multi-node cycles, CLI and both adapter modes. |
| RV-004 | Fixed: runtime discovery decodes XML text once and handles multiline locations. | Named, numeric, nested, invalid-scalar and received-query controls. |
| RV-005 | Fixed: required, unknown and repeated CLI gate options fail before dependency/browser work. | Argument matrix and legitimate boolean/value controls. |
| RV-006 | Fixed: malformed relative or protocol-relative links do not abort valid sibling extraction. | Discovery parser fixture. |
| RV-007 | Merged: both root search validators use one-pass XML decoding and trimmed locations; live canonical comparisons decode before comparison. | Shared table-driven test of both actual functions and built-site search validation. Production search after delivery remains open. |
| SEC-007 | Merged: Action loopback server rejects symlink and special-file aliases, including index and fallback paths. | Actual HTTP direct/encoded/file/directory/hidden-target/broken-link denials and regular-file controls in isolated consumer. |
| SEC-008 | Merged: authenticated uploads select only enabled, generated regular files and revalidate immediately before collection. | Direct/nested alias, unused-stage, replacement-after-preflight and ordinary-file controls. Hosted upload was not executed. |
| SEC-009 | Merged: report checks scanner bytes before loading; scanner checks its four local executable helpers. | Disposable bundle mutation test rejects each dependency before sentinel execution; legitimate report generation passes. Published guide remains tied to v3.3.0. |
| SEC-010 | Fixed: audit gate resolves npm advisory references, rejects dangling/advisory-free cycles and reconciles counts/severities. | Twelve synthetic reports and retained root/scanner reports. |
| SEC-011 | Merged: site build rejects symlinks and special files and leaves generated staging untouched on failed source validation. | Isolated outward, hidden, in-root and broken-link fixtures; normal site build passes. Local `.DS_Store` is preserved but excluded from staging. |
| SEC-012 | Fixed: discovery deduplicates child fetches and bounds documents, aggregate bytes, targets and one deadline. | Injected fetch/clock boundary controls and small loopback propagation test. |
| DEP-004 | Fixed in the local lock candidate: transitive `qs` 6.16.0 to 6.16.1. | Fresh root and scanner npm audit reports each have zero advisories; installed scanner graph reports 6.16.1. Older installed and released graphs are separate. |

## Preventive recommendations

| Item | Local disposition |
|---|---|
| Managed installed dependency identity | Implemented: successful locked install writes a lock digest marker; reuse checks the installed lock, required packages, axe-core and Puppeteer versions. Interrupted or stale installs fail identity. Project/global fallbacks remain externally managed. |
| Baseline-first README proof | Prepared for the release candidate with a synthetic image and button: unchanged/new/restored native exits `0/2/0`, one stable existing finding, one new `button-name`, and identical candidate baseline digest across comparisons. [Measured evidence](evidence/2026-11-18/baseline-demo-local.json) is local and is not a human production-baseline acceptance or hosted CI run. |
| Bundle metadata helper | Deferred to separate maintenance review. Existing bundle manifest integrity validation remains in place. No accepted baseline is regenerated. |
| Release-to-site identity | Implemented local Pages workflow check: current and staged guide, executable and provenance bytes must match the selected release tag. The workflow checks the verifier script's reviewed SHA-256 before running it. Matching and tampered-guide/executable/verifier controls pass. No deployment was performed. |
| Coverage quality | Added behavioral fixtures for confirmed cases and legitimate inputs. The independent pass found sitemap cycles, a mutable Pages verifier, and three partial-evidence bypasses; each was repaired and rechecked. |

## Local verification and remaining stages

Local evidence includes bundle validation, CLI contract, real-browser baseline/readiness/auth/security tests, isolated CLI and warm-cache Action consumers, root and scanner audits, site/search checks, actionlint and diff whitespace review. The Action consumer passed two clean package-install passes using an existing matching Chrome cache, including stale Puppeteer repair. Three attempts at its separate fresh-browser acquisition stalled in Puppeteer postinstall; that one acquisition claim remains unverified. The remediation PRs were pushed and merged after exact-head protected CI; hosted consumer checks passed. Production search, v3.4.0 tag, release, deployment and real consumer adoption remain separate. Human baseline acceptance remains separate.

The original audit's accepted Pages `nosniff` warning remains unchanged. This record does not renew human guide-verification dates or treat local tests as source admission, publication or conformance certification.

The merge sequence was PR #39, #37, #38, #40, #41, #42, #43, #44 and #45. Each passed the independent simplicity review and ten protected checks on its final head. This record does not itself establish a v3.4.0 release.
