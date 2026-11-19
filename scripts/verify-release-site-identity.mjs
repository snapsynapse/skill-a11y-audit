#!/usr/bin/env node
// Check release-controlled bytes before publishing a descendant commit to Pages.
import fs from 'node:fs';
import path from 'node:path';

const [releaseArg, candidateArg, stagedArg] = process.argv.slice(2);
if (!releaseArg || !candidateArg || !stagedArg) {
  console.error('Usage: verify-release-site-identity.mjs RELEASE_DIR CANDIDATE_DIR STAGED_DIR');
  process.exit(2);
}
const release = path.resolve(releaseArg);
const candidate = path.resolve(candidateArg);
const staged = path.resolve(stagedArg);

const fixed = [
  'package.json',
  'assistant-guide.txt',
  'a11y-audit/SKILL.md',
  'a11y-audit/MANIFEST.yaml',
  'a11y-audit/deps/package.json',
  'a11y-audit/deps/package-lock.json',
  '.github/actions/scan/action.yml',
  'docs/.well-known/assistant-guide.txt',
  'docs/.well-known/assistant-guide-manifest.txt',
  'a11y-audit/references/output-schema.json',
  'a11y-audit/references/cli-result-schema.json',
];
function assertRegularPath(base, relative, type) {
  let current = base;
  const parts = relative.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    const expected = index === parts.length - 1 ? type : 'directory';
    if (expected === 'directory' ? !stat.isDirectory() : !stat.isFile()) {
      throw new Error(`Release identity requires regular ${expected}: ${relative}`);
    }
  }
}
function walkFiles(base, relative) {
  const directory = path.join(base, relative);
  assertRegularPath(base, relative, 'directory');
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(base, next));
    else if (entry.isFile()) files.push(next);
    else throw new Error(`Unexpected link or special file: ${next}`);
  }
  return files;
}
function equalFiles(leftBase, leftName, rightBase, rightName = leftName) {
  const leftPath = path.join(leftBase, leftName);
  const rightPath = path.join(rightBase, rightName);
  assertRegularPath(leftBase, leftName, 'file');
  assertRegularPath(rightBase, rightName, 'file');
  const left = fs.readFileSync(leftPath);
  const right = fs.readFileSync(rightPath);
  if (!left.equals(right)) throw new Error(`Release byte mismatch: ${leftName} != ${rightName}`);
}

try {
  for (const file of fixed) equalFiles(release, file, candidate);
  const releaseScripts = walkFiles(release, 'a11y-audit/scripts').sort();
  const candidateScripts = walkFiles(candidate, 'a11y-audit/scripts').sort();
  if (releaseScripts.join('\n') !== candidateScripts.join('\n')) {
    throw new Error('Release executable inventory mismatch: a11y-audit/scripts');
  }
  for (const file of releaseScripts) equalFiles(release, file, candidate);
  for (const [releaseFile, stagedFile] of [
    ['docs/.well-known/assistant-guide.txt', '.well-known/assistant-guide.txt'],
    ['docs/.well-known/assistant-guide-manifest.txt', '.well-known/assistant-guide-manifest.txt'],
    ['a11y-audit/references/output-schema.json', 'schema/audit-v1.json'],
    ['a11y-audit/references/cli-result-schema.json', 'schema/cli-result-posix-json-v1.json'],
  ]) equalFiles(release, releaseFile, staged, stagedFile);
  console.log('Release and Pages guide, executable and provenance bytes match');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
