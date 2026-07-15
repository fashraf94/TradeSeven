// research/level-study/06-aggregate.js
//
// LevelStory Session 7 — THE AGGREGATION RUNNER (parent §10, §11, §15; Addendum §A7). Joins the
// per-event labels (data/labels) with the feature rows (data/features) on eventId, mode-filters to the
// in-sample or held-out window, runs the frozen pre-registered aggregation (lib/aggregate.js), and
// renders the four-view report (Addendum §A7) as reports/{insample_v4,final_v4}.md + .json.
//
//   npm run aggregate:insample     # reads ONLY in-sample events (< 2025-12-10) → reports/insample_v4.*
//   npm run aggregate:holdout      # opens the holdout ONCE, applies §11.4 + §15.5 → reports/final_v4.*
//
// ⛔ THE HOLDOUT OPENS EXACTLY ONCE (parent §11.4). `aggregate:insample` CANNOT read a post-holdout
// event — asserted in code (assertNoHoldoutLeak). `aggregate:holdout` is founder-triggered, after the
// in-sample analysis AND the manual-validation packets pass, and it is SINGLE-OPEN: a failing result is
// DEAD, never re-tuned or re-tested. There are no knobs to re-tune — everything is frozen; the
// discipline is that we do not fish the holdout for a rescue.
//
// This runner does I/O and rendering only. Every statistic and every verdict lives in lib/aggregate.js
// / lib/stats.js as pure functions, and every displayed verdict is derived from the same rounded value
// it prints (BUILD_RULES §9 display-agreement). Zero product imports; artifacts are gitignored.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.js';
import {
  aggregateInSample, applyHoldout, poolingPermitted, HOLDOUT_START, SIDES,
  MIN_N, MIN_UD, MIN_DIFF_POINTS, P6_MIN_DIFF_POINTS, ASYMMETRY_MULT,
} from './lib/aggregate.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const LABELS_DIR = path.join(HERE, 'data', 'labels');
const FEATURES_DIR = path.join(HERE, 'data', 'features');
const REPORTS_DIR = path.join(HERE, 'reports');
const UNIVERSE_PATH = path.join(REPO_ROOT, CONFIG.universe.universeFilePath);
const REG_OPEN = CONFIG.session.regularOpenEtMinutes; // 570

// ── Load + join ────────────────────────────────────────────────────────────────────────────────────

function loadJson(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; }

/** Build one canonical joined record from a label + its feature row (feature may be null). */
function joinRecord(label, feat) {
  const pre = feat && feat.features ? feat.features.pre_touch : {};
  const ct = label.confirmationTime;
  const tt = label.touchTime;
  return {
    eventId: label.eventId,
    symbol: label.symbol,
    sector: label.sector ?? null,
    side: label.side,
    eventDate: label.eventDate,
    familyTier: label.familyTier ?? null,
    disposition: label.disposition,
    touchEtMinutes: label.touchEtMinutes ?? (feat ? feat.touchEtMinutes : null),
    hasIntradayApproach: feat ? feat.hasIntradayApproach : null,
    hourlyClassEligible: label.hourlyClassEligible ?? null,
    hourly_class: label.hourly_class ?? null,
    // feature-layer splits (P3/P6 + lift controls)
    rvol_bucket: pre.rvol_bucket ?? null,
    extension_bucket: pre.extension_bucket ?? null,
    momo_regime: pre.momo_regime ?? null,
    base_count: pre.base_count ?? null,
    move_origin: pre.move_origin ?? null,
    tod_bucket: pre.tod_bucket ?? null,
    vol_regime_pctile: pre.vol_regime_pctile ?? null,
    spy_direction_at_touch: pre.spy_direction_at_touch ?? null,
    // §A7 context view: group leadership (peer confirmations) + breadth at event
    peer_confirmations: label.peer_confirmations_same_session_before_touch ?? (pre.peer_confirmations_same_session_before_touch ?? null),
    breadth_pct_above_50dma: pre.breadth_pct_above_50dma ?? null,
    // outcome endpoints
    held_EOD_entry: ct ? ct.held.EOD : null,
    clean_bounce_touch: tt ? tt.cleanBounce : null,
    clean_bounce_entry: ct ? ct.cleanBounce : null,
    mfe_eod_entry: ct ? ct.mfe.EOD : null,
    mae_eod_entry: ct ? ct.mae.EOD : null,
    fraction_elapsed: label.fractionElapsedAtEntry ?? null,
  };
}

