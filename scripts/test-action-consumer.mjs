#!/usr/bin/env node
// Execute the composite Action's shell steps from a clean external workspace.
// GitHub's setup-node and artifact upload remain covered by the hosted lane.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-consumer-'));
const bundle = path.join(temp, 'installed-skill');
const workspace = path.join(temp, 'consumer');
const runtime = path.join(temp, 'runtime');
for (const directory of [bundle, workspace, runtime]) fs.mkdirSync(directory, { recursive: true });
fs.cpSync(path.join(root, 'a11y-audit'), path.join(bundle, 'a11y-audit'), {
  recursive: true,
  filter: source => path.basename(source) !== 'node_modules',
});
const actionPath = path.join(bundle, '.github/actions/scan');
fs.mkdirSync(actionPath, { recursive: true });
fs.copyFileSync(path.join(root, '.github/actions/scan/action.yml'), path.join(actionPath, 'action.yml'));
const yaml = spawnSync('ruby', ['-rjson', '-ryaml', '-e',
  'puts JSON.generate(YAML.safe_load(File.read(ARGV[0])))', path.join(actionPath, 'action.yml')], { encoding: 'utf8' });
assert.equal(yaml.status, 0, yaml.stderr);
const action = JSON.parse(yaml.stdout);
fs.cpSync(path.join(root, 'a11y-audit/evals/fixtures/eval-3'), path.join(workspace, 'site'), { recursive: true });
for (const name of ['route-group-map.json', 'surface-map.json', 'changed-files.json']) {
  fs.copyFileSync(path.join(root, 'a11y-audit/evals/fixtures/eval-19', name), path.join(workspace, name));
}
const socket = net.createServer();
await new Promise((resolve, reject) => {
  socket.on('error', reject);
  socket.listen(0, '127.0.0.1', resolve);
});
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const inputs = Object.fromEntries(Object.entries(action.inputs).map(([key, value]) => [key, value.default ?? '']));
Object.assign(inputs, {
  'serve-path': 'site', port: String(port), 'discover-url': `http://127.0.0.1:${port}/`,
  'discover-no-sitemap': 'true', 'discover-group-map': 'route-group-map.json',
  'surface-map': 'surface-map.json', 'changed-files': 'changed-files.json',
  'fail-on': 'none', 'upload-artifact': 'false',
});
function substitute(text) {
  return text.replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_, key) => {
    if (key === 'github.action_path') return actionPath;
    if (key.startsWith('inputs.') && Object.hasOwn(inputs, key.slice(7))) return inputs[key.slice(7)];
    throw new Error(`Unsupported Action expression: ${key}`);
  });
}
// Fail on new conditions so changes to Action control flow cannot be ignored.
const conditions = new Map([
  [undefined, true], ["inputs.serve-path != ''", true], ["inputs.discover-url != ''", true],
  ["inputs.discover-url != '' && inputs.surface-map != '' && (inputs.changed-files != '' || inputs.changed-base != '')", true],
  ["always() && inputs.serve-path != ''", true], ["always() && inputs.upload-artifact == 'true'", false],
]);
const env = { ...process.env, RUNNER_TEMP: runtime, GITHUB_WORKSPACE: workspace,
  PUPPETEER_CACHE_DIR: path.join(temp, 'browser-cache') };
// The first pass must prove default installation against an empty browser cache.
delete env.PUPPETEER_SKIP_DOWNLOAD;
delete env.PUPPETEER_SKIP_CHROME_DOWNLOAD;
delete env.PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD;
delete env.PUPPETEER_EXECUTABLE_PATH;
function runStep(step) {
  assert.ok(conditions.has(step.if), `Unsupported Action condition: ${step.if}`);
  if (!conditions.get(step.if)) return;
  if (step.uses) {
    assert.ok(step.uses.startsWith('actions/setup-node@'), `Unexpected external Action: ${step.uses}`);
    console.log(`LOCAL ${step.name}: using Node ${process.versions.node}; hosted setup-node is not emulated`);
    return;
  }
  assert.equal(step.shell, 'bash');
  const stepEnv = Object.fromEntries(Object.entries(step.env || {}).map(([key, value]) => [key, substitute(value)]));
  const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', substitute(step.run)], {
    cwd: workspace, env: { ...env, ...stepEnv }, encoding: 'utf8', timeout: 300000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${step.name}: ${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  console.log(`PASS ${step.name}`);
}
try {
  for (const skipDownload of [false, true]) {
    if (skipDownload) {
      // The first pass acquired the pinned Chrome. Preserve that verified cache,
      // remove all npm packages, then prove a skip-download clean reinstall.
      env.PUPPETEER_SKIP_DOWNLOAD = 'true';
      fs.rmSync(path.join(bundle, 'a11y-audit/deps/node_modules'), { recursive: true });
    }
    assert.equal(fs.existsSync(path.join(bundle, 'a11y-audit/deps/node_modules')), false);
    try {
      for (const step of action.runs.steps.filter(step => !step.if?.startsWith('always()'))) runStep(step);
      const read = input => JSON.parse(fs.readFileSync(path.join(workspace, inputs[input]), 'utf8'));
      const scan = read('output');
      assert.deepEqual(scan.errors, []);
      assert.equal(scan.results.length, 1);
      assert.equal(scan.browser_version, '25.10.0');
      assert.ok(scan.results[0].axe.violations.some(item => item.id === 'button-name'));
      assert.equal(read('discover-output').routeGrouping.mode, 'mapped');
      assert.equal(read('selection-output').changedSurface.mode, 'targeted');
      assert.equal(read('selection-output').changedSurface.directUrls[0], inputs['discover-url']);
      const graph = spawnSync('npm', ['ls', 'extract-zip', '--all', '--json', '--prefix', path.join(bundle, 'a11y-audit/deps')],
        { encoding: 'utf8', env });
      assert.equal(graph.status, 1, graph.stdout + graph.stderr);
      assert.deepEqual(JSON.parse(graph.stdout).dependencies ?? {}, {});
      console.log(`PASS external consumer (skip-download=${skipDownload}) with isolated packages and browser cache`);
      if (skipDownload) {
        // Seed stale installed metadata in this disposable copy. The old
        // presence-only resolver would reuse it without repairing the graph.
        const browserMetadata = path.join(bundle, 'a11y-audit/deps/node_modules/puppeteer/package.json');
        const stale = JSON.parse(fs.readFileSync(browserMetadata, 'utf8'));
        stale.version = '24.43.1';
        fs.writeFileSync(browserMetadata, JSON.stringify(stale));
        const repairedOutput = path.join(workspace, 'repaired-scan.json');
        const repair = spawnSync(process.execPath, [path.join(bundle, 'a11y-audit/scripts/scan.js'),
          '--urls', inputs['discover-url'], '--output', repairedOutput, '--summary', '--fail-on', 'none'],
        { cwd: workspace, env, encoding: 'utf8', timeout: 300000 });
        assert.equal(repair.status, 0, repair.stderr);
        assert.match(repair.stderr, /Managed puppeteer does not match/);
        assert.equal(JSON.parse(fs.readFileSync(repairedOutput, 'utf8')).browser_version, '25.10.0');
        assert.equal(JSON.parse(fs.readFileSync(browserMetadata, 'utf8')).version, '25.10.0');
        console.log('PASS stale managed Puppeteer triggers a locked reinstall before scanning');
      }
    } finally {
      for (const step of action.runs.steps.filter(step => step.if?.startsWith('always()'))) runStep(step);
    }
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
