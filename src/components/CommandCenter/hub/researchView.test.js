// src/components/CommandCenter/hub/researchView.test.js
//
// Command Center hub, slice S6 (rulings R-S6-3 … R-S6-7; spec V1.2 §8.1, §11.3 "Research") — what the idea reader's answer
// means for the screen, on the pure derivations. The reader is pinned in useHubResearch.jsdom.test.jsx and the whole hub in
// CommandCenterHub.s6.jsdom.test.jsx.

import { describe, expect, it } from 'vitest';
import { CARRIABLE_STATUSES } from '../../../constants/hypothesisRecords';
import { HORIZON_LABELS, STATUS_LABELS, lifecycleLineFor, researchLinesOf } from '../../Forge/Watchlist/ideaCopy';
import { HUB_COPY as COPY } from './hubCopy';
import {
  HONEST_LINE, RESEARCH_READ, RESEARCH_STATE, VERSION_PAGE_MAX, deployingWithOf, deriveResearch, honestLineKindOf, ideaActivityOf, pointerVersionOf, researchAccessOf,
} from './researchView';
import { IDEA_ACCESS, LOADOUT_STATUS, WATCHLIST_STATE, symbolsOf } from './selectors/loadout';

const T0 = '2026-10-01T14:00:00.000Z';
const T1 = '2026-10-06T15:30:00.000Z';

const V = (n, over = {}) => ({
  version: n, statement: `Idea v${n}: tech beats the market`, status: 'draft', horizonEnum: 'swing', horizonSource: 'player',
  createdAt: T0, stateChangedAt: T1, stateReason: null, ...over,
});
const dataOf = (over = {}) => ({ currentVersion: 1, versionCount: 1, versions: [V(1)], research: [], deployedLists: {}, ...over });
const readOf = (over = {}) => ({
  key: 'u-1:1:wl-1', listId: 'wl-1', status: RESEARCH_READ.READY, data: dataOf(), asOf: 1_000, refreshing: false, retryNotBefore: null, ...over,
});
const card = (over = {}) => ({ id: 'wl-1', name: 'Tech Leaders', state: WATCHLIST_STATE.READY, symbols: ['NVDA', 'AAPL', 'MSFT'], count: 3, idea: 'universe', ...over });
const loadoutOf = (over = {}) => ({ status: LOADOUT_STATUS.READY, watchlist: card(), ...over });
const derive = (over = {}) => deriveResearch({ read: readOf(), loadout: loadoutOf(), listDoc: { watchlistId: 'wl-1', thesis: '' }, ...over });

// A research record as the route summarises it (api/_utils/researchRecords/model.js recordSummaryOf), one per origin.
const SUMMARY = {
  signaldrop: { researchWorkId: 'rw_a', watchlistId: 'wl-1', origin: 'signaldrop', completions: 3, state: 'closed', stages: { shortlisted: 25, eligible: 10 } },
  screener: { researchWorkId: 'rw_b', watchlistId: 'wl-1', origin: 'screener', completions: 2, state: 'closed', stages: { universeSize: 500, matchedPreLimit: 37, shortlisted: 25, eligible: 20 } },
  analysis: { researchWorkId: 'rw_c', watchlistId: 'wl-1', origin: 'analysis', completions: 1, state: 'open', stages: { selectedForInvestigation: 8, investigationsCompleted: 6 } },
  analysis2: { researchWorkId: 'rw_d', watchlistId: 'wl-1', origin: 'analysis', completions: 1, state: 'closed', stages: { selectedForInvestigation: 9, investigationsCompleted: 9 } },
};

