// api/_utils/practiceField/bookView.b6.test.js
//
// Practice Field build B6 — THE VIEW, before the players:
//   B6-3  a desk's own words: the old desk names and the caller's own idea ids, and nothing else (deskOwnWords), in every
//         place a desk's words appear; a founder's thesis untouched; the stored records untouched; every scene scanned;
//   B6-4  SPY keeps reading after the last position sells (Astra B5-A04);
//   B6-5  an epoch must state every slot's cap before the view carries a split (Astra B5-A05).
// Pure, on the scenes (__testsupport__/bookViewScenes.js, bookViewScenesHub.js), and through the reader on the in-memory store.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildBookView, deskOwnWords, ideaSlotsOf, deskNamesOf, epochSharesOf, finishedView } from './bookView.js';
import { IDEA_IN_DESK_WORDS } from './bookViewCopy.js';
import { readBookView } from './bookViewRead.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { sealAdjustment, verifyPacket } from './evidence.js';
import { makeMandateFakeDb } from './__testsupport__/fixtures.js';
import { SCENE_NAMES, sceneInput, SCENE_UID, SCENE_BOOK_ID } from './__testsupport__/bookViewScenes.js';
import { hubSceneInput, hubSceneDocs, sceneEpoch, HUB_AGENT_NAME } from './__testsupport__/bookViewScenesHub.js';

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); });
afterEach(() => restoreMode());

const NAMED = deskNamesOf({ agentName: 'Atlas', archetypeName: 'Trend Follower' });
const FALLBACK = deskNamesOf();
const SLOTS = new Map([['idea_aaa', 'medium'], ['idea_bbb', 'short'], ['idea_ccc', 'long']]);
const say = (text, { names = NAMED, ideaSlots = SLOTS } = {}) => deskOwnWords(text, { names, ideaSlots });

