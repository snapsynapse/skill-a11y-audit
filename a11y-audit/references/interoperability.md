---
skill_bundle: a11y-audit
file_role: reference
version: 1
version_date: 2026-08-31
previous_version: 0
change_summary: >
  Defines the vendor-neutral JSON process adapter for composing discovery,
  changed-surface selection, scanning, and report generation.
---

# Interoperability Adapter

Use `scripts/run-audit.js` when another agent system, CI runner, or local tool
needs one process entrypoint instead of coordinating the four helper scripts.
The adapter preserves their existing JSON contracts and exit codes. It does not
translate findings into a vendor-specific agent or issue format.

## Request

Paths are relative to `workspace`, which is relative to the request file.
Generated artifacts must remain inside that workspace. The default artifact
directory is `.a11y-audit/run`.

Replace: WORKSPACE_PATH -> target workspace relative to this request file
Replace: BASE_URL -> reachable HTTP or HTTPS origin to discover and scan
Replace: ROUTE_MAP_JSON -> reviewed route-group map inside the workspace
Replace: SURFACE_MAP_JSON -> reviewed source ownership map inside the workspace
Replace: BASE_SHA -> complete Git base object ID
Replace: HEAD_SHA -> complete Git head object ID or HEAD
Replace: PROJECT_NAME -> project name for the generated report
Customize
```json
{
  "schema_version": 1,
  "workspace": "WORKSPACE_PATH",
  "artifacts_dir": ".a11y-audit/run",
  "discovery": {
    "url": "BASE_URL",
    "group_map": "ROUTE_MAP_JSON",
    "max_per_group": 2
  },
  "selection": {
    "surface_map": "SURFACE_MAP_JSON",
    "route_group_map": "ROUTE_MAP_JSON",
    "base": "BASE_SHA",
    "head": "HEAD_SHA"
  },
  "scan": {
    "fail_on": "none",
    "summary": true
  },
  "report": {
    "enabled": true,
    "project_name": "PROJECT_NAME",
    "standard": "wcag22-aa",
    "expected_url": "BASE_URL"
  }
}
```

`selection` may instead contain `changed_files`, pointing to a JSON array of
repository-relative paths. `scan.fail_on` accepts `none`, `errors`, or `new`;
`new` also requires `scan.baseline`. The adapter defaults to `none` so report
generation can complete even when findings exist.

## Invocation

Inspect the normalized stage plan without network access, browser startup, or
artifact writes:

Replace: REQUEST_JSON -> path to the adapter request
Customize
```text
node scripts/run-audit.js --config REQUEST_JSON --dry-run
```

Execute the request:

Replace: REQUEST_JSON -> path to the adapter request
Customize
```text
node scripts/run-audit.js --config REQUEST_JSON
```

CI systems can keep a reusable request file and supply event-specific Git
objects at invocation time:

Replace: REQUEST_JSON -> path to the adapter request
Replace: BASE_SHA -> complete CI base object ID
Replace: HEAD_SHA -> complete CI head object ID
Customize
```text
node scripts/run-audit.js --config REQUEST_JSON --base BASE_SHA --head HEAD_SHA
```

`--changed-files` similarly overrides the request's change source with a JSON
file. Supplying both changed files and a Git base is rejected.

## Result

The adapter writes `run.json` with `schema_version`, overall `status`, artifact
paths, ordered stage commands, and each executed stage's exit code. Discovery,
selection, scan, and report artifacts keep their native schemas. On failure,
`run.json` records `failed_stage`, preserves artifacts already produced, and the
adapter exits with that stage's nonzero status.

This process boundary is the compatibility contract. Integrations should read
the JSON artifacts or exit status rather than parse terminal prose.
