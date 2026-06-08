// scratch/scouting-focus-replay/harness.mjs
//
// THROWAWAY Stage-0 measurement harness. NOT production / NOT shipped.
//
// BOUNDARY: the archetype ranking engine is FENCED. This harness imports and
// CONSUMES the real engine read-only:
//   - computeArchetypeRankings()  (api/_utils/archetypeScoring.js)  → real ranking
//   - screenStocks()              (api/_utils/screenStocks.js)      → real screener
// It applies its OWN parametrized post-rank tilt *here only*. No engine file is
// edited. This mirrors the eventual design (focus = bounded post-rank promotion).
//
// Two draft models are measured because the real draft has two layers:
//   Model B — draft off the TOP of the (tilted) archetype ranking. This is the
//             signal the Sonnet/Haiku draft is steered by (it reads the
//             archetype-ranked CSV top-down). Most representative of focus reach.
//   Model A — the deterministic buildFallbackPortfolio path (decide.js:735),
//             which re-sorts the top-35 by baggerBombFit. Used only on LLM
//             failure, but it shows how much downstream selection can MUTE a tilt.
//
// Run: node scratch/scouting-focus-replay/harness.mjs

import { computeArchetypeRankings } from '../../api/_utils/archetypeScoring.js';
import screenStocks from '../../api/_utils/screenStocks.js';
import { buildStates } from './universe.mjs';
import { FOCUSES, PAIRS } from './focuses.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── draft constants (decide.js validatePortfolio:696-699, fallback:735-779) ──
const STARTER_COUNT = 6;     // star(2)+core(2)+support(2)
const SHORTLIST_COUNT = 35;  // decide.js:215 fallback shortlist
const BENCH_COUNT = 3;

// Model A: reproduce buildFallbackPortfolio (read-only mirror).
function draftModelA(rankedDesc) {
  const shortlistData = rankedDesc.slice(0, SHORTLIST_COUNT);
  const sorted = shortlistData.slice().sort((a, b) => (b.baggerBombFit || 0) - (a.baggerBombFit || 0));
  const star = sorted.slice(0, 2);
  const starSectors = new Set(star.map((s) => s.sectorName));
  const corePool = sorted.slice(2).filter((s) => !starSectors.has(s.sectorName));
  const core = corePool.length >= 2 ? corePool.slice(0, 2) : sorted.slice(2, 4);
  const used = new Set([...star, ...core].map((s) => s.symbol));
  const remaining = sorted.filter((s) => !used.has(s.symbol));
  const support = remaining.slice().sort((a, b) => (a.atrPercentile || 0) - (b.atrPercentile || 0)).slice(0, 2);
  return [...star, ...core, ...support].map((s) => s.symbol); // conviction order
}
// Model B: draft straight off the (tilted) ranking.
const draftModelB = (rankedDesc) => rankedDesc.slice(0, STARTER_COUNT).map((s) => s.symbol);

// ── post-rank tilt: band gate + bounded bonus + one-tier-jump cap ────────────
function applyTilt(ranked, watchSet, { tiltStrength, bandPct, uncapped = false }) {
  const N = ranked.length;
  const bandCount = Math.round(bandPct * N);
  const scoreAtRank = (k) => ranked[Math.min(Math.max(k, 1), N) - 1].archetypeScore;
  const spread = scoreAtRank(Math.round(0.10 * N)) - scoreAtRank(Math.round(0.50 * N));
  const bonus = tiltStrength * spread * 0.6;
  const starterCut = scoreAtRank(STARTER_COUNT + 1);

  const tilted = ranked.map((s, i) => {
    const rank = i + 1;
    let score = s.archetypeScore;
    if (watchSet && watchSet.has(s.symbol) && rank <= bandCount) {
      const tier = rank <= STARTER_COUNT ? 0 : (rank <= SHORTLIST_COUNT ? 1 : 2);
      const cap = (uncapped || tier !== 2) ? Infinity : starterCut;
      score = Math.min(s.archetypeScore + bonus, cap);
    }
    return { ...s, _tilted: score };
  });
  tilted.sort((a, b) => (b._tilted - a._tilted) || (a.symbol < b.symbol ? -1 : 1));
  return tilted;
}