describe('the reader\'s admission (ruling R-S6-4)', () => {
  it('a held answer is admitted; the gate off and the typed disabled answer are not admitted; everything else is unknown', () => {
    expect(researchAccessOf(readOf())).toBe(IDEA_ACCESS.ADMITTED);
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.GATE_OFF, data: null }))).toBe(IDEA_ACCESS.NOT_ADMITTED);
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.DISABLED, data: null }))).toBe(IDEA_ACCESS.NOT_ADMITTED);
    for (const status of [RESEARCH_READ.LOADING, RESEARCH_READ.ERROR, RESEARCH_READ.IDLE]) {
      expect(researchAccessOf(readOf({ status, data: null })), status).toBe(IDEA_ACCESS.UNKNOWN);
    }
    expect(researchAccessOf(null)).toBe(IDEA_ACCESS.UNKNOWN);
    expect(researchAccessOf(undefined)).toBe(IDEA_ACCESS.UNKNOWN);
    expect(researchAccessOf('admitted')).toBe(IDEA_ACCESS.UNKNOWN);
  });

  it('the answer HELD is the answer: a refresh in flight or one that failed does not take the admission back, and nothing held is not admitted', () => {
    expect(researchAccessOf(readOf({ refreshing: true }))).toBe(IDEA_ACCESS.ADMITTED);
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.ERROR }))).toBe(IDEA_ACCESS.ADMITTED);
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.LOADING, data: null }))).toBe(IDEA_ACCESS.UNKNOWN);
  });
});

describe('the Research section, one row per state of spec §8.1\'s table', () => {
  it('client gate off · no reader at all → the gate-off state, with its summary', () => {
    expect(derive({ read: readOf({ status: RESEARCH_READ.GATE_OFF, data: null, listId: null }) })).toMatchObject({ status: RESEARCH_STATE.GATE_OFF, summary: COPY.research.summary.gateOff });
    expect(derive({ read: null }).status).toBe(RESEARCH_STATE.GATE_OFF);
  });

  it('typed disabled → "not available on this account": no zero count, no empty-research inference, no idea', () => {
    const section = derive({ read: readOf({ status: RESEARCH_READ.DISABLED, data: null }) });
    expect(section.status).toBe(RESEARCH_STATE.DISABLED);
    expect(section.idea).toBeUndefined();
    expect(JSON.stringify(section)).not.toMatch(/noIdea|No idea|0 ideas/);
  });

  it('loading: the agent unresolved, or the read still out — never an old owner\'s or old list\'s idea', () => {
    expect(derive({ loadout: { status: LOADOUT_STATUS.LOADING } }).status).toBe(RESEARCH_STATE.LOADING);
    expect(derive({ loadout: null }).status).toBe(RESEARCH_STATE.LOADING);
    expect(derive({ read: readOf({ status: RESEARCH_READ.LOADING, data: null }) }).status).toBe(RESEARCH_STATE.LOADING);
    // An answer for another list is not this list's: it reads as loading.
    expect(derive({ read: readOf({ listId: 'wl-OTHER' }) }).status).toBe(RESEARCH_STATE.LOADING);
  });

  it('the agent read failed → the request-error state (its Retry is the agent\'s, wired by the runtime)', () => {
    expect(derive({ loadout: { status: LOADOUT_STATUS.ERROR } }).status).toBe(RESEARCH_STATE.ERROR);
  });

  it('no equipped list → "Equip a watchlist in the Forge to see its idea here"; no agent at all is the same absence', () => {
    expect(derive({ loadout: loadoutOf({ watchlist: card({ state: WATCHLIST_STATE.NONE, id: null }) }), read: readOf({ status: RESEARCH_READ.IDLE, listId: null, data: null }) }).status).toBe(RESEARCH_STATE.NO_LIST);
    expect(derive({ loadout: { status: LOADOUT_STATUS.NONE }, read: readOf({ status: RESEARCH_READ.IDLE, listId: null, data: null }) }).status).toBe(RESEARCH_STATE.NO_LIST);
    expect(COPY.research.noList).toBe('Equip a watchlist in the Forge to see its idea here');
  });

  it('currentVersion 0 → "No idea yet on {list}": a successful no-idea state, whatever versions the response holds', () => {
    const section = derive({ read: readOf({ data: dataOf({ currentVersion: 0, versions: [], versionCount: 0 }) }) });
    expect(section).toMatchObject({ status: RESEARCH_STATE.NO_IDEA, listName: 'Tech Leaders' });
    expect(COPY.research.noIdea('Tech Leaders')).toBe('No idea yet on Tech Leaders');
    // The pointer is the answer, never "the greatest version the hub guesses".
    expect(derive({ read: readOf({ data: dataOf({ currentVersion: 0, versions: [V(3)], versionCount: 1 }) }) }).status).toBe(RESEARCH_STATE.NO_IDEA);
  });

  it('a positive pointer with no matching version → unavailable, and no other version is picked in its place', () => {
    const section = derive({ read: readOf({ data: dataOf({ currentVersion: 5, versions: [V(4), V(3)], versionCount: 2 }) }) });
    expect(section.status).toBe(RESEARCH_STATE.UNAVAILABLE);
    expect(section.idea).toBeUndefined();
    expect(pointerVersionOf(dataOf({ currentVersion: 5, versions: [V(4), V(6)] }))).toBeNull();
  });

  it('a request error with nothing held → "Couldn\'t load your idea · Retry"', () => {
    expect(derive({ read: readOf({ status: RESEARCH_READ.ERROR, data: null }) }).status).toBe(RESEARCH_STATE.ERROR);
    expect(COPY.research.error).toBe("Couldn't load your idea");
  });

  it('a request error over a held answer keeps ONLY that answer (same owner and list), with its age and the wait before a Retry', () => {
    const section = derive({ read: readOf({ status: RESEARCH_READ.ERROR, asOf: 5_000, retryNotBefore: 99_000 }) });
    expect(section).toMatchObject({ status: RESEARCH_STATE.READY, stale: true, asOf: 5_000, retryNotBefore: 99_000 });
    expect(section.idea.statement).toBe(V(1).statement);
    expect(derive().stale).toBeUndefined();
  });
});

