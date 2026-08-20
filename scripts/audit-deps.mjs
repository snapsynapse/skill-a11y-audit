#!/usr/bin/env node
// Runs `npm audit` and fails on high or critical advisories, except those
// carried in an allowlist file with a reason and an expiry date.
// Expired entries and entries that no longer match a live advisory also fail,
// so the allowlist cannot rot into a blanket suppression.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BLOCKING = new Set(['high', 'critical']);
const ROOT = process.cwd();
const arg = name => {
    const found = process.argv.find(value => value.startsWith(`--${name}=`));
    return found ? found.slice(name.length + 3) : null;
};

const prefix = arg('prefix');
const allowlistPath = arg('allowlist');
const today = new Date().toISOString().slice(0, 10);
const failures = [];

function runAudit() {
    const args = ['audit', '--json'];
    if (prefix) args.push('--prefix', prefix);
    const result = spawnSync('npm', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (result.error) throw new Error(`npm audit failed to run: ${result.error.message}`);
    if (!result.stdout.trim()) throw new Error(`npm audit produced no output: ${result.stderr.trim()}`);
    return JSON.parse(result.stdout);
}

// npm nests advisory objects inside each vulnerability's `via` chain; string
// entries are indirection through another vulnerable package, not advisories.
function collectAdvisories(report) {
    const found = new Map();
    for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
        for (const via of vulnerability.via ?? []) {
            if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
            const id = String(via.url ?? '').split('/').pop() || `npm-${via.source}`;
            if (!found.has(id)) found.set(id, { id, package: via.name, severity: via.severity, title: via.title });
        }
    }
    return found;
}

function loadAllowlist() {
    if (!allowlistPath) return [];
    const resolved = path.resolve(ROOT, allowlistPath);
    const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    const entries = parsed.advisories ?? [];
    for (const entry of entries) {
        if (!entry.id || !entry.reason || !entry.expires) {
            throw new Error(`allowlist entry needs id, reason, and expires: ${JSON.stringify(entry)}`);
        }
    }
    return entries;
}

const advisories = collectAdvisories(runAudit());
const allowlist = loadAllowlist();
const allowed = new Map(allowlist.map(entry => [entry.id, entry]));

for (const advisory of advisories.values()) {
    const entry = allowed.get(advisory.id);
    if (!entry) {
        failures.push(`AUDIT  ${advisory.severity} ${advisory.id} in ${advisory.package}: ${advisory.title}`);
        continue;
    }
    if (entry.expires < today) {
        failures.push(`AUDIT  allowlist for ${advisory.id} expired on ${entry.expires}; re-review or extend it`);
        continue;
    }
    console.log(`ALLOWED  ${advisory.id} (${advisory.package}) until ${entry.expires}: ${entry.reason}`);
}

for (const entry of allowlist) {
    if (!advisories.has(entry.id)) {
        failures.push(`AUDIT  allowlist entry ${entry.id} matches no current advisory; remove it`);
    }
}

for (const failure of failures) console.error(failure);
if (failures.length) process.exit(1);
console.log(`AUDIT  no unreviewed high or critical advisories${prefix ? ` in ${prefix}` : ''}`);
