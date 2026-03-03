#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-03-03
previous_version: null
change_summary: Added a non-destructive issue planning helper for markdown+issues mode.
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

function priorityForImpact(impact) {
  switch (impact) {
    case 'critical':
      return 'P0';
    case 'serious':
      return 'P1';
    case 'moderate':
      return 'P2';
    default:
      return 'P3';
  }
}

function thresholdAllows(priority, threshold) {
  const order = ['P0', 'P1', 'P2', 'P3'];
  return order.indexOf(priority) <= order.indexOf(threshold);
}

function routeFromUrl(url) {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(args.input || '');
const outputPath = path.resolve(args.output || 'issue-plan.md');
const threshold = args.threshold || 'P1';

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('Missing --input path to helper scan JSON');
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const byRule = new Map();

for (const result of input.results || []) {
  const route = routeFromUrl(result.url);
  const axe = result.axe || {};
  for (const violation of axe.violations || []) {
    const key = `${violation.id}::${route}`;
    const priority = priorityForImpact(violation.impact || 'minor');
    if (!thresholdAllows(priority, threshold)) continue;
    if (!byRule.has(key)) {
      byRule.set(key, {
        key,
        rule: violation.id,
        priority,
        impact: violation.impact || 'minor',
        route,
        help: violation.help,
        helpUrl: violation.helpUrl,
        instances: 0
      });
    }
    byRule.get(key).instances += (violation.nodes || []).length;
  }
}

const issues = [...byRule.values()].sort((a, b) => a.key.localeCompare(b.key));
const lines = [
  '# Accessibility Issue Plan',
  '',
  `Input: \`${inputPath}\``,
  `Threshold: \`${threshold}\``,
  `Planned tickets: ${issues.length}`,
  '',
  '| Priority | Rule | Route | Instances | Dedup Key | Summary |',
  '|---|---|---|---:|---|---|'
];

for (const issue of issues) {
  lines.push(`| ${issue.priority} | ${issue.rule} | ${issue.route} | ${issue.instances} | \`<!-- a11y-audit-key: ${issue.rule}::${issue.route} -->\` | ${issue.help || 'Accessibility issue'} |`);
}

lines.push('', 'Use this plan for user review and deduplication checks before live ticket creation.');

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(outputPath);
