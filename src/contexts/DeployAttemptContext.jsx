// src/contexts/DeployAttemptContext.jsx
//
// Command Center slice S2b — the deploy attempt provider (spec V1.2 §2, §5;
// corrections C2, C3, C4; rulings R-S2b-1 … R-S2b-8). It owns, for the hub,
// the one attempt record, the hold slot's record, the committed beat, the
// due-idea screen, the root deploy ceremony and every ownership check between
// a press and its result.
//
// WHERE IT LIVES (ruling R-S2b-1, a deliberate deviation from spec §2's
// main.jsx placement): App's unified return wraps the screen router in it.
// App does not remount across screens or widths, so the attempt, its beat and
// its ceremony outlive both, and the app's entry file stays untouched. App
// hands its callbacks in as props — that is the bridge — and the provider
// checks the captured uid, auth epoch and attempt epoch immediately before
// calling each one.
//
// FLAG OFF (spec §4): the hub flag is read once, at mount, through
// isCommandCenterHubOn(). False, this is a pass-through — it renders its
// children and nothing else: no reducer work, no subscription, timer or
// listener, no ceremony. A later false (a runtime disable, injected by its
// rows as `hubEnabled`; no live toggle exists) cancels an uncommitted hold and
// refuses new attempts, while a request already committed keeps its record and
// its ceremony through resolution.
//
// THE RECORD. hub/selectors/attemptReducer.js, over S2a's vocabulary, held in
// a ref so a second press in the same tick sees the first one's guard (spec
// §5.3). Before every `begin` the provider asks the hub's own §3.1 table
// (deployState.js): canStart for a tap, canCommit at a hold's threshold, the
// selector's `retry` action for a Retry. The table's reader inputs are the
// hub's (hub/useHubDeploy.js registers them); the identity is read now from
// the one source (services/authIdentity.js); attempt, hold, cooldown, the clock
// and the open overlays are the provider's.
//
// OWNERSHIP (spec §5.3, C2). Every attempt captures uid, auth epoch and attempt
// epoch. After every await, and before the due-idea screen, the ceremony, the
// target report, App's handoff, a navigation and every result shown, both
// must still match. An identity change cancels a charge and revokes a beat in
// its own task, orphans the attempt, closes its ceremony and screen, drops its
// reads and the matching ceremony stash, and is cleaned up at once: a late old
// promise finds nothing to change. The server battle a request may already have
// created for its owner is never touched.
//
// THE HOLD (spec §5.5, C4). The hub's controls claim through `holdSeam`
// (useHoldToDeploy.js, THE HUB'S SEAM): a claim is admitted by canStart before
// the slot grants it, with the input and this provider's hold epoch; the
// threshold commits only through canCommit and the slot together; the
// provider is the controls' beatOwner, so a committed beat survives unmount
// and a width change, and is run — or released — on every exit (R2 FR2-5).
// A charge is cancelled synchronously (R2 FR2-4) by an identity change, a
// runtime disable, an overlay opening and an area change. Each frame's charge
// goes to an owner-tagged store (`progress`), read by the control and the
// status line only.
//
// THE DEPLOY (ruling R-S2b-4): the shells' steps, owned here — claim/commit or
// tap; checkDueIdea and its one screen (P1c E1; a Retry skips it); the
// ceremony opened; deployAgent with `isCurrent`; the service result; the
// ceremony's phases through onPhaseChange with the attempt id. With the
// ceremony off a created battle navigates at once (App's handoff, as today)
// and an existing one opens only its fetched owned document.
//
// RECONCILIATION (rulings R-S2b-5, R-S2b-6). An existing answer gets one owned
// targeted read of the server's id per attempt (services/ownedBattleRead.js),
// with a deadline and a 30 s Retry cooldown. An uncertain one is resolved only
// by reconciliation: Check deployment runs the target-scoped verifier (found →
// existing; clear → a Retry once the cooldown has passed; error → still
// uncertain); a ceremony whose preserved recovery gates admitted a battle
// (phase `reveal`) is read once to learn its id → created, recovered; a
// ceremony that confirmed no battle (`error`, tone `confirmed`) is clear.
// Nothing replays automatically.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ATTEMPT_ACTION_TYPES as T, attemptReducer, cooldownFor, initialAttemptState } from '../components/CommandCenter/hub/selectors/attemptReducer';
import { ATTEMPT_ACTIONS, ATTEMPT_PHASES, CEREMONY_PHASES, ERROR_TONES, HOLD_PHASES, RECONCILIATION, RESULT_KINDS, realId } from '../components/CommandCenter/hub/selectors/attemptVocabulary';
import { canCommit, deriveHubDeployState } from '../components/CommandCenter/hub/selectors/deployState';
import { authInputOf } from '../components/CommandCenter/hub/selectors/readerInputs';
import { inertSiblings } from '../components/CommandCenter/hub/overlayStack';
import { lastDeployedAtMs } from '../components/CommandCenter/hub/hubDate';
import useDeployTargetProgress from '../hooks/useDeployTargetProgress';
import { readAuthIdentity, subscribeAuthIdentity } from '../services/authIdentity';
import { deployAgent } from '../services/agentDeploy';
import { checkDueIdea } from '../services/dueIdeaCheck';
import { findActiveBattleForAgent } from '../services/agentBattleVerify';
import { readOwnedBattle } from '../services/ownedBattleRead';
import { claimHold, commitHold, currentHold, releaseHold } from '../hooks/holdClaim';
import { LOCK_BEAT_MS } from '../hooks/useHoldToDeploy';
import { isCommandCenterHubOn, isDeployCeremonyOn } from '../config/featureFlags';
import { CMD } from '../components/Dashboard/commandUI';
import { deployResultFor, isOrphanedResult } from '../components/Dashboard/deployResult';
import * as ceremonyTiming from '../components/Dashboard/deployCeremony/ceremonyTiming';
import DeployCeremony from '../components/Dashboard/deployCeremony/DeployCeremony';
import DueIdeaInterstitial from '../components/Dashboard/deployCeremony/DueIdeaInterstitial';

