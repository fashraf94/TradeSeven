// api/_utils/practiceField/agentTool.js
//
// Practice Field build B2 — THE ONE TOOL THE AGENT ANSWERS THROUGH, and the code that validates what comes back (§1:
// "output through one tool with a strict schema — the mandateDecisionTool pattern — validate everything by code").
//
// THE TOOL (`submit_book_check`) asks for exactly three things: `bookNote` (the desk's note on the book), `actions` (one
// per open idea of the desk: `hold` or `exit`, each with a reason) and `drafts` (up to three). There is NO money field:
// the agent names the slot, the names, the comparison, the line distances, the thesis and where it came from; code sizes
// and clamps (ruling B2-3). The schema is the model's guide, not the guard: Sonnet 5.5 refuses a forced tool choice, so
// the request asks with `auto` and an answer may arrive in any shape. The API's `strict` mode is not used (a large
// strict schema was refused live in this repo — "compiled grammar is too large"); code checks every field instead.
//
// WHAT CODE REFUSES, AS A WHOLE ANSWER (the desk falls back to the code-built note and changes nothing):
//   • no tool call, more than one, another tool, a block of an unexpected kind, a refusal or a cut-off answer;
//   • an unknown field at any level (the reason names it only when it is a plain identifier with no result word); a
//     field of the wrong type;
//   • a note that is empty, longer than 600 code points (B11), holds a broken character or one of the result words
//     ("validated", "proven", "supported");
//   • an action naming an idea that is not one of THIS desk's open ideas (another desk's included), two actions for one
//     idea, an open idea with no action, an action that is not `hold` or `exit`, a reason empty or over 280 code points;
//   • more than three drafts, or a draft that is not the shape below.
//
// RULING R-18 (the founder, B2 fix round, 23 Nov 2026; Astra B2-A02), verbatim:
//   "null on an optional field means 'omitted'. Models often write null for a field they mean to leave out. Refusing the
//   whole answer for that would turn ordinary days into fallback days. So an explicit null on an optional field is read as
//   omitted, by rule. Every other wrong type is refused whole, as R-4 says: a string where an array belongs, a number where
//   a string belongs, an array of the wrong element type. After reading null as omitted, the draft must still be valid on
//   its own. A same_stock_held comparison needs no symbols. A sector_fund comparison with symbols: null is refused as that
//   draft, and listed as considered."
// So: every OPTIONAL property the raw tool object contains (`comparison.symbols`, `source.thesisRef` — the tool's only two)
// is read through optionalOf: absent or `null` is omitted; any other value must be its declared type, or the WHOLE answer
// is refused. A draft that is then incomplete on its own (a `sector_fund` with no fund) is not the answer's shape: it is
// refused as that draft, at drafting, by the contract's own codes (admission.js normalizeIdeaContract).
//
// WHAT THE CLOSE ROW STORES OF A DRAFT (B2-A06). A draft's `thesisRef` belongs to the `saved_thesis` source only: on a
// `price_list` draft it is checked for its type (R-18) and then DROPPED, so it never reaches the stored answer or the
// considered list. Every text of a draft that the row stores — the slot, the thesis, each name, the comparison's type and
// each of its symbols, each line's symbol and a kept `thesisRef` — passes the result-word check; a draft carrying one refuses the whole answer, as the note
// and the reasons do.
//
// What a DRAFT says about the market — a slot of the other desk, a name nobody prices, a line outside its band — is
// not the answer's shape: it is refused draft by draft at drafting (agentDrafting.js), and each refusal goes on the
// close row's considered list.
//
// Pure.

import { COMPARISON_TYPES, THESIS_MAX_CODE_POINTS } from './constants.js';
import { hasLoneSurrogate } from './contract.js';
import {
  AGENT_NOTE_MAX_CODE_POINTS, AGENT_REASON_MAX_CODE_POINTS, AGENT_DRAFTS_PER_CALL, AGENT_ACTIONS, BANNED_AGENT_WORDS, DESKS,
} from './agentConfig.js';
import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';

export const AGENT_TOOL_NAME = 'submit_book_check';
/** The schema's own version (its own family). */
export const AGENT_TOOL_VERSION = 1;

/** Where a draft says it came from: the shared price list, or one of the owner's saved theses (by its local label). */
export const DRAFT_SOURCE_KINDS = Object.freeze(['price_list', 'saved_thesis']);