/** Join all symbols' labels + features into canonical records. Returns { records, diag }. */
function loadJoined(symbols) {
  const records = [];
  const diag = { symbolsLoaded: 0, labelFilesMissing: [], featureFilesMissing: [], featureRowMissing: 0, configMismatch: [] };
  for (const sym of symbols) {
    const lab = loadJson(path.join(LABELS_DIR, `${sym}.json`));
    const fea = loadJson(path.join(FEATURES_DIR, `${sym}.json`));
    if (!lab) { diag.labelFilesMissing.push(sym); continue; }
    if (!fea) diag.featureFilesMissing.push(sym);
    if (lab.configVersion != null && lab.configVersion !== CONFIG.version) diag.configMismatch.push(`${sym}:labels=${lab.configVersion}`);
    if (fea && fea.configVersion != null && fea.configVersion !== CONFIG.version) diag.configMismatch.push(`${sym}:features=${fea.configVersion}`);
    const featById = new Map((fea && fea.rows ? fea.rows : []).map((r) => [r.eventId, r]));
    for (const label of lab.labels || []) {
      const feat = featById.get(label.eventId) || null;
      if (label.disposition === 'touch' && !feat) diag.featureRowMissing += 1;
      records.push(joinRecord(label, feat));
    }
    diag.symbolsLoaded += 1;
  }
  return { records, diag };
}

// ── The single-open date guard (parent §11.4; S7 §7) ────────────────────────────────────────────────

/**
 * Validate the clustering key on the RAW loaded records BEFORE any holdout filtering. A record with a
 * defaulted eventDate must THROW (L-S56-2), not silently vanish: `null < '2025-12-10'` is false, so a
 * broken-date record would be dropped by the in-sample filter and never reach assertAggregable — a
 * silent loss of a required input, exactly the failure the byte-identical guard exists to prevent.
 */
function assertEventDates(records) {
  const bad = records.find((r) => typeof r.eventDate !== 'string' || !r.eventDate);
  if (bad) {
    throw new Error(
      `aggregate: record ${bad.eventId ?? '(no id)'} has no string eventDate — the clustering unit is `
      + 'never defaulted; refusing to silently drop it through the holdout filter (L-S56-2). Aborting.',
    );
  }
  return true;
}

/** Assert the in-sample aggregation cannot see a post-holdout event. Throws loudly on any leak. */
function assertNoHoldoutLeak(records) {
  const leak = records.find((r) => r.eventDate >= HOLDOUT_START);
  if (leak) {
    throw new Error(
      `HOLDOUT LEAK: event ${leak.eventId} (${leak.eventDate}) is on/after the holdout boundary ${HOLDOUT_START} `
      + 'but reached the in-sample aggregation. The holdout opens exactly once, founder-triggered — '
      + 'aggregate:insample must never read it (parent §11.4). Aborting.',
    );
  }
  return true;
}

// ── Footer facts (parent §10.3 — the mandatory disclosure block) ────────────────────────────────────

function round1(x) { return x == null ? null : Math.round(x * 10) / 10; }

