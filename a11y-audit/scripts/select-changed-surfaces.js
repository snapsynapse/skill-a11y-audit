#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 3
version_date: 2026-08-09
previous_version: 2
change_summary: >
  Distinguishes ambiguous canonical direct routes from unresolved routes while
  retaining the conservative full-sample fallback for both conditions.
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHANGED_SURFACE_SCHEMA_VERSION = 2;
const SUPPORTED_SURFACE_MAP_SCHEMAS = new Set([1, 2]);
const MAX_GIT_OUTPUT_BYTES = 4 * 1024 * 1024;

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeRepositoryPath(value, label = 'repository path') {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (/[\0\r\n]/.test(value)) {
    throw new Error(`${label} contains a control character`);
  }

  const slashed = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!slashed || slashed.startsWith('/') || /^[A-Za-z]:\//.test(slashed)) {
    throw new Error(`${label} must be repository-relative`);
  }

  const segments = slashed.split('/').filter((segment) => segment && segment !== '.');
  if (segments.includes('..')) {
    throw new Error(`${label} must not traverse outside the repository`);
  }
  if (segments.length === 0) {
    throw new Error(`${label} must identify a repository path`);
  }
  return segments.join('/');
}

function validateDiscoveryPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('Discovery plan must be a JSON object');
  }
  if (!Array.isArray(plan.scanList) || plan.scanList.length === 0) {
    throw new Error('Discovery plan must contain a non-empty scanList');
  }
  if (!Array.isArray(plan.groups) || plan.groups.length === 0) {
    throw new Error('Discovery plan must contain template groups');
  }

  const scanUrls = new Set();
  for (const url of plan.scanList) {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error('Discovery scanList entries must be HTTP(S) URLs');
    }
    scanUrls.add(url);
  }

  const patterns = new Set();
  for (const group of plan.groups) {
    if (!group || typeof group.pattern !== 'string' || group.pattern.length === 0) {
      throw new Error('Every discovery group must have a non-empty pattern');
    }
    if (patterns.has(group.pattern)) {
      throw new Error(`Duplicate discovery group pattern: ${group.pattern}`);
    }
    patterns.add(group.pattern);
    if (!Array.isArray(group.selected) || group.selected.length === 0) {
      throw new Error(`Discovery group ${group.pattern} must contain selected URLs`);
    }
    for (const url of group.selected) {
      if (!scanUrls.has(url)) {
        throw new Error(`Discovery group ${group.pattern} selects a URL outside scanList`);
      }
    }
    if (group.urls !== undefined) {
      if (!Array.isArray(group.urls) || group.urls.length === 0) {
        throw new Error(`Discovery group ${group.pattern} has an invalid urls list`);
      }
      for (const url of group.urls) {
        if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
          throw new Error(`Discovery group ${group.pattern} contains an invalid URL`);
        }
      }
    }
  }

  if (plan.discoveredUrls !== undefined) {
    if (!Array.isArray(plan.discoveredUrls) || plan.discoveredUrls.length === 0) {
      throw new Error('Discovery plan discoveredUrls must be a non-empty array');
    }
    for (const url of plan.discoveredUrls) {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        throw new Error('Discovery discoveredUrls entries must be HTTP(S) URLs');
      }
    }
  }

  return plan;
}

