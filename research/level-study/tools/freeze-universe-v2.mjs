// research/level-study/tools/freeze-universe-v2.mjs
//
// LevelStory S5.6 — write universe_frozen.json v2 from the Phase A sweep + the founder's rulings.
//
//   node tools/freeze-universe-v2.mjs
//
// Pure derivation from `data/phase-a/phase_a_sweep.json` + the rulings recorded in
// docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S5_6.md. Decides nothing; every exclusion and every sector
// override below is a founder ruling, cited. Re-runnable and deterministic.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from '../config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY_ROOT = path.resolve(HERE, '..');
const SWEEP = path.join(STUDY_ROOT, 'data', 'phase-a', 'phase_a_sweep.json');
const OUT = path.join(STUDY_ROOT, 'universe_frozen.json');

// ── Founder rulings, 2026-07-13 (Phase A hard gate) ──────────────────────────
// Every entry here is a DECISION THE FOUNDER MADE, transcribed. This script makes none of its own.
const EXCLUDE = {
  // Ruling 1 — R2 failures (<550 daily sessions before 2023-07-10).
  HOOD: 'R2 FAIL — 488 pre-study sessions (−62). IPO 2021-07-29.',
  CEG: 'R2 FAIL — 368 pre-study sessions (−182). Constellation spin-off 2022-01.',
  CRWV: 'R2 FAIL — 0 pre-study sessions (−550). CoreWeave IPO 2025-03; listed after the study window opens.',
  GEV: 'R2 FAIL — 0 pre-study sessions (−550). GE Vernova spin-off 2024-03.',
  // Ruling 2 — SPAC shell.
  RKLB: 'SPAC SHELL — 64 sessions at $10.35 ± $0.22 / 0.69% daily vol, then ×7.2 vol on 2021-03-01. '
    + 'Shell-era bars sit inside the 504-session extension window and the 252-session trend-origin lookback; '
    + 'they would poison extension percentiles. Same rationale as DKNG.',
};

// Dropped BEFORE the sweep (recorded here so the provenance chain is complete).
const DROPPED_PRE_SWEEP = {
  GOOG: 'Same company as GOOGL (dual share class) — would double-count in peer confirmation, breadth, and the momentum deciles.',
  DKNG: 'De-SPAC (DEAC/SBTech shell) — shell-era bars are not economically DKNG.',
};

// ── DATA-INTEGRITY QUARANTINE (discovered in Phase B; FOUNDER RULING PENDING) ─────────────────
//
// These symbols FAIL the A1 cross-grain invariant (raw daily close vs the 5m closing-auction print,
// 0.1% tolerance — parent §4.3, NEVER loosened). The failure is not noise: for each, the diff is a
// CONSTANT ratio across a span that stops dead on one date — a SPINOFF.
//
// Root cause: EODHD back-adjusts the DAILY `close` field for spinoffs but delivers 5-minute bars AS
// PRINTED. The A1 premise — "daily close is the raw point-in-time print" — is therefore FALSE for
// spinoff names, on every session before their spinoff.
//
// Consequence if included: levels and ATR are built on the daily (spinoff-adjusted) basis while
// events are detected on 5m bars that are NOT spinoff-adjusted. For DD the two bases differ by
// 2.39× — every level would sit 139% away from every 5m bar and the events would be garbage.
//
// NOT FIXED HERE, deliberately: re-deriving the adjustment factor from the auction print would make
// the cross-grain invariant pass BY CONSTRUCTION and destroy the diagnostic that caught this. The
// tolerance is never loosened. Parent §4.3: "quarantine, don't degrade" — a symbol whose grains
// disagree is quarantined UNTIL EXPLAINED, and it is now explained but not yet ruled on.
const QUARANTINE = {
  DD: 'A1 CROSS-GRAIN FAIL — 589/758 sessions (77.7%). Constant 2.3909× ratio (139.09%) from 2023-05-24 → 2025-10-31; grains re-converge 2025-11-03. DuPont/Qnity spinoff: EODHD spinoff-adjusted the daily close, not the 5m.',
  LEN: 'A1 CROSS-GRAIN FAIL — 410/764 sessions (53.7%). Constant 1.0074× ratio (0.74%) from 2023-05-24 → 2025-01-17; grains re-converge 2025-01-21. Lennar/Millrose spinoff.',
  K: 'A1 CROSS-GRAIN FAIL — 88/618 sessions (14.2%). Constant 1.0657× ratio (6.57%) from 2023-05-24 → 2023-09-29; grains re-converge 2023-10-02. Kellogg/WK Kellogg spinoff.',
};

// Ruling 3/4 — sector overrides. The map is GICS-derived (EODHD General::GicSector); these are the
// named exceptions the founder ruled on.
const SECTOR_OVERRIDE = {
  AFRM: {
    sector: 'XLF',
    why: 'FOUNDER OVERRIDE of the vendor (GICS says XLI / Industrials / Professional Services). The sector map '
      + 'exists to capture ECONOMIC PEER SIMILARITY, not taxonomic correctness. Affirm is a BNPL consumer lender; '
      + 'its peers are consumer-finance names, not GE and CAT. A deliberate, reasoned override — not a data error.',
  },
  // BE needs no override: GICS already says XLI (Industrials/Electrical Equipment). It is the PRODUCT
  // map that was wrong (XLK). Adopting GICS fixes it. Recorded because it was a named founder ruling.
};

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

