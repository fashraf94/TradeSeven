// api/_utils/filmRoom/momentExcerpt.golden.test.js
//
// Film Room C2 item 3 — THE MOMENT EXCERPT's goldens and guards (Build C spec §6, acceptance C-EXCERPT; Amendment C
// CC-2, CC-3, CC-6; exit criteria 15 and 17). Over the Sep 23 day written by the REAL passes
// (__fixtures__/excerptFixtures.js):
//   the GOLDENS          one moment, one card — each equal to its committed JSON, the JSON pinned by SHA-256, and every
//                        field checked against its named source on the tape;
//   the BOUNDS           every quoted field at its limit (carried exactly) and one over (not carried), astral included;
//   ABSENCE              every field absent when its tape section (or record) is missing — never a guess, never a
//                        neighbouring check's row;
//   LABELS (CC-3)        no id-shaped value in `excerpt`, and the detector bites on each id kind planted;
//   SPEAKERS (CC-2)      every quotation one source, one speaker — the amendment's table, pinned;
//   THE WRITE GATE       no write call in momentExcerpt.js or anything it imports (the C1 census script's pattern),
//                        the two non-Firestore hits in its closure pinned by text and count, and a planted write caught.
// The owner, attribution, source and read rules are item 2's (momentExcerpt.test.js).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): see momentExcerpt.test.js — this import is never mocked either.
import { excerptOf, excerptOfCard, MOMENT_EXCERPT_VERSION, EXCERPT_LABELS, EXCERPT_BOUNDS, QUOTE_SPEAKERS } from './momentExcerpt.js';
import {
  excerptDay, excerptStore as storeOfDay, excerptCardWith, ideaVersionDoc, dbOf, OWNER, AGENT, CLONE_AGENT, SEP23, EXCERPT_BATTLE, EXCERPT_ENTRY,
  EXCERPT_WATCHLIST, EXCERPT_IDEA_VERSION, ETN_MOMENT, META_MOMENT, EXCERPT_NOTE, EXCERPT_MEETING, FORGED_DIAGNOSIS, EXCERPT_STATEMENT, EXCERPT_CONTENT_HASH, ideaCall,
} from './__fixtures__/excerptFixtures.js';
import { buildCardDoc } from './cardStore.js';
// the fix round's review, CX1-3: the in-memory Firestore with a read hook, to fail one read alone
import { makeTapeDb } from '../filmTape/__fixtures__/tapeFirestore.js';
// CE-1: the card request's own note normaliser — a note holding an id is accepted at intake and left out at projection
import { normalizeNote } from './cardRequest.js';
import { CARD_SLOTS } from '../../../src/data/cardSlots.js';
import { stableStringify } from '../canonicalHash.js';
import { WRITE_PATTERN } from '../../../scripts/census-film-room-v1-plays.mjs';
import { stripComments, importSpecifiersOf, opaqueImportsOf, callNamesOf, memberNamesOf, resolveImport } from './__fixtures__/jsSource.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const GOLDEN_PATH = path.join(HERE, '__fixtures__', 'momentExcerpt.golden.json');
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
const sha256 = (v) => createHash('sha256').update(stableStringify(v), 'utf8').digest('hex');
/** The goldens' SHA-256, over their canonical JSON (canonicalHash.js stableStringify) — the build report records both. */
const GOLDEN_SHA256 = Object.freeze({
  // the C2 fix round moves each by the rulings that change the shape, one commit each (build report §11): CD-16 (no meeting), CD-14 (no card.note), CD-3 (the sector named); CD-8 moved no byte
  moment: 'cff3ecd44b55090a91a29d0dda19435f9bfef6c34fbf8ba7b9502658ff7e9637',
  card: '397116410d1d178651625e32ed7f3fa04794ddc9b9bec94d8fb278fce13d0c5a',
});

/** The card, by the ledger's own builder; the store with it unless a test names another. */
const excerptCard = (o) => excerptCardWith(buildCardDoc, o);
const excerptStore = (day, opts = {}) => storeOfDay(day, { card: excerptCard({ battleId: opts.battleId }), ...opts });
const clone = (v) => structuredClone(v);
const DAY = await excerptDay();
const TAPE_PATH = `agentBattles/${EXCERPT_BATTLE}/tape/${SEP23}`;
const SERIES_ETN = `${TAPE_PATH}/series/ETN`;
const IDEA_PATH = `watchlists/${EXCERPT_WATCHLIST}/hypothesisVersions/v${EXCERPT_IDEA_VERSION}`;
const MOMENT_ASK = { uid: OWNER, attributionAgentId: AGENT, battleId: EXCERPT_BATTLE, etDate: SEP23, moment: ETN_MOMENT };
const CARD_ASK = { uid: OWNER, attributionAgentId: AGENT, entryId: EXCERPT_ENTRY };

/** The day's store with one tape change (`edit` mutates a copy of the stored tape). */
const withTape = (edit, opts = {}) => { const tape = clone(DAY.tape); edit(tape); return excerptStore({ ...DAY, tape }, opts); };
const momentOver = async (store, ask = MOMENT_ASK) => excerptOf(dbOf(store).db, ask);
const cardOver = async (store, ask = CARD_ASK) => excerptOfCard(dbOf(store).db, ask);
const idxBy = (list, pred) => list.findIndex(pred);
const RAT15 = idxBy(DAY.tape.rationale, (r) => r.tickSeq === 15);
const DIR15 = idxBy(DAY.tape.directives, (d) => d.heard?.tickSeq === 15);
/** The LIVE excerpts — the rows that judge the excerpt's shape run on what the code answers now, not only on the committed JSON (§2 review L1-6). */
const LIVE = { moment: await momentOver(excerptStore(DAY)), card: await cardOver(excerptStore(DAY)) };
/** A strict instant, as the excerpt carries one (§2 review L1-1). */
const STRICT_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

// ── the goldens ─────────────────────────────────────────────────────────────

describe('C-EXCERPT — the goldens, through the real writer', () => {
  it('the moment (ETN 15–19): equal to its golden, the golden pinned by SHA-256', async () => {
    const got = await momentOver(excerptStore(DAY));
    expect(got).toEqual(GOLDEN.moment);
    expect(sha256(GOLDEN.moment)).toBe(GOLDEN_SHA256.moment);
  });
  it('the card (its filed source, the same moment): equal to its golden, pinned by SHA-256', async () => {
    const got = await cardOver(excerptStore(DAY));
    expect(got).toEqual(GOLDEN.card);
    expect(sha256(GOLDEN.card)).toBe(GOLDEN_SHA256.card);
  });
  it('the card\'s excerpt is the moment\'s, plus the card, its one input quote and its label — nothing else differs', () => {
    const { card, inputQuote, ...rest } = GOLDEN.card.excerpt;
    expect(rest).toEqual(GOLDEN.moment.excerpt);
    expect(GOLDEN.card.refs).toEqual({ ...GOLDEN.moment.refs, c1: EXCERPT_ENTRY });
    expect(inputQuote).toEqual({ text: EXCERPT_NOTE, by: 'player', at: excerptCard().createdAt, class: 'quoted' });
    expect(card.label).toBe(EXCERPT_LABELS.card);
  });
  it('CD-14 — THE NOTE HAS ONE HOME: `card` holds no note, and the note\'s words appear exactly once in the excerpt, as `inputQuote` (live and golden)', () => {
    for (const e of [GOLDEN.card.excerpt, LIVE.card.excerpt]) {
      expect('note' in e.card).toBe(false);
      expect(Object.keys(e.card).sort()).toEqual(['filed', 'label', 'question', 'route']);
      expect(stringsOf(e).filter((x) => x === EXCERPT_NOTE)).toHaveLength(1);
      expect(e.inputQuote.text).toBe(EXCERPT_NOTE);
    }
  });
  it('every field is the named source\'s value (the golden is checked against the tape, not only against itself)', () => {
    const e = GOLDEN.moment.excerpt;
    const t = DAY.tape;
    expect(e.excerptVersion).toBe(MOMENT_EXCERPT_VERSION);
    expect(MOMENT_EXCERPT_VERSION).toBe(1);
    expect([e.symbol.value, e.situationId.value, e.situationVersion.value, e.checks.value]).toEqual(['ETN', 'stalled', 2, 5]);
    expect([e.from.value, e.to.value]).toEqual([t.checks.find((c) => c.tickSeq === 15).at, t.checks.find((c) => c.tickSeq === 19).at]);
    expect(e.sector).toEqual({ value: 'Industrials', class: 'recorded' });   // CD-3: the directory's name, never the fund code
    expect(e.rationale.rationale.text).toBe(t.rationale[RAT15].rationale);
    expect(e.rationale.hypothesis.text).toBe(t.rationale[RAT15].hypothesis);
    expect(e.directive.playerText.text).toBe(t.directives[DIR15].playerText);
    expect(e.directive.canonicalText.text).toBe(t.directives[DIR15].canonicalText);
    expect(t.meetings[0].diagnosis).toBe(EXCERPT_MEETING.diagnosis);   // the tape holds the meeting …
    expect(e.meeting).toBeUndefined();                                 // … the excerpt never carries it (CD-16)
    const sale = t.actions.find((a) => a.symbolOut === 'ETN');
    expect(sale.tickSeq).toBe(20);
    expect(e.exit).toEqual({ mechanism: { value: sale.mechanism, class: 'recorded' }, exitReason: { value: sale.exitReason, class: 'recorded' }, sold: { value: 'ETN', class: 'recorded' }, bought: { value: sale.symbolIn, class: 'recorded' }, exitPrice: { value: sale.exitPrice, class: 'recorded' } });
    const etn = DAY.series.find((s) => s.symbol === 'ETN');
    const after = etn.bars.filter((b) => Date.parse(b.t) > Date.parse(sale.at));
    expect(e.afterExit).toEqual({ close: { value: after.at(-1).c, class: 'market' }, barStart: { value: after.at(-1).t, class: 'market' }, barsAfter: { value: after.length, class: 'derived' } });
    expect(e.count).toEqual({ value: t.tags.items.find((i) => i.symbol === 'ETN' && i.tickSeq === 19).count, class: 'derived' });
    expect(e.idea.version).toEqual({ value: EXCERPT_IDEA_VERSION, class: 'recorded' });
    expect(e.recurrences).toBeUndefined();
  });
  it('a series bar keeps the series document\'s own class (`market`), never relabelled `recorded`', () => {
    expect(DAY.series.find((s) => s.symbol === 'ETN').numberClasses['bars[].c']).toBe('market');
    expect(GOLDEN.moment.excerpt.afterExit.close.class).toBe('market');
  });
});

