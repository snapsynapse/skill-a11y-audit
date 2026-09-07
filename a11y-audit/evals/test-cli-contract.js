#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 1
version_date: 2026-09-07
previous_version: null
change_summary: >
  Covers the experimental POSIX JSON adapter contract with injected child
  execution and filesystem collision fixtures.
*/

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Ajv2020 = require('ajv/dist/2020');

const repoRoot = path.resolve(__dirname, '../..');
const adapterPath = path.join(repoRoot, 'a11y-audit/scripts/run-audit.js');
const schema = require(path.join(repoRoot, 'a11y-audit/references/cli-result-schema.json'));
const adapter = require(adapterPath);
const scanner = require(path.join(repoRoot, 'a11y-audit/scripts/scan.js'));
const validate = new Ajv2020({ allErrors: true }).compile(schema);
const roots = [];
let passed = 0;

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-cli-contract-'));
  roots.push(root);
  return root;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  assert.ok(index >= 0, `missing ${flag}`);
  return args[index + 1];
}

function requestFixture(mode = 'major', options = {}) {
  const root = tempRoot();
  const requestPath = path.join(root, 'request.json');
  const request = {
    schema_version: 1,
    workspace: '.',
    artifacts_dir: options.artifactsDir || 'artifacts',
    discovery: { url: 'https://example.com/', no_sitemap: true },
    scan: { fail_on: mode, summary: true },
    report: { enabled: options.report !== false, project_name: 'Contract fixture' },
  };
  writeJson(requestPath, request);
  return { root, requestPath, request };
}

function scanPayload(outcome, options = {}) {
  const violation = {
    id: 'button-name', impact: 'critical', tags: ['wcag412'], nodes: [{ target: ['button'] }],
  };
  const violations = outcome === 'fail' || options.violations ? [violation] : [];
  const incomplete = outcome === 'inconclusive' ? [{
    id: 'manual-review', impact: null, tags: ['wcag141'], nodes: [{ target: ['main'] }],
  }] : [];
  const results = options.empty ? [] : [{
    url: 'https://example.com/',
    axe: {
      violations,
      incomplete,
    },
  }];
  const errors = options.errors || [];
  const auditEvidence = scanner.buildAuditEvidence(results);
  return {
    urls: ['https://example.com/'],
    results,
    errors,
    audit_evidence: auditEvidence,
    gate: outcome ? scanner.evaluateMajorGate(auditEvidence, errors) : null,
    baseline: options.newCount === undefined ? null : { new_count: options.newCount },
  };
}

function injectedRunner(options = {}) {
  const calls = [];
  const executeStage = (entry) => {
    calls.push(entry.name);
    if (options.onStage) options.onStage(entry);
    if (options.childError === entry.name) {
      return { status: 0, signal: null, error: new Error('injected launch error') };
    }
    if (options.failStage === entry.name) {
      return { status: options.failStatus || 1, signal: options.signal || null };
    }
    if (entry.name === 'discover') {
      writeJson(flagValue(entry.args, '--output'), { scanList: ['https://example.com/'] });
      return { status: options.discoverStatus || 0, stdout: 'discover progress\n', stderr: '' };
    }
    if (entry.name === 'scan') {
      const output = flagValue(entry.args, '--output');
      if (options.scanArtifact === 'malformed') fs.writeFileSync(output, '{');
      else if (options.scanArtifact !== 'missing') writeJson(output, options.scanPayload);
      return { status: options.scanStatus ?? 0, stdout: 'scan artifact\n', stderr: 'scan diagnostic\n' };
    }
    if (entry.name === 'report') {
      const outputDir = flagValue(entry.args, '--output-dir');
      const date = new Date().toISOString().slice(0, 10);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(path.join(outputDir, `audit-${date}.md`), '# Audit\n');
      writeJson(path.join(outputDir, `audit-${date}.json`), { date });
      return { status: 0, stdout: 'report files\n', stderr: '' };
    }
    throw new Error(`unexpected stage ${entry.name}`);
  };
  return { calls, executeStage };
}

