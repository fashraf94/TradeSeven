// scripts/practice-field-founder.b6.test.js
//
// Practice Field build B6 — the founder's script, two of the six small fixes, on the in-memory store (no real Firestore):
//   B6-7  `status` warns when this machine's player list holds an entry the door's own owner-id rule would refuse: how many,
//         never which (Astra B4-A02, ruled — the gate is unchanged);
//   B6-8  `status` excuses a late symbol only when its parse entry is truly absent: a stored `null` or array alerts (Astra
//         B4-A03).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runCli, malformedPlayerEntries, playerListWarning } from './practice-field-founder.mjs';
import { setPracticeFieldModeForTests, setPracticeFieldAgentForTests } from '../api/_utils/practiceField/mode.js';
import { PRACTICE_FIELD_PLAYER_ENV, PRACTICE_FIELD_FOUNDER_ENV } from '../api/_utils/practiceField/playerList.js';
import { admitIdea } from '../api/_utils/practiceField/admission.js';
import {
  makeMandateFakeDb, contractOf, etIso, ADMIT_ISO, DAYS, closeOn, closeNowOf, omitParseReport, admitAndEnter, storeParseReport, CLEAN_PARSE_ENTRY,
} from '../api/_utils/practiceField/__testsupport__/fixtures.js';
import { quotesOn } from '../api/_utils/practiceField/__testsupport__/agentFixtures.js';

const FOUNDER = 'founder-b6';
const PLAYER = 'player-b6-one';
const seed = (...uids) => Object.assign({}, ...uids.map((uid) => ({ [`agents/agent-${uid}`]: { ownerId: uid, archetype: 'momentum_chaser', name: 'Ranked' } })));

async function cli(db, args, { nowIso = ADMIT_ISO } = {}) {
  const lines = [];
  const code = await runCli(args, { getDb: async () => db, nowIso: () => nowIso, print: (s) => lines.push(String(s)) });
  return { code, out: lines.join('\n') };
}
const json = async (db, args, opts) => {
  const r = await cli(db, [...args, '--json'], opts);
  return { code: r.code, body: JSON.parse(r.out) };
};

let restoreMode;
let restoreAgent;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('allowlist');
  restoreAgent = setPracticeFieldAgentForTests({ agent: false });
  vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, FOUNDER);
  vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, [FOUNDER, PLAYER].join(','));
});
afterEach(() => { restoreAgent(); restoreMode(); vi.unstubAllEnvs(); });

// ── B6-8 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * B4's 25 Nov shape (scripts/practice-field-founder.b4.test.js): the founder's book holds AAPL at Monday's close; two ideas
 * admitted at that close (JPM, BAC; XOM, CVX) are not in Monday's report — late symbols.
 */
async function lateSymbols() {
  const restore = setPracticeFieldModeForTests('on');
  const db = makeMandateFakeDb(seed(FOUNDER));
  const made = await json(db, ['create-book', '--uid', FOUNDER, '--go']);
  const bookId = made.body.answer.bookId;
  const q = quotesOn();
  await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: q });
  await closeOn(db, bookId, DAYS.d1, q);
  const atClose = new Date(closeNowOf(DAYS.d1).getTime() + 5 * 60_000).toISOString();
  const b = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['JPM', 'BAC'], capitalUsd: 25000 }), opId: 'after-1', nowIso: atClose });
  const c = await admitIdea(db, { bookId, contract: contractOf({ slot: 'long', names: ['XOM', 'CVX'], capitalUsd: 30000 }), opId: 'after-2', nowIso: atClose });
  expect([b.ok, c.ok]).toEqual([true, true]);
  omitParseReport(db, DAYS.d1, ['JPM', 'BAC', 'XOM', 'CVX']);
  restore();
  return { db };
}
const evening = () => new Date(closeNowOf(DAYS.d1).getTime() + 3 * 3600_000).toISOString();
/** Store a raw value as one symbol's entry in the session's report (storeParseReport clones it; null and [] go in as is). */
const storeRawEntry = (db, symbol, value) => {
  storeParseReport(db, DAYS.d1, symbol, CLEAN_PARSE_ENTRY);
  const path = `practiceFieldCaParseReports/${DAYS.d1}`;
  const cur = db._store.get(path);
  db._store.set(path, { data: { ...cur.data, symbols: { ...cur.data.symbols, [symbol]: value } }, version: cur.version + 1 });
};

