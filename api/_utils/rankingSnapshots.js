// api/_utils/rankingSnapshots.js
//
// Archetype Rank Interface V2 — the observation-window snapshot writer (spec §5
// Phase A, P-11; docs/specs/ARCHETYPE_RANK_INTERFACE_V2_BUILD_SPEC_V1_3.md).
//
// Toggled by the Firestore OPS DOC `ops/rankingSnapshots { enabled, retainDays }`
// — an ops toggle, not a feature flag: the founder flips it in the console (no
// deploy), the producer reads it at run start, ABSENT ⇒ OFF. Expiry is
// expire-on-write inside the premarket run (no cron slot — BUILD_RULES §6 has
// one left). A snapshot failure is logged into the run's `errors` and never
// fails the producer: it runs AFTER the stockRankings batch has committed.
//
// Pure builders + thin Admin-SDK adapters that the cron composes. ZERO firebase
// imports here so the unit tests run against a fake db; the cron adds the
// Timestamp / serverTimestamp fields at the write.
//
// Document shapes (also recorded in the Job 1 report §6):
//   ops/rankingSnapshots            { enabled: boolean, retainDays: integer ≥ 1 }
//   rankingSnapshots/{etDate}_{runLabel}   see buildRankingSnapshotDoc()

export const RANKING_SNAPSHOTS_COLLECTION = 'rankingSnapshots';
export const RANKING_SNAPSHOTS_OPS_COLLECTION = 'ops';
export const RANKING_SNAPSHOTS_OPS_DOC = 'rankingSnapshots';
export const RANKING_SNAPSHOTS_DEFAULT_RETAIN_DAYS = 30;
export const RANKING_SNAPSHOT_SCHEMA_VERSION = 1;

// vercel.json schedules the intraday recompute "0 14-20 * * 1-5" (UTC-only, so
// no DST shift); the 20:00 UTC run is the LAST intraday run of the day — the
// second daily snapshot P-11 asks for ("premarket and last-intraday").
export const LAST_INTRADAY_RUN_HOUR_UTC = 20;
export const SNAPSHOT_RUN_LABELS = Object.freeze({
  premarket: 'premarket',
  intradayLast: 'intraday-last',
});

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRE_QUERY_LIMIT = 500;
const LABEL_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** { enabled, retainDays } from the raw ops doc data; anything malformed ⇒ off / default. */
export function normalizeSnapshotOps(data) {
  if (!data || typeof data !== 'object') {
    return { enabled: false, retainDays: RANKING_SNAPSHOTS_DEFAULT_RETAIN_DAYS };
  }
  const enabled = data.enabled === true;
  const rd = data.retainDays;
  const retainDays = Number.isInteger(rd) && rd >= 1 ? rd : RANKING_SNAPSHOTS_DEFAULT_RETAIN_DAYS;
  return { enabled, retainDays };
}

/**
 * Read the ops toggle at run start. Absent doc ⇒ off; a read error ⇒ off (and
 * logged) — the toggle can only ever ADD work, never break the producer.
 */
export async function readRankingSnapshotOps(db, { log = () => {} } = {}) {
  try {
    const snap = await db.collection(RANKING_SNAPSHOTS_OPS_COLLECTION).doc(RANKING_SNAPSHOTS_OPS_DOC).get();
    if (!snap.exists) {
      return { enabled: false, retainDays: RANKING_SNAPSHOTS_DEFAULT_RETAIN_DAYS, source: 'absent' };
    }
    return { ...normalizeSnapshotOps(snap.data()), source: 'doc' };
  } catch (err) {
    log(`⚠ ops/rankingSnapshots read failed — snapshots OFF this run: ${err?.message}`);
    return { enabled: false, retainDays: RANKING_SNAPSHOTS_DEFAULT_RETAIN_DAYS, source: 'error' };
  }
}

/**
 * Which runs snapshot: the premarket run always; the intraday run only at the
 * last scheduled hour; any other intraday run ⇒ null (no snapshot). An explicit
 * `override` label (a manual `?snapshotLabel=` invocation for a smoke) wins when
 * it is a safe doc-id fragment.
 */