function runFixture(mode, runnerOptions = {}, fixtureOptions = {}) {
  const fixture = requestFixture(mode, fixtureOptions);
  const runner = injectedRunner(runnerOptions);
  const diagnostics = [];
  const result = adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', fixture.requestPath,
  ], {
    executeStage: runner.executeStage,
    diagnostic: (value) => diagnostics.push(value),
  });
  assert.ok(validate(result), new Ajv2020().errorsText(validate.errors));
  return { ...fixture, ...runner, diagnostics, result };
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}\n${error.stack || error}`);
    process.exitCode = 1;
  }
}

test('strict parser rejects unsupported selectors, options, duplicate values, and boolean values', () => {
  const fixture = requestFixture();
  const cases = [
    [['--contract', 'other', '--config', fixture.requestPath], 'unsupported-contract'],
    [['--contract', 'posix-json-v1', '--config', fixture.requestPath, '--wat'], 'unsupported-option'],
    [['--contract', 'posix-json-v1', '--config', fixture.requestPath, '--config', fixture.requestPath], 'duplicate-option'],
    [['--contract', 'posix-json-v1', '--config', fixture.requestPath, '--dry-run', 'true'], 'invalid-invocation'],
  ];
  for (const [argv, id] of cases) {
    const result = adapter.runContractFromArgv(argv);
    assert.strictEqual(result.exit_code, 64);
    assert.strictEqual(result.operational.error.id, id);
  }
});

test('contract dry-run is one schema-valid terminal object and does not claim gate acceptance', () => {
  const fixture = requestFixture('major');
  const child = spawnSync(process.execPath, [adapterPath,
    '--contract', 'posix-json-v1', '--config', fixture.requestPath, '--dry-run'], {
    encoding: 'utf8', cwd: repoRoot,
  });
  assert.strictEqual(child.status, 0, child.stderr);
  assert.strictEqual(child.stdout.trim().split('\n').length, 1);
  const result = JSON.parse(child.stdout);
  assert.ok(validate(result), new Ajv2020().errorsText(validate.errors));
  assert.strictEqual(result.dry_run, true);
  assert.strictEqual(result.gate.status, 'not_evaluated');
  assert.deepStrictEqual(result.completed_stages, []);
});

test('legacy dry-run output remains exactly the legacy plan envelope', () => {
  const fixture = requestFixture('none');
  const child = spawnSync(process.execPath, [adapterPath,
    '--config', fixture.requestPath, '--dry-run'], { encoding: 'utf8', cwd: repoRoot });
  assert.strictEqual(child.status, 0, child.stderr);
  assert.deepStrictEqual(JSON.parse(child.stdout), adapter.buildRunPlan(fixture.requestPath).envelope);
});

test('accepted major gate completes reporting and isolates child logs from terminal data', () => {
  const run = runFixture('major', { scanStatus: 0, scanPayload: scanPayload('pass') });
  assert.strictEqual(run.result.exit_code, 0);
  assert.strictEqual(run.result.operational.status, 'complete');
  assert.deepStrictEqual(run.result.gate, { mode: 'major', status: 'accepted' });
  assert.deepStrictEqual(run.calls, ['discover', 'scan', 'report']);
  assert.match(run.diagnostics.join(''), /discover progress/);
  assert.match(run.diagnostics.join(''), /scan artifact/);
  const persisted = JSON.parse(fs.readFileSync(path.join(run.root, 'artifacts/run.json')));
  assert.deepStrictEqual(persisted, run.result);
});

test('progress artifact is explicitly nonterminal while a child is running', () => {
  let progress;
  const run = runFixture('major', {
    scanStatus: 0,
    scanPayload: scanPayload('pass'),
    onStage: (entry) => {
      if (entry.name !== 'discover') return;
      const requestRoot = path.dirname(flagValue(entry.args, '--output'));
      progress = JSON.parse(fs.readFileSync(path.join(requestRoot, 'run.json')));
    },
  });
  assert.strictEqual(progress.terminal, false);
  assert.strictEqual(progress.operational.status, 'running');
  assert.strictEqual(run.result.terminal, true);
});

test('confirmed rejection and inconclusive evidence retain 2 and 3 after reporting', () => {
  for (const [status, gate, exitCode] of [['fail', 'rejected', 2], ['inconclusive', 'inconclusive', 3]]) {
    const run = runFixture('major', { scanStatus: exitCode, scanPayload: scanPayload(status) });
    assert.strictEqual(run.result.exit_code, exitCode);
    assert.strictEqual(run.result.operational.status, 'complete');
    assert.strictEqual(run.result.gate.status, gate);
    assert.deepStrictEqual(run.result.completed_stages, ['discover', 'scan', 'report']);
  }
});

test('report operational failure overrides a retained rejection', () => {
  const run = runFixture('major', {
    scanStatus: 2, scanPayload: scanPayload('fail'), failStage: 'report', failStatus: 1,
  });
  assert.strictEqual(run.result.exit_code, 1);
  assert.strictEqual(run.result.operational.status, 'failed');
  assert.strictEqual(run.result.gate.status, 'rejected');
  assert.deepStrictEqual(run.result.completed_stages, ['discover', 'scan']);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(run.root, 'artifacts/run.json'))), run.result);
});

test('no-gate scan with findings completes without claiming accessibility acceptance', () => {
  const run = runFixture('none', { scanPayload: scanPayload(null, { violations: true }) });
  assert.strictEqual(run.result.exit_code, 0);
  assert.deepStrictEqual(run.result.gate, { mode: 'none', status: 'not_requested' });
});

test('unverified child 2, missing, malformed, empty, and errored scan artifacts cannot become gates', () => {
  const arbitrary = runFixture('major', {
    failStage: 'discover', failStatus: 2, scanPayload: scanPayload('fail'),
  });
  assert.strictEqual(arbitrary.result.exit_code, 1);
  assert.strictEqual(arbitrary.result.gate.status, 'not_evaluated');
  for (const options of [
    { scanStatus: 2, scanArtifact: 'missing' },
    { scanStatus: 0, scanArtifact: 'malformed' },
    { scanStatus: 0, scanPayload: scanPayload('pass', { empty: true }) },
    { scanStatus: 0, scanPayload: scanPayload('pass', { errors: [{ url: 'https://example.com/' }] }) },
  ]) {
    const run = runFixture('major', options);
    assert.strictEqual(run.result.exit_code, 1);
    assert.strictEqual(run.result.operational.status, 'failed');
    assert.notStrictEqual(run.result.gate.status, 'accepted');
    assert.strictEqual(run.calls.includes('report'), false);
  }
});

test('major gate status must agree with independently derived raw evidence', () => {
  const inconsistent = scanPayload('pass');
  inconsistent.results[0].axe.violations.push({
    id: 'button-name', impact: 'serious', tags: ['wcag412'], nodes: [{ target: ['button'] }],
  });
  inconsistent.gate.confirmed_major_instances = 1;
  const run = runFixture('major', { scanStatus: 0, scanPayload: inconsistent });
  assert.strictEqual(run.result.exit_code, 1);
  assert.strictEqual(run.result.operational.error.id, 'scan-gate-mismatch');
  assert.notStrictEqual(run.result.gate.status, 'accepted');
});

test('child error and signal take precedence over a numeric child status', () => {
  const withError = runFixture('major', {
    childError: 'scan', scanPayload: scanPayload('pass'),
  });
  assert.strictEqual(withError.result.exit_code, 1);
  assert.strictEqual(withError.result.stages[1].exit_code, 0);
  const signaled = runFixture('major', {
    failStage: 'scan', failStatus: 0, signal: 'SIGTERM', scanPayload: scanPayload('pass'),
  });
  assert.strictEqual(signaled.result.exit_code, 1);
  assert.strictEqual(signaled.result.stages[1].signal, 'SIGTERM');
});

test('missing request, malformed JSON, and impossible output have stable sysexits', () => {
  const missing = adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', path.join(tempRoot(), 'missing.json'),
  ]);
  assert.strictEqual(missing.exit_code, 66);
  const malformedPath = path.join(tempRoot(), 'bad.json');
  fs.writeFileSync(malformedPath, '{');
  assert.strictEqual(adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', malformedPath,
  ]).exit_code, 65);
  const fixture = requestFixture();
  fs.writeFileSync(path.join(fixture.root, 'blocked'), 'file');
  const impossible = adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', fixture.requestPath,
    '--output', 'blocked/run.json',
  ]);
  assert.strictEqual(impossible.exit_code, 73);
});

test('symlink escapes and hard-link input aliases are rejected before mutation', () => {
  const outside = tempRoot();
  const fixture = requestFixture('major', { artifactsDir: 'linked-artifacts' });
  fs.symlinkSync(outside, path.join(fixture.root, 'linked-artifacts'));
  const sentinel = path.join(outside, 'discovery.json');
  fs.writeFileSync(sentinel, 'keep');
  const escaped = adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', fixture.requestPath, '--dry-run',
  ]);
  assert.strictEqual(escaped.exit_code, 65);
  assert.strictEqual(escaped.operational.error.id, 'output-path-escape');
  assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), 'keep');

  const linked = requestFixture();
  const output = path.join(linked.root, 'linked-run.json');
  fs.linkSync(linked.requestPath, output);
  const original = fs.readFileSync(linked.requestPath, 'utf8');
  const collision = adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', linked.requestPath,
    '--output', 'linked-run.json', '--dry-run',
  ]);
  assert.strictEqual(collision.exit_code, 65);
  assert.strictEqual(collision.operational.error.id, 'output-path-collision');
  assert.strictEqual(fs.readFileSync(linked.requestPath, 'utf8'), original);
});

test('existing non-regular report destinations are rejected before any stage runs', () => {
  const fixture = requestFixture();
  const date = new Date().toISOString().slice(0, 10);
  const reportDir = path.join(fixture.root, 'artifacts/report');
  fs.mkdirSync(path.join(reportDir, `audit-${date}.json`), { recursive: true });
  fs.writeFileSync(path.join(reportDir, `audit-${date}.md`), 'old report');
  const runner = injectedRunner({ scanStatus: 0, scanPayload: scanPayload('pass') });
  const result = adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', fixture.requestPath,
  ], { executeStage: runner.executeStage });
  assert.strictEqual(result.exit_code, 73);
  assert.strictEqual(result.operational.error.id, 'output-cannot-create');
  assert.deepStrictEqual(runner.calls, []);
  assert.strictEqual(fs.readFileSync(path.join(reportDir, `audit-${date}.md`), 'utf8'), 'old report');
});

test('disabled report outputs do not create false output collisions', () => {
  const fixture = requestFixture('none', { report: false });
  const date = new Date().toISOString().slice(0, 10);
  const result = adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', fixture.requestPath,
    '--output', `artifacts/report/audit-${date}.md`, '--dry-run',
  ]);
  assert.strictEqual(result.exit_code, 0);
  assert.strictEqual(result.dry_run, true);
  assert.strictEqual(result.stages.some((stage) => stage.name === 'report'), false);
});

test('report paths stay frozen when execution crosses a UTC date boundary', () => {
  const fixture = requestFixture();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const prior = path.join(fixture.root, `prior-${tomorrow}.json`);
  writeJson(prior, { date: tomorrow, violations: [] });
  fixture.request.report.previous = path.basename(prior);
  writeJson(fixture.requestPath, fixture.request);
  const RealDate = Date;
  const runner = injectedRunner({
    scanStatus: 0,
    scanPayload: scanPayload('pass'),
    onStage: (entry) => {
      if (entry.name !== 'report') return;
      global.Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [RealDate.now() + 86400000]));
        }
        static now() { return RealDate.now() + 86400000; }
      };
    },
  });
  let result;
  try {
    result = adapter.runContractFromArgv([
      '--contract', 'posix-json-v1', '--config', fixture.requestPath,
    ], { executeStage: runner.executeStage, diagnostic: () => {} });
  } finally {
    global.Date = RealDate;
  }
  assert.strictEqual(result.exit_code, 1);
  assert.strictEqual(result.operational.error.id, 'report-result-missing');
  assert.strictEqual(fs.existsSync(path.join(fixture.root, `artifacts/report/audit-${tomorrow}.json`)), false);
  assert.strictEqual(fs.existsSync(path.join(fixture.root, `artifacts/report/audit-${today}.json`)), false);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(prior)), { date: tomorrow, violations: [] });
});

test('progress writes do not follow predictable preexisting temporary symlinks', () => {
  const fixture = requestFixture('major');
  const artifacts = path.join(fixture.root, 'artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const sentinel = path.join(tempRoot(), 'sentinel.json');
  fs.writeFileSync(sentinel, 'keep');
  const oldTemporary = path.join(artifacts, `run.json.posix-json-v1-${process.pid}.tmp`);
  fs.symlinkSync(sentinel, oldTemporary);
  const runner = injectedRunner({ scanStatus: 0, scanPayload: scanPayload('pass') });
  const result = adapter.runContractFromArgv([
    '--contract', 'posix-json-v1', '--config', fixture.requestPath,
  ], { executeStage: runner.executeStage, diagnostic: () => {} });
  assert.strictEqual(result.exit_code, 0);
  assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), 'keep');
  assert.strictEqual(fs.lstatSync(oldTemporary).isSymbolicLink(), true);
});

for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
if (process.exitCode) process.exit(process.exitCode);
console.log(`\n${passed} CLI contract checks passed`);
