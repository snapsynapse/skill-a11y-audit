#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-report-pin-'));
try {
  const scripts = path.join(temporary, 'scripts');
  fs.cpSync(path.join(root, 'a11y-audit/scripts'), scripts, { recursive: true });
  const report = path.join(scripts, 'report.js');
  const run = () => spawnSync(process.execPath, [report], { encoding: 'utf8' });

  const valid = run();
  assert.equal(valid.status, 1);
  assert.match(valid.stderr, /Usage: report\.js/);
  assert.doesNotMatch(valid.stderr, /integrity mismatch/i);

  for (const name of ['scan.js', 'auth-state.js', 'network-policy.js', 'check-runtime.js', 'output-safety.js']) {
    const target = path.join(scripts, name);
    const original = fs.readFileSync(target);
    fs.writeFileSync(target, `console.log('TAMPERED_LOCAL_EXECUTED'); throw Error('synthetic tamper');\n`);
    const tampered = run();
    assert.equal(tampered.status, 1, name);
    assert.match(tampered.stderr, /integrity mismatch/i, name);
    assert.doesNotMatch(tampered.stdout, /TAMPERED_LOCAL_EXECUTED/, name);
    fs.writeFileSync(target, original);
  }
  console.log('Report and all local transitive executable mutations were rejected before execution');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