const ANSWER_KEYS = Object.freeze(['bookNote', 'actions', 'drafts']);
const ACTION_KEYS = Object.freeze(['ideaId', 'action', 'reason']);
const DRAFT_KEYS = Object.freeze(['slot', 'thesis', 'names', 'comparison', 'lines', 'source']);
const COMPARISON_KEYS = Object.freeze(['type', 'symbols']);
const LINE_KEYS = Object.freeze(['symbol', 'distancePct']);
const SOURCE_KEYS = Object.freeze(['kind', 'thesisRef']);
const MAX_SYMBOL_LEN = 12;
const MAX_LIST_LEN = 8;

/** The tool for one desk: its slots are the only ones the schema offers. */
export function buildAgentTool(deskId) {
  const desk = DESKS[deskId];
  if (!desk) throw new Error(`buildAgentTool: unknown desk '${deskId}'`);
  const names = PRACTICE_FIELD_SLOTS.B3_NAMES_PER_IDEA;
  return {
    name: AGENT_TOOL_NAME,
    description:
      'Submit this desk\'s one check of the book for today: the note, one action for EACH of your open ideas, and up to '
      + `${AGENT_DRAFTS_PER_CALL} drafts for your empty slots. Call it exactly once. You never set money: code sizes every `
      + 'idea and refuses any draft outside the rails.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['bookNote', 'actions', 'drafts'],
      properties: {
        bookNote: { type: 'string', description: `Today's note on the book from this desk: plain words, at most ${AGENT_NOTE_MAX_CODE_POINTS} characters.` },
        actions: {
          type: 'array',
          description: 'One entry per open idea of THIS desk, and no other: hold it, or exit it early.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['ideaId', 'action', 'reason'],
            properties: {
              ideaId: { type: 'string', description: 'The idea id exactly as listed under "Your open ideas".' },
              action: { type: 'string', enum: [...AGENT_ACTIONS], description: 'hold: change nothing. exit: settle the idea early; code sells at the next session\'s first window.' },
              reason: { type: 'string', description: `One line, at most ${AGENT_REASON_MAX_CODE_POINTS} characters.` },
            },
          },
        },
        drafts: {
          type: 'array',
          maxItems: AGENT_DRAFTS_PER_CALL,
          description: 'Ideas for your EMPTY slots only, in your order of preference. Leave it empty if nothing is worth drafting.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['slot', 'thesis', 'names', 'comparison', 'lines', 'source'],
            properties: {
              slot: { type: 'string', enum: [...desk.slots] },
              thesis: { type: 'string', description: `One sentence, at most ${THESIS_MAX_CODE_POINTS} characters.` },
              names: { type: 'array', minItems: names.min, maxItems: names.max, items: { type: 'string' }, description: 'Symbols from the candidate list.' },
              comparison: {
                type: 'object',
                additionalProperties: false,
                required: ['type'],
                properties: {
                  type: { type: 'string', enum: [...COMPARISON_TYPES] },
                  symbols: { type: 'array', items: { type: 'string' }, description: 'sector_fund: the one fund. frozen_basket: 2 to 8 universe stocks. same_stock_held: omit.' },
                },
              },
              lines: {
                type: 'array',
                description: 'One per name: how far below its entry price the line sits, as a fraction (0.08 = 8% below).',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['symbol', 'distancePct'],
                  properties: { symbol: { type: 'string' }, distancePct: { type: 'number' } },
                },
              },
              source: {
                type: 'object',
                additionalProperties: false,
                required: ['kind'],
                properties: {
                  kind: { type: 'string', enum: [...DRAFT_SOURCE_KINDS] },
                  thesisRef: { type: 'string', description: 'saved_thesis only: the label of the saved thesis (T1 to T5).' },
                },
              },
            },
          },
        },
      },
    },
  };
}

/** `tool_choice` for the request: `auto`, at most one tool call (Sonnet 5.5 refuses a forced choice). */
export const AGENT_TOOL_CHOICE = Object.freeze({ type: 'auto', disable_parallel_tool_use: true });

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const codePoints = (s) => [...s].length;
/**
 * Refuter F1: an unknown field's NAME as a refusal reason carries it (the reason is stored on the close row): a plain
 * identifier of at most 40 characters with no result word, else `?`.
 */
function keyForReason(k) { return /^[A-Za-z0-9_]{1,40}$/.test(k) && !carriesBannedWord(k) ? k : '?'; }
const unknownKeys = (obj, allowed) => Object.keys(obj).filter((k) => !allowed.includes(k)).map(keyForReason);

/** The block kinds an answer may carry beside its one tool call (adaptive thinking runs by default on Sonnet 5.5). */
const ALLOWED_BLOCKS = new Set(['text', 'thinking', 'redacted_thinking', 'tool_use']);

/**
 * The one tool call of a model response, or why there is none. Pure.
 * @returns {{ ok: true, input: object } | { ok: false, reason: string }}
 */
