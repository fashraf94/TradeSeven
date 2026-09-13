// api/_utils/directiveTransaction.js
//
// THE ONE TRANSACTION A DIRECTIVE IS FILED IN — shared by the two routes that
// file one (PHASE_B_TICK_STAMPS_SPEC_V1.md §2, ruling: "extract
// `file-directive.js:196-299` into a sibling `api/_utils/directiveTransaction.js`;
// both routes import it; `directiveFiling.js` stays zero-import").
//
// It is the chip route's transaction, extracted UNCHANGED and then given two
// caller-selected policies so the typed route can share it:
//
//   · the chip  (api/agent/file-directive.js) — `conflict: 'reject'`,
//     `budget: 'reject'`: its pre-existing behaviour, byte for byte. Its suite
//     passes unchanged, which is the proof the extraction is faithful.
//   · the typed turn (api/agent/chat.js) — `conflict: 'replace-and-report'`
//     (spec ruling 4: latest-wins files anyway; the outcome records the ACTUAL
//     replaced thread from the in-transaction read) and
//     `budget: 'commit-over-budget'` (ruling 5: a race that produces an
//     eleventh COMMITS and stamps `overBudget: true` on the exchange — never
//     fail a turn after the model answered).
//
// WHAT IT OWNS (spec §2). Every precondition is re-read INSIDE the transaction,
// because the typed route's only battle read happens ~20 seconds and one model
// call before its write: `battle.directive.directiveThreadId`, `battle.status`,
// `battle[budgetField]`, and the League `agentChatBudget` doc via
// `resolveBudgetDay`. Then the mint, the slot and record build through
// `directiveFiling.js`, and the writes — ONE `tx.update` on the battle plus the
// cross-document League charge in the SAME transaction (ruling 5; D-105).
//
// D-105, IN TERMS: "charges `chatBudgetUsed` on the battle doc by an explicit
// in-transaction count (NEVER `FieldValue.increment`), the cap authoritative
// under a race." The count below is read inside the transaction and written as
// `used + 1`. `FieldValue` is imported here for `arrayUnion` on
// `chatExchanges` — and for nothing else.
//
// THE EXCHANGE IS THE CALLER'S (spec §2: "it takes the composed exchange as an
// argument … the chat turn's has a user half, the reply, the scratchpad, the
// gate outcome; the chip's does not"). It arrives as a BUILDER rather than a
// finished object, because the thread id it must carry is minted in here, on
// the attempt that commits — the same sentence that hands the module the
// exchange also hands it the mint, and a retry that re-mints must re-compose.
// The builder is called once per attempt with the id and the in-transaction
// battle; everything else it closes over is the caller's.
//
// THE ARCHETYPE ALLOWLIST STAYS IN THE CHIP ROUTE, deliberately: `resolveDirective`
// is a caller callback, so this module is NOT a new importer of
// `archetypeAdjustments.js` and the Spec §2.3 import-boundary ratchet is not
// touched by the extraction.
//
// Fence (BUILD_RULES §1): no fenced file edited or called. The battle doc's
// shape is fenced as a CONCEPT — this module writes EXISTING keys only
// (`directive`, `chatExchanges`, `chatBudgetUsed` / `reviewBudgetUsed`, plus
// whatever existing keys the caller's `buildBattleUpdate` returns); the League
// counter lives in its own collection for exactly that reason
// (agentChatBudget.js header). B2 adds no battle-doc key.
//
// Protected stores: this module's `tx.update` / `tx.set` are handle-form, so
// they carry their rows in compositionProtectedStoresAllowlist.json (spec §2).

import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { agentBelongsToBattle } from './agentBattleBinding.js';
import {
  resolveBudgetDay,
  agentChatBudgetDocId,
  AGENT_CHAT_BUDGET_COLLECTION,
  AGENT_CHAT_DAILY_LIMIT,
} from './agentChatBudget.js';
import { toIso } from './tournamentTime.js';
import { buildDirectiveRecord, buildDirectiveSlot } from './directiveFiling.js';

