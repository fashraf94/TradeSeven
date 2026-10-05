// api/_utils/callRecords/copy.test.js
//
// Cockpit Build 1a — COPY AND LINT (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §4,
// §15.3): stored paths; the pick request line with no intent; the next-session
// weekday; the early close; every event renderer; acted never from intent;
// the lint's regex identity with the experiment; the corpus — every label,
// counts 23 / 60, SHA-256 pinned.
//
// Dependency-surface guard (BUILD_RULES §4): the import of ./copy.js — which
// imports src/utils/formatters.js and (Build 2a S-7) the zero-import
// src/components/Dashboard/desk/deskCopy.js — is the runtime guard that both
// stay Node-clean; it is never mocked. Build 2a also imports copy.js from the
// CLIENT: the vite build is that half of the guard.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as copyModule from './copy.js';
import {
  fmtPrice, fmtTimeEt, fmtWeekdayEt, checkLabel, deadlineText, renderCallLine, renderUpsideLine, isUpsideCall, CLOCKS,
  renderDeclaredEvent, renderAnsweredEvent, renderHeardEvent, renderActedEvent, renderNoMatchingTradeEvent,
  renderExpiredEvent, renderEndedWithBattleEvent, renderSupersededEvent, EXPIRY_REASON_TEXT, ANSWER_WORDS,
  saidFlagsRound2, saidLintTerms, saidPassesLint, SAID_LINT_LABELS, SAID_UNVERIFIED_LABEL,
} from './copy.js';
import { sessionCloseAfter, etDateOf } from './horizon.js';
import { formatPrice } from '../../../src/utils/formatters.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const CORPUS_PATH = resolve(HERE, '__fixtures__/saidLintCorpus.json');
/** The corpus as built from the local raw records by scripts/build-said-lint-corpus.mjs (build report §4). */
const CORPUS_SHA256 = '2513b3d82b8bc73b4092a278cb40e41b936efc5dd9e03d65bc3f7c2d08fe9d40';

const T = (iso) => Date.parse(iso);
/** Wed Sep 9 2026, 11:00 ET (EDT) — the tick harness's frozen instant. */
const NOW = T('2026-09-09T15:00:00.000Z');

const shot = (over = {}) => ({
  callId: 'b:eval_001:call:0', kind: 'called_shot', battleId: 'b', evalId: 'eval_001', evalSeq: 1, mintedAt: NOW - 60_000,
  symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 161 },
  horizon: { phrase: 'this_session', expiresAt: T('2026-09-09T20:00:00.000Z'), basis: 'this_session' },
  defaultAction: 'act', said: 'AMD above $161 by the close.', state: 'open', ...over,
});
const pick = (over = {}) => ({
  callId: 'b:eval_001:call:1', kind: 'pick', battleId: 'b', evalId: 'eval_001', evalSeq: 1, mintedAt: NOW - 60_000,
  symbol: null, direction: null, slot: 'support', counterpart: null, swapOut: 'KO',
  options: [{ symbol: 'AMD', why: 'leader' }, { symbol: 'JPM', why: 'rate play' }],
  condition: null, horizon: { phrase: 'next_check', expiresAt: NOW + 900_000, basis: 'next_check' },
  defaultAction: null, said: 'AMD or JPM for KO at the next check.', state: 'open', ...over,
});

describe('the formatters (spec §4)', () => {
  it('fmtPrice is the pinned src/utils/formatters.js formatPrice at two decimals', () => {
    expect(fmtPrice(161)).toBe('$161.00');
    expect(fmtPrice(62.5)).toBe('$62.50');
    expect(fmtPrice(161)).toBe(formatPrice(161, 2));
  });

  it('fmtTimeEt is ET wall clock, 24-hour, from ms or ISO; fmtWeekdayEt the ET weekday; null for garbage', () => {
    expect(fmtTimeEt('2026-09-09T14:30:00.000Z')).toBe('10:30');
    expect(fmtTimeEt(T('2026-12-01T15:30:00.000Z'))).toBe('10:30');
    expect(fmtTimeEt('2026-09-09T19:45:00.000Z')).toBe('15:45');
    expect(fmtTimeEt(null)).toBeNull();
    expect(fmtTimeEt('nope')).toBeNull();
    expect(fmtWeekdayEt(T('2026-09-14T20:00:00.000Z'))).toBe('Monday');
    expect(fmtWeekdayEt(undefined)).toBeNull();
    expect(checkLabel('2026-09-09T14:30:00.000Z')).toBe('the 10:30 check');
    expect(checkLabel(null)).toBeNull();
  });
});

