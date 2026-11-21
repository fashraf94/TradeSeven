// src/config/filmRoomFlowFlags.test.js
//
// Film Room D1 item 1 — THE FLAG PIN (BUILD_RULES §2), Build D spec §2 and
// ruling FL-14. FILM_ROOM_FLOW_MODE is a STRING TRI-STATE after the
// FILM_ROOM_CARDS_MODE pattern (filmRoomCardsFlags.test.js): pinned directly
// here (the pin, the allowed values, the literal and its Pinned-by pointer),
// never a DARK_BY_DESIGN key — the guard scans `*_ENABLED` booleans only. It
// merges at 'allowlist' (FL-14). A flip ('allowlist' → 'on', or a rollback to
// 'off') moves the first row below in its own founder PR.
//
// This file is the pin, not a behaviour test: the flow's off-path goldens and
// the screen suites mock the flag explicitly, so none of them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { FILM_ROOM_FLOW_MODE, FILM_ROOM_FLOW_MODES } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

const docstringOf = (name) => {
  const idx = SRC.indexOf(`export const ${name} = `);
  const prev = SRC.lastIndexOf('/**', idx);
  return SRC.slice(prev, idx);
};

describe('FILM_ROOM_FLOW_MODE — the pin (BUILD_RULES §2; Build D spec §2, FL-14)', () => {
  it("is 'allowlist': the front only for the owners the cockpit's server-side allowlist admits; everyone else is the 'off' screen", () => {
    // THE ROW THAT MOVES WITH A FLIP ('allowlist' → 'on', or back to 'off'), in the flip PR's own commit.
    expect(FILM_ROOM_FLOW_MODE).toBe('allowlist');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(FILM_ROOM_FLOW_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(FILM_ROOM_FLOW_MODES)).toBe(true);
    expect(FILM_ROOM_FLOW_MODES).toContain(FILM_ROOM_FLOW_MODE);
    expect(typeof FILM_ROOM_FLOW_MODE).toBe('string');
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway, its rollback and the shared verdict are written beside it', () => {
    expect(SRC).toMatch(/^export const FILM_ROOM_FLOW_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const FILM_ROOM_FLOW_MODE = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: filmRoomFlowFlags.test.js');
    const doc = docstringOf('FILM_ROOM_FLOW_MODE');
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('never a build PR');
    expect(doc).toContain('PER BATTLE OWNER');
    expect(doc).toContain('cockpit-status');
    expect(doc).toContain('readFilmRoomVerdict');
    expect(doc).toContain('ROLLBACK');
    expect(doc).toContain('FL-14');
    expect(doc).toContain('byte for byte');
    expect(doc).toContain('NOTHING THE AGENT SEES OR TRADES');
  });

  it('never a DARK_BY_DESIGN key (the guard scans *_ENABLED booleans only), and no boolean twin exists', () => {
    expect(GUARD).not.toMatch(/^\s*FILM_ROOM_FLOW_MODE\s*:/m);
    expect(SRC).not.toMatch(/^export const FILM_ROOM_FLOW_ENABLED\b/m);
  });
});
