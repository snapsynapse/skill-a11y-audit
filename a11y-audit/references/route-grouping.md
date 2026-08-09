---
skill_bundle: a11y-audit
file_role: reference
version: 1
version_date: 2026-08-09
previous_version: null
change_summary: >
  Defines reviewed route-group maps, specificity, evidence, and conservative
  fallback behavior for flat or irregular site structures.
---

# Route Grouping

The optional route-group map replaces discovery's path-depth heuristic with a
project-owned contract. Use it for flat sites where many unrelated templates
share one-segment URLs, or whenever the heuristic groups do not match the
site's actual template ownership.

## Map contract

Store the map at `.a11y-audit/route-group-map.json` or pass another path with
`discover.js --group-map` or the Action's `discover-group-map` input.

`path_patterns` must be absolute paths. `*` is allowed only as a complete path
segment and matches exactly one segment. Exact literal segments outrank
wildcards. If equally specific matching rules name different groups, the map
is ambiguous.

Replace: HOME_GROUP -> discovery group name for the home page
Replace: SPECIAL_PATH -> exact path for a special standalone page
Replace: SPECIAL_GROUP -> discovery group name for the special page
Replace: REPEATED_GROUP -> discovery group name for other one-segment pages
Customize
```json
{
  "schema_version": 1,
  "rules": [
    {"name": "home", "path_patterns": ["/"], "group": "HOME_GROUP"},
    {"name": "special", "path_patterns": ["SPECIAL_PATH"], "group": "SPECIAL_GROUP"},
    {"name": "repeated pages", "path_patterns": ["/*"], "group": "REPEATED_GROUP"}
  ]
}
```

The map cannot contain origins, queries, fragments, backslashes, traversal,
encoded delimiters, `**`, or partial-segment wildcards. It does not execute
code or infer framework routes.

## Fallback and evidence

Discovery records `routeGrouping.mode` as `mapped`, `heuristic`, or
`full-fallback`. When a supplied map is malformed, incomplete, or ambiguous,
every discovered URL becomes its own exact group. This prevents a bad map
from silently reducing coverage. The evidence records the reason and the
unmatched or ambiguous URLs.

Changing the route-group map in a changed-surface comparison also retains the
complete representative sample. Review the new grouping evidence before
accepting narrower pull-request scans.
