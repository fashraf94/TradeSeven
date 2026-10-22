// src/components/CommandCenter/hub/selectors/loadout.js
//
// Command Center hub, slice S5 — the Loadout and career selectors (spec V1.2
// §2 `deriveLoadout`, §7 career; rulings R-S5-1 … R-S5-3). Pure, like every
// module in this directory: they read only their arguments and hold vocabulary
// tokens, never phrases — the words live in hub/hubCopy.js, chosen by token.
//
// Every input is handed in, flags included. The hub root reads the flags and
// the shells' own helpers (getEquipSlots, getTraitSlotSummary) at render and
// passes their results, so a row can drive each case without mocking a module,
// and the shells' rules are used, never copied.
//
// The desired loadout is the OWNER'S AGENT DOCUMENT at rest (spec §2: "current
// desired loadout; game rows use battle-frozen configuration"): a live game
// keeps the loadout it was deployed with, so this never describes a game.

import { deriveDeployGate } from '../../../../utils/commandCenterLiveBattles';

export const LOADOUT_STATUS = Object.freeze({ LOADING: 'loading', NONE: 'none', READY: 'ready' });
export const WATCHLIST_STATE = Object.freeze({
  NONE: 'none', LOADING: 'loading', READY: 'ready', UNAVAILABLE: 'unavailable', ERROR: 'error',
});
/** How the watchlist card labels its names (design note appendix A: the idea leads, the list is its universe). */
export const IDEA_LABEL = Object.freeze({ UNIVERSE: 'universe', PLAIN: 'plain', NEUTRAL: 'neutral' });
/**
 * Whether the server admits this player to idea records (founder ruling Q-S5-4a). The client cannot know it
 * without a read (featureFlags.js: it "never learns who is admitted"), so S5 passes UNKNOWN and every player sees
 * the neutral "N names"; S6 supplies ADMITTED or NOT_ADMITTED from its gated reader.
 */
export const IDEA_ACCESS = Object.freeze({ UNKNOWN: 'unknown', ADMITTED: 'admitted', NOT_ADMITTED: 'not_admitted' });

/** An access answer as given: anything that is not exactly one of the three words is UNKNOWN. */
export function ideaAccessOf(value) {
  return value === IDEA_ACCESS.ADMITTED || value === IDEA_ACCESS.NOT_ADMITTED ? value : IDEA_ACCESS.UNKNOWN;
}
export const CAREER_STATUS = Object.freeze({ LOADING: 'loading', READY: 'ready', UNAVAILABLE: 'unavailable' });
/** The Forge tab the adjustments' door opens, by the tab's own name. */
export const FORGE_DOOR = Object.freeze({ CHARACTER: 'character', TRAITS: 'traits' });
/** The lists reader's states (hub/useHubLoadout.js). */
export const LISTS_STATUS = Object.freeze({ LOADING: 'loading', READY: 'ready', ERROR: 'error' });

/**
 * Which label the watchlist card wears (ruling R-S5-2, as narrowed by Q-S5-4a).
 *   - the player not KNOWN to be admitted to idea records (`ideaAccess` anything
 *     but ADMITTED: unknown, not admitted, or absent), the records flag off, or a
 *     malformed pointer: the neutral "N names" — it claims nothing about ideas
 *     (the flag dominates: with the records dark a stale pointer would name an
 *     idea the player cannot see; and a player the server does not admit has no
 *     "idea yet" to be told about);
 *   - admitted, flag on and the pointer absent or null: the plain list, no idea yet;
 *   - admitted, flag on and a positive integer: the list is an idea's universe.
 * The pointer is `currentHypothesisVersion` on the list document; the server's
 * own reader (api/_utils/hypothesisRecords/model.js currentVersionOf) treats
 * absent and null as 0 and anything but a positive integer as corrupt.
 */
export function ideaLabelKind(list, hypothesisRecordsOn, ideaAccess) {
  if (ideaAccess !== IDEA_ACCESS.ADMITTED || hypothesisRecordsOn !== true) return IDEA_LABEL.NEUTRAL;
  const pointer = list ? list.currentHypothesisVersion : undefined;
  if (pointer === undefined || pointer === null) return IDEA_LABEL.PLAIN;
  return Number.isInteger(pointer) && pointer > 0 ? IDEA_LABEL.UNIVERSE : IDEA_LABEL.NEUTRAL;
}

