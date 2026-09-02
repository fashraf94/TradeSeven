// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyTiming.test.jsx
//
// Ceremony stage-duration instrumentation — the §6 verification rows.
//
// The rows that matter are the ones a REAL defect would redden:
//
//   §6.3  classification. Constructed against the machine's ACTUAL floors, one
//         case of each verdict, driven through the real stage machine rather
//         than by calling the marks by hand — a classifier that agreed with a
//         hand-fed timeline but not with the machine would prove nothing.
//   §6.4  the fallback path. setDeployTarget #2 never fires, and the run must
//         say so as an OUTCOME, not as a null or a crash.
//   §6.5  constraint 2. A forced throw INSIDE the module (not a mocked export —
//         the call sites have no try/catch of their own and are not supposed
//         to) leaves the deploy result and the machine's transitions unchanged.
//         That is also the executable form of constraint 1: nothing gates on a
//         timestamp, so poisoning the instrumentation cannot move the machine.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const { getIdTokenMock } = vi.hoisted(() => ({ getIdTokenMock: vi.fn() }));
vi.mock('../../../firebase/authService', () => ({ getIdToken: getIdTokenMock }));

const { deployAgent } = await import('../../../services/agentDeploy.js');
const { default: useCeremonyStageMachine } = await import('./useCeremonyStageMachine.js');
const ceremonyTiming = await import('./ceremonyTiming.js');

// The floors the machine actually applies (useCeremonyStageMachine MIN_FLOOR_MS).
// Duplicated HERE on purpose: these rows exist to prove the classification agrees
// with the machine, so the expectation must be an independent statement of the
// floors, not a re-read of the value under test.
const FLOORS = [2000, 2500, 2500, 2500];
const TOLERANCE_MS = 150;

const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid1';

let container; let root; let seen;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  getIdTokenMock.mockReset();
  delete window.__ceremonyTiming;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── machine harness (mirrors ceremonyDeployTarget.test.jsx) ────────────────
const BASE = {
  stage: undefined, deployId: undefined, updatedAt: undefined, errorPhase: undefined,
  deployStatus: 'pending', targetKnown: false, targetAgentId: null,
};
function MachineProbe(props) { seen = useCeremonyStageMachine(props); return null; }
// Two separate act() calls, deliberately — see the note in ceremonyDeployTarget.
//
// Time is advanced ONE INTERVAL AT A TIME. The machine reads its current stage
// through a ref assigned during RENDER, and a concurrent root does not commit
// inside the act() that scheduled the update — so a multi-tick
// advanceTimersByTime in a single act() would run every tick against a stale
// stage index, re-firing the same transition and collapsing four stages into
// one. Production commits between the 100ms ticks; this makes the harness do
// the same, which is what lets these rows measure real per-stage durations.
const step = (props, ms = 200) => {
  act(() => { root.render(<MachineProbe {...{ ...BASE, ...props }} />); });
  for (let i = 0; i < Math.max(1, Math.round(ms / 100)); i += 1) {
    act(() => { vi.advanceTimersByTime(100); });
  }
};

// Poisons EXACTLY the timing module's output path — console.table, its summary
// line, and its own suppression warning — and nothing else. Poisoning the whole
// console would break the deploy path's own [Deploy] logging and prove the wrong
// thing: the claim under test is that a fault inside the instrumentation is
// contained, not that the deploy survives a dead console.
const poisonTiming = () => {
  vi.spyOn(console, 'table').mockImplementation(() => { throw new Error('timing boom'); });
  vi.spyOn(console, 'log').mockImplementation((first) => {
    if (typeof first === 'string' && first.startsWith('CEREMONY')) throw new Error('timing boom');
  });
  vi.spyOn(console, 'warn').mockImplementation((first) => {
    if (typeof first === 'string' && first.startsWith('[CeremonyTiming]')) throw new Error('timing boom');
  });
};
// 'performance' is NOT in vitest's default toFake list, and both the machine and
// the timing module measure with performance.now().
const fakeClock = () => vi.useFakeTimers({
  toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
});