describe('a current idea (ruling R-S6-3)', () => {
  it('the exact recorded statement, the Forge\'s status label, the version and the time-frame', () => {
    const statement = '  Semis lead for ten sessions.\nWatch NVDA first.  ';
    const section = derive({ read: readOf({ data: dataOf({ versions: [V(1, { statement, status: 'ready' })] }) }) });
    expect(section.status).toBe(RESEARCH_STATE.READY);
    expect(section.idea).toMatchObject({ version: 1, status: 'ready', statusLabel: 'Ready', statement, timeFrame: 'Swing, 10 trading sessions' });
    expect(section.summary).toBe('Ready');
  });

  it.each(Object.keys(STATUS_LABELS))('%s reads the Forge\'s own word', (status) => {
    const section = derive({ read: readOf({ data: dataOf({ versions: [V(1, { status })] }) }) });
    expect(section.idea.statusLabel).toBe(STATUS_LABELS[status]);
  });

  it('time-frames: the window the Forge states, or "No time-frame"; never invented', () => {
    const frame = (horizonEnum) => derive({ read: readOf({ data: dataOf({ versions: [V(1, { horizonEnum })] }) }) }).idea.timeFrame;
    expect(frame('intraday')).toBe('Intraday, 2 trading sessions');
    expect(frame('longterm')).toBe('Long-term, 60 trading sessions');
    expect(frame('unspecified')).toBe(HORIZON_LABELS.unspecified);
    expect(frame(undefined)).toBeNull();
  });

  it('recorded times are shown as the record holds them (ET dates), and a time the record lacks is not shown', () => {
    const idea = derive().idea;
    expect(idea.savedOn).toBe('Saved Oct 1, 2026');
    expect(idea.statusSince).toBe('Status since Oct 6, 2026');
    const bare = derive({ read: readOf({ data: dataOf({ versions: [V(1, { createdAt: undefined, stateChangedAt: 'not a time' })] }) }) }).idea;
    expect(bare.savedOn).toBeNull();
    expect(bare.statusSince).toBeNull();
  });

  it('four revisions are still ONE idea: the pointer\'s version is shown, "1 idea on {list}", and no other version surfaces', () => {
    const versions = [V(4, { status: 'draft' }), V(3, { status: 'ready' }), V(2, { status: 'retired' }), V(1, { status: 'rejected' })];
    const section = derive({ read: readOf({ data: dataOf({ currentVersion: 2, versions, versionCount: 4 }) }) });
    expect(section.idea.version).toBe(2);
    expect(section.idea.statement).toBe('Idea v2: tech beats the market');
    expect(section.idea.count).toBe('1 idea on Tech Leaders');
    expect(JSON.stringify(section)).not.toMatch(/Idea v[134]|4 ideas|ideas on/);
    // The greatest version is not the current idea.
    expect(pointerVersionOf(dataOf({ currentVersion: 2, versions }))).toBe(versions[2]);
  });

  it('at most two recorded research lines, the list\'s own origin first (researchLinesOf, unmodified)', () => {
    const research = [SUMMARY.analysis, SUMMARY.signaldrop, SUMMARY.screener, SUMMARY.analysis2];
    const section = derive({ read: readOf({ data: dataOf({ research }) }) });
    expect(section.idea.research).toHaveLength(2);
    expect(section.idea.research).toEqual(researchLinesOf(research, { watchlistId: 'wl-1' }));
    expect(section.idea.research[0].line).toBe('Researched with your agent: 25 candidates · 10 kept');
    // Fewer records say fewer lines; none say none (and no "no research recorded" inference).
    expect(derive({ read: readOf({ data: dataOf({ research: [SUMMARY.signaldrop] }) }) }).idea.research).toHaveLength(1);
    expect(derive().idea.research).toEqual([]);
    // A record closed against another list is not this list's line.
    expect(derive({ read: readOf({ data: dataOf({ research: [{ ...SUMMARY.signaldrop, watchlistId: 'wl-9' }] }) }) }).idea.research).toEqual([]);
  });

  it('a version that holds no statement text draws an empty statement, not another version\'s', () => {
    const idea = derive({ read: readOf({ data: dataOf({ versions: [V(1, { statement: undefined })] }) }) }).idea;
    expect(idea.statement).toBe('');
  });

  it('the list\'s name falls back to words, never to a list that is not this one', () => {
    expect(derive({ loadout: loadoutOf({ watchlist: card({ name: null }) }) }).idea.count).toBe(COPY.research.oneIdea(COPY.research.thisList));
  });
});