/** The owned targeted read's deadline, and the wait before its Retry (spec §6: "a 30-second per-attempt cooldown"). */
export const EXISTING_READ_DEADLINE_MS = 8000;
export const EXISTING_READ_RETRY_MS = 30000;
/** The target-scoped verifier's deadline for Check deployment (the same bound as the other hub operations, spec §6). */
export const RECONCILE_DEADLINE_MS = 8000;

/** The hydration's statuses (the hub's card reads them). */
export const EXISTING_READ = Object.freeze({ LOADING: 'loading', FOUND: 'found', ERROR: 'error' });

const DeployAttemptContext = createContext(null);

/** The provider's `{ snapshot, api }`, or null with the hub flag off or outside a provider. */
export function useDeployAttempt() {
  return useContext(DeployAttemptContext);
}

/**
 * The owner-tagged hold progress (spec §5.5): `{ controlId, holdToken, progress }` of the charge in flight, or null.
 * Read only by the control's status line; a Games row never re-renders per frame because nothing else subscribes.
 */
export function useHoldProgress(store) {
  const subscribe = store ? store.subscribe : noopSubscribe;
  const get = store ? store.get : nullSnapshot;
  return useSyncExternalStore(subscribe, get, get);
}
const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

function createProgressStore() {
  let value = null;
  const listeners = new Set();
  const notify = () => { for (const listener of [...listeners]) listener(); };
  return {
    get: () => value,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(next) { value = Object.freeze(next); notify(); },
    clear(holdToken) {
      if (value === null || (holdToken != null && value.holdToken !== holdToken)) return;
      value = null;
      notify();
    },
  };
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const TIMED_OUT = Symbol('timed-out');

/**
 * The provider's state machine, outside React (the component below renders it). Every method is synchronous up to
 * its first await; every continuation re-checks its capture.
 */
export function createDeployRuntime({ getBridge, notify, now = () => Date.now() }) {
  const first = readAuthIdentity();
  let state = initialAttemptState({ uid: first.resolved ? first.uid : null, authEpoch: first.authEpoch });
  let identity = first;
  let revoked = false;
  let inputsGetter = null;
  let holdEpoch = 0;
  let attemptSeq = 0;
  let charge = null; // { token, controlId, cancel } — the charging hold
  let committed = null; // { token, controlId, agent, ceremonyAgent } — the hold committed at its threshold
  let beat = null; // { token, run, timer } — the committed beat this provider owns
  let run = null; // the attempt's runtime: { attemptId, attemptEpoch, capturedUid, authEpoch, agent, ceremonyAgent }
  let ceremony = null; // { attemptId, key, visible, deployResult, targetAgentId }
  let due = null; // { attemptId, due, proceed, settle }
  let hydration = null; // { key, attemptId, battleId, status, battle, retryAt }
  let recovered = null; // { attemptId, battle } — the document a recovered creation enters
  let version = 0;
  let cached = null;
  const timers = new Set();
  const progress = createProgressStore();

  const changed = () => { version += 1; notify(); };
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };
  const cancelLater = (id) => { if (id != null) { clearTimeout(id); timers.delete(id); } };
  const within = (promise, ms) => {
    let timer = null;
    return Promise.race([
      promise,
      new Promise((resolve) => { timer = later(() => resolve(TIMED_OUT), ms); }),
    ]).finally(() => cancelLater(timer));
  };

  const apply = (action) => {
    const next = attemptReducer(state, action);
    if (next !== state) { state = next; changed(); }
    return next;
  };

  const bridge = () => getBridge() || {};
  const overlayOpen = () => Boolean(ceremony?.visible) || due !== null;

  /** A capture is current only while the identity, its epoch and the attempt epoch are all still its own (C2). */
  const currentFor = (r) => () => {
    if (revoked || !r) return false;
    const id = readAuthIdentity();
    return id.resolved === true && id.uid === r.capturedUid && id.authEpoch === r.authEpoch
      && state.attemptEpoch === r.attemptEpoch && state.attempt?.attemptId === r.attemptId;
  };

  // ── the selector's inputs at this instant ───────────────────────────────────
  function admission({ exemptOverlay = false } = {}) {
    const hub = inputsGetter ? inputsGetter() : null;
    if (!hub || !hub.inputs) return null;
    const auth = authInputOf(readAuthIdentity());
    const agentDoc = hub.inputs.agent?.agent ?? null;
    const target = state.attempt?.targetAgentId ?? agentDoc?.id ?? null;
    // The Scouting Board's own deploy is inside its modal (spec §10): the board is the one overlay it may sit under.
    const hubModal = exemptOverlay ? hub.hubModalDepth > 1 : hub.hubModalOpen === true;
    return {
      inputs: Object.freeze({
        ...hub.inputs,
        auth,
        attempt: state.attempt,
        hold: state.hold,
        cooldown: auth?.signedIn === true ? cooldownFor(state, auth.uid, target) : null,
        now: now(),
        modalOpen: hubModal || overlayOpen(),
      }),
      agent: agentDoc,
      ceremonyAgent: hub.ceremonyAgent ?? null,
      liveBattles: Array.isArray(hub.liveBattles) ? hub.liveBattles : [],
    };
  }

  // ── the hold seam (useHoldToDeploy.js THE HUB'S SEAM) ───────────────────────
  function claim(controlId, inputId, cancel) {
    if (revoked || state.flagDisabled) return null;
    const a = admission();
    // A denied claim returns before any effect: no frame, timer, progress, sky or request (spec §5.5).
    if (!a || deriveHubDeployState(a.inputs).canStart !== true) return null;
    holdEpoch += 1;
    const token = claimHold(controlId, inputId, holdEpoch);
    if (token === null) return null;
    const next = apply({ type: T.HOLD_CLAIMED, auth: a.inputs.auth, controlId, holdToken: token, holdEpoch });
    if (next.hold?.holdToken !== token) { releaseHold(token); return null; }
    charge = { token, controlId, cancel };
    progress.set({ controlId, holdToken: token, progress: 0 });
    return token;
  }

  function commit(token) {
    if (revoked) return false;
    const a = admission();
    if (!a || !canCommit(token, a.inputs)) return false;
    if (!commitHold(token)) return false;
    const next = apply({ type: T.HOLD_COMMITTED, auth: a.inputs.auth, holdToken: token });
    if (next.hold?.holdToken !== token || next.hold.phase !== HOLD_PHASES.LOCKED) { releaseHold(token); return false; }
    committed = { token, controlId: next.hold.controlId, agent: a.agent, ceremonyAgent: a.ceremonyAgent };
    charge = null;
    return true;
  }

  function release(token) {
    releaseHold(token);
    if (charge?.token === token) charge = null;
    if (committed?.token === token) committed = null;
    progress.clear(token);
    apply({ type: T.HOLD_RELEASED, holdToken: token });
  }

  function report(token, p) {
    const owner = charge?.token === token ? charge : committed?.token === token ? committed : null;
    if (owner && finite(p)) progress.set({ controlId: owner.controlId, holdToken: token, progress: Math.max(0, Math.min(1, p)) });
  }

  const holdSeam = Object.freeze({ claim, commit, release, progress: report });

  /** The committed beat, owned here: it survives the control's unmount and a width change (spec §5.5). */
  const beatOwner = Object.freeze({
    commit(token, runBeat) {
      // Not ours (revoked, or not the hold this provider committed): the hook keeps its own beat.
      if (revoked || committed?.token !== token) throw new Error('[DeployAttempt] no committed hold for this beat');
      if (beat) cancelLater(beat.timer);
      beat = { token, run: runBeat, timer: null };
      beat.timer = later(() => { const b = beat; beat = null; if (b) b.run(); }, LOCK_BEAT_MS);
    },
  });

  /** The synchronous cancel of an uncommitted charge, in the caller's task (R2 FR2-4). */
  function cancelCharging() {
    const c = charge;
    if (!c) return;
    try { c.cancel(); } catch (err) { console.warn('[DeployAttempt] the charge cancel threw:', err?.message || err); }
    // The control's own cancel gives the claim back through release(); a control that could not, is released here.
    if (charge?.token === c.token) release(c.token);
  }

  /** A committed beat not yet run is revoked: its run then deploys nothing and returns its control to idle. */
  function revokeBeat({ runIt = true } = {}) {
    const b = beat;
    if (!b) return;
    beat = null;
    cancelLater(b.timer);
    releaseHold(b.token);
    if (committed?.token === b.token) committed = null;
    progress.clear(b.token);
    if (runIt) { try { b.run(); } catch (err) { console.warn('[DeployAttempt] a revoked beat threw:', err?.message || err); } }
  }

  // ── identity, runtime disable, unmount ──────────────────────────────────────
  function cleanupOrphan() {
    const a = state.attempt;
    if (!a || a.phase !== ATTEMPT_PHASES.ORPHANED) return;
    // Local cleanup of the former owner's attempt (spec §5.4): its screen, ceremony, reads, stash and timers.
    const r = run;
    if (due && due.attemptId === a.attemptId) { const d = due; due = null; d.settle('orphaned'); }
    if (ceremony && ceremony.attemptId === a.attemptId) ceremony = null;
    if (hydration && hydration.attemptId === a.attemptId) hydration = null;
    if (recovered && recovered.attemptId === a.attemptId) recovered = null;
    const battleId = realId(a.result?.battleId);
    if (battleId) { try { bridge().clearCeremonyStash?.(battleId); } catch { /* the stash is App's; nothing to undo here */ } }
    if (r && r.attemptId === a.attemptId) run = null;
    apply({ type: T.ORPHAN_CLEANED, attemptId: a.attemptId, attemptEpoch: a.attemptEpoch });
    changed();
  }

  function identityChanged(next) {
    if (revoked || !next || next.authEpoch === identity.authEpoch) return;
    identity = next;
    cancelCharging();
    revokeBeat();
    apply({ type: T.AUTH_CHANGED, uid: next.resolved ? next.uid : null, authEpoch: next.authEpoch });
    cleanupOrphan();
  }

  function setHubEnabled(enabled) {
    if (revoked || enabled === true) return;
    cancelCharging();
    apply({ type: T.FLAG_DISABLED });
  }

  function unmount() {
    if (revoked) return;
    cancelCharging();
    // The owner releases a beat it will never run (R2 FR2-5); nothing runs after the root has gone.
    revokeBeat({ runIt: false });
    if (due) { const d = due; due = null; d.settle('unmounted'); }
    state = attemptReducer(state, { type: T.UNMOUNT });
    revoked = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    ceremony = null;
    hydration = null;
    run = null;
    progress.clear(null);
  }

  // ── the deploy ──────────────────────────────────────────────────────────────
  const newAttemptId = () => { attemptSeq += 1; return `attempt_${attemptSeq}_${now()}`; };

  function cooldownFromResult(r, result) {
    const target = state.attempt?.targetAgentId;
    if (!target) return;
    const retryAfterUntil = finite(result?.retryAfter) && result.retryAfter >= 0 ? now() + result.retryAfter * 1000 : null;
    if (retryAfterUntil !== null) {
      apply({ type: T.COOLDOWN_EVIDENCE, ownerUid: r.capturedUid, authEpoch: r.authEpoch, targetAgentId: target, retryAfterUntil });
    }
  }

  /** The recorded `lastDeployedAt` of a deploy target, as the reader or the target's own document reports it. */
  function lastDeployedEvidence({ uid, authEpoch, targetAgentId, lastDeployedAtMs }) {
    if (revoked || !finite(lastDeployedAtMs)) return;
    apply({ type: T.COOLDOWN_EVIDENCE, ownerUid: uid, authEpoch, targetAgentId, lastDeployedAtMs });
  }

  async function startAttempt({ hold = null, tap = null, retryOf = null }) {
    if (revoked) return { success: false };
    const auth = authInputOf(readAuthIdentity());
    if (auth?.signedIn !== true) return { success: false };
    const attemptId = newAttemptId();
    const startedAt = now();
    let agent = null;
    let ceremonyAgent = null;
    let next = state;
    if (hold) {
      // Committed at its threshold through canCommit (spec §5.5): the reducer admits only that hold.
      agent = hold.agent;
      ceremonyAgent = hold.ceremonyAgent;
      if (!agent?.id) return { success: false };
      next = apply({ type: T.BEGIN, attemptId, auth, targetAgentId: agent.id, startedAt, controlId: hold.controlId, holdToken: hold.token });
    } else if (retryOf) {
      const a = admission();
      if (!a || state.flagDisabled) return { success: false };
      // The selector offers Retry only when the request that would replace the terminal is admitted now (§5.4).
      if (deriveHubDeployState(a.inputs).action !== ATTEMPT_ACTIONS.RETRY) return { success: false };
      agent = retryOf.agent ?? a.agent;
      ceremonyAgent = retryOf.ceremonyAgent ?? a.ceremonyAgent;
      if (!agent?.id) return { success: false };
      next = apply({ type: T.RETRY, attemptId, priorAttemptId: retryOf.attemptId, priorAttemptEpoch: retryOf.attemptEpoch, auth, now: now(), startedAt });
    } else if (tap) {
      if (state.flagDisabled) return { success: false };
      const a = admission({ exemptOverlay: tap.exemptOverlay === true });
      // A tap can never bypass another control's hold: the table and the reducer both refuse it (spec §5.5).
      if (!a || deriveHubDeployState(a.inputs).canStart !== true) return { success: false };
      agent = a.agent;
      ceremonyAgent = a.ceremonyAgent;
      if (!agent?.id) return { success: false };
      next = apply({ type: T.BEGIN, attemptId, auth, targetAgentId: agent.id, startedAt });
    }
    if (next.attempt?.attemptId !== attemptId) return { success: false };

    const r = Object.freeze({
      attemptId, attemptEpoch: next.attempt.attemptEpoch, capturedUid: auth.uid, authEpoch: auth.authEpoch, agent, ceremonyAgent,
    });
    run = r;
    hydration = null;
    recovered = null;
    const isCurrent = currentFor(r);

    // P1c founder ruling E1: one screen before any deploy call; a Retry skips it (the choice was made).
    ceremonyTiming.startRun();
    if (!retryOf) {
      const dueIdea = await checkDueIdea(agent);
      if (!isCurrent()) return { success: false };
      if (dueIdea) {
        const choice = await new Promise((settle) => {
          due = { attemptId, due: dueIdea, settle, proceed: () => settle('proceed') };
          changed();
        });
        if (due && due.attemptId === attemptId) due = null;
        changed();
        if (choice !== 'proceed' || !isCurrent()) return { success: false };
        ceremonyTiming.startRun();
      }
    }

    const ceremonyOn = isDeployCeremonyOn();
    // The ceremony opens BEFORE the call, seeded pending (the stage machine's OPEN-3 note depends on it).
    if (ceremonyOn) {
      ceremony = { attemptId, key: attemptId, visible: true, deployResult: { status: 'pending' }, targetAgentId: null };
      changed();
    }

    const onTarget = (id) => {
      if (!isCurrent()) return;
      apply({ type: T.TARGET_RESOLVED, attemptId, attemptEpoch: r.attemptEpoch, targetAgentId: id });
      if (ceremony?.attemptId === attemptId) { ceremony = { ...ceremony, targetAgentId: id }; changed(); }
    };
    // App's handoff, checked here immediately before it and handed the same check for its own later effects (C2).
    const onCreate = (portfolio, bench, meta) => {
      if (!isCurrent()) return null;
      const create = bridge().onCreateAgentBattle;
      return typeof create === 'function' ? create(portfolio, bench, { ...meta, isCurrent }) : null;
    };

    let result;
    try {
      result = await deployAgent(agent.id, onCreate, onTarget, { isCurrent });
    } catch (err) {
      // deployAgent's only throw is before its POST; an untyped result fails closed (uncertain) all the same.
      console.error('[DeployAttempt] deploy threw:', err?.message || err);
      result = { success: false, error: err?.message, postIssued: false, httpStatus: null };
    }
    // An identity change, a newer attempt or the root's unmount: nothing more is shown or done for this one.
    if (!isCurrent()) return result;

    apply({ type: T.SERVICE_RESULT, attemptId, attemptEpoch: r.attemptEpoch, result });
    cooldownFromResult(r, result);
    if (state.attempt?.phase === ATTEMPT_PHASES.ORPHANED) {
      cleanupOrphan();
      return result;
    }

    if (ceremonyOn && ceremony?.attemptId === attemptId) {
      if (isOrphanedResult(result)) ceremony = null;
      else ceremony = { ...ceremony, deployResult: deployResultFor(result) };
      changed();
    }

    try { bridge().refreshActiveBattles?.(); } catch (err) { console.warn('[DeployAttempt] refresh failed:', err?.message || err); }

    const phase = state.attempt?.phase;
    if (phase === ATTEMPT_PHASES.EXISTING) hydrate({ open: !ceremonyOn });
    else if (phase === ATTEMPT_PHASES.CREATED && !ceremonyOn && state.attempt?.result?.kind === RESULT_KINDS.CREATED) {
      // Ceremony off: App's handoff navigated at once, as today; that navigation acknowledges the terminal. A
      // handoff that threw navigated nowhere, so its creation stays, "Deployed · Enter battle", for the real id.
      dismiss();
    }
    return result;
  }

  // ── existing-battle hydration (spec §6, ruling R-S2b-5) ────────────────────
  function hydrate({ open = false } = {}) {
    const a = state.attempt;
    const r = run;
    if (!a || a.phase !== ATTEMPT_PHASES.EXISTING || !r || r.attemptId !== a.attemptId) return;
    const battleId = realId(a.resolution?.battleId) ?? realId(a.result?.battleId);
    if (!battleId) return;
    const key = `${r.capturedUid}:${r.authEpoch}:${a.attemptId}:${battleId}`;
    if (hydration?.key === key) {
      if (hydration.status !== EXISTING_READ.ERROR) return;
      if (finite(hydration.retryAt) && now() < hydration.retryAt) return;
    }
    hydration = { key, attemptId: a.attemptId, battleId, status: EXISTING_READ.LOADING, battle: null, retryAt: null };
    changed();
    const isCurrent = currentFor(r);
    within(Promise.resolve().then(() => readOwnedBattle(battleId, r.capturedUid)), EXISTING_READ_DEADLINE_MS)
      .then((battle) => (battle === TIMED_OUT ? Promise.reject(new Error('timeout')) : battle))
      .then((battle) => {
        if (!isCurrent() || hydration?.key !== key) return;
        if (battle && battle.id === battleId && battle.ownerId === r.capturedUid) {
          hydration = { ...hydration, status: EXISTING_READ.FOUND, battle };
          changed();
          if (open) openGame();
        } else {
          hydration = { ...hydration, status: EXISTING_READ.ERROR, retryAt: now() + EXISTING_READ_RETRY_MS };
          changed();
        }
      }, (err) => {
        if (!isCurrent() || hydration?.key !== key) return;
        console.warn('[DeployAttempt] the running battle could not be read:', err?.message || err);
        hydration = { ...hydration, status: EXISTING_READ.ERROR, retryAt: now() + EXISTING_READ_RETRY_MS };
        changed();
      });
  }

  // ── reconciliation of an uncertain attempt (§5.4) ──────────────────────────
  function reconcile({ admitted = false } = {}) {
    const a = state.attempt;
    const r = run;
    if (!a || a.phase !== ATTEMPT_PHASES.UNCERTAIN || !r || r.attemptId !== a.attemptId) return;
    if (a.reconciliationStatus === RECONCILIATION.PENDING) return;
    const tag = { attemptId: a.attemptId, attemptEpoch: a.attemptEpoch };
    apply({ type: T.RECONCILIATION_PENDING, ...tag });
    const isCurrent = currentFor(r);
    const target = a.targetAgentId;
    within(Promise.resolve().then(() => findActiveBattleForAgent(target)), RECONCILE_DEADLINE_MS)
      .then((found) => {
        if (!isCurrent()) return;
        if (found === TIMED_OUT || !found || typeof found.found !== 'boolean') {
          apply({ type: T.RECONCILIATION_RESULT, ...tag, status: RECONCILIATION.ERROR });
          return;
        }
        if (!found.found) {
          apply({ type: T.RECONCILIATION_RESULT, ...tag, status: RECONCILIATION.CLEAR });
          return;
        }
        const battle = found.battle;
        apply({ type: T.RECONCILIATION_RESULT, ...tag, status: RECONCILIATION.FOUND, battle: { id: battle?.id, ownerId: battle?.ownerId }, admitted });
        const now2 = state.attempt;
        if (now2?.phase === ATTEMPT_PHASES.CREATED && battle?.ownerId === r.capturedUid) {
          recovered = { attemptId: a.attemptId, battle };
        } else if (now2?.phase === ATTEMPT_PHASES.EXISTING && battle?.ownerId === r.capturedUid) {
          hydration = { key: `${r.capturedUid}:${r.authEpoch}:${a.attemptId}:${battle.id}`, attemptId: a.attemptId, battleId: battle.id, status: EXISTING_READ.FOUND, battle, retryAt: null };
        }
        changed();
      }, (err) => {
        if (!isCurrent()) return;
        console.warn('[DeployAttempt] the deployment check could not complete:', err?.message || err);
        apply({ type: T.RECONCILIATION_RESULT, ...tag, status: RECONCILIATION.ERROR });
      });
  }

  /** The ceremony's own conclusion for an uncertain attempt, as its phase reports it. */
  function clearFromCeremony() {
    const a = state.attempt;
    if (!a || a.phase !== ATTEMPT_PHASES.UNCERTAIN || a.reconciliationStatus === RECONCILIATION.PENDING) return;
    const tag = { attemptId: a.attemptId, attemptEpoch: a.attemptEpoch };
    apply({ type: T.RECONCILIATION_PENDING, ...tag });
    apply({ type: T.RECONCILIATION_RESULT, ...tag, status: RECONCILIATION.CLEAR });
  }

  function phaseChanged({ attemptId, phase, errorTone }) {
    const a = state.attempt;
    // Stale and repeated reports change nothing (StrictMode echoes; a remounted ceremony's earlier one).
    if (!a || attemptId !== a.attemptId || !run || run.attemptId !== a.attemptId) return;
    apply({ type: T.CEREMONY_PHASE, attemptId, attemptEpoch: a.attemptEpoch, phase, errorTone });
    if (a.phase !== ATTEMPT_PHASES.UNCERTAIN) return;
    // The preserved recovery gates admitted a battle: read it once to learn its id (spec §5.2 "recovered").
    if (phase === CEREMONY_PHASES.REVEAL) reconcile({ admitted: true });
    // A server error signal AND an empty verifier read: the ceremony's confirmed "no battle" is a clear result.
    else if (phase === CEREMONY_PHASES.ERROR && errorTone === ERROR_TONES.CONFIRMED) clearFromCeremony();
  }

  // ── the terminal's actions (§5.4) ───────────────────────────────────────────
  function dismiss() {
    const a = state.attempt;
    if (!a || !run || run.attemptId !== a.attemptId) return;
    if (ceremony?.attemptId === a.attemptId) ceremony = { ...ceremony, visible: false };
    const battleId = a.phase === ATTEMPT_PHASES.CREATED ? realId(a.result?.battleId) : null;
    apply({ type: T.DISMISS, attemptId: a.attemptId, attemptEpoch: a.attemptEpoch, at: now() });
    // The matching stash goes with an acknowledged creation (spec §5.4); Enter has already taken it when it entered.
    if (battleId && state.attempt?.phase === ATTEMPT_PHASES.IDLE) {
      try { bridge().clearCeremonyStash?.(battleId); } catch { /* App's */ }
    }
    changed();
  }

  function enterBattle(recoveredBattle = null) {
    const a = state.attempt;
    const r = run;
    if (!a || !r || r.attemptId !== a.attemptId || !currentFor(r)()) return;
    const doc = recoveredBattle?.id ? recoveredBattle : null;
    if (doc && doc.ownerId !== r.capturedUid) return;
    if (doc && a.phase === ATTEMPT_PHASES.UNCERTAIN) {
      // The reveal's Enter carries the battle the preserved gates admitted: the record learns its id here.
      const tag = { attemptId: a.attemptId, attemptEpoch: a.attemptEpoch };
      if (a.reconciliationStatus !== RECONCILIATION.PENDING) apply({ type: T.RECONCILIATION_PENDING, ...tag });
      apply({ type: T.RECONCILIATION_RESULT, ...tag, status: RECONCILIATION.FOUND, battle: { id: doc.id, ownerId: doc.ownerId }, admitted: true });
    }
    if (state.attempt?.phase !== ATTEMPT_PHASES.CREATED) return;
    const entry = doc ?? (recovered?.attemptId === a.attemptId ? recovered.battle : null);
    const handoffId = state.attempt.result?.kind === RESULT_KINDS.HANDOFF ? realId(state.attempt.result.battleId) : null;
    if (!entry && handoffId) {
      // A creation whose handoff threw built no battle in App: open the real one by its id, read and owned (§5.2).
      const isCurrent = currentFor(r);
      within(Promise.resolve().then(() => readOwnedBattle(handoffId, r.capturedUid)), EXISTING_READ_DEADLINE_MS)
        .then((battle) => {
          if (battle === TIMED_OUT || !battle || !isCurrent() || battle.ownerId !== r.capturedUid) return;
          recovered = { attemptId: a.attemptId, battle };
          enterBattle(battle);
        }, (err) => { console.warn('[DeployAttempt] the created battle could not be read:', err?.message || err); });
      return;
    }
    // Identity, epoch and the document's owner, again, immediately before the navigation.
    if (!currentFor(r)() || (entry && entry.ownerId !== r.capturedUid)) return;
    try { bridge().onEnterBattle?.(entry); } finally { dismiss(); }
  }

  function openGame(battle = null) {
    const a = state.attempt;
    const r = run;
    if (!a || !r || r.attemptId !== a.attemptId || a.phase !== ATTEMPT_PHASES.EXISTING) return;
    const existingId = realId(a.resolution?.battleId) ?? realId(a.result?.battleId);
    const doc = battle ?? (hydration?.attemptId === a.attemptId && hydration.status === EXISTING_READ.FOUND ? hydration.battle : null);
    if (!doc) { hydrate(); return; }
    if (!currentFor(r)() || doc.id !== existingId || doc.ownerId !== r.capturedUid) return;
    try { bridge().onOpenBattle?.(doc); } finally { dismiss(); }
  }

  function retry() {
    const a = state.attempt;
    const r = run;
    if (!a || !r || r.attemptId !== a.attemptId) return Promise.resolve({ success: false });
    return startAttempt({ retryOf: { attemptId: a.attemptId, attemptEpoch: a.attemptEpoch, agent: r.agent, ceremonyAgent: r.ceremonyAgent } });
  }

  function deployCommitted(controlId) {
    const c = committed;
    if (!c || c.controlId !== controlId || state.hold?.holdToken !== c.token || state.hold.phase !== HOLD_PHASES.LOCKED) {
      return Promise.resolve({ success: false });
    }
    if (currentHold()?.holdToken !== c.token) return Promise.resolve({ success: false });
    committed = null;
    progress.clear(c.token);
    return startAttempt({ hold: c });
  }

  /** Does the hub's table offer this attempt's Retry right now (its own words, R-S2b-6)? */
  function retryActionNow() {
    const a = admission();
    return Boolean(a) && !state.flagDisabled && deriveHubDeployState(a.inputs).action === ATTEMPT_ACTIONS.RETRY;
  }

  function registerInputs(getter) {
    inputsGetter = getter;
    return () => { if (inputsGetter === getter) inputsGetter = null; };
  }

  /** The earliest future cooldown bound of the signed-in owner, for the clock that re-renders when it passes. */
  function nextCooldownEnd() {
    const uid = readAuthIdentity().uid;
    const bounds = Object.values(state.cooldowns?.[uid] || {}).filter((b) => finite(b) && b > now());
    return bounds.length ? Math.min(...bounds) : null;
  }

  function snapshot() {
    if (cached && cached.version === version) return cached;
    cached = Object.freeze({
      version,
      state,
      overlayOpen: overlayOpen(),
      ceremony,
      due,
      hydration,
      flagDisabled: state.flagDisabled === true,
    });
    return cached;
  }

  return {
    holdSeam,
    beatOwner,
    progress,
    snapshot,
    registerInputs,
    identityChanged,
    setHubEnabled,
    unmount,
    cancelCharging,
    deployCommitted,
    tap: (controlId, { exemptOverlay = false } = {}) => startAttempt({ tap: { controlId, exemptOverlay } }),
    retry,
    dismiss,
    enterBattle,
    openGame,
    checkDeployment: () => reconcile({ admitted: false }),
    phaseChanged,
    lastDeployedEvidence,
    retryActionNow,
    nextCooldownEnd,
    tick: changed,
    /** Tests only: the ceremony's live list beside the owned document. */
    liveBattlesFor: () => {
      const a = admission();
      const listed = a ? a.liveBattles : [];
      return hydration?.status === EXISTING_READ.FOUND && hydration.battle ? [hydration.battle, ...listed] : listed;
    },
    agentFor: () => run?.agent ?? null,
    ceremonyAgentFor: () => run?.ceremonyAgent ?? null,
  };
}

