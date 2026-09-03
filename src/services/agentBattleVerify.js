// src/services/agentBattleVerify.js
//
// Deploy Ceremony · PR 2 — the existence check behind terminal-state honesty.
//
// THE PRINCIPLE: the client may not make a claim about server state it has not
// verified. Before this module the ceremony asserted "no battle was created"
// from the shape of a failure alone, and in the founding incident it was wrong —
// the battle existed. A direct re-read of `agentBattles` is the only sound
// signal; see THE FAILURE MODEL below for why no cheaper one will do.
//
// ── THE FAILURE MODEL (canonical) ───────────────────────────────────────────
// Every other file in this seam points HERE rather than restating this, because
// it is pinned to line numbers in a FENCED file (`api/agent/decide.js`) that no
// PR on this seam may edit or keep in sync. Re-verify at your HEAD before
// relying on the numbers; the SHAPE is what matters and it is stated first.
//
// SHAPE. `decide.js` runs one big `try` (opens `:131`) whose catch returns a
// single 500 (`:1012`). Inside it, the battle is committed at `:910`. Every
// deliberate refusal returns a specific 4xx/409/503 and returns BEFORE `:910`
// (`:106`, `:111`, `:140`, `:153`, `:165`, `:168`, `:171`, `:178`, `:187`,
// `:298`, `:337`, `:844`, `:907`).
//
// WHAT THAT LICENSES. A status OTHER than 500 proves the server refused before
// it could create anything. That inference is sound and the ceremony's
// attribution gate rests on it.
//
// WHERE THE INFERENCE STOPS — the converse is NOT true. The `try` opens at
// `:131`, roughly 780 lines before the commit, so the SAME 500 is returned for a
// throw anywhere BEFORE `:910` too — including both Anthropic calls, which are
// the dominant failure of this endpoint. A 500 therefore means "a battle MAY
// exist", never "a battle from THIS deploy exists". Anything that needs the
// stronger reading needs a different key: the league filter below, or the
// battle-id round-trip that PR 4 owns. Reading the first half without this one
// is what produced the false-reveal defect this filter now closes.
//
// THE POST-COMMIT WINDOW. `:929` (`await agentRef.update({ activeBattleId })`)
// is the only statement that can throw between the commit at `:910` and the 200
// at `:963` — `generateFirstMessageOnDeploy` (`:936`) swallows everything in its
// own outer catch and `logDecision` (`:944`) is `.catch()`-guarded. So a `:929`
// rejection leaves a DURABLE battle behind a 500, and `activeBattleId` is
// guaranteed ABSENT on the agent doc: that write IS the statement that threw.
//
// WHY THE CHEAP SIGNALS ARE NOT EVIDENCE.
//   - `errorPhase: 'post_decision'` only means the decision persisted at
//     `decide.js:704`, which PRECEDES battle creation at `:910`.
//   - `deployProgress.stage: 'complete'` is written at `decide.js:690`, also
//     before `:910`, and the 503/409 gates at `:841-853` / `:905-908` return
//     without throwing after it.
// ────────────────────────────────────────────────────────────────────────────
//
// The query mirrors the server's own write at `agentBattleService.js:129-132`
// (`agentId` / `ownerId` / `status`) and the `agentBattles` read rule
// (`firestore.rules`: `resource.data.ownerId == request.auth.uid`), which is why
// `ownerId` is a query key and not a post-filter.
//
// Keyed on the DEPLOY TARGET's id, never the ranked `agent.id`: the battle's
// `agentId` is `agentData.id` — the document decide.js was POSTed — which is the
// CLONE on the casual-clone path. Keyed on the ranked id this returns empty every
// time and would report "no battle" with total confidence, in exactly the case
// this check exists to prevent.
//
// Deliberately NOT `useAgentBattleId`: that hook reads `auth.currentUser` inside
// an effect keyed only on `agentId`, so it never re-runs when auth resolves late.
// Fixing it belongs to the codebase-wide audit, not here.

import { collection, query, where, limit, getDocsFromServer } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { classifyBattleType, BATTLE_TYPE_BAGGERBOMB } from '../utils/commandCenterLiveBattles';

const BATTLES_COLLECTION = 'agentBattles';

// Read a HANDFUL, not one. Both filters below run client-side on the documents
// already fetched, so `limit(1)` would let a stale sibling — an expired doc still
// stamped `active`, or a league battle on the same target — be the ONE document
// the query returns, get filtered out, and report a definitive "no battle" while
// a live one sits in the collection. The query has no `orderBy`, so WHICH doc
// comes back is not ours to choose. Two `active` docs is constructible via the
// same blind spot at `decide.js:709-713`, which also reads with `limit(1)` and
// sweeps only the one it happened to get. Small enough to stay one round trip.
const BATTLE_SCAN_LIMIT = 5;

