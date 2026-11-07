# Huddle S1 — query and index manifest

**Required by:** spec V1.1 Amendment A §A8 (and §A11's housekeeping). Written by the S1 build as it built.
**Rule applied:** Firestore needs a composite index for a query that combines an equality on one field with a range or an order on another, or a range on one field with an order on another. Equality filters alone are served by merging single-field indexes; a range and an order on the same single field use that field's single-field index. The emulator does not enforce composites, so the founder's flag-on smoke on the preview (live database) is the validation step: any query that fails for a missing index is a smoke blocker, and the report records the console link the error provides.
**Field overrides read:** `firestore.indexes.json` exempts `ticks.{manifest, checks, actions, controls, callEnvelope, decision, capture, scores}` from indexing, so no Huddle query filters on `controls.*` (RF-7).

| # | Where (file) | Collection | Filters / order | Composite needed? | Index added |
|---|---|---|---|---|---|
| Q-A1 | `api/_utils/huddle/applyPlan.js` `activeBattleIdsOf`; `gather.js` | `agentBattles` | `ownerId ==`, `status ==` | No (equality only; merged single-field indexes). The `ownerId + status + completedAt` composite already in the manifest also serves it | none |
| Q-G1 | `confirmPlan.js` (inside the confirm transaction), `gather.js` | `agents` | `ownerId ==` | No (single field) | none |
| Q-R2 | `applyPlan.js` `findHeardTick` | `agentBattles/{id}/ticks` | `capturedAt >=` + `orderBy capturedAt asc`, limit 40 | No (range and order on the same single field; `capturedAt` is not exempted — the exemptions are `controls`, `manifest`, `checks`, `actions`, `callEnvelope`, `decision`, `capture`, `scores`) | none |
| Q-W1 | `queue.js` `selectClaimable` | `huddleQueue` | `etDate ==`, `status == 'pending'`; oldest first in memory | No (equality only) | none |
| Q-W2 | `queue.js` `selectClaimable` (reclaim) | `huddleQueue` | `etDate ==`, `status == 'claimed'`; `leaseUntil < now` tested in memory | No (equality only) | none |
| Q-W3 | `queue.js` `rowsToReconcile` | `huddleQueue` | `etDate ==`, `reconcile == true` | No (equality only) | none |
| Q-P1 | `players.js` | `agentBattles` | `status ==` | No (single field) | none |
| Q-P2 | `players.js` | `agentBattles` | `completedAt >=` | No (single field; the closePass `completedBetween` shape, `api/_utils/filmTape/closePass.js:95-100`) | none |
| Q-P3 | `players.js` | `agents` | `lastDeployedAt >=` (ISO string) | No (single field) | none |
| Q-E2 | `api/_utils/evidence/fantasyTimesStories.js` | `fantasyTimesStories` | `publishedAt >=` + `orderBy publishedAt desc`, limit 300; tickers filtered in memory | No (range and order on one field). Deliberately NOT `fetchRecentNews`'s `tickers array-contains` + `publishedAt` range (`agentTriggerGate.js:235-240`), which needs a composite the manifest lacks (build report RF-1) | none |

**Reads by path (no query):** `huddles/{uid}/days/{etDate}`, `huddleQueue/{uid}_{etDate}`, `huddleRuns/{etDate}`, `symbolDayEvidence/{etDate}_{SYMBOL}`, `agentBattles/{id}`, `watchlists/{id}`, `indexIntelligence/marketContext`. The playback token resolves through the day's index on `huddleRuns/{etDate}` (no collection-group query on `days`).

**Result: S1 adds no composite index.** `firestore.indexes.json` is unchanged. Every query above is equality-only, single-field, or a range and order on the same field, so none can fail for a missing composite on the live database; the founder's smoke still records any console link an error provides (A §A8).
