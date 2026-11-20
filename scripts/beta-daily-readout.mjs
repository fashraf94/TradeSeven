// scripts/beta-daily-readout.mjs
//
// THE BETA DAILY READOUT (build prompt BUILD_PROMPT_COCKPIT_STAGED_SWITCH_ON_NOV20_2026, Part B; report
// docs/audits/20261120_COCKPIT_STAGED_SWITCH_ON.md). One ET session, one block in plain words the founder can
// read in a minute, ending in the PAUSE lines: may more players be invited tomorrow?
//
//   Players and battles   distinct owners with an agent-mode battle (a count), battles, peak battles in one run
//   Model cost            model checks, cost per check, cost per battle-day, the evaluator's total, `on` / `off`
//   Evaluator             runs that deferred or budget-skipped a battle, the largest wall time, K and max in flight
//   Anthropic limits      the limits the API reported, the lowest remaining, 429s
//   EODHD                 the evaluator's requests (run records) and the intraday poller's units (intradayBudget)
//   Cockpit               the release switch (cockpitConfig/release, read now), cohort battles, the answer chain,
//                         the readiness report's §C3 trips
//   Rules                 each rule below as ok / PAUSE / STOP, or CHECK (a human should read it) / no data
//
// It is built on the two reads that already exist and does not copy them: `gather` + `renderLimits`
// (scripts/eval-capacity-read.mjs) and `gatherStage` + `renderStage` (scripts/cockpit-release-read.mjs). --detail
// prints their tables under the block.
//
// --switch is the release switch's VERIFICATION READ (the build prompt's Part E), run each time the founder changes
// the control document: the document as release.js parses it, and today's and upcoming battles sorted by whether
// release.js's own cohort test admits them, with the reason when it does not.
//
// IT NEVER NEEDS A UID AND PRINTS NO ID. Owner ids are read (field-masked) only to count distinct owners and to put
// a battle through the cohort test, in memory; no owner, agent or battle id reaches the output or --json.
//
// READ-ONLY BY CONSTRUCTION. Firestore Admin SDK `.get()` / `getAll()` only — no set, update, delete, create,
// transaction, batch or bulk writer (beta-daily-readout.test.js greps this file). No external API call. The only
// file written is --json's path.
//
// USAGE (repo root; the Firebase Admin env vars in the shell or in .env.local / .env at the repo root):
//   node scripts/beta-daily-readout.mjs [--session YYYY-MM-DD] [--detail] [--json <out.json>]
//   node scripts/beta-daily-readout.mjs --switch [--json <out.json>]
//   Default session: the latest NYSE session whose close was at least an hour ago (the evaluator's last run of a
//   regular day starts 45 minutes after the close), from the repo's own market calendar (src/utils/marketCalendar.js):
//   weekends and holidays are skipped, and an early close counts from its 1 PM close.
//
// The tallies are pure exported functions (beta-daily-readout.test.js); Firestore, the env loader, the allowlist and
// the sweep are imported lazily inside main().

import { gather, renderLimits, etDay, toMs } from './eval-capacity-read.mjs';
import { gatherStage, renderStage, HAIKU_PRICE_PER_MTOK } from './cockpit-release-read.mjs';
import { getSessionForDate, getPreviousSessionDate } from '../src/utils/marketCalendar.js';
import { parseReleaseDocument, isInReleaseCohort, RELEASE_COLLECTION, RELEASE_DOC, RELEASE_COHORT_GAME_MODE } from '../api/_utils/callRecords/release.js';
import { isCpuUserId } from '../src/constants/leagueTournament.js';

// ---------------------------------------------------------------- the founder's thresholds (build prompt §3)

/** PAUSE adding players when the session's mean evaluator cost per battle-day is above this (measured plan ≈ $0.49). */
export const PAUSE_COST_PER_BATTLE_DAY_USD = 0.65;
/** PAUSE when the evaluator's cost per model check is above this (measured ≈ $0.025). */
export const PAUSE_COST_PER_CHECK_USD = 0.032;
/** PAUSE when the lowest input tokens left in any minute falls below this share of the input-token limit. */
export const PAUSE_ANTHROPIC_INPUT_LEFT_SHARE = 0.2;
/** PAUSE when the evaluator's EODHD units plus the intraday poller's units exceed this in one session. */
export const PAUSE_EODHD_UNITS = 60_000;
/** An EODHD intraday request bills 5 units; an end-of-day or real-time request bills 1. */
export const EODHD_INTRADAY_UNITS = 5;
/**
 * STOP when a call the sweep settled was stamped more than this after its deadline. Not set by the readiness report
 * (§C3 names "sweep lag" with no number) nor by sweep.js: chosen here as two of the sweep's 15-minute slots
 * (process-pending-reflections, `*15 13-1 UTC`) — one slot is the ordinary worst case for a deadline that falls just
 * after a run, the second covers one late or short run. A founder question in the report; measured lag is ≈ 0.7 min.
 */