function footerFacts(allRecords, modeRecords, universe, mode) {
  const touch = modeRecords.filter((r) => r.disposition === 'touch');
  const dates = touch.map((r) => r.eventDate).sort();
  const bySym = {};
  for (const r of touch) bySym[r.symbol] = (bySym[r.symbol] || 0) + 1;
  const top5 = Object.values(bySym).sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const openTouch = touch.filter((r) => r.hasIntradayApproach === false && r.touchEtMinutes === REG_OPEN).length;
  const dataGap = touch.filter((r) => r.hasIntradayApproach === false && r.touchEtMinutes !== REG_OPEN).length;
  const f2 = touch.filter((r) => r.familyTier === 'F2' || r.familyTier === 'F3');
  const droppedIneligible = f2.filter((r) => r.hourlyClassEligible !== true).length;

  // Ambiguity rates + manual-validation garbage rate come from side artifacts if a real run produced
  // them; never fabricated. (data/labels/_stats.json from S6; reports/packets_grading.json from Phase B.)
  const labelStats = loadJson(path.join(LABELS_DIR, '_stats.json'));
  const grading = loadJson(path.join(REPORTS_DIR, 'packets_grading.json'));

  return {
    universeSurvivorshipNote:
      `Universe frozen ${universe ? universe.frozenAt || 'universeVersion ' + (universe.universeVersion ?? '?') : '(universe file absent)'}; `
      + `${universe ? (universe.symbols || []).length : '?'} names, stratified survivorship-disclosed (parent §13 pitfall #13). `
      + 'Names delisted/acquired mid-window are NOT back-filled; the frozen list is the study population.',
    verifiedDataRange: dates.length ? `${dates[0]} … ${dates[dates.length - 1]} (${mode})` : '(no events)',
    configVersion: CONFIG.version,
    eventCounts: {
      totalRecordsLoaded: allRecords.length,
      modeTouchEvents: touch.length,
      afterEpisodeFiltering: touch.length, // episode filtering is upstream (§6); these are the analyzable touches
    },
    uniqueEventDates: new Set(dates).size,
    top5SymbolPct: touch.length ? round1((top5 / touch.length) * 100) : null,
    openTouchCount: openTouch,              // S56-A2 descriptive class
    noPreBarDataGapCount: dataGap,          // S56-A2/A4 data-quality diagnostic (a large count is a finding)
    droppedIncompleteHourlyBars: droppedIneligible, // S56-A4 (a large count is a finding)
    ambiguityByPair: labelStats && labelStats.report ? labelStats.report.ambiguityByPair : '(data/labels/_stats.json absent — run npm run label)',
    corporateActionExclusion:
      `sourced upstream — events within ±${CONFIG.adjustment.corporateActionAdjacentSessions} sessions of a split/div ex-date are excluded at event detection (parent §4.3); `
      + 'the exact count lives in the events manifest and is NOT recomputed in the aggregation layer '
      + '(the label/feature records carry no corporate-action flag). Reported as an upstream count, never fabricated here.',
    manualValidationGarbageRate: grading
      ? `${grading.garbagePct}% (n=${grading.graded}) — gate is >${CONFIG.manualReview.garbageGatePct}% blocks the holdout (parent §12)`
      : '(reports/packets_grading.json absent — Phase B manual validation not yet graded)',
  };
}

// ── Executive verdict summary (BUILD_RULES §8 — lead with the verdict table) ────────────────────────

function collectVerdicts(agg) {
  const rows = [];
  const push = (q, side, contrastName, verdict, extra) => rows.push({ q, side, contrast: contrastName, verdict, ...extra });
  for (const side of SIDES) {
    for (const c of agg.P1.perSide[side].contrasts) push('P1', side, c.contrastName, c.verdict);
    for (const c of agg.P3.perSide[side].contrasts) push('P3', side, c.contrastName, c.verdict);
    push('P4', side, agg.P4.perSide[side].contrast.contrastName, agg.P4.perSide[side].contrast.verdict);
    push('P5', side, agg.P5.perSide[side].contrast.contrastName, agg.P5.perSide[side].contrast.verdict);
    push('P6', side, agg.P6.perSide[side].contrast.contrastName, agg.P6.perSide[side].contrast.verdict);
    for (const [cls, d] of Object.entries(agg.P2.perSide[side].perClass)) push('P2', side, `${cls} (bridge)`, d.provisional);
  }
  return rows;
}

// ── Markdown rendering (Addendum §A7 four views; parent §10.3 no-composite/display-agreement) ───────

