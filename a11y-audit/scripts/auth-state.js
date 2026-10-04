/*
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-10-03
previous_version: null
change_summary: >
  Validates bounded authentication inputs and isolates each authenticated target.
*/
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function keys(value, allowed) {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert(Object.keys(value).every(key => allowed.includes(key)));
}
function webUrl(value) {
  assert(typeof value === 'string');
  const url = new URL(value);
  assert(['http:', 'https:'].includes(url.protocol));
  assert(!url.username && !url.password && !url.search && !url.hash);
  return url;
}
function text(value) { assert(typeof value === 'string' && value.length > 0); }
function protectAuthFiles(inputs, outputs) {
  try {
    const resolved = inputs.map(p => fs.realpathSync(path.resolve(p)));
    for (const output of outputs.filter(Boolean)) {
      const absolute = path.resolve(output);
      let ancestor = absolute;
      while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
      const real = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, absolute));
      assert(!resolved.some(input => input === real || input.startsWith(real + path.sep)));
      if (fs.existsSync(absolute)) {
        const stat = fs.statSync(absolute);
        assert(!resolved.some(input => {
          const other = fs.statSync(input);
          return other.dev === stat.dev && other.ino === stat.ino;
        }));
      }
    }
  } catch { throw new Error('Authentication files must exist and remain separate from all output and artifact paths.'); }
}
function loadAuth(statePath, targetsPath, urls, outputs = []) {
  if (statePath === undefined && targetsPath === undefined) return null;
  try {
    text(statePath); text(targetsPath);
    const inputs = [statePath, targetsPath].map(p => fs.realpathSync(path.resolve(p)));
    protectAuthFiles(inputs, outputs);
    assert(inputs.every(p => fs.statSync(p).size <= 1024 * 1024));
    const state = JSON.parse(fs.readFileSync(inputs[0], 'utf8'));
    const targets = JSON.parse(fs.readFileSync(inputs[1], 'utf8'));
    keys(state, ['cookies', 'origins']);
    assert(Array.isArray(state.cookies) && Array.isArray(state.origins));
    assert(Array.isArray(targets) && targets.length > 0);
    const byUrl = new Map();
    for (const target of targets) {
      keys(target, ['url', 'expected_url', 'ready_selector']);
      const url = webUrl(target.url);
      const expected = webUrl(target.expected_url);
      assert(url.origin === expected.origin);
      text(target.ready_selector);
      assert(target.ready_selector.length <= 1024);
      assert(!byUrl.has(url.href));
      byUrl.set(url.href, { expected: expected.href, selector: target.ready_selector });
    }
    assert(urls.every(url => byUrl.has(webUrl(url).href)));
    const origins = new Set(targets.map(t => webUrl(t.url).origin));
    const hostnames = new Set([...origins].map(o => new URL(o).hostname));
    const seenOrigins = new Set();
    for (const origin of state.origins) {
      keys(origin, ['origin', 'localStorage']);
      assert(webUrl(origin.origin).origin === origin.origin && origins.has(origin.origin));
      assert(!seenOrigins.has(origin.origin)); seenOrigins.add(origin.origin);
      assert(Array.isArray(origin.localStorage));
      const names = new Set();
      for (const item of origin.localStorage) {
        keys(item, ['name', 'value']); text(item.name);
        assert(typeof item.value === 'string' && !names.has(item.name)); names.add(item.name);
      }
    }
    for (const cookie of state.cookies) {
      keys(cookie, ['name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite']);
      text(cookie.name); assert(typeof cookie.value === 'string');
      text(cookie.domain); assert(hostnames.has(cookie.domain.replace(/^\./, '')));
      assert(typeof cookie.path === 'string' && cookie.path.startsWith('/'));
      assert(Number.isFinite(cookie.expires) && (cookie.expires === -1 || cookie.expires > 0));
      assert(typeof cookie.httpOnly === 'boolean' && typeof cookie.secure === 'boolean');
      assert(['Strict', 'Lax', 'None'].includes(cookie.sameSite));
    }
    const secrets = [...state.cookies.map(c => c.value), ...state.origins.flatMap(o => o.localStorage.map(i => i.value))]
      .filter(Boolean).sort((a, b) => b.length - a.length);
    const redact = value => {
      if (typeof value === 'string') return secrets.reduce((s, secret) => s.split(secret).join('[REDACTED]'), value);
      if (Array.isArray(value)) return value.map(redact);
      if (value && typeof value === 'object') {
        // Engine identifiers and severity/tag enums are not page content. Changing
        // them can turn a blocking finding into an unknown or nonblocking rule.
        const structural = new Set(['id', 'impact', 'tags', 'testEngine', 'testRunner', 'testEnvironment', 'toolOptions']);
        return Object.fromEntries(Object.entries(value).map(([key, item]) =>
          [key, structural.has(key) ? item : redact(item)]));
      }
      return value;
    };
    return { state, byUrl, redact };
  } catch {
    throw new Error('Invalid authentication inputs: supply supported storage state and same-origin target assertions for every scan URL; inputs must not alias outputs.');
  }
}
async function prepareAuth(browser, auth, url) {
  const context = await browser.createBrowserContext();
  try {
    const target = new URL(url);
    const cookies = auth.state.cookies.filter(c => c.domain.replace(/^\./, '') === target.hostname)
      .map(({ domain, expires, ...cookie }) => ({ ...cookie, domain: target.hostname, ...(expires === -1 ? {} : { expires }) }));
    if (cookies.length) await context.setCookie(...cookies);
    const page = await context.newPage();
    const local = auth.state.origins.find(o => o.origin === target.origin)?.localStorage || [];
    await page.evaluateOnNewDocument((origin, entries) => {
      if (window.location.origin === origin) {
        for (const { name, value } of entries) window.localStorage.setItem(name, value);
      }
    }, target.origin, local);
    // Bound requests intercepted on this page to its declared target origin.
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', request => {
      const requestUrl = new URL(request.url());
      if (['data:', 'blob:'].includes(requestUrl.protocol) || requestUrl.origin === target.origin) request.continue().catch(() => {});
      else request.abort().catch(() => {});
    });
    return { context, page };
  } catch (error) { await context.close(); throw error; }
}
async function assertAuth(page, response, assertion) {
  assert(response && response.ok(), 'Authenticated target did not return a successful response.');
  assert(/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers()['content-type'] || ''), 'Authenticated target did not return HTML.');
  assert(page.url() === assertion.expected, 'Authenticated target URL assertion failed.');
  await page.waitForSelector(assertion.selector, { visible: true, timeout: 5000 });
  assert(page.url() === assertion.expected, 'Authenticated target URL changed while waiting.');
}
module.exports = { loadAuth, prepareAuth, assertAuth, protectAuthFiles };
if (require.main === module) {
  try {
    const [state, targets, ...outputs] = process.argv.slice(2);
    if (state || targets) {
      assert(state && targets);
      assert(outputs.every(output => output && !/[!*?\[\]\r\n]/.test(output)));
      protectAuthFiles([state, targets], outputs);
    }
  } catch { console.error('Unsafe authentication artifact configuration.'); process.exitCode = 1; }
}