/**
 * App's root: a pass-through with the hub flag off; the live provider with it on (ruling R-S2b-1). The flag is
 * read once, at mount, through its accessor (R-S2b-8): a cold flag-off load has no attempt to recover and adds
 * nothing. `hubEnabled` is the rows' injected value — a later false is the runtime disable; App passes none.
 */
export function DeployAttemptProvider({ hubEnabled, children, ...bridge }) {
  const injected = typeof hubEnabled === 'boolean';
  const [live] = useState(() => (injected ? hubEnabled : isCommandCenterHubOn()) === true);
  if (!live) return children;
  return <LiveDeployAttemptProvider hubEnabled={injected ? hubEnabled : true} bridge={bridge}>{children}</LiveDeployAttemptProvider>;
}

function LiveDeployAttemptProvider({ hubEnabled, bridge, children }) {
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const [, setVersion] = useState(0);
  const runtimeRef = useRef(null);
  if (!runtimeRef.current) {
    runtimeRef.current = createDeployRuntime({
      getBridge: () => bridgeRef.current,
      notify: () => setVersion((v) => v + 1),
    });
  }
  const rt = runtimeRef.current;
  const snap = rt.snapshot();

  // The identity, from the one source, synchronously at every change (C2), and the root's revocation (§5.4).
  useEffect(() => {
    const off = subscribeAuthIdentity(() => rt.identityChanged(readAuthIdentity()));
    rt.identityChanged(readAuthIdentity());
    return () => { off(); rt.unmount(); };
  }, [rt]);

  // A runtime disable, injected (no live toggle exists).
  useEffect(() => { rt.setHubEnabled(hubEnabled === true); }, [rt, hubEnabled]);

  // The clock re-renders the hub when a known cooldown bound passes, and only while one is pending.
  useEffect(() => {
    const until = rt.nextCooldownEnd();
    if (until === null) return undefined;
    const id = setTimeout(rt.tick, Math.max(0, until - Date.now()) + 25);
    return () => clearTimeout(id);
  }, [rt, snap.version]);

  // While the root ceremony or the due-idea screen is open, the app behind it is inert (spec §10).
  const overlayOpen = snap.overlayOpen;
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const root = document.getElementById('root');
    return root ? inertSiblings(null, [root]) : undefined;
  }, [overlayOpen]);

  const value = useMemo(() => Object.freeze({ snapshot: snap, api: rt }), [rt, snap]);

  const a = snap.state.attempt;
  const c = snap.ceremony;
  const showCeremony = Boolean(c?.visible) && a && a.attemptId === c.attemptId && a.phase !== ATTEMPT_PHASES.ORPHANED;
  const agent = rt.agentFor();
  const extras = rt.ceremonyAgentFor();
  // The shells' own expressions (CommandDashboard.jsx, CommandDashboardDesktop.jsx), over the attempt's agent.
  const accent = agent?.primaryColor || agent?.avatarColors?.[0] || CMD.teal;
  const agentName = agent?.name || bridge.userName || 'your agent';
  const offerRetry = showCeremony && !snap.flagDisabled;
  // The deploy target's recorded lastDeployedAt is the cooldown's evidence while the attempt stands (spec §5.4).
  const evidenceTarget = a && a.phase !== ATTEMPT_PHASES.IDLE && a.phase !== ATTEMPT_PHASES.ORPHANED && realId(a.targetAgentId)
    ? a.targetAgentId : null;

  return (
    <DeployAttemptContext.Provider value={value}>
      {children}
      {evidenceTarget && (
        <TargetEvidence key={`${a.attemptId}:${evidenceTarget}`} rt={rt} targetAgentId={evidenceTarget} uid={a.capturedUid} authEpoch={a.authEpoch} />
      )}
      {snap.due && <DueIdeaInterstitial key={snap.due.attemptId} due={snap.due.due} accent={accent} onProceed={snap.due.proceed} />}
      {showCeremony && (
        <RootCeremony
          rt={rt}
          ceremony={c}
          attempt={a}
          agent={agent}
          accent={accent}
          agentName={agentName}
          directiveCount={extras?.directiveCount || 0}
          offerRetry={offerRetry}
        />
      )}
    </DeployAttemptContext.Provider>
  );
}