const fmtPct = (x) => (x == null ? '—' : `${x.toFixed(2)}%`);
const fmtCI = (ci) => (ci == null ? '—' : `[${(ci.loPct ?? ci.lo)?.toFixed(2)}, ${(ci.hiPct ?? ci.hi)?.toFixed(2)}]`);
const mixStr = (m) => Object.entries(m).map(([k, v]) => `${k}:${v}`).join(', ');

function renderCellRow(c) {
  const rate = c.floorOk ? fmtPct(c.ratePct) : `**${c.insufficient}**`;
  const ci = c.floorOk ? fmtCI(c.rateCI) : '—';
  return `| ${c.label} | ${c.n} | ${c.uniqueDates} | ${rate} | ${ci} | ${c.top5SymbolPct ?? '—'}% |`;
}

function renderContrast(c, lines) {
  lines.push(`- **${c.contrastName}** → verdict: \`${c.verdict}\``);
  if (c.diffPoints != null || c.diffMedian != null) {
    const d = c.diffPoints != null ? `${c.diffPoints.toFixed(2)} pts` : `${c.diffMedian?.toFixed(2)} ATR (median)`;
    lines.push(`  - difference: ${d}; 90% clustered CI ${fmtCI(c.diffCI)}; excludes zero: ${c.ciExcludesZero}; min floor: ${c.minDiffPoints ?? 'median'} pts`);
    if (c.stability) {
      lines.push(`  - stability review: ${c.stability.pass ? 'PASS' : `**FAIL** (${(c.stability.flips || []).map((f) => `${f.type}:${f.key}`).join(', ')})`}`);
    }
    if (c.asymmetry) {
      for (const [k, a] of Object.entries(c.asymmetry)) {
        if (a && a.medianMfe != null) lines.push(`  - asymmetry [${k}]: median MFE ${a.medianMfe} vs median MAE ${a.medianMae} → favorable(≥${ASYMMETRY_MULT}×): ${a.favorable}`);
      }
    }
  } else {
    lines.push('  - one or both siblings below floor — no sibling difference computed (UNCONFIRMED — insufficient).');
  }
}

function renderCohortViews(qres, side, lines) {
  const s = qres.perSide[side];
  // 1. Pattern view — the taxonomy cells with their rates.
  lines.push(`#### ${qres.question} — ${side} (population n=${s.population ?? s.n ?? '—'})`);
  if (s.cells) {
    lines.push('');
    lines.push('_Pattern view_ — rate per cell (rate shown only when n≥30 AND uniqueDates≥15):');
    lines.push('| cell | n | uniqueDates | rate | 90% CI | top5-sym |');
    lines.push('|---|---|---|---|---|---|');
    for (const c of s.cells) lines.push(renderCellRow(c));
  }
  // 2. Context view (Addendum §A7: group leadership, regime mix, breadth, extension, leg maturity, move origin).
  if (s.context) {
    const c = s.context;
    lines.push('');
    lines.push('_Context view_ (descriptive, never verdict-bearing):');
    lines.push(`- group leadership (median peer confirmations before touch): ${c.groupLeadershipMedianPeerConfirmations ?? '—'}; breadth (median % above 50DMA): ${c.breadthMedianPctAbove50dma ?? '—'}`);
    lines.push(`- regime: ${mixStr(c.regimeMix)}`);
    lines.push(`- extension: ${mixStr(c.extensionMix)}; leg maturity (base_count median): ${c.legMaturityBaseCountMedian ?? '—'}; move-origin: ${mixStr(c.moveOriginMix)}`);
  }
  // 3. Comparative view — the sibling contrasts + incremental lift.
  lines.push('');
  lines.push('_Comparative view_ — sibling contrasts (condition-vs-condition; no pooled headline):');
  const contrasts = s.contrasts || (s.contrast ? [s.contrast] : []);
  if (!contrasts.length) lines.push('- (no contrasts for this question type)');
  for (const c of contrasts) renderContrast(c, lines);
  if (s.incrementalLift) {
    lines.push(`- incremental lift (parent §11.3, exploratory appendix — directional flag only): retained significance = **${s.incrementalLift.retainedSignificance}**${s.incrementalLift.direction ? ` (${s.incrementalLift.direction})` : ''} — _${s.incrementalLift.note}_`);
  }
  // 4. Validation view (Addendum §A7: symbol concentration, sector concentration, unique-event-date count).
  lines.push('');
  lines.push('_Validation view_ — concentration + power:');
  const valLine = (cell) => `- ${cell.label}: uniqueDates=${cell.uniqueDates}, top-5 symbols=${cell.top5SymbolPct ?? '—'}%${cell.topSymbols && cell.topSymbols.length ? ` (${cell.topSymbols.join(',')})` : ''}, top sector=${cell.topSectorPct ?? '—'}%${cell.topSectors && cell.topSectors.length ? ` (${cell.topSectors.join(', ')})` : ''}`;
  if (s.cells) {
    for (const c of s.cells) lines.push(valLine(c));
  } else if (s.contrast) {
    for (const cell of [s.contrast.cellA, s.contrast.cellB]) lines.push(valLine(cell));
  }
  lines.push('');
}

