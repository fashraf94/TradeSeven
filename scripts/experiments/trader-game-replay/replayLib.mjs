// scripts/experiments/trader-game-replay/replayLib.mjs
//
// Shared, pure helpers for the replay pack's offline scripts (Parts A–C). No
// network, no Firestore, no clock: every input is the local export written by
// exportReplay.mjs, and every time is read from a stored timestamp. Eastern time
// is computed with Intl and an explicit time zone, never from the host's zone.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export function parseArgs(argv, extra = {}) {
  const flags = { in: null, out: null, ...extra };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (!(key in flags)) throw new Error(`Unknown flag: ${argv[i]}`);
    flags[key] = typeof flags[key] === 'boolean' ? true : argv[++i];
  }
  if (!flags.in) throw new Error('--in <export dir> is required');
  return flags;
}

export function readManifest(dir) {
  return JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
}

/** Every bundle the manifest lists, in manifest order, each with its ordinal label. */
export function* bundles(dir, { completedOnly = true } = {}) {
  for (const row of readManifest(dir).battles) {
    if (completedOnly && row.status !== 'completed') continue;
    const bundle = JSON.parse(readFileSync(path.join(dir, row.file), 'utf8'));
    bundle.battle.id = bundle.battle._docId; // the pseudonymized id, as validators read it
    yield { label: row.file.replace(/\.json$/, ''), row, ...bundle };
  }
}

export function writeResult(dir, name, value) {
  const out = path.join(dir, 'results');
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
}

const ET_PARTS = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** { date: 'YYYY-MM-DD', minutes: minutes after ET midnight } for an ISO instant. */
export function etOf(iso) {
  const ms = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const p = Object.fromEntries(ET_PARTS.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** The 15-minute cron slot an instant falls in, as an ET date and slot number. */
export function slotKey(iso) {
  const e = etOf(iso);
  return e ? `${e.date}#${Math.floor(e.minutes / 15)}` : null;
}

export const round2 =(x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
export const sum = (xs) => xs.reduce((n, x) => n + x, 0);
export function median(xs) {
  const a = xs.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function mean(xs) {
  const a = xs.filter(Number.isFinite);
  return a.length ? sum(a) / a.length : null;
}
export function tally(items, key) {
  const m = {};
  for (const it of items) { const k = String(key(it)); m[k] = (m[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])));
}
export function groupBy(items, key) {
  const m = new Map();
  for (const it of items) { const k = key(it); if (!m.has(k)) m.set(k, []); m.get(k).push(it); }
  return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

/** A Markdown table. `cols` is [[header, row => cell]]. */
export function mdTable(rows, cols) {
  const cell = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' ? String(round2(v)) : String(v)).replace(/\|/g, '\\|');
  return [
    `| ${cols.map((c) => c[0]).join(' | ')} |`,
    `|${cols.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${cols.map((c) => cell(c[1](r))).join(' | ')} |`),
  ].join('\n');
}

export const pct = (n, d) => (d ? `${round2((100 * n) / d)}% (${n} of ${d})` : `— (0 of 0)`);