export const STOP_SWEEP_LAG_MS = 30 * 60_000;
/** The default session is the latest one whose close was at least this long ago. */
export const READ_AFTER_CLOSE_MS = 60 * 60_000;
/** The switch read's known-owner window: the agent-mode owners of this many sessions back. */
export const SWITCH_KNOWN_SESSIONS = 10;

const FAILURES = ['timeout', 'e400', 'invalid'];
const FAILURE_WORDS = { timeout: 'timeouts', e400: '400s', invalid: 'invalid_tool_result' };
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------- the session

/**
 * The default session: the latest NYSE session (marketCalendar.js) whose close was at least READ_AFTER_CLOSE_MS
 * before `nowMs`. Today counts once that much time has passed since its close; weekends and holidays are skipped.
 * Throws outside the calendar's maintained years (it never guesses).
 */
export function defaultSession(nowMs) {
  const today = etDay(nowMs);
  const s = getSessionForDate(today);
  if (!s) throw new Error(`the market calendar does not cover ${today}`);
  if (s.isTradingDay && nowMs >= s.closeMs + READ_AFTER_CLOSE_MS) return today;
  const prev = getPreviousSessionDate(today);
  if (!prev) throw new Error(`the market calendar does not cover the session before ${today}`);
  return prev;
}

/** A --session argument checked against the calendar: a YYYY-MM-DD that is a trading session, else an Error. */
export function checkSession(day) {
  const s = getSessionForDate(day);
  if (!s) throw new Error(`--session ${day}: not a date the market calendar covers (YYYY-MM-DD, 2026–2027)`);
  if (!s.isTradingDay) throw new Error(`--session ${day}: the market was closed that day`);
  return day;
}

/** Is this battle a real player's agent-mode battle (not a CPU seat, a non-empty owner)? Pure. */
export function isAgentReal(b) {
  return b?.gameMode === RELEASE_COHORT_GAME_MODE && b?.isCpu !== true && typeof b?.ownerId === 'string' && b.ownerId.length > 0 && !isCpuUserId(b.ownerId);
}

/** The session's agent-mode battles: a count and the count of distinct owners. The ids stay in this function. Pure. */
export function playersRead(battles, session) {
  const own = (Array.isArray(battles) ? battles : []).filter((b) => etDay(toMs(b?.expiresAt)) === session && isAgentReal(b));
  return { agentBattles: own.length, owners: new Set(own.map((b) => b.ownerId)).size };
}

// ---------------------------------------------------------------- the summary (pure)

const usdOf = (input, output) => (input / 1e6) * HAIKU_PRICE_PER_MTOK.input + (output / 1e6) * HAIKU_PRICE_PER_MTOK.output;
/** A dist's sum, back from its mean and n (the capacity read keeps no raw list); tokens are integers. */
const sumOfDist = (d) => (d && d.n > 0 && finite(d.mean) ? Math.round(d.mean * d.n) : 0);

/**
 * The block's numbers, from the two reads for ONE session. Pure. `capacity` is eval-capacity-read's gather() over
 * [session]; `stage` cockpit-release-read's gatherStage() over [session]; `players` playersRead(); `control` the
 * switch as read now ({ view, disabled }).
 */