describe('review due (spec §8.1: the due copy, the frozen list, the Forge, no mutation)', () => {
  const due = V(1, { status: 'review_due', stateReason: 'horizon_elapsed', horizonEnum: 'swing', firstDeployedAt: T0, activation: [], invalidation: [] });

  it('the Forge\'s own review-due line, filled from the frozen list the route returns', () => {
    const frozen = { 1: { battleId: 'b1', name: 'Tech Leaders', tickers: ['NVDA'] } };
    const section = derive({ read: readOf({ data: dataOf({ versions: [due], deployedLists: frozen }) }) });
    expect(section.idea.reviewDue).toBe(lifecycleLineFor(due, frozen[1]));
    expect(section.idea.reviewDue).toBe("Your NVDA idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.");
    expect(section.idea.statusLabel).toBe('Review due');
  });

  it('with several frozen names the line names the frozen LIST; with none known it says nothing (no invented context)', () => {
    const several = { 1: { battleId: 'b1', name: 'Tech Leaders', tickers: ['NVDA', 'AAPL'] } };
    expect(derive({ read: readOf({ data: dataOf({ versions: [due], deployedLists: several }) }) }).idea.reviewDue).toContain('Your Tech Leaders idea reached its time-frame');
    expect(derive({ read: readOf({ data: dataOf({ versions: [due], deployedLists: {} }) }) }).idea.reviewDue).toBeNull();
  });

  it('only a review-due version carries the line, and the section holds no action of its own', () => {
    expect(derive().idea.reviewDue).toBeNull();
    const section = derive({ read: readOf({ data: dataOf({ versions: [due], deployedLists: { 1: { battleId: 'b', name: 'L', tickers: ['X'] } } }) }) });
    expect(Object.keys(section).sort()).toEqual(['idea', 'listName', 'status', 'summary']);
  });

  it('a superseded due version while the CURRENT one is a draft: the panel shows the current one, one idea', () => {
    const versions = [V(2, { status: 'draft' }), due];
    const section = derive({ read: readOf({ data: dataOf({ currentVersion: 2, versions, versionCount: 2 }) }) });
    expect(section.idea).toMatchObject({ version: 2, status: 'draft', reviewDue: null });
  });
});

