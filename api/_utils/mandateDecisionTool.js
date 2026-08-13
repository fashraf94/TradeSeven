// api/_utils/mandateDecisionTool.js
//
// Spec 1 — Mandate Substrate — the decision tool schema (§3.4). One action per
// eval, sized in DOLLARS (shares derive at execution from the harvest mark, I3).
// Bandwidth is deliberately one action per eval (I16): auditability and gate
// simplicity over de-risking speed. Verbs come from the pinned vintage's
// gateConfig.decisionVerbs (frozen per book, D-44) — the schema is built from
// that list so a book's tool matches its vintage exactly.
//
// tool_choice forces this tool (§3.3): the model always returns a structured
// decision, never free text. The model seam (mandateModelCall.js) sets
// tool_choice and validates the returned input against this schema's contract.

import { MANDATE_DECISION_VERBS } from './mandateConfig.js';

export const MANDATE_DECISION_TOOL_NAME = 'submit_mandate_decision';

/**
 * Build the decision tool for a book, using the verb set frozen in its vintage
 * (falls back to the platform default if a caller passes none).
 *
 * @param {string[]} [verbs] — gateConfig.decisionVerbs from the pinned vintage.
 */
export function buildMandateDecisionTool(verbs = MANDATE_DECISION_VERBS) {
  const verbEnum = [...verbs];
  return {
    name: MANDATE_DECISION_TOOL_NAME,
    description:
      'Submit exactly one portfolio action for this evaluation. '
      + 'BUY = open a new position (dollars). ADD = increase an existing position (dollars). '
      + 'SELL = fully exit a position. TRIM = reduce a position (dollars). HOLD = take no action this eval. '
      + 'Size is in US dollars; share quantities are derived at execution from the current mark. '
      + 'You may name only tickers present in the candidate universe for BUY/ADD.',
    input_schema: {
      type: 'object',
      required: ['verb', 'rationale'],
      properties: {
        verb: {
          type: 'string',
          enum: verbEnum,
          description: 'The single action for this eval. HOLD names no ticker and no size.',
        },
        ticker: {
          type: ['string', 'null'],
          description: 'The symbol acted on. Required for BUY/ADD/SELL/TRIM; null (or omitted) for HOLD.',
        },
        sizeUsd: {
          type: ['number', 'null'],
          description:
            'Dollar size of the action. Required for BUY/ADD/TRIM (positive USD). '
            + 'Ignored for SELL (a full exit) and HOLD. Sizes are clamped to available cash / held shares at execution.',
        },
        conviction: {
          type: ['integer', 'null'],
          minimum: 0,
          maximum: 100,
          description: 'Confidence in this action (0–100). Optional.',
        },
        rationale: {
          type: 'string',
          description:
            'First-person, in-character reasoning citing specific numbers from the context. 2–5 sentences.',
        },
      },
    },
  };
}

/** Verbs that require a ticker (everything but HOLD). */
export const TICKER_VERBS = Object.freeze(['BUY', 'ADD', 'SELL', 'TRIM']);
/** Verbs that require a positive dollar size. SELL is a full exit (size derived from holdings). */
export const SIZED_VERBS = Object.freeze(['BUY', 'ADD', 'TRIM']);
/** Entry verbs (subject to the entry gates). */
export const ENTRY_VERBS = Object.freeze(['BUY', 'ADD']);
/** Exit verbs (the exit lane — never blocked by entry rules, C-21). */
export const EXIT_VERBS = Object.freeze(['SELL', 'TRIM']);
/** §6.4/I2 exit-only mode: the verb set a QUARANTINED book's tool is restricted to. */
export const EXIT_MODE_VERBS = Object.freeze(['SELL', 'TRIM', 'HOLD']);

/** The effective verb set for a book: the vintage's verbs, intersected with
 * EXIT_MODE_VERBS when quarantined (§6.4 — entries leave the tool schema
 * itself, so the model cannot even emit a BUY/ADD in exit-only mode). */
export function effectiveVerbs(vintageVerbs = MANDATE_DECISION_VERBS, { quarantined = false } = {}) {
  const base = [...(vintageVerbs || MANDATE_DECISION_VERBS)];
  if (!quarantined) return base;
  const restricted = base.filter((v) => EXIT_MODE_VERBS.includes(v));
  // A vintage whose verb set somehow lacks every exit verb still gets HOLD —
  // the tool must never be empty (fail-safe, not fail-open: HOLD trades nothing).
  return restricted.length > 0 ? restricted : ['HOLD'];
}

/**
 * Shape-validate a raw tool input into a normalized decision, or return an error.
 * Structural only — the deterministic gate (mandateGate.js) enforces policy.
 *
 * @returns {{ ok: true, decision: {verb, ticker, sizeUsd, conviction, rationale} }
 *          | { ok: false, reason: string }}
 */
export function normalizeDecisionInput(raw, { verbs = MANDATE_DECISION_VERBS } = {}) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'no_input' };
  const verb = typeof raw.verb === 'string' ? raw.verb.toUpperCase() : null;
  if (!verb || !verbs.includes(verb)) return { ok: false, reason: 'bad_verb' };

  const ticker = raw.ticker != null ? String(raw.ticker).trim().toUpperCase() : null;
  if (TICKER_VERBS.includes(verb) && !ticker) return { ok: false, reason: 'missing_ticker' };

  let sizeUsd = null;
  if (SIZED_VERBS.includes(verb)) {
    const n = typeof raw.sizeUsd === 'string' ? Number(raw.sizeUsd) : raw.sizeUsd;
    if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: 'bad_size' };
    sizeUsd = n;
  }

  const conviction = Number.isFinite(raw.conviction) ? Math.max(0, Math.min(100, Math.round(raw.conviction))) : null;
  const rationale = typeof raw.rationale === 'string' ? raw.rationale : '';

  return { ok: true, decision: { verb, ticker: verb === 'HOLD' ? null : ticker, sizeUsd, conviction, rationale } };
}