/** Every string a player reads: the desk ids (`desk`) are the engine's keys. */
const playerStrings = (v, key = null, out = []) => {
  if (typeof v === 'string') { if (key !== 'desk') out.push(v); }
  else if (Array.isArray(v)) v.forEach((x) => playerStrings(x, key, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) playerStrings(x, k, out);
  return out;
};
const OLD_NAMES = /shadow desk|archetype desk/i;

// ── B6-3: the helper ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('B6-3 — deskOwnWords: exactly two replacements', () => {
  it('the old names, in any letter case, with or without "the": that desk\'s name — `name` at a sentence\'s head, `mid` inside one', () => {
    const rows = [
      ['The Shadow desk holds JPM.', 'Atlas’s desk holds JPM.'],
      ['Shadow desk, 16 Nov: the banks hold.', 'Atlas’s desk, 16 Nov: the banks hold.'],
      ['I agree with the shadow desk.', 'I agree with Atlas’s desk.'],
      ['THE SHADOW DESK and THE ARCHETYPE DESK agree.', 'Atlas’s desk and Trend Follower’s desk agree.'],
      ['the Archetype Desk exits; the archetype desk said so.', 'Trend Follower’s desk exits; Trend Follower’s desk said so.'],
      ['Holding. the shadow desk waits.', 'Holding. Atlas’s desk waits.'],
    ];
    for (const [text, want] of rows) expect(say(text), text).toBe(want);
    // A fallback name is lower-cased inside a sentence and capitalised at its head (B5's rule).
    expect(say('The Shadow desk holds; I side with the shadow desk.', { names: FALLBACK })).toBe('Your agent’s desk holds; I side with your agent’s desk.');
    expect(say('Ask the archetype desk. Archetype desk agrees.', { names: FALLBACK })).toBe('Ask your archetype’s desk. Your archetype’s desk agrees.');
    // After a line break, a new sentence — with or without a full stop before it.
    expect(say('Held.\nShadow desk next.', { names: FALLBACK })).toBe('Held.\nYour agent’s desk next.');
    expect(say('Holding\nShadow desk next', { names: FALLBACK })).toBe('Holding\nYour agent’s desk next');
    expect(say('Holding, shadow desk next', { names: FALLBACK })).toBe('Holding, your agent’s desk next');
  });

  it('review A5: the head of a sentence after "…" or behind an opening bracket or quote; a desk\'s own lower case after "vs." stays inside it', () => {
    const rows = [
      ['Wait… The Shadow desk holds.', 'Wait… Your agent’s desk holds.'],
      ['Held. (The Shadow desk agrees.)', 'Held. (Your agent’s desk agrees.)'],
      ['Held. “The archetype desk agrees.”', 'Held. “Your archetype’s desk agrees.”'],
      ['Ahead vs. the archetype desk today.', 'Ahead vs. your archetype’s desk today.'],
      ['Held. the shadow desk waits.', 'Held. your agent’s desk waits.'],
      ['Held. the idea_aaa waits.', 'Held. the medium idea waits.'],
      ['Held. The idea_aaa waits.', 'Held. The medium idea waits.'],
      ['Held. idea_aaa waits.', 'Held. The medium idea waits.'],
    ];
    for (const [text, want] of rows) expect(say(text, { names: FALLBACK }), text).toBe(want);
  });

  it('review A1, A7, A11: a look-alike of "s" names no desk; a line break inside "the … Shadow desk" is part of the replaced phrase (A7 refuted); an empty id is never searched for', () => {
    const longS = String.fromCodePoint(0x17f); // LATIN SMALL LETTER LONG S: /iu would fold it to "s"
    expect(say(`${longS}hadow desk holds`)).toBe(`${longS}hadow desk holds`);
    expect(say('I keep the\nidea_aaa and the\nShadow desk agrees.')).toBe('I keep the medium idea and Atlas’s desk agrees.');
    expect(say('Held.\nI agree.')).toBe('Held.\nI agree.'); // (a line break outside a replacement is never touched)
    expect(deskOwnWords('x idea_aaa', { names: NAMED, ideaSlots: new Map([['', 'short'], ['idea_aaa', 'medium']]) })).toBe('x the medium idea');
  });

  it('a note that names both desks and two ideas', () => {
    expect(say('The Shadow desk holds idea_aaa; the archetype desk exits idea_bbb.'))
      .toBe('Atlas’s desk holds the medium idea; Trend Follower’s desk exits the short idea.');
  });

  it('each id of the caller\'s own book: "the {slot} idea", matched whole, at a sentence\'s head capitalised; "the" before it taken in', () => {
    expect(say('idea_aaa is near its line.')).toBe('The medium idea is near its line.');
    expect(say('I hold the idea_ccc; idea_aaa too.')).toBe('I hold the long idea; the medium idea too.');
    expect(say('Exit idea_bbb. idea_bbb failed.')).toBe('Exit the short idea. The short idea failed.');
    expect(say('(idea_aaa), "idea_bbb", idea_ccc\'s line')).toBe('(The medium idea), "the short idea", the long idea\'s line');
    // Review A4: an id is `idea_` and hex — a hyphen never extends one, so "idea_aaa-style" names the idea.
    expect(say('I like idea_aaa-style trades.')).toBe('I like the medium idea-style trades.');
    for (const slot of ['short', 'medium', 'long']) expect(IDEA_IN_DESK_WORDS[slot]).toEqual({ name: `The ${slot} idea`, mid: `the ${slot} idea` });
  });

  it('nothing else is touched: an unknown id, a longer token, a bare "Shadow", "desk" or "archetype" — and text with nothing to replace is returned as it is', () => {
    const untouched = [
      'idea_zzz is not this book\'s.', // an id the view does not hold
      'idea_aaa2 and xidea_aaa and idea_aaa_b', // a known id inside a longer token
      'Shadows lengthen on the desk; the archetype\'s frozen identity.',
      'The shadow-desk word and shadow desks stay.',
      'Holding steady; nothing material changed.',
    ];
    for (const t of untouched) expect(say(t), t).toBe(t);
    expect(say(null)).toBeNull();
    expect(say(undefined)).toBeUndefined();
    expect(say('')).toBe('');
    // Without the view's ids, only the names change.
    expect(deskOwnWords('The Shadow desk holds idea_aaa.', { names: NAMED })).toBe('Atlas’s desk holds idea_aaa.');
  });

  it('a given name is put in as it is: no `$` pattern of String.replace reaches it', () => {
    const names = deskNamesOf({ agentName: '$& $1 $$ $`', archetypeName: 'Trend Follower' });
    expect(say('The Shadow desk holds.', { names })).toBe('$& $1 $$ $`’s desk holds.');
  });

  it('ideaSlotsOf: the ids the view holds, each to its slot; an idea with no known slot is not in it', () => {
    const m = ideaSlotsOf([{ ideaId: 'a', contract: { slot: 'short' } }, { ideaId: 'b', contract: { slot: 'medium' } }, { ideaId: 'c', contract: { slot: 'weird' } }, null, { contract: { slot: 'long' } }]);
    expect([...m]).toEqual([['a', 'short'], ['b', 'medium']]);
  });
});

