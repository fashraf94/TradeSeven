// src/services/sharedResearchService.js
//
// Shared Research — the sheet's client for its one route,
// api/forge/shared-research.js (spec §6.3, §7.1), and the two existing calls
// behind "Use it in my next game" (K-9). fetchWithAuth for every request.
//
// Every call RESOLVES, never throws, with one shape the hook branches on:
//   { ok, status, body, retryAfterS, gated, network }
//   - status 0 + network: true — no answer arrived: the connection failed, or the
//     client's own timeout (CLIENT_TIMEOUT_MS, above the route's 30 s) aborted it.
//     For a save that is the UNCERTAIN case: the server may have committed (K-8);
//   - gated: the route answered 404 { error: 'disabled' } — the gate is off for
//     this player (K-3), whatever the hub passed;
//   - retryAfterS: a 429's wait, from the Retry-After header (both limiters send
//     it) or the body's retryAfter.
// The body is the server's answer as received: the sheet echoes `previewRev`
// from it untouched (spec §16 FQ-7) and shows a refusal's `message` (K-5).

import { fetchWithAuth } from '../utils/fetchWithAuth';
import { transitionHypothesis } from './hypothesisVersionService';
import { equipLoadoutBook } from './loadoutService';

export const SHARED_RESEARCH_ROUTE = '/api/forge/shared-research';
/** The client gives up after this long: the route's maxDuration is 30 s. */
export const CLIENT_TIMEOUT_MS = 35_000;

/** A fresh id for one request or one step (a uuid: both the forge-id and the uuid shape). */
export function newRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const NO_ANSWER = Object.freeze({ ok: false, status: 0, body: null, retryAfterS: null, gated: false, network: true });

async function call(url, init) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS) : null;
  try {
    const res = await fetchWithAuth(url, controller ? { ...init, signal: controller.signal } : init);
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null; // a non-JSON answer (a platform error page): the status still speaks
    }
    const header = Number(res.headers?.get?.('Retry-After'));
    const wait = Number.isFinite(header) && header > 0 ? header : Number(body?.retryAfter);
    return {
      ok: res.ok === true, status: res.status, body,
      retryAfterS: res.status === 429 && Number.isFinite(wait) && wait > 0 ? wait : null,
      gated: res.status === 404 && body?.error === 'disabled',
      network: false,
    };
  } catch {
    return { ...NO_ANSWER };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const post = (body) => call(SHARED_RESEARCH_ROUTE, { method: 'POST', body: JSON.stringify(body) });

/** GET ?list=open — "Continue your research" (≤ 3 rows) and today's quota. */
export const listOpenInvestigations = () => call(`${SHARED_RESEARCH_ROUTE}?list=open`, { method: 'GET' });
/** GET ?sessionId= — one investigation as the server projects it (also the save check, K-8). */
export const readInvestigation = (sessionId) => call(`${SHARED_RESEARCH_ROUTE}?sessionId=${encodeURIComponent(sessionId)}`, { method: 'GET' });
/** POST frame — the player's words framed into a question (one model call). */
export const frameQuestion = ({ observation, requestId }) => post({ action: 'frame', observation, requestId });
/** POST open — a story, a drop (`entry`, `requestId`) or a framed observation (`sessionId`). */
export const openInvestigation = (body) => post({ action: 'open', ...body });
/** POST step — one evidence step: `{ sessionId, stepId, intent, direction?, target? }`. */
export const takeStep = (body) => post({ action: 'step', ...body });
/** POST close — `{ sessionId, reason: 'concluded' | 'abandoned' }`. */
export const closeInvestigation = (body) => post({ action: 'close', ...body });
/** POST adopt — the idea, with the preview's `previewRev` exactly as the server sent it. */
export const adoptIdea = (body) => post({ action: 'adopt', ...body });

/**
 * "Use it in my next game" (K-9; spec §6.6): the existing ready transition, then
 * the existing equip route. A ready that already happened (409 status_conflict)
 * proceeds to equip. Resolves { ok: true } or { ok: false, step, error }.
 */
export async function equipIdea({ agentId, watchlistId }) {
  try {
    await transitionHypothesis(watchlistId, { version: 1, action: 'ready', expectedStatus: 'researched' });
  } catch (error) {
    if (error?.code !== 'status_conflict') return { ok: false, step: 'ready', error };
  }
  try {
    const out = await equipLoadoutBook(agentId, watchlistId, 'baggerbomb');
    return { ok: true, out };
  } catch (error) {
    return { ok: false, step: 'equip', error };
  }
}
