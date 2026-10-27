// Read-only reproduction: mock npm responses in an in-memory audit-gate copy.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const root = process.argv[2] || process.cwd();
const gatePath = `${root}/scripts/audit-deps.mjs`;
const source = fs.readFileSync(gatePath, 'utf8');
const scenarios = [
  {name: 'unsupported-audit-endpoint', result: {status: 1, stdout: JSON.stringify({error:{code:'ENOAUDIT',summary:'registry does not support audit'}}), stderr: 'audit error'}},
  {name: 'provider-failure', result: {status: 1, stdout: JSON.stringify({error:{code:'ECONNRESET',summary:'registry connection reset'}}), stderr: 'audit error'}},
  {name: 'valid-clean-control', result: {status: 0, stdout: JSON.stringify({auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}}}), stderr: ''}},
];
for (const scenario of scenarios) {
  const mocked = source.replace("import { spawnSync } from 'node:child_process';", `const spawnSync = () => (${JSON.stringify(scenario.result)});`);
  if (mocked === source) throw new Error('Audit-gate import changed; update this reproduction.');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', mocked], {encoding:'utf8',cwd:root});
  console.log(JSON.stringify({scenario:scenario.name,exit_code:result.status,stdout:result.stdout.trim(),stderr:result.stderr.trim()}));
}