// ── the bounds ──────────────────────────────────────────────────────────────

const ASTRAL = '\u{1F600}';
/** A text of exactly `n` code points whose last character is astral (two UTF-16 units). */
const textOf = (n) => `${'a'.repeat(n - 1)}${ASTRAL}`;

describe('the bounds — at the limit carried exactly, one over not carried (never cut), astral characters counted once', () => {
  it('every bound is at most 500 code points (W-06), and each is the amendment\'s', () => {
    expect(EXCERPT_BOUNDS).toEqual({ statement: 280, hypothesis: 500, rationale: 500, playerText: 400, canonicalText: 400, note: 280 });
    for (const b of Object.values(EXCERPT_BOUNDS)) expect(b).toBeLessThanOrEqual(500);
  });
  const rows = [
    { name: 'rationale', bound: 500, plant: (s, text) => withTape((t) => { t.rationale[RAT15].rationale = text; }), read: (x) => x.rationale?.rationale?.text, card: false },
    { name: 'hypothesis', bound: 500, plant: (s, text) => withTape((t) => { t.rationale[RAT15].hypothesis = text; }), read: (x) => x.rationale?.hypothesis?.text, card: false },
    { name: 'directive player text', bound: 400, plant: (s, text) => withTape((t) => { t.directives[DIR15].playerText = text; }), read: (x) => x.directive?.playerText?.text, card: false },
    { name: 'directive canonical text', bound: 400, plant: (s, text) => withTape((t) => { t.directives[DIR15].canonicalText = text; }), read: (x) => x.directive?.canonicalText?.text, card: false },
    { name: 'idea statement', bound: 280, plant: (s, text) => excerptStore(DAY, { idea: ideaVersionDoc({ statement: text }) }), read: (x) => x.idea?.statement?.text, card: false },
    { name: 'card note', bound: 280, plant: (s, text) => excerptStore(DAY, { card: excerptCard({ note: text }) }), read: (x) => x.inputQuote?.text, card: true },
  ];
  for (const r of rows) {
    it(`${r.name}: ${r.bound} code points carried exactly; ${r.bound + 1} not carried`, async () => {
      const at = await (r.card ? cardOver : momentOver)(r.plant(null, textOf(r.bound)));
      expect(r.read(at.excerpt)).toBe(textOf(r.bound));
      expect(textOf(r.bound).length).toBe(r.bound + 1);   // the astral last character is two UTF-16 units, one code point
      const over = await (r.card ? cardOver : momentOver)(r.plant(null, textOf(r.bound + 1)));
      expect(over).not.toBeNull();
      expect(r.read(over.excerpt)).toBeUndefined();
    });
  }
  it('a card note over its bound, missing, empty or not a string: no inputQuote, and no note anywhere — the card itself kept (CD-14)', async () => {
    for (const note of [textOf(281), null, '', 7]) {
      const got = await cardOver(excerptStore(DAY, { card: { ...excerptCard(), note } }));
      expect(got.excerpt.inputQuote, String(note).slice(0, 20)).toBeUndefined();
      expect('note' in got.excerpt.card).toBe(false);
      expect(got.excerpt.card.question).toBeDefined();
    }
  });
});

// ── absence ─────────────────────────────────────────────────────────────────