// ── B6-3: every place a desk's own words appear ─────────────────────────────────────────────────────────────────────

/** A scene's ids (live and finished), each to its slot. */
const sceneIdeaSlots = (input) => ideaSlotsOf([...input.ideas, ...input.finished.map((f) => f.idea)]);
/** Words a desk could have written before B6: both old names and every id the scene's book holds. */
const voice = (text, ids) => `The Shadow desk and the archetype desk agree on ${ids.join(', ')}. ${text ?? ''}`.trim();
/** A finished idea with its result packet re-sealed — so the voiced exit reason passes the packet's own check. */
function reseal(f, managerExitReason) {
  if (!f.packet?.result?.managerExit) return f;
  const { contentHash: _h, hashAlgorithm: _a, ...body } = f.packet;
  const packet = sealAdjustment({ ...body, result: { ...body.result, managerExit: { ...body.result.managerExit, reason: managerExitReason } } });
  return { ...f, packet };
}
/**
 * A scene with every desk's own words voiced: each desk's note, each call's reason, each draft's thesis, the thesis of every
 * idea a desk authored (live and finished) and every finished idea's exit reason. A founder's thesis is left as it is.
 */
function voiced(input) {
  const ids = [...sceneIdeaSlots(input).keys()];
  const v = (t) => voice(t, ids);
  const desks = input.closeRow?.agent?.desks || {};
  const voicedDesks = Object.fromEntries(Object.entries(desks).map(([k, p]) => [k, p && {
    ...p,
    ...(p.source === 'model' ? { note: v(p.note) } : {}),
    actions: (p.actions || []).map((a) => ({ ...a, reason: v(a.reason) })),
    considered: (p.considered || []).map((c) => ({ ...c, thesis: v(c.thesis) })),
  }]));
  const thesisOfIdea = (idea) => (idea?.contract?.thesis?.author === 'agent' ? { ...idea, contract: { ...idea.contract, thesis: { ...idea.contract.thesis, text: v(idea.contract.thesis.text) } } } : idea);
  return {
    ...input,
    closeRow: input.closeRow ? { ...input.closeRow, agent: { ...input.closeRow.agent, desks: voicedDesks } } : input.closeRow,
    ideas: input.ideas.map(thesisOfIdea),
    finished: input.finished.map((f) => reseal({ ...f, idea: thesisOfIdea(f.idea) }, v(f.packet?.result?.managerExit?.reason))),
  };
}