describe('the honest line (ruling R-S6-6): one wording per case, chosen from what reaches the agent', () => {
  const statement = 'Semis lead for ten sessions.';
  it('(c) no thesis on the list: blank, absent, whitespace or not text', () => {
    for (const thesis of ['', '   ', undefined, null, 7, {}]) expect(honestLineKindOf({ thesis, statement }), String(thesis)).toBe(HONEST_LINE.NO_THESIS);
  });

  it('(a) the thesis IS the idea\'s current statement (trimmed, exact)', () => {
    expect(honestLineKindOf({ thesis: statement, statement })).toBe(HONEST_LINE.THESIS_IS_IDEA);
    expect(honestLineKindOf({ thesis: `  ${statement}\n`, statement: statement })).toBe(HONEST_LINE.THESIS_IS_IDEA);
  });

  it('(b) any other thesis: the one the list was saved with, a revision\'s statement, or one longer than the statement cap', () => {
    expect(honestLineKindOf({ thesis: 'Old thesis text', statement })).toBe(HONEST_LINE.THESIS_SAVED);
    expect(honestLineKindOf({ thesis: statement.toLowerCase(), statement })).toBe(HONEST_LINE.THESIS_SAVED);
    expect(honestLineKindOf({ thesis: `${statement} And a long tail.`, statement })).toBe(HONEST_LINE.THESIS_SAVED);
  });

  it('on the section: each case lands on the list\'s own wording, and the three wordings are the founder\'s', () => {
    const ideaRead = readOf({ data: dataOf({ versions: [V(1, { statement })] }) });
    const kindFor = (thesis) => derive({ read: ideaRead, listDoc: { watchlistId: 'wl-1', thesis } }).idea.honest;
    expect(kindFor('')).toBe(HONEST_LINE.NO_THESIS);
    expect(kindFor(statement)).toBe(HONEST_LINE.THESIS_IS_IDEA);
    expect(kindFor('The list was saved with this.')).toBe(HONEST_LINE.THESIS_SAVED);
    expect(COPY.research.honest.thesisIsIdea).toBe("Your agent gives this list's names priority and reads the idea as the list's thesis. It doesn't learn from your ideas or their reviews yet.");
    expect(COPY.research.honest.thesisSaved).toBe("Your agent gives this list's names priority and reads the thesis the list was saved with, not later versions of your idea. It doesn't learn from your ideas or their reviews yet.");
    expect(COPY.research.honest.noThesis).toBe("Your agent gives this list's names priority. It doesn't read or learn from your ideas yet.");
  });

  it('a later version of the idea turns (a) into (b): the thesis does not follow the idea', () => {
    const asV1 = derive({ read: readOf({ data: dataOf({ currentVersion: 1, versions: [V(1, { statement })] }) }), listDoc: { thesis: statement } }).idea.honest;
    const asV2 = derive({ read: readOf({ data: dataOf({ currentVersion: 2, versions: [V(2, { statement: 'A revised idea.' }), V(1, { statement })] }) }), listDoc: { thesis: statement } }).idea.honest;
    expect(asV1).toBe(HONEST_LINE.THESIS_IS_IDEA);
    expect(asV2).toBe(HONEST_LINE.THESIS_SAVED);
  });

  it('said only about a list the agent can deploy with: not while the card is unavailable, loading, errored or empty, nor without the list\'s document', () => {
    for (const watchlist of [
      card({ state: WATCHLIST_STATE.UNAVAILABLE }), card({ state: WATCHLIST_STATE.LOADING }), card({ state: WATCHLIST_STATE.ERROR }),
      card({ count: 0, symbols: [] }),
    ]) {
      expect(derive({ loadout: loadoutOf({ watchlist }) }).idea.honest, watchlist.state + watchlist.count).toBeNull();
    }
    expect(derive({ listDoc: null }).idea.honest).toBeNull();
    expect(derive({ listDoc: undefined }).idea.honest).toBeNull();
    expect(derive().idea.honest).toBe(HONEST_LINE.NO_THESIS);
  });
});

