---
skill_bundle: a11y-audit
file_role: reference
version: 1
version_date: 2026-09-05
previous_version: null
change_summary: >
  Defines the v3 runtime floor, browser acquisition, and security migration.
---

# Runtime compatibility

v3 requires Node.js 22.12.0 or later. Upgrade Node before installing scanner
dependencies or invoking the scripts. Node 18 and 20 are no longer supported.
The reusable GitHub Action defaults to Node 22 and checks
the actual runtime before installing dependencies. Its `node-version` input
can select another supported version, including `22.12.0` for floor testing.

The managed lockfile pins Puppeteer 25.10.0, puppeteer-core 25.10.0, and
`@puppeteer/browsers` 3.2.2. All three require Node >=22.12.0. The browser
installer uses `modern-tar`; the complete root and scanner lockfiles contain
no `extract-zip`. This removes the managed dependency path affected by
[GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv),
which concerns symlink traversal during ZIP extraction. It does not claim
that every browser installation mechanism or user-supplied package is safe.

axe-core stays pinned to 4.12.1. Existing accepted baselines retain their
rule-engine version; review actual finding changes before updating a baseline.

## Browser installation

From the repository root, install the committed scanner graph. Puppeteer's
postinstall acquires its matching Chrome into the configured Puppeteer cache.
Literal
```bash
npm ci --prefix a11y-audit/deps
```
`PUPPETEER_SKIP_DOWNLOAD=true` installs npm packages without acquiring a
browser. A scan then requires the matching Chrome already present in the
same cache, or an explicitly configured compatible executable. To acquire
the pinned Chrome explicitly from the repository root, use the installed
CLI. This command downloads and extracts the browser.
Literal
```bash
a11y-audit/deps/node_modules/.bin/puppeteer browsers install chrome
```
Use the same `PUPPETEER_CACHE_DIR` for installation and scanning. Review
installer settings if npm disables lifecycle scripts. The Action honors
Puppeteer download settings and does not silently override a skipped download.

An installed skill uses the same `deps/` layout under its selected skill
directory. An existing skill-local Puppeteer that differs from the pinned
version triggers a complete locked reinstall before
scanning, so an earlier managed installation cannot silently retain Puppeteer 24.
The scanner can still resolve project or global packages when
skill-local dependencies are absent. Those externally managed graphs are
outside this bundle's lockfile guarantee; inspect their versions and audit
them separately. Install the committed skill-local graph to use the validated
Puppeteer release.

## Verification

`npm run validate` guards both lockfiles, runtime metadata, CI selectors,
the Action runtime check, and nested or aliased extractor reintroduction.
`npm run eval:browser` exercises a real scan and accepted-baseline rescan.
`npm run eval:consumer` copies the bundle without dependencies into a
temporary installation and executes the Action's shell steps from a separate
consumer workspace. It tests an empty browser cache followed by a clean
skip-download reinstall using that cache, then tests replacement of stale
managed Puppeteer metadata through a real locked reinstall. Temporary files are removed after
the run. This test downloads a managed browser and requires loopback access.

The local consumer harness uses the current Node executable. It does not
emulate GitHub setup-node or artifact uploads; the hosted Action consumer
job tests those platform operations. CI also tests the exact Node 22.12.0
floor. Passing local tests does not establish hosted CI or release completion.