function renderP2(qres, side, lines) {
  const s = qres.perSide[side];
  lines.push(`#### P2 — ${side} (bridge; population n=${s.population})`);
  lines.push('_Pattern view_ — fractionElapsedAtEntry distribution + remaining MFE/MAE asymmetry per class:');
  lines.push('| class | n(frac) | uniqueDates | p25 | median | p75 | med MFE | med MAE | favorable(≥2×) | provisional |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const [cls, d] of Object.entries(s.perClass)) {
    const f = d.fractionElapsed;
    const a = d.asymmetry;
    lines.push(`| ${cls} | ${d.fracN} | ${d.uniqueDates} | ${f ? f.p25 : '—'} | ${f ? f.median : '**' + (d.insufficient || 'insufficient') + '**'} | ${f ? f.p75 : '—'} | ${a.medianMfe ?? '—'} | ${a.medianMae ?? '—'} | ${a.favorable ?? '—'} | \`${d.provisional}\` |`);
  }
  lines.push('');
}

function renderOpenTouch(qres, lines) {
  lines.push('### OPEN_TOUCH — descriptive base rates only (S56-A2; NEVER pooled, NEVER a verdict)');
  lines.push(`_${qres.note}_`);
  lines.push('| side | n | uniqueDates | F2+ n | held_EOD | clean_bounce(touch) | med MFE(EOD) | med MAE(EOD) |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const side of SIDES) {
    const s = qres.perSide[side];
    const hr = s.baseRates.held_EOD, cb = s.baseRates.clean_bounce_touch;
    lines.push(`| ${side} | ${s.n} | ${s.uniqueDates} | ${s.f2plusN} | ${hr.ratePct != null ? fmtPct(hr.ratePct) : hr.insufficient} | ${cb.ratePct != null ? fmtPct(cb.ratePct) : cb.insufficient} | ${s.baseRates.medianMfeEOD ?? '—'} | ${s.baseRates.medianMaeEOD ?? '—'} |`);
  }
  lines.push('');
}

