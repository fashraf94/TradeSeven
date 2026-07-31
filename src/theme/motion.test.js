// Acceptance suite for the motion vocabulary — spec V1 §7 rows A1–A4.
// Delight Layer arc, Task 3 (Phase 1 — DEFINE, inert).
// Basis: docs/audits/20260731_DELIGHT_MOTION_TOKENS_PHASE0_DISCOVERY.md
//
// Runs in the default 'node' environment (no DOM needed). The import of ./motion.js
// below IS the purity/import guard (BUILD_RULES §4): motion.js must stay React-free,
// framer-motion-free and DOM-free, so if a browser dep ever entered its graph this
// node-env import would explode at load. Do NOT mock ./motion.js — that would defeat
// the guard.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { MOTION, motionToken, snappy, quick, smooth, bouncy, gesture, instant } from './motion.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(HERE, 'motion.js'), 'utf8');

// Strip block + line comments so the A4 source scan sees CODE only. The docblock
// legitimately NAMES the browser globals it promises never to touch (e.g. "does NOT
// read matchMedia"), so a raw-substring scan would false-positive on the documentation.
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// The six token names, in lock order. New names are a spec change, not a value tune.
const NAMES = ['snappy', 'quick', 'smooth', 'bouncy', 'gesture', 'instant'];
const SPRINGS = ['snappy', 'bouncy', 'gesture'];
const TWEENS = ['quick', 'smooth', 'instant'];

/**
 * The STOP-locked value table (founder rulings, July 31 2026). Duplicated here
 * DELIBERATELY, independent of motion.js: if a shipped value drifts, this table does
 * NOT move with it, so A2 fails. A test that read the values back out of the module
 * under test could not detect drift. A deliberate D5 tune updates BOTH in one commit.
 */
const LOCKED = Object.freeze({
  snappy: { type: 'spring', stiffness: 300, damping: 25 },
  quick: { duration: 0.2 },
  smooth: { duration: 0.3, ease: 'easeOut' },
  bouncy: { type: 'spring', stiffness: 300, damping: 20 },
  gesture: { type: 'spring', stiffness: 300, damping: 30 },
  instant: { duration: 0 },
});

const EXPORTS = { snappy, quick, smooth, bouncy, gesture, instant };

// ---------------------------------------------------------------------------
// A1 — defines-vocabulary: every name exists and is a valid Framer transition shape.
// Fails on a missing name or a malformed shape.
// ---------------------------------------------------------------------------
describe('A1 defines-vocabulary', () => {
  it('exports all six names as objects, both individually and via MOTION', () => {
    expect(Object.keys(MOTION)).toEqual(NAMES);
    for (const name of NAMES) {
      expect(EXPORTS[name], `named export "${name}" missing`).toBeTypeOf('object');
      expect(MOTION[name], `MOTION.${name} missing`).toBe(EXPORTS[name]);
    }
  });

  it('each spring token is a valid Framer spring (type + numeric stiffness/damping)', () => {
    for (const name of SPRINGS) {
      const t = MOTION[name];
      expect(t.type, `${name}.type`).toBe('spring');
      expect(t.stiffness, `${name}.stiffness`).toBeTypeOf('number');
      expect(t.stiffness).toBeGreaterThan(0);
      expect(t.damping, `${name}.damping`).toBeTypeOf('number');
      expect(t.damping).toBeGreaterThan(0);
    }
  });

  it('each tween token is a valid Framer tween (numeric duration, no spring type)', () => {
    for (const name of TWEENS) {
      const t = MOTION[name];
      expect(t.duration, `${name}.duration`).toBeTypeOf('number');
      expect(t.duration).toBeGreaterThanOrEqual(0);
      expect(t.type, `${name} must not be a spring`).not.toBe('spring');
    }
    // smooth carries the house ease; a Framer string easing is valid.
    expect(smooth.ease).toBe('easeOut');
  });
});

// ---------------------------------------------------------------------------
// A2 — locked-values: frozen-baseline diff. Fails on any drift from the STOP table.
// ---------------------------------------------------------------------------
describe('A2 locked-values', () => {
  it('every token deep-equals the STOP-locked table exactly', () => {
    for (const name of NAMES) {
      expect(MOTION[name], `value drift on "${name}" — update LOCKED in this file in the same commit as any D5 tune`).toEqual(LOCKED[name]);
    }
  });

  it('the vocabulary has exactly the six locked names — no additions, no removals', () => {
    expect(Object.keys(MOTION).sort()).toEqual(Object.keys(LOCKED).sort());
  });
});

// ---------------------------------------------------------------------------
// A3 — reduced-motion: accessor returns `instant` under reduced motion, the named
// token otherwise. Fails if the branch inverts or is dropped.
// ---------------------------------------------------------------------------
describe('A3 reduced-motion accessor', () => {
  it('returns the named token when reducedMotion is false (and by default)', () => {
    for (const name of NAMES) {
      expect(motionToken(name, { reducedMotion: false })).toBe(MOTION[name]);
      expect(motionToken(name)).toBe(MOTION[name]); // default is false
    }
  });

  it('returns `instant` for every name when reducedMotion is true', () => {
    for (const name of NAMES) {
      expect(motionToken(name, { reducedMotion: true })).toBe(instant);
    }
  });

  it('actually swaps — a non-instant token differs between the two modes (catches a dropped branch)', () => {
    for (const name of NAMES.filter((n) => n !== 'instant')) {
      const active = motionToken(name, { reducedMotion: false });
      const reduced = motionToken(name, { reducedMotion: true });
      expect(active).not.toBe(reduced);
      expect(reduced).toBe(instant);
      expect(active).toBe(MOTION[name]); // catches an inverted branch
    }
  });

  it('throws on an unknown name in BOTH modes (validates before the reduced-motion swap)', () => {
    expect(() => motionToken('nope')).toThrow(/unknown motion token/);
    expect(() => motionToken('nope', { reducedMotion: true })).toThrow(/unknown motion token/);
  });
});

// ---------------------------------------------------------------------------
// A4 — purity + import guard: no React, no framer-motion, no DOM, frozen exports.
// The top-of-file import is itself the node-env dependency-surface guard.
// ---------------------------------------------------------------------------
describe('A4 purity', () => {
  it('imports neither React nor framer-motion', () => {
    expect(CODE).not.toMatch(/from\s+['"]react['"]/);
    expect(CODE).not.toMatch(/from\s+['"]framer-motion['"]/);
    expect(CODE).not.toMatch(/from\s+['"]motion\/react['"]/);
    expect(CODE).not.toMatch(/\bimport\b/); // no imports at all — the vocabulary stands alone
  });

  it('touches no DOM / browser global (keeps the D2 accessor injectable, not matchMedia-reading)', () => {
    for (const token of ['window', 'document', 'matchMedia', 'localStorage', 'navigator']) {
      expect(CODE, `motion.js code must not reference ${token}`).not.toContain(token);
    }
  });

  it('freezes every exported token and the MOTION map (no consumer can mutate the shared vocabulary)', () => {
    expect(Object.isFrozen(MOTION)).toBe(true);
    for (const name of NAMES) {
      expect(Object.isFrozen(MOTION[name]), `${name} not frozen`).toBe(true);
    }
  });
});