// Drives ONE ceremony with the founder's reported shape: S1 gated only by its
// floor, S2 left waiting on the server, S3/S4 gated only by their floors.
// Returns the emitted run.
function runMixedCeremony({ s2WaitMs = 8000 } = {}) {
  const T = { targetKnown: true, targetAgentId: CLONE };
  ceremonyTiming.startRun();
  step({ ...T });                                                              // baseline (not ours)
  step({ ...T, stage: 'strategy_running', deployId: 'ours', updatedAt: 'u1' }, 2500);  // S1 → floor
  step({ ...T, stage: 'strategy_running', deployId: 'ours', updatedAt: 'u1' }, s2WaitMs); // S2 waits
  step({ ...T, stage: 'strategy_complete', deployId: 'ours', updatedAt: 'u2' }, 300);   // S2 → SERVER
  step({ ...T, stage: 'complete', deployId: 'ours', updatedAt: 'u3', deployStatus: 'success' }, 6000);
  return window.__ceremonyTiming;
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.1 / §6.2 — a deploy emits the line + the table, and the run is stashed
// ═══════════════════════════════════════════════════════════════════════════
describe('emission (§6.1, §6.2)', () => {
  beforeEach(fakeClock);
  afterEach(() => vi.useRealTimers());

  it('emits ONE summary line and ONE table at the reveal', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    runMixedCeremony();

    expect(seen.phase).toBe('reveal');
    expect(table).toHaveBeenCalledTimes(1);
    const lines = log.mock.calls.map((c) => c[0]).filter((l) => typeof l === 'string' && l.startsWith('CEREMONY'));
    expect(lines).toHaveLength(1);
    // The documented, copy-pasteable shape — the format is the deliverable.
    expect(lines[0]).toMatch(
      /^CEREMONY \d+\.\ds \| clone [^|]+( \| S\d+ \d+\.\ds (floor|SERVER|skipped|open))+$/
    );
  });

  it('window.__ceremonyTiming holds the LAST run, readable after the log', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    runMixedCeremony();

    const run = window.__ceremonyTiming;
    expect(run).toBeTruthy();
    expect(run.endKind).toBe('reveal');
    expect(typeof run.summary).toBe('string');
    expect(run.rows.length).toBeGreaterThan(4);
    expect(run.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // t0 is handleDeploy's startRun, so the total spans the whole ceremony.
    expect(run.endedAt - run.t0).toBeGreaterThan(FLOORS.reduce((a, b) => a + b, 0));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §6.3 — floor-bound vs server-bound, against the machine's known floors
// ═══════════════════════════════════════════════════════════════════════════
describe('classification (§6.3)', () => {
  beforeEach(fakeClock);
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a stage the pipeline beat is FLOOR-bound; a stage that waited is SERVER-bound', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    const run = runMixedCeremony({ s2WaitMs: 8000 });

    const verdicts = run.rows.filter((r) => /^S\d+$/.test(r.phase)).map((r) => r.verdict);
    expect(verdicts).toEqual(['floor', 'SERVER', 'floor', 'floor']);

    const stageMs = run.stages.map((s) => s.exitedAt - s.enteredAt);
    // Floor-bound stages exit within the tolerance of their floor — that is the
    // whole claim: the ceremony, not the server, was the gate.
    [0, 2, 3].forEach((i) => {
      expect(stageMs[i]).toBeGreaterThanOrEqual(FLOORS[i]);
      expect(stageMs[i] - FLOORS[i]).toBeLessThanOrEqual(TOLERANCE_MS);
      expect(run.stages[i].floorMs).toBe(FLOORS[i]);
    });
    // The server-bound stage ran materially past its floor — a real wait.
    expect(stageMs[1] - FLOORS[1]).toBeGreaterThan(TOLERANCE_MS);
    expect(stageMs[1]).toBeGreaterThan(8000);
  });

  // MUTATION CHECK (BUILD_RULES §2): the row above must be able to FAIL. The ONLY
  // difference here is the length of the wait — same stage, same position, same
  // code path — so a classifier that hard-coded "S2 is the slow one" would pass
  // the row above and fail this one. S2 enters at its predecessor's 2000ms floor,
  // so a 1700ms wait resolves the server gate at ~4400ms, INSIDE S2's own floor
  // at ~4500ms: the ceremony is still the gate and the user never waited.
  it('the same stage is FLOOR-bound when the wait fits inside its floor (mutation check)', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    const run = runMixedCeremony({ s2WaitMs: 1700 });
    const verdicts = run.rows.filter((r) => /^S\d+$/.test(r.phase)).map((r) => r.verdict);
    expect(verdicts).toEqual(['floor', 'floor', 'floor', 'floor']);
    const s2 = run.stages[1];
    expect(s2.exitedAt - s2.enteredAt - FLOORS[1]).toBeLessThanOrEqual(TOLERANCE_MS);
  });

  it('a SKIPPED stage is neither floor-bound nor a wait', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    const T = { targetKnown: true, targetAgentId: CLONE };
    ceremonyTiming.startRun();
    step({ ...T });
    step({ ...T, stage: 'strategy_complete', deployId: 'ours', updatedAt: 'u1' }, 2500);
    expect(seen.canSkip).toBe(true);
    act(() => { seen.requestSkip(); });   // zeroes the floors, not the rank gate
    step({ ...T, stage: 'complete', deployId: 'ours', updatedAt: 'u2', deployStatus: 'success' }, 500);

    const run = window.__ceremonyTiming;
    const verdicts = run.rows.filter((r) => /^S\d+$/.test(r.phase)).map((r) => r.verdict);
    expect(verdicts.slice(1)).toEqual(['skipped', 'skipped', 'skipped']);
    expect(run.summary).toContain('skipped');
  });

  // A stage still OPEN when the run ends is the stall case, and is the row the
  // founder most needs to see — it must be measured, not dropped.
  it('a stage still open when the watchdog fires is measured to the end of the run', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    const T = { targetKnown: true, targetAgentId: CLONE };
    ceremonyTiming.startRun();
    step({ ...T });
    step({ ...T, stage: 'strategy_running', deployId: 'ours', updatedAt: 'u1' }, 2500); // S1 → floor
    step({ ...T, stage: 'strategy_running', deployId: 'ours', updatedAt: 'u1' }, 95000); // watchdog

    expect(seen.phase).toBe('error');
    const run = window.__ceremonyTiming;
    expect(run.endKind).toBe('error:timeout');
    expect(run.summary).toContain('ERROR:TIMEOUT');
    const s2 = run.rows.find((r) => r.phase === 'S2');
    expect(s2.verdict).toBe('open');
    expect(s2.ms).toBeGreaterThan(85000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §6.4 — Measurement A: the clone round trip, and the fallback OUTCOME
// ═══════════════════════════════════════════════════════════════════════════
describe('clone round trip (§6.4)', () => {
  const stubFetch = ({ cloneOk, cloneDelayMs = 0 }) => vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url === '/api/agent/ensure-casual-clone') {
      if (cloneDelayMs) await new Promise((r) => setTimeout(r, cloneDelayMs));
      return cloneOk
        ? { ok: true, status: 200, text: async () => JSON.stringify({ cloneId: CLONE }) }
        : { ok: false, status: 503, text: async () => JSON.stringify({ error: 'boom' }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, agentBattleId: 'b1' }) };
  }));

  it('resolved: both setDeployTarget calls are seen and the round trip is measured', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    getIdTokenMock.mockResolvedValue('tok');
    stubFetch({ cloneOk: true });

    ceremonyTiming.startRun();
    const result = await deployAgent(RANKED, null, () => {});
    ceremonyTiming.markReveal();

    expect(result.success).toBe(true);
    const run = window.__ceremonyTiming;
    expect(run.firstTargetId).toBe(RANKED);   // setDeployTarget #1
    expect(run.cloneId).toBe(CLONE);          // setDeployTarget #2
    const clone = run.rows.find((r) => r.phase === 'ensure-casual-clone');
    expect(clone.verdict).toBe('resolved');
    expect(clone.ms).not.toBeNull();
    expect(run.summary).toMatch(/\| clone \d+\.\ds$/);   // no outcome tag when resolved
    // The auth-token leg is split out, so the clone number does not absorb it —
    // pre-warming cannot claim time it has no way to recover.
    expect(run.rows.find((r) => r.phase === 'auth token').ms).not.toBeNull();
    expect(run.rows.find((r) => r.phase === 'POST decide').detail).toBe('HTTP 200');
  });

  it('fallback: setDeployTarget #2 never fires → a distinct OUTCOME, not a null or a crash', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    getIdTokenMock.mockResolvedValue('tok');
    stubFetch({ cloneOk: false });

    ceremonyTiming.startRun();
    const result = await deployAgent(RANKED, null, () => {});
    ceremonyTiming.markReveal();

    expect(result.success).toBe(true);            // the deploy still succeeds, degraded
    const run = window.__ceremonyTiming;
    expect(run.cloneResolvedAt).toBeNull();       // #2 genuinely never fired
    const clone = run.rows.find((r) => r.phase === 'ensure-casual-clone');
    expect(clone.verdict).toBe('fallback');       // …and that is recorded as an outcome
    expect(clone.ms).not.toBeNull();              // the round trip is still known
    expect(clone.detail).toBe('http_503');
    expect(run.summary).toContain('fallback');
    expect(run.summary).not.toContain('null');
    expect(run.summary).not.toContain('NaN');
  });

  it('a clone attempt that never happened reads "off", not a false zero', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    // The shape of a CASUAL_CLONE_CONCURRENCY_ENABLED=false deploy: one target
    // report, then straight to the POST.
    ceremonyTiming.startRun();
    ceremonyTiming.markDeployTarget(RANKED);
    ceremonyTiming.markPostIssued();
    ceremonyTiming.markPostResolved(200);
    ceremonyTiming.markReveal();

    const run = window.__ceremonyTiming;
    expect(run.rows.find((r) => r.phase === 'ensure-casual-clone').verdict).toBe('off');
    expect(run.summary).toContain('clone off');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §6.5 — constraints 1 & 2: it cannot throw, and nothing gates on it
// ═══════════════════════════════════════════════════════════════════════════
describe('the module cannot break a deploy (§6.5, constraints 1–2)', () => {
  it('a throw raised INSIDE a mark is swallowed and the call returns undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A genuine internal throw: the String() conversion in markCloneFallback.
    const poison = { toString() { throw new Error('boom'); } };
    ceremonyTiming.startRun();
    expect(() => ceremonyTiming.markCloneFallback(poison)).not.toThrow();
    expect(ceremonyTiming.markCloneFallback(poison)).toBeUndefined();
    // …and the same on the stage path (the property-key conversion).
    expect(() => ceremonyTiming.markStageEnter(poison)).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it('a throw raised INSIDE the emit is swallowed', () => {
    poisonTiming();
    ceremonyTiming.startRun();
    ceremonyTiming.markDeployTarget(RANKED);
    expect(() => ceremonyTiming.markReveal()).not.toThrow();
  });

  it('a poisoned console leaves the deploy result byte-identical', async () => {
    getIdTokenMock.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      url === '/api/agent/ensure-casual-clone'
        ? { ok: true, status: 200, text: async () => JSON.stringify({ cloneId: CLONE }) }
        : { ok: true, status: 200, text: async () => JSON.stringify({ success: true, agentBattleId: 'b1' }) }
    )));

    // Clean run first, for the comparison baseline.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    ceremonyTiming.startRun();
    const reportedClean = [];
    const clean = await deployAgent(RANKED, null, (id) => reportedClean.push(id));

    // Now with the module's whole output path throwing.
    poisonTiming();
    ceremonyTiming.startRun();
    const reportedPoisoned = [];
    const poisoned = await deployAgent(RANKED, null, (id) => reportedPoisoned.push(id));
    expect(() => ceremonyTiming.markReveal()).not.toThrow();

    expect(poisoned).toEqual(clean);
    expect(reportedPoisoned).toEqual(reportedClean);
    expect(reportedPoisoned).toEqual([RANKED, CLONE]);
  });

  // Constraint 1, stated executably: instrumentation is not behavior. With the
  // module's whole output path throwing, the machine must reach the SAME phase,
  // stage and rank at the same ticks — a machine that gated on a timestamp could
  // not survive this.
  it('a poisoned timing module leaves every machine transition identical', () => {
    fakeClock();
    const T = { targetKnown: true, targetAgentId: CLONE };
    const trace = () => {
      const out = [];
      const record = () => out.push(`${seen.phase}/${seen.stageIndex}/${seen.serverRank}/${seen.canSkip}`);
      ceremonyTiming.startRun();
      step({ ...T }); record();
      step({ ...T, stage: 'strategy_running', deployId: 'ours', updatedAt: 'u1' }, 2500); record();
      step({ ...T, stage: 'strategy_running', deployId: 'ours', updatedAt: 'u1' }, 8000); record();
      step({ ...T, stage: 'strategy_complete', deployId: 'ours', updatedAt: 'u2' }, 300); record();
      step({ ...T, stage: 'complete', deployId: 'ours', updatedAt: 'u3', deployStatus: 'success' }, 6000); record();
      act(() => { root.render(<div key="reset" />); });
      return out;
    };

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    const clean = trace();

    poisonTiming();
    const poisoned = trace();

    expect(poisoned).toEqual(clean);
    expect(clean.at(-1)).toBe('reveal/4/4/false');
    vi.useRealTimers();
  });
});