function renderInSampleReport(agg, footer, diag) {
  const L = [];
  L.push('# LevelStory — In-Sample Aggregation (Phase A)');
  L.push('');
  L.push(`Config v${CONFIG.version}. Window: in-sample only (eventDate < ${HOLDOUT_START}). The holdout is UNTOUCHED.`);
  L.push(`Floors: a rate is shown only at **n ≥ ${MIN_N} AND uniqueDates ≥ ${MIN_UD}** (S5-A2). Sibling-diff floor: ${MIN_DIFF_POINTS} pts (P6: ${P6_MIN_DIFF_POINTS} pts). Asymmetry: median MFE ≥ ${ASYMMETRY_MULT}× median MAE (§15.5).`);
  L.push('');
  L.push('> Provisional verdicts apply §15 criteria 1–3 (floor; sibling difference significant; stability). **CONFIRMED-pending-holdout** = a stable, significant in-sample effect awaiting the single-open holdout. **DEAD** = significant but stability-fragile (killed in-sample; not carried to the holdout — S7-C1). **UNCONFIRMED** = below floor or not significant. Holdout (criteria 4–5) is applied only by `aggregate:holdout`.');
  L.push('');

  // Executive verdict table (BUILD_RULES §8).
  L.push('## Executive verdict table');
  L.push('| Question | Side | Contrast | Provisional verdict |');
  L.push('|---|---|---|---|');
  for (const r of collectVerdicts(agg)) L.push(`| ${r.q} | ${r.side} | ${r.contrast} | \`${r.verdict}\` |`);
  L.push('');
  L.push('_Expected reality (S7 §3.3): SHARP_REJECT is rare; P4 and P6 gate on it and will very likely read `UNCONFIRMED — insufficient` per side after the split. That is an honest finding, not a defect — no definition is widened to avoid it._');
  L.push('');

  // Detail — four views per question per side (Addendum §A7).
  L.push('## Detail — four views per cohort (Addendum §A7)');
  for (const q of ['P1', 'P3', 'P4', 'P5', 'P6']) {
    L.push(`### ${q} — ${agg[q].study} — ${agg[q].endpoint} — gate: ${agg[q].gate || agg[q].within}`);
    for (const side of SIDES) renderCohortViews(agg[q], side, L);
    // Pooling guard (parent §10.2): only for the named 2-cell questions.
    if (agg[q].perSide.support.contrast) {
      const pool = poolingPermitted(agg[q].perSide.support.contrast, agg[q].perSide.resistance.contrast);
      L.push(`_Sign-separation (parent §10.2): pooling ${pool.permitted ? 'PERMITTED' : 'FORBIDDEN'} — ${pool.reason}_`);
      L.push('');
    }
  }
  // P2 (bridge) rendered specially.
  L.push('### P2 — bridge — fractionElapsedAtEntry + remaining MFE/MAE — gate: F2+ AND hourlyClassEligible');
  for (const side of SIDES) renderP2(agg.P2, side, L);
  // OPEN_TOUCH.
  renderOpenTouch(agg.OPEN_TOUCH, L);

  // Footer (parent §10.3) — the SAME complete block both reports carry.
  pushFooter(L, footer);
  L.push('');
  L.push(`_Join diagnostics: ${diag.symbolsLoaded} symbols loaded; ${diag.labelFilesMissing.length} label files missing; ${diag.featureFilesMissing.length} feature files missing; ${diag.featureRowMissing} touch events without a feature row.${diag.configMismatch.length ? ' ⚠ CONFIG MISMATCH: ' + diag.configMismatch.join(', ') : ''}_`);
  return L.join('\n');
}

/** The complete §10.3 disclosure footer — one source, so in-sample and final reports never diverge. */
function pushFooter(L, footer) {
  L.push('## Footer (mandatory disclosure — parent §10.3)');
  L.push(`- Universe + survivorship: ${footer.universeSurvivorshipNote}`);
  L.push(`- Verified data range: ${footer.verifiedDataRange}`);
  L.push(`- Config version: ${footer.configVersion}`);
  L.push(`- Event counts: ${footer.eventCounts.totalRecordsLoaded} records loaded → ${footer.eventCounts.modeTouchEvents} touch events (after upstream episode filtering)`);
  L.push(`- Unique event dates: ${footer.uniqueEventDates}`);
  L.push(`- Top-5-symbol contribution: ${footer.top5SymbolPct}%`);
  L.push(`- OPEN_TOUCH count (S56-A2 descriptive): ${footer.openTouchCount}`);
  L.push(`- NO_PRE_BAR_DATA_GAP count (S56-A2/A4 data-quality — a large count is a finding): ${footer.noPreBarDataGapCount}`);
  L.push(`- Dropped for incomplete hourly bars (S56-A4): ${footer.droppedIncompleteHourlyBars}`);
  L.push(`- Ambiguity rates per pair: ${typeof footer.ambiguityByPair === 'string' ? footer.ambiguityByPair : JSON.stringify(footer.ambiguityByPair)}`);
  L.push(`- Corporate-action exclusion count: ${footer.corporateActionExclusion}`);
  L.push(`- Manual-validation garbage rate: ${footer.manualValidationGarbageRate}`);
}

