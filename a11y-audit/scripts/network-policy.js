/*
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-10-26
previous_version: null
change_summary: >
  Shares approved-origin checks and bounded HTTP reads across discovery and scanning.
*/
'use strict';

const http = require('http');
const https = require('https');
const zlib = require('zlib');

function webUrl(value, base) {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Network targets must use HTTP(S) without embedded credentials.');
  }
  return url;
}

function approvedOrigins(base, extra = []) {
  if (!Array.isArray(extra)) throw new Error('Additional approved origins must be an array.');
  const origins = new Set([webUrl(base).origin]);
  for (const value of extra) {
    const url = webUrl(value);
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error('An approved origin must contain only scheme, hostname and optional port.');
    }
    origins.add(url.origin);
  }
  return origins;
}

function requireApprovedUrl(value, origins, base) {
  const url = webUrl(value, base);
  if (!origins.has(url.origin)) {
    throw new Error(`URL origin is not approved: ${url.origin}. Use --allow-origin for reviewed additional origins.`);
  }
  return url.href;
}

// One deadline spans redirects and body streaming, rather than restarting on
// each chunk or redirect. Refuse an off-origin redirect before issuing it.
function fetchResource(value, opts = {}, state = {}) {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 5;
  for (const [label, limit] of Object.entries({ timeoutMs, maxBytes, maxRedirects })) {
    if (!Number.isSafeInteger(limit) || limit < (label === 'maxRedirects' ? 0 : 1)) {
      return Promise.reject(new Error(`Invalid network limit: ${label}`));
    }
  }
  let url;
  try { url = webUrl(value); } catch {
    return Promise.resolve({ blocked: true, reason: 'invalid-url', url: String(value), origin: null });
  }
  const blocked = reason => ({ blocked: true, reason, url: url.href, origin: url.origin });
  if (opts.allowedOrigins && !opts.allowedOrigins.has(url.origin)) {
    return Promise.resolve(blocked('cross-origin'));
  }
  const deadline = state.deadline ?? Date.now() + timeoutMs;
  if (Date.now() >= deadline) return Promise.resolve(blocked('timeout'));
  return new Promise(resolve => {
    let done = false;
    let request;
    let decoder;
    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    };
    const stop = reason => {
      finish(blocked(reason));
      decoder?.destroy();
      request?.destroy();
    };
    const timer = setTimeout(() => stop('timeout'), Math.max(1, deadline - Date.now()));
    try {
      request = (url.protocol === 'https:' ? https : http).get(url, {
        timeout: deadline - Date.now(), headers: { 'accept-encoding': 'gzip, deflate, br' },
      }, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          if ((state.redirects ?? 0) >= maxRedirects) return stop('redirect-limit');
          let next;
          try { next = webUrl(response.headers.location, url).href; } catch { return stop('invalid-url'); }
          finish(fetchResource(next, opts, { deadline, redirects: (state.redirects ?? 0) + 1 }));
          request?.destroy();
          return;
        }
        if (response.statusCode !== 200) {
          finish(null);
          request?.destroy();
          return;
        }
        if (Number(response.headers['content-length']) > maxBytes) return stop('max-bytes');
        const encoding = String(response.headers['content-encoding'] || 'identity').trim().toLowerCase();
        const decoders = { gzip: zlib.createGunzip, deflate: zlib.createInflate, br: zlib.createBrotliDecompress };
        if (encoding !== 'identity') {
          if (!Object.hasOwn(decoders, encoding)) return stop('unsupported-encoding');
          decoder = decoders[encoding]();
        }
        const body = decoder || response;
        const chunks = [];
        let bytes = 0;
        let wireBytes = 0;
        response.on('data', chunk => {
          wireBytes += chunk.length;
          if (wireBytes > maxBytes) stop('max-bytes');
        });
        body.on('data', chunk => {
          if (done) return;
          bytes += chunk.length;
          if (bytes > maxBytes) return stop('max-bytes');
          chunks.push(chunk);
        });
        body.on('end', () => finish({
          body: Buffer.concat(chunks).toString('utf8'), bytes: Math.max(bytes, wireBytes), url: url.href,
          origin: url.origin, blocked: false, reason: null,
        }));
        response.on('aborted', () => stop('incomplete-response'));
        response.on('error', () => stop('incomplete-response'));
        if (decoder) {
          decoder.on('error', () => stop('invalid-encoding'));
          response.pipe(decoder);
        }
      });
      request.on('timeout', () => stop('timeout'));
      request.on('error', () => finish(null));
    } catch { finish(null); }
  });
}

async function guardNavigation(page, origins) {
  let blocked = false;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      try { requireApprovedUrl(request.url(), origins); } catch {
        blocked = true;
        request.abort().catch(() => {});
        return;
      }
    }
    request.continue().catch(() => {});
  });
  return () => {
    if (blocked) throw new Error('Navigation attempted an unapproved origin.');
    requireApprovedUrl(page.url(), origins);
  };
}

module.exports = { webUrl, approvedOrigins, requireApprovedUrl, fetchResource, guardNavigation };