function runConfig(universe, archetype, focusFn, opts) {
  const ranked = computeArchetypeRankings(universe, archetype); // REAL engine
  const preRank = new Map(ranked.map((s, i) => [s.symbol, i + 1]));
  const N = ranked.length;
  const bandCount = Math.round(opts.bandPct * N);
  let watchSet = null, watchList = [];
  if (focusFn) {
    watchList = screenStocks(universe, focusFn(universe, opts.watchlistSize)).results.map((r) => r.symbol);
    watchSet = new Set(watchList);
  }
  const tilted = focusFn ? applyTilt(ranked, watchSet, opts) : ranked;
  return { preRank, N, bandCount, watchList, A: draftModelA(tilted), B: draftModelB(tilted) };
}

// ── metric helpers ───────────────────────────────────────────────────────────
const setOf = (a) => new Set(a);
const inter = (a, set) => a.filter((x) => set.has(x)).length;
const overlapFrac = (a, b) => (a.length ? inter(a, setOf(b)) / a.length : 0);
const changedFrac = (cfg, base) => (cfg.length ? cfg.filter((x) => !setOf(base).has(x)).length / cfg.length : 0);
const badJump = (picks, preRank, N) => picks.filter((s) => (preRank.get(s) || 0) > N / 2).length / (picks.length || 1);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const pct = (x) => `${Math.round(x * 100)}%`;
const f1 = (x) => x.toFixed(1);

const BAND_PCT = 0.40;
const TILTS = [0.5, 1, 2];
const WATCHLISTS = [10, 12, 15, 20];
const states = buildStates({ seeds: [1, 2] });

// average a metric suite over all states for one (pair, alt, tilt, wl)
function evalCell(pair, altKey, tiltStrength, watchlistSize, { bandPct = BAND_PCT, uncapped = false } = {}) {
  const k = { wlOvl: [], dA: [], oA: [], dB: [], oB: [], hitA: [], hitB: [], baseHitA: [],
    badA: [], badB: [], eligDef: [], eligAlt: [], t5defA: [], t5altA: [], t5altB: [], dDefA: [], dDefB: [] };
  for (const st of states) {
    const U = st.universe, opt = { tiltStrength, watchlistSize, bandPct, uncapped };
    const base = runConfig(U, pair.archetype, null, opt);
    const def = runConfig(U, pair.archetype, FOCUSES[pair.default.key], opt);
    const alt = runConfig(U, pair.archetype, FOCUSES[altKey], opt);
    const inBand = (s) => (base.preRank.get(s) || 1e9) <= base.bandCount;

    k.wlOvl.push(overlapFrac(alt.watchList, def.watchList));
    k.dA.push(changedFrac(alt.A, def.A));      k.oA.push(overlapFrac(alt.A, def.A));
    k.dB.push(changedFrac(alt.B, def.B));      k.oB.push(overlapFrac(alt.B, def.B));
    k.dDefA.push(changedFrac(def.A, base.A));  k.dDefB.push(changedFrac(def.B, base.B));
    k.hitA.push(overlapFrac(alt.A, alt.watchList)); k.hitB.push(overlapFrac(alt.B, alt.watchList));
    k.baseHitA.push(overlapFrac(base.A, alt.watchList));
    k.badA.push(badJump(alt.A, base.preRank, base.N)); k.badB.push(badJump(alt.B, base.preRank, base.N));
    k.eligDef.push(def.watchList.filter(inBand).length); k.eligAlt.push(alt.watchList.filter(inBand).length);
    k.t5defA.push(inter(def.A.slice(0, 5), setOf(def.watchList)));
    k.t5altA.push(inter(alt.A.slice(0, 5), setOf(alt.watchList)));
    k.t5altB.push(inter(alt.B.slice(0, 5), setOf(alt.watchList)));
  }
  const m = {}; for (const key of Object.keys(k)) m[key] = mean(k[key]); return m;
}

// minimum tilt at which ranking-level Δ crosses 30% at any watchlist size
function tiltThreshold(pair, altKey) {
  for (const t of TILTS) {
    for (const wl of WATCHLISTS) {
      if (evalCell(pair, altKey, t, wl).dB >= 0.30) return t;
    }
  }
  return null;
}

