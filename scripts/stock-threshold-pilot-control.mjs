// scripts/stock-threshold-pilot-control.mjs
//
// BaggerBomb stock thresholds v2 pilot — the ONE switch (Ruling 6;
// docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_ADMISSION_RUNBOOK_V1_20261013.md, v2
// section). The code selector ships true; the server document
// `stockThresholdControl/admission` decides who gets a measured battle:
//
//   enable  — schema 2, enabled, a fresh epoch, the registered v2 model and an
//             allowlist audience of the owner ids given on the command line;
//   disable — the same document disabled with a fresh epoch (legacy for
//             everyone, at once, on every warm worker's next creation);
//   show    — read-only: prints the current document and what it selects.
//
// DRY RUN BY DEFAULT. Nothing is written without --apply. Every mode prints the
// exact document it would write (or the current one). Owner ids are taken from
// the command line only and are never written to any file by this script.
//
// USAGE (repo root; Admin credentials from .env.local via scripts/loadLocalEnv.js):
//   node scripts/stock-threshold-pilot-control.mjs show
//   node scripts/stock-threshold-pilot-control.mjs enable --owner <uid> [--owner <uid>] [--apply]
//   node scripts/stock-threshold-pilot-control.mjs disable [--apply]
//
// PRECONDITION (build report, identity finding): do not enable before the
// security-identity follow-up lands — the collector refuses most US stocks
// today because the provider's General.ISIN is null.

import { pathToFileURL } from 'node:url';
import { STOCK_MODEL, stockContent } from '../src/utils/stockThresholdModel.js';
import { STOCK_ADMISSION_CONTROL_PATH, STOCK_ADMISSION_CONTROL_SCHEMA, validStockAdmissionControl, stockAdmissionSelects } from '../api/_utils/stockThresholdPolicyRegistry.js';

const MODEL = Object.freeze({ ...STOCK_MODEL });

/** Parse argv into { action, ownerIds, apply }. Throws on anything ambiguous. */
export function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (!['show', 'enable', 'disable'].includes(action)) throw new Error('usage: show | enable --owner <uid> [--owner <uid>] [--apply] | disable [--apply]');
  const ownerIds = []; let apply = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--apply') apply = true;
    else if (rest[i] === '--owner' && typeof rest[i + 1] === 'string' && rest[i + 1] && !rest[i + 1].startsWith('--')) ownerIds.push(rest[++i]);
    else throw new Error(`unknown or incomplete argument: ${rest[i]}`);
  }
  if (action === 'enable' && ownerIds.length === 0) throw new Error('enable needs at least one --owner <uid>');
  if (action !== 'enable' && ownerIds.length) throw new Error(`${action} takes no --owner`);
  if (action === 'show' && apply) throw new Error('show is read-only');
  return { action, ownerIds: [...new Set(ownerIds)], apply };
}

/**
 * The exact document for an action, from the current one. The epoch always
 * advances, so a creation prepared under the old document is refused at commit
 * (the transaction's whole-document re-read).
 */
export function buildControlDocument(current, { action, ownerIds = [] }) {
  const epoch = (Number.isInteger(current?.epoch) && current.epoch > 0 ? current.epoch : 0) + 1;
  if (action === 'enable') {
    const doc = { schemaVersion: STOCK_ADMISSION_CONTROL_SCHEMA, enabled: true, epoch, model: { ...MODEL }, audience: { mode: 'allowlist', ownerIds: [...ownerIds] } };
    if (!validStockAdmissionControl(doc)) throw new Error('refusing to write a control document the server would not accept');
    return doc;
  }
  if (action === 'disable') {
    const keep = Array.isArray(current?.audience?.ownerIds) ? current.audience.ownerIds.filter(id => typeof id === 'string' && id) : [];
    return { schemaVersion: STOCK_ADMISSION_CONTROL_SCHEMA, enabled: false, epoch, model: { ...MODEL }, audience: { mode: 'allowlist', ownerIds: keep } };
  }
  throw new Error(`no document for ${action}`);
}

/** One plain line on what a document selects. */
export function describeControl(doc) {
  if (!doc) return 'no control document: every creation is legacy';
  if (!validStockAdmissionControl(doc)) return 'control document present but closed (disabled, old schema, other audience or unregistered model): every creation is legacy';
  return `enabled for ${doc.audience.ownerIds.length} owner id(s): those owners' tiered full-day creations are measured; everyone else is legacy`;
}

export async function run(argv, { db, log = console.log } = {}) {
  const { action, ownerIds, apply } = parseArgs(argv);
  const ref = db.doc(STOCK_ADMISSION_CONTROL_PATH);
  const snap = await ref.get();
  const current = snap.exists ? snap.data() : null;
  log(`${STOCK_ADMISSION_CONTROL_PATH} now: ${current ? JSON.stringify(current, null, 2) : '(absent)'}`);
  log(`selects: ${describeControl(current)}`);
  if (action === 'show') return { action, written: false, current };
  const next = buildControlDocument(current, { action, ownerIds });
  log(`${apply ? 'WRITING' : 'DRY RUN — would write'} ${STOCK_ADMISSION_CONTROL_PATH}:\n${JSON.stringify(next, null, 2)}`);
  log(`after: ${describeControl(next)}`);
  for (const id of ownerIds) log(`  ${id}: ${stockAdmissionSelects(next, id) ? 'selected' : 'not selected'}`);
  if (!apply) { log('Nothing written. Re-run with --apply to write exactly this document.'); return { action, written: false, current, next }; }
  await ref.set(next);
  const check = (await ref.get()).data();
  if (stockContent(check) !== stockContent(next)) throw new Error('read-back differs from the written document');
  log('Written and read back.');
  return { action, written: true, current, next };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  run(process.argv.slice(2), { db: getFirebaseAdmin() }).catch(err => { console.error(err.message); process.exitCode = 1; });
}
