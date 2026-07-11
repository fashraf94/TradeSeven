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
 * ── The 0.20 floor + established/emerging tier split (Build 2.1, founder
 *    decision #1 — replaces the V2 Build 2 single 'signal' tier) ───────────
 * The ranked statistic corr20 is ALWAYS a 20-return window: under no
 * relationship at all its sampling sd is ≈ 1/√19 ≈ 0.23, so chance alone
 * pushes a single driver past |0.20| roughly two times in five — a 20d
 * reading BY ITSELF is never treated as an established relationship. corr60
 * (sd ≈ 0.13 under the null, ~13% single-driver false-clear) is the steadier
 * window, so:
 *   'established' — |corr20| ≥ 0.20 AND |corr60| ≥ 0.20 (both windows clear);
 *   'emerging'    — |corr20| ≥ 0.20 only (a 20-day lead to watch, possibly
 *                   noise — never highlighted as a relationship, never in
 *                   the summary);
 *   'weak'        — everything else (greyed "weak/none"; null stats "no data").
 * The summary headlines the top ESTABLISHED non-identity row or is null.
 * Scan copy never says "discovered", "predicts", or "signal found" — a top
 * row is "worth investigating, not a discovery".
 *
 * ── Identity rows (Build 2.1, founder decision #2) ─────────────────────────
 * A driver whose wire symbol IS one of the surviving group members
 * self-correlates (corr = 1.0 for a group of one) — truthful but vacuous.
 * Such rows carry identity: true (annotated in the UI as a group member,
 * never silently omitted) and are EXCLUDED from the summary even when
 * established: the summary must headline an external driver, and even a
 * diluted multi-member self-link is partially tautological.
 *
 * Caching: same collection (`correlationIntelligence`), doc id
 * sha1(sortedGroup + '|SCAN|' + lookbackDays + '|' + registrySalt), same
 * two-sided TTL. The registry salt (Build 2.1, founder decision #3) is the
 * sorted key:symbol list, so ANY registry change — key added/removed/renamed
 * OR a proxy symbol swap (the Fix 1 precedent) — orphans every cached scan
 * instead of serving rows the new code can't deep-dive. Cache ONLY a fully
 * clean run — zero dropped members, zero dropped drivers, AND zero
 * uncomputable (core-error) rows (the V0 no-poisoned-cache rule at scan blast
 * radius: a transient XLF failure — whether a failed fetch or a truncated
 * 200 body — must not bake into every scan of this group until close).
 */
import { createHash } from 'crypto';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFromCache, setInCache } from '../_utils/serverCache.js';
import { standardizedDivergenceScore, computeReturnsSeries, pairwiseCohesion } from '../_utils/correlationMath.js';
import {
  assembleDriverCore,
  computeCorrelationCacheTtlMs,
  tensionStateFrom,
  buildRelationshipQualityShared,
  MIN_CLOSES_FOR_INFLECTIONS,
} from './correlationAssembly.js';
import { CORRELATION_DRIVERS } from './driverRegistry.js';
import { fetchEodCloses } from './fetchDriverSeries.js';
import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';
// api→src cross-boundary imports (correlation.js precedent). Node-clean per
// BUILD_RULES §4 — featureFlags and correlationVerdict carry no browser deps;
// the unmocked handler import in correlation-scan.boundary.test.js is the
// dependency-surface guard.
import {
  CORRELATION_LAB_ENABLED,
  CORRELATION_RELATIONSHIP_QUALITY_ENABLED,
  CORRELATION_SYNTHESIS_ENABLED,
  CORRELATION_EXTENDED_DRIVERS_ENABLED,
} from '../../src/config/featureFlags.js';
import { strengthBand } from '../../src/components/Research/correlationVerdict.js';
// V3 Sub-build 2 — the summary contract + the "since your last scan" comparison.
import {
  synthesisActive,
  buildScanContract,
  membershipHash,
  serializedByteSize,
  MAX_CONTRACT_BYTES,
  METHODOLOGY_VERSION,
  CHANGE_POLICY_VERSION,
} from './summaryContract.js';
import {
  driverUniverseHash,
  compactSnapshot,
  carryPriorSnapshot,
  buildComparison,
  computeChanges,
} from './correlationChanges.js';

// ~28 EODHD fetches (group + 25 drivers) in 6 throttled chunks (~1.5s of
// deliberate sleep) plus Firestore round-trips — same ceiling as correlation.js.
export const config = { maxDuration: 30 };

const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // pinned: accepts BRK.B, BF.B, hyphens
const LOOKBACK = { DEFAULT: 504, MIN: 150, MAX: 1260 };
// The pinned floor, applied per window (see the header rationale): clearing
// it on corr20 alone is 'emerging'; on BOTH windows, 'established'.
// V3 Sub-build 3: the floor is a PER-DRIVER null-sampling threshold (the
// "roughly two drivers in five past |0.20| by chance" figure is per-driver, not
// a family-wide rate), so it is unchanged by the extended tier — it holds
// identically at 30 drivers as at 25. The scan honesty caption stays valid.
const SCAN_SIGNAL_FLOOR = 0.2;
// The scan's own chunk discipline (5 concurrent / ~300ms — the fetchAllSeries
// convention; that helper is single-driver-shaped, so the scan batches the
// deduped symbol universe itself through the exported fetchEodCloses).
const CHUNK_SIZE = 5;
const CHUNK_DELAY_MS = 300;
// Per-symbol fetch timeout (H3 — Build 2 review backlog): a single hung EODHD
// socket could otherwise ride until maxDuration and 504 after the quota was
// spent. Each per-symbol fetch is raced against this budget; a loser is aborted
// and converts to the same honest outcome as any other failed fetch (a dropped
// driver leaves the scan uncached per the clean-run rule; a dropped member
// follows the existing partial contract). Well under config.maxDuration.
const PER_FETCH_TIMEOUT_MS = 3500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetchEodCloses raced against PER_FETCH_TIMEOUT_MS. On timeout the AbortController
 * aborts the in-flight fetch (freeing the socket) and the race rejects, so the
 * loser lands in the caller's failed/null bucket exactly like a 404 or a
 * non-array body. Resolves/rejects with the fetch result on the happy path.
 */
function fetchEodClosesWithTimeout(symbol, lookbackDays, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`EODHD ${symbol}: per-fetch timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  const fetchJob = fetchEodCloses(symbol, lookbackDays, { signal: controller.signal });
  return Promise.race([fetchJob, timeout]).finally(() => clearTimeout(timer));
}
const markCached = (payload) => ({ ...payload, meta: { ...payload.meta, cached: true } });
const latestValue = (series) => (series && series.length ? series[series.length - 1].value : null);

/**
 * The V1.1 signed change rule — rule of record: correlationVerdict.js
 * buildVerdictSentence clause 2 (measure the move in the DIRECTION of the
 * established corr60 link, not raw magnitude; only when both windows exist
 * and the gap ≥ 0.15). Kept semantically identical here because that file
 * inlines the rule inside the sentence builder; if the rule ever changes
 * there, change it here in the same PR.
 *
 * Attachment guard (code-review fix): in the rule of record the change
 * clause lives inside the band !== null branch — it NEVER attaches when the
 * corr60 base link is sub-band (|corr60| < 0.15, "no reliable link"). Without
 * this guard a link that EMERGED from ~0 would be called "weakened" whenever
 * corr60 sits at noise-level negative — backwards, and contradicting the
 * deep-dive sentence one click away. Since Build 2.1 the summary only ever
 * carries ESTABLISHED rows, so this guard is unreachable there — kept as
 * defense-in-depth against any future tier loosening. (Build 3 note: the
 * tier now compares 2dp-ROUNDED values, so 'established' guarantees raw
 * |corr60| ≥ 0.195, not 0.20 — still safely above strengthBand's 0.15
 * null-floor, but the margin is 0.045, not 0.05; re-check this guard before
 * ever raising that floor.)
 */
function signedChangeWord(corr20, corr60) {
  if (corr20 == null || corr60 == null || Math.abs(corr20 - corr60) < 0.15) return null;
  if (strengthBand(Math.abs(corr60)) === null) return null; // no base link → no change clause
  const moved = corr60 >= 0 ? corr20 - corr60 : corr60 - corr20;
  return moved >= 0 ? 'tightened' : 'weakened';
}

/**
 * Build 2.1 tier rule (founder decision #1): 'established' needs BOTH windows
 * to clear the floor; corr20 alone is 'emerging' (a 20-observation statistic
 * is one-in-2.5 chance noise at |0.20| — see the header). Null corr20 (or
 * sub-floor) is 'weak' regardless of corr60.
 *
 * Build 3 rider (founder smoke of Build 2): the comparison runs on the
 * 2dp-ROUNDED values — the UI displays fmtCorr = toFixed(2), and a row must
 * never read "+0.20" while tiered weak/none. Number(toFixed(2)) is the same
 * rounding the display applies, so display and tier agree by construction.
 *
 * Deliberately NOT the shared round2 in src/constants/leagueTournament.js:
 * that one zero-fills non-finite input, and a null corr here must stay null
 * (null-never-zero, the correlationMath convention) — 0 is a measured "no
 * correlation", null is "no answer".
 */
const round2 = (v) => (v == null ? null : Number(v.toFixed(2)));

function scanTier(corr20, corr60) {
  const r20 = round2(corr20);
  const r60 = round2(corr60);
  if (r20 == null || Math.abs(r20) < SCAN_SIGNAL_FLOOR) return 'weak';
  return r60 != null && Math.abs(r60) >= SCAN_SIGNAL_FLOOR ? 'established' : 'emerging';
}

/**
 * Fetch every unique EODHD symbol (members + all registry drivers, deduped —
 * a group member that IS a driver proxy, e.g. SPY, fetches once) in chunks of
 * 5 with ~300ms between chunks. → Map<wireSymbol, rows|null>.
 */
/**
 * Group cohesion for the scan's groupEvidence (V3 Sub-build 2) — the members'
 * OWN pairwise correlation on a member-only join axis (the driver isn't a
 * cohesion member, and the scan has no single driver, so cohesion is
 * driver-independent here). Uses the SAME pairwiseCohesion as the deep dive
 * (BUILD_RULES §4). Null below 3 members (a 2-member cohesion is one pair).
 */
function computeGroupCohesion(memberMaps, lookbackDays) {
  if (!Array.isArray(memberMaps) || memberMaps.length < 3) return null;
  const [first, ...rest] = memberMaps;
  let dates = [...first.keys()].filter((d) => rest.every((m) => m.has(d)));
  dates.sort();
  if (dates.length > lookbackDays) dates = dates.slice(-lookbackDays);
  if (dates.length < 2) return null;
  const memberReturns = memberMaps.map((m) => computeReturnsSeries(dates.map((d) => m.get(d)), 'pct'));
  if (memberReturns.some((r) => r === null)) return null;
  return {
    c20: pairwiseCohesion(memberReturns, 20),
    c60: pairwiseCohesion(memberReturns, 60),
    memberCount: memberMaps.length,
  };
}

async function fetchSymbolUniverse(wireSymbols, lookbackDays) {
  const symbols = [...wireSymbols];
  const bySymbol = new Map();
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map((symbol) => fetchEodClosesWithTimeout(symbol, lookbackDays, PER_FETCH_TIMEOUT_MS))
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
  // Group provenance for the summary contract (finding 21 — enum only, never a
  // user name); an unknown value degrades to 'manual' inside groupIdentity.
  const groupType = typeof body.groupType === 'string' ? body.groupType : 'manual';

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  // ── Effective driver universe (V3 Sub-build 3 — the extended-tier rule) ──
  // Extended drivers are opt-in: included ONLY when the flag is on AND the user
  // opts in (a small "Include extended drivers" scan-bar toggle → includeExtended).
  // Everything driver-universe-scoped below — the salt, the docId, the
  // driverUniverseHash, and the compute loop — reads THIS effective set, never
  // the whole registry. So a core-only run (flag off, OR flag on but not opted
  // in) keeps today's exact 25-driver fingerprint: the dark merge orphans zero
  // cached scans and manufactures zero not_comparable days. An opted-in extended
  // run gets its own docId family (30-driver salt) and its own universeHash, so
  // a comparison across opt-in states correctly reads not_comparable.
  const includeExtended = CORRELATION_EXTENDED_DRIVERS_ENABLED && body.includeExtended === true;
  const driverKeys = Object.keys(CORRELATION_DRIVERS).filter(
    (k) => CORRELATION_DRIVERS[k].tier !== 'extended' || includeExtended
  );

  // Scan cache key: the literal 'SCAN' segment namespaces away from every
  // single-driver key (those carry '<driverKey>:<customSymbol>' there, and no
  // registry driver is named SCAN). The registry salt (sorted key:symbol
  // pairs) orphans every cached scan on ANY registry change — a renamed key
  // or swapped proxy symbol must never serve rows the deployed code can't
  // deep-dive (Build 2.1 decision #3). Derived from the EFFECTIVE set (above):
  // core-only ⇒ byte-identical to the pre-extended-tier salt.
  const registrySalt = [...driverKeys]
    .sort()
    .map((k) => `${k}:${CORRELATION_DRIVERS[k].symbol}`)
    .join(',');
  const docId = createHash('sha1')
    .update([...group].sort().join(',') + '|SCAN|' + lookbackDays + '|' + registrySalt)
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

    // ── Fetch MEMBERS FIRST (code-review fix): a guaranteed-fail group must
    //    not spend the full driver universe before its 422 — members are
    //    1–2 chunks, and with the registry symbol count a chunk-size multiple
    //    the split costs zero extra fetches and no extra sleeps on the happy
    //    path. Members use the repo-standard app→wire normalization; driver
    //    symbols come exact from the registry, never re-formatted. `driverKeys`
    //    is the EFFECTIVE universe computed above (core-only unless opted in). ──
    const memberWire = new Map(group.map((s) => [s, `${normalizeSymbolForEODHD(s)}.US`]));
    const rowsBySymbol = await fetchSymbolUniverse(new Set(memberWire.values()), lookbackDays);

    // ── Member-side partial-failure contract (identical to V0) ──
    const survivors = group.filter((s) => rowsBySymbol.get(memberWire.get(s)));
    const failedSymbols = group.filter((s) => !rowsBySymbol.get(memberWire.get(s)));
    if (survivors.length === 0) {
      return res.status(422).json({ error: 'group_unavailable', droppedSymbols: failedSymbols });
    }
    const partial = failedSymbols.length > 0;

    // ── Then the driver symbols not already fetched (a member that IS a
    //    driver proxy, e.g. SPY, fetches once — that driver's row reads the
    //    member's rows from the merged map). Inter-batch sleep keeps the
    //    5-concurrent/300ms wire cadence identical to a single batch. ──
    const driverOnlySymbols = new Set(
      driverKeys.map((k) => CORRELATION_DRIVERS[k].symbol).filter((sym) => !rowsBySymbol.has(sym))
    );
    if (driverOnlySymbols.size > 0) {
      await sleep(CHUNK_DELAY_MS);
      const driverRowsBySymbol = await fetchSymbolUniverse(driverOnlySymbols, lookbackDays);
      for (const [sym, rows] of driverRowsBySymbol) rowsBySymbol.set(sym, rows);
    }

    // ── Reverse-once boundary for members, ONCE for all 25 driver joins ──
    const memberMaps = survivors.map(
      (s) => new Map([...rowsBySymbol.get(memberWire.get(s))].reverse().map((r) => [r.date, r.close]))
    );
    // Identity detection (decision #2): a driver whose wire symbol is one of
    // the SURVIVING members (dropped members aren't in the composite).
    const survivorWires = new Set(survivors.map((s) => memberWire.get(s)));

    // V3 relationship-quality: the SPY reference for per-row SPY-adjusted partial
    // correlation, built ONCE (SPY.US is already in rowsBySymbol as the SPX
    // driver — no extra fetch). Null if SPY.US failed to fetch, in which case
    // every row's partial degrades to spy_unavailable; a failed SPX driver
    // already lands in droppedDrivers, leaving the run uncached (clean-run rule).
    const spyRows = CORRELATION_RELATIONSHIP_QUALITY_ENABLED ? rowsBySymbol.get('SPY.US') : null;
    const spyMap = spyRows ? new Map(spyRows.map((r) => [r.date, r.close])) : null;

    // ── Per-driver assembly: the shared V0 core per registry driver ──
    const rows = [];
    const droppedDrivers = [];
    // Error rows (fetch succeeded, nothing computable) poison the cache the
    // same way dropped drivers do: a transiently truncated/corrupt wire body
    // must not bake a null-stat row into every scan of this group until
    // close. V0 422s-uncached for the identical core errors (code-review fix).
    let hadErrorRows = false;
    // V3 Sub-build 2 — the scan's observation trading day: the freshest joined
    // bar across all computed rows. A driver on the equity calendar (e.g. SPY)
    // pins this to the group's own freshest shared member bar (no schedule helper).
    let maxObservationDay = null;
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
        hadErrorRows = true;
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
          identity: survivorWires.has(registry.symbol),
          // Shape stability: an uncomputable row still carries the rq key (null)
          // when the flag is on, so the UI never branches on its presence per-row.
          ...(CORRELATION_RELATIONSHIP_QUALITY_ENABLED ? { rq: null } : {}),
        });
        continue;
      }
      const corr20 = latestValue(core.corr20);
      const corr60 = latestValue(core.corr60);
      const lastJoined = core.joinedDates.length ? core.joinedDates[core.joinedDates.length - 1] : null;
      if (lastJoined && (maxObservationDay === null || lastJoined > maxObservationDay)) maxObservationDay = lastJoined;
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
      const d = lastDiv ? lastDiv.d : null;

      // V3 relationship-quality per row (the shared cheap surface only — partial,
      // self-percentile, past-stability, driver context; contribution/asymmetry/
      // tail stay deep-dive-natural). Computed from the core series BEFORE they
      // are discarded above; flag-gated so the row is byte-identical when off.
      const rq = CORRELATION_RELATIONSHIP_QUALITY_ENABLED
        ? buildRelationshipQualityShared({
            groupReturns: core.groupReturns,
            driverReturns: core.driverReturns,
            driverCloses: core.driverCloses,
            joinedDates: core.joinedDates,
            corr20: core.corr20,
            corr60: core.corr60,
            driverSymbol: registry.symbol,
            spyMap,
          })
        : null;

      rows.push({
        driver: key,
        label: registry.label,
        category: registry.category,
        corr20,
        corr60,
        d,
        score,
        tensionState: tensionStateFrom({ score, d }),
        joinedCloses: core.joinedCloses,
        tier: scanTier(corr20, corr60),
        identity: survivorWires.has(registry.symbol),
        ...(CORRELATION_RELATIONSHIP_QUALITY_ENABLED ? { rq } : {}),
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

    // ── Summary input: the top ESTABLISHED NON-IDENTITY row, or null.
    //    Emerging rows never headline (20-day evidence only), identity rows
    //    never headline (the group tracking itself is vacuous). Deterministic
    //    fields only — the client assembles the sentence (past/present
    //    descriptive; no "discovered"/"predicts"). ──
    const top = rows.find((r) => r.tier === 'established' && !r.identity) ?? null;
    const summary = top
      ? {
          driver: top.driver,
          label: top.label,
          band: strengthBand(Math.abs(top.corr20)),
          direction: top.corr20 >= 0 ? 'positive' : 'negative',
          change: signedChangeWord(top.corr20, top.corr60),
        }
      : null;

    // V3 Sub-build 2 — synthesis active only when BOTH flags are on; the scan's
    // observation trading day is the freshest joined bar across computed rows.
    const synthActive = synthesisActive(CORRELATION_SYNTHESIS_ENABLED, CORRELATION_RELATIONSHIP_QUALITY_ENABLED);
    const cleanRun = !partial && droppedDrivers.length === 0 && !hadErrorRows;
    const dataAsOf = maxObservationDay;

    const payload = {
      meta: {
        group,
        droppedSymbols: failedSymbols,
        partial,
        lookbackDays,
        computedAt: new Date().toISOString(),
        cached: false,
        // Additive + flag-gated → byte-identical meta when synthesis is dark.
        ...(synthActive && cleanRun && dataAsOf ? { dataAsOf, observationTradingDay: dataAsOf } : {}),
      },
      rows,
      droppedDrivers,
      summary,
    };

    // ── The summary contract + "since your last scan" (Change 2 + 3). Built
    //    ONLY on a clean run: the comparison is a clean-vs-clean concept (the
    //    stored baseline is always a clean cached scan; a matching
    //    driverUniverseHash guarantees identical driver sets, so no spurious
    //    absence events). The comparison/changes are computed ONCE here and
    //    referenced by BOTH the payload and the contract (finding 4, §9). The
    //    existing doc is read at write-time for the snapshot-carry idiom. ──
    let scanSnapshot = null;
    let priorSnapshot = null;
    if (synthActive && cleanRun && dataAsOf) {
      const universeHash = driverUniverseHash(registrySalt);
      const fingerprints = {
        membershipHash: membershipHash(group),
        driverUniverseHash: universeHash,
        methodologyVersion: METHODOLOGY_VERSION,
        changePolicyVersion: CHANGE_POLICY_VERSION,
      };
      let existingDoc = null;
      try {
        const snap = await db.collection('correlationIntelligence').doc(docId).get();
        existingDoc = snap.exists ? snap.data() : null;
      } catch {
        existingDoc = null; // a read failure degrades to no_prior_scan, never a 500
      }
      scanSnapshot = compactSnapshot({ rows, observationTradingDay: dataAsOf, fingerprints });
      priorSnapshot = carryPriorSnapshot(existingDoc, dataAsOf);
      const comparison = buildComparison({ prior: priorSnapshot, current: scanSnapshot, fingerprints });
      const changes = {
        status: comparison.status,
        events: comparison.status === 'available' ? computeChanges({ prior: priorSnapshot, current: scanSnapshot }) : [],
      };
      const cohesion = computeGroupCohesion(memberMaps, lookbackDays);
      payload.summaryContract = buildScanContract({
        generatedAt: payload.meta.computedAt,
        dataAsOf,
        observationTradingDay: dataAsOf,
        lookbackDays,
        group,
        groupType,
        driverUniverseHash: universeHash,
        rows,
        cohesion,
        comparison,
        changes,
      });
      // What-changed on the analytical payload too (finding 4) — the SAME
      // objects the contract holds, so they can never drift.
      payload.comparison = comparison;
      payload.changes = changes;
    }

    // ── Cache write: FULLY CLEAN RUNS ONLY (zero dropped members, zero
    //    dropped drivers, zero uncomputable rows); a cache failure never
    //    fails the response. The doc carries the doc-level `snapshot` (its own
    //    compact snapshot, so the NEXT scan can carry it forward) and the
    //    embedded `priorSnapshot`, beside the payload. ──
    if (cleanRun) {
      try {
        const ttlMs = computeCorrelationCacheTtlMs();
        const doc = { payload, computedAt: payload.meta.computedAt, expiresAt: Date.now() + ttlMs, ttlMs };
        if (scanSnapshot) {
          doc.snapshot = scanSnapshot;
          doc.priorSnapshot = priorSnapshot;
        }
        // Doc-size guard (test #18): over the pinned budget against Firestore's
        // 1MB limit → SKIP the cache write entirely (no Firestore write, no L1),
        // and still serve the full response — the same no-poisoned-cache
        // discipline as the deep dive. An oversized scan is simply not cached.
        if (serializedByteSize(doc) > MAX_CONTRACT_BYTES) {
          console.warn('[correlation-scan] doc over size budget; skipping cache write (response served in full)');
        } else {
          await db.collection('correlationIntelligence').doc(docId).set(doc);
          setInCache(cacheKey, payload, Math.floor(ttlMs / 1000));
        }
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