export function summarize({ session, capacity, stage, players, control }) {
  const runDay = capacity.runs.perDay.find((d) => d.day === session) || null;
  const lim = capacity.limits.perDay.find((d) => d.day === session) || null;
  const bud = capacity.budget.perDay.find((d) => d.day === session) || null;
  const tr = capacity.ticks.tickRecords;
  const inputTokens = sumOfDist(tr.inputTokens);
  const outputTokens = sumOfDist(tr.outputTokens);
  const modelChecks = tr.dispatched;
  const totalUsd = usdOf(inputTokens, outputTokens);
  const battleDays = tr.perBattleDay.battleDays;
  const checks = stage.checks.find((c) => c.day === session);
  const onCost = stage.cost.find((c) => c.day === session);
  const cohortDay = stage.cohort.perDay.find((c) => c.day === session) || null;
  const answers = stage.answers.find((a) => a.day === session);
  const sweep = stage.sweep.perDay.find((s) => s.day === session);
  const req = lim ? lim.eodhdByEndpoint : null;
  const evaluatorUnits = lim && lim.runs > 0 ? req.eod + req.realTime + EODHD_INTRADAY_UNITS * req.intraday : null;
  const pollerUnits = bud && finite(bud.unitsRequested) ? bud.unitsRequested : null;
  return {
    session,
    players: { owners: players.owners, agentBattles: players.agentBattles, peakBattlesInRun: runDay ? runDay.maxBattles : 0 },
    cost: {
      modelChecks, inputTokens, outputTokens, totalUsd, battleDays,
      perCheckUsd: modelChecks > 0 ? totalUsd / modelChecks : null,
      perBattleDayUsd: battleDays > 0 ? totalUsd / battleDays : null,
      on: { checks: checks.on.n, usd: onCost.modelUsd },
      // Everything not `on` (an `off` check, or a pre-Oct-5 `shadow` one). The capacity read's battle window holds the
      // stage read's, so total ≥ `on`; the floor only absorbs rounding.
      off: { checks: Math.max(0, modelChecks - checks.on.n), usd: Math.max(0, totalUsd - onCost.modelUsd) },
    },
    evaluator: {
      runs: runDay ? runDay.runs : 0,
      deferredRuns: runDay ? runDay.deferredRuns : 0,
      budgetSkippedRuns: runDay ? runDay.budgetSkippedRuns : 0,
      maxWallMs: runDay ? runDay.maxWallMs : null,
      kSeen: lim ? lim.kSeen : [],
      maxInFlight: lim ? lim.maxInFlight : null,
    },
    anthropic: {
      runsWithBlocks: lim ? lim.runs : 0,
      requestsLimit: lim ? lim.requestsLimit : null, inputTokensLimit: lim ? lim.inputTokensLimit : null, outputTokensLimit: lim ? lim.outputTokensLimit : null,
      minRequestsRemaining: lim ? lim.minRequestsRemaining : null, minInputTokensRemaining: lim ? lim.minInputTokensRemaining : null, minOutputTokensRemaining: lim ? lim.minOutputTokensRemaining : null,
      responses429: lim ? lim.responses429 : 0,
    },
    eodhd: {
      requests: req ? { ...req } : null,
      evaluatorUnits, pollerUnits,
      totalUnits: evaluatorUnits !== null && pollerUnits !== null ? evaluatorUnits + pollerUnits : null,
    },
    cockpit: {
      control: { status: control.view.status, active: control.view.active, shareBp: control.view.status === 'absent' ? null : control.view.shareBp, disabled: control.disabled },
      cohortBattles: cohortDay ? cohortDay.cohortBattles : null,
      cohortBasis: stage.cohort.basis,
      answers: { commands: answers.commands, acknowledgments: answers.acknowledgments, heard: answers.heard, acted: answers.acted, noMatchingTrade: answers.noMatchingTrade },
      on: checks.on, cohort: checks.cohort, off: checks.off,
      flags: checks.flags, cohortFlags: checks.cohortFlags,
      sweep: { swept: sweep.swept, endedWithBattle: sweep.endedWithBattle, medianMs: sweep.medianMs, maxMs: sweep.maxMs },
      overdueQueueRows: stage.sweep.overdueQueueRows,
    },
  };
}

// ---------------------------------------------------------------- the rules (pure)

const money = (v) => (finite(v) ? `$${v.toFixed(v > 0 && v < 0.1 ? 4 : 2)}` : '—');
const int = (v) => (finite(v) ? Math.round(v).toLocaleString('en-US') : '—');
const minutes = (ms) => (finite(ms) ? `${(ms / 60_000).toFixed(1)} min` : '—');

/**
 * Each rule of the build prompt's table, evaluated. Pure. A rule reads `no data` when the session holds nothing it can
 * judge (never `ok` by default: a NaN or a null compared to a threshold is never allowed to pass silently), and the
 * cockpit rule reads CHECK when an `on` failure has no `off` check that session to be compared with.
 * @returns {{ key: string, label: string, status: 'ok'|'PAUSE'|'STOP'|'CHECK'|'no data', reason: string }[]}
 */
