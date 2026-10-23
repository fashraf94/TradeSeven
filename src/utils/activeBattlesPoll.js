// src/utils/activeBattlesPoll.js
//
// Command Center slice S3 (ruling R-S3-3; spec V1.2 §3, "Active poll") — the
// owner-aware half of App's active-battle poll, pure, so App's poll stays one
// closure (App.agentBattlesPoll.test.js pins its body) and these rules are
// tested directly.
//
// App keeps the retained list where it always has (activeAgentBattles, one
// setActiveAgentBattles(liveBattles) in the poll body) and this METADATA in its
// own state, the Sync Pass 1 precedent (setVoiceLayerCaches):
//
//   { epoch, status, ownerUid, ownerEpoch, lastSuccessfulAt, error, refreshing }
//
//   epoch             the identity epoch (services/authIdentity.js) this
//                     metadata describes; App resets it on every change
//   status            the latest SETTLED request of this epoch: 'loading'
//                     until one settles, then 'ready' | 'error'. A background
//                     run (the 120 s interval) reports nothing until it
//                     settles, so the hub never reads "Refreshing" every two
//                     minutes; the hub's input names an explicit refresh's
//                     request as 'loading' (hub/selectors/readerInputs.js)
//   ownerUid,         the owner (the uid the request queried) and epoch of the
//   ownerEpoch        RETAINED list; null until a success in this epoch
//   lastSuccessfulAt  ms the request that produced that list BEGAN — its
//                     "as of": never fresher than the list it describes
//   error             the latest failure; null after a success
//   refreshing        an explicit refresh — the hub's Retry, or S2b's call —
//                     is in flight; never the background run
//
// The run bookkeeping (createActivePollFlights) keeps one run in flight per
// explicit refresh: a refresh joins the newest unsettled run of the current
// epoch instead of starting another, and `refreshing` lasts until the NEWEST
// explicit run of the epoch settles. Background runs keep today's schedule
// exactly — every interval tick still starts its run.

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/** The metadata before any request of `epoch` has settled. */
export function initialActivePoll(epoch = 0) {
  return Object.freeze({
    epoch, status: 'loading', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: null, refreshing: false,
  });
}

/**
 * Is the identity a run captured still the one it queries for? An unresolved
 * capture (Firebase auth has not answered yet) queries as today; a resolved
 * one only for its own uid, so no other owner's list is ever tagged with it.
 */
export function pollCaptureMatches(capture, queriedUid) {
  if (!capture || typeof queriedUid !== 'string' || !queriedUid) return false;
  return capture.resolved !== true || capture.uid === queriedUid;
}

/** An explicit refresh started (or joined a running request) for `capture`. */
export function activePollRefreshStarted(meta, capture) {
  if (!meta || meta.epoch !== capture?.authEpoch || meta.refreshing) return meta;
  return Object.freeze({ ...meta, refreshing: true });
}

/**
 * A request of `capture` settled. `outcome` is `{ ok: true, uid, at }`, `{ ok:
 * false, error, at }`, or null when it made no request (nobody signed in, or
 * the identity moved). `at` is when the request BEGAN: a success is "as of"
 * its start, a lower bound on the list's age that an older run landing after a
 * newer one (a run can outlive a hide/show) can never overstate; a failure
 * that began BEFORE the retained success is older than the list now held and
 * says nothing about it (App's list is still whichever success landed last,
 * exactly as before S3). `explicitDone`: this settle ends the explicit
 * refresh (the flights say so: no newer explicit run of the epoch is out).
 * Metadata of another epoch is left alone: App resets it on the change itself.
 */
export function activePollSettled(meta, capture, outcome, explicitDone) {
  if (!meta || meta.epoch !== capture?.authEpoch) return meta;
  const refreshing = explicitDone ? false : meta.refreshing;
  if (outcome && outcome.ok === true && typeof outcome.uid === 'string' && outcome.uid && finite(outcome.at)) {
    return Object.freeze({
      ...meta, status: 'ready', ownerUid: outcome.uid, ownerEpoch: capture.authEpoch, lastSuccessfulAt: outcome.at, error: null, refreshing,
    });
  }
  if (outcome && outcome.ok === false) {
    if (finite(outcome.at) && finite(meta.lastSuccessfulAt) && outcome.at < meta.lastSuccessfulAt) {
      return refreshing === meta.refreshing ? meta : Object.freeze({ ...meta, refreshing });
    }
    const error = outcome.error ?? null;
    // The same failure again changes nothing a reader shows, so it renders nothing.
    if (meta.status === 'error' && meta.refreshing === refreshing && String(meta.error?.message ?? meta.error) === String(error?.message ?? error)) return meta;
    return Object.freeze({ ...meta, status: 'error', error, refreshing });
  }
  return refreshing === meta.refreshing ? meta : Object.freeze({ ...meta, refreshing });
}

/**
 * The runs in flight. `onRefreshStarted(flight)` fires when a run takes on an
 * explicit refresh (started as one, or joined); `onSettled(flight, outcome,
 * endsRefresh)` once per run, at its first settle — `endsRefresh` true when the
 * run carried an explicit refresh and no NEWER explicit run of its epoch is
 * still out, so a refresh lasts as long as its newest run (an older run that
 * stalls cannot hold it open). Each run carries `done`, a promise that
 * resolves to true on a successful request.
 *
 * Every unsettled run is kept, oldest first: a refresh joins the NEWEST
 * unsettled run of its epoch, even after a newer run has settled and left an
 * older one out. Only a refresh consults this; begin() starts a run whatever
 * is out, so the background schedule is untouched.
 */
export function createActivePollFlights({ onRefreshStarted, onSettled }) {
  const open = [];
  const epochOf = (flight) => flight.capture?.authEpoch;
  const markExplicit = (flight) => {
    if (!flight || flight.settled || flight.explicit) return;
    flight.explicit = true;
    onRefreshStarted(flight);
  };
  return {
    begin(capture, explicit = false) {
      let resolve;
      const done = new Promise((r) => { resolve = r; });
      const flight = { capture, explicit: false, settled: false, done, resolve };
      open.push(flight);
      if (explicit) markExplicit(flight);
      return flight;
    },
    /** The newest unsettled run of this epoch, which a refresh joins. */
    joinable(epoch) {
      for (let i = open.length - 1; i >= 0; i -= 1) {
        if (epochOf(open[i]) === epoch) return open[i];
      }
      return null;
    },
    markExplicit,
    settle(flight, outcome) {
      if (!flight || flight.settled) return;
      flight.settled = true;
      const at = open.indexOf(flight);
      const newerExplicitOut = at !== -1 && open.slice(at + 1).some((other) => other.explicit && epochOf(other) === epochOf(flight));
      if (at !== -1) open.splice(at, 1);
      onSettled(flight, outcome, flight.explicit && !newerExplicitOut);
      flight.resolve(outcome?.ok === true);
    },
  };
}