/**
 * What a stale `expectedDirectiveThreadId` means to the caller.
 *
 * REJECT — the chip's: its belief came from the server's last word, so a
 * changed thread means the tap was made against a screen that is no longer
 * true. Nothing is written; the route answers `conflict` with the current id.
 *
 * REPLACE_AND_REPORT — the typed turn's (spec ruling 4). The user typed a
 * sentence and a model answered it; refusing to file after that spends the
 * turn for nothing. It files, and the outcome carries the thread it actually
 * replaced — read inside the transaction, never the caller's stale belief.
 */
export const DIRECTIVE_CONFLICT_POLICY = Object.freeze({
  REJECT: 'reject',
  REPLACE_AND_REPORT: 'replace-and-report',
});

/**
 * What being at or over the cap means to the caller.
 *
 * REJECT — the chip's: no model was called, so refusing costs nothing.
 *
 * COMMIT_OVER_BUDGET — the typed turn's (spec ruling 5): "a race that produces
 * an eleventh COMMITS and stamps `overBudget: true` on the exchange — never
 * fail a turn after the model answered." The count is NOT incremented past the
 * cap (the soft cap `agentChatBudget.js`'s own charge helper documents for the
 * League store): an eleventh exchange lands, and the counter still reads ten.
 */
export const DIRECTIVE_BUDGET_POLICY = Object.freeze({
  REJECT: 'reject',
  COMMIT_OVER_BUDGET: 'commit-over-budget',
});

/** Every outcome the transaction can produce. The HTTP layer maps them. */
export const DIRECTIVE_OUTCOME = Object.freeze({
  FILED: 'filed',
  BATTLE_NOT_FOUND: 'battle_not_found',
  AGENT_NOT_FOUND: 'agent_not_found',
  FORBIDDEN_OWNER: 'forbidden_owner',
  FORBIDDEN_AGENT: 'forbidden_agent',
  BATTLE_NOT_ACTIVE: 'battle_not_active',
  CONFLICT: 'conflict',
  REJECTED: 'rejected',
  BUDGET_EXHAUSTED: 'budget_exhausted',
});

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const normalizeCount = (raw) => (Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0);

/**
 * Is this call's minted thread id ALREADY on the battle document — the slot, or
 * an exchange carrying it top-level?
 *
 * The id is minted once per CALL (never per attempt), from `randomUUID`, and
 * nothing else in the system can produce it. So finding it on the document
 * inside the transaction body is proof of exactly one thing: an earlier attempt
 * of THIS call committed. Both places are checked because the two writes land
 * together but do not stay together — a concurrent `replace-and-report` filing
 * can overwrite the slot after our commit, leaving the exchange as the only
 * surviving evidence.
 *
 * THE CONTRACT THIS PLACES ON EVERY CALLER'S `buildExchange`, stated because
 * nothing enforces it (adversarial review, Lens D, finding F-8): an exchange
 * that files a directive MUST carry `directiveThreadId` TOP-LEVEL. Both shipped
 * callers do (`chat.js`'s composed exchange and `file-directive.js`'s
 * `buildFiledExchange`), and each has rows on it. A third caller that omitted
 * it would get no evidence from the exchange, and — if the slot were replaced
 * between its commit and its re-run — would answer 409 over a filing of its own
 * that persisted and charged, which is the defect the no-op exists to remove.
 * The scan is a `some`, not a look at the last element: a narration write
 * (`voiceLayerAnticipation.js:128`, `:367`) appends to `chatExchanges` outside
 * any transaction, so our element is not reliably last (row A-2i).
 *
 * Exported for its rows, and because the recognition rule is the whole of the
 * no-op: if this predicate is wrong, the no-op is wrong.
 */
