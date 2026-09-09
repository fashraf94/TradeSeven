// src/screens/battleView/deriveHeard.js
//
// Heard — Phase B (B1 client half, seed §1). PURE.
//
// ONE CLAIM, AND IT IS EXACT (D-110, and the rule that governs every line of
// this phase): `Heard` = THIS THREAD WAS IN THE DECIDER'S PROMPT AT THAT
// CHECK. Never that the decider considered it, used it, noticed it, understood
// it, or decided because of it. Two verbs ship — Heard and Saw — and neither
// is ever upgraded.
//
// The proof is the server's own stamp, written by the cron that writes the
// entry, from the cron's OWN `resolveControls` call on the in-memory battle
// object — the same argument list the fenced assembler used, byte for byte
// (api/_utils/tickStamps.js `deriveHeardStamp`). It is NEVER the model's echo
// (`ignoredDirectiveIds` / the entry's own `directiveThreadId` are self-report
// — the basis of Acted, never of Heard).
//
//   suppressed === null   the assembler put the thread in the prompt → Heard.
//   suppressed a string   a directive existed and the assembler WITHHELD it
//                         ('malformed' | 'mode_not_enforce' | 'epoch_killed',
//                         or 'unknown' for a type-corrupt id) → NOT Heard.
//
// The four suppression words NEVER reach a surface (Sol M-1). They are
// resolver diagnostics, not character experience: the character never received
// the withheld directive, so a first-person "I didn't hear this because it was
// epoch-killed" attributes knowledge of a pre-prompt event to the character AND
// upgrades the verb in the same breath. The negative receipt is system-owned
// and reasonless — `NOT_HEARD_LINE` — and the reason stays in telemetry.
//
// PRESENCE-GATED, never flag-gated (D-113): no stamp, no line. Pre-flip
// entries, every `budget_skipped` entry and any entry whose prompt build threw
// carry no `heard` key at all, so this returns {} for them and every surface
// renders exactly what it renders today.
//
// THE MID-TICK CASE is why "nothing" is a first-class answer here: a filing
// that lands DURING a tick is stamped on the NEXT decided entry, not this one.
// So a freshly filed thread has no entry naming it and gets no line — the card
// is honest to say nothing, and the receipt appears one check later. The older
// thread keeps its last Heard as a past fact.

import { toIso } from '../../adapters/baggerbombAdapter';

/**
 * Every directive thread the record proves was — or was not — in front of the
 * decider, LAST ENTRY PER THREAD WINS (the newest check is the current truth;
 * a thread heard at 10:02 and withheld at 10:17 reads as withheld).
 *
 * A stamp is admitted only in the two shapes the server actually writes: a
 * `null` suppression (Heard) or a non-empty string one (not Heard). Anything
 * else is a shape the composer cannot produce, and this makes NO claim about
 * it rather than defaulting to the negative — "Not heard" is a claim too, and
 * an unrecognised stamp does not prove it.
 *
 * @param {Array} evaluations  battle.evaluations, in write order
 * @returns {{ [directiveThreadId: string]: { at: string|null, heard: boolean } }}
 *   `at` is the ISO timestamp of the entry that carried the stamp — the CHECK's
 *   own instant, rendered through the shared D-83 slot formatter by the copy
 *   layer and never as an exact minute.
 */
export function deriveHeard(evaluations) {
  const out = {};
  if (!Array.isArray(evaluations)) return out;
  for (const evaluation of evaluations) {
    const stamp = evaluation?.heard;
    if (!stamp || typeof stamp !== 'object') continue;
    const threadId = stamp.directiveThreadId;
    if (typeof threadId !== 'string' || !threadId) continue;
    const { suppressed } = stamp;
    const heard = suppressed === null;
    // Not Heard is a claim; only the server's own suppression strings prove it.
    if (!heard && !(typeof suppressed === 'string' && suppressed)) continue;
    out[threadId] = { at: toIso(evaluation.timestamp), heard };
  }
  return out;
}

export default deriveHeard;
