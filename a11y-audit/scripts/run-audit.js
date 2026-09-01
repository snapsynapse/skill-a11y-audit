#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-08-31
previous_version: 0
change_summary: >
  Adds a vendor-neutral JSON process adapter that composes discovery,
  changed-surface selection, scanning, and report generation.
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCHEMA_VERSION = 1;
const SCRIPT_DIR = __dirname;
const MAX_CHILD_OUTPUT_BYTES = 16 * 1024 * 1024;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label) {
  if (!isObject(value)) throw new Error(`${label} must be a JSON object`);
  return value;
}

function assertKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported key: ${key}`);
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`);
  return value;
}

function resolveWithin(root, value, label) {
  const resolved = path.resolve(root, assertString(value, label));
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay within the workspace`);
  }
  return resolved;
}

function relativeToWorkspace(workspace, value) {
  const relative = path.relative(workspace, value).split(path.sep).join('/');
  return relative || '.';
}

function validateHttpUrl(value, label) {
  const parsed = new URL(assertString(value, label));
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  return parsed.href;
}

function addValue(args, flag, value) {
  if (value !== undefined && value !== null && value !== '') args.push(flag, String(value));
}

function addBoolean(args, flag, value) {
  if (value === true) args.push(flag);
}

function stage(name, script, args) {
  return {
    name,
    script: path.join(SCRIPT_DIR, script),
    args,
  };
}

function serializeStage(entry, workspace) {
  const command = ['node', `scripts/${path.basename(entry.script)}`];
  for (const value of entry.args) {
    if (path.isAbsolute(value)) command.push(relativeToWorkspace(workspace, value));
    else command.push(value);
  }
  return { name: entry.name, command };
}

function buildRunPlan(configPath, cliArgs = {}) {
  const absoluteConfig = path.resolve(configPath);
  const config = assertObject(JSON.parse(fs.readFileSync(absoluteConfig, 'utf8')), 'config');
  assertKeys(config, new Set([
    'schema_version', 'workspace', 'artifacts_dir', 'discovery', 'selection', 'scan', 'report',
  ]), 'config');
  if (config.schema_version !== SCHEMA_VERSION) {
    throw new Error(`config schema_version must be ${SCHEMA_VERSION}`);
  }

  const configDir = path.dirname(absoluteConfig);
  const workspace = path.resolve(configDir, config.workspace || '.');
  const artifactsDir = resolveWithin(
    workspace,
    config.artifacts_dir || '.a11y-audit/run',
    'artifacts_dir'
  );
  const outputPath = resolveWithin(
    workspace,
    cliArgs.output || path.join(relativeToWorkspace(workspace, artifactsDir), 'run.json'),
    'output'
  );

  const discovery = assertObject(config.discovery, 'discovery');
  assertKeys(discovery, new Set([
    'url', 'group_map', 'max_per_group', 'no_sitemap', 'no_fingerprint',
    'allow_cross_origin_sitemaps',
  ]), 'discovery');
  const discoveryUrl = validateHttpUrl(discovery.url, 'discovery.url');
  if (discovery.max_per_group !== undefined
    && (!Number.isInteger(discovery.max_per_group) || discovery.max_per_group < 1)) {
    throw new Error('discovery.max_per_group must be a positive integer');
  }
  for (const key of ['no_sitemap', 'no_fingerprint', 'allow_cross_origin_sitemaps']) {
    if (discovery[key] !== undefined) assertBoolean(discovery[key], `discovery.${key}`);
  }

  const artifacts = {
    discovery: path.join(artifactsDir, 'discovery.json'),
    selection: path.join(artifactsDir, 'selection.json'),
    scan: path.join(artifactsDir, 'scan.json'),
    report_dir: path.join(artifactsDir, 'report'),
    run: outputPath,
  };
  const stages = [];
  const discoverArgs = ['--url', discoveryUrl, '--output', artifacts.discovery];
  if (discovery.group_map) {
    addValue(discoverArgs, '--group-map', resolveWithin(workspace, discovery.group_map, 'discovery.group_map'));
  }
  addValue(discoverArgs, '--max-per-group', discovery.max_per_group);
  addBoolean(discoverArgs, '--no-sitemap', discovery.no_sitemap);
  addBoolean(discoverArgs, '--no-fingerprint', discovery.no_fingerprint);
  addBoolean(
    discoverArgs,
    '--allow-cross-origin-sitemaps',
    discovery.allow_cross_origin_sitemaps
  );
  stages.push(stage('discover', 'discover.js', discoverArgs));

  let scanPlan = artifacts.discovery;
  if (config.selection !== undefined) {
    const selection = assertObject(config.selection, 'selection');
    assertKeys(selection, new Set([
      'surface_map', 'route_group_map', 'changed_files', 'base', 'head',
    ]), 'selection');
    const surfaceMap = resolveWithin(workspace, selection.surface_map, 'selection.surface_map');
    const cliChangedFiles = cliArgs['changed-files'];
    const cliGitComparison = cliArgs.base || cliArgs.head;
    if (cliChangedFiles && cliGitComparison) {
      throw new Error('selection overrides must use changed-files or base/head, not both');
    }
    const changedFiles = cliChangedFiles
      || (cliGitComparison ? undefined : selection.changed_files);
    const base = cliGitComparison
      ? cliArgs.base
      : (cliChangedFiles ? undefined : selection.base);
    const head = cliGitComparison
      ? (cliArgs.head || selection.head || 'HEAD')
      : (selection.head || 'HEAD');
    if (changedFiles && base) {
      throw new Error('selection must use changed_files or base/head, not both');
    }
    if (!changedFiles && !base) {
      throw new Error('selection requires changed_files or base/head');
    }
    const selectArgs = [
      '--discover', artifacts.discovery,
      '--map', surfaceMap,
      '--output', artifacts.selection,
    ];
    if (selection.route_group_map) {
      addValue(
        selectArgs,
        '--group-map',
        resolveWithin(workspace, selection.route_group_map, 'selection.route_group_map')
      );
    }
    if (changedFiles) {
      addValue(
        selectArgs,
        '--changed-files',
        resolveWithin(workspace, changedFiles, 'selection.changed_files')
      );
    } else {
      addValue(selectArgs, '--base', assertString(base, 'selection.base'));
      addValue(selectArgs, '--head', assertString(head, 'selection.head'));
    }
    stages.push(stage('select', 'select-changed-surfaces.js', selectArgs));
    scanPlan = artifacts.selection;
  } else if (cliArgs['changed-files'] || cliArgs.base || cliArgs.head) {
    throw new Error('change overrides require a selection object');
  }

  const scan = config.scan === undefined ? {} : assertObject(config.scan, 'scan');
  assertKeys(scan, new Set(['root', 'baseline', 'fail_on', 'summary', 'axe_version']), 'scan');
  const failOn = scan.fail_on || 'none';
  if (!['errors', 'new', 'none'].includes(failOn)) {
    throw new Error('scan.fail_on must be errors, new, or none');
  }
  if (scan.summary !== undefined) assertBoolean(scan.summary, 'scan.summary');
  if (failOn === 'new' && !scan.baseline) {
    throw new Error('scan.baseline is required when scan.fail_on is new');
  }
  const scanArgs = [
    '--discover', scanPlan,
    '--root', resolveWithin(workspace, scan.root || '.', 'scan.root'),
    '--fail-on', failOn,
    '--output', artifacts.scan,
  ];
  if (scan.baseline) {
    addValue(scanArgs, '--baseline', resolveWithin(workspace, scan.baseline, 'scan.baseline'));
  }
  addValue(scanArgs, '--axe-version', scan.axe_version);
  if (scan.summary !== false) scanArgs.push('--summary');
  stages.push(stage('scan', 'scan.js', scanArgs));

  const report = config.report === undefined ? {} : assertObject(config.report, 'report');
  assertKeys(report, new Set([
    'enabled', 'project_name', 'standard', 'expected_url', 'runtime_url', 'previous',
  ]), 'report');
  if (report.enabled !== undefined) assertBoolean(report.enabled, 'report.enabled');
  if (report.enabled !== false) {
    const reportArgs = [
      '--input', artifacts.scan,
      '--discover', scanPlan,
      '--output-dir', artifacts.report_dir,
    ];
    addValue(reportArgs, '--project-name', report.project_name);
    addValue(reportArgs, '--standard', report.standard);
    addValue(reportArgs, '--expected-url', report.expected_url);
    addValue(reportArgs, '--runtime-url', report.runtime_url || discoveryUrl);
    if (report.previous) {
      addValue(reportArgs, '--previous', resolveWithin(workspace, report.previous, 'report.previous'));
    }
    stages.push(stage('report', 'report.js', reportArgs));
  }

  return {
    workspace,
    artifactsDir,
    artifacts,
    stages,
    envelope: {
      schema_version: SCHEMA_VERSION,
      status: 'planned',
      artifacts: Object.fromEntries(
        Object.entries(artifacts).map(([key, value]) => [key, relativeToWorkspace(workspace, value)])
      ),
      stages: stages.map((entry) => serializeStage(entry, workspace)),
    },
  };
}

function writeEnvelope(runPlan, envelope) {
  fs.mkdirSync(path.dirname(runPlan.artifacts.run), { recursive: true });
  fs.writeFileSync(runPlan.artifacts.run, `${JSON.stringify(envelope, null, 2)}\n`);
}

function runPlan(runPlan) {
  fs.mkdirSync(runPlan.artifactsDir, { recursive: true });
  const envelope = {
    ...runPlan.envelope,
    status: 'running',
    stages: [],
  };
  writeEnvelope(runPlan, envelope);

  for (const entry of runPlan.stages) {
    const result = spawnSync(process.execPath, [entry.script, ...entry.args], {
      cwd: runPlan.workspace,
      encoding: 'utf8',
      maxBuffer: MAX_CHILD_OUTPUT_BYTES,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const exitCode = result.error ? 1 : (result.status ?? 1);
    envelope.stages.push({
      ...serializeStage(entry, runPlan.workspace),
      exit_code: exitCode,
    });
    if (exitCode !== 0) {
      envelope.status = 'failed';
      envelope.failed_stage = entry.name;
      writeEnvelope(runPlan, envelope);
      return exitCode;
    }
    writeEnvelope(runPlan, envelope);
  }

  envelope.status = 'passed';
  if (fs.existsSync(runPlan.artifacts.report_dir)) {
    envelope.report_files = fs.readdirSync(runPlan.artifacts.report_dir)
      .sort()
      .map((name) => relativeToWorkspace(
        runPlan.workspace,
        path.join(runPlan.artifacts.report_dir, name)
      ));
  }
  writeEnvelope(runPlan, envelope);
  console.log(runPlan.artifacts.run);
  return 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.config !== 'string') {
    console.error('Usage: run-audit.js --config <request.json> [--changed-files <files.json> | --base <sha> --head <sha|HEAD>] [--output <run.json>] [--dry-run]');
    process.exit(1);
  }
  try {
    const plan = buildRunPlan(args.config, args);
    if (args['dry-run']) {
      console.log(JSON.stringify(plan.envelope, null, 2));
      return;
    }
    process.exitCode = runPlan(plan);
  } catch (error) {
    console.error(`Invalid audit request: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildRunPlan,
  parseArgs,
  runPlan,
};

if (require.main === module) main();
