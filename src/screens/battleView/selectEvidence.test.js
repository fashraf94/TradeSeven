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
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import {
  evidenceFacts,
  evidenceFactLines,
  evidenceHeading,
  provenanceLine,
  regimeWord,
  regimeLabel,
  REGIME_LABELS,
  REGIME_WORDS,
  riskWord,
  RISK_WORDS,
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

  // ── One walk, two renders (BUILD_RULES §9) ───────────────────────────────
  //
  // `evidenceFacts` is the walk; `evidenceFactLines` is `.map(f => f.text)`.
  // The narrator's YOUR RECORD block renders the LINES and must keep printing
  // the token the decider's prompt printed — the evidence claim is "this is
  // what the check saw", and a friendlier word would show something it never
  // saw. The panel renders the ENTRIES and shows the player's word with the
  // token on its `title`. One walk means the two can't name different tokens.
  it('the lines are the entries\' `text`, in order — the narrator sees no change', () => {
    expect(evidenceFactLines(FULL)).toEqual(evidenceFacts(FULL).map((f) => f.text));
    // …and the regime line among them is still the raw token, byte for byte.
    expect(evidenceFactLines(FULL)).toContain('Regime directional_expansion');
    expect(evidenceFactLines(FULL)).not.toContain('Regime · Expanding');
  });

  it('only the regime entry is translated — every other label IS its text, with no title', () => {
    for (const fact of evidenceFacts(FULL)) {
      if (fact.title) {
        expect(fact.text).toBe('Regime directional_expansion');
        expect(fact.label).toBe('Regime · Expanding');
        expect(fact.title).toBe('directional_expansion');
      } else {
        expect(fact.label).toBe(fact.text);
        expect(fact.title).toBeNull();
      }
    }
    expect(evidenceFacts(FULL).filter((f) => f.title)).toHaveLength(1);
  });

  it('the panel\'s word comes from the ONE map — the same one both Agent feeds read', () => {
    for (const token of REGIME_WORDS) {
      const [fact] = evidenceFacts({ regime: token });
      expect(fact.label).toBe(`Regime · ${REGIME_LABELS[token]}`);
      expect(fact.label).toBe(`Regime · ${regimeLabel(token)}`);
      expect(fact.title).toBe(token);
      expect(fact.text).toBe(`Regime ${token}`);
    }
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

  // Review A-4: the risk action is a CLOSED vocabulary, for the reason
  // `regimeWord` and `WOKEN_BY_TYPE` are closed (D-81). A new action added to
  // the fenced risk manager must arrive SILENT, not as a raw machinery token
  // on a player surface.
  it('the four ruled non-HOLD verdicts render, and HOLD is absent BY RULE', () => {
    for (const word of RISK_WORDS) {
      expect(riskWord(word)).toBe(word);
      expect(evidenceFactLines({ risk: { action: word } })).toEqual([`Risk ${word}`]);
    }
    expect(RISK_WORDS).not.toContain('HOLD');
    expect(riskWord('HOLD')).toBeNull();
  });

  it('an UNRULED action renders nothing — never a raw token', () => {
    for (const unruled of ['BRAND_NEW', 'WARNING', 'hold', 'Lock', 'SWAP', '']) {
      expect(riskWord(unruled)).toBeNull();
      expect(evidenceFactLines({ px: 100, risk: { action: unruled } })).toEqual(['Price $100.00']);
    }
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

  // Review A-3. `etTime` is time-only. A rankings doc from a missed overnight
  // run rendered as "Rankings as of 7:00 AM" — days stale, reading as a time
  // later TODAY. That is the M-2 overclaim wearing a different hat.
  it('an instant from ANOTHER ET day carries its date', () => {
    const check = '2026-09-01T13:45:00.000Z'; // 9:45 AM ET, Sep 1
    const line = provenanceLine(
      { techAt: '2026-08-29T20:05:00.000Z', rankingsAt: '2026-08-31T11:00:00.000Z' },
      timeText, check,
    );
    expect(line).toBe('Latest held technical stamp · Aug 29 4:05 PM · Rankings as of Aug 31 7:00 AM');
  });

  it('an instant on the CHECK\'s own ET day keeps the bare time', () => {
    const check = '2026-09-01T18:45:00.000Z';
    expect(provenanceLine({ techAt: '2026-09-01T18:29:55.000Z' }, timeText, check))
      .toBe('Latest held technical stamp · 2:29 PM');
  });

  it('with no check instant to compare against, the bare time stands', () => {
    expect(provenanceLine({ techAt: '2026-08-29T20:05:00.000Z' }, timeText))
      .toBe('Latest held technical stamp · 4:05 PM');
  });

  it('the ET DAY decides, not UTC — a late-evening ET instant is still that day', () => {
    // 2026-09-02T01:30:00Z is Sep 1, 9:30 PM ET: the same ET day as the check,
    // a different UTC day. A UTC comparison would wrongly stamp it "Sep 2".
    expect(provenanceLine({ techAt: '2026-09-02T01:30:00.000Z' }, timeText, '2026-09-01T18:45:00.000Z'))
      .toBe('Latest held technical stamp · 9:30 PM');
  });
});

describe('heardLine — the copy layer\'s half of "Not heard is a claim too" (review C-8)', () => {
  const filed = (heard) => ({ state: 'filed', at: '2026-09-01T15:31:00.000Z', heard });

  it('renders each verdict from a well-formed stamp', () => {
    expect(COPY.heardLine(filed({ at: '2026-09-01T15:31:00.000Z', heard: true })))
      .toBe('Heard at the 11:30 AM check');
    expect(COPY.heardLine(filed({ at: '2026-09-01T15:31:00.000Z', heard: false })))
      .toBe('Not heard at this check');
  });

  it('an UNRECOGNISED stamp makes NO claim — defence in depth behind the walk', () => {
    // `heardStamps` guarantees a strict boolean today, so this branch is a
    // second line rather than a live bug — but the rule "Not heard is a claim
    // too" was pinned only at the derivation layer, and the copy layer is
    // where a future caller would hand in something looser.
    for (const bad of [{ heard: 'yes' }, { heard: 1 }, { heard: null }, {}, 'x', 42]) {
      expect(COPY.heardLine(filed(bad))).toBeNull();
    }
    expect(COPY.heardLine(filed(null))).toBeNull();
    expect(COPY.heardLine(null)).toBeNull();
  });

  // THE ASYMMETRY, AT THE COPY LAYER. The positive names its own check and is
  // true wherever it is read; the negative names none and borrows the
  // reader's, so it can only mean the latest one.
  it('the DEICTIC negative stays on the current card — every other state gets no line', () => {
    const stamp = { at: '2026-09-01T15:31:00.000Z', heard: false };
    for (const state of ['replaced', 'expired', undefined]) {
      expect(COPY.heardLine({ state, at: null, heard: stamp })).toBeNull();
    }
    // …and it is the STATE doing that, not the stamp: the same receipt under
    // `filed` renders. Without this the row above passes on a heardLine that
    // returned null for everything.
    expect(COPY.heardLine({ state: 'filed', at: null, heard: stamp })).toBe('Not heard at this check');
  });

  it('the POSITIVE travels — it names its own check, so every card state renders it', () => {
    const stamp = { at: '2026-09-01T15:31:00.000Z', heard: true };
    for (const state of ['filed', 'replaced', 'expired', undefined]) {
      expect(COPY.heardLine({ state, at: null, heard: stamp })).toBe('Heard at the 11:30 AM check');
    }
  });
});
