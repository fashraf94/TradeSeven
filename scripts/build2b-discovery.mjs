// scripts/build2b-discovery.mjs
//
// Phase 0 — Cockpit Build 2b discovery: the timing read (Part A) and the live
// counts (Part C) of docs/audits/20261014_PHASE0_BUILD2B_COCKPIT.md. The two
// allowlisted accounts' battles on the cockpit-on ET sessions 2026-10-06 …
// 2026-10-14, beside the founder's pre-flip battles (off: no `declarationsPhase`
// on the entry; shadow: the field present before the #931 merge instant).
//
// READ-ONLY BY CONSTRUCTION (the week-1 read's discipline,
// scripts/cockpit-week1-read.mjs): Firestore Admin SDK `.get()` / `getAll()`
// only — no set, update, delete, create, runTransaction, batch or bulkWriter
// (grep it); git `rev-parse` and `log` only; no model API call of any kind
// (token figures come from the stored tick bodies' `usage`). The only files
// written are --out (the tables) and --raw (the dump, refused unless the path
// is git-ignored).
//
// THE ACCOUNTS: COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA> in the shell for the
// run only. No uid is printed; every table names the account by its label.
//
// USAGE (repo root):
//   COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA> node scripts/build2b-discovery.mjs \
//     [--out <tables.md>] [--raw reads-raw/build2b] [--from-raw <dump.json>]
//   --from-raw replays a dump this script wrote (the same bytes come out, except
//   the read instant), for reproduction without a second Firestore read.
//
// DETERMINISTIC: the same Firestore state prints the same bytes, except the
// read instant.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PROJECT_ROOT } from './loadLocalEnv.js';
import { etDateOf } from '../api/_utils/callRecords/horizon.js';

// ---------------------------------------------------------------- constants

