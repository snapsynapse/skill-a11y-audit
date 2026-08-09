---
skill_bundle: a11y-audit
file_role: evals
version: 2
version_date: 2026-08-04
previous_version: 1
change_summary: >
  Adds a reviewed route-group map and schema-v2 direct-route rule to the
  deterministic Action-consumer fixture.
---

# Eval 19 changed-surface fixture

The consumer Action discovers the eval-3 loopback page, applies this fixture's
route-group map, then uses the repository-relative changed-file list and
schema-v2 surface map to select the known `fixture` group and resolve the
changed `index.html` directly to `/`. The offline eval runner separately covers
global, unmatched, unknown-group, invalid-map, and deterministic targeted
behavior.
