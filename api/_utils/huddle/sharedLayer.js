// api/_utils/huddle/sharedLayer.js
//
// Huddle S1 — THE SHARED LAYER, computed once per morning (spec V1.1 §5.2; concept V1.2 §6
// "Shared layer, computed once at 8:30"), stored on huddleRuns/{etDate}.shared by the
// enqueue stage and read by every job:
//   tape       indexIntelligence/marketContext — the prior close, said as such: regime,
//              breadth and volatility tiers, top and worst sector, SPY / QQQ change; NO
//              volume field exists there and none is passed (C §C12)
//   macro      today's events from the existing macro module (api/_utils/macroCalendar.js;
//              2026-only, its 2027 switch is its own task)
//   earnings   today's reports and the next session's, ONE raw EODHD /calendar/earnings call
//              from today through the next session (Amendment E §E2: a name reporting before
//              the next open is what NO_ADDS_TO_BEFORE_REPORT names), parsed from the
//              capture's keys (evidence/earnings.js; C §C11, report_date)
// Each source's outcome is recorded; an error is said, never hidden.

import { getMacroEventsInWindow } from '../macroCalendar.js';
import { parseEarningsRows } from '../evidence/earnings.js';
import { huddleRunRef, nextSessionDateOf } from './records.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' && v ? v : null);
const toIso = (v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : typeof v === 'string' ? v : null);

/** The tape fields the script may use, from the marketContext document (pure). */
export function tapeOf(mc) {
  if (!mc || typeof mc !== 'object') return null;
  return {
    regime: str(mc.regime),
    breadthTier: str(mc.breadthTier),
    volatilityRegime: str(mc.volatilityRegime),
    topSector: str(mc.topSectorToday),
    topSectorChange: num(mc.topSectorChange),
    worstSector: str(mc.worstSectorToday),
    worstSectorChange: num(mc.worstSectorChange),
    spyChangePercent: num(mc.spy?.changePercent),
    qqqChangePercent: num(mc.qqq?.changePercent),
    // E3 g: each index's close and change, for one `tape` pack item per index (marketContext's own fields)
    indices: ['spy', 'qqq', 'dia', 'iwm'].map((k) => ({ symbol: k.toUpperCase(), close: num(mc[k]?.price), changePct: num(mc[k]?.changePercent) }))
      .filter((i) => i.close !== null && i.changePct !== null),
    mode: str(mc.mode),
    asOf: toIso(mc.updatedAt),
  };
}

/** Today's and the next session's US earnings rows, one call. Never throws. */
export async function fetchTodaysEarnings({ etDate, toDate = nextSessionDateOf(etDate) ?? etDate, signal, apiKey = process.env.EODHD_API_KEY, fetchImpl = fetch }) {
  if (!apiKey) return { status: 'skipped', rows: [], reason: 'no_api_key' };
  const url = `https://eodhd.com/api/calendar/earnings?fmt=json&from=${etDate}&to=${toDate}&api_token=${apiKey}`;
  try {
    const res = await fetchImpl(url, { signal });
    if (!res.ok) return { status: 'error', rows: [], reason: `http_${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data?.earnings)) return { status: 'error', rows: [], reason: 'no_earnings_array' };
    return { status: 'ok', rows: parseEarningsRows(data.earnings).filter((r) => r.reportDate === etDate || r.reportDate === toDate) };
  } catch (err) {
    return { status: 'error', rows: [], reason: err?.name === 'AbortError' ? 'aborted' : 'request_failed' };
  }
}

/** Build the shared layer (I/O injected for tests). */
export async function buildSharedLayer(db, { etDate, nowMs = Date.now(), fetchEarnings = fetchTodaysEarnings, macroIn = getMacroEventsInWindow }) {
  const sources = {};
  let tape = null;
  try {
    const snap = await db.collection('indexIntelligence').doc('marketContext').get();
    tape = snap.exists ? tapeOf(snap.data()) : null;
    sources.marketContext = tape ? 'ok' : 'error';
  } catch {
    sources.marketContext = 'error';
  }
  let macroEvents = [];
  try {
    macroEvents = macroIn({ fromDate: etDate, toDate: etDate }).filter((e) => e.date === etDate)
      .map((e) => ({ date: e.date, time: e.time ?? null, category: e.category ?? null, impact: e.impact ?? null, event: e.event ?? null }));
    sources.macro = 'ok';
  } catch {
    sources.macro = 'error';
  }
  const nextEtDate = nextSessionDateOf(etDate);
  const earn = await fetchEarnings({ etDate, toDate: nextEtDate ?? etDate });
  sources.earnings = earn.status;
  // the counts stay today's (the run marker's record; never spoken, Amendment E §E3 f)
  return { tape, macroEvents, earnings: earn.rows, earningsTotal: earn.rows.filter((r) => r.reportDate === etDate).length, nextEtDate: nextEtDate ?? null, sources, builtAt: new Date(nowMs).toISOString() };
}

/** Read the stored shared layer (null when the enqueue stage has not built it). */
export async function readSharedLayer(db, { etDate }) {
  const snap = await huddleRunRef(db, etDate).get();
  return snap.exists ? (snap.data()?.shared ?? null) : null;
}