describe('renderCallLine — stored paths only (spec §4; Astra B1R-13, B1R2-11)', () => {
  it('a shot renders from condition.side / condition.level / horizon.* — never from top-level fields', () => {
    expect(renderCallLine(shot(), { nowMs: NOW })).toBe("AMD above $161.00 by today's close");
    const wrongPaths = { ...shot(), condition: null, side: 'above', level: 161 };
    expect(renderCallLine(wrongPaths, { nowMs: NOW })).toBeNull();
    const noHorizon = { ...shot(), horizon: null };
    expect(renderCallLine(noHorizon, { nowMs: NOW })).toBe('AMD above $161.00');
  });

  it('a pick renders its REQUEST line from options[].symbol and swapOut', () => {
    expect(renderCallLine(pick(), { nowMs: NOW })).toBe('support: AMD or JPM for KO');
    expect(renderCallLine({ ...pick(), options: [] }, { nowMs: NOW })).toBeNull();
  });

  it('renderIntentLine is RETIRED (founder ruling Oct 4; review L6-10): no consumer ever read it, and its wording dropped the call\'s own symbol ("Intent: bring in for KO", "Intent: exit for AMD") — the one intent line is the cockpit sheet\'s', () => {
    expect(copyModule).not.toHaveProperty('renderIntentLine');
    expect(Object.keys(copyModule).filter((k) => /intent/i.test(k))).toEqual([]);
  });

  it("deadline: next_check → 'by the next check'; this_battle → 'before the battle ends'; explicit → 'by HH:MM'", () => {
    expect(deadlineText({ basis: 'next_check', expiresAt: NOW + 900_000 }, { nowMs: NOW })).toBe('by the next check');
    expect(deadlineText({ basis: 'this_battle', expiresAt: NOW + 86_400_000 }, { nowMs: NOW })).toBe('before the battle ends');
    expect(deadlineText({ basis: 'explicit', expiresAt: T('2026-09-09T19:45:00.000Z') }, { nowMs: NOW })).toBe('by 15:45');
    expect(deadlineText({ basis: 'explicit', expiresAt: null }, { nowMs: NOW })).toBeNull();
    expect(deadlineText({ basis: 'other', expiresAt: NOW }, { nowMs: NOW })).toBeNull();
    expect(deadlineText(null, { nowMs: NOW })).toBeNull();
  });

  it("this_session: 'by today's close' ONLY when expiresAt is on today's ET date — a Friday-after-close call shows Monday on Friday (Astra B1R-13)", () => {
    // Fri Sep 11 2026 at 16:30 ET (after the close): the session close is the NEXT regular session's — Mon Sep 14.
    const fridayEvening = T('2026-09-11T20:30:00.000Z');
    const close = sessionCloseAfter(fridayEvening);
    expect(etDateOf(close.closeMs)).toBe('2026-09-14');
    const call = shot({ horizon: { phrase: 'this_session', expiresAt: close.closeMs, basis: 'this_session' } });
    expect(renderCallLine(call, { nowMs: fridayEvening })).toBe("AMD above $161.00 by Monday's close");
    // Read on Monday itself, the same call says today.
    expect(renderCallLine(call, { nowMs: T('2026-09-14T14:00:00.000Z') })).toBe("AMD above $161.00 by today's close");
  });

  it('the early close: a call minted on the half day expires at 13:00 ET and still says today; one minted after it points at the next session', () => {
    // Fri Nov 27 2026 is an early close (13:00 ET). 11:00 ET that day → that day's 13:00 close.
    const halfDayMorning = T('2026-11-27T16:00:00.000Z');
    const early = sessionCloseAfter(halfDayMorning);
    expect(fmtTimeEt(early.closeMs)).toBe('13:00');
    const onHalfDay = shot({ horizon: { phrase: 'this_session', expiresAt: early.closeMs, basis: 'this_session' } });
    expect(renderCallLine(onHalfDay, { nowMs: halfDayMorning })).toBe("AMD above $161.00 by today's close");
    // 13:30 ET that day, after the early close → Monday Nov 30's close.
    const afterEarlyClose = T('2026-11-27T18:30:00.000Z');
    const next = sessionCloseAfter(afterEarlyClose);
    expect(etDateOf(next.closeMs)).toBe('2026-11-30');
    const afterHalfDay = shot({ horizon: { phrase: 'this_session', expiresAt: next.closeMs, basis: 'this_session' } });
    expect(renderCallLine(afterHalfDay, { nowMs: afterEarlyClose })).toBe("AMD above $161.00 by Monday's close");
  });
});

