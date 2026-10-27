// Mocked npm result only; actual audit gate executes in an in-memory module.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=process.argv[2]||process.cwd();
const source=fs.readFileSync(root+'/scripts/audit-deps.mjs','utf8');
const fixture={auditReportVersion:2,vulnerabilities:{example:{severity:'moderate',via:[{name:'example',url:'https://github.com/advisories/GHSA-test-test-test',severity:'moderate',title:'test'}]}},metadata:{vulnerabilities:{info:0,low:0,moderate:1,high:0,critical:0,total:1}}};
const mocked=source.replace("import { spawnSync } from 'node:child_process';",`const spawnSync=()=>(${JSON.stringify({status:0,stdout:JSON.stringify(fixture),stderr:''})});`);
const run=spawnSync(process.execPath,['--input-type=module','-e',mocked],{encoding:'utf8',cwd:root});
console.log(JSON.stringify({scenario:'valid moderate report; npm audit-level=high returns 0',exit:run.status,stdout:run.stdout.trim(),stderr:run.stderr.split('\n').slice(0,7).join('\n')}));
