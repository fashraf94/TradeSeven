// api/_utils/wireEditorialAdapters.js
// FantasyTimes Wire — N3.3 deterministic verdict adapters (Spec V1.2 N3.3
// B3/F-B2/F-M4/F-M5; V1.5 R4-M1; Calibration Addendum §§1–6, FINAL LOCK).
//
// Everything here is PURE and P9-disciplined: an adapter identifies source
// fields, normalizes units, RECOMPUTES every supported declared basis from
// ADMITTED operands (the story's dataSnapshot + the generating-day
// fantasyTimesConsensus bucket — nothing else, D-P2-8), compares with the
// LOCKED tolerance, and returns VERIFIED_CORRECT / VERIFIED_WRONG /
// NOT_VERIFIABLE with operands, formula, expected, declared, and reason
// recorded. No heuristic ever originates a verdict; a value that won't
// parse deterministically is never eyeballed.
//
// DECLARED-VALUE REFERENT (build interpretation of record, flagged in the
// P3 checkpoint for ratification): every `X_vs_Y` basis declares the SIGNED
// DEVIATION of X from Y. This is not a guess — the validator's own R4_SIGN
// rule enforces sign-consistency between `direction` and `magnitude.value`
// on directionBases, which is only coherent when the value is the signed
// deviation (a jobless-claims LEVEL of 212,000 with direction 'down' would
// trip R4_SIGN; the −8,000 deviation does not). One recorded exception:
// revenue_vs_consensus, where the locked rationale ("2–3 sig figs of
// billions") admits a level reading — a declared value failing the
// deviation referent but matching the LEVEL within the same tolerance is
// NOT_VERIFIABLE(`ambiguous_referent`), never adjudicated to WRONG (the
// addendum's own S5 declared-referent precedent).
//
// GATE-BEARING vs DERIVATION ERROR (B3/F-B2 partition of record, same
// ratification flag): the deterministic prose↔facts dimensions (ticker ·
// value · unit · direction · actual-vs-expected status) surface here as
// CRITICAL codes — categorical inversions with zero tolerance —
// while magnitude misses beyond tolerance WITH THE SAME SIGN are ordinary
// derivation errors carried by the 5% budget:
//   · status_inversion  — sign(declared) contradicts sign(recomputed);
//   · direction_inversion — declared `direction` contradicts the
//     recomputed deviation's sign on a directionBases basis (catches the
//     self-consistent-but-inverted story R4_SIGN structurally cannot);
//   · subject_mismatch  — storyDoc.primaryTicker ≠ facts.primaryTicker
//     (public artifact vs typed channel, both non-null);
//   · wrong_subject_index_move — the declared index move fails its OWN
//     subjectRef's ETF leg while matching a DIFFERENT index's leg
//     (deterministic, operand-grounded; N3.4's own zero-tolerance clause).

import {
  EVENT_CONTRACTS,
  BASIS_SCOPE,
  ETF_TO_INDEX,
  WIRE_EDITORIAL_ADAPTER_VERSION,
} from './wireContracts.js';

export const EDITORIAL_VERDICTS = Object.freeze({
  VERIFIED_CORRECT: 'VERIFIED_CORRECT',
  VERIFIED_WRONG: 'VERIFIED_WRONG',
  NOT_VERIFIABLE: 'NOT_VERIFIABLE',
});
const { VERIFIED_CORRECT, VERIFIED_WRONG, NOT_VERIFIABLE } = EDITORIAL_VERDICTS;

// Index subject → the stored ETF proxy leg (addendum caveat ³: VIX has no leg).
const INDEX_LEG = Object.freeze({ SPX: 'spy', NDX: 'qqq', DJI: 'dia', RUT: 'iwm' });

// ── §6 tolerance machinery (LOCKED — any change bumps ADAPTER_VERSION) ────

const round4 = (x) => Math.round(x * 10_000) / 10_000;

/** |declared| < 10 → ±abs; else ±rel·|expected| (the §6 half-step rule). */
const bandFor = (declared, expected, abs, rel) =>
  Math.abs(declared) < 10 ? abs : rel * Math.abs(expected);

