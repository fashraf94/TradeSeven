// api/_utils/filmTape/tapeTags.js
//
// Film Room B1 item 2 — THE TAGGER (Build B spec §2; shared contract §2, §4).
// The close pass runs it over the MERGED day (writeTapeDay hands it to the
// merge, which calls it after the rows and coverage are merged), and the tape
// stores what it found as the declared section `tags`, with `coverage.tags`.
// Every re-run of the close pass for the day — the nightly pass, the backfill,
// the refresh (`refresh=1`) — re-tags it.
//
// THREE PARTS:
//   tagInputs   — what the tagger used, resolved from the battle and the day's
//                 ticks: the archetype's forced-rotation thresholds from the
//                 registry adapter (getArchetypeDefinition — never the legacy
//                 table), the founder slots from the situation registry, and
//                 the tempo dial at each check, with its basis. Stored as
//                 `tags.inputs`, so the section is reproducible from the tape.
//   tagDay      — PURE over (inputs, checks, actions): the platform's own
//                 arithmetic (updateStagnationCounter, imported from the fenced
//                 risk manager — called, never copied, BUILD_RULES §1/§4) over
//                 the price the agent was shown at each check, and the list of
//                 every recorded stagnation exit. Re-running it on a stored
//                 tape's `tags.inputs`, `checks[]` and `actions[]` gives its
//                 `items` and `exits` again (exit criterion 3).
//   tagTapeDay  — both, behind ONE try/catch: a tagger failure never stops or
//                 corrupts the rest of the tape write. `tags` then reads
//                 unavailable with the error class (exit criterion 4).
//
// THE DIAL AT EACH CHECK (spec §2, §9.1). The permanent tick has no tempo field
// (api/_utils/tickCapture/captureWriter.js `controls`). It does record
// `controls.controlEpoch`, the length of the battle's `controlEpochLog` when it
// ran, and that log's entry records whether the dial was on
// (`modes.tempoDialEnabled`, controlSuppressionTelemetry.js). So:
//   tick_controls     — the battle's frozen desired tempo
//                       (agentContext.dials.tempo), resolved under the dial
//                       state the tick's control epoch recorded;
//   battle_frozen     — the same desired tempo, resolved under the dial flag
//                       as it stands when the tagger runs (no epoch on the tick);
//   archetype_default — no tempo on the battle: standard, multiplier 1.
// The resolution and the threshold scaling are the clamp's own
// (resolveTempoDial, applyTempoToHftConfig).
//
// TWO BASES, PER HOLDING PER DAY (B1.1, Amendment C RC-1 — `stalled` v2):
//   recorded    — every check that holds the symbol carries the live rule's
//                 own record (`checks[].stagnation[sym]`, copied from the
//                 tick's `risk.stagnation`, RC-2): the count evaluateRisk
//                 received, its age verdict and the daily change the winner
//                 test read. Those are the tag's count, age verdict and winner
//                 input; nothing is recomputed, and the count carries over the
//                 night as the live rule's does. A reset is `withinAge &&
//                 ticks === 0`.
//   recomputed  — any check that holds the symbol lacks the record (every
//                 day before B1.1): the holding is walked exactly as v1 walks
//                 it, below. `tags.inputs.holdingBasis` stores each holding's
//                 basis, so the section is reproducible from the tape alone.
//
// WHAT A RECOMPUTED HOLDING'S TAPE DOES NOT HOLD (reported, never guessed):
//   · the daily change the live rule's winner test reads
//     (`prices[sym].changePercent`, agent-evaluate.js). The tape records
//     `evidence.*.chg`, the change from the position's entry; the winner test
//     here reads it (`tags.inputs.winnerBasis.recomputed`: `change_since_entry`;
//     a recorded holding's is `daily_change`, its record's `dailyPct`).
//   · a price at a check with no evaluation entry (a `no_trigger` check writes
//     none). The live counter steps on every tick; here such a check pauses the
//     count for the holding, as the age guard does — updateStagnationCounter's
//     own no-price branch.
//   · the count the live counter carried over the night (cronState persists;
//     nothing resets it at the day boundary). Here the count starts at zero at
//     the day's first check, as the registry's definition says.