export const WEEK1 = Object.freeze(['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
export const WEEK2 = Object.freeze(['2026-10-12', '2026-10-13', '2026-10-14']);
export const ON_DAYS = Object.freeze([...WEEK1, ...WEEK2]);
export const PRE_FLIP_FIRST_DAY = '2026-09-21';
const SCOPE_FLOOR_MS = Date.parse('2026-09-21T00:00:00Z');
export const FLIP_PR = 931;
export const ACCOUNT_LABELS = Object.freeze(['founder', 'FT_QA']);
const SUBCOLLECTIONS = ['calls', 'declarations', 'callEvents', 'callObservations', 'tickBodies'];
const WINDOWS = ['on', 'pre-flip · shadow', 'pre-flip · off'];
const BENCH_HEADER = 'BENCH (available for swap):';
/** Amendment B §4: a next_check directive lives 15 minutes past its slot. */
const NEXT_CHECK_GRACE_MS = 900_000;
/** Amendment C-6: the level tolerance, against the newer call. */
const LEVEL_TOL = 0.01;
/** validate.js DECLARATION_CAPS.shots: the kept cap. */
const SHOT_CAP = 6;
const TOKEN_BINS = [[0, 499], [500, 999], [1000, 1499], [1500, 1999], [2000, Infinity]];

// ---------------------------------------------------------------- helpers

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.__ts === 'number') return v.__ts;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}
const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
const etHourFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false });
const etHm = (ms) => (finite(ms) ? etFmt.format(new Date(ms)) : 'n/a');
const etClock = (ms) => (finite(ms) ? `${etDateOf(ms)} ${etHm(ms)} ET` : 'n/a');
const etHour = (ms) => (finite(ms) ? `${etHourFmt.format(new Date(ms)).replace(/^24$/, '00')}:00` : 'n/a');
/** Nearest-rank percentile; null on an empty list. */
export function pct(values, p) {
  const xs = values.filter(finite).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.min(xs.length - 1, Math.max(0, Math.ceil((p / 100) * xs.length) - 1))];
}
export function median(values) {
  const xs = values.filter(finite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
const r1 = (v) => (v == null ? 'n/a' : (Number.isInteger(v) ? String(v) : v.toFixed(1)));
const r2 = (v) => (v == null ? 'n/a' : (Number.isInteger(v) ? String(v) : v.toFixed(2)));
const p3 = (list) => { const xs = list.filter(finite); return xs.length ? `${pct(xs, 50)} · ${pct(xs, 90)} · ${pct(xs, 95)} (n=${xs.length})` : 'n/a'; };
/** "mean · median · min–max (n)". */
export function dist(values) {
  const xs = values.filter(finite);
  if (!xs.length) return 'n/a';
  return `${r2(mean(xs))} · ${r2(median(xs))} · ${Math.min(...xs)}–${Math.max(...xs)} (n=${xs.length})`;
}
const fmtRate = (num, den) => (den ? `${num} / ${den} (${((100 * num) / den).toFixed(1)}%)` : `${num} / 0`);
const inc = (obj, key, by = 1) => { obj[key] = (obj[key] || 0) + by; return obj; };
const tally = (obj) => (Object.keys(obj).length ? Object.keys(obj).sort().map((k) => `\`${k}\` ×${obj[k]}`).join(', ') : 'none');
const byKey = (k) => (a, b) => String(a[k]).localeCompare(String(b[k]));
const short = (id) => (typeof id === 'string' ? id.replace(/^([A-Za-z0-9]{5})[A-Za-z0-9]{15}(:|$)/, '$1…$2') : String(id));
const minutes = (a, b) => (finite(a) && finite(b) ? Math.round(((b - a) / 60000) * 10) / 10 : null);
/** Pearson correlation of two equal-length lists; null under 3 pairs. */
export function corr(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n)); const my = mean(ys.slice(0, n));
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const cut = (s, n = 110) => { const t = String(s ?? '').replace(/\s+/g, ' ').replace(/[|`]/g, ''); return t.length > n ? `${t.slice(0, n)}…` : t; };
const callLine = (c) => `${c.symbol} ${c.direction} ${c.condition?.side} ${c.condition?.level} (${c.kind}, default ${c.defaultAction}, ${c.horizon?.basis}, counterpart ${c.counterpart ?? 'null'})`;

/** Amendment C-6's key (cockpitModel.js threadKeyOf). */
export function threadKeyOf(call) {
  const minted = toMs(call?.mintedAt);
  const side = call?.condition?.side;
  if (minted === null || !nonEmpty(call?.symbol) || !nonEmpty(call?.direction) || !nonEmpty(call?.slot) || !nonEmpty(side) || !nonEmpty(call?.defaultAction)) return null;
  return `${etDateOf(minted)}|${call.symbol}|${call.direction}|${call.slot}|${side}|${call.defaultAction}`;
}
export function levelsWithin(older, newer) {
  const a = older?.condition?.level; const b = newer?.condition?.level;
  if (!finite(a) || !finite(b) || b === 0) return false;
  return Math.abs(a - b) / Math.abs(b) <= LEVEL_TOL;
}
/** Was the call open at instant t? */
export function openAt(call, t) {
  const minted = toMs(call.mintedAt);
  if (!finite(minted) || minted > t) return false;
  if (call.state === 'open') return true;
  if (call.stateSource === 'mint') return false;
  const changed = toMs(call.stateChangedAt);
  return finite(changed) && changed > t;
}
/** The calls open at t, folded into C-6 threads (each newest first; threads newest first). */
export function foldAt(calls, t) {
  const open = calls.filter((c) => openAt(c, t)).sort((a, b) => b.mintedAt - a.mintedAt || String(b.callId).localeCompare(String(a.callId)));
  const parent = open.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const keys = open.map(threadKeyOf);
  for (let i = 0; i < open.length; i += 1) {
    if (keys[i] === null) continue;
    for (let j = i + 1; j < open.length; j += 1) if (keys[j] === keys[i] && levelsWithin(open[j], open[i])) parent[find(j)] = find(i);
  }
  const groups = new Map();
  open.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  return [...groups.values()];
}
/** The call directive's lifetime end (callActions.js callDirectiveExpiresAtMs). */
const lifetimeOf = (d) => (finite(d?.expiresAtMs) ? d.expiresAtMs : null);
/** The bench rows of a prompt's BENCH CSV block (symbol, status), or null. */
export function benchRowsOf(text) {
  const i = typeof text === 'string' ? text.indexOf(`${BENCH_HEADER}\n`) : -1;
  if (i < 0) return null;
  const lines = text.slice(i).split('\n\n')[0].split('\n');
  const cols = (lines[1] || '').split(',');
  const sym = cols.indexOf('Symbol'); const st = cols.indexOf('Status');
  if (sym < 0 || st < 0) return null;
  return lines.slice(2).map((l) => { const f = l.split(','); return { symbol: (f[sym] || '').trim(), status: f.slice(st).join(',').trim() }; }).filter((r) => r.symbol);
}
/** What a tick body says about the request and the response (null = unreadable part). */
export function readTickBody(body) {
  const out = { reqChars: null, sysChars: null, msgChars: null, toolsChars: null, context: null, inputTokens: null, outputTokens: null, stopReason: null, inputJsonChars: null, declChars: null, rawShots: null, rawWatching: null };
  try {
    const req = JSON.parse(body?.request?.body ?? 'null');
    if (req && Array.isArray(req.messages)) {
      const text = (m) => (typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((c) => c?.text ?? '').join('\n') : ''));
      out.sysChars = typeof req.system === 'string' ? req.system.length : JSON.stringify(req.system ?? '').length;
      out.msgChars = req.messages.reduce((s, m) => s + text(m).length, 0);
      out.toolsChars = JSON.stringify(req.tools ?? []).length;
      out.reqChars = out.sysChars + out.msgChars + out.toolsChars;
      out.context = req.messages.filter((m) => m?.role === 'user').map(text).join('\n\n');
    }
  } catch { /* unreadable request */ }
  try {
    const res = JSON.parse(body?.response?.body ?? 'null');
    if (res && typeof res === 'object') {
      out.stopReason = res.stop_reason ?? null;
      if (finite(res.usage?.input_tokens)) out.inputTokens = res.usage.input_tokens;
      if (finite(res.usage?.output_tokens)) out.outputTokens = res.usage.output_tokens;
      const tu = Array.isArray(res.content) ? res.content.find((c) => c?.type === 'tool_use') : null;
      if (tu && tu.input && typeof tu.input === 'object') {
        out.inputJsonChars = JSON.stringify(tu.input).length;
        const d = tu.input.declarations;
        out.declChars = d && typeof d === 'object' ? JSON.stringify(d).length : 0;
        out.rawShots = Array.isArray(d?.calledShots) ? d.calledShots.length : 0;
        out.rawWatching = Array.isArray(d?.watching) ? d.watching.length : (Array.isArray(tu.input.watching) ? tu.input.watching.length : 0);
      }
    }
  } catch { /* unreadable response */ }
  return out;
}

// ---------------------------------------------------------------- reads

const git = (args) => execFileSync('git', args, { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
function flipMergeInstant() {
  const line = git(['log', '--merges', '--first-parent', '--format=%H%x09%cI%x09%s', 'HEAD']).split('\n').find((l) => new RegExp(`Merge pull request #${FLIP_PR} `).test(l));
  if (!line) throw new Error(`no first-parent merge of PR #${FLIP_PR} in HEAD's history`);
  return { sha: line.split('\t')[0], at: line.split('\t')[1] };
}
async function readFirestore(db, uids) {
  const battles = new Map();
  for (const [i, uid] of uids.entries()) {
    const snap = await db.collection('agentBattles').where('ownerId', '==', uid).get();
    for (const d of snap.docs) battles.set(d.id, { id: d.id, acct: ACCOUNT_LABELS[i], doc: d.data() });
  }
  const inScope = [...battles.values()].filter((b) => b.doc.status === 'active' || (toMs(b.doc.expiresAt) ?? Infinity) >= SCOPE_FLOOR_MS).sort(byKey('id'));
  for (const b of inScope) {
    b.sub = {};
    for (const name of SUBCOLLECTIONS) {
      const s = await db.collection('agentBattles').doc(b.id).collection(name).get();
      b.sub[name] = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byKey('id'));
    }
  }
  return { total: battles.size, totalBy: ACCOUNT_LABELS.map((a) => [...battles.values()].filter((b) => b.acct === a).length), inScope };
}
function writeRaw(dir, payload) {
  const abs = path.resolve(PROJECT_ROOT, dir);
  const rel = path.relative(PROJECT_ROOT, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    try { execFileSync('git', ['check-ignore', '-q', `${rel.split(path.sep).join('/')}/x`], { cwd: PROJECT_ROOT }); }
    catch { throw new Error(`--raw ${dir} is inside the tree and not git-ignored — nothing raw may be committable`); }
  }
  mkdirSync(abs, { recursive: true });
  writeFileSync(path.join(abs, 'build2b-raw.json'), JSON.stringify(payload, (k, x) => (x && typeof x === 'object' && typeof x.toMillis === 'function' ? { __ts: x.toMillis() } : x)));
}

// ---------------------------------------------------------------- the read

async function main() {
  const args = process.argv.slice(2);
  const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const head = git(['rev-parse', 'HEAD']);
  const flip = flipMergeInstant();
  const flipMs = Date.parse(flip.at);
  let F; let readAtMs;
  if (argOf('--from-raw')) {
    const raw = JSON.parse(readFileSync(path.resolve(PROJECT_ROOT, argOf('--from-raw')), 'utf8'));
    F = { total: raw.total ?? 'n/a', totalBy: raw.totalBy ?? ['n/a', 'n/a'], inScope: raw.battles }; readAtMs = raw.readAtMs;
  } else {
    const uids = (process.env.COCKPIT_ALLOWLIST_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (uids.length !== 2) throw new Error('COCKPIT_ALLOWLIST_UIDS must hold exactly two uids for this run: <founder>,<FT_QA>');
    const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
    readAtMs = Date.now();
    F = await readFirestore(getFirebaseAdmin(), uids);
    if (argOf('--raw')) writeRaw(argOf('--raw'), { readAtMs, head, total: F.total, totalBy: F.totalBy, battles: F.inScope });
  }

  // ------------------------------------------------------------ indexes
  const groupOf = (b) => `${b.acct} · ${b.doc.agentContext?.archetype ?? 'unknown'}`;
  const bodies = new Map();
  for (const b of F.inScope) for (const t of b.sub.tickBodies) if (t.evalId) bodies.set(`${b.id}|${t.evalId}`, readTickBody(t));
  const entries = [];
  for (const b of F.inScope) {
    const decls = new Map(b.sub.declarations.map((d) => [d.evalId, d]));
    for (const e of Array.isArray(b.doc.evaluations) ? b.doc.evaluations : []) {
      const ms = toMs(e?.promptBuiltAt) ?? toMs(e?.timestamp);
      if (ms === null) continue;
      const day = etDateOf(ms);
      const window = ON_DAYS.includes(day) ? 'on' : (ms < flipMs && day >= PRE_FLIP_FIRST_DAY ? ('declarationsPhase' in e ? 'pre-flip · shadow' : 'pre-flip · off') : null);
      if (!window) continue;
      const fc = e.haikuError?.failureClass ?? null;
      const x = {
        b, e, ms, day, window, group: groupOf(b), evalId: e.evalId, hour: etHour(ms),
        dispatched: finite(e.callMs), refused: /^\d{3}$/.test(String(fc)), timeout: fc === 'timeout', completed: finite(e.callMs) && !e.haikuError,
        declaring: e.declarationsPhase === 'expected', body: bodies.get(`${b.id}|${e.evalId}`) ?? null, decl: decls.get(e.evalId) ?? null,
        atMs: toMs(decls.get(e.evalId)?.mintedAt) ?? toMs(e.timestamp) ?? ms,
      };
      x.modelCall = x.dispatched && !x.refused;
      entries.push(x);
    }
  }
  entries.sort((a, b) => a.ms - b.ms || a.b.id.localeCompare(b.b.id));
  const on = entries.filter((x) => x.window === 'on');
  const groupsAll = [...new Set(entries.map((x) => x.group))].sort();
  const groupsOn = [...new Set(on.map((x) => x.group))].sort();
  const inOn = (ms) => finite(ms) && ON_DAYS.includes(etDateOf(ms));
  const calls = F.inScope.flatMap((b) => b.sub.calls.map((c) => ({ ...c, b, group: groupOf(b) }))).filter((c) => inOn(toMs(c.mintedAt))).sort((x, y) => x.mintedAt - y.mintedAt || x.callId.localeCompare(y.callId));
  const decls = F.inScope.flatMap((b) => b.sub.declarations.map((d) => ({ ...d, b, group: groupOf(b) }))).filter((d) => inOn(toMs(d.mintedAt)));
  const battleDays = (xs) => [...new Set(xs.map((x) => `${x.b.id}|${x.day}`))].sort();
  const onBattles = [...new Set(on.map((x) => x.b))].sort(byKey('id'));
  /** Every call-family directive filing of a battle, oldest first, with its live interval. */
  const commandsOf = (b) => {
    const list = (b.doc.chatExchanges || []).filter((x) => x?.hasDirective && x.directive && typeof x.directive === 'object').map((x) => ({ x, ms: toMs(x.timestamp), d: x.directive })).filter((c) => finite(c.ms)).sort((p, q) => p.ms - q.ms);
    return list.map((c, i) => {
      const next = list[i + 1]?.ms ?? Infinity;
      const acted = c.d.family === 'call' ? b.sub.callEvents.find((ev) => ev.kind === 'acted' && (ev.callIds || []).includes(c.d.callId)) : null;
      const retiredMs = acted && c.d.kind !== 'call_hold' ? toMs(acted.at) : Infinity;
      return { ...c, call: c.d.family === 'call' ? b.sub.calls.find((k) => k.callId === c.d.callId) ?? null : null, endMs: Math.min(lifetimeOf(c.d) ?? Infinity, next, retiredMs) };
    }).filter((c) => c.d.family === 'call');
  };
  const liveCommandsAt = (b, t) => commandsOf(b).filter((c) => c.ms <= t && t <= c.endMs);

  // ------------------------------------------------------------ output
  const L = [];
  const p = (s = '') => L.push(s);
  const tbl = (head, rows) => { p(`| ${head.join(' | ')} |`); p(`|${head.map(() => '---').join('|')}|`); for (const r of rows) p(`| ${r.map((v) => String(v ?? 'n/a')).join(' | ')} |`); p(); };

  p('## Generated tables (`scripts/build2b-discovery.mjs`)');
  p();
  p(`Read at ${new Date(readAtMs).toISOString()} (${etClock(readAtMs)}) · HEAD \`${head.slice(0, 8)}\` · #${FLIP_PR} merged ${flip.at} (\`${flip.sha.slice(0, 8)}\`). Battles owned by the two accounts: ${F.total} (founder ${F.totalBy[0]}, FT_QA ${F.totalBy[1]}); read in full (expiry on/after ${PRE_FLIP_FIRST_DAY}, or active): ${F.inScope.length}. Windows: on = ET sessions ${ON_DAYS.join(', ')} (week 1 = ${WEEK1.join(', ')}; week 2 = ${WEEK2.join(', ')}); pre-flip = ${PRE_FLIP_FIRST_DAY} up to the #${FLIP_PR} merge instant, shadow when the entry carries \`declarationsPhase\`, off otherwise.`);
  p();
  tbl(['Account · archetype', 'Window', 'Battles', 'Battle-days', 'Checks', 'ET days'], groupsAll.flatMap((g) => WINDOWS.map((w) => {
    const xs = entries.filter((x) => x.group === g && x.window === w);
    return xs.length ? [g, w, new Set(xs.map((x) => x.b.id)).size, battleDays(xs).length, xs.length, [...new Set(xs.map((x) => x.day))].sort().join(', ')] : null;
  }).filter(Boolean)));
  const active = F.inScope.filter((b) => b.doc.status === 'active');
  p(`- Active at read: ${active.length ? active.map((b) => `${b.acct} \`${short(b.id)}\` (expires ${etClock(toMs(b.doc.expiresAt))})`).join('; ') : 'none'}. Open calls at read (on window): ${calls.filter((c) => c.state === 'open').length}. \`declarationsPhase\` values on the on-window checks: ${tally(on.reduce((o, x) => inc(o, String(x.e.declarationsPhase ?? 'absent')), {}))}.`);
  p();

  // ---- A1
  p('### A1. Timeouts and callMs');
  p();
  p('A *model call* is a dispatched check (finite `callMs`) that the API did not refuse; API-refused checks (`failureClass` = an HTTP status) are left out of every rate and listed in their own column. A timed-out check has no answer, so it cannot be classified as declaring: the declaring / non-declaring split covers completed checks (no `haikuError`), and timeouts stand beside them. `callMs` p50 · p90 · p95 in ms.');
  p();
  const a1 = (xs) => {
    const mc = xs.filter((x) => x.modelCall); const to = mc.filter((x) => x.timeout); const done = mc.filter((x) => x.completed);
    const kinds = {}; for (const x of to) inc(kinds, x.e.haikuError?.timeoutKind ?? 'null');
    const other = {}; for (const x of mc) if (x.e.haikuError && !x.timeout) inc(other, x.e.haikuError.failureClass);
    return [xs.length, mc.length, xs.filter((x) => x.refused).length, fmtRate(to.length, mc.length), tally(kinds), tally(other), p3(mc.map((x) => x.e.callMs)),
      `${done.filter((x) => x.declaring).length} / ${done.length}`, p3(done.filter((x) => x.declaring).map((x) => x.e.callMs)), p3(done.filter((x) => !x.declaring).map((x) => x.e.callMs))];
  };
  const A1_HEAD = ['Checks', 'Model calls', 'API-refused (separate)', 'Timeouts', '`timeoutKind`', 'Other failures', 'callMs p50 · p90 · p95 (model calls)', 'Declaring / completed', 'callMs, completed declaring', 'callMs, completed non-declaring'];
  tbl(['Account · archetype', 'Window', ...A1_HEAD], groupsAll.flatMap((g) => WINDOWS.map((w) => { const xs = entries.filter((x) => x.group === g && x.window === w); return xs.length ? [g, w, ...a1(xs)] : null; }).filter(Boolean)));
  p('By ET hour of the check (on window):');
  p();
  tbl(['Account · archetype', 'ET hour', ...A1_HEAD], groupsOn.flatMap((g) => [...new Set(on.filter((x) => x.group === g).map((x) => x.hour))].sort().map((h) => [g, h, ...a1(on.filter((x) => x.group === g && x.hour === h))])));
  p('By ET day (on window):');
  p();
  tbl(['Account · archetype', 'ET day', ...A1_HEAD], groupsOn.flatMap((g) => ON_DAYS.map((d) => { const xs = on.filter((x) => x.group === g && x.day === d); return xs.length ? [g, d, ...a1(xs)] : null; }).filter(Boolean)));
  const to400 = {}; for (const x of entries) if (x.refused) inc(to400, `${x.window} · ${x.group} · ${x.day} · ${x.e.haikuError.failureClass}: ${cut(String(x.e.haikuError.message ?? '').replace(/^\d{3}\s*/, ''), 70)}`);
  p(`- API-refused checks, by day and message: ${tally(to400)}.`);
  p();

  // ---- A2
  p('### A2. Output tokens vs callMs (readable tick bodies)');
  p();
  p('A body is *readable* when the stored response carries `usage.output_tokens` (a timed-out check stores its request and no response). The declarations share is a character-share proxy: the JSON length of the tool input\'s `declarations` block over the JSON length of the whole tool input (no token counter is called).');
  p();
  const a2rows = []; const binRows = [];
  for (const g of groupsAll) for (const w of WINDOWS) {
    const mc = entries.filter((x) => x.group === g && x.window === w && x.modelCall);
    if (!mc.length) continue;
    const rb = mc.filter((x) => finite(x.body?.outputTokens));
    const dec = rb.filter((x) => x.declaring); const non = rb.filter((x) => !x.declaring);
    const share = dec.filter((x) => x.body.inputJsonChars).map((x) => x.body.declChars / x.body.inputJsonChars);
    a2rows.push([g, w, `${rb.length} of ${mc.length}`, `${mc.filter((x) => x.timeout && x.body && x.body.reqChars !== null && x.body.outputTokens === null).length}`, r2(corr(rb.map((x) => x.body.outputTokens), rb.map((x) => x.e.callMs))),
      p3(rb.map((x) => x.body.outputTokens)), p3(dec.map((x) => x.body.outputTokens)), p3(non.map((x) => x.body.outputTokens)), share.length ? `${r2(100 * mean(share))}% · ${r2(100 * median(share))}% (n=${share.length})` : 'n/a',
      r2(corr(dec.map((x) => x.body.rawShots), dec.map((x) => x.body.outputTokens))), rb.filter((x) => x.body.stopReason === 'max_tokens').length]);
    for (const [lo, hi] of TOKEN_BINS) {
      const xs = rb.filter((x) => x.body.outputTokens >= lo && x.body.outputTokens <= hi);
      if (xs.length) binRows.push([g, w, `${lo}–${hi === Infinity ? '' : hi}`, xs.length, p3(xs.map((x) => x.e.callMs)), fmtRate(xs.filter((x) => x.declaring).length, xs.length), r1(mean(xs.map((x) => x.body.rawShots ?? 0)))]);
    }
  }
  tbl(['Account · archetype', 'Window', 'Bodies readable / model calls', 'Timeouts with a request and no response', 'corr(output tokens, callMs)', 'Output tokens p50 · p90 · p95', '…declaring checks', '…non-declaring checks', 'Declarations share of the tool input (mean · median)', 'corr(raw called shots, output tokens)', '`max_tokens` stops'], a2rows);
  tbl(['Account · archetype', 'Window', 'Output tokens', 'Checks', 'callMs p50 · p90 · p95', 'Declaring', 'Raw called shots (mean)'], binRows);

  // ---- A3
  p('### A3. Input size per check');
  p();
  p('Request characters come from the stored request (system + the three messages + the tool schema), so they cover timed-out checks too; input tokens come from the response\'s `usage.input_tokens`, so completed checks only.');
  p();
  tbl(['Account · archetype', 'Window', 'Requests readable / dispatched', 'Request chars p50 · p90 · p95', 'System chars p50', 'Message chars p50', 'Tool schema chars p50', 'Input tokens p50 · p90 · p95', 'Prompts with a BENCH TECHNICAL CONTEXT block'], groupsAll.flatMap((g) => WINDOWS.map((w) => {
    const xs = entries.filter((x) => x.group === g && x.window === w && x.dispatched);
    if (!xs.length) return null;
    const rq = xs.filter((x) => finite(x.body?.reqChars));
    return [g, w, `${rq.length} of ${xs.length}`, p3(rq.map((x) => x.body.reqChars)), pct(rq.map((x) => x.body.sysChars), 50), pct(rq.map((x) => x.body.msgChars), 50), pct(rq.map((x) => x.body.toolsChars), 50),
      p3(xs.filter((x) => finite(x.body?.inputTokens)).map((x) => x.body.inputTokens)), `${rq.filter((x) => String(x.body.context).includes('BENCH TECHNICAL CONTEXT:')).length} of ${rq.length}`];
  }).filter(Boolean)));

  // ---- A4 (data side)
  p("### A4 (data). The check's own wall times");
  p();
  p('From the evaluation entries: `buildMs` (the prompt build), `callMs` (the model call) and `tickMs` (the whole tick, from admission under the lock to the final update, so it also holds the pre-build work: quotes, the risk loop, triggers). The rest = tickMs − buildMs − callMs, the pre-build and post-call work together; the records do not split the two. Model calls only; ms.');
  p();
  tbl(['Account · archetype', 'Window', 'Model calls', 'buildMs p50 · p90 · p95', 'callMs p50 · p90 · p95', 'tickMs p50 · p90 · p95', 'The rest (tickMs − buildMs − callMs) p50 · p90 · p95', 'tickMs > 48,000', 'tickMs max'], groupsAll.flatMap((g) => WINDOWS.map((w) => {
    const mc = entries.filter((x) => x.group === g && x.window === w && x.modelCall);
    if (!mc.length) return null;
    const post = mc.filter((x) => finite(x.e.tickMs) && finite(x.e.buildMs)).map((x) => x.e.tickMs - x.e.buildMs - x.e.callMs);
    return [g, w, mc.length, p3(mc.map((x) => x.e.buildMs)), p3(mc.map((x) => x.e.callMs)), p3(mc.map((x) => x.e.tickMs)), p3(post), mc.filter((x) => x.e.tickMs > 48_000).length, pct(mc.map((x) => x.e.tickMs), 100)];
  }).filter(Boolean)));

  // ---- A5
  p('### A5. Called shots per declaring check');
  p();
  p(`Raw = the agent's \`declarations.calledShots\` as written in the tool input; kept = the record's list after validation (cap ${SHOT_CAP}, \`validate.js\` DECLARATION_CAPS.shots).`);
  p();
  const hist = (xs, f) => { const o = {}; for (const x of xs) { const n = f(x); inc(o, n == null ? 'n/a' : (n > SHOT_CAP ? `>${SHOT_CAP}` : String(n))); } return tally(o); };
  tbl(['Account · archetype', 'Window', 'Declaring checks', 'Raw shots: histogram', 'Raw > 3', 'Raw mean', 'Kept shots: histogram', 'Kept > 3', 'Kept mean'], groupsAll.flatMap((g) => ['on', 'pre-flip · shadow'].map((w) => {
    const xs = entries.filter((x) => x.group === g && x.window === w && x.declaring);
    if (!xs.length) return null;
    const raw = xs.filter((x) => finite(x.body?.rawShots)); const kept = xs.filter((x) => x.decl);
    return [g, w, xs.length, hist(raw, (x) => x.body.rawShots), raw.filter((x) => x.body.rawShots > 3).length, r2(mean(raw.map((x) => x.body.rawShots))), hist(kept, (x) => (x.decl.calledShots || []).length), kept.filter((x) => (x.decl.calledShots || []).length > 3).length, r2(mean(kept.map((x) => (x.decl.calledShots || []).length)))];
  }).filter(Boolean)));

  // ---- C1
  p('### C1. Now-card candidates, per check');
  p();
  p('At each check\'s instant (its declarations record\'s mint, or its final update) the open calls are folded into C-6 threads; a thread *needs you* when its newest call is not an upside call, no call in it is answered, and its deadline is ahead. DP-1\'s priority: 1 = a Confirmation (exit, default act) with `counterpart` null; 2 = any other Confirmation; 3 = a called shot the agent plans to hold on; 4 = a live command and nothing above; none otherwise. A *lead change* is a check whose lead (priority and thread, a thread named by its oldest call so a restatement is not a change) differs from the previous check of the same battle.');
  p();
  const needs = (th, t) => { const n = th[0]; return !n.heldAtMint && !th.some((c) => c.playerResponse) && finite(toMs(n.horizon?.expiresAt)) && toMs(n.horizon.expiresAt) > t; };
  const leadOf = (b, t) => {
    const ths = foldAt(b.sub.calls, t).filter((th) => needs(th, t));
    const pick = (f) => ths.find((th) => f(th[0]));
    const p1 = pick((c) => c.kind === 'confirmation' && c.counterpart == null); if (p1) return { pri: 1, th: p1 };
    const p2 = pick((c) => c.kind === 'confirmation'); if (p2) return { pri: 2, th: p2 };
    const p3x = pick((c) => c.kind === 'called_shot' && c.defaultAction === 'hold'); if (p3x) return { pri: 3, th: p3x };
    if (liveCommandsAt(b, t).length) return { pri: 4, th: null };
    return { pri: 'none', th: null };
  };
  const c1 = new Map(); const c1ex = [];
  for (const b of onBattles) {
    const xs = on.filter((x) => x.b === b);
    let prev = null; let prevDay = null;
    for (const x of xs) {
      const lead = leadOf(b, x.atMs); const id = lead.th ? lead.th[lead.th.length - 1].callId : String(lead.pri);
      const key = `${b.id}|${x.day}`; const r = c1.get(key) ?? { b, day: x.day, checks: 0, pri: {}, changes: 0, priChanges: 0 };
      r.checks += 1; inc(r.pri, String(lead.pri));
      if (prev && prevDay === x.day) { if (prev.id !== id) r.changes += 1; if (String(prev.pri) !== String(lead.pri)) r.priChanges += 1; }
      prev = { id, pri: lead.pri }; prevDay = x.day; c1.set(key, r);
      if (lead.th && c1ex.length < 8 && lead.pri === 1) c1ex.push(`${b.acct} \`${short(b.id)}\` ${x.evalId} (${etHm(x.atMs)} ET): priority ${lead.pri} — ${callLine(lead.th[0])}`);
    }
  }
  tbl(['Battle', 'Account', 'ET day', 'Checks', 'Lead = 1 (exit, no replacement)', '2 (Confirmation)', '3 (hold-default shot)', '4 (live command only)', 'none', 'Lead changes (thread)', 'Lead changes (priority only)'], [...c1.values()].sort((a, b) => a.b.acct.localeCompare(b.b.acct) || a.day.localeCompare(b.day) || a.b.id.localeCompare(b.b.id)).map((r) => [`\`${short(r.b.id)}\``, r.b.acct, r.day, r.checks, r.pri['1'] || 0, r.pri['2'] || 0, r.pri['3'] || 0, r.pri['4'] || 0, r.pri.none || 0, r.changes, r.priChanges]));
  const c1tot = (acct) => { const rs = [...c1.values()].filter((r) => r.b.acct === acct); const sum = (f) => rs.reduce((s, r) => s + f(r), 0); return `${acct}: ${sum((r) => r.checks)} checks — lead 1 ×${sum((r) => r.pri['1'] || 0)}, 2 ×${sum((r) => r.pri['2'] || 0)}, 3 ×${sum((r) => r.pri['3'] || 0)}, 4 ×${sum((r) => r.pri['4'] || 0)}, none ×${sum((r) => r.pri.none || 0)}; lead changes ${sum((r) => r.changes)} (priority-only ${sum((r) => r.priChanges)}) over ${sum((r) => r.checks - 1)} consecutive pairs`; };
  p(`- ${ACCOUNT_LABELS.map(c1tot).join('. ')}.`);
  p(`- Examples (priority 1): ${c1ex.length ? c1ex.join('; ') : 'none'}.`);
  p();

  // ---- C2
  p('### C2. Open calls at once (the Also-live strip)');
  p();
  p('At each check\'s instant: the open calls after C-6 folding (threads), upside calls included — the strip holds every open call but the Now card. Per battle: mean and max over its checks.');
  p();
  tbl(['Battle', 'Account', 'ET day', 'Checks', 'Open threads: mean', 'max', 'Open calls (unfolded): mean', 'max', 'Threads needing you: mean', 'max'], onBattles.flatMap((b) => [...new Set(on.filter((x) => x.b === b).map((x) => x.day))].sort().map((d) => {
    const xs = on.filter((x) => x.b === b && x.day === d);
    const th = xs.map((x) => foldAt(b.sub.calls, x.atMs)); const ns = th.map((ts, i) => ts.filter((t) => needs(t, xs[i].atMs)).length);
    const tc = th.map((ts) => ts.length); const cc = th.map((ts) => ts.reduce((s, t) => s + t.length, 0));
    return [`\`${short(b.id)}\``, b.acct, d, xs.length, r1(mean(tc)), Math.max(...tc), r1(mean(cc)), Math.max(...cc), r1(mean(ns)), Math.max(...ns)];
  })));

  // ---- C3
  p('### C3. The replacement step: exits with no usable replacement, and the agent\'s own lists');
  p();
  p('The calls that would show "Who comes in?": Confirmations (exit, default act) and hold-default exit called shots whose `counterpart` is null. At the minting check: the names in the agent\'s anticipation candidates (`candidates[].symbol`) and in its declarations record\'s watch list that the same prompt\'s bench showed as `available`. A check with several such calls counts once per call.');
  p();
  const c3calls = calls.filter((c) => c.kind !== 'pick' && c.direction === 'exit' && c.counterpart == null && (c.kind === 'confirmation' || c.defaultAction === 'hold') && !c.heldAtMint);
  const listsAt = (c) => {
    const x = on.find((y) => y.b === c.b && y.evalId === c.evalId);
    const rows = x?.body?.context ? benchRowsOf(x.body.context) : null;
    if (!rows) return null;
    const avail = new Set(rows.filter((r) => r.status === 'available').map((r) => r.symbol));
    const cand = [...new Set((x.e.candidates || []).map((k) => k?.symbol).filter((s) => avail.has(s)))];
    const watch = [...new Set((x.decl?.watching || []).filter((s) => avail.has(s)))];
    return { avail: [...avail], cand, watch, either: [...new Set([...cand, ...watch])] };
  };
  const c3rows = []; const c3ex = [];
  for (const acct of ACCOUNT_LABELS) for (const d of ON_DAYS) {
    const cs = c3calls.filter((c) => c.b.acct === acct && etDateOf(c.mintedAt) === d);
    if (!cs.length) continue;
    const ls = cs.map(listsAt); const ok = ls.filter(Boolean);
    const ge = (f, n) => ok.filter((l) => f(l).length >= n).length;
    c3rows.push([acct, d, cs.length, cs.filter((c) => c.kind === 'confirmation').length, cs.filter((c) => c.kind !== 'confirmation').length, `${ok.length} of ${cs.length}`, ge((l) => l.avail, 2), `${ge((l) => l.cand, 1)} · ${ge((l) => l.cand, 2)}`, `${ge((l) => l.watch, 1)} · ${ge((l) => l.watch, 2)}`, `${ge((l) => l.either, 1)} · ${ge((l) => l.either, 2)}`, r1(mean(ok.map((l) => l.avail.length)))]);
    for (const [i, c] of cs.entries()) if (c3ex.length < 8 && ls[i]) c3ex.push(`${c.b.acct} \`${short(c.callId)}\` ${callLine(c)} — eyeing (candidates) ${ls[i].cand.join(', ') || 'none'}; watching ${ls[i].watch.join(', ') || 'none'}; bench available ${ls[i].avail.length}`);
  }
  tbl(['Account', 'ET day', 'Exit calls, no replacement', '…Confirmations', '…hold-default shots', 'Prompt bench readable', 'Bench ≥ 2 available', 'Candidates available ≥ 1 · ≥ 2', 'Watch list available ≥ 1 · ≥ 2', 'Either ≥ 1 · ≥ 2', 'Available bench names (mean)'], c3rows);
  p(`- Examples: ${c3ex.length ? c3ex.join('; ') : 'none'}.`);
  // B5: entry calls with a KEPT counterpart — was the counterpart in the call's slot tier at the check? Readable only where the prompt's portfolio CSV carries a Tier column (tiered battles; flat6 drops it).
  const kept = calls.filter((c) => c.kind !== 'pick' && c.direction === 'entry' && c.counterpart != null);
  const tierOf = (ctx, sym) => { const m = new RegExp(`^(star|core|support),${sym},`, 'm').exec(ctx || ''); return m ? m[1] : null; };
  let same = 0; let other = 0; let unreadable = 0;
  for (const c of kept) { const x = on.find((y) => y.b === c.b && y.evalId === c.evalId); const t = tierOf(x?.body?.context, c.counterpart); if (!t) unreadable += 1; else if (t === c.slot) same += 1; else other += 1; }
  p(`- B5 (C-3's entry mint rule vs the filing check counterpart_not_held): entry calls with a kept counterpart ${kept.length}; counterpart in the call's slot tier ${same}, in another tier ${other}, tier unreadable from the stored prompt (no Tier column) ${unreadable}.`);
  p();

  // ---- C4
  p('### C4. Two commands wanted');
  p();
  p('(a) Overrides filed while another call\'s directive was live: the endpoint stores the refusal on the call (`refused.reason = directive_pending`); a chat or chip filing that replaced a live call directive carries a `supersedes` stamp. (b) At each check\'s instant: the threads needing you whose newest call takes an override (every non-upside open call does), by distinct symbol — checks where two or more symbols were open at once.');
  p();
  const refusedRows = calls.filter((c) => c.refused).map((c) => `${c.b.acct} \`${short(c.callId)}\` ${callLine(c)} refused ${etClock(toMs(c.refused.at))} (${c.refused.reason})`);
  const sup = {}; for (const b of onBattles) for (const x of b.doc.chatExchanges || []) if (x?.supersedes && inOn(toMs(x.timestamp))) inc(sup, `${b.acct}:${x.source ?? (nonEmpty(x.userMessage) ? 'chat' : 'chip')}`);
  p(`- (a) Refusals stored (\`directive_pending\`): ${refusedRows.length} — ${refusedRows.join('; ') || 'none'}. Filings that replaced a live call directive (\`supersedes\`), by source: ${tally(sup)}.`);
  const c4rows = []; const c4ex = [];
  for (const acct of ACCOUNT_LABELS) for (const d of ON_DAYS) {
    const xs = on.filter((x) => x.b.acct === acct && x.day === d);
    if (!xs.length) continue;
    let two = 0; let any = 0;
    for (const x of xs) {
      const syms = [...new Set(foldAt(x.b.sub.calls, x.atMs).filter((th) => needs(th, x.atMs)).map((th) => th[0].symbol))];
      if (syms.length >= 1) any += 1;
      if (syms.length >= 2) { two += 1; if (c4ex.length < 8) c4ex.push(`${acct} \`${short(x.b.id)}\` ${x.evalId} (${etHm(x.atMs)} ET): ${syms.join(', ')}`); }
    }
    c4rows.push([acct, d, xs.length, any, two]);
  }
  tbl(['Account', 'ET day', 'Checks', 'Checks with ≥ 1 overrideable symbol', 'Checks with ≥ 2 overrideable symbols'], c4rows);
  p(`- (b) Examples: ${c4ex.length ? c4ex.join('; ') : 'none'}.`);
  p();

  // ---- C5
  p('### C5. Stale commands: the symbol left the book while the command was live');
  p();
  p('Every call-family directive filed in the window, from any route. Live = from its filing until the earliest of its lifetime end, the next directive filing of any kind, or (for a go / pick) its `acted` event. A trade whose `symbolOut` is the command\'s symbol inside that interval, from any source, makes the command stale; the prompts carrying it after are the later checks whose `heard` stamp names its thread.');
  p();
  const c5rows = [];
  for (const b of onBattles) for (const c of commandsOf(b)) {
    if (!inOn(c.ms)) continue;
    const sym = c.d.action?.symbol; const end = Math.min(c.endMs, lifetimeOf(c.d) ?? Infinity);
    const trades = (b.doc.trades || []).map((t) => ({ t, ms: toMs(t.swappedOutAt) })).filter((x) => finite(x.ms) && x.t.symbolOut === sym && x.ms >= c.ms && x.ms <= end).sort((p, q) => p.ms - q.ms);
    const after = trades.length ? (b.doc.evaluations || []).filter((e) => e.heard?.directiveThreadId === c.d.directiveThreadId && (toMs(e.promptBuiltAt) ?? 0) > trades[0].ms).length : 0;
    const heardAll = (b.doc.evaluations || []).filter((e) => e.heard?.directiveThreadId === c.d.directiveThreadId).length;
    c5rows.push([b.acct, `\`${short(b.id)}\``, c.d.kind, cut(c.d.text, 90), etClock(c.ms), etClock(end), heardAll, trades.length ? trades.map((x) => `${x.t.symbolOut}→${x.t.symbolIn} ${etHm(x.ms)} ET (${x.t.source ?? '-'} · ${x.t.trigger ?? x.t.exitReason ?? '-'})`).join('; ') : 'none', after]);
  }
  tbl(['Account', 'Battle', 'Kind', 'Text', 'Filed', 'Live until', 'Prompts that carried it', 'Trades taking its symbol out while live', 'Prompts carrying it after the trade'], c5rows);
  p(`- Commands in the window: ${c5rows.length}; stale: ${c5rows.filter((r) => r[7] !== 'none').length}.`);
  p();

  // ---- C6
  p('### C6. Following your call');
  p();
  p('Calls minted while a live command (C5\'s interval) on the same symbol and direction existed, whose `condition.side` is the answered call\'s; split by whether the new call\'s default matched the command (a `call_go` asks for act, a `call_hold` for hold), and by whether its level is within 1% of the answered call\'s.');
  p();
  const c6 = {}; const c6ex = [];
  for (const c of calls) {
    if (c.kind === 'pick') continue;
    for (const cmd of liveCommandsAt(c.b, c.mintedAt)) {
      const a = cmd.call; if (!a || a.callId === c.callId) continue;
      if (cmd.d.action?.symbol !== c.symbol || cmd.d.action?.direction !== c.direction || a.condition?.side !== c.condition?.side) continue;
      const wanted = cmd.d.kind === 'call_go' ? 'act' : (cmd.d.kind === 'call_hold' ? 'hold' : null);
      const match = wanted === c.defaultAction; const band = levelsWithin(a, c);
      inc(c6, `${c.b.acct} · default ${match ? 'matches' : 'differs'} · level ${band ? 'within 1%' : 'outside 1%'}`);
      if (c6ex.length < 8) c6ex.push(`${c.b.acct} \`${short(c.callId)}\` ${callLine(c)} minted ${etHm(c.mintedAt)} ET under "${cut(cmd.d.text, 70)}" → ${match ? 'matches' : 'differs'}${band ? '' : ', level outside 1%'}; now \`${c.state}\``);
    }
  }
  p(`- Calls minted under a live command on their symbol, direction and side: ${tally(c6)}.`);
  p(`- Examples: ${c6ex.length ? c6ex.join('; ') : 'none'}.`);
  p();

  // ---- C7
  p('### C7. Week 2 beside week 1 (the week-1 read\'s headline rows)');
  p();
  const RECEIPTED = new Set(['hit', 'expired_unresolved', 'ended_with_battle']);
  const SOURCES_FOR = { open: ['mint'], invalidated: ['mint'], hit: ['check'], expired_unresolved: ['check', 'sweep'], ended_with_battle: ['sweep'] };
  const wk = (x) => (WEEK1.includes(x.day) ? 'week 1' : 'week 2');
  const weekOf = (ms) => (WEEK1.includes(etDateOf(ms)) ? 'week 1' : 'week 2');
  const c7 = [];
  for (const g of groupsOn) for (const w of ['week 1', 'week 2']) {
    const xs = on.filter((x) => x.group === g && wk(x) === w);
    if (!xs.length) continue;
    const bd = battleDays(xs); const mc = xs.filter((x) => x.modelCall);
    const cs = calls.filter((c) => c.group === g && weekOf(c.mintedAt) === w); const ds = decls.filter((d) => d.group === g && weekOf(toMs(d.mintedAt)) === w);
    const bs = [...new Set(xs.map((x) => x.b))];
    const ev = {}; for (const b of bs) for (const e of b.sub.callEvents) if (finite(toMs(e.at)) && weekOf(toMs(e.at)) === w) inc(ev, e.kind);
    const st = {}; for (const c of cs) inc(st, c.state);
    const kinds = {}; for (const c of cs) inc(kinds, c.kind === 'pick' ? 'pick' : `${c.kind}:${c.direction}·${c.defaultAction}`);
    const an = cs.filter((c) => c.playerResponse);
    const declKey = new Set(bs.flatMap((b) => b.sub.declarations.map((d) => `${b.id}|${d.evalId}`)));
    const pubGap = xs.filter((x) => x.declaring && !declKey.has(`${x.b.id}|${x.evalId}`)).length;
    const miss = {}; for (const c of cs) for (const f of ['heldAtMint', 'counterpartRaw', 'saidOk', 'mintedMode']) if (!(f in c)) inc(miss, f); for (const d of ds) for (const f of ['watchingSource', 'mintedMode']) if (!(f in d)) inc(miss, f);
    const viol = {};
    for (const c of cs) {
      const evs = new Set(c.b.sub.callEvents.map((e) => e.id)); const r = c.b.sub.callObservations.find((o) => o.id === c.callId) ?? null;
      if (RECEIPTED.has(c.state) && !r) inc(viol, 'terminal_without_receipt');
      if (!RECEIPTED.has(c.state) && r) inc(viol, 'receipt_on_non_terminal');
      if (!(SOURCES_FOR[c.state] || []).includes(c.stateSource)) inc(viol, 'state_source_mismatch');
      if (c.state === 'expired_unresolved' && !evs.has(`${c.callId}:expired`)) inc(viol, 'expired_without_event');
      if (c.state === 'ended_with_battle' && !evs.has(`${c.callId}:ended`)) inc(viol, 'ended_without_event');
      if (c.playerResponse && ![...evs].some((k) => k.startsWith(`${c.callId}:answered:`))) inc(viol, 'answer_without_event');
      if (c.playerResponse?.heardEvalId && !evs.has(`${c.callId}:heard:${c.playerResponse.heardEvalId}`)) inc(viol, 'heard_without_event');
      if (c.state === 'open' && c.b.doc.status !== 'active') inc(viol, 'open_under_completed_battle');
    }
    const lag = cs.map((c) => { const r = c.b.sub.callObservations.find((o) => o.id === c.callId); return r?.source === 'sweep' && r.reason === 'past_deadline' ? minutes(toMs(c.horizon?.expiresAt), r.observedAtMs) : null; }).filter(finite);
    c7.push([g, w, bd.length, xs.length, mc.length, xs.filter((x) => x.refused).length, fmtRate(mc.filter((x) => x.timeout).length, mc.length), mc.filter((x) => x.e.haikuError?.failureClass === 'invalid_tool_result').length,
      r2(xs.filter((x) => x.declaring).length / bd.length), r2(cs.length / bd.length), tally(kinds), `${an.length} (${an.filter((c) => c.playerResponse.kind === 'directive').length} overrides, ${an.filter((c) => c.playerResponse.kind === 'ack').length} agreements)`, tally(ev), tally(st), cs.filter((c) => c.outcome?.actedEvalId).length,
      `publication gaps ${pubGap}; Amendment C fields missing ${tally(miss)}; integrity ${Object.keys(viol).length ? tally(viol) : '0'}; sweep lag past_deadline (min) ${dist(lag)}`]);
  }
  tbl(['Account · archetype', 'Week', 'Battle-days', 'Checks', 'Model calls', 'API-refused', 'Timeouts', 'invalid_tool_result', 'Declaring checks / battle-day', 'Calls / battle-day', 'Calls by kind · direction · default', 'Answered', 'Call events by kind', 'Call states at read', 'Acted (`actedEvalId`)', 'Anything broken'], c7);

  const md = L.join('\n');
  if (argOf('--out')) writeFileSync(path.resolve(PROJECT_ROOT, argOf('--out')), `${md}\n`); else console.log(md);
  console.error(`[build2b] head=${head.slice(0, 8)} battles=${F.inScope.length} onChecks=${on.length} calls=${calls.length} decls=${decls.length}`);
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main().catch((err) => { console.error(err); process.exit(1); });
