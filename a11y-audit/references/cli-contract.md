---
skill_bundle: a11y-audit
file_role: reference
version: 1
version_date: 2026-09-07
previous_version: null
change_summary: >
  Defines the experimental posix-json-v1 process contract for the audit
  adapter.
---

# Experimental CLI Contract

`scripts/run-audit.js` preserves its existing behavior unless the caller
explicitly passes `--contract posix-json-v1`. The selector is experimental. It
does not change the request schema or any helper-script or Action default.

## Process boundary

The selected contract writes exactly one terminal JSON object to stdout. Child
stdout and stderr are diagnostics and are both forwarded to adapter stderr.
The terminal object follows `cli-result-schema.json` and separates operational
completion from the requested accessibility gate.

Terminal stdout always records `terminal: true`. The progressive `run` artifact
records `terminal: false` and `operational.status: running` until the adapter
finishes. If the process terminates without a terminal stdout record, the run
is incomplete even when partial artifacts exist; a progressive file is never
success evidence.

Each stage writes to a unique temporary sibling and the adapter validates the
new artifact before atomically replacing the declared generated file. This
prevents stale evidence from substantiating a new result and avoids deleting a
previous result before its replacement exists. The request, maps, baselines,
previous reports, workspace and output directories are protected from lexical,
symlink and hard-link output aliasing. The report stage replaces only its two
date-named output files, not the report directory. The adapter freezes that UTC
date before preflight and reuses the same declared paths through publication.

A scan status of 2 or 3 is treated as gate evidence only when the newly created
scan artifact structurally agrees with the requested policy and contains no
page errors. A confirmed gate rejection or inconclusive result does not stop
the report stage. A later operational failure takes process precedence while
the terminal result retains the gate outcome.

`--dry-run` validates and prints the planned stages without creating artifacts
or running children. Its gate is `not_evaluated` when a gate was requested.

## Exit status

| Status | Meaning |
|---|---|
| 0 | The pipeline completed and the requested gate accepted, or no gate was requested. |
| 2 | The pipeline and reporting completed with a confirmed gate rejection. |
| 3 | The pipeline and reporting completed with confirmed inconclusive gate evidence. |
| 64 | The contract invocation is malformed or uses an unsupported option or selector. |
| 65 | The request JSON or request data is invalid. |
| 66 | The required request file is missing. |
| 73 | The declared result output cannot be created. |
| 74 | The adapter has specific file I/O failure evidence. |
| 77 | The adapter has specific permission-denied evidence. |
| 1 | A child or generated artifact failed without evidence for a narrower category. |

The adapter records a child signal and nullable raw child status separately.
It does not infer a sysexits category from child diagnostic prose or an
ambiguous child status.

`retryable` and `safe_to_repeat` are conservative. Unknown child and partial
pipeline failures set both to false. Reconcile completed stages and retained
artifacts before manually repeating the operation.

## Invocation

Replace: REQUEST_JSON -> reviewed adapter request inside the target workspace
Customize
```bash
node scripts/run-audit.js --contract posix-json-v1 --config REQUEST_JSON
```
