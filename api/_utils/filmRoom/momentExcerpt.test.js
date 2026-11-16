// api/_utils/filmRoom/momentExcerpt.test.js
//
// Film Room C2 item 2 — THE MOMENT EXCERPT's rules (Build C spec §6; Amendment C CC-3 … CC-5), over the Sep 23 day
// written by the REAL passes (__fixtures__/excerptFixtures.js):
//   THE OWNER (CC-5)     another owner's day, another owner's card and another agent each give null, and the answers
//                        are indistinguishable (the same null, nothing logged); a malformed argument is the same null
//                        before any read;
//   THE ATTRIBUTION      a casual clone's battle answers for its parent through the owner's clone document — the
//                        platform resolver's rule and its ownership guard (the parent read), pinned to resolveAttributionAgentId;
//   THE SOURCE (CC-4)    a card whose source changed gives null; the moment must be exactly a stored one; the day check
//                        is the shared one (sourceDay.js), with no judgment of the excerpt's own;
//   LABELS (CC-3, CC-2)  `excerpt` names the battle, the idea and the card by their labels, `refs` maps them; a card's
//                        note is its one `inputQuote`;
//   READS                bounded document gets only, exactly the ones named, at their owners' own paths.
// The goldens, the bounds, the absences, the id detector, the speakers and the write gate are item 3's
// (momentExcerpt.golden.test.js).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): momentExcerpt.js imports src/ modules (the tape's vocabulary, the stage
// vocabulary, the questions, the calendar, the shared subject module and the directory it reads); this import is the
// runtime guard that they stay Node-clean — never mocked.
import { excerptOf, excerptOfCard, EXCERPT_LABELS, EXCERPT_PATHS } from './momentExcerpt.js';
import {
  excerptDay, excerptStore as storeOfDay, excerptCardWith, dbOf, OWNER, AGENT, CLONE_AGENT, SEP23, EXCERPT_BATTLE, EXCERPT_ENTRY,
  EXCERPT_WATCHLIST, EXCERPT_IDEA_VERSION, ETN_MOMENT, EXCERPT_NOTE,
} from './__fixtures__/excerptFixtures.js';
import { PLAYS_SUBCOLLECTION, agentRefOf, buildCardDoc } from './cardStore.js';
import { WATCHLISTS_COLLECTION, VERSIONS_SUBCOLLECTION, versionDocId } from '../hypothesisRecords/model.js';
import { resolveRecordTargetId, resolveAttributionAgentId } from '../casualClone.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The card, by the ledger's own builder; the store with it unless a test names another. */
const excerptCard = (o) => excerptCardWith(buildCardDoc, o);
const excerptStore = (day, opts = {}) => storeOfDay(day, { card: excerptCard({ battleId: opts.battleId }), ...opts });
const clone = (v) => structuredClone(v);
const DAY = await excerptDay();
const CLONE_DAY = await excerptDay({ clone: true });
const TAPE_PATH = `agentBattles/${EXCERPT_BATTLE}/tape/${SEP23}`;
const SERIES_ETN = `${TAPE_PATH}/series/ETN`;
const IDEA_PATH = `watchlists/${EXCERPT_WATCHLIST}/hypothesisVersions/v${EXCERPT_IDEA_VERSION}`;
const CARD_PATH = `agents/${AGENT}/plays/${EXCERPT_ENTRY}`;
const MOMENT_ASK = { uid: OWNER, attributionAgentId: AGENT, battleId: EXCERPT_BATTLE, etDate: SEP23, moment: ETN_MOMENT };
const CARD_ASK = { uid: OWNER, attributionAgentId: AGENT, entryId: EXCERPT_ENTRY };

/** The day's store with one tape change (`edit` mutates a copy of the stored tape). */
const withTape = (edit, opts = {}) => { const tape = clone(DAY.tape); edit(tape); return excerptStore({ ...DAY, tape }, opts); };
const momentOver = async (store, ask = MOMENT_ASK) => excerptOf(dbOf(store).db, ask);
const cardOver = async (store, ask = CARD_ASK) => excerptOfCard(dbOf(store).db, ask);

afterEach(() => { vi.restoreAllMocks(); });

