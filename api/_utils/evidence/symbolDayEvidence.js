// api/_utils/evidence/symbolDayEvidence.js
//
// Huddle S1 — THE SHARED PER-SYMBOL EVIDENCE RECORD (Amendment C V1.2 §C1, replacing
// V1.1 §3.5's ticker cache), with per-field-group claims under Amendment B §B4's rules.
//
//   symbolDayEvidence/{etDate}_{SYMBOL}   (ET trading date only; no client access)
//     symbol, etDate
//     price:   { lastClose, lastCloseAsOf }                       Huddle job writes
//     news:    [ ≤ 10 C1 news items ]                             Huddle job writes
//     sources: { eodhd, newsfilter, fantasytimes }: ok|skipped|error   Huddle job writes
//     release, earnings                                           RESERVED (Shared Research);
//                                                                 absent until written, read as null
//     claims:  { price|news: { claimGeneration, leaseUntil, owner, state } }
//
// Each symbol is fetched ONCE per morning however many players hold it: the first job to
// need a group CLAIMS it (generation + 1, a lease), fetches outside the transaction, and
// FINALIZES in a transaction that requires, all three (B §B4): generation equality, the
// claim still `claimed`, and its lease unexpired. Finalizing marks the group `ready` (or
// `failed`) and BUMPS the generation, so a claimant whose lease lapsed and whose group was
// reclaimed can never write afterwards — its finalize is refused and logged
// `stale_generation`, and the successor's result stands (A §A2). A job that finds a group
// claimed by another waits briefly, then reads what is there and notes the source
// `skipped` (V1.1 §3.5). Null when unknown, never zero.

import { symbolDayEvidenceRef } from '../huddle/records.js';

export const EVIDENCE_LEASE_MS = 60_000;
export const HUDDLE_GROUPS = Object.freeze(['price', 'news']);
export const GROUP_STATE = Object.freeze({ CLAIMED: 'claimed', READY: 'ready', FAILED: 'failed' });

const isDone = (c) => c?.state === GROUP_STATE.READY || c?.state === GROUP_STATE.FAILED;

/**
 * Claim every wanted group that is neither done nor held by an unexpired lease.
 * @returns {Promise<{ claimed: Record<string, number>, busy: string[], done: string[], data: object|null }>}
 */
export async function claimGroups(db, { etDate, symbol, owner, groups = HUDDLE_GROUPS, nowMs = Date.now() }) {
  const ref = symbolDayEvidenceRef(db, etDate, symbol);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    const claimed = {};
    const busy = [];
    const done = [];
    const update = {};
    for (const g of groups) {
      const c = data?.claims?.[g] || null;
      if (isDone(c)) { done.push(g); continue; }
      if (c?.state === GROUP_STATE.CLAIMED && Number.isFinite(c.leaseUntil) && c.leaseUntil > nowMs && c.owner !== owner) { busy.push(g); continue; }
      const gen = (Number.isInteger(c?.claimGeneration) ? c.claimGeneration : 0) + 1;
      claimed[g] = gen;
      update[`claims.${g}`] = { claimGeneration: gen, leaseUntil: nowMs + EVIDENCE_LEASE_MS, owner, state: GROUP_STATE.CLAIMED };
    }
    if (Object.keys(claimed).length > 0) {
      if (!snap.exists) tx.set(ref, { symbol, etDate });
      tx.set(ref, nestClaims(update), { merge: true });
    }
    return { claimed, busy, done, data };
  });
}

function nestClaims(update) {
  const claims = {};
  for (const [k, v] of Object.entries(update)) claims[k.slice('claims.'.length)] = v;
  return { claims };
}

/**
 * Finalize one group: write its fields and mark it ready/failed, only while this owner's
 * generation still holds an unexpired claim. Bumps the generation.
 * @returns {Promise<{ outcome: 'written' | 'stale_generation' }>}
 */
export async function finalizeGroup(db, { etDate, symbol, owner, group, generation, fields, state = GROUP_STATE.READY, nowMs = Date.now() }) {
  const ref = symbolDayEvidenceRef(db, etDate, symbol);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const c = snap.exists ? snap.data()?.claims?.[group] : null;
    const owns = !!c && c.claimGeneration === generation && c.state === GROUP_STATE.CLAIMED && c.owner === owner
      && Number.isFinite(c.leaseUntil) && c.leaseUntil > nowMs;
    if (!owns) {
      console.warn('[symbolDayEvidence] stale_generation', JSON.stringify({ etDate, symbol, group, generation }));
      return { outcome: 'stale_generation' };
    }
    tx.set(ref, { ...fields, claims: { [group]: { claimGeneration: generation + 1, leaseUntil: null, owner, state } } }, { merge: true });
    return { outcome: 'written' };
  });
}

/** Read the record (null when absent). Reserved groups read as null. */
export async function readSymbolEvidence(db, { etDate, symbol }) {
  const snap = await symbolDayEvidenceRef(db, etDate, symbol).get();
  if (!snap.exists) return null;
  const d = snap.data();
  return { ...d, release: d.release ?? null, earnings: d.earnings ?? null, price: d.price ?? null, news: Array.isArray(d.news) ? d.news : null };
}

/**
 * Make sure this morning's price and news are on the record, fetching only the groups
 * this caller claimed. `fetchGroup(group)` returns `{ fields, state }` and never throws.
 * A group another job holds is waited for up to `waitMs`, then read as it stands.
 *
 * @returns {Promise<{ record: object|null, skipped: string[] }>}
 */
export async function ensureSymbolEvidence(db, { etDate, symbol, owner, fetchGroup, nowMs = () => Date.now(), waitMs = 3_000, pollMs = 500, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const claim = await claimGroups(db, { etDate, symbol, owner, nowMs: nowMs() });
  for (const [group, generation] of Object.entries(claim.claimed)) {
    let result;
    try {
      result = await fetchGroup(group);
    } catch {
      result = { fields: {}, state: GROUP_STATE.FAILED };
    }
    await finalizeGroup(db, { etDate, symbol, owner, group, generation, fields: result?.fields || {}, state: result?.state || GROUP_STATE.FAILED, nowMs: nowMs() });
  }
  let record = await readSymbolEvidence(db, { etDate, symbol });
  let pending = claim.busy.filter((g) => !isDone(record?.claims?.[g]));
  for (let waited = 0; pending.length > 0 && waited < waitMs; waited += pollMs) {
    await sleep(pollMs);
    record = await readSymbolEvidence(db, { etDate, symbol });
    pending = pending.filter((g) => !isDone(record?.claims?.[g]));
  }
  return { record, skipped: pending };
}
