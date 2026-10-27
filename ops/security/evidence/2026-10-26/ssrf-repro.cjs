'use strict';
// Mock-only reproduction. No real HTTP or browser requests are made.
const path = require('node:path');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const root = path.resolve(process.argv[2] || process.cwd());
const responses = {
  'https://public.test/robots.txt': { statusCode: 404 },
  'https://public.test/sitemap.xml': {
    body: '<urlset><url><loc>http://127.0.0.1:8000/admin</loc></url></urlset>',
  },
};
const requested = [];
const mockGet = (url, options, callback) => {
  const href = url.href || String(url);
  requested.push(href);
  const entry = responses[href] || { statusCode: 404 };
  const request = new EventEmitter();
  request.destroy = () => {};
  process.nextTick(() => {
    const response = new EventEmitter();
    response.statusCode = entry.statusCode || 200;
    response.headers = {};
    response.resume = () => {};
    callback(response);
    process.nextTick(() => {
      if (entry.body) response.emit('data', Buffer.from(entry.body));
      response.emit('end');
    });
  });
  return request;
};
require('node:http').get = mockGet;
require('node:https').get = mockGet;
const fetches = [];
global.fetch = async (url, options) => {
  fetches.push({ url, options: options || null });
  return {
    ok: true,
    text: async () => url === 'https://public.test/sitemap.xml'
      ? '<sitemapindex><sitemap><loc>http://127.0.0.1:8000/internal.xml</loc></sitemap></sitemapindex>'
      : '<urlset><url><loc>http://127.0.0.1:8000/admin</loc></url></urlset>',
  };
};
(async () => {
  const { discover } = require(path.join(root, 'a11y-audit/scripts/discover.js'));
  const { loadUrlsFromSitemap } = require(path.join(root, 'a11y-audit/scripts/scan.js'));
  const discovery = await discover('https://public.test/', { fingerprint: false });
  assert.equal(discovery.originPolicy, 'same-origin');
  assert.deepEqual(discovery.scanList, ['http://127.0.0.1:8000/admin']);
  assert.deepEqual(discovery.blockedFetches, []);
  const directUrls = await loadUrlsFromSitemap('https://public.test/sitemap.xml');
  assert.equal(fetches[1].url, 'http://127.0.0.1:8000/internal.xml');
  console.log(JSON.stringify({
    reproduction: 'SEC-200 mock-only; no live requests',
    discovery: {
      originPolicy: discovery.originPolicy,
      discoveredOrigins: discovery.discoveredOrigins,
      blockedFetches: discovery.blockedFetches,
      scanList: discovery.scanList,
      mockedRequests: requested,
    },
    directSitemap: { mockedFetches: fetches, urls: directUrls },
    assertions: 'passed',
  }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
