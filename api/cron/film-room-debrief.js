/**
 * Vercel cron: Film Room D2 — THE AGENT'S WORDS, the nightly pass (D2 spec
 * docs/specs/FILM_ROOM_BUILD_D2_WORDS_SPEC_V1_20261121.md §7; DW-7; the founder's FD-4).
 *
 * Schedule: `45 3 * * 2-6` UTC → /api/cron/film-room-debrief (vercel.json; src/utils/debriefSchedule.js holds the same
 * string, and a test pins the two equal) — 10:45 PM EST / 11:45 PM EDT, the same ET evening as the session it reads,
 * after the close pass (`15 2 * * 2-6`, at most 300 s) has written its tape. Its own entry, never a branch inside the
 * close pass: model calls never share the tape writer's 300-second budget, and a failure here never touches the tape.
 *
 * The handler is auth + gate + wiring:
 *   1. its secret (Amendment F DF-7): `CRON_SECRET` set and non-empty, and `Authorization: Bearer $CRON_SECRET` —
 *      the Vercel cron header alone no longer admits a request. THE FOUNDER'S PRECONDITION: with no CRON_SECRET in
 *      the production environment, every scheduled run answers 401 and writes nothing;
 *   2. FILM_ROOM_DEBRIEF_MODE read at CALL time (api/_utils/filmRoom/debriefGate.js): 'off' answers
 *      200 { skipped: true } before the Firestore handle is even taken — zero reads, zero calls, zero writes;
 *   3. the pass (api/_utils/filmRoom/debriefPass.js): the ET date of the run, its admitted tiered battle days, one
 *      model call per battle day with a swap, the checks, one record created per battle day
 *      (agentBattles/{id}/debriefs/{etDate}).
 * Writes ONLY agentBattles/{id}/debriefs/{etDate}, with `create` (a second run never overwrites a record). Reads
 * the battles, each battle day's tape and its record — and, for a casual clone's battle only, the clone's own agent
 * document, for the record's attribution agent (debriefPass.js attributionOf, the cards' counter's reading). Logs counts only: never words, ids or keys; an
 * error is named by its kind, never by its message (a Firestore message can carry a document path).
 *
 * Crons do not run on Vercel preview: verification is the unit tests on the gate, the selection, the digest, the
 * call, the checks and the record, then the first production run.
 */

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { filmRoomDebriefMode } from '../_utils/filmRoom/debriefGate.js';
import { runDebriefPass, publicSummaryOf, errorKindOf } from '../_utils/filmRoom/debriefPass.js';

export const config = { maxDuration: 300 };

const LOG_PREFIX = '[film-room-debrief]';

export default async function handler(req, res, { getDb = getFirebaseAdmin, pass = runDebriefPass } = {}) {
  const startMs = Date.now();
  // Amendment F DF-7 (Astra's F7): the paid endpoint requires its secret — 401 before the gate and before any read
  // unless CRON_SECRET is set and non-empty AND the request carries `Authorization: Bearer <CRON_SECRET>`. The
  // `x-vercel-cron` header alone no longer admits a request (Vercel sends the bearer on every scheduled run when the
  // secret is set). This endpoint only: the other crons keep their own guard (the founder's separate item).
  const secret = process.env.CRON_SECRET;
  if (typeof secret !== 'string' || secret === '' || req.headers?.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // The gate, read at CALL time, before any Firestore access.
  const mode = filmRoomDebriefMode();
  if (mode === 'off') return res.status(200).json({ skipped: true, reason: 'off' });
  try {
    const summary = await pass({ db: getDb(), clock: Date.now, startMs, budgetMs: config.maxDuration * 1000, mode });
    // Amendment F DF-6 (Astra's F6): the ONE public projection the log prints — counts and the total cost, never a
    // battle id, a day or a key
    return res.status(200).json(publicSummaryOf(summary));
  } catch (err) {
    // never the message: it can carry a document path, and so an id; the kind from a fixed set (DF-6)
    console.error(`${LOG_PREFIX} handler error`, JSON.stringify({ kind: errorKindOf(err), code: Number.isInteger(err?.code) ? err.code : null }));
    return res.status(500).json({ error: 'debrief_pass_failed' });
  }
}
