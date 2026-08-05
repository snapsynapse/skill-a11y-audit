#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-08-04
previous_version: null
change_summary: >
  Selects representative discovery groups from repository changes using an
  explicit source-prefix map, with a documented full-sample fallback whenever
  ownership cannot be established safely.
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHANGED_SURFACE_SCHEMA_VERSION = 1;
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
  }

  return plan;
}

function validateSurfaceMap(surfaceMap) {
  if (!surfaceMap || typeof surfaceMap !== 'object' || Array.isArray(surfaceMap)) {
    throw new Error('Surface map must be a JSON object');
  }
  if (surfaceMap.schema_version !== CHANGED_SURFACE_SCHEMA_VERSION) {
    throw new Error(`Surface map schema_version must be ${CHANGED_SURFACE_SCHEMA_VERSION}`);
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

    return { name, sourcePrefixes, groups };
  });

  return { schemaVersion: CHANGED_SURFACE_SCHEMA_VERSION, rules };
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
  }

  const details = {
    changedFiles,
    matchedRules: [...matchedRules].sort(),
    affectedGroups: [...affectedGroups].sort(),
    unmatchedFiles,
  };
  if (unmatchedFiles.length > 0) return fullSample(plan, 'unmapped-changes', details);
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
  const scanList = plan.scanList.filter((url) => selectedUrls.has(url));
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
    console.error('Usage: select-changed-surfaces.js --discover <plan.json> --map <surface-map.json> (--changed-files <files.json> | --base <sha> [--head <sha|HEAD>]) [--output <path>]');
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
