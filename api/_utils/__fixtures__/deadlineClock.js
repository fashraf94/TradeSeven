// api/_utils/__fixtures__/deadlineClock.js
//
// The call-record DEADLINE rows' clock (the Oct 29, 2026 flake fix —
// docs/audits/20261029_FIX_CALLRECORDS_DEADLINE_FLAKE.md).
//
// The calls steps read the WALL clock for their deadlines (Date.now()
// arithmetic) and race their ceilings on a TIMER (setTimeout, through
// intraday/evaluatorHook.js withTimeout), which runs on the MONOTONIC clock. On
// real time the two disagree whenever the wall clock is stepped (WSL's guest
// time sync steps it forward ~1.3 s every ~33 s, idle or loaded) or a worker
// stalls: a deadline "passes" that the timer has not reached, and a commit that
// landed in time reads as unconfirmed. These rows fake setTimeout, clearTimeout
// and Date together — one virtual clock — and move it themselves, so every
// outcome is decided by the virtual milliseconds the row names.
//
// Takes the test file's own `vi`. ZERO product imports.

/** @param {import('vitest').VitestUtils} vi */
export function deadlineClock(vi) {
  return {
    /** Fake setTimeout, clearTimeout and Date as one clock; `atMs` (optional) sets the instant. */
    use(atMs) {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      if (atMs !== undefined) vi.setSystemTime(atMs);
    },
    /**
     * Let `ms` virtual milliseconds pass with `promise` in flight. Resolves to
     * `{ value, atMs }` — what it settled to, and how many virtual ms after this
     * call it settled. Throws when it is still pending (it ran past the time the
     * row allows) or when it rejected.
     */
    async settle(ms, promise) {
      const startMs = Date.now();
      let outcome = null;
      promise.then((value) => { outcome = { value, atMs: Date.now() - startMs }; }, (error) => { outcome = { error }; });
      await vi.advanceTimersByTimeAsync(ms);
      if (!outcome) throw new Error(`deadlineClock: still pending after ${ms} virtual ms`);
      if ('error' in outcome) throw outcome.error;
      return outcome;
    },
  };
}
