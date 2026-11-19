#!/usr/bin/env node
// skill_bundle: portfolio-search-indexing-audit
// file_role: asset
// version: 1
// version_date: 2026-11-18
// previous_version: null
// change_summary: Exercises the vendored decoder copies against one-pass XML entity cases.
'use strict';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cases = [
    ['a=1&amp;b=2', 'a=1&b=2'],
    ['&amp;lt;tag&amp;gt;', '&lt;tag&gt;'],
    ['&#38;amp;', '&amp;'],
    ['&apos;&#39;&#x27;', "'''"],
    ['&#0;&#xD800;&#x110000;', '&#0;&#xD800;&#x110000;'],
    ['&#65;&#x41;', 'AA'],
];
for (const file of ['scripts/check-search.mjs', 'scripts/check-production-search.mjs']) {
    const source = fs.readFileSync(file, 'utf8');
    const match = source.match(/function decode\(value\) \{[\s\S]*?\n\}/);
    assert(match, `${file} must define a standalone decoder`);
    const decode = vm.runInNewContext(`(${match[0]})`);
    for (const [input, expected] of cases) assert.equal(decode(input), expected, `${file}: ${input}`);
    assert.equal(decode(undefined), '');
    assert.match(source, /decode\([^\n]*<loc>|loc: decode\(/, `${file} must decode sitemap locations`);
}
console.log('search decoder copies pass one-pass entity contract');
