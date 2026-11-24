// api/_utils/practiceField/__testsupport__/bookViewScenes.js
//
// Practice Field build B3 — THE SCREEN'S SCENES (test support; never imported by a production path). Each scene is a set
// of STORED records in the shapes the close, the entry and the agent write them — the book, its ideas, their rows at the
// last close and the close before, the book's two rows, the close row's agent block, finished ideas with their sealed
// result packets — for one state the design of record draws (docs/design/practice-field/IDEA_BOOK_ROUND_2.html): the
// sample day, the ten states, the fit test, the Desks day and History. The mock-up's names, theses, calls and notes are
// used as written; its money is a placeholder, so here every figure is MADE CONSISTENT the way the close makes it: a row's
// holdings value is the engine's markBook sum rounded once, its value is cash plus that, the book's equity is the treasury
// plus every open idea's value.
//
//   sceneInput(name)  → the input buildBookView takes (bookViewRead.js's output shape), plus the uid and book id;
//   sceneDocs(name)   → the same records by Firestore path, to seed the in-memory store (the reader's and the endpoint's
//                       tests read them back through bookViewRead.js).

import { markBook } from '../../mandateValuation.js';
import { roundUsd } from '../../mandateRounding.js';
import { sealAdjustment } from '../evidence.js';
import { sessionAfter, nextSessionDate, slotSessions } from '../windows.js';

export const SCENE_UID = 'owner-b3';
export const SCENE_BOOK_ID = 'pf_scene_book';
export const SCENE_AGENT_ID = 'agent-ranked-b3';

const r2 = (v) => roundUsd(v);
/** The session `n` sessions before `date`. */
function sessionsBefore(date, n) {
  let s = date;
  for (let i = 0; i < n; i += 1) s = sessionBefore(s);
  return s;
}
/** The trading session immediately before `date` (a walk back by calendar days; every candidate checked forward). */
export function sessionBefore(date) {
  let d = new Date(`${date}T12:00:00Z`);
  for (let i = 0; i < 12; i += 1) {
    d = new Date(d.getTime() - 86_400_000);
    const c = d.toISOString().slice(0, 10);
    // c is a session exactly when the session after the day before it is c.
    const dayBefore = new Date(d.getTime() - 86_400_000).toISOString().slice(0, 10);
    if (nextSessionDate(dayBefore) === c && nextSessionDate(c) === date) return c;
  }
  return null;
}

const BANKS_THESIS = 'Large US banks keep earning a wide net interest margin while credit stays clean; over the next weeks these three should beat the financials fund.';
const ENERGY_THESIS = 'Energy has led for three sessions while the broad market stalled. A short hold on the two strongest names.';
const INSURERS_THESIS = 'Health insurers have been marked down on cost fears that the last two quarters did not confirm. Over a few months the group should close some of that distance.';
const BANKS_CALL = 'Nothing in today’s tape changes the margin story. All three are well clear of their lines.';
const ENERGY_CALL = 'One day against us is inside the plan. I have no chart evidence yet, so I’m judging on price alone.';
const INSURERS_CALL = 'Four sessions in, there is nothing to judge yet. No name is near its line.';
const LONG_REASON = 'Nothing I read tonight changes the view. Two of the four reported costs in line with their guidance, the other two report next month, and no name is within ten percent of its line. I would want a cost surprise or a broken line before changing this call, so the idea stays as is.';
const SH_NOTE = 'The bank idea is doing what it should, slowly. I looked at three long-horizon drafts tonight and admitted none: two were priced too close to their own lines, and one overlapped the banks we already hold.';
const SH_NOTE_FULL = 'Both of my ideas are inside their plans. The banks are slightly ahead of the financials fund and the insurers are flat against theirs. I made no changes tonight.';
const AR_NOTE_FULL = 'Energy gave back a little today and stayed above both lines. I hold the two names, and I am not looking for a second idea while the short slot is full.';
const AR_NOTE_ADMIT = 'Energy is the clearest short-term leader on the price list, so I took its two strongest names. I passed on a second draft because one slot is all I run.';
const LONG_NOTE = 'Both of my ideas are inside their plans. The banks are a little ahead of the financials fund after four sessions, which is what a slow margin story should look like. The insurers are flat against their own fund, and four sessions tells me nothing yet. I read the two cost updates released after the close and neither changes what I expect. I asked whether the bank idea and the insurer idea lean on the same thing, a calm credit market, and I think they partly do. I am not acting on that tonight. If credit spreads widen for several sessions, I will write about it here before I change anything.';
const EXIT_CALL = 'Energy stopped leading today. The reason for the idea is gone, so I am closing it before either name reaches its line.';
const SH_CONS = [
  { names: ['USB', 'PNC', 'TFC'], thesis: 'Regional lenders as a cheaper way into the same margin story.', outcome: 'refused', refusals: [{ code: 'ticker_held_by_other_idea', symbol: 'USB' }] },
  { names: ['UNP', 'CSX', 'NSC'], thesis: 'Railroads on steady freight volumes through next quarter.', outcome: 'refused', refusals: [{ code: 'line_distance_out_of_band', symbol: 'UNP' }] },
  { names: ['DHI', 'LEN', 'PHM'], thesis: 'Home builders into lower mortgage rates.', outcome: 'refused', refusals: [{ code: 'line_distance_out_of_band', symbol: 'DHI' }] },
];
const AR_CONS = [
  { names: ['XOM', 'CVX'], thesis: ENERGY_THESIS, outcome: 'admitted', refusals: [] },
  { names: ['NVDA', 'AMD'], thesis: 'Chip makers bouncing off a two-week low.', outcome: 'not_chosen', refusals: [] },
  { names: ['ZIM'], thesis: 'A small shipping name breaking out on volume.', outcome: 'refused', refusals: [{ code: 'name_not_a_candidate', symbol: 'ZIM' }] },
];

