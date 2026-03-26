#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 2
version_date: 2026-03-26
previous_version: 1
change_summary: >
  DOM fingerprinting for smarter representative selection, API entity
  enrichment for group labels, HTML crawl fallback improvements.
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

function httpFetch(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpFetch(res.headers.location));
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
  while ((m = re.exec(xml)) !== null) urls.push(m[1].trim());
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
    if (!href.startsWith('http')) href = new URL(href, baseUrl).href;
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

function classifyUrl(urlStr) {
  const u = new URL(urlStr);
  let pathname = u.pathname;
  pathname = pathname.replace(/\/index\.html$/, '/');
  if (pathname === '/') return { pattern: '/', segments: [] };

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0) parts[parts.length - 1] = parts[parts.length - 1].replace(/\.html$/, '');

  if (parts.length === 1) return { pattern: parts[0], segments: parts };

  const patternParts = [parts[0], ...parts.slice(1).map(() => '*')];
  return { pattern: patternParts.join('/'), segments: parts };
}

// ---------------------------------------------------------------------------
// DOM fingerprinting (lightweight — loads HTML, counts structural elements)
// ---------------------------------------------------------------------------

function computeFingerprint(html) {
  if (!html) return { score: 0, elements: {} };

  // Count elements inside <main> if present, else whole body
  let region = html;
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) region = mainMatch[1];

  const counts = {};
  const tags = ['table', 'details', 'form', 'input', 'select', 'button', 'ul', 'ol', 'dl', 'h1', 'h2', 'h3', 'h4', 'img', 'canvas', 'svg', 'iframe', 'video', 'audio'];
  for (const tag of tags) {
    const re = new RegExp(`<${tag}[\\s>]`, 'gi');
    const matches = region.match(re);
    if (matches) counts[tag] = matches.length;
  }

  // Count data attributes that imply interactivity
  const sortable = (region.match(/data-sortable/gi) || []).length;
  const filterable = (region.match(/data-filterable/gi) || []).length;
  if (sortable) counts['[data-sortable]'] = sortable;
  if (filterable) counts['[data-filterable]'] = filterable;

  // Complexity score: weighted sum
  const weights = { table: 3, details: 2, form: 3, input: 2, select: 2, button: 1, dl: 2, iframe: 4, video: 4, canvas: 3, svg: 1, '[data-sortable]': 2, '[data-filterable]': 2 };
  let score = 0;
  for (const [tag, count] of Object.entries(counts)) {
    score += count * (weights[tag] || 1);
  }

  return { score, elements: counts };
}

