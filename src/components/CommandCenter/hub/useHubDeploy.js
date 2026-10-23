// src/components/CommandCenter/hub/useHubDeploy.js
//
// Command Center hub, slice S2b — the hub's side of the deploy provider
// (src/contexts/DeployAttemptContext.jsx; rulings R-S2b-2 … R-S2b-7). The
// provider lives at App's root and owns the attempt; the hub owns what it
// shows and which control asks. This hook:
//
//   - registers the hub's reader inputs with the provider (the identity, the
//     owner-tagged agent, the poll, the completed window, the concurrency
//     flag), with the hub's overlay stack read at the moment of asking — so a
//     claim, a commitment, a tap and a Retry are admitted by the same §3.1
//     table the strip and the card show;
//   - reports the ranked agent's recorded lastDeployedAt as cooldown evidence;
//   - hands each control its wiring: the hold seam, the provider as beatOwner
//     and the committed deploy (`hold(controlId)`), the tap (`tap`), the
//     synchronous cancel of a charge (`cancelCharging`), the owner-tagged
//     progress store and the hold's phase;
//   - runs the attempt's one action by its kind (`attemptAction`).
//
// Without a provider (the hub flag off, the frame tests, the layout fixtures)
// it returns null and registers nothing: every control stays inert, as before.

import { useEffect, useMemo, useRef } from 'react';
import { DISPLAY_ACTIONS } from './deployDisplay';
import { FORGE_AREAS, FORGE_RETURN } from '../hubChrome';
import { useHubOverlays } from './HubOverlays';
import { lastDeployedAtMs } from './hubDate';

/** The hub's three hold controls and its one tap (spec §5.5). */
export const HUB_DEPLOY_CONTROLS = Object.freeze({
  CARD: 'hub-deploy-card',
  STRIP: 'hub-deploy-strip',
  NEXT_ACTION: 'hub-next-action',
  SCOUTING_BOARD: 'hub-scouting-board',
});

/**
 * @param {{ deployAttempt: null|{ snapshot, api }, readers: object, hub: object }} args
 *   readers is useHubReaders' result: its `inputs`, `liveBattles` and `ceremonyAgent`
 */
export function useHubDeploy({ deployAttempt, readers, hub }) {
  const api = deployAttempt?.api ?? null;
  const stack = useHubOverlays();
  const latest = useRef(null);
  latest.current = { inputs: readers?.inputs ?? null, liveBattles: readers?.liveBattles ?? [], ceremonyAgent: readers?.ceremonyAgent ?? null, hub };

  // The provider asks at the moment of a press; the overlay stack is read then, never from a render behind it.
  useEffect(() => {
    if (!api) return undefined;
    return api.registerInputs(() => ({
      inputs: latest.current.inputs,
      liveBattles: latest.current.liveBattles,
      ceremonyAgent: latest.current.ceremonyAgent,
      hubModalOpen: stack.modalOpen,
      hubModalDepth: stack.depth,
    }));
  }, [api, stack]);

  // The ranked agent's recorded lastDeployedAt: the cooldown's evidence for that target (spec §5.4; S2a A3-9).
  const auth = readers?.inputs?.auth ?? null;
  // Only this identity's own read: the render that carries a new identity can still hold the former owner's
  // agent, and its recorded time is never stamped under the new uid (review W2-2).
  const agentRead = readers?.inputs?.agent ?? null;
  const ownRead = auth?.signedIn === true && agentRead?.status === 'ready'
    && agentRead.ownerUid === auth.uid && agentRead.ownerEpoch === auth.authEpoch;
  const agentDoc = ownRead ? agentRead.agent ?? null : null;
  const lastMs = lastDeployedAtMs(agentDoc?.lastDeployedAt ?? null, Date.now());
  const uid = auth?.signedIn === true ? auth.uid : null;
  const authEpoch = auth?.signedIn === true ? auth.authEpoch : null;
  const agentId = agentDoc?.id ?? null;
  useEffect(() => {
    if (!api || lastMs === null || !uid || !agentId) return;
    api.lastDeployedEvidence({ uid, authEpoch, targetAgentId: agentId, lastDeployedAtMs: lastMs });
  }, [api, lastMs, uid, authEpoch, agentId]);

  const holds = useRef(new Map());
  const wiring = useMemo(() => {
    if (!api) return null;
    holds.current = new Map();
    const hold = (controlId) => {
      if (!holds.current.has(controlId)) {
        holds.current.set(controlId, Object.freeze({
          controlId,
          holdSeam: api.holdSeam,
          beatOwner: api.beatOwner,
          onComplete: () => api.deployCommitted(controlId),
        }));
      }
      return holds.current.get(controlId);
    };
    const attemptAction = (kind) => {
      switch (kind) {
        case DISPLAY_ACTIONS.ENTER_BATTLE: api.enterBattle(); break;
        case DISPLAY_ACTIONS.OPEN_GAME: api.openGame(); break;
        case DISPLAY_ACTIONS.CHECK_DEPLOYMENT: api.checkDeployment(); break;
        case DISPLAY_ACTIONS.RETRY: api.retry(); break;
        case DISPLAY_ACTIONS.OPEN_FORGE_REVIEW: {
          // The review-due refusal's one action: that list's Forge editor (spec §5.4). Retry never reaffirms,
          // retires or deploys on the way back; the player's next hold is the intentional Retry, read afresh.
          const { hub: h, inputs } = latest.current;
          const watchlistId = inputs?.agent?.agent?.equippedWatchlistId || null;
          if (typeof h?.onOpenForge === 'function') {
            api.dismiss();
            h.onOpenForge({ area: FORGE_AREAS.LISTS, watchlistId, returnTo: FORGE_RETURN.DASHBOARD });
          }
          break;
        }
        default: break;
      }
    };
    return Object.freeze({
      hold,
      tap: (controlId, options) => api.tap(controlId, options),
      cancelCharging: () => api.cancelCharging(),
      attemptAction,
      progress: api.progress,
    });
  }, [api]);

  if (!wiring) return null;
  const snapshot = deployAttempt.snapshot;
  // The hold the controls and the status line follow: charging, or committed with its beat still to run. Once the
  // hold has started its request (begin stamps it with the attempt), the attempt's own words take over everywhere —
  // the hold record stays with the attempt until it ends, but it no longer speaks (review W3-1, W3-2).
  const hold = snapshot.state?.hold ?? null;
  const speaking = hold && !hold.attemptId ? hold : null;
  return { ...wiring, holdPhase: speaking?.phase ?? null, holdControlId: speaking?.controlId ?? null, existingRead: snapshot.hydration };
}