describe('a field the tape does not hold is absent — never a guess, never a neighbouring row', () => {
  const absentWith = async (edit, field, opts) => {
    const got = await momentOver(withTape(edit, opts));
    expect(got, field).not.toBeNull();
    expect(got.excerpt[field], field).toBeUndefined();
    return got;
  };
  it('no rationale section, or only rows after the moment\'s first check: no rationale (the mutant: a later row taken)', async () => {
    await absentWith((t) => { delete t.rationale; }, 'rationale');
    await absentWith((t) => { t.rationale = t.rationale.filter((r) => r.tickSeq > 15); }, 'rationale');
    await absentWith((t) => { t.rationale = t.rationale.map((r) => ({ ...r, tickSeq: null })); }, 'rationale');
  });
  it('the row AT the first check missing: the nearest earlier one, never the next', async () => {
    const got = await momentOver(withTape((t) => { t.rationale = t.rationale.filter((r) => r.tickSeq !== 15); }));
    const earlier = DAY.tape.rationale.filter((r) => r.tickSeq < 15).sort((a, b) => b.tickSeq - a.tickSeq)[0];
    expect(got.excerpt.rationale.rationale.text).toBe(earlier.rationale);
    expect(got.excerpt.rationale.rationale.at).toBe(earlier.at);
  });
  it('no directives, or none heard inside the moment: no directive (a directive heard after the moment is not taken)', async () => {
    await absentWith((t) => { delete t.directives; }, 'directive');
    await absentWith((t) => { t.directives[DIR15].heard = { ...t.directives[DIR15].heard, tickSeq: 20 }; }, 'directive');
    await absentWith((t) => { t.directives[DIR15].heard = null; }, 'directive');
  });
  it('CD-16 — NO MEETING, whatever the history holds: the fixture\'s meeting, whose life holds the moment, is on the tape and not in the excerpt — moment or card', async () => {
    expect(DAY.tape.meetings).toHaveLength(1);
    for (const e of [LIVE.moment.excerpt, LIVE.card.excerpt]) expect('meeting' in e).toBe(false);
  });
  it('CD-16 — A FORGED, OWNER-WRITTEN MEETING HISTORY, through the real writer, gives no meeting in the excerpt and none of its words (the owner may update the history; the owner\'s own screen still shows it — FilmRoomMeetings.writer.jsdom.test.jsx)', { timeout: 60_000 }, async () => {
    const forgedMeetings = [
      { ...EXCERPT_MEETING, diagnosis: FORGED_DIAGNOSIS, status: 'approved', resolvedBy: 'coach' },
      { ...EXCERPT_MEETING, id: 'gpm_1758649000000', status: 'expired', expiresAt: '2026-09-23T19:30:00.000Z', resolvedAt: '2026-09-23T19:30:00.000Z', diagnosis: `${FORGED_DIAGNOSIS} Again.` },
    ];
    const forged = await excerptDay({ battleId: 'b-sep23-forged', meetings: forgedMeetings });
    expect(forged.tape.meetings.map((x) => x.diagnosis)).toEqual([FORGED_DIAGNOSIS, `${FORGED_DIAGNOSIS} Again.`]);
    const ask = { ...MOMENT_ASK, battleId: 'b-sep23-forged' };
    const moment = await momentOver(storeOfDay(forged, { battleId: 'b-sep23-forged', card: excerptCard({ battleId: 'b-sep23-forged' }) }), ask);
    const card = await cardOver(storeOfDay(forged, { battleId: 'b-sep23-forged', card: excerptCard({ battleId: 'b-sep23-forged' }) }));
    for (const got of [moment, card]) {
      expect(got).not.toBeNull();
      expect('meeting' in got.excerpt).toBe(false);
      expect(stringsOf(got.excerpt).some((x) => x.includes('player is always right'))).toBe(false);
    }
  });
  it('no actions, or the sale not at the moment\'s last check or the next: no exit and nothing after it', async () => {
    const none = await absentWith((t) => { delete t.actions; }, 'exit');
    expect(none.excerpt.afterExit).toBeUndefined();
    const late = await absentWith((t) => { t.actions.find((a) => a.symbolOut === 'ETN').tickSeq = 22; }, 'exit');
    expect(late.excerpt.afterExit).toBeUndefined();
    await absentWith((t) => { t.actions.find((a) => a.symbolOut === 'ETN').tickSeq = null; }, 'exit');
  });
  it('a sale with a part unrecorded keeps the rest: no exit price, no bought symbol (an exit to cash)', async () => {
    const got = await momentOver(withTape((t) => { const a = t.actions.find((x) => x.symbolOut === 'ETN'); a.exitPrice = null; a.symbolIn = null; }));
    expect(Object.keys(got.excerpt.exit).sort()).toEqual(['exitReason', 'mechanism', 'sold']);
  });
  it('no series for the sold symbol, another owner\'s, or no bar after the exit: no afterExit, the exit kept', async () => {
    const gone = await momentOver(excerptStore(DAY, { over: { [SERIES_ETN]: undefined } }));
    expect(gone.excerpt.afterExit).toBeUndefined();
    expect(gone.excerpt.exit).toBeDefined();
    const etn = clone(DAY.series.find((s) => s.symbol === 'ETN'));
    const foreign = await momentOver(excerptStore(DAY, { over: { [SERIES_ETN]: { ...etn, ownerId: 'someone-else' } } }));
    expect(foreign.excerpt.afterExit).toBeUndefined();
    const early = await momentOver(excerptStore(DAY, { over: { [SERIES_ETN]: { ...etn, bars: etn.bars.filter((b) => Date.parse(b.t) < Date.parse('2026-09-23T19:00:00.000Z')) } } }));
    expect(early.excerpt.afterExit).toBeUndefined();
  });
  it('CD-8 — THE IDEA THE BATTLE CARRIED: the fixture day mints no call, and the idea is there — from the battle\'s frozen carriage', async () => {
    expect(DAY.tape.calls).toEqual([]);
    expect(DAY.fx.battle.agentContext.equippedHypothesis).toMatchObject({ watchlistId: EXCERPT_WATCHLIST, hypothesisVersion: EXCERPT_IDEA_VERSION, contentHash: EXCERPT_CONTENT_HASH });
    expect(LIVE.moment.excerpt.idea).toEqual({ label: 'i1', version: { value: EXCERPT_IDEA_VERSION, class: 'recorded' }, statement: { text: EXCERPT_STATEMENT, by: 'player', at: ideaVersionDoc().createdAt, class: 'quoted' } });
    expect(LIVE.moment.refs.i1).toBe(EXCERPT_WATCHLIST);
  });
  it('CD-8 — NO CARRIAGE, NO IDEA, whatever the day\'s calls name (the mutant: the idea read from calls[] again)', async () => {
    const noCarriage = { ...DAY.fx.battle, agentContext: { ...DAY.fx.battle.agentContext } };
    delete noCarriage.agentContext.equippedHypothesis;
    for (const calls of [[], [ideaCall(EXCERPT_BATTLE)], [ideaCall(EXCERPT_BATTLE), ideaCall(EXCERPT_BATTLE, { watchlistId: 'wl-other', hypothesisVersion: 1 })]]) {
      const tape = { ...clone(DAY.tape), calls };
      const got = await momentOver(excerptStore({ ...DAY, tape }, { over: { [`agentBattles/${EXCERPT_BATTLE}`]: noCarriage } }));
      expect(got.excerpt.idea, `${calls.length} calls`).toBeUndefined();
      expect(got.refs.i1).toBeUndefined();
    }
  });
  it('CD-8 — CONTRADICTORY CALLS ARE IGNORED: calls naming another list, another version, or two ideas leave the carried idea exactly as it is', async () => {
    for (const calls of [[ideaCall(EXCERPT_BATTLE, { watchlistId: 'wl-other', hypothesisVersion: 1 })], [ideaCall(EXCERPT_BATTLE, { watchlistId: EXCERPT_WATCHLIST, hypothesisVersion: 9 })], [ideaCall(EXCERPT_BATTLE), ideaCall(EXCERPT_BATTLE, { watchlistId: 'wl-other', hypothesisVersion: 1 })]]) {
      const got = await momentOver(withTape((t) => { t.calls = calls; }));
      expect(got.excerpt.idea).toEqual(LIVE.moment.excerpt.idea);
      expect(got.refs.i1).toBe(EXCERPT_WATCHLIST);
    }
  });
  it('CD-8 / CE-5 — THE VERSION DOCUMENT: missing or unread, the idea without its statement (never the frozen one); another owner\'s, or one contradicting the carriage — another list, version number or content hash — no idea at all', async () => {
    const missing = await momentOver(excerptStore(DAY, { idea: undefined, over: { [IDEA_PATH]: undefined } }));
    expect(missing.excerpt.idea).toEqual({ label: 'i1', version: { value: EXCERPT_IDEA_VERSION, class: 'recorded' } });
    expect(missing.refs.i1).toBe(EXCERPT_WATCHLIST);
    for (const foreign of [ideaVersionDoc({ userId: 'someone-else' }), ideaVersionDoc({ watchlistId: 'wl-other' }), ideaVersionDoc({ version: 2 }), ideaVersionDoc({ contentHash: 'f'.repeat(64) })]) {
      const got = await momentOver(excerptStore(DAY, { idea: foreign }));
      expect(got.excerpt.idea, JSON.stringify(foreign).slice(0, 120)).toBeUndefined();
      expect(got.refs.i1).toBeUndefined();
    }
  });
  it('CD-8 — THE CARRIAGE IS READ FOR ITS IDENTITY ONLY: a carriage whose frozen statement says otherwise changes nothing; a malformed carriage (no hash, a version of 0, a reserved list id) is no idea', async () => {
    const carriage = DAY.fx.battle.agentContext.equippedHypothesis;
    const withCarriage = (c) => ({ ...DAY.fx.battle, agentContext: { ...DAY.fx.battle.agentContext, equippedHypothesis: c } });
    const frozen = await momentOver(excerptStore(DAY, { over: { [`agentBattles/${EXCERPT_BATTLE}`]: withCarriage({ ...carriage, statement: 'FROZEN WORDS NEVER READ' }) } }));
    expect(frozen.excerpt.idea).toEqual(LIVE.moment.excerpt.idea);
    for (const bad of [{ ...carriage, contentHash: undefined }, { ...carriage, hypothesisVersion: 0 }, { ...carriage, watchlistId: '__x__' }]) {
      const got = await momentOver(excerptStore(DAY, { over: { [`agentBattles/${EXCERPT_BATTLE}`]: withCarriage(bad) } }));
      expect(got.excerpt.idea).toBeUndefined();
    }
  });
  it('the count: the item at the LAST check; with it missing, no count (the mutant: a neighbouring check\'s count)', async () => {
    await absentWith((t) => { t.tags.items = t.tags.items.map((i) => (i.symbol === 'ETN' && i.tickSeq === 19 ? { ...i, count: null } : i)); }, 'count');
    const rec = await momentOver(withTape((t) => {
      t.tags.inputs.holdingBasis = { ...t.tags.inputs.holdingBasis, ETN: 'recorded' };
      t.checks.find((c) => c.tickSeq === 19).stagnation = { ETN: { ticks: 6, withinAge: true, dailyPct: -0.001 } };
    }));
    expect(rec.excerpt.count).toEqual({ value: 6, class: 'recorded' });
    await absentWith((t) => {
      t.tags.inputs.holdingBasis = { ...t.tags.inputs.holdingBasis, ETN: 'recorded' };
      t.checks.find((c) => c.tickSeq === 18).stagnation = { ETN: { ticks: 5, withinAge: true, dailyPct: -0.001 } };
    }, 'count');
  });
  it('a number its document declares no class for is not carried', async () => {
    const got = await momentOver(withTape((t) => { delete t.numberClasses['actions[].exitPrice']; }));
    expect(got.excerpt.exit.exitPrice).toBeUndefined();
    expect(got.excerpt.exit.sold).toBeDefined();
  });
  it('EVERY CLASS IS THE DOCUMENT\'S OWN (§2 review L1-6): no declaration for the items\' version, or a series bar\'s close — that number is not carried; the carried idea\'s version is the battle\'s own, `recorded` (CE-5), whatever the tape declares', async () => {
    const noTapeCallClass = await momentOver(withTape((t) => { delete t.numberClasses['calls[].hypothesisRef.hypothesisVersion']; }));
    expect(noTapeCallClass.excerpt.idea).toEqual(LIVE.moment.excerpt.idea);
    expect(LIVE.moment.excerpt.idea.version).toEqual({ value: EXCERPT_IDEA_VERSION, class: 'recorded' });
    const noItemVersion = await momentOver(withTape((t) => { delete t.numberClasses['tags.items[].version']; }));
    expect(noItemVersion.excerpt.situationVersion).toBeUndefined();
    const etn = clone(DAY.series.find((s) => s.symbol === 'ETN'));
    delete etn.numberClasses['bars[].c'];
    const noBarClass = await momentOver(excerptStore(DAY, { over: { [SERIES_ETN]: etn } }));
    expect(noBarClass.excerpt.afterExit).toBeUndefined();
  });
  it('the directive heard just BEFORE the moment\'s first check is not taken (the lower bound — §2 review L1-6)', async () => {
    await absentWith((t) => { t.directives[DIR15].heard = { ...t.directives[DIR15].heard, tickSeq: 14 }; }, 'directive');
  });
  it('A LOOSE TIME CARRIES NO TEXT (§2 review L1-1): a rationale\'s loose time holding an id is null — no id reaches `excerpt`', async () => {
    const PLANTED = '9/23/2026 13:30 (Ab3dEf7hIj9kLm1nOp5q)';
    expect(Number.isFinite(Date.parse(PLANTED))).toBe(true);   // Date.parse alone would have read it
    const rationale = await momentOver(withTape((t) => { t.rationale[RAT15].at = PLANTED; }));
    expect(rationale.excerpt.rationale.rationale.at).toBeNull();
    expect(idsIn(rationale.excerpt)).toEqual([]);
  });
  it('the writer\'s `unrecorded` mechanism is its sentinel for a missing exit reason — absent here, as the reason is (§2 review L1-4)', async () => {
    const got = await momentOver(withTape((t) => { const a = t.actions.find((x) => x.symbolOut === 'ETN'); a.exitReason = null; a.mechanism = 'unrecorded'; }));
    expect(Object.keys(got.excerpt.exit).sort()).toEqual(['bought', 'exitPrice', 'sold']);
  });
  it('the card note\'s bound IS S10 (the card\'s own note limit), pinned (§2 review L1-9)', () => {
    expect(EXCERPT_BOUNDS.note).toBe(CARD_SLOTS.S10.noteMaxChars);
  });
  it('a symbol the directory lacks has no sector (the mutant: a sector guessed)', async () => {
    const tape = clone(DAY.tape);
    for (const i of tape.tags.items) if (i.symbol === 'META') i.symbol = 'ZZQX';
    const got = await momentOver(excerptStore({ ...DAY, tape }), { ...MOMENT_ASK, moment: { ...META_MOMENT, symbol: 'ZZQX' } });
    expect(got.excerpt.symbol.value).toBe('ZZQX');
    expect(got.excerpt.sector).toBeUndefined();
  });
  it('recurrences are not carried in version 1 (they need a window of tape days — a read the excerpt may not make)', async () => {
    expect((await cardOver(excerptStore(DAY, { card: excerptCard({ route: 'watch' }) }))).excerpt.recurrences).toBeUndefined();
  });
});

// ── every time a real instant (CE-3) ────────────────────────────────────────

