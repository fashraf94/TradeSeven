// api/_utils/openerTemplateFloor.js
//
// Deterministic, no-LLM fallback opener for the Voice Layer first-message.
// Used ONLY by api/agent/ensure-opener.js when the patient Gemma regeneration
// also fails, so a fresh-deploy chat is never silent. Pure + Node-clean: no
// Firestore, no network, no randomness, no side effects — composed only from
// fields already on the battle/agent docs. Unit-tested directly.
//
// Imports getArchetypeLabel from the FENCED api/_utils/agentArchetypeConfig.js as
// a READ-ONLY import (permitted by BUILD_RULES §1 — the fenced file is not
// edited; only its exported label map is called).

import { getArchetypeLabel } from './agentArchetypeConfig.js';

// Per-archetype posture line — short + deterministic so the floor reads like the
// agent rather than a form letter. Keyed by the archetype code-id (the same keys
// getArchetypeLabel resolves). Unknown/missing archetypes use DEFAULT_POSTURE.
const ARCHETYPE_POSTURE = {
  momentum_chaser: 'riding strength and cutting the laggards fast',
  analyst: 'leaning on the fundamentals and giving the theses room to play out',
  diversifier: 'spreading the risk and keeping us balanced across the book',
  contrarian: 'looking where the crowd is leaning the wrong way',
  degen: 'swinging for the high-upside setups',
  guardian: 'protecting the downside first and pressing only the clean edges',
};
const DEFAULT_POSTURE = 'reading the tape as it develops and keeping you in the loop';

// Up to `cap` valid symbols from a portfolio tier array.
function tierSymbols(tier, cap = 3) {
  if (!Array.isArray(tier)) return [];
  return tier
    .map((p) => (p && typeof p.symbol === 'string' ? p.symbol.trim() : null))
    .filter(Boolean)
    .slice(0, cap);
}

// "A", "A and B", "A, B and C".
function humanList(items) {
  const a = items.filter(Boolean);
  if (a.length === 0) return '';
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

/**
 * Build a deterministic opening message from data already on the docs.
 * Never throws; always returns a non-empty string with no "null"/"undefined".
 *
 * @param {Object} [params]
 * @param {Object} [params.agent]  the agent doc (archetype fallback source)
 * @param {Object} [params.battle] the agentBattles doc (portfolio + agentContext)
 * @returns {string} the agentResponse text for a first_message exchange
 */
export function buildTemplateOpener({ agent, battle } = {}) {
  const archetypeCode = battle?.agentContext?.archetype || agent?.archetype || null;
  const label = getArchetypeLabel(archetypeCode); // fenced helper; has its own safe fallback
  const posture = ARCHETYPE_POSTURE[archetypeCode] || DEFAULT_POSTURE;

  const portfolio = battle?.portfolio || {};
  const star = tierSymbols(portfolio.star);
  const core = tierSymbols(portfolio.core);
  const support = tierSymbols(portfolio.support);

  // Degrade tier by tier so a partial portfolio still reads naturally.
  const bookParts = [];
  if (star.length) bookParts.push(`${humanList(star)} up top`);
  if (core.length) bookParts.push(`${humanList(core)} in core`);
  if (support.length) bookParts.push(`${humanList(support)} backing it up`);
  const book = bookParts.length
    ? `I've built the book around ${humanList(bookParts)}. `
    : '';

  return (
    `Hey — we're live. ${book}`
    + `I'm running this as a ${label}, so I'll be ${posture}. `
    + `I'll flag anything that starts moving — anything you want me watching from the open?`
  );
}
