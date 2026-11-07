// src/services/huddleService.js
//
// Huddle S1 — the client's ONE service for the Huddle (Amendment C V1.2 §C7). Imported by
// exactly two readers (src/hooks/useHuddleToday.js, src/hooks/useHuddleHistory.js) and the
// sheet body (src/components/Huddle/HuddleSheetBody.jsx); never by the hub directory, and
// never by anything the root deploy provider imports (C7: the client post-deploy hook is
// not built). Every call is a request on a trigger — no timer, no poll, no listener here.
//
//   today     GET  /api/huddle/status        (reconciled on read)
//   confirm   POST /api/huddle/confirm       { etDate, baseRevision, replacement }
//   skip      POST /api/huddle/skip          { etDate }
//   playback  POST /api/huddle/playback-token { etDate } → a same-origin audio URL
//   event     POST /api/huddle/event         { etDate, kind: 'listened' | 'completed' }
//   history   the owner's recent records, read through the owner-read rule
//             (huddles/{uid}/days, ordered by its etDate, newest first; a single-field
//             order: no composite index, huddle-s1-queries.md)

import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';

export const HISTORY_LIMIT = 10;

async function asJson(response) {
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { ok: response.ok, status: response.status, body: body || {} };
}

/** Today's record (or a given day's), reconciled on read. Throws on a transport failure. */
export async function fetchHuddleToday({ etDate } = {}) {
  const url = etDate ? `/api/huddle/status?etDate=${encodeURIComponent(etDate)}` : '/api/huddle/status';
  const r = await asJson(await fetchWithAuth(url, { method: 'GET' }));
  if (!r.ok) {
    const err = new Error(r.body.error || `status_${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.body;
}

/** Confirm (or reconfirm): resolves `{ ok, status, body }` — 200, or the 409 / 410 / 422 refusal the sheet shows. */
export async function confirmHuddlePlan({ etDate, baseRevision, replacement }) {
  return asJson(await fetchWithAuth('/api/huddle/confirm', { method: 'POST', body: JSON.stringify({ etDate, baseRevision, replacement }) }));
}

export async function skipHuddlePlan({ etDate }) {
  return asJson(await fetchWithAuth('/api/huddle/skip', { method: 'POST', body: JSON.stringify({ etDate }) }));
}

/** A fresh, short-lived playback URL (the token rotates on every call). */
export async function issueHuddlePlayback({ etDate }) {
  const r = await asJson(await fetchWithAuth('/api/huddle/playback-token', { method: 'POST', body: JSON.stringify({ etDate }) }));
  if (!r.ok || typeof r.body.url !== 'string') {
    const err = new Error(r.body.error || 'playback_unavailable');
    err.status = r.status;
    throw err;
  }
  return { url: r.body.url, expiresAt: r.body.expiresAt ?? null };
}

/** A measurement event, awaited (BUILD_RULES §5); its failure is the caller's to ignore. */
export async function sendHuddleEvent({ etDate, kind }) {
  return asJson(await fetchWithAuth('/api/huddle/event', { method: 'POST', body: JSON.stringify({ etDate, kind }) }));
}

/** The owner's recent plans, newest first: { etDate, status, planStatus, confirmedAt, skippedAt }[]. */
export async function fetchHuddleHistory({ uid }) {
  const snap = await getDocs(query(collection(db, 'huddles', uid, 'days'), orderBy('etDate', 'desc'), limit(HISTORY_LIMIT)));
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      etDate: data.etDate ?? d.id,
      status: data.status ?? null,
      planStatus: data.plan?.status ?? null,
      confirmedAt: data.plan?.confirmed?.confirmedAt ?? null,
      skippedAt: data.plan?.skippedAt ?? null,
      stances: (data.plan?.confirmed?.current ?? data.plan?.current)?.stances?.map((s) => `${s.kind} ${s.ticker}`) ?? [],
    };
  });
}