/** The same instant as `iso`, written with offset `sign hh:mm` — a valid instant whose clock reads differently. */
const withOffset = (iso, sign, hh, mm = 0) => {
  const shift = (sign === '+' ? 1 : -1) * (hh * 60 + mm) * 60_000;
  const local = new Date(Date.parse(iso) + shift).toISOString().slice(0, 23);
  return `${local}${sign}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
/** The times CE-3 names: refused ones (each a string Date.parse alone would read, or nearly) and the two valid forms. */
const LOOSE_TIMES = Object.freeze({
  'a date only': (iso) => iso.slice(0, 10),
  'a time with no zone': (iso) => iso.slice(0, 19),
  '30 February': () => '2026-02-30T15:00:00.000Z',
  '31 April': () => '2026-04-31T15:00:00.000Z',
  '24:00': (iso) => `${iso.slice(0, 10)}T24:00:00.000Z`,
});
const VALID_TIMES = Object.freeze({ 'a valid offset': (iso) => withOffset(iso, '+', 5, 30), 'a valid Z': (iso) => iso });

describe('CE-3 — every time a real instant, or nothing is inferred from it (C2-F3)', () => {
  const SALE = DAY.tape.actions.find((a) => a.symbolOut === 'ETN');
  it('THE EXIT: a loose or impossible exit time gives no afterExit — the exit itself stays, placed by its tickSeq (R6); a valid offset or Z gives the same afterExit', async () => {
    expect(LIVE.moment.excerpt.afterExit).toBeDefined();
    for (const [name, make] of Object.entries(LOOSE_TIMES)) {
      const got = await momentOver(withTape((t) => { t.actions.find((a) => a.symbolOut === 'ETN').at = make(SALE.at); }));
      expect(got.excerpt.exit, name).toEqual(LIVE.moment.excerpt.exit);
      expect(got.excerpt.afterExit, name).toBeUndefined();
    }
    for (const [name, make] of Object.entries(VALID_TIMES)) {
      const got = await momentOver(withTape((t) => { t.actions.find((a) => a.symbolOut === 'ETN').at = make(SALE.at); }));
      expect(got.excerpt.afterExit, name).toEqual(LIVE.moment.excerpt.afterExit);
    }
  });
  it('A QUOTATION\'S TIME: a loose or impossible time keeps the words with `at: null`; a valid offset or Z is carried as written', async () => {
    const at = DAY.tape.rationale[RAT15].at;
    for (const [name, make] of Object.entries(LOOSE_TIMES)) {
      const got = await momentOver(withTape((t) => { t.rationale[RAT15].at = make(at); }));
      expect(got.excerpt.rationale.rationale, name).toEqual({ ...LIVE.moment.excerpt.rationale.rationale, at: null });
      expect(got.excerpt.rationale.hypothesis.at, name).toBeNull();
    }
    for (const [name, make] of Object.entries(VALID_TIMES)) {
      const got = await momentOver(withTape((t) => { t.rationale[RAT15].at = make(at); }));
      expect(got.excerpt.rationale.rationale.at, name).toBe(make(at));
    }
  });
  it('A TIE-BREAK BY TIME reads instants, never strings: of two directives heard at the same check, the one filed a minute earlier wins though its offset clock reads later', async () => {
    const filed = DAY.tape.directives[DIR15].filedAt;
    const earlier = withOffset(new Date(Date.parse(filed) - 60_000).toISOString(), '+', 5, 0);
    expect(earlier > filed).toBe(true);   // as a string it sorts later
    const got = await momentOver(withTape((t) => { t.directives.push({ ...clone(t.directives[DIR15]), playerText: 'Sell the laggard first.', filedAt: earlier }); }));
    expect(got.excerpt.directive.playerText).toEqual({ text: 'Sell the laggard first.', by: 'player', at: earlier, class: 'quoted' });
  });
  it('A TIE-BREAK BY TIME, the directive (CE-3 + CE-4): a tied directive filed at a date only, no zone, 30 February, 31 April or 24:00 leaves the tie unsettled — no directive, whichever row holds the loose time; a valid offset or Z settles it by instant', async () => {
    const filed = DAY.tape.directives[DIR15].filedAt;
    const twin = (t, filedAt) => t.directives.push({ ...clone(t.directives[DIR15]), playerText: 'Sell the laggard first.', filedAt });
    for (const [name, make] of Object.entries(LOOSE_TIMES)) {
      const onTwin = await momentOver(withTape((t) => { twin(t, make(filed)); }));
      expect(onTwin.excerpt.directive, `${name}, on the twin`).toBeUndefined();
      const onOriginal = await momentOver(withTape((t) => { twin(t, filed); t.directives[DIR15].filedAt = make(filed); }));
      expect(onOriginal.excerpt.directive, `${name}, on the original`).toBeUndefined();
    }
    const earlier = await momentOver(withTape((t) => { twin(t, VALID_TIMES['a valid offset'](new Date(Date.parse(filed) - 60_000).toISOString())); }));
    expect(earlier.excerpt.directive.playerText.text).toBe('Sell the laggard first.');
    const later = await momentOver(withTape((t) => { twin(t, VALID_TIMES['a valid Z'](new Date(Date.parse(filed) + 60_000).toISOString())); }));
    expect(later.excerpt.directive).toEqual(LIVE.moment.excerpt.directive);
  });
  it('A TIE-BREAK BY TIME, the exit (CE-3 + CE-4): a tied sale at a loose or impossible time leaves the tie unsettled — no exit and no afterExit; a valid offset or Z settles it by instant', async () => {
    const twin = (t, at) => t.actions.push({ ...clone(t.actions.find((a) => a.symbolOut === 'ETN')), exitPrice: 999, at });
    for (const [name, make] of Object.entries(LOOSE_TIMES)) {
      const got = await momentOver(withTape((t) => { twin(t, make(SALE_AT)); }));
      expect(got.excerpt.exit, name).toBeUndefined();
      expect(got.excerpt.afterExit, name).toBeUndefined();
    }
    const earlier = await momentOver(withTape((t) => { twin(t, VALID_TIMES['a valid offset'](new Date(Date.parse(SALE_AT) - 60_000).toISOString())); }));
    expect(earlier.excerpt.exit.exitPrice.value).toBe(999);
    const later = await momentOver(withTape((t) => { twin(t, VALID_TIMES['a valid Z'](new Date(Date.parse(SALE_AT) + 60_000).toISOString())); }));
    expect(later.excerpt.exit).toEqual(LIVE.moment.excerpt.exit);
    expect(later.excerpt.afterExit).toEqual(LIVE.moment.excerpt.afterExit);
  });
});

// ── a tie the rules don't settle (CE-4) ─────────────────────────────────────

const SALE_AT = DAY.tape.actions.find((a) => a.symbolOut === 'ETN').at;
/** A seeded shuffle (a small LCG): the same order on every run. */
const shuffled = (list, seed) => {
  const out = [...list];
  let x = seed;
  for (let i = out.length - 1; i > 0; i -= 1) { x = (x * 1103515245 + 12345) % 2147483648; const j = x % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
/** The orders every tie is judged under: as stored (the twin last), the tied pair swapped, the whole section reversed, two seeded shuffles. */
const ORDERS = Object.freeze({
  'as stored': (l, p) => [...l],
  'the pair swapped': (l, p) => { const o = [...l]; const q = o.length - 1; [o[p], o[q]] = [o[q], o[p]]; return o; },
  reversed: (l) => [...l].reverse(),
  'shuffle 7': (l) => shuffled(l, 7),
  'shuffle 11': (l) => shuffled(l, 11),
});
const ETN_SERIES = DAY.series.find((s) => s.symbol === 'ETN');
const BARS_AFTER = ETN_SERIES.bars.map((b, k) => ({ b, k })).filter(({ b }) => Date.parse(b.t) > Date.parse(SALE_AT));
/**
 * The six selections Astra's C2-F4 names — each with how to plant a twin of the selected row (`twin(t, patch)` mutates
 * the tape, or for the bars hands back a series), the section the orders permute, and the field(s) it fills.
 */
const recordedCountTape = (t) => { t.tags.inputs.holdingBasis = { ...t.tags.inputs.holdingBasis, ETN: 'recorded' }; t.checks.find((c) => c.tickSeq === 19).stagnation = { ETN: { ticks: 6, withinAge: true, dailyPct: -0.001 } }; };
const TIES = {
  rationale: { section: (t) => t.rationale, at: () => RAT15, twin: (t, patch) => t.rationale.push({ ...clone(t.rationale[RAT15]), ...patch }), conflicts: [{ rationale: 'second row' }, { hypothesis: 'another hypothesis' }, { at: '2026-09-23T17:44:00.000Z' }], fields: ['rationale'] },
  directive: { section: (t) => t.directives, at: () => DIR15, twin: (t, patch) => t.directives.push({ ...clone(t.directives[DIR15]), ...patch }), conflicts: [{ playerText: 'second player row' }, { canonicalText: 'another canonical text' }], fields: ['directive'] },
  exit: { section: (t) => t.actions, at: (t) => t.actions.findIndex((a) => a.symbolOut === 'ETN'), twin: (t, patch) => t.actions.push({ ...clone(t.actions.find((a) => a.symbolOut === 'ETN')), ...patch }), conflicts: [{ exitPrice: 999 }, { mechanism: 'guardrail' }, { exitReason: 'guardrail_stopLoss' }, { symbolIn: 'NVDA' }], fields: ['exit', 'afterExit'] },
  'tag item': { section: (t) => t.tags.items, at: (t) => t.tags.items.findIndex((i) => i.symbol === 'ETN' && i.tickSeq === 19), twin: (t, patch) => t.tags.items.push({ ...clone(t.tags.items.find((i) => i.symbol === 'ETN' && i.tickSeq === 19)), ...patch }), conflicts: [{ count: 999 }], fields: ['count'] },
  check: { prep: recordedCountTape, section: (t) => t.checks, at: (t) => t.checks.findIndex((c) => c.tickSeq === 19), twin: (t, patch) => t.checks.push({ ...clone(t.checks.find((c) => c.tickSeq === 19)), ...patch }), conflicts: [{ stagnation: { ETN: { ticks: 999, withinAge: true, dailyPct: -0.001 } } }], fields: ['count'] },
};
/** The excerpt for a tape edit, its section then put in `order` (the selected row at index `p`, the twin last). */
const tiedOver = async (c, patch, order) => momentOver(withTape((t) => {
  c.prep?.(t);
  const p = c.at(t);
  c.twin(t, patch);
  const sec = c.section(t);
  sec.splice(0, sec.length, ...order(sec, p));
}));
/** The series bars' excerpt, with a twin of a bar after the exit (`k`: which of them; `patch`), in `order`. */
const barTwinOver = async (k, patch, order) => {
  const s = clone(ETN_SERIES);
  const { b, k: at } = BARS_AFTER[k];
  s.bars.push({ ...clone(b), ...patch });
  s.bars = order(s.bars, at);
  return momentOver(excerptStore(DAY, { over: { [SERIES_ETN]: s } }));
};

describe('CE-4 — a tie the rules don\'t settle means nothing is said (C2-F4); array order is never a rule', () => {
  for (const [name, c] of Object.entries(TIES)) {
    it(`${name}: a CONFLICTING twin at the selecting key — on EVERY field the selection compares (the fix round's review, CX1-2) — the field and its dependents absent, under every order of the stored rows`, async () => {
      for (const [o, order] of Object.entries(ORDERS)) for (const conflict of c.conflicts) {
        const got = await tiedOver(c, conflict, order);
        expect(got, `${name} · ${o}`).not.toBeNull();
        for (const f of c.fields) expect(got.excerpt[f], `${name} · ${o} · ${f}`).toBeUndefined();
      }
    });
    it(`${name}: an IDENTICAL twin counts as one — the same answer as with no twin, under every order`, async () => {
      const base = c.prep ? await momentOver(withTape(c.prep)) : LIVE.moment;
      for (const [o, order] of Object.entries(ORDERS)) {
        const got = await tiedOver(c, {}, order);
        for (const f of c.fields) expect(got.excerpt[f], `${name} · ${o} · ${f}`).toEqual(base.excerpt[f]);
        expect(got.excerpt[c.fields[0]], `${name} · ${o}`).toBeDefined();
      }
    });
  }
  it('series bar: a CONFLICTING twin at the latest start — no afterExit (the exit kept), under every order', async () => {
    for (const [o, order] of Object.entries(ORDERS)) {
      const got = await barTwinOver(BARS_AFTER.length - 1, { c: 999 }, order);
      expect(got.excerpt.afterExit, o).toBeUndefined();
      expect(got.excerpt.exit, o).toEqual(LIVE.moment.excerpt.exit);
    }
  });
  it('series bar: an IDENTICAL twin counts as one — `barsAfter` counts distinct starts, never the duplicate (the mutant: counted twice), under every order', async () => {
    for (const [o, order] of Object.entries(ORDERS)) {
      for (const k of [0, BARS_AFTER.length - 1]) {
        const got = await barTwinOver(k, {}, order);
        expect(got.excerpt.afterExit, `${o} · bar ${k}`).toEqual(LIVE.moment.excerpt.afterExit);
      }
    }
    expect(LIVE.moment.excerpt.afterExit.barsAfter.value).toBe(BARS_AFTER.length);
  });
  it('SETTLED CONTROLS — a tie the rules DO settle answers, under every order: a conflicting rationale earlier than the nearest; a directive heard later, or filed later; a sale at a later check; a tag item at another check; a conflicting bar at an earlier start', async () => {
    for (const [o, order] of Object.entries(ORDERS)) {
      const earlierRationale = await tiedOver(TIES.rationale, { rationale: 'an earlier row', tickSeq: 14 }, order);
      expect(earlierRationale.excerpt.rationale, o).toEqual(LIVE.moment.excerpt.rationale);
      const heardLater = await tiedOver(TIES.directive, { playerText: 'heard later', heard: { ...DAY.tape.directives[DIR15].heard, tickSeq: 16 } }, order);
      expect(heardLater.excerpt.directive, o).toEqual(LIVE.moment.excerpt.directive);
      const filedLater = await tiedOver(TIES.directive, { playerText: 'filed later', filedAt: new Date(Date.parse(DAY.tape.directives[DIR15].filedAt) + 60_000).toISOString() }, order);
      expect(filedLater.excerpt.directive, o).toEqual(LIVE.moment.excerpt.directive);
      const filedEarlier = await tiedOver(TIES.directive, { playerText: 'filed earlier', filedAt: new Date(Date.parse(DAY.tape.directives[DIR15].filedAt) - 60_000).toISOString() }, order);
      expect(filedEarlier.excerpt.directive.playerText.text, o).toBe('filed earlier');
      const saleLater = await tiedOver(TIES.exit, { exitPrice: 999, tickSeq: 22 }, order);
      expect(saleLater.excerpt.exit, o).toEqual(LIVE.moment.excerpt.exit);
      const itemElsewhere = await tiedOver(TIES['tag item'], { count: 999, symbol: 'META' }, order);
      expect(itemElsewhere.excerpt.count, o).toEqual(LIVE.moment.excerpt.count);
      const earlierBar = await barTwinOver(0, { c: 999 }, order);
      expect(earlierBar.excerpt.afterExit, o).toEqual(LIVE.moment.excerpt.afterExit);
    }
  });
  it('A CONFLICT NEVER FALLS BACK TO A NEIGHBOUR: conflicting rationale rows at the first check, with a clean row before it — no rationale; conflicting sales at the last check, with a clean sale at the next — no exit and no afterExit', async () => {
    expect(DAY.tape.rationale.some((r) => r.tickSeq < 15)).toBe(true);
    const rationale = await tiedOver(TIES.rationale, { rationale: 'second row' }, ORDERS['as stored']);
    expect(rationale.excerpt.rationale).toBeUndefined();
    const sales = await momentOver(withTape((t) => {
      const sale = t.actions.find((a) => a.symbolOut === 'ETN');
      expect(sale.tickSeq).toBe(20);
      t.actions.push({ ...clone(sale), tickSeq: 19, exitPrice: 100 }, { ...clone(sale), tickSeq: 19, exitPrice: 999 });
    }));
    expect(sales.excerpt.exit).toBeUndefined();
    expect(sales.excerpt.afterExit).toBeUndefined();
  });
});