describe('B6-3 — in each place a desk\'s words appear', () => {
  it('the sample day: the desk\'s note, each call\'s reason (Positions and the Desks tab), each draft\'s thesis, the agent-authored thesis; the founder\'s thesis untouched', () => {
    const input = voiced(hubSceneInput('sample'));
    const v = buildBookView(input);
    const head = 'Atlas’s desk and Trend Follower’s desk agree on ';
    const short = v.groups.find((g) => g.slot === 'short');
    const medium = v.groups.find((g) => g.slot === 'medium');
    expect(short.call.text.startsWith(head)).toBe(true);
    expect(medium.call.text.startsWith(head)).toBe(true);
    expect(short.call.text).toContain('the short idea, the medium idea');
    const shadowDesk = v.desks.find((d) => d.desk === 'shadow');
    expect(shadowDesk.note.text.startsWith(head)).toBe(true);
    expect(shadowDesk.calls.find((c) => c.slot === 'medium').call.text).toBe(medium.call.text);
    expect(shadowDesk.passed.drafts.every((d) => d.thesis.startsWith(head))).toBe(true);
    // The archetype desk's idea: its thesis is the desk's own words. The banks idea's is the founder's: shown as written.
    expect(short.thesis).toMatchObject({ byline: 'Trend Follower’s desk' });
    expect(short.thesis.text.startsWith(head)).toBe(true);
    expect(medium.thesis.byline).toBe('The founder');
    expect(medium.thesis.text).toBe(input.ideas.find((i) => i.ideaId === 'i_banks').contract.thesis.text);
  });

  it('a founder\'s thesis that names a desk and an id is untouched; an idea of any other author too', () => {
    const base = hubSceneInput('sample');
    const words = 'The Shadow desk manages i_banks for me.';
    const ideas = base.ideas.map((i) => (i.ideaId === 'i_banks' ? { ...i, contract: { ...i.contract, thesis: { text: words, author: 'founder_fixture' } } }
      : { ...i, contract: { ...i.contract, thesis: { text: words, author: 'someone' } } }));
    const v = buildBookView({ ...base, ideas });
    expect(v.groups.find((g) => g.slot === 'medium').thesis).toMatchObject({ text: words, byline: 'The founder' });
    expect(v.groups.find((g) => g.slot === 'short').thesis).toMatchObject({ text: words, byline: null });
  });

  it('review N1: a founder fixture whose thesis is labelled `agent` (the door forces the origin, not the author) is still the founder\'s text — untouched', () => {
    const base = hubSceneInput('sample');
    const words = 'The Shadow desk manages i_banks for me.';
    const ideas = base.ideas.map((i) => (i.ideaId === 'i_banks' ? { ...i, contract: { ...i.contract, thesis: { text: words, author: 'agent' }, origin: { kind: 'founder_fixture', initiatedBy: 'agent' } } } : i));
    const v = buildBookView({ ...base, ideas });
    expect(v.groups.find((g) => g.slot === 'medium').thesis.text).toBe(words);
    // (The control: the same words on a desk's own idea are replaced.)
    const own = base.ideas.map((i) => (i.ideaId === 'i_banks' ? { ...i, contract: { ...i.contract, thesis: { text: words, author: 'agent' }, origin: { kind: 'market_scan', initiatedBy: 'agent' } } } : i));
    expect(buildBookView({ ...base, ideas: own }).groups.find((g) => g.slot === 'medium').thesis.text).toBe('Atlas’s desk manages the medium idea for me.');
  });

  it('History and the slot settled today: a finished idea\'s thesis and its exit\'s reason; History on its own replaces the names and no id', () => {
    for (const name of ['history', 'settledToday']) {
      const input = voiced(hubSceneInput(name));
      const v = buildBookView(input);
      const exits = v.history.items.filter((h) => h.lastCall);
      expect(exits.length, name).toBeGreaterThan(0);
      for (const h of exits) {
        expect(h.lastCall.text.startsWith('Atlas’s desk and Trend Follower’s desk agree on '), name).toBe(true);
        expect(h.lastCall.text, name).not.toMatch(/\b[if]_[a-z]+\b/);
      }
      for (const h of v.history.items.filter((x) => x.thesis)) expect(h.thesis.text, name).not.toMatch(OLD_NAMES);
      if (name === 'settledToday') {
        const g = v.groups.find((x) => x.state === 'settled_today');
        expect(g.lastCall.text.startsWith('Atlas’s desk and Trend Follower’s desk agree on ')).toBe(true);
        expect(g.thesis.text.startsWith('Atlas’s desk and Trend Follower’s desk agree on ')).toBe(true);
        // The ids too: the finished idea's own and the live ones, each as its slot's idea.
        for (const text of [g.lastCall.text, g.thesis.text]) {
          expect(text).toContain('the long idea');
          expect(text).not.toMatch(/\b[if]_[a-z]+\b/);
        }
      }
    }
    // finishedView on its own (no ids handed in): the names change, an id is left as written.
    const f = voiced(hubSceneInput('settledToday')).finished[0];
    expect(verifyPacket(f.packet)).toBe(true);
    const alone = finishedView(f, { bookId: SCENE_BOOK_ID, names: NAMED });
    expect(alone.lastCall.text.startsWith('Atlas’s desk and Trend Follower’s desk agree on ')).toBe(true);
    expect(alone.lastCall.text).toContain('f_today');
  });

  it('the stored records are unchanged after a view is built from them, and after a read through the store', async () => {
    const input = voiced(hubSceneInput('sample'));
    const before = JSON.stringify({ closeRow: input.closeRow, ideas: input.ideas, finished: input.finished });
    buildBookView(input);
    expect(JSON.stringify({ closeRow: input.closeRow, ideas: input.ideas, finished: input.finished })).toBe(before);
    // Through the reader: the close row as stored, before and after.
    const docs = hubSceneDocs('sample');
    const closePath = Object.keys(docs).find((p) => p.endsWith('_close'));
    docs[closePath] = input.closeRow;
    const db = makeMandateFakeDb(docs);
    const storedBefore = JSON.stringify(db._get(closePath));
    const { book: v } = await readBookView(db, { uid: SCENE_UID, agentOn: true });
    expect(v.desks.find((d) => d.desk === 'shadow').note.text.startsWith('Atlas’s desk and Trend Follower’s desk')).toBe(true);
    expect(JSON.stringify(db._get(closePath))).toBe(storedBefore);
    expect(db._get(closePath).agent.desks.shadow.note.startsWith('The Shadow desk and the archetype desk')).toBe(true);
  });
});

