// Synthetic local fixtures only. Run from repository root.
'use strict';
const http = require('node:http');
const assert = require('node:assert/strict');
const { discover, parseSitemap, extractLinks } = require(require('node:path').join(process.cwd(), 'a11y-audit/scripts/discover.js'));
(async () => {
 let origin, childHits = 0, failedHits = 0;
 const server = http.createServer((req, res) => {
  if (req.url === '/sitemap.xml') return res.end('<sitemapindex>' + Array.from({length:7},()=>`<sitemap><loc>${origin}/good.xml</loc></sitemap>`).join('') + `<sitemap><loc>${origin}/failed.xml</loc></sitemap></sitemapindex>`);
  if (req.url === '/good.xml') { childHits++; return res.end(`<urlset><url><loc>${origin}/page</loc></url></urlset>`); }
  if (req.url === '/failed.xml') { failedHits++; res.writeHead(503); return res.end('unavailable'); }
  res.writeHead(404); res.end();
 });
 await new Promise(r => server.listen(0,'127.0.0.1',r)); origin=`http://127.0.0.1:${server.address().port}`;
 try {
  const plan = await discover(origin, {fingerprint:false});
  assert.equal(childHits,7); assert.equal(failedHits,1); assert.deepEqual(plan.scanList,[origin+'/page']); assert.deepEqual(plan.blockedFetches,[]); assert.equal(plan.error,undefined);
  const encoded = parseSitemap('<urlset><url><loc>https://example.test/?a=1&amp;b=2</loc></url></urlset>');
  assert.equal(encoded[0],'https://example.test/?a=1&amp;b=2');
  const multiline = parseSitemap('<urlset><url><loc>\nhttps://example.test/page\n</loc></url></urlset>'); assert.deepEqual(multiline,[]);
  let malformedError;try {extractLinks('<a href="//[">bad</a><a href="/good">good</a>',origin);}catch(e){malformedError=e.message;}assert(malformedError);
  console.log(JSON.stringify({childHits,failedHits,planScanList:plan.scanList,blockedFetches:plan.blockedFetches,error:plan.error??null,encoded,multiline,malformedError},null,2));
 } finally {server.closeAllConnections(); await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