// ── the fix round's §2 review, lens 1 (CX1) ─────────────────────────────────

/** The excerpt under each order of the stored tag items (the twin appended last, so 'the pair swapped' puts it first). */
const underItemOrders = async (edit, at = (t) => t.tags.items.findIndex((i) => i.symbol === 'ETN' && i.tickSeq === 15)) => {
  const out = {};
  for (const [o, order] of Object.entries(ORDERS)) {
    out[o] = await momentOver(withTape((t) => { const p = at(t); edit(t); t.tags.items = order(t.tags.items, p); }));
  }
  return out;
};

describe('the fix round\'s §2 review, lens 1 — what the shared day judge takes first, and the auxiliary reads', () => {
  it('CX1-1 — THE MOMENT\'S VERSION is said only when every stored item of the moment agrees: a twin at its first check tagged under another version leaves `situationVersion` out — the same excerpt under every order of the stored items', async () => {
    const twin = (t) => t.tags.items.push({ ...clone(t.tags.items.find((i) => i.symbol === 'ETN' && i.tickSeq === 15)), version: 3 });
    const got = await underItemOrders(twin);
    for (const [o, x] of Object.entries(got)) {
      expect(x, o).not.toBeNull();
      expect(x.excerpt.situationVersion, o).toBeUndefined();
      expect(x, o).toEqual(got['as stored']);
    }
    expect(LIVE.moment.excerpt.situationVersion).toEqual({ value: 2, class: 'recorded' });
  });
  it('CX1-1 — THE MOMENT\'S LAST INSTANT is said only when every stored item at that check agrees: a twin at its last check holding another time leaves `to` out — the same excerpt under every order', async () => {
    for (const other of ['not a time', '2026-09-23T18:46:00.000Z']) {
      const twin = (t) => t.tags.items.push({ ...clone(t.tags.items.find((i) => i.symbol === 'ETN' && i.tickSeq === 19)), at: other });
      const got = await underItemOrders(twin, (t) => t.tags.items.findIndex((i) => i.symbol === 'ETN' && i.tickSeq === 19));
      for (const [o, x] of Object.entries(got)) {
        expect(x, `${other} · ${o}`).not.toBeNull();
        expect(x.excerpt.to, `${other} · ${o}`).toBeUndefined();
        expect(x.excerpt.from, `${other} · ${o}`).toEqual(LIVE.moment.excerpt.from);
        expect(x, `${other} · ${o}`).toEqual(got['as stored']);
      }
    }
  });
  it('CX1-1 — and its FIRST instant the same way: a twin at the first check holding another time leaves `from` out, in every order', async () => {
    const twin = (t) => t.tags.items.push({ ...clone(t.tags.items.find((i) => i.symbol === 'ETN' && i.tickSeq === 15)), at: '2026-09-23T17:44:00.000Z' });
    const got = await underItemOrders(twin);
    for (const [o, x] of Object.entries(got)) {
      expect(x.excerpt.from, o).toBeUndefined();
      expect(x, o).toEqual(got['as stored']);
    }
  });
  it('CX1-1, THE CARD PATH (the refuter\'s confirmation) — a card filed under the moment\'s version, on a day whose items at the moment disagree on their version, is null in EVERY order of the stored items (the shared judge compares only the first it meets)', async () => {
    expect((await cardOver(excerptStore(DAY))).excerpt.situationVersion).toEqual({ value: 2, class: 'recorded' });
    for (const [o, order] of Object.entries(ORDERS)) {
      const tape = clone(DAY.tape);
      const p = tape.tags.items.findIndex((i) => i.symbol === 'ETN' && i.tickSeq === 15);
      tape.tags.items.push({ ...clone(tape.tags.items[p]), version: 3 });
      tape.tags.items = order(tape.tags.items, p);
      expect(await cardOver(excerptStore({ ...DAY, tape })), o).toBeNull();
    }
  });
  it('CX1-3 — A FAILED AUXILIARY READ GIVES A PARTIAL EXCERPT, never null and never a thrown error (CE-6): the version\'s read failing keeps the idea without its statement; the series\' read failing keeps the exit without afterExit; a failed core read is null', async () => {
    const failing = (path) => makeTapeDb(excerptStore(DAY), { hooks: { beforeRead: (label) => { if (label === path) throw Object.assign(new Error('unavailable'), { code: 14 }); } } }).db;
    const noVersion = await excerptOf(failing(IDEA_PATH), MOMENT_ASK);
    expect(noVersion.excerpt.idea).toEqual({ label: 'i1', version: LIVE.moment.excerpt.idea.version });
    expect(noVersion.excerpt.afterExit).toEqual(LIVE.moment.excerpt.afterExit);
    const noSeries = await excerptOf(failing(SERIES_ETN), MOMENT_ASK);
    expect(noSeries.excerpt.afterExit).toBeUndefined();
    expect(noSeries.excerpt.exit).toEqual(LIVE.moment.excerpt.exit);
    expect(noSeries.excerpt.idea).toEqual(LIVE.moment.excerpt.idea);
    for (const core of [TAPE_PATH, `agentBattles/${EXCERPT_BATTLE}`]) expect(await excerptOf(failing(core), MOMENT_ASK), core).toBeNull();
  });
  it('CX1-5 — A BAR WHOSE START IS NO STRICT INSTANT might fall after the exit: no afterExit at all (the exit kept), never the latest of the bars it could read', async () => {
    for (const t of ['2026-09-23T19:55:00', 'not a time', '2026-02-30T19:55:00.000Z']) {
      const etn = clone(ETN_SERIES);
      etn.bars.push({ ...clone(etn.bars.at(-1)), t, c: 999 });
      const got = await momentOver(excerptStore(DAY, { over: { [SERIES_ETN]: etn } }));
      expect(got.excerpt.afterExit, t).toBeUndefined();
      expect(got.excerpt.exit, t).toEqual(LIVE.moment.excerpt.exit);
    }
  });
  it('CX1-7 — THE CARD\'S OTHER IDS are known exactly: the idea it became, its result and its Forge offer, planted in the note, leave the note out', async () => {
    const ids = { bookId: 'book-cx1-7', ideaId: 'idea-cx1-7', resultRef: 'results-cx1-7', offerId: 'offer-cx1-7' };
    const adopted = (note) => ({ ...excerptCard({ note }), stage: 'installed', nomination: { bookId: ids.bookId, nominationId: EXCERPT_ENTRY, state: 'accepted', ideaId: ids.ideaId }, idea: { bookId: ids.bookId, ideaId: ids.ideaId }, result: { ideaId: ids.ideaId, resultRef: ids.resultRef }, offer: { ideaId: ids.ideaId, offerId: ids.offerId, state: 'accepted' } });
    expect((await cardOver(storeOfDay(DAY, { card: adopted(EXCERPT_NOTE) }))).excerpt.inputQuote.text).toBe(EXCERPT_NOTE);
    for (const [kind, id] of Object.entries(ids)) {
      const got = await cardOver(storeOfDay(DAY, { card: adopted(`Recorded ${id} here.`) }));
      expect(got.excerpt.inputQuote, kind).toBeUndefined();
      expect(got.excerpt.card, kind).toBeDefined();
    }
  });
});

