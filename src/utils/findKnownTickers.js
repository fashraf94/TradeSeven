// src/utils/findKnownTickers.js
//
// THE DETECTOR — "does this text name NVDA?" — Phase A2 (A2.3, ruling 8). PURE.
//
// Lifted out of renderMessageWithEntities.jsx unchanged. The chat has
// underlined tickers in messages since the Voice Layer rework; A2.3 needs the
// same question answered without rendering anything, so `In the chat · {n}`
// can count the messages that name a piece. Two answers to one question is the
// display-disagreement class BUILD_RULES §9 exists to forbid, so there is one
// scan and the renderer consumes it.
//
// THE RULE IS THE SHIPPED ONE, CAVEATS AND ALL (ruling 8). It is not improved
// here, because improving it would change what the shipped chat underlines:
//
//   · CASE-SENSITIVE. `\b([A-Z]{1,5})\b` — `slb` does not match.
//   · `$NVDA` MATCHES. `$` is a non-word character, so `\b` sits between it
//     and the `N`.
//   · A SYMBOL THAT IS ALSO AN ENGLISH WORD MATCHES THE WORD, when the word is
//     written in capitals (`ALL`, `ON`, `IT`).
//   · TICKER BEATS TERM. A word in the battle's roster is a ticker even when
//     it is also a glossary term; only the fallthrough is plain text, which is
//     what keeps `VWAP` / `PCE` / `RSI` out of a broken research modal.
//
// THIS IS NOT `symbolPattern` (selectWhyState.js), and the two are not being
// merged. They answer different questions over different corpora: this one
// asks "is this word in the battle's roster" of CONVERSATION text, that one
// asks "does this sentence name the tapped piece" of the decider's PROSE. A2's
// review measured them against each other — 75 disagreements in 2401
// differential inputs, all underscore-adjacent, never on prose (L5-F10,
// refuted as a defect). Reconciling them would change the shipped underline.

import { TERM_TOKENS_SET } from '../data/termUniverse';

/** The shipped matcher. A fresh instance per scan: `lastIndex` is stateful. */
const entityPattern = () => /\b([A-Z]{1,5})\b/g;

export const ENTITY_KIND = Object.freeze({ TICKER: 'ticker', TERM: 'term' });

/**
 * Every entity occurrence in `text`, in order, with the index the renderer
 * slices on. The ONE scan — `renderMessageWithEntities` maps this into spans
 * and `findKnownTickers` filters it, so the underline and the count can never
 * disagree about what naming a piece means.
 *
 * @param {string} text
 * @param {Set<string>|null} knownTickers  the battle's roster
 * @returns {Array<{ word: string, index: number, kind: string }>}
 */
export function scanEntities(text, knownTickers) {
  if (typeof text !== 'string' || !text) return [];
  const out = [];
  const regex = entityPattern();
  let match = regex.exec(text);
  while (match !== null) {
    const word = match[1];
    const isTicker = Boolean(knownTickers?.has(word));
    const isTerm = !isTicker && TERM_TOKENS_SET.has(word);
    if (isTicker || isTerm) {
      out.push({ word, index: match.index, kind: isTicker ? ENTITY_KIND.TICKER : ENTITY_KIND.TERM });
    }
    match = regex.exec(text);
  }
  return out;
}

/**
 * The roster symbols `text` names, DISTINCT and in first-occurrence order
 * (A2.3, ruling 8).
 *
 * Distinct because the question `In the chat · {n}` asks is how many ENTRIES
 * name a piece, not how many times a piece is written — a message that says
 * NVDA three times is one message about NVDA.
 *
 * @param {string} text
 * @param {Set<string>|null} knownTickers
 * @returns {string[]}
 */
export function findKnownTickers(text, knownTickers) {
  const seen = new Set();
  const out = [];
  for (const entity of scanEntities(text, knownTickers)) {
    if (entity.kind !== ENTITY_KIND.TICKER || seen.has(entity.word)) continue;
    seen.add(entity.word);
    out.push(entity.word);
  }
  return out;
}

/** Whether `text` names `symbol` under the rule above. */
export function textNamesTicker(text, symbol, knownTickers) {
  if (typeof symbol !== 'string' || !symbol) return false;
  return findKnownTickers(text, knownTickers).includes(symbol);
}

export default findKnownTickers;
