/**
 * POST /api/research/correlation-scan — Correlation Intelligence V2 Build 2
 * (multi-driver scan). One click runs the group against EVERY registry driver
 * and ranks the relationships by current strength — the breadth surface; the
 * single-driver endpoint stays the depth surface and every scan row links
 * into it ("Deep dive →" in the Lab).
 *
 * Per-driver assembly is the IDENTICAL join-and-compute pipeline as the
 * single-driver endpoint via the shared assembleDriverCore
 * (correlationAssembly.js — extracted verbatim from correlation.js in this
 * build): reverse-once discipline, inner-join per driver (calendars
 * legitimately differ — BTC joins DOWN to equity days; each row reports its
 * own joinedCloses), composite on the per-driver joined calendar, gated
 * corr20/corr60, divergence latest (d + SDS via the shared
 * standardizedDivergenceScore). NO episodes, base rates, beta, or lead-lag
 * here — those belong to the deep dive.
 *
 * ── The 0.20 signal floor (pinned honesty guard, Change 2) ─────────────────
 * Scanning ~24 drivers on ~500 observations produces an expected MAX spurious
 * |corr| ≈ 0.12 under no relationship at all (max of ~24 independent
 * Pearson draws, each with sd ≈ 1/√n ≈ 0.045) — sub-floor rows are
 * indistinguishable from coincidence, so they are tier 'weak', rendered
 * greyed as "weak/none", never highlighted, never in the summary. Scan copy
 * never says "discovered", "predicts", or "signal found" — a top row is
 * "worth investigating, not a discovery".
 *
 * Caching: same collection (`correlationIntelligence`), doc id
 * sha1(sortedGroup + '|SCAN|' + lookbackDays), same two-sided TTL. Cache ONLY
 * a fully clean run — zero dropped members AND zero dropped drivers (the V0
 * no-poisoned-cache rule at scan blast radius: a transient XLF failure must
 * not bake into every scan of this group until close).
 */
import { createHash } from 'crypto';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFromCache, setInCache } from '../_utils/serverCache.js';
import { standardizedDivergenceScore } from '../_utils/correlationMath.js';
import {
  assembleDriverCore,
  computeCorrelationCacheTtlMs,
  tensionStateFromScore,
  MIN_CLOSES_FOR_INFLECTIONS,
} from './correlationAssembly.js';
import { CORRELATION_DRIVERS } from './driverRegistry.js';
import { fetchEodCloses } from './fetchDriverSeries.js';
import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';
// api→src cross-boundary imports (correlation.js precedent). Node-clean per
// BUILD_RULES §4 — featureFlags and correlationVerdict carry no browser deps;
// the unmocked handler import in correlation-scan.boundary.test.js is the
// dependency-surface guard.
import { CORRELATION_LAB_ENABLED } from '../../src/config/featureFlags.js';
import { strengthBand } from '../../src/components/Research/correlationVerdict.js';

// ~28 EODHD fetches (group + 25 drivers) in 6 throttled chunks (~1.5s of
// deliberate sleep) plus Firestore round-trips — same ceiling as correlation.js.
export const config = { maxDuration: 30 };

const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // pinned: accepts BRK.B, BF.B, hyphens
const LOOKBACK = { DEFAULT: 504, MIN: 150, MAX: 1260 };
// The pinned signal floor (see the header rationale). |corr20| below this is
// tier 'weak' — statistically indistinguishable from a no-relationship scan.
const SCAN_SIGNAL_FLOOR = 0.2;
// The scan's own chunk discipline (5 concurrent / ~300ms — the fetchAllSeries
// convention; that helper is single-driver-shaped, so the scan batches the
// deduped symbol universe itself through the exported fetchEodCloses).
const CHUNK_SIZE = 5;
const CHUNK_DELAY_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const markCached = (payload) => ({ ...payload, meta: { ...payload.meta, cached: true } });
const latestValue = (series) => (series && series.length ? series[series.length - 1].value : null);

/**
 * The V1.1 signed change rule — rule of record: correlationVerdict.js
 * buildVerdictSentence clause 2 (measure the move in the DIRECTION of the
 * established corr60 link, not raw magnitude; only when both windows exist
 * and the gap ≥ 0.15). Kept semantically identical here because that file
 * inlines the rule inside the sentence builder; if the rule ever changes
 * there, change it here in the same PR.
 */
function signedChangeWord(corr20, corr60) {
  if (corr20 == null || corr60 == null || Math.abs(corr20 - corr60) < 0.15) return null;
  const moved = corr60 >= 0 ? corr20 - corr60 : corr60 - corr20;
  return moved >= 0 ? 'tightened' : 'weakened';
}

