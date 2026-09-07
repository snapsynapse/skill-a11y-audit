#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 3
version_date: 2026-09-07
previous_version: 2
change_summary: >
  Adds the opt-in experimental posix-json-v1 process contract while preserving
  the legacy adapter path.
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isDeepStrictEqual } = require('util');
const { buildAuditEvidence, evaluateMajorGate } = require('./scan.js');

const SCHEMA_VERSION = 1;
const SCRIPT_DIR = __dirname;
const MAX_CHILD_OUTPUT_BYTES = 16 * 1024 * 1024;
const CONTRACT_NAME = 'posix-json-v1';
const CONTRACT_SCHEMA_VERSION = 1;
const EX_USAGE = 64;
const EX_DATAERR = 65;
const EX_NOINPUT = 66;
const EX_CANTCREAT = 73;
const EX_IOERR = 74;
const EX_NOPERM = 77;

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
  const protectedPaths = new Set([absoluteConfig]);
  assertKeys(config, new Set([
    'schema_version', 'workspace', 'artifacts_dir', 'discovery', 'selection', 'scan', 'report',
  ]), 'config');
  if (config.schema_version !== SCHEMA_VERSION) {
    throw new Error(`config schema_version must be ${SCHEMA_VERSION}`);
  }

  const configDir = path.dirname(absoluteConfig);
  const workspace = path.resolve(configDir, config.workspace || '.');
  protectedPaths.add(workspace);
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
    const groupMap = resolveWithin(workspace, discovery.group_map, 'discovery.group_map');
    protectedPaths.add(groupMap);
    addValue(discoverArgs, '--group-map', groupMap);
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
    protectedPaths.add(surfaceMap);
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
      const routeGroupMap = resolveWithin(
        workspace,
        selection.route_group_map,
        'selection.route_group_map'
      );
      protectedPaths.add(routeGroupMap);
      addValue(
        selectArgs,
        '--group-map',
        routeGroupMap
      );
    }
    if (changedFiles) {
      const changedFilesPath = resolveWithin(workspace, changedFiles, 'selection.changed_files');
      protectedPaths.add(changedFilesPath);
      addValue(
        selectArgs,
        '--changed-files',
        changedFilesPath
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
  if (!['errors', 'major', 'new', 'none'].includes(failOn)) {
    throw new Error('scan.fail_on must be errors, major, new, or none');
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
  protectedPaths.add(resolveWithin(workspace, scan.root || '.', 'scan.root'));
  if (scan.baseline) {
    const baseline = resolveWithin(workspace, scan.baseline, 'scan.baseline');
    protectedPaths.add(baseline);
    addValue(scanArgs, '--baseline', baseline);
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
      const previous = resolveWithin(workspace, report.previous, 'report.previous');
      protectedPaths.add(previous);
      addValue(reportArgs, '--previous', previous);
    }
    stages.push(stage('report', 'report.js', reportArgs));
  }

  const plan = {
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
  Object.defineProperties(plan, {
    configPath: { value: absoluteConfig },
    gateMode: { value: failOn },
    protectedPaths: { value: [...protectedPaths].filter((value) => value !== workspace
      && value !== resolveWithin(workspace, scan.root || '.', 'scan.root')) },
    protectedDirectories: {
      value: [workspace, resolveWithin(workspace, scan.root || '.', 'scan.root')],
    },
    contractReportDate: { value: new Date().toISOString().slice(0, 10) },
  });
  Object.defineProperty(plan, 'contractReportPaths', {
    value: [
      path.join(plan.artifacts.report_dir, `audit-${plan.contractReportDate}.md`),
      path.join(plan.artifacts.report_dir, `audit-${plan.contractReportDate}.json`),
    ],
  });
  return plan;
}

function hasContractSelector(argv) {
  return argv.some((arg) => /^--contract(?:=|$)/.test(arg));
}

function contractArgumentError(message, id) {
  return Object.assign(new Error(message), {
    contractExitCode: EX_USAGE,
    contractErrorId: id,
  });
}

function parseContractArgs(argv) {
  const valueFlags = new Set(['contract', 'config', 'changed-files', 'base', 'head', 'output']);
  const booleanFlags = new Set(['dry-run']);
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--') || arg.includes('=')) {
      throw contractArgumentError(`Unsupported argument syntax: ${arg}`, 'invalid-invocation');
    }
    const key = arg.slice(2);
    if (!valueFlags.has(key) && !booleanFlags.has(key)) {
      throw contractArgumentError(`Unsupported option: --${key}`, 'unsupported-option');
    }
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      throw contractArgumentError(`Duplicate option: --${key}`, 'duplicate-option');
    }
    if (booleanFlags.has(key)) {
      args[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw contractArgumentError(`Option --${key} requires a value`, 'missing-option-value');
    }
    args[key] = value;
    index += 1;
  }
  if (args.contract !== CONTRACT_NAME) {
    throw contractArgumentError(`Unsupported contract: ${String(args.contract)}`, 'unsupported-contract');
  }
  if (typeof args.config !== 'string') {
    throw contractArgumentError('Option --config is required', 'missing-config-option');
  }
  return args;
}

