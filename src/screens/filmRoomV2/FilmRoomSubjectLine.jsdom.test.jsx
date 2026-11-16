// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomSubjectLine.jsdom.test.jsx
//
// Film Room C2 item 5 — THE SUBJECT LINE on the screen (Build C spec §5; Amendment C CC-7), over the Sep 23 day the
// moment excerpt's goldens are built from (api/_utils/filmRoom/__fixtures__/excerptFixtures.js, the real passes):
//   ON THE SCREEN    under cards mode (the shipped 'allowlist', the owner admitted) the form for a moment shows the line
//                    under the moment's facts, the day's carried idea read ONCE, its version marked as the tape's;
//   CARDS OFF        no line at all, and the version never read;
//   THE RECEIPT      the card's own day shows the line, EQUAL to the agent's excerpt's projection of the same card
//                    (momentExcerpt.js excerptOfCard → subjectOfExcerpt); a card from another day shows none;
//   EACH PART        present and absent — no carried idea, the version unread or another owner's, an unmapped symbol;
//   THE SWEEPS       clean over the form and the receipt with the statement's digits and words; the statement bound to
//                    the version document as read (the harness's CC-7 binding), and the binding bites on a forged,
//                    unbound or over-bound text.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';
import FilmRoomScreenV2 from './FilmRoomScreenV2';
import { Receipt, YourCall } from './FilmRoomCardRegions';
import { mounter, readersOf, NOW, sweepNumbers, sweepWords, sweepSigns, quoteDefects, boundSubjectStatementOf, SPEC_SUBJECT_STATEMENT } from './__fixtures__/filmRoomHarness';
import { excerptDay, excerptStore, excerptCardWith, ideaVersionDoc, dbOf, OWNER, AGENT, SEP23, EXCERPT_BATTLE, EXCERPT_ENTRY, EXCERPT_WATCHLIST, EXCERPT_IDEA_VERSION, EXCERPT_STATEMENT, ETN_MOMENT } from '../../../api/_utils/filmRoom/__fixtures__/excerptFixtures.js';
import { buildCardDoc } from '../../../api/_utils/filmRoom/cardStore.js';
import { excerptOf, excerptOfCard } from '../../../api/_utils/filmRoom/momentExcerpt.js';
import { subjectOfExcerpt, SUBJECT_STATEMENT_CODE_POINTS } from '../../utils/filmRoomSubject';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

let DAY;
beforeAll(async () => { DAY = await excerptDay(); });

const m = mounter();
beforeEach(() => { m.setup(); globalThis.localStorage.clear(); });
afterEach(() => { m.teardown(); vi.restoreAllMocks(); });

const card = (o) => excerptCardWith(buildCardDoc, o);
const battle = () => ({ id: EXCERPT_BATTLE, agentBattleId: EXCERPT_BATTLE, ownerId: OWNER, agentId: AGENT, status: 'completed', completedAt: '2026-09-23T20:05:00.000Z', timing: { tradingDays: [SEP23] }, agentContext: { agentName: 'Momentum chaser', archetype: 'momentum_chaser' }, gameMode: 'baggerbomb_agent' });
const COUNTER = (cards = []) => ({ agentId: AGENT, attributionAgentId: AGENT, archetypeCodeId: 'momentum_chaser', cards, open: cards.length, cap: 5, recurrences: {}, book: { open: false }, unavailableDays: {}, weekly: [], window: { from: SEP23, to: SEP23 } });
const cardsApi = (admitted, cards = []) => ({ readVerdict: async () => admitted, readCounter: async () => ({ ok: true, status: 200, body: COUNTER(cards) }), postCard: async () => ({ ok: false, status: 400, body: { error: 'x' } }), newOpId: () => 'op_s1' });
/** The readers, with the idea's one read counted. */
const readers = (doc = ideaVersionDoc()) => {
  const r = readersOf({ [SEP23]: DAY.tape });
  r.ideaReads = [];
  r.readIdeaVersion = async (watchlistId, version) => { r.ideaReads.push([watchlistId, version]); return doc ? { status: 'ready', doc } : { status: 'missing', doc: null }; };
  return r;
};
/** A line's visible words: its text with the class markers (KindMark) left out. */
const lineText = (el) => { const c = el.cloneNode(true); for (const k of c.querySelectorAll('[data-kind-mark]')) k.remove(); return c.textContent; };
const STATEMENT_60 = [...EXCERPT_STATEMENT].slice(0, SUBJECT_STATEMENT_CODE_POINTS).join('');
const FULL = `ETN · XLI · under your idea '${STATEMENT_60}' v${EXCERPT_IDEA_VERSION}`;

