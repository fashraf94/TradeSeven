// research/level-study/tests/_helpers.js — shared test loaders. Zero product imports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from '../config.js';

export const STUDY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(STUDY_ROOT, '..', '..');
export const DATA_DIR = path.join(STUDY_ROOT, 'data');
export const NORM_DIR = path.join(DATA_DIR, 'normalized');

export const PROBE = [...CONFIG.universe.probe.equities, ...CONFIG.universe.probe.context];

export function hasNormalized(sym) {
  return fs.existsSync(path.join(NORM_DIR, sym, 'sessions.json')) &&
         fs.existsSync(path.join(NORM_DIR, sym, 'daily.json'));
}
export function requireData(sym) {
  if (!hasNormalized(sym)) throw new Error(`Missing data/normalized/${sym} — run \`npm run fetch\` (or \`node 01-fetch-history.js\`) first`);
}
export function loadSessions(sym) { requireData(sym); return JSON.parse(fs.readFileSync(path.join(NORM_DIR, sym, 'sessions.json'), 'utf8')); }
export function loadDaily(sym) { requireData(sym); return JSON.parse(fs.readFileSync(path.join(NORM_DIR, sym, 'daily.json'), 'utf8')); }
export function loadFixture(rel) { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'fixtures', rel), 'utf8')); }
export function byDateOf(dailyBars) { return new Map(dailyBars.map((b) => [b.date, b])); }
