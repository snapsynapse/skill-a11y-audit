/*
skill_bundle: a11y-audit
file_role: script
version: 2
version_date: 2026-11-18
previous_version: 1
change_summary: >
  Rejects symlink and special-file aliases while serving Action fixtures on loopback.
*/
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { createServer } = require('../deps/node_modules/http-server');

const [root, portText] = process.argv.slice(2);
const port = Number(portText);
if (!root || !/^\d+$/.test(portText || '') || port < 1 || port > 65535) {
  throw new Error('Usage: serve-local.js ROOT PORT (1-65535)');
}
const serveRoot = path.resolve(root);
if (!fs.lstatSync(serveRoot).isDirectory()) throw new Error('Serve root must be a regular directory');

function isSafePublicPath(candidate) {
  const relative = path.relative(serveRoot, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
  let current = serveRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    if (segment.startsWith('.')) return false;
    current = path.join(current, segment);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return true;
      return false;
    }
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) return false;
  }
  return true;
}

const server = createServer({
  root: serveRoot, cache: -1, showDir: 'false', showDotfiles: false,
  before: [(request, response) => {
    // http-server's showDotfiles flag hides listing entries, but permits direct
    // requests. Reject decoded hidden segments before the static handler runs.
    try {
      const pathname = decodeURIComponent(request.url.split('?')[0]).replace(/\\/g, '/');
      if (pathname.split('/').some(segment => segment.startsWith('.'))) {
        response.writeHead(404); response.end(); return;
      }
      const target = path.resolve(serveRoot, `.${pathname}`);
      // http-server may internally retry an index, extension, or 404 page
      // without rerunning this middleware. Check those paths here too.
      const candidates = [target, path.join(target, 'index.html'), path.join(serveRoot, '404.html')];
      if (target !== serveRoot) candidates.push(`${target}.html`);
      if (!candidates.every(isSafePublicPath)) {
        response.writeHead(404); response.end(); return;
      }
    } catch {
      response.writeHead(400); response.end(); return;
    }
    response.emit('next');
  }],
});
server.listen(port, '127.0.0.1', () => console.log(`Serving http://127.0.0.1:${port}`));