/** One name: shares, entry (its average cost), the close's mark, the mark at the close before, its line's level. */
const N = (sym, shares, entry, now, prev, level, x = {}) => ({ sym, shares, entry, now, prev, level, ...x });
const BANKS = () => [N('JPM', 27, 301.20, 304.85, 303.90, 271.08), N('BAC', 159, 52.40, 52.10, 52.30, 47.16), N('GS', 10, 812.50, 826.00, 820.40, 731.25)];
const ENERGY = () => [N('XOM', 105, 118.30, 117.05, 118.85, 112.39), N('CVX', 77, 161.75, 163.20, 161.10, 153.66)];
const INSURERS = () => [N('UNH', 24, 342.10, 345.60, 344.20, 290.79), N('ELV', 26, 318.40, 315.90, 317.00, 270.64), N('CI', 29, 286.75, 289.30, 288.10, 243.74)];

/** The value of names at a mark field, as the close values them (markBook's sum, rounded once). */
function holdingsValue(names, field) {
  const positions = Object.fromEntries(names.filter((n) => !n.sold && Number.isFinite(n[field])).map((n) => [n.sym, { shares: n.shares, lastMark: n[field] }]));
  return r2(markBook(positions, 0, null).positionsValue);
}

/**
 * One idea and its rows. `day` and `slot` fix its schedule against `session`; `gap` its stored gaps (USD) — the comparison's
 * value is the idea's less the gap; `quality` overrides a name's close-mark quality; `status`, `endpointKind`, `exitPending`
 * and `sold` shape the states.
 */
