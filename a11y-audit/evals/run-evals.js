#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 18
version_date: 2026-08-19
previous_version: 17
change_summary: >
  Asserts the reviewed-allowlist audit gate replacing the literal npm audit
  commands, including allowlist reason and expiry enforcement.
*/

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmpRoot = '/tmp/a11y-audit-evals';
const validateMode = process.argv.includes('--validate');
const results = [];
const auditSchema = readJsonFromRoot('a11y-audit/references/output-schema.json');
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validateAuditOutput = ajv.compile(auditSchema);

function readJsonFromRoot(file) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', file), 'utf8'));
}

function repoPath(...parts) {
  return path.join(repoRoot, ...parts);
}

function tmpPath(...parts) {
  return path.join(tmpRoot, ...parts);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runNode(args, opts = {}) {
  const run = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...opts,
  });
  if (run.status !== 0) {
    throw new Error([
      `$ node ${args.join(' ')}`,
      run.stdout.trim(),
      run.stderr.trim(),
    ].filter(Boolean).join('\n'));
  }
  return run;
}

function runCommand(command, args) {
  const run = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    throw new Error([
      `$ ${command} ${args.join(' ')}`,
      run.stdout.trim(),
      run.stderr.trim(),
    ].filter(Boolean).join('\n'));
  }
  return run;
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function findGeneratedFile(dir, ext) {
  const matches = fs.readdirSync(dir)
    .filter((entry) => entry.startsWith('audit-') && entry.endsWith(ext))
    .map((entry) => path.join(dir, entry));
  assert.strictEqual(matches.length, 1, `expected one generated ${ext} file in ${dir}`);
  return matches[0];
}

function assertAuditJsonShape(json) {
  for (const key of ['schema_version', 'date', 'tool', 'standard', 'pages', 'summary', 'violations', 'matrix', 'lighthouse']) {
    assert.ok(Object.prototype.hasOwnProperty.call(json, key), `audit JSON missing ${key}`);
  }
  assert.match(json.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(json.pages), 'pages must be an array');
  assert.ok(Array.isArray(json.violations), 'violations must be an array');
  for (const level of ['critical', 'serious', 'moderate', 'minor']) {
    assert.strictEqual(typeof json.summary[level], 'number', `summary.${level} must be numeric`);
  }
  assert.strictEqual(typeof json.matrix, 'object', 'matrix must be an object');
  assert.strictEqual(typeof json.lighthouse, 'object', 'lighthouse must be an object');
  assert.ok(validateAuditOutput(json), ajv.errorsText(validateAuditOutput.errors, { separator: '\n' }));
}

function summarizeImpacts(scan) {
  const summary = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const result of scan.results || []) {
    for (const violation of result.axe?.violations || []) {
      const impact = violation.impact || 'minor';
      summary[impact] += (violation.nodes || []).length;
    }
  }
  return summary;
}

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`FAIL ${name}`);
    console.error(error.stack || String(error));
  }
}

function validateSyntax() {
  const files = [
    'a11y-audit/scripts/discover.js',
    'a11y-audit/scripts/select-changed-surfaces.js',
    'a11y-audit/scripts/scan.js',
    'a11y-audit/scripts/report.js',
    'a11y-audit/scripts/bootstrap-context.js',
    'a11y-audit/scripts/plan-issues.js',
    'a11y-audit/evals/run-discover-fixture.js',
    'a11y-audit/evals/run-evals.js',
  ];
  for (const file of files) runNode(['--check', file]);
}

function validateJsonFiles() {
  const files = [
    'a11y-audit/evals/evals.json',
    'a11y-audit/references/output-schema.json',
    'a11y-audit/assets/sample-output/audit-sample.json',
    'a11y-audit/deps/package.json',
    'a11y-audit/deps/package-lock.json',
    'a11y-audit/assets/ci/github-actions/surface-map.example.json',
    'a11y-audit/assets/ci/github-actions/route-group-map.example.json',
    'a11y-audit/evals/fixtures/eval-19/changed-files.json',
    'a11y-audit/evals/fixtures/eval-19/route-group-map.json',
    'a11y-audit/evals/fixtures/eval-19/surface-map.json',
    'a11y-audit/evals/fixtures/eval-20/route-group-map.json',
    'a11y-audit/evals/fixtures/eval-20/surface-map.json',
  ];
  for (const file of files) readJson(repoPath(file));
  assertAuditJsonShape(readJson(repoPath('a11y-audit/assets/sample-output/audit-sample.json')));
}

function validateManifestIntegrity() {
  const ruby = [
    'require "yaml"',
    'require "json"',
    'require "date"',
    'puts JSON.generate(YAML.safe_load(File.read("a11y-audit/MANIFEST.yaml"), permitted_classes:[Date]))',
  ].join('; ');
  const manifest = JSON.parse(runCommand('ruby', ['-e', ruby]).stdout);
  const listed = new Set();
  const versions = [];
  for (const entry of manifest.files || []) {
    listed.add(entry.path);
    if (Number.isInteger(entry.version)) versions.push(entry.version);
    const file = repoPath('a11y-audit', entry.path);
    assert.ok(fs.existsSync(file), `manifest path does not exist: ${entry.path}`);
    if (entry.path === 'MANIFEST.yaml') continue;
    assert.match(entry.hash || '', /^sha256:[0-9a-f]{64}$/, `invalid manifest hash: ${entry.path}`);
    const bytes = fs.readFileSync(file);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.strictEqual(entry.hash, `sha256:${digest}`, `stale manifest hash: ${entry.path}`);

    const text = bytes.toString('utf8').slice(0, 1600);
    if (/skill_bundle:\s*a11y-audit/.test(text)) {
      const embedded = text.match(/(?:^|\n)[ \t*]*version:\s*(\d+)/)
        || text.match(/skill_bundle:\s*a11y-audit\s*\/\s*file_role:[^/]+\/\s*version:\s*(\d+)/);
      assert.ok(embedded, `embedded version missing: ${entry.path}`);
      assert.strictEqual(
        Number(embedded[1]),
        entry.version,
        `manifest/header version mismatch: ${entry.path}`
      );
    }
  }
  assert.strictEqual(
    manifest.bundle_version,
    Math.max(...versions),
    'bundle_version must equal the highest tracked file version'
  );
  const walk = (dir, prefix = '') => {
    const files = [];
    for (const name of fs.readdirSync(dir).sort()) {
      if (name === 'node_modules' || name === '.DS_Store') continue;
      const absolute = path.join(dir, name);
      const relative = path.posix.join(prefix, name);
      if (fs.statSync(absolute).isDirectory()) files.push(...walk(absolute, relative));
      else files.push(relative);
    }
    return files;
  };
  const unlisted = walk(repoPath('a11y-audit')).filter((file) => !listed.has(file));
  assert.deepStrictEqual(unlisted, [], `bundle files missing from manifest: ${unlisted.join(', ')}`);
}