function contractIdentity() {
  return { name: CONTRACT_NAME, version: 1, experimental: true };
}

function errorResult(error, defaults = {}) {
  const exitCode = error.contractExitCode || defaults.exitCode || 1;
  return {
    schema_version: CONTRACT_SCHEMA_VERSION,
    contract: contractIdentity(),
    operational: {
      status: 'failed',
      error: {
        id: error.contractErrorId || defaults.id || 'operational-failure',
        exit_code: exitCode,
        message: error.message || String(error),
        retryable: defaults.retryable === true,
        safe_to_repeat: defaults.safeToRepeat === true,
      },
    },
    gate: defaults.gate || { mode: 'none', status: 'not_requested' },
    stages: defaults.stages || [],
    completed_stages: defaults.completedStages || [],
    artifacts: defaults.artifacts || {},
    report_files: defaults.reportFiles || [],
    exit_code: exitCode,
    terminal: true,
  };
}

function classifyFilesystemError(error, operation) {
  if (error && (error.code === 'EACCES' || error.code === 'EPERM')) {
    return { exitCode: EX_NOPERM, id: `${operation}-permission-denied` };
  }
  if (operation === 'request-read' && error && error.code === 'ENOENT') {
    return { exitCode: EX_NOINPUT, id: 'request-input-missing' };
  }
  if (operation === 'output-create'
    && error && ['ENOENT', 'EEXIST', 'EISDIR', 'ENOTDIR', 'EROFS'].includes(error.code)) {
    return { exitCode: EX_CANTCREAT, id: 'output-cannot-create' };
  }
  return {
    exitCode: EX_IOERR,
    id: `${operation}-io-failure`,
    retryable: Boolean(error && ['EAGAIN', 'EBUSY', 'ETIMEDOUT'].includes(error.code)),
  };
}

function loadContractPlan(args) {
  try {
    return buildRunPlan(args.config, args);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw Object.assign(error, {
        contractExitCode: EX_DATAERR,
        contractErrorId: 'request-json-invalid',
      });
    }
    if (error && error.code) {
      const classified = classifyFilesystemError(error, 'request-read');
      throw Object.assign(error, {
        contractExitCode: classified.exitCode,
        contractErrorId: classified.id,
      });
    }
    throw Object.assign(error, {
      contractExitCode: EX_DATAERR,
      contractErrorId: 'request-data-invalid',
    });
  }
}