export function extractAgentToolInput(response) {
  if (!isPlain(response)) return { ok: false, reason: 'no_response' };
  if (response.stop_reason === 'refusal') return { ok: false, reason: 'refusal' };
  if (response.stop_reason === 'max_tokens') return { ok: false, reason: 'max_tokens' };
  const content = Array.isArray(response.content) ? response.content : [];
  const calls = [];
  for (const block of content) {
    if (!ALLOWED_BLOCKS.has(block?.type)) return { ok: false, reason: `unexpected_block:${block?.type ?? 'none'}` };
    if (block.type === 'tool_use') calls.push(block);
  }
  if (calls.length === 0) return { ok: false, reason: 'no_tool_call' };
  if (calls.length > 1) return { ok: false, reason: 'more_than_one_tool_call' };
  if (calls[0].name !== AGENT_TOOL_NAME) return { ok: false, reason: 'unknown_tool' };
  return { ok: true, input: calls[0].input };
}

/** A bounded text field: the trimmed text, or the reason it is refused. */
function textOf(v, max, field) {
  if (typeof v !== 'string') return { error: `${field}:not_text` };
  const t = v.trim();
  if (t.length === 0) return { error: `${field}:empty` };
  if (codePoints(t) > max) return { error: `${field}:too_long` };
  if (hasLoneSurrogate(t)) return { error: `${field}:broken_character` };
  if (BANNED_AGENT_WORDS.test(t)) return { error: `${field}:banned_word` };
  return { text: t };
}

const symbolOk = (s) => typeof s === 'string' && s.length > 0 && s.length <= MAX_SYMBOL_LEN && !hasLoneSurrogate(s);

/**
 * R-18: an OPTIONAL property of the raw tool object. Absent or `null` is omitted; any other value must pass `check` (its
 * declared type), or the field is refused — and with it the whole answer.
 * @returns {{ omitted: true } | { value: unknown } | { error: string }}
 */
function optionalOf(obj, key, check, at) {
  const v = obj[key];
  if (v === undefined || v === null) return { omitted: true };
  return check(v) ? { value: v } : { error: `${at}.${key}:invalid` };
}

/** B2-A06: does a stored text carry a result word? */
function carriesBannedWord(s) { return typeof s === 'string' && BANNED_AGENT_WORDS.test(s); }

/** One draft's shape, normalised, or the reason it is refused. */
function draftOf(d, i) {
  // Refuter F1: the slot and the comparison's type are stored on the row too (the answer, the considered list, a
  // refusal's detail) — they pass the result-word check like every other text of the draft.
  const at = `drafts[${i}]`;
  if (!isPlain(d)) return { error: `${at}:not_an_object` };
  const extra = unknownKeys(d, DRAFT_KEYS);
  if (extra.length > 0) return { error: `${at}:unknown_field:${extra[0]}` };
  if (typeof d.slot !== 'string' || d.slot.length === 0 || d.slot.length > 20) return { error: `${at}.slot:invalid` };
  if (carriesBannedWord(d.slot)) return { error: `${at}.slot:banned_word` };
  const thesis = textOf(d.thesis, THESIS_MAX_CODE_POINTS, `${at}.thesis`);
  if (thesis.error) return thesis;
  if (!Array.isArray(d.names) || d.names.length === 0 || d.names.length > MAX_LIST_LEN || !d.names.every(symbolOk)) return { error: `${at}.names:invalid` };
  if (!isPlain(d.comparison)) return { error: `${at}.comparison:invalid` };
  const cExtra = unknownKeys(d.comparison, COMPARISON_KEYS);
  if (cExtra.length > 0) return { error: `${at}.comparison:unknown_field:${cExtra[0]}` };
  if (typeof d.comparison.type !== 'string') return { error: `${at}.comparison.type:invalid` };
  if (carriesBannedWord(d.comparison.type)) return { error: `${at}.comparison.type:banned_word` };
  const cSymbols = optionalOf(d.comparison, 'symbols', (v) => Array.isArray(v) && v.length <= MAX_LIST_LEN && v.every(symbolOk), `${at}.comparison`);
  if (cSymbols.error) return cSymbols;
  if (!Array.isArray(d.lines) || d.lines.length === 0 || d.lines.length > MAX_LIST_LEN) return { error: `${at}.lines:invalid` };
  for (const [j, l] of d.lines.entries()) {
    if (!isPlain(l)) return { error: `${at}.lines[${j}]:invalid` };
    const lExtra = unknownKeys(l, LINE_KEYS);
    if (lExtra.length > 0) return { error: `${at}.lines[${j}]:unknown_field:${lExtra[0]}` };
    if (!symbolOk(l.symbol) || typeof l.distancePct !== 'number' || !Number.isFinite(l.distancePct)) return { error: `${at}.lines[${j}]:invalid` };
  }
  if (!isPlain(d.source)) return { error: `${at}.source:invalid` };
  const sExtra = unknownKeys(d.source, SOURCE_KEYS);
  if (sExtra.length > 0) return { error: `${at}.source:unknown_field:${sExtra[0]}` };
  if (!DRAFT_SOURCE_KINDS.includes(d.source.kind)) return { error: `${at}.source.kind:invalid` };
  const ref = optionalOf(d.source, 'thesisRef', (v) => typeof v === 'string' && v.length > 0 && v.length <= 8, `${at}.source`);
  if (ref.error) return ref;
  // B2-A06: the label belongs to a saved thesis only; on any other source it is dropped (after its type was checked).
  const thesisRef = d.source.kind === 'saved_thesis' && !ref.omitted ? ref.value : null;
  // B2-A06: every text the close row stores of the draft passes the result-word check (the thesis passed it above).
  if (d.names.some(carriesBannedWord)) return { error: `${at}.names:banned_word` };
  if (!cSymbols.omitted && cSymbols.value.some(carriesBannedWord)) return { error: `${at}.comparison.symbols:banned_word` };
  if (d.lines.some((l) => carriesBannedWord(l.symbol))) return { error: `${at}.lines:banned_word` };
  if (carriesBannedWord(thesisRef)) return { error: `${at}.source.thesisRef:banned_word` };
  return {
    draft: {
      index: i,
      slot: d.slot,
      thesis: thesis.text,
      names: [...d.names],
      comparison: { type: d.comparison.type, ...(cSymbols.omitted ? {} : { symbols: [...cSymbols.value] }) },
      lines: d.lines.map((l) => ({ symbol: l.symbol, distancePct: l.distancePct })),
      source: { kind: d.source.kind, thesisRef },
    },
  };
}

