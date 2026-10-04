# Authenticated input implementation review

Scope: skill-a11y-audit only. Local implementation under the approved September
plan, refreshed against current state on 2026-10-03.

## Starting state

- Fetched origin before edits. Main at `297e891`, synchronized with upstream and default branch; zero uncommitted files and zero unpushed commits.
- The old post-release handoff had already been migrated and removed. Roadmap priority 1 remained authenticated deterministic journeys.
- Baseline validation passed 29/29 before implementation.

## Local result

The scanner now accepts paired storage-state and target-assertion files.
The adapter and Action forward these inputs. Authenticated targets require a
successful HTML response, exact expected URL and visible readiness selector.
Each target receives a fresh browser context. Cookie and local-storage values
are redacted from page-derived axe evidence without changing severity, rule
IDs or tags. Output aliases, including hard links, are rejected. The Action
checks upload paths before discovery and skips upload when that guard fails.

See `a11y-audit/references/authenticated-scans.md` for the precise contract.
This is a bounded first slice: discovery is still unauthenticated; external
page requests are restricted; IndexedDB, partitioned cookies, session storage,
journeys and native Playwright execution are unsupported. It is not a network
sandbox for malicious pages or a guarantee that page content contains no
private information.

## Validation

Local runtime: Node 26.10.0. Hosted CI has not run on this uncommitted candidate.
The existing browser matrix now includes the authentication eval.

| Check | Result |
|---|---|
| `npm run validate` | 29/30; sole failure is unchanged assistant-guide scanner anchor |
| `npm run eval:cli` | 17/17 |
| `npm run eval:auth` | Real scanner, paired cookie/local storage, repeatability, same-run context isolation, expired session, wrong URL, missing selector, cross-origin redirect/subresource rejection, actual Action shell steps and adapter terminal outcomes |
| `npm run eval:browser` | Existing scan, accepted baseline rescan and missing-route major gate pass |
| `npm run eval:cli:consumer` | Four external scenarios pass |
| `npm run eval:consumer` | Fresh acquisition, skip-download reuse, artifact guard and stale managed dependency repair pass |
| `git diff --check` | Pass |

## Initial publication blocker and subsequent approval

The approved implementation scope excluded guide-anchor migration. The guide
remains byte-for-byte unchanged, as do the frozen release receipts. Its
scanner pin is `5d6fad11e116adad2c68b68dfa8db440651058de6d8c7a9cb8838cb1abfa647d`;
the candidate scanner is
`9c0bf0f94f8de48e5cf963dac7c471be6e28fc5dace78da1eacbd96f61b08493`.
The integrity regression intentionally fails until these are reconciled.

Proposed next local tranche: prepare and independently review a guide version
and manifest update covering the scanner and new helper dependency; update
pinned integrity expectations; run full validation and the applicable pinned
and hosted GuideCheck compatibility checks. Keep the existing hosted
`install-skill` opacity finding visible unless separately corrected with
supporting evidence. Do not claim the anchor update alone fixes that finding.

No commit, push, merge, release, deployment, guide modification or branch
cleanup was performed. All implementation changes remain uncommitted on main.

## Approved guide preparation follow-up

The user approved the guide-anchor preparation and independent review.
Guide 0.3.16 now pins the scanner, which verifies both local executable helpers
before loading them. Bundle validation now passes 30/30. The sidecar is draft;
immutable release provenance and the existing installer compatibility finding
remain unresolved. See `guide-anchor-2026-10-03/REVIEW.md` and its retained
verifier reports for current results. Earlier hashes and status above describe
the initial implementation checkpoint, not the final candidate.