function makeIdea({
  id, slot, desk, names, session, day, status = 'holding', thesis, admittedDaysBefore = 1, origin = 'market_scan',
  comparison = { type: 'sector_fund', symbols: ['XLF'] }, gap = 84.2, spyGap = 31.05, reserved = null, cash = 0.37,
  rowFullQuality = true, endpointKind = null, prevMissing = false, entered = true, observed = true,
}) {
  const sessions = slotSessions(slot);
  const start = entered ? sessionsBefore(session, day) : nextSessionDate(session);
  const due = sessionAfter(start, sessions);
  const capital = reserved ?? r2(names.reduce((s, n) => s + n.shares * n.entry, 0) + cash);
  const holdings = {};
  for (const n of names) {
    if (n.sold) continue;
    holdings[n.sym] = {
      shares: n.shares, costBasisTotal: r2(n.shares * n.entry), avgCost: n.entry, lastMark: n.now, lastMarkSource: 'snapshot', sector: null, openedAt: start,
      ...(n.exitPending ? { exitPending: { reason: n.exitPending, session, at: `${session}T21:20:00.000Z` } } : {}),
      ...(status === 'settled' ? { settlementPending: { session, at: `${session}T21:20:00.000Z`, ...(endpointKind === 'manager_exit' ? { reason: 'manager_exit' } : {}), replacedExit: null, waiting: null } } : {}),
    };
  }
  // A name sold at a window this session left its proceeds in the idea's cash (at its mark, the scene's sale price).
  const cashNow = r2(cash + names.filter((n) => n.sold).reduce((t, n) => t + n.shares * n.now, 0));
  const saleReceipts = names.filter((n) => n.sold).map((n) => ({ kind: n.sold.kind, symbol: n.sym, sessionDate: n.sold.date, tickKey: `${n.sold.date}_open30` }));
  const admittedAt = `${sessionsBefore(start, admittedDaysBefore)}T21:10:00.000Z`;
  const idea = {
    ideaId: id,
    bookId: SCENE_BOOK_ID,
    status,
    admittedAt,
    contract: {
      slot, names: names.map((n) => n.sym), thesis: { text: thesis, author: origin === 'founder_fixture' ? 'founder_fixture' : 'agent' },
      comparison: { ...comparison }, capitalUsd: capital, origin: { kind: origin, initiatedBy: 'agent' },
      sources: origin === 'founder_fixture' ? [] : [{ kind: origin, ref: `${sessionBefore(start)}_close` }],
      lines: names.map((n) => ({ symbol: n.sym, distancePct: r2((1 - n.level / n.entry)) })),
      schedule: { startSession: start, dueSession: due },
      ...(desk ? { desk } : {}),
    },
    ...(entered ? {
      entry: { sessionDate: start, slot: 'open30', legCount: names.length },
      lines: names.map((n) => ({ symbol: n.sym, side: 'below', level: n.level, distancePct: r2(1 - n.level / n.entry), fillPrice: n.entry, adjustments: [] })),
      ledger: { cash: cashNow, holdings, saleReceipts, corporateActionReceipts: [] },
    } : { ledger: { cash: capital, holdings: {}, saleReceipts: [], corporateActionReceipts: [] } }),
    ...(status === 'settled' ? { result: { endpointKind, endpointSession: session, ...(endpointKind === 'manager_exit' ? { managerExit: { session, desk, reason: EXIT_CALL } } : {}) }, endpoint: { session, kind: endpointKind } } : {}),
  };
  if (!entered) return { idea, rows: { last: null, prev: null } };
  const rowOf = (date, field, full) => {
    const held = names.filter((n) => !n.sold || (field === 'prev' && n.sold.date > date));
    const value = holdingsValue(held.map((n) => ({ ...n, sold: false })), field);
    const rowCash = field === 'now' ? cashNow : cash;
    const markedValue = r2(rowCash + value);
    const marks = Object.fromEntries(held.map((n) => [n.sym, { mark: n[field], quality: (field === 'now' ? n.quality : n.prevQuality) ?? 'vendor_time', markSource: 'snapshot', vendorTimeIso: `${date}T21:00:00.000Z` }]));
    return {
      rowKind: 'valuation', basis: 'mark', label: observed ? 'post_close_snapshot' : 'unobserved', date, ideaId: id, bookId: SCENE_BOOK_ID,
      reservedCapitalUsd: capital, markedValue, cash: rowCash, markedHoldingsValue: value,
      quantities: Object.fromEntries(held.map((n) => [n.sym, n.shares])), marks,
      comparisonType: comparison.type, comparisonMarkedValue: r2(markedValue - gap), comparisonMarks: Object.fromEntries((comparison.symbols || []).filter((s) => !names.some((n) => n.sym === s)).map((s) => [s, { mark: 48.1, quality: 'vendor_time', markSource: 'snapshot' }])),
      spyMarkedValue: r2(markedValue - spyGap), spyMarks: { SPY: { mark: field === 'now' ? 596.42 : 594.1, quality: 'vendor_time', markSource: 'snapshot' } },
      markedGapUsd: gap, markedGapPct: (gap * 100) / capital, markedGapToSpyUsd: spyGap, markedGapToSpyPct: (spyGap * 100) / capital,
      fullQuality: full, observed, holdingsCents: null,
    };
  };
  const prevDate = sessionBefore(session);
  const last = rowOf(session, 'now', rowFullQuality && names.every((n) => (n.quality ?? 'vendor_time') === 'vendor_time'));
  const prev = prevMissing || start >= session ? null : rowOf(prevDate, 'prev', true);
  return { idea, rows: { last, prev } };
}

