#!/usr/bin/env node
// Exercise the opt-in adapter as an external consumer with real child processes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-cli-consumer-'));
const installed = path.join(temp, 'installed-skill');
const workspace = path.join(temp, 'consumer');
fs.mkdirSync(workspace);
fs.cpSync(path.join(root, 'a11y-audit'), installed, {
  recursive: true,
  filter: source => !['node_modules', '.DS_Store'].includes(path.basename(source)),
});
const adapter = path.join(installed, 'scripts/run-audit.js');
const schema = JSON.parse(fs.readFileSync(path.join(installed, 'references/cli-result-schema.json')));
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
const good = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Audit fixture</title></head><body style="color:#000;background:#fff"><main><h1>Audit fixture</h1><p>This page has readable text.</p></main></body></html>';
const bad = fs.readFileSync(path.join(root, 'a11y-audit/evals/fixtures/eval-3/index.html'));
const server = http.createServer((request, response) => {
  if (request.url === '/missing') {
    response.writeHead(404, { 'content-type': 'text/html' });
    response.end('<h1>Not found</h1>');
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(request.url === '/bad' ? bad : good);
});

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [adapter, ...args], { cwd: workspace });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill('SIGTERM'), 300000);
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', (status, signal) => {
      clearTimeout(timeout);
      resolve({ status, signal, stdout, stderr });
    });
  });
}

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const scenario of [
    { name: 'accepted', route: '/good', mode: 'major', status: 0, gate: 'accepted', operation: 'complete' },
    { name: 'rejected', route: '/bad', mode: 'major', status: 2, gate: 'rejected', operation: 'complete' },
    { name: 'report-only', route: '/bad', mode: 'none', status: 0, gate: 'not_requested', operation: 'complete' },
    { name: 'missing', route: '/missing', mode: 'major', operation: 'failed' },
  ]) {
    const config = path.join(workspace, `${scenario.name}.json`);
    fs.writeFileSync(config, JSON.stringify({
      schema_version: 1,
      workspace: '.',
      artifacts_dir: `.a11y-audit/${scenario.name}`,
      discovery: { url: `${base}${scenario.route}`, no_sitemap: true, no_fingerprint: true },
      scan: { fail_on: scenario.mode, summary: true },
      report: { enabled: true, project_name: 'CLI contract consumer' },
    }));
    const result = await run(['--config', config, '--contract', 'posix-json-v1']);
    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.stdout.trim().split('\n').length, 1, 'stdout must contain one terminal JSON line');
    const envelope = JSON.parse(result.stdout);
    assert.ok(validate(envelope), JSON.stringify(validate.errors));
    assert.equal(envelope.contract.name, 'posix-json-v1');
    assert.equal(envelope.operational.status, scenario.operation, result.stderr);
    if (scenario.status !== undefined) assert.equal(result.status, scenario.status, result.stderr);
    else assert.notEqual(result.status, 0, 'missing required coverage cannot pass');
    if (scenario.gate) assert.equal(envelope.gate.status, scenario.gate);
    if (scenario.operation === 'complete') {
      assert.ok(envelope.completed_stages.includes('report'), 'report must complete even when the gate rejects');
      assert.ok(envelope.report_files.length > 0);
      for (const file of envelope.report_files) assert.ok(fs.statSync(path.join(workspace, file)).isFile());
      const scan = JSON.parse(fs.readFileSync(path.join(workspace, envelope.artifacts.scan)));
      assert.equal(scan.results.length, 1, 'fixture must be scanned');
      if (scenario.route === '/bad') {
        assert.ok(scan.results[0].axe.violations.some(v => v.id === 'button-name'));
      }
    }
    const saved = JSON.parse(fs.readFileSync(path.join(workspace, envelope.artifacts.run)));
    assert.deepEqual(saved, envelope, 'stdout and persisted terminal result must agree');
    console.log(`PASS external CLI consumer: ${scenario.name} (exit ${result.status})`);
  }
} finally {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
}
