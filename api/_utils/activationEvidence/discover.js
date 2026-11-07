// api/_utils/activationEvidence/discover.js
//
// ID-1 Build 2 — A BATTLE'S ACTIVATIONS (contract §4.1, §4.3, §8).
//
// From a battle and its lifetimes (lifetimes.js): the activations (one per stock
// lifetime of the owner's tiered slots: every starting stock position, every
// executed stock swap-in), each with its id, kind, normalised ISO instant and
// source; the crypto lifetimes skipped, counted; the unresolved ones by reason;
// and the battle's schedule (cutoffAt, expiresAt, terminal) for finalisation.
//
// And THE KEY an activation is served by (contract §8 "The call"): the instant
// in epoch milliseconds → lastCompletedSessionAt → `ok` checked before `session`
// is read → the store's own snapshotIdOf, which refuses a dotted or suffixed
// symbol (`symbol_form`, never repaired). `calendar_missing` (an unmaintained
// year) is no key: the activation is deferred, never written (V1.7 §4.2).
//
// Pure. Its two store imports are the store's pure modules (key.js, and
// sessionAt.js, which reaches marketDataCache.js for toEtParts: that module
// loads firebase-admin at its top but does no I/O on import).
// setupEvidenceImportGuard.test.js lists this file by name.

import { lastCompletedSessionAt } from '../setupEvidence/sessionAt.js';
import { snapshotIdOf } from '../setupEvidence/key.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { lifetimesOf } from './lifetimes.js';
import { scheduleOf } from './schedule.js';

/**
 * @param {object} battle the battle document's data (an in-scope battle; scope.js decides that)
 * @returns {{
 *   gap: boolean,
 *   activations: Array<{ activationId, kind, symbol, tier, slot, route, activatedAt, activatedAtMs, activatedAtSource, row }>,
 *   unresolved: Array<{ kind, tier, slot, reason }>,
 *   cryptoSkipped: number,
 *   schedule: { terminal: boolean, expiresAtMs: number|null, cutoffAtMs: number|null },
 * }}
 */
export function discoverActivations(battle) {
  const { gap, records } = lifetimesOf(battle);
  const activations = [];
  const unresolved = [];
  let cryptoSkipped = 0;
  for (const r of records) {
    if (r.status === 'crypto') cryptoSkipped += 1;
    else if (r.status === 'unresolved') unresolved.push({ kind: r.kind, tier: r.tier, slot: r.slot, reason: r.reason });
    else {
      activations.push({
        activationId: r.activationId, kind: r.kind, symbol: r.symbol, tier: r.tier, slot: r.slot, route: r.route,
        activatedAt: r.activatedAt, activatedAtMs: r.activatedAtMs, activatedAtSource: r.activatedAtSource, row: r.row,
      });
    }
  }
  return { gap, activations, unresolved, cryptoSkipped, schedule: scheduleOf(battle) };
}

/** The rule set as deployed (the evaluator's describeRuleSet): what the store keys every snapshot by. */
export const currentRuleSet = () => describeRuleSet();

/**
 * The snapshot key that serves an activation, under the rule set `ruleSet`.
 *
 * @returns {{ ok: true, session: string, relation: string, snapshotId: string }
 *   | { ok: false, reason: 'calendar_missing' | 'symbol_form' }}
 * @throws {TypeError} on a malformed rule set (a programming error, never an activation's fault)
 */
export function activationKeyOf(activation, ruleSet) {
  const at = lastCompletedSessionAt(activation.activatedAtMs);
  if (!at.ok) return { ok: false, reason: 'calendar_missing' };
  try {
    return { ok: true, session: at.session, relation: at.relation, snapshotId: snapshotIdOf({ session: at.session, symbol: activation.symbol, ruleSet }) };
  } catch (err) {
    if (err instanceof TypeError && /malformed symbol/.test(err.message)) return { ok: false, reason: 'symbol_form' };
    throw err;
  }
}