function renderFinalReport(insampleAgg, holdoutAgg, finals, footer) {
  const L = [];
  L.push('# LevelStory — Final Aggregation (Phase C: THE HOLDOUT, opened once)');
  L.push('');
  L.push(`Config v${CONFIG.version}. The holdout (eventDate ≥ ${HOLDOUT_START}) was opened EXACTLY ONCE. Single-open discipline: a failing result is DEAD — never re-tuned, never re-tested against these months (parent §11.4).`);
  L.push('');
  L.push('## Final verdict table');
  L.push('| Question | Side | Contrast | In-sample | Holdout diff | Final verdict | Why |');
  L.push('|---|---|---|---|---|---|---|');
  for (const f of finals) {
    L.push(`| ${f.q} | ${f.side} | ${f.contrast} | ${f.inSample} | ${f.holdoutDiff ?? '—'} | \`${f.finalVerdict}\` | ${f.reason} |`);
  }
  L.push('');
  pushFooter(L, footer); // the SAME complete §10.3 block as the in-sample report
  L.push('');
  L.push('_The honest verdicts — including the likely `UNCONFIRMED`/`DEAD` on P4/P6 (SHARP_REJECT is too rare to confirm at this sample, per side) — ARE the result of the study, not a failure._');
  return L.join('\n');
}

// ── Holdout wiring: pair each in-sample CONFIRMED-pending contrast with its holdout twin ─────────────

function buildFinals(insampleAgg, holdoutAgg) {
  const finals = [];
  const named = ['P4', 'P5', 'P6'];
  const findContrast = (agg, q, side) => agg[q].perSide[side].contrast;
  for (const side of SIDES) {
    // Named 2-cell questions.
    for (const q of named) {
      const inC = findContrast(insampleAgg, q, side);
      const hoC = findContrast(holdoutAgg, q, side);
      const res = applyHoldout(inC, hoC, { confirmationTime: true });
      finals.push({ q, side, contrast: inC.contrastName, inSample: inC.verdict, holdoutDiff: res.holdoutDiff, finalVerdict: res.finalVerdict, reason: res.reason });
    }
    // Multi-level questions: pair contrasts by name.
    for (const q of ['P1', 'P3']) {
      const hoByName = new Map(holdoutAgg[q].perSide[side].contrasts.map((c) => [c.contrastName, c]));
      for (const inC of insampleAgg[q].perSide[side].contrasts) {
        if (inC.verdict !== 'CONFIRMED-pending-holdout') continue; // only graduation candidates open the holdout
        const hoC = hoByName.get(inC.contrastName);
        const res = applyHoldout(inC, hoC, { confirmationTime: q === 'P1' });
        finals.push({ q, side, contrast: inC.contrastName, inSample: inC.verdict, holdoutDiff: res.holdoutDiff, finalVerdict: res.finalVerdict, reason: res.reason });
      }
    }
  }
  // Also surface the in-sample non-candidates so the final table is complete (they stay UNCONFIRMED/DEAD).
  for (const side of SIDES) {
    for (const q of ['P1', 'P3']) {
      for (const inC of insampleAgg[q].perSide[side].contrasts) {
        if (inC.verdict === 'CONFIRMED-pending-holdout') continue;
        finals.push({ q, side, contrast: inC.contrastName, inSample: inC.verdict, holdoutDiff: null, finalVerdict: inC.verdict.replace('-pending-holdout', ''), reason: 'not a holdout candidate (in-sample verdict stands)' });
      }
    }
  }
  return finals;
}

// ── Universe / symbols ──────────────────────────────────────────────────────────────────────────────

function loadUniverseSymbols() {
  const uni = loadJson(UNIVERSE_PATH);
  if (!uni) return { universe: null, symbols: CONFIG.universe.probe.equities };
  const members = (uni.symbols || []).filter((m) => !m.quarantined);
  return { universe: uni, symbols: members.map((m) => m.symbol) };
}

