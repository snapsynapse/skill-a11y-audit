#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'docs');
const output = path.join(root, '_site');
const schemaSource = path.join(root, 'a11y-audit/references/output-schema.json');
const allowedHiddenFiles = new Set([
  '.nojekyll',
  '.well-known/assistant-guide-manifest.txt',
  '.well-known/assistant-guide.txt'
]);

function walkHidden(directory, relative = '') {
  const hidden = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) hidden.push(...walkHidden(path.join(directory, entry.name), next));
    else if (next.split('/').some(segment => segment.startsWith('.'))) hidden.push(next);
  }
  return hidden;
}

const hiddenFiles = walkHidden(source);
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

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true });
fs.mkdirSync(path.join(output, 'schema'), { recursive: true });
fs.copyFileSync(schemaSource, path.join(output, 'schema/audit-v1.json'));

console.log(`build-site: staged ${path.relative(root, output)} with ${hiddenFiles.length} reviewed hidden files`);