// ── labels, never ids (CC-3) ────────────────────────────────────────────────

/** Every string a value holds, its keys included. */
const stringsOf = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); stringsOf(x, out); }
  return out;
};
const NOMINATION = 'nom-planted-7f3a';
const BOOK = 'book-planted-91c2';
const KNOWN_IDS = Object.freeze({ battle: EXCERPT_BATTLE, uid: OWNER, agent: AGENT, clone: CLONE_AGENT, entry: EXCERPT_ENTRY, watchlist: EXCERPT_WATCHLIST, nomination: NOMINATION, book: BOOK });
/** Id SHAPES beyond the fixture's: a Firestore auto-id or Firebase uid (20+ alphanumerics), a UUID, a casual clone's id. */
const ID_SHAPES = [/\b[A-Za-z0-9]{20,}\b/, /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, /casual-agent-/];
const idsIn = (excerpt) => {
  const hits = [];
  for (const s of stringsOf(excerpt)) {
    for (const [kind, id] of Object.entries(KNOWN_IDS)) if (s.includes(id)) hits.push(`${kind}: ${s}`);
    for (const re of ID_SHAPES) if (re.test(s)) hits.push(`shape ${re}: ${s}`);
  }
  return hits;
};

describe('CC-3 — labels, never ids', () => {
  it('no excerpt — the goldens and the live answers — holds an id-shaped value; `refs` maps each label present to its real id', () => {
    for (const e of [GOLDEN.moment.excerpt, GOLDEN.card.excerpt, LIVE.moment.excerpt, LIVE.card.excerpt]) expect(idsIn(e)).toEqual([]);
    expect(GOLDEN.moment.excerpt.battle).toBe(EXCERPT_LABELS.battle);
    expect(GOLDEN.card.excerpt.idea.label).toBe(EXCERPT_LABELS.idea);
    expect(GOLDEN.card.excerpt.card.label).toBe(EXCERPT_LABELS.card);
    expect(GOLDEN.card.refs).toEqual({ b1: EXCERPT_BATTLE, i1: EXCERPT_WATCHLIST, c1: EXCERPT_ENTRY });
    expect(EXCERPT_LABELS).toEqual({ battle: 'b1', idea: 'i1', card: 'c1' });
  });
  it('a NOMINATED card — its book and nomination ids on the entry — still gives no id in `excerpt`', async () => {
    const nominated = { ...excerptCard(), stage: 'nominated', nomination: { bookId: BOOK, nominationId: NOMINATION, state: 'queued' } };
    const got = await cardOver(excerptStore(DAY, { card: nominated }));
    expect(idsIn(got.excerpt)).toEqual([]);
  });
  it('THE DETECTOR BITES: a planted battle id, uid, agent id, entry id, watchlist id and nomination id each fail it — as a value, inside words, or as a key', () => {
    for (const [kind, id] of Object.entries(KNOWN_IDS)) {
      for (const plant of [(e) => { e.battle = id; }, (e) => { e.rationale.rationale.text = `held ${id} here`; }, (e) => { e.card[id] = 1; }]) {
        const e = clone(GOLDEN.card.excerpt);
        plant(e);
        expect(idsIn(e).length, `${kind}`).toBeGreaterThan(0);
      }
    }
    for (const shaped of ['Ab3dEf7hIj9kLm1nOp5q', '123e4567-e89b-12d3-a456-426614174000', 'casual-agent-x']) {
      const e = clone(GOLDEN.moment.excerpt);
      e.symbol.value = shaped;
      expect(idsIn(e).length, shaped).toBeGreaterThan(0);
    }
  });
});

// ── no identifier rides in on someone's words (CE-1) ────────────────────────

/** A nominated card — its nomination and book on the entry, so the excerpt knows them (CE-1 item 1). */
const nominatedCard = (o = {}) => ({ ...excerptCard(), stage: 'nominated', nomination: { bookId: BOOK, nominationId: NOMINATION, state: 'queued' }, ...o });
/** Every quotation location (CD-14: the note is inputQuote only; CD-16: no meeting), each with how to plant words in it. */
const QUOTE_LOCATIONS = Object.freeze({
  inputQuote: { plant: (text) => storeOfDay(DAY, { card: nominatedCard({ note: text }) }), read: (e) => e.inputQuote },
  'idea.statement': { plant: (text) => storeOfDay(DAY, { card: nominatedCard(), idea: ideaVersionDoc({ statement: text }) }), read: (e) => e.idea?.statement },
  'rationale.hypothesis': { plant: (text) => withTape((t) => { t.rationale[RAT15].hypothesis = text; }, { card: nominatedCard() }), read: (e) => e.rationale?.hypothesis },
  'rationale.rationale': { plant: (text) => withTape((t) => { t.rationale[RAT15].rationale = text; }, { card: nominatedCard() }), read: (e) => e.rationale?.rationale },
  'directive.playerText': { plant: (text) => withTape((t) => { t.directives[DIR15].playerText = text; }, { card: nominatedCard() }), read: (e) => e.directive?.playerText },
  'directive.canonicalText': { plant: (text) => withTape((t) => { t.directives[DIR15].canonicalText = text; }, { card: nominatedCard() }), read: (e) => e.directive?.canonicalText },
});
/** Astra's ten id kinds (C2-F1): the fixture's own ids, each known to the card's excerpt exactly, and the two shapes. */
const PLANTED_IDS = Object.freeze({ ...KNOWN_IDS, 'Firestore auto-id': 'Ab3dEf7hIj9kLm1nOp5q', UUID: '123e4567-e89b-12d3-a456-426614174000' });
/** The excerpt with one location's quotation removed — what CE-1 leaves when it omits that quotation whole. */
const without = (excerpt, loc) => {
  const e = clone(excerpt);
  const [a, b] = loc.split('.');
  if (b) { delete e[a][b]; if (!Object.keys(e[a]).filter((k) => k !== 'label').length && a !== 'idea') delete e[a]; } else delete e[a];
  return e;
};
const NOMINATED_LIVE = await cardOver(storeOfDay(DAY, { card: nominatedCard() }));

