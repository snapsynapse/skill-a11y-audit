#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'docs');
const output = path.join(root, '_site');
const schemaSource = path.join(root, 'a11y-audit/references/output-schema.json');
const cliSchemaSource = path.join(root, 'a11y-audit/references/cli-result-schema.json');
const allowedHiddenFiles = new Set([
  '.nojekyll',
  '.well-known/assistant-guide-manifest.txt',
  '.well-known/assistant-guide.txt'
]);

function walkPublic(directory, relative = '') {
  const hidden = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const next = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      throw new Error(`build-site: refusing symlink or special public file: ${next}`);
    }
    if (entry.isDirectory()) hidden.push(...walkPublic(path.join(directory, entry.name), next));
    else if (next.split('/').some(segment => segment.startsWith('.'))) hidden.push(next);
  }
  return hidden;
}

function assertRegularSource(file) {
  let current = root;
  const parts = path.relative(root, file).split(path.sep);
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error(`build-site: refusing symlink or special schema source: ${path.relative(root, file)}`);
    }
  }
}

if (!fs.lstatSync(source).isDirectory()) throw new Error('build-site: docs must be a regular directory');
const hiddenFiles = walkPublic(source);
const unexpected = hiddenFiles.filter(file => !allowedHiddenFiles.has(file));
if (unexpected.length) {
  console.error(`build-site: refusing unexpected hidden public file(s): ${unexpected.join(', ')}`);
  process.exit(1);
}
for (const required of allowedHiddenFiles) {
  if (!hiddenFiles.includes(required)) {
    console.error(`build-site: required hidden public file is missing: ${required}`);
    process.exit(1);
  }
}
assertRegularSource(schemaSource);
assertRegularSource(cliSchemaSource);

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true, filter: entry => path.basename(entry) !== '.DS_Store' });
// A source entry changed during copying must not leave a link in the upload tree.
walkPublic(output);
fs.mkdirSync(path.join(output, 'schema'), { recursive: true });
fs.copyFileSync(schemaSource, path.join(output, 'schema/audit-v1.json'));
fs.copyFileSync(cliSchemaSource, path.join(output, 'schema/cli-result-posix-json-v1.json'));

console.log(`build-site: staged ${path.relative(root, output)} with ${hiddenFiles.length} reviewed hidden files`);
