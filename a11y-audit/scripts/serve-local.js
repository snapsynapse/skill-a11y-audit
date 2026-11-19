/*
skill_bundle: a11y-audit
file_role: script
version: 3
version_date: 2026-11-19
previous_version: 2
change_summary: >
  Checks only selected static and fallback paths while rejecting unsafe aliases.
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

function statIfPresent(candidate) {
  try { return fs.lstatSync(candidate); }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
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
      // http-server may retry an index, extension, or 404 page without
      // rerunning this middleware. Check only the path that retry can serve.
      if (!isSafePublicPath(target)) {
        response.writeHead(404); response.end(); return;
      }
      const targetStat = statIfPresent(target);
      let selected = target;
      if (targetStat?.isDirectory()) selected = path.join(target, 'index.html');
      else if (!targetStat) {
        const extension = `${target}.html`;
        selected = !path.extname(pathname) && statIfPresent(extension)
          ? extension : path.join(serveRoot, '404.html');
      }
      if (!isSafePublicPath(selected)) {
        response.writeHead(404); response.end(); return;
      }
    } catch {
      response.writeHead(400); response.end(); return;
    }
    response.emit('next');
  }],
});
server.listen(port, '127.0.0.1', () => console.log(`Serving http://127.0.0.1:${port}`));