async function openScreen({ admitted = true, r = readers(), cards = [] } = {}) {
  m.render(<FilmRoomScreenV2 battle={battle()} onBack={() => {}} viewerId="viewer-s" readers={r} nowMs={NOW} cardsApi={cardsApi(admitted, cards)} />);
  await m.flush(10);
  return r;
}
const takeHome = async (key = 'stalled:ETN:15-19') => {
  const row = m.q(`[data-moment-row="${key}"]`);
  m.click([...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Take this home'));
  await m.flush(6);
};

describe('CC-7 — on the screen, under cards mode only', () => {
  it('the form shows the line under the moment\'s facts — every part — and the day\'s idea is read ONCE', async () => {
    const r = await openScreen();
    await takeHome();
    const form = m.q('[data-card-form]');
    const line = form.querySelector('[data-subject-line]');
    expect(lineText(line)).toBe(FULL);
    // under the facts: after the moment's facts in the form's order
    expect(form.querySelector('[data-moment-facts]').compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // the version is the tape's own number, marked with its class
    const v = line.querySelector('[data-num]');
    expect(v.getAttribute('data-num')).toMatch(/^calls\[\d+\]\.hypothesisRef\.hypothesisVersion$/);
    expect(v.getAttribute('data-num-class')).toBe('recorded');
    expect(r.ideaReads).toEqual([[EXCERPT_WATCHLIST, EXCERPT_IDEA_VERSION]]);
    // a second form on the same day reads nothing more
    m.click([...form.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancel'));
    await m.flush(2);
    await takeHome('stalled:META:15-19');
    expect(lineText(m.q('[data-card-form] [data-subject-line]'))).toBe(`META · XLC · under your idea '${STATEMENT_60}' v${EXCERPT_IDEA_VERSION}`);
    expect(r.ideaReads).toHaveLength(1);
  });
  it('§2 review L3-3 — THROUGH THE SCREEN: a card opened from My cards on its own day shows the receipt\'s line, equal to the excerpt\'s projection of that card (the mutant: the screen not handing the idea to the receipt)', async () => {
    const c = { ...card(), shelved: false };
    const r = await openScreen({ cards: [c] });
    m.click(m.q(`[data-my-card="${EXCERPT_ENTRY}"]`));
    await m.flush(6);
    const line = m.q(`[data-card-receipt="${EXCERPT_ENTRY}"] [data-subject-line]`);
    const got = await excerptOfCard(dbOf(excerptStore(DAY, { card: card() })).db, { uid: OWNER, attributionAgentId: AGENT, entryId: EXCERPT_ENTRY });
    expect(lineText(line)).toBe(subjectOfExcerpt(got.excerpt).text);
    expect(lineText(line)).toBe(FULL);
    expect(r.ideaReads).toEqual([[EXCERPT_WATCHLIST, EXCERPT_IDEA_VERSION]]);
  });
  it('CE-1 — THROUGH THE SCREEN, the form and the receipt are handed the ids the excerpt knows (the mutant: the screen handing none): a statement holding the battle\'s id — known exactly, no id shape — is on neither line, as on neither excerpt', async () => {
    const doc = ideaVersionDoc({ statement: `Recorded ${EXCERPT_BATTLE} here.` });
    const c = { ...card(), shelved: false };
    await openScreen({ r: readers(doc), cards: [c] });
    await takeHome();
    const moment = await excerptOf(dbOf(excerptStore(DAY, { card: card(), idea: doc })).db, { uid: OWNER, attributionAgentId: AGENT, battleId: EXCERPT_BATTLE, etDate: SEP23, moment: ETN_MOMENT });
    const formLine = m.q('[data-card-form] [data-subject-line]');
    expect(lineText(formLine)).toBe(subjectOfExcerpt(moment.excerpt).text);
    expect(lineText(formLine)).toBe(`ETN · XLI · under your idea v${EXCERPT_IDEA_VERSION}`);
    m.click(m.q(`[data-my-card="${EXCERPT_ENTRY}"]`));
    await m.flush(6);
    const ofCard = await excerptOfCard(dbOf(excerptStore(DAY, { card: card(), idea: doc })).db, { uid: OWNER, attributionAgentId: AGENT, entryId: EXCERPT_ENTRY });
    expect(lineText(m.q(`[data-card-receipt="${EXCERPT_ENTRY}"] [data-subject-line]`))).toBe(subjectOfExcerpt(ofCard.excerpt).text);
  });
  it('CARDS OFF (the owner not admitted): no line anywhere, and the idea never read (the mutant: the line shown with cards off)', async () => {
    const r = await openScreen({ admitted: false });
    expect(m.q('[data-cards-region]')).toBeNull();
    expect(m.q('[data-subject-line]')).toBeNull();
    expect(m.container.textContent).not.toContain('under your idea');
    await m.flush(6);
    expect(r.ideaReads).toEqual([]);
  });
  it('the sweeps over the form with the line: numbers, words, signs, quotations — clean', async () => {
    await openScreen();
    await takeHome();
    const docs = { tape: DAY.tape, idea: ideaVersionDoc(), battle: battle(), ledger: { etDate: SEP23, cards: {} }, agentArchetype: 'momentum_chaser' };
    const form = m.q('[data-card-form]');
    expect(sweepNumbers(form, docs)).toEqual([]);
    expect(sweepWords(form, docs)).toEqual([]);
    expect(sweepSigns(form)).toEqual([]);
    expect(quoteDefects(form, docs)).toEqual([]);
  });
});

describe('CC-7 — the receipt says what the agent\'s excerpt says', () => {
  const renderReceipt = ({ tape = DAY.tape, idea = { status: 'ready', doc: ideaVersionDoc() }, c = card(), subjectIds = null } = {}) => {
    m.render(<Receipt day={SEP23} counter={{ status: 'ready', data: COUNTER([c]) }} card={c} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} tape={tape} idea={idea} subjectIds={subjectIds} />);
  };
  it('CE-1 — A STATEMENT HOLDING AN ID is not on the receipt\'s line, EQUAL to the excerpt, which leaves it out: an id the receipt knows exactly (the battle, the card\'s entry) or a shape the platform mints', async () => {
    const ids = { ownerId: OWNER, battleId: EXCERPT_BATTLE, battleAgentId: AGENT, attributionAgentId: AGENT };
    for (const id of [EXCERPT_BATTLE, EXCERPT_ENTRY, 'Ab3dEf7hIj9kLm1nOp5q']) {
      const doc = ideaVersionDoc({ statement: `Recorded ${id} here.` });
      const got = await excerptOfCard(dbOf(excerptStore(DAY, { card: card(), idea: doc })).db, { uid: OWNER, attributionAgentId: AGENT, entryId: EXCERPT_ENTRY });
      expect(got.excerpt.idea.statement, id).toBeUndefined();
      renderReceipt({ idea: { status: 'ready', doc }, subjectIds: ids });
      const line = m.q('[data-subject-line]');
      expect(lineText(line), id).toBe(subjectOfExcerpt(got.excerpt).text);
      expect(lineText(line), id).toBe(`ETN · XLI · under your idea v${EXCERPT_IDEA_VERSION}`);
      expect(line.textContent, id).not.toContain(id);
      m.teardown(); m.setup();
    }
  });
  it('the receipt\'s line EQUALS the excerpt\'s projection of the same card (excerptOfCard → subjectOfExcerpt)', async () => {
    const got = await excerptOfCard(dbOf(excerptStore(DAY, { card: card() })).db, { uid: OWNER, attributionAgentId: AGENT, entryId: EXCERPT_ENTRY });
    const said = subjectOfExcerpt(got.excerpt);
    renderReceipt();
    const line = m.q(`[data-card-receipt="${EXCERPT_ENTRY}"] [data-subject-line]`);
    expect(lineText(line)).toBe(said.text);
    expect(said.text).toBe(FULL);
    // under the card's facts, before the note
    expect(m.q('[data-card-receipt] [data-quotation]').compareDocumentPosition(line) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
  it('the same, part for part, when the version is unread (the idea without its statement) and when the day carries no idea', async () => {
    const store = excerptStore(DAY, { card: card(), over: { [`watchlists/${EXCERPT_WATCHLIST}/hypothesisVersions/v${EXCERPT_IDEA_VERSION}`]: undefined } });
    const unread = await excerptOfCard(dbOf(store).db, { uid: OWNER, attributionAgentId: AGENT, entryId: EXCERPT_ENTRY });
    renderReceipt({ idea: { status: 'missing', doc: null } });
    expect(lineText(m.q('[data-subject-line]'))).toBe(subjectOfExcerpt(unread.excerpt).text);
    expect(lineText(m.q('[data-subject-line]'))).toBe(`ETN · XLI · under your idea v${EXCERPT_IDEA_VERSION}`);
    m.teardown(); m.setup();
    const noIdea = { ...structuredClone(DAY.tape), calls: [] };
    const none = await excerptOfCard(dbOf(excerptStore({ ...DAY, tape: noIdea }, { card: card() })).db, { uid: OWNER, attributionAgentId: AGENT, entryId: EXCERPT_ENTRY });
    renderReceipt({ tape: noIdea, idea: { status: 'idle', doc: null } });
    expect(lineText(m.q('[data-subject-line]'))).toBe(subjectOfExcerpt(none.excerpt).text);
    expect(lineText(m.q('[data-subject-line]'))).toBe('ETN · XLI');
  });
  it('another owner\'s version: the line ends after the sector, as the excerpt carries no idea', () => {
    renderReceipt({ idea: { status: 'ready', doc: ideaVersionDoc({ userId: 'someone-else' }) } });
    expect(lineText(m.q('[data-subject-line]'))).toBe('ETN · XLI');
  });
  it('§2 review L3-2 / L3-8: while the version reads, or after the read failed, NO line (the excerpt would quote the statement); a read the rules deny shows no idea, as the excerpt says of another owner\'s', () => {
    for (const status of ['loading', 'error']) {
      renderReceipt({ idea: { status, doc: null } });
      expect(m.q('[data-card-receipt]'), status).toBeTruthy();
      expect(m.q('[data-subject-line]'), status).toBeNull();
      m.teardown(); m.setup();
    }
    renderReceipt({ idea: { status: 'denied', doc: null } });
    expect(lineText(m.q('[data-subject-line]'))).toBe('ETN · XLI');
  });
  it('a card from another day shows no line (its own day is not on screen)', () => {
    renderReceipt({ tape: { ...DAY.tape, etDate: '2026-09-24' } });
    expect(m.q('[data-card-receipt]')).toBeTruthy();
    expect(m.q('[data-subject-line]')).toBeNull();
  });
  it('the sweeps over the receipt with the line: clean', () => {
    const c = card();
    renderReceipt({ c });
    const docs = { tape: DAY.tape, idea: ideaVersionDoc(), battle: battle(), ledger: { etDate: SEP23, cards: { [c.entryId]: c } }, agentArchetype: 'momentum_chaser' };
    const r = m.q('[data-card-receipt]');
    expect(sweepNumbers(r, docs)).toEqual([]);
    expect(sweepWords(r, docs)).toEqual([]);
    expect(quoteDefects(r, docs)).toEqual([]);
  });
});

describe('the sweeps\' CC-7 binding — the statement is the player\'s own words only when bound to the version as read', () => {
  const DIGITS = 'Hold chips for 3 days; best if 2 of them run twice.';
  const formWith = (doc) => {
    m.render(<YourCall tape={DAY.tape} moment={{ ...ETN_MOMENT, from: '2026-09-23T17:45:20.000Z', to: '2026-09-23T18:45:20.000Z', checks: 5 }} counter={{ status: 'ready', data: COUNTER() }} mintOpId={() => 'op_f'} onFile={async () => ({ ok: true })} onCancel={() => {}} idea={{ status: 'ready', doc }} />);
    return { doc, docs: { tape: DAY.tape, idea: doc, ledger: { etDate: SEP23, cards: {} }, agentArchetype: 'momentum_chaser' } };
  };
  it('a statement with digits, a forbidden word and a number word, bound: the sweeps pass it as the player\'s words — and a longer one, cut at 60, binds as its cut', () => {
    const long = `${DIGITS} Then rotate into industrials.`;
    const cut = formWith(ideaVersionDoc({ statement: long }));
    expect(m.q('[data-subject-statement]').textContent).toBe([...long].slice(0, 60).join(''));
    expect(sweepNumbers(m.container, cut.docs)).toEqual([]);
    expect(sweepWords(m.container, cut.docs)).toEqual([]);
    m.teardown(); m.setup();
    const { docs } = formWith(ideaVersionDoc({ statement: DIGITS }));
    expect(m.q('[data-subject-statement]').textContent).toBe(DIGITS);
    expect(sweepNumbers(m.container, docs)).toEqual([]);
    expect(sweepWords(m.container, docs)).toEqual([]);
  });
  it('THE BINDING BITES: forged text, a document holding other words, an over-bound statement, or the span outside a subject line — swept', () => {
    const { docs } = formWith(ideaVersionDoc({ statement: DIGITS }));
    const s = m.q('[data-subject-statement]');
    expect(boundSubjectStatementOf(s, docs)).toBe(s);
    expect(boundSubjectStatementOf(s, { ...docs, idea: ideaVersionDoc({ statement: `${DIGITS} More.` }) })).toBeNull();   // its 60-code-point cut is other words
    expect(boundSubjectStatementOf(s, { ...docs, idea: ideaVersionDoc({ statement: 'Other 4 words.' }) })).toBeNull();
    expect(boundSubjectStatementOf(s, { ...docs, idea: ideaVersionDoc({ statement: `${DIGITS}${'x'.repeat(SPEC_SUBJECT_STATEMENT.max)}` }) })).toBeNull();
    expect(boundSubjectStatementOf(s, { ...docs, idea: null })).toBeNull();
    expect(sweepNumbers(m.container, { ...docs, idea: ideaVersionDoc({ statement: 'Other 4 words.' }) }).some((d) => /stray digit/.test(d))).toBe(true);
    const unbound = sweepWords(m.container, { ...docs, idea: ideaVersionDoc({ statement: 'Other 4 words.' }) });
    expect(unbound).toContain('best');
    expect(unbound.some((h) => /number word “twice”/.test(h))).toBe(true);
    s.textContent = 'Hold chips for 9 days';
    expect(sweepNumbers(m.container, docs).some((d) => /stray digit/.test(d))).toBe(true);
    const loose = document.createElement('span');
    loose.setAttribute('data-subject-statement', '');
    loose.setAttribute('data-subject-doc', 'idea');
    loose.textContent = DIGITS;
    m.container.appendChild(loose);
    expect(boundSubjectStatementOf(loose, docs)).toBeNull();
    expect(SPEC_SUBJECT_STATEMENT).toEqual({ max: 280, cut: 60 });
  });
});