export function evaluateRules(s) {
  const rules = [];
  const push = (key, label, status, reason) => rules.push({ key, label, status, reason });

  // 1. Cost per battle-day (session mean).
  const pbd = s.cost.perBattleDayUsd;
  if (!(s.cost.battleDays > 0) || !finite(pbd)) push('costPerBattleDay', 'Cost per battle-day', 'no data', 'no battle was checked this session');
  else if (pbd > PAUSE_COST_PER_BATTLE_DAY_USD) push('costPerBattleDay', 'Cost per battle-day', 'PAUSE', `${money(pbd)} is above ${money(PAUSE_COST_PER_BATTLE_DAY_USD)} — don't add players`);
  else push('costPerBattleDay', 'Cost per battle-day', 'ok', `${money(pbd)}; pauses above ${money(PAUSE_COST_PER_BATTLE_DAY_USD)}`);

  // 2. Cost per model check.
  const pc = s.cost.perCheckUsd;
  if (!(s.cost.modelChecks > 0) || !finite(pc)) push('costPerCheck', 'Cost per model check', 'no data', 'no model check this session');
  else if (pc > PAUSE_COST_PER_CHECK_USD) push('costPerCheck', 'Cost per model check', 'PAUSE', `${money(pc)} is above ${money(PAUSE_COST_PER_CHECK_USD)} — don't add players`);
  else push('costPerCheck', 'Cost per model check', 'ok', `${money(pc)}; pauses above ${money(PAUSE_COST_PER_CHECK_USD)}`);

  // 3. Evaluator capacity.
  const ev = s.evaluator;
  if (!(ev.runs > 0)) push('evaluator', 'Evaluator capacity', 'no data', 'no evaluator run record for this session');
  else if (ev.deferredRuns > 0 || ev.budgetSkippedRuns > 0) push('evaluator', 'Evaluator capacity', 'PAUSE', `${ev.deferredRuns} run(s) deferred a battle and ${ev.budgetSkippedRuns} budget-skipped one — don't add players until K is raised`);
  else push('evaluator', 'Evaluator capacity', 'ok', `no run deferred or budget-skipped a battle, over ${ev.runs} runs`);

  // 4. Anthropic.
  const an = s.anthropic;
  const inLimit = an.inputTokensLimit; const inLeft = an.minInputTokensRemaining;
  const measured = finite(inLimit) && inLimit > 0 && finite(inLeft);
  if (an.responses429 > 0) push('anthropic', 'Anthropic', 'PAUSE', `${an.responses429} response(s) were 429 (rate limited) — don't add players`);
  else if (measured && inLeft < PAUSE_ANTHROPIC_INPUT_LEFT_SHARE * inLimit) push('anthropic', 'Anthropic', 'PAUSE', `the lowest input tokens left was ${int(inLeft)}, under ${Math.round(100 * PAUSE_ANTHROPIC_INPUT_LEFT_SHARE)} % of the ${int(inLimit)} limit — don't add players`);
  else if (!measured) push('anthropic', 'Anthropic', 'no data', 'no model call reported the limits this session');
  else push('anthropic', 'Anthropic', 'ok', `no 429; the lowest input tokens left was ${(100 * inLeft / inLimit).toFixed(1)} % of the limit`);

  // 5. EODHD (records): the evaluator's units + the poller's units. A missing part is a gap, never a zero — but a known
  // part above the line already pauses.
  const eo = s.eodhd;
  const known = (eo.evaluatorUnits ?? 0) + (eo.pollerUnits ?? 0);
  const gaps = [eo.evaluatorUnits === null ? 'no evaluator run record carries the EODHD counts' : null, eo.pollerUnits === null ? 'no poller ledger (intradayBudget) for the session' : null].filter(Boolean);
  if (known > PAUSE_EODHD_UNITS) push('eodhd', 'EODHD (records)', 'PAUSE', `${int(known)} units${gaps.length ? ' (known so far)' : ''} is above ${int(PAUSE_EODHD_UNITS)} — don't add players, and check the EODHD dashboard`);
  else if (gaps.length) push('eodhd', 'EODHD (records)', 'no data', gaps.join('; '));
  else push('eodhd', 'EODHD (records)', 'ok', `${int(known)} units; pauses above ${int(PAUSE_EODHD_UNITS)} — the fixed jobs and browser polling come on top`);

  // 6. Cockpit health — the off switch, not a cost rule.
  const ck = s.cockpit;
  const above = (flags) => FAILURES.filter((k) => flags?.[k] === 'ABOVE');
  const unbased = (flags) => FAILURES.filter((k) => flags?.[k] === 'no baseline');
  const trips = [];
  const allAbove = [...new Set([...above(ck.flags), ...above(ck.cohortFlags)])];
  if (allAbove.length) trips.push(`\`on\` ${allAbove.map((k) => FAILURE_WORDS[k]).join(', ')} above the session's \`off\` baseline`);
  if (finite(ck.sweep.maxMs) && ck.sweep.maxMs > STOP_SWEEP_LAG_MS) trips.push(`sweep lag ${minutes(ck.sweep.maxMs)}, past its ${minutes(STOP_SWEEP_LAG_MS)} bound`);
  const noBase = [...new Set([...unbased(ck.flags), ...unbased(ck.cohortFlags)])];
  if (trips.length) push('cockpit', 'Cockpit health', 'STOP', `set disabled: true — ${trips.join('; ')}`);
  else if (noBase.length) push('cockpit', 'Cockpit health', 'CHECK', `no \`off\` check this session to compare with — ${noBase.map((k) => `${ck.on[k]} ${FAILURE_WORDS[k]}`).join(', ')} in ${ck.on.n} \`on\` checks; read them (nothing is paused)`);
  else if (!(ck.on.n > 0) && !(ck.sweep.swept > 0)) push('cockpit', 'Cockpit health', 'no data', 'no `on` check and no swept call this session');
  else push('cockpit', 'Cockpit health', 'ok', `no §C3 trip: ${ck.on.n} \`on\` checks, sweep lag max ${minutes(ck.sweep.maxMs)}`);

  return rules;
}