/**
 * A list's names as the shells draw them (EquipStation tickerLabel): strings, or the symbol / ticker of an object —
 * each name once, in order, as the server counts them (its extractTickerSymbols dedupes). ONE count per list: the
 * card, its label and the watchlist sheet's rows all read this (BUILD_RULES §9).
 */
export function symbolsOf(list) {
  const tickers = Array.isArray(list?.tickers) ? list.tickers : [];
  const names = [];
  for (const t of tickers) {
    const symbol = typeof t === 'string' ? t : t?.symbol || t?.ticker;
    if (typeof symbol === 'string' && symbol !== '' && !names.includes(symbol)) names.push(symbol);
  }
  return names;
}

const nonEmpty = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);

/**
 * The watchlist card's state. `committed` is the COMMITTED lists the reader
 * returned (the shells' filterWatchlistsByStatus(list, 'committed')); the
 * equipped one is found among them by id, as the shells do. A list that is
 * equipped but not among them — deleted, or back to draft — is `unavailable`;
 * a read that failed is `error`, which is not the same thing (spec §3: loading
 * and absence are distinct from failure).
 *
 * `listsReadFor` is the id that was equipped when those lists were read
 * (hub/useHubLoadout.js `readFor`). Lists read under ANOTHER id say nothing about
 * this one — the equip happened elsewhere, after the read — so "not among them" is
 * not yet an answer and the card reads `loading` while the read for it is in
 * flight. Left out (undefined), the lists are taken to be current.
 */
export function deriveWatchlist({ agent, committed, listsStatus, listsReadFor, hypothesisRecordsOn, ideaAccess }) {
  const id = nonEmpty(agent?.equippedWatchlistId);
  const base = { id, name: null, symbols: [], count: 0, idea: IDEA_LABEL.NEUTRAL };
  if (!id) return { ...base, state: WATCHLIST_STATE.NONE };
  // The agent document carries the equipped list's name, so the card can name it before the lists arrive.
  const stored = nonEmpty(agent.equippedWatchlistName);
  if (listsStatus === LISTS_STATUS.ERROR) return { ...base, name: stored, state: WATCHLIST_STATE.ERROR };
  if (listsStatus !== LISTS_STATUS.READY) return { ...base, name: stored, state: WATCHLIST_STATE.LOADING };
  const found = (Array.isArray(committed) ? committed : []).find((list) => list?.watchlistId === id);
  if (!found) {
    const stale = listsReadFor !== undefined && listsReadFor !== id;
    return { ...base, name: stored, state: stale ? WATCHLIST_STATE.LOADING : WATCHLIST_STATE.UNAVAILABLE };
  }
  const symbols = symbolsOf(found);
  return {
    id,
    name: nonEmpty(found.name) || stored,
    symbols,
    count: symbols.length,
    idea: ideaLabelKind(found, hypothesisRecordsOn, ideaAccess),
    state: WATCHLIST_STATE.READY,
  };
}

/**
 * Is the loadout locked in a live game? ONE predicate drives the card's
 * "Locked in battle" line and every picker's disabled state (BUILD_RULES §9).
 * It is the union of the shells' two expressions of the same lock:
 *   - the shells' label (`deriveDeployGate(...).equipLocked`, computed from the
 *     active-battle poll the shells filter by `status === 'active'`), and
 *   - the shells' slots (`Boolean(agent.activeBattleId)`, the field the server
 *     checks: changes mid-battle answer 409).
 * With the concurrency flag on, as shipped, `equipLocked` IS the agent field, so
 * the two agree; with it off they can differ for one poll interval, and the hub
 * is then never less locked than either shell surface.
 */
export function equipLockOf({ agent, activeAgentBattles, concurrencyEnabled }) {
  const liveBattles = (Array.isArray(activeAgentBattles) ? activeAgentBattles : []).filter((battle) => battle?.status === 'active');
  const { equipLocked } = deriveDeployGate({ liveBattles, agent, concurrencyEnabled: concurrencyEnabled === true });
  return equipLocked === true || Boolean(agent?.activeBattleId);
}