/**
 * One direct read for a live Command-Center battle owned by the caller on
 * `targetAgentId`.
 *
 * Resolves `{ found, battle }` — `battle` is the full doc plus its id, so the
 * caller can route straight into the Battle View without a second read (and
 * WITHOUT `agent.activeBattleId`, which in the `:929` scenario is guaranteed
 * absent — see THE FAILURE MODEL above).
 *
 * THROWS on anything that prevents the check from completing — no target, no
 * resolved auth, a permission error, a transport failure, an unreachable server.
 * A caller must treat a throw as "we do not know", never as "nothing happened":
 * returning a falsy `found` for an unreadable query would let a failed check
 * author a stronger claim than the one it replaced.
 */
export async function findActiveBattleForAgent(targetAgentId) {
  if (!targetAgentId) throw new Error('agentBattleVerify: no deploy target id');
  const uid = auth?.currentUser?.uid;
  // Not a "no battle" answer: without a uid the query is not even expressible
  // under the read rule, so nothing was learned.
  if (!uid) throw new Error('agentBattleVerify: no authenticated user');

  const q = query(
    collection(db, BATTLES_COLLECTION),
    where('agentId', '==', targetAgentId),
    where('ownerId', '==', uid),
    where('status', '==', 'active'),
    limit(BATTLE_SCAN_LIMIT),
  );

  // FROM THE SERVER, explicitly. Plain `getDocs` resolves from the local cache
  // when the server cannot be reached — the SDK's own contract: "attempts to
  // provide up-to-date data ... but it MAY RETURN CACHED DATA or fail if you are
  // offline". It does not throw in that case, so an empty cache-served snapshot
  // would become a definitive `found: false` and, beside a server error signal
  // the machine already latched, would license "no battle was created" — the
  // founding defect of this whole arc, regenerated by a read that verified
  // nothing. `getDocsFromServer` errors when the network is unavailable, and
  // that throw is the honest answer: the caller routes it to "lost contact".
  const snapshot = await getDocsFromServer(q);
  if (snapshot.empty) return { found: false, battle: null };

  for (const docSnap of snapshot.docs) {
    const battle = { id: docSnap.id, ...docSnap.data() };
    if (isExpired(battle)) continue;
    if (!isCommandCenterBattle(battle)) continue;
    return { found: true, battle };
  }
  return { found: false, battle: null };
}

// `status: 'active'` is not the same predicate the rest of the app uses for
// "live". decide.js:718-728 treats a past `expiresAt` as NOT live and sweeps such
// a doc to `completed` on the next deploy — the field is only reconciled lazily,
// so an expired battle sits in the collection still stamped 'active'. The whole
// authority of this check is that it is a direct re-read; re-reading a WEAKER
// predicate than the app's own would let it announce a finished battle as the one
// this deploy just created.
function isExpired(battle) {
  const raw = battle?.expiresAt;
  if (!raw) return false;                      // no clock is not an expired clock
  const at = raw?.toDate ? raw.toDate() : new Date(raw);
  const ms = at?.getTime?.();
  if (!Number.isFinite(ms)) return false;      // unparseable is not evidence either
  return ms < Date.now();
}

// ── SCOPE NARROWING, NOT ATTRIBUTION. Read this before touching it. ─────────
//
// This answers "is this a LEAGUE battle", not "did THIS deploy create it". It
// closes the false reveal because a `groupId`-bearing document is DEFINITIONALLY
// not from this deploy: the Command Center is BaggerBomb-only (Framework §3.1),
// its Deploy CTA never starts a league game, and `agentBattleService.js:137`
// stamps `groupId` on tournament docs only. Same discriminator the Manage card
// and the Sync Desk use (`classifyBattleType`) — a second one would let two
// surfaces disagree about which game is on screen.
//
// WHAT IT CLOSES. A 5xx thrown BEFORE the commit still satisfies the machine's
// attribution gate (see THE FAILURE MODEL above — the 500 is returned for
// pre-commit throws too). On the clone-fallback path the deploy target is the
// RANKED agent, `deployBlockedByLive` does not block a live ranked battle
// (`commandCenterLiveBattles.js:159` gates on BaggerBomb only), and the query
// would find the user's live league battle: "Deployment complete", the CTA opens
// a competitive game the user did not just deploy, and the picks on screen are
// the PREVIOUS deploy's (`lastDecision` is written at `:664-700`, after the model
// calls that threw).
//
// WHAT IT LEAVES OPEN — invariant 4 is NOT satisfied. A pre-existing CASUAL
// battle on the target is still unattributed. Nothing here excludes it; it is
// held shut by a TIMING COMPOSITION of two constants that cover complementary
// windows:
//   - `deployBlockedByLive` disables the CTA once the 120s `activeAgentBattles`
//     poll lands the battle, and
//   - the server's own 120s cooldown (`decide.js:187`) returns a 429 — which the
//     attribution gate excludes — for the whole window before the poll lands.
// Move either constant and the windows stop covering each other. Do NOT read
// this filter as closing invariant 4. Real attribution needs the client to know
// its own battle id, which means round-tripping it through the POST response —
// a fenced `decide.js` change that belongs to PR 4.
function isCommandCenterBattle(battle) {
  return classifyBattleType(battle) === BATTLE_TYPE_BAGGERBOMB;
}

export default findActiveBattleForAgent;
