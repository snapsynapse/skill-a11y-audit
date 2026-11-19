#!/usr/bin/env node
// Exercise site staging with isolated synthetic inputs. No deployment occurs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-site.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-site-boundary-'));
const root = path.join(temp, 'project');
const docs = path.join(root, 'docs');
const schemas = path.join(root, 'a11y-audit/references');
fs.mkdirSync(path.join(docs, '.well-known'), { recursive: true });
fs.mkdirSync(schemas, { recursive: true });
for (const file of ['.nojekyll', '.well-known/assistant-guide.txt', '.well-known/assistant-guide-manifest.txt']) {
  fs.writeFileSync(path.join(docs, file), `reviewed ${file}`);
}
fs.writeFileSync(path.join(docs, 'index.html'), '<main>PUBLIC_CONTROL</main>');
fs.writeFileSync(path.join(docs, '.DS_Store'), 'LOCAL_METADATA_CONTROL');
fs.mkdirSync(path.join(docs, 'nested'));
fs.writeFileSync(path.join(docs, 'nested/.DS_Store'), 'NESTED_LOCAL_METADATA_CONTROL');
fs.writeFileSync(path.join(schemas, 'output-schema.json'), '{}');
fs.writeFileSync(path.join(schemas, 'cli-result-schema.json'), '{}');
const outside = path.join(root, 'outside.txt');
fs.writeFileSync(outside, 'SYNTHETIC_OUTSIDE_ROOT');
const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });

try {
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(root, '_site/index.html'), 'utf8'), '<main>PUBLIC_CONTROL</main>');
  assert.equal(fs.existsSync(path.join(root, '_site/.DS_Store')), false);
  assert.equal(fs.existsSync(path.join(root, '_site/nested/.DS_Store')), false);
  assert.equal(fs.readFileSync(path.join(docs, '.DS_Store'), 'utf8'), 'LOCAL_METADATA_CONTROL');
  assert.equal(fs.readFileSync(path.join(root, '_site/schema/audit-v1.json'), 'utf8'), '{}');
  console.log('PASS normal site and required hidden files stage');

  const cases = [
    ['outward file', 'outside-link.txt', outside],
    ['outward directory', 'outside-directory', path.dirname(outside)],
    ['hidden target', 'hidden-link.txt', path.join(docs, '.nojekyll')],
    ['in-root link', 'internal-link.html', path.join(docs, 'index.html')],
    ['broken link', 'broken-link.txt', path.join(root, 'missing.txt')],
  ];
  for (const [label, name, target] of cases) {
    const link = path.join(docs, name);
    fs.symlinkSync(target, link);
    try {
      result = run();
      assert.notEqual(result.status, 0, label);
      assert.match(result.stderr, /symlink|special/i, label);
      assert.equal(fs.readFileSync(path.join(root, '_site/index.html'), 'utf8'), '<main>PUBLIC_CONTROL</main>', label);
      assert.equal(fs.existsSync(path.join(root, '_site', name)), false, label);
    } finally { fs.unlinkSync(link); }
    console.log(`PASS ${label} rejected without changing staged site`);
  }
  const schema = path.join(schemas, 'output-schema.json');
  fs.unlinkSync(schema);
  fs.symlinkSync(outside, schema);
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symlink or special schema source/);
  assert.equal(fs.readFileSync(path.join(root, '_site/index.html'), 'utf8'), '<main>PUBLIC_CONTROL</main>');
  fs.unlinkSync(schema);
  fs.writeFileSync(schema, '{}');
  console.log('PASS schema input link rejected before changing staged site');
  fs.unlinkSync(path.join(docs, '.nojekyll'));
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /required hidden public file is missing/);
  console.log('PASS missing required hidden file rejected');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
