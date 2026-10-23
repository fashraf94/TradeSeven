// src/components/CommandCenter/hub/selectors/selectors.purity.guard.test.js
//
// Command Center hub, slice S2a — the selectors' guards (prompt §4, §5):
//   1. purity: every module under hub/selectors/ is pure — no React, no
//      Firebase, no package at all, no window / document / clock / timer /
//      random / storage / network, no dynamic import — and imports only the
//      allowed modules: ../hubCopy, ../deployDisplay,
//      src/utils/commandCenterLiveBattles.js, src/constants/*, and each other;
//   2. display words: no selector or display file branches on a STORED phase
//      named confirmed, finishing, verifying or failed (spec §5.2: those are
//      display words). The ceremony's own `verifying` phase (the shipped stage
//      machine's, stored as ceremonyPhase) is a different field and is not a
//      provider phase;
//   3. display agreement (BUILD_RULES §9): the reducer's 120 s cooldown is the
//      server's and the shipped ceremony's.
// Every scan parses the module (acorn, as the copy guard does), so comments
// never satisfy or trip a row, and each scan proves itself on planted code.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { describe, expect, it } from 'vitest';
import { DEPLOY_COOLDOWN_MS } from './attemptReducer';

const JsxParser = Parser.extend(acornJsx());
const parse = (code) => JsxParser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const SELECTORS = 'src/components/CommandCenter/hub/selectors';
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const selectorFiles = () => readdirSync(path.join(REPO_ROOT, SELECTORS))
  .filter((n) => /\.[mc]?jsx?$/.test(n) && !/\.test\.[mc]?jsx?$/.test(n))
  .map((n) => `${SELECTORS}/${n}`);

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const [k, v] of Object.entries(node)) {
    if (k === 'start' || k === 'end') continue;
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit, node));
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}

// ── 1. purity ───────────────────────────────────────────────────────────────

/** What a pure selector may import, as resolved repo paths. */
const ALLOWED_IMPORT = [
  /^src\/components\/CommandCenter\/hub\/hubCopy\.js$/,
  /^src\/components\/CommandCenter\/hub\/deployDisplay\.js$/,
  /^src\/utils\/commandCenterLiveBattles\.js$/,
  /^src\/constants\/[^/]+\.js$/,
  /^src\/components\/CommandCenter\/hub\/selectors\/[^/]+\.js$/,
];

/**
 * Globals a pure selector never touches: the browser, the clock and the environment's locale and
 * time zone (Intl), timers and microtasks (Promise), randomness, eval-like code, storage, the network
 * (S2a review A5-16 added Intl, Promise, Function and eval).
 */
const IMPURE_GLOBALS = new Set([
  'window', 'document', 'globalThis', 'self', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'indexedDB',
  'Date', 'performance', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'queueMicrotask', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'BroadcastChannel', 'crypto', 'process',
  'require', 'console', 'Intl', 'Promise', 'Function', 'eval',
]);

function resolveImport(fromRel, spec) {
  if (!spec.startsWith('.')) return null;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  return /\.[mc]?jsx?$/.test(joined) ? joined : `${joined}.js`;
}

function impurityIn(rel, code) {
  const hits = [];
  const ast = parse(code);
  walk(ast, (node, parent) => {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
      const spec = node.source?.value;
      if (typeof spec !== 'string') return;
      const resolved = resolveImport(rel, spec);
      if (!resolved) hits.push(`package import: ${spec}`);
      else if (!ALLOWED_IMPORT.some((re) => re.test(resolved))) hits.push(`import outside the allowed list: ${spec}`);
    }
    if (node.type === 'ImportExpression') hits.push('dynamic import()');
    if (node.type === 'Identifier' && IMPURE_GLOBALS.has(node.name)) {
      // A property name (`x.Date`, `{ fetch: 1 }`) is not the global.
      const isProperty = (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed)
        || (parent?.type === 'Property' && parent.key === node && !parent.computed);
      if (!isProperty) hits.push(`global: ${node.name}`);
    }
    if (node.type === 'MemberExpression' && node.object?.name === 'Math'
      && ((!node.computed && node.property?.name === 'random') || (node.computed && node.property?.type === 'Literal' && node.property.value === 'random'))) {
      hits.push('Math.random');
    }
    if (node.type === 'MetaProperty') hits.push('import.meta');
  });
  return hits;
}

