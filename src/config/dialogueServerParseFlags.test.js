// src/config/dialogueServerParseFlags.test.js
//
// Pilot P1c — THE FLAG PIN for the parse binding (BUILD_RULES §2; pilot spec
// V1.4 §2.8; founder decision E4; build report
// docs/audits/20261022_BUILD_PILOT_P1C_REVIEW_EXPERIENCE.md). The
// hypothesisRecordsFlags.test.js precedent, as it stood before that flag's
// flip: one pin, a Pinned-by pointer the flag-pin guard keeps honest, and a
// DARK_BY_DESIGN registration a deliberate flip drops in the same commit.
//
// DIALOGUE_SERVER_PARSE_ENABLED shipped FALSE, and the founder flipped it TRUE
// in its own PR (P1c Part D, 2026-10-28): the first row below moved to `true`
// and the registration row turned around, in the same commit, with the flag
// line and the DARK_BY_DESIGN entry dropped (four edits). A rollback is the
// same four edits back: the pin to `false`, the registration row to
// `.toMatch`, and the entry re-added.
//
// This file is the pin, not a behaviour test: the flag-off rows (the off
// golden) and the flag-on rows live beside the dialogue
// (api/forge/watchlist-dialogue.parseBinding*.test.js), and each mocks the
// flag explicitly, so none of them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { DIALOGUE_SERVER_PARSE_ENABLED, isDialogueServerParseOn } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('DIALOGUE_SERVER_PARSE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is LIVE: DIALOGUE_SERVER_PARSE_ENABLED is true — flipped in the founder\'s own PR (P1c Part D)', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the founder's flip commit itself.
    expect(DIALOGUE_SERVER_PARSE_ENABLED).toBe(true);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const DIALOGUE_SERVER_PARSE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const DIALOGUE_SERVER_PARSE_ENABLED = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: dialogueServerParseFlags.test.js');
  });

  it('is NOT registered DARK_BY_DESIGN while it ships true (the flip dropped the entry; a rollback re-adds it)', () => {
    expect(GUARD).not.toMatch(/^\s*DIALOGUE_SERVER_PARSE_ENABLED:/m);
  });

  it('the accessor is the constant and nothing else — no URL, storage or environment override', () => {
    expect(isDialogueServerParseOn()).toBe(DIALOGUE_SERVER_PARSE_ENABLED);
    const start = SRC.indexOf('export function isDialogueServerParseOn()');
    const body = SRC.slice(start, SRC.indexOf('}', start) + 1);
    expect(body).toMatch(/return DIALOGUE_SERVER_PARSE_ENABLED;/);
    expect(body).not.toMatch(/localStorage|location|process\.env|URLSearchParams/);
  });
});