describe('CE-1 — no identifier rides in on someone\'s words (C2-F1): a quotation holding one is left out WHOLE, never redacted', () => {
  it('the nominated card\'s excerpt carries all six quotations when no id is planted (the baseline every row below departs from)', () => {
    for (const [loc, l] of Object.entries(QUOTE_LOCATIONS)) expect(l.read(NOMINATED_LIVE.excerpt), loc).toBeDefined();
  });
  for (const [kind, id] of Object.entries(PLANTED_IDS)) {
    it(`${kind} (${id}), planted in each of the six quotation locations: that quotation is absent, every other field as before, and no id anywhere in \`excerpt\``, async () => {
      for (const [loc, l] of Object.entries(QUOTE_LOCATIONS)) {
        const got = await cardOver(l.plant(`Recorded ${id} here.`));
        expect(got, `${kind} in ${loc}`).not.toBeNull();
        expect(l.read(got.excerpt), `${kind} in ${loc}`).toBeUndefined();
        expect(got.excerpt, `${kind} in ${loc}: only that quotation leaves`).toEqual(without(NOMINATED_LIVE.excerpt, loc));
        expect(idsIn(got.excerpt), `${kind} in ${loc}`).toEqual([]);
        expect(stringsOf(got.excerpt).some((s) => s.includes(id)), `${kind} in ${loc}`).toBe(false);
      }
    });
  }
  it('the MOMENT\'s excerpt too (no card, so no entry, nomination or book known): the ids it knows, and the platform\'s shapes for the ones it does not — a card op id, a book, a clone, a Mandate manager — each leaves its quotation out', async () => {
    const plantedForMoment = { battle: EXCERPT_BATTLE, uid: OWNER, agent: AGENT, watchlist: EXCERPT_WATCHLIST, clone: CLONE_AGENT, 'a card op / nomination': 'op_123e4567-e89b-42d3-a456-426614174000', book: 'pf_0123456789abcdef01234567', manager: 'mgr_momentum_chaser_0123456789abcdef', uid28: 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ9b' };
    for (const [kind, id] of Object.entries(plantedForMoment)) {
      for (const loc of ['rationale.hypothesis', 'rationale.rationale', 'directive.playerText', 'directive.canonicalText']) {
        const [sec, key] = loc.split('.');
        const got = await momentOver(withTape((t) => { (sec === 'rationale' ? t.rationale[RAT15] : t.directives[DIR15])[key] = `Recorded ${id} here.`; }));
        expect(got.excerpt[sec]?.[key], `${kind} in ${loc}`).toBeUndefined();
        expect(idsIn(got.excerpt), `${kind} in ${loc}`).toEqual([]);
      }
      const statement = await momentOver(excerptStore(DAY, { idea: ideaVersionDoc({ statement: `Recorded ${id} here.` }) }));
      expect(statement.excerpt.idea.statement, `${kind} in the statement`).toBeUndefined();
      expect(statement.excerpt.idea.version, `${kind}: the idea itself kept`).toEqual(LIVE.moment.excerpt.idea.version);
    }
  });
  it('ORDINARY PROSE IS CARRIED in every location: tickers, prices, dates, times, percentages and long words', async () => {
    const PROSE = 'ETN dropped 2.4% to $385.70 on 2026-09-23 at 10:15 AM; BRK-B held. Internationalization, counterrevolutionaries.';
    for (const [loc, l] of Object.entries(QUOTE_LOCATIONS)) {
      const got = await cardOver(l.plant(PROSE));
      expect(l.read(got.excerpt)?.text, loc).toBe(PROSE);
    }
  });
  it('THE REAL PATHS: a note through the real card request (normalizeNote accepts it — CE-1 works at projection, not intake), and a chat message through the real tape writer — each quotation left out, the rest kept', { timeout: 60_000 }, async () => {
    const note = normalizeNote('  Recorded Ab3dEf7hIj9kLm1nOp5q here.  ');
    expect(note).toBe('Recorded Ab3dEf7hIj9kLm1nOp5q here.');
    const viaRequest = await cardOver(storeOfDay(DAY, { card: excerptCard({ note }) }));
    expect(viaRequest.excerpt.inputQuote).toBeUndefined();
    expect(viaRequest.excerpt.card).toEqual(LIVE.card.excerpt.card);
    const chatted = await excerptDay({ battleId: 'b-sep23-chat', edit: (fx) => { fx.battle.chatExchanges[0].userMessage = 'Refer to Ab3dEf7hIj9kLm1nOp5q'; } });
    const heard = chatted.tape.directives.find((d) => d.heard?.tickSeq === 15);
    expect(heard.playerText).toBe('Refer to Ab3dEf7hIj9kLm1nOp5q');   // the writer copied the player's words as they were
    const got = await momentOver(storeOfDay(chatted, { battleId: 'b-sep23-chat' }), { ...MOMENT_ASK, battleId: 'b-sep23-chat' });
    expect(got.excerpt.directive.playerText).toBeUndefined();
    expect(got.excerpt.directive.canonicalText).toEqual({ ...LIVE.moment.excerpt.directive.canonicalText, at: got.excerpt.directive.canonicalText.at });
    expect(idsIn(got.excerpt)).toEqual([]);
  });
  it('RECORDED WORDS OUTSIDE THEIR DOMAINS ARE ABSENT (CE-1 item 3): the moment\'s symbol, the situation, the route, the exit\'s reason, mechanism and bought symbol, the question — each an id here, none reaches `excerpt`', async () => {
    const ID = 'Ab3dEf7hIj9kLm1nOp5q';
    const symbolTape = clone(DAY.tape);
    for (const i of symbolTape.tags.items) if (i.symbol === 'ETN') i.symbol = ID;
    const symbol = await momentOver(storeOfDay({ ...DAY, tape: symbolTape }, { card: excerptCard() }), { ...MOMENT_ASK, moment: { ...ETN_MOMENT, symbol: ID } });
    expect(symbol).not.toBeNull();
    expect(symbol.excerpt.symbol).toBeUndefined();
    expect(symbol.excerpt.sector).toBeUndefined();
    const situationTape = clone(DAY.tape);
    for (const i of situationTape.tags.items) if (i.symbol === 'ETN') i.situationId = ID;
    const situation = await momentOver(storeOfDay({ ...DAY, tape: situationTape }, { card: excerptCard() }), { ...MOMENT_ASK, moment: { ...ETN_MOMENT, situationId: ID } });
    const exit = await momentOver(withTape((t) => { Object.assign(t.actions.find((a) => a.symbolOut === 'ETN'), { exitReason: ID, mechanism: ID, symbolIn: ID }); }));
    expect(Object.keys(exit.excerpt.exit).sort()).toEqual(['exitPrice', 'sold']);
    const route = await cardOver(storeOfDay(DAY, { card: { ...excerptCard(), route: ID } }));
    expect(route.excerpt.card.route).toBeUndefined();
    const question = await cardOver(storeOfDay(DAY, { card: { ...excerptCard(), questionId: ID } }));
    expect(question.excerpt.card.question).toBeUndefined();
    for (const [name, got] of Object.entries({ symbol, situation, exit, route, question })) {
      if (got === null) continue;   // a situation the registry lacks may be refused by the day check itself
      expect(stringsOf(got.excerpt).some((s) => s.includes(ID)), name).toBe(false);
      expect(idsIn(got.excerpt), name).toEqual([]);
    }
  });
});

// ── speakers (CC-2) ─────────────────────────────────────────────────────────

/** CC-2's table, pinned here from the amendment: each quoted field and its speaker. */
const SPEAKER_TABLE = Object.freeze({
  'idea.statement': 'player',
  'rationale.hypothesis': 'agent',
  'rationale.rationale': 'agent',
  'directive.playerText': 'player',
  'directive.canonicalText': 'platform',
  inputQuote: 'player',
});
const quotesIn = (v, p = '', out = {}) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.class === 'quoted') { out[p] = v; return out; }
    for (const [k, x] of Object.entries(v)) quotesIn(x, p ? `${p}.${k}` : k, out);
  }
  return out;
};

describe('CC-2 — every quotation one source, one speaker, with its time', () => {
  it('the card excerpt\'s quotations (live, and the golden alike) are exactly the table\'s, each by its speaker, shaped { text, by, at, class }, its time a strict instant or null', () => {
    expect(quotesIn(LIVE.card.excerpt)).toEqual(quotesIn(GOLDEN.card.excerpt));
    const q = quotesIn(LIVE.card.excerpt);
    expect(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v.by]))).toEqual(SPEAKER_TABLE);
    for (const [k, v] of Object.entries(q)) {
      expect(Object.keys(v).sort(), k).toEqual(['at', 'by', 'class', 'text']);
      expect(QUOTE_SPEAKERS, k).toContain(v.by);
      expect(v.at === null || STRICT_INSTANT.test(v.at), k).toBe(true);
    }
    expect(QUOTE_SPEAKERS).toEqual(['agent', 'player', 'platform']);
  });
  it('no quotation joins two speakers\' words (the mutant: the directive\'s texts in one quotation) — each text is exactly one source field', () => {
    const t = DAY.tape;
    const sources = {
      'idea.statement': ideaVersionDoc().statement,
      'rationale.hypothesis': t.rationale[RAT15].hypothesis,
      'rationale.rationale': t.rationale[RAT15].rationale,
      'directive.playerText': t.directives[DIR15].playerText,
      'directive.canonicalText': t.directives[DIR15].canonicalText,
      inputQuote: EXCERPT_NOTE,
    };
    const q = quotesIn(LIVE.card.excerpt);
    for (const [k, text] of Object.entries(sources)) expect(q[k].text, k).toBe(text);
    const all = Object.values(sources);
    for (const [k, v] of Object.entries(q)) for (const other of all) if (other !== v.text) expect(v.text.includes(other), `${k} holds another field's words`).toBe(false);
  });
  it('each quotation\'s time is the record\'s own for the words', () => {
    const q = quotesIn(LIVE.card.excerpt);
    expect(q['rationale.rationale'].at).toBe(DAY.tape.rationale[RAT15].at);
    expect(q['directive.playerText'].at).toBe(DAY.tape.directives[DIR15].filedAt);
    expect(q['idea.statement'].at).toBe(ideaVersionDoc().createdAt);
    expect(q.inputQuote.at).toBe(excerptCard().createdAt);
  });
});

// ── the write gate ──────────────────────────────────────────────────────────

const rel = (f) => path.relative(REPO, f).split(path.sep).join('/');
/**
 * Every module reachable from `root` by its imports — relative and the `@/` alias, static and dynamic — with each
 * one's source, read by the census's own parser (__fixtures__/jsSource.js, @babel/parser — CE-2: a regex stripper let
 * a `/*` inside a line comment hide live imports, §2 review L2-1; the hand lexer after it, a regex after an `if`, C2-F2).
 */
const closureOf = (root, read = (f) => readFileSync(f, 'utf8')) => {
  const seen = new Map([[root, read(root)]]);
  const stack = [root];
  while (stack.length) {
    const f = stack.pop();
    // the fix round's review, CX2-2: a load no static reading follows fails the gate, never passes as no edge
    const opaque = opaqueImportsOf(seen.get(f), f);
    if (opaque.length) throw Object.assign(new Error(`write gate: ${rel(f)} loads by ${opaque.join(', ')}`), { code: 'OPAQUE_IMPORT' });
    for (const spec of importSpecifiersOf(seen.get(f), f)) {
      // CX2-1: a query, a fragment or percent-encoding is read through; a local specifier naming no module throws
      const n = resolveImport(f, spec, REPO);
      if (n && !seen.has(n)) { seen.set(n, read(n)); stack.push(n); }
    }
  }
  return seen;
};
/**
 * THE GATE'S SECOND READING (the fix round's review, CX2-4): every call's method or function name the parser finds —
 * however the call is split across lines or comments, a computed string key included (`ref['set'](…)`) — and every
 * `FieldValue`. The per-line pattern above misses `ref.\nset(`, `ref['set'](` and `ref./**\/set(`; this reading does not.
 */
// the refuter's CXV-10: the closure holds src/ modules too, so the client SDK's write functions are write names as well
const WRITE_CALLS = new Set(['set', 'update', 'delete', 'add', 'create', 'batch', 'runTransaction', 'bulkWriter', 'writeBatch', 'recursiveDelete', 'FieldValue', 'setDoc', 'updateDoc', 'addDoc', 'deleteDoc']);
const NON_FIRESTORE_CALLS = Object.freeze([
  { file: 'api/_utils/filmTape/tapeSources.js', name: 'add', count: 1, why: 'the same Set of evaluation ids as NON_FIRESTORE_HITS' },
  { file: 'src/utils/filmRoomMoments.js', name: 'set', count: 1, why: 'the same Map grouping tag items as NON_FIRESTORE_HITS' },
]);
/**
 * The refuter's CXV-5: a write need not name its method where it calls it — `ref.set.call(…)`, `(0, ref.set)(…)`,
 * `Reflect.apply(ref.set, …)`, `ref.set.bind(ref)(…)`. So the second reading takes every MEMBER the module names, called or
 * not, and every call by a key no static reading names (`[computed]`); a member call counted by both is counted once.
 */