describe('every event renderer (spec §4, §10)', () => {
  it('declared: at most three call lines, the rest counted; null with nothing renderable', () => {
    const calls = [shot(), pick(), shot({ symbol: 'KO', direction: 'exit', condition: { side: 'below', level: 62.5 } }), shot({ symbol: 'PG' })];
    expect(renderDeclaredEvent({ calls, nowMs: NOW })).toBe("Called: AMD above $161.00 by today's close · support: AMD or JPM for KO · KO below $62.50 by today's close … 1 more");
    expect(renderDeclaredEvent({ calls: [shot()], nowMs: NOW })).toBe("Called: AMD above $161.00 by today's close");
    expect(renderDeclaredEvent({ calls: [], nowMs: NOW })).toBeNull();
    expect(renderDeclaredEvent({ calls: [{ kind: 'called_shot' }], nowMs: NOW })).toBeNull();
  });

  it('answered: the answer word, the pick symbol, and the canonical text when a directive was filed', () => {
    expect(renderAnsweredEvent({ answer: 'hold', canonicalText: "Hold off on the AMD entry until today's close." })).toBe("Answered: Hold off — Hold off on the AMD entry until today's close.");
    expect(renderAnsweredEvent({ answer: 'go' })).toBe('Answered: Go');
    expect(renderAnsweredEvent({ answer: 'pick', pickSymbol: 'JPM', canonicalText: 'Bring in JPM for KO at the next check.' })).toBe('Answered: Pick JPM — Bring in JPM for KO at the next check.');
    expect(renderAnsweredEvent({ answer: 'agree' })).toBe('Answered: Agree');
    expect(renderAnsweredEvent({ answer: 'disagree' })).toBe('Answered: Disagree');
    expect(renderAnsweredEvent({ answer: 'go_now', canonicalText: 'x' })).toBe('Answered: Go now — x');
    expect(renderAnsweredEvent({ answer: 'ask' })).toBeNull(); // deferred to 1b: no word, no line
    expect(Object.keys(ANSWER_WORDS)).toEqual(['go', 'hold', 'go_now', 'pick', 'agree', 'disagree']);
  });

  it("heard: 'Heard at the HH:MM check' from that check's promptBuiltAt — prompt inclusion, nothing more", () => {
    expect(renderHeardEvent({ promptBuiltAt: '2026-09-09T14:15:00.000Z' })).toBe('Heard at the 10:15 check');
    expect(renderHeardEvent({ promptBuiltAt: null })).toBe('Heard (check time unavailable)');
    expect(renderHeardEvent({ promptBuiltAt: '2026-09-09T14:15:00.000Z' })).not.toMatch(/agree|comply|understood/i);
  });

  it("acted: from the committed executor result's symbolOut / symbolIn, at the check — NEVER from the call's intent", () => {
    expect(renderActedEvent({ executorResult: { symbolOut: 'MU', symbolIn: 'NVDA', tier: 'core', slotIndex: 0 }, promptBuiltAt: '2026-09-09T14:30:00.000Z' }))
      .toBe('The agent exited MU for NVDA at the 10:30 check');
    // A call whose intent says "bring in AMD for KO" with NO executor result renders nothing.
    expect(renderActedEvent({ executorResult: null, promptBuiltAt: '2026-09-09T14:30:00.000Z', call: shot() })).toBeNull();
    expect(renderActedEvent({ executorResult: { symbolOut: null, symbolIn: 'AMD' }, promptBuiltAt: '2026-09-09T14:30:00.000Z' })).toBeNull();
    expect(renderActedEvent({ executorResult: { symbolOut: 'KO', symbolIn: 'AMD' } })).toBe('The agent exited KO for AMD');
  });

  it('no matching trade / expired / ended / superseded', () => {
    expect(renderNoMatchingTradeEvent({ promptBuiltAt: '2026-09-09T14:30:00.000Z' })).toBe('No matching trade recorded at the 10:30 check');
    expect(renderNoMatchingTradeEvent({})).toBe('No matching trade recorded at this check');
    // A pick's slot traded for something other than the selection: the committed symbols and the selection it was not (review V2-G2).
    expect(renderNoMatchingTradeEvent({ promptBuiltAt: '2026-09-09T14:30:00.000Z', executorResult: { symbolOut: 'KO', symbolIn: 'AMD' }, selectedSymbol: 'JPM' })).toBe('The agent exited KO for AMD at the 10:30 check — not the selected JPM');
    expect(renderNoMatchingTradeEvent({ executorResult: { symbolOut: 'KO', symbolIn: 'JPM' }, selectedSymbol: 'JPM' })).toBe('No matching trade recorded at this check');
    expect(renderNoMatchingTradeEvent({ executorResult: { symbolOut: 'KO', symbolIn: null }, selectedSymbol: 'JPM' })).toBe('No matching trade recorded at this check');
    expect(renderExpiredEvent({ reason: 'unobserved' })).toBe('Expired — no check observed it before its session closed');
    expect(renderExpiredEvent({ reason: 'past_deadline' })).toBe('Expired — the deadline passed before a check observed it');
    expect(renderExpiredEvent({ reason: 'check' })).toBe('Expired — a check observed it past its deadline');
    expect(renderExpiredEvent({ reason: 'whatever' })).toBe('Expired');
    // The check's own judgments (review L5-6): a next_check shot judged at its slot; a pick by the agent's choice there.
    expect(renderExpiredEvent({ reason: 'slot_judged' })).toBe('Expired — the check at its slot found the condition unmet');
    expect(renderExpiredEvent({ reason: 'pick_chosen' })).toBe("Expired — the check at its slot recorded the agent's own choice");
    expect(renderExpiredEvent({ reason: 'pick_unchosen' })).toBe('Expired — the check at its slot recorded no choice');
    expect(Object.keys(EXPIRY_REASON_TEXT)).toEqual(['unobserved', 'past_deadline', 'check', 'slot_judged', 'pick_chosen', 'pick_unchosen']);
    expect(renderEndedWithBattleEvent()).toBe('Ended with the battle');
    expect(renderSupersededEvent({ at: '2026-09-09T14:21:00.000Z' })).toBe('Superseded by a later filing at 10:21 ET');
    expect(renderSupersededEvent({})).toBe('Superseded by a later filing');
  });

  it('no renderer ever claims a "held" fact or causal attribution (spec §2, §11)', () => {
    const src = readFileSync(resolve(HERE, 'copy.js'), 'utf8');
    expect(src).not.toMatch(/held off|heldOff|the agent held/i);
    expect(src).not.toMatch(/In response to/);
  });
});