export function resolveSnapshotRunLabel({ intraday, now = new Date(), override = null } = {}) {
  if (typeof override === 'string' && LABEL_RE.test(override)) return override;
  if (!intraday) return SNAPSHOT_RUN_LABELS.premarket;
  return now.getUTCHours() === LAST_INTRADAY_RUN_HOUR_UTC ? SNAPSHOT_RUN_LABELS.intradayLast : null;
}

/** `{YYYY-MM-DD}_{runLabel}` — ET market date (BUILD_RULES §6: Intl, never offset math). */
export function snapshotDocId(etDate, runLabel) {
  return `${etDate}_${runLabel}`;
}

/**
 * The snapshot document (pure). Per-symbol payload is keyed by symbol so a
 * reader can join it to any later doc without scanning: { axes, arch_scores,
 * arch_scores_v2 } — the three things the observation window compares.
 */
export function buildRankingSnapshotDoc({
  etDate,
  runLabel,
  mode,
  now,
  codeHead = null,
  universe,
  axesFormulaVersion,
  universeMedianReturn1W = null,
  axisNullCounts = null,
  archetypePostFilterCounts = null,
  events = [],
  elapsedSeconds = null,
  stageTimings = null,
  retainDays = RANKING_SNAPSHOTS_DEFAULT_RETAIN_DAYS,
}) {
  const stocks = {};
  for (const s of Array.isArray(universe) ? universe : []) {
    if (typeof s?.symbol !== 'string') continue;
    stocks[s.symbol] = {
      axes: s.axes ?? null,
      arch_scores: s.arch_scores ?? null,
      arch_scores_v2: s.arch_scores_v2 ?? null,
    };
  }
  const asOfMs = now.getTime();
  return {
    schemaVersion: RANKING_SNAPSHOT_SCHEMA_VERSION,
    etDate,
    runLabel,
    mode,
    asOf: now.toISOString(),
    asOfMs,
    codeHead,
    universeCount: Object.keys(stocks).length,
    axesFormulaVersion,
    universeMedianReturn1W,
    axisNullCounts,
    archetypePostFilterCounts,
    events: Array.isArray(events) ? events : [],
    elapsedSeconds,
    stageTimings,
    retainDays,
    expiresAtMs: asOfMs + retainDays * DAY_MS,
    stocks,
  };
}

// The two write chains below name their collection as a LITERAL on purpose:
// the B3 deny-by-default write scan (compositionProtectedStoresScan.js)
// resolves only `.collection('<literal>')`, so an identifier constant here
// would land both helpers — and every caller — on the allowlist as
// 'unresolved'. Literal-at-the-write is the recorded precedent (the allowlist's
// mandateUniverseSnapshot note); RANKING_SNAPSHOTS_COLLECTION stays exported for
// readers and tests.
export async function writeRankingSnapshot(db, id, docData) {
  await db.collection('rankingSnapshots').doc(id).set(docData);
  return id;
}

/**
 * Expire-on-write (P-11): delete snapshots whose asOf is older than retainDays
 * (measured against the CURRENT retainDays, so shortening the window in the
 * ops doc takes effect on the next premarket run). Bounded to one batch.
 */
export async function expireRankingSnapshots(db, { nowMs, retainDays, limit = EXPIRE_QUERY_LIMIT }) {
  const cutoffMs = nowMs - retainDays * DAY_MS;
  const snap = await db.collection('rankingSnapshots')
    .where('asOfMs', '<=', cutoffMs)
    .limit(limit)
    .get();
  if (snap.empty) return { deleted: 0, cutoffMs };
  // Per-doc deletes through the literal chain (not a batch of query-derived
  // refs, which the B3 scan cannot resolve). Typical volume: the one or two
  // snapshots that aged out since the previous premarket run.
  await Promise.all(snap.docs.map((d) => db.collection('rankingSnapshots').doc(d.id).delete()));
  return { deleted: snap.docs.length, cutoffMs };
}
