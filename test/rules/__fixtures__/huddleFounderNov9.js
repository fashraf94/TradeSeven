// test/rules/__fixtures__/huddleFounderNov9.js
//
// Huddle S1.1 — THE FOUNDER'S NOV 9 CASE (Amendment E §E1's first test), built from a READ-ONLY production read on
// Nov 10, 2026 (build prompt hard rule 6: Admin SDK get/query only; the founder's own huddle record, agents and battles).
// Every occurrence of the founder's uid is replaced by `FOUNDER_UID` (asserted absent after the replacement); no other
// player's data is here.
//
// What happened on Nov 9: the plan was generated, and first confirmed, under the founder's equipped archetype Contrarian
// (the record's `plan.archetypeAtGeneration` and its first confirmation, 18:34:45 UTC), while the founder's live
// BaggerBomb game ran Diversifier (its frozen `agentContext.archetype`; the game's first trading day Nov 9). Under C15 the
// game read "Confirmed under a different approach · Reconfirm", and Reconfirm could not help because the equipped
// archetype had not changed; the second confirmation (Diversifier, 18:51:37 UTC) came only after the founder switched the
// equipped archetype. E1: one confirm must file into that game.
//
// Two values are set to the Nov 9 state, not the Nov 10 read, and are disclosed here: the ranked agent read Diversifier on
// Nov 10 (the founder's switch) and is set to Contrarian, as at the first confirm; the casual clone read Contrarian on
// Nov 10 (redeployed for Nov 10's game) and is set to Diversifier, the archetype Nov 9's game froze. The game is `active`,
// as during the Nov 9 session (it read `completed` on Nov 10). Agent and battle ids are the production ids.

export const FOUNDER_UID = 'FOUNDER_UID';
export const NOV9 = '2026-11-09';

export const NOV9_SESSION = Object.freeze({ etDate: NOV9, isTradingDay: true, isEarlyClose: false, openMs: 1794234600000, closeMs: 1794258000000 });

const ORIGIN = { kind: 'huddle', recordKind: null, recordId: null };

/** The plan the model proposed on Nov 9, exactly as stored (`plan.proposed`). */
export const NOV9_PROPOSAL = Object.freeze({
  stances: [{ kind: 'HOLD', ticker: 'CCI', origin: ORIGIN }, { kind: 'WATCH', ticker: 'RKLB', origin: ORIGIN }],
  lines: [{ kind: 'NO_ADDS_BEFORE', eventId: 'earn:RKLB:2026-11-09:amc', origin: ORIGIN }],
});

/** The validation context the Nov 9 record froze (`plan.context`). */
export const NOV9_CONTEXT = Object.freeze({
  universe: ['ADP', 'BTC', 'CAT', 'CCI', 'CSX', 'ETN', 'FDX', 'GEV', 'MDT', 'NEE', 'PWR', 'RKLB', 'STZ', 'UNP', 'UPS', 'WEC'],
  closes: { CCI: 88.6, RKLB: 53.07, MDT: 101.8, STZ: 141.97, BTC: 75746.93, NEE: 86.95, WEC: 115.87, ADP: 303.35 },
  eligibleEvents: ['ANZGF', 'ANZGY', 'ICPVF', 'KNNNF', 'LBTSF', 'RKLB', 'VDMCY', 'VODAF'].map((s) => ({
    eventId: `earn:${s}:2026-11-09:amc`, label: `${s}'s report after the close`, source: 'earnings', etDate: NOV9,
  })),
});

export const NOV9_RANKED_AGENT_ID = 'w8EPjTAXgfZatrTywQsj';
export const NOV9_GAME_ID = 'E0TvPcaDOkv9lyK9nxh3';

/** The founder's agents (ids as in production): the ranked agent, the casual clone and seven training clones. */
export const NOV9_AGENTS = Object.freeze([
  { id: NOV9_RANKED_AGENT_ID, ownerId: FOUNDER_UID, archetype: 'contrarian' },
  { id: `casual-agent-${FOUNDER_UID}`, ownerId: FOUNDER_UID, archetype: 'diversifier', isCasualClone: true },
  { id: `training-agent-2jkl5WDgCQaOZ1Hy33IS-${FOUNDER_UID}`, ownerId: FOUNDER_UID, archetype: 'analyst', isTrainingClone: true },
  { id: `training-agent-8osyIrfNwwXIj3W5YNP0-${FOUNDER_UID}`, ownerId: FOUNDER_UID, archetype: 'guardian', isTrainingClone: true },
  { id: `training-agent-Kt5cFqO6eu6AtTwvXG3E-${FOUNDER_UID}`, ownerId: FOUNDER_UID, archetype: 'diversifier', isTrainingClone: true },
  { id: `training-agent-TlXZK0LU4PCfE99vIDQz-${FOUNDER_UID}`, ownerId: FOUNDER_UID, archetype: 'momentum_chaser', isTrainingClone: true },
  { id: `training-agent-iQyVcflXhv0r3tSMWCml-${FOUNDER_UID}`, ownerId: FOUNDER_UID, archetype: 'diversifier', isTrainingClone: true },
  { id: `training-agent-jsvFBUG5vnm71Bh8YXN2-${FOUNDER_UID}`, ownerId: FOUNDER_UID, archetype: 'analyst', isTrainingClone: true },
  { id: `training-agent-tgGPUPDeQPbDwhSCgq4z-${FOUNDER_UID}`, ownerId: FOUNDER_UID, archetype: 'momentum_chaser', isTrainingClone: true },
]);

/** The live game of Nov 9: the casual clone's BaggerBomb game, frozen under Diversifier, first trading day Nov 9. */
export const NOV9_GAME = Object.freeze({
  id: NOV9_GAME_ID, ownerId: FOUNDER_UID, agentId: `casual-agent-${FOUNDER_UID}`, status: 'active', gameMode: 'baggerbomb_agent',
  agentContext: { archetype: 'diversifier' }, timing: { tradingDays: [NOV9] },
});
