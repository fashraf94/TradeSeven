// src/config/voiceGroundingFlags.test.js
//
// Voice-layer grounding — THE FLAG PIN (BUILD_RULES §2).
//
// VOICE_GROUNDING_MODE is a STRING tri-state ('off' | 'shadow' | 'canary' |
// 'on'), so the flag-pin guard — which scans `*_ENABLED = true|false` and
// `expect(FLAG).toBe(true|false)` only — cannot see it, and DARK_BY_DESIGN
// cannot hold it (its integrity test rejects any key outside the boolean map).
// It is pinned HERE, directly, the MANDATE_TRANSPORT_MODE precedent
// (mandateFlags.test.js:44), with no boolean companion (Sep 7 ruling 3).
//
// The walk is the founder's: 'off' → 'shadow' → 'canary' → 'on', one one-line
// PR per step, and EACH step moves the first row below with it (BUILD_RULES §2
// — a flip that leaves a pin behind reddens every other open PR). A rollback
// moves it back. Nothing else in this file pins a value; the rest are contracts
// that hold in every state so they survive the walk intact.
//
// Deliberately pins ONLY this flag (the characterPaneFlags.test.js precedent):
// pinning a flag obliges its docstring to name this file, so an unrelated flag
// added here "as context" would couple its future flip to this arc.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  VOICE_GROUNDING_MODE,
  VOICE_GROUNDING_MODES,
  getVoiceGroundingMode,
  resolveVoiceGroundingMode,
  parseVoiceGroundingCanaryUids,
} from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
// The source with every comment stripped (the deskHonesty.test.js idiom): the
// source rows below scan CODE, and the docstrings name the things they explain.
const CODE = SRC
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The body of a named export function, from its signature to its closing brace. */
// Over the comment-stripped CODE, so a read moved into a comment cannot satisfy
// a source row (review R-30).
function fnBody(name) {
  const body = CODE.slice(CODE.indexOf(`export function ${name}`));
  return body.slice(0, body.indexOf('\n}') + 2);
}

describe('Voice-layer grounding flag — the pin (BUILD_RULES §2, ruling 3)', () => {
  it("ships DARK: 'off' — every prompt byte-identical (the goldens hold the bytes)", () => {
    // THE ROW THAT MOVES WITH THE WALK. 'off' → 'shadow' → 'canary' → 'on',
    // each in its own founder PR, each updating this literal in the same commit.
    expect(VOICE_GROUNDING_MODE).toBe('off');
  });

  it('the live value is one of the four walked states', () => {
    expect(VOICE_GROUNDING_MODES).toEqual(['off', 'shadow', 'canary', 'on']);
    expect(VOICE_GROUNDING_MODES).toContain(VOICE_GROUNDING_MODE);
  });

  it('the accessor resolves the LIVE value for any caller (off today: nobody is grounded)', () => {
    // Holds in every state by the resolver's contract; asserted against the
    // live literal so this row never becomes a second pin.
    expect(getVoiceGroundingMode('any-uid')).toBe(resolveVoiceGroundingMode(VOICE_GROUNDING_MODE, 'any-uid', undefined));
    expect(getVoiceGroundingMode(null)).toBe(resolveVoiceGroundingMode(VOICE_GROUNDING_MODE, null, undefined));
  });

  it("the docstring carries the direct-pin pointer (flagPinGuard cannot keep it honest for a string enum)", () => {
    // flagPinGuard's "Pinned by:" integrity row is built from `*_ENABLED` pins,
    // so for this flag the pointer is kept honest HERE instead.
    const idx = SRC.indexOf("export const VOICE_GROUNDING_MODE = ");
    expect(idx).toBeGreaterThan(0);
    const window = SRC.slice(Math.max(0, idx - 400), idx);
    expect(window).toContain('Pinned by: voiceGroundingFlags.test.js');
  });

  it('is NOT registered in DARK_BY_DESIGN (a string flag fails that registry; ruling 3)', () => {
    const guard = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');
    expect(guard).not.toMatch(/VOICE_GROUNDING_MODE\s*:/);
  });
});