describe('B6-3 — the scan of B5, over a desk\'s own words in every scene', () => {
  it('every scene, its desks\' words voiced with both old names and every id of its book: no old name and no id in any string a player reads — named, fallback and agent off', { timeout: 60_000 }, () => {
    let voicedStrings = 0;
    for (const n of SCENE_NAMES) {
      for (const [how, raw] of [['named', hubSceneInput(n)], ['fallback', sceneInput(n)], ['agent off', { ...hubSceneInput(n), agentOn: false }]]) {
        const input = voiced(raw);
        const ids = [...sceneIdeaSlots(input).keys()];
        const v = buildBookView(input);
        for (const s of playerStrings(v)) {
          expect(s, `${n} ${how}: ${s}`).not.toMatch(OLD_NAMES);
          for (const id of ids) expect(s.includes(id), `${n} ${how}: ${s}`).toBe(false);
          if (/^(Atlas’s|Your agent’s) desk and (Trend Follower’s|your archetype’s) desk agree on /.test(s)) voicedStrings += 1;
        }
      }
    }
    // (Not vacuous: the voiced words reached the view, in many places.)
    expect(voicedStrings).toBeGreaterThan(100);
  });
});

// ── B6-4: SPY after the last sale ───────────────────────────────────────────────────────────────────────────────────

const MON = '2026-11-16';
const TUE = '2026-11-17';
const WED = '2026-11-18';
/**
 * Astra's B5-A04 row: one idea, SPY 500 at Monday's fill and 510 at Tuesday's full-quality close, sold at Wednesday's first
 * window. The view is read after that sale, before Wednesday's close: the idea is in History, finished SINCE Tuesday's close,
 * with its Tuesday row (`atClose`).
 */
function soldAfterTuesday({ withAtClose = true } = {}) {
  const tueRow = {
    date: TUE, observed: true, fullQuality: true, quantities: { XOM: 100 }, marks: { XOM: { mark: 199.94, quality: 'vendor_time' } },
    markedHoldingsValue: 19994, spyMarks: { SPY: { mark: 510, quality: 'vendor_time', markSource: 'snapshot' } }, markedGapUsd: 0, markedGapPct: 0,
  };
  const idea = {
    ideaId: 'idea_xom', status: 'resulted', contract: { slot: 'short', desk: 'archetype', names: ['XOM'], thesis: { text: 'XOM.', author: 'agent' }, comparison: { type: 'same_stock_held' } },
    entry: { sessionDate: MON, filledAt: `${MON}T15:02:00.000Z` }, liquidation: { completedSession: WED }, ledger: { cash: 0, holdings: {}, saleReceipts: [{ kind: 'settlement', symbol: 'XOM', sessionDate: WED }] },
  };
  return {
    book: { bookId: SCENE_BOOK_ID, status: 'active', drafting: 'on', slots: { short: null, medium: null, long: null }, openIdeaIds: [], execState: { lastCloseKey: TUE }, portfolio: { initialValue: 100000, totalValue: 99994, cash: 80000 } },
    ideas: [],
    rows: new Map(),
    dailyRows: { last: { date: TUE, markedEquity: 99994, treasuryCash: 80000, reservedCash: 0, fullQuality: true, observed: true }, prev: { date: MON, markedEquity: 99990, treasuryCash: 80000, reservedCash: 0, fullQuality: true, observed: true } },
    closeRow: null,
    finished: [{ idea, packet: null, parts: {}, ...(withAtClose ? { atClose: tueRow } : {}) }],
    firstEntry: { session: MON, inception: { legs: { spy: [{ symbol: 'SPY', mark: 500, markVendorTimeIso: `${MON}T15:02:00.000Z` }] } } },
    agentOn: true,
  };
}

