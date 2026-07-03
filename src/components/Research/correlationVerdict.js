/**
 * correlationVerdict — the plain-language verdict sentence at the top of the
 * Correlation Lab results (V1.1 Change C). A DETERMINISTIC template assembled
 * from the /api/research/correlation payload — NO LLM.
 *
 * Presentation-honesty rules (Build Spec V1.2, binding): copy is past-tense and
 * sample-bounded, never claims statistical significance, and every clause drops
 * out cleanly when its input is missing (null-safe throughout). Clause order:
 *   1. base   — corr60 sign + strength band (falls back to corr20, "past month")
 *   2. change — corr20 vs corr60 (only when both exist and the gap ≥ 0.15)
 *   3. break  — the most recent regime break (or the suppressed reason in place)
 *   4. lead   — who tended to move first (only on a directional lead verdict)
 *
 * Pure — no React, no imports — so it unit-tests directly (band edges, clause
 * drop-out on nulls, suppressed path).
 */

// Strength bands on |corr| (pinned V1.1). Returns null for < 0.15 — the caller
// renders the dedicated "no reliable link" base clause for that floor case.
export function strengthBand(absCorr) {
  if (!Number.isFinite(absCorr)) return null;
  if (absCorr >= 0.7) return 'strong';
  if (absCorr >= 0.4) return 'moderate';
  if (absCorr >= 0.15) return 'loose';
  return null;
}

// English ordinal: 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th", 21 → "21st".
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * @param {object|null} data - the /api/research/correlation response payload
 * @param {string} driverLabel - human label for the driver (e.g. "10Y Yield")
 * @returns {string|null} the verdict sentence, or null when nothing can be said
 */
export function buildVerdictSentence(data, driverLabel) {
  if (!data) return null;
  const corr60 = data?.byWindow?.corr60?.value ?? null;
  const corr20 = data?.byWindow?.corr20?.value ?? null;

  // ── Clause 1 — base. Prefer corr60 (3 months); fall back to corr20 (1 month).
  let baseCorr;
  let windowPhrase;
  if (corr60 != null) {
    baseCorr = corr60;
    windowPhrase = 'over the past 3 months';
  } else if (corr20 != null) {
    baseCorr = corr20;
    windowPhrase = 'over the past month';
  } else {
    return null; // no correlation at all → no verdict renders
  }
  const band = strengthBand(Math.abs(baseCorr));

  let sentence1;
  if (band === null) {
    // No reliable link — a complete sentence; the change clause has no link to
    // modify, so it does not attach here.
    sentence1 = `Your stocks show no reliable link to ${driverLabel} ${windowPhrase}.`;
  } else {
    const dir = baseCorr >= 0 ? 'move with' : 'move opposite';
    let base = `Your stocks usually ${dir} ${driverLabel} (${band} link ${windowPhrase})`;
    // ── Clause 2 — change (only with BOTH windows and a ≥ 0.15 gap).
    // Measure the move in the DIRECTION of the base link (corr60's sign), not
    // by raw magnitude: a positive link that inverts to strongly negative has
    // weakened, not "tightened" — magnitude alone would mislabel that flip.
    if (corr20 != null && corr60 != null && Math.abs(corr20 - corr60) >= 0.15) {
      const moved = corr60 >= 0 ? corr20 - corr60 : corr60 - corr20;
      const word = moved >= 0 ? 'tightened' : 'weakened';
      base += ` — but that link has ${word} this month`;
    }
    sentence1 = `${base}.`;
  }

  const parts = [sentence1];

  // ── Clause 3 — break context, or the suppressed reason in its place.
  const suppressedReason = data?.suppressed?.inflections ?? null;
  if (suppressedReason) {
    parts.push(`Regime-break detection isn't available yet — ${suppressedReason}.`);
  } else {
    const episodes = Array.isArray(data?.inflections) ? data.inflections : [];
    if (episodes.length) {
      const latest = episodes[episodes.length - 1];
      const since = data?.meta?.firstEligibleInflectionDate;
      let breakClause = `The most recent regime break was ${latest.startDate} — the ${ordinal(
        episodes.length
      )}`;
      breakClause += since ? ` since ${since}.` : '.';
      // Freshness: ≤ 10 sessions between the break flag and the latest close.
      const joined = data?.meta?.joinedCloses;
      if (
        Number.isFinite(joined) &&
        Number.isInteger(latest.startCloseIndex) &&
        joined - 1 - latest.startCloseIndex <= 10
      ) {
        breakClause += ' That break is still fresh.';
      }
      parts.push(breakClause);
    }
  }

  // ── Clause 4 — lead (only a directional lead verdict; coincident/none drop).
  const leadLag = data?.leadLag ?? null;
  if (leadLag && (leadLag.verdict === 'driver_leads' || leadLag.verdict === 'group_leads')) {
    const k = Math.abs(leadLag.bestLag);
    const dayWord = k === 1 ? 'day' : 'days';
    parts.push(
      leadLag.verdict === 'driver_leads'
        ? `${driverLabel} has tended to move first by ${k} ${dayWord}.`
        : `Your stocks have tended to move first by ${k} ${dayWord}.`
    );
  }

  return parts.join(' ');
}