async function fingerprintCandidates(urls) {
  // Load HTML for each candidate and compute fingerprint
  const results = [];
  for (const url of urls) {
    const html = await httpFetch(url);
    const fp = computeFingerprint(html);
    results.push({ url, ...fp });
  }
  return results.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Representative selection (with optional fingerprinting)
// ---------------------------------------------------------------------------

async function selectRepresentatives(group, maxPerGroup, useFingerprint) {
  const urls = group.urls.sort();
  if (urls.length <= Math.max(maxPerGroup, 3)) {
    return { selected: urls, reason: `all ${urls.length} — small group` };
  }

  if (useFingerprint) {
    // Sample candidates: first, middle, last, plus a few random
    const candidateIdxs = new Set([0, Math.floor(urls.length / 4), Math.floor(urls.length / 2), Math.floor(3 * urls.length / 4), urls.length - 1]);
    // Add up to 3 random indices for variety
    for (let i = 0; i < 3 && candidateIdxs.size < Math.min(10, urls.length); i++) {
      candidateIdxs.add(Math.floor(Math.random() * urls.length));
    }
    const candidates = [...candidateIdxs].map((i) => urls[i]);

    const fingerprinted = await fingerprintCandidates(candidates);
    if (fingerprinted.length > 0 && fingerprinted[0].score > 0) {
      // Pick most complex and least complex
      const selected = [fingerprinted[0].url];
      const least = fingerprinted[fingerprinted.length - 1];
      if (least.url !== selected[0]) selected.push(least.url);
      if (maxPerGroup >= 3 && fingerprinted.length > 2) {
        const mid = fingerprinted[Math.floor(fingerprinted.length / 2)];
        if (!selected.includes(mid.url)) selected.push(mid.url);
      }
      return {
        selected: selected.slice(0, maxPerGroup),
        reason: `${selected.length} of ${urls.length} — by DOM complexity (scores: ${fingerprinted[0].score}→${least.score})`,
        fingerprints: fingerprinted,
      };
    }
  }

  // Fallback: alphabetic spread
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
// API entity enrichment
// ---------------------------------------------------------------------------

function enrichGroupLabel(pattern, apiManifest) {
  if (!apiManifest) return null;
  // Support both "endpoints" and "files" keys (common API index patterns)
  const catalog = apiManifest.endpoints || apiManifest.files;
  if (!catalog) return null;

  // Map URL patterns to API endpoint names
  const patternToEndpoint = {
    'regulation/*': 'regulations',
    'obligation/*': 'obligations',
    'authority/*': 'authorities',
    'applies-to/*': 'jurisdictions',
    'standard/*': 'standards',
    'requires/*/*': 'provisions',
  };

  const endpointKey = patternToEndpoint[pattern];
  if (!endpointKey) return null;

  const endpoint = catalog[endpointKey];
  if (!endpoint) return null;

  return {
    entityType: endpointKey,
    description: endpoint.description || null,
    count: endpoint.count || null,
  };
}

// ---------------------------------------------------------------------------
// Main discovery
// ---------------------------------------------------------------------------

async function discover(runtimeUrl, opts = {}) {
  const maxPerGroup = parseInt(opts.maxPerGroup, 10) || 2;
  const useFingerprint = opts.fingerprint !== false;
  const baseOrigin = new URL(runtimeUrl).origin;

  let allUrls = [];
  let source = 'unknown';

  // 1. Try sitemap via well-known paths
  if (!opts.noSitemap) {
    const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml'];

    const robotsTxt = await httpFetch(`${baseOrigin}/robots.txt`);
    if (robotsTxt) {
      const sitemapMatch = robotsTxt.match(/Sitemap:\s*(\S+)/i);
      if (sitemapMatch) {
        try {
          const sitemapUrl = new URL(new URL(sitemapMatch[1]).pathname, baseOrigin).href;
          sitemapPaths.unshift(sitemapUrl.replace(baseOrigin, ''));
        } catch { /* use defaults */ }
      }
    }

    for (const p of [...new Set(sitemapPaths)]) {
      const xml = await httpFetch(`${baseOrigin}${p}`);
      if (xml && (xml.includes('<urlset') || xml.includes('<sitemapindex'))) {
        let sitemapUrls = parseSitemap(xml);

        if (xml.includes('<sitemapindex')) {
          const subSitemaps = parseSitemap(xml);
          sitemapUrls = [];
          for (const sub of subSitemaps) {
            const subUrl = new URL(new URL(sub).pathname, baseOrigin).href;
            const subXml = await httpFetch(subUrl);
            if (subXml) sitemapUrls.push(...parseSitemap(subXml));
          }
        }

        allUrls = sitemapUrls.map((u) => {
          try {
            return `${baseOrigin}${new URL(u).pathname}`;
          } catch { return u; }
        });
        source = `sitemap (${p})`;
        break;
      }
    }
  }

  // 2. Fallback: crawl navigation links
  if (allUrls.length === 0) {
    const html = await httpFetch(runtimeUrl);
    if (html) {
      allUrls = extractLinks(html, runtimeUrl);
      source = 'html-crawl (depth 1)';

      const hubUrls = [...allUrls];
      for (const hubUrl of hubUrls.slice(0, 20)) {
        const hubHtml = await httpFetch(hubUrl);
        if (hubHtml) {
          const deeper = extractLinks(hubHtml, hubUrl);
          for (const d of deeper) {
            if (!allUrls.includes(d)) allUrls.push(d);
          }
        }
      }
      source = `html-crawl (depth 2, ${allUrls.length} links)`;
    }
  }

  if (allUrls.length === 0) {
    return { error: 'No pages discovered. Check the URL and try --no-sitemap for crawl mode.' };
  }

  // 3. Classify into groups
  const groupMap = new Map();
  for (const url of allUrls) {
    const { pattern } = classifyUrl(url);
    if (!groupMap.has(pattern)) groupMap.set(pattern, { pattern, urls: [] });
    groupMap.get(pattern).urls.push(url);
  }

  // 4. Fetch API manifest for enrichment
  let apiManifest = null;
  for (const apiPath of ['/api/v1/index.json', '/api/index.json']) {
    const apiJson = await httpFetch(`${baseOrigin}${apiPath}`);
    if (apiJson) {
      try { apiManifest = JSON.parse(apiJson); break; } catch { /* skip */ }
    }
  }

  // 5. Select representatives (with fingerprinting for large groups)
  const groups = [];
  const scanList = [];

  const sorted = [...groupMap.values()].sort((a, b) => {
    const aIsTopLevel = !a.pattern.includes('/') && !a.pattern.includes('*');
    const bIsTopLevel = !b.pattern.includes('/') && !b.pattern.includes('*');
    if (aIsTopLevel && !bIsTopLevel) return -1;
    if (!aIsTopLevel && bIsTopLevel) return 1;
    return b.urls.length - a.urls.length;
  });

  let fingerprintCount = 0;
  for (const group of sorted) {
    const isTopLevel = !group.pattern.includes('/') && !group.pattern.includes('*');
    let selected, reason, fingerprints;

    if (isTopLevel || group.urls.length === 1) {
      selected = group.urls.sort();
      reason = isTopLevel ? 'top-level page — always included' : 'singleton — always included';
    } else {
      // Only fingerprint groups with 4+ pages to limit HTTP requests
      const shouldFingerprint = useFingerprint && group.urls.length >= 4;
      ({ selected, reason, fingerprints } = await selectRepresentatives(group, maxPerGroup, shouldFingerprint));
      if (shouldFingerprint) fingerprintCount += 1;
    }

    // Enrich with API data
    const enrichment = enrichGroupLabel(group.pattern, apiManifest);

    const groupEntry = {
      pattern: group.pattern,
      count: group.urls.length,
      selected,
      reason,
    };
    if (enrichment) groupEntry.entity = enrichment;
    if (fingerprints) groupEntry.fingerprints = fingerprints.slice(0, 5); // keep top 5

    groups.push(groupEntry);
    scanList.push(...selected);
  }

  return {
    source,
    runtimeUrl,
    totalPages: allUrls.length,
    selectedPages: scanList.length,
    coverageRatio: `${groups.length} template groups, ${scanList.length} pages selected`,
    fingerprintedGroups: fingerprintCount,
    apiManifest: apiManifest ? {
      version: apiManifest.meta?.version,
      endpoints: Object.keys(apiManifest.endpoints || apiManifest.files || {}).length,
    } : null,
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
    console.error('Usage: discover.js --url <base-url> [--output <path>] [--max-per-group N] [--no-sitemap] [--no-fingerprint]');
    process.exit(1);
  }

  const result = await discover(url, {
    maxPerGroup: args['max-per-group'],
    noSitemap: args['no-sitemap'] === true || args['no-sitemap'] === 'true',
    fingerprint: !(args['no-fingerprint'] === true || args['no-fingerprint'] === 'true'),
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

  // Summary to stderr
  console.error(`\nDiscovery: ${result.totalPages} pages found via ${result.source}`);
  console.error(`Selected ${result.selectedPages} pages across ${result.groups.length} template groups`);
  if (result.fingerprintedGroups > 0) {
    console.error(`DOM fingerprinting used on ${result.fingerprintedGroups} groups`);
  }
  for (const g of result.groups) {
    const label = g.entity && g.entity.count ? ` (${g.entity.count} ${g.entity.entityType})` : '';
    console.error(`  ${g.pattern}${label}: ${g.count} pages → ${g.selected.length} selected (${g.reason})`);
  }
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
