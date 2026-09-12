// src/constants/eligibility.test.js
//
// Backing Beta PR 0 — locks the export shape of the zero-import eligibility
// constants (spec V1.3 §12 PR 0): the draft terms version, the two placeholder
// strings, their counsel markers, and the zero-import property.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this test's real import of the
// module is the runtime guard for api/eligibility/attest.js's api/ -> src/
// import — it explodes in this Node test env if a browser-only dep ever enters
// the graph. Never mock it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERMS_VERSION, ATTESTATION_COPY } from './eligibility.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'eligibility.js'), 'utf8');

describe('eligibility constants — the export shape', () => {
  it('TERMS_VERSION is the draft tag (counsel replaces it before the flip)', () => {
    expect(TERMS_VERSION).toBe('beta-2026-09-draft');
  });

  it('ATTESTATION_COPY carries exactly the two strings — adult and terms — frozen and non-empty', () => {
    expect(Object.keys(ATTESTATION_COPY).sort()).toEqual(['adult', 'terms']);
    for (const key of ['adult', 'terms']) {
      expect(typeof ATTESTATION_COPY[key]).toBe('string');
      expect(ATTESTATION_COPY[key].trim().length).toBeGreaterThan(0);
    }
    expect(Object.isFrozen(ATTESTATION_COPY)).toBe(true);
  });

  it('has zero imports (Node-clean by construction — BUILD_RULES §4)', () => {
    expect(SRC).not.toMatch(/^\s*import\s/m);
    expect(SRC).not.toMatch(/\brequire\(/);
  });

  it('marks each placeholder string for counsel — exactly two markers, one directly above each string', () => {
    expect(SRC.match(/\/\/ COUNSEL: replace before flip/g)).toHaveLength(2);
    expect(SRC).toMatch(/\/\/ COUNSEL: replace before flip\n\s*adult: '/);
    expect(SRC).toMatch(/\/\/ COUNSEL: replace before flip\n\s*terms: '/);
  });
});