function preflightContractPlan(plan) {
  const activeOutputs = [
    plan.artifacts.run,
    ...plan.stages.flatMap((entry) => stageOutputs(entry, plan)),
  ].map((value) => path.resolve(value));
  const pathsOverlap = (left, right) => {
    const relative = path.relative(left, right);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
  };
  if (activeOutputs.some((output, index) => activeOutputs
    .some((candidate, candidateIndex) => index !== candidateIndex
      && (pathsOverlap(output, candidate) || pathsOverlap(candidate, output))))) {
    throw Object.assign(new Error('Contract output paths must be distinct'), {
      contractExitCode: EX_DATAERR,
      contractErrorId: 'output-path-collision',
    });
  }
  const protectedPaths = new Set(plan.protectedPaths.map((value) => path.resolve(value)));
  for (const output of activeOutputs) {
    if ([...protectedPaths].some((input) => pathsOverlap(output, input)
      || pathsOverlap(input, output))
      || plan.protectedDirectories.some((directory) => output === path.resolve(directory))
      || output === path.resolve(plan.artifactsDir)
      || output === path.resolve(plan.artifacts.report_dir)) {
      throw Object.assign(new Error(`Contract output aliases an input or directory: ${output}`), {
        contractExitCode: EX_DATAERR,
        contractErrorId: 'output-path-collision',
      });
    }
  }
  const workspaceReal = fs.realpathSync(plan.workspace);
  const protectedStats = [...protectedPaths].flatMap((input) => {
    try {
      const stat = fs.statSync(input);
      return [{ input, dev: stat.dev, ino: stat.ino }];
    } catch (error) {
      return [];
    }
  });
  for (const output of activeOutputs) {
    let existing = output;
    while (!fs.existsSync(existing)) {
      const parent = path.dirname(existing);
      if (parent === existing) break;
      existing = parent;
    }
    const outputReal = path.resolve(fs.realpathSync(existing), path.relative(existing, output));
    const relative = path.relative(workspaceReal, outputReal);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw Object.assign(new Error(`Contract output resolves outside the workspace: ${output}`), {
        contractExitCode: EX_DATAERR,
        contractErrorId: 'output-path-escape',
      });
    }
    if (fs.existsSync(output)) {
      if (!fs.lstatSync(output).isFile()) {
        throw Object.assign(new Error(`Contract output is not a regular file: ${output}`), {
          contractExitCode: EX_CANTCREAT,
          contractErrorId: 'output-cannot-create',
        });
      }
      const outputStat = fs.statSync(output);
      const collision = protectedStats.find((input) => input.dev === outputStat.dev
        && input.ino === outputStat.ino);
      if (collision) {
        throw Object.assign(new Error(`Contract output aliases input storage: ${collision.input}`), {
          contractExitCode: EX_DATAERR,
          contractErrorId: 'output-path-collision',
        });
      }
    }
  }
}

function plannedContractResult(plan, dryRun = false) {
  const gateStatus = plan.gateMode === 'none' ? 'not_requested' : 'not_evaluated';
  return {
    schema_version: CONTRACT_SCHEMA_VERSION,
    contract: contractIdentity(),
    operational: { status: 'complete', error: null },
    gate: { mode: plan.gateMode, status: gateStatus },
    stages: plan.stages.map((entry) => ({
      ...serializeStage(entry, plan.workspace),
      status: 'planned',
      exit_code: null,
      signal: null,
    })),
    completed_stages: [],
    artifacts: plan.envelope.artifacts,
    report_files: [],
    exit_code: 0,
    terminal: true,
    ...(dryRun ? { dry_run: true } : {}),
  };
}

function defaultExecuteStage(entry, plan) {
  return spawnSync(process.execPath, [entry.script, ...entry.args], {
    cwd: plan.workspace,
    encoding: 'utf8',
    maxBuffer: MAX_CHILD_OUTPUT_BYTES,
  });
}

function stageOutputs(entry, plan) {
  if (entry.name === 'discover') return [plan.artifacts.discovery];
  if (entry.name === 'select') return [plan.artifacts.selection];
  if (entry.name === 'scan') return [plan.artifacts.scan];
  if (entry.name === 'report') return plan.contractReportPaths;
  return [];
}

function prepareContractStage(entry, plan, sequence) {
  const token = `${process.pid}-${Date.now()}-${sequence}`;
  const declared = stageOutputs(entry, plan);
  const temporary = declared.map((output) => `${output}.posix-json-v1-${token}.tmp`);
  const args = [...entry.args];
  if (entry.name === 'report') {
    const temporaryDir = path.join(plan.artifacts.report_dir, `.posix-json-v1-${token}.tmp`);
    const outputIndex = args.indexOf('--output-dir');
    args[outputIndex + 1] = temporaryDir;
    return {
      entry: { ...entry, args },
      declared,
      temporary: declared.map((output) => path.join(temporaryDir, path.basename(output))),
      temporaryDir,
    };
  }
  const outputIndex = args.indexOf('--output');
  args[outputIndex + 1] = temporary[0];
  return { entry: { ...entry, args }, declared, temporary, temporaryDir: null };
}