describe('purity — hub/selectors/ (prompt §4: no React, no Firebase, no timers, no Date.now() or window reads)', () => {
  it('finds the selector modules, so the rows below are not vacuous', () => {
    expect(selectorFiles().sort()).toEqual([
      `${SELECTORS}/attemptReducer.js`,
      `${SELECTORS}/attemptVocabulary.js`,
      `${SELECTORS}/deployState.js`,
      // S3: the outcome selector (R-S3-7) and the readers' input shapes (R-S3-9).
      `${SELECTORS}/gameOutcome.js`,
      `${SELECTORS}/loadout.js`,
      `${SELECTORS}/ownership.js`,
      `${SELECTORS}/readerInputs.js`,
    ]);
  });

  it('every selector module is pure and imports only the allowed modules', () => {
    const hits = selectorFiles().flatMap((rel) => impurityIn(rel, read(rel)).map((h) => `${rel}: ${h}`));
    expect(hits).toEqual([]);
  });

  it('the imports are exactly the ones the selectors need', () => {
    const importsOf = (rel) => {
      const out = [];
      walk(parse(read(rel)), (n) => { if (n.type === 'ImportDeclaration') out.push(n.source.value); });
      return out.sort();
    };
    expect(importsOf(`${SELECTORS}/ownership.js`)).toEqual([]);
    expect(importsOf(`${SELECTORS}/attemptVocabulary.js`)).toEqual(['../../../../constants/hypothesisRecords']);
    expect(importsOf(`${SELECTORS}/attemptReducer.js`)).toEqual(['./attemptVocabulary', './ownership']);
    expect(importsOf(`${SELECTORS}/deployState.js`)).toEqual([
      '../../../../constants/leagueTournament', '../../../../utils/commandCenterLiveBattles', './attemptVocabulary', './ownership',
    ]);
    // S3: the outcome selector reads one constant; the input shapes, the gate's own owned set.
    expect(importsOf(`${SELECTORS}/gameOutcome.js`)).toEqual(['../../../../constants/leagueTournament']);
    expect(importsOf(`${SELECTORS}/readerInputs.js`)).toEqual(['./deployState']);
    // S5: the Loadout selector takes every input as an argument; its one import is the shipped equip lock.
    expect(importsOf(`${SELECTORS}/loadout.js`)).toEqual(['../../../../utils/commandCenterLiveBattles']);
  });

  it('the scan flags what it names', () => {
    const rel = `${SELECTORS}/planted.js`;
    for (const planted of [
      "import React from 'react';", "import { getDoc } from 'firebase/firestore';", "import { x } from '../../../../config/featureFlags';",
      "import { y } from '../../../../services/agentDeploy';", "import { z } from '../hubStyle';", "export * from '../../../../hooks/useAgent';",
      'const t = Date.now();', 'const d = new Date(0);', 'const w = window.innerWidth;', 'setTimeout(f, 0);', 'queueMicrotask(f);',
      'const r = Math.random();', 'const u = crypto.randomUUID();', "const m = import('./x');", 'const e = import.meta.env;',
      'globalThis.x = 1;', 'performance.now();', "localStorage.getItem('k');", "fetch('/api');", "console.log('x');",
      // S2a review A5-16 (PL-02, PL-03, PL-04, PL-06).
      'const z = Intl.DateTimeFormat().resolvedOptions().timeZone;', "const f = Function('return 1');", 'Promise.resolve().then(f);',
      "const q = Math['random']();", "eval('1');",
    ]) {
      expect(impurityIn(rel, planted), planted).not.toEqual([]);
    }
    for (const fine of [
      "import { HUB_COPY } from '../hubCopy';", "import { deployDisplay } from '../deployDisplay';",
      "import { deriveDeployGate } from '../../../../utils/commandCenterLiveBattles';", "import { X } from '../../../../constants/leagueTournament';",
      "import { a } from './attemptVocabulary';", 'const o = { fetch: 1, Date: 2 }; o.Date; o.fetch;', 'const n = Math.max(1, 2);',
    ]) {
      expect(impurityIn(rel, fine), fine).toEqual([]);
    }
  });
});

