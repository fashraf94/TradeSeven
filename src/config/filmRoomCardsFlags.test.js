// src/config/filmRoomCardsFlags.test.js
//
// Film Room B2 item 8 — THE FLAG PIN (BUILD_RULES §2), Build B spec §7 and
// Amendment G RG-2 / RG-10. FILM_ROOM_CARDS_MODE is a STRING TRI-STATE after
// the FILM_ROOM_V2_MODE pattern (filmTapeFlags.test.js): pinned directly here
// (the pin, the allowed values, the literal and its Pinned-by pointer), never a
// DARK_BY_DESIGN key — the guard scans `*_ENABLED` booleans only — and noted
// by name in that block instead. A flip moves the first row below in its own
// founder PR, after the plays rules and the counter's index are deployed.
//
// This file is the pin, not a behaviour test: the cards-off byte-identity
// golden and the endpoints' 404 rows mock the flag explicitly, so none of
// them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { FILM_ROOM_CARDS_MODE, FILM_ROOM_CARDS_MODES } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

const docstringOf = (name) => {
  const idx = SRC.indexOf(`export const ${name} = `);
  const prev = SRC.lastIndexOf('/**', idx);
  return SRC.slice(prev, idx);
};

describe('FILM_ROOM_CARDS_MODE — the pin (BUILD_RULES §2; Build B spec §7)', () => {
  it("is 'allowlist': FILM_ROOM_CARDS_MODE is 'allowlist' — cards only for the owners the cockpit's server-side allowlist admits; everyone else is the 'off' screen, and both endpoints refuse them", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'allowlist' → 'on'), in the flip PR's own commit; a rollback moves it back.
    expect(FILM_ROOM_CARDS_MODE).toBe('allowlist');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(FILM_ROOM_CARDS_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(FILM_ROOM_CARDS_MODES)).toBe(true);
    expect(FILM_ROOM_CARDS_MODES).toContain(FILM_ROOM_CARDS_MODE);
    expect(typeof FILM_ROOM_CARDS_MODE).toBe('string');
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway, its rollback and the one door are written beside it', () => {
    expect(SRC).toMatch(/^export const FILM_ROOM_CARDS_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const FILM_ROOM_CARDS_MODE = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: filmRoomCardsFlags.test.js');
    const doc = docstringOf('FILM_ROOM_CARDS_MODE');
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('never a build PR');
    expect(doc).toContain('PER BATTLE OWNER');
    expect(doc).toContain('cockpit-status');
    expect(doc).toContain('ROLLBACK');
    expect(doc).toContain('RG-7');
    expect(doc).toContain('byte for byte');
    expect(doc).toContain('NOTHING THE AGENT SEES OR TRADES');
  });

  it('never a DARK_BY_DESIGN key (the guard scans *_ENABLED booleans only), but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*FILM_ROOM_CARDS_MODE\s*:/m);
    expect(GUARD).toContain('FILM_ROOM_CARDS_MODE intentionally ABSENT');
  });

  it('no boolean twin exists: no FILM_ROOM_CARDS_ENABLED export, so the guard has nothing to half-see', () => {
    expect(SRC).not.toMatch(/^export const FILM_ROOM_CARDS_ENABLED\b/m);
  });
});