describe('"Deploying with" (ruling R-S6-5): the carriage rule\'s common case, and nothing it has to guess', () => {
  const rd = (versions, over = {}) => readOf({ data: dataOf({ versions, versionCount: versions.length, currentVersion: versions[0]?.version ?? 0 }), ...over });
  const line = (versions, over = {}, watchlist = card()) => deployingWithOf({ read: rd(versions, over), watchlist });

  it('the newest version ready or activated, no version review due: the newest\'s statement and the card\'s own count', () => {
    for (const status of CARRIABLE_STATUSES) {
      expect(line([V(2, { status }), V(1, { status: 'retired' })]), status).toEqual({ statement: 'Idea v2: tech beats the market', count: 3, version: 2 });
    }
  });

  it.each(['draft', 'researched', 'waiting_for_evidence', 'invalidated', 'review_due', 'retired', 'rejected', 'cancelled'])('the newest version %s → no line', (status) => {
    expect(line([V(2, { status }), V(1, { status: 'ready' })])).toBeNull();
  });

  it('a review-due version anywhere → no line, even under a newer ready one (the hub shows the common case only)', () => {
    expect(line([V(3, { status: 'ready' }), V(2, { status: 'review_due' }), V(1, { status: 'retired' })])).toBeNull();
    expect(line([V(3, { status: 'activated' }), V(2, { status: 'retired' })])).not.toBeNull();
  });

  it('the statement is the NEWEST version\'s — the one carriage picks — not the pointer\'s', () => {
    const versions = [V(3, { status: 'ready', statement: 'The newest.' }), V(2, { status: 'activated', statement: 'The pointer.' })];
    const read = readOf({ data: dataOf({ currentVersion: 2, versions, versionCount: 2 }) });
    expect(deployingWithOf({ read, watchlist: card() }).statement).toBe('The newest.');
    // ...and the panel's current idea is the pointer's: two different questions with two different answers.
    expect(deriveResearch({ read, loadout: loadoutOf(), listDoc: null }).idea.statement).toBe('The pointer.');
  });

  it('the count is the Loadout card\'s own (symbolsOf: each name once, objects by symbol or ticker)', () => {
    const doc = { tickers: ['NVDA', 'NVDA', { symbol: 'AAPL' }, { ticker: 'MSFT' }, '', { nothing: 1 }] };
    const symbols = symbolsOf(doc);
    expect(symbols).toEqual(['NVDA', 'AAPL', 'MSFT']);
    expect(line([V(1, { status: 'ready' })], {}, card({ symbols, count: symbols.length })).count).toBe(symbols.length);
    expect(COPY.deploy.deployingWith('S', COPY.loadout.names(3))).toBe('Deploying with: S · 3 names');
    expect(COPY.deploy.deployingWith('S', COPY.loadout.names(1))).toBe('Deploying with: S · 1 name');
  });

  it('not admitted, or nothing current held → no line: disabled, gate off, idle, loading, error with nothing, and a refresh that failed', () => {
    const v = [V(1, { status: 'ready' })];
    for (const status of [RESEARCH_READ.DISABLED, RESEARCH_READ.GATE_OFF, RESEARCH_READ.IDLE, RESEARCH_READ.LOADING, RESEARCH_READ.ERROR]) {
      expect(deployingWithOf({ read: readOf({ status, data: null }), watchlist: card() }), status).toBeNull();
    }
    expect(line(v, { status: RESEARCH_READ.ERROR }), 'a stale answer is not asserted').toBeNull();
    expect(line(v, { status: RESEARCH_READ.READY, refreshing: true })).not.toBeNull();
    expect(deployingWithOf({ read: null, watchlist: card() })).toBeNull();
  });

  it('the Loadout card must be ready for THIS list with at least one name', () => {
    const v = [V(1, { status: 'ready' })];
    for (const watchlist of [
      card({ state: WATCHLIST_STATE.LOADING }), card({ state: WATCHLIST_STATE.UNAVAILABLE }), card({ state: WATCHLIST_STATE.ERROR }),
      card({ state: WATCHLIST_STATE.NONE }), card({ id: 'wl-other' }), card({ count: 0, symbols: [] }), null,
    ]) {
      expect(deployingWithOf({ read: rd(v), watchlist }), JSON.stringify(watchlist)).toBeNull();
    }
  });

  it('a whole response only: a page at the route\'s limit may have left a due version out', () => {
    const v = [V(2, { status: 'ready' })];
    expect(VERSION_PAGE_MAX).toBe(100);
    expect(deployingWithOf({ read: readOf({ data: dataOf({ versions: v, versionCount: 99, currentVersion: 2 }) }), watchlist: card() })).not.toBeNull();
    expect(deployingWithOf({ read: readOf({ data: dataOf({ versions: v, versionCount: 100, currentVersion: 2 }) }), watchlist: card() })).toBeNull();
  });

  it('a statement that is blank or missing → no line (nothing is invented)', () => {
    expect(line([V(1, { status: 'ready', statement: '   ' })])).toBeNull();
    expect(line([V(1, { status: 'ready', statement: undefined })])).toBeNull();
  });

  it('no versions at all → no line', () => {
    expect(line([])).toBeNull();
  });
});