/** A finished idea with its sealed result packet (contract §4.4's five columns as settlement.js writes them). */
function makeFinished({ id, slot, desk, names, endpointKind, completed, endpointSession = completed, gapUsd, gapPct, comparison = { type: 'sector_fund', symbols: ['XLE'] }, economicResult = null, unmeasurableBecause = [], contractCondition = 'met', processQuality = 'followed_plan', breaches = [], thesis = ENERGY_THESIS, tamper = false }) {
  const result = {
    resultVersion: 1, endpointSession, endpointKind,
    contractCondition, contractDetail: { breaches: breaches.map((s) => ({ symbol: s, session: endpointSession })), unobservedLineSessions: {}, unobservedLineSessionCount: 0 },
    economicResult: economicResult ?? (unmeasurableBecause.length > 0 ? 'unmeasurable' : gapUsd > 5 ? 'ahead' : gapUsd < -5 ? 'behind' : 'within_band'),
    economic: { gapUsd, gapPctOfReserved: gapPct, unmeasurableBecause },
    processQuality, processDetail: { blockedBy: [] },
    evidenceScope: 'single_forward_observation', adoption: 'no_offer', closingNote: null, oneObservationLabel: true,
    ...(endpointKind === 'manager_exit' ? { managerExit: { session: endpointSession, desk, reason: EXIT_CALL } } : {}),
  };
  const sealed = sealAdjustment({ packetVersion: 1, packetId: 'result', bookId: SCENE_BOOK_ID, ideaId: id, result, corporateActions: { receipts: 0, byLedger: {}, parts: [] } });
  const packet = tamper ? { ...sealed, result: { ...sealed.result, economicResult: 'ahead' } } : sealed;
  const idea = {
    ideaId: id, bookId: SCENE_BOOK_ID, status: 'resulted', admittedAt: `${sessionsBefore(endpointSession, slotSessions(slot) + 1)}T21:10:00.000Z`,
    contract: { slot, names, thesis: { text: thesis, author: 'agent' }, comparison, origin: { kind: 'market_scan', initiatedBy: 'agent' }, schedule: {}, ...(desk ? { desk } : {}) },
    entry: { sessionDate: sessionsBefore(endpointSession, slotSessions(slot)) },
    ledger: { cash: 0, holdings: {}, saleReceipts: names.map((s) => ({ kind: 'settlement', symbol: s, sessionDate: completed })) },
    result, endpoint: { session: endpointSession, kind: endpointKind }, liquidation: { completedSession: completed },
  };
  return { idea, packet, parts: {} };
}

/** The close row's agent block. */
const deskPart = ({ source = 'model', note = null, actions = [], considered = [] } = {}) => ({ status: 'done', source, note: source === 'code_fallback' ? "The agent could not complete today's check; nothing changed." : note, actions, considered: considered.map((c, i) => ({ index: i, slot: c.slot ?? 'long', ...c })) });

/** Assemble a scene: the book (its equity the treasury plus every open idea's value) and everything the view reads. */
function assemble({ session, ideas, finished = [], closeAgent = null, drafting = 'on', status = 'active', windDown = null, treasury = 49870.11, dailyFull = true, prevDaily = true, firstEntrySession = null, observed = true }) {
  const open = ideas.map((x) => x.idea);
  const value = (field) => r2(treasury + ideas.reduce((s, x) => {
    const row = x.rows[field];
    return s + (row ? row.markedValue : (field === 'last' ? x.idea.ledger.cash : x.idea.ledger.cash));
  }, 0));
  const reserved = r2(ideas.reduce((s, x) => s + (x.rows.last ? x.rows.last.cash : x.idea.ledger.cash), 0));
  const prevReserved = r2(ideas.reduce((s, x) => s + (x.rows.prev ? x.rows.prev.cash : x.idea.ledger.cash), 0));
  const slots = { short: null, medium: null, long: null };
  for (const i of open) slots[i.contract.slot] = i.ideaId;
  const book = {
    kind: 'idea_book', bookId: SCENE_BOOK_ID, userId: SCENE_UID, status, drafting, windDown, attributionAgentId: SCENE_AGENT_ID, archetypeCodeId: 'momentum_chaser',
    slots, openIdeaIds: open.map((i) => i.ideaId), treasury: { unreservedCash: treasury },
    portfolio: { initialValue: 100_000, cash: r2(treasury + reserved), totalValue: value('last') },
    execState: { lastCloseKey: session },
  };
  const prevDate = sessionBefore(session);
  const dailyRows = {
    last: { date: session, markedEquity: value('last'), treasuryCash: treasury, reservedCash: reserved, fullQuality: dailyFull, observed },
    prev: prevDaily ? { date: prevDate, markedEquity: value('prev'), treasuryCash: treasury, reservedCash: prevReserved, fullQuality: true, observed: true } : null,
  };
  const rows = new Map(ideas.filter((x) => x.idea.entry).map((x) => [x.idea.ideaId, x.rows]));
  const firstIdea = firstEntrySession ? null : [...open, ...finished.map((f) => f.idea)].filter((i) => i.entry?.sessionDate).sort((a, b) => (a.entry.sessionDate < b.entry.sessionDate ? -1 : 1))[0];
  const firstSession = firstEntrySession ?? firstIdea?.entry?.sessionDate ?? null;
  // The first entered idea's row at its entry session: the row itself when the scene holds it, else one with SPY's close there.
  const held = firstIdea ? Object.values(rows.get(firstIdea.ideaId) || {}).find((r) => r && r.date === firstSession) : null;
  const firstEntry = firstSession ? { session: firstSession, ideaId: firstIdea?.ideaId ?? null, row: held ?? { date: firstSession, spyMarks: { SPY: { mark: 590.0, quality: 'vendor_time' } } } } : null;
  const closeRow = closeAgent ? { session: { expected: ['open30', 'midday', 'preClose', 'close'], missing: [] }, agent: { version: 1, desks: closeAgent } } : null;
  return { book, ideas: open, rows, dailyRows, closeRow, finished, firstEntry, agentOn: true, archetypeName: 'Trend Follower' };
}