export function directiveThreadOnDocument(battle, directiveThreadId) {
  if (!battle || !nonEmpty(directiveThreadId)) return false;
  if (battle.directive?.directiveThreadId === directiveThreadId) return true;
  const exchanges = Array.isArray(battle.chatExchanges) ? battle.chatExchanges : [];
  return exchanges.some((e) => e?.directiveThreadId === directiveThreadId);
}

/**
 * The attestation every outcome carries (spec ruling 7). `persisted` and
 * `charged` are facts about THIS transaction, and only the transaction can
 * know them: a refusal decided inside the body wrote nothing, and a commit
 * that landed charged whatever it charged whether or not the reply reaches the
 * client. Three outcomes, of which this function states two — the third
 * (committed, then something after the commit threw) is the HTTP layer's,
 * because only it knows what ran after `runTransaction` returned.
 */

/**
 * Ruling 7's failure attestation, decided by WHERE the throw happened — which
 * is the only thing that makes `persisted` knowable.
 *
 * §2 names three outcomes: "threw BEFORE the transaction (nothing persisted,
 * nothing charged), rejected inside it (same), committed then threw (persisted
 * and charged)". The first and third are what the two `false` and `true`
 * branches below say.
 *
 * THE FOURTH POSITION IS THE ONE §2 DOES NOT NAME, and it is not invented away
 * here. When the transaction itself threw, the route does not know which side
 * of the commit it is on: `runTransaction` retries, and a commit that LANDED
 * whose reply was lost surfaces as a retryable error — exactly the hazard
 * `research.js:193-200` writes down for its own route. Claiming `false` there
 * would be the same defect this whole vocabulary exists to remove, one layer
 * down. So it says it does not know (`null`, never `false`), and both reader
 * helpers in `decisionRecord.js` test for `=== true` / `=== false`, so an
 * unknown reads as no claim on either side. Reported for a founder ruling
 * rather than settled here.
 *
 * @param {{ committed: object|null, attempted: boolean, reason: string }} at
 */
export function attestThrown({ committed = null, attempted = false, reason }) {
  if (committed) return { persisted: true, charged: committed.charged, reason };
  if (attempted) return { persisted: null, charged: null, reason };
  return { persisted: false, charged: false, reason };
}

/**
 * Run the filing transaction.
 *
 * @param {object} db                       the Firestore admin handle
 * @param {object} opts
 * @param {object} opts.battleRef           `agentBattles/{battleId}`
 * @param {object} [opts.agentRef]          `agents/{agentId}` — required when `readAgent`
 * @param {string} opts.agentId             the agent the caller named
 * @param {string} opts.uid                 the AUTHENTICATED uid (never the body's)
 * @param {boolean} [opts.readAgent]        read the agent doc in-transaction (the chip
 *                                          needs it for the server-derived archetype; the
 *                                          typed turn read it before the model and its
 *                                          `resolveDirective` does not use it)
 * @param {boolean} [opts.requireActive]    reject a non-active battle (false only for the
 *                                          typed route's review mode, which is valid on a
 *                                          completed battle — chat.js step 9)
 * @param {string|null} opts.expectedDirectiveThreadId  the caller's belief about the
 *                                          current directive (null = none)
 * @param {string} opts.conflictPolicy      DIRECTIVE_CONFLICT_POLICY
 * @param {string} opts.budgetPolicy        DIRECTIVE_BUDGET_POLICY
 * @param {(battle: object, agent: object|null) => ({ normalized: object|null }|{ rejected: object })}
 *        opts.resolveDirective             the directive to file, resolved against the
 *                                          in-transaction battle. `{ normalized: null }`
 *                                          = this turn files no directive (the common
 *                                          typed turn): the exchange and the charge still
 *                                          land, the slot is untouched.
 * @param {(battle: object) => boolean} opts.isLeagueBudget  which store this filing charges
 * @param {{ field: string, limit: number }|null} [opts.battleBudget]  the battle-doc
 *                                          counter, when `isLeagueBudget` is false
 * @param {(ctx: object) => object} opts.buildExchange  the composed exchange, given
 *                                          `{ battle, agent, directiveRecord,
 *                                            directiveThreadId, createdAt, overBudget }`
 * @param {(battle: object) => object} [opts.buildBattleUpdate]  further EXISTING battle
 *                                          keys to write in the same `tx.update`
 */
