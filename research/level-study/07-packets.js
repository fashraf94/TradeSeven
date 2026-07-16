// research/level-study/07-packets.js
//
// LevelStory Session 7 — THE MANUAL-VALIDATION CHART-PACKET EXPORTER (parent §12; Addendum §A4.1).
// Exports 100 events, stratified across the three ATR%-vol tertiles (S56-A3), each rendered as:
//   • the daily context (≈80 sessions into the event) with the level zone + the detected
//     current_leg_origin marker and the base_count annotation (the S7-graded machinery, §A4.1),
//   • the full 5-minute event session with the level zone shaded and touchAt / confirmationAt /
//     entryAt vertical markers,
// into ONE self-contained HTML file the (non-technical) founder opens and grades:
//   • event validity: valid / garbage / ambiguous,
//   • AND, graded separately, base_count + current_leg_origin detection (Addendum §A4.1).
// The page exports the grades to a JSON blob the founder saves as reports/packets_grading.json — the
// footer's manual-validation garbage rate (parent §12 gate: >10% blocks the holdout) reads from it.
//
//   npm run packets                 # frozen universe, in-sample events, the fixed 100-event sample
//   node 07-packets.js --fresh      # advance the seed for a genuinely fresh sample (only after a fix)
//
// The sample is IN-SAMPLE ONLY (eventDate < holdout): validating on holdout events would peek at the
// holdout before it is founder-opened. Determinism: the same 100 events are drawn every run (a fresh
// draw requires --fresh, never a silent reshuffle). Zero product imports; output is gitignored.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.js';
import { buildSeries } from './lib/level-series.js';
import { loadFiveMinByDate } from './03-detect-events.js';
import { stratifiedSample, PACKET_SEED, SAMPLE_SIZE, STRATA } from './lib/packets.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const EVENTS_DIR = path.join(HERE, 'data', 'events');
const LABELS_DIR = path.join(HERE, 'data', 'labels');
const FEATURES_DIR = path.join(HERE, 'data', 'features');
const NORM_DIR = path.join(HERE, 'data', 'normalized');
const REPORTS_DIR = path.join(HERE, 'reports');
const PACKETS_DIR = path.join(REPORTS_DIR, 'packets');
const UNIVERSE_PATH = path.join(REPO_ROOT, CONFIG.universe.universeFilePath);
const HOLDOUT = CONFIG.range.holdoutStart;
const DAILY_CONTEXT_SESSIONS = 80;

// ── SVG primitives (pure; deterministic — a byte-identical render after a real change is a bug) ─────

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (x) => (x == null ? '' : (Math.round(x * 100) / 100).toString());

/** Map a value in [dataMin,dataMax] to a y pixel in [pad, h-pad] (inverted: high value = low y). */
function yScaler(dataMin, dataMax, h, pad) {
  const span = (dataMax - dataMin) || 1; // guard a degenerate (flat) range
  return (v) => h - pad - ((v - dataMin) / span) * (h - 2 * pad);
}

/**
 * A candlestick chart of OHLC bars. bars: [{o,h,l,c,label?,marker?}]. zone: {lo,hi} shaded band.
 * markers: [{x:index, color, label}] drawn as vertical lines. Returns an <svg> string.
 */
