// src/screens/battleView/selectEvidence.test.js
//
// Phase B (B1 client half, seed §2 / §7). The import IS the guard (BUILD_RULES
// §4): it explodes in the Node env if a browser dependency enters the graph.
// Never mocked.
//
// The rows defend four things: the stamp is presence-gated, the decided-join
// is the same one the panel uses, the eight fields render as the seed pins
// them, and the two Sol carve-outs (risk HOLD silent, the reason code never
// rendered) hold under every shape.

import { describe, it, expect } from 'vitest';
import { selectEvidence } from './selectEvidence';
import {
  evidenceFactLines,
  evidenceHeading,
  provenanceLine,
  regimeWord,
  REGIME_WORDS,
} from '../../data/decisionRecord';

const T = '2026-09-01T15:31:00.000Z';
const SCORED = '2026-09-01T15:30:00.000Z';

const FULL = {
  px: 123.6, chg: 2.57, atrX: 0.83, vwapDev: 0.95, bbPct: 15, nr7: true,
  regime: 'directional_expansion', risk: { action: 'LOCK', reason: 'threshold_proximity' },
};
const VINTAGES = {
  quote: 'tick', vwap: 'tick',
  techAt: '2026-09-01T18:29:55.000Z', fundAsOf: '2026-09-08', rankingsAt: '2026-09-01T18:30:00.000Z',
};
const entry = (over = {}) => ({ timestamp: T, evidence: { NVDA: FULL }, vintages: VINTAGES, ...over });

describe('selectEvidence — presence-gated, and joined to the latest check', () => {
  it('returns the piece\'s row, the check\'s instant and the entry\'s own vintages', () => {
    expect(selectEvidence(entry(), 'NVDA', SCORED)).toEqual({
      checkedAt: T, evidence: FULL, vintages: VINTAGES,
    });
  });

  it('NO STAMP, NO SECTION — the pre-flip battle, budget_skipped, and a prompt-build throw', () => {
    expect(selectEvidence({ timestamp: T }, 'NVDA', SCORED)).toBeNull();
    expect(selectEvidence({ timestamp: T, evidence: {} }, 'NVDA', SCORED)).toBeNull();
  });

  it('a name with no row in the stamp gets nothing — never an empty placeholder', () => {
    expect(selectEvidence(entry(), 'TSLA', SCORED)).toBeNull();
  });

  it('a STALE entry is refused by the same `>=` join the panel applies (hazard 21)', () => {
    // The entry predates the scoring stamp: the words and the evidence must
    // never come from two different checks.
    expect(selectEvidence(entry(), 'NVDA', '2026-09-01T15:45:00.000Z')).toBeNull();
  });

  it('the book panel (no symbol), a null entry and a timestamp-less entry are all null', () => {
    expect(selectEvidence(entry(), null, SCORED)).toBeNull();
    expect(selectEvidence(null, 'NVDA', SCORED)).toBeNull();
    expect(selectEvidence({ evidence: { NVDA: FULL } }, 'NVDA', SCORED)).toBeNull();
  });

  it('vintages absent → the row still renders, with no provenance', () => {
    const out = selectEvidence(entry({ vintages: undefined }), 'NVDA', SCORED);
    expect(out.evidence).toEqual(FULL);
    expect(out.vintages).toBeNull();
  });
});

describe('the eight fields — exactly eight, and each says what it is', () => {
  it('renders all eight in order, with the labels the seed pins', () => {
    expect(evidenceFactLines(FULL)).toEqual([
      'Price $123.60',
      'Gain since entry +2.57%',
      'ATR multiple 0.83×',
      'VWAP deviation +0.95%',
      'Bollinger width 15th %ile',
      'NR7',
      'Regime directional_expansion',
      'Risk LOCK',
    ]);
  });

  it('`chg` IS ALWAYS SINCE ENTRY (Sol M-3) — never change, move or today', () => {
    const line = evidenceFactLines({ chg: 2.57 })[0];
    expect(line).toBe('Gain since entry +2.57%');
    for (const wrong of ['Change', 'Move', 'today', 'changed', 'moved']) {
      expect(line).not.toContain(wrong);
    }
    // The sign is explicit in both directions.
    expect(evidenceFactLines({ chg: -1.2 })[0]).toBe('Gain since entry -1.20%');
    expect(evidenceFactLines({ chg: 0 })[0]).toBe('Gain since entry +0.00%');
  });

  it('A NULL FIELD RENDERS NOTHING — never 0, never a dash, never a placeholder', () => {
    expect(evidenceFactLines({
      px: null, chg: null, atrX: null, vwapDev: null, bbPct: null, nr7: null, regime: null, risk: null,
    })).toEqual([]);
    // And a partial stamp renders only what it has.
    expect(evidenceFactLines({ px: 10, chg: null, atrX: 1.5 })).toEqual([
      'Price $10.00', 'ATR multiple 1.50×',
    ]);
  });

  it('EIGHT MEANS EIGHT (Sol m-1) — no rsPct slot, no "RS unavailable", no ninth field', () => {
    const lines = evidenceFactLines({ ...FULL, rsPct: 72 });
    expect(lines).toHaveLength(8);
    expect(lines.join(' ')).not.toContain('72');
    expect(lines.join(' ')).not.toMatch(/RS/);
  });

  it('NR7 is a flag: true prints, false and null stay silent', () => {
    expect(evidenceFactLines({ nr7: true })).toEqual(['NR7']);
    expect(evidenceFactLines({ nr7: false })).toEqual([]);
    expect(evidenceFactLines({ nr7: null })).toEqual([]);
  });

  it('the percentile ordinal is right where English is irregular', () => {
    const pct = (n) => evidenceFactLines({ bbPct: n })[0];
    expect(pct(1)).toBe('Bollinger width 1st %ile');
    expect(pct(2)).toBe('Bollinger width 2nd %ile');
    expect(pct(3)).toBe('Bollinger width 3rd %ile');
    expect(pct(11)).toBe('Bollinger width 11th %ile');
    expect(pct(12)).toBe('Bollinger width 12th %ile');
    expect(pct(13)).toBe('Bollinger width 13th %ile');
    expect(pct(21)).toBe('Bollinger width 21st %ile');
    expect(pct(100)).toBe('Bollinger width 100th %ile');
  });

  it('the regime is the RAW TOKEN the prompt printed; an unruled value renders nothing', () => {
    for (const word of REGIME_WORDS) {
      expect(evidenceFactLines({ regime: word })).toEqual([`Regime ${word}`]);
      expect(regimeWord(word)).toBe(word);
    }
    // D-81's precedent: an unknown token is not a fact a player can read.
    expect(regimeWord('unknown')).toBeNull();
    expect(regimeWord('')).toBeNull();
    expect(evidenceFactLines({ regime: 'brand_new_regime' })).toEqual([]);
  });
});