/**
 * Validate the tool's input for one desk. `openIdeaIds` are THIS desk's open ideas — every one needs exactly one action,
 * and no other id may appear. Pure.
 *
 * @returns {{ ok: true, answer: { bookNote: string, actions: Array<object>, drafts: Array<object> } }
 *          | { ok: false, reason: string }}
 */
export function validateAgentAnswer(raw, { openIdeaIds }) {
  if (!isPlain(raw)) return { ok: false, reason: 'answer:not_an_object' };
  const extra = unknownKeys(raw, ANSWER_KEYS);
  if (extra.length > 0) return { ok: false, reason: `answer:unknown_field:${extra[0]}` };
  const note = textOf(raw.bookNote, AGENT_NOTE_MAX_CODE_POINTS, 'bookNote');
  if (note.error) return { ok: false, reason: note.error };

  if (!Array.isArray(raw.actions)) return { ok: false, reason: 'actions:not_a_list' };
  const known = new Set(openIdeaIds);
  const seen = new Set();
  const actions = [];
  for (const [i, a] of raw.actions.entries()) {
    if (!isPlain(a)) return { ok: false, reason: `actions[${i}]:not_an_object` };
    const aExtra = unknownKeys(a, ACTION_KEYS);
    if (aExtra.length > 0) return { ok: false, reason: `actions[${i}]:unknown_field:${aExtra[0]}` };
    if (typeof a.ideaId !== 'string' || !known.has(a.ideaId)) return { ok: false, reason: `actions[${i}]:unknown_idea` };
    if (seen.has(a.ideaId)) return { ok: false, reason: `actions[${i}]:duplicate_idea` };
    seen.add(a.ideaId);
    if (!AGENT_ACTIONS.includes(a.action)) return { ok: false, reason: `actions[${i}]:unknown_action` };
    const reason = textOf(a.reason, AGENT_REASON_MAX_CODE_POINTS, `actions[${i}].reason`);
    if (reason.error) return { ok: false, reason: reason.error };
    actions.push({ ideaId: a.ideaId, action: a.action, reason: reason.text });
  }
  const missing = openIdeaIds.filter((id) => !seen.has(id));
  if (missing.length > 0) return { ok: false, reason: 'actions:missing_idea' };

  if (!Array.isArray(raw.drafts)) return { ok: false, reason: 'drafts:not_a_list' };
  if (raw.drafts.length > AGENT_DRAFTS_PER_CALL) return { ok: false, reason: 'drafts:too_many' };
  const drafts = [];
  for (const [i, d] of raw.drafts.entries()) {
    const out = draftOf(d, i);
    if (out.error) return { ok: false, reason: out.error };
    drafts.push(out.draft);
  }
  return { ok: true, answer: { bookNote: note.text, actions, drafts } };
}
