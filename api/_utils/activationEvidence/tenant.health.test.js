// api/_utils/activationEvidence/tenant.health.test.js
//
// ID-1 review fixes (review-fix prompt §3) — THE HEALTH LINE. After each run that
// did not skip, the tenant logs one line, `[activationEvidence] {counts}`: counts
// only, every key a literal or a stage name, every error code through codeLabelOf.
// A skipped run (the gate: the flag off) logs nothing. The emulator suite
// (test/rules/activationObserver.rules.mjs) checks the line of a real run with
// sentinel ids planted in every document; these rows check the line's own shape.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the tenant is imported unmocked; only
// the flag module is replaced, held OFF here whatever its deployed value (so this
// file never pins the flag: flagPinGuard.test.js).

import { describe, it, expect, vi, afterEach } from 'vitest';

// The flag is OFF unless a row turns it on; a row may also make the deployed rule set malformed (a programming error).
const ctl = vi.hoisted(() => ({ flagOn: false, malformedRuleSet: false }));
vi.mock('../../../src/config/activationEvidenceFlags.js', () => ({ get ACTIVATION_EVIDENCE_ENABLED() { return ctl.flagOn; } }));
vi.mock('../setupEvaluator/thresholds.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, describeRuleSet: () => (ctl.malformedRuleSet ? { setupVersion: 'tf-setup-v1', thresholdsHash: 'NOT A HASH', semanticsId: 'x' } : real.describeRuleSet()) };
});
const { codeLabelOf, healthLineOf, HEALTH_LINE_PREFIX, runActivationObserver } = await import('./tenant.js');

afterEach(() => { vi.restoreAllMocks(); ctl.flagOn = false; ctl.malformedRuleSet = false; });
const parse = (line) => { expect(line.startsWith(`${HEALTH_LINE_PREFIX} `)).toBe(true); return JSON.parse(line.slice(HEALTH_LINE_PREFIX.length + 1)); };