const D27 = '2026-11-27';
const D25 = '2026-11-25';
const D24 = '2026-11-24';
const D20 = '2026-11-20';

/** The sample day: the brief's book (ENERGY in the short slot, BANKS in the medium), long open. */
function sample(over = {}) {
  const session = over.session ?? D27;
  const energy = makeIdea({ id: 'i_energy', slot: 'short', desk: 'archetype', names: over.energyNames ?? ENERGY(), session, day: 2, thesis: ENERGY_THESIS, comparison: { type: 'sector_fund', symbols: ['XLE'] }, gap: -22.4, spyGap: -14.1, ...(over.energy || {}) });
  const banks = makeIdea({ id: 'i_banks', slot: 'medium', desk: 'shadow', names: over.bankNames ?? BANKS(), session, day: 4, thesis: BANKS_THESIS, origin: 'founder_fixture', gap: 84.2, spyGap: 31.05, ...(over.banks || {}) });
  const ideas = [energy, banks, ...(over.extra || [])];
  const closeAgent = over.closeAgent === undefined ? {
    archetype: deskPart({ note: null, source: 'model', actions: [{ ideaId: 'i_energy', action: 'hold', reason: ENERGY_CALL, outcome: 'held' }] }),
    shadow: deskPart({ note: SH_NOTE, actions: [{ ideaId: 'i_banks', action: 'hold', reason: BANKS_CALL, outcome: 'held' }], considered: SH_CONS }),
  } : over.closeAgent;
  return assemble({ session, ideas, closeAgent, ...(over.assemble || {}) });
}

