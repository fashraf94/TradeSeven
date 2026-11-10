// api/_utils/huddle/gate.js
//
// Huddle S1 — the server's one read of DRB_HUDDLE_ENABLED (Amendment A §A10). Every
// server path asks here: the brief handler's enqueue and drain stages, the worker, every
// /api/huddle/* route, the check-start sweep and the settle reconcile. Anything but
// exactly `true` is off. Tests turn it on by mocking src/config/huddleFlags.js.

import { DRB_HUDDLE_ENABLED } from '../../../src/config/huddleFlags.js';

export function isHuddleOn() {
  return DRB_HUDDLE_ENABLED === true;
}
