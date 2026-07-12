#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 7
version_date: 2026-07-11
previous_version: 6
change_summary: >
  Adds stable finding fingerprints, explicit baseline creation, and a
  legacy-friendly --fail-on new gate with axe-version mismatch protection.
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { execSync, spawnSync } = require('child_process');

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
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function splitCsv(value) {
  if (!value) return [];
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function validateBrowserLib(browserLib) {
  if (browserLib === 'puppeteer') return browserLib;
  throw new Error(`Unsupported browser library: ${browserLib}. This bundled script supports puppeteer only.`);
}

// axe-core rule sets change between releases, so an unpinned auto-install
// makes repeat audits drift: the same site can gain "new" violations that
// are really new rules, which corrupts delta reports. Auto-install therefore
// pins a known-good version. Override with --axe-version <x.y.z|latest> when
// a newer rule set is deliberately wanted. A project- or global-resolved
// axe-core still wins over auto-install; the resolved version is recorded in
// the output JSON either way so report.js can flag cross-version deltas.
const PINNED_VERSIONS = { 'axe-core': '4.12.1' };

function validateAxeVersion(value) {
  if (value === 'latest' || /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(value)) return value;
  throw new Error(`Invalid --axe-version: ${value}. Use an exact version (e.g. 4.12.1) or "latest".`);
}

// ---------------------------------------------------------------------------
// Sitemap loading
// ---------------------------------------------------------------------------

// Fetch a sitemap.xml URL, extract <loc> entries, and apply optional
// find/replace and exclude transforms. Used by CI callers that need to scan
// every URL on a built site without listing them in --urls. Transparently
// recurses into <sitemapindex> documents (large sites commonly split their
// sitemaps into per-section files). find/replace runs before the recursion
// fetch so the rewritten host is used for child sitemaps too. The exclude
// regex applies only to leaf URLs, never to child-sitemap fetches.
// Requires the global fetch (Node 18+); guards against pathological cycles.
async function loadUrlsFromSitemap(sitemapUrl, { find, replace, exclude } = {}, _seen = new Set()) {
  if (typeof fetch !== 'function') {
    throw new Error('Sitemap loading requires Node.js 18+ (global fetch).');
  }
  if (_seen.has(sitemapUrl)) return [];
  _seen.add(sitemapUrl);
  if (_seen.size > 50) {
    throw new Error(`Sitemap recursion exceeded 50 documents (cycle?). Last: ${sitemapUrl}`);
  }
  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap ${sitemapUrl}: HTTP ${response.status}`);
  }
  const xml = await response.text();
  const isIndex = /<sitemapindex\b/i.test(xml);
  const locMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
  const excludeRegex = exclude ? new RegExp(exclude) : null;
  const urls = [];
  for (const tag of locMatches) {
    let url = tag.replace(/^<loc>/, '').replace(/<\/loc>$/, '').trim();
    if (find && url.includes(find)) {
      url = url.split(find).join(replace || '');
    }
    if (isIndex) {
      const childUrls = await loadUrlsFromSitemap(url, { find, replace, exclude }, _seen);
      for (const c of childUrls) urls.push(c);
      continue;
    }
    if (excludeRegex && excludeRegex.test(url)) continue;
    urls.push(url);
  }
  return urls;
}

// Count axe violation instances across every scanned URL. Used by --fail-on
// errors so the script's exit code carries the gate semantic to CI without
// the caller having to parse the JSON output.
function countViolations(results) {
  let count = 0;
  for (const r of results || []) {
    const axe = r.axe || {};
    if (Array.isArray(axe.violations)) {
      for (const v of axe.violations) {
        count += Array.isArray(v.nodes) ? v.nodes.length : 1;
      }
    } else if (axe.counts && typeof axe.counts.violations === 'number') {
      count += axe.counts.violations;
    }
  }
  return count;
}

function normalizeRoute(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    return pathname.length > 1 ? pathname.replace(/\/$/, '') : '/';
  } catch (_) {
    return String(urlValue || '').trim();
  }
}

function normalizeTarget(target) {
  const parts = Array.isArray(target) ? target.flat(Infinity) : [target];
  return parts
    .map((part) => String(part || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' >> ');
}

function findingFingerprint({ rule, route, target }) {
  return crypto
    .createHash('sha256')
    .update(`${rule}\n${route}\n${target}`)
    .digest('hex');
}

function collectFindings(results) {
  const findings = new Map();
  for (const result of results || []) {
    const route = normalizeRoute(result.url);
    for (const violation of result.axe?.violations || []) {
      const nodes = Array.isArray(violation.nodes) && violation.nodes.length > 0
        ? violation.nodes
        : [{ target: [] }];
      for (const node of nodes) {
        const target = normalizeTarget(node.target);
        const fingerprint = findingFingerprint({ rule: violation.id, route, target });
        if (!findings.has(fingerprint)) {
          findings.set(fingerprint, {
            fingerprint,
            rule: violation.id,
            impact: violation.impact || null,
            route,
            url: result.url,
            target,
          });
        }
      }
    }
  }
  return [...findings.values()].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

function readBaseline(baselinePath) {
  const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  if (parsed.schema_version !== 1 || !Array.isArray(parsed.findings)) {
    throw new Error(`Invalid accessibility baseline: ${baselinePath}`);
  }
  const valid = parsed.findings.every((finding) => {
    const fingerprint = typeof finding === 'string' ? finding : finding?.fingerprint;
    return typeof fingerprint === 'string' && /^[a-f0-9]{64}$/.test(fingerprint);
  });
  if (!valid) throw new Error(`Invalid finding fingerprint in accessibility baseline: ${baselinePath}`);
  return parsed;
}

function compareBaseline(findings, baseline) {
  const current = new Map(findings.map((finding) => [finding.fingerprint, finding]));
  const accepted = new Map(baseline.findings.map((finding) => [
    typeof finding === 'string' ? finding : finding.fingerprint,
    finding,
  ]));
  const newlyIntroduced = findings.filter((finding) => !accepted.has(finding.fingerprint));
  const existing = findings.filter((finding) => accepted.has(finding.fingerprint));
  const resolved = [...accepted.keys()].filter((fingerprint) => !current.has(fingerprint));
  return {
    baseline_count: accepted.size,
    current_count: current.size,
    existing_count: existing.length,
    new_count: newlyIntroduced.length,
    resolved_count: resolved.length,
    new_findings: newlyIntroduced,
    resolved_fingerprints: resolved.sort(),
  };
}

function buildBaseline(findings, axeVersion) {
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    axe_version: axeVersion || null,
    fingerprint_model: 'sha256(rule + normalized route + normalized axe target)',
    findings,
  };
}

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

// The skill's own deps directory, sibling to scripts/
const SKILL_DEPS_DIR = path.resolve(__dirname, '..', 'deps');

function findPackageIn(dir, packageName) {
  const pkgJson = path.join(dir, 'node_modules', packageName, 'package.json');
  if (fs.existsSync(pkgJson)) return path.dirname(pkgJson);
  return null;
}

function findPackage(packageName, projectRoot) {
  // 1. Skill-local deps directory (highest priority — self-contained)
  const skillLocal = findPackageIn(SKILL_DEPS_DIR, packageName);
  if (skillLocal) return { root: skillLocal, source: 'skill-deps' };

  // 2. Target project workspace roots
  const workspaceRoots = [
    projectRoot,
    path.join(projectRoot, 'frontend'),
    path.join(projectRoot, 'app'),
    path.join(projectRoot, 'web'),
    path.join(projectRoot, 'apps', 'web'),
  ];
  for (const root of workspaceRoots) {
    const found = findPackageIn(root, packageName);
    if (found) return { root: found, source: `project (${root})` };
  }

  // 3. Global node_modules
  try {
    const globalDir = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const globalPkg = path.join(globalDir, packageName, 'package.json');
    if (fs.existsSync(globalPkg)) return { root: path.dirname(globalPkg), source: 'global' };
  } catch { /* no global npm */ }

  return null;
}

function readPkgVersion(packageRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

function ensureDependency(packageName, projectRoot, installVersion) {
  if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(packageName)) {
    console.error(`Invalid package name: ${packageName}`);
    process.exit(1);
  }

  const found = findPackage(packageName, projectRoot);
  if (found) return found;

  // Auto-install to skill-local deps directory, pinned when a known-good
  // version is defined ("latest" falls through to the npm dist-tag).
  const installSpec = installVersion && installVersion !== 'latest'
    ? `${packageName}@${installVersion}`
    : packageName;
  console.error(`${packageName} not found — installing ${installSpec} to ${SKILL_DEPS_DIR}...`);
  fs.mkdirSync(SKILL_DEPS_DIR, { recursive: true });

  // Create a minimal package.json if it doesn't exist
  const depsPackageJson = path.join(SKILL_DEPS_DIR, 'package.json');
  if (!fs.existsSync(depsPackageJson)) {
    fs.writeFileSync(depsPackageJson, JSON.stringify({
      name: 'a11y-audit-deps',
      version: '1.0.0',
      private: true,
      description: 'Auto-managed dependencies for a11y-audit skill scripts',
    }, null, 2));
  }

  try {
    const install = spawnSync('npm', ['install', '--prefix', SKILL_DEPS_DIR, installSpec], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    });
    if (install.status !== 0) {
      throw new Error(install.stderr || install.stdout || `npm install exited with ${install.status}`);
    }
  } catch (err) {
    console.error(`Failed to install ${packageName}: ${err.message}`);
    process.exit(1);
  }

  const installed = findPackageIn(SKILL_DEPS_DIR, packageName);
  if (!installed) {
    console.error(`${packageName} installed but not found at expected path`);
    process.exit(1);
  }
  console.error(`${packageName} installed successfully`);
  return { root: installed, source: 'skill-deps (auto-installed)' };
}

// ---------------------------------------------------------------------------
// Puppeteer loader
// ---------------------------------------------------------------------------

async function loadPuppeteer(packageRoot) {
  const entry = path.join(packageRoot, 'lib', 'esm', 'puppeteer', 'puppeteer.js');
  if (fs.existsSync(entry)) {
    return import(pathToFileURL(entry).href);
  }
  // Fallback: try CJS require
  return require(packageRoot);
}

// ---------------------------------------------------------------------------
// Lighthouse (optional)
// ---------------------------------------------------------------------------

function buildLighthouseCommand(url) {
  return [
    'npx', 'lighthouse', url,
    '--output=json', '--output-path=stdout',
    '--only-categories=accessibility',
    '--chrome-flags=--headless --no-sandbox',
    '--quiet',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// axe summary mode
// ---------------------------------------------------------------------------

function summarizeAxe(axe) {
  const tagsOnly = (arr) => (arr || []).map((r) => ({ id: r.id, tags: r.tags }));
  return {
    violations: axe.violations,
    incomplete: axe.incomplete,
    passes: tagsOnly(axe.passes),
    inapplicable: tagsOnly(axe.inapplicable),
    counts: {
      violations: (axe.violations || []).length,
      passes: (axe.passes || []).length,
      incomplete: (axe.incomplete || []).length,
      inapplicable: (axe.inapplicable || []).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(args.root || process.cwd());
  const urls = splitCsv(args.urls);
  const outputPath = path.resolve(args.output || path.join(process.cwd(), 'a11y-scan-results.json'));
  let browserLib;
  try {
    browserLib = validateBrowserLib(args.browser || 'puppeteer');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const runLighthouse = args.lighthouse === 'true';
  const summaryMode = args.summary === true || args.summary === 'true';
  const failOn = typeof args['fail-on'] === 'string' ? args['fail-on'] : null;
  if (failOn && !['errors', 'new', 'none'].includes(failOn)) {
    console.error(`Invalid --fail-on value: ${failOn}. Use errors, new, or none.`);
    process.exit(1);
  }
  if (failOn === 'new' && typeof args.baseline !== 'string') {
    console.error('--fail-on new requires --baseline <path>.');
    process.exit(1);
  }
  let axeInstallVersion = PINNED_VERSIONS['axe-core'];
  if (typeof args['axe-version'] === 'string') {
    try {
      axeInstallVersion = validateAxeVersion(args['axe-version']);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  if (args.sitemap && typeof args.sitemap === 'string') {
    try {
      const sitemapUrls = await loadUrlsFromSitemap(args.sitemap, {
        find: typeof args['sitemap-find'] === 'string' ? args['sitemap-find'] : null,
        replace: typeof args['sitemap-replace'] === 'string' ? args['sitemap-replace'] : null,
        exclude: typeof args['sitemap-exclude'] === 'string' ? args['sitemap-exclude'] : null,
      });
      for (const u of sitemapUrls) urls.push(u);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  if (urls.length === 0) {
    console.error('Usage: scan.js (--urls url1,url2 | --sitemap <url>) [--root <project-dir>] [--output <path>] [--summary] [--lighthouse true] [--axe-version <x.y.z|latest>] [--sitemap-find <s> --sitemap-replace <s>] [--sitemap-exclude <regex>] [--baseline <path> --fail-on new] [--write-baseline <path>] [--fail-on errors|new|none]');
    process.exit(1);
  }

  // Resolve dependencies (skill-local → project → global → auto-install)
  const axeDep = ensureDependency('axe-core', rootDir, axeInstallVersion);
  const browserDep = ensureDependency(browserLib, rootDir);

  const axeVersion = readPkgVersion(axeDep.root);
  const browserVersion = readPkgVersion(browserDep.root);
  console.error(`axe-core: ${axeDep.source}${axeVersion ? ` (v${axeVersion})` : ''}`);
  console.error(`${browserLib}: ${browserDep.source}${browserVersion ? ` (v${browserVersion})` : ''}`);

  const axeSourcePath = path.join(axeDep.root, 'axe.min.js');
  const axeSource = fs.readFileSync(axeSourcePath, 'utf8');

  const browserModule = await loadPuppeteer(browserDep.root);

  const browser = await browserModule.default.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  const results = [];
  for (const url of urls) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(axeSource);
    const axe = await page.evaluate(async () => {
      return axe.run(document, {
        resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
      });
    });
    results.push({
      url,
      axe: summaryMode ? summarizeAxe(axe) : axe,
      lighthouse: runLighthouse
        ? { status: 'not-run-by-script', command: buildLighthouseCommand(url) }
        : { status: 'skipped', reason: 'Lighthouse disabled for this run' },
    });
    await page.close();
  }

  await browser.close();
  const findings = collectFindings(results);
  let baselineComparison = null;
  if (typeof args.baseline === 'string') {
    try {
      const baselinePath = path.resolve(args.baseline);
      const baseline = readBaseline(baselinePath);
      const versionMismatch = Boolean(
        baseline.axe_version && axeVersion && baseline.axe_version !== axeVersion
      );
      if (versionMismatch && args['allow-axe-version-mismatch'] !== true) {
        throw new Error(
          `Baseline axe-core version mismatch (${baseline.axe_version} -> ${axeVersion}). ` +
          'Refresh the baseline deliberately or pass --allow-axe-version-mismatch.'
        );
      }
      baselineComparison = {
        path: baselinePath,
        baseline_axe_version: baseline.axe_version || null,
        current_axe_version: axeVersion || null,
        axe_version_mismatch: versionMismatch,
        ...compareBaseline(findings, baseline),
      };
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    root_dir: rootDir,
    browser: browserLib,
    browser_version: browserVersion,
    axe_version: axeVersion,
    axe_source: axeSourcePath,
    dependency_sources: {
      'axe-core': axeDep.source,
      [browserLib]: browserDep.source,
    },
    urls,
    results,
    findings,
    baseline: baselineComparison,
  };
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  if (typeof args['write-baseline'] === 'string') {
    const baselineOutput = path.resolve(args['write-baseline']);
    fs.mkdirSync(path.dirname(baselineOutput), { recursive: true });
    fs.writeFileSync(baselineOutput, JSON.stringify(buildBaseline(findings, axeVersion), null, 2));
    console.error(`a11y baseline: wrote ${findings.length} accepted finding(s) to ${baselineOutput}`);
  }

  console.log(outputPath);

  if (failOn === 'errors') {
    const total = countViolations(results);
    if (total > 0) {
      console.error(`a11y scan: ${total} axe violation instance(s) across ${urls.length} URL(s) — see ${outputPath}`);
      process.exit(2);
    }
    console.error(`a11y scan: 0 violations across ${urls.length} URL(s).`);
  } else if (failOn === 'new') {
    if (baselineComparison.new_count > 0) {
      console.error(
        `a11y scan: ${baselineComparison.new_count} new finding(s); ` +
        `${baselineComparison.existing_count} accepted; ${baselineComparison.resolved_count} resolved — see ${outputPath}`
      );
      process.exit(2);
    }
    console.error(
      `a11y scan: 0 new findings; ${baselineComparison.existing_count} accepted; ` +
      `${baselineComparison.resolved_count} resolved.`
    );
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.stack || String(error));
    process.exit(1);
  });
}

module.exports = {
  splitCsv,
  validateBrowserLib,
  validateAxeVersion,
  loadUrlsFromSitemap,
  countViolations,
  normalizeRoute,
  normalizeTarget,
  findingFingerprint,
  collectFindings,
  compareBaseline,
  buildBaseline,
};
