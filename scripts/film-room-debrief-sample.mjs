#!/usr/bin/env node
// scripts/film-room-debrief-sample.mjs
//
// Film Room D2 — THE SAMPLE PACK (D2 spec §11; DW-12). FOUNDER-RUN, READ-ONLY against production, LOCAL OUTPUT ONLY.
// It reads one owner's recent tape days the way the nightly pass reads them (debriefPass.js: the close pass's two
// candidate queries for each day, kept where tiered, a battle day and the owner's; one get of the day's tape; written
// days only), builds each day's digest, and runs the call and the checks for BOTH models (Claude Sonnet 5.5 and Claude
// Haiku 5.5) — then writes ONE JSON file and ONE Markdown file under scripts/output/ (git-ignored), with each swap's
// fact, each model's line or drop reason, and each call's cost. Nothing else:
//   * it NEVER WRITES FIRESTORE — no create, set, update or delete anywhere in it;
//   * it STOPS BEFORE the estimated total passes $2 (SAMPLE_CAP_USD): before each call, the spent cost plus that call's
//     estimate (its prompt's bytes as tokens, three bytes to a token, plus the full 800 output tokens, at the model's
//     list price) must stay within the cap, or no further call is made;
//   * it NEVER PRINTS a key, a token or an id — the console gets counts and the two file paths; the files name days by
//     date and battles as "battle 1", "battle 2", never by id.
// Credentials come from the environment, which the founder sets with a hidden prompt: Firestore through
// api/_utils/firebaseAdmin.js (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) and the model through
// CLAUDE_API_KEY (debriefModelCall.js). Claude Code wrote it and tested it on fakes (film-room-debrief-sample.test.js);
// it has never been run against production.
//
//   node scripts/film-room-debrief-sample.mjs --owner <uid> [--days 3]

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidatesFor, writtenTape, selectedForDebrief } from '../api/_utils/filmRoom/debriefPass.js';
import { buildDayDigest } from '../api/_utils/filmRoom/dayDigest.js';
import { buildDebriefPrompt } from '../api/_utils/filmRoom/debriefPrompt.js';
import { runDebriefCall, DEBRIEF_MODELS, MODEL_PRICES, DEBRIEF_MAX_OUTPUT_TOKENS } from '../api/_utils/filmRoom/debriefModelCall.js';
import { checkDebriefLines } from '../api/_utils/filmRoom/debriefChecks.js';
import { resolveAttributionAgentId } from '../api/_utils/casualClone.js';
import { TAPE_SUBCOLLECTION } from '../src/constants/filmTape.js';
import { etDateOf, etDayBounds, isSessionDate, closePassEndMs } from '../src/utils/tapeSchedule.js';
import { getPreviousSessionDate } from '../src/utils/marketCalendar.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** DW-12: the whole pack stops before its estimated total passes $2. */
export const SAMPLE_CAP_USD = 2;
export const SAMPLE_DEFAULT_DAYS = 3;
export const SAMPLE_OUT_DIR = path.join(HERE, 'output');
/** One call's deadline. */
const CALL_TIMEOUT_MS = 60_000;

/** A call's cost ESTIMATE before it is made: the prompt's bytes as tokens (three bytes to a token) and the full output, at list price. */
export function estimateCallUsd(model, prompt) {
  const p = MODEL_PRICES[model];
  const bytes = Buffer.byteLength(`${prompt.system}${prompt.user}${JSON.stringify(prompt.schema)}`, 'utf8');
  const input = Math.ceil(bytes / 3);
  return ((input * p.inputPerMTok) + (DEBRIEF_MAX_OUTPUT_TOKENS * p.outputPerMTok)) / 1_000_000;
}

/** The `days` most recent session dates whose close pass has finished by `nowMs`, newest first. */
export function recentTapeDates(nowMs, days) {
  const out = [];
  let d = etDateOf(nowMs);
  if (!(isSessionDate(d) && nowMs >= closePassEndMs(d))) d = getPreviousSessionDate(d);
  while (d && out.length < days) { out.push(d); d = getPreviousSessionDate(d); }
  return out;
}

/** A swap's fact, as the front's fact line says it: its clock, its maker, its symbols, its exit price. */
const factOf = (s) => [s.time, s.maker, `${s.sold ?? 'not recorded'} → ${s.bought ?? 'not recorded'}`, s.soldAt ? `sold at ${s.soldAt}` : null].filter(Boolean).join(' · ');
const dataOf = (snap) => (snap?.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null);

/**
 * The pack, on any Firestore handle and model call (fakes in its tests).
 * @returns {Promise<{ report: object, files: { json: string, md: string } | null }>}
 */