describe('the lint — the round-2 rule, verbatim (spec §4; Astra B1R-12, B1R2-13)', () => {
  const EXPERIMENT = resolve(REPO, 'scripts/declarations-wording-experiment.mjs');
  const block = (src) => {
    const s = src.replace(/\r\n/g, '\n');
    const start = s.indexOf('/**\n * The round-2 rule ("added conditions in said")');
    const fnAt = s.indexOf('export function saidFlagsRound2(row) {', start);
    const end = s.indexOf('\n}\n', fnAt) + 3;
    expect(start).toBeGreaterThan(0);
    expect(fnAt).toBeGreaterThan(start);
    return s.slice(start, end);
  };

  it('REGEX IDENTITY: the rule block in copy.js is byte-identical to scripts/declarations-wording-experiment.mjs:376-397', () => {
    const mine = block(readFileSync(resolve(HERE, 'copy.js'), 'utf8'));
    const theirs = block(readFileSync(EXPERIMENT, 'utf8'));
    expect(mine).toBe(theirs);
    expect(mine).toContain('const SAID_R2_ANY = [');
    expect(mine).toContain('const SAID_R2_NEXT_CHECK = [');
    expect(mine).toContain('const SAID_R2_OTHER = [');
    expect(mine).toContain("row.horizonPhrase === 'next_check' ? SAID_R2_NEXT_CHECK : SAID_R2_OTHER");
  });

  it('the rule keys on next_check: the close is an added condition there and not elsewhere; the next check is the reverse', () => {
    expect(saidLintTerms('AMD above $161 by the close.', 'next_check')).toEqual(['by/before the close (next_check)']);
    expect(saidLintTerms('AMD above $161 by the close.', 'this_session')).toEqual([]);
    expect(saidLintTerms('AMD above $161 at the next check.', 'this_session')).toEqual(['next check/eval (not next_check)']);
    expect(saidLintTerms('AMD above $161 at the next check.', 'next_check')).toEqual([]);
    expect(saidLintTerms('AMD closes above $161 on volume.', 'this_session')).toEqual(['volume', 'close(s) above/below']);
    expect(saidLintTerms('MU trading above $1,080 by next check would confirm NR7 breakout upside', 'next_check')).toEqual([]); // bare thesis language
    expect(saidFlagsRound2({ said: 42 })).toEqual([]);
    expect(saidPassesLint('AMD above $161 by the close.', 'this_session')).toBe(true);
    expect(saidPassesLint('AMD above $161 by the close.', 'next_check')).toBe(false);
    expect(saidPassesLint(null, 'this_session')).toBe(false);
    expect(saidPassesLint('', 'this_session')).toBe(false);
    expect(SAID_LINT_LABELS).toHaveLength(13);
  });

  it("the label a passing said is shown under is \"agent's own wording (unverified)\" (its one reader: the cockpit sheet)", () => {
    expect(SAID_UNVERIFIED_LABEL).toBe("agent's own wording (unverified)");
  });

  it('renderSaidLine is RETIRED (founder ruling Oct 5): no consumer ever read it, and it lacked the upside exclusion — the sheet shows a said only from the record\'s saidOk, never on an upside call', () => {
    expect(copyModule).not.toHaveProperty('renderSaidLine');
    expect(Object.keys(copyModule).filter((k) => /^render.*said/i.test(k))).toEqual([]);
  });

  describe('THE CORPUS — derived from the local raw round-2 records (saidLintCorpus.json)', () => {
    const corpus = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'));

    it('is exactly the file the build session derived (SHA-256 pinned, LF, .gitattributes)', () => {
      expect(createHash('sha256').update(readFileSync(CORPUS_PATH)).digest('hex')).toBe(CORPUS_SHA256);
      expect(readFileSync(CORPUS_PATH).includes(0x0d)).toBe(false);
      const attributes = readFileSync(resolve(REPO, '.gitattributes'), 'utf8').split(/\r?\n/).map((l) => l.trim());
      expect(attributes).toContain('api/_utils/callRecords/__fixtures__/saidLintCorpus.json text eol=lf');
    });

    it('carries its provenance and the experiment\'s counts: D 23 of 167, D2 60 of 314 — 481 minted called shots', () => {
      expect(corpus.provenance.run).toMatchObject({ seed: 20261001, round: 2 });
      expect(corpus.provenance.text).toContain('agent text only');
      expect(corpus.counts).toEqual({ D: { shots: 167, flagged: 23 }, D2: { shots: 314, flagged: 60 } });
      expect(corpus.rows).toHaveLength(481);
      expect(corpus.rows.filter((r) => r.arm === 'D')).toHaveLength(167);
      expect(corpus.rows.filter((r) => r.arm === 'D2' && r.flagged)).toHaveLength(60);
    });

    it('every row is agent text only, with exactly the corpus keys; every label is one the rule emits; every basis is a stored basis', () => {
      for (const row of corpus.rows) {
        expect(Object.keys(row)).toEqual(['arm', 'rep', 'check', 'said', 'basis', 'flagged', 'terms']);
        expect(['D', 'D2']).toContain(row.arm);
        expect([1, 2]).toContain(row.rep);
        expect(typeof row.said).toBe('string');
        expect(['next_check', 'this_session', 'this_battle', 'explicit']).toContain(row.basis);
        for (const term of row.terms) expect(SAID_LINT_LABELS).toContain(term);
        expect(row.flagged).toBe(row.terms.length > 0);
      }
    });

    it('THE RULE REPRODUCES EVERY LABEL: the shipping lint recomputes each row\'s terms and flag exactly', () => {
      let flaggedD = 0;
      let flaggedD2 = 0;
      for (const row of corpus.rows) {
        const terms = saidLintTerms(row.said, row.basis);
        expect(terms, `${row.check} ${row.arm}/${row.rep}: ${row.said}`).toEqual(row.terms);
        expect(saidPassesLint(row.said, row.basis)).toBe(!row.flagged);
        if (row.flagged && row.arm === 'D') flaggedD += 1;
        if (row.flagged && row.arm === 'D2') flaggedD2 += 1;
      }
      expect(flaggedD).toBe(23);
      expect(flaggedD2).toBe(60);
    });

    it('a mutated rule would be caught: dropping the volume pattern leaves flagged rows unflagged', () => {
      const volumeRows = corpus.rows.filter((r) => r.terms.includes('volume'));
      expect(volumeRows.length).toBeGreaterThan(0);
      for (const row of volumeRows) expect(saidLintTerms(row.said.replace(/volume/gi, 'size'), row.basis)).not.toEqual(row.terms);
    });
  });
});

