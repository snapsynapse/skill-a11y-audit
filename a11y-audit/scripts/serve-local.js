/*
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-10-26
previous_version: null
change_summary: >
  Serves Action fixtures on loopback with hidden paths and directory listings denied.
*/
'use strict';

const path = require('node:path');
const { createServer } = require('../deps/node_modules/http-server');

const [root, portText] = process.argv.slice(2);
const port = Number(portText);
if (!root || !/^\d+$/.test(portText || '') || port < 1 || port > 65535) {
  throw new Error('Usage: serve-local.js ROOT PORT (1-65535)');
}
const server = createServer({
  root: path.resolve(root), cache: -1, showDir: 'false', showDotfiles: false,
  before: [(request, response) => {
    // http-server's showDotfiles flag hides listing entries, but permits direct
    // requests. Reject decoded hidden segments before the static handler runs.
    try {
      const pathname = decodeURIComponent(request.url.split('?')[0]).replace(/\\/g, '/');
      if (pathname.split('/').some(segment => segment.startsWith('.'))) {
        response.writeHead(404); response.end(); return;
      }
    } catch {
      response.writeHead(400); response.end(); return;
    }
    response.emit('next');
  }],
});
server.listen(port, '127.0.0.1', () => console.log(`Serving http://127.0.0.1:${port}`));
