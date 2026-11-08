// api/_utils/researchAsk.js
//
// Research Modal Build C — THE ASK, server side (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md BC-7, §4.3). Non-fenced;
// chat.js is its one caller.
//
// The request carries an OPTIONAL `researchAsk: { symbol, questionId, items[] }`.
//   parseResearchAsk      validates it against the sheet's closed vocabularies
//                         (packs.js): a known question, one to five items of
//                         known kinds and record kinds, each fact at most 200
//                         characters. Only the item shape's own keys survive;
//                         the client's `status` is never read. Absent → null
//                         (the turn is exactly main's).
//   verifyResearchItems   re-runs the SAME pack builder (packs.js — one builder,
//                         BUILD_RULES §4) over the battle document chat.js has
//                         just read. An item of a kind the server can re-read
//                         (packs.js SERVER_KINDS) whose kind and source record
//                         the rebuild also produced is replaced by the SERVER'S
//                         item, `verified`. Anything else keeps the client's
//                         words, `unverified`, with its reason: the client-only
//                         kinds their own (a live quote, the chart, the rankings,
//                         the scoreboard as shown), a server kind the record no
//                         longer holds 'not_on_record'.
//   researchAskForPrompt  the named input buildVoiceLayerPrompt renders as the
//                         RESEARCH ASK block (voiceLayerPrompt.js), the question
//                         in the server's own words (sheetCopy.js QUESTION_TEXT).
//
// Dependency surface: packs.js and sheetCopy.js are Node-clean (no React, no
// client SDK); researchAsk.test.js imports this module unmocked as the runtime
// guard that they stay so (BUILD_RULES §4).

import { QUESTION_IDS, ITEM_KINDS, RECORD_KINDS, SERVER_KINDS, CLIENT_REASON, FACT_MAX, candidateItems } from '../../src/components/Research/Sheet/packs.js';
import { QUESTION_TEXT } from '../../src/components/Research/Sheet/sheetCopy.js';
import { sanitizeChatText } from './chatTextSanitize.js';

export const RESEARCH_ASK_MAX_ITEMS = 5;
const RECORD_ID_MAX = 256;
const LABEL_MAX = 120;
const TICKER = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isoOrNull = (v) => {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v === 'string' && ISO.test(v) && Number.isFinite(Date.parse(v)) && new Date(Date.parse(v)).toISOString() === v) return { ok: true, value: v };
  return { ok: false };
};
const cleanText = (v, max) => {
  if (typeof v !== 'string') return null;
  const t = sanitizeChatText(v);
  return t && t.length <= max ? t : null;
};

function parseItem(raw, askSymbol) {
  if (!isPlain(raw)) return { error: 'item_not_object' };
  if (!ITEM_KINDS.includes(raw.kind)) return { error: 'item_kind' };
  const fact = cleanText(raw.fact, FACT_MAX);
  if (!fact) return { error: 'item_fact' };
  const symbol = raw.symbol === null || raw.symbol === undefined ? askSymbol : raw.symbol;
  if (typeof symbol !== 'string' || !TICKER.test(symbol)) return { error: 'item_symbol' };
  const src = raw.source;
  if (!isPlain(src) || !RECORD_KINDS.includes(src.recordKind)) return { error: 'item_source' };
  const recordId = typeof src.recordId === 'string' && src.recordId.length <= RECORD_ID_MAX ? sanitizeChatText(src.recordId) : null;
  const label = cleanText(src.label, LABEL_MAX);
  if (recordId === null || !label) return { error: 'item_source' };
  const at = isoOrNull(raw.at);
  const asOf = isoOrNull(raw.asOf);
  if (!at.ok || !asOf.ok) return { error: 'item_instant' };
  let pin = null;
  if (raw.pin !== null && raw.pin !== undefined) {
    const p = raw.pin;
    if (isPlain(p) && p.type === 'price' && typeof p.value === 'number' && Number.isFinite(p.value) && p.value > 0) pin = { type: 'price', value: p.value };
    else if (isPlain(p) && p.type === 'time' && isoOrNull(p.value).ok && p.value) pin = { type: 'time', value: p.value };
    else return { error: 'item_pin' };
  }
  return { item: { kind: raw.kind, symbol, fact, source: { recordKind: src.recordKind, recordId, label }, at: at.value, asOf: asOf.value, status: 'unverified', statusReason: null, pin } };
}

/**
 * @param {*} raw  req.body.researchAsk
 * @returns {{ ok: true, ask: null } | { ok: true, ask: { symbol, questionId, items } } | { ok: false, reason: string }}
 */
export function parseResearchAsk(raw) {
  if (raw === undefined || raw === null) return { ok: true, ask: null };
  if (!isPlain(raw)) return { ok: false, reason: 'not_object' };
  const symbol = raw.symbol;
  if (typeof symbol !== 'string' || !TICKER.test(symbol)) return { ok: false, reason: 'symbol' };
  if (!QUESTION_IDS.includes(raw.questionId)) return { ok: false, reason: 'question' };
  if (!Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > RESEARCH_ASK_MAX_ITEMS) return { ok: false, reason: 'items' };
  const items = [];
  for (const it of raw.items) {
    const parsed = parseItem(it, symbol);
    if (parsed.error) return { ok: false, reason: parsed.error };
    items.push(parsed.item);
  }
  return { ok: true, ask: { symbol, questionId: raw.questionId, items } };
}

/**
 * The Ask's items with the server's status (BC-7): a server kind it re-derived
 * is the SERVER's item, `verified`; everything else is the client's, `unverified`.
 * Never throws: a rebuild that fails leaves every item unverified ('not_reread').
 */
export function verifyResearchItems({ battle, battleId = null, ask, nowMs }) {
  let server = [];
  let reread = true;
  try {
    const incumbent = ask.items.find((it) => it.kind === 'incumbent')?.symbol ?? null;
    server = candidateItems({ battle, symbol: ask.symbol, nowMs, row: {}, battleId, directive: battle?.directive ?? null, incumbent }).items;
  } catch {
    reread = false;
  }
  return ask.items.map((it) => {
    if (SERVER_KINDS.includes(it.kind)) {
      const own = reread ? server.find((s) => s.kind === it.kind && s.source.recordId === it.source.recordId) : null;
      if (own) return { ...own, status: 'verified', statusReason: null };
      return { ...it, status: 'unverified', statusReason: reread ? 'not_on_record' : 'not_reread' };
    }
    return { ...it, status: 'unverified', statusReason: CLIENT_REASON[it.kind] ?? 'client_only' };
  });
}

/** The named prompt input (voiceLayerPrompt.js renderResearchAskBlock). */
export function researchAskForPrompt({ ask, items }) {
  return { symbol: ask.symbol, questionId: ask.questionId, question: QUESTION_TEXT[ask.questionId], items };
}
