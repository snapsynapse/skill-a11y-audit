# CLI contract pilot plan

Prepared: 2026-09-07. Reconciled: 2026-09-08. Status: the A11y pilot shipped in v3.1.0 on 2026-09-07. The CLI contract remains experimental, not a published portfolio standard. Final publication evidence is in [the release receipt](v3.1.0-publication-receipt.json).

Scope: A11y-owned implementation and delivery planning. Cross-portfolio policy remains a proposal until the pilot provides evidence. The supplied LocalBrain reference is design input, not an executable implementation mandate.

The proposal and authority sections below preserve the pre-publication plan. They do not describe an outstanding v3.1.0 release queue or authorize another publication. Subsequent consumer adoption remains separate from A11y release acceptance.

Second adoption (recorded 2026-09-23): GuideCheck, then Portfolio CLI, should test portability of the explicit contract selector, gate/operational separation, terminal JSON, raw child outcomes and conservative retry semantics. Bring demonstrated incompatibilities back to this repository before promoting a shared contract. Preserve A11y's legacy defaults and avoid dependencies on LocalBrain or the Project board. Do not require A11y to adopt GuideCheck's corrected profile before GuideCheck can ship; that would create a circular prerequisite. Authenticated journeys, SARIF, Playwright integration, live tracker validation and field ergonomics stay in `../a11y-audit/ROADMAP.md` and are not prerequisites for this rollout. Consumer pins, guide-profile migrations, source-site findings and baseline decisions remain owned by their respective repositories.

## Objective

Use A11y alone to test a portable, versioned CLI contract without changing existing command behavior or making GuideCheck and Portfolio CLI migration prerequisites.

The current major-findings candidate remains the starting point. Its verified gate semantics and accessibility threshold are unchanged. Publishing that candidate alone would deliver the accessibility feature, but would not complete this CLI contract pilot.

## Bounded implementation proposal

- Inventory public entrypoints and their direct consumers, but implement the pilot at `a11y-audit/scripts/run-audit.js` only.
- Add an explicitly selected experimental CLI contract. Output format selection alone must not silently change exit semantics. Decide the exact selector after reconciling existing adapter argument and request compatibility.
- Preserve existing adapter, helper-script and Action defaults. New gate behavior remains explicitly selected by the caller.
- Distinguish reporting completion, gate acceptance and operational failure. Proposed pilot gate statuses retain 0 for acceptance, 2 for rejection and 3 for inconclusive evidence; these are application conventions, not POSIX requirements.
- Use applicable sysexits categories for operational failures under the new contract, with stable error identifiers. Do not infer precise categories solely from ambiguous child exit numbers or diagnostic prose. Preserve child status in structured evidence; retain an honest generic category where necessary.
- Emit a schema-defined terminal JSON result in machine mode. Keep child progress and diagnostics out of result stdout; document missing terminal output after process termination as incomplete evidence.
- Report completed stages and artifact locations on failure. Distinguish potentially retryable failures from operations safe to repeat.
- Keep the draft contract, schema and conformance cases in this repository so the pilot requires no LocalBrain access or new shared infrastructure.

## Acceptance evidence

Cover accepted major gate, confirmed major rejection, inconclusive evidence, malformed invocation and input, representative operational failure, stdout/stderr separation, terminal-result schema validity and unchanged legacy behavior. Use controlled fixtures rather than depending on external service failures.

Run existing deterministic and browser checks plus a clean consumer smoke. Exercise the contract through a thin CI invocation once its local behavior is validated. Reuse the existing copied-site evidence only where candidate identities remain applicable; rerun changed paths against exact candidate content.

An accessibility finding in the fixture can demonstrate a correctly failing gate. It does not require repairing the consumer website or accepting its baseline.

## Original delivery and authority plan

Local design, implementation and validation can proceed under the agreed pilot approach. Prepare a reviewable release candidate before requesting publication approval.

The tentative release is 3.1.0 only if changes remain additive and compatibility checks substantiate a minor release. Confirm the final version against current tags and release state. Any incompatible default change requires a new decision rather than being folded into this pilot.

Before publication, present the exact commit scope, branch/PR route, version, tag, release assets and site deployment consequences. Sam approved local commits at stable stages on 2026-09-07. Push, merge, tag, GitHub Release and deployment still need explicit delivery authorization. Package metadata is currently private; do not introduce npm publication or any new distribution channel.

Do not create additional GitHub issues or broaden the six previously approved issue bodies under their earlier approval. Prepare any needed Project mutation separately for exact review.

## Estimate and sequence

Planning estimate, not a timed benchmark or scheduled commitment:

| Work | Active elapsed time |
|---|---|
| Contract slice, command inventory and fixtures | 30-60 minutes |
| Adapter implementation and focused compatibility tests | 1.5-3 hours |
| Full checks, clean consumer, independent review and release preparation | 1-2 hours |
| Authorized publication and remote verification | 30-90 minutes, plus provider delays |

Allow roughly 4-8 hours for a verified published pilot, excluding owner response time, unexpected compatibility defects or provider incidents. Re-estimate after the command inventory if the opt-in boundary cannot isolate the changes cleanly.

Use one gpt-5.6-sol agent at medium effort for the bounded implementation, with independent review of exit semantics and failure cases. Do not split concurrent writing across this small adapter. GuideCheck and Portfolio CLI adoption follow the A11y pilot; they need not wait for every optional A11y roadmap item.

After A11y delivery, evaluate the contract against GuideCheck and Portfolio CLI before promoting shared fixtures or requiring a portfolio standard. Estimate each follow-on from its own command/consumer inventory rather than multiplying this pilot estimate across repositories.

## Delivery completion

The major gate was checkpointed at `e9ffec4` and the CLI pilot at `f180997`. v3.1.0 shipped from `6af2c95a56ff058cddf0c6febc71512db1d6d19b` on 2026-09-07. The [release receipt](v3.1.0-publication-receipt.json) records verified downloaded assets and matching live files; [release state](v3.1.0-release-state.json) retains the delivery record. The original preparation plan remains in `v3.1.0-release-preparation.md`. The shipped contract is still experimental; subsequent GuideCheck and Portfolio CLI adoption must be evaluated against their own evidence.
