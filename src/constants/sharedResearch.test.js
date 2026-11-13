// src/constants/sharedResearch.test.js
//
// Shared Research B1 — the vocabulary's pins (spec §6.1, §7.3, §8, F9). The
// restated values equal their sources; the module imports nothing; the beat
// table keys are the reporters' own beats; the label rule of §7.3.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  ENTRY_ITEM_RECORD_KINDS, BEAT_QUESTIONS, DEFAULT_BEAT_QUESTION, questionForBeat, ADOPTABLE_HORIZONS, HORIZON_SESSIONS,
  HORIZON_LABELS, RELATIONSHIP_ROLES, STEP_BUDGET, PER_DAY, FRAMINGS_PER_DAY, GLOBAL_STEPS_PER_DAY_DEFAULT, AGE_DAYS,
  findingLabelOf, STATUS_REASON_LABELS,
} from './sharedResearch.js';
import { HORIZON_WINDOW_SESSIONS, HORIZON_ENUMS } from './hypothesisRecords.js';
import { REPORTER_PROFILES } from '../../api/_utils/fantasyTimesPrompts.js';

const SRC = readFileSync(fileURLToPath(new URL('./sharedResearch.js', import.meta.url)), 'utf8');

describe('src/constants/sharedResearch.js', () => {
  it('imports nothing (Node-clean for the api/ importers, BUILD_RULES §4)', () => {
    expect(SRC).not.toMatch(/^\s*import\b/m);
    expect(SRC).not.toMatch(/\brequire\(|\bimport\(/);
  });

  it('the spec §6.1 values', () => {
    expect(ENTRY_ITEM_RECORD_KINDS).toEqual(['fantasyTimesStories', 'signalDrops']);
    expect([STEP_BUDGET, PER_DAY, FRAMINGS_PER_DAY, GLOBAL_STEPS_PER_DAY_DEFAULT, AGE_DAYS]).toEqual([10, 3, 10, 150, 2]);
    expect(RELATIONSHIP_ROLES).toEqual(['Product owner', 'Supplier', 'Customer', 'Partner', 'Competitor', 'Other']);
  });

  it('the three horizons are idea-record horizons with the record windows (F9); never intraday or unspecified', () => {
    expect(ADOPTABLE_HORIZONS).toEqual(['swing', 'positional', 'longterm']);
    for (const h of ADOPTABLE_HORIZONS) {
      expect(HORIZON_ENUMS).toContain(h);
      expect(HORIZON_SESSIONS[h]).toBe(HORIZON_WINDOW_SESSIONS[h]);
      expect(HORIZON_LABELS[h]).toBe(`${h} · about ${HORIZON_WINDOW_SESSIONS[h]} sessions`);
    }
    expect(ADOPTABLE_HORIZONS).not.toContain('intraday');
    expect(ADOPTABLE_HORIZONS).not.toContain('unspecified');
  });

  it("every beat question is keyed by a reporter's own beat; any other beat gets the default", () => {
    const beats = Object.values(REPORTER_PROFILES).map((p) => p.beat);
    for (const key of Object.keys(BEAT_QUESTIONS)) expect(beats).toContain(key);
    expect(questionForBeat('Market Pulse')).toBe(BEAT_QUESTIONS['Market Pulse']);
    expect(questionForBeat('Thematic & Industry Research')).toBe(DEFAULT_BEAT_QUESTION);
    expect(questionForBeat(undefined)).toBe(DEFAULT_BEAT_QUESTION);
    expect(questionForBeat('toString')).toBe(DEFAULT_BEAT_QUESTION);
  });

  it('the §7.3 label rule', () => {
    expect(findingLabelOf({ kind: 'release', status: 'verified', statusReason: null })).toBe('Source-backed');
    expect(findingLabelOf({ kind: 'observation', status: 'unverified', statusReason: 'player_words' })).toBe('Your observation');
    expect(findingLabelOf({ kind: 'observation', status: 'unverified', statusReason: 'player_drop' })).toBe('Your drop');
    expect(findingLabelOf({ kind: 'coverage', status: 'unverified', statusReason: 'reporter_content' })).toBe('From FantasyTimes');
    expect(findingLabelOf({ kind: 'inference', status: 'unverified', statusReason: 'from_drop' })).toBe('From your drop');
    expect(findingLabelOf({ kind: 'inference', status: 'unverified', statusReason: 'inference' })).toBe('Inferred');
    expect(findingLabelOf({ kind: 'relationship', status: 'unavailable', statusReason: 'not_disclosed' })).toBe('Unresolved · Not disclosed');
    expect(findingLabelOf({ kind: 'relationship', status: 'unavailable', statusReason: 'some_new_word' })).toBe('Unresolved · Unresolved');
    expect(STATUS_REASON_LABELS.identity_unresolved).toBe("Symbol · not in the app's records");
  });
});
