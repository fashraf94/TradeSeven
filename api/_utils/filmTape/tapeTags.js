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
// WHAT THE TAPE DOES NOT HOLD (reported, never guessed):
//   · the daily change the live rule's winner test reads
//     (`prices[sym].changePercent`, agent-evaluate.js). The tape records
//     `evidence.*.chg`, the change from the position's entry; the winner test
//     here reads it, basis `change_since_entry`.
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

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' && v ? v : null);
const rowsOf = (v) => (Array.isArray(v) ? v.filter(isObj) : []);

const STALLED = SITUATIONS.stalled;
/** The winner test's input on the tape (the live rule reads the daily change, which the tape does not hold). */
export const WINNER_BASIS = 'change_since_entry';
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

/** The dial at one check, with its basis (see the header). */
function dialAt({ desired, tick, epochLog, dialEnabled }) {
  if (desired === undefined || desired === null) return { basis: 'archetype_default', effectiveTempo: 'standard', multiplier: 1 };
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
      winnerBasis: WINNER_BASIS,
      perCheck,
    },
  };
}

/** The holdings a check records: its risk verdicts' symbols and its evidence stamp's. Null when it records neither. */
function heldAt(check) {
  const keys = [...Object.keys(isObj(check.risk) ? check.risk : {}), ...Object.keys(isObj(check.evidence) ? check.evidence : {})];
  return keys.length ? [...new Set(keys)].sort() : null;
}

/**
 * PURE — the day's `stalled` items and every recorded stagnation exit, from
 * the stored inputs, checks and actions alone.
 *
 * Per holding, in check order: the count steps through updateStagnationCounter
 * over `evidence[sym].px` at the check's evidence instant (`evidenceAt`, else
 * its `at`); a check with no price for the holding pauses it. A holding the
 * check does not record (a check that records holdings at all) leaves the book:
 * its count is dropped, as the live counter prunes it. The rule has FIRED for
 * a holding once a check records its stagnation verdict, until it leaves.
 * A check tags the holding `stalled` when it carries the holding's price and
 * change, the rule has not fired, the count is at or above the effective
 * threshold less S1 (S2's count when the rule is off), and the change is below
 * the rule's winner threshold.
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
  const state = isObj(seed) ? Object.fromEntries(Object.entries(seed).map(([sym, s]) => [sym, { ...s, fired: false }])) : {};
  const items = [];
  walked.forEach((c, i) => {
    const pc = inputs.perCheck[i];
    if (pc.at !== c.at || pc.tickSeq !== (Number.isInteger(c.tickSeq) ? c.tickSeq : null)) throw new Error('tags_inputs_mismatch: perCheck out of step with the checks');
    const held = heldAt(c);
    if (!held) return;
    for (const sym of Object.keys(state)) if (!held.includes(sym)) delete state[sym];
    const liveAt = fr.enabled ? pc.effectiveTicksThreshold - S1 : pc.effectiveTicksThreshold;
    for (const sym of held) {
      const prev = state[sym] ?? { stagnationTicks: 0, lastTickPrice: null, lastTickTimestamp: null, fired: false };
      const ev = isObj(c.evidence) && isObj(c.evidence[sym]) ? c.evidence[sym] : null;
      const px = num(ev?.px);
      const chg = num(ev?.chg);
      const step = updateStagnationCounter({
        currentPrice: px,
        lastTickPrice: prev.lastTickPrice,
        lastTickTimestamp: prev.lastTickTimestamp,
        now: toMs(c.evidenceAt) ?? toMs(c.at),
        pctThreshold,
        maxTickAgeMinutes: fr.maxTickAgeMinutes,
        stagnationTicks: prev.stagnationTicks,
      });
      const fired = prev.fired || (isObj(c.risk) && c.risk[sym]?.reason === STAGNATION_EXIT_REASON);
      state[sym] = { stagnationTicks: step.stagnationTicks, lastTickPrice: step.lastTickPrice, lastTickTimestamp: step.lastTickTimestamp, fired };
      if (Array.isArray(trace)) trace.push({ symbol: sym, tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, at: c.at, px, chg, count: step.stagnationTicks, withinAge: step.withinAge, fired, liveAt, winnerThreshold: fr.winnerThreshold });
      if (px === null || chg === null || fired) continue;
      if (step.stagnationTicks >= liveAt && chg / 100 < fr.winnerThreshold) {
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
    // The tag must fall inside the holding's stint that the exit ends: after
    // the last swap that brought the name in before the exit, if any.
    const entries = acts.filter((a) => a.symbolIn === x.symbol && toMs(a.at) !== null && exitMs !== null && toMs(a.at) < exitMs).map((a) => toMs(a.at));
    const since = entries.length ? Math.max(...entries) : -Infinity;
    const precededByTag = exitMs !== null && items.some((it) => it.symbol === x.symbol && toMs(it.at) !== null && toMs(it.at) < exitMs && toMs(it.at) > since);
    return { ...x, precededByTag };
  });
  return { items, exits, closing: state };
}

/** BA-20 — the tags section's coverage: it follows the inputs `stalled` reads (the checks and the evidence), never the bars. */
function tagsCoverage(doc, { failure = null, pausedChecks = 0 } = {}) {
  const span = (() => {
    const ms = tagChecks(doc?.checks).map((c) => toMs(c.at)).filter((v) => v !== null).sort((a, b) => a - b);
    return ms.length ? { from: new Date(ms[0]).toISOString(), to: new Date(ms[ms.length - 1]).toISOString() } : null;
  })();
  const sources = ['checks', 'checks.evidence', 'checks.risk', 'actions'];
  if (failure) return coverageOf('unavailable', { span, sources, note: failure });
  const reasons = [];
  for (const section of ['checks', 'evidence']) {
    const status = doc?.coverage?.[section]?.status;
    if (status !== 'complete') reasons.push(`the ${section} section is ${status ?? 'missing'}`);
  }
  const pauses = pausedChecks
    ? [`the count pauses at ${pausedChecks} ${pausedChecks === 1 ? 'check that carries' : 'checks that carry'} no price for a held stock`]
    : [];
  if (reasons.length) return coverageOf('unavailable', { span, sources, note: [`stalled unavailable: ${reasons.join('; ')}`, ...pauses].join('; ') });
  return coverageOf('complete', { span, sources, note: pauses.join('; ') || null });
}

/** Checks that record a holding without its price — where the count pauses. */
function pausedCheckCount(checks) {
  return tagChecks(checks).filter((c) => {
    const held = heldAt(c);
    return held && held.some((sym) => num(c.evidence?.[sym]?.px) === null);
  }).length;
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
      coverage: tagsCoverage(doc, { pausedChecks: pausedCheckCount(doc?.checks) }),
    };
  } catch (err) {
    const errorClass = str(err?.name) ?? str(err?.constructor?.name) ?? 'Error';
    return {
      tags: { ...tagsHeader(), inputs: null, items: null, exits },
      coverage: tagsCoverage(doc, { failure: `stalled unavailable: the tagger failed (${errorClass})` }),
    };
  }
}
