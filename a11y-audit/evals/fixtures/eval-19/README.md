---
skill_bundle: a11y-audit
file_role: evals
version: 1
version_date: 2026-08-04
previous_version: null
change_summary: >
  Documents the deterministic Action-consumer inputs for changed-surface
  selection.
---

# Eval 19 changed-surface fixture

The consumer Action discovers the eval-3 loopback page, then uses this
fixture's repository-relative changed-file list and surface map to select the
known `/` discovery group. The offline eval runner separately covers global,
unmatched, unknown-group, invalid-map, and deterministic targeted behavior.
