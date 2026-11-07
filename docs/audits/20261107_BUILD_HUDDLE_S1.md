# Build report — Huddle S1 (the huddle, dark)

**Status:** IN PROGRESS — this file is written as the build goes; the final sections are filled at the end.

## Running findings (to be folded into the final sections)

- RF-1 `fetchRecentNews` (`api/_utils/agentTriggerGate.js:235-240`) queries `fantasyTimesStories` with `tickers array-contains` + `publishedAt >` + `orderBy publishedAt desc`; `firestore.indexes.json` carries no composite for it, and the catch at `:256` logs and returns nothing per symbol. It may return no stories in production. Out of scope: reported, not fixed. The Huddle's story fetcher uses a single-field `publishedAt` range instead (no new index).
- RF-2 V1.1 §5.1 drains jobs in the brief handler "while ≥ 150 s of the 300 s maxDuration remain"; the brief handler's `maxDuration` is 60 s (`api/cron/compute-daily-regime-brief.js:37`). A10 says the handler behaves as HEAD, so it stays 60 s and its drain stage claims nothing (`drainedInHandler: 0`); the worker's first tick drains within two minutes.
- RF-3 V1.1 §4.5 wants `textVersion: 'plan.v1'` on the slot; `buildDirectiveSlot` emits `textVersion` only for a call-family filing (`api/_utils/directiveFiling.js:34-46`, `:87`). The plan filing builds its slot object itself with existing keys only (`text, expiry, directiveThreadId, createdAt, textVersion`), the cockpit precedent for `textVersion`.
- RF-4 V1.1 §8 calls the Huddle sheet "a lazy module outside the hub directory"; the mount guard pins exactly one lazy edge in the hub graph (`commandCenterHub.mount.guard.test.js:826-834`). The sheet body is a static import listed in `PERMITTED_TERMINALS`, moved under C8's HubSheet ruling.
- RF-5 C6's agreed order names "research awaiting your direction"; no such rule exists in `hub/nextAction.js` at HEAD (`:8-17`). S1 adds only the Huddle rule.
- RF-6 Superseded, so a reader of V1.1 alone does not look for them: V1.1 §6's 60 s status poll (withdrawn by C7: no poll); V1.1 §5.1's `30 12,13` brief entry (withdrawn by A10); V1.1 §6.2's post-deploy hook and the `apply` route (withdrawn by C7).
- RF-7 `firestore.indexes.json` exempts `ticks.controls` (and `manifest`, `checks`, `actions`, …) from indexing, so "heard" cannot be a query on `controls.*`. Reconcile reads the battle's ticks by a single-field `capturedAt` range from the filing instant and tests `controls` in memory.
- RF-8 The brief handler's `today` is the UTC date (`compute-daily-regime-brief.js:194`); the `huddleRuns` marker is keyed by the ET date. At 12:30 UTC they agree.
- RF-9 Two tests pin the cron count at 44: `api/agent/research.dark.test.js:141`, `api/cron/agent-evaluate.measuredFollowup.test.js:188`.