export function candleSVG(bars, { width = 900, height = 260, zone = null, vlines = [], title = '' } = {}) {
  const pad = 24;
  const highs = bars.map((b) => b.h).filter((x) => x != null);
  const lows = bars.map((b) => b.l).filter((x) => x != null);
  if (zone) { highs.push(zone.hi); lows.push(zone.lo); }
  const dataMax = Math.max(...highs), dataMin = Math.min(...lows);
  const yOf = yScaler(dataMin, dataMax, height, pad);
  const bw = (width - 2 * pad) / Math.max(bars.length, 1);
  const xOf = (i) => pad + i * bw + bw / 2;
  const parts = [`<svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">`];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#0d1117"/>`);
  if (zone) {
    const yh = yOf(zone.hi), yl = yOf(zone.lo);
    parts.push(`<rect x="${pad}" y="${n2(Math.min(yh, yl))}" width="${width - 2 * pad}" height="${n2(Math.abs(yl - yh) || 2)}" fill="#3b82f6" opacity="0.18"/>`);
    parts.push(`<line x1="${pad}" y1="${n2(yOf((zone.hi + zone.lo) / 2))}" x2="${width - pad}" y2="${n2(yOf((zone.hi + zone.lo) / 2))}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4 3"/>`);
  }
  for (const v of vlines) {
    if (v.x == null || v.x < 0) continue;
    const x = xOf(v.x);
    parts.push(`<line x1="${n2(x)}" y1="${pad}" x2="${n2(x)}" y2="${height - pad}" stroke="${v.color}" stroke-width="1.4" opacity="0.9"/>`);
    parts.push(`<text x="${n2(x + 2)}" y="${pad + 10}" fill="${v.color}" font-size="10">${esc(v.label)}</text>`);
  }
  bars.forEach((b, i) => {
    if (b.o == null) return;
    const x = xOf(i);
    const up = b.c >= b.o;
    const col = up ? '#26a69a' : '#ef5350';
    parts.push(`<line x1="${n2(x)}" y1="${n2(yOf(b.h))}" x2="${n2(x)}" y2="${n2(yOf(b.l))}" stroke="${col}" stroke-width="1"/>`);
    const yO = yOf(b.o), yC = yOf(b.c);
    parts.push(`<rect x="${n2(x - bw * 0.3)}" y="${n2(Math.min(yO, yC))}" width="${n2(Math.max(bw * 0.6, 1))}" height="${n2(Math.abs(yC - yO) || 1)}" fill="${col}"/>`);
  });
  if (title) parts.push(`<text x="${pad}" y="14" fill="#9ca3af" font-size="11">${esc(title)}</text>`);
  parts.push(`<text x="${width - pad}" y="${pad}" fill="#6b7280" font-size="9" text-anchor="end">${n2(dataMax)}</text>`);
  parts.push(`<text x="${width - pad}" y="${height - pad + 8}" fill="#6b7280" font-size="9" text-anchor="end">${n2(dataMin)}</text>`);
  parts.push('</svg>');
  return parts.join('');
}

/** Daily context SVG: ≈80 sessions ending at the event, zone band, leg-origin vertical marker. */
export function dailyChartSVG(series, eventIdx, { zone, legOriginDate, title }) {
  const start = Math.max(0, eventIdx - DAILY_CONTEXT_SESSIONS + 1);
  const bars = [];
  for (let i = start; i <= eventIdx; i++) bars.push({ o: series.aOpen[i], h: series.aHigh[i], l: series.aLow[i], c: series.aClose[i] });
  const vlines = [{ x: eventIdx - start, color: '#fbbf24', label: 'event' }];
  if (legOriginDate != null) {
    const li = series.dateIndex.get(legOriginDate);
    if (li != null && li >= start && li <= eventIdx) vlines.push({ x: li - start, color: '#a78bfa', label: 'leg origin' });
  }
  return candleSVG(bars, { zone, vlines, title });
}

const HOURLY_BOUNDARIES = CONFIG.hourly.bucketBoundariesEtMinutes; // [570,630,…,960]

/** The 5m constituents of the hourly confirmation window = touch hourly bucket + next hourly bucket. */
function hourlyWindowBars(regularBars, touchEt) {
  let ti = null;
  for (let i = 0; i < HOURLY_BOUNDARIES.length - 1; i++) {
    if (touchEt >= HOURLY_BOUNDARIES[i] && touchEt < HOURLY_BOUNDARIES[i + 1]) { ti = i; break; }
  }
  if (ti == null) return [];
  const start = HOURLY_BOUNDARIES[ti];
  const end = HOURLY_BOUNDARIES[Math.min(ti + 2, HOURLY_BOUNDARIES.length - 1)]; // touch bucket + next bucket
  return regularBars.filter((b) => b.etMinutes >= start && b.etMinutes < end);
}

/** Hourly confirmation-window SVG (parent §12): the window's 5m constituents zoomed, zone + markers. */
export function hourlyWindowChartSVG(regularBars, { zone, touchEt, confirmEt, entryEt, title }) {
  const wb = hourlyWindowBars(regularBars, touchEt);
  if (!wb.length) return '<div style="color:#8b949e">confirmation window unavailable</div>';
  return intradayChartSVG(wb, { zone, touchEt, confirmEt, entryEt, title });
}

