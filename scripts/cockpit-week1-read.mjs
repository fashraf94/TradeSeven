// scripts/cockpit-week1-read.mjs
//
// Cockpit live week 1 — the week's read. The two allowlisted accounts' battles
// on the ET sessions 2026-10-06 … 2026-10-09 (the first week after PR #931 set
// CALL_RECORDS_MODE 'on' + COCKPIT_UI_ENABLED true), with the same accounts'
// pre-flip battles beside them where they exist. Report of record:
// docs/audits/20261009_COCKPIT_LIVE_WEEK1_READ.md (sections A–H are this
// script's output). The rollback safety check itself is
// scripts/shadow-read-call-records.mjs --rollback-check; this script does not
// repeat it.
//
// READ-ONLY BY CONSTRUCTION. Firestore Admin SDK calls here are `.get()` and
// `getAll()` reads only — no set, update, delete, create, runTransaction, batch
// or bulkWriter (grep it). git calls are `rev-parse`, `log`, `diff` and
// `check-ignore` only. No API call of any other kind. The only files written
// are --out (the generated tables) and --raw (the raw dump), and --raw refuses
// any path inside the tree that git does not ignore.
//
// THE ACCOUNTS. The two owner uids come from COCKPIT_ALLOWLIST_UIDS in the
// shell for this run only (the variable the server reads; never committed):
// first = "founder", second = "FT_QA". No uid is ever printed — every table
// names the account by its label. The raw dump (git-ignored) carries the
// documents as read, owner fields included; nothing raw is committed.
//
// CREDENTIALS — the existing loaders: scripts/loadLocalEnv.js (.env.local →
// process.env) + api/_utils/firebaseAdmin.js getFirebaseAdmin().
//
// USAGE (repo root):
//   COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA> node scripts/cockpit-week1-read.mjs \
//     [--out <tables.md>] [--raw reads-raw/cockpit-week1] [--ref <rev>]
//   --ref: the git revision whose first-parent merges section A lists (default HEAD;
//   on a report branch pass origin/main so the branch's own commits are not read as main's).
//
// DETERMINISTIC: the same Firestore state and the same --ref print the same bytes,
// except the read instant and the sweep cursor's own clock (`callSweepState`).

import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PROJECT_ROOT } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { etDateOf } from '../api/_utils/callRecords/horizon.js';
// The pre-Build-1a integrity checks the shadow read still runs (H.6 explains its counts).
import { integrityViolations as legacyIntegrityViolations } from './shadow-read-call-records.mjs';

// ---------------------------------------------------------------- constants