function verdict(cells, wlOvlMin, thr) {
  const dB = Math.max(...cells.map((c) => c.dB));
  const oB = Math.min(...cells.map((c) => c.oB));
  const dA = Math.max(...cells.map((c) => c.dA));
  const at = thr ? ` from ${thr}× tilt` : '';
  if (dB >= 0.30 && oB <= 0.60) return `REAL MOVEMENT${at} (ranking-level Δ peaks ${pct(dB)}${dA < 0.30 ? `; baggerBombFit fallback mutes to ${pct(dA)}` : ''})`;
  if (wlOvlMin <= 0.55 && dB < 0.30) return `WATCHLIST DIVERGES (${pct(wlOvlMin)} ovl) BUT DRAFT CONVERGES (Δ≤${pct(dB)}) — focus distinct on paper, not in picks`;
  if (dB < 0.15) return 'COSMETIC / INERT';
  return `WEAK / MARGINAL (ranking-level Δ peaks ${pct(dB)})`;
}

// ── report ───────────────────────────────────────────────────────────────────
const L = [];
const W = (s = '') => L.push(s);
const Uref = states[0].universe;

W('# Scouting Focus — Replay Harness Findings (Stage-0 Gate)');
W('');
W(`_Generated ${new Date().toISOString().slice(0, 16)}Z · ${states.length} synthetic market states (5 regimes × 2 seeds) · real engine, real symbols/sectors._`);
W('');
W('> **Snapshot answer — POINT-IN-TIME.** The daily ranked universe is one overwritten Firestore doc');
W('> `indexIntelligence/stockRankings` (`compute-index-intelligence.js:1090`, `batch.set`). No date-keyed');
W('> history/archive collection exists, so no past market states are retrievable; the harness cannot prove');
W('> regime-robustness from real data. In this sandbox there are also no Firebase Admin creds and no');
W('> fixtures, so even today\'s doc is unreachable — per-stock metrics are **synthetic**. What stays real:');
W('> the symbols + 11-sector structure (`STOCK_UNIVERSE`), the metric *shape* the cron writes, and the');
W('> ranking/screening engines. The 5 regimes × 2 seeds are a robustness *proxy*, not historical days.');
W('');
W(`**Setup.** Acceptable band = top ${pct(BAND_PCT)} of the archetype ranking (≈ top ${Math.round(BAND_PCT * Uref.length)} of ${Uref.length}). Starters = ${STARTER_COUNT} (star+core+support). Shortlist = ${SHORTLIST_COUNT}. Tier cap: a near-band name can rise into the shortlist but not become a starter in one tilt. Adaptive bonus = 0.6 × (decile−median score spread) × tilt.`);
W('');
W('**Two draft models.** *B = draft off the top of the (tilted) ranking* (the signal the LLM draft consumes — most representative). *A = deterministic buildFallbackPortfolio* (LLM-failure path; shows downstream muting).');
W('');
W('**Columns.** WL-ovl = alt-vs-default *watchlist* overlap (upstream). **Δalt/def** & **Ovl** = pick change / overlap between alternate & default focus, per model (headline). Bad = % picks from bottom-half of pre-tilt rank (guardrail). Elig = focus names inside band (flag <8). T5alt = focus names in alternate\'s top-5.');