/** Intraday 5m SVG: the event session, zone band, touch/confirm/entry vertical markers. */
export function intradayChartSVG(regularBars, { zone, touchEt, confirmEt, entryEt, title }) {
  const bars = regularBars.map((b) => ({ o: b.adjOpen, h: b.adjHigh, l: b.adjLow, c: b.adjClose, et: b.etMinutes }));
  const idxOfEt = (et) => { if (et == null) return -1; let best = -1, bestD = Infinity; bars.forEach((b, i) => { const d = Math.abs(b.et - et); if (d < bestD) { bestD = d; best = i; } }); return best; };
  const vlines = [
    { x: idxOfEt(touchEt), color: '#fbbf24', label: 'touch' },
    { x: idxOfEt(confirmEt), color: '#38bdf8', label: 'confirm' },
    { x: idxOfEt(entryEt), color: '#34d399', label: 'entry' },
  ].filter((v) => v.x >= 0);
  return candleSVG(bars, { zone, vlines, title, height: 300 });
}

/** The full self-contained HTML page for a set of rendered packets. */
export function packetHtml(packets, meta) {
  const cards = packets.map((p, i) => `
  <section class="packet" data-i="${i}" data-eventid="${esc(p.eventId)}">
    <h2>#${i + 1} — ${esc(p.symbol)} · ${esc(p.side)} · ${esc(p.familyTier)} · ${esc(p.eventDate)} <span class="chip">${esc(p.stratum)}</span></h2>
    <div class="meta">hourly_class: <b>${esc(p.hourlyClass ?? 'null')}</b> · base_count: <b>${esc(p.baseCount ?? '—')}</b> · current_leg_origin: <b>${esc(p.legOriginDate ?? '—')}</b> · extension: <b>${esc(p.extensionBucket ?? '—')}</b> · touchAt ${esc(p.touchAt ?? '—')} · confirmationAt ${esc(p.confirmationAt ?? '—')} · entryAt ${esc(p.entryAt ?? '—')}</div>
    <div class="chart">${p.dailySvg}</div>
    <div class="chart">${p.hourlyWindowSvg}</div>
    <div class="chart">${p.intradaySvg}</div>
    <div class="grades">
      <fieldset><legend>event validity</legend>
        ${['valid', 'garbage', 'ambiguous'].map((g) => `<label><input type="radio" name="v_${i}" value="${g}"> ${g}</label>`).join('')}
      </fieldset>
      <fieldset><legend>leg-origin detection</legend>
        ${['agree', 'disagree', 'unsure'].map((g) => `<label><input type="radio" name="leg_${i}" value="${g}"> ${g}</label>`).join('')}
      </fieldset>
      <fieldset><legend>base-count detection</legend>
        ${['agree', 'disagree', 'unsure'].map((g) => `<label><input type="radio" name="base_${i}" value="${g}"> ${g}</label>`).join('')}
      </fieldset>
    </div>
  </section>`).join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>LevelStory manual validation — ${esc(meta.count)} packets</title>
<style>
  body{background:#010409;color:#c9d1d9;font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:16px}
  header{position:sticky;top:0;background:#010409;padding:8px 0;border-bottom:1px solid #21262d;z-index:10}
  h1{font-size:18px;margin:0 0 4px} .sub{color:#8b949e;font-size:12px}
  .packet{border:1px solid #21262d;border-radius:8px;padding:12px;margin:14px 0;background:#0d1117}
  .packet h2{font-size:15px;margin:0 0 4px} .chip{background:#1f6feb33;color:#58a6ff;border-radius:10px;padding:1px 8px;font-size:11px;margin-left:6px}
  .meta{color:#8b949e;font-size:12px;margin-bottom:8px} .chart{margin:6px 0;overflow-x:auto}
  .grades{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px} fieldset{border:1px solid #30363d;border-radius:6px;padding:6px 10px}
  legend{color:#8b949e;font-size:11px} label{margin-right:10px;font-size:12px}
  button{background:#238636;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer}
  #out{white-space:pre-wrap;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px;margin-top:8px;font:12px/1.4 monospace;display:none}
</style></head><body>
<header>
  <h1>LevelStory — manual validation (${esc(meta.count)} chart packets)</h1>
  <div class="sub">Config v${esc(meta.configVersion)} · sample seed ${esc(meta.seed)} · strata ${esc(meta.allocationStr)} · in-sample only (&lt; ${esc(meta.holdout)}). Gate: garbage &gt; ${esc(meta.garbageGatePct)}% blocks the holdout (parent §12). Grade validity AND (separately) leg-origin + base-count detection (§A4.1).</div>
  <button onclick="grade()">compute + export grades → save as reports/packets_grading.json</button>
  <div id="out"></div>
</header>
${cards}
<script>
function grade(){
  const N=${meta.count}; const ids=${JSON.stringify(packets.map((p) => p.eventId))};
  const rows=[]; let valid=0,garbage=0,ambiguous=0,ungraded=0, legAgree=0,legTot=0, baseAgree=0,baseTot=0;
  for(let i=0;i<N;i++){
    const v=(document.querySelector('input[name="v_'+i+'"]:checked')||{}).value||null;
    const leg=(document.querySelector('input[name="leg_'+i+'"]:checked')||{}).value||null;
    const base=(document.querySelector('input[name="base_'+i+'"]:checked')||{}).value||null;
    if(v==='valid')valid++; else if(v==='garbage')garbage++; else if(v==='ambiguous')ambiguous++; else ungraded++;
    if(leg==='agree'){legAgree++;legTot++} else if(leg==='disagree'){legTot++}
    if(base==='agree'){baseAgree++;baseTot++} else if(base==='disagree'){baseTot++}
    rows.push({eventId:ids[i], validity:v, legOrigin:leg, baseCount:base});
  }
  const graded=valid+garbage+ambiguous;
  const out={generatedBy:'07-packets.js', configVersion:${meta.configVersion}, seed:'${esc(meta.seed)}',
    graded:graded, ungraded:ungraded, valid:valid, garbage:garbage, ambiguous:ambiguous,
    garbagePct: graded? Math.round(garbage/graded*1000)/10 : null,
    garbageGateBlocksHoldout: graded ? (garbage/graded*100) > ${meta.garbageGatePct} : null,
    legOriginAgreementPct: legTot? Math.round(legAgree/legTot*1000)/10 : null,
    baseCountAgreementPct: baseTot? Math.round(baseAgree/baseTot*1000)/10 : null,
    componentDemoteBelowPct: ${meta.demoteBelowAgreementPct}, rows:rows};
  const el=document.getElementById('out'); el.style.display='block'; el.textContent=JSON.stringify(out,null,2);
}
</script></body></html>`;
}

// ── Loaders ─────────────────────────────────────────────────────────────────────────────────────────

function loadJson(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; }
function loadDailySeries(sym) { const p = path.join(NORM_DIR, sym, 'daily.json'); return fs.existsSync(p) ? buildSeries(JSON.parse(fs.readFileSync(p, 'utf8'))) : null; }

/** Approximate the ET minute of an ISO timestamp within a session (epoch is linear in ET minutes). */
function etMinuteOf(iso, session) {
  if (!iso || !session || !session.regular || !session.regular.length) return null;
  const epoch = Math.floor(Date.parse(iso) / 1000);
  const b0 = session.regular[0];
  return b0.etMinutes + Math.round((epoch - b0.epoch) / 60);
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  const fresh = argv.includes('--fresh');
  const seed = fresh ? (PACKET_SEED + 1) : PACKET_SEED;

  const uni = loadJson(UNIVERSE_PATH);
  if (!uni) { console.error('🔴 universe file absent — cannot stratify. Expected ' + UNIVERSE_PATH); process.exit(1); }
  const members = (uni.symbols || []).filter((m) => !m.quarantined);
  const stratumBySymbol = {}; for (const m of members) if (m.stratum) stratumBySymbol[m.symbol] = m.stratum;
  const symbols = members.map((m) => m.symbol);

  // Build the candidate event list: in-sample touch events joined across events+labels+features.
  const candidates = [];
  for (const sym of symbols) {
    const evs = loadJson(path.join(EVENTS_DIR, `${sym}.json`));
    const lab = loadJson(path.join(LABELS_DIR, `${sym}.json`));
    const fea = loadJson(path.join(FEATURES_DIR, `${sym}.json`));
    if (!evs || !lab) continue;
    const evById = new Map((evs.events || []).map((e) => [e.eventId, e]));
    const feById = new Map((fea && fea.rows ? fea.rows : []).map((r) => [r.eventId, r]));
    for (const l of lab.labels || []) {
      if (l.disposition !== 'touch' || l.eventDate >= HOLDOUT) continue; // in-sample touch only
      const ev = evById.get(l.eventId); const fe = feById.get(l.eventId);
      if (!ev) continue;
      candidates.push({
        eventId: l.eventId, symbol: sym, side: l.side, eventDate: l.eventDate, familyTier: l.familyTier,
        touchAt: l.touchAt, touchEtMinutes: l.touchEtMinutes, confirmationAt: l.confirmationAt, entryAt: l.entryAt,
        entryEtMinutes: l.entryEtMinutes, hourlyClass: l.hourly_class,
        zoneLow: ev.zoneLow, zoneHigh: ev.zoneHigh,
        baseCount: fe ? fe.features.pre_touch.base_count : null,
        legOriginDate: fe ? fe.features.pre_touch.current_leg_origin_date : null,
        extensionBucket: fe ? fe.features.pre_touch.extension_bucket : null,
      });
    }
  }
  if (!candidates.length) { console.error('🔴 No in-sample touch events found. Run the pipeline + label first.'); process.exit(1); }

  const { sample, allocation, availability, eligibleTotal } = stratifiedSample(candidates, stratumBySymbol, { total: SAMPLE_SIZE, seed });
  console.log(`Sampling ${sample.length}/${eligibleTotal} eligible in-sample touch events. Allocation: ${JSON.stringify(allocation)} (availability ${JSON.stringify(availability)}).`);

  // Render each packet (cache the 5m + daily per symbol).
  const fiveCache = new Map(), dailyCache = new Map();
  const packets = [];
  for (const s of sample) {
    if (!fiveCache.has(s.symbol)) { try { fiveCache.set(s.symbol, loadFiveMinByDate(s.symbol).fiveMinByDate); } catch { fiveCache.set(s.symbol, null); } }
    if (!dailyCache.has(s.symbol)) dailyCache.set(s.symbol, loadDailySeries(s.symbol));
    const five = fiveCache.get(s.symbol); const series = dailyCache.get(s.symbol);
    const session = five ? (five.get ? five.get(s.eventDate) : five[s.eventDate]) : null;
    const zone = { lo: s.zoneLow, hi: s.zoneHigh };
    const dailySvg = series && series.dateIndex.get(s.eventDate) != null
      ? dailyChartSVG(series, series.dateIndex.get(s.eventDate), { zone, legOriginDate: s.legOriginDate, title: `${s.symbol} daily (≤${DAILY_CONTEXT_SESSIONS} sessions to ${s.eventDate})` })
      : '<div style="color:#8b949e">daily context unavailable</div>';
    const confirmEt = etMinuteOf(s.confirmationAt, session);
    const hasSession = session && session.regular && session.regular.length;
    const hourlyWindowSvg = hasSession
      ? hourlyWindowChartSVG(session.regular, { zone, touchEt: s.touchEtMinutes, confirmEt, entryEt: s.entryEtMinutes, title: `${s.symbol} hourly confirmation window (touch bucket + next)` })
      : '<div style="color:#8b949e">confirmation window unavailable</div>';
    const intradaySvg = hasSession
      ? intradayChartSVG(session.regular, { zone, touchEt: s.touchEtMinutes, confirmEt, entryEt: s.entryEtMinutes, title: `${s.symbol} 5m ${s.eventDate}` })
      : '<div style="color:#8b949e">intraday session unavailable</div>';
    packets.push({ ...s, dailySvg, hourlyWindowSvg, intradaySvg });
  }

  const allocationStr = STRATA.map((k) => `${k}:${allocation[k]}`).join(' ');
  const html = packetHtml(packets, {
    count: packets.length, configVersion: CONFIG.version, seed: fresh ? `${seed} (--fresh)` : `${seed}`,
    allocationStr, holdout: HOLDOUT, garbageGatePct: CONFIG.manualReview.garbageGatePct,
    demoteBelowAgreementPct: CONFIG.manualReview.demoteBelowAgreementPct,
  });
  await fsp.mkdir(PACKETS_DIR, { recursive: true });
  await fsp.writeFile(path.join(PACKETS_DIR, 'packets.html'), html);
  await fsp.writeFile(path.join(PACKETS_DIR, 'packets_manifest.json'), JSON.stringify({
    generatedMode: 'packets', configVersion: CONFIG.version, seed, fresh, allocation, availability,
    sample: sample.map((s) => ({ eventId: s.eventId, symbol: s.symbol, stratum: s.stratum, eventDate: s.eventDate, side: s.side })),
  }, null, 2));
  console.log(`✅ reports/packets/packets.html (${packets.length} packets) + packets_manifest.json written.`);
  console.log(`Founder: open packets.html, grade each event (validity + leg-origin + base-count), click export, save the JSON as reports/packets_grading.json.`);
  console.log(`Gate: garbage > ${CONFIG.manualReview.garbageGatePct}% blocks the holdout (parent §12); component agreement < ${CONFIG.manualReview.demoteBelowAgreementPct}% demotes that feature to exploratory-only (§A4.1).`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
