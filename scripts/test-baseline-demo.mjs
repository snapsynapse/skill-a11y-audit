import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanner = path.join(root, 'a11y-audit/scripts/scan.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-baseline-demo-'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let buttonNamed = true;
const html = () => `<!doctype html><html lang="en"><head><title>Baseline demonstration</title></head><body><main><h1>Baseline demonstration</h1><img id="existing-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><button id="new-button"${buttonNamed ? ' aria-label="Continue"' : ''}></button></main></body></html>`;
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(html());
});
function run(args) {
  return new Promise((resolve, reject) => {
    const override = process.env.A11Y_AUDIT_TEST_NO_SANDBOX === 'true' ? ['--no-sandbox'] : [];
    const child = spawn(process.execPath, [scanner, ...args, ...override], { cwd: temp });
    let stderr = '';
    child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stderr }));
  });
}
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const url = `http://127.0.0.1:${server.address().port}/demo`;
  const baseline = path.join(temp, 'candidate-baseline.json');
  const initialOutput = path.join(temp, 'initial.json');
  const initialRun = await run(['--urls', url, '--output', initialOutput, '--write-baseline', baseline, '--fail-on', 'none']);
  assert.equal(initialRun.code, 0, initialRun.stderr);
  const initial = JSON.parse(fs.readFileSync(initialOutput, 'utf8'));
  assert.ok(initial.findings.some(finding => finding.rule === 'image-alt' && finding.target.includes('#existing-image')),
    'fixture must retain existing image-alt finding');
  const baselineDigest = sha(baseline);
  const outcomes = [];
  for (const [name, named, exit] of [['unchanged', true, 0], ['new', false, 2], ['restored', true, 0]]) {
    buttonNamed = named;
    const output = path.join(temp, `${name}.json`);
    const result = await run(['--urls', url, '--output', output, '--baseline', baseline, '--fail-on', 'new']);
    assert.equal(result.code, exit, `${name}: ${result.stderr}`);
    const data = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(sha(baseline), baselineDigest, `${name} changed candidate baseline`);
    assert.equal(data.baseline.existing_count, initial.findings.length);
    assert.equal(data.baseline.new_count, name === 'new' ? 1 : 0);
    if (name === 'new') {
      assert.equal(data.baseline.new_findings[0].rule, 'button-name');
      assert.equal(data.baseline.new_findings[0].route, '/demo');
      assert.match(data.baseline.new_findings[0].target, /#new-button/);
    }
    outcomes.push({ state: name, exit_code: result.code, existing_count: data.baseline.existing_count,
      new_count: data.baseline.new_count, new_findings: data.baseline.new_findings });
  }
  const evidence = { runtime: process.version, axe_version: initial.axe_version,
    browser_version: initial.browser_version, candidate_baseline_sha256: baselineDigest,
    initial_findings: initial.findings, outcomes };
  console.log(JSON.stringify(evidence));
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
