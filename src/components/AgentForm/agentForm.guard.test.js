// src/components/AgentForm/agentForm.guard.test.js
//
// Build S0 — two static guards over the agent form code (Node; reads source, imports nothing under test).
//   1. THE SOURCE SCAN (Phase 0 report §4): the engine never loads three from a CDN or a blob, never reads a
//      window global or event, never draws a random number or reads the wall clock, and never asks a media
//      query; reduced motion and bloom arrive as arguments. The wrapper and the lab ask no media query either
//      (the lab reads framer-motion's useReducedMotion, the hub's one source, R-S7-1).
//   2. THE IMPORT GRAPH: three.js is reachable only through the lazy engine module — every importer of
//      'three' lives in engine/, the one edge into engine/ from outside is loadEngine.js's import(), App.jsx's
//      static graph reaches neither the lab nor the engine nor three, and App reaches the lab only by import().
// Each banned pattern and each graph rule is planted in a self-check, so the scanner is known to see it.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');
const REPO = path.resolve(SRC, '..');
const rel = (abs) => path.relative(REPO, abs).split(path.sep).join('/');
const read = (abs) => readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) { if (name !== 'node_modules') walk(abs, out); } else if (/\.(js|jsx)$/.test(name)) out.push(abs);
  }
  return out;
}
const isTestish = (abs) => /\.test\.(js|jsx)$/.test(abs) || /[\\/](__mocks__|__fixtures__)[\\/]/.test(abs);
const ENGINE_DIR = path.join(HERE, 'engine');
const ENGINE_FILES = walk(ENGINE_DIR).filter((f) => !isTestish(f));
const WRAPPER_FILES = walk(HERE).filter((f) => !isTestish(f) && !f.startsWith(ENGINE_DIR));
const LAB_FILES = [path.join(SRC, 'screens', 'AgentFormLab.jsx'), path.join(SRC, 'screens', 'agentFormLabReadout.js')];

