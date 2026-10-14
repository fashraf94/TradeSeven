// api/_utils/filmTape/tapeNotes.test.js
//
// Film Room B1 item 8 — W4, singular and plural. The writers' counted notes
// stop printing "check(s)" / "entr(y/ies)" forms: each count agrees with its
// noun, its verb and its pronoun, and no other word changes. A tape written
// before W4 and re-merged after it carries each fact once, in the new
// wording (the merge says the old wording the new way before its union);
// a tape never re-merged keeps its notes.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real writer; only the flag
// module is mocked, by spreading the real one.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { NOTES, UNKNOWN_WHAT, counted, modernNotes } from './tapeNotes.js';
import { writeTapeDay } from './writeTapeDay.js';
import { mergeTape, contentOf, stableStringify } from './tapeMerge.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay } from './__fixtures__/tapeFixtures.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const WHAT = UNKNOWN_WHAT;

/**
 * Every counted note, at 1 and at 2: the new wording, and the wording the
 * writers printed before W4 (their template literals at 03993139, verbatim).
 */
const CASES = [
  ['evictedEntries', [1], '1 check recorded an evalId whose evaluation entry is absent (evicted: older than the oldest surviving entry)', '1 check(s) recorded an evalId whose evaluation entry is absent (evicted: older than the oldest surviving entry)'],
  ['evictedEntries', [2], '2 checks recorded an evalId whose evaluation entry is absent (evicted: older than the oldest surviving entry)', '2 check(s) recorded an evalId whose evaluation entry is absent (evicted: older than the oldest surviving entry)'],
  ['lostEntries', [1], '1 check recorded an evalId whose evaluation entry is absent', '1 check(s) recorded an evalId whose evaluation entry is absent'],
  ['lostEntries', [3], '3 checks recorded an evalId whose evaluation entry is absent', '3 check(s) recorded an evalId whose evaluation entry is absent'],
  ...Object.keys(WHAT).flatMap((k) => [
    ['unknownChecks', [1, WHAT[k]], `1 minted check of this day has no record of what it read or produced (no tick record, or an evaluation entry that is absent) — ${WHAT[k].one} unknown for it`,
      `1 minted check(s) of this day have no record of what they read or produced (no tick record, or an evaluation entry that is absent) — ${WHAT[k].many} unknown for them`],
    ['unknownChecks', [4, WHAT[k]], `4 minted checks of this day have no record of what they read or produced (no tick record, or an evaluation entry that is absent) — ${WHAT[k].many} unknown for them`,
      `4 minted check(s) of this day have no record of what they read or produced (no tick record, or an evaluation entry that is absent) — ${WHAT[k].many} unknown for them`],
  ]),
  ['gapsAttributed', [1, '13'], '1 minted check of this day has no record (tickSeq 13)', '1 minted check(s) of this day have no record (tickSeq 13)'],
  ['gapsAttributed', [2, '13, 14'], '2 minted checks of this day have no record (tickSeq 13, 14)', '2 minted check(s) of this day have no record (tickSeq 13, 14)'],
  ['gapsUnattributed', [1, '1'], '1 minted check adjacent to this day has no record and its day cannot be established (tickSeq 1)', '1 minted check(s) adjacent to this day have no record and their day cannot be established (tickSeq 1)'],
  ['gapsUnattributed', [2, '1, 2'], '2 minted checks adjacent to this day have no record and their day cannot be established (tickSeq 1, 2)', '2 minted check(s) adjacent to this day have no record and their day cannot be established (tickSeq 1, 2)'],
  ['entryOnly', [1], '1 evaluation entry has no tick record; its sequence number is among the gaps', '1 evaluation entr(y/ies) have no tick record; their sequence numbers are among the gaps'],
  ['entryOnly', [2], '2 evaluation entries have no tick record; their sequence numbers are among the gaps', '2 evaluation entr(y/ies) have no tick record; their sequence numbers are among the gaps'],
  ['missingSlots', [1, '11:00'], 'no run record for 1 evaluator slot (11:00 ET) — a check in it may be missing or its deferral unlisted', 'no run record for 1 evaluator slot(s) (11:00 ET) — a check in them may be missing or its deferral unlisted'],
  ['missingSlots', [2, '11:00, 11:15'], 'no run record for 2 evaluator slots (11:00, 11:15 ET) — a check in them may be missing or its deferral unlisted', 'no run record for 2 evaluator slot(s) (11:00, 11:15 ET) — a check in them may be missing or its deferral unlisted'],
  ['untradedSwaps', [50, 1], 'trades[] is at its 50-entry cap and its oldest surviving entry is not before this day — 1 swap has no trade record here (possibly evicted): tier, slot, exit price and locked gain unknown', 'trades[] is at its 50-entry cap and its oldest surviving entry is not before this day — 1 swap(s) have no trade record here (possibly evicted): tier, slot, exit price and locked gain unknown'],
  ['untradedSwaps', [50, 2], 'trades[] is at its 50-entry cap and its oldest surviving entry is not before this day — 2 swaps have no trade record here (possibly evicted): tier, slot, exit price and locked gain unknown', 'trades[] is at its 50-entry cap and its oldest surviving entry is not before this day — 2 swap(s) have no trade record here (possibly evicted): tier, slot, exit price and locked gain unknown'],
  ['earlyCards', [1], "1 card filed before this ET day (after the battle's activation or the previous trading day) is shown here", "1 card(s) filed before this ET day (after the battle's activation or the previous trading day) are shown here"],
  ['earlyCards', [2], "2 cards filed before this ET day (after the battle's activation or the previous trading day) are shown here", "2 card(s) filed before this ET day (after the battle's activation or the previous trading day) are shown here"],
  ['platformAuthored', [1], "1 entry carried platform-written text (a placeholder or a guardrail override), not the agent's words — not copied", "1 entr(y/ies) carried platform-written text (a placeholder or a guardrail override), not the agent's words — not copied"],
  ['platformAuthored', [2], "2 entries carried platform-written text (a placeholder or a guardrail override), not the agent's words — not copied", "2 entr(y/ies) carried platform-written text (a placeholder or a guardrail override), not the agent's words — not copied"],
  ['noModelCheck', [1, 0], 'no model check recorded among the 1 known check', 'no model check recorded among the 1 known check(s)'],
  ['noModelCheck', [26, 0], 'no model check recorded among the 26 known checks', 'no model check recorded among the 26 known check(s)'],
  ['noModelCheck', [25, 1], 'no model check recorded among the 25 known checks; 1 check has no record', 'no model check recorded among the 25 known check(s); 1 check(s) have no record'],
  ['noModelCheck', [24, 2], 'no model check recorded among the 24 known checks; 2 checks have no record', 'no model check recorded among the 24 known check(s); 2 check(s) have no record'],
  ['declarationsUnread', [1], '1 check expected a declarations record this read did not look up (an evaluation newer than the read)', '1 check(s) expected a declarations record this read did not look up (an evaluation newer than the read)'],
  ['declarationsUnread', [2], '2 checks expected a declarations record this read did not look up (an evaluation newer than the read)', '2 check(s) expected a declarations record this read did not look up (an evaluation newer than the read)'],
  ['declarationsAbsent', [1], '1 check expected a declarations record that is absent (failed or unconfirmed — contract §2.1)', '1 check(s) expected a declarations record that is absent (failed or unconfirmed — contract §2.1)'],
  ['declarationsAbsent', [2], '2 checks expected a declarations record that is absent (failed or unconfirmed — contract §2.1)', '2 check(s) expected a declarations record that is absent (failed or unconfirmed — contract §2.1)'],
  ['lostDeclarations', [1], '1 check recorded an evalId whose evaluation entry is absent — whether it expected a declarations record is unknown', '1 check(s) recorded an evalId whose evaluation entry is absent — whether they expected a declarations record is unknown'],
  ['lostDeclarations', [2], '2 checks recorded an evalId whose evaluation entry is absent — whether they expected a declarations record is unknown', '2 check(s) recorded an evalId whose evaluation entry is absent — whether they expected a declarations record is unknown'],
  ['cryptoLegs', [1], '1 crypto leg not replayed (crypto_not_supported)', null],
  ['cryptoLegs', [2], '2 crypto legs not replayed (crypto_not_supported)', null],
  ['noFreshPrice', [1], 'no fresh price at 1 check', null],
  ['noFreshPrice', [3], 'no fresh price at 3 checks', null],
  ['builtBeforeChecks', [1], 'built before 1 check was recorded', null],
  ['builtBeforeChecks', [2], 'built before 2 checks were recorded', null],
];

