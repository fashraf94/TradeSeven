// src/components/Research/BattleResearch/groups.js
//
// Battle Research Slice 1 — A RESULT'S MEMBERSHIP (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-4, BRS-6, BRS-15). PURE and
// NODE-CLEAN. The two groups are battleUniverse.researchGroupsOf's (the bench
// roster's own walk, extended — never re-derived); each name keeps its group
// tags and its eligibility, which is callRecords/swappable.js canComeIn (the
// swap's own five facts, restated once for every surface) at the result's
// `takenAt`: OUT is the incumbent on the weakest question, none on a group
// question.
//
// A result freezes the WHOLE membership — both groups, deduped — so a group
// switch or a condition re-runs over the same frozen evidence and reads
// nothing (BRS-14); the step's view picks the group.

import { researchGroupsOf } from '../../../data/battleUniverse.js';
import { canComeIn } from '../../../../api/_utils/callRecords/swappable.js';

const CRYPTO_SUFFIX = /\.CC$/i;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Is a bench-list name crypto, as the swap reads it: the crypto slot, a bench row's isCrypto, or a .CC suffix. */
export function isCryptoName(battle, symbol) {
  const bench = battle?.portfolio?.bench;
  if (bench?.crypto?.symbol === symbol) return true;
  const row = (Array.isArray(bench?.stocks) ? bench.stocks : []).find((s) => s?.symbol === symbol);
  if (row?.isCrypto === true) return true;
  return CRYPTO_SUFFIX.test(symbol || '');
}

/** The persisted bench row's cooldown, as epoch ms (a lock names its time). */
function cooldownMsOf(battle, symbol) {
  const bench = battle?.portfolio?.bench;
  const row = (Array.isArray(bench?.stocks) ? bench.stocks : []).find((s) => s?.symbol === symbol)
    ?? (bench?.crypto?.symbol === symbol ? bench.crypto : null);
  const ms = row?.cooldownUntil ? Date.parse(row.cooldownUntil) : Number.NaN;
  return finite(ms) ? ms : null;
}

/**
 * BRS-15 — one name's eligibility at `atMs`: canComeIn against OUT (the incumbent, or none).
 * @returns {{ ok: boolean, reason: string|null, lockedUntil: number|null }}
 */
export function eligibilityOf(battle, { out = null, slot = null, symbol, atMs }) {
  const v = canComeIn({ battle, out, slot, inSymbol: symbol, atMs });
  if (v.ok) return { ok: true, reason: null, lockedUntil: null };
  return { ok: false, reason: v.reason, lockedUntil: v.reason === 'pick_locked' ? cooldownMsOf(battle, symbol) : null };
}

/**
 * The result's membership: every name on the bench and the agent watchlist (the union, bench
 * first, in roster order), each with its tags, its class and its eligibility; and the held names
 * the lists carry, left out as `held`.
 * @param {object} battle
 * @param {{ out?: string|null, slot?: string|null, atMs: number }} p
 */
export function membershipOf(battle, { out = null, slot = null, atMs }) {
  const g = researchGroupsOf(battle);
  const order = [...g.bench, ...g.agentWatchlist.filter((s) => !g.bench.includes(s))];
  return {
    membership: order.map((symbol) => ({
      symbol,
      groups: [...g.membership[symbol]],
      isCrypto: isCryptoName(battle, symbol),
      eligibility: eligibilityOf(battle, { out, slot, symbol, atMs }),
    })),
    excluded: g.held.map((symbol) => ({ symbol, reason: 'held' })),
  };
}

/** Does a member belong to the view's group? 'union' is the weakest and moving questions' whole set. */
export function inGroup(member, group) {
  if (group === 'bench') return member.groups.includes('bench');
  if (group === 'agent_watchlist') return member.groups.includes('agent_watchlist');
  return true;
}
