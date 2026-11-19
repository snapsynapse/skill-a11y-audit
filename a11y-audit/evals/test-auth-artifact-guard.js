#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 1
version_date: 2026-11-18
previous_version: null
change_summary: >
  Tests authenticated artifact file boundaries and Action upload selection.
*/
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { protectAuthFiles, collectArtifactPaths } = require('../scripts/auth-state.js');

const root = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-auth-artifacts-'));
try {
  const state = path.join(dir, 'state.json');
  const targets = path.join(dir, 'targets.json');
  const scan = path.join(dir, 'scan.json');
  const discover = path.join(dir, 'discover.json');
  const selection = path.join(dir, 'selection.json');
  const githubOutput = path.join(dir, 'github-output.txt');
  fs.writeFileSync(state, 'SYNTHETIC_STATE');
  fs.writeFileSync(targets, 'SYNTHETIC_TARGETS');
  fs.writeFileSync(scan, '{}');
  fs.writeFileSync(discover, '{}');
  fs.writeFileSync(selection, '{}');
  const inputs = [state, targets];
  const outputs = { scan, discover, selection };
  const all = { scan: 'success', discover: 'success', selection: 'success' };
  assert.deepStrictEqual(collectArtifactPaths(inputs, outputs, all), [scan, discover, selection]);
  assert.deepStrictEqual(collectArtifactPaths(inputs, outputs,
    { scan: 'success', discover: 'skipped', selection: 'skipped' }), [scan]);
  assert.deepStrictEqual(collectArtifactPaths(inputs, outputs,
    { scan: 'failure', discover: 'skipped', selection: 'skipped' }), [scan]);
  assert.throws(() => collectArtifactPaths(inputs, outputs,
    { scan: 'unknown', discover: 'skipped', selection: 'skipped' }));
  assert.throws(() => collectArtifactPaths(inputs, { ...outputs, scan: path.join(dir, 'missing.json') },
    { scan: 'success', discover: 'skipped', selection: 'skipped' }));

  const runUpload = (configured, stages = all) => spawnSync(process.execPath,
    [path.join(root, 'a11y-audit/scripts/auth-state.js'), '--upload-paths'], {
      cwd: dir, encoding: 'utf8',
      env: { ...process.env, STORAGE_STATE: state, AUTH_TARGETS: targets,
        OUTPUT: configured.scan, DISCOVER_OUTPUT: configured.discover,
        SELECTION_OUTPUT: configured.selection, SCAN_STAGE: stages.scan,
        DISCOVER_STAGE: stages.discover, SELECTION_STAGE: stages.selection,
        GITHUB_OUTPUT: githubOutput },
    });
  assert.strictEqual(runUpload(outputs).status, 0);
  assert(fs.readFileSync(githubOutput, 'utf8').includes(scan));

  const alias = path.join(dir, 'hardlink.json');
  fs.linkSync(state, alias);
  assert.throws(() => protectAuthFiles(inputs, [alias]));
  assert.notStrictEqual(runUpload({ ...outputs, discover: alias }).status, 0);
  const directLink = path.join(dir, 'symlink.json');
  fs.symlinkSync(state, directLink);
  assert.throws(() => protectAuthFiles(inputs, [directLink]));
  const artifactDir = path.join(dir, 'artifact-dir');
  fs.mkdirSync(artifactDir);
  fs.linkSync(state, path.join(artifactDir, 'nested-hardlink.json'));
  fs.symlinkSync(targets, path.join(artifactDir, 'nested-symlink.json'));
  assert.throws(() => protectAuthFiles(inputs, [artifactDir]));
  assert.notStrictEqual(runUpload({ ...outputs, discover: artifactDir },
    { scan: 'success', discover: 'skipped', selection: 'skipped' }).status, 0,
    'unused configured directory must fail closed');
  assert.throws(() => protectAuthFiles(inputs, [dir]), 'input-containing directory must fail');

  // Revalidation catches a replacement made between preflight and collection.
  protectAuthFiles(inputs, [scan, discover, selection]);
  fs.rmSync(scan);
  fs.linkSync(state, scan);
  assert.notStrictEqual(runUpload(outputs).status, 0);
  fs.rmSync(scan);
  fs.writeFileSync(scan, '{}');
  assert.strictEqual(runUpload(outputs).status, 0);

  const yaml = spawnSync('ruby', ['-rjson', '-ryaml', '-e',
    'puts JSON.generate(YAML.safe_load(File.read(ARGV[0])))', path.join(root, '.github/actions/scan/action.yml')],
  { encoding: 'utf8' });
  assert.strictEqual(yaml.status, 0, yaml.stderr);
  const steps = JSON.parse(yaml.stdout).runs.steps;
  const preflight = steps.find(step => step.name === 'Protect authentication artifacts');
  const recheck = steps.find(step => step.name === 'Check artifact paths immediately before upload');
  const upload = steps.find(step => step.name === 'Upload results artifact');
  assert(preflight && recheck && upload);
  assert.strictEqual(upload.with.path, '${{ steps.artifact-paths.outputs.paths }}');
  assert(recheck.if.includes("steps.auth-paths.outcome == 'success'"));
  assert(upload.if.includes("steps.artifact-paths.outcome == 'success'"));
  assert(steps.findIndex(step => step === preflight) < steps.findIndex(step => step === recheck));
  assert(steps.findIndex(step => step === recheck) < steps.findIndex(step => step === upload));
  console.log('Authenticated artifact paths reject aliases and collect only enabled regular files');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
