// api/_utils/practiceField/__testsupport__/bookViewScenesHub.js
//
// Practice Field build B5 — THE SCENES WITH WHAT THE HUB'S VIEW READS (test support; never imported by a production path).
// The B3 scenes (bookViewScenes.js, unchanged) carry no epoch and no agent: the view then gives no archetype, no split and
// the desks' fallback names. These add, the way the engine stores them:
//   the epoch          `mandates/{book}/epochs/{FIRST_EPOCH_ID}`, built by the engine's own buildIdeaBookEpochDoc (so its
//                      caps and cash floor are the real ones), and the book's `currentEpochId` naming it;
//   the agent          `agents/{SCENE_AGENT_ID}`, the caller's own (`ownerId`), named HUB_AGENT_NAME — with a battle
//                      archetype that is NOT the book's, so a view that took the archetype from the agent would show it;
//   the view's input   `archetype` (the epoch's code id, the registry's name), `epoch` and `agentName`.
//
//   hubSceneInput(name, opts)  → buildBookView's input
//   hubSceneDocs(name, opts)   → the same records by Firestore path (seed makeMandateFakeDb; never written through
//                                `collection('agents')`, which the protected-store scan watches)

import { buildIdeaBookEpochDoc } from '../ideaBook.js';
import { FIRST_EPOCH_ID } from '../constants.js';
import { getArchetypeDefinition } from '../../archetypeRegistry.js';
import { sceneInput, sceneDocs, SCENE_UID, SCENE_BOOK_ID, SCENE_AGENT_ID } from './bookViewScenes.js';

export const HUB_AGENT_NAME = 'Atlas';
/** The agent's own battle archetype — deliberately not the book's (B5-1: the view never reads it). */
export const HUB_AGENT_BATTLE_ARCHETYPE = 'degen';
export const HUB_ARCHETYPE = 'momentum_chaser';

/** The epoch the scene's book runs under: the engine's own document, or one with `over` merged into its rails and gate. */
export function sceneEpoch({ archetypeCodeId = HUB_ARCHETYPE, slotCapShare = null, cashFloorPct = null } = {}) {
  const epoch = buildIdeaBookEpochDoc({ bookId: SCENE_BOOK_ID, epochId: FIRST_EPOCH_ID, archetypeCodeId, openedAt: '2026-11-13T14:00:00.000Z' });
  if (slotCapShare) epoch.rails.slotCapShare = { ...slotCapShare };
  if (cashFloorPct !== null) epoch.gateConfig.cashFloorPct = cashFloorPct;
  return epoch;
}

/**
 * A scene's input as the B5 reader hands it to the view. `agentName` undefined → HUB_AGENT_NAME; null → no usable name.
 * `epoch` undefined → the engine's epoch for `archetypeCodeId`; null → none.
 */
export function hubSceneInput(name, { agentName, archetypeCodeId = HUB_ARCHETYPE, epoch } = {}) {
  const { archetypeName: _b3Name, ...s } = sceneInput(name);
  const ep = epoch === undefined ? sceneEpoch({ archetypeCodeId }) : epoch;
  const codeId = ep?.archetypeCodeId ?? null;
  const archetype = typeof codeId === 'string' ? { codeId, name: getArchetypeDefinition(codeId)?.displayName ?? null } : null;
  return {
    ...s,
    book: { ...s.book, currentEpochId: FIRST_EPOCH_ID },
    archetype,
    epoch: ep,
    agentName: agentName === undefined ? HUB_AGENT_NAME : agentName,
  };
}

/** The same scene's records by path, with the epoch and the caller's agent (`agent` merged into the agent document). */
export function hubSceneDocs(name, { agentName = HUB_AGENT_NAME, archetypeCodeId = HUB_ARCHETYPE, epoch, agent = {} } = {}) {
  const docs = sceneDocs(name);
  const base = `mandates/${SCENE_BOOK_ID}`;
  docs[base] = { ...docs[base], currentEpochId: FIRST_EPOCH_ID };
  const ep = epoch === undefined ? sceneEpoch({ archetypeCodeId }) : epoch;
  if (ep) docs[`${base}/epochs/${FIRST_EPOCH_ID}`] = ep;
  docs[`agents/${SCENE_AGENT_ID}`] = { ownerId: SCENE_UID, name: agentName, archetype: HUB_AGENT_BATTLE_ARCHETYPE, ...agent };
  return docs;
}