/**
 * The Loadout section (hub/hubModel.js). `status` is the agent's: `loading`
 * until the ranked agent resolves, `none` when it resolved to no agent (the
 * hook has no error channel: a failed subscription also resolves to null), else
 * `ready` — the cards then carry their own states, so a slow lists read never
 * hides the archetype.
 *
 * @param {object}  p
 * @param {object|null} p.agent          the ranked agent doc (the useAgent hook's legacy `agent` field)
 * @param {boolean} p.agentLoading       that hook's legacy `loading` field
 * @param {{ name: string, approach: (string|null) }} p.archetype  hub/archetypeLines.js
 * @param {Array<{ id: string, filled: boolean }>} p.slots  getEquipSlots(agent)
 * @param {{ equipped: boolean, count: number, name: string, sub: string }} p.adjustments  getTraitSlotSummary(agent)
 * @param {Array}   p.committed          the committed lists the reader returned
 * @param {string}  p.listsStatus        LISTS_STATUS
 * @param {string|null|undefined} p.listsReadFor  the equipped id when the lists were read (hub/useHubLoadout.js)
 * @param {Array}   p.activeAgentBattles App's active-battle poll (the shells' input)
 * @param {boolean} p.concurrencyEnabled CASUAL_CLONE_CONCURRENCY_ENABLED
 * @param {boolean} p.hypothesisRecordsOn HYPOTHESIS_RECORDS_ENABLED
 * @param {string}  p.ideaAccess         IDEA_ACCESS: S5 passes UNKNOWN (the neutral label); S6 supplies the server's answer
 * @param {boolean} p.characterTab       RELEASE3_CHARACTER_TAB_ENABLED: the Forge's `traits` area is then "Character"
 */
export function deriveLoadout({
  agent, agentLoading, archetype, slots, adjustments, committed, listsStatus, listsReadFor, activeAgentBattles, concurrencyEnabled, hypothesisRecordsOn, ideaAccess, characterTab,
}) {
  if (!agent) return { status: agentLoading === true ? LOADOUT_STATUS.LOADING : LOADOUT_STATUS.NONE };
  const lockedInGame = equipLockOf({ agent, activeAgentBattles, concurrencyEnabled });
  const hasTraitsSlot = (Array.isArray(slots) ? slots : []).some((slot) => slot?.id === 'traits');
  return {
    status: LOADOUT_STATUS.READY,
    identity: { name: nonEmpty(agent.name) },
    archetype,
    watchlist: deriveWatchlist({ agent, committed, listsStatus, listsReadFor, hypothesisRecordsOn, ideaAccess }),
    // Only where the shells have the slot (TRAIT_SLOT_ENABLED): getEquipSlots decides, as it does for them.
    // `door` names the Forge area the adjustments' Forge action opens: the same `traits` area, whose tab reads
    // "Character" only while RELEASE3_CHARACTER_TAB_ENABLED is on (ForgeWorkshop.jsx navItems).
    adjustments: hasTraitsSlot && adjustments
      ? { equipped: adjustments.equipped === true, name: adjustments.name, sub: adjustments.sub, door: characterTab === true ? FORGE_DOOR.CHARACTER : FORGE_DOOR.TRAITS }
      : null,
    lockedInGame,
  };
}

const isCount = (n) => Number.isSafeInteger(n) && n >= 0;

/**
 * The career record (spec §7, ruling R-S5-3): the stored wins and losses as
 * `${wins}W-${losses}L`, draws excluded, no win rate, no rebuilt aggregate.
 * Absent or malformed operands read `unavailable` — never synthesized zeros
 * (useAgent's own `record` string would print "0-0" for a missing stats object
 * and "undefinedW-…" for a partial one, which is why it is not used here).
 */
export function deriveCareer({ agent, agentLoading }) {
  if (!agent) return { status: agentLoading === true ? CAREER_STATUS.LOADING : CAREER_STATUS.UNAVAILABLE };
  const wins = agent.stats?.wins;
  const losses = agent.stats?.losses;
  if (!isCount(wins) || !isCount(losses)) return { status: CAREER_STATUS.UNAVAILABLE };
  return { status: CAREER_STATUS.READY, record: `${wins}W-${losses}L` };
}
