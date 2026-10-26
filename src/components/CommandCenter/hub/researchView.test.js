// src/components/CommandCenter/hub/researchView.test.js
//
// Command Center hub, slice S6 (rulings R-S6-3 … R-S6-7; spec V1.2 §8.1, §11.3 "Research") — what the idea reader's answer
// means for the screen, on the pure derivations. The reader is pinned in useHubResearch.jsdom.test.jsx and the whole hub in
// CommandCenterHub.s6.jsdom.test.jsx.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARRIABLE_STATUSES, dueDeployPending } from '../../../constants/hypothesisRecords';
import { HORIZON_LABELS, STATUS_LABELS, lifecycleLineFor, researchLinesOf } from '../../Forge/Watchlist/ideaCopy';
import { HUB_COPY as COPY } from './hubCopy';
import {
  HONEST_LINE, PROMPT_THESIS_CAP, RESEARCH_READ, RESEARCH_STATE, VERSION_PAGE_MAX, deployingWithOf, deriveResearch, honestLineKindOf, ideaActivityOf, ideaPointerOf, pointerVersionOf, researchAccessOf,
} from './researchView';
import { IDEA_ACCESS, IDEA_LABEL, LISTS_STATUS, LOADOUT_STATUS, WATCHLIST_STATE, deriveWatchlist, symbolsOf } from './selectors/loadout';

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
// The list document as the lists route returns it: tickers are objects (the server's filter reads `symbol`), thesis is the list's own.
const LISTDOC = (over = {}) => ({ watchlistId: 'wl-1', thesis: '', tickers: [{ symbol: 'NVDA' }, { symbol: 'AAPL' }, { symbol: 'MSFT' }], ...over });
const derive = (over = {}) => deriveResearch({ read: readOf(), loadout: loadoutOf(), listDoc: LISTDOC(), ...over });
const NOW_MS = Date.parse('2026-10-25T15:00:00.000Z');

// A research record as the route summarises it (api/_utils/researchRecords/model.js recordSummaryOf), one per origin.
const SUMMARY = {
  signaldrop: { researchWorkId: 'rw_a', watchlistId: 'wl-1', origin: 'signaldrop', completions: 3, state: 'closed', stages: { shortlisted: 25, eligible: 10 } },
  screener: { researchWorkId: 'rw_b', watchlistId: 'wl-1', origin: 'screener', completions: 2, state: 'closed', stages: { universeSize: 500, matchedPreLimit: 37, shortlisted: 25, eligible: 20 } },
  analysis: { researchWorkId: 'rw_c', watchlistId: 'wl-1', origin: 'analysis', completions: 1, state: 'open', stages: { selectedForInvestigation: 8, investigationsCompleted: 6 } },
  analysis2: { researchWorkId: 'rw_d', watchlistId: 'wl-1', origin: 'analysis', completions: 1, state: 'closed', stages: { selectedForInvestigation: 9, investigationsCompleted: 9 } },
};