describe('every counted note, in the right number', () => {
  it.each(CASES)('%s(%j)', (name, args, modern) => {
    expect(NOTES[name](...args)).toBe(modern);
  });

  it('counted()', () => {
    expect([counted(0, 'check', 'checks'), counted(1, 'check', 'checks'), counted(2, 'entry', 'entries')]).toEqual(['0 checks', '1 check', '2 entries']);
  });

  it('no writer composes a "(s)" or "(y/ies)" form any more — the close pass, the candle pass, the merge, the replay', () => {
    for (const f of ['tapeAssemble.js', 'candlePass.js', 'tapeMerge.js', 'tapeReplay.js', 'tapeTags.js']) {
      // comments and console lines (logs, not notes on the tape) aside
      const src = readFileSync(resolve(HERE, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l) && !/console\.(log|warn|error)/.test(l)).join('\n');
      // a word, its "(s)" / "(es)" / "(y/ies)", then more words — prose, never code like `has(s)` or `add(s);`
      expect(src.match(/[a-z]\((?:s|es|y\/ies)\) [a-z(]/g), f).toBeNull();
    }
  });
});

describe('the old wording, said the new way (what the merge applies to a stored note)', () => {
  const legacy = CASES.filter(([, , , old]) => old !== null);

  it.each(legacy)('%s(%j)', (_name, _args, modern, old) => {
    expect(modernNotes(old)).toBe(modern);
    expect(modernNotes(modern)).toBe(modern);                      // idempotent: the new wording is left alone
  });

  it('inside a joined note, every part — and the text around them untouched', () => {
    const old = `${CASES[2][3]}; state as observed at copiedAt, not a reconstruction of the day; ${CASES.find((c) => c[0] === 'entryOnly')[3]}`;
    expect(modernNotes(old)).toBe(`${CASES[2][2]}; state as observed at copiedAt, not a reconstruction of the day; 1 evaluation entry has no tick record; its sequence number is among the gaps`);
    expect(modernNotes(null)).toBeNull();
    expect(modernNotes('awaiting the candle pass')).toBe('awaiting the candle pass');
  });
});

describe('a tape written before W4, re-merged after it: each fact once, in the new wording', () => {
  /** The stored tape as the pre-W4 writer would have left it: every counted note and caveat in the old wording. */
  function toLegacy(tape) {
    const t = structuredClone(tape);
    const pairs = legacyPairs();
    const say = (s) => (typeof s === 'string' ? pairs.reduce((acc, [modern, old]) => acc.split(modern).join(old), s) : s);
    for (const cov of Object.values(t.coverage)) {
      if (!cov) continue;
      cov.note = say(cov.note);
      if (Array.isArray(cov.caveats)) cov.caveats = cov.caveats.map(say);
    }
    return t;
  }
  const legacyPairs = () => CASES.filter(([, , , old]) => old !== null).map(([, , modern, old]) => [modern, old]).sort((a, b) => b[0].length - a[0].length);

  it('the refresh keeps one caveat per fact and writes the new wording; a second refresh writes nothing', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT });
    const path = `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
    const fresh = structuredClone(t.store.get(path));
    const old = toLegacy(fresh);
    expect(stableStringify(old.coverage)).not.toBe(stableStringify(fresh.coverage));   // the planted wording is the old one
    expect(stableStringify(old.coverage)).toMatch(/minted check\(s\)/);
    t.store.set(path, old);
    expect((await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT + 60_000 })).status).toBe('written');
    const after = t.store.get(path);
    for (const [k, cov] of Object.entries(after.coverage)) {
      expect(cov?.note ?? null, k).toBe(fresh.coverage[k]?.note ?? null);
      expect(cov?.caveats ?? null, k).toEqual(fresh.coverage[k]?.caveats ?? null);
    }
    expect((await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT + 120_000 })).status).toBe('unchanged');
  });

  it('a stored section that outranks the new read keeps its own note — said the new way', () => {
    const stored = {
      etDate: '2026-09-24', writtenAt: '2026-09-25T02:15:30.000Z', passes: { close: { status: 'written', gaps: [] }, candles: { status: 'skipped', reason: 'outside_candle_window' } },
      score: {}, battle: { status: 'active', final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null },
      checks: [], actions: [], directives: [], plans: [], calls: [], rationale: [], meetings: [],
      coverage: { rationale: { status: 'complete', span: null, sources: ['evaluations'], preservedFrom: null, note: CASES.find((c) => c[0] === 'platformAuthored')[3], caveats: [], unknownChecks: 0, dependsOn: null } },
    };
    const assembled = { ...structuredClone(stored), coverage: { rationale: { status: 'partial', span: null, sources: ['evaluations'], preservedFrom: null, note: 'evaluations[] is at its 150-entry cap', caveats: [], unknownChecks: 0 } } };
    const { doc } = mergeTape(stored, assembled, { nowIso: '2026-09-25T02:16:00.000Z', withinWindow: false, resolveResult: () => null });
    expect(doc.coverage.rationale.status).toBe('complete');
    expect(doc.coverage.rationale.note).toBe(CASES.find((c) => c[0] === 'platformAuthored')[2]);
    expect(stableStringify(contentOf(doc))).not.toMatch(/entr\(y\/ies\)/);
  });
});
