# Accessibility dependency readiness

Prepared 2026-09-07 from `main` at v3.0.0. This is a local v3.1.0 candidate
record. Sam approved scoped local commits on 2026-09-07. Push, release, and
deployment remain outside the authorized scope.
The proposed target release is v3.1.0; `package.json` correctly remains 3.0.0
until a separately authorized release-preparation step.

## Acceptance contract

The confirmed bar is zero current critical or serious standards findings.
Moderate, minor, and explicitly best-practice-only findings remain fully
reported and nonblocking. Best-practice-only classification requires
`best-practice` plus axe `cat.*` tags only; standards or unrecognized tags
prevent downgrading. Existing major
findings fail even when their fingerprints appear in an accepted baseline.

Unknown violation impact is inconclusive. Critical, serious, and unknown-impact
axe `incomplete` candidates are also inconclusive pending review; moderate and
minor incomplete candidates are advisory. Scan errors or an unusable/empty
required scan plan are infrastructure or scope failures and cannot produce a
pass. A pass is scoped automated evidence, not proof of accessibility or legal
conformance.

## Shipped state

- v3.0.0 provides `--fail-on errors|new|none`. `errors` blocks every violation
  regardless of impact. `new` blocks every fingerprint absent from the reviewed
  baseline regardless of impact.
- Fingerprints contain rule, normalized route, and normalized target, but not
  impact. A severity change on the same rule/route/target is therefore not new.
- Reports preserve axe impact, but null impact was omitted from the displayed
  total and axe `incomplete` evidence was not summarized.
- v3.0.0 and the fixed dependency graph shipped 2026-09-05. Dependabot alert 2
  for `GHSA-jmr9-qjv8-65gv` closed automatically at 2026-09-05T20:19:03Z.

## Candidate implementation

- Add `--fail-on major` without changing existing modes or defaults. Exit 2
  represents confirmed major findings; exit 3 represents inconclusive evidence;
operational scan errors retain exit 1.
- In major mode, reject HTTP error and non-HTML responses as missing required
  coverage. Existing modes retain their established response behavior.
- Persist impact counts, rule provenance, best-practice-only classification,
  incomplete-review counts, and gate reasons in scan JSON. Add optional report
  JSON/schema fields and explicit Markdown acceptance language. Matrix status
  precedence in Markdown is `Fail`, `Needs review`, `Pass`, `N/A`, then
  `Manual`. JSON keeps the published v1 matrix vocabulary and carries unresolved
  criteria in an additive `criterion_review` object; their v1 matrix value is
  `manual`, never an unqualified `pass`.
- Forward the value through `run-audit.js` and the composite Action. Do not
  impose the portfolio policy as the Action or adapter default.
- Cover critical/serious failure, moderate/minor pass, explicit
  best-practice-only pass, mixed-tag failure, unknown-impact inconclusive,
  incomplete advisory/blocking behavior, adapter forwarding, Action forwarding,
  report rendering, and schema validation.

## Deferred roadmap

Authenticated deterministic journeys, SARIF output, and first-class Playwright
execution remain future work. Live issue-tracker validation, broader manual
adjudication workflow, external scans, issue creation, and accepted-baseline
rewrites are outside this candidate.

## Validation evidence

- `npm run eval`: 24/24 checks passed.
- `npm run validate`: 29/29 checks passed, including syntax, JSON/YAML,
  manifest hashes and versions, schema validation, dependency/runtime policy,
  Action security, and assistant-guide parity and pinning.
- `npm run build:site` stopped at the repository's hidden-file guard because the
  existing ignored `docs/.DS_Store` remains present. It was preserved; this
  candidate did not modify or clean unrelated local metadata.
- The unchanged build script passed in isolated scratch using a checksum-matched
  copy of `docs/` that excluded only that `.DS_Store`. It staged all three
  reviewed hidden files and generated `_site/schema/audit-v1.json` byte-for-byte
  from the candidate schema. Scratch evidence is recorded in
  `readiness/a11y-site-build/build-validation.json` under the assessment root.
- `npm run eval:browser`: passed the real axe scan, accepted-baseline rescan,
  and missing requested route returning HTTP 404 as inconclusive with exit 1.
- Refreshed copied `sam-rogers.com` pilot: tool-consumer verification passed,
  while the copied artifact correctly failed the major gate with exit 2. All 10
  selected routes scanned with zero page errors. The output recorded 4 confirmed
  major instances, 47 nonblocking instances including 4 explicitly
  best-practice-only instances, and 212 serious incomplete candidates. SC 1.4.3
  rendered `Needs review`.
- `pilot-validation.json` records source identity, input snapshot identity, and
  output hashes. Scanner, report, adapter, schema, and Action hashes were
  rechecked after the exact scan and report run. The source checkout remained
  unchanged and its baseline was not rewritten.
- Final candidate hashes used by the pilot: scanner
  `5d6fad11e116adad2c68b68dfa8db440651058de6d8c7a9cb8838cb1abfa647d`,
  reporter
  `99489a06d2cdaf6904ea4e0c4563f8d6403cb457fcd5744c99de1a302e818f05`,
  adapter
  `a75b3001833ee0cdb0973919f9deeccce5e0efdba824ef7ac1350b4c8653fd65`,
  schema
  `af137c85ae4c26ab650115402d6b9cb386d93c4110745f3e267cebbd6f5bfa4a`,
  and Action
  `226b1c24891da068093ab7216b720295f0452eb2807620093293cd28b50f6aba`.
- Pilot scan JSON SHA-256:
  `57ea117271c6f49ee2ff3e5a6f1c860c533573341e2114330d9035bca17fe626`;
  report JSON:
  `a6502c67081f7bdeb7741c5f61c5ac72791e48938a60cde2821e5e2fb65a2818`;
  report Markdown:
  `6331da40122d4dcf75273f67e3f6be30552863105f915fe4d9b77cbe43fca2d3`.
- The pilot used a copied build artifact. Source-build freshness and production
  behavior are unverified; the failed artifact is not production acceptance and
  no production claim is made.
