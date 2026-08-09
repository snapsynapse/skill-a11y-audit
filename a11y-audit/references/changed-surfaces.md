---
skill_bundle: a11y-audit
file_role: reference
version: 2
version_date: 2026-08-09
previous_version: 1
change_summary: >
  Adds schema-v2 direct changed-page routes and route-group map fallback to
  the portable changed-surface selection contract.
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
  "schema_version": 2,
  "rules": [
    {
      "name": "GLOBAL_RULE_NAME",
      "source_prefixes": ["GLOBAL_SOURCE_PREFIX"],
      "groups": ["*"]
    },
    {
      "name": "TARGET_RULE_NAME",
      "source_prefixes": ["TARGET_SOURCE_PREFIX"],
      "groups": ["DISCOVERY_GROUP"],
      "direct_route": {
        "source_prefix": "TARGET_SOURCE_PREFIX",
        "source_suffix": ".md",
        "route_prefix": "/"
      }
    }
  ]
}
```
`source_prefixes` are normalized repository-relative path prefixes, not glob
expressions. A prefix matches that exact path or a path beneath it. `groups`
must use exact `pattern` values from `discover.js` output. The reserved `*`
group marks shared code that requires the complete representative sample.

Schema 2 optionally adds `direct_route` to a rule. It strips the reviewed
repository-relative `source_prefix` and `source_suffix`, joins the remaining
path to the same-origin `route_prefix`, and treats a final `index` as the
directory route. The derived URL must already appear in discovery evidence.
The selector adds that changed page even when it is not one of the group's
representatives. Schema 1 maps remain accepted but cannot use `direct_route`.

## Selection contract

The selector emits a scan-compatible discovery plan with a `changedSurface`
evidence object. Targeted selection occurs only when:

- the map and changed-file input are valid
- at least one file changed
- every changed file matches one or more rules
- every mapped group exists in the discovery plan
- no matched rule contains the global `*` group
- the ownership map itself was not changed by the comparison
- the route-group map itself was not changed by the comparison
- every applicable direct route resolves uniquely to a discovered same-origin URL

Otherwise the output keeps the full original `scanList`, uses mode
`full-fallback`, and records a machine-readable reason. Missing Git history,
unknown groups, changed or malformed maps, unmatched files, unresolved direct
routes, ambiguous direct routes, and empty diffs are therefore safe
degradations rather than opportunities to skip coverage.

## Direct invocation

Use a JSON array of repository-relative changed paths:

Replace: DISCOVERY_JSON -> path to the discovery plan
Replace: SURFACE_MAP_JSON -> path to the reviewed ownership map
Replace: ROUTE_GROUP_MAP_JSON -> path to the reviewed route-group map
Replace: CHANGED_FILES_JSON -> path to the JSON array of changed paths
Replace: SELECTED_JSON -> path for the selected scan plan
Customize
```text
node scripts/select-changed-surfaces.js --discover DISCOVERY_JSON --map SURFACE_MAP_JSON --group-map ROUTE_GROUP_MAP_JSON --changed-files CHANGED_FILES_JSON --output SELECTED_JSON
```
Or compare two Git object IDs. `--base` accepts a complete 40- or 64-character
object ID. `--head` accepts the same form or `HEAD`:

Replace: DISCOVERY_JSON -> path to the discovery plan
Replace: SURFACE_MAP_JSON -> path to the reviewed ownership map
Replace: ROUTE_GROUP_MAP_JSON -> path to the reviewed route-group map
Replace: BASE_SHA -> complete base Git object ID
Replace: HEAD_SHA -> complete head Git object ID or HEAD
Replace: SELECTED_JSON -> path for the selected scan plan
Customize
```text
node scripts/select-changed-surfaces.js --discover DISCOVERY_JSON --map SURFACE_MAP_JSON --group-map ROUTE_GROUP_MAP_JSON --base BASE_SHA --head HEAD_SHA --output SELECTED_JSON
```
The composite GitHub Action exposes both forms. The checked-in workflow starter
uses pull-request base and head SHAs and a full-history checkout. If either SHA
is unavailable, the Action retains the ordinary full representative plan.
