// src/hooks/holdClaim.js
//
// Command Center repair R2, ruling R-R2-1 (spec V1.2 §5.5, correction C4) —
// ONE HOLD AT A TIME, APP-WIDE.
//
// Every hold-to-deploy button owns its own useHoldToDeploy, so before this
// module nothing stopped two of them charging at once: two fingers, or the
// mobile station plus the "Deploy without previewing" line, or a pointer and a
// key on the same control in one tick. Each reached onComplete (D2, D3). This
// is the single slot they now share:
//
//   slot = { token, controlId, phase: 'charging' | 'locked' } or empty
//
//   claimHold(controlId)  a fresh opaque token when the slot is EMPTY, else
//                         null. A second input on the holding control is
//                         denied like any other control. No control id, no
//                         claim (fails closed).
//   commitHold(token)     the atomic commitment check: true and 'locked' only
//                         when `token` is the current CHARGING claim; false
//                         otherwise, with the slot untouched.
//   releaseHold(token)    empties the slot only for its own token, so a late
//                         release from an older hold can never free a newer
//                         one.
//   currentHold()         a frozen copy for readers, in the shape the hub's
//                         S2a selector reads — { controlId, holdToken, phase } —
//                         or null. holdEpoch is the S2b provider's to stamp
//                         (spec §5.5's claimHold takes it as an input).
//
// Command Center slice S2b (ruling R-S2b-3; spec §5.5): the hub's controls
// claim with the input and the epoch as well —
//
//   claimHold(controlId, inputId, holdEpoch)
//                         the same single slot and the same denial, and the
//                         claim also names the input that made it (`pointer:7`,
//                         `key`) and the provider's hold epoch. Both must be
//                         valid or nothing is granted (fails closed). The copy
//                         currentHold() returns then carries `inputId` and
//                         `holdEpoch` too. The hook uses the input to ignore a
//                         denied second finger's lift (R2 Q5).
//
// claimHold(controlId) — today's shells — is unchanged, and its copy carries
// neither field.
//
// Pure and synchronous: no React, no DOM, no timer. Every call completes before
// it returns, which is what lets a claim be checked BEFORE any effect (R-R2-3)
// and a commitment be decided in the same call that makes it (R-R2-5).
//
// Who releases (the hook keeps this; useHoldToDeploy.js header): a cancel
// while charging; the settle of onComplete's result after a committed beat, or
// the bounded safety release 180 s after onComplete ran if it never settles;
// an unmount that cancels a legacy beat before it runs. A beat handed to a
// beatOwner is released by its run, or by the owner.

let slot = null;
let issued = 0;

const validInput = (inputId) => typeof inputId === 'string' && inputId.length > 0;
const validEpoch = (n) => Number.isInteger(n) && n >= 0;

export function claimHold(controlId, ...named) {
  if (slot !== null) return null;
  if (controlId === undefined || controlId === null || controlId === '') return null;
  // S2b: a claim that names its input must name a valid one, and its epoch.
  const [inputId, holdEpoch] = named;
  if (named.length > 0 && (!validInput(inputId) || !validEpoch(holdEpoch))) return null;
  issued += 1;
  const token = `hold_${issued}`;
  slot = named.length > 0 ? { token, controlId, phase: 'charging', inputId, holdEpoch } : { token, controlId, phase: 'charging' };
  return token;
}

export function commitHold(token) {
  if (slot === null || token == null || slot.token !== token || slot.phase !== 'charging') return false;
  slot = { ...slot, phase: 'locked' };
  return true;
}

export function releaseHold(token) {
  if (slot === null || token == null || slot.token !== token) return false;
  slot = null;
  return true;
}

export function currentHold() {
  if (slot === null) return null;
  if (Object.hasOwn(slot, 'inputId')) {
    return Object.freeze({ controlId: slot.controlId, holdToken: slot.token, phase: slot.phase, inputId: slot.inputId, holdEpoch: slot.holdEpoch });
  }
  return Object.freeze({ controlId: slot.controlId, holdToken: slot.token, phase: slot.phase });
}

/**
 * Test seam: empty the slot. The token counter is NOT reset, so a token issued
 * before a reset can never match one issued after it.
 */
export function __resetHoldClaim() {
  slot = null;
}
