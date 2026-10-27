# Security remediation verification, 2026-10-26

Baseline: [full audit](audit-2026-10-26.md), source `fb72bbef22f07dd676e6c2d427bbc5acbbca8606`, merged on main at `2c21b9a`. Sam requested fixing all six findings and preparing an updated release for review. The original report and vulnerability reproductions remain historical evidence.

## Finding disposition

| ID | Resolution | Verification |
|---|---|---|
| SEC-001 | Fixed in local candidate | Original ENOAUDIT/ECONNRESET cases now exit nonzero; malformed shapes, inconsistent totals and bad advisory records fail; valid clean and moderate-threshold controls pass; high advisories still block. Live root/scanner gates pass with complete zero-advisory responses. |
| SEC-002 | Fixed in local candidate | Default discovery excludes off-origin leaves without fetching them. Direct children/leaves/redirects reject unapproved origins. Forged plan metadata does not grant permission. Actual sandbox-enabled scanner blocks HTTP and script navigation; explicit approved-origin controls and preview rewriting pass. |
| SEC-003 | Fixed in local candidate | Default launch arguments retain Chromium sandboxing. Explicit boolean override is propagated through CLI, adapter and Action. Default browser and explicit trusted-fixture override paths are exercised separately. No automatic fallback exists. |
| SEC-004 | Fixed in local candidate | The bundled Action server binds loopback and denies hidden paths before static serving. The isolated consumer checks the actual bind address, 404 refusal of literal/encoded dotfiles and hidden directories, and 403 refusal of directory listings while scanning an index page successfully. |
| SEC-005 | Fixed in local candidate | Streaming deadlines, wire/decompressed bytes, redirects, aggregate bytes, document count and target count have executable regressions. Continuously streaming discarded responses close promptly. Valid compressed XML works and malformed/compression-bomb inputs fail. |
| SEC-006 | Fixed and active on GitHub | Required PR and ten strict GitHub Actions checks, with resolved threads, zero mandatory approvals and no bypass actors. Read-back/effective-rule evidence is retained. The desired-state regression derives the ten contexts from the actual workflow matrix, preventing accidental check-name drift. |

The source fixes are not yet published. Their status applies to the prepared working tree and review archives, not existing v3.2.0 installations or live public bytes. The `PROJECT_CONTEXT.md` finding table links here for the new baseline.

## Executed proofs and adversarial review

Historical npm and sitemap reproductions established the original failures before editing. New tests exercise the actual audit script with controlled npm subprocess output, real loopback HTTP services, actual scanner navigation and Action shell steps. The stable URL corpus includes ordinary HTTPS, default-port/case normalization, Unicode/punycode equivalence, lookalike hosts, userinfo deception, changed scheme/port and unsupported protocols.

The independent adversarial pass reproduced three issues in the first fix. Redirect/error response bodies outlived the fetch deadline; npm severity-threshold behavior produced a false failure; gzip sitemap input lost compatibility. All three were corrected and retested. The full Action consumer then exposed that http-server's dotfile option hides listings without denying direct requests. A bundled request guard now rejects hidden path segments, including encoded forms, and has a supplementary independent review. The review and portable proofs are in `evidence/2026-10-26-remediation/`; current test outputs and source fingerprints are in `../v3.3.0-readiness/`.

The complete local and archive verification result is maintained in `../v3.3.0-readiness/verification.json`. It records actual runtime versions and separates pending CI/publication from completed tests. No risk acceptance or new human verification date is inferred from passing tests.

## Preserved limits

The origin control covers automatic targets and main-frame navigation. Ordinary unauthenticated subresources remain renderable. Workers, popups, DNS rebinding and browser compromise require external network/runner isolation. Authenticated state still needs explicitly authorized synthetic accounts and sensitive-artifact handling. Project/global package fallback graphs remain external to the managed lockfile guarantee.

Static-host response-header observations and the original accessibility roadmap remain outside these six findings. No unrelated public site or infrastructure setting was changed. Final release and hosted verification remain later approval gates.
