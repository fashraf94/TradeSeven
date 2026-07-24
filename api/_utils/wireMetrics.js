// api/_utils/wireMetrics.js
// FantasyTimes Wire — timing metrics sink (Spec V1.5 §4.8, F2-5).
//
// Server-only wireMetrics/{marketDate} doc: per-seam bounded samples
// (cap 500/seam/day) + counts. Percentiles are computed at review time from
// the samples — nothing here aggregates beyond count/totalMs.
//
// Contract: recording NEVER touches the model request object or persisted
// story content, and a metrics failure NEVER fails the caller — contained
// with a logged error (not a silent .catch(()=>{}) swallow; metrics are not
// catalog events, so BUILD_RULES §5 does not demand the queue-flag pattern).

import { WIRE_METRICS_COLLECTION } from './wireContracts.js';

export const METRIC_SAMPLE_CAP = 500;

/**
 * Record one duration sample for a seam.
 *
 * @param {object} db — Firestore Admin instance
 * @param {object} s
 * @param {string} s.seam — e.g. 'kai_pulse'
 * @param {string} s.metric — 'generate_publish' | 'wire_path'
 * @param {number} s.ms — duration in milliseconds
 * @param {string} s.marketDate — the day bucket (deriveMarketDate output)
 */
export async function recordWireSample(db, { seam, metric, ms, marketDate }) {
  try {
    if (!seam || !metric || !Number.isFinite(ms) || !marketDate) return;
    const ref = db.collection(WIRE_METRICS_COLLECTION).doc(marketDate);
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const data = snap.exists ? snap.data() : { date: marketDate, seams: {} };
      const seams = data.seams || {};
      const seamData = seams[seam] || {};
      const m = seamData[metric] || { count: 0, totalMs: 0, samples: [] };
      m.count += 1;
      m.totalMs += Math.round(ms);
      if (m.samples.length < METRIC_SAMPLE_CAP) m.samples.push(Math.round(ms));
      seamData[metric] = m;
      seams[seam] = seamData;
      t.set(ref, { date: marketDate, seams, updatedAt: new Date() });
    });
  } catch (err) {
    console.error(`[WireMetrics] sample record failed (${seam}/${metric}):`, err?.message || err);
  }
}
