# v3.2.0 local publication-readiness receipt

Historical R1 preparation checkpoint. Current authority and publication status
are recorded in `../v3.2.0-release-state.json`.

At this checkpoint, this was local preparation only. The existing implementation commit `07f1d75`
is unpushed; this publication-preparation tranche is uncommitted. No tag,
GitHub Release, PR, deployment or hosted-candidate result has been created.

## Reviewed identities

- Guide 0.3.17: `0dc141091020c080717fb03cc3390a83ffae2c99c75ce69abeded7ff0b5f376d`, 8070 bytes.
- Root lockfile: `05432ce397b0365c188be42aeb0c356c5f439a6c5c89e9f0551f4a93e6390916`.
- Site index: `809865c82f253dc8ad4e1f1b79d5667344d691bc353e4e82482d74a587ea5ee8`.
- Full non-receipt candidate hashes and aggregate fingerprint: `candidate-hashes.json`.

Independent review approved local preparation with no remaining blockers after
correcting the site's structured status/date mismatch. It verified all 77
non-self bundle hashes and the scoped fast-uri 3.1.8 validation lockfile patch.
The scanner runtime and dependency pins are unchanged from the prior reviewed
implementation commit. The guide acquisition correction avoids treating npx
execution as a verified dependency-installer exemption.

## Checks

- `guide-pinned.json`: CI-pinned 0.7.0 evaluation, Level 3 with zero blockers/warnings.
- `guide-current.json`: current exact-commit 0.7.1 evaluation, Level 3 with zero blockers/warnings.
- `guide-manifest.json`: required fields and candidate hash/size match; independent external anchor remains absent. This is not Level 4 acceptance.
- Final archive checks and asset hashes: `artifact-smoke.json`. Each archived file was read back against the staged source. Tar extraction is used for the clean consumer tests; ZIP file contents are compared byte-for-byte too.
- Clean staged build/search: zero defects or infrastructure failures; ignored source `.DS_Store` preserved and excluded.
- Root audit after the fast-uri patch: zero vulnerabilities. Scanner audit gate passes with no unreviewed high/critical advisories.
- Read-only skills-monorepo audit passed inventory checks.

The working-tree archives in `dist/v3.2.0/` are local review artifacts. They
must be rebuilt from the approved release commit, with final archive readback
and signatures, before publication. Evidence receipts are excluded from the
aggregate source fingerprint to avoid recursive self-hashing. Later receipt
updates do not imply changes to tested source bytes.

## Next approval boundary

Review `../v3.2.0-release-preparation.md` for the concrete delivery sequence.
Commit/stage, branch push and PR, signed tag/release/assets, merge/Pages and
post-deploy hosted acceptance remain distinct authorized steps. The draft
manifest must not be described as a published independent anchor. The live
public guide's old installer result is not cleared until its deployed hash is
verified through the hosted service.
