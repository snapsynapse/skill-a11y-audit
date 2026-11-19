// Synthetic local fixtures only. Run from repository root.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-access-review-'));
const run = (args) => new Promise((resolve, reject) => {
  const childProcess = spawn(process.execPath, args, { cwd: root });
  let out = '';
  let err = '';
  childProcess.stdout.on('data', chunk => { out += chunk; });
  childProcess.stderr.on('data', chunk => { err += chunk; });
  childProcess.on('error', reject);
  childProcess.on('close', code => resolve({ code, out, err }));
});

(async () => {
  let missing = false;
  const good = '<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main><h1>Fixture</h1><img id="debt" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="></main></body></html>';
  const clean = '<!doctype html><html lang="en"><head><title>Not Found</title></head><body><main><h1>Not Found</h1></main></body></html>';
  const server = http.createServer((req, res) => {
    res.writeHead(missing ? 404 : 200, { 'content-type': 'text/html' });
    res.end(missing ? clean : good);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    const baseline = path.join(temp, 'baseline.json');
    const args = ['a11y-audit/scripts/scan.js', '--urls', url, '--summary'];
    const first = await run([...args, '--write-baseline', baseline, '--output', path.join(temp, 'initial.json'), '--fail-on', 'none']);
    console.log('baseline', first.code, fs.existsSync(baseline)
      ? JSON.parse(fs.readFileSync(baseline)).findings.length : first.err);

    missing = true;
    const absent = await run([...args, '--baseline', baseline, '--output', path.join(temp, 'missing.json'), '--fail-on', 'new']);
    const json = JSON.parse(fs.readFileSync(path.join(temp, 'missing.json')));
    console.log('404 regression', JSON.stringify({ exit: absent.code, errors: json.errors, baseline: json.baseline }));

    missing = false;
    const bare = await run([...args, '--output', path.join(temp, 'bare.json'), '--fail-on']);
    console.log('bare fail-on', JSON.stringify({ exit: bare.code }));
    const collision = await run([...args, '--baseline', baseline, '--output', baseline, '--fail-on', 'new']);
    const accepted = JSON.parse(fs.readFileSync(baseline));
    console.log('baseline/output collision', JSON.stringify({
      exit: collision.code,
      schema_version: accepted.schema_version,
      hasScanResults: Array.isArray(accepted.results),
    }));
  } finally {
    server.close();
  }

  // A controlled synthetic file outside the served root, with no sensitive data.
  const site = path.join(temp, 'site');
  fs.mkdirSync(site);
  fs.writeFileSync(path.join(temp, 'outside-fixture.txt'), 'SYNTHETIC_OUTSIDE_ROOT');
  fs.symlinkSync(path.join(temp, 'outside-fixture.txt'), path.join(site, 'visible-link.txt'));
  const probe = http.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['a11y-audit/scripts/serve-local.js', site, String(port)], { cwd: root });
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve);
    child.once('error', reject);
  });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/visible-link.txt`);
    console.log('symlink escape', JSON.stringify({ status: response.status, body: await response.text() }));
  } finally {
    child.kill();
  }
  console.log('evidence', temp);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
