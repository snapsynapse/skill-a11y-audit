#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-audit-deps-test-'));
const severity = ['info', 'low', 'moderate', 'high', 'critical'];
const advisory = (name, level) => ({
  name, severity: level, url: `https://github.com/advisories/GHSA-${name}-test-test`,
  title: 'Synthetic advisory',
});
const node = (name, level, via) => ({ name, severity: level, via });
const cases = [
  ['clean', {}, 0],
  ['direct moderate', { qs: node('qs', 'moderate', [advisory('qs', 'moderate')]) }, 0],
  ['direct high', { vulnerable: node('vulnerable', 'high', [advisory('vulnerable', 'high')]) }, 1],
  ['propagated high', { parent: node('parent', 'high', ['child']), child: node('child', 'high', [advisory('child', 'high')]) }, 1],
  ['missing reference', { vulnerable: node('vulnerable', 'high', ['missing']) }, 1],
  ['self cycle', { vulnerable: node('vulnerable', 'high', ['vulnerable']) }, 1],
  ['multi node cycle', { a: node('a', 'high', ['b']), b: node('b', 'high', ['a']) }, 1],
  ['unexplained high', { vulnerable: node('vulnerable', 'high', [advisory('vulnerable', 'moderate')]) }, 1],
  ['understated high', { vulnerable: node('vulnerable', 'moderate', [advisory('vulnerable', 'high')]) }, 1],
  ['valid cycle with advisory', { a: node('a', 'high', ['b']), b: node('b', 'high', ['a', advisory('b', 'high')]) }, 1],
  ['dangling moderate', { vulnerable: node('vulnerable', 'moderate', ['missing']) }, 1],
];

try {
  fs.writeFileSync(path.join(temp, 'npm'), '#!/usr/bin/env node\nprocess.stdout.write(process.env.AUDIT_RESPONSE);process.exit(process.env.AUDIT_EXIT ? Number(process.env.AUDIT_EXIT) : 0);\n', { mode: 0o755 });
  for (const [name, vulnerabilities, expected] of cases) {
    const counts = Object.fromEntries(severity.map(level => [level, 0]));
    for (const value of Object.values(vulnerabilities)) counts[value.severity] += 1;
    counts.total = Object.keys(vulnerabilities).length;
    const report = { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
    const run = spawnSync(process.execPath, ['scripts/audit-deps.mjs'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, PATH: `${temp}${path.delimiter}${process.env.PATH}`, AUDIT_RESPONSE: JSON.stringify(report), AUDIT_EXIT: counts.total ? '1' : '0' },
    });
    assert.equal(run.status, expected, `${name}: ${run.stdout}\n${run.stderr}`);
    if (['missing reference', 'self cycle', 'multi node cycle', 'unexplained high', 'understated high', 'dangling moderate'].includes(name)) {
      assert.match(run.stderr, /coverage is unavailable|malformed advisory data/i, name);
    } else if (expected === 1) {
      assert.match(run.stderr, /AUDIT\s+high/i, name);
      assert.doesNotMatch(run.stderr, /coverage is unavailable/i, name);
    }
  }
  const inconsistent = {
    auditReportVersion: 2,
    vulnerabilities: { vulnerable: node('vulnerable', 'high', [advisory('vulnerable', 'high')]) },
    metadata: { vulnerabilities: { info: 0, low: 1, moderate: 0, high: 0, critical: 0, total: 1 } },
  };
  const mismatch = spawnSync(process.execPath, ['scripts/audit-deps.mjs'], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, PATH: `${temp}${path.delimiter}${process.env.PATH}`, AUDIT_RESPONSE: JSON.stringify(inconsistent), AUDIT_EXIT: '1' },
  });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /coverage is unavailable/i);
  for (const fixture of ['root-audit.json', 'scanner-audit.json']) {
    const report = fs.readFileSync(path.join(root, 'ops/security/evidence/2026-11-18', fixture), 'utf8');
    const run = spawnSync(process.execPath, ['scripts/audit-deps.mjs'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, PATH: `${temp}${path.delimiter}${process.env.PATH}`, AUDIT_RESPONSE: report, AUDIT_EXIT: fixture === 'root-audit.json' ? '0' : '1' },
    });
    assert.equal(run.status, 0, `${fixture}: ${run.stdout}\n${run.stderr}`);
  }
  console.log(`${cases.length + 1} npm advisory graph cases and two retained provider reports passed`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