describe('Activity\'s descriptor (ruling R-S6-7): the current idea only', () => {
  it('the pointer\'s version, with the times the record holds and its status word', () => {
    const versions = [V(4), V(3), V(2, { status: 'ready', createdAt: T0, stateChangedAt: T1 }), V(1)];
    const idea = ideaActivityOf({ read: readOf({ data: dataOf({ currentVersion: 2, versions, versionCount: 4 }) }), watchlist: card() });
    expect(idea).toEqual({ listId: 'wl-1', listName: 'Tech Leaders', version: 2, status: 'ready', statusLabel: 'Ready', createdAt: T0, stateChangedAt: T1 });
  });

  it('none without an idea held, a current idea, a matching version, or a ready card for this list', () => {
    expect(ideaActivityOf({ read: null, watchlist: card() })).toBeNull();
    expect(ideaActivityOf({ read: readOf({ data: null, status: RESEARCH_READ.LOADING }), watchlist: card() })).toBeNull();
    expect(ideaActivityOf({ read: readOf({ data: dataOf({ currentVersion: 0, versions: [], versionCount: 0 }) }), watchlist: card() })).toBeNull();
    expect(ideaActivityOf({ read: readOf({ data: dataOf({ currentVersion: 9 }) }), watchlist: card() })).toBeNull();
    expect(ideaActivityOf({ read: readOf(), watchlist: card({ state: WATCHLIST_STATE.UNAVAILABLE }) })).toBeNull();
    expect(ideaActivityOf({ read: readOf(), watchlist: card({ id: 'wl-other' }) })).toBeNull();
    expect(ideaActivityOf({ read: readOf(), watchlist: null })).toBeNull();
  });
});
