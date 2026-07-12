#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 2
version_date: 2026-03-03
previous_version: 1
change_summary: Adds optional regression-gate and baseline fields to generated project context.
*/

const fs = require('fs');
const path = require('path');

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

function renderList(items) {
  return items.length === 0 ? ['- none: true'] : items.map((item) => `  - ${item}`);
}

const args = parseArgs(process.argv.slice(2));
const workspace = path.resolve(args.workspace || process.cwd());
const outDir = path.join(workspace, '.a11y-audit');
const outPath = path.join(outDir, 'PROJECT_CONTEXT.md');

const name = args.name || path.basename(workspace);
const baseUrl = args.base_url || 'http://localhost:3000';
const appRoot = args.app_root || '.';
const standards = args.standards || 'WCAG 2.1 AA';
const mode = args.output_mode || 'markdown';
const reportPath = args.report_path || 'docs/accessibility/audits/audit-YYYY-MM-DD.md';
const routes = splitCsv(args.routes);
const priorityRoutes = splitCsv(args.priority_routes);
const failOn = typeof args.fail_on === 'string' ? args.fail_on : null;
const baselinePath = args.baseline_path || '.a11y-audit/baseline.json';

fs.mkdirSync(outDir, { recursive: true });

const lines = [
  '# Accessibility Audit Project Context',
  '',
  '## Project',
  '',
  `- name: ${name}`,
  `- base_url: ${baseUrl}`,
  '- repo_root: .',
  `- app_root: ${appRoot}`,
  '',
  '## Audit Scope',
  '',
  `- standards: ${standards}`,
  '- scan_mode: full',
  '- include_routes:',
  ...renderList(routes),
  '- priority_routes:',
  ...renderList(priorityRoutes),
  '',
  '## Output Configuration',
  '',
  `- output_mode: ${mode}`,
  `- report_path: ${reportPath}`,
];

if (mode !== 'markdown') {
  lines.push('- json_path: docs/accessibility/audits/audit-YYYY-MM-DD.json');
}

if (failOn) {
  lines.push(
    '',
    '## Regression Gate',
    '',
    `- fail_on: ${failOn}`,
    `- baseline_path: ${baselinePath}`,
    '- baseline_policy: Baseline changes require explicit review; never refresh automatically in CI.'
  );
}

lines.push('', '## References', '', '- conformance_docs: docs/accessibility/', '- manual_testing_guide: docs/testing_qa/');

fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
console.log(outPath);
