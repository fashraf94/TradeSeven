// api/_utils/filmTape/__fixtures__/sizeFixtures.js
//
// Film Room B1 (Astra F3) — the document-size fixtures: the capture-composed
// `stalledDay` with a roster, a day of meetings each at the builder's limits
// (MEETINGS_PER_DAY_MAX rows; a unique id of MEETING_ID_MAX code units; real
// instants; two roster-bound legs; MEETING_DIAGNOSIS_MAX characters of
// multibyte diagnosis; MEETING_RESOLVED_BY_MAX of resolver), and two levers
// that grow the CORE tape: one evaluation's rationale (the battle document
// holds it once, the tape copies it once — Astra's repro) and the risk
// reasons of a few ticks (each tick document stays small; the tape copies
// them all). Invented ids and words only; no production data.

import { stalledDay } from './tagFixtures.js';
import { MEETINGS_PER_DAY_MAX, MEETING_ID_MAX, MEETING_DIAGNOSIS_MAX, MEETING_RESOLVED_BY_MAX } from '../tapeAssemble.js';

/** The battle's book and bench: every leg below names one of these (review RF-1). */
export const SIZE_ROSTER = Object.freeze({
  star: [{ symbol: 'ACN' }, { symbol: 'MSFT' }], core: [{ symbol: 'NVDA' }, { symbol: 'XOM' }], support: [{ symbol: 'CSCO' }],
  bench: { stocks: [{ symbol: 'ORCL' }, { symbol: 'IBM' }], crypto: null },
});

/** `n` meetings created on `etDate`, each at every per-field limit the builder keeps. */
export function boundedMeetings(etDate, n = MEETINGS_PER_DAY_MAX) {
  return Array.from({ length: n }, (_, k) => {
    const created = Date.parse(`${etDate}T14:00:00.000Z`) + k * 60_000;
    return {
      id: `gpm_${String(k).padStart(2, '0')}_`.padEnd(MEETING_ID_MAX, 'x'),
      createdAt: new Date(created).toISOString(),
      expiresAt: new Date(created + 30 * 60_000).toISOString(),
      resolvedAt: new Date(created + 10 * 60_000).toISOString(),
      status: ['approved', 'rejected', 'expired'][k % 3],
      resolvedBy: 'r'.repeat(MEETING_RESOLVED_BY_MAX),
      diagnosis: '漢'.repeat(MEETING_DIAGNOSIS_MAX),       // 500 characters, 1,500 UTF-8 bytes
      opportunity: 'Technology has momentum.', proposedAction: 'rotate_sector', fromSector: null, toSectors: ['Technology'],
      suggestedSwaps: [
        { symbolOut: 'ACN', symbolIn: 'ORCL', rationale: 'ACN down 1.2%, ORCL has tech score 71.' },
        { symbolOut: 'MSFT', symbolIn: 'IBM', rationale: 'MSFT down 0.8%, IBM has tech score 66.' },
      ],
    };
  });
}

/**
 * The stalled day with the roster; `rationaleChars` grows the first
 * evaluation's rationale to that many ASCII characters, `riskReason` sets
 * that many characters of risk reason on each of the first `riskTicks`
 * ticks' verdicts; `meetings` is the meeting history.
 */
export async function sizedDay({ battleId = 'b-size', rationaleChars = 0, riskTicks = 0, riskReason = 0, meetings = [] } = {}) {
  const fx = await stalledDay({ battleId });
  fx.battle.portfolio = { ...fx.battle.portfolio, ...SIZE_ROSTER };
  fx.battle.gameplanMeetingHistory = meetings;
  if (rationaleChars > 0) fx.battle.evaluations[0].rationale = 'r'.repeat(rationaleChars);
  for (const tk of fx.ticks.slice(0, riskTicks)) {
    for (const v of Object.values(tk.risk?.verdicts ?? {})) v.reason = 'q'.repeat(riskReason);
  }
  return fx;
}