/** Every scene, by name. */
export const SCENES = Object.freeze({
  // The sample day, as written (the mock-up's s0).
  sample: () => sample(),
  // 1. A full book: three ideas, eight names.
  full: () => {
    const insurers = makeIdea({ id: 'i_insurers', slot: 'long', desk: 'shadow', names: INSURERS(), session: D27, day: 4, thesis: INSURERS_THESIS, origin: 'research', comparison: { type: 'sector_fund', symbols: ['XLV'] }, gap: 46.9, spyGap: -8.15 });
    return sample({
      extra: [insurers],
      assemble: { treasury: 25065.56 },
      closeAgent: {
        archetype: deskPart({ note: AR_NOTE_FULL, actions: [{ ideaId: 'i_energy', action: 'hold', reason: ENERGY_CALL, outcome: 'held' }] }),
        shadow: deskPart({ note: SH_NOTE_FULL, actions: [{ ideaId: 'i_banks', action: 'hold', reason: BANKS_CALL, outcome: 'held' }, { ideaId: 'i_insurers', action: 'hold', reason: INSURERS_CALL, outcome: 'held' }] }),
      },
    });
  },
  // 2. A new book: one idea entering (admitted at the first close), two open slots.
  newBook: () => {
    const banks = makeIdea({ id: 'i_banks', slot: 'medium', desk: 'shadow', names: BANKS(), session: D20, day: 0, status: 'accepted', entered: false, thesis: BANKS_THESIS, origin: 'founder_fixture' });
    return assemble({
      session: D20, ideas: [banks], treasury: 100_000 - banks.idea.contract.capitalUsd, prevDaily: false,
      closeAgent: { shadow: deskPart({ note: null, considered: [{ slot: 'medium', names: ['JPM', 'BAC', 'GS'], thesis: BANKS_THESIS, outcome: 'admitted', refusals: [] }] }) },
    });
  },
  // 3. New today: XOM and CVX bought at this session's window.
  newToday: () => {
    const energy = makeIdea({ id: 'i_energy', slot: 'short', desk: 'archetype', names: [N('XOM', 105, 118.30, 118.85, 118.30, 112.39), N('CVX', 77, 161.75, 161.10, 161.75, 153.66)], session: D25, day: 0, thesis: ENERGY_THESIS, comparison: { type: 'sector_fund', symbols: ['XLE'] }, gap: 4.15, spyGap: 2.1 });
    const banks = makeIdea({ id: 'i_banks', slot: 'medium', desk: 'shadow', names: [N('JPM', 27, 301.20, 303.10, 302.40, 271.08), N('BAC', 159, 52.40, 52.30, 52.65, 47.16), N('GS', 10, 812.50, 820.40, 815.10, 731.25)], session: D25, day: 3, thesis: BANKS_THESIS, origin: 'founder_fixture', gap: 52.1, spyGap: -6.4 });
    return assemble({
      session: D25, ideas: [energy, banks],
      closeAgent: {
        archetype: deskPart({ actions: [{ ideaId: 'i_energy', action: 'hold', reason: 'Both names were bought at this morning’s first window. One session tells me nothing yet, so I hold.', outcome: 'held' }] }),
        shadow: deskPart({ actions: [{ ideaId: 'i_banks', action: 'hold', reason: BANKS_CALL, outcome: 'held' }] }),
      },
    });
  },
  // 4. Near a line: XOM 0.7% from its line.
  nearLine: () => sample({ energyNames: [N('XOM', 105, 118.30, 113.20, 118.85, 112.39), N('CVX', 77, 161.75, 163.20, 161.10, 153.66)], energy: { gap: -118.6 } }),
  // 5. A line hit: XOM sold at its line by code this session.
  lineHit: () => sample({ energyNames: [N('XOM', 105, 118.30, 112.39, 118.85, 112.39, { sold: { kind: 'line_exit', date: D27 } }), N('CVX', 77, 161.75, 163.20, 161.10, 153.66)], energy: { gap: -309.4 } }),
  // 5b. A line recognised at the close, its sale queued (not drawn by the mock-up).
  lineRecognised: () => sample({ energyNames: [N('XOM', 105, 118.30, 112.10, 113.20, 112.39, { exitPending: 'line' }), N('CVX', 77, 161.75, 163.20, 161.10, 153.66)], energy: { gap: -140.2 } }),
  // 6. An exit called: the archetype desk settles the short idea early; it sells at the next session's first window.
  exitCalled: () => sample({
    energy: { status: 'settled', endpointKind: 'manager_exit' },
    closeAgent: {
      archetype: deskPart({ actions: [{ ideaId: 'i_energy', action: 'exit', reason: EXIT_CALL, outcome: 'exit_settled' }] }),
      shadow: deskPart({ note: SH_NOTE, actions: [{ ideaId: 'i_banks', action: 'hold', reason: BANKS_CALL, outcome: 'held' }], considered: SH_CONS }),
    },
  }),
  // 6b. Settled at its review date, waiting for its sale (not drawn by the mock-up).
  reviewDate: () => sample({ energy: { status: 'settled', endpointKind: 'due_session', day: 10 } }),
  // 7. Waiting on data: BAC has no closing price for the session.
  waiting: () => sample({ bankNames: [N('JPM', 27, 301.20, 304.85, 303.90, 271.08), N('BAC', 159, 52.40, 52.30, 52.30, 47.16, { quality: 'carried_forward' }), N('GS', 10, 812.50, 826.00, 820.40, 731.25)], assemble: { dailyFull: false } }),
  // 8. A failed check: the archetype desk's call did not complete; nothing changed.
  failed: () => sample({
    closeAgent: {
      archetype: deskPart({ source: 'code_fallback' }),
      shadow: deskPart({ note: SH_NOTE, actions: [{ ideaId: 'i_banks', action: 'hold', reason: BANKS_CALL, outcome: 'held' }], considered: SH_CONS }),
    },
  }),
  // 9. Paused: no desk checks; code still sells at lines.
  paused: () => sample({
    assemble: { drafting: 'paused' },
    closeAgent: { archetype: { status: 'done', source: 'no_work', note: null, stoppedBy: 'drafting_paused', actions: [], considered: [] }, shadow: { status: 'done', source: 'no_work', note: null, stoppedBy: 'drafting_paused', actions: [], considered: [] } },
  }),
  // Winding down (not drawn by the mock-up).
  windingDown: () => sample({ assemble: { status: 'draining', windDown: { requestedAt: `${D27}T15:00:00.000Z` } } }),
  // The agent switch off (production today): no close-row agent block, so no strip, no notes, no calls.
  agentOff: () => ({ ...sample({ closeAgent: null }), agentOn: false }),
  // Bought at this morning's window, after the last close (not drawn: the mock-up's note says state 3 is drawn after the close).
  boughtToday: () => {
    const s = sample();
    const energy = makeIdea({ id: 'i_energy', slot: 'short', desk: 'archetype', names: ENERGY(), session: D27, day: 0, thesis: ENERGY_THESIS, comparison: { type: 'sector_fund', symbols: ['XLE'] } });
    energy.idea.entry.sessionDate = '2026-11-30';
    return { ...s, ideas: [energy.idea, ...s.ideas.filter((i) => i.ideaId !== 'i_energy')], rows: new Map([...s.rows].filter(([k]) => k !== 'i_energy')) };
  },
  // A session nobody observed: marks carried, every row below full quality.
  unobserved: () => sample({
    energyNames: ENERGY().map((n) => ({ ...n, quality: 'unobserved' })),
    bankNames: BANKS().map((n) => ({ ...n, quality: 'unobserved' })),
    energy: { observed: false }, banks: { observed: false },
    assemble: { dailyFull: false, observed: false },
  }),
  // The fit test, not a real day: a four-name idea, NEW on a five-letter symbol, five-figure amounts, the longest
  // comparison and the 278-character reason.
  fit: () => {
    const fit = makeIdea({
      id: 'i_fit', slot: 'long', desk: 'shadow', session: D27, day: 4, thesis: INSURERS_THESIS, origin: 'research', comparison: { type: 'same_stock_held' }, gap: 10598.15, spyGap: 9870.2,
      names: [N('GOOGL', 380, 1284.60, 1318.42, 1345.27, 1156.14), N('UNH', 1300, 342.10, 333.94, 332.98, 290.79), N('ELV', 1500, 318.40, 325.11, 325.67, 270.64), N('HUM', 14, 254.60, 251.85, 251.85, 216.41)],
    });
    fit.idea.entry.sessionDate = D27; // GOOGL's NEW tag: every name of this idea was bought today in the mock-up's fit test
    fit.rows.prev = null;
    return sample({
      extra: [fit], assemble: { treasury: 25065.56 },
      closeAgent: {
        archetype: deskPart({ note: AR_NOTE_FULL, actions: [{ ideaId: 'i_energy', action: 'hold', reason: ENERGY_CALL, outcome: 'held' }] }),
        shadow: deskPart({ note: LONG_NOTE, actions: [{ ideaId: 'i_banks', action: 'hold', reason: BANKS_CALL, outcome: 'held' }, { ideaId: 'i_fit', action: 'hold', reason: LONG_REASON, outcome: 'held' }], considered: SH_CONS }),
      },
    });
  },
  // The Desks tab, the day an idea was admitted: the archetype desk's note, its call and three drafts with all three outcomes.
  desksAdmit: () => {
    const energy = makeIdea({ id: 'i_energy', slot: 'short', desk: 'archetype', names: ENERGY(), session: D24, day: 0, status: 'accepted', entered: false, thesis: ENERGY_THESIS, comparison: { type: 'sector_fund', symbols: ['XLE'] } });
    const banks = makeIdea({ id: 'i_banks', slot: 'medium', desk: 'shadow', names: [N('JPM', 27, 301.20, 302.40, 301.75, 271.08), N('BAC', 159, 52.40, 52.65, 52.50, 47.16), N('GS', 10, 812.50, 815.10, 813.20, 731.25)], session: D24, day: 2, thesis: BANKS_THESIS, origin: 'founder_fixture', gap: 21.4, spyGap: -12.8 });
    return assemble({
      session: D24, ideas: [energy, banks], treasury: 74935.2,
      closeAgent: {
        archetype: deskPart({ note: AR_NOTE_ADMIT, considered: AR_CONS.map((c) => ({ ...c, slot: 'short' })) }),
        shadow: deskPart({ actions: [{ ideaId: 'i_banks', action: 'hold', reason: BANKS_CALL, outcome: 'held' }] }),
      },
    });
  },
  // History: finished ideas with all four endings, one not measurable, one whose packet does not check.
  history: () => {
    const banks = makeIdea({ id: 'i_banks', slot: 'medium', desk: 'shadow', names: [N('JPM', 27, 301.20, 309.40, 308.10, 271.08), N('BAC', 159, 52.40, 53.05, 52.90, 47.16), N('GS', 10, 812.50, 838.75, 835.00, 731.25)], session: '2026-12-17', day: 18, thesis: BANKS_THESIS, origin: 'founder_fixture', gap: 212.75, spyGap: 96.3 });
    return assemble({
      session: '2026-12-17', ideas: [banks], treasury: 74612.9,
      closeAgent: { shadow: deskPart({ actions: [{ ideaId: 'i_banks', action: 'hold', reason: BANKS_CALL, outcome: 'held' }] }) },
      finished: [
        makeFinished({ id: 'f_nvda', slot: 'short', desk: 'archetype', names: ['NVDA', 'AVGO'], endpointKind: 'due_session', completed: '2026-12-16', endpointSession: '2026-12-15', gapUsd: 0, gapPct: 0, unmeasurableBecause: ['idea_mark_not_full_quality'], processQuality: 'blocked' }),
        makeFinished({ id: 'f_kopep', slot: 'long', desk: 'shadow', names: ['KO', 'PEP', 'PG'], endpointKind: 'manager_exit', completed: '2026-12-08', endpointSession: '2026-12-07', gapUsd: 12.4, gapPct: 0.05, comparison: { type: 'same_stock_held' }, thesis: INSURERS_THESIS }),
        makeFinished({ id: 'f_energy', slot: 'short', desk: 'archetype', names: ['XOM', 'CVX'], endpointKind: 'due_session', completed: '2026-12-01', endpointSession: '2026-11-30', gapUsd: 58.9, gapPct: 0.29 }),
        makeFinished({ id: 'f_early', slot: 'short', desk: 'archetype', names: ['SLB'], endpointKind: 'early_resolution', completed: '2026-11-19', endpointSession: '2026-11-18', gapUsd: -41.3, gapPct: -0.21, contractCondition: 'breached', breaches: ['SLB'] }),
        makeFinished({ id: 'f_late', slot: 'short', desk: 'archetype', names: ['OXY'], endpointKind: 'late', completed: '2026-11-13', endpointSession: '2026-11-12', gapUsd: 3.1, gapPct: 0.02, unmeasurableBecause: ['endpoint_after_due_session'] }),
        makeFinished({ id: 'f_tampered', slot: 'short', desk: 'archetype', names: ['DVN'], endpointKind: 'due_session', completed: '2026-11-06', endpointSession: '2026-11-05', gapUsd: -9.9, gapPct: -0.05, tamper: true }),
      ],
    });
  },
  // A slot whose idea finished this session (its last sale filled today), shown in its place until the next close.
  settledToday: () => {
    const done = makeFinished({ id: 'f_today', slot: 'long', desk: 'shadow', names: ['UNH', 'ELV', 'CI'], endpointKind: 'manager_exit', completed: D27, endpointSession: D25, gapUsd: -41.3, gapPct: -0.21, comparison: { type: 'sector_fund', symbols: ['XLV'] }, thesis: INSURERS_THESIS });
    return sample({ assemble: { finished: [done] } });
  },
});

