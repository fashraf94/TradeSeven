// src/constants/backingLexicon.js
//
// Backing Beta — ONE matcher for the backing lexicon (design brief §5 "never
// bet, wager, odds, cash out, or gamble — anywhere, including microcopy"),
// shared by the copy guard (backingCopy.guard.test.js) and the team-card
// projection's approach filter (api/tournament/team-card.js), so the two can
// never disagree on what a forbidden term is (R-B-5, the PR 4 review record).
//
// A term matches as a whole word and in its plain inflections — "bets",
// "betting", "bettor", "wagered", "gambling" — and never inside another word:
// "better", "between", "beta" and "alphabet" are clean. Node-clean; the one
// import is the zero-import constants module.

import { FORBIDDEN_TERMS } from './backing.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The regular expression for one forbidden term (case-insensitive, whole word, plain inflections). */
export function forbiddenTermRegExp(term) {
  const stem = escape(term).replace(/ /g, '\\s+');
  const alternatives = [`${stem}(?:s|es|d|ed|ing|ting|tor|tors|r|rs)?`];
  if (term.endsWith('e')) alternatives.push(`${escape(term.slice(0, -1))}ing`);
  return new RegExp(`\\b(?:${alternatives.join('|')})\\b`, 'i');
}

/** The first forbidden term the text carries, or null. */
export function findForbiddenTerm(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  for (const term of FORBIDDEN_TERMS) if (forbiddenTermRegExp(term).test(text)) return term;
  return null;
}