function publishStageOutputs(prepared) {
  const published = [];
  for (let index = 0; index < prepared.declared.length; index += 1) {
    try {
      fs.mkdirSync(path.dirname(prepared.declared[index]), { recursive: true });
      fs.renameSync(prepared.temporary[index], prepared.declared[index]);
      published.push(prepared.declared[index]);
    } catch (error) {
      error.publishedOutputs = published;
      throw error;
    }
  }
  if (prepared.temporaryDir) fs.rmSync(prepared.temporaryDir, { recursive: true, force: true });
}

function discardTemporaryOutputs(prepared) {
  for (const output of prepared.temporary) fs.rmSync(output, { force: true });
  if (prepared.temporaryDir) fs.rmSync(prepared.temporaryDir, { recursive: true, force: true });
}

function parseGeneratedJson(file, id) {
  if (!fs.existsSync(file)) {
    throw Object.assign(new Error(`Expected child artifact was not created: ${file}`), {
      contractErrorId: `${id}-missing`,
    });
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw Object.assign(new Error(`Expected child artifact is not valid JSON: ${file}`), {
      contractErrorId: `${id}-invalid-json`,
    });
  }
}

function countResultViolations(scan) {
  if (!Array.isArray(scan.results)) return null;
  let total = 0;
  for (const result of scan.results) {
    if (!isObject(result) || !isObject(result.axe) || !Array.isArray(result.axe.violations)) return null;
    for (const violation of result.axe.violations) {
      if (!isObject(violation) || !Array.isArray(violation.nodes)) return null;
      total += violation.nodes.length;
    }
  }
  return total;
}

function verifyScanOutcome(scanPath, mode, exitCode) {
  const scan = parseGeneratedJson(scanPath, 'scan-result');
  if (!isObject(scan) || !Array.isArray(scan.errors) || scan.errors.length > 0) {
    throw Object.assign(new Error('Scan artifact contains missing or incomplete page evidence'), {
      contractErrorId: 'scan-result-incomplete',
    });
  }
  if (!Array.isArray(scan.urls) || scan.urls.length === 0
    || !Array.isArray(scan.results) || scan.results.length === 0
    || scan.results.some((result) => !isObject(result)
      || typeof result.url !== 'string'
      || !isObject(result.axe)
      || !Array.isArray(result.axe.violations)
      || !Array.isArray(result.axe.incomplete))
    || scan.urls.some((url) => typeof url !== 'string'
      || !scan.results.some((result) => result.url === url))) {
    throw Object.assign(new Error('Scan artifact does not contain usable evidence for every required URL'), {
      contractErrorId: 'scan-result-invalid',
    });
  }
  if (mode === 'none') {
    if (exitCode !== 0) throw Object.assign(new Error('Ungated scan returned a nonzero status'), {
      contractErrorId: 'scan-status-mismatch',
    });
    return 'not_requested';
  }
  if (mode === 'errors') {
    const violations = countResultViolations(scan);
    if (violations === null || !((exitCode === 0 && violations === 0) || (exitCode === 2 && violations > 0))) {
      throw Object.assign(new Error('Scan result does not substantiate the errors gate status'), {
        contractErrorId: 'scan-gate-mismatch',
      });
    }
    return exitCode === 2 ? 'rejected' : 'accepted';
  }
  if (mode === 'new') {
    const newCount = scan.baseline && scan.baseline.new_count;
    if (!Number.isInteger(newCount)
      || !((exitCode === 0 && newCount === 0) || (exitCode === 2 && newCount > 0))) {
      throw Object.assign(new Error('Scan result does not substantiate the new-findings gate status'), {
        contractErrorId: 'scan-gate-mismatch',
      });
    }
    return exitCode === 2 ? 'rejected' : 'accepted';
  }
  const computedEvidence = buildAuditEvidence(scan.results);
  const computedGate = evaluateMajorGate(computedEvidence, scan.errors);
  const expected = exitCode === 0 ? 'pass' : exitCode === 2 ? 'fail' : exitCode === 3 ? 'inconclusive' : null;
  if (!expected
    || !isDeepStrictEqual(scan.audit_evidence, computedEvidence)
    || !isObject(scan.gate)
    || !isDeepStrictEqual(scan.gate, computedGate)
    || computedGate.status !== expected) {
    throw Object.assign(new Error('Scan result does not substantiate the major-findings gate status'), {
      contractErrorId: 'scan-gate-mismatch',
    });
  }
  return expected === 'pass' ? 'accepted' : expected === 'fail' ? 'rejected' : 'inconclusive';
}

