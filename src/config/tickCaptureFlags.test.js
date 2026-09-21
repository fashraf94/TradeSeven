// src/config/tickCaptureFlags.test.js
//
// Tick capture — THE FLAG PIN (BUILD_RULES §2), spec
// docs/specs/CAPTURE_BUILD_SPEC_V1_3.md §6. The intradayFlags.test.js
// precedent: one live-state pin, a Pinned-by pointer the flag-pin guard keeps
// honest, and a DARK_BY_DESIGN registration that a deliberate flip drops in
// the same commit.
//
// This file is the pin, not a behavior test: the flag-off byte-identity rows
// live in api/cron/agent-evaluate.tickCapture.flagOff.test.js.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { TICK_CAPTURE_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('TICK_CAPTURE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('ships FALSE — the record is built dark and flips only on its own prerequisites', () => {
    expect(TICK_CAPTURE_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const TICK_CAPTURE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const TICK_CAPTURE_ENABLED = ');
    expect(idx).toBeGreaterThan(0);
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: tickCaptureFlags.test.js');
  });

  it('is registered DARK_BY_DESIGN with its runway, so an accidental flip is loud and a deliberate one drops the entry', () => {
    expect(GUARD).toMatch(/TICK_CAPTURE_ENABLED:\s*\n\s*'Tick capture/);
  });

  it('the docstring names the four flip prerequisites (spec §6) — a flip PR has something to check itself against', () => {
    const block = SRC.slice(SRC.indexOf('TICK CAPTURE — the per-check observation record'), SRC.indexOf('export const TICK_CAPTURE_ENABLED'));
    for (const prerequisite of ['TTL policy', 'index exemptions', 'overhead', 'coverage reporting']) {
      expect(block, `the docstring must name "${prerequisite}"`).toContain(prerequisite);
    }
  });
});