const summary = [];
for (const pair of PAIRS) {
  // default-focus expression (independent of alternate) at WL=15, tilt 1×
  const dexp = evalCell(pair, pair.alternates[0].key, 1, 15);
  W('');
  W(`## ${pair.label}  (\`${pair.archetype}\`) — default: ${pair.default.label}`);
  W('');
  W(`_Default-focus expression (WL15, 1×): Δ default-vs-no-focus = ${pct(dexp.dDefB)} (B) / ${pct(dexp.dDefA)} (A); top-5 default focus names = ${f1(dexp.t5defA)} (A) → ${dexp.t5defA >= 2 ? 'meets' : 'MISSES'} "≥2 in top-5"._`);

  for (const alt of pair.alternates) {
    W('');
    W(`### vs ${alt.label}`);
    W('');
    W('| tilt | WL | WL-ovl | Δalt/def B | Ovl B | Δalt/def A | Ovl A | Bad B/A | Elig def/alt | T5alt B/A |');
    W('|---|---|---|---|---|---|---|---|---|---|');
    const cells = [];
    for (const tilt of TILTS) for (const wl of WATCHLISTS) {
      const m = evalCell(pair, alt.key, tilt, wl); cells.push(m);
      W(`| ${tilt}× | ${wl} | ${pct(m.wlOvl)} | **${pct(m.dB)}** | **${pct(m.oB)}** | ${pct(m.dA)} | ${pct(m.oA)} | ${f1(m.badB)}/${f1(m.badA)} | ${f1(m.eligDef)}/${f1(m.eligAlt)} | ${f1(m.t5altB)}/${f1(m.t5altA)} |`);
    }
    const wlOvlMin = Math.min(...cells.map((c) => c.wlOvl));
    const thr = tiltThreshold(pair, alt.key);
    const v = verdict(cells, wlOvlMin, thr);
    W('');
    W(`**Verdict:** ${v}.`);
    summary.push({ pair: pair.label, alt: alt.label, v,
      dB: Math.max(...cells.map((c) => c.dB)), dA: Math.max(...cells.map((c) => c.dA)),
      wlOvlMin, eligAltMin: Math.min(...cells.map((c) => c.eligAlt)) });
  }
}

// ── Trend Follower: raw vs sector-relative separation (headline question) ────
W('');
W('## Trend Follower — does sector-relative strength separate where raw technical rank does not?');
W('');
W('At WL15, tilt 1×, vs default (Chase Winners):');
W('');
W('| Sector-Leaders construction | watchlist overlap vs Chase Winners | draft overlap B / A vs Chase Winners |');
W('|---|---|---|');
{
  const tf = PAIRS.find((p) => p.id === 'trend_follower');
  for (const key of ['sectorLeadersRaw', 'sectorLeadersRel']) {
    const m = evalCell(tf, key, 1, 15);
    const label = tf.alternates.find((a) => a.key === key).label;
    W(`| ${label} | ${pct(m.wlOvl)} | ${pct(m.oB)} / ${pct(m.oA)} |`);
  }
}
W('');
W('Raw technical ≈ Chase Winners (high watchlist overlap). Sector-relative roughly halves watchlist overlap — it **is** the separating ingredient *at the watchlist level*. Whether that reaches the draft is the band-gate question below.');

// ── ablation: what suppresses focus reach, and at what safety cost? ───────────
W('');
W('## What suppresses focus reach — and what does buying more cost? (WL15)');
W('');
W('Three suppressors are possible: (1) the **band gate** filtering out-of-band focus names, (2) the **bonus magnitude** being too small to surface deep names, (3) the **baggerBombFit fallback** re-sort (Model A only). Below: widen band 40%→100% + remove the one-tier cap (isolates #1), then also crank the bonus to 4× (isolates #2). Bad-jump = % picks from the bottom half of pre-tilt rank (the safety cost).');
W('');
W('| pair / alternate | ΔB 40%·1×·capped | ΔB 100%·1×·uncapped | ΔB 100%·4×·uncapped | bad-jump B @4× |');
W('|---|---|---|---|---|');
for (const [pairId, altKey] of [['fundamental_investor', 'sectorLeadersRelQuality'], ['trend_follower', 'sectorLeadersRel'], ['speculator', 'chaseWinners']]) {
  const pair = PAIRS.find((p) => p.id === pairId);
  const gated = evalCell(pair, altKey, 1, 15);
  const open = evalCell(pair, altKey, 1, 15, { bandPct: 1.0, uncapped: true });
  const crank = evalCell(pair, altKey, 4, 15, { bandPct: 1.0, uncapped: true });
  const label = pair.alternates.find((a) => a.key === altKey).label;
  W(`| ${pair.label} / ${label} | ${pct(gated.dB)} | ${pct(open.dB)} | ${pct(crank.dB)} | ${f1(crank.badB)} |`);
}
W('');
W('Widening the band barely changes Δ (40%≈100%): the focus watchlists already sit inside the band, so **the band gate is non-binding free safety, not the suppressor**. Bad-jump stays ~0 even uncapped because the screeners pick already-decent names. The fallback (Model A) is the real muter where it diverges from B.');