const TOLERANCES = Object.freeze({
  pct_strict: (d, e) => bandFor(d, e, 0.05, 0.005),
  pct_proxy: (d, e) => bandFor(d, e, 0.05, 0.005) + 0.10,   // ETF↔index tracking slack
  pct_catalyst: () => 0.10,                                  // abs/sign rule
  pct_priceMove: () => 0.10,                                 // S5 declared-referent rule
  eps_usd: () => 0.005,
  eps_surprise_pct: () => 0.5,
  // §6: revenue tolerance is 0.5% of the revenue LEVEL ("0.5% covers
  // two-sig-fig rounding of billions"), NOT 0.5% of the deviation being
  // compared. The caller passes the level as `relBase`; the second arg here
  // is that base, never the deviation (see compare()).
  revenue_rel: (d, base) => 0.005 * Math.abs(base),
  print_native: (d, e) => bandFor(d, e, 0.05, 0.005),
});

/** Strict numeric parse for Sonar-emitted operand strings (§6 print row):
 *  optional %, K/M/B suffix, comma strip. Returns null on anything else —
 *  the P9 boundary. */
export function parseOperand(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const m = raw.trim().replace(/,/g, '').match(/^([+-]?\d+(?:\.\d+)?)\s*([KMB])?\s*%?$/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Number(m[1]) * mult;
}

// ── Result construction ────────────────────────────────────────────────────

const nv = (target, basis, reason, extra = {}) => ({
  target, basis, verdict: NOT_VERIFIABLE, reason, declared: null, expected: null,
  operands: null, formula: null, critical: null, caveats: [], ...extra,
});

/**
 * Compare a declared deviation against a recomputed one under a locked
 * tolerance. Emits the critical partition (status/sign inversion) per the
 * module-header interpretation.
 */
function compare({ target, basis, declared, expected, operands, formula, toleranceKey, relBase, direction, directionChecked, caveats = [] }) {
  const d = round4(declared);
  const e = round4(expected);
  // Tolerances are relative to the recomputed comparison value (`e`) — EXCEPT
  // revenue_vs_consensus, whose §6 band is relative to the revenue LEVEL, not
  // the deviation `e` being compared. That one caller passes an explicit
  // relBase (the level); everything else leaves it undefined and uses `e`.
  const tolBase = relBase !== undefined ? round4(relBase) : e;
  const tol = TOLERANCES[toleranceKey](d, tolBase);
  const result = {
    target, basis, declared: d, expected: e, tolerance: round4(tol),
    toleranceKey, operands, formula, caveats, reason: null, critical: null,
  };

  // Direction inversion (gate-bearing): declared direction vs recomputed sign.
  if (directionChecked && direction && e !== 0) {
    const contradicts = (direction === 'up' && e < 0) || (direction === 'down' && e > 0);
    if (contradicts) {
      return { ...result, verdict: VERIFIED_WRONG, reason: 'direction_inversion', critical: 'direction_inversion' };
    }
  }
  // Status inversion (gate-bearing): declared sign vs recomputed sign.
  if (d !== 0 && e !== 0 && Math.sign(d) !== Math.sign(e) && Math.abs(d - e) > tol) {
    return { ...result, verdict: VERIFIED_WRONG, reason: 'status_inversion', critical: 'status_inversion' };
  }
  if (Math.abs(d - e) <= tol) return { ...result, verdict: VERIFIED_CORRECT };
  return { ...result, verdict: VERIFIED_WRONG, reason: 'beyond_tolerance' };
}

// ── R4-M1 binding precondition ─────────────────────────────────────────────

/** Typed-only entity set: tickers[] ∪ offUniverseTickers[] ∪ subjectRef,
 *  normalized + deduped. NO prose scanning (R4-M1). */
export function bindingEntitySet(facts) {
  const set = new Set();
  for (const t of facts.tickers || []) if (t) set.add(String(t).toUpperCase());
  for (const t of facts.offUniverseTickers || []) if (t) set.add(String(t).toUpperCase());
  if (facts.subjectRef) set.add(String(facts.subjectRef).toUpperCase());
  return [...set];
}

/** A ticker-scoped declaration binds iff exactly one unique entity AND
 *  primaryTicker equals it AND the basis is statically ticker_scoped. */
export function bindsToPrimaryTicker(facts, basis) {
  if (BASIS_SCOPE[basis] !== 'ticker_scoped') return { ok: false, reason: 'basis_not_ticker_scoped' };
  const entities = bindingEntitySet(facts);
  if (entities.length !== 1) return { ok: false, reason: `entity_count:${entities.length}` };
  const primary = facts.primaryTicker ? String(facts.primaryTicker).toUpperCase() : null;
  if (!primary || entities[0] !== primary) return { ok: false, reason: 'primary_ticker_mismatch' };
  return { ok: true, entity: entities[0] };
}

// ── Shape detection (F-M5: keyed on the ACTUAL snapshot shape) ────────────

export function detectSnapshotShape(dataSnapshot) {
  const ds = dataSnapshot;
  if (!ds || typeof ds !== 'object') return 'unknown';
  if (ds.spy !== undefined && ds.qqq !== undefined && ds.dia !== undefined && ds.iwm !== undefined) return 'S1';
  if (ds.percentChange !== undefined && ds.atrMultiple !== undefined && ds.price !== undefined) return 'S2';
  if (ds.eventName !== undefined && 'actual' in ds && 'estimate' in ds) return 'S3';
  if (ds.weekHighlight !== undefined && ds.totalEvents !== undefined) return 'S4';
  if (ds.epsActual !== undefined && ds.epsEstimate !== undefined && 'priceMove' in ds) return 'S5';
  if (ds.reportDate !== undefined && ds.symbol !== undefined) return 'S6';
  if (Array.isArray(ds.sectorPerformance)) return 'S7';
  return 'unknown';
}

// ── Declarations under review ──────────────────────────────────────────────

/** Enumerate the story's declared (target, basis, value, unit) tuples:
 *  the magnitude plus every figure. */
function declaredTuples(facts) {
  const out = [];
  if (facts.magnitude && typeof facts.magnitude.value === 'number') {
    out.push({ target: 'magnitude', basis: facts.magnitude.basis, value: facts.magnitude.value, unit: facts.magnitude.unit, entity: null });
  }
  // NOTE: figures carry NO ticker field in this phase (D-P2-8: figures[].ticker
  // is a V2 model-contract candidate; ModelAgentFacts is not reopened) —
  // entity resolution is the R4-M1 binding rule or nothing.
  (facts.figures || []).forEach((fig, i) => {
    if (fig && typeof fig.value === 'number') {
      out.push({ target: `figure[${i}]`, basis: fig.basis, value: fig.value, unit: fig.unit });
    }
  });
  return out;
}

// ── Per-shape recomputation ────────────────────────────────────────────────

function verifyTuple(tuple, ctx) {
  const { shape, facts, ds, bucket, direction, contract } = ctx;
  const { target, basis, value, unit } = tuple;
  const directionChecked = Boolean(contract && (contract.directionBases || []).includes(basis));

  // CIRCULAR shapes never reach here (handled in adaptStory) — belt anyway.
  if (shape === 'S4' || shape === 'S6') return nv(target, basis, 'circular');

  switch (basis) {
    case 'index_vs_prior_close': {
      if (shape !== 'S1') return nv(target, basis, 'missing_operand');
      if (unit !== 'pct') return nv(target, basis, 'unit_unsupported');
      const subject = facts.subjectRef ? String(facts.subjectRef).toUpperCase() : null;
      if (!subject) return nv(target, basis, 'missing_subject');
      if (subject === 'VIX') return nv(target, basis, 'no_proxy_instrument');
      const legKey = INDEX_LEG[subject];
      if (!legKey) return nv(target, basis, 'no_proxy_instrument');
      const leg = ds[legKey];
      if (!leg || typeof leg.changePercent !== 'number') return nv(target, basis, 'missing_operand');
      const result = compare({
        target, basis, declared: value, expected: leg.changePercent,
        operands: { leg: legKey, changePercent: leg.changePercent },
        formula: `${legKey}.changePercent (ETF proxy for ${subject})`,
        toleranceKey: 'pct_proxy', direction, directionChecked,
        caveats: ['etf_index_proxy'],
      });
      // Wrong-subject probe (N3.4): own leg failed — does another index leg
      // match within the same proxy tolerance? Deterministic, operand-only.
      if (result.verdict === VERIFIED_WRONG) {
        const matches = Object.entries(INDEX_LEG).filter(([idx, key]) => {
          if (idx === subject) return false;
          const other = ds[key];
          if (!other || typeof other.changePercent !== 'number') return false;
          const d = round4(value); const e = round4(other.changePercent);
          return Math.abs(d - e) <= TOLERANCES.pct_proxy(d, e);
        }).map(([idx]) => idx);
        if (matches.length > 0) {
          return { ...result, reason: 'wrong_subject_index_move', critical: 'wrong_subject_index_move', caveats: [...result.caveats, `matches:${matches.join('+')}`] };
        }
      }
      return result;
    }

    case 'price_vs_prior_close': {
      // Dispatch by shape: S2 strict · S1 catalyst-proxy · S5 priceMove ·
      // S7 sector ETF quote. Binding rule gates every ticker-scoped path.
      if (unit !== 'pct') return nv(target, basis, 'unit_unsupported');
      if (shape === 'S2') {
        const bind = bindsToPrimaryTicker(facts, basis);
        if (!bind.ok) return nv(target, basis, `unbindable:${bind.reason}`);
        if (typeof ds.percentChange !== 'number') return nv(target, basis, 'missing_operand');
        return compare({
          target, basis, declared: value, expected: ds.percentChange,
          operands: { percentChange: ds.percentChange },
          formula: 'dataSnapshot.percentChange', toleranceKey: 'pct_strict',
          direction, directionChecked,
        });
      }
      if (shape === 'S1') {
        const bind = bindsToPrimaryTicker(facts, basis);
        if (!bind.ok) return nv(target, basis, `unbindable:${bind.reason}`);
        const row = bucket?.catalysts?.[bind.entity];
        if (!row || typeof row.percentChange !== 'number') return nv(target, basis, 'missing_operand', { caveats: ['catalyst_presence_conditional'] });
        // Abs/sign rule (§6): |declared| vs |operand|; direction separately.
        const d = round4(Math.abs(value)); const e = round4(Math.abs(row.percentChange));
        const within = Math.abs(d - e) <= TOLERANCES.pct_catalyst();
        const dirOk = !direction || !row.direction || direction === row.direction;
        const base = {
          target, basis, declared: d, expected: e, tolerance: 0.10,
          toleranceKey: 'pct_catalyst', formula: '|catalysts[ticker].percentChange| with direction matched separately',
          operands: { percentChange: row.percentChange, direction: row.direction ?? null },
          caveats: ['abs_sign_rule'], reason: null, critical: null,
        };
        if (!dirOk) return { ...base, verdict: VERIFIED_WRONG, reason: 'direction_inversion', critical: 'direction_inversion' };
        if (within) return { ...base, verdict: VERIFIED_CORRECT };
        return { ...base, verdict: VERIFIED_WRONG, reason: 'beyond_tolerance' };
      }
      if (shape === 'S5') {
        if (typeof ds.priceMove !== 'number') return nv(target, basis, 'missing_operand');
        const result = compare({
          target, basis, declared: value, expected: ds.priceMove,
          operands: { priceMove: ds.priceMove },
          formula: 'dataSnapshot.priceMove (earnings-day move — declared-referent rule)',
          toleranceKey: 'pct_priceMove', direction, directionChecked,
        });
        return { ...result, caveats: [...result.caveats, 'ambiguous_referent_priceMove'] };
      }
      if (shape === 'S7') {
        const bind = bindsToPrimaryTicker(facts, basis);
        if (!bind.ok) return nv(target, basis, `unbindable:${bind.reason}`, { caveats: ['five_of_eleven_etfs'] });
        const entity = bind.entity;
        const row = (ds.sectorPerformance || []).find((p) => String(p.symbol).toUpperCase() === entity);
        if (!row || typeof row.changePercent !== 'number') return nv(target, basis, 'missing_operand', { caveats: ['five_of_eleven_etfs'] });
        const result = compare({
          target, basis, declared: value, expected: row.changePercent,
          operands: { symbol: entity, changePercent: row.changePercent },
          formula: 'sectorPerformance[symbol].changePercent', toleranceKey: 'pct_strict',
          direction, directionChecked,
        });
        return { ...result, caveats: [...result.caveats, 'proxy_e_coverage'] };
      }
      return nv(target, basis, 'missing_operand');
    }

    case 'print_vs_expected': {
      if (shape !== 'S3') return nv(target, basis, 'missing_operand');
      let actual = parseOperand(ds.actual);
      let expected = parseOperand(ds.estimate);
      let source = 'dataSnapshot';
      if (actual === null || expected === null) {
        // Bucket corroboration (§3 sources): the generating-day economics[]
        // row for the same event.
        const row = (bucket?.economics || []).find((e) => e.event === ds.eventName);
        const a2 = parseOperand(row?.actual); const x2 = parseOperand(row?.expected);
        if (a2 !== null && x2 !== null) { actual = a2; expected = x2; source = 'consensus_bucket'; }
      }
      if (actual === null || expected === null) {
        return nv(target, basis, (ds.actual ?? ds.estimate) != null ? 'unparseable_operand' : 'missing_operand');
      }
      return compare({
        target, basis, declared: value, expected: actual - expected,
        operands: { actual, expected, source },
        formula: 'parse(actual) − parse(expected)', toleranceKey: 'print_native',
        direction, directionChecked,
      });
    }

    case 'eps_vs_consensus': {
      if (shape !== 'S5') return nv(target, basis, 'missing_operand');
      const a = ds.epsActual; const e = ds.epsEstimate;
      if (typeof a !== 'number' || typeof e !== 'number') return nv(target, basis, 'missing_operand');
      if (unit === 'usd') {
        return compare({
          target, basis, declared: value, expected: a - e,
          operands: { epsActual: a, epsEstimate: e },
          formula: 'epsActual − epsEstimate', toleranceKey: 'eps_usd',
          direction, directionChecked,
        });
      }
      if (unit === 'pct') {
        if (e === 0) return nv(target, basis, 'zero_denominator');
        return compare({
          target, basis, declared: value, expected: ((a - e) / Math.abs(e)) * 100,
          operands: { epsActual: a, epsEstimate: e },
          formula: '(epsActual − epsEstimate) / |epsEstimate| × 100', toleranceKey: 'eps_surprise_pct',
          direction, directionChecked,
        });
      }
      return nv(target, basis, 'unit_unsupported');
    }

    case 'revenue_vs_consensus': {
      if (shape !== 'S5') return nv(target, basis, 'missing_operand');
      if (unit !== 'usd') return nv(target, basis, 'unit_unsupported');
      const row = bucket?.earnings?.results?.[String(facts.primaryTicker || '').toUpperCase()]
        ?? bucket?.earnings?.results?.[facts.primaryTicker];
      const a = row?.revenueActual; const e = row?.revenueEstimate;
      if (typeof a !== 'number' || typeof e !== 'number') return nv(target, basis, 'missing_operand', { caveats: ['revenue_nullable'] });
      const deviation = a - e;
      const result = compare({
        target, basis, declared: value, expected: deviation,
        operands: { revenueActual: a, revenueEstimate: e },
        formula: 'revenueActual − revenueEstimate', toleranceKey: 'revenue_rel',
        relBase: a, // §6: band is 0.5% of the revenue LEVEL, not the deviation
        direction, directionChecked,
      });
      if (result.verdict === VERIFIED_WRONG) {
        // Recorded exception (module header): a declared value matching the
        // LEVEL within the same relative tolerance is ambiguous-referent —
        // refused, counted, never adjudicated WRONG.
        if (Math.abs(round4(value) - round4(a)) <= 0.005 * Math.abs(a)) {
          return nv(target, basis, 'ambiguous_referent', { declared: round4(value), caveats: ['level_vs_deviation'] });
        }
      }
      return result;
    }

    // Structurally unavailable operands (addendum §2 UNAVAILABLE / DEAD).
    case 'price_vs_level':
    case 'volume_vs_avg':
    case 'range_vs_atr':
    case 'gap_vs_prior_close':
    case 'rs_vs_peers':
    case 'sector_vs_spy':
      return nv(target, basis, 'missing_operand');

    case 'consensus_estimate':
    case 'prior_print':
      return nv(target, basis, 'circular');

    default:
      return nv(target, basis, 'unknown_basis');
  }
}

// ── The story adapter ──────────────────────────────────────────────────────

/**
 * Run the deterministic verdict machinery over one sampled story.
 *
 * @param {object} o
 * @param {object} o.entry — the Wire entry (agentFacts + wrapper fields)
 * @param {object|null} o.storyDoc — the published story document
 * @param {object|null} o.bucket — the GENERATING-DAY fantasyTimesConsensus
 *   doc data (joined by the writers' own UTC-date expression — P2-40)
 * @returns {object} audit-row core: shape, adapterVersion, results[],
 *   storyVerdict, criticalCodes[], notVerifiableReasons[]
 */
export function adaptStory({ entry, storyDoc, bucket }) {
  const facts = entry?.agentFacts || {};
  const ds = storyDoc?.dataSnapshot ?? null;
  const contract = EVENT_CONTRACTS[facts.eventType] || null;
  const shape = detectSnapshotShape(ds);
  const tuples = declaredTuples(facts);
  const results = [];
  const criticalCodes = [];

  // Gate-bearing subject check (doc↔facts, deterministic, no oracle needed).
  if (storyDoc?.primaryTicker && facts.primaryTicker
    && String(storyDoc.primaryTicker).toUpperCase() !== String(facts.primaryTicker).toUpperCase()) {
    criticalCodes.push('subject_mismatch');
  }

  if (shape === 'unknown') {
    // F-M5 / P2-23: a novel shape is NOT_VERIFIABLE(unknown_shape) on every
    // declaration — counted, never a throw, never a skip.
    for (const t of tuples) results.push(nv(t.target, t.basis, 'unknown_shape'));
    if (tuples.length === 0) results.push(nv('story', null, 'unknown_shape'));
  } else if (shape === 'S4' || shape === 'S6') {
    // P2-39: preview shapes are UNVERIFIABLE(circular) by spec text —
    // regardless of value agreement, they are never adapted.
    for (const t of tuples) results.push(nv(t.target, t.basis, 'circular'));
    if (tuples.length === 0) results.push(nv('story', null, 'circular'));
  } else {
    const ctx = { shape, facts, ds, bucket, direction: facts.direction ?? null, contract };
    for (const t of tuples) results.push(verifyTuple(t, ctx));
    if (tuples.length === 0) results.push(nv('story', null, 'no_declarations'));
  }

  for (const r of results) if (r.critical) criticalCodes.push(r.critical);

  const anyWrong = results.some((r) => r.verdict === VERIFIED_WRONG);
  const anyCorrect = results.some((r) => r.verdict === VERIFIED_CORRECT);
  const storyVerdict = anyWrong ? VERIFIED_WRONG : anyCorrect ? VERIFIED_CORRECT : NOT_VERIFIABLE;

  return {
    shape,
    adapterVersion: WIRE_EDITORIAL_ADAPTER_VERSION,
    results,
    storyVerdict,
    criticalCodes: [...new Set(criticalCodes)],
    notVerifiableReasons: [...new Set(results.filter((r) => r.verdict === NOT_VERIFIABLE).map((r) => r.reason))],
  };
}

/** The writers' own consensus join key (P2-40): UTC date of publishedAt via
 *  the SAME expression the writers use — never the Wire marketDate. */
export function consensusJoinDate(publishedAt) {
  // Nullish guard FIRST: new Date(null) is epoch 0 (1970-01-01), not an
  // Invalid Date, so without this a missing publishedAt would silently join
  // to a '1970-01-01' bucket and persist that as audit provenance. A missing
  // timestamp has no join key — return null (the caller passes no bucket).
  if (publishedAt === null || publishedAt === undefined) return null;
  const d = publishedAt?.toDate?.() ?? publishedAt;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}