export async function runDirectiveTransaction(db, {
  battleRef,
  agentRef = null,
  agentId,
  uid,
  readAgent = true,
  requireActive = true,
  expectedDirectiveThreadId = null,
  conflictPolicy = DIRECTIVE_CONFLICT_POLICY.REJECT,
  budgetPolicy = DIRECTIVE_BUDGET_POLICY.REJECT,
  resolveDirective,
  isLeagueBudget,
  battleBudget = null,
  buildExchange,
  buildBattleUpdate = null,
}) {
  // ONE id and ONE instant per CALL, not per attempt (review lens A, finding
  // A-2). `runTransaction` re-runs the body on a retryable commit error — and a
  // commit that LANDED whose reply was lost surfaces as exactly that. Minting
  // inside the body made the exchange a DIFFERENT object on each attempt, so
  // `arrayUnion` appended it twice and the second attempt stranded the first
  // thread id on a persisted exchange. Minting once per call restores the
  // property the pre-B2 write had for free: the element is byte-identical
  // across attempts, and `arrayUnion` is set-semantics on deep equality, so a
  // re-run cannot duplicate the turn.
  //
  // KNOWN LIMIT, stated rather than papered over: the element is only
  // byte-identical if the caller's `buildExchange` is. It is, on every field
  // but `overBudget`, which is read from the document — so a retry that crosses
  // the cap between attempts composes a different element and the dedupe does
  // not apply.
  //
  // …and the id is also this call's SIGNATURE on the document, which is what
  // the no-op below recognises. See the block at the top of the body.
  const mintedThreadId = randomUUID();
  const now = new Date();
  const createdAt = now.toISOString();
  // Which attempt this is. A refusal decided on a RE-RUN cannot prove that
  // nothing landed — the re-run may be reading this transaction's OWN commit
  // (finding A-1) — so it says so instead of claiming `false`. It STAYS after
  // the no-op below, because the no-op only proves a commit landed when the
  // filing carried a thread id: a turn that files no directive leaves this
  // call no signature, and a refusal on its re-run still cannot know.
  let attempt = 0;
  // The outcome the attempt that COMMITTED computed. The body buffers its
  // writes and sets this immediately before it returns, so a commit that
  // landed cannot exist without it — which is what lets the no-op answer with
  // what the write actually did rather than re-deriving it from the document.
  let committedOutcome = null;

  return db.runTransaction(async (tx) => {
    attempt += 1;
    const refusal = (kind, extra = {}) => ({
      kind,
      persisted: attempt > 1 ? null : false,
      charged: attempt > 1 ? null : false,
      reason: kind,
      ...extra,
    });

    // ---- reads (all before any write — Firestore's transaction contract) ----
    const battleSnap = await tx.get(battleRef);
    if (!battleSnap.exists) return refusal(DIRECTIVE_OUTCOME.BATTLE_NOT_FOUND);
    const battle = battleSnap.data();

    // ---- CHECK 0 — THE COMMIT THAT ALREADY LANDED (founder ruling on the
    // build report's §7; §7-A). `runTransaction` re-runs the body on a
    // retryable commit error, and a commit that LANDED whose reply was lost
    // surfaces as exactly that. On a re-run, the minted id is this call's own
    // signature on the document — nothing else can write it — so finding it
    // proves the prior attempt committed. The outcome is therefore already
    // settled, and the only correct thing to do is report it and WRITE NOTHING.
    //
    // It is above every other check, deliberately. A commit that landed is a
    // fact; a battle that has completed, changed hands or had its directive
    // replaced since must not turn a filing that persisted into a refusal
    // claiming it did not. This is also what makes the answer the same under
    // BOTH conflict policies: `reject` would otherwise re-read its own new
    // thread id and answer `conflict` (a 409 whose own commit had filed and
    // charged), and `replace-and-report` would file a SECOND directive and
    // charge a second message.
    //
    // It answers with the outcome the committing attempt computed, so
    // `charged`, `remaining` and the replaced-thread report are what the write
    // that landed actually did rather than a re-derivation from a document
    // another writer may have touched since. Both conditions are required, and
    // the invariant ties them: the body buffers its writes and sets
    // `committedOutcome` before it returns, so evidence on the document cannot
    // exist without it. If it somehow did, this falls through to today's
    // behaviour rather than to a fabricated receipt.
    if (attempt > 1 && committedOutcome && directiveThreadOnDocument(battle, mintedThreadId)) {
      return committedOutcome;
    }

    // Check 1 — the authenticated owner.
    if (battle.ownerId !== uid) return refusal(DIRECTIVE_OUTCOME.FORBIDDEN_OWNER);
    // Check 2 — the battle is active. RE-READ, not carried: `agent-evaluate`
    // flips a battle to `completed` on its own schedule, and the typed route's
    // pre-model read is a model call old by the time it gets here.
    if (requireActive && battle.status !== 'active') return refusal(DIRECTIVE_OUTCOME.BATTLE_NOT_ACTIVE);
    // Check 3 — the agent belongs to this battle.
    if (!agentBelongsToBattle(battle, agentId)) return refusal(DIRECTIVE_OUTCOME.FORBIDDEN_AGENT);
    // Check 4 — the client's belief about the current directive, against the
    // slot as it is NOW. Under `reject` a stale belief writes nothing; under
    // `replace-and-report` it files and `replacedDirectiveThreadId` carries the
    // thread this filing actually replaced.
    const currentThreadId = typeof battle.directive?.directiveThreadId === 'string' && battle.directive.directiveThreadId
      ? battle.directive.directiveThreadId
      : null;
    const staleExpectation = currentThreadId !== expectedDirectiveThreadId;
    if (staleExpectation && conflictPolicy === DIRECTIVE_CONFLICT_POLICY.REJECT) {
      return refusal(DIRECTIVE_OUTCOME.CONFLICT, { currentDirectiveThreadId: currentThreadId });
    }

    let agent = null;
    if (readAgent) {
      const agentSnap = await tx.get(agentRef);
      if (!agentSnap.exists) return refusal(DIRECTIVE_OUTCOME.AGENT_NOT_FOUND);
      agent = agentSnap.data();
    }

    // Checks 5 and 6 — what this filing actually files, resolved against the
    // in-transaction battle (the chip derives the archetype and its canonical
    // text here; the typed turn hands over what its gate already minted).
    const resolved = resolveDirective(battle, agent);
    if (resolved?.rejected) return refusal(DIRECTIVE_OUTCOME.REJECTED, { archetype: resolved.rejected.archetype ?? null });
    const normalized = resolved?.normalized ?? null;

    // Check 8 — the budget, from the store the caller named.
    const isLeague = isLeagueBudget(battle);
    let remaining = null;
    let charged = false;
    let overBudget = false;
    let commitBudget = () => {};
    let battleBudgetUpdate = {};
    if (isLeague) {
      // The League store: the group read derives the game day (the same
      // index the daily close writes); null = unkeyable → FAIL-OPEN, the
      // chat route's own contract (file for free, never a placeholder day).
      const key = await resolveBudgetDay(db, battle);
      if (key) {
        const budgetRef = db.collection(AGENT_CHAT_BUDGET_COLLECTION).doc(agentChatBudgetDocId(key.groupId, uid, key.dayN));
        const budgetSnap = await tx.get(budgetRef);
        const count = budgetSnap.exists ? normalizeCount(budgetSnap.data()?.count) : 0;
        if (count >= AGENT_CHAT_DAILY_LIMIT) {
          if (budgetPolicy === DIRECTIVE_BUDGET_POLICY.REJECT) return refusal(DIRECTIVE_OUTCOME.BUDGET_EXHAUSTED);
          overBudget = true;
          remaining = 0;
        } else {
          const next = count + 1;
          remaining = Math.max(0, AGENT_CHAT_DAILY_LIMIT - next);
          charged = true;
          commitBudget = () => tx.set(budgetRef, {
            groupId: key.groupId,
            uid,
            dayN: key.dayN,
            count: next,
            updatedAt: toIso(now),
          }, { merge: true });
        }
      }
    } else if (battleBudget) {
      const used = normalizeCount(battle[battleBudget.field]);
      if (used >= battleBudget.limit) {
        if (budgetPolicy === DIRECTIVE_BUDGET_POLICY.REJECT) return refusal(DIRECTIVE_OUTCOME.BUDGET_EXHAUSTED);
        overBudget = true;
        remaining = 0;
      } else {
        remaining = Math.max(0, battleBudget.limit - (used + 1));
        charged = true;
        // An explicit count, not FieldValue.increment: the in-transaction
        // read is what makes the cap authoritative under a race (D-105).
        battleBudgetUpdate = { [battleBudget.field]: used + 1 };
      }
    }

    // ---- the write ----
    const directiveThreadId = normalized ? mintedThreadId : null;
    const directiveRecord = normalized ? buildDirectiveRecord(normalized, directiveThreadId) : null;
    const slot = normalized ? buildDirectiveSlot(normalized, directiveThreadId, createdAt) : null;
    const exchange = buildExchange({
      battle,
      agent,
      directiveRecord,
      directiveThreadId,
      createdAt,
      overBudget,
    });

    // The caller's extra keys are spread FIRST (review lens A, finding A-6): a
    // `buildBattleUpdate` that happened to return `directive` or the budget
    // field would otherwise silently override the two keys this module owns.
    // The module's own writes win by construction, not by convention.
    tx.update(battleRef, {
      ...(buildBattleUpdate ? buildBattleUpdate(battle) : {}),
      chatExchanges: FieldValue.arrayUnion(exchange),
      ...(slot ? { directive: slot } : {}),
      ...battleBudgetUpdate,
    });
    commitBudget();

    // Stashed BEFORE the return, and after the writes are buffered: a commit
    // can only land for a body that got this far, so check 0 above can rely on
    // this being the outcome of the attempt whose writes it is looking at.
    committedOutcome = {
      kind: DIRECTIVE_OUTCOME.FILED,
      // Ruling 7: this side of the commit is known here. `charged` is false on
      // a fail-open League filing (no keyable day) and on an over-budget
      // eleventh — both persist, neither costs a message.
      persisted: true,
      charged,
      reason: null,
      directive: slot,
      directiveThreadId,
      // `replaced-prior` whenever a directive WAS current — a legacy slot with
      // text but no thread id (pre-Phase-7) is replaced too, even though no
      // thread can be named for it (review R-19).
      replacedPrior: !!(currentThreadId || nonEmpty(battle.directive?.text)),
      // The ACTUAL replaced thread, from the in-transaction read (ruling 4) —
      // null when this turn filed no directive, because nothing was replaced.
      replacedDirectiveThreadId: normalized ? currentThreadId : null,
      // The slot as it was when the transaction that committed read it. The
      // typed route answers `currentDirectiveThreadId` from this, so what it
      // tells the client is the server's last word rather than a guess made
      // one model call ago.
      priorDirectiveThreadId: currentThreadId,
      // …and whether the caller's belief was already stale when it got here.
      // The chip never sees this (it refuses instead); the typed route uses it
      // to tell the player a filing they never saw has just been replaced.
      staleExpectation: !!normalized && staleExpectation,
      overBudget,
      remaining,
    };
    return committedOutcome;
  });
}