// ── 2. display words are never stored phases ────────────────────────────────

const DISPLAY_ONLY = new Set(['confirmed', 'finishing', 'verifying', 'failed']);
const DISPLAY_ONLY_KEYS = new Set(['CONFIRMED', 'FINISHING', 'VERIFYING', 'FAILED']);
const COMPARE = new Set(['===', '!==', '==', '!=']);

/** A display-only word: the literal, or any constant member named for one — whichever table holds it (S2a review A5-8). */
const isDisplayOnly = (n) => (n?.type === 'Literal' && DISPLAY_ONLY.has(n.value))
  || (n?.type === 'MemberExpression' && !n.computed && DISPLAY_ONLY_KEYS.has(n.property?.name));
const keyName = (k) => (k?.type === 'Identifier' ? k.name : k?.type === 'Literal' ? String(k.value) : null);
/** An object literal, bare or frozen, with a display-only key. */
const displayKeyedObject = (n) => {
  const obj = n?.type === 'CallExpression' && n.arguments?.[0]?.type === 'ObjectExpression' ? n.arguments[0] : n;
  return obj?.type === 'ObjectExpression' && obj.properties.some((p) => p.type === 'Property' && DISPLAY_ONLY.has(keyName(p.key)));
};

function storedPhaseBranches(code) {
  const hits = [];
  const ast = parse(code);
  // Bindings that hold a stored phase (`const { phase: p } = attempt`) and tables keyed by display words.
  const phaseNames = new Set(['phase']);
  const displayTables = new Set();
  walk(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id?.type === 'ObjectPattern') {
      for (const p of node.id.properties) if (p.type === 'Property' && keyName(p.key) === 'phase' && p.value?.type === 'Identifier') phaseNames.add(p.value.name);
    }
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && displayKeyedObject(node.init)) displayTables.add(node.id.name);
  });
  /** `x.phase`, `x?.phase`, `x['phase']`, or a binding that holds one: the provider record's stored phase. */
  const isPhase = (n) => (n?.type === 'MemberExpression' && !n.computed && n.property?.name === 'phase')
    || (n?.type === 'MemberExpression' && n.computed && n.property?.type === 'Literal' && n.property.value === 'phase')
    || (n?.type === 'ChainExpression' && isPhase(n.expression))
    || (n?.type === 'Identifier' && phaseNames.has(n.name));
  // The one legitimate meeting of a `.phase` and a ceremony word: a ceremonyPhase action's own payload
  // (`action.phase`) against CEREMONY_PHASES — a ceremony phase, never a stored one.
  const ceremonyPayload = (p, other) => p?.type === 'MemberExpression' && !p.computed && p.object?.name === 'action'
    && other?.type === 'MemberExpression' && other.object?.name === 'CEREMONY_PHASES';
  walk(ast, (node) => {
    if (node.type === 'BinaryExpression' && COMPARE.has(node.operator)) {
      const branches = (p, other) => isPhase(p) && isDisplayOnly(other) && !ceremonyPayload(p, other);
      if (branches(node.left, node.right) || branches(node.right, node.left)) hits.push(`compare at ${node.start}`);
    }
    if (node.type === 'SwitchStatement' && isPhase(node.discriminant)) {
      for (const c of node.cases) if (c.test && isDisplayOnly(c.test)) hits.push(`case at ${c.start}`);
    }
    // `['confirmed', …].includes(attempt.phase)`
    if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && node.callee.property?.name === 'includes'
      && node.callee.object?.type === 'ArrayExpression' && node.callee.object.elements.some(isDisplayOnly) && node.arguments.some(isPhase)) {
      hits.push(`includes at ${node.start}`);
    }
    // `WORDS[attempt.phase]` where WORDS has a display-only key
    if (node.type === 'MemberExpression' && node.computed && isPhase(node.property) && node.object?.type === 'Identifier' && displayTables.has(node.object.name)) {
      hits.push(`lookup at ${node.start}`);
    }
    // ATTEMPT_PHASES.CONFIRMED / FAILED … read anywhere: the phase does not exist.
    if (node.type === 'MemberExpression' && !node.computed && node.object?.name === 'ATTEMPT_PHASES' && DISPLAY_ONLY_KEYS.has(node.property?.name)) {
      hits.push(`ATTEMPT_PHASES.${node.property.name}`);
    }
  });
  return hits;
}

