#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(root, 'scripts/verify-release-site-identity.mjs');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
const pinnedVerifier = workflow.match(/echo '([0-9a-f]{64})  scripts\/verify-release-site-identity\.mjs' \| sha256sum --check/)?.[1];
assert.ok(pinnedVerifier, 'Pages workflow must pin verifier bytes before execution');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(digest(verifier), pinnedVerifier, 'Pages workflow verifier pin is stale');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-release-site-'));
const release = path.join(temp, 'release');
const candidate = path.join(temp, 'descendant');
const staged = path.join(temp, 'staged');
const files = [
  'package.json', 'assistant-guide.txt', 'a11y-audit/SKILL.md', 'a11y-audit/MANIFEST.yaml',
  'a11y-audit/deps/package.json', 'a11y-audit/deps/package-lock.json',
  '.github/actions/scan/action.yml', 'docs/.well-known/assistant-guide.txt',
  'docs/.well-known/assistant-guide-manifest.txt',
  'a11y-audit/references/output-schema.json', 'a11y-audit/references/cli-result-schema.json',
];
function put(base, file, bytes) {
  const destination = path.join(base, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}
function run() {
  return spawnSync(process.execPath, [verifier, release, candidate, staged], { encoding: 'utf8' });
}
try {
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(root, file));
    put(release, file, bytes);
    put(candidate, file, bytes);
  }
  fs.cpSync(path.join(root, 'a11y-audit/scripts'), path.join(release, 'a11y-audit/scripts'), { recursive: true });
  fs.cpSync(path.join(root, 'a11y-audit/scripts'), path.join(candidate, 'a11y-audit/scripts'), { recursive: true });
  for (const [source, destination] of [
    ['docs/.well-known/assistant-guide.txt', '.well-known/assistant-guide.txt'],
    ['docs/.well-known/assistant-guide-manifest.txt', '.well-known/assistant-guide-manifest.txt'],
    ['a11y-audit/references/output-schema.json', 'schema/audit-v1.json'],
    ['a11y-audit/references/cli-result-schema.json', 'schema/cli-result-posix-json-v1.json'],
  ]) put(staged, destination, fs.readFileSync(path.join(release, source)));

  let result = run();
  assert.equal(result.status, 0, result.stderr);
  console.log('PASS matching release descendant and staged identity');

  const candidateGuide = path.join(candidate, 'assistant-guide.txt');
  fs.appendFileSync(candidateGuide, '\nchanged guide, same package version\n');
  result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /assistant-guide.txt/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(candidate, 'package.json'))).version,
    JSON.parse(fs.readFileSync(path.join(release, 'package.json'))).version);
  fs.copyFileSync(path.join(release, 'assistant-guide.txt'), candidateGuide);
  console.log('PASS same-version descendant with altered guide rejected');

  const stagedGuide = path.join(staged, '.well-known/assistant-guide.txt');
  fs.appendFileSync(stagedGuide, '\nchanged staged guide\n');
  result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /assistant-guide.txt/);
  fs.copyFileSync(path.join(release, 'docs/.well-known/assistant-guide.txt'), stagedGuide);
  console.log('PASS altered staged guide rejected');

  const script = path.join(candidate, 'a11y-audit/scripts/scan.js');
  fs.appendFileSync(script, '\n// altered executable\n');
  result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /scan.js/);
  console.log('PASS altered executable rejected');

} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
