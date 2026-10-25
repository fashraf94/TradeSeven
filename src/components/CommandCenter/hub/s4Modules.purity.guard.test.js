// src/components/CommandCenter/hub/s4Modules.purity.guard.test.js
//
// Command Center hub, slice S4 (review T-9) — the purity of S4's two derivations, executable. hub/activityRows.js and
// hub/nextAction.js each open with "Pure: it reads only its arguments", and the rest of the hub's pure code has a guard that says
// the same (selectors.purity.guard.test.js; reviewScheduler.purity.guard.test.js). Without one a `Date.now()` in either would pass
// every other guard and quietly make Activity's year, or the next action's choice, depend on a clock the caller did not hand in
// (Activity takes `nowMs` for exactly that reason).
//
// The scan parses each module (acorn) so a comment or a string never counts. A module may import only what is listed for it, and
// touches no global of the page, the clock, a timer, the network, storage, the environment or randomness. `Intl` is allowed to
// neither: hub/hubDate.js and hub/activityDates.js own every formatter, so the derivations never build one.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(path.join(HERE, name), 'utf8').replace(/\r\n/g, '\n');
const parse = (code) => Parser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

/** What each module may import: its siblings in the hub, the copy table, and (activity) the shared lean kernel. */
const ALLOWED_IMPORTS = Object.freeze({
  'activityRows.js': [/^\.\.\/\.\.\/\.\.\/\.\.\/api\/_utils\/leanRevalidation\.js$/, /^\.\/activityDates$/, /^\.\/hubCopy$/, /^\.\/hubDate$/, /^\.\/selectors\/loadout$/],
  'nextAction.js': [/^\.\/hubCopy$/, /^\.\/hubDate$/, /^\.\/selectors\/deployState$/],
});

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

/** Every way `code` reaches outside its arguments, as readable hits. */
function impurityIn(code, allowedImports = []) {
  const hits = [];
  walk(parse(code), (node, parent) => {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' || (node.type === 'ExportNamedDeclaration' && node.source)) {
      const spec = String(node.source?.value);
      if (!allowedImports.some((re) => re.test(spec))) hits.push(`import: ${spec}`);
    }
    if (node.type === 'ImportExpression') hits.push('dynamic import()');
    if (node.type === 'MetaProperty') hits.push('import.meta');
    if (node.type === 'Identifier' && IMPURE_GLOBALS.has(node.name)) {
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

describe('purity — S4\'s derivations read only their arguments (review T-9)', () => {
  for (const [file, allowed] of Object.entries(ALLOWED_IMPORTS)) {
    it(`${file} imports only what is listed and touches no clock, timer, page, storage, network, environment or random source`, () => {
      expect(impurityIn(read(file), allowed)).toEqual([]);
    });
  }

  it('finds the modules\' exports, so the rows above are not vacuous', () => {
    const exported = (file) => {
      const names = [];
      walk(parse(read(file)), (node) => {
        if (node.type === 'ExportNamedDeclaration' && node.declaration?.id?.name) names.push(node.declaration.id.name);
      });
      return names;
    };
    expect(exported('activityRows.js')).toEqual(expect.arrayContaining(['deriveActivity', 'activitySectionOf', 'loadoutKnowledgeOf']));
    expect(exported('nextAction.js')).toEqual(expect.arrayContaining(['deriveNextAction', 'firstDeploymentOffer', 'laterKeyOf']));
  });

  it('the scan flags what it names', () => {
    for (const planted of [
      'const t = Date.now();', 'const d = new Date(0);', 'performance.now();', "fetch('/api');", 'setTimeout(f, 0);', 'requestAnimationFrame(f);',
      'window.focus();', 'const h = document.hidden;', "sessionStorage.getItem('k');", "localStorage.getItem('k');", "console.log('x');",
      "new Intl.DateTimeFormat('en-US');", "eval('1');", 'const r = Math.random();', "const q = Math['random']();", 'const e = process.env.X;',
      "import x from 'y';", "import { z } from './useHubReaders';", "export * from './x';", "const m = import('./x');", 'const e = import.meta.env;',
    ]) {
      expect(impurityIn(planted, ALLOWED_IMPORTS['nextAction.js']), planted).not.toEqual([]);
    }
    for (const fine of [
      "import { HUB_COPY as COPY } from './hubCopy';", 'const o = { Date: 1, fetch: 2 }; o.Date; o.fetch;', 'new Map(); new Set(); Object.freeze({});',
      'const n = Math.max(1, 2); const m = Math.min(...[1]);', 'export const X = 1;',
    ]) {
      expect(impurityIn(fine, ALLOWED_IMPORTS['nextAction.js']), fine).toEqual([]);
    }
  });
});
