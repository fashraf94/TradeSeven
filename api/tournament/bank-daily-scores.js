// api/tournament/bank-daily-scores.js
//
// P1b — POST /api/tournament/bank-daily-scores. Manual trigger for one
// group's daily banking pass (admin/cron secret). This is the PREVIEW path:
// crons do not run on Vercel preview, so the founder smoke script drives
// banking through this endpoint — including a deliberate second invocation
// to watch the per-ET-day idempotency skip. Production banking rides the
// nightly snake-draft-daily-scores handler (zero new cron entries).
//
// `bypassTradingDay` is a preview time-control (the endpoint is already
// admin-gated, so no further secret check is needed): it suppresses only the
// weekend/holiday guard. The idempotency skip is NEVER bypassable — the
// smoke script depends on seeing it.
//
// `simulatedNow` (P3b, same idiom): an ISO instant injected as the banking
// clock, so the founder smoke arc banks day1..day5 in one session by
// stepping the simulated ET date (Mon..Fri). The per-ET-day idempotency
// applies to the SIMULATED date — re-banking the same simulated day still
// shows the skip. Quotes are always live; only the clock is simulated.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { isTradingDay } from '../_utils/marketSchedule.js';
import { parseSimulatedNow } from '../_utils/tournamentTime.js';
import { getGroup } from '../_utils/tournamentGroupService.js';
import { bankGroup } from '../_utils/tournamentBanking.js';
import { loadAtrPercentiles } from '../_utils/tournamentUserScoring.js';
import { fetchBatchQuotes } from '../_utils/tournamentPrices.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId, bypassTradingDay = false, simulatedNow = null } = body;
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }
  const parsed = parseSimulatedNow(simulatedNow);
  if (parsed.error) {
    return res.status(400).json({ error: 'invalid_simulated_now', message: parsed.error });
  }
  const now = parsed.now;

  // One clock for guard AND banking: the trading-day check evaluates the
  // (possibly simulated) instant being banked, ET-shifted per the
  // marketSchedule getETDate convention — never the real wall clock against
  // a simulated recordedDate.
  const etShiftedNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  if (!isTradingDay(etShiftedNow) && !bypassTradingDay) {
    return res.status(409).json({
      error: 'not_trading_day',
      message: 'Market is closed on the banked date (weekend or holiday). Pass bypassTradingDay: true to bank anyway.',
    });
  }

  try {
    const db = getFirebaseAdmin();

    const group = await getGroup(db, groupId);
    if (!group) {
      return res.status(404).json({ error: 'group_not_found', message: 'Tournament group not found.' });
    }
    if (group.status !== GROUP_STATUS.BATTLE) {
      return res.status(409).json({ error: 'not_battle', message: 'Banking requires a group in battle.' });
    }

    const symbols = new Set();
    for (const player of group.players || []) {
      for (const pick of player.picks || []) {
        if (pick?.symbol) symbols.add(pick.symbol);
      }
    }

    const [quotes, atrPercentiles] = await Promise.all([
      fetchBatchQuotes([...symbols]),
      loadAtrPercentiles(db),
    ]);
    if (symbols.size > 0 && Object.keys(quotes).length === 0) {
      return res.status(502).json({
        error: 'prices_unavailable',
        message: 'No quotes available — banking would record zero snapshots. Try again shortly.',
      });
    }

    const result = await bankGroup(db, groupId, quotes, {
      now,
      atrPercentiles,
      recordedBy: 'manual',
    });

    console.log(`[Tournament] bank-daily-scores: group ${groupId} →`, result.skipped ? `skipped (${result.reason})` : result.dayKey);
    return res.status(200).json({ groupId, ...result });
  } catch (err) {
    console.error('[Tournament] bank-daily-scores error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not bank daily scores.' });
  }
}