// ---------------------------------------------------------------------------
// Cockpit Build 2a — the upside line (Amendment C-2, spec S-3) and the client
// clock (spec S-7). The server's 24-hour output is model-visible: it must not
// move by a byte.
describe('Build 2a — the 24-hour label is byte-identical; the 12-hour label names the slot', () => {
  // HEAD's formatter, restated as the oracle (the copy.js of 4dfc48d9, verbatim).
  const HEAD_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const headCheckLabel = (instant) => {
    const ms = typeof instant === 'string' ? Date.parse(instant) : instant;
    return Number.isFinite(ms) ? `the ${HEAD_TIME.format(new Date(ms))} check` : null;
  };

  it('checkLabel() and checkLabel(x, { clock: "24h" }) equal HEAD\'s output on every instant of a dense grid (DST both ways, midnight, the minute boundary)', () => {
    const start = T('2026-01-01T00:00:00.000Z');
    for (let i = 0; i < 2000; i += 1) {
      const ms = start + i * 4_391_117; // ~73 min steps over ~100 days, odd seconds
      expect(checkLabel(ms)).toBe(headCheckLabel(ms));
      expect(checkLabel(new Date(ms).toISOString(), { clock: '24h' })).toBe(headCheckLabel(ms));
    }
    for (const iso of ['2026-03-08T06:59:59.000Z', '2026-03-08T07:00:00.000Z', '2026-11-01T05:59:59.000Z', '2026-11-01T06:00:00.000Z', '2026-09-10T04:05:00.000Z']) {
      expect(checkLabel(iso)).toBe(headCheckLabel(iso));
    }
    expect(checkLabel('2026-09-09T17:31:20.000Z')).toBe('the 13:31 check');
    expect(CLOCKS).toEqual(['24h', '12h']);
  });

  it('the client clock: "the 1:30 PM check" — 12-hour ET, the check named by its SLOT (D-83), exactly as the Battle View names it', () => {
    expect(checkLabel('2026-09-09T17:31:20.000Z', { clock: '12h' })).toBe('the 1:30 PM check');
    expect(checkLabel('2026-09-09T17:44:59.000Z', { clock: '12h' })).toBe('the 1:30 PM check');
    expect(checkLabel('2026-09-09T17:45:00.000Z', { clock: '12h' })).toBe('the 1:45 PM check');
    expect(checkLabel(T('2026-09-09T13:30:04.000Z'), { clock: '12h' })).toBe('the 9:30 AM check');
    expect(checkLabel(null, { clock: '12h' })).toBeNull();
    expect(checkLabel('garbage', { clock: '12h' })).toBeNull();
  });

  it('a deadline is an INSTANT: the 12-hour explicit deadline keeps its exact minute; the server text is unchanged', () => {
    const horizon = { basis: 'explicit', expiresAt: T('2026-09-09T18:31:00.000Z') };
    expect(deadlineText(horizon)).toBe('by 14:31');
    expect(deadlineText(horizon, { clock: '12h' })).toBe('by 2:31 PM');
    expect(fmtTimeEt(horizon.expiresAt, { clock: '12h' })).toBe('2:31 PM');
    expect(deadlineText({ basis: 'this_session', expiresAt: T('2026-09-09T20:00:00.000Z') }, { nowMs: NOW, clock: '12h' })).toBe("by today's close");
  });
});