const callHitsOf = (closure) => [...closure].flatMap(([f, src]) => {
  const seen = new Map();
  for (const c of [...callNamesOf(src, f), ...memberNamesOf(src, f)]) if (WRITE_CALLS.has(c.name) || c.name === '[computed]') seen.set(`${c.line}:${c.col}:${c.name}`, { file: rel(f), name: c.name, line: c.line });
  return [...seen.values()];
});
const unexplainedCalls = (hits) => {
  const left = [...hits];
  for (const a of NON_FIRESTORE_CALLS) {
    const mine = left.filter((h) => h.file === a.file && h.name === a.name);
    if (mine.length !== a.count) return [`${a.file}: ${mine.length} calls of ${a.name}, pinned ${a.count}`];
    for (const h of mine) left.splice(left.indexOf(h), 1);
  }
  return left.map((h) => `${h.file}:${h.line}: ${h.name}`);
};
/**
 * The write pattern's hits in the excerpt's closure that are NOT Firestore writes, pinned by file, exact line text and
 * count — each a JavaScript Set's or Map's own method. Any other hit, or one of these grown in number, fails.
 */
const NON_FIRESTORE_HITS = Object.freeze([
  { file: 'api/_utils/filmTape/tapeSources.js', text: 'snaps.forEach((s, i) => { if (s && s.exists) present.add(evalIds[i]); });', count: 1, why: 'a Set of evaluation ids (readDeclarationPresence), never called by the excerpt' },
  { file: 'src/utils/filmRoomMoments.js', text: 'if (!groups.has(key)) groups.set(key, []);', count: 1, why: 'a Map grouping tag items by situation and symbol (momentsOf)' },
]);
const writeHitsOf = (closure) => {
  const hits = [];
  for (const [f, src] of closure) stripComments(src).split(/\r?\n/).forEach((line) => { if (WRITE_PATTERN.test(line)) hits.push({ file: rel(f), text: line.trim() }); });
  return hits;
};
const unexplained = (hits) => {
  const left = [...hits];
  for (const a of NON_FIRESTORE_HITS) {
    const mine = left.filter((h) => h.file === a.file && h.text === a.text);
    if (mine.length !== a.count) return [`${a.file}: ${mine.length} of “${a.text}”, pinned ${a.count}`];
    for (const h of mine) left.splice(left.indexOf(h), 1);
  }
  return left.map((h) => `${h.file}: ${h.text}`);
};
const EXCERPT_FILE = path.join(HERE, 'momentExcerpt.js');

describe('THE WRITE GATE — no write call in momentExcerpt.js or anything it imports (the C1 census script\'s pattern)', () => {
  it('its closure is the modules it is known to import, and every write-pattern hit in it is a pinned non-Firestore one', () => {
    const closure = closureOf(EXCERPT_FILE);
    expect([...closure.keys()].map(rel).sort()).toEqual([
      'api/_utils/filmRoom/momentExcerpt.js', 'api/_utils/filmRoom/sourceDay.js', 'api/_utils/filmTape/errorClass.js', 'api/_utils/filmTape/tapeSources.js',
      'api/_utils/rankingConfig.js', 'src/constants/filmTape.js', 'src/constants/leagueTournament.js', 'src/data/cardStages.js', 'src/data/situationQuestions.js',
      // the C2 fix round (CE-1): the shared prompt-bound text policy, and the situation registry its domains read
      'src/data/situationRegistry.js', 'src/utils/filmRoomMoments.js', 'src/utils/filmRoomSubject.js', 'src/utils/marketCalendar.js', 'src/utils/promptBoundText.js',
      'src/utils/tapeSchedule.js',
    ]);
    expect(unexplained(writeHitsOf(closure))).toEqual([]);
  });
  it('momentExcerpt.js, sourceDay.js, the subject module and the text policy hold no hit at all — not even a Set\'s or a Map\'s', () => {
    for (const f of ['api/_utils/filmRoom/momentExcerpt.js', 'api/_utils/filmRoom/sourceDay.js', 'src/utils/filmRoomSubject.js', 'src/utils/promptBoundText.js']) {
      expect(writeHitsOf(new Map([[path.join(REPO, f), readFileSync(path.join(REPO, f), 'utf8')]])), f).toEqual([]);
    }
  });
  it('THE GATE BITES: a write planted in the excerpt, in a module it imports, or a second pinned hit — each fails it', () => {
    const plant = (target, extra) => (f) => { const src = readFileSync(f, 'utf8'); return path.resolve(f) === path.resolve(path.join(REPO, target)) ? `${src}\n${extra}\n` : src; };
    for (const [target, extra] of [
      ['api/_utils/filmRoom/momentExcerpt.js', 'export const w = (ref) => ref.set({ a: 1 });'],
      ['api/_utils/filmRoom/momentExcerpt.js', 'export const w = (db) => db.run' + 'Transaction(async () => 1);'],
      ['api/_utils/filmRoom/sourceDay.js', 'export const w = (ref) => ref.update({ a: 1 });'],
      ['src/constants/filmTape.js', 'export const w = (col) => col.add({});'],
      ['src/utils/filmRoomMoments.js', 'if (!groups.has(key)) groups.set(key, []);'],
    ]) expect(unexplained(writeHitsOf(closureOf(EXCERPT_FILE, plant(target, extra)))).length, `${target}: ${extra}`).toBeGreaterThan(0);
  });
  it('THE SECOND READING (CX2-4): the closure\'s write-named calls are exactly the two pinned non-Firestore ones; the excerpt, the day check, the subject module and the text policy hold none', () => {
    const closure = closureOf(EXCERPT_FILE);
    expect(unexplainedCalls(callHitsOf(closure))).toEqual([]);
    for (const f of ['api/_utils/filmRoom/momentExcerpt.js', 'api/_utils/filmRoom/sourceDay.js', 'src/utils/filmRoomSubject.js', 'src/utils/promptBoundText.js']) {
      expect(callHitsOf(new Map([[path.join(REPO, f), readFileSync(path.join(REPO, f), 'utf8')]])), f).toEqual([]);
    }
  });
  it('THE SECOND READING BITES where the line pattern cannot: a call split across lines, a computed string key, a comment between the dot and the name, a FieldValue, a method named but not called there, a client SDK write (CXV-5, CXV-10) — each fails it', () => {
    const plant = (extra) => (f) => { const src = readFileSync(f, 'utf8'); return path.resolve(f) === path.resolve(EXCERPT_FILE) ? `${src}\n${extra}\n` : src; };
    for (const extra of [
      'export const w = (ref) => ref.\n  set({ a: 1 });',
      "export const w = (ref) => ref['set']({ a: 1 });",
      'export const w = (ref) => ref./**/set({ a: 1 });',
      'export const w = (admin) => admin.firestore.FieldValue.delete;',
      // the refuter's CXV-5: the method named but not called where it is named, and a key no static reading names
      'export const w = (ref) => ref.set.call(ref, { a: 1 });',
      'export const w = (ref) => ref.update.apply(ref, [{ a: 1 }]);',
      'export const w = (ref) => (0, ref.set)({ a: 1 });',
      'export const w = (ref) => Reflect.apply(ref.set, ref, [{ a: 1 }]);',
      'export const w = (ref) => ref.set.bind(ref)({ a: 1 });',
      'export const w = (ref, k) => ref[k]({ a: 1 });',
      // the refuter's CXV-10: the client SDK's writes, by the function the SDK exports
      "import { setDoc } from 'firebase/firestore';\nexport const w = (ref) => setDoc(ref, { a: 1 });",
      "import { updateDoc } from 'firebase/firestore';\nexport const w = (ref) => updateDoc(ref, { a: 1 });",
      "import { addDoc } from 'firebase/firestore';\nexport const w = (col) => addDoc(col, { a: 1 });",
      "import { deleteDoc } from 'firebase/firestore';\nexport const w = (ref) => deleteDoc(ref);",
    ]) expect(unexplainedCalls(callHitsOf(closureOf(EXCERPT_FILE, plant(extra)))).length, extra).toBeGreaterThan(0);
    // the line pattern alone misses the first three (why the second reading exists)
    for (const extra of ['export const w = (ref) => ref.\n  set({ a: 1 });', "export const w = (ref) => ref['set']({ a: 1 });", 'export const w = (ref) => ref./**/set({ a: 1 });']) {
      expect(unexplained(writeHitsOf(closureOf(EXCERPT_FILE, plant(extra)))), extra).toEqual([]);
    }
  });
  it('THE GATE FAILS CLOSED on an import it cannot follow (CX2-1, CX2-2; CXV-6, CXV-7): `./cardStore.js?v=1` planted in the day check brings the ledger\'s writes in; an unresolvable or computed import, the module loader by a string key, and a `data:` module throw', () => {
    const plant = (target, extra) => (f) => { const src = readFileSync(f, 'utf8'); return path.resolve(f) === path.resolve(path.join(REPO, target)) ? `${src}\n${extra}\n` : src; };
    const queried = closureOf(EXCERPT_FILE, plant('api/_utils/filmRoom/sourceDay.js', "import './cardStore.js?v=1';"));
    expect([...queried.keys()].map(rel)).toContain('api/_utils/filmRoom/cardStore.js');
    expect(unexplained(writeHitsOf(queried)).length).toBeGreaterThan(0);
    expect(unexplainedCalls(callHitsOf(queried)).length).toBeGreaterThan(0);
    for (const [extra, code] of [
      ["import './noSuchModule.js';", 'UNRESOLVED_IMPORT'],
      ["const w = './cardStore.js';\nexport const later = () => import(w);", 'OPAQUE_IMPORT'],
      // the refuter's CXV-6 and CXV-7: the module loader by a string key; a `data:` module importing the ledger's store
      ["export const m = process['getBuiltinModule']('node:module')['createRequire'](import.meta.url)('./cardStore.js');", 'OPAQUE_IMPORT'],
      [`export * as zz from 'data:text/javascript,export * from "${pathToFileURL(path.join(HERE, 'cardStore.js')).href}"';`, 'UNRESOLVED_IMPORT'],
    ]) {
      let err = null;
      try { closureOf(EXCERPT_FILE, plant('api/_utils/filmRoom/sourceDay.js', extra)); } catch (e) { err = e; }
      expect(err?.code, extra).toBe(code);
    }
  });
});
