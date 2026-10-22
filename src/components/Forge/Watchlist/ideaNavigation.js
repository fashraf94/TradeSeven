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
//                             as read).
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

/** Ask App to open a battle's review. The battle document (with its id) is required; anything else does nothing. */
export function requestOpenBattleReview(battle) {
  if (!battle || typeof battle.id !== 'string' || battle.id.length === 0 || !canDispatch()) return false;
  window.dispatchEvent(new CustomEvent(OPEN_BATTLE_REVIEW_EVENT, { detail: { battle } }));
  return true;
}
