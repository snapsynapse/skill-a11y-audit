#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 6
version_date: 2026-07-13
previous_version: 5
change_summary: >
  Adds eval-15 pluggable standards matrix coverage (wcag21-aa default,
  wcag22-aa, en301549, invalid-id rejection).
*/

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmpRoot = '/tmp/a11y-audit-evals';
const validateMode = process.argv.includes('--validate');
const results = [];

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
  for (const key of ['date', 'tool', 'pages', 'summary', 'violations', 'matrix', 'lighthouse']) {
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
  ];
  for (const file of files) readJson(repoPath(file));
  assertAuditJsonShape(readJson(repoPath('a11y-audit/assets/sample-output/audit-sample.json')));
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
  assert.deepStrictEqual(actual, expected);
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
  assert.match(scanSource, /const PINNED_VERSIONS = \{ 'axe-core':/);
  assert.doesNotMatch(scanSource, /execSync\(`npm install/);
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
  assert.match(surfaces[2][1], /Prompt: "Run an accessibility audit on this project\."/);
  assert.match(surfaces[3][1], /Prompt: "Run an accessibility audit on this project\."/);
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
  assert.match(text, /^guide-version: 0\.3\.4$/m);
  assert.match(text, /^verifier-conformance: human-verifiable-assistant-guide-verifier >=0\.7\.0, <0\.8\.0$/m);

  const scriptHashes = new Map([
    ['a11y-audit/scripts/discover.js', null],
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
      return command.includes(installedPath);
    });
    if (!localScript) continue;
    const declared = block[1].match(/^exec-sha256: ([0-9a-f]{64})$/m)?.[1];
    assert.strictEqual(declared, scriptHashes.get(localScript), `stale exec-sha256 for ${localScript}`);
  }

  const manifest = fs.readFileSync(repoPath('docs/.well-known/assistant-guide-manifest.txt'), 'utf8');
  const digest = crypto.createHash('sha256').update(rootGuide).digest('hex');
  assert.match(manifest, /^guide-version: 0\.3\.4$/m);
  assert.match(manifest, new RegExp(`^guide-sha256: ${digest}$`, 'm'));
  assert.match(manifest, new RegExp(`^guide-bytes: ${rootGuide.length}$`, 'm'));
  assert.match(manifest, /^profile-version: 0\.7\.0$/m);
}

resetDir(tmpRoot);

if (validateMode) {
  test('syntax checks cover bundled scripts and eval harnesses', validateSyntax);
  test('JSON files parse and sample output matches audit shape', validateJsonFiles);
  test('YAML and frontmatter files parse', validateYamlFiles);
  test('bootstrap-context smoke test creates workspace context', validateBootstrapSmoke);
}

test('eval-9 preserves cross-origin sitemap URLs', () => runDiscoverFixture('eval-9'));
test('eval-10 keeps discovery deterministic', () => runDiscoverFixture('eval-10'));
test('eval-12 blocks cross-origin sitemaps unless explicitly allowed', () => runDiscoverFixture('eval-12'));
test('eval-2 plans issues with labels and deduplication', eval2IssuePlanning);
test('eval-3 quick scan summarizes one plain HTML page', eval3QuickScan);
test('eval-4 reports skipped Lighthouse without inventing scores', eval4SkippedLighthouseReport);
test('eval-11 reports page-aware delta movement', eval11ReportDelta);
test('eval-15 renders matrices from pluggable standards data', eval15PluggableStandards);
test('scan.js rejects unsupported browser package names before install', scannerBrowserValidation);
test('scan.js fingerprints and compares accepted accessibility baselines', scannerBaselineRegression);
test('report.js escapes target-derived markdown fields', markdownEscapingRegression);
test('plan-issues.js escapes target-derived markdown fields', issuePlanEscapingRegression);
test('scan.js dependency auto-install policy is documented', dependencyPolicyCheck);
test('public install surfaces stay current and synchronized', installationSurfaceRegression);
test('assistant guide artifacts stay bounded, pinned, and synchronized', assistantGuideArtifactRegression);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) process.exit(1);
