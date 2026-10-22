// scripts/cockpit-2b-read.mjs
//
// Cockpit Build 2b — THE 2b READ (spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-13;
// contract Amendment D). Modelled on scripts/cockpit-week1-read.mjs, with the
// same account handling. Per battle-day (ET session) it prints:
//
//   commands    the cockpit filings (chatExchanges with source 'cockpit' and a
//               directive — the very entries D-1 counts), by directive kind,
//               and by route where the record can say it: a `go_now` on an
//               exit + hold call is the "Exit instead" route; a named answer
//               (`replace`, a named `go_now`, a `pick`) is a step or sheet
//               pick. CARD CHIP vs SHEET is NOT RECORDED (the endpoint stores
//               no surface) — printed as unknown, never guessed
//   replaces    confirmed replacements that landed — the `superseded` events
//               whose replacing exchange is a cockpit filing. Confirmations
//               shown and kept, and 409 `replace_unconfirmed` refusals, are
//               never persisted (D-2) and no server log is read here — printed
//               as unknown
//   chosen      each named filing's chosen name, by where it came from: the
//               call's stored option (`agent` · `bench`) or the sheet alone
//   receipts    `acted` and `no_matching_trade` events on calls answered with
//               a chosen name
//   retired     every `retired` event, by reason (D-6)
//   following   restatements under a live command (D-10 rev 2: same plan,
//               within 1 % of the answered level, minted after the filing, at
//               a check whose `declared` event names the command's thread)
//   options     calls minted with `replacementOptions`: how many, and the fill
//               (agent count, bench count); null and absent apart
//   refusals    `counterpart_unavailable` is a 400 the endpoint does not
//               persist — printed as unknown
//   events      every call-event kind seen, tallied generically, so a kind this
//               script does not know still shows
//
// READ-ONLY BY CONSTRUCTION. Firestore Admin SDK calls are `.get()` only — no
// set, update, delete, create, runTransaction, batch or bulkWriter (grep it).
// The only files written are --out (the tables) and --raw (the raw dump),
// and --raw refuses any path inside the tree that git does not ignore.
//
// THE ACCOUNTS. The two owner uids come from COCKPIT_ALLOWLIST_UIDS in the
// shell for this run only (never committed): first = "founder", second =
// "FT_QA". No uid is ever printed — every table names the account by label.
//
// USAGE (repo root):
//   COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA> node scripts/cockpit-2b-read.mjs \
//     [--days 2026-10-22,2026-10-23] [--out <tables.md>] [--raw reads-raw/cockpit-2b]
//   --days: ET sessions (default: today's ET date).
//
// The tallies are pure exported functions (scripts/cockpit-2b-read.test.js);
// Firestore, the env loader and git are imported lazily inside main(), so the
// tests import nothing that reads a credential.

export const ACCOUNT_LABELS = Object.freeze(['founder', 'FT_QA']);
export const COMMAND_SOURCE = 'cockpit';
export const FOLLOW_TOLERANCE = 0.01;
export const UNKNOWN = 'unknown — not recorded';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/** Firestore Timestamp, millis, ISO string, `{ __ts }` → millis, or null. */
export function toMs(v) {
  if (finite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v && finite(v.__ts)) return v.__ts;
  if (v && finite(v._seconds)) return v._seconds * 1000 + Math.round((v._nanoseconds ?? 0) / 1e6);
  return null;
}