export const SCENE_NAMES = Object.freeze(Object.keys(SCENES));

/** The input buildBookView takes for a scene. */
export function sceneInput(name) {
  const make = SCENES[name];
  if (!make) throw new Error(`no scene '${name}'`);
  return make();
}

/** A scene's records by Firestore path (to seed makeMandateFakeDb), as bookViewRead.js reads them. */
export function sceneDocs(name, { uid = SCENE_UID } = {}) {
  const s = sceneInput(name);
  const base = `mandates/${SCENE_BOOK_ID}`;
  const docs = {
    [`practiceFieldBooks/${uid}`]: { bookId: SCENE_BOOK_ID, status: s.book.status, attributionAgentId: SCENE_AGENT_ID },
    [base]: { ...s.book, userId: uid },
  };
  for (const idea of s.ideas) {
    docs[`${base}/ideas/${idea.ideaId}`] = idea;
    const rows = s.rows.get(idea.ideaId);
    if (rows?.last) docs[`${base}/ideas/${idea.ideaId}/rows/${rows.last.date}`] = rows.last;
    if (rows?.prev) docs[`${base}/ideas/${idea.ideaId}/rows/${rows.prev.date}`] = rows.prev;
  }
  if (s.dailyRows.last) docs[`${base}/dailyRows/${s.dailyRows.last.date}`] = s.dailyRows.last;
  if (s.dailyRows.prev) docs[`${base}/dailyRows/${s.dailyRows.prev.date}`] = s.dailyRows.prev;
  if (s.closeRow) docs[`${base}/windows/${s.book.execState.lastCloseKey}_close`] = s.closeRow;
  for (const f of s.finished) {
    docs[`${base}/ideas/${f.idea.ideaId}`] = f.idea;
    docs[`${base}/ideas/${f.idea.ideaId}/evidence/result`] = f.packet;
  }
  // The first entered idea's row at its entry session (SPY's close there).
  if (s.firstEntry?.ideaId) {
    const path = `${base}/ideas/${s.firstEntry.ideaId}/rows/${s.firstEntry.session}`;
    if (!docs[path]) docs[path] = s.firstEntry.row;
  }
  return docs;
}

/**
 * A scene's records as ANOTHER owner's book: every path and value naming the scene's uid, book or ideas renamed (a JSON
 * rewrite of the whole set). Its sealed packets no longer check under the new ids — irrelevant to what it is for: a
 * second owner in the same store, whose ids must never reach the first owner's answer.
 */
export function sceneDocsFor(name, { uid, bookId, ideaPrefix }) {
  const json = JSON.stringify(sceneDocs(name, { uid: SCENE_UID }))
    .split(SCENE_BOOK_ID).join(bookId)
    .split(SCENE_UID).join(uid)
    .split(SCENE_AGENT_ID).join(`${ideaPrefix}agent`)
    .replace(/(["/])([if])_([a-z]+)/g, (_, q, k, rest) => `${q}${ideaPrefix}${k}_${rest}`);
  return JSON.parse(json);
}