async function main() {
  if (!fs.existsSync(SWEEP)) throw new Error(`missing ${path.relative(STUDY_ROOT, SWEEP)} — run tools/phase-a-universe-sweep.mjs first`);
  const sweep = JSON.parse(fs.readFileSync(SWEEP, 'utf8'));

  const passed = sweep.symbols.filter((s) => s.r2.verdict === 'PASS');
  const kept = passed.filter((s) => !EXCLUDE[s.symbol]);
  const excluded = passed.filter((s) => EXCLUDE[s.symbol]);

  // Sector = GICS-derived, with the founder's named overrides applied.
  // Quarantined symbols STAY in the file (the founder approved 232; hiding them would be a silent
  // universe change) but carry `quarantined: true` and a reason. The build stages skip them and say
  // so out loud. If the founder rules them back in, one flag flips.
  const symbols = kept.map((s) => {
    const ov = SECTOR_OVERRIDE[s.symbol];
    const gics = s.eodhdSector;
    const q = QUARANTINE[s.symbol];
    return {
      symbol: s.symbol,
      sector: ov ? ov.sector : gics,
      sectorSource: ov ? 'founder_override' : 'EODHD General::GicSector',
      productSector: s.productSector,
      atrPct: s.atrPct,
      ...(q ? { quarantined: true, quarantineReason: q } : {}),
    };
  });

  // Strata — ATR% tertiles, recut on the FINAL 232 (not the 233 sweep set): the strata must describe
  // the universe that actually exists, and RKLB's removal shifts the boundaries. Mechanical.
  const ranked = symbols.filter((s) => s.atrPct != null).sort((a, b) => a.atrPct - b.atrPct);
  const t1 = Math.floor(ranked.length / 3), t2 = Math.floor((2 * ranked.length) / 3);
  const cut1 = ranked[t1] ? ranked[t1].atrPct : null;
  const cut2 = ranked[t2] ? ranked[t2].atrPct : null;
  ranked.forEach((s, i) => { s.stratum = i < t1 ? 'LOW_VOL' : i < t2 ? 'MID_VOL' : 'HIGH_VOL'; });
  for (const s of symbols) if (!s.stratum) s.stratum = null;

  const bySector = {};
  for (const s of symbols) bySector[s.sector] = (bySector[s.sector] || 0) + 1;
  const byStratum = {};
  for (const s of symbols) byStratum[s.stratum] = (byStratum[s.stratum] || 0) + 1;

  const doc = {
    universeVersion: 2,
    frozenAt: '2026-07-13',
    studyStart: CONFIG.range.studyStart,
    studyEnd: CONFIG.range.studyEnd,
    holdoutStart: CONFIG.range.holdoutStart,
    configVersion: CONFIG.version,

    provenance: {
      basis: 'api/_utils/rankingConfig.js STOCK_UNIVERSE (239 tickers, 11 SPDR sectors) — DATA TRANSCRIPTION, never imported.',
      pipeline: '239 product tickers → −GOOG −DKNG (founder, pre-sweep) → 237 candidates → R2 sweep (233 PASS / 4 FAIL) → −RKLB (founder, SPAC shell) → 232 frozen.',
      eligibilityRule: `R2: ≥${CONFIG.universe.eligibilityMinPreStudySessions} daily trading sessions before ${CONFIG.universe.eligibilityAsOf}. Swept with lib/depth-eligibility.js.`,
      sectorTaxonomy: 'SPDR Select Sector (11 GICS sectors).',
      sectorSource:
        'EODHD `General::GicSector` (GICS) — NOT `General::Sector` (Morningstar). The SPDR sector ETFs track GICS, and every '
        + 'sector feature (rs_vs_sector_*, sector_rs_vs_spy_*, sector_direction_at_touch) plus the peer group itself is measured '
        + 'against those ETFs, so a symbol must be grouped with the ETF it is actually a constituent of. Using the Morningstar '
        + 'field would have introduced 3 new errors (ADP, PKG, WBA) to fix 1. Against GICS the product map is right on 234/237. '
        + 'See LESSON L-S56-1 in docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S5_6.md.',
      strataRule: 'ATR% (median ATR14/close over the study window) tertiles, cut on the FINAL 232. Mechanical, disclosed; replaces the four hand-assigned v1 strata, which did not scale and were never mechanical.',
      unchangedFromV1: 'Study window, holdout date, geometry, the six pre-registered questions, and every honesty floor are UNCHANGED. Only the symbol set grows.',
      amendments: 'S56-A1 (hasIntradayApproach / P3), S56-A2 (OPEN_TOUCH), S56-A3 (universe v2), S56-A4 (bar-coverage guard), S56-A5 (completeness floor — pending founder).',
      rulingsDoc: 'docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S5_6.md',
    },

    counts: {
      frozen: symbols.length,
      quarantined: Object.keys(QUARANTINE).length,
      buildable: symbols.filter((s) => !s.quarantined).length, // what the build stages actually run on
      bySector, byStratum,
    },
    dataIntegrityQuarantine: {
      invariant: 'A1 / parent §4.3 — |raw daily close − 5m closing-auction print| ≤ 0.1%, NEVER loosened (S3-R2).',
      rootCause: 'EODHD back-adjusts the DAILY `close` field for SPINOFFS but delivers 5-minute bars AS PRINTED. The A1 premise that the daily close is the raw point-in-time print is FALSE for spinoff names, on every session before the spinoff.',
      consequenceIfIncluded: 'Levels/ATR are built on the daily (spinoff-adjusted) basis while events are detected on 5m bars that are NOT spinoff-adjusted. For DD the bases differ by 2.39× — every level would sit 139% from every 5m bar. The events would be garbage.',
      notFixed: 'Deliberate. Re-deriving the adjustment factor from the auction print would make the cross-grain invariant pass BY CONSTRUCTION and destroy the diagnostic that caught this.',
      status: '⛔ FOUNDER RULING REQUIRED — quarantined pending ruling (parent §4.3 "quarantine, don\'t degrade").',
      symbols: Object.entries(QUARANTINE).map(([symbol, reason]) => ({ symbol, reason })),
    },
    strataCutPoints: { rule: 'median ATR14/close %, tertiles of the frozen 232', LOW_below: cut1, HIGH_atOrAbove: cut2 },

    droppedPreSweep: DROPPED_PRE_SWEEP,
    excludedAtGate: excluded.map((s) => ({ symbol: s.symbol, productSector: s.productSector, reason: EXCLUDE[s.symbol] })),
    sectorOverrides: Object.entries(SECTOR_OVERRIDE).map(([symbol, o]) => ({ symbol, sector: o.sector, why: o.why })),
    sectorMapCorrections: [
      { symbol: 'BE', from: 'XLK (product)', to: 'XLI (GICS)', why: 'Genuine product error — Bloom Energy is GICS Industrials / Electrical Equipment. The v1 freeze already had XLI. Founder ruling 4.' },
    ],
    unresolvedButMoot: [
      { symbol: 'GEV', product: 'XLI', gics: 'XLU', why: 'Sector disagreement NOT resolved — GEV fails R2 (zero pre-study sessions) and is not in the universe, so it has no sector entry, peer group, or RS benchmark. Recorded so the disagreement cannot be silently inherited if GEV is revisited on a later window.' },
    ],

    // Context symbols are NOT study subjects — no events are detected on them.
    contextSymbols: {
      market: ['SPY'],
      // ALL ELEVEN SPDR sector ETFs (v1 fetched only XLK + XLE — the cause of the 53.5%
      // sector_rs_vs_spy null: the 6 study names outside XLK/XLE had no sector series at all).
      sectorETFs: CONFIG.universe.sectorEtfs,
      appetite: CONFIG.universe.dailyGrainOnly, // SPHB/SPLV — DAILY-GRAIN ONLY (S3-R4); their 5m is never fetched
      note: 'SPY + all 11 SPDR sector ETFs supply daily series AND 5m direction tags. SPHB/SPLV are daily-only beta-appetite inputs (S3-R4) and their 5m is never fetched or referenced.',
    },

    symbols: symbols.sort((a, b) => (a.symbol < b.symbol ? -1 : 1)),
  };

  await fsp.writeFile(OUT, `${JSON.stringify(doc, null, 2)}\n`);

  console.log(`universe_frozen.json v2 → ${symbols.length} symbols (${symbols.filter((s) => !s.quarantined).length} buildable, ${Object.keys(QUARANTINE).length} QUARANTINED)`);
  if (Object.keys(QUARANTINE).length) console.log(`  🔴 data-integrity quarantine (A1 cross-grain): ${Object.keys(QUARANTINE).join(', ')} — FOUNDER RULING REQUIRED`);
  console.log(`  excluded at the gate: ${excluded.map((s) => s.symbol).join(', ')}`);
  console.log(`  sector overrides:     ${Object.keys(SECTOR_OVERRIDE).join(', ') || 'none'}`);
  console.log(`  strata cut points:    LOW < ${cut1}% ≤ MID < ${cut2}% ≤ HIGH`);
  console.log(`  by stratum:           ${Object.entries(byStratum).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`  by sector:            ${Object.entries(bySector).sort().map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`  context:              SPY + ${CONFIG.universe.sectorEtfs.length} sector ETFs + ${CONFIG.universe.dailyGrainOnly.join('/')} (daily-only)`);
  const median232 = median(symbols.map((s) => s.atrPct).filter((x) => x != null));
  console.log(`  median ATR%:          ${median232}`);
}

main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
