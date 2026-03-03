#!/usr/bin/env node
/* 
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-03-03
previous_version: null
change_summary: Added a reusable axe-based scanner with optional Lighthouse probing.
*/

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

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

function resolveFromRoots(roots, relativePath) {
  for (const root of roots) {
    const candidate = path.resolve(root, relativePath);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findPackageRoot(rootDir, packageName) {
  const roots = [
    rootDir,
    path.join(rootDir, 'frontend'),
    path.join(rootDir, 'app'),
    path.join(rootDir, 'web'),
    path.join(rootDir, 'apps', 'web'),
  ];
  for (const root of roots) {
    const pkgJson = path.join(root, 'node_modules', packageName, 'package.json');
    if (fs.existsSync(pkgJson)) return path.dirname(pkgJson);
  }
  return null;
}

async function loadPuppeteer(packageRoot) {
  const entry = path.join(packageRoot, 'lib', 'esm', 'puppeteer', 'puppeteer.js');
  return import(pathToFileURL(entry).href);
}

function buildLighthouseCommand(url) {
  return [
    'npx',
    'lighthouse',
    url,
    '--output=json',
    '--output-path=stdout',
    '--only-categories=accessibility',
    '--chrome-flags=--headless --no-sandbox',
    '--quiet',
  ].join(' ');
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(args.root || process.cwd());
  const urls = splitCsv(args.urls);
  const outputPath = path.resolve(args.output || path.join(process.cwd(), 'a11y-scan-results.json'));
  const browserLib = args.browser || 'puppeteer';
  const runLighthouse = args.lighthouse === 'true';

  if (urls.length === 0) {
    console.error('Missing --urls url1,url2');
    process.exit(1);
  }

  const axeRoot = findPackageRoot(rootDir, 'axe-core');
  if (!axeRoot) {
    console.error('axe-core not found in workspace dependency roots');
    process.exit(1);
  }

  const browserRoot = findPackageRoot(rootDir, browserLib);
  if (!browserRoot) {
    console.error(`${browserLib} not found in workspace dependency roots`);
    process.exit(1);
  }

  const axeSourcePath = resolveFromRoots([axeRoot], 'axe.min.js');
  const axeSource = fs.readFileSync(axeSourcePath, 'utf8');

  let browserModule;
  if (browserLib === 'puppeteer') {
    browserModule = await loadPuppeteer(browserRoot);
  } else {
    console.error('Only puppeteer is supported by this bundled script version');
    process.exit(1);
  }

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
      axe,
      lighthouse: runLighthouse
        ? {
            status: 'not-run-by-script',
            command: buildLighthouseCommand(url),
          }
        : {
            status: 'skipped',
            reason: 'Lighthouse disabled for this run',
          },
    });
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(outputPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    root_dir: rootDir,
    browser: browserLib,
    axe_source: axeSourcePath,
    urls,
    results,
  }, null, 2));

  console.log(outputPath);
}

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
