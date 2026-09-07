# A11y CLI pilot inventory

Scope: public A11y entrypoints and their direct in-repository consumers, inspected on 2026-09-07 from local major-gate checkpoint `e9ffec4`. This is a bounded inventory, not a complete portfolio dependency graph.

| Surface | Consumer | Pilot disposition |
|---|---|---|
| `a11y-audit/scripts/run-audit.js` | Direct Node invocation documented in README, SKILL and interoperability reference; eval-21 | Add explicitly selected terminal JSON contract; preserve default invocation |
| `discover.js` | Adapter, composite Action, npm discover and discovery evals | Preserve native command and artifact contracts |
| `select-changed-surfaces.js` | Adapter, composite Action and selection evals | Preserve native command and artifact contracts |
| `scan.js` | Adapter, composite Action, npm scan, browser and consumer evals | Preserve existing exits; independently validate scan evidence before translating gate results |
| `report.js` | Adapter, npm report and report evals | Preserve report schema and helper exits; run after a confirmed gate rejection in the new adapter mode |
| `bootstrap-context.js`, `plan-issues.js` | Skill instructions and focused evals | Outside the initial contract implementation |
| Repository validation, build, dependency and search scripts | npm scripts and existing GitHub workflows | Test infrastructure keeps its established exits; no blanket renumbering |

## Compatibility boundary

The default adapter forwards child output, mirrors a nonzero child exit, stops before reporting a rejected scan, writes progressive `run.json`, and prints the final path on success. Existing behavior remains supported.

The reusable Action invokes helper scripts directly. Its current consumers do not acquire the experimental adapter contract merely by receiving this release. The existing Action consumer harness is therefore a regression check, while the new CLI consumer harness separately proves adapter behavior.

Scan results use 2 for rejection and 3 for major-gate inconclusive evidence. These meanings are not global interpretations of any child process returning 2 or 3. Operational and usage errors from older helper scripts often collapse to 1, so the adapter must preserve uncertainty rather than infer a remediation category from terminal prose.

## Promotion criteria

Complete A11y's opt-in pilot and release evidence before migrating GuideCheck or the Portfolio CLI. A second adoption should challenge which parts of the contract are reusable. Extract shared fixtures only after that evidence exists; no LocalBrain path, GitHub Project query, or unpublished producer is required at runtime.
