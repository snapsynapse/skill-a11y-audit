# Guide anchor candidate 0.3.16

Scope: local skill-a11y-audit guide preparation, approved 2026-10-03. No publication.

## Candidate

Root and hosted-source guides match at 8087 bytes, SHA-256
`87700567075d76c536916dc1cee82ba40bb101ef4ef829c81ac47a4452fdbbd8`.
All three scanner actions pin the current scanner. The scanner checks literal
SHA-256 expectations for both `auth-state.js` and `check-runtime.js` before
loading either. Tampered dependencies fail before their code executes.
This is locally tested dependency binding, not a claim that GuideCheck resolves
or verifies the entire executable dependency graph. Public-only guide action
scope is unchanged. Bundle revision is 47; package version remains 3.1.0.

The sidecar is explicitly draft and has matching guide hash and byte count.
Its stale v3.0.0 release URL and release timestamp were removed. It deliberately
lacks immutable release provenance until a release is chosen and authorized.
Do not publish it as an accepted Level 4 manifest.

## Evidence

| Evaluation | Identity and input | Result |
|---|---|---|
| CI-pinned local verifier | `3a5cbb5e880db00e0a8f44b68d89df0a73e53a45`, candidate | Level 3; zero blockers/warnings |
| Tagged 0.7.1 local verifier | `4dbc373daed75a327ec3f14e559140927ae1f8b5`, candidate | Level 3; zero blockers/warnings |
| Current local verifier | `48848bf1b5b48b5ca369a48e1162e7d9b0c1daec`, candidate | Level 2; unchanged `action-block.malformed` on `install-skill` |
| Hosted public verifier | reports 0.7.1; existing public guide hash `5336f01caff74893df033b4cfc8676631de24eb2c1c7526ac8523ad1a628ea35` | Level 2; same installer blocker and missing-nosniff warning |
| Pinned verifier with draft sidecar | candidate | Hash/size match; missing immutable release URL and independent anchor block Level 4 |

The two implementations reporting version 0.7.1 do not behave identically.
Keep commit identity and evaluation mode with every result. The local candidate
was not uploaded or deployed to obtain hosted verification. JSON reports beside
this review preserve all findings. UTC report timestamps fall on October 4;
the user-facing session date is October 3 in America/Denver.

## Validation

- Bundle validation: 30/30, including all scanner pins, public-only scope, helper digests and tampered-helper rejection.
- Authenticated browser and actual Action shell fixture: pass after adding dependency checks.
- CLI contract: 17/17.
- Direct site build stopped on a pre-existing ignored `docs/.DS_Store`; that file was preserved. A clean staging copy of tracked and candidate files passes build and search checks (zero defects/infrastructure failures), with emitted guide and sidecar bytes matching the reviewed sources.
- Independent final-candidate review: approved without actionable blockers. Reviewer verified both guide copies, the scanner and both helper pins, all 77 non-self bundle hashes, the public-only scope, draft provenance and tamper-before-execution tests. Scanner SHA-256: `db62ae74880d569664df153f34efa177f68bf92680b874ce7aed69f5f91d5e7a`. Approval covers local preparation only.

## Remaining gates

The existing installer compatibility correction is still separate work. Release
selection, immutable publication provenance, commit/push and deployment remain
unapproved. Frozen release receipts and public surfaces have not changed.
