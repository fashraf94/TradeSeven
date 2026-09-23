// src/config/evalDeferredBeatFlags.test.js
//
// Eval-cron instrumentation — THE FLAG PIN (BUILD_RULES §2), build report
// docs/audits/20260923_BUILD_EVAL_DEFERRED_BEAT.md. The showItFlags.test.js
// precedent: one pin, a Pinned-by pointer the flag-pin guard keeps honest, and
// a DARK_BY_DESIGN registration that a deliberate flip drops in the same
// commit.
//
// EVAL_DEFERRED_BEAT_ENABLED ships FALSE by design: the beat's server write and
// its tape line merge dark, and the founder flips the flag in its own one-line
// PR. Because it sits in DARK_BY_DESIGN, an accidental flip fails the guard
// loudly with the runway note; a DELIBERATE flip moves the first row below to
// `true` and turns the registration row around, in the same commit.
//
// This file is the pin, not a behaviour test: the flag-off and flag-on rows of
// the beat itself live in api/cron/agent-evaluate.evalRun.test.js, which mocks
// the flag explicitly both ways. Deliberately pins ONLY this flag.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EVAL_DEFERRED_BEAT_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('EVAL_DEFERRED_BEAT_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: EVAL_DEFERRED_BEAT_ENABLED is false at merge — the founder flips it in its own PR', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(EVAL_DEFERRED_BEAT_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const EVAL_DEFERRED_BEAT_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const EVAL_DEFERRED_BEAT_ENABLED = ');
    expect(idx).toBeGreaterThan(0);
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: evalDeferredBeatFlags.test.js');
  });

  it('is registered DARK_BY_DESIGN in the guard — the entry a deliberate flip drops in the same commit', () => {
    // Keyed on the entry form (`FLAG:` at the start of a line), so a comment
    // that merely names the flag cannot satisfy it.
    expect(GUARD).toMatch(/^\s*EVAL_DEFERRED_BEAT_ENABLED:/m);
  });

  it('its docstring names the flip map and states what is NOT behind the flag', () => {
    const block = SRC.slice(SRC.indexOf('EVAL-CRON INSTRUMENTATION'), SRC.indexOf('export const EVAL_DEFERRED_BEAT_ENABLED'));
    expect(block).toContain('FLIP MAP');
    expect(block).toContain('DARK_BY_DESIGN');
    // The run document is always on; the flag must never read as gating it.
    expect(block).toContain('agentEvalRuns/{runId}');
    expect(block).toContain('always on');
  });
});
