// Disposable synthetic filesystem fixtures; never reads real credentials.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const require = createRequire(import.meta.url);
const { protectAuthFiles } = require(path.join(root, 'a11y-audit/scripts/auth-state.js'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-integrity-review-'));
const results = {};
try {
  const state = path.join(temp,'state.json');
  const targets = path.join(temp,'targets.json');
  const artifacts = path.join(temp,'artifacts'); fs.mkdirSync(artifacts);
  fs.writeFileSync(state, JSON.stringify({cookies:[],origins:[],synthetic:'SYNTHETIC_STATE'}));
  fs.writeFileSync(targets,'[]');
  fs.linkSync(state,path.join(artifacts,'cache.json'));
  protectAuthFiles([state,targets],[artifacts]);
  results.authDirectoryAlias = {guardAccepted:true,aliasContainsSyntheticState:fs.readFileSync(path.join(artifacts,'cache.json'),'utf8').includes('SYNTHETIC_STATE')};
  const scripts = path.join(temp,'report-entry'); fs.mkdirSync(scripts);
  const originalReport = fs.readFileSync(path.join(root,'a11y-audit/scripts/report.js'));
  fs.writeFileSync(path.join(scripts,'report.js'),originalReport);
  fs.writeFileSync(path.join(scripts,'scan.js'),"console.log('TAMPERED_TRANSITIVE_SCAN_EXECUTED');throw new Error('Synthetic tamper sentinel');\n");
  const reportRun=spawnSync(process.execPath,[path.join(scripts,'report.js')],{encoding:'utf8'});
  results.reportTransitivePin={entryUnchanged:fs.readFileSync(path.join(scripts,'report.js')).equals(originalReport),sentinelExecuted:reportRun.stdout.includes('TAMPERED_TRANSITIVE_SCAN_EXECUTED'),exit:reportRun.status};
  const site=path.join(temp,'build'); fs.mkdirSync(site);
  fs.cpSync(path.join(root,'docs'),path.join(site,'docs'),{recursive:true,filter:source=>path.basename(source)!=='.DS_Store'});
  fs.mkdirSync(path.join(site,'a11y-audit/references'),{recursive:true});
  for(const file of ['output-schema.json','cli-result-schema.json']) fs.copyFileSync(path.join(root,'a11y-audit/references',file),path.join(site,'a11y-audit/references',file));
  fs.writeFileSync(path.join(site,'private.txt'),'SYNTHETIC_OUTSIDE_DOCS');
  fs.symlinkSync('../private.txt',path.join(site,'docs/public.txt'));
  const build=spawnSync(process.execPath,[path.join(root,'scripts/build-site.mjs')],{cwd:site,encoding:'utf8'});
  if(build.status !== 0) throw new Error(JSON.stringify({status:build.status,error:String(build.error),stdout:build.stdout,stderr:build.stderr}));
  results.siteSymlink={exit:build.status,stagedSymlink:fs.lstatSync(path.join(site,'_site/public.txt')).isSymbolicLink(),readsOutsideSentinel:fs.readFileSync(path.join(site,'_site/public.txt'),'utf8')==='SYNTHETIC_OUTSIDE_DOCS'};
  assert(results.authDirectoryAlias.guardAccepted && results.reportTransitivePin.sentinelExecuted && results.siteSymlink.readsOutsideSentinel);
  console.log(JSON.stringify(results,null,2));
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
