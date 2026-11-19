/*
skill_bundle: a11y-audit
file_role: script
version: 2
version_date: 2026-11-19
previous_version: 1
change_summary: >
  Protects input paths and writes atomic JSON with owner-only permissions.
*/
'use strict';
const fs = require('fs');
const path = require('path');

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function resolvedDestination(value) {
  const absolute = path.resolve(value);
  let ancestor = absolute;
  while (true) {
    try { fs.lstatSync(ancestor); break; }
    catch (error) {
      if (error.code === 'ENOTDIR') throw new Error(`Output has an unexpected file type in parent path: ${ancestor}`);
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  if (ancestor !== absolute && !fs.statSync(ancestor).isDirectory()) {
    throw new Error(`Output has an unexpected file type in parent path: ${ancestor}`);
  }
  return path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, absolute));
}

function assertSeparateOutputs(inputs, outputs, options = {}) {
  const source = inputs.filter(Boolean).map(value => path.resolve(value));
  const targets = outputs.filter(Boolean).map(value => path.resolve(value));
  const sourceReal = source.map(resolvedDestination);
  const targetReal = targets.map(resolvedDestination);
  const directoryOutputs = new Set((options.directories || []).map(value => path.resolve(value)));
  const sourceStats = source.flatMap(value => {
    try { const stat = fs.statSync(value); return [{ value, dev: stat.dev, ino: stat.ino }]; }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  });
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (fs.existsSync(target) && !(directoryOutputs.has(target)
      ? fs.lstatSync(target).isDirectory() : fs.lstatSync(target).isFile())) {
      throw new Error(`Output has an unexpected file type: ${target}`);
    }
    if (source.some(value => contains(value, target) || contains(target, value))
      || sourceReal.some(value => contains(value, targetReal[i]) || contains(targetReal[i], value))) {
      throw new Error(`Output aliases an input: ${target}`);
    }
    if (fs.existsSync(target)) {
      const stat = fs.statSync(target);
      if (sourceStats.some(input => input.dev === stat.dev && input.ino === stat.ino)) {
        throw new Error(`Output aliases an input inode: ${target}`);
      }
    }
    for (let j = 0; j < i; j++) {
      if (contains(target, targets[j]) || contains(targets[j], target)
        || contains(targetReal[i], targetReal[j]) || contains(targetReal[j], targetReal[i])) {
        throw new Error(`Output paths collide: ${target}`);
      }
      if (fs.existsSync(target) && fs.existsSync(targets[j])) {
        const left = fs.statSync(target);
        const right = fs.statSync(targets[j]);
        if (left.dev === right.dev && left.ino === right.ino) throw new Error(`Output inodes collide: ${target}`);
      }
    }
  }
}

function writeJsonAtomic(destination, value) {
  const absolute = path.resolve(destination);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temporary = path.join(path.dirname(absolute), `.${path.basename(absolute)}.${process.pid}.${require('crypto').randomBytes(8).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, absolute);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

module.exports = { assertSeparateOutputs, writeJsonAtomic };
