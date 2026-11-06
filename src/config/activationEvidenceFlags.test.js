// src/config/activationEvidenceFlags.test.js
//
// ID-1 Build 2 — THE FLAG PIN (BUILD_RULES §2; the hypothesisRecordsFlags.test.js
// precedent): one pin, a Pinned-by pointer the flag-pin guard keeps honest, and a
// DARK_BY_DESIGN registration a deliberate flip drops in the same commit.
//
// ACTIVATION_EVIDENCE_ENABLED ships FALSE. The founder flips it in their own PR,
// after the rules for the two new collections are published and the
// (ownerId, createdAt) index is deployed: the first row below moves to `true`, the
// registration row turns around (`.not.toMatch`), and the flag line and the
// DARK_BY_DESIGN entry are dropped, in one commit.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ACTIVATION_EVIDENCE_ENABLED } from './activationEvidenceFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'activationEvidenceFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

describe('ACTIVATION_EVIDENCE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is DARK: ACTIVATION_EVIDENCE_ENABLED is false', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the founder's flip commit itself.
    expect(ACTIVATION_EVIDENCE_ENABLED).toBe(false);
  });
  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const ACTIVATION_EVIDENCE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const ACTIVATION_EVIDENCE_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: activationEvidenceFlags\.test\.js/);
  });
  it('its module is registered with the guard, and the flag is registered as dark by design', () => {
    expect(GUARD).toMatch(/'src\/config\/activationEvidenceFlags\.js'/);
    expect(GUARD).toMatch(/^ {2}ACTIVATION_EVIDENCE_ENABLED:$/m);
  });
  it('the module has no imports (nothing on the client reads it)', () => {
    expect(SRC).not.toMatch(/^import /m);
  });
});