function writeContractArtifact(plan, result) {
  let temporaryDir;
  try {
    fs.mkdirSync(path.dirname(plan.artifacts.run), { recursive: true });
    temporaryDir = fs.mkdtempSync(path.join(
      path.dirname(plan.artifacts.run),
      '.posix-json-v1-run-'
    ));
    const temporary = path.join(temporaryDir, 'result.json');
    fs.writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`);
    fs.renameSync(temporary, plan.artifacts.run);
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  } catch (error) {
    try {
      if (temporaryDir) fs.rmSync(temporaryDir, { recursive: true, force: true });
    } catch (cleanupError) {
      // Preserve the owning write failure classification.
    }
    const classified = classifyFilesystemError(error, 'output-create');
    throw Object.assign(error, {
      contractExitCode: classified.exitCode,
      contractErrorId: classified.id,
      contractRetryable: classified.retryable === true,
    });
  }
}

function persistContractResult(plan, result) {
  try {
    writeContractArtifact(plan, result);
    return result;
  } catch (error) {
    return errorResult(error, {
      exitCode: error.contractExitCode || 1,
      id: error.contractErrorId || 'output-write-failed',
      retryable: error.contractRetryable === true,
      gate: result.gate,
      stages: result.stages,
      completedStages: result.completed_stages,
      artifacts: result.artifacts,
      reportFiles: result.report_files,
    });
  }
}

function failContractResult(plan, result, error, defaults = {}) {
  const failure = errorResult(error, {
    ...defaults,
    gate: result.gate,
    stages: result.stages,
    completedStages: result.completed_stages,
    artifacts: result.artifacts,
    reportFiles: result.report_files,
  });
  return persistContractResult(plan, failure);
}

function runContractPlan(plan, dependencies = {}) {
  const executeStage = dependencies.executeStage || defaultExecuteStage;
  const diagnostic = dependencies.diagnostic || ((value) => process.stderr.write(value));
  const result = plannedContractResult(plan);
  result.operational.status = 'running';
  result.terminal = false;
  const initial = persistContractResult(plan, result);
  if (initial !== result) return initial;
  let gateExitCode = 0;

  for (let index = 0; index < plan.stages.length; index += 1) {
    const entry = plan.stages[index];
    const stageResult = result.stages[index];
    let prepared;
    try {
      prepared = prepareContractStage(entry, plan, index);
      discardTemporaryOutputs(prepared);
    } catch (error) {
      const classified = classifyFilesystemError(error, 'output-create');
      return failContractResult(plan, result, error, {
        ...classified,
      });
    }

    let child;
    try {
      child = executeStage(prepared.entry, plan);
    } catch (error) {
      child = { status: null, signal: null, error };
    }
    if (child.stdout) diagnostic(String(child.stdout));
    if (child.stderr) diagnostic(String(child.stderr));
    stageResult.exit_code = Number.isInteger(child.status) ? child.status : null;
    stageResult.signal = child.signal || null;

    if (child.error || child.signal) {
      stageResult.status = 'failed';
      discardTemporaryOutputs(prepared);
      return failContractResult(
        plan,
        result,
        child.error || new Error(`Child stage terminated by signal: ${child.signal}`),
        { id: 'child-stage-failed', exitCode: 1, retryable: false }
      );
    }

    if (entry.name === 'scan' && [0, 2, 3].includes(stageResult.exit_code)) {
      try {
        result.gate.status = verifyScanOutcome(
          prepared.temporary[0],
          plan.gateMode,
          stageResult.exit_code
        );
        publishStageOutputs(prepared);
      } catch (error) {
        stageResult.status = 'failed';
        discardTemporaryOutputs(prepared);
        return failContractResult(plan, result, error, {
          id: error.contractErrorId || 'scan-result-invalid',
          exitCode: 1,
          retryable: false,
        });
      }
      gateExitCode = result.gate.status === 'rejected' ? 2
        : result.gate.status === 'inconclusive' ? 3 : 0;
      stageResult.status = 'completed';
      result.completed_stages.push(entry.name);
      const persisted = persistContractResult(plan, result);
      if (persisted !== result) return persisted;
      continue;
    }

    if (stageResult.exit_code !== 0) {
      stageResult.status = 'failed';
      discardTemporaryOutputs(prepared);
      return failContractResult(plan, result, new Error(`Child stage failed: ${entry.name}`), {
        id: 'child-stage-failed',
        exitCode: 1,
        retryable: false,
      });
    }

    try {
      const outputs = prepared.temporary;
      if (entry.name === 'discover' || entry.name === 'select') {
        parseGeneratedJson(outputs[0], `${entry.name}-result`);
      } else if (entry.name === 'report') {
        for (const output of outputs) {
          if (!fs.existsSync(output)) throw Object.assign(
            new Error(`Expected report artifact was not created: ${output}`),
            { contractErrorId: 'report-result-missing' }
          );
        }
      }
      publishStageOutputs(prepared);
      if (entry.name === 'report') {
        result.report_files = prepared.declared
          .map((value) => relativeToWorkspace(plan.workspace, value));
      }
    } catch (error) {
      stageResult.status = 'failed';
      if (entry.name === 'report' && Array.isArray(error.publishedOutputs)) {
        result.report_files = error.publishedOutputs
          .map((value) => relativeToWorkspace(plan.workspace, value));
      }
      discardTemporaryOutputs(prepared);
      return failContractResult(plan, result, error, {
        id: error.contractErrorId || 'child-result-invalid',
        exitCode: 1,
      });
    }
    stageResult.status = 'completed';
    result.completed_stages.push(entry.name);
    const persisted = persistContractResult(plan, result);
    if (persisted !== result) return persisted;
  }

  result.exit_code = gateExitCode;
  result.operational.status = 'complete';
  result.terminal = true;
  return persistContractResult(plan, result);
}

function runContractFromArgv(argv, dependencies = {}) {
  let args;
  let plan;
  try {
    args = parseContractArgs(argv);
    plan = loadContractPlan(args);
    preflightContractPlan(plan);
  } catch (error) {
    return errorResult(error, {
      exitCode: error.contractExitCode || EX_DATAERR,
      id: error.contractErrorId || 'request-data-invalid',
      retryable: error.contractRetryable === true,
    });
  }
  if (args['dry-run']) return plannedContractResult(plan, true);
  try {
    return runContractPlan(plan, dependencies);
  } catch (error) {
    return errorResult(error, {
      exitCode: error.contractExitCode || 1,
      id: error.contractErrorId || 'operational-failure',
      retryable: error.contractRetryable === true,
      gate: { mode: plan.gateMode, status: plan.gateMode === 'none' ? 'not_requested' : 'not_evaluated' },
      artifacts: plan.envelope.artifacts,
    });
  }
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
  const argv = process.argv.slice(2);
  if (hasContractSelector(argv)) {
    const result = runContractFromArgv(argv);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.exit_code;
    return;
  }
  const args = parseArgs(argv);
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
  hasContractSelector,
  parseArgs,
  parseContractArgs,
  runContractFromArgv,
  runContractPlan,
  runPlan,
  verifyScanOutcome,
};

if (require.main === module) main();