/** The ET calendar date of an instant ("2026-10-21"), or null. */
export function etDay(ms) {
  if (!finite(ms)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The battle's cockpit filings (D-1's own entries): one per accepted directive answer. */
export function commandsOf(chatExchanges) {
  return (Array.isArray(chatExchanges) ? chatExchanges : [])
    .filter((ex) => ex && ex.source === COMMAND_SOURCE && ex.hasDirective === true)
    .map((ex) => ({
      thread: ex.directiveThreadId ?? ex.directive?.directiveThreadId ?? null,
      callId: ex.callId ?? ex.directive?.callId ?? null,
      kind: ex.directive?.kind ?? null,
      pickSymbol: nonEmpty(ex.directive?.action?.pickSymbol) ? ex.directive.action.pickSymbol : null,
      textVersion: ex.directive?.textVersion ?? null,
      atMs: toMs(ex.timestamp),
    }));
}

/** The route a filing's own record can prove (card chip vs sheet is never recorded). */
export function routeOf(command, call) {
  if (!call) return 'unknown';
  const answer = call.playerResponse?.answer ?? null;
  if (command.kind === 'call_pick') return 'pick (Build 1a)';
  if (command.pickSymbol) return answer === 'go_now' ? 'Exit instead · named' : 'step or sheet pick';
  if (answer === 'go_now' && call.direction === 'exit' && call.defaultAction === 'hold') return 'Exit instead · let the agent choose';
  return 'button';
}

/** Where a chosen name came from: the call's stored option, by its source, or the sheet alone. */
export function chosenSourceOf(call, pickSymbol) {
  if (!nonEmpty(pickSymbol)) return null;
  const options = Array.isArray(call?.replacementOptions) ? call.replacementOptions : [];
  const hit = options.find((o) => o?.symbol === pickSymbol);
  if (!hit) return 'sheet-only';
  return hit.source === 'agent' || hit.source === 'bench' ? hit.source : 'sheet-only';
}

/** Every event kind, tallied — kinds this script does not know included. */
export function tallyKinds(events) {
  const out = {};
  for (const e of Array.isArray(events) ? events : []) {
    const k = nonEmpty(e?.kind) ? e.kind : '(no kind)';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** The `retired` events by reason (D-6). */
export function retiredByReason(events) {
  const out = {};
  for (const e of Array.isArray(events) ? events : []) {
    if (e?.kind !== 'retired') continue;
    const r = nonEmpty(e.reason) ? e.reason : '(no reason)';
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

const planKey = (c) => [c.symbol, c.direction, c.slot, c.condition?.side, c.defaultAction].join('|');

/**
 * Restatements under a command (D-10 rev 2): a later call on the answered
 * call's plan, minted after the filing, within 1 % of the answered level, at
 * a check whose `declared` event carries the command's thread. Never the
 * answered call itself.
 */
export function followingOf(command, calls, events) {
  const answered = (Array.isArray(calls) ? calls : []).find((c) => c?.callId === command.callId);
  if (!answered || !finite(answered.condition?.level) || !nonEmpty(command.thread)) return [];
  const declaredFor = (callId) => (Array.isArray(events) ? events : []).find((e) => e?.kind === 'declared' && Array.isArray(e.callIds) && e.callIds.includes(callId));
  return calls.filter((c) => {
    if (!c || c.callId === answered.callId || planKey(c) !== planKey(answered)) return false;
    if (!finite(c.condition?.level) || Math.abs(c.condition.level - answered.condition.level) > FOLLOW_TOLERANCE * Math.abs(answered.condition.level)) return false;
    const minted = toMs(c.mintedAt);
    if (!finite(minted) || !finite(command.atMs) || minted <= command.atMs) return false;
    return declaredFor(c.callId)?.promptDirectiveThreadId === command.thread;
  });
}

/** Calls minted with replacement options and their fill. */
export function optionsFill(calls) {
  const list = Array.isArray(calls) ? calls : [];
  const withField = list.filter((c) => Array.isArray(c?.replacementOptions));
  const fills = withField.map((c) => ({
    agent: c.replacementOptions.filter((o) => o?.source === 'agent').length,
    bench: c.replacementOptions.filter((o) => o?.source === 'bench').length,
  }));
  const hist = (key) => {
    const h = {};
    for (const f of fills) h[f[key]] = (h[f[key]] ?? 0) + 1;
    return h;
  };
  return {
    minted: list.length,
    withOptions: withField.length,
    nonEmpty: fills.filter((f) => f.agent + f.bench > 0).length,
    nullOptions: list.filter((c) => c && c.replacementOptions === null).length,
    absent: list.filter((c) => c && !('replacementOptions' in c)).length,
    agentFill: hist('agent'),
    benchFill: hist('bench'),
  };
}

/**
 * One battle-day's read, from the battle document, its calls and its events.
 * Pure: everything it prints comes from these three inputs.
 */
export function battleDayRead({ battle, calls, events, day }) {
  const callsOn = (Array.isArray(calls) ? calls : []).filter((c) => etDay(toMs(c?.mintedAt)) === day);
  const eventsOn = (Array.isArray(events) ? events : []).filter((e) => etDay(toMs(e?.at)) === day);
  const allCalls = Array.isArray(calls) ? calls : [];
  const callById = new Map(allCalls.map((c) => [c.callId, c]));
  const commands = commandsOf(battle?.chatExchanges).filter((c) => etDay(c.atMs) === day);
  const byKind = {};
  const byRoute = {};
  const chosen = { agent: 0, bench: 0, 'sheet-only': 0 };
  for (const cmd of commands) {
    byKind[cmd.kind ?? '(no kind)'] = (byKind[cmd.kind ?? '(no kind)'] ?? 0) + 1;
    const route = routeOf(cmd, callById.get(cmd.callId));
    byRoute[route] = (byRoute[route] ?? 0) + 1;
    const src = chosenSourceOf(callById.get(cmd.callId), cmd.pickSymbol);
    if (src) chosen[src] += 1;
  }
  const namedCalls = new Set(commands.filter((c) => c.pickSymbol).map((c) => c.callId));
  const onNamed = (kind) => eventsOn.filter((e) => e?.kind === kind && Array.isArray(e.callIds) && e.callIds.some((id) => namedCalls.has(id))).length;
  const cockpitThreads = new Set(commandsOf(battle?.chatExchanges).map((c) => c.thread).filter(Boolean));
  const replaced = eventsOn.filter((e) => e?.kind === 'superseded' && cockpitThreads.has(e.supersededBy)).length;
  const following = commands.reduce((n, cmd) => n + followingOf(cmd, allCalls, events).filter((c) => etDay(toMs(c.mintedAt)) === day).length, 0);
  return {
    day,
    commands: commands.length,
    byKind,
    byRoute,
    surface: UNKNOWN,
    replacedLanded: replaced,
    confirmationsShown: UNKNOWN,
    replaceUnconfirmed: UNKNOWN,
    chosen,
    actedOnNamed: onNamed('acted'),
    noMatchOnNamed: onNamed('no_matching_trade'),
    retired: retiredByReason(eventsOn),
    following,
    options: optionsFill(callsOn.filter((c) => c.mintedMode === 'on')),
    counterpartUnavailable: UNKNOWN,
    eventKinds: tallyKinds(eventsOn),
  };
}

const fmtMap = (m) => (Object.keys(m).length ? Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k} ${v}`).join(' · ') : 'none');

/** The markdown table rows for a list of { acct, battleId, read }. */
export function renderTables(rows) {
  const L = [];
  const head = ['Account', 'Battle', 'ET day', 'Commands', 'By kind', 'By route (record-provable)', 'Card vs sheet', 'Replacements landed', 'Confirmations shown / 409 unconfirmed', 'Chosen (agent · bench · sheet-only)', 'Acted / no match on chosen', 'Retired', 'Following', 'Options (with · non-empty · null · absent / minted)', 'Agent fill', 'Bench fill', 'counterpart_unavailable', 'Event kinds'];
  L.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`);
  for (const { acct, battleId, read: r } of rows) {
    L.push(`| ${[
      acct, `\`${String(battleId).slice(0, 8)}\``, r.day, r.commands, fmtMap(r.byKind), fmtMap(r.byRoute), r.surface, r.replacedLanded,
      `${r.confirmationsShown} / ${r.replaceUnconfirmed}`, `${r.chosen.agent} · ${r.chosen.bench} · ${r.chosen['sheet-only']}`,
      `${r.actedOnNamed} / ${r.noMatchOnNamed}`, fmtMap(r.retired), r.following,
      `${r.options.withOptions} · ${r.options.nonEmpty} · ${r.options.nullOptions} · ${r.options.absent} / ${r.options.minted}`,
      fmtMap(r.options.agentFill), fmtMap(r.options.benchFill), r.counterpartUnavailable, fmtMap(r.eventKinds),
    ].join(' | ')} |`);
  }
  return L.join('\n');
}

// ---------------------------------------------------------------- the run (reads only)

async function main() {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const path = (await import('node:path')).default;
  const { PROJECT_ROOT } = await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const args = process.argv.slice(2);
  const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const uids = (process.env.COCKPIT_ALLOWLIST_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (uids.length !== 2) throw new Error('COCKPIT_ALLOWLIST_UIDS must hold exactly two uids for this run: <founder>,<FT_QA>');
  const days = (argOf('--days') || etDay(Date.now())).split(',').map((s) => s.trim()).filter(Boolean);
  const db = getFirebaseAdmin();
  const readAtMs = Date.now();
  const rows = [];
  const raw = [];
  for (const [i, uid] of uids.entries()) {
    const snap = await db.collection('agentBattles').where('ownerId', '==', uid).get();
    for (const d of [...snap.docs].sort((a, b) => a.id.localeCompare(b.id))) {
      const battle = d.data();
      const calls = (await db.collection('agentBattles').doc(d.id).collection('calls').get()).docs.map((x) => ({ id: x.id, ...x.data() }));
      const events = (await db.collection('agentBattles').doc(d.id).collection('callEvents').get()).docs.map((x) => ({ id: x.id, ...x.data() }));
      for (const day of days) {
        const read = battleDayRead({ battle, calls, events, day });
        const touched = read.commands + Object.values(read.eventKinds).reduce((a, b) => a + b, 0) + read.options.minted;
        if (touched > 0) rows.push({ acct: ACCOUNT_LABELS[i], battleId: d.id, read });
      }
      raw.push({ acct: ACCOUNT_LABELS[i], id: d.id, battle, calls, events });
    }
  }
  const out = [
    '## Generated tables (`scripts/cockpit-2b-read.mjs`)',
    '',
    `Read at ${new Date(readAtMs).toISOString()} · ET sessions ${days.join(', ')} · battle-days with any cockpit filing, call event or minted call: ${rows.length}. "${UNKNOWN}" marks a fact the records do not hold (spec S-13): the card-vs-sheet surface, replace confirmations shown and kept, 409 \`replace_unconfirmed\`, and \`counterpart_unavailable\` refusals are never persisted, and no server log is read.`,
    '',
    rows.length ? renderTables(rows) : '_No battle-day in range._',
    '',
  ].join('\n');
  if (argOf('--out')) writeFileSync(path.resolve(PROJECT_ROOT, argOf('--out')), out);
  else process.stdout.write(out);
  if (argOf('--raw')) {
    const abs = path.resolve(PROJECT_ROOT, argOf('--raw'));
    const rel = path.relative(PROJECT_ROOT, abs);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      try { execFileSync('git', ['check-ignore', '-q', rel.split(path.sep).join('/') + '/x'], { cwd: PROJECT_ROOT }); }
      catch { throw new Error(`--raw ${argOf('--raw')} is inside the tree and not git-ignored — nothing raw may be committable`); }
    }
    mkdirSync(abs, { recursive: true });
    const conv = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toMillis === 'function' ? { __ts: x.toMillis() } : x));
    writeFileSync(path.join(abs, 'cockpit-2b-raw.json'), conv({ readAtMs, days, battles: raw }));
  }
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().catch((err) => { console.error(err?.message || err); process.exit(1); });
}