/** The day's one word: STOP over PAUSE over CHECK over ok; `no data` only when no rule could judge anything. Pure. */
export function verdictOf(rules) {
  const has = (st) => rules.some((r) => r.status === st);
  if (has('STOP')) return 'STOP';
  if (has('PAUSE')) return 'PAUSE';
  if (has('CHECK')) return 'CHECK';
  if (rules.every((r) => r.status === 'no data')) return 'no data';
  return 'ok';
}

const VERDICT_WORDS = {
  STOP: 'STOP — set `disabled: true` in cockpitConfig/release now (save this readout first).',
  PAUSE: "PAUSE — don't invite more players while any line reads PAUSE.",
  CHECK: 'CHECK — nothing is paused, but a line needs a read before you invite more players.',
  'no data': 'no data — the session holds nothing to judge (no battle was checked).',
  ok: 'ok — every line is ok or has no data; you may invite more players.',
};

// ---------------------------------------------------------------- the block (pure)

const etClock = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
const weekday = (day) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(new Date(`${day}T12:00:00Z`));
const pct = (n, d) => (finite(n) && finite(d) && d > 0 ? `${((100 * n) / d).toFixed(1)} %` : '—');

/** The readout as Markdown: the block, then (with `detail`) the two reads' own tables. Pure. */
export function renderReadout(read, { detail = false } = {}) {
  const s = read.summary;
  const L = [];
  L.push(`## Beta daily readout — ${weekday(s.session)} ${s.session} (ET)`, '');
  L.push(`Read ${etClock(read.readAtMs)} ET · read-only · no id is printed.`, '');
  L.push(`**${VERDICT_WORDS[read.verdict]}**`, '');
  L.push('**Players and battles**');
  L.push(`- Players with an agent-mode battle: ${s.players.owners}`);
  L.push(`- Agent-mode battles: ${s.players.agentBattles}`);
  L.push(`- Peak battles in one evaluator run: ${s.players.peakBattlesInRun}`, '');
  const c = s.cost;
  L.push(`**Model cost** (Haiku 4.5 list price, $${HAIKU_PRICE_PER_MTOK.input} / $${HAIKU_PRICE_PER_MTOK.output} per million tokens, on measured tokens)`);
  L.push(`- Model checks: ${c.modelChecks}`);
  L.push(`- Cost per model check: ${money(c.perCheckUsd)}`);
  L.push(`- Cost per battle-day: ${money(c.perBattleDayUsd)} (${c.battleDays} battle-day${c.battleDays === 1 ? '' : 's'})`);
  L.push(`- The evaluator's total for the session: ${money(c.totalUsd)} (${int(c.inputTokens)} input, ${int(c.outputTokens)} output tokens)`);
  L.push(`- Cockpit split: \`on\` ${c.on.checks} checks, ${money(c.on.usd)} · \`off\` ${c.off.checks} checks, ${money(c.off.usd)}`);
  L.push("- This is the evaluator only. The Anthropic Console's usage page holds the account-wide total (Huddle, reflections and chat included).", '');
  const ev = s.evaluator;
  L.push('**Evaluator**');
  L.push(`- Runs: ${ev.runs} · with a deferred battle: ${ev.deferredRuns} · with a budget-skipped battle: ${ev.budgetSkippedRuns}`);
  L.push(`- Longest run: ${finite(ev.maxWallMs) ? `${(ev.maxWallMs / 1000).toFixed(1)} s` : '—'}`);
  L.push(`- Pool: K = ${ev.kSeen.length ? ev.kSeen.join(', ') : '—'}, at most ${ev.maxInFlight ?? '—'} battle(s) in flight`, '');
  const an = s.anthropic;
  L.push('**Anthropic limits** (per minute, as the API reported them on the evaluator\'s calls)');
  if (an.runsWithBlocks > 0 && finite(an.inputTokensLimit)) {
    L.push(`- Limits: ${int(an.requestsLimit)} requests · ${int(an.inputTokensLimit)} input tokens · ${int(an.outputTokensLimit)} output tokens`);
    L.push(`- Lowest left: ${int(an.minRequestsRemaining)} requests · ${int(an.minInputTokensRemaining)} input tokens (${pct(an.minInputTokensRemaining, an.inputTokensLimit)}) · ${int(an.minOutputTokensRemaining)} output tokens`);
  } else L.push('- No model call reported the limits this session.');
  L.push(`- 429s: ${an.responses429}`, '');
  const eo = s.eodhd;
  L.push('**EODHD** (units: an intraday request bills 5, the others 1)');
  if (eo.requests && eo.evaluatorUnits !== null) L.push(`- Evaluator: ${int(eo.evaluatorUnits)} units (${int(eo.requests.eod)} end-of-day, ${int(eo.requests.realTime)} real-time, ${int(eo.requests.intraday)} intraday${eo.requests.other ? `, ${int(eo.requests.other)} other, not counted` : ''} requests)`);
  else L.push('- Evaluator: no run record carries the counts.');
  L.push(`- Intraday poller: ${eo.pollerUnits !== null ? `${int(eo.pollerUnits)} units` : 'no ledger for the session'}`);
  L.push(`- Together: ${eo.totalUnits !== null ? `${int(eo.totalUnits)} units` : '—'}. The app-wide total is on the EODHD dashboard: browser polling and the fixed jobs (about 10,000 a day) are not in these records.`, '');
  const ck = s.cockpit;
  L.push('**Cockpit**');
  L.push(`- Switch (cockpitConfig/release, as read now): ${ck.control.status}${ck.control.status === 'absent' ? ' — the two pilot accounts only' : ` · shareBp ${ck.control.shareBp ?? '—'} · disabled ${ck.control.disabled ?? '—'}`}`);
  L.push(`- Cohort battles: ${ck.cohortBattles ?? '—'} (${ck.cohortBasis})`);
  L.push(`- Answers: ${ck.answers.commands} commands · ${ck.answers.acknowledgments} acknowledgments · ${ck.answers.heard} heard · ${ck.answers.acted} acted`);
  L.push(`- \`on\` checks: ${ck.on.n} (${ck.on.timeout} timeouts · ${ck.on.e400} 400s · ${ck.on.invalid} invalid_tool_result · ${ck.on.other} other) · \`off\` checks: ${ck.off.n}`);
  L.push(`- Sweep: ${ck.sweep.swept} calls settled, lag max ${minutes(ck.sweep.maxMs)} · queue rows overdue now: ${ck.overdueQueueRows}`, '');
  L.push('**Rules**');
  for (const r of read.rules) L.push(`- ${r.label}: ${r.status === 'ok' || r.status === 'no data' ? `${r.status} (${r.reason})` : `${r.status}: ${r.reason}`}`);
  L.push('');
  if (detail) {
    L.push('---', '', '### Detail (the two reads the block is built from)', '');
    L.push(renderStage(read.stage), '');
    L.push(...renderLimits(read.capacity.limits));
  }
  return L.join('\n');
}