function validateSurfaceMap(surfaceMap) {
  if (!surfaceMap || typeof surfaceMap !== 'object' || Array.isArray(surfaceMap)) {
    throw new Error('Surface map must be a JSON object');
  }
  if (!SUPPORTED_SURFACE_MAP_SCHEMAS.has(surfaceMap.schema_version)) {
    throw new Error('Surface map schema_version must be 1 or 2');
  }
  if (!Array.isArray(surfaceMap.rules) || surfaceMap.rules.length === 0) {
    throw new Error('Surface map must contain at least one rule');
  }

  const names = new Set();
  const rules = surfaceMap.rules.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      throw new Error(`Surface map rule ${index + 1} must be an object`);
    }
    if (typeof rule.name !== 'string' || rule.name.trim().length === 0) {
      throw new Error(`Surface map rule ${index + 1} must have a name`);
    }
    const name = rule.name.trim();
    if (names.has(name)) throw new Error(`Duplicate surface map rule name: ${name}`);
    names.add(name);

    if (!Array.isArray(rule.source_prefixes) || rule.source_prefixes.length === 0) {
      throw new Error(`Surface map rule ${name} must contain source_prefixes`);
    }
    if (!Array.isArray(rule.groups) || rule.groups.length === 0) {
      throw new Error(`Surface map rule ${name} must contain groups`);
    }

    const sourcePrefixes = [...new Set(rule.source_prefixes.map((prefix) => (
      normalizeRepositoryPath(prefix, `source prefix in rule ${name}`)
    )))].sort();
    const groups = [...new Set(rule.groups.map((group) => {
      if (typeof group !== 'string' || group.length === 0 || /[\0\r\n]/.test(group)) {
        throw new Error(`Surface map rule ${name} contains an invalid group`);
      }
      return group;
    }))].sort();

    let directRoute = null;
    if (rule.direct_route !== undefined) {
      if (surfaceMap.schema_version !== 2) {
        throw new Error(`Surface map rule ${name} requires schema_version 2 for direct_route`);
      }
      const direct = rule.direct_route;
      if (!direct || typeof direct !== 'object' || Array.isArray(direct)) {
        throw new Error(`Surface map rule ${name} direct_route must be an object`);
      }
      const sourcePrefix = normalizeRepositoryPath(
        direct.source_prefix,
        `direct_route source_prefix in rule ${name}`
      );
      if (!sourcePrefixes.includes(sourcePrefix)) {
        throw new Error(`Surface map rule ${name} direct_route source_prefix must also appear in source_prefixes`);
      }
      if (typeof direct.source_suffix !== 'string'
        || !/^\.[A-Za-z0-9][A-Za-z0-9._-]*$/.test(direct.source_suffix)) {
        throw new Error(`Surface map rule ${name} direct_route source_suffix is invalid`);
      }
      if (typeof direct.route_prefix !== 'string'
        || !direct.route_prefix.startsWith('/')
        || /[\\?#*\0\r\n]/.test(direct.route_prefix)
        || direct.route_prefix.split('/').includes('..')) {
        throw new Error(`Surface map rule ${name} direct_route route_prefix must be a safe same-origin path`);
      }
      const routePrefix = direct.route_prefix.replace(/\/+$/, '') || '/';
      directRoute = {
        sourcePrefix,
        sourceSuffix: direct.source_suffix,
        routePrefix,
      };
    }

    return { name, sourcePrefixes, groups, directRoute };
  });

  return { schemaVersion: surfaceMap.schema_version, rules };
}

function sourcePrefixMatches(file, prefix) {
  return file === prefix || file.startsWith(`${prefix}/`);
}

function normalizeChangedFiles(changedFiles) {
  if (!Array.isArray(changedFiles)) {
    throw new Error('Changed-files input must be a JSON array');
  }
  return [...new Set(changedFiles.map((file) => normalizeRepositoryPath(file, 'changed file')))].sort();
}

function repositoryRelativeInputPath(value, cwd = process.cwd()) {
  const relative = path.relative(cwd, path.resolve(cwd, value)).replace(/\\/g, '/');
  return normalizeRepositoryPath(relative, 'input path');
}

function surfaceMapWasChanged(changedFiles, mapPath, cwd = process.cwd()) {
  if (typeof mapPath !== 'string') return false;
  try {
    const normalizedFiles = normalizeChangedFiles(changedFiles);
    return normalizedFiles.includes(repositoryRelativeInputPath(mapPath, cwd));
  } catch {
    return false;
  }
}

function inputPathWasChanged(changedFiles, inputPath, cwd = process.cwd()) {
  if (typeof inputPath !== 'string') return false;
  try {
    const normalizedFiles = normalizeChangedFiles(changedFiles);
    return normalizedFiles.includes(repositoryRelativeInputPath(inputPath, cwd));
  } catch {
    return false;
  }
}

function canonicalRouteKey(urlStr) {
  const url = new URL(urlStr);
  if (!/^https?:$/.test(url.protocol)) throw new Error('Direct routes must use HTTP(S)');
  let pathname = url.pathname.replace(/\/index\.html$/, '/');
  pathname = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  return `${url.origin}${pathname}`;
}

function discoveredUrlsForPlan(plan) {
  const candidates = Array.isArray(plan.discoveredUrls)
    ? plan.discoveredUrls
    : plan.groups.flatMap((group) => Array.isArray(group.urls) ? group.urls : group.selected);
  return [...new Set(candidates)].sort();
}