/**
 * The deploy target's recorded lastDeployedAt, from the target's own document (decide.js stamps it on a creation
 * and on an existing answer), as cooldown evidence for its owner and target. The same listener the ceremony keeps.
 */
function TargetEvidence({ rt, targetAgentId, uid, authEpoch }) {
  const { lastDeployedAt, targetKnown } = useDeployTargetProgress(targetAgentId);
  useEffect(() => {
    if (!targetKnown) return;
    const ms = lastDeployedAtMs(lastDeployedAt, Date.now());
    if (ms !== null) rt.lastDeployedEvidence({ uid, authEpoch, targetAgentId, lastDeployedAtMs: ms });
  }, [rt, targetKnown, lastDeployedAt, uid, authEpoch, targetAgentId]);
  return null;
}

/** The hub attempt's ceremony, at the root: the shipped ceremony, its callbacks through the provider's checks. */
function RootCeremony({ rt, ceremony, attempt, agent, accent, agentName, directiveCount, offerRetry }) {
  return (
    <DeployCeremony
      key={ceremony.key}
      attemptId={ceremony.attemptId}
      onPhaseChange={rt.phaseChanged}
      agent={agent}
      accent={accent}
      agentName={agentName}
      directiveCount={directiveCount}
      deployResult={ceremony.deployResult}
      targetAgentId={ceremony.targetAgentId}
      liveBattles={rt.liveBattlesFor()}
      onEnterBattle={rt.enterBattle}
      onOpenBattle={rt.openGame}
      onDismiss={rt.dismiss}
      onRetry={offerRetry && retryAdmitted(rt, attempt) ? rt.retry : undefined}
    />
  );
}

/**
 * The ceremony offers Retry only when the hub's own table does (spec §5.4): a refusal, or an uncertain attempt
 * whose reconciliation came back clear, with the replacing request admitted now. An unresolved uncertainty has
 * no Retry — Check deployment first — and nothing is ever replayed on its own.
 */
function retryAdmitted(rt, attempt) {
  const clear = attempt.phase === ATTEMPT_PHASES.UNCERTAIN && attempt.reconciliationStatus === RECONCILIATION.CLEAR;
  if (attempt.phase !== ATTEMPT_PHASES.REFUSED && !clear) return false;
  return rt.retryActionNow() === true;
}
