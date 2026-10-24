// src/components/CommandCenter/__fixtures__/deployAttemptKit.jsx
//
// Command Center slice S2b — the test kit for the deploy provider's suites
// (DeployAttemptContext.*.jsdom.test.jsx). Tests only; nothing in src/ imports it.
//
//   FakeHub      a stand-in for the hub's connected root: the reader inputs of the
//                CURRENT identity (all ready, one ranked agent, no live game), the
//                provider's half through the real attemptInputsOf, the real
//                useHubDeploy registration, and the real HubHold controls with
//                their wiring — so a press runs the real button, the real hook,
//                the real seam and the real provider.
//   readerInputs the ready inputs of an identity, with overrides
//   frames       a controllable requestAnimationFrame (frames run only when asked)

import React from 'react';
import { useAuthIdentity } from '../../../services/authIdentity';
import { useDeployAttempt } from '../../../contexts/DeployAttemptContext';
import { HubOverlayProvider, useHubModalOpen, useHubOverlays } from '../hub/HubOverlays';
import { useHubDeploy } from '../hub/useHubDeploy';
import { HUB_S2A_DEPLOY_INPUTS } from '../hub/hubModel';
import { attemptInputsOf, authInputOf } from '../hub/selectors/readerInputs';
import { deriveHubDeployState } from '../hub/selectors/deployState';
import HubHold from '../sections/HubHold';

export const AGENT_OF = (uid) => Object.freeze({ id: `agent-${uid}`, ownerId: uid, name: `Agent ${uid}`, equippedWatchlistId: null, stats: { gamesPlayed: 3 } });

export function readerInputs(uid, epoch, now, over = {}) {
  return {
    ...HUB_S2A_DEPLOY_INPUTS,
    auth: { signedIn: true, uid, authEpoch: epoch },
    agent: { status: 'ready', agent: AGENT_OF(uid), ownerUid: uid, ownerEpoch: epoch, error: null },
    poll: { status: 'ready', liveBattles: [], ownerUid: uid, ownerEpoch: epoch, lastSuccessfulAt: now, error: null, refreshing: false },
    completed: { status: 'ready', rows: [], ownerUid: uid, ownerEpoch: epoch },
    concurrencyEnabled: true,
    ...over,
  };
}

/**
 * @param {{ controls: string[], probe: { current: any }, over?: object, hub?: object }} props
 *   probe.current is set on every render: { deploy (the wiring), state (the selector's result), inputs }
 */
export function FakeHub({ controls, probe, over = {}, hub = {} }) {
  const identity = useAuthIdentity();
  const deployAttempt = useDeployAttempt();
  const hubModalOpen = useHubModalOpen();
  const auth = authInputOf(identity);
  const base = auth?.signedIn === true ? readerInputs(auth.uid, auth.authEpoch, Date.now(), over) : { ...HUB_S2A_DEPLOY_INPUTS, auth };
  const inputs = Object.freeze({
    ...base,
    ...attemptInputsOf(deployAttempt?.snapshot ?? null, { auth, agentId: base.agent?.agent?.id ?? null, hubModalOpen, now: Date.now() }),
  });
  const readers = { inputs, liveBattles: [], ceremonyAgent: { directiveCount: 2 } };
  const deploy = useHubDeploy({ deployAttempt, readers, hub });
  const state = deriveHubDeployState(inputs);
  probe.current = { deploy, state, inputs, snapshot: deployAttempt?.snapshot ?? null, api: deployAttempt?.api ?? null };
  return (
    <div data-fake-hub="">
      {controls.map((id) => (
        <div key={id} data-control={id}>
          <HubHold label="Hold to deploy" canStart={state.canStart} wiring={deploy ? deploy.hold(id) : null} holding={deploy?.holdControlId === id ? deploy.holdPhase : null} />
        </div>
      ))}
    </div>
  );
}

/** The hub root's overlay provider as CommandCenterHub mounts it: an overlay opening cancels a charge. */
export function HubRoot({ children }) {
  const deployAttempt = useDeployAttempt();
  return <HubOverlayProvider onOpen={deployAttempt ? deployAttempt.api.cancelCharging : null}>{children}</HubOverlayProvider>;
}

/** The enclosing hub's overlay stack, for a row that opens an overlay itself. */
export function StackProbe({ probe }) {
  probe.current = useHubOverlays();
  return null;
}

/** A requestAnimationFrame that runs only when the row says so. */
export function createFrames() {
  let queue = [];
  let id = 0;
  return {
    request: (cb) => { id += 1; queue.push({ id, cb }); return id; },
    cancel: (handle) => { queue = queue.filter((f) => f.id !== handle); },
    pending: () => queue.length,
    run: (now) => { const due = queue; queue = []; for (const f of due) f.cb(now); },
  };
}
