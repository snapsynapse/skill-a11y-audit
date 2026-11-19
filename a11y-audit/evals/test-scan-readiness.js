#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 1
version_date: 2026-11-18
previous_version: null
change_summary: >
  Exercises operational target readiness across all accessibility gate modes in Chromium.
*/
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const scanner = path.resolve(__dirname, '../scripts/scan.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-readiness-'));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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
async function main() {
  const server = http.createServer((request, response) => {
    const route = request.url;
    if (route === '/drop') { request.socket.destroy(); return; }
    response.writeHead(route === '/404' ? 404 : route === '/500' ? 500 : 200, {
      'content-type': route === '/text' ? 'text/plain' : 'text/html',
    });
    response.end(route === '/text' ? 'plain text' : '<!doctype html><html lang="en"><head><title>Ready</title></head><body><main><h1>Ready</h1></main></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const baseline = path.join(temp, 'accepted.json');
    const initial = await run(['--urls', `${origin}/ok`, '--output', path.join(temp, 'initial.json'),
      '--write-baseline', baseline, '--fail-on', 'none']);
    assert.equal(initial.code, 0, initial.stderr);
    const acceptedDigest = digest(baseline);
    for (const mode of ['new', 'errors', 'none', 'major']) {
      const output = path.join(temp, `${mode}.json`);
      const args = ['--urls', ['/ok', '/404', '/500', '/text', '/drop'].map(value => origin + value).join(','),
        '--output', output, '--fail-on', mode];
      if (mode === 'new') args.push('--baseline', baseline);
      const result = await run(args);
      assert.equal(result.code, 1, `${mode}: ${result.stderr}`);
      const payload = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.equal(payload.results.length, 1, `${mode} should retain successful HTML evidence`);
      assert.equal(payload.errors.length, 4, `${mode} should report every failed target`);
      assert.equal(digest(baseline), acceptedDigest, `${mode} changed accepted baseline`);
      console.log(`PASS ${mode} preserves one good result and four operational failures`);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