describe('the reader\'s admission (rulings R-S6-4, Q-S6-4, Q-S6-8: admission belongs to the account)', () => {
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

  it('with nothing remembered, loading or error → unknown (R-S6-4): a refresh in flight keeps the admission (the status stays ready), a refresh that FAILED has only what the account remembers', () => {
    expect(researchAccessOf(readOf({ refreshing: true }))).toBe(IDEA_ACCESS.ADMITTED);
    // Over an answer held from before but nothing remembered: the label goes neutral, which claims nothing.
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.ERROR }))).toBe(IDEA_ACCESS.UNKNOWN);
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.LOADING, data: null }))).toBe(IDEA_ACCESS.UNKNOWN);
    // A status other than ready with data riding along (a half-built read) is not an answer.
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.LOADING }))).toBe(IDEA_ACCESS.UNKNOWN);
    // ...and a `ready` status with nothing held is not an answer either.
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.READY, data: null }))).toBe(IDEA_ACCESS.UNKNOWN);
    for (const lastAnswer of [undefined, null, '', 'admitted', 'not_admitted', RESEARCH_READ.ERROR, RESEARCH_READ.LOADING, RESEARCH_READ.IDLE, true]) {
      expect(researchAccessOf(readOf({ status: RESEARCH_READ.LOADING, data: null, lastAnswer })), String(lastAnswer)).toBe(IDEA_ACCESS.UNKNOWN);
    }
  });

  it('a remembered success keeps the account admitted across a list change (loading), a failed refresh (error, with or without the old data) and a read that is idle again (Q-S6-4, Q-S6-8)', () => {
    const lastAnswer = RESEARCH_READ.READY;
    for (const over of [
      { status: RESEARCH_READ.LOADING, data: null }, { status: RESEARCH_READ.ERROR, data: null }, { status: RESEARCH_READ.ERROR },
      { status: RESEARCH_READ.IDLE, data: null, listId: null }, { status: RESEARCH_READ.READY, data: null },
    ]) {
      expect(researchAccessOf(readOf({ ...over, lastAnswer })), over.status).toBe(IDEA_ACCESS.ADMITTED);
    }
  });

  it('a remembered typed disabled keeps the account not admitted while the next list loads or fails (Q-S6-4)', () => {
    const lastAnswer = RESEARCH_READ.DISABLED;
    for (const status of [RESEARCH_READ.LOADING, RESEARCH_READ.ERROR, RESEARCH_READ.IDLE]) {
      expect(researchAccessOf(readOf({ status, data: null, lastAnswer })), status).toBe(IDEA_ACCESS.NOT_ADMITTED);
    }
  });

  it('the answer in hand outranks the memory: a typed disabled replaces a remembered success, and a held success a remembered disabled (Q-S6-4)', () => {
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.DISABLED, data: null, lastAnswer: RESEARCH_READ.READY }))).toBe(IDEA_ACCESS.NOT_ADMITTED);
    expect(researchAccessOf(readOf({ lastAnswer: RESEARCH_READ.DISABLED }))).toBe(IDEA_ACCESS.ADMITTED);
    // The client gate off is not the account's answer: nothing remembered can admit past it.
    expect(researchAccessOf(readOf({ status: RESEARCH_READ.GATE_OFF, data: null, lastAnswer: RESEARCH_READ.READY }))).toBe(IDEA_ACCESS.NOT_ADMITTED);
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
    // The card's absence is what says it, not the reader's list id alone.
    expect(derive({ loadout: loadoutOf({ watchlist: card({ state: WATCHLIST_STATE.NONE, id: null }) }) }).status).toBe(RESEARCH_STATE.NO_LIST);
  });

  it('a ready card with an idle reader (no list id to ask about) is "no list", not a wait for an answer that cannot come', () => {
    expect(derive({ read: readOf({ status: RESEARCH_READ.IDLE, listId: null, data: null }) }).status).toBe(RESEARCH_STATE.NO_LIST);
    expect(derive({ read: readOf({ listId: null }) }).status).toBe(RESEARCH_STATE.NO_LIST);
  });

  it('each settled state carries its own one-line summary for the stage (and only a loading one has none)', () => {
    const S = COPY.research.summary;
    const pick = (over) => derive(over).summary;
    expect(pick({ read: readOf({ status: RESEARCH_READ.GATE_OFF, data: null, listId: null }) })).toBe(S.gateOff);
    expect(pick({ read: readOf({ status: RESEARCH_READ.DISABLED, data: null }) })).toBe(S.disabled);
    expect(pick({ loadout: loadoutOf({ watchlist: card({ state: WATCHLIST_STATE.NONE, id: null }) }) })).toBe(S.noList);
    expect(pick({ read: readOf({ data: dataOf({ currentVersion: 0, versions: [], versionCount: 0 }) }) })).toBe(S.noIdea);
    expect(pick({ read: readOf({ data: dataOf({ currentVersion: 5, versions: [V(4)], versionCount: 1 }) }) })).toBe(S.pointerUnavailable);
    expect(pick({ read: readOf({ status: RESEARCH_READ.ERROR, data: null }) })).toBe(S.error);
    expect(pick({ loadout: { status: LOADOUT_STATUS.ERROR } })).toBe(S.error);
    expect(pick({ read: readOf({ data: dataOf({ versions: [V(1, { status: 'ready' })] }) }) })).toBe('Ready');
    expect(pick({ loadout: { status: LOADOUT_STATUS.LOADING } })).toBeUndefined();
    expect(new Set(Object.values(S)).size, 'no two states share a summary word').toBe(Object.keys(S).length);
  });

  it('a status the Forge has no word for is never shown as a raw token: no chip, and the unavailable summary stands in for the word', () => {
    const section = derive({ read: readOf({ data: dataOf({ versions: [V(1, { status: 'archived_by_robots' })] }) }) });
    expect(section.idea.statusLabel).toBeNull();
    expect(section.summary).toBe(COPY.research.summary.pointerUnavailable);
    expect(JSON.stringify(section)).not.toContain('archived_by_robots"statusLabel');
    const idea = ideaActivityOf({ read: readOf({ data: dataOf({ versions: [V(1, { status: 'archived_by_robots' })] }) }), watchlist: card() });
    expect(idea.statusLabel).toBeNull();
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
    // A zero pointer is no pointer: not even a (malformed) version numbered 0 is its match.
    expect(pointerVersionOf(dataOf({ currentVersion: 0, versions: [V(0), V(1)] }))).toBeNull();
    expect(pointerVersionOf(null)).toBeNull();
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
    // ...not the newest version's, when the pointer names an older one.
    const older = derive({ read: readOf({ data: dataOf({ currentVersion: 1, versions: [V(2, { statement: 'The newest.' }), V(1, { statement: undefined })], versionCount: 2 }) }) }).idea;
    expect(older.version).toBe(1);
    expect(older.statement).toBe('');
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

describe('the honest line (rulings R-S6-6, Q-S6-1): one wording per case, chosen from what reaches the agent', () => {
  const statement = 'Semis lead for ten sessions.';
  it('(c) no thesis on the list: blank, absent, whitespace or not text', () => {
    for (const thesis of ['', '   ', undefined, null, 7, {}]) expect(honestLineKindOf({ thesis, statement }), String(thesis)).toBe(HONEST_LINE.NO_THESIS);
  });

  it('(a) the thesis IS the idea\'s current statement (trimmed, exact)', () => {
    expect(honestLineKindOf({ thesis: statement, statement })).toBe(HONEST_LINE.THESIS_IS_IDEA);
    expect(honestLineKindOf({ thesis: `  ${statement}\n`, statement: statement })).toBe(HONEST_LINE.THESIS_IS_IDEA);
  });

  it('(a) compares what the PROMPT carries (whitespace collapsed), so the same words over two lines are still the idea', () => {
    expect(honestLineKindOf({ thesis: 'Semis lead\nfor ten   sessions.', statement: 'Semis lead for ten sessions.' })).toBe(HONEST_LINE.THESIS_IS_IDEA);
    // ...and the other way round: the statement is the one set over several lines.
    expect(honestLineKindOf({ thesis: 'Semis lead for ten sessions.', statement: ' Semis lead\nfor ten   sessions. ' })).toBe(HONEST_LINE.THESIS_IS_IDEA);
  });

  it('(d) the prompt keeps only the first PROMPT_THESIS_CAP characters of the thesis, so a longer thesis is the fourth wording — even when it equals the idea (Q-S6-1)', () => {
    const long = `${'Semis lead for ten sessions. '.repeat(10)}Watch NVDA first.`.trim();
    expect(long.length).toBeGreaterThan(PROMPT_THESIS_CAP);
    expect(honestLineKindOf({ thesis: long, statement: long })).toBe(HONEST_LINE.THESIS_CUT);
    expect(honestLineKindOf({ thesis: long, statement: 'Something else entirely.' })).toBe(HONEST_LINE.THESIS_CUT);
    const exactly = 'x'.repeat(PROMPT_THESIS_CAP);
    expect(honestLineKindOf({ thesis: exactly, statement: exactly }), 'exactly at the cap fits').toBe(HONEST_LINE.THESIS_IS_IDEA);
    expect(honestLineKindOf({ thesis: `${exactly}y`, statement: `${exactly}y` }), 'one over').toBe(HONEST_LINE.THESIS_CUT);
    expect(honestLineKindOf({ thesis: `${exactly}y`, statement: exactly }), 'one over, not the idea').toBe(HONEST_LINE.THESIS_CUT);
    // what the cut takes decides, not the idea: the first 200 are the idea, the rest is more text
    expect(honestLineKindOf({ thesis: `${exactly} and then more`, statement: exactly })).toBe(HONEST_LINE.THESIS_CUT);
  });

  it('(d) is about text lost to the cut, not length: blanks after the cap lose nothing, and the cap counts raw characters before whitespace is collapsed', () => {
    const exactly = 'x'.repeat(PROMPT_THESIS_CAP);
    expect(honestLineKindOf({ thesis: `${exactly}   \n `, statement: exactly })).toBe(HONEST_LINE.THESIS_IS_IDEA);
    expect(honestLineKindOf({ thesis: `${exactly}   \n y`, statement: exactly })).toBe(HONEST_LINE.THESIS_CUT);
    // sanitizeRuleText slices the RAW text first: 199 letters and a blank fit, but a letter after a run of blanks past the cap is cut
    const spaced = `${'x'.repeat(PROMPT_THESIS_CAP - 1)}${' '.repeat(5)}z`;
    expect(spaced.length).toBeGreaterThan(PROMPT_THESIS_CAP);
    expect(honestLineKindOf({ thesis: spaced, statement: 'x'.repeat(PROMPT_THESIS_CAP - 1) })).toBe(HONEST_LINE.THESIS_CUT);
    // a short thesis padded with leading blanks past the cap loses its start of text: cut
    expect(honestLineKindOf({ thesis: `${' '.repeat(PROMPT_THESIS_CAP)}Semis lead.`, statement: 'Semis lead.' })).toBe(HONEST_LINE.THESIS_CUT);
  });

  it('no thesis is never (d), and (d) never reaches a list with no thesis: blank text past the cap is still no thesis', () => {
    expect(honestLineKindOf({ thesis: ' '.repeat(PROMPT_THESIS_CAP + 50), statement })).toBe(HONEST_LINE.NO_THESIS);
  });

  it('the cap is the prompt\'s: api/_utils/agentPromptAssembly.js sanitizeRuleText slices the first 200 characters (source tripwire; the file is read, not imported)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(path.resolve(here, '../../../../api/_utils/agentPromptAssembly.js'), 'utf8');
    const body = source.slice(source.indexOf('export function sanitizeRuleText'));
    expect(body.slice(0, 400)).toContain(`text.slice(0, ${PROMPT_THESIS_CAP})`);
    expect(PROMPT_THESIS_CAP).toBe(200);
  });

  it('(b) any other thesis that fits: the one the list was saved with, a revision\'s statement, or a longer text that still fits', () => {
    expect(honestLineKindOf({ thesis: 'Old thesis text', statement })).toBe(HONEST_LINE.THESIS_SAVED);
    expect(honestLineKindOf({ thesis: statement.toLowerCase(), statement })).toBe(HONEST_LINE.THESIS_SAVED);
    expect(honestLineKindOf({ thesis: `${statement} And a long tail.`, statement })).toBe(HONEST_LINE.THESIS_SAVED);
    // fits exactly at the cap but is not the idea: still (b), not (d)
    expect(honestLineKindOf({ thesis: 'y'.repeat(PROMPT_THESIS_CAP), statement })).toBe(HONEST_LINE.THESIS_SAVED);
  });

  it('the line is judged against the POINTER\'s statement, never the newest version\'s', () => {
    const versions = [V(2, { statement: 'A newer, different idea.' }), V(1, { statement })];
    const read = readOf({ data: dataOf({ currentVersion: 1, versions, versionCount: 2 }) });
    expect(derive({ read, listDoc: LISTDOC({ thesis: statement }) }).idea.honest).toBe(HONEST_LINE.THESIS_IS_IDEA);
    expect(derive({ read, listDoc: LISTDOC({ thesis: 'A newer, different idea.' }) }).idea.honest).toBe(HONEST_LINE.THESIS_SAVED);
  });

  it('a version with no statement text, against a list that has a thesis, is (b) — and nothing throws', () => {
    expect(honestLineKindOf({ thesis: 'Old thesis', statement: undefined })).toBe(HONEST_LINE.THESIS_SAVED);
    expect(honestLineKindOf({ thesis: 'Old thesis', statement: null })).toBe(HONEST_LINE.THESIS_SAVED);
    const read = readOf({ data: dataOf({ versions: [V(1, { statement: undefined })] }) });
    expect(derive({ read, listDoc: LISTDOC({ thesis: 'Old thesis' }) }).idea.honest).toBe(HONEST_LINE.THESIS_SAVED);
  });

  it('on the section: each case lands on the list\'s own wording, and the four wordings are the founder\'s', () => {
    const ideaRead = readOf({ data: dataOf({ versions: [V(1, { statement })] }) });
    const kindFor = (thesis) => derive({ read: ideaRead, listDoc: LISTDOC({ thesis }) }).idea.honest;
    expect(kindFor('')).toBe(HONEST_LINE.NO_THESIS);
    expect(kindFor(statement)).toBe(HONEST_LINE.THESIS_IS_IDEA);
    expect(kindFor('The list was saved with this.')).toBe(HONEST_LINE.THESIS_SAVED);
    expect(kindFor(`${statement} ${'More and more of the same idea. '.repeat(8)}`)).toBe(HONEST_LINE.THESIS_CUT);
    expect(COPY.research.honest.thesisCut).toBe("Your agent gives this list's names priority and reads only the start of the thesis the list was saved with, not later versions of your idea. It doesn't learn from your ideas or their reviews yet.");
    expect(Object.keys(COPY.research.honest).sort()).toEqual(['noThesis', 'thesisCut', 'thesisIsIdea', 'thesisSaved']);
    expect(Object.values(HONEST_LINE).sort()).toEqual(['no_thesis', 'thesis_cut', 'thesis_is_idea', 'thesis_saved']);
    expect(COPY.research.honest.thesisIsIdea).toBe("Your agent gives this list's names priority and reads the idea as the list's thesis. It doesn't learn from your ideas or their reviews yet.");
    expect(COPY.research.honest.thesisSaved).toBe("Your agent gives this list's names priority and reads the thesis the list was saved with, not later versions of your idea. It doesn't learn from your ideas or their reviews yet.");
    expect(COPY.research.honest.noThesis).toBe("Your agent gives this list's names priority. It doesn't read or learn from your ideas yet.");
  });

  it('a later version of the idea turns (a) into (b): the thesis does not follow the idea', () => {
    const asV1 = derive({ read: readOf({ data: dataOf({ currentVersion: 1, versions: [V(1, { statement })] }) }), listDoc: LISTDOC({ thesis: statement }) }).idea.honest;
    const asV2 = derive({ read: readOf({ data: dataOf({ currentVersion: 2, versions: [V(2, { statement: 'A revised idea.' }), V(1, { statement })] }) }), listDoc: LISTDOC({ thesis: statement }) }).idea.honest;
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
    // ...and only when the deploy keeps one of its names: the server's filter drops these, and the prompt then carries no list.
    for (const tickers of [[], [{ symbol: '^GSPC' }], [{ symbol: 'BRK/B' }, { symbol: ' ' }], ['NVDA'], [{ ticker: 'NVDA' }], undefined]) {
      expect(derive({ listDoc: LISTDOC({ tickers }) }).idea.honest, JSON.stringify(tickers)).toBeNull();
    }
    expect(derive({ listDoc: LISTDOC({ tickers: [{ symbol: '^GSPC' }, { symbol: ' brk.b ' }] }) }).idea.honest).toBe(HONEST_LINE.NO_THESIS);
  });
});

describe('"Deploying with" (ruling R-S6-5): the carriage rule\'s common case, and nothing it has to guess', () => {
  const rd = (versions, over = {}) => readOf({ data: dataOf({ versions, versionCount: versions.length, currentVersion: versions[0]?.version ?? 0 }), ...over });
  const dw = (args) => deployingWithOf({ listDoc: LISTDOC(), nowMs: NOW_MS, watchlist: card(), ...args });
  const line = (versions, over = {}, watchlist = card()) => dw({ read: rd(versions, over), watchlist });

  it('the newest version ready or activated: the newest\'s statement and the card\'s own count', () => {
    for (const status of CARRIABLE_STATUSES) {
      expect(line([V(2, { status }), V(1, { status: 'retired' })]), status).toEqual({ statement: 'Idea v2: tech beats the market', count: 3, version: 2 });
    }
  });

  it.each(['draft', 'researched', 'waiting_for_evidence', 'invalidated', 'review_due', 'retired', 'rejected', 'cancelled'])('the newest version %s → no line', (status) => {
    expect(line([V(2, { status }), V(1, { status: 'ready' })])).toBeNull();
  });

  it('the carriage rule (Q-S6-2): an older due version under a NEWER ready or activated one — a reaffirmed idea — shows the newest\'s line, as the server carries it', () => {
    const due = { status: 'review_due', firstDeployedAt: T0, stateReason: 'horizon_elapsed' };
    expect(line([V(2, { status: 'ready' }), V(1, due)])).toEqual({ statement: 'Idea v2: tech beats the market', count: 3, version: 2 });
    expect(line([V(3, { status: 'activated' }), V(2, due), V(1, { status: 'retired' })])).toMatchObject({ version: 3 });
    // a retired or rejected version does not hide the line either
    expect(line([V(2, { status: 'ready' }), V(1, { status: 'retired' })])).not.toBeNull();
    expect(line([V(3, { status: 'activated' }), V(2, { status: 'rejected' }), V(1, { status: 'cancelled' })])).not.toBeNull();
  });

  it('the deploy station\'s predicate, to the letter: the newest DEPLOYED version due with nothing carriable above it → no line', () => {
    const due = { status: 'review_due', firstDeployedAt: T0, stateReason: 'horizon_elapsed' };
    // a due newest-deployed version with a ready version BELOW it (an older one never rides over a due newer one)
    expect(line([V(3, due), V(2, { status: 'ready' })])).toBeNull();
    // a due version with nothing above it, and a draft above it (a draft cannot ride)
    expect(line([V(2, { status: 'draft' }), V(1, due)])).toBeNull();
    // a due version that was never deployed has no deploy to be due for: the predicate ignores it
    expect(line([V(2, { status: 'ready' }), V(1, { status: 'review_due' })])).not.toBeNull();
  });

  it('it IS dueDeployPending: the line is hidden exactly when the shared predicate names a version (swapped fixtures, one rule)', () => {
    const due = { status: 'review_due', firstDeployedAt: T0 };
    const cases = [
      [V(2, { status: 'ready' }), V(1, due)],
      [V(3, { status: 'activated' }), V(2, due)],
      [V(3, due), V(2, { status: 'ready' })],
      [V(2, { status: 'draft' }), V(1, due)],
      [V(1, due)],
      [V(1, { status: 'ready' })],
    ];
    for (const versions of cases) {
      const pending = dueDeployPending(versions) !== null;
      const newestCarriable = CARRIABLE_STATUSES.includes(versions[0].status);
      // when the predicate names a due version the line is hidden; when it does not, the line shows exactly if the newest version can ride
      expect(line(versions) === null, JSON.stringify(versions.map((v) => `${v.version}:${v.status}`))).toBe(pending || !newestCarriable);
    }
  });

  it('the statement is the NEWEST version\'s — the one carriage picks — not the pointer\'s', () => {
    const versions = [V(3, { status: 'ready', statement: 'The newest.' }), V(2, { status: 'activated', statement: 'The pointer.' })];
    const read = readOf({ data: dataOf({ currentVersion: 2, versions, versionCount: 2 }) });
    expect(dw({ read }).statement).toBe('The newest.');
    // ...and the panel\'s current idea is the pointer\'s: two different questions with two different answers.
    expect(deriveResearch({ read, loadout: loadoutOf(), listDoc: null }).idea.statement).toBe('The pointer.');
  });

  it('the count is the Loadout card\'s own (symbolsOf: each name once, objects by symbol or ticker)', () => {
    const doc = { tickers: [{ symbol: 'NVDA' }, { symbol: 'NVDA' }, { symbol: 'AAPL' }, { ticker: 'MSFT' }, '', { nothing: 1 }] };
    const symbols = symbolsOf(doc);
    expect(symbols).toEqual(['NVDA', 'AAPL', 'MSFT']);
    expect(line([V(1, { status: 'ready' })], {}, card({ symbols, count: symbols.length })).count).toBe(symbols.length);
    expect(COPY.deploy.deployingWith('S', COPY.loadout.names(3))).toBe('Deploying with: S · 3 names');
    expect(COPY.deploy.deployingWith('S', COPY.loadout.names(1))).toBe('Deploying with: S · 1 name');
  });

  it('the deploy must keep at least one of the list\'s names (the server\'s filter), or the agent is handed no list: no line', () => {
    const v = [V(1, { status: 'ready' })];
    for (const tickers of [[], [{ symbol: '^GSPC' }, { symbol: 'BRK/B' }], ['NVDA', 'AAPL'], undefined]) {
      expect(dw({ read: rd(v), listDoc: LISTDOC({ tickers }) }), JSON.stringify(tickers)).toBeNull();
    }
    expect(dw({ read: rd(v), listDoc: null })).toBeNull();
    // One surviving name is enough; the count shown is still the card\'s.
    expect(dw({ read: rd(v), listDoc: LISTDOC({ tickers: [{ symbol: '^GSPC' }, { symbol: 'brk.b' }] }) }).count).toBe(3);
  });

  it('an `activated` newest version whose recorded review time has passed is not shown: the deploy judges it due and carries nothing', () => {
    const past = new Date(NOW_MS - 60_000).toISOString();
    const future = new Date(NOW_MS + 3_600_000).toISOString();
    expect(line([V(1, { status: 'activated', reviewDueAt: past })])).toBeNull();
    expect(line([V(1, { status: 'activated', reviewDueAt: new Date(NOW_MS).toISOString() })]), 'due at this very instant').toBeNull();
    expect(line([V(1, { status: 'activated', reviewDueAt: future })])).not.toBeNull();
    // A battle-end review has no recorded time (the hub cannot know it): shown; and a ready version has no clock yet.
    expect(line([V(1, { status: 'activated', reviewDueAt: null })])).not.toBeNull();
    expect(line([V(1, { status: 'activated' })])).not.toBeNull();
    expect(line([V(1, { status: 'ready', reviewDueAt: past })])).not.toBeNull();
    // Without a clock handed in nothing is guessed.
    expect(deployingWithOf({ read: rd([V(1, { status: 'activated', reviewDueAt: past })]), watchlist: card(), listDoc: LISTDOC() })).not.toBeNull();
  });

  it('not admitted, or nothing current held → no line: disabled, gate off, idle, loading, error with nothing, and a refresh that failed', () => {
    const v = [V(1, { status: 'ready' })];
    for (const status of [RESEARCH_READ.DISABLED, RESEARCH_READ.GATE_OFF, RESEARCH_READ.IDLE, RESEARCH_READ.LOADING, RESEARCH_READ.ERROR]) {
      expect(dw({ read: readOf({ status, data: null }) }), status).toBeNull();
    }
    expect(line(v, { status: RESEARCH_READ.ERROR }), 'a stale answer is not asserted').toBeNull();
    expect(line(v, { status: RESEARCH_READ.READY, refreshing: true })).not.toBeNull();
    expect(dw({ read: null })).toBeNull();
  });

  it('the Loadout card must be ready for THIS list with at least one name', () => {
    const v = [V(1, { status: 'ready' })];
    for (const watchlist of [
      card({ state: WATCHLIST_STATE.LOADING }), card({ state: WATCHLIST_STATE.UNAVAILABLE }), card({ state: WATCHLIST_STATE.ERROR }),
      card({ state: WATCHLIST_STATE.NONE }), card({ id: 'wl-other' }), card({ count: 0, symbols: [] }), null,
    ]) {
      expect(dw({ read: rd(v), watchlist }), JSON.stringify(watchlist)).toBeNull();
    }
  });

  it('a whole response only: a page at the route\'s limit may have left a version out', () => {
    const v = [V(2, { status: 'ready' })];
    expect(VERSION_PAGE_MAX).toBe(100);
    expect(dw({ read: readOf({ data: dataOf({ versions: v, versionCount: 99, currentVersion: 2 }) }) })).not.toBeNull();
    expect(dw({ read: readOf({ data: dataOf({ versions: v, versionCount: 100, currentVersion: 2 }) }) })).toBeNull();
  });

  it('a statement that is blank or missing → no line (nothing is invented)', () => {
    expect(line([V(1, { status: 'ready', statement: '   ' })])).toBeNull();
    expect(line([V(1, { status: 'ready', statement: undefined })])).toBeNull();
  });

  it('no versions at all → no line', () => {
    expect(line([])).toBeNull();
  });
});

describe('an equipped list the committed lists do not hold (deleted, or taken back to draft)', () => {
  const unavailable = loadoutOf({ watchlist: card({ state: WATCHLIST_STATE.UNAVAILABLE, symbols: [], count: 0 }) });

  it('the route answers not_found and a Retry could never succeed: that is "no usable list", not "couldn\'t load your idea"', () => {
    const section = derive({ loadout: unavailable, read: readOf({ status: RESEARCH_READ.ERROR, data: null }) });
    expect(section.status).toBe(RESEARCH_STATE.NO_LIST);
    expect(section.summary).toBe(COPY.research.summary.noList);
  });

  it('a genuine failure for a list that IS held is still an error with its Retry', () => {
    expect(derive({ read: readOf({ status: RESEARCH_READ.ERROR, data: null }) }).status).toBe(RESEARCH_STATE.ERROR);
  });

  it('an idea the route does give for it (a draft list keeps its versions) is shown as it is, with no honest line and no Deploy line', () => {
    const section = derive({ loadout: unavailable });
    expect(section.status).toBe(RESEARCH_STATE.READY);
    expect(section.idea.honest).toBeNull();
    expect(deployingWithOf({ read: readOf({ data: dataOf({ versions: [V(1, { status: 'ready' })] }) }), watchlist: unavailable.watchlist, listDoc: LISTDOC(), nowMs: NOW_MS })).toBeNull();
  });
});

describe('the label wears the reader\'s pointer once it holds the list\'s answer (BUILD_RULES §9)', () => {
  const agent = { id: 'a1', equippedWatchlistId: 'wl-1', equippedWatchlistName: 'Tech Leaders' };
  const base = { agent, committed: [{ watchlistId: 'wl-1', name: 'Tech Leaders', tickers: [{ symbol: 'NVDA' }], currentHypothesisVersion: undefined }], listsStatus: LISTS_STATUS.READY, hypothesisRecordsOn: true, ideaAccess: IDEA_ACCESS.ADMITTED };
  const kind = (pointer, doc) => deriveWatchlist({ ...base, committed: [{ ...base.committed[0], currentHypothesisVersion: doc }], ideaPointer: pointer }).idea;

  it('ideaPointerOf: the reader\'s currentVersion for its list (null for none), or undefined while it holds nothing', () => {
    expect(ideaPointerOf(readOf())).toEqual({ listId: 'wl-1', version: 1 });
    expect(ideaPointerOf(readOf({ data: dataOf({ currentVersion: 0, versions: [], versionCount: 0 }) }))).toEqual({ listId: 'wl-1', version: null });
    for (const read of [null, undefined, readOf({ data: null }), readOf({ listId: null }), readOf({ data: dataOf({ currentVersion: 'x' }) })]) expect(ideaPointerOf(read)).toBeUndefined();
  });

  it('the list document\'s pointer lags the reader\'s: the label follows the reader (the panel\'s answer), either way', () => {
    expect(kind({ listId: 'wl-1', version: 1 }, undefined)).toBe(IDEA_LABEL.UNIVERSE);
    expect(kind({ listId: 'wl-1', version: null }, 2)).toBe(IDEA_LABEL.PLAIN);
  });

  it('without a pointer for THIS list the list document\'s stands (S5): none given, or one for another list', () => {
    expect(kind(undefined, 2)).toBe(IDEA_LABEL.UNIVERSE);
    expect(kind(undefined, undefined)).toBe(IDEA_LABEL.PLAIN);
    expect(kind({ listId: 'wl-OTHER', version: null }, 2)).toBe(IDEA_LABEL.UNIVERSE);
  });

  it('a reader pointer never makes a label for a player not known to be admitted', () => {
    expect(deriveWatchlist({ ...base, ideaAccess: IDEA_ACCESS.UNKNOWN, ideaPointer: { listId: 'wl-1', version: 1 } }).idea).toBe(IDEA_LABEL.NEUTRAL);
    expect(deriveWatchlist({ ...base, hypothesisRecordsOn: false, ideaPointer: { listId: 'wl-1', version: 1 } }).idea).toBe(IDEA_LABEL.NEUTRAL);
  });
});

describe('Activity\'s descriptor (ruling R-S6-7): the current idea only', () => {
  it('the pointer\'s version, with the times the record holds and its status word', () => {
    const versions = [V(4), V(3), V(2, { status: 'ready', createdAt: T0, stateChangedAt: T1 }), V(1)];
    const idea = ideaActivityOf({ read: readOf({ data: dataOf({ currentVersion: 2, versions, versionCount: 4 }) }), watchlist: card() });
    expect(idea).toEqual({ listId: 'wl-1', listName: 'Tech Leaders', version: 2, status: 'ready', statusLabel: 'Ready', createdAt: T0, stateChangedAt: T1 });
  });

  it('a refresh that failed is not asserted: no descriptor, so no row without an age note; a refresh in flight is', () => {
    const versions = [V(2, { status: 'ready' })];
    const data = dataOf({ currentVersion: 2, versions, versionCount: 1 });
    expect(ideaActivityOf({ read: readOf({ data, status: RESEARCH_READ.ERROR }), watchlist: card() })).toBeNull();
    expect(ideaActivityOf({ read: readOf({ data, refreshing: true }), watchlist: card() })).not.toBeNull();
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
