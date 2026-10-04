/*
skill_bundle: a11y-audit
file_role: evals
version: 1
version_date: 2026-10-03
previous_version: null
change_summary: >
  Exercises authenticated browser isolation, failure handling, and input rejection.
*/
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { loadAuth, protectAuthFiles } = require('../scripts/auth-state.js');
const { buildRunPlan } = require('../scripts/run-audit.js');
const unit = process.argv.includes('--unit');
const root = path.resolve(__dirname, '../..');
function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command || process.execPath, args, { cwd: root, env: options.env || process.env });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-auth-'));
  const statePath = path.join(dir, 'state.json');
  const targetsPath = path.join(dir, 'targets.json');
  const output = path.join(dir, 'scan.json');
  const secret = 'AUTH_SECRET_748256';
  let leakedRequests = 0;
  const other = http.createServer((req, res) => { leakedRequests++; res.end('unexpected'); });
  if (!unit) await new Promise(resolve => other.listen(0, '127.0.0.1', resolve));
  const otherOrigin = `http://127.0.0.1:${(other.address()?.port || 18081)}`;
  const server = http.createServer((req, res) => {
    if (req.url === '/sitemap.xml') { res.setHeader('content-type', 'application/xml'); res.end(`<urlset><url><loc>${origin}/protected</loc></url></urlset>`); return; }
    if (req.url === '/redirect') { res.writeHead(302, {location: `${otherOrigin}/`}); res.end(); return; }
    if (['/protected', '/second'].includes(req.url) && req.headers.cookie !== `session=${secret}`) {
      res.writeHead(302, { location: '/login' }); res.end(); return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(`<!doctype html><html lang="en"><title>Fixture</title><body><main><h1>Protected</h1><button></button><img src="${otherOrigin}/track"><script>
      if (['/protected', '/second'].includes(location.pathname) && localStorage.getItem('token') === '${secret}') {
        const marker = document.createElement('div'); marker.id = 'ready'; marker.textContent = '${secret}'; document.body.append(marker);
        localStorage.setItem('token', 'mutated'); document.cookie = 'session=mutated; path=/';
      }
    </script></main></body></html>`);
  });
  if (!unit) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address()?.port || 18080)}`;
  const url = `${origin}/protected`;
  const state = { cookies: [{ name: 'session', value: secret, domain: '127.0.0.1', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }], origins: [{ origin, localStorage: [{ name: 'token', value: secret }] }] };
  const target = { url, expected_url: url, ready_selector: '#ready' };
  const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
  save(statePath, state); save(targetsPath, [target]);
  try {
    const auth = loadAuth(statePath, targetsPath, [url], [output]);
    assert.strictEqual(auth.redact(`contains ${secret}`), 'contains [REDACTED]');
    for (const bad of [ {...state, indexedDB: []}, {...state, origins: [{ ...state.origins[0], indexedDB: [] }]}, {...state, cookies: [{...state.cookies[0], partitionKey: origin}]}, {...state, cookies: [{...state.cookies[0], domain: 'example.com'}]} ]) {
      save(statePath, bad); assert.throws(() => loadAuth(statePath, targetsPath, [url]));
    }
    save(statePath, state);
    save(statePath, {...state, cookies: [{...state.cookies[0], value: 'serious'}]});
    const enumAuth = loadAuth(statePath, targetsPath, [url]);
    assert.deepStrictEqual(enumAuth.redact({impact: 'serious', html: '<p>serious</p>', tags: ['best-practice']}),
      {impact: 'serious', html: '<p>[REDACTED]</p>', tags: ['best-practice']});
    save(statePath, state);
    assert.throws(() => loadAuth(statePath, undefined, [url]));
    assert.throws(() => loadAuth(statePath, targetsPath, [`${origin}/unlisted`]));
    assert.throws(() => loadAuth(statePath, targetsPath, [url], [statePath]));
    fs.linkSync(statePath, path.join(dir, 'alias')); assert.throws(() => loadAuth(statePath, targetsPath, [url], [path.join(dir, 'alias')]));
    assert.throws(() => protectAuthFiles([statePath, targetsPath], [dir]));
    const request = { schema_version: 1, workspace: '.', artifacts_dir: 'artifacts', discovery: {url: origin}, scan: {storage_state: 'state.json', auth_targets: 'targets.json', fail_on: 'none'}, report: {enabled: false} };
    const requestPath = path.join(dir, 'request.json'); save(requestPath, request);
    const plan = buildRunPlan(requestPath, {});
    const args = plan.stages[1].args;
    assert(args.includes('--storage-state') && args.includes(statePath));
    assert(args.includes('--auth-targets') && args.includes(targetsPath));
    assert(plan.protectedPaths.includes(statePath));
    const scanArgs = ['a11y-audit/scripts/scan.js', '--urls', url, '--storage-state', statePath, '--auth-targets', targetsPath, '--output', output, '--summary', '--fail-on', 'none'];
    if (unit) { console.log('Authentication input and adapter checks passed'); return; }
    const yaml = await run(['-rjson', '-ryaml', '-e', 'puts JSON.generate(YAML.safe_load(File.read(ARGV[0])))', path.join(root, '.github/actions/scan/action.yml')], {command: 'ruby'});
    assert.strictEqual(yaml.status, 0, yaml.stderr);
    const action = JSON.parse(yaml.stdout);
    const inputs = Object.fromEntries(Object.entries(action.inputs).map(([key, value]) => [key, value.default || '']));
    Object.assign(inputs, {urls: url, 'storage-state': statePath, 'auth-targets': targetsPath, output, 'fail-on': 'none'});
    async function actionStep(name) {
      const step = action.runs.steps.find(s => s.name === name);
      const env = Object.fromEntries(Object.entries(step.env).map(([key, value]) => [key, value.replace(/\$\{\{ inputs\.([^ ]+) \}\}/g, (_, input) => inputs[input])]));
      const script = step.run.replace(/\$\{\{ github.action_path \}\}/g, path.join(root, '.github/actions/scan'));
      return run(['-eo', 'pipefail', '-c', script], {command: 'bash', env: {...process.env, ...env}});
    }
    inputs.output = statePath;
    assert.notStrictEqual((await actionStep('Protect authentication artifacts')).status, 0);
    inputs.output = output;
    assert.strictEqual((await actionStep('Protect authentication artifacts')).status, 0);
    const actionScan = await actionStep('Run a11y scan');
    assert.strictEqual(actionScan.status, 0, actionScan.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(output)).results.length, 1);
    let first;
    for (let index = 0; index < 2; index++) {
      const result = await run(scanArgs); assert.strictEqual(result.status, 0, result.stderr);
      const bytes = fs.readFileSync(output, 'utf8'); assert(!bytes.includes(secret)); assert(!result.stderr.includes(secret));
      const scan = JSON.parse(bytes); assert.deepStrictEqual(scan.errors, []); assert(scan.findings.length);
      if (first) assert.deepStrictEqual(scan.findings, first); else first = scan.findings;
    }
    save(targetsPath, [target, {...target, url: `${origin}/second`, expected_url: `${origin}/second`}]);
    const isolatedArgs = [...scanArgs]; isolatedArgs[2] = `${url},${origin}/second`;
    const isolated = await run(isolatedArgs); assert.strictEqual(isolated.status, 0, isolated.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(output)).results.length, 2);
    assert.strictEqual(leakedRequests, 0, 'cross-origin subresources must be blocked');
    for (const failure of ['expired', 'selector', 'destination', 'redirect']) {
      save(statePath, failure === 'expired' ? {...state, cookies: [{...state.cookies[0], expires: 1}]} : state);
      save(targetsPath, [{...target, ...(failure === 'selector' ? {ready_selector: '#absent'} : {}), ...(failure === 'destination' ? {expected_url: `${origin}/other`} : {}), ...(failure === 'redirect' ? {url: `${origin}/redirect`, expected_url: `${origin}/redirect`} : {})}]);
      const args = [...scanArgs]; if (failure === 'redirect') args[2] = `${origin}/redirect`;
      const result = await run(args); assert.strictEqual(result.status, 1, failure);
      const bytes = fs.readFileSync(output, 'utf8'); assert(!bytes.includes(secret)); assert(!result.stderr.includes(secret));
      const scan = JSON.parse(bytes); assert.strictEqual(scan.results.length, 0); assert.strictEqual(scan.errors.length, 1);
    }
    assert.strictEqual(leakedRequests, 0);
    save(statePath, state); save(targetsPath, [target]);
    const result = await run(['a11y-audit/scripts/run-audit.js', '--contract', 'posix-json-v1', '--config', requestPath]);
    assert.strictEqual(result.status, 0, result.stderr + result.stdout);
    assert.strictEqual(JSON.parse(result.stdout).operational.status, 'complete');
    save(statePath, {...state, cookies: [{...state.cookies[0], expires: 1}]});
    const failed = await run(['a11y-audit/scripts/run-audit.js', '--contract', 'posix-json-v1', '--config', requestPath]);
    assert.notStrictEqual(failed.status, 0);
    assert.strictEqual(JSON.parse(failed.stdout).operational.status, 'failed');
    console.log('Authenticated browser and adapter checks passed');
  } finally {
    if (!unit) await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => other.close(resolve))]);
    fs.rmSync(dir, {recursive: true, force: true});
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
