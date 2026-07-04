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
//
// H5 — band on the 2dp-ROUNDED |corr|, the SAME value the UI prints (fmtCorr /
// scan summary = toFixed(2)), so the band WORD can never contradict the
// displayed NUMBER at the 0.40 / 0.70 edges (e.g. a raw 0.395 that displays
// "0.40" must band 'moderate', not 'loose'). Number(x.toFixed(2)) is exactly
// the display's rounding — the same idiom as the scan-tier round2 and
// rsiDisplay, the two other members of this rounding family. Input is always
// Math.abs(...) (non-negative finite) at every call site, so toFixed is safe.
export function strengthBand(absCorr) {
  if (!Number.isFinite(absCorr)) return null;
  const rounded = Number(absCorr.toFixed(2));
  if (rounded >= 0.7) return 'strong';
  if (rounded >= 0.4) return 'moderate';
  if (rounded >= 0.15) return 'loose';
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

// ── Break-state phrase (V2 Build 3.1, Change B — vocabulary unification) ──────
// The GROUP composite's technical state at a flag, humanized: a trend/RSI word
// pair leads (primary line), the technical detail (50DMA side + RSI value) is
// demoted to muted secondary text. Presentation-honesty surface: a null part is
// omitted (never guessed), and an all-null context returns null so the cell
// renders a single "—". Pure — unit-tested beside the verdict template.
const TREND_WORD = { above: 'uptrend', below: 'downtrend' };
const RSI_WORD = { overbought: 'running hot', oversold: 'washed out' }; // neutral omits

/**
 * RSI display rounding that never contradicts the server's zone word: RSI 69.6
 * is 'neutral', but a bare round prints "70" against the pinned ≥ 70 overbought
 * edge — in the two half-point slivers where the integer crosses a zone
 * boundary, render 1dp instead. The zone word now leads on the primary line,
 * but the technical "RSI n" must still not read as a different zone.
 */
export function rsiDisplay(rsi14, rsiZone) {
  const rounded = Math.round(rsi14);
  const contradicts =
    (rounded >= 70 && rsiZone !== 'overbought') || (rounded <= 30 && rsiZone !== 'oversold');
  return contradicts ? rsi14.toFixed(1) : String(rounded);
}

/**
 * @param {{vs50DMA:('above'|'below'|null), rsi14:(number|null), rsiZone:(string|null)}|null|undefined} ctx
 *   an episode's contextAtFlag stamp.
 * @returns {{primary:(string|null), secondary:(string|null)}|null}
 *   e.g. { primary: 'uptrend · running hot', secondary: 'above 50DMA · RSI 73' };
 *   null when there is no state to show at all (cell renders "—").
 */
export function breakStatePhrase(ctx) {
  if (!ctx || (ctx.vs50DMA == null && ctx.rsi14 == null)) return null;
  const trendWord = ctx.vs50DMA != null ? TREND_WORD[ctx.vs50DMA] ?? null : null;
  const rsiWord = ctx.rsiZone != null ? RSI_WORD[ctx.rsiZone] ?? null : null;
  const smaBit = ctx.vs50DMA != null ? `${ctx.vs50DMA} 50DMA` : null;
  const rsiBit = ctx.rsi14 != null ? `RSI ${rsiDisplay(ctx.rsi14, ctx.rsiZone)}` : null;
  return {
    primary: [trendWord, rsiWord].filter(Boolean).join(' · ') || null,
    secondary: [smaBit, rsiBit].filter(Boolean).join(' · ') || null,
  };
}

// ── Conditional-correlation verdict chip (V2 Build 4) ────────────────────────

/**
 * Verdict chip for one `conditional` condition block (pinned copy):
 *   asymmetric → "tighter on {winning-side label}"
 *   not asymmetric → "no meaningful difference"
 *   either side null → "not enough {side label} (n={n}, {minObs} needed)"
 *
 * Both-sides-null names the smaller-n side (the binding constraint; tie →
 * side A). The null-side-with-enough-days corner (a degenerate ≥-minObs
 * subset — engineered data only) says "couldn't measure" instead of letting
 * the insufficient template lie about the count — and so does a null side
 * whose count is MISSING entirely (malformed/renamed counts): an unknown
 * count must never be printed as "n=0" (null-never-zero, review fix). A
 * sub-floor difference is NEVER a percentage and never "significant" — "no
 * meaningful difference" is the whole verdict (the 0.15 floor and the
 * truncation rationale live with compareConditionalSides in
 * correlationMath.js). Pure — no React — so it unit-tests beside
 * buildVerdictSentence/breakStatePhrase.
 *
 * @param {object|null|undefined} block - conditional.driverDirection / .volRegime / .trendState
 * @param {[string, string]} sides - the block's side keys in [A, B] order
 * @param {number} [minObs=60] - the server floor (conditional.minObs)
 * @returns {{kind:('tighter'|'nodiff'|'insufficient'|'unmeasurable'), text:string}|null}
 *   null only on a missing block (old cached shape — the caller renders nothing).
 */
export function conditionalVerdict(block, sides, minObs = 60) {
  if (!block) return null;
  const [keyA, keyB] = sides;
  const a = block[keyA];
  const b = block[keyB];
  const labels = block.labels ?? {};
  const counts = block.counts ?? {};
  if (a == null || b == null) {
    let side;
    if (a == null && b == null) {
      side = (counts[keyB] ?? 0) < (counts[keyA] ?? 0) ? keyB : keyA;
    } else {
      side = a == null ? keyA : keyB;
    }
    const n = counts[side];
    // A missing count (n == null) or a degenerate ≥-floor subset both mean the
    // day count can't honestly explain the null side — never fabricate "n=0".
    if (n == null || n >= minObs) {
      return { kind: 'unmeasurable', text: `couldn't measure ${labels[side] ?? side}` };
    }
    return {
      kind: 'insufficient',
      text: `not enough ${labels[side] ?? side} (n=${n}, ${minObs} needed)`,
    };
  }
  // direction is the server-mapped winning-side key; the guard also covers the
  // exact-|corr|-tie corner, which arrives asymmetric with a null direction.
  if (block.asymmetric === true && block.direction && labels[block.direction]) {
    return { kind: 'tighter', text: `tighter on ${labels[block.direction]}` };
  }
  return { kind: 'nodiff', text: 'no meaningful difference' };
}