describe('B6-8 — a late symbol is excused only when its parse entry is truly absent (Astra B4-A03)', () => {
  it('her row, for an otherwise identical after-cutoff idea: missing → zero alerts; a stored null → one; a stored [] → one', async () => {
    const missing = await lateSymbols();
    const none = await json(missing.db, ['status', '--uid', FOUNDER], { nowIso: evening() });
    expect(none.body.parseReport).toMatchObject({ session: DAYS.d1, alerts: [] });
    expect((await cli(missing.db, ['status', '--uid', FOUNDER], { nowIso: evening() })).out).toContain('clean for the book\'s symbols');
    for (const [label, value] of [['null', null], ['[]', []]]) {
      const { db } = await lateSymbols();
      storeRawEntry(db, 'JPM', value);
      const st = await json(db, ['status', '--uid', FOUNDER], { nowIso: evening() });
      expect(st.body.parseReport.alerts, label).toEqual([{ session: DAYS.d1, symbol: 'JPM', reason: 'parse_report_missing' }]);
      const text = await cli(db, ['status', '--uid', FOUNDER], { nowIso: evening() });
      expect(text.out, label).toContain('1 alert(s)');
      expect(text.out, label).not.toContain('clean for the book\'s symbols');
    }
  });

  it('what B4 already alerted still alerts: a malformed object, and a held symbol\'s missing entry', async () => {
    const a = await lateSymbols();
    storeRawEntry(a.db, 'BAC', {});
    expect((await json(a.db, ['status', '--uid', FOUNDER], { nowIso: evening() })).body.parseReport.alerts).toEqual([{ session: DAYS.d1, symbol: 'BAC', reason: 'parse_envelope_malformed' }]);
    const b = await lateSymbols();
    omitParseReport(b.db, DAYS.d1, ['AAPL']);
    expect((await json(b.db, ['status', '--uid', FOUNDER], { nowIso: evening() })).body.parseReport.alerts).toEqual([{ session: DAYS.d1, symbol: 'AAPL', reason: 'parse_report_missing' }]);
  });
});

// ── B6-7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B6-7 — status warns about a malformed player-list entry: how many, never which', () => {
  const statusOf = async (list) => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, list);
    const db = makeMandateFakeDb(seed(FOUNDER));
    return { json: await json(db, ['status', '--uid', FOUNDER]), text: await cli(db, ['status', '--uid', FOUNDER]) };
  };

  it('a clean list: no warning, and a count of zero', async () => {
    const { json: j, text } = await statusOf(`${FOUNDER},${PLAYER}`);
    expect(j.body).toMatchObject({ onPlayerList: true, playerListMalformed: 0 });
    expect(text.out).not.toContain('WARNING');
    expect(malformedPlayerEntries()).toBe(0);
  });

  it('entries the door\'s owner-id rule refuses: counted and warned about — the gate still reads the list (the founder is still on it)', async () => {
    const bad = ['bad/path', '_registry', '.', 'x'.repeat(129), 'two words'];
    const { json: j, text } = await statusOf([FOUNDER, ...bad, PLAYER].join(','));
    expect(j.body).toMatchObject({ onPlayerList: true, modeAdmitsOwner: true, playerListMalformed: bad.length });
    expect(text.out).toContain(playerListWarning(bad.length));
    expect(text.out).toContain(`WARNING: ${bad.length} entries on this machine's list are not a uid the door accepts`);
    expect(playerListWarning(1)).toContain('WARNING: 1 entry on this machine\'s list is not a uid the door accepts');
    // No entry's value is printed — not a malformed one (a mistyped real uid), not a valid one — in the text or the JSON.
    // (Every entry long enough to tell apart from ordinary text: a bare "." is in any sentence.)
    for (const v of [...bad, PLAYER].filter((x) => x.length > 3)) {
      expect(text.out.includes(v), v).toBe(false);
      expect(JSON.stringify(j.body).includes(v), v).toBe(false);
    }
  });

  it('`fixture-player,bad/path`: one entry counted; the warning sits under the player-list line', async () => {
    const { text } = await statusOf(`${FOUNDER},fixture-player,bad/path`);
    const lines = text.out.split('\n');
    const at = lines.findIndex((l) => l.startsWith('player list '));
    expect(lines[at + 1]).toBe(playerListWarning(1));
    expect(text.out).not.toContain('bad/path');
    expect(text.out).not.toContain('fixture-player');
    expect(etIso(DAYS.d1, 9, 0)).toMatch(/^2026-11-16T/); // (the fixtures' calendar, as B4's rows)
  });
});
