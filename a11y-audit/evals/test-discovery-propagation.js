#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 1
version_date: 2026-11-18
previous_version: null
change_summary: >
  Verifies required sitemap-child failure reaches the CLI and adapter with partial evidence.
*/
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-discovery-propagation-'));
const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'application/xml');
  if (request.url === '/robots.txt') { response.statusCode = 404; response.end(); return; }
  if (request.url === '/sitemap.xml') {
    response.end(`<sitemapindex><sitemap><loc>${origin}/good.xml</loc></sitemap><sitemap><loc>${origin}/bad.xml</loc></sitemap></sitemapindex>`);
  } else if (request.url === '/good.xml') {
    response.end(`<urlset><url><loc>${origin}/good</loc></url></urlset>`);
  } else { response.statusCode = 503; response.end('unavailable'); }
});
let origin;
function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, script), ...args], { cwd: temp });
    let stderr = '';
    child.stderr.on('data', value => { stderr += value; });
    child.stdout.resume();
    child.on('error', reject);
    child.on('close', status => resolve({ status, stderr }));
  });
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const planPath = path.join(temp, 'discover.json');
    const direct = await run('a11y-audit/scripts/discover.js', ['--url', origin, '--output', planPath, '--no-fingerprint']);
    assert.equal(direct.status, 1, direct.stderr);
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.match(plan.error, /required-sitemap-unavailable/);
    assert.deepEqual(plan.discoveredUrls, [`${origin}/good`]);
    assert(plan.blockedFetches.some(item => item.url === `${origin}/bad.xml`));

    const requestPath = path.join(temp, 'request.json');
    fs.writeFileSync(requestPath, JSON.stringify({ schema_version: 1, workspace: '.', artifacts_dir: 'artifacts',
      discovery: { url: origin, no_fingerprint: true }, scan: { fail_on: 'none' }, report: { enabled: false } }));
    const adapter = await run('a11y-audit/scripts/run-audit.js', ['--config', requestPath]);
    assert.equal(adapter.status, 1, adapter.stderr);
    const envelope = JSON.parse(fs.readFileSync(path.join(temp, 'artifacts/run.json'), 'utf8'));
    assert.equal(envelope.status, 'failed');
    assert.equal(envelope.failed_stage, 'discover');
    const partial = JSON.parse(fs.readFileSync(path.join(temp, 'artifacts/discovery.json'), 'utf8'));
    assert.match(partial.error, /required-sitemap-unavailable/);
    assert.deepEqual(partial.discoveredUrls, [`${origin}/good`]);
    assert.equal(fs.existsSync(path.join(temp, 'artifacts/scan.json')), false);
    fs.rmSync(path.join(temp, 'artifacts'), { recursive: true, force: true });
    const contract = await run('a11y-audit/scripts/run-audit.js',
      ['--contract', 'posix-json-v1', '--config', requestPath]);
    assert.equal(contract.status, 1, contract.stderr);
    const contractPartial = JSON.parse(fs.readFileSync(path.join(temp, 'artifacts/discovery.json'), 'utf8'));
    assert.match(contractPartial.error, /required-sitemap-unavailable/);
    assert.deepEqual(contractPartial.discoveredUrls, [`${origin}/good`]);
    assert.equal(fs.existsSync(path.join(temp, 'artifacts/scan.json')), false);
    const action = fs.readFileSync(path.join(root, '.github/actions/scan/action.yml'), 'utf8');
    assert.match(action, /id: discover[\s\S]*?node "\$\{\{ github\.action_path \}\}\/\.\.\/\.\.\/\.\.\/a11y-audit\/scripts\/discover\.js" "\$\{ARGS\[@\]\}"/);
    console.log('Required child failure propagates through CLI, adapter and Action discovery command');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