// ---------------------------------------------------------------- the switch verification read (pure parts)

/**
 * Sort battles by what the cohort test does with them. Pure; returns counts only. `live` battles are today's and
 * upcoming ones (by the ET date of expiresAt) plus any still marked active; `known` owners are every agent-mode
 * owner in the window, put through the bucket test alone.
 */
export function switchRead({ battles, view, allowlist, nowMs, isInCohort = isInReleaseCohort }) {
  const today = etDay(nowMs);
  const allow = allowlist instanceof Set ? allowlist : new Set(allowlist || []);
  const out = { live: 0, inCohort: 0, inCohortAllowlisted: 0, viaAllowlistOnly: 0, reasons: { notActive: 0, league: 0, cpu: 0, otherMode: 0, switchOff: 0, overShare: 0 }, agentRealActive: 0 };
  const knownOwners = new Set();
  for (const b of Array.isArray(battles) ? battles : []) {
    if (isAgentReal(b)) knownOwners.add(b.ownerId);
    const day = etDay(toMs(b?.expiresAt));
    const live = b?.status === 'active' || (day !== null && day >= today);
    if (!live) continue;
    out.live += 1;
    const cpu = b?.isCpu === true || isCpuUserId(b?.ownerId);
    const allowlisted = !cpu && typeof b?.ownerId === 'string' && allow.has(b.ownerId);
    if (b?.status !== 'active') { out.reasons.notActive += 1; continue; }
    const inCohort = isInCohort(b, view) === true;
    if (inCohort) { out.inCohort += 1; out.agentRealActive += 1; if (allowlisted) out.inCohortAllowlisted += 1; continue; }
    if (allowlisted) out.viaAllowlistOnly += 1;
    if (cpu) out.reasons.cpu += 1;
    else if (b?.gameMode === 'baggerbomb_tournament') out.reasons.league += 1;
    else if (b?.gameMode !== RELEASE_COHORT_GAME_MODE) out.reasons.otherMode += 1;
    else if (!isAgentReal(b)) out.reasons.otherMode += 1; // an agent-mode battle with no usable owner: never admitted
    else { out.agentRealActive += 1; if (view?.active === true) out.reasons.overShare += 1; else out.reasons.switchOff += 1; }
  }
  // The server's own test on a stand-in agent-mode battle of each known owner (the owner's bucket against the share).
  const knownIn = [...knownOwners].filter((o) => isInCohort({ gameMode: RELEASE_COHORT_GAME_MODE, isCpu: false, ownerId: o }, view) === true).length;
  let expected;
  if (view?.active !== true) expected = { cohort: 0, why: `the switch is not active (${view?.status ?? 'unread'}): no battle is in the cohort` };
  else if (view.shareBp === 0) expected = { cohort: 0, why: 'shareBp 0: no battle is in the cohort' };
  else if (view.shareBp === 10_000) expected = { cohort: out.agentRealActive, why: 'shareBp 10000: every active agent-mode, non-CPU battle is in the cohort' };
  else expected = { cohort: null, why: `shareBp ${view.shareBp}: a partial share has no fixed expectation` };
  const knownExpected = view?.active !== true || view.shareBp === 0 ? 0 : (view.shareBp === 10_000 ? knownOwners.size : null);
  return {
    ...out,
    knownOwners: knownOwners.size, knownOwnersIn: knownIn, knownExpected,
    expected,
    nothingToTest: out.agentRealActive === 0,
    asExpected: expected.cohort === null ? null : out.inCohort === expected.cohort && (knownExpected === null || knownIn === knownExpected),
  };
}

