// api/film-room/counter.js
//
// Film Room B2 item 6 — GET /api/film-room/counter?agentId=…[&from=YYYY-MM-DD&to=YYYY-MM-DD]
// (Build B spec §5; Amendment G RG-4). The owner comes from the ID token; the
// mode and the owner's admission are checked exactly as for the card endpoint
// (api/_utils/filmRoom/cardsGate.js). It reads the owner's tape days in the
// window through the Admin SDK with the field mask `tags`, `etDate`,
// `ownerId`, `agentId`, `battleId`, and the agent's ledger, and answers
//   { agentId, attributionAgentId, archetypeCodeId, window: { from, to },
//     weekly: { [agentId]: { [situationId]: { [mondayEtDate]: { tags, moments } } } },
//     cards: [ …with each card's computed `shelved` ], open, cap,
//     recurrences: { [entryId]: [{ battleId, etDate, symbol, fromTickSeq, toTickSeq, from, to, checks }] },
//     unavailableDays: { [attributionAgentId]: n } }
// Build B Amendment K RK-1: `agentId` is the agent asked (the battle's own,
// as the screen knows it); the answer is FOR its attribution agent,
// `attributionAgentId` — a casual clone's parent — whose ledger it reads and
// whose tape days (the clone's and its own) it counts. The owner's clone the
// resolver cannot resolve → 503 attribution_unavailable.
// Every count is derived. The logic is api/_utils/filmRoom/cardCounter.js;
// the index it needs is firestore.indexes.json's tape COLLECTION_GROUP
// composite (ownerId ASC, etDate ASC) — a founder deploy after merge (RG-7).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { gateFilmRoomCardsRoute, sendCardError } from '../_utils/filmRoom/cardsGate.js';
import { buildCounter } from '../_utils/filmRoom/cardCounter.js';
import { isValidForgeId } from '../_utils/idValidation.js';

export const config = { maxDuration: 10 };

/** The per-IP window the shared middleware's limiter applies (applyRateLimit). */
export const COUNTER_RATE_LIMIT = Object.freeze({ limit: 30, windowMs: 60_000 });

const one = (v) => (Array.isArray(v) ? v[0] : v);

export default async function handler(req, res) {
  const gate = await gateFilmRoomCardsRoute(req, res, { methods: ['GET'], rateLimit: COUNTER_RATE_LIMIT });
  if (!gate) return;
  const { user } = gate;
  const agentId = one(req.query?.agentId);
  if (!isValidForgeId(agentId)) return res.status(400).json({ error: 'invalid_agent_id', message: 'agentId is required.' });
  const from = one(req.query?.from) ?? null;
  const to = one(req.query?.to) ?? null;
  try {
    const out = await buildCounter(getFirebaseAdmin(), { uid: user.uid, agentId, nowMs: Date.now(), from, to });
    if (out.error) return res.status(400).json({ error: out.error, message: 'from and to must be YYYY-MM-DD dates in order, at most 400 days apart.' });
    return res.status(200).json(out);
  } catch (err) {
    return sendCardError(res, err, 'counter');
  }
}