describe('Build 2a — the upside line (Amendment C-2)', () => {
  const upside = (over = {}) => shot({ symbol: 'TSLA', heldAtMint: true, counterpart: null, condition: { side: 'above', level: 250 }, ...over });

  it('renderUpsideLine: symbol, side, level, deadline — "TSLA above $250.00 by today\'s close" — and no action clause', () => {
    expect(renderUpsideLine(upside(), { nowMs: NOW })).toBe("TSLA above $250.00 by today's close");
    expect(renderUpsideLine(upside({ horizon: { phrase: 'explicit', basis: 'explicit', expiresAt: T('2026-09-09T18:31:00.000Z') } }), { nowMs: NOW, clock: '12h' })).toBe('TSLA above $250.00 by 2:31 PM');
  });

  it('renderUpsideLine renders ONLY an upside call: a plain shot, a pick, a legacy record, a broken record → null', () => {
    expect(renderUpsideLine(shot(), { nowMs: NOW })).toBeNull();
    expect(renderUpsideLine(pick({ heldAtMint: true }), { nowMs: NOW })).toBeNull();
    expect(renderUpsideLine(upside({ condition: null }), { nowMs: NOW })).toBeNull();
    expect(renderUpsideLine(null)).toBeNull();
    expect(isUpsideCall(upside())).toBe(true);
  });

  it('renderCallLine routes an upside call through the upside line — never an action clause — and leaves every other call as it was', () => {
    expect(renderCallLine(upside(), { nowMs: NOW })).toBe(renderUpsideLine(upside(), { nowMs: NOW }));
    expect(renderCallLine(upside({ counterpart: 'KO', defaultAction: 'act' }), { nowMs: NOW })).not.toMatch(/bring|exit|for KO|Intent|then/i);
    expect(renderCallLine(shot(), { nowMs: NOW })).toBe("AMD above $161.00 by today's close");
    expect(renderCallLine(pick())).toBe('support: AMD or JPM for KO');
  });
});