describe('the health line', () => {
  it('flag off: the run skips before any read and logs nothing', async () => {
    const saved = process.env.COCKPIT_ALLOWLIST_UIDS;
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1'; // an allowlist present: only the flag holds the gate shut
    try {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const db = new Proxy({}, { get() { throw new Error('no read may happen with the flag off'); } });
      expect(await runActivationObserver({ db, handlerStartMs: Date.now() })).toEqual({ skipped: true });
      expect(log).not.toHaveBeenCalled();
    } finally {
      if (saved === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = saved;
    }
  });
  it('carries the run\'s counts only, in a fixed shape; the four named deferrals show even at zero', () => {
    const counts = {
      battles: { read: 7, due: 2, unseen: 1, ordinary: 4, missing: 0, notOwned: 0, malformed: 0, finished: 1 },
      acquisitionsStarted: 5,
      store: { finalRead: 1, final: 3, pending: 1, retryable: 1, excluded: 0, threw: { 10: 1 } },
      pointers: { withEvidence: 9, null: 2, exists: 1, snapshotInvalid: 0, writeFailed: { aborted: 1 } },
      deferred: { tick_grace: 2, write_cap: 3 },
      truncations: { candidates: 1, ticks: 0 },
      failures: { 'ticks:14': 2 },
      stateWritten: true,
    };
    expect(parse(healthLineOf(counts))).toEqual({
      battles: { read: 7, due: 2, unseen: 1, ordinary: 4 },
      acquisitions: { started: 5, final: 3, pending: 1, retryable: 1, excluded: 0, threw: { 10: 1 } },
      pointers: { withEvidence: 9, null: 2 },
      deferred: { write_cap: 3, prep_cut: 0, not_reached: 0, attribution_read_error: 0, tick_grace: 2 },
      truncations: { candidates: 1, ticks: 0 },
      failures: { 'ticks:14': 2, 'pointer_write:aborted': 1 },
      stateWritten: true,
    });
  });
  it('a run deferred for budget logs the same shape, with no_budget', () => {
    expect(parse(healthLineOf({ deferred: 'no_budget' }))).toMatchObject({ deferred: { no_budget: 1, write_cap: 0 }, battles: { read: 0 }, stateWritten: false });
  });
  it('an error code that could carry an id is printed as `other`, never echoed', () => {
    const SENTINELS = ['SENTINEL_OWNER_7f3a', 'SENTINEL_BATTLE_91c2', 'NVDA', 'BRK-B', 'pos_7Hq2LmN4', 'ao-owner-1', '2026-11-04__NVDA__x'];
    const counts = {
      battles: {}, store: { threw: Object.fromEntries(SENTINELS.map((s) => [s, 1])) },
      pointers: { writeFailed: Object.fromEntries(SENTINELS.map((s) => [s, 1])) },
      deferred: { SENTINEL_REASON_X: 1 },
      truncations: {}, failures: Object.fromEntries(SENTINELS.map((s, i) => [`${['battles', 'pointers', 'ticks', 'final', 'candidates', 'state_write', 'battles'][i]}:${s}`, 1])),
    };
    const line = healthLineOf(counts);
    for (const s of [...SENTINELS, 'SENTINEL', 'NVDA', '__']) expect([s, line.includes(s)]).toEqual([s, false]);
    const h = parse(line);
    expect(h.acquisitions.threw).toEqual({ other: SENTINELS.length });
    expect(h.deferred.other).toBe(1);
  });
  it('review PFA-3: a code with a colon is labelled whole where there is no stage, and a stage off its list reads `other`', () => {
    const counts = {
      battles: {}, store: { threw: { 'SENTINEL_OWNER_7f3a:x': 1 } }, pointers: { writeFailed: { 'NVDA__2026-11-04:y': 1 } }, deferred: {}, truncations: {},
      failures: { 'pointers:14': 1, 'SENTINEL_STAGE:aborted': 1, 'battles:SENTINEL_B:z': 1 },
    };
    const line = healthLineOf(counts);
    for (const s of ['SENTINEL', 'NVDA', '__', ':x', ':y', ':z']) expect([s, line.includes(s)]).toEqual([s, false]);
    const h = parse(line);
    expect(h.acquisitions.threw).toEqual({ other: 1 });
    expect(h.failures).toEqual({ 'pointers:14': 1, 'other:other': 1, 'battles:other': 1, 'pointer_write:other': 1 }); // an unknown stage: its whole key is the code
  });
  it('review PFA-7: a run that throws (a malformed deployed rule set) logs one line, with no id, then the error goes on to the host', async () => {
    const saved = process.env.COCKPIT_ALLOWLIST_UIDS;
    process.env.COCKPIT_ALLOWLIST_UIDS = 'SENTINEL_OWNER_7f3a';
    ctl.flagOn = true;
    ctl.malformedRuleSet = true;
    try {
      const lines = [];
      vi.spyOn(console, 'log').mockImplementation((...a) => { lines.push(a.map(String).join(' ')); });
      const db = new Proxy({}, { get() { throw new Error('no read happens before the rule set is checked'); } });
      await expect(runActivationObserver({ db, handlerStartMs: Date.now() })).rejects.toThrow(TypeError);
      expect(lines).toHaveLength(1);
      expect(lines[0]).not.toContain('SENTINEL');
      expect(parse(lines[0])).toMatchObject({ failures: { 'run:TypeError': 1 }, battles: { read: 0 }, stateWritten: false });
    } finally {
      if (saved === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = saved;
    }
  });
  it('codeLabelOf: gRPC numbers, lower-case status names, error class names and Node errnos pass; anything else is other', () => {
    for (const c of ['10', 14, 'aborted', 'deadline-exceeded', 'unknown', 'TypeError', 'Error', 'SetupEvidenceProgrammingError', 'ETIMEDOUT', 'ECONNRESET']) expect([c, codeLabelOf(c)]).toEqual([c, String(c)]);
    for (const c of ['ABORTED', 'NVDA', 'EBAY', 'SENTINEL_X', 'agent-1x', 'Owner', '1234', 'a/b', '']) expect([c, codeLabelOf(c)]).toEqual([c, 'other']);
  });
});
