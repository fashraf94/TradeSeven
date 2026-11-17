// api/_utils/filmRoom/cardStages.b6Pin.test.js
//
// Film Room C2 item 7 (Build C Amendment C CC-9 item 3; Astra C1 backlog CA-8) — B6'S PIN. The Film Room's copy of
// the nomination expiry, `NOMINATION_EXPIRY_SESSIONS` (src/data/cardStages.js — zero-import by design, so the pin lives
// here, in a test), is the Practice Field's own B6 slot: `PRACTICE_FIELD_SLOTS.B6_NOMINATION_EXPIRY_SESSIONS` in
// src/data/practiceFieldSlots.js (contract V2 Amendment B item 9). A change to either without the other fails here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): both data modules are imported by api/ code; these imports, never mocked,
// are the runtime guard that they stay Node-clean.
import { NOMINATION_EXPIRY_SESSIONS } from '../../../src/data/cardStages.js';
import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

describe('B6 — the Film Room\'s nomination expiry is the Practice Field\'s slot', () => {
  it('NOMINATION_EXPIRY_SESSIONS equals PRACTICE_FIELD_SLOTS.B6_NOMINATION_EXPIRY_SESSIONS (10 sessions today)', () => {
    expect(Number.isInteger(PRACTICE_FIELD_SLOTS.B6_NOMINATION_EXPIRY_SESSIONS)).toBe(true);
    expect(NOMINATION_EXPIRY_SESSIONS).toBe(PRACTICE_FIELD_SLOTS.B6_NOMINATION_EXPIRY_SESSIONS);
    expect(NOMINATION_EXPIRY_SESSIONS).toBe(10);
  });
  it('cardStages.js stays zero-import — which is why the pin is a test', () => {
    const src = readFileSync(path.join(REPO, 'src/data/cardStages.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/\bimport\s*\(/);
  });
});
