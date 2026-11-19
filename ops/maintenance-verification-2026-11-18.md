# Maintenance verification, 2026-11-18
Scope: local dependency security/integrity correction and handoff reconciliation. No commit, push, PR update, hosted workflow execution, merge, tag, release, deployment, baseline acceptance or external message occurred.
## Starting state
- Fetched origin before editing. Clean `main` at `8c724e4a9991316c2c3361f7a67d5d02963c5939`, 0 ahead/behind upstream and default `origin/main`; zero pre-existing uncommitted paths.
- Local branch: `codex/handoff-dependency-integrity`, based on that main commit. PR #35 and PR #36 remain open as observed through GitHub on November 18.
- Latest GitHub release queried: v3.3.0, published 2026-10-27T04:23:43Z. No new asset-byte or hosted guide verification was performed. Existing publication evidence remains in the v3.3.0 release records. Product version 3.3.0, bundle inventory revision 52 and guide 0.3.18 identify different surfaces.
## Correction and reproduction
Applied the exact lockfile bytes from fetched `origin/dependabot/npm_and_yarn/a11y-audit/deps/follow-redirects-1.16.2`. Only follow-redirects changes, from 1.16.1 to 1.16.2. The corrected lockfile SHA-256 is `87944d804a3ef22579fd4d9476695ab8442c53d91a78055a7c482cdf87f182ab`.
The first unrestricted validation run with that lockfile reproduced PR #36's stale manifest hash: 31/32 checks, only bundle integrity failing. Updated its inventory version/hash, roadmap and changelog metadata, with bundle revision 52. No scanner implementation, axe-core/Puppeteer pin, audit exception, gate, accepted baseline, guide byte or release identity changed.
## Local evidence
| Check | Runtime | Result |
|---|---|---|
| Bundle validation after metadata repair | Node 26.13.0 | 32/32 pass |
| Bundle validation after metadata repair | Node 24.22.3 | 32/32 pass |
| Locked scanner dependency installation | Node 24.22.3 | Pass, 76 packages installed |
| Scanner audit gate | Node 24.22.3 | Pass, zero high/critical advisories |
| Real browser eval | Node 24.22.3 | Pass: scan, accepted-baseline rescan and missing-route major gate |
| Isolated Action consumer | Node 24.22.3 | Pass: clean browser acquisition, skip-download reinstall, stale managed-install recovery, loopback-only server and hidden-path/listing protections |
The raw npm audit response reports one moderate `qs` advisory, GHSA-6pq8-jhm2-2vcw, and zero high/critical advisories. This is not a vulnerability-free claim. The existing empty allowlist and high/critical threshold were preserved. Follow-up triage remains in the maintenance queue.
The initial sandboxed validation was unable to bind a loopback fixture (`EPERM`); the same suite was rerun with the required access. Node 26's npm transport returned `EBADF`, so the audit correctly failed closed as unavailable coverage. Node 24.22.3 was downloaded from the official Node distribution to temporary storage; its archive SHA-256 `ff6e17d4874b76d272212b908cc020d6e815fba5a6c7eaaa06add725840307fd` matched the official checksum list before use. No system runtime configuration changed.
Local consumer checks do not emulate hosted setup-node, artifact upload or protected-branch acceptance. No new hosted CI claim is made. Required hosted checks and independent review remain delivery work.
## Handoff reconciliation
| Temporary source | Disposition |
|---|---|
| October 11 README baseline-regression-first | Remaining example, trial, CI evidence and acceptance requirements transferred to the README section of `ops/maintenance-queue.md`; current-priority pointer in `a11y-audit/ROADMAP.md`. Implementation is reserved for the separate release tranche. |
| November 8 search decoder | Upstream v7 reference, local adaptation constraints, regression cases, verification and post-merge production check transferred to `ops/maintenance-queue.md` |
| November 13 repository review, updated November 17 | Confirmed bounded direction moved to roadmap; refreshed dependency PR evidence, release distinction, authority boundaries and open work retained here and in maintenance queue |
The three temporary files are removed only after verifying these destinations. Pending decoder and adoption work is transferred, not represented as implemented. The original decoder handoff's merge condition still governs delivery completion; transfer out of the temporary queue does not assert that condition has been met.
## Delivery boundary
All candidate changes are local and uncommitted. No committed-but-unpushed work was created. Commit/push/PR and later merge/release actions retain separate authority. Consumer upgrades and baseline acceptance remain owned by their respective repositories and human reviewers.