describe('CC-3 / CC-2 — labels for the battle, the idea and the card; the card\'s note its one input quote', () => {
  it('a moment names the battle and its idea by label, and `refs` maps exactly those', async () => {
    const got = await momentOver(excerptStore(DAY));
    expect(got.excerpt.battle).toBe(EXCERPT_LABELS.battle);
    expect(got.excerpt.idea.label).toBe(EXCERPT_LABELS.idea);
    expect(got.excerpt.card).toBeUndefined();
    expect(got.excerpt.inputQuote).toBeUndefined();
    expect(got.refs).toEqual({ b1: EXCERPT_BATTLE, i1: EXCERPT_WATCHLIST });
  });
  it('a card adds c1, and its note — the player\'s words at the card\'s filing — is its `inputQuote`, and nowhere else (CD-14)', async () => {
    const got = await cardOver(excerptStore(DAY));
    expect(got.excerpt.card.label).toBe(EXCERPT_LABELS.card);
    expect(got.refs).toEqual({ b1: EXCERPT_BATTLE, i1: EXCERPT_WATCHLIST, c1: EXCERPT_ENTRY });
    expect(got.excerpt.inputQuote).toEqual({ text: EXCERPT_NOTE, by: 'player', at: excerptCard().createdAt, class: 'quoted' });
    expect('note' in got.excerpt.card).toBe(false);   // CD-14: the note's one home is inputQuote
  });
  it('a stored `drill` route reads `offer` (the one export\'s routeOf), as every reader reads it', async () => {
    const got = await cardOver(excerptStore(DAY, { card: { ...excerptCard(), route: 'drill' } }));
    expect(got.excerpt.card.route).toEqual({ value: 'offer', class: 'recorded' });
  });
});

// ── the owner, silently (CC-5) ──────────────────────────────────────────────

