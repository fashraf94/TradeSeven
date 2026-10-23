// src/components/CommandCenter/hub/reviewScheduler.purity.guard.test.js
//
// Command Center hub, slice S3 (ruling R-S3-6: "pure scheduler on an injected clock behind a thin hook"; review T5-17) —
// the scheduler's purity, executable. hub/reviewScheduler.js says it "holds no timer, clock or read of its own": its clock
// (`now`, `setTimer`, `clearTimer`), its completed read and its review helper are all injected, which is what lets every §6
// rule run under a fake clock in reviewScheduler.test.js. The hub mount guard's activity scan sees timers, listeners and
// calls to fetch in the hub directory, and nothing else saw a clock read: a `Date.now()` or a `performance.now()` in this
// file would have passed every guard and quietly moved the rate budget onto the real clock.
//
// The scan mirrors the selectors' (hub/selectors/selectors.purity.guard.test.js): the module is parsed (acorn), so comments
// never satisfy or trip it; it may import nothing but the modules on ALLOWED_IMPORT (none today — a refactor that imports a
// pure constant adds its path there, on purpose); and it touches no global of the browser, the clock, a timer, the network,
// the environment or randomness. `Promise`, `Map`, `Set` and the other language built-ins are not impure. A local variable
// named like one of those globals trips the scan: rename the local. The scan proves itself on planted code.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULER = path.join(HERE, 'reviewScheduler.js');
const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const parse = (code) => Parser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

/** What the scheduler may import: nothing today. Each entry is a regex over the import specifier. */
const ALLOWED_IMPORT = [];

/** Globals a pure scheduler never touches: the page, the clock, timers, the network, the environment, randomness. */
const IMPURE_GLOBALS = new Set([
  'window', 'document', 'globalThis', 'self', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'indexedDB',
  'Date', 'performance', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'clearImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'queueMicrotask',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'BroadcastChannel', 'crypto', 'process', 'require', 'console',
  'Intl', 'Function', 'eval',
]);

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const [k, v] of Object.entries(node)) {
    if (k === 'start' || k === 'end') continue;
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit, node));
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}

/** Every way `code` reaches outside its own arguments, as readable hits. */
function impurityIn(code) {
  const hits = [];
  walk(parse(code), (node, parent) => {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' || (node.type === 'ExportNamedDeclaration' && node.source)) {
      const spec = node.source?.value;
      if (!ALLOWED_IMPORT.some((re) => re.test(String(spec)))) hits.push(`import: ${spec}`);
    }
    if (node.type === 'ImportExpression') hits.push('dynamic import()');
    if (node.type === 'MetaProperty') hits.push('import.meta');
    if (node.type === 'Identifier' && IMPURE_GLOBALS.has(node.name)) {
      // A property name (`o.Date`, `{ fetch: 1 }`) is not the global.
      const isProperty = (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed)
        || (parent?.type === 'Property' && parent.key === node && !parent.computed);
      if (!isProperty) hits.push(`global: ${node.name}`);
    }
    if (node.type === 'MemberExpression' && node.object?.name === 'Math'
      && ((!node.computed && node.property?.name === 'random') || (node.computed && node.property?.type === 'Literal' && node.property.value === 'random'))) {
      hits.push('Math.random');
    }
  });
  return hits;
}

describe('purity — hub/reviewScheduler.js (R-S3-6: a pure scheduler on an injected clock)', () => {
  it('imports nothing and touches no clock, timer, page, network or random source of its own', () => {
    expect(impurityIn(read(SCHEDULER))).toEqual([]);
  });

  it('finds the scheduler, so the row above is not vacuous', () => {
    const exported = [];
    walk(parse(read(SCHEDULER)), (node) => {
      if (node.type === 'ExportNamedDeclaration' && node.declaration?.id?.name) exported.push(node.declaration.id.name);
    });
    expect(exported).toContain('createReviewScheduler');
  });

  it('the scan flags what it names', () => {
    for (const planted of [
      'const t = Date.now();', 'const d = new Date(0);', 'performance.now();', 'const f = globalThis.fetch;', "fetch('/api');",
      'setTimeout(f, 0);', 'setInterval(f, 1);', 'clearTimeout(h);', 'requestAnimationFrame(f);', 'queueMicrotask(f);',
      'window.focus();', 'const h = document.hidden;', "localStorage.getItem('k');", "console.log('x');",
      'const z = Intl.DateTimeFormat().resolvedOptions().timeZone;', "eval('1');", "const f = Function('return 1');",
      'const r = Math.random();', "const q = Math['random']();", 'const u = crypto.randomUUID();', 'const e = process.env.X;',
      "import x from 'y';", "import { z } from './hubCopy';", "export * from './x';", "export { w } from './x';", "const m = import('./x');",
      'const e = import.meta.env;',
    ]) {
      expect(impurityIn(planted), planted).not.toEqual([]);
    }
    for (const fine of [
      'const o = { Date: 1, fetch: 2 }; o.Date; o.fetch;', 'clock.now(); clock.setTimer(f, 1); clock.clearTimer(h);',
      'Promise.resolve().then(f);', 'new Map(); new Set(); Object.freeze({});', 'const n = Math.max(1, 2);', 'export const X = 1;',
      'class LocalTimeout extends Error {}',
    ]) {
      expect(impurityIn(fine), fine).toEqual([]);
    }
  });
});