import { updateStagnationCounter } from '../agentRiskManager.js';
import { getArchetypeDefinition } from '../archetypeRegistry.js';
import { resolveTempoDial, applyTempoToHftConfig, desiredTempoOf } from '../tempoDialClamp.js';
import { TEMPO_DIAL_ENABLED } from '../../../src/config/featureFlags.js';
import { SITUATIONS, SITUATION_REGISTRY_VERSION } from '../../../src/data/situationRegistry.js';
import { isCheck } from './candleInputs.js';
import { coverageOf } from './tapeAssemble.js';
import { toMs } from './tapeTime.js';
import { errorClassOf } from './errorClass.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' && v ? v : null);
const rowsOf = (v) => (Array.isArray(v) ? v.filter(isObj) : []);

const STALLED = SITUATIONS.stalled;
/**
 * The winner test's input per basis, stored as `tags.inputs.winnerBasis`
 * (Build B Amendment D RD-7, review X2-7b): a RECORDED holding reads the daily
 * change the live rule read (its record's `dailyPct`); a RECOMPUTED holding
 * reads the change from entry (`evidence.*.chg`), as B1 did — its tape does
 * not hold the daily change. B1 and B1.1 stored the recomputed input alone
 * (the string 'change_since_entry'); tagDay never reads this field, so those
 * stored inputs still reproduce their sections.
 */
export const WINNER_BASIS = Object.freeze({ recorded: 'daily_change', recomputed: 'change_since_entry' });
/** RC-1 — the two bases a holding's day is tagged on. */
export const HOLDING_BASES = Object.freeze(['recorded', 'recomputed']);
/** The dial bases, in the spec's order of preference (§2). */
export const DIAL_BASES = Object.freeze(['tick_controls', 'battle_frozen', 'archetype_default']);
/** The exit reason the platform's forced rotation records (agentRiskManager.js evaluateRiskAction step 5). */
export const STAGNATION_EXIT_REASON = 'stagnation';

/** What the section always carries: the registry version and each live situation's version. */
export const tagsHeader = () => ({ registryVersion: SITUATION_REGISTRY_VERSION, situations: { stalled: STALLED.version } });

/** The checks the tagger walks — the rows that record a check the battle ran, at a known time (candleInputs.js isCheck). */
export const tagChecks = (checks) => rowsOf(checks).filter(isCheck);

/**
 * Every recorded stagnation exit of the day, from the action rows alone. Its
 * `precededByTag` is filled by tagDay; without items it stays null (unknown).
 */
export function listExits(actions) {
  return rowsOf(actions)
    .filter((a) => a.exitReason === STAGNATION_EXIT_REASON)
    .map((a) => ({ symbol: str(a.symbolOut), tickSeq: Number.isInteger(a.tickSeq) ? a.tickSeq : null, at: str(a.at), precededByTag: null }));
}

/**
 * RC-1 — a check's COMPLETE record for `sym`: the count (an integer ≥ 0), the
 * age verdict (a boolean) and the daily change (a finite number) the live rule
 * read at that tick — or null when any of the three is missing.
 */
export function recordAt(check, sym) {
  const r = isObj(check?.stagnation) ? check.stagnation[sym] : null;
  return isObj(r) && Number.isInteger(r.ticks) && r.ticks >= 0 && typeof r.withinAge === 'boolean' && num(r.dailyPct) !== null ? r : null;
}

/**
 * RC-1 — each holding's basis for the day, from the checks alone: `recorded`
 * when EVERY check that holds the symbol carries its complete record, else
 * `recomputed`. Sorted by symbol.
 */
