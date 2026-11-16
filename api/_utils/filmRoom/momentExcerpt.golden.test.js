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
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): see momentExcerpt.test.js — this import is never mocked either.
import { excerptOf, excerptOfCard, MOMENT_EXCERPT_VERSION, EXCERPT_LABELS, EXCERPT_BOUNDS, QUOTE_SPEAKERS } from './momentExcerpt.js';
import {
  excerptDay, excerptStore as storeOfDay, excerptCardWith, ideaVersionDoc, dbOf, OWNER, AGENT, CLONE_AGENT, SEP23, EXCERPT_BATTLE, EXCERPT_ENTRY,
  EXCERPT_WATCHLIST, EXCERPT_IDEA_VERSION, ETN_MOMENT, META_MOMENT, EXCERPT_NOTE,
} from './__fixtures__/excerptFixtures.js';
import { buildCardDoc } from './cardStore.js';
import { stableStringify } from '../canonicalHash.js';
import { WRITE_PATTERN } from '../../../scripts/census-film-room-v1-plays.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const GOLDEN_PATH = path.join(HERE, '__fixtures__', 'momentExcerpt.golden.json');
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
const sha256 = (v) => createHash('sha256').update(stableStringify(v), 'utf8').digest('hex');
/** The goldens' SHA-256, over their canonical JSON (canonicalHash.js stableStringify) — the build report records both. */
const GOLDEN_SHA256 = Object.freeze({
  moment: '55a8ced5f794847cf40bbc8595cf5420790be03d63ff9080b2726bf8e23a84d6',
  card: '7965ded9eed35c13bf229c957a37aefb76d4452171ba6382ad45a3b7bd6712a8',
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
    expect(inputQuote).toEqual(card.note);
    expect(inputQuote).not.toBe(card.note);
  });
  it('every field is the named source\'s value (the golden is checked against the tape, not only against itself)', () => {
    const e = GOLDEN.moment.excerpt;
    const t = DAY.tape;
    expect(e.excerptVersion).toBe(MOMENT_EXCERPT_VERSION);
    expect(MOMENT_EXCERPT_VERSION).toBe(1);
    expect([e.symbol.value, e.situationId.value, e.situationVersion.value, e.checks.value]).toEqual(['ETN', 'stalled', 2, 5]);
    expect([e.from.value, e.to.value]).toEqual([t.checks.find((c) => c.tickSeq === 15).at, t.checks.find((c) => c.tickSeq === 19).at]);
    expect(e.sector).toEqual({ value: 'XLI', class: 'recorded' });
    expect(e.rationale.rationale.text).toBe(t.rationale[RAT15].rationale);
    expect(e.rationale.hypothesis.text).toBe(t.rationale[RAT15].hypothesis);
    expect(e.directive.playerText.text).toBe(t.directives[DIR15].playerText);
    expect(e.directive.canonicalText.text).toBe(t.directives[DIR15].canonicalText);
    expect(e.meeting.diagnosis.text).toBe(t.meetings[0].diagnosis);
    const sale = t.actions.find((a) => a.symbolOut === 'ETN');
    expect(sale.tickSeq).toBe(20);
    expect(e.exit).toEqual({ mechanism: { value: sale.mechanism, class: 'recorded' }, exitReason: { value: sale.exitReason, class: 'recorded' }, sold: { value: 'ETN', class: 'recorded' }, bought: { value: sale.symbolIn, class: 'recorded' }, exitPrice: { value: sale.exitPrice, class: 'recorded' } });
    const etn = DAY.series.find((s) => s.symbol === 'ETN');
    const after = etn.bars.filter((b) => Date.parse(b.t) > Date.parse(sale.at));
    expect(e.afterExit).toEqual({ close: { value: after.at(-1).c, class: 'market' }, closeAt: { value: after.at(-1).t, class: 'market' }, barsAfter: { value: after.length, class: 'derived' } });
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
    expect(EXCERPT_BOUNDS).toEqual({ statement: 280, hypothesis: 500, rationale: 500, playerText: 400, canonicalText: 400, diagnosis: 400, note: 280 });
    for (const b of Object.values(EXCERPT_BOUNDS)) expect(b).toBeLessThanOrEqual(500);
  });
  const rows = [
    { name: 'rationale', bound: 500, plant: (s, text) => withTape((t) => { t.rationale[RAT15].rationale = text; }), read: (x) => x.rationale?.rationale?.text, card: false },
    { name: 'hypothesis', bound: 500, plant: (s, text) => withTape((t) => { t.rationale[RAT15].hypothesis = text; }), read: (x) => x.rationale?.hypothesis?.text, card: false },
    { name: 'directive player text', bound: 400, plant: (s, text) => withTape((t) => { t.directives[DIR15].playerText = text; }), read: (x) => x.directive?.playerText?.text, card: false },
    { name: 'directive canonical text', bound: 400, plant: (s, text) => withTape((t) => { t.directives[DIR15].canonicalText = text; }), read: (x) => x.directive?.canonicalText?.text, card: false },
    { name: 'meeting diagnosis', bound: 400, plant: (s, text) => withTape((t) => { t.meetings[0].diagnosis = text; }), read: (x) => x.meeting?.diagnosis?.text, card: false },
    { name: 'idea statement', bound: 280, plant: (s, text) => excerptStore(DAY, { idea: ideaVersionDoc({ statement: text }) }), read: (x) => x.idea?.statement?.text, card: false },
    { name: 'card note', bound: 280, plant: (s, text) => excerptStore(DAY, { card: excerptCard({ note: text }) }), read: (x) => x.card?.note?.text, card: true },
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
  it('the card note over its bound takes inputQuote with it (one quotation, one answer)', async () => {
    const over = await cardOver(excerptStore(DAY, { card: excerptCard({ note: textOf(281) }) }));
    expect(over.excerpt.inputQuote).toBeUndefined();
    expect(over.excerpt.card.question).toBeDefined();
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
  it('no meetings, or none whose life holds the moment: no meeting', async () => {
    await absentWith((t) => { delete t.meetings; }, 'meeting');
    await absentWith((t) => { t.meetings[0].createdAt = '2026-09-23T17:50:00.000Z'; }, 'meeting');
    await absentWith((t) => { t.meetings[0].resolvedAt = '2026-09-23T18:30:00.000Z'; }, 'meeting');
    await absentWith((t) => { t.meetings[0].resolvedAt = null; t.meetings[0].expiresAt = null; }, 'meeting');
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
  it('no carried idea (no calls, or calls naming two ideas): no idea and no i1', async () => {
    const none = await absentWith((t) => { t.calls = []; }, 'idea');
    expect(none.refs.i1).toBeUndefined();
    const two = await absentWith((t) => { t.calls.push({ ...clone(t.calls[0]), key: 'other', callId: 'other', hypothesisRef: { watchlistId: 'wl-other', hypothesisVersion: 1 } }); }, 'idea');
    expect(two.refs.i1).toBeUndefined();
  });
  it('the idea\'s version unreadable or missing: the idea without its statement; another owner\'s version: no idea at all', async () => {
    const missing = await momentOver(excerptStore(DAY, { idea: undefined, over: { [IDEA_PATH]: undefined } }));
    expect(missing.excerpt.idea).toEqual({ label: 'i1', version: { value: EXCERPT_IDEA_VERSION, class: 'recorded' } });
    for (const foreign of [ideaVersionDoc({ userId: 'someone-else' }), ideaVersionDoc({ watchlistId: 'wl-other' }), ideaVersionDoc({ version: 2 })]) {
      const got = await momentOver(excerptStore(DAY, { idea: foreign }));
      expect(got.excerpt.idea, JSON.stringify(foreign)).toBeUndefined();
      expect(got.refs.i1).toBeUndefined();
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
  it('neither golden\'s `excerpt` holds an id-shaped value; `refs` maps each label present to its real id', () => {
    expect(idsIn(GOLDEN.moment.excerpt)).toEqual([]);
    expect(idsIn(GOLDEN.card.excerpt)).toEqual([]);
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

// ── speakers (CC-2) ─────────────────────────────────────────────────────────

/** CC-2's table, pinned here from the amendment: each quoted field and its speaker. */
const SPEAKER_TABLE = Object.freeze({
  'idea.statement': 'player',
  'rationale.hypothesis': 'agent',
  'rationale.rationale': 'agent',
  'directive.playerText': 'player',
  'directive.canonicalText': 'platform',
  'meeting.diagnosis': 'platform',
  'card.note': 'player',
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
  it('the card golden\'s quotations are exactly the table\'s, each by its speaker, each shaped { text, by, at, class }', () => {
    const q = quotesIn(GOLDEN.card.excerpt);
    expect(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v.by]))).toEqual(SPEAKER_TABLE);
    for (const [k, v] of Object.entries(q)) {
      expect(Object.keys(v).sort(), k).toEqual(['at', 'by', 'class', 'text']);
      expect(QUOTE_SPEAKERS, k).toContain(v.by);
      expect(v.at === null || Number.isFinite(Date.parse(v.at)), k).toBe(true);
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
      'meeting.diagnosis': t.meetings[0].diagnosis,
      'card.note': EXCERPT_NOTE,
      inputQuote: EXCERPT_NOTE,
    };
    const q = quotesIn(GOLDEN.card.excerpt);
    for (const [k, text] of Object.entries(sources)) expect(q[k].text, k).toBe(text);
    const all = Object.values(sources);
    for (const [k, v] of Object.entries(q)) for (const other of all) if (other !== v.text) expect(v.text.includes(other), `${k} holds another field's words`).toBe(false);
  });
  it('each quotation\'s time is the record\'s own for the words', () => {
    const q = quotesIn(GOLDEN.card.excerpt);
    expect(q['rationale.rationale'].at).toBe(DAY.tape.rationale[RAT15].at);
    expect(q['directive.playerText'].at).toBe(DAY.tape.directives[DIR15].filedAt);
    expect(q['meeting.diagnosis'].at).toBe(DAY.tape.meetings[0].createdAt);
    expect(q['idea.statement'].at).toBe(ideaVersionDoc().createdAt);
    expect(q['card.note'].at).toBe(excerptCard().createdAt);
  });
});

// ── the write gate ──────────────────────────────────────────────────────────

const RESOLVE_EXT = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
const resolveImport = (from, spec) => {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const ext of RESOLVE_EXT) { const c = base + ext; if (existsSync(c) && /\.(m?js|jsx)$/.test(c)) return c; }
  return null;
};
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SPEC_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm;
const rel = (f) => path.relative(REPO, f).split(path.sep).join('/');
/** Every module reachable from `root` by its relative imports, static and dynamic, with each one's source. */
const closureOf = (root, read = (f) => readFileSync(f, 'utf8')) => {
  const seen = new Map([[root, read(root)]]);
  const stack = [root];
  while (stack.length) {
    const f = stack.pop();
    for (const m of stripComments(seen.get(f)).matchAll(SPEC_RE)) {
      const n = resolveImport(f, m[1] || m[2] || m[3]);
      if (n && !seen.has(n)) { seen.set(n, read(n)); stack.push(n); }
    }
  }
  return seen;
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
      'src/utils/filmRoomMoments.js', 'src/utils/filmRoomSubject.js', 'src/utils/marketCalendar.js', 'src/utils/tapeSchedule.js',
    ]);
    expect(unexplained(writeHitsOf(closure))).toEqual([]);
  });
  it('momentExcerpt.js, sourceDay.js and the subject module hold no hit at all — not even a Set\'s or a Map\'s', () => {
    for (const f of ['api/_utils/filmRoom/momentExcerpt.js', 'api/_utils/filmRoom/sourceDay.js', 'src/utils/filmRoomSubject.js']) {
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
});
