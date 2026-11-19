#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 2
version_date: 2026-11-19
previous_version: 1
change_summary: >
  Checks output containment and owner-only atomic JSON publication.
*/
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { assertSeparateOutputs, writeJsonAtomic } = require('../scripts/output-safety.js');
const scanner = path.resolve(__dirname, '../scripts/scan.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-input-boundaries-'));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = path.join(temp, 'accepted.json');
fs.writeFileSync(source, '{"accepted":true}\n');
const original = digest(source);
const aliases = [
  source,
  path.join(temp, 'sym.json'),
  path.join(temp, 'hard.json'),
  temp,
];
fs.symlinkSync(source, aliases[1]);
fs.linkSync(source, aliases[2]);
for (const alias of aliases) {
  assert.throws(() => assertSeparateOutputs([source], [alias]), /aliases|unexpected file type/);
  assert.equal(digest(source), original);
}
const nested = path.join(temp, 'nested');
fs.mkdirSync(nested);
const inputWithin = path.join(nested, 'input.json');
fs.writeFileSync(inputWithin, '{}');
assert.throws(() => assertSeparateOutputs([inputWithin], [nested], { directories: [nested] }), /aliases/);
assert.doesNotThrow(() => assertSeparateOutputs([source], [path.join(temp, 'scan.json')]));
const scanOutput = path.join(temp, 'scan.json');
writeJsonAtomic(scanOutput, { results: [] });
assert.equal(fs.statSync(scanOutput).mode & 0o077, 0, 'new scan artifacts must be owner-only');
fs.chmodSync(scanOutput, 0o600);
writeJsonAtomic(scanOutput, { results: ['updated'] });
assert.equal(fs.statSync(scanOutput).mode & 0o077, 0, 'replaced private artifacts must stay owner-only');
assert.equal(digest(source), original);
for (const bad of [
  ['--fail-on'], ['--fail-on', 'bogus'], ['--fail-onn', 'new'],
  ['--fail-on', 'none', '--fail-on', 'new'], ['--baseline'],
]) {
  const output = path.join(temp, 'should-not-exist.json');
  const result = spawnSync(process.execPath, [scanner, '--urls', 'https://example.com/', '--output', output, ...bad], {
    encoding: 'utf8', cwd: temp,
  });
  assert.equal(result.status, 1, `${bad.join(' ')}: ${result.stderr}`);
  assert.equal(fs.existsSync(output), false, `${bad.join(' ')} wrote output`);
}
for (const alias of aliases.slice(0, 3)) {
  const result = spawnSync(process.execPath, [scanner, '--urls', 'https://example.com/', '--baseline', source,
    '--output', alias, '--fail-on', 'new'], { encoding: 'utf8', cwd: temp });
  assert.equal(result.status, 1, `${alias}: ${result.stderr}`);
  assert.equal(digest(source), original);
  assert.doesNotMatch(result.stderr, /axe-core:|puppeteer:/);
}
console.log('PASS scanner arguments and output collisions preserve accepted inputs before browser work');
