// Bounded synthetic npm responses only. No provider calls or source changes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-audit-ref-'));
try {
  fs.writeFileSync(path.join(temp, 'npm'), '#!/usr/bin/env node\nconsole.log(process.env.AUDIT_RESPONSE);process.exit(1);\n', { mode: 0o755 });
  const totals = {info:0,low:0,moderate:0,high:1,critical:0,total:1};
  const cases = [
    ['unresolved-reference', { vulnerable: { severity: 'high', via: ['missing-package'] } }],
    ['reference-cycle', { vulnerable: { severity: 'high', via: ['vulnerable'] } }],
    ['real-high-control', { vulnerable: { severity: 'high', via: [{name:'vulnerable',severity:'high',url:'https://github.com/advisories/GHSA-test-test-test',title:'Synthetic advisory'}] } }],
  ];
  const observed = cases.map(([name, vulnerabilities]) => {
    const report = {auditReportVersion:2,vulnerabilities,metadata:{vulnerabilities:totals}};
    const run = spawnSync(process.execPath, ['scripts/audit-deps.mjs'], {cwd:root,encoding:'utf8',env:{...process.env,PATH:temp+path.delimiter+process.env.PATH,AUDIT_RESPONSE:JSON.stringify(report)}});
    return {name,exit:run.status,stdout:run.stdout.trim(),stderr:run.stderr.trim()};
  });
  console.log(JSON.stringify(observed,null,2));
  if (observed[0].exit !== 0 || observed[1].exit !== 0 || observed[2].exit !== 1) throw new Error('Reproduction behavior changed');
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
