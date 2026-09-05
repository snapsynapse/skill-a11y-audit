#!/usr/bin/env node
/*
skill_bundle: a11y-audit
file_role: script
version: 1
version_date: 2026-09-05
previous_version: null
change_summary: >
  Rejects unsupported Node runtimes before scanner dependency acquisition.
*/
'use strict';

function assertSupportedNode(version = process.versions.node) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match || Number(match[1]) < 22 || (Number(match[1]) === 22 && Number(match[2]) < 12)) {
    throw new Error(`a11y-audit requires Node.js >=22.12.0; found ${version}. Upgrade Node before installing or scanning.`);
  }
}

if (require.main === module) {
  try {
    assertSupportedNode();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { assertSupportedNode };