const ENGINE_BANS = [
  ['a CDN', /unpkg|jsdelivr|cdnjs|https?:\/\//],
  ['a blob-URL module', /createObjectURL|\bBlob\b|__resources/],
  ['a window global or event', /\bwindow\s*\.|\bwindow\s*\[|dispatchEvent|AF_MOTION|AF_NOBLOOM|\bAF3\b/],
  ['a random number', /Math\s*\.\s*random/],
  ['the wall clock', /\bDate\b/],
  ['a media query', /matchMedia/],
];
const scan = (code, bans) => bans.filter(([, re]) => re.test(stripComments(code))).map(([what]) => what);

describe('the engine source scan', () => {
  it('reads every engine module (non-vacuous)', () => {
    expect(ENGINE_FILES.map(rel).sort()).toEqual(['armor.js', 'batch.js', 'bloom.js', 'core.js', 'engine.js', 'form.js', 'glPlatform.js', 'index.js', 'vocab.js'].map((f) => `src/components/AgentForm/engine/${f}`));
  });

  it.each(ENGINE_FILES.map((f) => [rel(f), f]))('%s: no CDN, blob module, window global, random, wall clock or media query', (_name, abs) => {
    expect(scan(read(abs), ENGINE_BANS)).toEqual([]);
  });

  it('the wrapper and the lab ask no media query and draw no random number', () => {
    for (const abs of [...WRAPPER_FILES, ...LAB_FILES]) expect(scan(read(abs), [ENGINE_BANS[3], ENGINE_BANS[5]]), rel(abs)).toEqual([]);
  });

  it('self-check: each banned pattern is caught when planted, and a comment is not code', () => {
    const planted = ["import('https://unpkg.com/three@0.184.0/build/three.module.js')", 'URL.createObjectURL(b)', 'window.AF_MOTION', "window.addEventListener('x', f)", 'const r = Math.random();', 'const d = Date.now();', 'new Date()', "matchMedia('(prefers-reduced-motion: reduce)')"];
    for (const p of planted) expect(scan(p, ENGINE_BANS), p).not.toEqual([]);
    expect(scan('// window.foo, Math.random(), Date.now()\n/* matchMedia */\nconst a = 1;', ENGINE_BANS)).toEqual([]);
  });
});

/** Static and dynamic import specifiers of a module. */
function imports(code) {
  const out = [], s = stripComments(code);
  for (const re of [/(?:^|\n)\s*import\s+[^'"]*?from\s+['"]([^'"]+)['"]/g, /(?:^|\n)\s*export\s+[^'"]*?from\s+['"]([^'"]+)['"]/g, /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g]) for (const m of s.matchAll(re)) out.push({ spec: m[1], lazy: false });
  for (const m of s.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) out.push({ spec: m[1], lazy: true });
  return out;
}
function resolve(from, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null;
  const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}
const ALL = walk(SRC).filter((f) => !isTestish(f));
const isThree = (spec) => spec === 'three' || spec.startsWith('three/');

/** The static import closure of `entry` (lazy edges not followed): first-party files and bare packages. */
function staticClosure(entry) {
  const seen = new Set(), packages = new Set(), queue = [entry];
  while (queue.length) {
    const f = queue.pop(); if (seen.has(f)) continue; seen.add(f);
    for (const { spec, lazy } of imports(read(f))) {
      if (lazy) continue;
      const r = resolve(f, spec);
      if (r) queue.push(r); else if (!spec.startsWith('.')) packages.add(spec);
    }
  }
  return { files: seen, packages };
}

describe('the import graph: three.js only through the lazy engine module', () => {
  it('every module that imports three lives in engine/ (and there are some)', () => {
    const importers = ALL.filter((f) => imports(read(f)).some(({ spec }) => isThree(spec))).map(rel);
    expect(importers.length).toBeGreaterThan(3);
    expect(importers.filter((f) => !f.startsWith('src/components/AgentForm/engine/'))).toEqual([]);
  });

  it('the one edge into engine/ from outside it is loadEngine.js\'s import() of the entry module', () => {
    const edges = [];
    for (const f of ALL) {
      if (f.startsWith(ENGINE_DIR)) continue;
      for (const { spec, lazy } of imports(read(f))) { const r = resolve(f, spec); if (r && r.startsWith(ENGINE_DIR)) edges.push(`${rel(f)} -> ${rel(r)}${lazy ? ' (lazy)' : ''}`); }
    }
    expect(edges).toEqual(['src/components/AgentForm/loadEngine.js -> src/components/AgentForm/engine/index.js (lazy)']);
  });

  it('App.jsx\'s static graph reaches one agent form module, the SVG still — no wrapper, no engine, no lab and no three', () => {
    const { files, packages } = staticClosure(path.join(SRC, 'App.jsx'));
    expect(files.size).toBeGreaterThan(200);
    // Build S1: the battle view (in App's static graph) shows the form's still while its lazy battle form loads
    // (battleView/battleAgentFormSlot.jsx); the still is SVG and imports no three. The form, its wrapper and the
    // engine stay behind import()s. Flag-off, the still folds away with the rest (the build report's dist diff).
    expect([...files].map(rel).filter((f) => f.includes('/AgentForm') || f.includes('agentFormLab'))).toEqual(['src/components/AgentForm/AgentFormStill.jsx']);
    expect([...packages].filter(isThree)).toEqual([]);
  });

  it('App reaches the lab only through one import(), and the lab\'s own static graph has no three', () => {
    const lazyToLab = imports(read(path.join(SRC, 'App.jsx'))).filter(({ spec }) => /AgentFormLab/.test(spec));
    expect(lazyToLab).toEqual([{ spec: './screens/AgentFormLab', lazy: true }]);
    const { files, packages } = staticClosure(LAB_FILES[0]);
    expect([...files].map(rel).filter((f) => f.startsWith('src/components/AgentForm/engine/'))).toEqual([]);
    expect([...packages].filter(isThree)).toEqual([]);
  });

  it('self-check: the scanner sees static, re-exported, side-effect and dynamic imports, and ignores comments', () => {
    const code = "import * as THREE from 'three';\nexport { x } from './a.js';\nimport './b.css';\nconst m = () => import('./engine/index.js');\n// import y from 'three/addons'";
    expect(imports(code)).toEqual([{ spec: 'three', lazy: false }, { spec: './a.js', lazy: false }, { spec: './b.css', lazy: false }, { spec: './engine/index.js', lazy: true }]);
  });
});
