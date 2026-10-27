#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 1
version_date: 2026-10-26
previous_version: null
change_summary: >
  Reproduces security failures and verifies policy, fetch budgets and browser defaults.
*/
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { spawnSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-security-'));
const { approvedOrigins, requireApprovedUrl, fetchResource, guardNavigation } = require('../scripts/network-policy');
const { loadUrlsFromSitemap, loadUrlsFromDiscoverPlan, browserLaunchOptions } = require('../scripts/scan');
const { discover } = require('../scripts/discover');
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

async function main() {
  await test('SEC-001 audit errors and malformed reports cannot become clean coverage', () => {
    const bin = path.join(temp, 'bin'); fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'npm'), '#!/usr/bin/env node\nprocess.stdout.write(process.env.AUDIT_RESPONSE);process.exit(Number(process.env.AUDIT_STATUS));\n', { mode: 0o755 });
    const clean = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } };
    const high = { auditReportVersion: 2, vulnerabilities: { vulnerable: { severity: 'high', via: [{ name: 'vulnerable', url: 'https://github.com/advisories/GHSA-test-test-test', severity: 'high', title: 'test advisory' }] } }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } } };
    for (const [response, status, expected] of [
      [{ error: { code: 'ENOAUDIT' } }, 1, false], [{ error: { code: 'ECONNRESET' } }, 1, false],
      [{}, 0, false], [[], 0, false], [null, 0, false], ['invalid-json', 0, false],
      [{ ...clean, vulnerabilities: [] }, 0, false], [{ ...clean, metadata: {} }, 0, false],
      [clean, 2, false], [clean, 1, false], [high, 0, false],
      [{ ...high, vulnerabilities: { vulnerable: { severity: 'high', via: [] } } }, 1, false],
      [high, 1, false], [clean, 0, true],
    ]) {
      const result = spawnSync(process.execPath, [path.join(root, 'scripts/audit-deps.mjs')], {
        cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          AUDIT_RESPONSE: typeof response === 'string' ? response : JSON.stringify(response), AUDIT_STATUS: String(status) },
      });
      assert.equal(result.status === 0, expected, result.stdout + result.stderr);
      if (!expected) assert.doesNotMatch(result.stdout, /no unreviewed/);
    }
    // A valid lower-severity report is coverage, not an infrastructure error.
    const moderate = JSON.parse(JSON.stringify(high)); moderate.vulnerabilities.vulnerable.severity = 'moderate';
    moderate.vulnerabilities.vulnerable.via[0].severity = 'moderate';
    moderate.metadata.vulnerabilities.high = 0; moderate.metadata.vulnerabilities.moderate = 1;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/audit-deps.mjs')], { cwd: root, encoding: 'utf8', env: {
      ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, AUDIT_RESPONSE: JSON.stringify(moderate), AUDIT_STATUS: '0',
    } });
    assert.equal(result.status, 0, result.stderr);
  });
  await test('SEC-002 origin matching uses parsed HTTP(S) origins and rejects deceptive URLs', () => {
    const corpus = require('./fixtures/eval-24/network-cases.json');
    const origins = approvedOrigins(corpus.base, corpus.allowed_origins);
    for (const value of corpus.valid) assert.doesNotThrow(() => requireApprovedUrl(value, origins));
    for (const value of corpus.blocked) assert.throws(() => requireApprovedUrl(value, origins));
    assert.throws(() => requireApprovedUrl('//evil.test/', origins, 'https://example.test/'));
    assert.throws(() => approvedOrigins('https://example.test', ['https://other.test/path']));
    const plan = path.join(temp, 'plan.json');
    fs.writeFileSync(plan, JSON.stringify({ runtimeUrl: 'https://example.test', allowedOrigins: ['https://evil.test'], originPolicy: 'approved-origins', scanList: ['https://evil.test/'] }));
    assert.throws(() => loadUrlsFromDiscoverPlan(plan), /not approved/);
    assert.deepEqual(loadUrlsFromDiscoverPlan(plan, ['https://evil.test']), ['https://evil.test/']);
  });
  await test('SEC-003 sandbox stays enabled unless the operator explicitly disables it', () => {
    assert.deepEqual(browserLaunchOptions(), { headless: true, args: [] });
    assert.deepEqual(browserLaunchOptions(true).args, ['--no-sandbox']);
    assert.throws(() => browserLaunchOptions('false'));
  });
  let otherHits = 0;
  const other = http.createServer((req, res) => { otherHits++; res.end('<!doctype html><title>Other</title><main>Other</main>'); });
  await listen(other);
  const otherOrigin = `http://127.0.0.1:${other.address().port}`;
  let origin;
  let activeDiscardedBodies = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') { res.writeHead(404); res.end(); }
    else if (req.url === '/sitemap.xml') res.end(`<urlset><url><loc>${origin}/good</loc></url><url><loc>${otherOrigin}/private</loc></url></urlset>`);
    else if (req.url === '/cross.xml') res.end(`<urlset><url><loc>${otherOrigin}/private</loc></url></urlset>`);
    else if (req.url === '/index.xml') res.end(`<sitemapindex><sitemap><loc>${otherOrigin}/internal.xml</loc></sitemap></sitemapindex>`);
    else if (req.url === '/many.xml') res.end(`<urlset>${[1, 2, 3].map(n => `<url><loc>${origin}/${n}</loc></url>`).join('')}</urlset>`);
    else if (req.url === '/local-index.xml') res.end(`<sitemapindex><sitemap><loc>${origin}/many.xml</loc></sitemap></sitemapindex>`);
    else if (req.url === '/redirect') { res.writeHead(302, { location: `${otherOrigin}/private` }); res.end(); }
    else if (req.url === '/cycle') { res.writeHead(302, { location: '/cycle' }); res.end(); }
    else if (req.url === '/stream-redirect' || req.url === '/stream-error') {
      activeDiscardedBodies++;
      res.writeHead(req.url === '/stream-redirect' ? 302 : 404, { location: '/good' });
      res.write('x'); const timer = setInterval(() => res.write('x'.repeat(100)), 5);
      res.on('close', () => { clearInterval(timer); activeDiscardedBodies--; });
    }
    else if (req.url === '/gzip.xml' || req.url === '/gzip-bomb' || req.url === '/bad-gzip') {
      res.setHeader('content-encoding', 'gzip');
      const text = req.url === '/gzip-bomb' ? 'x'.repeat(10000) : `<urlset><url><loc>${origin}/good</loc></url></urlset>`;
      res.end(req.url === '/bad-gzip' ? 'invalid compressed data' : zlib.gzipSync(text));
    }
    else if (req.url === '/large') res.end('x'.repeat(4096));
    else if (req.url === '/slow') {
      res.writeHead(200); const timer = setInterval(() => res.write('x'), 5);
      res.on('close', () => clearInterval(timer));
    } else if (req.url === '/jump') { res.setHeader('content-type', 'text/html'); res.end(`<script>location.href=${JSON.stringify(otherOrigin + '/private')}</script>`); }
    else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html lang="en"><title>Fixture</title><main><h1>Fixture</h1></main></html>'); }
  });
  await listen(server); origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await test('SEC-002 discovery filters cross-origin leaves without fetching them; explicit allowlist works', async () => {
      const plan = await discover(origin, { fingerprint: false });
      assert.deepEqual(plan.scanList, [`${origin}/good`]);
      assert.equal(plan.originPolicy, 'same-origin');
      assert(plan.blockedFetches.some(x => x.reason === 'cross-origin-target'));
      assert.equal(otherHits, 0);
      const optedIn = await discover(origin, { fingerprint: false, allowedOrigins: [otherOrigin] });
      assert.equal(optedIn.scanList.length, 2);
      assert.equal(optedIn.originPolicy, 'approved-origins');
      assert.equal(otherHits, 0);
    });
    await test('SEC-002 direct sitemap leaves, children and redirects cannot fetch another origin', async () => {
      for (const route of ['/cross.xml', '/index.xml', '/redirect']) await assert.rejects(loadUrlsFromSitemap(origin + route), /not approved|cross-origin/);
      assert.equal(otherHits, 0);
      assert.deepEqual(await loadUrlsFromSitemap(origin + '/cross.xml', { allowedOrigins: [otherOrigin] }), [`${otherOrigin}/private`]);
      const rewritten = await loadUrlsFromSitemap(origin + '/cross.xml', { find: otherOrigin, replace: origin });
      assert.deepEqual(rewritten, [`${origin}/private`]);
    });
    await test('SEC-005 bytes, streaming deadlines, redirect loops and total sitemap budgets are bounded', async () => {
      const options = { allowedOrigins: approvedOrigins(origin), timeoutMs: 60, maxBytes: 128 };
      assert.equal((await fetchResource(origin + '/large', options)).reason, 'max-bytes');
      const started = Date.now(); assert.equal((await fetchResource(origin + '/slow', options)).reason, 'timeout');
      assert(Date.now() - started < 2000);
      assert.equal((await fetchResource(origin + '/cycle', options)).reason, 'redirect-limit');
      assert.equal((await fetchResource(origin + '/stream-redirect', { ...options, maxBytes: 1024 })).blocked, false);
      assert.equal(await fetchResource(origin + '/stream-error', options), null);
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(activeDiscardedBodies, 0, 'redirect/error bodies must be closed rather than drained without a budget');
      await assert.rejects(loadUrlsFromSitemap(origin + '/many.xml', { maxUrls: 2 }), /URL budget/);
      await assert.rejects(loadUrlsFromSitemap(origin + '/local-index.xml', { maxDocuments: 1 }), /document budget/);
      await assert.rejects(loadUrlsFromSitemap(origin + '/local-index.xml', { totalBytes: 180 }), /max-bytes|byte budget/);
      assert.equal((await loadUrlsFromSitemap(origin + '/many.xml')).length, 3);
      assert.deepEqual(await loadUrlsFromSitemap(origin + '/gzip.xml'), [`${origin}/good`]);
      await assert.rejects(loadUrlsFromSitemap(origin + '/gzip-bomb', { maxBytes: 128 }), /max-bytes/);
      await assert.rejects(loadUrlsFromSitemap(origin + '/bad-gzip'), /invalid-encoding/);
    });
    await test('SEC-002 page navigation guard blocks redirects while preserving ordinary external assets', async () => {
      let handler; let aborted = 0; let continued = 0;
      const frame = {}; const page = { setRequestInterception: async () => {}, on: (_, fn) => { handler = fn; }, mainFrame: () => frame, url: () => origin };
      const check = await guardNavigation(page, approvedOrigins(origin));
      const request = nav => ({ isNavigationRequest: () => nav, frame: () => frame, url: () => otherOrigin, abort: async () => { aborted++; }, continue: async () => { continued++; } });
      handler(request(false)); check(); assert.equal(continued, 1);
      handler(request(true)); assert.equal(aborted, 1); assert.throws(check, /unapproved/);
    });
    if (process.argv.includes('--browser')) {
      await test('SEC-002/003 real scanner keeps sandbox default and blocks HTTP and script redirects', async () => {
        for (const [route, allowed, expected] of [['/good', false, 0], ['/redirect', false, 1], ['/jump', false, 1], ['/redirect', true, 0]]) {
          const args = [path.join(root, 'a11y-audit/scripts/scan.js'), '--urls', origin + route, '--output', path.join(temp, 'scan.json'), '--fail-on', 'none', '--summary'];
          if (allowed) args.push('--allow-origin', otherOrigin);
          if (process.env.A11Y_AUDIT_TEST_NO_SANDBOX === 'true') args.push('--no-sandbox');
          const result = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, args, { cwd: root }); let stderr = '';
            child.stderr.on('data', chunk => { stderr += chunk; }); child.stdout.resume();
            child.on('error', reject); child.on('close', status => resolve({ status, stderr }));
          });
          assert.equal(result.status, expected, result.stderr);
          const scan = JSON.parse(fs.readFileSync(path.join(temp, 'scan.json')));
          assert.equal(scan.errors.length > 0, expected !== 0);
          if (!allowed) assert.equal(otherHits, 0);
        }
      });
    }
  } finally { await close(server); await close(other); }
  console.log(`${passed} security regression groups passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