function deriveDirectRoute(file, directRoute, plan) {
  if (!directRoute || !sourcePrefixMatches(file, directRoute.sourcePrefix)) {
    return { applicable: false };
  }
  if (!file.endsWith(directRoute.sourceSuffix)) {
    return { applicable: true, error: 'source-suffix-mismatch' };
  }
  const relative = file.slice(directRoute.sourcePrefix.length).replace(/^\//, '');
  const stem = relative.slice(0, -directRoute.sourceSuffix.length);
  if (!stem) return { applicable: true, error: 'empty-route' };
  const segments = stem.split('/');
  if (segments[segments.length - 1] === 'index') segments.pop();
  const prefixSegments = directRoute.routePrefix === '/'
    ? []
    : directRoute.routePrefix.slice(1).split('/');
  const pathname = `/${[...prefixSegments, ...segments].map(encodeURIComponent).join('/')}` || '/';
  const runtimeUrl = new URL(plan.runtimeUrl || plan.scanList[0]);
  const expected = new URL(pathname || '/', runtimeUrl.origin).href;
  const expectedKey = canonicalRouteKey(expected);
  const matches = discoveredUrlsForPlan(plan).filter((url) => canonicalRouteKey(url) === expectedKey);
  if (matches.length === 0) return { applicable: true, error: 'route-not-discovered', expected };
  if (matches.length > 1) {
    return { applicable: true, error: 'ambiguous-discovered-route', expected, routes: matches };
  }
  return { applicable: true, url: matches[0] };
}

function fullSample(plan, reason, details = {}) {
  const scanList = [...plan.scanList];
  return {
    ...plan,
    scanList,
    selectedPages: scanList.length,
    changedSurface: {
      schemaVersion: CHANGED_SURFACE_SCHEMA_VERSION,
      mode: 'full-fallback',
      reason,
      changedFiles: details.changedFiles || [],
      matchedRules: details.matchedRules || [],
      affectedGroups: details.affectedGroups || [],
      unmatchedFiles: details.unmatchedFiles || [],
      directUrls: details.directUrls || [],
      unresolvedDirectFiles: details.unresolvedDirectFiles || [],
      ambiguousDirectFiles: details.ambiguousDirectFiles || [],
      fullSamplePages: plan.scanList.length,
      selectedPages: scanList.length,
    },
  };
}

function selectChangedSurfaces(planInput, mapInput, changedFilesInput) {
  const plan = validateDiscoveryPlan(planInput);
  const surfaceMap = validateSurfaceMap(mapInput);
  const changedFiles = normalizeChangedFiles(changedFilesInput);
  if (changedFiles.length === 0) {
    return fullSample(plan, 'no-changed-files');
  }

  const matchedRules = new Set();
  const affectedGroups = new Set();
  const unmatchedFiles = [];
  const directUrls = new Set();
  const unresolvedDirectFiles = [];
  const ambiguousDirectFiles = [];

  for (const file of changedFiles) {
    const matches = surfaceMap.rules.filter((rule) => (
      rule.sourcePrefixes.some((prefix) => sourcePrefixMatches(file, prefix))
    ));
    if (matches.length === 0) {
      unmatchedFiles.push(file);
      continue;
    }
    for (const rule of matches) {
      matchedRules.add(rule.name);
      for (const group of rule.groups) affectedGroups.add(group);
    }
    const derived = matches
      .map((rule) => deriveDirectRoute(file, rule.directRoute, plan))
      .filter((route) => route.applicable);
    const ambiguous = derived.filter((route) => route.error === 'ambiguous-discovered-route');
    const ambiguousRoutes = [...new Set(ambiguous.flatMap((route) => route.routes || []))].sort();
    const errors = derived.filter((route) => route.error && route.error !== 'ambiguous-discovered-route');
    if (errors.length > 0) {
      unresolvedDirectFiles.push({ file, reasons: [...new Set(errors.map((route) => route.error))].sort() });
    }
    const routes = [...new Set(derived.filter((route) => route.url).map((route) => route.url))].sort();
    if (ambiguousRoutes.length > 0 || routes.length > 1) {
      ambiguousDirectFiles.push({
        file,
        routes: [...new Set([...ambiguousRoutes, ...routes])].sort(),
      });
    } else if (routes.length === 1) directUrls.add(routes[0]);
  }

  const details = {
    changedFiles,
    matchedRules: [...matchedRules].sort(),
    affectedGroups: [...affectedGroups].sort(),
    unmatchedFiles,
    directUrls: [...directUrls].sort(),
    unresolvedDirectFiles,
    ambiguousDirectFiles,
  };
  if (unmatchedFiles.length > 0) return fullSample(plan, 'unmapped-changes', details);
  if (ambiguousDirectFiles.length > 0) return fullSample(plan, 'direct-route-ambiguous', details);
  if (unresolvedDirectFiles.length > 0) return fullSample(plan, 'direct-route-unresolved', details);
  if (affectedGroups.has('*')) return fullSample(plan, 'global-surface-rule', details);

  const knownGroups = new Map(plan.groups.map((group) => [group.pattern, group]));
  const unknownGroups = [...affectedGroups].filter((pattern) => !knownGroups.has(pattern)).sort();
  if (unknownGroups.length > 0) {
    return fullSample(plan, 'unknown-template-groups', {
      ...details,
      affectedGroups: [...affectedGroups].sort(),
    });
  }

  const selectedUrls = new Set();
  for (const pattern of affectedGroups) {
    for (const url of knownGroups.get(pattern).selected) selectedUrls.add(url);
  }
  for (const url of directUrls) selectedUrls.add(url);
  const scanList = [
    ...plan.scanList.filter((url) => selectedUrls.has(url)),
    ...[...directUrls].sort().filter((url) => !plan.scanList.includes(url)),
  ];
  if (scanList.length === 0) return fullSample(plan, 'empty-targeted-sample', details);

  const targetedGroups = [...affectedGroups].sort();
  return {
    ...plan,
    scanList,
    selectedPages: scanList.length,
    coverageRatio: `${targetedGroups.length} affected template groups, ${scanList.length} pages selected from ${plan.groups.length} discovered groups`,
    changedSurface: {
      schemaVersion: CHANGED_SURFACE_SCHEMA_VERSION,
      mode: 'targeted',
      reason: 'mapped-changes',
      changedFiles,
      matchedRules: [...matchedRules].sort(),
      affectedGroups: targetedGroups,
      unmatchedFiles: [],
      directUrls: [...directUrls].sort(),
      unresolvedDirectFiles: [],
      ambiguousDirectFiles: [],
      fullSamplePages: plan.scanList.length,
      selectedPages: scanList.length,
    },
  };
}

function validCommit(value, allowHead = false) {
  if (allowHead && value === 'HEAD') return true;
  return typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}

function gitChangedFiles(base, head = 'HEAD', cwd = process.cwd()) {
  if (!validCommit(base)) return { error: 'invalid-base-commit' };
  if (!validCommit(head, true)) return { error: 'invalid-head-commit' };

  const run = spawnSync('git', ['diff', '--name-only', '-z', base, head, '--'], {
    cwd,
    encoding: null,
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
  });
  if (run.error || run.status !== 0 || !Buffer.isBuffer(run.stdout)) {
    return { error: 'git-diff-unavailable' };
  }
  return {
    files: run.stdout.toString('utf8').split('\0').filter(Boolean),
    source: 'git-diff',
  };
}

function resolveChangedFiles(args) {
  if (typeof args['changed-files'] === 'string') {
    try {
      return { files: readJson(path.resolve(args['changed-files'])), source: 'changed-files-json' };
    } catch {
      return { error: 'changed-files-unavailable' };
    }
  }
  if (typeof args.base === 'string') {
    return gitChangedFiles(args.base, typeof args.head === 'string' ? args.head : 'HEAD');
  }
  return { error: 'changed-files-unavailable' };
}

function buildSelection(plan, args) {
  let surfaceMap;
  try {
    if (typeof args.map !== 'string') return fullSample(plan, 'surface-map-unavailable');
    surfaceMap = readJson(path.resolve(args.map));
    validateSurfaceMap(surfaceMap);
  } catch {
    return fullSample(plan, 'surface-map-invalid');
  }

  const changed = resolveChangedFiles(args);
  if (changed.error) return fullSample(plan, changed.error);
  try {
    const changedFiles = normalizeChangedFiles(changed.files);
    if (surfaceMapWasChanged(changedFiles, args.map)) {
      return fullSample(plan, 'surface-map-changed', { changedFiles });
    }
    if (inputPathWasChanged(changedFiles, args['group-map'])) {
      return fullSample(plan, 'route-group-map-changed', { changedFiles });
    }
    return selectChangedSurfaces(plan, surfaceMap, changedFiles);
  } catch {
    return fullSample(plan, 'changed-files-invalid');
  }
}

function writeResult(result, output) {
  const json = JSON.stringify(result, null, 2);
  if (!output) {
    console.log(json);
    return;
  }
  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${json}\n`);
  console.log(outputPath);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.discover !== 'string') {
    console.error('Usage: select-changed-surfaces.js --discover <plan.json> --map <surface-map.json> [--group-map <route-group-map.json>] (--changed-files <files.json> | --base <sha> [--head <sha|HEAD>]) [--output <path>]');
    process.exit(1);
  }

  let plan;
  try {
    plan = validateDiscoveryPlan(readJson(path.resolve(args.discover)));
  } catch (error) {
    console.error(`Invalid discovery plan: ${error.message}`);
    process.exit(1);
  }

  const result = buildSelection(plan, args);
  writeResult(result, args.output);
  const selection = result.changedSurface;
  console.error(`Changed-surface selection: ${selection.mode} (${selection.reason})`);
  console.error(`Selected ${selection.selectedPages} of ${selection.fullSamplePages} representative pages`);
}

module.exports = {
  buildSelection,
  fullSample,
  gitChangedFiles,
  canonicalRouteKey,
  deriveDirectRoute,
  inputPathWasChanged,
  normalizeChangedFiles,
  normalizeRepositoryPath,
  repositoryRelativeInputPath,
  selectChangedSurfaces,
  sourcePrefixMatches,
  surfaceMapWasChanged,
  validCommit,
  validateDiscoveryPlan,
  validateSurfaceMap,
};

if (require.main === module) main();