/**
 * Fetch every unique EODHD symbol (members + all registry drivers, deduped —
 * a group member that IS a driver proxy, e.g. SPY, fetches once) in chunks of
 * 5 with ~300ms between chunks. → Map<wireSymbol, rows|null>.
 */
async function fetchSymbolUniverse(wireSymbols, lookbackDays) {
  const symbols = [...wireSymbols];
  const bySymbol = new Map();
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map((symbol) => fetchEodCloses(symbol, lookbackDays))
    );
    settled.forEach((outcome, k) => {
      const rows = outcome.status === 'fulfilled' ? outcome.value : null;
      bySymbol.set(chunk[k], rows && rows.length > 0 ? rows : null);
    });
    if (i + CHUNK_SIZE < symbols.length) await sleep(CHUNK_DELAY_MS);
  }
  return bySymbol;
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Defense-in-depth for merge-dark: while the flag is off the endpoint reveals
  // nothing, performs no reads, and spends no EODHD quota (correlation.js:111).
  if (!CORRELATION_LAB_ENABLED) return res.status(404).json({ error: 'not_found' });

  const user = await requireAuth(req, res);
  if (!user) return;

  // ── Validation (pinned — same canonicalization/dedupe/clamp as correlation.js;
  //    no driver field: scans are registry-only, CUSTOM never scans) ──
  const body = req.body || {};
  if (!Array.isArray(body.group) || body.group.length < 1 || body.group.length > 10) {
    return res.status(400).json({ error: 'invalid_group', message: 'group must be 1–10 symbols.' });
  }
  const group = [
    ...new Set(body.group.map((s) => String(s).trim().toUpperCase().replace(/\.US$/, ''))),
  ];
  if (!group.every((s) => SYMBOL_RE.test(s))) {
    return res.status(400).json({ error: 'invalid_symbol', message: 'Invalid ticker symbol format.' });
  }
  let lookbackDays = LOOKBACK.DEFAULT;
  if (body.lookbackDays !== undefined) {
    if (typeof body.lookbackDays !== 'number' || !Number.isFinite(body.lookbackDays)) {
      return res.status(400).json({ error: 'invalid_lookback', message: 'lookbackDays must be a number.' });
    }
    lookbackDays = Math.min(LOOKBACK.MAX, Math.max(LOOKBACK.MIN, Math.round(body.lookbackDays)));
  }
  const forceRefresh = body.forceRefresh === true;

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  // Scan cache key: the literal 'SCAN' segment namespaces away from every
  // single-driver key (those carry '<driverKey>:<customSymbol>' there, and no
  // registry driver is named SCAN).
  const docId = createHash('sha1')
    .update([...group].sort().join(',') + '|SCAN|' + lookbackDays)
    .digest('hex');
  const cacheKey = `correlationScan:${docId}`;

  try {
    const db = getFirebaseAdmin();

    // ── Cache read: L1 then Firestore (both bypassed by forceRefresh) ──
    if (!forceRefresh) {
      const l1 = getFromCache(cacheKey); // no dataType → static expiry
      if (l1) return res.status(200).json(markCached(l1));
      const snap = await db.collection('correlationIntelligence').doc(docId).get();
      if (snap.exists) {
        const doc = snap.data();
        if (doc?.payload && typeof doc.expiresAt === 'number' && Date.now() < doc.expiresAt) {
          setInCache(cacheKey, doc.payload, Math.floor((doc.expiresAt - Date.now()) / 1000));
          return res.status(200).json(markCached(doc.payload));
        }
      }
    }

    // ── Fetch the deduped symbol universe: group members + ALL registry
    //    drivers. Members use the repo-standard app→wire normalization;
    //    driver symbols come exact from the registry, never re-formatted. ──
    const driverKeys = Object.keys(CORRELATION_DRIVERS);
    const memberWire = new Map(group.map((s) => [s, `${normalizeSymbolForEODHD(s)}.US`]));
    const wireSymbols = new Set([
      ...group.map((s) => memberWire.get(s)),
      ...driverKeys.map((k) => CORRELATION_DRIVERS[k].symbol),
    ]);
    const rowsBySymbol = await fetchSymbolUniverse(wireSymbols, lookbackDays);

    // ── Member-side partial-failure contract (identical to V0) ──
    const survivors = group.filter((s) => rowsBySymbol.get(memberWire.get(s)));
    const failedSymbols = group.filter((s) => !rowsBySymbol.get(memberWire.get(s)));
    if (survivors.length === 0) {
      return res.status(422).json({ error: 'group_unavailable', droppedSymbols: failedSymbols });
    }
    const partial = failedSymbols.length > 0;

    // ── Reverse-once boundary for members, ONCE for all 25 driver joins ──
    const memberMaps = survivors.map(
      (s) => new Map([...rowsBySymbol.get(memberWire.get(s))].reverse().map((r) => [r.date, r.close]))
    );

    // ── Per-driver assembly: the shared V0 core per registry driver ──
    const rows = [];
    const droppedDrivers = [];
    for (const key of driverKeys) {
      const registry = CORRELATION_DRIVERS[key];
      const driverRows = rowsBySymbol.get(registry.symbol);
      if (!driverRows) {
        // Fetch failed → reported, never silently omitted (coverage honesty).
        droppedDrivers.push({ driver: key, label: registry.label });
        continue;
      }
      const driverAsc = [...driverRows].reverse();
      const core = assembleDriverCore({ driverAsc, memberMaps, registry, lookbackDays });
      if (core.error) {
        // Fetch succeeded but nothing computable (no overlap / degenerate
        // series) — an honest null-stat row, ranked last, never highlighted.
        rows.push({
          driver: key,
          label: registry.label,
          category: registry.category,
          corr20: null,
          corr60: null,
          d: null,
          score: null,
          tensionState: null,
          joinedCloses: core.joinedCloses,
          tier: 'weak',
        });
        continue;
      }
      const corr20 = latestValue(core.corr20);
      const corr60 = latestValue(core.corr60);
      // Tension read mirrors the single-driver gauge gate exactly
      // (correlation.js divergence.latest): below MIN_CLOSES_FOR_INFLECTIONS
      // joined closes the deep dive shows no gauge, so the scan chip nulls too.
      const gaugeEligible =
        core.joinedCloses >= MIN_CLOSES_FOR_INFLECTIONS && core.divergenceSeries.length > 0;
      const lastDiv = gaugeEligible
        ? core.divergenceSeries[core.divergenceSeries.length - 1]
        : null;
      const score = lastDiv
        ? standardizedDivergenceScore(core.divergenceSeries, core.divergenceSeries.length - 1)
        : null;
      rows.push({
        driver: key,
        label: registry.label,
        category: registry.category,
        corr20,
        corr60,
        d: lastDiv ? lastDiv.d : null,
        score,
        tensionState: tensionStateFromScore(score),
        joinedCloses: core.joinedCloses,
        tier: corr20 != null && Math.abs(corr20) >= SCAN_SIGNAL_FLOOR ? 'signal' : 'weak',
      });
    }

    // ── Ranking: |corr20| desc; null corr20 last (unavailable rows live in
    //    droppedDrivers, after everything); key asc for a deterministic order ──
    rows.sort((a, b) => {
      const aAbs = a.corr20 == null ? -1 : Math.abs(a.corr20);
      const bAbs = b.corr20 == null ? -1 : Math.abs(b.corr20);
      if (bAbs !== aAbs) return bAbs - aAbs;
      return a.driver < b.driver ? -1 : a.driver > b.driver ? 1 : 0;
    });

    // ── Summary input: the top signal-tier row, or null when nothing clears
    //    the floor. Deterministic fields only — the client assembles the
    //    sentence (past/present descriptive; no "discovered"/"predicts"). ──
    const top = rows.find((r) => r.tier === 'signal') ?? null;
    const summary = top
      ? {
          driver: top.driver,
          label: top.label,
          band: strengthBand(Math.abs(top.corr20)),
          direction: top.corr20 >= 0 ? 'positive' : 'negative',
          change: signedChangeWord(top.corr20, top.corr60),
        }
      : null;

    const payload = {
      meta: {
        group,
        droppedSymbols: failedSymbols,
        partial,
        lookbackDays,
        computedAt: new Date().toISOString(),
        cached: false,
      },
      rows,
      droppedDrivers,
      summary,
    };

    // ── Cache write: FULLY CLEAN RUNS ONLY (zero dropped members AND zero
    //    dropped drivers); a cache failure never fails the response ──
    if (!partial && droppedDrivers.length === 0) {
      try {
        const ttlMs = computeCorrelationCacheTtlMs();
        await db.collection('correlationIntelligence').doc(docId).set({
          payload,
          computedAt: payload.meta.computedAt,
          expiresAt: Date.now() + ttlMs,
          ttlMs,
        });
        setInCache(cacheKey, payload, Math.floor(ttlMs / 1000));
      } catch (cacheErr) {
        console.warn('[correlation-scan] cache write failed:', cacheErr?.message);
      }
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error('[correlation-scan] unexpected error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