// ── Writer ────────────────────────────────────────────────────────────────────────────────────────

async function writeOut(base, md, json) {
  await fsp.mkdir(REPORTS_DIR, { recursive: true });
  await fsp.writeFile(path.join(REPORTS_DIR, `${base}.md`), md);
  await fsp.writeFile(path.join(REPORTS_DIR, `${base}.json`), JSON.stringify(json, null, 2));
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const mode = (process.argv[2] || '').toLowerCase();
  if (mode !== 'insample' && mode !== 'holdout') {
    console.error('Usage: node 06-aggregate.js <insample|holdout>');
    console.error('  insample — reads ONLY events before ' + HOLDOUT_START + ' → reports/insample_v4.*');
    console.error('  holdout  — opens the holdout ONCE → reports/final_v4.* (requires reports/insample_v4.json)');
    process.exit(2);
  }

  const { universe, symbols } = loadUniverseSymbols();
  console.log(`LevelStory aggregate v${CONFIG.version} — mode=${mode} — ${symbols.length} symbols`);
  const { records, diag } = loadJoined(symbols);
  if (!records.length) {
    console.error('🔴 No labels/features present. Run the pipeline locally first: npm run levels && npm run events && npm run features && npm run label');
    process.exit(1);
  }

  assertEventDates(records); // L-S56-2: a defaulted clustering key throws BEFORE the filter can hide it

  if (mode === 'insample') {
    const inSample = records.filter((r) => r.eventDate < HOLDOUT_START);
    assertNoHoldoutLeak(inSample); // ⛔ the holdout is never read here (parent §11.4)
    const agg = aggregateInSample(inSample);
    const footer = footerFacts(records, inSample, universe, 'in-sample');
    const md = renderInSampleReport(agg, footer, diag);
    const json = { generatedMode: 'insample', configVersion: CONFIG.version, holdoutBoundary: HOLDOUT_START, footer, diag, aggregation: agg, verdicts: collectVerdicts(agg) };
    await writeOut('insample_v4', md, json);
    console.log(`✅ reports/insample_v4.md + .json written. In-sample touch events: ${inSample.filter((r) => r.disposition === 'touch').length}.`);
    console.log('⛔ The holdout was NOT opened. Next founder step (after manual validation): npm run aggregate:holdout');
  } else {
    // holdout mode — requires the frozen in-sample report to apply §11.4 crit 4 (in-sample CI).
    const inJsonPath = path.join(REPORTS_DIR, 'insample_v4.json');
    const inJson = loadJson(inJsonPath);
    if (!inJson) { console.error(`🔴 ${inJsonPath} absent — run npm run aggregate:insample first (the in-sample analysis must be frozen before the holdout opens).`); process.exit(1); }
    const holdout = records.filter((r) => r.eventDate >= HOLDOUT_START);
    if (!holdout.length) { console.error('🔴 No holdout events found (eventDate ≥ ' + HOLDOUT_START + '). Nothing to open.'); process.exit(1); }
    const holdoutAgg = aggregateInSample(holdout); // same frozen machinery, on the held-out months
    const finals = buildFinals(inJson.aggregation, holdoutAgg);
    const footer = footerFacts(records, holdout, universe, 'holdout');
    const md = renderFinalReport(inJson.aggregation, holdoutAgg, finals, footer);
    const json = { generatedMode: 'holdout', configVersion: CONFIG.version, holdoutBoundary: HOLDOUT_START, footer, finals, holdoutAggregation: holdoutAgg };
    await writeOut('final_v4', md, json);
    console.log(`✅ reports/final_v4.md + .json written. Holdout touch events: ${holdout.filter((r) => r.disposition === 'touch').length}.`);
    console.log('⛔ The holdout is now spent. Single-open: failing results are DEAD — never re-tested against these months (parent §11.4).');
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });

export { loadJoined, joinRecord, assertNoHoldoutLeak, assertEventDates, footerFacts, buildFinals };