describe('B6-4 — SPY keeps reading after the last position sells (Astra B5-A04)', () => {
  it('her row: SPY 500 at Monday\'s fill, 510 at Tuesday\'s close, sold at Wednesday\'s first window — still +2.00% since 16 Nov; the equity of that close still shows', () => {
    const v = buildBookView(soldAfterTuesday());
    expect(v.line.spy).toEqual({ label: 'SPY', value: '+2.00%', since: '16 Nov' });
    expect(v.line.value).toBe('$99,994.00');
    expect(v.line.first).toMatchObject({ kind: 'since', label: 'Since 16 Nov' });
    // The control: without the finished idea's row of that close — main's lookup — SPY reads "—".
    expect(buildBookView(soldAfterTuesday({ withAtClose: false })).line.spy).toEqual({ label: 'SPY', value: '—' });
  });

  it('only a row OF the last close is read: a finished idea\'s row of another session, or one below the vendor\'s timed mark, gives "—"', () => {
    const s = soldAfterTuesday();
    const atClose = s.finished[0].atClose;
    const other = { ...s, finished: [{ ...s.finished[0], atClose: { ...atClose, date: MON } }] };
    expect(buildBookView(other).line.spy).toEqual({ label: 'SPY', value: '—' });
    const carried = { ...s, finished: [{ ...s.finished[0], atClose: { ...atClose, spyMarks: { SPY: { mark: 510, quality: 'carried' } } } }] };
    expect(buildBookView(carried).line.spy).toEqual({ label: 'SPY', value: '—' });
  });

  it('a live idea\'s row still comes first: with one, its mark is the one read (the scenes draw as before)', () => {
    const s = soldAfterTuesday();
    const live = { ideaId: 'idea_live', status: 'holding', contract: { slot: 'medium', names: ['JPM'] }, entry: { sessionDate: MON } };
    const v = buildBookView({ ...s, ideas: [live], book: { ...s.book, slots: { ...s.book.slots, medium: 'idea_live' } }, rows: new Map([['idea_live', { last: { date: TUE, spyMarks: { SPY: { mark: 505, quality: 'vendor_time' } } }, prev: null }]]) });
    expect(v.line.spy.value).toBe('+1.00%');
  });
});

// ── B6-5: the epoch's shares ────────────────────────────────────────────────────────────────────────────────────────

describe('B6-5 — an epoch must state every slot\'s cap before the view carries a split (Astra B5-A05)', () => {
  it('her row: the short cap absent, medium 50%, long 40%, cash 10% — no split (main read the archetype desk 0% of $0.00)', () => {
    const epoch = sceneEpoch({ slotCapShare: { medium: 0.5, long: 0.4 } });
    expect(Object.hasOwn(epoch.rails.slotCapShare, 'short')).toBe(false);
    expect(epoch.gateConfig.cashFloorPct).toBe(0.1);
    expect(epochSharesOf(epoch)).toBeNull();
    expect(buildBookView(hubSceneInput('sample', { epoch })).split).toBeNull();
  });

  it('each slot missing in turn: no split; every slot stated: the split, as before', () => {
    for (const missing of ['short', 'medium', 'long']) {
      const caps = { short: 0.2, medium: 0.3, long: 0.4 };
      delete caps[missing];
      expect(epochSharesOf(sceneEpoch({ slotCapShare: caps })), missing).toBeNull();
    }
    expect(epochSharesOf(sceneEpoch())).toEqual({ shadow: 700_000, archetype: 200_000, cash: 100_000 });
    expect(buildBookView(hubSceneInput('sample')).split.parts.map((p) => p.share.text)).toEqual(['70%', '20%', '10%']);
  });
});

describe('the agent\'s name stays the caller\'s own (B5-3) inside a desk\'s words too', () => {
  it('a voiced note reads the caller\'s agent by name; another owner\'s agent never reaches it', async () => {
    const docs = hubSceneDocs('sample', { agent: { ownerId: 'someone-else', name: 'Mallory' } });
    const closePath = Object.keys(docs).find((p) => p.endsWith('_close'));
    docs[closePath] = voiced(hubSceneInput('sample')).closeRow;
    const { book: v } = await readBookView(makeMandateFakeDb(docs), { uid: SCENE_UID, agentOn: true });
    expect(v.desks.find((d) => d.desk === 'shadow').note.text.startsWith('Your agent’s desk and Trend Follower’s desk agree on ')).toBe(true);
    expect(JSON.stringify(v)).not.toContain('Mallory');
    expect(HUB_AGENT_NAME).toBe('Atlas');
  });
});