describe('display words are never stored phases (spec §5.2)', () => {
  const files = () => [...selectorFiles(), 'src/components/CommandCenter/hub/deployDisplay.js'];

  it('no selector or display file branches on a stored phase named confirmed, finishing, verifying or failed', () => {
    const hits = files().flatMap((rel) => storedPhaseBranches(read(rel)).map((h) => `${rel}: ${h}`));
    expect(hits).toEqual([]);
  });

  it('the scan flags each way such a branch can be written', () => {
    for (const planted of [
      "if (attempt.phase === 'confirmed') x();", "if ('failed' === a.phase) x();", "const v = attempt?.phase !== 'finishing';",
      "switch (attempt.phase) { case 'verifying': break; default: }", 'if (a.phase === ATTEMPT_PHASES.CONFIRMED) x();',
      "switch (phase) { case 'failed': break; }", 'const p = ATTEMPT_PHASES.FAILED;', 'if (a.phase === STATES.FINISHING) x();',
      // S2a review A5-8 (PL-08, PL-09, PL-10, PL-24, PL-25, PL-26).
      "if (['confirmed', 'failed'].includes(attempt.phase)) x();", "const { phase: p } = attempt; if (p === 'failed') x();",
      "const WORDS = { confirmed: 'a', idle: 'b' }; const w = WORDS[attempt.phase];", "if (attempt['phase'] === 'verifying') x();",
      'if (attempt.phase === ATTEMPT_DISPLAY.CONFIRMED) x();', 'if (attempt.phase === CEREMONY_PHASES.VERIFYING) x();',
      "const WORDS = Object.freeze({ failed: 'a' }); const w = WORDS[a.phase];",
    ]) {
      expect(storedPhaseBranches(planted), planted).not.toEqual([]);
    }
    for (const fine of [
      "if (attempt.phase === 'created') x();", 'if (ceremony === CEREMONY_PHASES.VERIFYING) x();',
      "if (attempt.ceremonyPhase === 'verifying') x();", "if (displayState === 'confirmed') x();",
      "switch (displayState) { case 'failed': break; }", 'const w = ATTEMPT_DISPLAY.CONFIRMED;',
      'if (state.attempt.ceremonyPhase === action.phase) x();', "if (['created', 'existing'].includes(attempt.phase)) x();",
      'if (action.phase === CEREMONY_PHASES.VERIFYING) x();',
      "const WORDS = { created: 'a' }; const w = WORDS[attempt.phase];", "const S = { failed: 'a' }; const w = S[displayState];",
    ]) {
      expect(storedPhaseBranches(fine), fine).toEqual([]);
    }
  });
});

// ── 3. the cooldown agrees with the server and the shipped ceremony ─────────

describe('display agreement: the 120 s cooldown (BUILD_RULES §9)', () => {
  it('the reducer\'s DEPLOY_COOLDOWN_MS is decide.js\'s per-agent cooldown and DeployCeremony\'s DEPLOY_LOCK_MS', () => {
    expect(DEPLOY_COOLDOWN_MS).toBe(120000);
    expect(read('src/components/Dashboard/deployCeremony/DeployCeremony.jsx')).toMatch(/\nconst DEPLOY_LOCK_MS = 120000;/);
    const decide = read('api/agent/decide.js');
    expect(decide).toMatch(/if \(sinceLastDeploy < 120000\) \{\n\s*return res\.status\(429\)/);
  });

  it('the server sets no Retry-After header today, so no cooldown is ever read from one (spec §5.4)', () => {
    expect(read('api/agent/decide.js')).not.toMatch(/retry-after/i);
    expect(read('src/services/agentDeploy.js')).not.toMatch(/retry-after/i);
  });
});
