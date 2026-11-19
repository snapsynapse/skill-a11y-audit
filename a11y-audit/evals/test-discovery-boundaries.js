#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { discover, parseSitemap, extractLinks } = require('../scripts/discover.js');

const origin = 'https://example.test';
function resource(url, body) {
  return { url, origin, body, bytes: Buffer.byteLength(body), blocked: false };
}
async function run(responses, options = {}) {
  const hits = [];
  const result = await discover(origin, {
    fingerprint: false,
    fetchResource: async (url) => {
      hits.push(url);
      return responses[url] ?? null;
    },
    ...options,
  });
  return { result, hits };
}

async function main() {
  const sitemap = resource(`${origin}/sitemap.xml`, `<sitemapindex><sitemap><loc>${origin}/good.xml</loc></sitemap><sitemap><loc>${origin}/good.xml</loc></sitemap><sitemap><loc>${origin}/bad.xml</loc></sitemap></sitemapindex>`);
  const good = resource(`${origin}/good.xml`, `<urlset><url><loc>${origin}/page?a=1&amp;b=2</loc></url></urlset>`);
  const base = { [`${origin}/sitemap.xml`]: sitemap, [`${origin}/good.xml`]: good };
  const failed = await run(base);
  assert.match(failed.result.error, /required-sitemap-unavailable/);
  assert.equal(failed.hits.filter(url => url === `${origin}/good.xml`).length, 1);
  assert.deepEqual(failed.result.discoveredUrls, [`${origin}/page?a=1&b=2`]);
  assert(failed.result.blockedFetches.some(item => item.url === `${origin}/bad.xml`));

  for (const reason of ['timeout', 'max-bytes', 'invalid-encoding', 'incomplete-response']) {
    const blocked = await run({ ...base, [`${origin}/bad.xml`]: {
      blocked: true, reason, url: `${origin}/bad.xml`, origin,
    } });
    assert.match(blocked.result.error, /required-sitemap-unavailable/, reason);
    assert(blocked.result.blockedFetches.some(item => item.reason === reason), reason);
  }
  const invalidChild = await run({ ...base, [`${origin}/bad.xml`]: resource(`${origin}/bad.xml`, 'not XML') });
  assert.match(invalidChild.result.error, /required-sitemap-invalid/);

  const healthy = await run({ ...base, [`${origin}/bad.xml`]: resource(`${origin}/bad.xml`, `<urlset><url><loc>${origin}/other</loc></url></urlset>`) });
  assert.equal(healthy.result.error, undefined);
  assert.equal(healthy.result.totalPages, 2);
  assert.equal(healthy.hits.filter(url => url === `${origin}/good.xml`).length, 1);

  const nested = await run({
    [`${origin}/sitemap.xml`]: resource(`${origin}/sitemap.xml`, `<sitemapindex><sitemap><loc>${origin}/nested.xml</loc></sitemap></sitemapindex>`),
    [`${origin}/nested.xml`]: resource(`${origin}/nested.xml`, `<sitemapindex><sitemap><loc>${origin}/missing.xml</loc></sitemap></sitemapindex>`),
  });
  assert.match(nested.result.error, /required-sitemap-unavailable/);

  const selfCycle = await run({
    [`${origin}/sitemap.xml`]: resource(`${origin}/sitemap.xml`, `<sitemapindex><sitemap><loc>${origin}/sitemap.xml</loc></sitemap></sitemapindex>`),
    [origin]: resource(origin, '<a href="/good">good</a>'),
  });
  assert.match(selfCycle.result.error, /required-sitemap-cycle/);
  assert(selfCycle.result.blockedFetches.some(item => item.reason === 'sitemap-cycle'));
  assert.equal(selfCycle.hits.includes(origin), false, 'cyclic index must not fall back to crawl');
  const multiCycle = await run({
    [`${origin}/sitemap.xml`]: resource(`${origin}/sitemap.xml`, `<sitemapindex><sitemap><loc>${origin}/next.xml</loc></sitemap></sitemapindex>`),
    [`${origin}/next.xml`]: resource(`${origin}/next.xml`, `<sitemapindex><sitemap><loc>${origin}/sitemap.xml</loc></sitemap></sitemapindex>`),
  });
  assert.match(multiCycle.result.error, /required-sitemap-cycle/);
  const emptyIndex = await run({
    [`${origin}/sitemap.xml`]: resource(`${origin}/sitemap.xml`, '<sitemapindex></sitemapindex>'),
    [origin]: resource(origin, '<a href="/good">good</a>'),
    [`${origin}/good`]: resource(`${origin}/good`, '<main>good</main>'),
  });
  assert.equal(emptyIndex.result.error, undefined, 'empty index permits crawl fallback');
  assert.match(emptyIndex.result.source, /html-crawl/);

  for (const [options, reason] of [
    [{ maxDocuments: 1 }, 'discovery-document-limit'],
    [{ maxTotalBytes: 10 }, 'discovery-aggregate-bytes'],
    [{ maxTargets: 1 }, 'discovery-target-limit'],
    [{ deadlineMs: 0 }, 'discovery-deadline'],
  ]) {
    const limited = await run({
      [`${origin}/sitemap.xml`]: resource(`${origin}/sitemap.xml`, `<urlset><url><loc>${origin}/one</loc></url><url><loc>${origin}/two</loc></url></urlset>`),
    }, options);
    assert.match(limited.result.error, new RegExp(reason));
  }

  assert.deepEqual(parseSitemap(`<loc>\n ${origin}/?a=1&amp;b=2 \n</loc>`), [`${origin}/?a=1&b=2`]);
  assert.deepEqual(parseSitemap('<loc>&amp;lt; &#38;amp; &apos; &#x27; &#0; &#xD800; &#x110000;</loc>'),
    ['&lt; &amp; \' \' &#0; &#xD800; &#x110000;']);
  assert.deepEqual(extractLinks(`<a href="//[">bad</a><a href="/good">good</a>`, origin), [`${origin}/good`]);
  console.log('discovery boundary tests passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
