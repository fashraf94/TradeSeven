// src/components/League/battleArena/arenaBeatTab.js
//
// League Battle View V2 — the BEAT → TAB router for the mobile arena (Phase 4,
// pure + node-clean). The mobile arena splits the desktop dock into three tabs —
// Your Portfolio (your three) · Agent Portfolio (the agent's six) · Chat (the
// agent's voice). When a beat fires on a tab you're NOT looking at, that tab
// pulses. This maps the engine's `beatStar` to the tab(s) it belongs to.
//
// WHY beatStar (not the raw beat): the engine sets `beatStar = {tk, kind, key}`
// ONLY for star-bearing beats and KEEPS it until the next one (arenaEngineCore
// applyBeat); the transient `beat` caption clears after its dwell and also fires
// for starless `lead`/board beats. So the pulse effect keys on `beatStar.key`, and
// a starless beat (a lead change about the HERO, not a holding) routes to nothing.
//
// EXHAUSTIVE over the engine's star-bearing kinds: 'flip' (your reversal) · 'swap'
// (the agent's trade — also lands in chat as a new voice line) · 'hit'/'edge'/
// 'danger'/'claim' (a star transition, routed by which book holds the ticker).
// ('busted' collapses to 'danger' upstream; 'lead'/board carry star:null.)

const YOU = 'you';
const AGENT = 'agent';
const CHAT = 'chat';

/**
 * Which tabs a beat should pulse.
 * @param {{tk:string, kind:string}|null} beatStar  the engine's current beatStar
 * @param {{agentTks:Set<string>|string[], yourTks:Set<string>|string[]}} books
 * @returns {string[]} zero or more of 'you' | 'agent' | 'chat'
 */
export function beatTabs(beatStar, { agentTks = [], yourTks = [] } = {}) {
  if (!beatStar || !beatStar.tk) return []; // starless (lead change / board) → pulse nothing
  const has = (set, tk) => (set instanceof Set ? set.has(tk) : Array.isArray(set) && set.includes(tk));
  const tk = beatStar.tk;

  // kind-defined ownership first (unambiguous regardless of book membership)
  if (beatStar.kind === 'flip') return [YOU]; // YOU flipped one of your three
  if (beatStar.kind === 'swap') return [AGENT, CHAT]; // the agent traded + narrated it

  // a star transition / resolved claim — route by which book holds the ticker.
  // TIE-BREAK: your three wins over the agent's six (a self-relevant pulse beats a
  // watch-only one) on the rare symbol overlap, incl. a rival claim's addSymbol
  // that happens to match a held ticker. Cosmetic only — the climb/stars of record
  // are unaffected. A ticker in neither book (a rival's name) pulses nothing.
  if (has(yourTks, tk)) return [YOU];
  if (has(agentTks, tk)) return [AGENT];
  return [];
}
