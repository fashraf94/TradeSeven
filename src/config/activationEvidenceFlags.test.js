// src/config/activationEvidenceFlags.test.js
//
// ID-1 Build 2 — THE FLAG PIN (BUILD_RULES §2; the hypothesisRecordsFlags.test.js
// precedent): one pin, a Pinned-by pointer the flag-pin guard keeps honest, and a
// DARK_BY_DESIGN registration a deliberate flip drops in the same commit.
//
// ACTIVATION_EVIDENCE_ENABLED is TRUE (2026-11-06, the founder's flip PR, after the
// rules for the two new collections were published and the (ownerId, createdAt)
// index and the two observer-state exemptions were Enabled). It was built dark
// (FALSE); the flip moved the first row below to `true`, turned the registration
// row around (`.not.toMatch`), and dropped the DARK_BY_DESIGN entry, in one
// commit. A rollback moves the flag line and both rows back together.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ACTIVATION_EVIDENCE_ENABLED } from './activationEvidenceFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'activationEvidenceFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

describe('ACTIVATION_EVIDENCE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is ON: ACTIVATION_EVIDENCE_ENABLED is true', () => {
    // THE ROW THAT MOVED WITH THE FLIP, in the founder's flip commit itself.
    expect(ACTIVATION_EVIDENCE_ENABLED).toBe(true);
  });
  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const ACTIVATION_EVIDENCE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const ACTIVATION_EVIDENCE_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: activationEvidenceFlags\.test\.js/);
  });
  it('its module is registered with the guard, and the flag is NOT registered as dark by design (it ships true)', () => {
    expect(GUARD).toMatch(/'src\/config\/activationEvidenceFlags\.js'/);
    expect(GUARD).not.toMatch(/^ {2}ACTIVATION_EVIDENCE_ENABLED:$/m);
  });
  it('the module has no imports (nothing on the client reads it)', () => {
    expect(SRC).not.toMatch(/^import /m);
  });
});