describe('The canary allowlist — an ENV VAR, parsed at call time, fails closed (ruling 2, hazard 21)', () => {
  it('parses a comma-separated list, trimming and dropping empties', () => {
    expect(parseVoiceGroundingCanaryUids('uidA, uidB ,,uidC')).toEqual(['uidA', 'uidB', 'uidC']);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace and commas', ' , ,  '],
    ['a non-string', 42],
  ])('%s → nobody', (_label, raw) => {
    expect(parseVoiceGroundingCanaryUids(raw)).toEqual([]);
  });

  it('no uid literal lives in the repo — the accessor reads the environment, never a constant', () => {
    expect(CODE).not.toMatch(/VOICE_GROUNDING_CANARY_UIDS\s*=/);
    expect(fnBody('getVoiceGroundingMode')).toContain('process?.env?.VOICE_GROUNDING_CANARY_UIDS');
    // Inside the call, not at module scope: the read must not be hoisted to a
    // top-level const (a deploy that sets the variable takes effect on the
    // next request, and the client bundle never evaluates it). Comments are
    // stripped first — the docstrings NAME the variable to explain it.
    const before = CODE.slice(0, CODE.indexOf('export function getVoiceGroundingMode'));
    expect(before).not.toContain('VOICE_GROUNDING_CANARY_UIDS');
  });

  it('the accessor DELEGATES to the pure resolver with the live flag (a source row — the branch is unreachable while off)', () => {
    expect(fnBody('getVoiceGroundingMode')).toMatch(/resolveVoiceGroundingMode\(VOICE_GROUNDING_MODE,\s*uid,\s*raw\)/);
  });
});

describe('resolveVoiceGroundingMode — the per-caller contract, in every state', () => {
  it("'off' → 'off' for everyone, allowlisted or not", () => {
    expect(resolveVoiceGroundingMode('off', 'uidA', 'uidA')).toBe('off');
    expect(resolveVoiceGroundingMode('off', null, 'uidA')).toBe('off');
  });

  it("'shadow' → 'shadow' for everyone (the old prompt is sent; both are logged)", () => {
    expect(resolveVoiceGroundingMode('shadow', 'uidA', 'uidA')).toBe('shadow');
    expect(resolveVoiceGroundingMode('shadow', 'uidZ', 'uidA')).toBe('shadow');
  });

  it("'canary' → 'on' ONLY for an allowlisted uid; everyone else stays on 'shadow'", () => {
    expect(resolveVoiceGroundingMode('canary', 'uidA', 'uidA, uidB')).toBe('on');
    expect(resolveVoiceGroundingMode('canary', 'uidB', 'uidA, uidB')).toBe('on');
    expect(resolveVoiceGroundingMode('canary', 'uidZ', 'uidA, uidB')).toBe('shadow');
  });

  it("'canary' with an empty or unset list grounds NOBODY (fails closed)", () => {
    expect(resolveVoiceGroundingMode('canary', 'uidA', undefined)).toBe('shadow');
    expect(resolveVoiceGroundingMode('canary', 'uidA', '')).toBe('shadow');
    expect(resolveVoiceGroundingMode('canary', 'uidA', ' , ')).toBe('shadow');
  });

  it("'canary' never matches a null, empty or non-string uid (a prefix or an object is not an allowlisted caller)", () => {
    expect(resolveVoiceGroundingMode('canary', null, 'uidA')).toBe('shadow');
    expect(resolveVoiceGroundingMode('canary', '', 'uidA')).toBe('shadow');
    expect(resolveVoiceGroundingMode('canary', 'uid', 'uidA')).toBe('shadow');
    expect(resolveVoiceGroundingMode('canary', { toString: () => 'uidA' }, 'uidA')).toBe('shadow');
  });

  it("'on' → 'on' for everyone", () => {
    expect(resolveVoiceGroundingMode('on', 'uidZ', '')).toBe('on');
    expect(resolveVoiceGroundingMode('on', null, '')).toBe('on');
  });

  it("an out-of-vocabulary mode (a typo on the walk) resolves to 'off' — the only state that changes nothing", () => {
    expect(resolveVoiceGroundingMode('true', 'uidA', 'uidA')).toBe('off');
    expect(resolveVoiceGroundingMode('ON', 'uidA', 'uidA')).toBe('off');
    expect(resolveVoiceGroundingMode(undefined, 'uidA', 'uidA')).toBe('off');
  });

  it("'canary' never escapes the resolver", () => {
    for (const mode of VOICE_GROUNDING_MODES) {
      for (const uid of ['uidA', 'uidZ', null]) {
        expect(['off', 'shadow', 'on']).toContain(resolveVoiceGroundingMode(mode, uid, 'uidA'));
      }
    }
  });
});