/** The switch read as Markdown. Pure. */
export function renderSwitch(read) {
  const r = read.result;
  const v = read.control.view;
  const L = [];
  L.push(`### Switch verification read — ${etClock(read.readAtMs)} ET`, '');
  L.push(`- Control document cockpitConfig/release (parsed by release.js): status **${v.status}** · active ${v.active} · shareBp ${v.status === 'absent' ? '—' : v.shareBp} · disabled ${read.control.disabled ?? '—'}`);
  L.push(`- Battles read: ${read.battlesRead} (expiresAt ${read.window.from} → ${read.window.to}); today's and upcoming, or still active: ${r.live}`);
  L.push(`- In the cohort: **${r.inCohort}**${r.inCohortAllowlisted ? ` (${r.inCohortAllowlisted} of them also allowlisted)` : ''}`);
  L.push(`- Out of the cohort: League ${r.reasons.league} · CPU ${r.reasons.cpu} · other mode ${r.reasons.otherMode} · not active ${r.reasons.notActive} · switch not active ${r.reasons.switchOff} · over the share ${r.reasons.overShare}`);
  L.push(`- \`on\` through the allowlist only (not in the cohort): ${r.viaAllowlistOnly}`);
  L.push(`- Known owners (agent-mode battles from ${read.window.knownFrom} on): ${r.knownOwners} — ${r.knownOwnersIn} would be in the cohort now${r.knownExpected === null ? '' : ` (expected ${r.knownExpected})`}`);
  L.push(`- Expected: ${r.expected.why}${r.expected.cohort === null ? '' : ` → ${r.expected.cohort}`}.`);
  let verdict;
  if (r.asExpected === null) verdict = 'no fixed expectation at this share';
  else if (!r.asExpected) verdict = '**NOT AS EXPECTED** — stop here and read it before the next step';
  else if (r.nothingToTest) verdict = `as expected, but there is no active agent-mode battle to test yet${r.knownOwners ? ' (the known-owner line is the check)' : ''}`;
  else verdict = '**as expected**';
  L.push(`- Result: ${verdict}.`, '');
  return L.join('\n');
}