export const WEEK_DAYS = Object.freeze(['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
/** The pre-flip comparison starts at the shadow read's baseline week. */
export const PRE_FLIP_FIRST_DAY = '2026-09-21';
const SCOPE_FLOOR_MS = Date.parse('2026-09-21T00:00:00Z');
export const FLIP_PR = 931;
export const ACCOUNT_LABELS = Object.freeze(['founder', 'FT_QA']);
const SUBCOLLECTIONS = ['calls', 'declarations', 'callEvents', 'callObservations', 'ticks', 'tickBodies'];
/** Contract V1.4 §6 + Amendment B §7: the terminal states that carry a receipt. */
const RECEIPTED = new Set(['hit', 'expired_unresolved', 'ended_with_battle']);
/** The state → stateSource pairs the writers produce (flip.js, sweep.js, publish.js). */
const SOURCES_FOR = { open: ['mint'], invalidated: ['mint'], hit: ['check'], expired_unresolved: ['check', 'sweep'], ended_with_battle: ['sweep'] };
/** Amendment C-6 (cockpitModel.js:50): the level tolerance, against the NEWER call's level. */
const THREAD_LEVEL_TOLERANCE = 0.01;
/** The bench block's header in the evaluator's context (scripts/build2-discovery-counts.mjs:113). */
const BENCH_HEADER = 'BENCH (available for swap):';

/** Path → area, for section A. Tests, fixtures and docs never count. */
export const AREAS = Object.freeze([
  ['evaluator', /^api\/cron\/agent-evaluate\.js$|^api\/agent\/decide\.js$|^api\/_utils\/(agentEvalPromptAssembly|agentPromptAssembly|agentEvalToolSchema|agentEvalToolResultValidation)\.js$/],
  ['swap execution', /^api\/_utils\/(agentSwapExecution|swapIdentity|executionAuthority|executorMetadata|landedTrade)\.js$/],
  ['calls pipeline', /^api\/_utils\/callRecords\/|^api\/agent\/call-response\.js$|^api\/_utils\/directive(Writer|Utils)\.js$|^api\/cron\/process-pending-reflections\.js$/],
  ['cockpit', /^src\/screens\/battleView\/(cockpit|Cockpit)|^src\/screens\/AgentBattleScreen\.jsx$|^api\/agent\/cockpit-status\.js$/],
  ['chat', /^api\/agent\/chat\.js$|AgentChat[^/]*\.jsx?$/],
  ['battle view (shared)', /^src\/screens\/battleView\//],
]);
const NOT_CODE = /(^docs\/)|(\.test\.)|(__fixtures__)|(^test\/)|(\.md$)/;

// ---------------------------------------------------------------- pure helpers

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}
const etTimeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
const etClock = (ms) => (finite(ms) ? `${etDateOf(ms)} ${etTimeFmt.format(new Date(ms))} ET` : 'n/a');
const etHm = (ms) => (finite(ms) ? etTimeFmt.format(new Date(ms)) : 'n/a');
/** Nearest-rank percentile (the shadow read's convention); null on an empty list. */
export function pct(values, p) {
  const xs = values.filter(finite).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.min(xs.length - 1, Math.max(0, Math.ceil((p / 100) * xs.length) - 1))];
}
/** Median as the mean of the two middle values on an even count. */
export function median(values) {
  const xs = values.filter(finite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}
const r2 = (v) => (v == null ? 'n/a' : (Number.isInteger(v) ? String(v) : v.toFixed(2)));
/** "mean · median · min–max (n)" over a list of per-unit counts. */
export function dist(values) {
  if (!values.length) return 'n/a (no unit)';
  const sum = values.reduce((s, v) => s + v, 0);
  return `${r2(sum / values.length)} · ${r2(median(values))} · ${Math.min(...values)}–${Math.max(...values)} (n=${values.length})`;
}
const fmtRate = (num, den) => (den ? `${num} / ${den} (${((100 * num) / den).toFixed(2)}%)` : `${num} / 0`);
const inc = (obj, key, by = 1) => { obj[key] = (obj[key] || 0) + by; return obj; };
const tally = (obj) => (Object.keys(obj).length ? Object.keys(obj).sort().map((k) => `\`${k}\` ×${obj[k]}`).join(', ') : 'none');
const byKey = (k) => (a, b) => String(a[k]).localeCompare(String(b[k]));
const short = (id) => (typeof id === 'string' ? id.replace(/^([A-Za-z0-9]{5})[A-Za-z0-9]{15}:/, '$1…:').replace(/^([A-Za-z0-9]{5})[A-Za-z0-9]{15}$/, '$1…') : String(id));
const minutes = (a, b) => (finite(a) && finite(b) ? Math.round(((b - a) / 60000) * 10) / 10 : null);

/** Amendment C-6's key (cockpitModel.js:119-124): ET day, symbol, direction, slot, side, default action. */
export function threadKeyOf(call) {
  const minted = toMs(call?.mintedAt);
  const side = call?.condition?.side;
  const ok = (v) => typeof v === 'string' && v.length > 0;
  if (minted === null || !ok(call?.symbol) || !ok(call?.direction) || !ok(call?.slot) || !ok(side) || !ok(call?.defaultAction)) return null;
  return `${etDateOf(minted)}|${call.symbol}|${call.direction}|${call.slot}|${side}|${call.defaultAction}`;
}
/** C-6 (cockpitModel.js:127-132): levels within 1 %, measured against the NEWER call's level. */
export function levelsWithin(older, newer) {
  const a = older?.condition?.level; const b = newer?.condition?.level;
  if (!finite(a) || !finite(b) || b === 0) return false;
  return Math.abs(a - b) / Math.abs(b) <= THREAD_LEVEL_TOLERANCE;
}
/** Was the call open at instant t? (Open from mint until its state changed; a call minted resolved never was.) */
export function openAt(call, t) {
  const minted = toMs(call.mintedAt);
  if (!finite(minted) || minted > t) return false;
  if (call.state === 'open') return true;
  if (call.stateSource === 'mint') return false;
  const changed = toMs(call.stateChangedAt);
  return finite(changed) && changed > t;
}
/**
 * C-6 restatements, by the open set at each mint: a call RESTATES when an older
 * call of the same battle, key and level band (against the newer) was still
 * open when it was minted. Threads = the connected sets those links form.
 */
export function restatements(calls) {
  const list = [...calls].sort((a, b) => a.mintedAt - b.mintedAt || a.callId.localeCompare(b.callId));
  const parent = list.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const restated = new Set();
  for (let j = 0; j < list.length; j += 1) {
    const kj = threadKeyOf(list[j]);
    if (kj === null) continue;
    for (let i = 0; i < j; i += 1) {
      if (list[i].battleId !== list[j].battleId || threadKeyOf(list[i]) !== kj) continue;
      if (openAt(list[i], list[j].mintedAt) && levelsWithin(list[i], list[j])) { restated.add(list[j].callId); parent[find(i)] = find(j); }
    }
  }
  const groups = new Map();
  list.forEach((c, i) => { const r = find(i); groups.set(r, [...(groups.get(r) || []), c]); });
  return { restated, threads: [...groups.values()].filter((g) => g.length > 1) };
}

/** One CSV block's rows by its header (scripts/build2-discovery-counts.mjs:165-173, csvSymbols; :863-870, benchRows' CSV part). */
export function benchRowsOf(text) {
  const i = typeof text === 'string' ? text.indexOf(`${BENCH_HEADER}\n`) : -1;
  if (i < 0) return null;
  const lines = text.slice(i).split('\n\n')[0].split('\n');
  const cols = (lines[1] || '').split(',');
  const sym = cols.indexOf('Symbol'); const st = cols.indexOf('Status');
  if (sym < 0 || st < 0) return null;
  return lines.slice(2).map((l) => { const f = l.split(','); return { symbol: (f[sym] || '').trim(), status: f.slice(st).join(',').trim() }; }).filter((r) => r.symbol);
}

/** The model request's context text and the response's stop_reason from a tick body (undefined = unreadable). */
export function readTickBody(body) {
  const out = { context: undefined, stopReason: undefined };
  try {
    const req = JSON.parse(body?.request?.body ?? 'null');
    if (req && Array.isArray(req.messages)) {
      out.context = req.messages.filter((m) => m?.role === 'user').map((m) => (typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((c) => c?.text ?? '').join('\n') : ''))).join('\n\n');
    }
  } catch { /* unreadable request */ }
  try {
    const res = JSON.parse(body?.response?.body ?? 'null');
    if (res && typeof res === 'object') out.stopReason = res.stop_reason ?? null;
  } catch { /* unreadable response */ }
  return out;
}

/** Section A: which areas a merge's code files touch. */
export function areasOf(files) {
  const out = {};
  for (const f of files) {
    if (NOT_CODE.test(f)) continue;
    const hit = AREAS.find(([, re]) => re.test(f));
    if (hit) (out[hit[0]] ||= []).push(f);
  }
  return out;
}

// ---------------------------------------------------------------- reads

const git = (args) => execFileSync('git', args, { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();

function readGit(ref) {
  const head = git(['rev-parse', ref]);
  const all = git(['log', '--merges', '--first-parent', '--format=%H%x09%cI%x09%s', head]).split('\n').filter(Boolean)
    .map((l) => { const [sha, at, subject] = l.split('\t'); return { sha, at, subject, pr: Number((/#(\d+)/.exec(subject) || [])[1]) }; });
  const idx = all.findIndex((m) => m.pr === FLIP_PR && subjectIsPr(m.subject, FLIP_PR));
  if (idx < 0) throw new Error(`no first-parent merge of PR #${FLIP_PR} in ${ref}'s history`);
  const detail = (m) => {
    const files = git(['diff', '--name-only', `${m.sha}^1`, m.sha]).split('\n').filter(Boolean);
    const flags = git(['diff', `${m.sha}^1`, m.sha, '--', 'src/config/featureFlags.js']).split('\n')
      .map((l) => /^([-+])export const (\w+) = (.+);$/.exec(l)).filter(Boolean).map(([, sign, name, value]) => `${sign}${name} = ${value}`);
    return { ...m, files, codeFiles: files.filter((f) => !NOT_CODE.test(f)), areas: areasOf(files), flags };
  };
  const direct = git(['log', '--first-parent', '--no-merges', '--format=%h %cI %s', `${all[idx].sha}..${head}`]).split('\n').filter(Boolean);
  return { head, flip: detail(all[idx]), merges: all.slice(0, idx).reverse().map(detail), direct };
}
const subjectIsPr = (subject, n) => new RegExp(`^Merge pull request #${n} `).test(subject);

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
  const refs = inScope.map((b) => db.collection('callSweepQueue').doc(b.id));
  const queue = refs.length ? (await db.getAll(...refs)).filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() })) : [];
  const st = await db.collection('callSweepState').doc('singleton').get();
  return { total: battles.size, totalBy: ACCOUNT_LABELS.map((a) => [...battles.values()].filter((b) => b.acct === a).length), inScope, queue, sweepState: st.exists ? st.data() : null };
}

function writeRaw(dir, payload) {
  const abs = path.resolve(PROJECT_ROOT, dir);
  const rel = path.relative(PROJECT_ROOT, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    try { execFileSync('git', ['check-ignore', '-q', rel.split(path.sep).join('/') + '/x'], { cwd: PROJECT_ROOT }); }
    catch { throw new Error(`--raw ${dir} is inside the tree and not git-ignored — nothing raw may be committable`); }
  }
  mkdirSync(abs, { recursive: true });
  const conv = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toMillis === 'function' ? { __ts: x.toMillis() } : x));
  writeFileSync(path.join(abs, 'cockpit-week1-raw.json'), conv(payload));
}

// ---------------------------------------------------------------- the read

async function main() {
  const args = process.argv.slice(2);
  const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const uids = (process.env.COCKPIT_ALLOWLIST_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (uids.length !== 2) throw new Error('COCKPIT_ALLOWLIST_UIDS must hold exactly two uids for this run: <founder>,<FT_QA>');
  const ref = argOf('--ref') ?? 'HEAD';
  const G = readGit(ref);
  const flipMs = Date.parse(G.flip.at);
  const db = getFirebaseAdmin();
  const readAtMs = Date.now();
  const F = await readFirestore(db, uids);
  if (argOf('--raw')) writeRaw(argOf('--raw'), { readAtMs, head: G.head, battles: F.inScope, queue: F.queue, sweepState: F.sweepState });

  // ------------------------------------------------------------ indexes
  const groupOf = (b) => `${b.acct} · ${b.doc.agentContext?.archetype ?? 'unknown'}`;
  const byId = new Map(F.inScope.map((b) => [b.id, b]));
  const entries = [];
  for (const b of F.inScope) {
    for (const e of Array.isArray(b.doc.evaluations) ? b.doc.evaluations : []) {
      const ms = toMs(e?.timestamp) ?? toMs(e?.promptBuiltAt);
      if (ms === null) continue;
      const day = etDateOf(ms);
      const window = WEEK_DAYS.includes(day) ? 'week' : (ms < flipMs && day >= PRE_FLIP_FIRST_DAY ? ('declarationsPhase' in e ? 'pre-flip · shadow' : 'pre-flip · off') : null);
      if (window) entries.push({ b, e, ms, day, window, group: groupOf(b) });
    }
  }
  const bodies = new Map();
  for (const b of F.inScope) for (const t of b.sub.tickBodies) if (t.evalId) bodies.set(`${b.id}|${t.evalId}`, t);
  const bodyCache = new Map();
  const bodyOf = (bid, evalId) => {
    const k = `${bid}|${evalId}`;
    if (!bodyCache.has(k)) bodyCache.set(k, bodies.has(k) ? readTickBody(bodies.get(k)) : null);
    return bodyCache.get(k);
  };
  const inWeek = (ms) => finite(ms) && WEEK_DAYS.includes(etDateOf(ms));
  const calls = F.inScope.flatMap((b) => b.sub.calls.map((c) => ({ ...c, b, group: groupOf(b) }))).filter((c) => inWeek(toMs(c.mintedAt))).sort((x, y) => x.mintedAt - y.mintedAt || x.callId.localeCompare(y.callId));
  const decls = F.inScope.flatMap((b) => b.sub.declarations.map((d) => ({ ...d, b, group: groupOf(b) }))).filter((d) => inWeek(toMs(d.mintedAt))).sort((x, y) => x.mintedAt - y.mintedAt || x.b.id.localeCompare(y.b.id));
  const eventsOf = (b) => new Map(b.sub.callEvents.map((ev) => [ev.id, ev]));
  const receiptOf = (c) => c.b.sub.callObservations.find((o) => o.id === c.callId) ?? null;
  const weekEntries = entries.filter((x) => x.window === 'week');
  const groups = [...new Set(entries.map((x) => x.group))].sort();
  const weekGroups = [...new Set(weekEntries.map((x) => x.group))].sort();
  const battleDays = (xs) => [...new Set(xs.map((x) => `${x.b.id}|${x.day}`))].sort();

  // ------------------------------------------------------------ output
  const L = [];
  const p = (s = '') => L.push(s);
  const tbl = (head, rows) => { p(`| ${head.join(' | ')} |`); p(`|${head.map(() => '---').join('|')}|`); for (const r of rows) p(`| ${r.map((v) => String(v ?? 'n/a')).join(' | ')} |`); p(); };

  p('## Generated tables (`scripts/cockpit-week1-read.mjs`)');
  p();
  p(`Read at ${new Date(readAtMs).toISOString()} (${etClock(readAtMs)}) · git \`${ref}\` = \`${G.head.slice(0, 8)}\` · #${FLIP_PR} merged ${G.flip.at} (\`${G.flip.sha.slice(0, 8)}\`). Battles owned by the two accounts: ${F.total} (founder ${F.totalBy[0]}, FT_QA ${F.totalBy[1]}); read in full (expiry on/after ${PRE_FLIP_FIRST_DAY}, or active): ${F.inScope.length}. Week = ET sessions ${WEEK_DAYS.join(', ')}; pre-flip = ${PRE_FLIP_FIRST_DAY} up to the #${FLIP_PR} merge instant, split by whether the entry carries \`declarationsPhase\` (the shadow era) or not.`);
  p();
  tbl(['Account · archetype', 'Window', 'Battles', 'Battle-days', 'Evaluation entries', 'ET days'], groups.flatMap((g) => ['week', 'pre-flip · shadow', 'pre-flip · off'].map((w) => {
    const xs = entries.filter((x) => x.group === g && x.window === w);
    return xs.length ? [g, w, new Set(xs.map((x) => x.b.id)).size, battleDays(xs).length, xs.length, [...new Set(xs.map((x) => x.day))].sort().join(', ')] : null;
  }).filter(Boolean)));
  const activeAtRead = F.inScope.filter((b) => b.doc.status === 'active');
  const noEval = F.inScope.filter((b) => !(b.doc.evaluations || []).length);
  p(`- Active at read: ${activeAtRead.length ? activeAtRead.map((b) => `${b.acct} \`${short(b.id)}\` (expires ${etClock(toMs(b.doc.expiresAt))})`).join('; ') : 'none'}. Battles in scope with no evaluation entry: ${noEval.length ? noEval.map((b) => `${b.acct} \`${short(b.id)}\` (created ${etClock(toMs(b.doc.createdAt))}, expires ${etClock(toMs(b.doc.expiresAt))}, status ${b.doc.status})`).join('; ') : 'none'}.`);
  p();

  // ---- A
  p('### A. Merges to main since #931');
  p();
  const firstWeekPhase = weekEntries.filter((x) => 'declarationsPhase' in x.e).sort((x, y) => x.ms - y.ms)[0];
  p(`- #${FLIP_PR} (\`${G.flip.sha.slice(0, 8)}\`, ${G.flip.at} = ${etClock(flipMs)}): flags ${G.flip.flags.join(' · ') || 'none'}. First week entry carrying \`declarationsPhase\` (the earliest proof the flip was deployed): ${firstWeekPhase ? `${firstWeekPhase.b.acct} \`${short(firstWeekPhase.b.id)}\` ${firstWeekPhase.e.evalId} at ${etClock(firstWeekPhase.ms)}` : 'none'}. Merge times are not deploy times; no deploy record is read.`);
  p(`- Direct (non-merge) commits on main's first-parent line since #${FLIP_PR}: ${G.direct.length ? G.direct.join('; ') : 'none'}.`);
  p();
  tbl(['PR', 'Merged (ET)', 'Title', 'Code files', 'Areas touched (non-test code)', 'Flag lines changed'], G.merges.map((m) => [
    `#${m.pr}`, etClock(Date.parse(m.at)), m.subject.replace(/^Merge pull request #\d+ from \S+/, '').trim() || m.subject.split(' from ')[1], m.codeFiles.length,
    Object.keys(m.areas).length ? Object.entries(m.areas).map(([a, fs]) => `${a}: ${fs.map((f) => `\`${f.split('/').pop()}\``).join(', ')}`).join('; ') : 'none of the five',
    m.flags.length ? m.flags.map((f) => `\`${f}\``).join(' ') : '—',
  ]));
  tbl(['ET session', 'First · last week check (any account)', 'Merged before the first check', 'Merged between the first and last check'], WEEK_DAYS.map((d) => {
    const xs = weekEntries.filter((x) => x.day === d).sort((a, b) => a.ms - b.ms);
    const first = xs[0]?.ms; const last = xs[xs.length - 1]?.ms;
    const prs = (f) => G.merges.filter((m) => f(Date.parse(m.at))).map((m) => `#${m.pr}`).join(' ') || '—';
    return [d, first ? `${etHm(first)} · ${etHm(last)} ET` : 'no entry', first ? prs((t) => t < first) : 'n/a', first ? prs((t) => t >= first && t <= last) : 'n/a'];
  }));

  // ---- B
  p('### B. Health (model calls), week vs the same accounts’ pre-flip battles — descriptive');
  p();
  const healthRow = (xs) => {
    const called = xs.filter((x) => finite(x.e.callMs));
    const fc = (x) => x.e.haikuError?.failureClass ?? null;
    const ok = called.filter((x) => !x.e.haikuError);
    const stops = called.map((x) => bodyOf(x.b.id, x.e.evalId)?.stopReason);
    const read = stops.filter((s) => s !== undefined);
    const other = {}; for (const x of xs) if (fc(x) && !['invalid_tool_result', 'truncated_response', 'timeout'].includes(fc(x))) inc(other, fc(x));
    return {
      bd: battleDays(xs).length, entries: xs.length, calls: called.length,
      invalid: called.filter((x) => fc(x) === 'invalid_tool_result').length,
      trunc: called.filter((x) => fc(x) === 'truncated_response').length,
      timeout: called.filter((x) => fc(x) === 'timeout').length,
      maxTok: stops.filter((s) => s === 'max_tokens').length, bodiesRead: read.length,
      p50: pct(called.map((x) => x.e.callMs), 50), p95: pct(called.map((x) => x.e.callMs), 95),
      cand: ok.length ? ok.reduce((s, x) => s + (Array.isArray(x.e.candidates) ? x.e.candidates.length : 0), 0) / ok.length : null, ok: ok.length, other,
    };
  };
  const healthRows = [];
  for (const g of groups) for (const w of ['week', 'pre-flip · shadow', 'pre-flip · off']) {
    const xs = entries.filter((x) => x.group === g && x.window === w);
    if (xs.length) healthRows.push([g, w, healthRow(xs)]);
  }
  tbl(['Account · archetype', 'Window', 'Battle-days', 'Model calls', 'invalid_tool_result', 'max_tokens stops (bodies read)', 'truncated_response', 'Timeouts', 'callMs p50', 'callMs p95', 'Candidates / model-ok check'],
    healthRows.map(([g, w, h]) => [g, w, h.bd, h.calls, fmtRate(h.invalid, h.calls), `${h.maxTok} (${h.bodiesRead} of ${h.calls})`, h.trunc, fmtRate(h.timeout, h.calls), h.p50, h.p95, `${r2(h.cand)} (${h.ok})`]));
  p(`- Other failure classes (every entry, model call or not): ${healthRows.map(([g, w, h]) => `${g} ${w}: ${tally(h.other)}`).join('; ')}.`);
  const msgs = {}; for (const x of entries) { const he = x.e.haikuError; if (he && /^\d{3}$/.test(String(he.failureClass))) inc(msgs, `${x.window} · ${x.group} · ${he.failureClass}: ${String(he.message ?? '').replace(/^\d{3}\s*/, '').replace(/[`|]/g, '').slice(0, 110)}…`); }
  p(`- HTTP-status failures by message: ${tally(msgs)}.`);
  const inv = {}; for (const x of entries) if (x.e.haikuError?.failureClass === 'invalid_tool_result') inc(inv, `${x.window} · ${x.group}: ${x.e.haikuError.invalidField ?? 'n/a'}`);
  p(`- \`invalid_tool_result\` by the field that failed: ${tally(inv)}.`);
  p();
  tbl(['Account · archetype', 'ET day', 'Model calls', 'invalid_tool_result', 'Timeouts', 'HTTP-status failures', 'First · last failure (ET)'], weekGroups.flatMap((g) => WEEK_DAYS.map((d) => {
    const xs = weekEntries.filter((x) => x.group === g && x.day === d && finite(x.e.callMs));
    if (!xs.length) return null;
    const failed = xs.filter((x) => x.e.haikuError).sort((a, b) => a.ms - b.ms);
    return [g, d, xs.length, xs.filter((x) => x.e.haikuError?.failureClass === 'invalid_tool_result').length, xs.filter((x) => x.e.haikuError?.failureClass === 'timeout').length,
      xs.filter((x) => /^\d{3}$/.test(String(x.e.haikuError?.failureClass))).length, failed.length ? `${etHm(failed[0].ms)} · ${etHm(failed[failed.length - 1].ms)}` : '—'];
  }).filter(Boolean)));
  p('- A model call is an entry with a finite `callMs`. `max_tokens` is read per check from the tick body\'s `response.body.stop_reason` (`cronState.callsDiag.truncated` holds only the latest check); a body that is absent or unreadable is left out of that column\'s denominator.');
  p();

  // ---- C
  p('### C. Declarations (week)');
  p();
  const dayRows = (g) => battleDays(weekEntries.filter((x) => x.group === g)).map((k) => {
    const [bid, day] = k.split('|');
    const es = weekEntries.filter((x) => x.b.id === bid && x.day === day);
    const ds = decls.filter((d) => d.b.id === bid && etDateOf(toMs(d.mintedAt)) === day);
    const cs = calls.filter((c) => c.b.id === bid && etDateOf(c.mintedAt) === day);
    return { bid, day, declaring: es.filter((x) => x.e.declarationsPhase === 'expected').length, records: ds.length, watchOnly: ds.filter((d) => !(d.minted || []).length).length, minted: cs.length, checks: es.length };
  });
  tbl(['Account · archetype', 'Battle-days', 'Declaring checks / battle-day', 'Declarations records / battle-day', '…of them watching-only', 'Calls minted / battle-day', 'Checks / battle-day'],
    weekGroups.map((g) => { const rs = dayRows(g); return [g, rs.length, dist(rs.map((r) => r.declaring)), dist(rs.map((r) => r.records)), rs.reduce((s, r) => s + r.watchOnly, 0), dist(rs.map((r) => r.minted)), dist(rs.map((r) => r.checks))]; }));
  tbl(['Battle', 'Account', 'ET day', 'Checks', 'Declaring', 'Records', 'Calls minted'], weekGroups.flatMap((g) => dayRows(g).map((r) => [`\`${short(r.bid)}\``, byId.get(r.bid).acct, r.day, r.checks, r.declaring, r.records, r.minted])));
  const cRow = (g, f) => { const o = {}; for (const c of calls.filter((x) => x.group === g)) inc(o, f(c)); return tally(o); };
  tbl(['Account · archetype', 'Calls', 'Kind', 'Direction · default (called shots + confirmations)', 'Upside calls (`heldAtMint`)', '`saidOk`', '`mintedMode`'], weekGroups.map((g) => [
    g, calls.filter((c) => c.group === g).length, cRow(g, (c) => c.kind), cRow(g, (c) => (c.kind === 'pick' ? 'pick' : `${c.direction} · ${c.defaultAction}`)),
    cRow(g, (c) => `${c.kind}:${c.heldAtMint === undefined ? 'missing' : c.heldAtMint}`), cRow(g, (c) => (c.saidOk === undefined ? 'missing' : String(c.saidOk))), cRow(g, (c) => String(c.mintedMode)),
  ]));
  const cp = (c) => (c.counterpart != null ? 'kept' : (c.counterpartRaw != null ? 'nulled (raw kept)' : 'absent'));
  tbl(['Account · archetype', 'Direction', 'Counterpart kept', 'Nulled (raw kept)', 'Absent', '`counterpartRaw` values (nulled)', 'Kept values'], weekGroups.flatMap((g) => ['exit', 'entry'].map((dir) => {
    const cs = calls.filter((c) => c.group === g && c.kind !== 'pick' && c.direction === dir);
    const raw = {}; const kept = {};
    for (const c of cs) { if (cp(c) === 'nulled (raw kept)') inc(raw, c.counterpartRaw); if (cp(c) === 'kept') inc(kept, c.counterpart); }
    return [g, dir, cs.filter((c) => cp(c) === 'kept').length, cs.filter((c) => cp(c) === 'nulled (raw kept)').length, cs.filter((c) => cp(c) === 'absent').length, tally(raw), tally(kept)];
  })));
  const dRow = (g, f) => { const o = {}; for (const d of decls.filter((x) => x.group === g)) f(d, o); return tally(o); };
  tbl(['Account · archetype', 'Records', '`watchingSource`', 'Non-empty watch list', 'Validator removals (`source:reason`)', '`mintedMode`'], weekGroups.map((g) => [
    g, decls.filter((d) => d.group === g).length, dRow(g, (d, o) => inc(o, d.watchingSource === undefined ? 'missing' : String(d.watchingSource))),
    decls.filter((d) => d.group === g && (d.watching || []).length).length,
    dRow(g, (d, o) => { for (const r of d.removed || []) inc(o, `${r.source}:${r.reason}`); for (const r of d.removedOverflow || []) inc(o, `${r.source}:${r.reason}`, r.count); }),
    dRow(g, (d, o) => inc(o, String(d.mintedMode))),
  ]));
  const R = restatements(calls);
  tbl(['Account · archetype', 'ET day', 'Calls minted', 'Restated calls (C-6, joined an open thread at mint)', 'Threads of ≥ 2 calls', 'Largest thread'], weekGroups.flatMap((g) => WEEK_DAYS.map((d) => {
    const cs = calls.filter((c) => c.group === g && etDateOf(c.mintedAt) === d);
    if (!cs.length) return null;
    const th = R.threads.filter((t) => t[0].group === g && etDateOf(t[0].mintedAt) === d);
    return [g, d, cs.length, cs.filter((c) => R.restated.has(c.callId)).length, th.length, th.length ? Math.max(...th.map((t) => t.length)) : 0];
  }).filter(Boolean)));

  // ---- D
  p('### D. Answers (week)');
  p();
  const answered = calls.filter((c) => c.playerResponse);
  tbl(['Account', 'Battle', 'Call', 'Kind · direction · default', 'Answer', 'Type', 'Mint → answer (min)', 'Filed', 'heardEvalId'], answered.map((c) => [
    c.b.acct, `\`${short(c.b.id)}\``, `${c.symbol} ${c.condition?.side} ${c.condition?.level} (\`${c.callId.split(':').slice(1).join(':')}\`)`, `${c.kind} · ${c.direction} · ${c.defaultAction}`,
    `\`${c.playerResponse.answer}\``, c.playerResponse.kind === 'directive' ? 'override (directive, 1 message)' : 'agree (acknowledgment, free)',
    minutes(c.mintedAt, toMs(c.playerResponse.filedAt)), etClock(toMs(c.playerResponse.filedAt)), c.playerResponse.heardEvalId ?? 'null',
  ]));
  tbl(['Account · archetype', 'Calls', 'Answered', 'Overrides', 'Agreements', 'By answer', 'Refused (`refused` stored)', 'Mint → answer, min (mean · median · min–max)'], weekGroups.map((g) => {
    const cs = calls.filter((c) => c.group === g); const an = cs.filter((c) => c.playerResponse);
    const by = {}; for (const c of an) inc(by, `${c.playerResponse.answer}`);
    const rf = {}; for (const c of cs) if (c.refused) inc(rf, c.refused.reason);
    return [g, cs.length, an.length, an.filter((c) => c.playerResponse.kind === 'directive').length, an.filter((c) => c.playerResponse.kind === 'ack').length, tally(by), tally(rf), dist(an.map((c) => minutes(c.mintedAt, toMs(c.playerResponse.filedAt))).filter(finite))];
  }));
  const weekBattles = [...new Set(weekEntries.map((x) => x.b))].sort(byKey('id'));
  tbl(['Account · archetype', 'Battles', 'Messages charged (`chatBudgetUsed`, summed)', 'Cockpit filings (`source: cockpit`)', 'Chat sends (`userMessage`)', 'Other directive filings'], weekGroups.map((g) => {
    const bs = weekBattles.filter((b) => groupOf(b) === g);
    const xs = bs.flatMap((b) => (b.doc.chatExchanges || []).filter((x) => inWeek(toMs(x.timestamp))));
    return [g, bs.length, bs.reduce((s, b) => s + (finite(b.doc.chatBudgetUsed) ? b.doc.chatBudgetUsed : 0), 0), xs.filter((x) => x.source === 'cockpit').length,
      xs.filter((x) => typeof x.userMessage === 'string' && x.userMessage.length).length, xs.filter((x) => x.hasDirective && x.source !== 'cockpit' && !(typeof x.userMessage === 'string' && x.userMessage.length)).length];
  }));

  // ---- E
  p('### E. Receipts (week)');
  p();
  const directives = answered.filter((c) => c.playerResponse.kind === 'directive');
  const evTally = {}; for (const b of weekBattles) for (const ev of b.sub.callEvents) if (inWeek(toMs(ev.at))) inc(evTally, `${b.acct}:${ev.kind}`);
  p(`- Call events in the week, by account and kind: ${tally(evTally)}.`);
  p(`- \`outcome.actedEvalId\` set on week calls: ${calls.filter((c) => c.outcome?.actedEvalId).length}. Directive answers: ${directives.length}; heard: ${directives.filter((c) => c.playerResponse.heardEvalId).length}. Calls carrying \`refused\` (\`directive_pending\` — the only refusal stored, Amendment B.5): ${calls.filter((c) => c.refused).length}.`);
  p();
  for (const c of directives) {
    const b = c.b; const filed = toMs(c.playerResponse.filedAt); const thread = c.playerResponse.directiveThreadId;
    const life = toMs(c.horizon?.expiresAt) + (c.horizon?.basis === 'next_check' ? 900000 : 0);
    const stamped = (b.doc.evaluations || []).filter((e) => e.heard?.directiveThreadId === thread).map((e) => ({ e, ms: toMs(e.promptBuiltAt) })).sort((x, y) => x.ms - y.ms);
    const heardMs = toMs((b.doc.evaluations || []).find((e) => e.evalId === c.playerResponse.heardEvalId)?.promptBuiltAt);
    const trades = (b.doc.trades || []).map((t) => ({ t, ms: toMs(t.swappedOutAt) })).filter((x) => finite(x.ms) && x.ms >= filed && x.ms <= life);
    const later = (b.doc.chatExchanges || []).filter((x) => x.hasDirective && toMs(x.timestamp) > filed && x.directiveThreadId !== thread);
    const follow = b.sub.calls.filter((o) => o.callId !== c.callId && o.symbol === c.symbol && o.direction === c.direction && o.condition?.side === c.condition?.side && o.mintedAt > filed && o.mintedAt <= life && levelsWithin(c, o));
    const fd = {}; for (const o of follow) inc(fd, `default ${o.defaultAction} → ${o.state}`);
    const dec = {}; for (const s of stamped) inc(dec, s.e.decision);
    p(`**${b.acct} \`${short(b.id)}\` — \`${c.playerResponse.answer}\` on ${c.symbol} ${c.direction} ${c.condition?.side} ${c.condition?.level} (default ${c.defaultAction}, ${c.horizon?.basis}, counterpart ${c.counterpart ?? 'null'})**`);
    p(`- Filed ${etClock(filed)} → heard at ${c.playerResponse.heardEvalId ?? 'never'} (${etClock(heardMs)}): ${minutes(filed, heardMs) ?? 'n/a'} min. The call ended \`${c.state}\` (${c.stateSource}, ${etClock(toMs(c.stateChangedAt))}); acted: ${c.outcome?.actedEvalId ?? 'no'}.`);
    p(`- In the slot (checks whose \`heard\` stamp names the thread): ${stamped.length} checks, ${etHm(stamped[0]?.ms)} → ${etHm(stamped[stamped.length - 1]?.ms)} ET (${minutes(stamped[0]?.ms, stamped[stamped.length - 1]?.ms) ?? 'n/a'} min); decisions at those checks: ${tally(dec)}. Lifetime end ${etClock(life)}. A later directive filing on another thread: ${later.length ? later.map((x) => etClock(toMs(x.timestamp))).join(', ') : 'none'}. \`battle.directive\` at read: ${b.doc.directive ? `thread ${b.doc.directive.directiveThreadId === thread ? 'this one' : 'another'}` : 'empty'}.`);
    p(`- Committed trades from filing to lifetime end: ${trades.length ? trades.map((x) => `${x.t.symbolOut}→${x.t.symbolIn} (${x.t.tier}, ${etHm(x.ms)} ET, ${x.t.trigger ?? x.t.exitReason ?? x.t.source}${x.t.symbolOut === c.symbol ? ', the call’s symbol' : ''}${x.t.tier === c.slot ? ', the call’s slot' : ''})`).join('; ') : 'none'}. Later calls on the same symbol, direction, side and level band (1 %): ${follow.length} — ${tally(fd)}.`);
    p();
  }

  // ---- F
  p('### F. Grading (week calls, state at read)');
  p();
  const states = ['hit', 'expired_unresolved', 'ended_with_battle', 'invalidated', 'open'];
  tbl(['Account · archetype', 'Kind', 'Calls', ...states, 'hit and acted'], weekGroups.flatMap((g) => [...new Set(calls.filter((c) => c.group === g).map((c) => c.kind))].sort().map((k) => {
    const cs = calls.filter((c) => c.group === g && c.kind === k);
    return [g, k, cs.length, ...states.map((s) => cs.filter((c) => c.state === s).length), cs.filter((c) => c.state === 'hit' && c.outcome?.actedEvalId).length];
  })));
  const exp = {}; for (const c of calls.filter((x) => x.state === 'expired_unresolved')) inc(exp, `${c.group}: ${c.horizon?.basis} · ${c.stateSource}`);
  p(`- \`expired_unresolved\` by horizon and writer: ${tally(exp)}.`);
  const endClock = {}; for (const c of calls) if (['expired_unresolved', 'ended_with_battle'].includes(c.state)) inc(endClock, `${c.group}: battle ends ${etHm(toMs(c.b.doc.expiresAt))} ET → ${c.state}`);
  p(`- Expired vs ended, by the battle's own end time (a battle that ends at the 16:00 close and a \`this_session\` deadline fall on the same instant): ${tally(endClock)}.`);
  const invR = {}; for (const c of calls.filter((x) => x.state === 'invalidated')) { const m = decls.find((d) => d.b.id === c.b.id && d.evalId === c.evalId)?.minted?.find((x) => x.callId === c.callId); inc(invR, `${c.group}: ${m?.reason ?? 'unrecorded'}`); }
  p(`- \`invalidated\` by minted reason: ${tally(invR)}.`);
  p();

  // ---- G
  p('### G. 2b sizing — exit calls with no usable replacement (week)');
  p();
  const noRepl = calls.filter((c) => c.kind !== 'pick' && c.direction === 'exit' && c.counterpart == null);
  const checkKeys = [...new Set(noRepl.map((c) => `${c.b.id}|${c.evalId}`))].sort();
  const gRows = weekGroups.map((g) => {
    const rs = dayRows(g).map((r) => noRepl.filter((c) => c.b.id === r.bid && etDateOf(c.mintedAt) === r.day).length);
    const ks = checkKeys.filter((k) => byId.get(k.split('|')[0]) && groupOf(byId.get(k.split('|')[0])) === g);
    let withBody = 0; let anyAvail = 0; let cand = 0; let watch = 0; let either = 0;
    for (const k of ks) {
      const [bid, evalId] = k.split('|');
      const body = bodyOf(bid, evalId);
      const rows = body?.context === undefined ? null : benchRowsOf(body.context);
      if (!rows) continue;
      withBody += 1;
      const avail = new Set(rows.filter((r) => r.status === 'available').map((r) => r.symbol));
      if (avail.size) anyAvail += 1;
      const e = (byId.get(bid).doc.evaluations || []).find((x) => x.evalId === evalId);
      const cs = new Set((e?.candidates || []).map((x) => x?.symbol).filter((s) => avail.has(s)));
      const ws = new Set((decls.find((d) => d.b.id === bid && d.evalId === evalId)?.watching || []).filter((s) => avail.has(s)));
      if (cs.size) cand += 1; if (ws.size) watch += 1; if (cs.size || ws.size) either += 1;
    }
    const cs = noRepl.filter((c) => c.group === g);
    return [g, cs.length, `${cs.filter((c) => c.counterpartRaw == null).length} / ${cs.filter((c) => c.counterpartRaw != null).length}`, dist(rs), ks.length, `${withBody} of ${ks.length}`, anyAvail, cand, watch, either];
  });
  tbl(['Account · archetype', 'Exit calls, counterpart null', 'Raw absent / raw present', 'Per battle-day', 'Checks carrying ≥ 1', 'Checks with a readable bench (tick body)', '…bench shows ≥ 1 available name', '…≥ 1 available bench name among its anticipation candidates', '…≥ 1 among its watch list', '…either'], gRows);
  p(`- Exit calls in the week (called shots + confirmations): ${calls.filter((c) => c.kind !== 'pick' && c.direction === 'exit').length}; of them with a counterpart kept: ${calls.filter((c) => c.kind !== 'pick' && c.direction === 'exit' && c.counterpart != null).length}. "Available" = the bench row's Status is \`available\` (not \`locked until …\`) in that check's own prompt; "eyeing" is read two ways — the check's \`candidates[].symbol\` (anticipation candidates) and its declarations record's \`watching\` list.`);
  p();

  // ---- H
  p('### H. Anything broken');
  p();
  const declKey = new Set(F.inScope.flatMap((b) => b.sub.declarations.map((d) => `${b.id}|${d.id}`)));
  const expectedNoDoc = weekEntries.filter((x) => x.e.declarationsPhase === 'expected' && !declKey.has(`${x.b.id}|${x.e.evalId}`));
  const docNoExpected = decls.filter((d) => !weekEntries.some((x) => x.b.id === d.b.id && x.e.evalId === d.evalId && x.e.declarationsPhase === 'expected'));
  const noPhase = weekEntries.filter((x) => !('declarationsPhase' in x.e));
  const np = {}; for (const x of noPhase) inc(np, `${x.b.acct} ${short(x.b.id)}: ${x.e.haikuError?.failureClass ?? (finite(x.e.callMs) ? 'model call' : 'no model call')}`);
  const cs = {}; for (const b of weekBattles) inc(cs, `${b.acct}:${b.doc.cronState?.declarationsPhase?.phase ?? 'absent'}`);
  p(`1. **Publication.** \`expected\` with no declarations record (failed or unconfirmed): ${expectedNoDoc.length ? expectedNoDoc.map((x) => `${x.b.acct} \`${short(x.b.id)}\` ${x.e.evalId}`).join(', ') : 'none'}. Records whose entry is not \`expected\`: ${docNoExpected.length ? docNoExpected.map((d) => `\`${short(d.b.id)}\` ${d.evalId}`).join(', ') : 'none'}. \`cronState.declarationsPhase\` (latest check per battle): ${tally(cs)}. Week entries without \`declarationsPhase\`: ${noPhase.length} — ${tally(np)}.`);
  const nowOpenPast = calls.filter((c) => c.state === 'open' && finite(toMs(c.horizon?.expiresAt)) && readAtMs > toMs(c.horizon.expiresAt));
  const lag = {}; const lags = { past_deadline: [], battle_ended: [] };
  for (const c of calls) {
    const r = receiptOf(c);
    if (r?.source !== 'sweep') continue;
    const ref = r.reason === 'battle_ended' ? toMs(c.b.doc.completedAt) : toMs(c.horizon?.expiresAt);
    const m = minutes(ref, r.observedAtMs); if (finite(m) && lags[r.reason]) lags[r.reason].push(m);
    inc(lag, `${c.b.acct}:${r.reason}`);
  }
  const qRows = F.queue.filter((q) => weekBattles.some((b) => b.id === q.id));
  p(`2. **Sweep.** Sweep logs are Vercel-only (\`sweep.js:176\`), not read. From the records: sweep receipts ${tally(lag)}; minutes from the deadline to the sweep receipt (past_deadline) ${dist(lags.past_deadline)}; from battle completion to the receipt (battle_ended) ${dist(lags.battle_ended)}. Week calls still open past their deadline at read: ${nowOpenPast.length ? nowOpenPast.map((c) => `\`${short(c.callId)}\` (${c.horizon.basis}, ${etClock(toMs(c.horizon.expiresAt))}, battle ${c.b.doc.status})`).join(', ') : 'none'}. \`callSweepQueue\` rows for week battles: ${qRows.length ? qRows.map((q) => `\`${short(q.id)}\` next ${etClock(toMs(q.nextExpiresAt))}, pendingHeard ${(q.pendingHeard || []).length}`).join('; ') : 'none'}. \`callSweepState/singleton\`: ${F.sweepState ? `phase ${F.sweepState.phase ?? 'n/a'}, updated ${etClock(toMs(F.sweepState.updatedAt))}` : 'absent'}.`);
  const negLag = calls.filter((c) => { const r = receiptOf(c); return r?.reason === 'battle_ended' && r.observedAtMs < toMs(c.b.doc.completedAt); });
  p(`   Sweep receipts (battle_ended) observed before the battle's \`completedAt\`: ${negLag.length ? [...new Set(negLag.map((c) => `\`${short(c.b.id)}\` (${negLag.filter((x) => x.b.id === c.b.id).length} receipts, up to ${Math.max(...negLag.filter((x) => x.b.id === c.b.id).map((x) => toMs(x.b.doc.completedAt) - receiptOf(x).observedAtMs))} ms before)`))].join('; ') : 'none'}.`);
  p();
  tbl(['Battle', 'Account', 'Status', 'Latest callsDiag evalId', 'exit', 'phaseResult', 'perId results', 'truncated', 'faults', 'flips (scanned · complete · stopped · failed · unconfirmed)', 'heard pass (stopped · skipped · failed · unconfirmed)', 'ms'],
    weekBattles.map((b) => { const d = b.doc.cronState?.callsDiag; if (!d) return [`\`${short(b.id)}\``, b.acct, b.doc.status, 'absent', '', '', '', '', '', '', '', '']; const r = {}; for (const x of d.perId || []) inc(r, x?.result ?? 'null');
      return [`\`${short(b.id)}\``, b.acct, b.doc.status, d.evalId, d.exit, d.phaseResult, tally(r), d.truncated, (d.faults || []).length ? JSON.stringify(d.faults).slice(0, 120) : 0,
        d.flips ? `${d.flips.scanned} · ${d.flips.complete} · ${d.flips.stopped} · ${d.flips.failed} · ${d.flips.unconfirmed}` : 'n/a', d.heard ? `${d.heard.stopped} · ${tally(d.heard.skipped || {})} · ${d.heard.failed} · ${d.heard.unconfirmed}` : 'n/a', d.ms]; }));
  const exits = {}; for (const b of weekBattles) inc(exits, `${b.acct}:${b.doc.cronState?.callsDiag?.exit ?? 'absent'}`);
  p(`   Latest \`callsDiag.exit\` per battle: ${tally(exits)}. Each check overwrites \`callsDiag\`; earlier checks' diagnostics are not retained.`);
  p();
  const miss = {};
  for (const c of calls) for (const f of ['heldAtMint', 'counterpartRaw', 'saidOk', 'mintedMode']) if (!(f in c)) inc(miss, `calls.${f}`);
  for (const d of decls) for (const f of ['watchingSource', 'mintedMode']) if (!(f in d)) inc(miss, `declarations.${f}`);
  const notOn = calls.filter((c) => c.mintedMode !== 'on').length + decls.filter((d) => d.mintedMode !== 'on').length;
  p(`3. **Amendment C fields.** Missing on week records: ${tally(miss)} (over ${calls.length} calls, ${decls.length} declarations records). Records with \`mintedMode\` other than \`'on'\` (the cockpit hides them): ${notOn}.`);
  // Current-contract integrity (contract V1.4 §6 + Amendment B §6/§7), every week call.
  const viol = [];
  const callIds = new Set(F.inScope.flatMap((b) => b.sub.calls.map((c) => `${b.id}|${c.callId}`)));
  for (const c of calls) {
    const r = receiptOf(c); const evs = eventsOf(c.b); const path0 = `agentBattles/${c.b.id}/callObservations/${c.callId}`;
    if (RECEIPTED.has(c.state) && !r) viol.push(['terminal_without_receipt', c.callId, c.state]);
    if (RECEIPTED.has(c.state) && r && c.outcome?.receiptRef !== path0) viol.push(['receiptRef_mismatch', c.callId, c.outcome?.receiptRef]);
    if (!RECEIPTED.has(c.state) && r) viol.push(['receipt_on_non_terminal', c.callId, c.state]);
    if (!(SOURCES_FOR[c.state] || []).includes(c.stateSource)) viol.push(['state_source_mismatch', c.callId, `${c.state}/${c.stateSource}`]);
    if (c.state === 'hit' && r && !(r.observedAtMs > c.mintedAt && ((c.condition?.side === 'above' && r.px > c.condition.level) || (c.condition?.side === 'below' && r.px < c.condition.level)))) viol.push(['hit_not_after_mint_or_px', c.callId, `${r.px} ${c.condition?.side} ${c.condition?.level}`]);
    if (r && r.evalId != null && r.evalId === c.evalId) viol.push(['hit_on_minting_eval', c.callId, r.evalId]);
    if (c.state === 'open' && c.b.doc.status !== 'active') viol.push(['open_under_completed_battle', c.callId, c.b.doc.status]);
    if (c.state === 'expired_unresolved' && !evs.has(`${c.callId}:expired`)) viol.push(['expired_without_event', c.callId, '']);
    if (c.state === 'ended_with_battle' && !evs.has(`${c.callId}:ended`)) viol.push(['ended_without_event', c.callId, '']);
    if (c.playerResponse && ![...evs.keys()].some((k) => k.startsWith(`${c.callId}:answered:`))) viol.push(['answer_without_event', c.callId, c.playerResponse.answer]);
    if (c.playerResponse?.heardEvalId && !evs.has(`${c.callId}:heard:${c.playerResponse.heardEvalId}`)) viol.push(['heard_without_event', c.callId, c.playerResponse.heardEvalId]);
    // The `acted` event is the heard pass's (heard.js:134-135), on an answered call; the flip stamps actedEvalId with no event (flip.js:252).
    if (c.playerResponse && c.outcome?.actedEvalId && !evs.has(`${c.callId}:acted:${c.outcome.actedEvalId}`)) viol.push(['answered_acted_without_event', c.callId, c.outcome.actedEvalId]);
  }
  // The `declared` event rides only a publication that minted calls (publish.js:195): watching-only records carry none.
  for (const d of decls) if ((d.minted || []).length && !eventsOf(d.b).has(`${d.evalId}:declared`)) viol.push(['declarations_without_declared_event', `${d.b.id}:${d.evalId}`, '']);
  const watchOnlyNoEvent = decls.filter((d) => !(d.minted || []).length && !eventsOf(d.b).has(`${d.evalId}:declared`)).length;
  for (const b of weekBattles) {
    for (const ev of b.sub.callEvents) for (const id of ev.callIds || []) if (!callIds.has(`${b.id}|${id}`)) viol.push(['event_names_unknown_call', ev.id, id]);
    for (const o of b.sub.callObservations) if (!callIds.has(`${b.id}|${o.callId}`)) viol.push(['receipt_without_call', o.id, '']);
    for (const t of b.sub.ticks) for (const ref of Array.isArray(t.calls) ? t.calls : []) if (!callIds.has(`${b.id}|${ref?.callId}`)) viol.push(['tick_ref_unresolved', t.id, ref?.callId]);
  }
  const vt = {}; for (const v of viol) inc(vt, v[0]);
  p(`4. **Integrity, current contract** (terminal = hit · expired_unresolved · ended_with_battle, each with a receipt and its writer's \`stateSource\` — the flip's \`check\` or the sweep's; every transition with its event; every tick reference resolving): ${viol.length} violation(s) — ${tally(vt)}.${viol.length ? ` ${viol.slice(0, 12).map((v) => `\`${v[0]}\` ${short(v[1])} ${v[2] ?? ''}`).join('; ')}` : ''} By design and not counted: ${watchOnlyNoEvent} watching-only declarations records with no \`declared\` event (publish.js:195); ${calls.filter((c) => !c.playerResponse && c.outcome?.actedEvalId).length} unanswered call(s) with a flip-stamped \`actedEvalId\` and no \`acted\` event (flip.js:252).`);
  const legacy = {}; for (const c of calls) for (const v of legacyIntegrityViolations({ call: c, receipt: receiptOf(c), battleStatus: c.b.doc.status, receiptPath: `agentBattles/${c.b.id}/callObservations/${c.callId}` })) inc(legacy, `${v.check}: ${/stateSource=/.test(v.detail) ? v.detail : (/receipt exists but state=/.test(v.detail) ? v.detail : 'other')}`);
  p(`5. **The shadow read's integrity checks on the same week calls** (\`shadow-read-call-records.mjs\` \`integrityViolations\`, written before Build 1a: terminal = hit · expired_unresolved only, \`stateSource\` must be \`check\`): ${Object.values(legacy).reduce((s, v) => s + v, 0)} — ${tally(legacy)}.`);
  // Tile states: answers filed on a C-6 thread that held a live directive answer at that instant.
  const tileQs = [];
  for (const c of answered) {
    const t = toMs(c.playerResponse.filedAt);
    const peers = c.b.sub.calls.filter((o) => o.callId !== c.callId && openAt(o, t) && threadKeyOf(o) === threadKeyOf(c) && (o.mintedAt <= c.mintedAt ? levelsWithin(o, c) : levelsWithin(c, o)));
    for (const o of peers) {
      const pr = o.playerResponse; const ft = toMs(pr?.filedAt);
      const life = toMs(o.horizon?.expiresAt) + (o.horizon?.basis === 'next_check' ? 900000 : 0);
      if (pr?.kind === 'directive' && ft < t && t <= life) tileQs.push(`\`${short(c.callId)}\` (${c.playerResponse.answer}) filed ${etClock(t)} while thread peer \`${short(o.callId)}\` carried a live \`${pr.answer}\` directive`);
    }
  }
  const newestAnswered = answered.filter((c) => { const t = toMs(c.playerResponse.filedAt); return c.b.sub.calls.some((o) => o.callId !== c.callId && o.mintedAt > c.mintedAt && o.mintedAt <= t && openAt(o, t) && threadKeyOf(o) === threadKeyOf(c) && levelsWithin(c, o)); });
  p(`6. **Tile states the records do not explain.** Answers filed on a thread holding a live directive answer (the tile offers none then, C-6): ${tileQs.length ? tileQs.join('; ') : 'none'}. Answers filed on a call that was not its open thread's newest at that instant (the tile's buttons answer the newest, Build 2a spec §7.2): ${newestAnswered.length ? newestAnswered.map((c) => `\`${short(c.callId)}\``).join(', ') : 'none'}.`);
  const actedThenClosed = calls.filter((c) => c.outcome?.actedEvalId && c.state !== 'hit');
  p(`7. **Acted, then resolved some other way** (the tile tags a terminal state first, so these read by their state, not "Acted" — \`cockpitModel.js\` \`callTag\`): ${actedThenClosed.length ? actedThenClosed.map((c) => `${c.b.acct} \`${short(c.callId)}\` ${c.symbol} ${c.direction} ${c.condition?.side} ${c.condition?.level}, acted at ${c.outcome.actedEvalId} (${etClock(toMs((c.b.doc.evaluations || []).find((e) => e.evalId === c.outcome.actedEvalId)?.promptBuiltAt))}), now \`${c.state}\``).join('; ') : 'none'}.`);
  const goneSymbol = directives.filter((c) => (c.b.doc.trades || []).some((t) => t.symbolOut === c.symbol && toMs(t.swappedOutAt) > toMs(c.playerResponse.filedAt) && toMs(t.swappedOutAt) < toMs(c.horizon?.expiresAt)));
  p(`8. **A live directive about a symbol that left the book** (the flip stamps \`acted\` only from the model's own executor result, \`flip.js:42\`; an exit with a stored counterpart matches only a trade that brings that counterpart in, \`flip.js:159-160\`; Amendment B.13's swap-out retirement covers a pick's directive only): ${goneSymbol.length ? goneSymbol.map((c) => { const t = (c.b.doc.trades || []).find((x) => x.symbolOut === c.symbol && toMs(x.swappedOutAt) > toMs(c.playerResponse.filedAt)); const after = (c.b.doc.evaluations || []).filter((e) => e.heard?.directiveThreadId === c.playerResponse.directiveThreadId && toMs(e.promptBuiltAt) > toMs(t.swappedOutAt)).length; return `${c.b.acct} \`${short(c.b.id)}\` ${c.symbol}: sold ${c.symbol}→${t.symbolIn} at ${etHm(toMs(t.swappedOutAt))} ET (${t.trigger ?? t.source}); the directive was in ${after} later checks' prompts`; }).join('; ') : 'none'}.`);
  p();

  const md = L.join('\n');
  if (argOf('--out')) writeFileSync(path.resolve(PROJECT_ROOT, argOf('--out')), md + '\n'); else console.log(md);
  console.error(`[week1-read] head=${G.head.slice(0, 8)} battles=${F.inScope.length} weekEntries=${weekEntries.length} calls=${calls.length} decls=${decls.length} violations=${viol.length}`);
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main().catch((err) => { console.error(err); process.exit(1); });
