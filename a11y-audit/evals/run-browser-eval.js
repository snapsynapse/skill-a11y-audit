#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 1
version_date: 2026-07-21
previous_version: null
change_summary: >
  Runs the real Puppeteer and axe-core scanner against a local fixture, then
  verifies accepted-baseline behavior without external network access.
*/

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixture = path.join(__dirname, 'fixtures', 'eval-3', 'index.html');
const tmpDir = '/tmp/a11y-audit-browser-eval';

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, encoding: 'utf8' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function main() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  const html = fs.readFileSync(fixture);
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;
  const scanPath = path.join(tmpDir, 'scan.json');
  const baselinePath = path.join(tmpDir, 'baseline.json');
  try {
    const first = await runNode([
      'a11y-audit/scripts/scan.js',
      '--urls', url,
      '--root', repoRoot,
      '--output', scanPath,
      '--write-baseline', baselinePath,
      '--summary',
      '--fail-on', 'none',
    ]);
    assert.strictEqual(first.status, 0, first.stderr || first.stdout);
    const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    assert.deepStrictEqual(scan.errors, []);
    assert.strictEqual(scan.results.length, 1);
    assert.ok(
      scan.results[0].axe.violations.some((violation) => violation.id === 'button-name'),
      'real axe scan must detect the fixture button-name violation'
    );
    assert.ok(scan.axe_version, 'scan must record the resolved axe-core version');
    assert.ok(scan.browser_version, 'scan must record the resolved browser version');

    const second = await runNode([
      'a11y-audit/scripts/scan.js',
      '--urls', url,
      '--root', repoRoot,
      '--output', path.join(tmpDir, 'rescan.json'),
      '--baseline', baselinePath,
      '--fail-on', 'new',
      '--summary',
    ]);
    assert.strictEqual(second.status, 0, second.stderr || second.stdout);
    const rescan = JSON.parse(fs.readFileSync(path.join(tmpDir, 'rescan.json'), 'utf8'));
    assert.strictEqual(rescan.baseline.new_count, 0);
    assert.ok(rescan.baseline.existing_count > 0);
    console.log('PASS real browser scan and accepted-baseline rescan');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