describe('the risk carve-out (Sol B-1, the BLOCKER)', () => {
  it('HOLD IS SILENT — the prompt renders no RISK STATUS block on an all-HOLD tick', () => {
    expect(evidenceFactLines({ risk: { action: 'HOLD' } })).toEqual([]);
    // And it stays silent inside a full stamp: seven facts, not eight.
    const lines = evidenceFactLines({ ...FULL, risk: { action: 'HOLD' } });
    expect(lines).toHaveLength(7);
    expect(lines.join(' ')).not.toContain('HOLD');
  });

  it('a NON-HOLD action renders — that block was on the page', () => {
    expect(evidenceFactLines({ risk: { action: 'LOCK' } })).toEqual(['Risk LOCK']);
  });

  it('THE REASON CODE IS NEVER RENDERED AS SEEN TEXT — the prompt carried a sentence, not the code', () => {
    for (const reason of ['threshold_proximity', 'stop_proximity', 'trailing_stop']) {
      const lines = evidenceFactLines({ ...FULL, risk: { action: 'LOCK', reason } });
      expect(lines).toContain('Risk LOCK');
      expect(lines.join(' ')).not.toContain(reason);
    }
    // The `detail` sentence is not ours to show either.
    const lines = evidenceFactLines({ risk: { action: 'LOCK', detail: 'NVDA is 0.2 ATR from its stop' } });
    expect(lines).toEqual(['Risk LOCK']);
  });

  it('a risk object with no action renders nothing', () => {
    expect(evidenceFactLines({ risk: {} })).toEqual([]);
    expect(evidenceFactLines({ risk: { action: '' } })).toEqual([]);
  });
});

describe('the heading and the provenance line (Sol M-2)', () => {
  const timeText = (iso) => new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  });

  it('the heading names the CHECK and needs a slot', () => {
    expect(evidenceHeading('12:45 PM')).toBe('What the 12:45 PM check saw');
    expect(evidenceHeading(null)).toBeNull();
  });

  it('the provenance line NAMES ITS FIELDS — never a freshness or cadence promise', () => {
    const line = provenanceLine(VINTAGES, timeText);
    expect(line).toBe('Fundamentals block as of Sep 8 · Latest held technical stamp · 2:29 PM · Rankings as of 2:30 PM');
    for (const overclaim of ['Technical data as of', 'Technicals updated', 'current at', 'daily', 'weekly']) {
      expect(line).not.toContain(overclaim);
    }
  });

  it('`fundAsOf` is a UTC CALENDAR DATE and is formatted in UTC — Sep 8 never reads as Sep 7', () => {
    // Through an ET formatter, 2026-09-08T00:00:00Z renders as Sep 7.
    expect(provenanceLine({ fundAsOf: '2026-09-08' }, timeText)).toBe('Fundamentals block as of Sep 8');
    expect(provenanceLine({ fundAsOf: '2026-01-01' }, timeText)).toBe('Fundamentals block as of Jan 1');
  });

  it('each part is independent; nothing usable → no line at all', () => {
    expect(provenanceLine({ techAt: VINTAGES.techAt }, timeText)).toBe('Latest held technical stamp · 2:29 PM');
    expect(provenanceLine({ fundAsOf: null, techAt: null, rankingsAt: null }, timeText)).toBeNull();
    expect(provenanceLine(null, timeText)).toBeNull();
    // `quote`/`vwap` are cadence words true by construction server-side; they
    // are not provenance a player reads, and never render.
    expect(provenanceLine({ quote: 'tick', vwap: 'tick' }, timeText)).toBeNull();
  });

  it('a malformed fundAsOf is dropped rather than guessed at', () => {
    expect(provenanceLine({ fundAsOf: 'weekly' }, timeText)).toBeNull();
    expect(provenanceLine({ fundAsOf: '2026-13-45' }, timeText)).toBeNull();
  });
});