export function holdingBasisOf(checks) {
  const out = {};
  for (const c of tagChecks(checks)) {
    const held = heldAt(c);
    if (!held) continue;
    for (const sym of held) if (out[sym] !== 'recomputed') out[sym] = recordAt(c, sym) ? 'recorded' : 'recomputed';
  }
  return Object.fromEntries(Object.keys(out).sort().map((sym) => [sym, out[sym]]));
}

const sameBasis = (a, b) => isObj(a) && isObj(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(b).every((k) => a[k] === b[k]);

/** The risk actions that take a holding out of the book at its check (agentRiskManager.js evaluateRiskAction). */
const SWAP_ACTIONS = Object.freeze(['SWAP_OUT', 'EMERGENCY_SWAP', 'TRAIL_STOP']);

/** The stagnation verdict a check records for a holding: on its tick's risk record, or — a check rebuilt from its entry — on the evidence stamp's risk (tickStamps.js composeRisk). */
const firedAt = (check, sym) => (isObj(check.risk) && check.risk[sym]?.reason === STAGNATION_EXIT_REASON)
  || (isObj(check.evidence) && isObj(check.evidence[sym]) && check.evidence[sym].risk?.reason === STAGNATION_EXIT_REASON);

/**
 * The held stocks a check records with no price, less the ones that left the
 * book AT that check — the evidence is stamped after a swap and no longer
 * carries the sold name (agent-evaluate.js: the risk record before the swap,
 * the stamp after it), so a sold name is no pause. A name left when the
 * check's risk verdict for it is a swap action, or an action of the day swapped
 * it out at that check (its tickSeq, else an instant after the previous check
 * and not after this one).
 */
export function unpricedHeld(check, { actions = [], prevAt = null } = {}) {
  const held = heldAt(check);
  if (!held) return [];
  const fromMs = toMs(prevAt) ?? -Infinity;
  const atMs = toMs(check.at);
  const left = (sym) => (isObj(check.risk) && SWAP_ACTIONS.includes(check.risk[sym]?.action))
    || rowsOf(actions).some((a) => a.symbolOut === sym && ((Number.isInteger(a.tickSeq) && a.tickSeq === check.tickSeq)
      || (toMs(a.at) !== null && atMs !== null && toMs(a.at) > fromMs && toMs(a.at) <= atMs)));
  return held.filter((sym) => num(check.evidence?.[sym]?.px) === null && !left(sym));
}

/** The dial at one check, with its basis (see the header). */
function dialAt({ desired, tick, epochLog, dialEnabled }) {
  if (desired === undefined || desired === null) return { basis: 'archetype_default', effectiveTempo: 'standard', multiplier: 1 };
  // controls.controlEpoch is the log's length after this tick's epoch telemetry
  // appended (agent-evaluate.js), so log[epoch − 1] is the epoch in force. If
  // that append's durable write failed twice, the in-memory log was not
  // extended and the index names the previous epoch (controlSuppressionTelemetry.js) — rare, and not detectable here.
  const epoch = tick?.controls?.controlEpoch;
  const entry = Number.isInteger(epoch) && epoch >= 1 ? epochLog[epoch - 1] : null;
  if (isObj(entry) && typeof entry.modes?.tempoDialEnabled === 'boolean') {
    const r = resolveTempoDial({ desiredTempo: desired, dialEnabled: entry.modes.tempoDialEnabled });
    return { basis: 'tick_controls', effectiveTempo: r.effectiveTempo, multiplier: r.multiplier };
  }
  const r = resolveTempoDial({ desiredTempo: desired, dialEnabled });
  return { basis: 'battle_frozen', effectiveTempo: r.effectiveTempo, multiplier: r.multiplier };
}

/**
 * What the tagger uses for one battle-day. `{ ok: false, reason }` when the
 * battle's archetype resolves to no forced-rotation thresholds — the tagger
 * does not guess one (the live rule falls back to the analyst's config for an
 * unknown archetype; the tape says it could not tag instead).
 *
 * @param {{ battle: object, checks: object[], ticks?: object[], dialEnabled?: boolean }} p
 */
export function tagInputs({ battle, checks, ticks = [], dialEnabled = TEMPO_DIAL_ENABLED }) {
  const archetypeCodeId = str(battle?.agentContext?.archetype);
  const def = archetypeCodeId ? getArchetypeDefinition(archetypeCodeId) : null;
  const hft = def?.physics?.hftConfig ?? null;
  const fr = hft?.forcedRotation ?? null;
  if (!isObj(fr)) {
    return { ok: false, reason: archetypeCodeId ? `unknown archetype (${archetypeCodeId})` : 'no archetype recorded on the battle', archetypeCodeId };
  }
  const forcedRotation = {
    enabled: fr.enabled === true,
    pctThreshold: num(fr.pctThreshold),
    ticksThreshold: num(fr.ticksThreshold),
    winnerThreshold: num(fr.winnerThreshold),
    maxTickAgeMinutes: num(fr.maxTickAgeMinutes),
  };
  const missing = Object.entries(forcedRotation).filter(([k, v]) => k !== 'enabled' && v === null).map(([k]) => k);
  if (missing.length) return { ok: false, reason: `the archetype's forced-rotation thresholds are incomplete (${missing.join(', ')})`, archetypeCodeId };

  const desired = desiredTempoOf(battle);
  const epochLog = Array.isArray(battle?.controlEpochLog) ? battle.controlEpochLog : [];
  const tickBySeq = {};
  for (const t of rowsOf(ticks)) if (Number.isInteger(t.tickSeq)) tickBySeq[t.tickSeq] = t;
  const S2 = STALLED.slots.S2;
  const perCheck = tagChecks(checks).map((c) => {
    const tick = Number.isInteger(c.tickSeq) ? (tickBySeq[c.tickSeq] ?? null) : null;
    const d = dialAt({ desired, tick, epochLog, dialEnabled });
    const effectiveTicksThreshold = forcedRotation.enabled
      ? num(applyTempoToHftConfig(hft, d.effectiveTempo, d.multiplier)?.forcedRotation?.ticksThreshold)
      : S2.checks;
    return { tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, at: c.at, tempoMultiplier: d.multiplier, effectiveTicksThreshold, basis: d.basis };
  });
  return {
    ok: true,
    inputs: {
      archetypeCodeId,
      forcedRotation,
      slots: { S1: { checksBeforeRule: STALLED.slots.S1.checksBeforeRule }, S2: { checks: S2.checks, pctThreshold: S2.pctThreshold } },
      tempoDesired: typeof desired === 'string' ? desired : null,
      dialEnabledAtTagTime: dialEnabled === true,
      winnerBasis: { ...WINNER_BASIS },
      perCheck,
      // RC-1: each holding's basis for the day (recorded | recomputed)
      holdingBasis: holdingBasisOf(checks),
    },
  };
}

/**
 * The holdings a check records: the risk record's symbols — the book the live
 * counter stepped over at that check (agent-evaluate.js: the risk loop runs
 * before any swap of the tick) — else, on a check rebuilt from its entry (no
 * risk record), the evidence stamp's. Null when it records neither. (A name a
 * swap brought in appears in the stamp before it is in a risk record; the live
 * counter first sees it at the next tick, and so does this walk.)
 */
function heldAt(check) {
  const keys = isObj(check.risk) && Object.keys(check.risk).length ? Object.keys(check.risk) : Object.keys(isObj(check.evidence) ? check.evidence : {});
  return keys.length ? [...keys].sort() : null;
}

/**
 * PURE — the day's `stalled` items and every recorded stagnation exit, from
 * the stored inputs, checks and actions alone.
 *
 * Per holding, its basis (RC-1, holdingBasisOf — the checks' own fact, which
 * stored inputs naming one must match). RECORDED: at every check the count,
 * the age verdict and the winner test's input are the check's record of the
 * live rule (`checks[].stagnation[sym]`: ticks, withinAge, dailyPct); a reset
 * is a timely zero; nothing else below changes. RECOMPUTED, as v1:
 *
 * Per holding, in check order: the count steps through updateStagnationCounter
 * over `evidence[sym].px` at the check's evidence instant (`evidenceAt`, else
 * its `at`); a check with no price for the holding pauses it. A holding the
 * check does not record (a check that records holdings at all) leaves the book:
 * its count is dropped, as the live counter prunes it. A RUN is the stretch
 * since the holding came into the book or since a timely move reset its count
 * (a within-age comparison that set it to 0). The rule has FIRED for a holding
 * once a check of the run records its stagnation verdict. A check tags the
 * holding `stalled` when it carries the holding's price and change, the rule
 * has not fired in the run, the count is at or above the effective threshold
 * less S1 — and at least 1, so a holding that moved at every check is never
 * stalled (S2's count when the rule is off) — and the change is below the
 * rule's winner threshold. An exit is preceded by a tag only when a tag of the
 * holding falls in the run the exit ends.
 *
 * Two parameters exist for the read-only census only (scripts/census-film-room-b1.mjs),
 * never passed by the close pass: `seed`, a per-holding starting state (the
 * census replays the live counter's overnight carry with it), and `trace`, an
 * array the walk appends one row per holding per check to. The returned
 * `closing` is the state after the last check.
 *
 * @param {{ inputs: object, checks: object[], actions: object[], seed?: object|null, trace?: object[]|null }} p
 * @returns {{ items: object[], exits: object[], closing: object }}
 */
export function tagDay({ inputs, checks, actions, seed = null, trace = null }) {
  const fr = inputs.forcedRotation;
  const S1 = inputs.slots.S1.checksBeforeRule;
  const S2 = inputs.slots.S2;
  const pctThreshold = fr.enabled ? fr.pctThreshold : S2.pctThreshold;
  const walked = tagChecks(checks);
  if (walked.length !== inputs.perCheck.length) throw new Error('tags_inputs_mismatch: perCheck does not cover the checks');
  // RC-1: the basis is the checks' own fact; stored inputs that name another are out of step (v1 inputs name none)
  const bases = holdingBasisOf(walked);
  if (inputs.holdingBasis !== undefined && !sameBasis(inputs.holdingBasis, bases)) throw new Error('tags_inputs_mismatch: holdingBasis does not match the checks');
  const state = isObj(seed) ? Object.fromEntries(Object.entries(seed).map(([sym, s]) => [sym, { ...s, fired: false }])) : {};
  const items = [];
  const resets = [];
  walked.forEach((c, i) => {
    const pc = inputs.perCheck[i];
    if (pc.at !== c.at || pc.tickSeq !== (Number.isInteger(c.tickSeq) ? c.tickSeq : null)) throw new Error('tags_inputs_mismatch: perCheck out of step with the checks');
    const held = heldAt(c);
    if (!held) return;
    for (const sym of Object.keys(state)) if (!held.includes(sym)) delete state[sym];
    // At least 1: the count must have stepped at least once (review A-1: a small dialled threshold less S1 reaches 0).
    const liveAt = fr.enabled ? Math.max(1, pc.effectiveTicksThreshold - S1) : pc.effectiveTicksThreshold;
    for (const sym of held) {
      const prev = state[sym] ?? { stagnationTicks: 0, lastTickPrice: null, lastTickTimestamp: null, fired: false };
      const ev = isObj(c.evidence) && isObj(c.evidence[sym]) ? c.evidence[sym] : null;
      const px = num(ev?.px);
      const chg = num(ev?.chg);
      // RC-1: a recorded holding reads the live rule's own record at every check — nothing recomputed;
      // a recomputed one steps the platform's counter over the price the agent was shown.
      const rec = bases[sym] === 'recorded' ? recordAt(c, sym) : null;
      const step = rec
        ? { stagnationTicks: rec.ticks, withinAge: rec.withinAge, lastTickPrice: prev.lastTickPrice, lastTickTimestamp: prev.lastTickTimestamp }
        : updateStagnationCounter({
          currentPrice: px,
          lastTickPrice: prev.lastTickPrice,
          lastTickTimestamp: prev.lastTickTimestamp,
          now: toMs(c.evidenceAt) ?? toMs(c.at),
          pctThreshold,
          maxTickAgeMinutes: fr.maxTickAgeMinutes,
          stagnationTicks: prev.stagnationTicks,
        });
      // A timely move that reset the count starts a new run: the rule has not fired in it.
      const reset = step.withinAge && step.stagnationTicks === 0;
      if (reset) resets.push({ symbol: sym, ms: toMs(c.at) });
      const fired = (prev.fired && !reset) || firedAt(c, sym);
      state[sym] = { stagnationTicks: step.stagnationTicks, lastTickPrice: step.lastTickPrice, lastTickTimestamp: step.lastTickTimestamp, fired };
      if (Array.isArray(trace)) trace.push({ symbol: sym, tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, at: c.at, px, chg, count: step.stagnationTicks, withinAge: step.withinAge, reset, fired, liveAt, winnerThreshold: fr.winnerThreshold, basis: rec ? 'recorded' : 'recomputed', dailyPct: rec ? rec.dailyPct : null });
      if (fired) continue;
      // The winner test's input: the recorded daily change, or — recomputed — the change from entry, which needs the check's price
      const winnerInput = rec ? rec.dailyPct : (px === null || chg === null ? null : chg / 100);
      if (winnerInput === null) continue;
      if (step.stagnationTicks >= liveAt && winnerInput < fr.winnerThreshold) {
        items.push({
          situationId: STALLED.id, version: STALLED.version, symbol: sym,
          tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, at: c.at,
          count: step.stagnationTicks, effectiveTicksThreshold: pc.effectiveTicksThreshold,
        });
      }
    }
  });
  const acts = rowsOf(actions);
  const exits = listExits(acts).map((x) => {
    const exitMs = toMs(x.at);
    // An exit whose instant is unreadable: unknown, never a mismatch (review A-6).
    if (exitMs === null) return { ...x, precededByTag: null };
    // The tag must fall in the RUN the exit ends: after the last swap that
    // brought the name in, and after the last reset of its count, before the exit.
    const marks = [
      ...acts.filter((a) => a.symbolIn === x.symbol && toMs(a.at) !== null && toMs(a.at) < exitMs).map((a) => toMs(a.at)),
      ...resets.filter((r) => r.symbol === x.symbol && r.ms !== null && r.ms < exitMs).map((r) => r.ms),
    ];
    const since = marks.length ? Math.max(...marks) : -Infinity;
    const precededByTag = items.some((it) => it.symbol === x.symbol && toMs(it.at) !== null && toMs(it.at) < exitMs && toMs(it.at) >= since);
    return { ...x, precededByTag };
  });
  return { items, exits, closing: state };
}

/**
 * BA-20 — the tags section's coverage: it follows the inputs `stalled` reads
 * (the checks and the evidence; RC-1: the checks' records, when a holding is
 * on the recorded basis), never the bars. Amendment D RD-5: the evidence is
 * read — its section's status counts, and `checks.evidence` is a source —
 * only when some holding of the day is on the recomputed basis (`recomputed`);
 * a recorded holding's count, age verdict and winner input are its records.
 * The checks section always counts. The failure paths, which tag nothing,
 * keep B1's list (the defaults): the checks, the evidence, the risk records
 * and the actions — the evidence even on a day whose holdings are all on the
 * recorded basis (the unresolved-inputs path returns before the bases are
 * known), and not `checks.stagnation`, as in B1.1 (review Y2-4).
 */
const MAX_DATE_MS = 8.64e15;
function tagsCoverage(doc, { failure = null, pausedChecks = 0, recorded = false, recomputed = true } = {}) {
  const span = (() => {
    const ms = tagChecks(doc?.checks).map((c) => toMs(c.at)).filter((v) => v !== null && Math.abs(v) <= MAX_DATE_MS).sort((a, b) => a - b);
    return ms.length ? { from: new Date(ms[0]).toISOString(), to: new Date(ms[ms.length - 1]).toISOString() } : null;
  })();
  const sources = ['checks', ...(recomputed ? ['checks.evidence'] : []), 'checks.risk', 'actions', ...(recorded ? ['checks.stagnation'] : [])];
  if (failure) return coverageOf('unavailable', { span, sources, note: failure });
  const reasons = [];
  for (const section of recomputed ? ['checks', 'evidence'] : ['checks']) {
    const status = doc?.coverage?.[section]?.status;
    if (status !== 'complete') reasons.push(`the ${section} section is ${status ?? 'missing'}`);
  }
  const pauses = pausedChecks
    ? [`the count pauses at ${pausedChecks} ${pausedChecks === 1 ? 'check that carries' : 'checks that carry'} no price for a held stock`]
    : [];
  if (reasons.length) return coverageOf('unavailable', { span, sources, note: [`stalled unavailable: ${reasons.join('; ')}`, ...pauses].join('; ') });
  return coverageOf('complete', { span, sources, note: pauses.join('; ') || null });
}

/**
 * Checks that record a holding without its price — where the RECOMPUTED count
 * pauses (a name sold at the check is no pause). A recorded holding is not
 * counted: its count is the live rule's own (RC-1), never this pause.
 */
function pausedCheckCount(checks, actions, holdingBasis = {}) {
  const walked = tagChecks(checks);
  return walked.filter((c, i) => unpricedHeld(c, { actions, prevAt: i ? walked[i - 1].at : null }).some((sym) => holdingBasis[sym] !== 'recorded')).length;
}

/**
 * The close pass's entry: tag the merged day. NEVER THROWS. Any failure — an
 * input that cannot be resolved, a throw anywhere in the tagger — yields the
 * section with what is known (the exits, from the action rows) and
 * `coverage.tags` unavailable with the reason or the error class.
 *
 * @param {{ battle: object, ticks?: object[], doc: object, dialEnabled?: boolean }} p
 * @returns {{ tags: object, coverage: object }}
 */
export function tagTapeDay({ battle, ticks = [], doc, dialEnabled = TEMPO_DIAL_ENABLED }) {
  let exits = null;
  try { exits = listExits(doc?.actions); } catch { exits = null; }
  try {
    const r = tagInputs({ battle, checks: doc?.checks, ticks, dialEnabled });
    if (!r.ok) {
      return {
        tags: { ...tagsHeader(), inputs: { archetypeCodeId: r.archetypeCodeId ?? null }, items: null, exits },
        coverage: tagsCoverage(doc, { failure: `stalled unavailable: ${r.reason}` }),
      };
    }
    const { items, exits: tagged } = tagDay({ inputs: r.inputs, checks: doc?.checks, actions: doc?.actions });
    return {
      tags: { ...tagsHeader(), inputs: r.inputs, items, exits: tagged },
      coverage: tagsCoverage(doc, {
        pausedChecks: pausedCheckCount(doc?.checks, doc?.actions, r.inputs.holdingBasis),
        recorded: Object.values(r.inputs.holdingBasis).includes('recorded'),
        // RD-5: a day with no recomputed holding (none held, or every one recorded) reads no evidence
        recomputed: Object.values(r.inputs.holdingBasis).includes('recomputed'),
      }),
    };
  } catch (err) {
    // B1.1 (RC-4): a class from the one fixed list, never a raw name
    const errorClass = errorClassOf(err);
    const note = `stalled unavailable: the tagger failed (${errorClass})`;
    let coverage;
    // the failure path's own coverage must not throw either (review A-5): its span is dropped first
    try { coverage = tagsCoverage(doc, { failure: note }); } catch { coverage = coverageOf('unavailable', { sources: ['checks', 'checks.evidence', 'checks.risk', 'actions'], note }); }
    return { tags: { ...tagsHeader(), inputs: null, items: null, exits }, coverage };
  }
}