function validateYamlFiles() {
  const files = [
    'a11y-audit/SKILL.md',
    'a11y-audit/HANDOFF.md',
    'a11y-audit/CHANGELOG.md',
    'a11y-audit/MANIFEST.yaml',
    'a11y-audit/references/claude-code.md',
    'a11y-audit/references/codex.md',
    'a11y-audit/references/project-context-template.md',
    'a11y-audit/references/output-contract.md',
    'a11y-audit/references/issue-trackers.md',
    'a11y-audit/agents/openai.yaml',
    'a11y-audit/assets/ci/github-actions/accessibility-audit.yml',
    '.github/actions/scan/action.yml',
  ];
  const code = [
    'require "yaml"',
    'require "date"',
    `files=${JSON.stringify(files)}`,
    'files.each do |f|',
    'text=File.read(f, encoding:"UTF-8")',
    'payload=(f.end_with?(".md") && text.start_with?("---\\n")) ? text.split(/^---\\n/,3)[1] : text',
    'YAML.safe_load(payload, permitted_classes:[Date])',
    'end',
  ].join('; ');
  runCommand('ruby', ['-e', code]);
}

function validateBootstrapSmoke() {
  const dir = tmpPath('bootstrap');
  resetDir(dir);
  const run = runNode([
    'a11y-audit/scripts/bootstrap-context.js',
    '--workspace', dir,
    '--name', 'Demo',
    '--base_url', 'http://127.0.0.1:3001',
    '--routes', '/,/about',
    '--priority_routes', '/',
    '--output_mode', 'markdown',
    '--fail_on', 'new',
    '--baseline_path', '.a11y-audit/baseline.json',
  ]);
  const outputPath = run.stdout.trim();
  assert.strictEqual(outputPath, path.join(dir, '.a11y-audit', 'PROJECT_CONTEXT.md'));
  const context = fs.readFileSync(outputPath, 'utf8');
  assert.match(context, /- name: Demo/);
  assert.match(context, /- output_mode: markdown/);
  assert.match(context, /## Regression Gate/);
  assert.match(context, /- fail_on: new/);
  assert.match(context, /- baseline_path: \.a11y-audit\/baseline\.json/);
}

function runDiscoverFixture(id) {
  const fixture = `a11y-audit/evals/fixtures/${id}`;
  const run = runNode(['a11y-audit/evals/run-discover-fixture.js', '--fixture', fixture]);
  const actual = JSON.parse(run.stdout);
  const expected = readJson(repoPath(fixture, 'expected.json'));
  const projectExpectedShape = (value, shape) => {
    if (Array.isArray(shape)) return shape.map((entry, index) => projectExpectedShape(value[index], entry));
    if (shape && typeof shape === 'object') {
      return Object.fromEntries(Object.keys(shape).map((key) => (
        [key, projectExpectedShape(value[key], shape[key])]
      )));
    }
    return value;
  };
  assert.deepStrictEqual(projectExpectedShape(actual, expected), expected);
}

function eval2IssuePlanning() {
  const dir = tmpPath('eval-2');
  resetDir(dir);
  const output = path.join(dir, 'issue-plan.md');
  runNode([
    'a11y-audit/scripts/plan-issues.js',
    '--input', 'a11y-audit/evals/fixtures/eval-2/current-scan.json',
    '--context', 'a11y-audit/evals/fixtures/eval-2/context.md',
    '--existing', 'a11y-audit/evals/fixtures/eval-2/existing-keys.json',
    '--output', output,
  ]);
  const plan = fs.readFileSync(output, 'utf8');
  assert.match(plan, /Threshold: `P1`/);
  assert.match(plan, /Planned tickets: 1/);
  assert.match(plan, /Skipped duplicates: 1/);
  assert.match(plan, /Additional standards: CAN-ASC-6\.2/);
  assert.match(plan, /accessibility-p0-critical, accessibility-new, wcag-perceivable, wcag-understandable/);
  assert.match(plan, /<!-- a11y-audit-key: color-contrast::\/ -->/);
  assert.match(plan, /<!-- a11y-audit-key: label::\/checkout -->/);
}

function eval3QuickScan() {
  const dir = tmpPath('eval-3');
  resetDir(dir);
  const scan = readJson(repoPath('a11y-audit/evals/fixtures/eval-3/current-scan.json'));
  assert.strictEqual(scan.results.length, 1, 'quick scan should include exactly one page');
  assert.strictEqual(scan.results[0].url, 'http://localhost:8080/');
  const summary = summarizeImpacts(scan);
  assert.deepStrictEqual(summary, { critical: 1, serious: 0, moderate: 0, minor: 0 });
  assert.strictEqual(scan.results[0].axe.violations[0].id, 'button-name');
  assert.strictEqual(scan.results[0].lighthouse.status, 'skipped');
  assert.ok(!fs.readdirSync(dir).some((entry) => entry.endsWith('.md')), 'quick scan eval must not generate markdown');
}

function eval4SkippedLighthouseReport() {
  const dir = tmpPath('eval-4');
  resetDir(dir);
  runNode([
    'a11y-audit/scripts/report.js',
    '--input', 'a11y-audit/evals/fixtures/eval-4/current-scan.json',
    '--project-name', 'Eval 4 Lighthouse Fixture',
    '--runtime-url', 'https://example.com',
    '--expected-url', 'https://example.com',
    '--output-dir', dir,
  ]);
  const md = fs.readFileSync(findGeneratedFile(dir, '.md'), 'utf8');
  const json = readJson(findGeneratedFile(dir, '.json'));
  assert.match(md, /Lighthouse was skipped: Lighthouse CLI unavailable in fixture environment\./);
  assert.match(md, /\| Lighthouse \| Skipped: Lighthouse CLI unavailable in fixture environment \|/);
  assert.strictEqual(json.lighthouse.status, 'skipped');
  assert.strictEqual(json.lighthouse.reason, 'Lighthouse CLI unavailable in fixture environment');
  assert.strictEqual(json.lighthouse.score, undefined);
  assertAuditJsonShape(json);
}

function eval11ReportDelta() {
  const dir = tmpPath('eval-11');
  resetDir(dir);
  runNode([
    'a11y-audit/scripts/report.js',
    '--input', 'a11y-audit/evals/fixtures/eval-11/current-scan.json',
    '--previous', 'a11y-audit/evals/fixtures/eval-11/previous-audit.json',
    '--discover', 'a11y-audit/evals/fixtures/eval-11/discover.json',
    '--project-name', 'Eval 11 Delta Fixture',
    '--runtime-url', 'https://example.com',
    '--expected-url', 'https://example.com',
    '--output-dir', dir,
  ]);
  const md = fs.readFileSync(findGeneratedFile(dir, '.md'), 'utf8');
  const json = readJson(findGeneratedFile(dir, '.json'));
  assertAuditJsonShape(json);
  assert.ok(json.delta, 'expected delta output');
  const changed = json.delta.changed.find((entry) => entry.rule === 'color-contrast');
  assert.ok(changed, 'color-contrast should be changed');
  assert.deepStrictEqual(changed.previousPages, [
    'https://example.com/blog/post-a',
    'https://example.com/blog/post-b',
  ]);
  assert.deepStrictEqual(changed.currentPages, [
    'https://example.com/docs/guide-a',
    'https://example.com/docs/guide-b',
  ]);
  assert.deepStrictEqual(changed.addedPages, [
    'https://example.com/docs/guide-a',
    'https://example.com/docs/guide-b',
  ]);
  assert.deepStrictEqual(changed.removedPages, [
    'https://example.com/blog/post-a',
    'https://example.com/blog/post-b',
  ]);
  assert.ok(!json.delta.changed.some((entry) => entry.rule === 'region'), 'region should not be changed');
  assert.strictEqual(json.axe_version, '4.12.1');
  assert.strictEqual(json.delta.previousAxeVersion, '4.10.2');
  assert.strictEqual(json.delta.currentAxeVersion, '4.12.1');
  assert.strictEqual(json.delta.axeVersionMismatch, true);
  assert.match(md, /axe-core version changed between audits \(4\.10\.2 → 4\.12\.1\)/);
  assert.match(md, /## Delta from Previous Audit/);
  assert.match(md, /\*\*Changed\*\*:/);
  assert.match(md, /color-contrast:/);
  assert.match(md, /\*\*Unchanged\*\*: region/);
}

function eval15PluggableStandards() {
  const input = 'a11y-audit/evals/fixtures/eval-4/current-scan.json';
  const runStandard = (standard) => {
    const dir = tmpPath(`eval-15-${standard || 'default'}`);
    resetDir(dir);
    const cmd = [
      'a11y-audit/scripts/report.js',
      '--input', input,
      '--project-name', 'Eval 15 Standards Fixture',
      '--output-dir', dir,
    ];
    if (standard) cmd.push('--standard', standard);
    runNode(cmd);
    return {
      md: fs.readFileSync(findGeneratedFile(dir, '.md'), 'utf8'),
      json: readJson(findGeneratedFile(dir, '.json')),
    };
  };

  // Default is behavior-identical WCAG 2.1 AA
  const dflt = runStandard(null);
  assertAuditJsonShape(dflt.json);
  assert.strictEqual(dflt.json.standard.id, 'wcag21-aa');
  assert.strictEqual(Object.keys(dflt.json.matrix).length, 50);
  assert.ok('4.1.1' in dflt.json.matrix, '2.1 keeps 4.1.1 Parsing');
  assert.match(dflt.md, /## WCAG 2\.1 AA Automated Evidence Matrix/);

  // WCAG 2.2 AA: 55 criteria, 4.1.1 removed, six new criteria present
  const w22 = runStandard('wcag22-aa');
  assertAuditJsonShape(w22.json);
  assert.strictEqual(w22.json.standard.id, 'wcag22-aa');
  assert.strictEqual(Object.keys(w22.json.matrix).length, 55);
  assert.ok(!('4.1.1' in w22.json.matrix), '2.2 removes 4.1.1 Parsing');
  for (const sc of ['2.4.11', '2.5.7', '2.5.8', '3.2.6', '3.3.7', '3.3.8']) {
    assert.ok(sc in w22.json.matrix, `2.2 adds ${sc}`);
  }
  assert.match(w22.md, /## WCAG 2\.2 AA Automated Evidence Matrix/);

  // EN 301 549: WCAG 2.1 mapping with clause-9 numbers rendered
  const en = runStandard('en301549');
  assertAuditJsonShape(en.json);
  assert.strictEqual(en.json.standard.id, 'en301549');
  assert.strictEqual(Object.keys(en.json.matrix).length, 50);
  assert.match(en.md, /EN 301 549/);
  assert.match(en.md, /\| Clause \| SC \|/);
  assert.match(en.md, /\| 9\.1\.4\.3 \| SC 1\.4\.3 \|/);

  // Unknown and traversal-shaped ids are rejected before any file read
  for (const bad of ['../evil', 'nope']) {
    const run = spawnSync(process.execPath, [
      'a11y-audit/scripts/report.js',
      '--input', input,
      '--standard', bad,
      '--output-dir', tmpPath('eval-15-bad'),
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.notStrictEqual(run.status, 0, `standard ${bad} must be rejected`);
    assert.match(run.stderr, /standard/i);
  }
}

function scannerBrowserValidation() {
  const scan = require(repoPath('a11y-audit/scripts/scan.js'));
  assert.strictEqual(scan.validateBrowserLib('puppeteer'), 'puppeteer');
  assert.throws(
    () => scan.validateBrowserLib('puppeteer; echo injected'),
    /Unsupported browser library/
  );
  assert.strictEqual(scan.validateAxeVersion('4.12.1'), '4.12.1');
  assert.strictEqual(scan.validateAxeVersion('latest'), 'latest');
  assert.throws(
    () => scan.validateAxeVersion('4.12.1; rm -rf /'),
    /Invalid --axe-version/
  );
  const scanSource = fs.readFileSync(repoPath('a11y-audit/scripts/scan.js'), 'utf8');
  assert.match(scanSource, /spawnSync\('npm', \['install', '--prefix', SKILL_DEPS_DIR, installSpec\]/);
  assert.match(scanSource, /const PINNED_VERSIONS = \{[\s\S]*'axe-core': '4\.12\.1'/);
  assert.doesNotMatch(scanSource, /execSync\(`npm install/);
}

function scannerDiscoverPlanRegression() {
  const scan = require(repoPath('a11y-audit/scripts/scan.js'));
  const dir = tmpPath('discover-plan');
  resetDir(dir);
  const planPath = path.join(dir, 'discover.json');
  fs.writeFileSync(planPath, JSON.stringify({
    scanList: [
      'https://example.com/',
      'https://example.com/',
      'https://example.com/docs',
    ],
  }));
  assert.deepStrictEqual(scan.loadUrlsFromDiscoverPlan(planPath), [
    'https://example.com/',
    'https://example.com/docs',
  ]);
  assert.deepStrictEqual(scan.normalizeScanUrls([
    'https://example.com',
    'https://example.com/',
  ]), ['https://example.com/']);
  assert.throws(() => scan.validateScanUrl('file:///etc/passwd'), /Unsupported scan URL protocol/);
  fs.writeFileSync(planPath, JSON.stringify({ scanList: [] }));
  assert.throws(() => scan.loadUrlsFromDiscoverPlan(planPath), /non-empty scanList/);
}

function eval19ChangedSurfaceSelection() {
  const selector = require(repoPath('a11y-audit/scripts/select-changed-surfaces.js'));
  const plan = {
    source: 'fixture',
    runtimeUrl: 'https://example.com/',
    totalPages: 7,
    selectedPages: 5,
    coverageRatio: '3 template groups, 5 pages selected',
    groups: [
      {
        pattern: '/',
        count: 1,
        selected: ['https://example.com/'],
        reason: 'top-level page',
      },
      {
        pattern: 'docs/*',
        count: 3,
        selected: ['https://example.com/docs/a', 'https://example.com/docs/c'],
        reason: 'representatives',
      },
      {
        pattern: 'blog/*',
        count: 3,
        selected: ['https://example.com/blog/a', 'https://example.com/blog/c'],
        reason: 'representatives',
      },
    ],
    scanList: [
      'https://example.com/',
      'https://example.com/docs/a',
      'https://example.com/docs/c',
      'https://example.com/blog/a',
      'https://example.com/blog/c',
    ],
  };
  const map = {
    schema_version: 1,
    rules: [
      { name: 'docs template', source_prefixes: ['src/docs'], groups: ['docs/*'] },
      { name: 'shared shell', source_prefixes: ['src/shared'], groups: ['*'] },
    ],
  };

  const targeted = selector.selectChangedSurfaces(plan, map, ['src/docs/page.js']);
  assert.strictEqual(targeted.changedSurface.mode, 'targeted');
  assert.strictEqual(targeted.changedSurface.reason, 'mapped-changes');
  assert.deepStrictEqual(targeted.changedSurface.affectedGroups, ['docs/*']);
  assert.deepStrictEqual(targeted.scanList, [
    'https://example.com/docs/a',
    'https://example.com/docs/c',
  ]);
  assert.deepStrictEqual(
    selector.selectChangedSurfaces(plan, map, ['src/docs/page.js']),
    targeted,
    'changed-surface selection must be deterministic'
  );

  const unmatched = selector.selectChangedSurfaces(plan, map, [
    'README.md',
    'src/docs/page.js',
  ]);
  assert.strictEqual(unmatched.changedSurface.mode, 'full-fallback');
  assert.strictEqual(unmatched.changedSurface.reason, 'unmapped-changes');
  assert.deepStrictEqual(unmatched.changedSurface.unmatchedFiles, ['README.md']);
  assert.deepStrictEqual(unmatched.scanList, plan.scanList);

  const global = selector.selectChangedSurfaces(plan, map, ['src/shared/nav.js']);
  assert.strictEqual(global.changedSurface.reason, 'global-surface-rule');
  assert.deepStrictEqual(global.scanList, plan.scanList);

  const unknown = selector.selectChangedSurfaces(plan, {
    schema_version: 1,
    rules: [{ name: 'unknown', source_prefixes: ['src/other'], groups: ['other/*'] }],
  }, ['src/other/page.js']);
  assert.strictEqual(unknown.changedSurface.reason, 'unknown-template-groups');
  assert.deepStrictEqual(unknown.scanList, plan.scanList);

  const dir = tmpPath('eval-19');
  resetDir(dir);
  const invalidMapPath = path.join(dir, 'surface-map.json');
  const changedFilesPath = path.join(dir, 'changed-files.json');
  const changedMapFilesPath = path.join(dir, 'changed-map-files.json');
  fs.writeFileSync(invalidMapPath, '{');
  fs.writeFileSync(changedFilesPath, JSON.stringify(['src/docs/page.js']));
  fs.writeFileSync(changedMapFilesPath, JSON.stringify([
    'a11y-audit/evals/fixtures/eval-19/surface-map.json',
  ]));
  const fallback = selector.buildSelection(plan, {
    map: invalidMapPath,
    'changed-files': changedFilesPath,
  });
  assert.strictEqual(fallback.changedSurface.reason, 'surface-map-invalid');
  assert.deepStrictEqual(fallback.scanList, plan.scanList);

  const mapChanged = selector.buildSelection(plan, {
    map: 'a11y-audit/evals/fixtures/eval-19/surface-map.json',
    'changed-files': changedMapFilesPath,
  });
  assert.strictEqual(mapChanged.changedSurface.reason, 'surface-map-changed');
  assert.deepStrictEqual(mapChanged.scanList, plan.scanList);

  const gitDir = path.join(dir, 'git-repository');
  fs.mkdirSync(path.join(gitDir, 'src', 'docs'), { recursive: true });
  const runGit = (args) => {
    const run = spawnSync('git', args, { cwd: gitDir, encoding: 'utf8' });
    assert.strictEqual(run.status, 0, run.stderr || `git ${args.join(' ')} failed`);
    return run.stdout.trim();
  };
  runGit(['init', '--quiet']);
  runGit(['config', 'user.name', 'A11y Eval']);
  runGit(['config', 'user.email', 'a11y-eval@example.invalid']);
  fs.writeFileSync(path.join(gitDir, 'src', 'docs', 'page.js'), 'first\n');
  runGit(['add', '--', 'src/docs/page.js']);
  runGit(['commit', '--quiet', '-m', 'base']);
  const base = runGit(['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(gitDir, 'src', 'docs', 'page.js'), 'second\n');
  runGit(['add', '--', 'src/docs/page.js']);
  runGit(['commit', '--quiet', '-m', 'head']);
  const head = runGit(['rev-parse', 'HEAD']);
  assert.deepStrictEqual(selector.gitChangedFiles(base, head, gitDir), {
    files: ['src/docs/page.js'],
    source: 'git-diff',
  });

  assert.strictEqual(selector.validCommit('a'.repeat(40)), true);
  assert.strictEqual(selector.validCommit('HEAD', true), true);
  assert.strictEqual(selector.validCommit('--output=/tmp/unsafe'), false);
  assert.strictEqual(selector.surfaceMapWasChanged(
    ['.a11y-audit/surface-map.json'],
    '.a11y-audit/surface-map.json'
  ), true);
  assert.throws(() => selector.normalizeRepositoryPath('../outside'), /traverse/);
  assert.throws(() => selector.normalizeRepositoryPath('.'), /identify/);
}

function eval20FlatRouteGroupingAndDirectPages() {
  const discover = require(repoPath('a11y-audit/scripts/discover.js'));
  const selector = require(repoPath('a11y-audit/scripts/select-changed-surfaces.js'));
  const routeMap = readJson(repoPath('a11y-audit/evals/fixtures/eval-20/route-group-map.json'));
  const surfaceMap = readJson(repoPath('a11y-audit/evals/fixtures/eval-20/surface-map.json'));
  const articleUrls = Array.from({ length: 314 }, (_, index) => (
    `https://example.com/article-${String(index + 1).padStart(3, '0')}`
  ));
  const urls = ['https://example.com/', 'https://example.com/ai-usage', ...articleUrls];
  const grouped = discover.groupDiscoveredUrls(urls, routeMap);
  assert.strictEqual(grouped.routeGrouping.mode, 'mapped');
  assert.strictEqual(grouped.groups.length, 3);
  assert.deepStrictEqual(
    grouped.groups.map((group) => [group.pattern, group.urls.length]).sort(),
    [['ai-usage', 1], ['articles/*', 314], ['home', 1]]
  );
  assert.strictEqual(
    discover.matchRouteGroup('https://example.com/ai-usage', discover.validateRouteGroupMap(routeMap)).group,
    'ai-usage',
    'exact route must outrank the wildcard route'
  );

  const ambiguous = discover.groupDiscoveredUrls(urls, {
    schema_version: 1,
    rules: [
      { name: 'first', path_patterns: ['/*'], group: 'first/*' },
      { name: 'second', path_patterns: ['/*'], group: 'second/*' },
      { name: 'home', path_patterns: ['/'], group: 'home' },
    ],
  });
  assert.strictEqual(ambiguous.routeGrouping.mode, 'full-fallback');
  assert.strictEqual(ambiguous.routeGrouping.reason, 'ambiguous-routes');
  assert.strictEqual(ambiguous.groups.length, 316);

  const incomplete = discover.groupDiscoveredUrls(urls, {
    schema_version: 1,
    rules: [{ name: 'home only', path_patterns: ['/'], group: 'home' }],
  });
  assert.strictEqual(incomplete.routeGrouping.reason, 'unmapped-routes');
  assert.strictEqual(incomplete.groups.length, 316);
  const invalid = discover.groupDiscoveredUrls(urls, { schema_version: 1, rules: [] });
  assert.strictEqual(invalid.routeGrouping.reason, 'route-group-map-invalid');
  assert.strictEqual(invalid.groups.length, 316);
  assert.deepStrictEqual(discover.groupDiscoveredUrls(urls, routeMap), grouped, 'route grouping must be deterministic');

  const plan = {
    discoverySchemaVersion: 2,
    runtimeUrl: 'https://example.com/',
    discoveredUrls: urls,
    totalPages: urls.length,
    groups: [
      { pattern: 'home', count: 1, urls: [urls[0]], selected: [urls[0]], reason: 'singleton' },
      { pattern: 'ai-usage', count: 1, urls: [urls[1]], selected: [urls[1]], reason: 'singleton' },
      {
        pattern: 'articles/*',
        count: articleUrls.length,
        urls: articleUrls,
        selected: [articleUrls[0], articleUrls[articleUrls.length - 1]],
        reason: 'representatives',
      },
    ],
    scanList: [urls[0], urls[1], articleUrls[0], articleUrls[articleUrls.length - 1]],
  };
  const targeted = selector.selectChangedSurfaces(plan, surfaceMap, ['content/article-157.md']);
  assert.strictEqual(targeted.changedSurface.mode, 'targeted');
  assert.deepStrictEqual(targeted.changedSurface.directUrls, ['https://example.com/article-157']);
  assert.deepStrictEqual(targeted.scanList, [
    articleUrls[0],
    articleUrls[articleUrls.length - 1],
    'https://example.com/article-157',
  ]);
  assert.deepStrictEqual(
    selector.selectChangedSurfaces(plan, surfaceMap, ['content/article-157.md']),
    targeted,
    'direct changed-page selection must be deterministic'
  );

  const unresolved = selector.selectChangedSurfaces(plan, surfaceMap, ['content/not-published.md']);
  assert.strictEqual(unresolved.changedSurface.reason, 'direct-route-unresolved');
  assert.deepStrictEqual(unresolved.scanList, plan.scanList);

  const directRoute = selector.validateSurfaceMap(surfaceMap).rules[0].directRoute;
  const routeShapePlan = {
    ...plan,
    discoveredUrls: [...urls, 'https://example.com/guides/start'],
  };
  assert.strictEqual(
    selector.deriveDirectRoute('content/index.md', directRoute, routeShapePlan).url,
    'https://example.com/'
  );
  assert.strictEqual(
    selector.deriveDirectRoute('content/guides/start.md', directRoute, routeShapePlan).url,
    'https://example.com/guides/start'
  );

  const ambiguousPlan = {
    runtimeUrl: 'https://example.com/',
    discoveredUrls: ['https://example.com/duplicate', 'https://example.com/duplicate.html'],
    groups: [{
      pattern: 'articles/*',
      count: 2,
      urls: ['https://example.com/duplicate', 'https://example.com/duplicate.html'],
      selected: ['https://example.com/duplicate'],
      reason: 'representative',
    }],
    scanList: ['https://example.com/duplicate'],
  };
  const ambiguousDirect = selector.selectChangedSurfaces(
    ambiguousPlan,
    surfaceMap,
    ['content/duplicate.md']
  );
  assert.strictEqual(ambiguousDirect.changedSurface.reason, 'direct-route-ambiguous');
  assert.deepStrictEqual(ambiguousDirect.changedSurface.ambiguousDirectFiles, [{
    file: 'content/duplicate.md',
    routes: ['https://example.com/duplicate', 'https://example.com/duplicate.html'],
  }]);
  assert.deepStrictEqual(ambiguousDirect.scanList, ambiguousPlan.scanList);

  assert.throws(() => selector.validateSurfaceMap({
    schema_version: 2,
    rules: [{
      name: 'unsafe origin',
      source_prefixes: ['content'],
      groups: ['articles/*'],
      direct_route: {
        source_prefix: 'content',
        source_suffix: '.md',
        route_prefix: 'https://outside.example',
      },
    }],
  }), /safe same-origin path/);
  assert.throws(() => selector.validateSurfaceMap({
    schema_version: 2,
    rules: [{
      name: 'unsafe traversal',
      source_prefixes: ['../content'],
      groups: ['articles/*'],
    }],
  }), /traverse/);

  const global = selector.selectChangedSurfaces(plan, surfaceMap, ['src/layouts/main.js']);
  assert.strictEqual(global.changedSurface.reason, 'global-surface-rule');
  assert.deepStrictEqual(global.scanList, plan.scanList);

  const dir = tmpPath('eval-20');
  resetDir(dir);
  const changedFilesPath = path.join(dir, 'changed-files.json');
  fs.writeFileSync(changedFilesPath, JSON.stringify(['.a11y-audit/route-group-map.json']));
  const groupMapChanged = selector.buildSelection(plan, {
    map: 'a11y-audit/evals/fixtures/eval-20/surface-map.json',
    'group-map': '.a11y-audit/route-group-map.json',
    'changed-files': changedFilesPath,
  });
  assert.strictEqual(groupMapChanged.changedSurface.reason, 'route-group-map-changed');
  assert.deepStrictEqual(groupMapChanged.scanList, plan.scanList);
}

function scannerBaselineRegression() {
  const scan = require(repoPath('a11y-audit/scripts/scan.js'));
  const previousResults = [
    {
      url: 'http://127.0.0.1:3000/about/?preview=1#team',
      axe: {
        violations: [
          {
            id: 'color-contrast',
            impact: 'serious',
            nodes: [{ target: ['main   .card', '.label'] }],
          },
          {
            id: 'region',
            impact: 'moderate',
            nodes: [{ target: ['body > div'] }],
          },
        ],
      },
    },
  ];
  const currentResults = [
    {
      url: 'https://preview.example.com/about',
      axe: {
        violations: [
          {
            id: 'color-contrast',
            impact: 'serious',
            nodes: [{ target: ['main .card', '.label'] }],
          },
          {
            id: 'button-name',
            impact: 'critical',
            nodes: [{ target: ['button.icon'] }],
          },
        ],
      },
    },
  ];
  const previous = scan.collectFindings(previousResults);
  const current = scan.collectFindings(currentResults);
  assert.strictEqual(scan.normalizeRoute(previousResults[0].url), '/about');
  assert.strictEqual(scan.normalizeTarget(['main   .card', '.label']), 'main .card >> .label');
  const baseline = scan.buildBaseline(previous, '4.12.1');
  const comparison = scan.compareBaseline(current, baseline);
  assert.strictEqual(comparison.baseline_count, 2);
  assert.strictEqual(comparison.current_count, 2);
  assert.strictEqual(comparison.existing_count, 1);
  assert.strictEqual(comparison.new_count, 1);
  assert.strictEqual(comparison.resolved_count, 1);
  assert.strictEqual(comparison.new_findings[0].rule, 'button-name');
  assert.strictEqual(baseline.schema_version, 1);
  assert.strictEqual(baseline.axe_version, '4.12.1');
  const scanSource = fs.readFileSync(repoPath('a11y-audit/scripts/scan.js'), 'utf8');
  assert.match(scanSource, /--fail-on new requires --baseline/);
  assert.match(scanSource, /Baseline axe-core version mismatch/);
}

function markdownEscapingRegression() {
  const dir = tmpPath('markdown-escaping');
  resetDir(dir);
  const inputPath = path.join(dir, 'scan.json');
  fs.writeFileSync(inputPath, JSON.stringify({
    generated_at: '2026-05-31T00:00:00Z',
    urls: ['https://example.com/a|b'],
    results: [
      {
        url: 'https://example.com/a|b',
        axe: {
          violations: [
            {
              id: 'color-contrast',
              impact: 'serious',
              description: 'desc',
              help: 'Fix | this\nnow',
              helpUrl: 'javascript:alert(1)',
              tags: ['wcag111'],
              nodes: [
                {
                  target: ['main` | td'],
                  html: '<main></main>',
                  any: [{ data: { fgColor: '#000', bgColor: '#fff', contrastRatio: 1.2, expectedContrastRatio: 4.5 } }],
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
          inapplicable: [],
        },
        lighthouse: { status: 'skipped', reason: 'not | run\nnow' },
      },
    ],
  }, null, 2));
  runNode([
    'a11y-audit/scripts/report.js',
    '--input', inputPath,
    '--project-name', 'Demo | Project',
    '--runtime-url', 'https://example.com/a|b',
    '--output-dir', dir,
  ]);
  const md = fs.readFileSync(findGeneratedFile(dir, '.md'), 'utf8');
  assert.match(md, /Demo \\| Project/);
  assert.match(md, /not \\| run now/);
  assert.match(md, /color-contrast/);
  assert.doesNotMatch(md, /\]\(javascript:alert/);
  assert.match(md, /main\\` \\| td/);
}

function issuePlanEscapingRegression() {
  const dir = tmpPath('issue-plan-escaping');
  resetDir(dir);
  const inputPath = path.join(dir, 'scan.json');
  const outputPath = path.join(dir, 'issue-plan.md');
  fs.writeFileSync(inputPath, JSON.stringify({
    results: [
      {
        url: 'https://example.com/route--><script>|x',
        axe: {
          violations: [
            {
              id: 'label|bad',
              impact: 'critical',
              help: 'Do | not\nexecute',
              tags: ['wcag131'],
              nodes: [{ target: ['input'] }],
            },
          ],
        },
      },
    ],
  }, null, 2));
  runNode([
    'a11y-audit/scripts/plan-issues.js',
    '--input', inputPath,
    '--output', outputPath,
  ]);
  const plan = fs.readFileSync(outputPath, 'utf8');
  assert.match(plan, /label\\|bad/);
  assert.match(plan, /Do \\| not execute/);
  assert.doesNotMatch(plan, /--><script>/);
}

function dependencyPolicyCheck() {
  const scanSource = fs.readFileSync(repoPath('a11y-audit/scripts/scan.js'), 'utf8');
  const skill = fs.readFileSync(repoPath('a11y-audit/SKILL.md'), 'utf8');
  assert.match(scanSource, /spawnSync\('npm'/);
  assert.match(scanSource, /skill-deps \(auto-installed\)/);
  assert.match(skill, /`scan\.js` may auto-install missing dependencies/);
  assert.match(skill, /ask before invoking scan\.js/);
}

function installationSurfaceRegression() {
  const canonical = 'npx skills add snapsynapse/skill-a11y-audit --skill a11y-audit';
  const surfaces = [
    'README.md',
    'docs/index.html',
    'llms.txt',
    'docs/llms.txt',
  ].map((file) => [file, fs.readFileSync(repoPath(file), 'utf8')]);

  for (const [file, text] of surfaces) {
    const normalized = text.replace(/\\\s*\n\s*/g, ' ').replace(/\s+/g, ' ');
    assert.ok(normalized.includes(canonical), `${file} must include the canonical install command`);
    assert.doesNotMatch(text, /~\/Git\/skill-a11y-audit/, `${file} must not assume a local clone`);
    assert.doesNotMatch(text, /\.codex\/skills/, `${file} must not publish the stale Codex skill path`);
  }
  for (const [file, text] of surfaces.slice(0, 2)) {
    assert.match(text, /\.claude\/skills/, `${file} must identify the Claude Code skill location`);
    assert.match(text, /\.agents\/skills/, `${file} must identify the Codex skill location`);
  }
  for (const [file, text] of surfaces) {
    assert.doesNotMatch(text, /--output-mode/, `${file} must not advertise an unsupported scanner flag`);
  }
  assert.match(surfaces[0][1], /npx skills use snapsynapse\/skill-a11y-audit --skill a11y-audit/);
  assert.match(surfaces[0][1], /uses: snapsynapse\/skill-a11y-audit\/.github\/actions\/scan@v2\.7\.0/);
  assert.match(surfaces[2][1], /Prompt: "Run an accessibility audit on this project\."/);
  assert.match(surfaces[3][1], /Prompt: "Run an accessibility audit on this project\."/);
}

function reusableActionRegression() {
  const action = fs.readFileSync(repoPath('.github/actions/scan/action.yml'), 'utf8');
  const validateWorkflow = fs.readFileSync(repoPath('.github/workflows/validate-skill.yml'), 'utf8');
  const starter = fs.readFileSync(
    repoPath('a11y-audit/assets/ci/github-actions/accessibility-audit.yml'),
    'utf8'
  );
  for (const input of [
    'discover-url',
    'discover-output',
    'discover-max-per-group',
    'discover-group-map',
    'discover-no-sitemap',
    'surface-map',
    'changed-files',
    'changed-base',
    'changed-head',
    'selection-output',
    'baseline',
    'fail-on',
  ]) {
    assert.match(action, new RegExp(`^  ${input}:`, 'm'), `action missing ${input} input`);
  }
  assert.match(action, /http-server@14\.1\.1/);
  assert.match(action, /scripts\/discover\.js/);
  assert.match(action, /scripts\/select-changed-surfaces\.js/);
  assert.match(action, /--discover "\$DISCOVER_OUTPUT"/);
  assert.match(action, /--group-map "\$DISCOVER_GROUP_MAP"/);
  assert.match(action, /--changed-files "\$CHANGED_FILES"/);
  assert.match(action, /--base "\$CHANGED_BASE"/);
  assert.match(action, /^outputs:/m);
  assert.match(starter, /uses: snapsynapse\/skill-a11y-audit\/.github\/actions\/scan@v2\.7\.0/);
  assert.match(starter, /discover-url: http:\/\/127\.0\.0\.1:8088\//);
  assert.match(starter, /discover-group-map: \.a11y-audit\/route-group-map\.json/);
  assert.match(starter, /surface-map: \.a11y-audit\/surface-map\.json/);
  assert.match(starter, /changed-base: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(starter, /fetch-depth: 0/);
  assert.doesNotMatch(starter, /curl .*sitemap/);
  assert.match(
    validateWorkflow,
    /discover-group-map: a11y-audit\/evals\/fixtures\/eval-19\/route-group-map\.json/
  );
  assert.match(validateWorkflow, /routeGrouping\?\.mode!=='mapped'/);
  assert.match(validateWorkflow, /changedSurface\?\.directUrls\?\.\[0\]/);
}

function workflowSecurityRegression() {
  const action = fs.readFileSync(repoPath('.github/actions/scan/action.yml'), 'utf8');
  const discover = fs.readFileSync(repoPath('a11y-audit/scripts/discover.js'), 'utf8');
  const selectChanged = fs.readFileSync(repoPath('a11y-audit/scripts/select-changed-surfaces.js'), 'utf8');
  const validate = fs.readFileSync(repoPath('.github/workflows/validate-skill.yml'), 'utf8');
  const pages = fs.readFileSync(repoPath('.github/workflows/pages.yml'), 'utf8');
  const dependabot = fs.readFileSync(repoPath('.github/dependabot.yml'), 'utf8');
  const combined = `${action}\n${validate}\n${pages}`;
  const remoteUses = [...combined.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)]
    .map((match) => match[1])
    .filter((value) => !value.startsWith('./'));
  for (const use of remoteUses) {
    assert.match(use, /@[0-9a-f]{40}$/, `remote Action must be SHA-pinned: ${use}`);
  }
  assert.doesNotMatch(action, /"\$\{\{ inputs\.(serve-path|port) \}\}"/);
  assert.doesNotMatch(action, /"\$\{\{ inputs\.(discover-group-map|surface-map|changed-files|changed-base|changed-head) \}\}"/);
  assert.match(selectChanged, /spawnSync\('git', \['diff', '--name-only', '-z'/);
  assert.ok(selectChanged.includes('/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i'));
  assert.match(validate, /^permissions:\n  contents: read$/m);
  assert.match(validate, /^  action-consumer:$/m);
  assert.match(validate, /discover-no-sitemap: true/);
  assert.match(discover, /new Set\(\[new URL\(runtimeUrl\)\.href, \.\.\.extractLinks/);
  assert.match(validate, /^  workflow-audit:$/m);
  assert.match(validate, /actionlint\/cmd\/actionlint@v1\.7\.12/);
  assert.match(validate, /astral-sh\/setup-uv@[0-9a-f]{40}/);
  assert.match(validate, /uvx zizmor==1\.28\.0 --offline --min-severity low \./);
  assert.match(validate, /npm ci --prefix a11y-audit\/deps/);
  assert.match(validate, /npm run audit:deps/);
  assert.match(validate, /npm run audit:scanner/);
  const auditGate = fs.readFileSync(repoPath('scripts/audit-deps.mjs'), 'utf8');
  assert.match(auditGate, /new Set\(\['high', 'critical'\]\)/);
  assert.match(auditGate, /entry\.expires < today/);
  const auditScripts = readJson(repoPath('package.json')).scripts;
  assert.strictEqual(auditScripts['audit:deps'], 'node scripts/audit-deps.mjs');
  assert.strictEqual(
    auditScripts['audit:scanner'],
    'node scripts/audit-deps.mjs --prefix=a11y-audit/deps --allowlist=ops/audit-allowlist.json'
  );
  // Every scanner exception must carry a reason and an unexpired review date.
  for (const entry of readJson(repoPath('ops/audit-allowlist.json')).advisories) {
    assert.ok(entry.id && entry.reason, `allowlist entry needs id and reason: ${entry.id}`);
    assert.match(entry.expires, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(
      entry.expires >= new Date().toISOString().slice(0, 10),
      `allowlist entry ${entry.id} expired on ${entry.expires}`
    );
  }
  assert.match(dependabot, /directory: \/a11y-audit\/deps[\s\S]*open-pull-requests-limit: 0/);
  const deps = readJson(repoPath('a11y-audit/deps/package.json'));
  assert.deepStrictEqual(deps.dependencies, {
    'axe-core': '4.12.1',
    puppeteer: '24.43.1',
  });
  const depsLock = readJson(repoPath('a11y-audit/deps/package-lock.json'));
  assert.strictEqual(
    depsLock.packages['node_modules/ip-address'].version,
    '10.4.0',
    'scanner lockfile must retain the patched ip-address release'
  );
  assert.strictEqual(
    depsLock.packages['node_modules/js-yaml'].version,
    '4.3.1',
    'scanner lockfile must retain the patched js-yaml release'
  );
}

function assistantGuideArtifactRegression() {
  const rootGuide = fs.readFileSync(repoPath('assistant-guide.txt'));
  const hostedGuide = fs.readFileSync(repoPath('docs/.well-known/assistant-guide.txt'));
  const text = rootGuide.toString('ascii');
  assert.deepStrictEqual(rootGuide, hostedGuide, 'root and hosted assistant guides must match');
  assert.ok(rootGuide.length <= 8192, `assistant guide exceeds 8192 bytes: ${rootGuide.length}`);
  assert.ok([...rootGuide].every((byte) => byte <= 0x7f), 'assistant guide must be ASCII');
  assert.doesNotMatch(text, /\r|\t/, 'assistant guide must not contain CR or tab bytes');
  text.split('\n').forEach((line, index) => {
    assert.ok(Buffer.byteLength(line) <= 120, `assistant guide line ${index + 1} exceeds 120 bytes`);
  });
  assert.match(text, /^profile-version: 0\.7\.0$/m);
  assert.match(text, /^guide-version: 0\.3\.10$/m);
  assert.match(text, /^verifier-conformance: human-verifiable-assistant-guide-verifier >=0\.7\.0, <0\.8\.0$/m);

  const scriptHashes = new Map([
    ['a11y-audit/scripts/discover.js', null],
    ['a11y-audit/scripts/select-changed-surfaces.js', null],
    ['a11y-audit/scripts/scan.js', null],
    ['a11y-audit/scripts/report.js', null],
  ]);
  for (const script of scriptHashes.keys()) {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(repoPath(script))).digest('hex');
    scriptHashes.set(script, digest);
  }
  for (const block of text.matchAll(/\[action\]\n([\s\S]*?)\n\[\/action\]/g)) {
    const command = block[1].match(/^command: (.+)$/m)?.[1] || '';
    const localScript = [...scriptHashes.keys()].find((script) => {
      const installedPath = script.replace(/^a11y-audit\//, 'SKILL_DIR/');
      const shortPath = script.replace(/^a11y-audit\//, 'S/');
      return command.includes(installedPath) || command.includes(shortPath);
    });
    if (!localScript) continue;
    const declared = block[1].match(/^exec-sha256: ([0-9a-f]{64})$/m)?.[1];
    assert.strictEqual(declared, scriptHashes.get(localScript), `stale exec-sha256 for ${localScript}`);
  }

  const manifest = fs.readFileSync(repoPath('docs/.well-known/assistant-guide-manifest.txt'), 'utf8');
  const digest = crypto.createHash('sha256').update(rootGuide).digest('hex');
  assert.match(manifest, /^guide-version: 0\.3\.10$/m);
  assert.match(manifest, new RegExp(`^guide-sha256: ${digest}$`, 'm'));
  assert.match(manifest, new RegExp(`^guide-bytes: ${rootGuide.length}$`, 'm'));
  assert.match(manifest, /^profile-version: 0\.7\.0$/m);
}

resetDir(tmpRoot);

if (validateMode) {
  test('syntax checks cover bundled scripts and eval harnesses', validateSyntax);
  test('JSON files parse and sample output matches audit shape', validateJsonFiles);
  test('YAML and frontmatter files parse', validateYamlFiles);
  test('manifest paths, hashes, and embedded versions cover the complete bundle', validateManifestIntegrity);
  test('bootstrap-context smoke test creates workspace context', validateBootstrapSmoke);
}

test('eval-9 preserves cross-origin sitemap URLs', () => runDiscoverFixture('eval-9'));
test('eval-10 keeps discovery deterministic', () => runDiscoverFixture('eval-10'));
test('eval-12 blocks cross-origin sitemaps unless explicitly allowed', () => runDiscoverFixture('eval-12'));
test('eval-19 targets mapped changed surfaces and falls back conservatively', eval19ChangedSurfaceSelection);
test('eval-20 groups flat routes and always includes directly changed pages', eval20FlatRouteGroupingAndDirectPages);
test('eval-2 plans issues with labels and deduplication', eval2IssuePlanning);
test('eval-3 quick scan summarizes one plain HTML page', eval3QuickScan);
test('eval-4 reports skipped Lighthouse without inventing scores', eval4SkippedLighthouseReport);
test('eval-11 reports page-aware delta movement', eval11ReportDelta);
test('eval-15 renders matrices from pluggable standards data', eval15PluggableStandards);
test('scan.js rejects unsupported browser package names before install', scannerBrowserValidation);
test('scan.js consumes validated, deduplicated discover plans', scannerDiscoverPlanRegression);
test('scan.js fingerprints and compares accepted accessibility baselines', scannerBaselineRegression);
test('report.js escapes target-derived markdown fields', markdownEscapingRegression);
test('plan-issues.js escapes target-derived markdown fields', issuePlanEscapingRegression);
test('scan.js dependency auto-install policy is documented', dependencyPolicyCheck);
test('public install surfaces stay current and synchronized', installationSurfaceRegression);
test('reusable Action and workflow starter stay template-aware', reusableActionRegression);
test('workflow and Action supply-chain controls stay enforced', workflowSecurityRegression);
test('assistant guide artifacts stay bounded, pinned, and synchronized', assistantGuideArtifactRegression);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) process.exit(1);