// ---------------------------------------------------------------- the reads (`.get()` / `getAll()` only)

/** One `.get()` of the control document, parsed by release.js. `disabled` is the raw boolean when there is one. */
export async function readControl(db, nowMs) {
  const snap = await db.collection(RELEASE_COLLECTION).doc(RELEASE_DOC).get();
  const data = snap && snap.exists ? snap.data() : null;
  return { view: parseReleaseDocument(data, nowMs), disabled: data && typeof data.disabled === 'boolean' ? data.disabled : null };
}

/** The battles whose expiresAt falls in [fromIso, toIso], field-masked to what the cohort test reads. */
async function maskedBattles(db, fromIso, toIso) {
  return (await db.collection('agentBattles').where('expiresAt', '>=', fromIso).where('expiresAt', '<=', toIso)
    .select('ownerId', 'gameMode', 'isCpu', 'status', 'expiresAt').get()).docs.map((d) => d.data());
}

/**
 * Everything the readout reads, and the block over it. Exported so a fake handle can drive it. `deadlineOf` is the
 * sweep's own call deadline and `isInCohort` the server's own membership test (main() passes both).
 */
export async function gatherReadout(db, { session, readAtMs, allowlistList = [], deadlineOf, isInCohort = isInReleaseCohort }) {
  const control = await readControl(db, readAtMs);
  const days = [session];
  const capacity = await gather(db, { days, readAtMs });
  const stage = await gatherStage(db, { days, readAtMs, control: control.view, allowlistList, deadlineOf, isInCohort });
  const floorIso = new Date(Date.parse(`${session}T00:00:00Z`) - 86_400_000).toISOString();
  const ceilIso = new Date(Date.parse(`${session}T00:00:00Z`) + 2 * 86_400_000).toISOString();
  const players = playersRead(await maskedBattles(db, floorIso, ceilIso), session);
  const summary = summarize({ session, capacity, stage, players, control });
  const rules = evaluateRules(summary);
  return { session, readAtMs, summary, rules, verdict: verdictOf(rules), capacity, stage };
}

/** The switch verification read: the control document, then the battles from SWITCH_KNOWN_SESSIONS sessions back. */
export async function gatherSwitch(db, { nowMs, allowlistList = [], isInCohort = isInReleaseCohort }) {
  const control = await readControl(db, nowMs);
  let knownFrom = etDay(nowMs);
  for (let i = 0; i < SWITCH_KNOWN_SESSIONS; i += 1) knownFrom = getPreviousSessionDate(knownFrom) ?? knownFrom;
  const fromIso = new Date(Date.parse(`${knownFrom}T00:00:00Z`)).toISOString();
  const toIso = new Date(nowMs + 8 * 86_400_000).toISOString();
  const battles = await maskedBattles(db, fromIso, toIso);
  const result = switchRead({ battles, view: control.view, allowlist: new Set(allowlistList), nowMs, isInCohort });
  return { readAtMs: nowMs, control, battlesRead: battles.length, window: { from: fromIso, to: toIso, knownFrom }, result };
}

async function main() {
  const { writeFileSync } = await import('node:fs');
  const path = (await import('node:path')).default;
  const { PROJECT_ROOT } = await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const { readCockpitAllowlist } = await import('../api/_utils/callRecords/allowlist.js');
  const { callDeadlineMs } = await import('../api/_utils/callRecords/sweep.js');
  const args = process.argv.slice(2);
  const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const db = getFirebaseAdmin();
  const nowMs = Date.now();
  let read; let out;
  if (args.includes('--switch')) {
    read = await gatherSwitch(db, { nowMs, allowlistList: readCockpitAllowlist() });
    out = renderSwitch(read);
  } else {
    const session = argOf('--session') ? checkSession(argOf('--session')) : defaultSession(nowMs);
    read = await gatherReadout(db, { session, readAtMs: nowMs, allowlistList: readCockpitAllowlist(), deadlineOf: callDeadlineMs });
    out = renderReadout(read, { detail: args.includes('--detail') });
  }
  process.stdout.write(`${out}\n`);
  if (argOf('--json')) writeFileSync(path.resolve(PROJECT_ROOT, argOf('--json')), JSON.stringify(read, null, 2));
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().catch((err) => { console.error(err?.message || err); process.exit(1); });
}
