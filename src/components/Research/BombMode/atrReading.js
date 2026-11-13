// src/components/Research/BombMode/atrReading.js
//
// BS-4 (founder ruling Q3, 2026-11-12; Battle Research inventory §4 F3 / §12 H3) —
// THE ATR READING a non-held stock's 💣 preview draws its rungs from in a battle
// scored by the measured ATR model.
//
// The number is the rankings' ATR %: the same 14-true-range formula the scorer
// uses (the simple mean of 14 true ranges ÷ the latest close × 100,
// technicalCalculations.js) — but not on the same bars: a swap measures 15
// completed, fully adjusted sessions, while an intraday rankings run includes
// today's partial bar and mixes raw highs and lows with the adjusted close
// (inventory §4.1 (b)). It is an estimate, and the preview says so. The cron
// writes it twice from ONE in-memory value in ONE batch
// (api/cron/compute-index-intelligence.js: `stockTechnicalScores/{SYM}` spreads
// the score object holding `atrPercent`; `stockRankings.stocks[].techRaw
// .atrPercent` mirrors `tech.atrPercent` off that same object; one
// `batch.commit()`), so the two copies cannot disagree within a run. The bench
// sheet's ATR column reads the rankings copy (api/agent/cockpit-bench.js); the
// modal reads the per-stock copy — about 1 KB, public, the document the Ranks
// tab already reads (useTechnicalScore) — once per stock, only when that preview
// shows. No provider call, no new endpoint (founder ruling, 2026-11-12: "one
// small doc read").
//
// FRESHNESS (review A1 / B2): the cron writes a stockTechnicalScores document
// only for the symbols it scored in that run and never deletes one, so a name
// that dropped out of the rankings keeps its last document. A reading older
// than ATR_READING_MAX_AGE_MS, or with no time on it, is NO reading.
//
// Never throws: anything but a fresh, finite, positive atrPercent is NO
// reading, and the preview then says "No ladder yet" — never the 2.5 default.

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * The oldest reading the preview takes: 96 hours. The rankings run every weekday
 * (pre-market, then hourly in the session), so a current name's reading is at most
 * a weekend and a holiday old (Fri 4 PM → Tue 9 AM is 89 hours); a name the runs
 * have stopped scoring falls out within four days. Inside the window the weekday
 * names the day without ambiguity (bombView.atrAsOfText).
 */
export const ATR_READING_MAX_AGE_MS = 96 * 60 * 60 * 1000;

/** The instant a Firestore Timestamp-like (or ms, or an ISO string) names; null otherwise. */
function msOf(v) {
  if (finite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') { try { const ms = v.toMillis(); return finite(ms) ? ms : null; } catch { return null; } }
  return null;
}

/**
 * The reading in one stockTechnicalScores document at `nowMs`: { pct, asOfMs } — pct null
 * when the document is missing, holds no finite positive `atrPercent`, carries no time, or
 * is older than ATR_READING_MAX_AGE_MS (a name the rankings no longer score).
 */
export function atrReadingOf(data, nowMs = Date.now()) {
  const raw = data && finite(data.atrPercent) && data.atrPercent > 0 ? data.atrPercent : null;
  const asOfMs = raw === null ? null : msOf(data.updatedAt);
  const fresh = asOfMs !== null && finite(nowMs) && nowMs - asOfMs <= ATR_READING_MAX_AGE_MS;
  return fresh ? { pct: raw, asOfMs } : { pct: null, asOfMs: null };
}

/**
 * One read of stockTechnicalScores/{SYM}. Resolves { status, pct, asOfMs }: 'ready' with a
 * reading, 'none' for a document with no current one (an unranked or dropped name), 'failed'
 * when the read itself failed (the preview says so, and asks again when 💣 is reopened).
 */
export async function readAtrReading(symbol, nowMs = Date.now()) {
  try {
    const [{ db }, fs] = await Promise.all([import('../../../firebase/config'), import('firebase/firestore')]);
    const snap = await fs.getDoc(fs.doc(db, 'stockTechnicalScores', symbol));
    const r = atrReadingOf(snap.exists() ? snap.data() : null, nowMs);
    return { status: r.pct === null ? 'none' : 'ready', ...r };
  } catch {
    return { status: 'failed', pct: null, asOfMs: null };
  }
}
