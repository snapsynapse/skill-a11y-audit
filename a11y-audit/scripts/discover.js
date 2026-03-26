#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-03-26
previous_version: null
change_summary: Sitemap-first page discovery with template-aware sampling for large sites.
*/

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { args[key] = true; continue; }
    args[key] = next;
    i += 1;
  }
  return args;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetch(res.headers.location));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', () => resolve(null));
  });
}

// ---------------------------------------------------------------------------
// Sitemap parsing (simple XML — no dependency needed)
// ---------------------------------------------------------------------------

function parseSitemap(xml) {
  const urls = [];
  const re = /<loc>(.*?)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

// ---------------------------------------------------------------------------
// HTML link extraction (fallback when no sitemap)
// ---------------------------------------------------------------------------

function extractLinks(html, baseUrl) {
  const links = new Set();
  const re = /<a\s[^>]*href="([^"#?]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    if (href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    if (!href.startsWith('http')) {
      href = new URL(href, baseUrl).href;
    }
    // Only same-origin links
    try {
      const u = new URL(href);
      const base = new URL(baseUrl);
      if (u.origin === base.origin) links.add(href);
    } catch { /* skip malformed */ }
  }
  return [...links];
}

// ---------------------------------------------------------------------------
// URL pattern classification
// ---------------------------------------------------------------------------

function classifyUrl(urlStr, baseOrigin) {
  const u = new URL(urlStr);
  let pathname = u.pathname;
  // Normalize: strip trailing index.html, ensure trailing slash consistency
  pathname = pathname.replace(/\/index\.html$/, '/');
  if (pathname === '/') return { pattern: '/', segments: [] };

  // Split into segments
  const parts = pathname.split('/').filter(Boolean);
  // Strip .html extension from last segment for pattern matching
  if (parts.length > 0) {
    parts[parts.length - 1] = parts[parts.length - 1].replace(/\.html$/, '');
  }

  if (parts.length === 1) {
    // Top-level page like /about, /matrix, /regulations
    return { pattern: parts[0], segments: parts };
  }

  // Multi-segment: replace dynamic segments with *
  // First segment is the type, rest are dynamic
  const patternParts = [parts[0], ...parts.slice(1).map(() => '*')];
  return { pattern: patternParts.join('/'), segments: parts };
}

// ---------------------------------------------------------------------------
// Representative selection
// ---------------------------------------------------------------------------

function selectRepresentatives(group, maxPerGroup) {
  const urls = group.urls.sort();
  if (urls.length <= Math.max(maxPerGroup, 3)) {
    return { selected: urls, reason: `all ${urls.length} — small group` };
  }
  // Pick first and last alphabetically, plus middle if max allows
  const selected = [urls[0], urls[urls.length - 1]];
  if (maxPerGroup >= 3 && urls.length > 4) {
    selected.splice(1, 0, urls[Math.floor(urls.length / 2)]);
  }
  return {
    selected: selected.slice(0, maxPerGroup),
    reason: `${selected.length} of ${urls.length} — alphabetic spread`,
  };
}

// ---------------------------------------------------------------------------
// Main discovery
// ---------------------------------------------------------------------------

