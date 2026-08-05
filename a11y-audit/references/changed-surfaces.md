---
skill_bundle: a11y-audit
file_role: reference
version: 1
version_date: 2026-08-04
previous_version: null
change_summary: >
  Defines the portable source-prefix ownership map and conservative fallback
  contract used for changed-surface accessibility scans.
---

# Changed-Surface Selection

Changed-surface selection narrows an existing representative discovery plan
only when every changed repository path maps unambiguously to known template
groups. It never invents source ownership from framework conventions.

## Surface map

Store the project-owned map at `.a11y-audit/surface-map.json` or pass another
path explicitly.

Replace: GLOBAL_RULE_NAME -> descriptive name for shared code requiring all groups
Replace: GLOBAL_SOURCE_PREFIX -> repository-relative prefix for that shared code
Replace: TARGET_RULE_NAME -> descriptive name for one target surface
Replace: TARGET_SOURCE_PREFIX -> repository-relative prefix for that surface
Replace: DISCOVERY_GROUP -> exact group pattern emitted by discover.js
Customize
```json
{
  "schema_version": 1,
  "rules": [
    {
      "name": "GLOBAL_RULE_NAME",
      "source_prefixes": ["GLOBAL_SOURCE_PREFIX"],
      "groups": ["*"]
    },
    {
      "name": "TARGET_RULE_NAME",
      "source_prefixes": ["TARGET_SOURCE_PREFIX"],
      "groups": ["DISCOVERY_GROUP"]
    }
  ]
}
```
`source_prefixes` are normalized repository-relative path prefixes, not glob
expressions. A prefix matches that exact path or a path beneath it. `groups`
must use exact `pattern` values from `discover.js` output. The reserved `*`
group marks shared code that requires the complete representative sample.

## Selection contract

The selector emits a scan-compatible discovery plan with a `changedSurface`
evidence object. Targeted selection occurs only when:

- the map and changed-file input are valid
- at least one file changed
- every changed file matches one or more rules
- every mapped group exists in the discovery plan
- no matched rule contains the global `*` group
- the ownership map itself was not changed by the comparison

Otherwise the output keeps the full original `scanList`, uses mode
`full-fallback`, and records a machine-readable reason. Missing Git history,
unknown groups, changed or malformed ownership maps, unmatched files, and
empty diffs are therefore safe degradations rather than opportunities to skip
coverage.

## Direct invocation

Use a JSON array of repository-relative changed paths:

Replace: DISCOVERY_JSON -> path to the discovery plan
Replace: SURFACE_MAP_JSON -> path to the reviewed ownership map
Replace: CHANGED_FILES_JSON -> path to the JSON array of changed paths
Replace: SELECTED_JSON -> path for the selected scan plan
Customize
```text
node scripts/select-changed-surfaces.js --discover DISCOVERY_JSON --map SURFACE_MAP_JSON --changed-files CHANGED_FILES_JSON --output SELECTED_JSON
```
Or compare two Git object IDs. `--base` accepts a complete 40- or 64-character
object ID. `--head` accepts the same form or `HEAD`:

Replace: DISCOVERY_JSON -> path to the discovery plan
Replace: SURFACE_MAP_JSON -> path to the reviewed ownership map
Replace: BASE_SHA -> complete base Git object ID
Replace: HEAD_SHA -> complete head Git object ID or HEAD
Replace: SELECTED_JSON -> path for the selected scan plan
Customize
```text
node scripts/select-changed-surfaces.js --discover DISCOVERY_JSON --map SURFACE_MAP_JSON --base BASE_SHA --head HEAD_SHA --output SELECTED_JSON
```
The composite GitHub Action exposes both forms. The checked-in workflow starter
uses pull-request base and head SHAs and a full-history checkout. If either SHA
is unavailable, the Action retains the ordinary full representative plan.
