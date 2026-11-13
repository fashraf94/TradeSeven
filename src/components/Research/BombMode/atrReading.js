// src/components/Research/BombMode/atrReading.js
//
// BS-4 (founder ruling Q3, 2026-11-12; Battle Research inventory §4 F3 / §12 H3) —
// THE ATR READING a non-held stock's 💣 preview draws its rungs from in a battle
// scored by the measured ATR model.
//
// The number is the rankings' ATR %: the scorer's own formula (the simple mean of
// 14 true ranges ÷ the latest close × 100, technicalCalculations.js), on nearly the
// bars a swap would measure. The cron writes it twice from ONE in-memory value in
// ONE batch (api/cron/compute-index-intelligence.js: `stockTechnicalScores/{SYM}`
// spreads the score object holding `atrPercent`; `stockRankings.stocks[].techRaw
// .atrPercent` mirrors `tech.atrPercent` off that same object; one `batch.commit()`),
// so the two copies cannot disagree within a run. The bench sheet's ATR column
// reads the rankings copy (api/agent/cockpit-bench.js); the modal reads the
// per-stock copy — about 1 KB, public, the document the Ranks tab already reads
// (useTechnicalScore) — once per stock, only when that preview shows. No provider
// call, no new endpoint (founder ruling, 2026-11-12: "one small doc read").
//
// Never throws: anything but a finite positive atrPercent is NO reading, and the
// preview then says "No ladder yet" — never the 2.5 default.

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The instant a Firestore Timestamp-like (or ms, or an ISO string) names; null otherwise. */
function msOf(v) {
  if (finite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') { try { const ms = v.toMillis(); return finite(ms) ? ms : null; } catch { return null; } }
  return null;
}

/**
 * The reading in one stockTechnicalScores document: { pct, asOfMs } — pct null when
 * the document is missing or holds no finite positive `atrPercent` (an unranked name).
 */
export function atrReadingOf(data) {
  const pct = data && finite(data.atrPercent) && data.atrPercent > 0 ? data.atrPercent : null;
  return { pct, asOfMs: pct === null ? null : msOf(data.updatedAt) };
}

/**
 * One read of stockTechnicalScores/{SYM}. Resolves { status, pct, asOfMs }: 'ready' with a
 * reading, 'none' for a document with none (an unranked name), 'failed' when the read itself
 * failed (the preview then says the reading has not loaded, never that the name is unranked).
 */
export async function readAtrReading(symbol) {
  try {
    const [{ db }, fs] = await Promise.all([import('../../../firebase/config'), import('firebase/firestore')]);
    const snap = await fs.getDoc(fs.doc(db, 'stockTechnicalScores', symbol));
    const r = atrReadingOf(snap.exists() ? snap.data() : null);
    return { status: r.pct === null ? 'none' : 'ready', ...r };
  } catch {
    return { status: 'failed', pct: null, asOfMs: null };
  }
}