async function discover(runtimeUrl, opts = {}) {
  const maxPerGroup = parseInt(opts.maxPerGroup, 10) || 2;
  const baseOrigin = new URL(runtimeUrl).origin;

  let allUrls = [];
  let source = 'unknown';

  // 1. Try sitemap via well-known paths
  if (!opts.noSitemap) {
    const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml'];

    // Check robots.txt for sitemap reference
    const robotsTxt = await fetch(`${baseOrigin}/robots.txt`);
    if (robotsTxt) {
      const sitemapMatch = robotsTxt.match(/Sitemap:\s*(\S+)/i);
      if (sitemapMatch) {
        // Rebase sitemap URL to runtime origin
        try {
          const sitemapUrl = new URL(new URL(sitemapMatch[1]).pathname, baseOrigin).href;
          sitemapPaths.unshift(sitemapUrl.replace(baseOrigin, ''));
        } catch { /* use defaults */ }
      }
    }

    for (const p of [...new Set(sitemapPaths)]) {
      const xml = await fetch(`${baseOrigin}${p}`);
      if (xml && xml.includes('<urlset') || xml && xml.includes('<sitemapindex')) {
        let sitemapUrls = parseSitemap(xml);

        // Handle sitemap index (list of sitemaps)
        if (xml.includes('<sitemapindex')) {
          const subSitemaps = parseSitemap(xml);
          sitemapUrls = [];
          for (const sub of subSitemaps) {
            const subUrl = new URL(new URL(sub).pathname, baseOrigin).href;
            const subXml = await fetch(subUrl);
            if (subXml) sitemapUrls.push(...parseSitemap(subXml));
          }
        }

        // Rebase URLs from production origin to runtime origin
        allUrls = sitemapUrls.map((u) => {
          try {
            const parsed = new URL(u);
            return `${baseOrigin}${parsed.pathname}`;
          } catch {
            return u;
          }
        });
        source = `sitemap (${p})`;
        break;
      }
    }
  }

  // 2. Fallback: crawl navigation links
  if (allUrls.length === 0) {
    const html = await fetch(runtimeUrl);
    if (html) {
      allUrls = extractLinks(html, runtimeUrl);
      source = 'html-crawl (depth 1)';

      // Crawl one level deeper for hub pages
      const hubUrls = [...allUrls];
      for (const hubUrl of hubUrls.slice(0, 20)) {
        const hubHtml = await fetch(hubUrl);
        if (hubHtml) {
          const deeper = extractLinks(hubHtml, hubUrl);
          for (const d of deeper) {
            if (!allUrls.includes(d)) allUrls.push(d);
          }
        }
      }
    }
  }

  if (allUrls.length === 0) {
    return { error: 'No pages discovered. Check the URL and try --sitemap-path.' };
  }

  // 3. Classify into groups
  const groupMap = new Map();
  for (const url of allUrls) {
    const { pattern } = classifyUrl(url, baseOrigin);
    if (!groupMap.has(pattern)) {
      groupMap.set(pattern, { pattern, urls: [] });
    }
    groupMap.get(pattern).urls.push(url);
  }

  // 4. Select representatives
  const groups = [];
  const scanList = [];

  // Sort groups: unique/top-level first, then by count descending
  const sorted = [...groupMap.values()].sort((a, b) => {
    const aIsTopLevel = !a.pattern.includes('/') && !a.pattern.includes('*');
    const bIsTopLevel = !b.pattern.includes('/') && !b.pattern.includes('*');
    if (aIsTopLevel && !bIsTopLevel) return -1;
    if (!aIsTopLevel && bIsTopLevel) return 1;
    return b.urls.length - a.urls.length;
  });

  for (const group of sorted) {
    const isTopLevel = !group.pattern.includes('/') && !group.pattern.includes('*');
    let selected, reason;

    if (isTopLevel || group.urls.length === 1) {
      // Top-level pages or singletons: always include
      selected = group.urls.sort();
      reason = isTopLevel ? 'top-level page — always included' : 'singleton — always included';
    } else {
      ({ selected, reason } = selectRepresentatives(group, maxPerGroup));
    }

    groups.push({
      pattern: group.pattern,
      count: group.urls.length,
      selected,
      reason,
    });
    scanList.push(...selected);
  }

  // 5. Try to enrich with API manifest
  let apiManifest = null;
  const apiJson = await fetch(`${baseOrigin}/api/v1/index.json`);
  if (apiJson) {
    try { apiManifest = JSON.parse(apiJson); } catch { /* skip */ }
  }

  return {
    source,
    runtimeUrl,
    totalPages: allUrls.length,
    selectedPages: scanList.length,
    coverageRatio: `${groups.length} template groups, ${scanList.length} pages selected`,
    apiManifest: apiManifest ? { version: apiManifest.meta?.version, endpoints: Object.keys(apiManifest.endpoints || {}).length } : null,
    groups,
    scanList,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url;
  if (!url) {
    console.error('Usage: discover.js --url <base-url> [--output <path>] [--max-per-group N] [--no-sitemap]');
    process.exit(1);
  }

  const result = await discover(url, {
    maxPerGroup: args['max-per-group'],
    noSitemap: args['no-sitemap'] === true || args['no-sitemap'] === 'true',
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  const outputPath = args.output ? path.resolve(args.output) : null;
  const json = JSON.stringify(result, null, 2);

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json);
    console.log(outputPath);
  } else {
    console.log(json);
  }

  // Summary to stderr so it's visible even when piping
  console.error(`\nDiscovery: ${result.totalPages} pages found via ${result.source}`);
  console.error(`Selected ${result.selectedPages} pages across ${result.groups.length} template groups`);
  for (const g of result.groups) {
    console.error(`  ${g.pattern}: ${g.count} pages → ${g.selected.length} selected (${g.reason})`);
  }
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
