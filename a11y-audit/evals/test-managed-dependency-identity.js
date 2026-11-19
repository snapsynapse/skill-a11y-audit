#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: evals
version: 3
version_date: 2026-11-19
previous_version: 2
change_summary: >
  Covers transitive package drift alongside lock and top-level version checks.
*/
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installDependencySet, managedSetStatus } = require('../scripts/scan.js');

const depsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-managed-identity-'));
const lockPath = path.join(depsDir, 'package-lock.json');
const modules = path.join(depsDir, 'node_modules');
const markerPath = path.join(modules, '.a11y-audit-installed-lock.json');
const pkgPath = name => path.join(modules, name, 'package.json');
const writePackage = (name, version) => {
  fs.mkdirSync(path.dirname(pkgPath(name)), { recursive: true });
  fs.writeFileSync(pkgPath(name), JSON.stringify({ name, version }));
};
const writeLock = transitive => fs.writeFileSync(lockPath, JSON.stringify({ packages: {
  '': {},
  'node_modules/axe-core': { version: '4.12.1' },
  'node_modules/puppeteer': { version: '25.16.0' },
  'node_modules/follow-redirects': { version: transitive },
} }));

try {
  writeLock('1.16.1');
  assert.match(managedSetStatus(depsDir), /missing install marker/);
  const spawn = (_program, args) => {
    assert.equal(args[0], 'ci');
    writePackage('axe-core', '4.12.1');
    writePackage('puppeteer', '25.16.0');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    writePackage('follow-redirects', lock.packages['node_modules/follow-redirects'].version);
    fs.writeFileSync(path.join(modules, '.package-lock.json'), JSON.stringify({ packages: Object.fromEntries(
      Object.entries(lock.packages).filter(([location]) => location)
    ) }));
    return { status: 0 };
  };
  installDependencySet({ depsDir, spawn, attempts: 1 });
  assert.equal(managedSetStatus(depsDir), null, 'valid locked graph must be reusable');
  assert(fs.existsSync(markerPath));
  writePackage('follow-redirects', '0.0.0');
  assert.match(managedSetStatus(depsDir), /managed dependency drift: node_modules\/follow-redirects/,
    'changed installed transitive metadata must not reuse an unchanged cached lock');
  writePackage('follow-redirects', '1.16.1');

  writeLock('1.16.2');
  assert.match(managedSetStatus(depsDir), /lock digest changed/, 'unchanged Puppeteer cannot hide changed transitive lock');
  installDependencySet({ depsDir, spawn, attempts: 1 });
  writePackage('axe-core', '4.11.0');
  assert.match(managedSetStatus(depsDir), /axe-core version drift/);
  writePackage('axe-core', '4.12.1');
  fs.rmSync(pkgPath('puppeteer'));
  assert.match(managedSetStatus(depsDir), /puppeteer version drift/, 'partial install must fail identity');
  writePackage('puppeteer', '25.16.0');
  fs.rmSync(pkgPath('follow-redirects'));
  assert.match(managedSetStatus(depsDir), /managed dependency drift: node_modules\/follow-redirects/, 'missing transitive must fail identity');
  writePackage('follow-redirects', '1.16.2');
  fs.rmSync(path.join(modules, '.package-lock.json'));
  assert.match(managedSetStatus(depsDir), /incomplete managed install/);
  fs.writeFileSync(path.join(modules, '.package-lock.json'), JSON.stringify({ packages: Object.fromEntries(
    Object.entries(JSON.parse(fs.readFileSync(lockPath, 'utf8')).packages).filter(([location]) => location)
  ) }));
  fs.writeFileSync(markerPath, JSON.stringify({ schema: 1, lock_sha256: '0'.repeat(64) }));
  assert.match(managedSetStatus(depsDir), /lock digest changed/, 'stale marker must fail identity');
  assert.throws(() => installDependencySet({ depsDir, attempts: 1, spawn: () => ({ status: 1 }) }), /Failed to install/);
  assert.equal(fs.existsSync(markerPath), false, 'interrupted install must invalidate prior marker');
  console.log('managed dependency identity tests passed');
} finally {
  fs.rmSync(depsDir, { recursive: true, force: true });
}