export async function runSample({
  db, ownerId, days = SAMPLE_DEFAULT_DAYS, nowMs = Date.now(), clock = Date.now, call = runDebriefCall, models = DEBRIEF_MODELS,
  capUsd = SAMPLE_CAP_USD, resolveAttribution = resolveAttributionAgentId, outDir = SAMPLE_OUT_DIR, write = true, log = (...a) => console.log(...a),
}) {
  if (typeof ownerId !== 'string' || !ownerId) throw new Error('film-room-debrief-sample: --owner <uid> is required');
  const report = { generatedAt: new Date(nowMs).toISOString(), capUsd, spentUsd: 0, stopped: false, models: [...models], calls: 0, days: [] };
  let battleNo = 0;
  outer:
  for (const etDate of recentTapeDates(nowMs, days)) {
    const battles = (await candidatesFor(db, etDayBounds(etDate))).filter((b) => b.ownerId === ownerId && selectedForDebrief(b, etDate, 'on'));
    for (const battle of battles) {
      const tape = dataOf(await db.collection('agentBattles').doc(battle.id).collection(TAPE_SUBCOLLECTION).doc(etDate).get());
      if (!writtenTape(tape)) continue;
      battleNo += 1;
      const attribution = await resolveAttribution(db, battle);
      const knownIds = [battle.id, battle.ownerId, battle.agentId, attribution].filter((v) => typeof v === 'string' && v);
      const built = buildDayDigest({ tape, battle, knownIds });
      if (!built) continue;
      const day = { etDate, battle: `battle ${battleNo}`, swaps: built.digest.swaps.map((s) => ({ label: s.label, fact: factOf(s), models: {} })), calls: [] };
      report.days.push(day);
      if (!day.swaps.length) { day.note = 'no swaps — no call'; continue; }
      const prompt = buildDebriefPrompt(built.digest);
      for (const model of models) {
        const estimate = estimateCallUsd(model, prompt);
        if (report.spentUsd + estimate > capUsd) { report.stopped = true; break outer; }
        const r = await call({ ...prompt, model, deadlineAt: clock() + CALL_TIMEOUT_MS });
        report.calls += 1;
        report.spentUsd += Number.isFinite(r?.costUsd) ? r.costUsd : estimate;
        day.calls.push({ model, ok: r?.ok === true, reason: r?.ok ? null : r?.reason ?? 'model_error_unknown', usage: r?.usage ?? null, costUsd: r?.costUsd ?? null, estimateUsd: estimate, attempts: r?.attempts ?? null });
        const checked = r?.ok ? checkDebriefLines(r.output, built.digest, { knownIds }) : null;
        for (const s of day.swaps) {
          if (!r?.ok) { s.models[model] = { failed: r?.reason ?? 'model_error_unknown' }; continue; }
          if (!checked.ok) { s.models[model] = { failed: 'parse' }; continue; }
          const line = checked.lines.find((l) => l.label === s.label);
          const drop = checked.dropped.find((d) => d.label === s.label);
          s.models[model] = line ? { line: line.text } : drop ? { dropped: drop.reason } : { none: true };
        }
      }
    }
  }
  report.spentUsd = Math.round(report.spentUsd * 1_000_000) / 1_000_000;
  let files = null;
  if (write) {
    mkdirSync(outDir, { recursive: true });
    const stamp = report.generatedAt.replace(/[:.]/g, '-');
    files = { json: path.join(outDir, `film-room-debrief-sample-${stamp}.json`), md: path.join(outDir, `film-room-debrief-sample-${stamp}.md`) };
    writeFileSync(files.json, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(files.md, markdownOf(report));
  }
  // counts only — never a key, a token or an id
  log('[film-room-debrief-sample]', JSON.stringify({ days: report.days.length, calls: report.calls, spentUsd: report.spentUsd, stopped: report.stopped }));
  if (files) log('[film-room-debrief-sample] wrote', files.json, 'and', files.md);
  return { report, files };
}

/** The Markdown file: one section per battle day, one row per swap — its fact, each model's line or drop reason — and the calls' costs. */
export function markdownOf(report) {
  const out = [`# Film Room D2 — sample pack (${report.generatedAt})`, '', `Models: ${report.models.join(', ')} · spent $${report.spentUsd.toFixed(6)} of the $${report.capUsd} cap${report.stopped ? ' · STOPPED before the cap' : ''}`, ''];
  for (const d of report.days) {
    out.push(`## ${d.etDate} · ${d.battle}`, '');
    if (d.note) { out.push(d.note, ''); continue; }
    out.push(`| Swap | Fact | ${report.models.join(' | ')} |`, `|---|---|${report.models.map(() => '---').join('|')}|`);
    for (const s of d.swaps) {
      const cells = report.models.map((m) => { const v = s.models[m]; if (!v) return '—'; if (v.line) return `“${v.line.replace(/\|/g, '\\|')}”`; if (v.dropped) return `dropped: ${v.dropped}`; if (v.failed) return `failed: ${v.failed}`; return 'no line'; });
      out.push(`| ${s.label} | ${s.fact.replace(/\|/g, '\\|')} | ${cells.join(' | ')} |`);
    }
    out.push('', ...d.calls.map((c) => `- ${c.model}: ${c.ok ? 'ok' : `failed (${c.reason})`} · cost $${c.costUsd ?? c.estimateUsd} · usage ${c.usage ? `${c.usage.input} in / ${c.usage.output} out` : 'unknown'}`), '');
  }
  return `${out.join('\n')}\n`;
}

/** `--owner <uid> --days <n>` → { ownerId, days }. */
export function argsOf(argv) {
  const at = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const days = Number(at('--days') ?? SAMPLE_DEFAULT_DAYS);
  return { ownerId: at('--owner') ?? null, days: Number.isInteger(days) && days > 0 && days <= 20 ? days : SAMPLE_DEFAULT_DAYS };
}

async function main() {
  const { ownerId, days } = argsOf(process.argv.slice(2));
  if (!ownerId) { console.error('usage: node scripts/film-room-debrief-sample.mjs --owner <uid> [--days 3]'); process.exitCode = 2; return; }
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  await runSample({ db: getFirebaseAdmin(), ownerId, days });
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().catch((err) => {
    // never the message: it can carry a document path, and so an id
    console.error('[film-room-debrief-sample] failed', JSON.stringify({ kind: err?.name ?? 'Error', code: Number.isInteger(err?.code) ? err.code : null }));
    process.exitCode = 1;
  });
}
