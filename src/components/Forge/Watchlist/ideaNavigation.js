// src/components/Forge/Watchlist/ideaNavigation.js
//
// Pilot P1c — the two places an idea's surfaces link to that App owns, asked
// for with one window event each (the CLASHBOT_OPEN_EVENT / DEPLOY_INTENT_EVENT
// precedent), so no dashboard mount gains a prop (the hub's S0 mount guard
// freezes those props) and the Forge needs no navigation prop:
//
//   OPEN_IDEA_EVENT           founder ruling E1 — the deploy ceremony's "This
//                             battle is running without your idea…" line opens
//                             the list's editor screen, where its Idea panel is
//                             (`detail.watchlistId`);
//   OPEN_BATTLE_REVIEW_EVENT  founder ruling E2 — the review card's carrying
//                             battles open that battle's review, the Film Room
//                             (`detail.battle`, the owner's own battle document
//                             as read). Film Room B2.1 B2 adds, optionally,
//                             `detail.at` — a day and a moment to open at — for
//                             a card's recurrence in another battle; P1c's own
//                             callers send none.
//
// App listens for both (src/App.jsx).

/** Open a list's editor (its Idea panel). */
export const OPEN_IDEA_EVENT = 'ft-open-idea';
/** Open a battle's review (the Film Room). */
export const OPEN_BATTLE_REVIEW_EVENT = 'ft-open-battle-review';

const canDispatch = () => typeof window !== 'undefined' && typeof window.dispatchEvent === 'function';

/** Ask App to open the list's editor. A list id is required; anything else does nothing. */
export function requestOpenIdea(watchlistId) {
  if (typeof watchlistId !== 'string' || watchlistId.length === 0 || !canDispatch()) return false;
  window.dispatchEvent(new CustomEvent(OPEN_IDEA_EVENT, { detail: { watchlistId } }));
  return true;
}

/**
 * Ask App to open a battle's review. The battle document (with its id) is required; anything else does nothing.
 * `at` (Film Room B2.1 B2, Build B Amendment H RH-2 — additive: every P1c caller sends none, and its event is exactly
 * as before) names a day and a moment of that battle's Film Room to open at, `{ etDate, moment }`; a malformed one is
 * not sent.
 */
export function requestOpenBattleReview(battle, at = null) {
  if (!battle || typeof battle.id !== 'string' || battle.id.length === 0 || !canDispatch()) return false;
  const day = battleReviewAtOf(at, battle.id);
  window.dispatchEvent(new CustomEvent(OPEN_BATTLE_REVIEW_EVENT, { detail: day ? { battle, at: { etDate: day.etDate, moment: day.moment } } : { battle } }));
  return true;
}

const isSeq = (v) => v === null || (Number.isInteger(v) && v >= 0);
/**
 * Astra's B2.1 review §4 item 1 — a real calendar date, `YYYY-MM-DD`: the year, month and day it names exist (never
 * rolled over, as `2026-02-30` would be into March). An ET date is a calendar date; no clock is involved.
 */
const isCalendarDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, mo, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
};
/**
 * B2.1 B2 — the day and moment an OPEN_BATTLE_REVIEW_EVENT names, checked: `{ battleId, etDate, moment }` when `at`
 * holds a real ET calendar date and a moment (`situationId`, `symbol`, `fromTickSeq`, `toTickSeq`) whose range, when
 * both bounds are recorded, runs forward (`fromTickSeq <= toTickSeq`; a bound the tape left null is checked for
 * nothing more — Astra §4 item 1), else null — the Film Room then opens as it does for P1c's own event, on its
 * default day.
 */
export function battleReviewAtOf(at, battleId) {
  const m = at?.moment;
  if (typeof battleId !== 'string' || !battleId || !isCalendarDate(at?.etDate)) return null;
  if (!m || typeof m.situationId !== 'string' || !m.situationId || typeof m.symbol !== 'string' || !m.symbol || !isSeq(m.fromTickSeq) || !isSeq(m.toTickSeq)) return null;
  if (m.fromTickSeq !== null && m.toTickSeq !== null && m.fromTickSeq > m.toTickSeq) return null;
  return { battleId, etDate: at.etDate, moment: { situationId: m.situationId, symbol: m.symbol, fromTickSeq: m.fromTickSeq, toTickSeq: m.toTickSeq } };
}