describe('CC-5 — the owner only, silently', () => {
  it('another owner\'s day, another owner\'s card, another agent: each null, and the three indistinguishable (nothing logged)', async () => {
    const spies = ['error', 'warn', 'log', 'info'].map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    const foreignDay = await momentOver(withTape((t) => { t.ownerId = 'someone-else'; }));
    const foreignCard = await cardOver(excerptStore(DAY, { card: { ...excerptCard(), ownerId: 'someone-else' } }));
    const otherAgent = await momentOver(excerptStore(DAY), { ...MOMENT_ASK, attributionAgentId: 'agent-2' });
    const otherAgentCard = await cardOver(excerptStore(DAY), { ...CARD_ASK, attributionAgentId: 'agent-2' });
    const otherCaller = await momentOver(excerptStore(DAY), { ...MOMENT_ASK, uid: 'someone-else' });
    const missingDay = await momentOver(excerptStore(DAY, { over: { [TAPE_PATH]: undefined } }));
    for (const [name, v] of Object.entries({ foreignDay, foreignCard, otherAgent, otherAgentCard, otherCaller, missingDay })) expect(v, name).toBeNull();
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
  it('the battle another owner\'s, or the tape naming another battle or day: null', async () => {
    expect(await momentOver(excerptStore(DAY, { over: { [`agentBattles/${EXCERPT_BATTLE}`]: { ...DAY.fx.battle, ownerId: 'someone-else' } } }))).toBeNull();
    expect(await momentOver(withTape((t) => { t.battleId = 'b-other'; }))).toBeNull();
    expect(await momentOver(withTape((t) => { t.etDate = '2026-09-24'; }))).toBeNull();
  });
  it('a card under the right agent but filed under another (its agentId), or holding another id: null', async () => {
    expect(await cardOver(excerptStore(DAY, { card: { ...excerptCard(), agentId: 'agent-2' } }))).toBeNull();
    expect(await cardOver(excerptStore(DAY, { card: { ...excerptCard(), entryId: 'op-other' } }))).toBeNull();
  });
  it('an unreadable read is the same null', async () => {
    const t = dbOf(excerptStore(DAY));
    const db = { collection: (...a) => { const c = t.db.collection(...a); return wrap(c); } };
    function wrap(ref) { return new Proxy(ref, { get: (o, k) => (k === 'get' ? async () => { throw Object.assign(new Error('unavailable'), { code: 14 }); } : (typeof o[k] === 'function' ? (...x) => wrap(o[k](...x)) : o[k])) }); }
    expect(await excerptOf(db, MOMENT_ASK)).toBeNull();
    expect(await excerptOfCard(db, CARD_ASK)).toBeNull();
  });
  it('a malformed argument is the same null, before any read', async () => {
    const t = dbOf(excerptStore(DAY));
    for (const bad of [{}, { ...MOMENT_ASK, battleId: 'a/b' }, { ...MOMENT_ASK, uid: '__x__' }, { ...MOMENT_ASK, etDate: '2026-9-23' }, { ...MOMENT_ASK, moment: null }, { ...MOMENT_ASK, moment: { ...ETN_MOMENT, fromTickSeq: -1 } }]) {
      expect(await excerptOf(t.db, bad), JSON.stringify(bad)).toBeNull();
    }
    expect(await excerptOfCard(t.db, { ...CARD_ASK, entryId: '' })).toBeNull();
    expect(await excerptOf(t.db)).toBeNull();
    expect(t.readLog).toEqual([]);
  });
});

describe('the attribution — a casual clone\'s battle, by the platform resolver\'s rule (RK-1)', () => {
  const cloneStore = (over = {}) => excerptStore(CLONE_DAY, { clone: true, over });
  it('a clone\'s battle answers for the clone\'s parent, through the owner\'s clone document — moment and card', async () => {
    expect((await momentOver(cloneStore()))?.excerpt.symbol.value).toBe('ETN');
    expect((await cardOver(cloneStore()))?.refs.c1).toBe(EXCERPT_ENTRY);
    expect(await momentOver(cloneStore(), { ...MOMENT_ASK, attributionAgentId: CLONE_AGENT })).toBeNull();
  });
  it('CD-8 — a clone\'s battle carries its idea on its OWN frozen carriage: the excerpt under the parent has it, from the battle already read (no other lookup)', async () => {
    const t = dbOf(cloneStore());
    const got = await excerptOf(t.db, MOMENT_ASK);
    expect(got.excerpt.idea).toMatchObject({ label: 'i1', version: { value: EXCERPT_IDEA_VERSION, class: 'recorded' } });
    expect(got.excerpt.idea.statement.by).toBe('player');
    expect(got.refs.i1).toBe(EXCERPT_WATCHLIST);
    expect(t.readLog.filter((p) => p === `agentBattles/${EXCERPT_BATTLE}`)).toHaveLength(1);
  });
  it('the clone document missing, another owner\'s, naming no parent, or naming a clone: null — nothing answered under a clone', async () => {
    for (const doc of [undefined, { ownerId: 'someone-else', rankedAgentId: AGENT }, { ownerId: OWNER }, { ownerId: OWNER, rankedAgentId: '' }, { ownerId: OWNER, rankedAgentId: CLONE_AGENT }]) {
      expect(await momentOver(cloneStore({ [`agents/${CLONE_AGENT}`]: doc })), JSON.stringify(doc)).toBeNull();
    }
  });
  it('NOTHING IS ANSWERED UNDER A CLONE: asked under the clone\'s own id, every clone-document shape is null — missing, no parent, another owner\'s, a parent that is a clone (the mutant: an unresolvable clone answered under itself, as the resolver\'s fallback would name it)', async () => {
    for (const doc of [undefined, null, {}, { ownerId: OWNER }, { ownerId: OWNER, rankedAgentId: '' }, { ownerId: OWNER, rankedAgentId: CLONE_AGENT }, { ownerId: 'someone-else', rankedAgentId: CLONE_AGENT }, { ownerId: OWNER, rankedAgentId: AGENT }]) {
      const store = cloneStore({ [`agents/${CLONE_AGENT}`]: doc });
      expect(await momentOver(store, { ...MOMENT_ASK, attributionAgentId: CLONE_AGENT }), JSON.stringify(doc)).toBeNull();
      // the resolver's own answer for such a document is the clone itself — the route refuses that (attribution_unavailable); so does the excerpt
      if (!(doc && doc.ownerId === OWNER && doc.rankedAgentId === AGENT)) expect(resolveRecordTargetId(CLONE_AGENT, doc && doc.ownerId === OWNER ? doc : null), JSON.stringify(doc)).toBe(CLONE_AGENT);
    }
  });
  it('THE RULE IS THE PLATFORM\'S: over every clone-document × parent-document shape, the excerpt answers exactly when the platform\'s async resolver (resolveAttributionAgentId, its CONFIRMED-1 guard included) names the owner\'s parent for the owner\'s own clone — the pure resolver agreeing (§2 review L1-7)', async () => {
    const clones = [undefined, null, {}, { ownerId: OWNER }, { ownerId: OWNER, rankedAgentId: AGENT }, { ownerId: OWNER, rankedAgentId: '' }, { ownerId: OWNER, rankedAgentId: 7 }, { ownerId: 'someone-else', rankedAgentId: AGENT }];
    const parents = [{ ownerId: OWNER, archetype: 'momentum_chaser' }, { ownerId: 'someone-else' }, undefined];
    vi.spyOn(console, 'warn').mockImplementation(() => {});   // the platform resolver warns on each degraded shape
    for (const doc of clones) {
      for (const parentDoc of parents) {
        const where = `${JSON.stringify(doc)} × ${JSON.stringify(parentDoc)}`;
        const store = cloneStore({ [`agents/${CLONE_AGENT}`]: doc, [`agents/${AGENT}`]: parentDoc });
        const platform = await resolveAttributionAgentId(dbOf(store).db, { agentId: CLONE_AGENT });
        const expected = platform === AGENT && doc?.ownerId === OWNER;
        if (expected) expect(resolveRecordTargetId(CLONE_AGENT, doc), where).toBe(AGENT);
        expect((await momentOver(store)) !== null, where).toBe(expected);
      }
    }
  });
  it('a valid clone document naming an agent ANOTHER owner holds: null — the parent read refuses it (the mutant: the pure resolver alone)', async () => {
    expect(await momentOver(cloneStore({ [`agents/${AGENT}`]: { ownerId: 'someone-else' } }))).toBeNull();
    expect(await cardOver(cloneStore({ [`agents/${AGENT}`]: { ownerId: 'someone-else' } }))).toBeNull();
    expect(await momentOver(cloneStore({ [`agents/${AGENT}`]: undefined }))).toBeNull();
  });
});

// ── the source (CC-4) ───────────────────────────────────────────────────────

describe('CC-4 — a card\'s excerpt re-checks its filed source; one that changed gives null', () => {
  it('the day re-tagged under another situation version, re-taped under another archetype, the moment gone or moved, the situations unavailable: null', async () => {
    const changes = {
      version: (t) => { for (const i of t.tags.items) if (i.symbol === 'ETN') i.version = 3; },
      archetype: (t) => { t.tags.inputs.archetypeCodeId = 'trend_follower'; },
      gone: (t) => { t.tags.items = t.tags.items.filter((i) => i.symbol !== 'ETN'); },
      moved: (t) => { t.tags.items = t.tags.items.filter((i) => !(i.symbol === 'ETN' && i.tickSeq === 19)); },
      unavailable: (t) => { t.coverage.tags.status = 'unavailable'; },
      noTape: (t) => { t.ownerId = null; },
    };
    expect(await cardOver(excerptStore(DAY))).not.toBeNull();
    for (const [name, edit] of Object.entries(changes)) expect(await cardOver(withTape(edit)), name).toBeNull();
  });
  it('the moment asked of excerptOf must be exactly one of the day\'s stored moments (a sub-range, a superset: null)', async () => {
    for (const m of [{ ...ETN_MOMENT, toTickSeq: 18 }, { ...ETN_MOMENT, fromTickSeq: 14 }, { ...ETN_MOMENT, symbol: 'PANW' }]) {
      expect(await momentOver(excerptStore(DAY), { ...MOMENT_ASK, moment: m }), JSON.stringify(m)).toBeNull();
    }
  });
  it('ONE implementation: momentExcerpt.js imports the shared day check and judges no coverage, moment, archetype or version itself', () => {
    const src = readFileSync(path.join(HERE, 'momentExcerpt.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).toMatch(/import\s*\{[^}]*\bjudgeDay\b[^}]*\bjudgeFiledDay\b[^}]*\breadDayWith\b[^}]*\}\s*from\s*'\.\/sourceDay\.js'/);
    for (const own of [/coverage\?\.tags\?\.status/, /momentOfDay\s*\(/, /momentsOf\s*\(/, /sameMoment\s*\(/, /tags\?\.inputs\?\.archetypeCodeId/, /archetypeCodeId\s*!==/]) expect(own.test(src), String(own)).toBe(false);
  });
});

// ── reads, paths ────────────────────────────────────────────────────────────

describe('bounded reads only — exactly the documents named, by get, never a query or a scan', () => {
  it('a moment: the tape day, the battle, the idea\'s version, the sold symbol\'s series — four gets', async () => {
    const t = dbOf(excerptStore(DAY));
    await excerptOf(t.db, MOMENT_ASK);
    expect(t.readLog).toEqual([TAPE_PATH, `agentBattles/${EXCERPT_BATTLE}`, IDEA_PATH, SERIES_ETN]);
  });
  it('a card: its plays entry first, then the same; a clone\'s battle adds the owner\'s clone document', async () => {
    const t = dbOf(excerptStore(DAY));
    await excerptOfCard(t.db, CARD_ASK);
    expect(t.readLog).toEqual([CARD_PATH, TAPE_PATH, `agentBattles/${EXCERPT_BATTLE}`, IDEA_PATH, SERIES_ETN]);
    const c = dbOf(excerptStore(CLONE_DAY, { clone: true }));
    await excerptOf(c.db, MOMENT_ASK);
    expect(c.readLog).toEqual([TAPE_PATH, `agentBattles/${EXCERPT_BATTLE}`, `agents/${CLONE_AGENT}`, `agents/${AGENT}`, IDEA_PATH, SERIES_ETN]);
  });
  it('the paths it reads are its owners\' own (the ledger\'s plays, the agents collection, the hypothesis store\'s versions)', () => {
    expect(EXCERPT_PATHS.plays).toBe(PLAYS_SUBCOLLECTION);
    const probe = { collection: (c) => ({ doc: (d) => ({ c, d }) }) };
    expect(agentRefOf(probe, 'x').c).toBe(EXCERPT_PATHS.agents);
    expect(EXCERPT_PATHS.ideaLists).toBe(WATCHLISTS_COLLECTION);
    expect(EXCERPT_PATHS.ideaVersions).toBe(VERSIONS_SUBCOLLECTION);
    for (const n of [1, 3, 12]) expect(EXCERPT_PATHS.ideaVersionDocId(n)).toBe(versionDocId(n));
  });
});