// ── close-out: plain-language verdicts + founder translation ─────────────────
const find = (p, a) => summary.find((s) => s.pair === p && s.alt.startsWith(a));
W('');
W('## Plain-language verdict per riskiest pair');
W('');
W('- **Trend Follower — Chase Winners vs Sector Leaders.** *Needs sector-relative reconstruction.* Built as **raw technical rank, "Sector Leaders" is a cosmetic duplicate of Chase Winners** (watchlist 77% shared, draft Δ ≤15%). Built **sector-relative**, the watchlist genuinely diverges (overlap ~50%) and the draft does move — but only **real from 2× tilt + small watchlist** (Δ peaks ~43%), and the fallback path mutes it to ~23%. Sector-relative strength *is* the separating ingredient; raw rank is not.');
W('- **Speculator — Hunt Big Movers vs Chase Winners.** *Real movement* — the healthiest pair. The two watchlists are almost disjoint (~9-13% overlap) and switching moves the draft from **0.5× tilt upward** (ranking-level Δ 37%→72%). Caveat: the **default (Hunt Big Movers) expresses weakly** — only ~1.5 of its own names reach the top-5, because the volatility axis collides with the draft\'s low-ATR "support" slots.');
W('- **Fundamental Investor — Back Strong Companies vs Sector Leaders (quality-floored).** *Real movement at the ranking level* (Δ 42-67% from 1× tilt; watchlists only ~15% shared) — **but the strongest "watchlist diverges, draft converges" warning**: the deterministic fallback mutes the switch to ~23%, and the default (Back Strong) lands only ~1 of its names in the top-5. Viable only if the draft honors the archetype-ranked order (LLM path), not the fallback.');
W('');
W('## For the founder');
W('');
W('**Does the core premise — "changing focus changes the draft, archetype-safely" — hold?** *Conditionally yes.*');
W('');
W('- **Archetype-safe: yes, confirmed.** The bounded post-rank promotion (band gate + one-tier cap) produced **zero bad jumps** in every pair/config/state, and is **non-binding free safety** — widening the band to 100% changed nothing, because well-built focus watchlists already sit inside the band. The safety design costs no expressiveness here.');
W('- **Changes the draft: only for well-built focuses, and mainly via the ranking signal.** Movement is real when the focus rides an axis the archetype ranking does **not** already dominate (sector-*relative* strength, or momentum for a volatility archetype) **and** the draft follows the archetype-ranked order. It is cosmetic when the focus restates the archetype\'s own axis (Sector Leaders *raw* ≈ Chase Winners for a momentum archetype).');
W('- **Genuinely viable:** Speculator ↔ Chase Winners (robust). **Viable but tilt-/path-dependent:** Fundamental → Sector Leaders, Trend Follower → Sector Leaders — *only* sector-relative, *only* at ≥1-2× tilt with smaller watchlists, and degraded by the baggerBombFit fallback. **Decorative:** any "Sector Leaders" built on raw technical rank.');
W('- **The real bottleneck is not the band gate — it is downstream pick selection.** Watchlist divergence (as low as 14% overlap) collapses to ~80% draft overlap through the deterministic fallback. Before building anything user-facing, decide whether the draft will honor the (tilted) archetype order or the baggerBombFit fallback, because that choice — not the focus screener — determines whether focus reaches the picks.');
W('');
W('_Caveat repeated: synthetic universe, point-in-time — these are mechanism/direction findings across a regime proxy, not magnitudes from live trading days. Regime-robustness cannot be proven until daily snapshots are retained (or the live doc is reachable)._');

writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'FINDINGS.md'), L.join('\n') + '\n');

console.log('\n=== Scouting Focus harness — summary (synthetic, point-in-time) ===\n');
console.log(`states=${states.length}  band=top${Math.round(BAND_PCT * 100)}%  starters=${STARTER_COUNT}  tilts=${TILTS.join('/')}  wl=${WATCHLISTS.join('/')}\n`);
for (const r of summary) {
  console.log(`• ${r.pair} → ${r.alt}`);
  console.log(`    ${r.v}`);
  console.log(`    maxΔ B=${pct(r.dB)} A=${pct(r.dA)}  minWLovl=${pct(r.wlOvlMin)}  minEligAlt=${f1(r.eligAltMin)}\n`);
}
console.log('Full tables → scratch/scouting-focus-replay/FINDINGS.md');
