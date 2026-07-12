# LEVELSTORY — RULINGS & AMENDMENTS (SESSION 4 — EVENT DETECTION + EPISODE MODEL)

**Status:** Spec amendments of record for Session 4 — `03-detect-events.js`, the episode model that turns level interactions into independent events (parent §6, §13). Recorded per the S4 prompt §7/§8.
**Session:** LevelStory Session 4 — event detection on branch `claude/level-study-session4-event-detection-u9811g`.
**Config:** `STUDY_CONFIG_VERSION = 3` — unchanged. The only config additions this session are the two diagnostics-only anomaly-scan guards (§A7), which gate no computed study value, so no version bump (S4 §2). Every artifact stamps `configVersion: 3`.
**Precedence:** this document → `LEVELSTORY_RULINGS_AND_AMENDMENTS_S3_5.md` → S3 → S2 → Addendum → parent spec.

---

## §A — Spec amendments (founder-ruled, per the S4 prompt + approval additions A1–A5, R1)

### Amendment 1 — Episode zone frame = family anchor ± 0.25·u (clamped distanceUnit)

Parent §6.1 wrote the episode zone as `anchor ± 0.25 × ATR(14, D−1)` (raw ATR). This is **superseded**: the zone is `anchor ± 0.25 × u`, where `u` is the clamped v3 `distanceUnit` (`lib/level-sources.js:distanceUnit`, read as `session.unit`), and the multiple `0.25` is read from `config.episode.zoneAtrMult` — never hardcoded. Rationale: S3.5 Amendment 5 unified the role-machine frame with the Session-4 episode zone (`config.js` roleMachine `zoneHalfWidthUnits` == `episode.zoneAtrMult`, both 0.25), so **roles and episode zones can never disagree** — they diverge under raw ATR exactly when the floor/cap clamp binds. Likewise the close-separation (`1.0·u`, `config.episode.closeSeparationAtr`) and cross-level-dedup proximity (`0.5·u`, `crossLevelDedup.intersectAtr`) are multiples of the clamped `u`, not raw ATR. Implemented `lib/events.js:episodeZone`.

### Amendment 2 — Point-in-time anchor via a single-source stamp; `anchorAsOfD` reads strictly < D (A4)

The episode zone at session D uses the family's committed anchor **as of the prior close** — the same `preAnchor` the role machine reads (`lib/lineage.js`). Source: `02-build-levels.js:stepOneDay` now stamps `snapshot.familyAnchor = state.families.get(fid).anchor` (the post-EMA committed anchor) after `lineageStep` — a single read of lineage's value, no EMA math duplicated (BUILD_RULES §4). The detector reconstructs `anchorAsOfD(F, D)` = the `familyAnchor` of F's latest snapshot with **date strictly < D** (A4: D's own snapshot is post-touch information); fallbacks are the study-start checkpoint anchor, then the founding centroid. Requires re-running `npm run levels` before `npm run events` so registries carry the field. Safe for the existing suite — every equivalence/determinism test compares run-vs-run, never against a committed golden registry. Tested: `tests/22` (A4 point-in-time case: D's own 105 stamp is ignored; the zone stays on the prior 100 stamp).

### Amendment 3 — Approach-side rule pinned at the 5-min grain (A3)

Parent §6.1 left "approached from the correct side" undefined at the intraday grain. Ruling: **the most recent regular 5-min close strictly before the touch bar determines the approach side** (support opens only from above, resistance only from below). If a session opens with its first bar already inside the zone, the **prior session's close decides**. Implemented as the `approachPos` seed (prior `sessionCloseAdj` vs D's zone) advanced per bar to the last close strictly before the current bar (`lib/events.js`, session loop). Tested: `tests/23` (A3 — opens-inside with prior close above → opens; with prior close below → no open).

### Amendment 4 — `touchAt` is the touch bar's open-label timestamp (A4, second clause)

`touchAt` = the open-label timestamp of the touch bar (UTC ISO from the bar's epoch, deterministic; `lib/events.js:touchAtOf`). **The touch bar itself is post-touch information — observable only at its close.** Session 5's pre-touch feature boundary (fingerprint features, §8.2) must be computed strictly on bars *before* the touch bar; this sentence is the boundary. `episodeStart`/`episodeEnd` are ET dates (per §4 shape); `episodeEnd` is `null` for an episode still open at the study-window end (genuinely ongoing — never back-stamped).

### Amendment 5 — 5-min reconstruction, key env var, and the deferred-run sequence (A5, S4 §0.1)

`01-fetch-history.js` persists only per-session summaries in `sessions.json`, **not per-bar 5m**. The event runner reconstructs per-bar 5m from the raw cache (`data/raw/{sym}/5m/*.json`) via `normalizeFiveMin` — the same normalizer the fetcher used, so no math is duplicated (`03-detect-events.js:loadFiveMinByDate`). Key env var: `lib/eodhd-client.js:loadKey` reads `VITE_EODHD_API_KEY` from `process.env` or the repo-root `.env`, **falling back to `EODHD_API_KEY` in the repo-root `.env`** (lines 46, 55) — the founder's local `.env` uses `EODHD_API_KEY`, read via that fallback (unchanged this session). **Deferred checkpoint run (founder-local, data already cached):** `npm run levels` (re-stamp `familyAnchor`) → `npm run events` — no fetch step, no key needed.

### Amendment 6 — Fetcher default scope = the frozen universe (F4 close-out, A2)

The S3-flagged F4 gap is closed. `01-fetch-history.js` default scope is now the **frozen universe** (11 study equities + context symbols from `universe_frozen.json`), not the stale S2 14-symbol probe — PLTR/BE are included by default. Per S3-R4 (F4), **SPHB/SPLV are daily-grain only**: their 5m is never fetched, no `sessions.json` is written, and they are excluded from the two 5m test loops via the new `FIVE_MIN_PROBE = PROBE − dailyGrainOnly` helper (`tests/_helpers.js`; `tests/01-cross-grain.test.js:11`, `tests/04-auction-tag.test.js:8`). Daily-only tests (`tests/02`, `tests/05`) are unaffected — SPHB/SPLV retain daily data.

### Amendment 7 — Anomaly-scan sensitivity guards (config chores, diagnostics-only) — S4 §2

Two guards added to `02-build-levels.js:scanWarnings`, thresholds in `config.diagnostics.anomalyScan` (config stays v3 — these gate only `_stats.json`/console warnings, never a per-symbol artifact):
- **§2.1 MAD sensitivity floor** (`madMedianFloorFrac = 0.05`): a metric flags a MAD outlier only when `MAD ≥ 0.05 × |median|`. Quiets tight-distribution false alarms (the 2.45-vs-2.32-median role-flip rate with MAD 0.02); a genuine outlier (PG-like F2/F3 share) still clears the floor. Tested `tests/24`.
- **§2.2 cross-strata event floor** (`crossStrataMinEvents = 20`): cross-strata correlations are reported `insufficient` when total universe event count < 20 (the `atrPct_vs_splitRate +0.61` over 5 splits is a correlation over a near-all-zero vector — noise). `kSplit` is **untouched** (geometry, not this guard). Tested `tests/24`.

### Field derivations (S4 §3.6, §4)
- `eodSource` = `session.hasAuction ? 'auction' : 'fallback_1555'` (derived — the tag is config-specified but not materialized in `sessions.json`).
- `halfDay` = `session.earlyClose`.
- `corporateActionAdjacent` = event date within ±`CONFIG.adjustment.corporateActionAdjacentSessions` (2) session-ordinals of an adjFactor discontinuity in the daily series.
- `confirmationAt` / `entryAt` are **omitted entirely** (not null-stubbed) — Session 6 fields.

### Merge / retire attribution (S4 §3.4)
An episode in flight when its family is absorbed transfers to the survivor; the single event is re-attributed (`levelFamilyId = survivorId`) — no duplicate. If both survivor and absorbed hold open episodes at the merge, the survivor's continues and the absorbed's open episode is dropped (survivor wins, per the S3.5 s4Hooks operator). An episode in flight when its family retires closes with disposition `RETIRED_MIDEPISODE`. Both `GAP_BREAK` and `RETIRED_MIDEPISODE` are recorded but **excluded from the touch base-rate set**. Tested `tests/21`.

---

## §R — Recorded accepted consequences (no code change)

### R1 — Role-hysteresis suppresses a fast break-and-retest from the new side

During a family's 3-session role-hysteresis window (S3.5 Amendment 5), a fast break-and-retest from the *new* side is suppressed by the wrong-side approach rule, because the role has not yet confirmed the flip. This is the locked rules (role hysteresis + correct-side approach) composing correctly; it drops a real setup class. Recorded, not fixed — reviewable at the Session-7 manual pass, alongside the S35-C6 knob-graduation path.

---

## §D — The event-budget checkpoint & the data situation (S4 §7, §0.2)

The event-budget checkpoint (parent §13/§15; floor **n ≥ 30** per side per primary cell, `honesty.acceptance.minN`) is implemented as `03-detect-events.js:buildCheckpointReport` and computes **actual detected counts — never projections** (S4 §8): totals, in-sample-vs-holdout split (holdout counted, not analyzed), unique event-dates, top-5-symbol share, events/symbol/month, per-side all-tier + F2+ cells, and per-question P1–P6 verdicts against the floor (only the S4-knowable gating cell is scored; hourly-class / RVOL / extension / regime splits are Sessions 5–6 and flagged pending). P4's F3 cell is flagged as possibly structurally impossible (F3 share 0.5–1.1% of snapshots).

**This session could not compute the real checkpoint in its container:** no EODHD key, no network to `eodhd.com` (the environment network policy denies it — proxy `connect_rejected` 403), and no cached data; committed fixtures cover only ~1 scattered month of 5m and lack PLTR/BE. Per S4 §0.2 this is reported, not faked. The engine, the runner, and all 14 required tests (+ A3/A4 + the §2 guards) are built and green on synthetic fixtures; the real §6 run and §7 checkpoint are a founder-local follow-up (§A5 sequence). Do **not** weaken any independence rule to raise counts (S4 §8) — a thin budget is a finding for the universe-expansion decision, which is the founder's.

---

## §B — Session-4 choice register (⚠, greppable as `S4-C*`)

| # | Choice | Value | Where |
|---|---|---|---|
| S4-C1 | episode zone frame | family anchor ± 0.25·u (clamped distanceUnit, NOT raw ATR) | `lib/events.js:episodeZone`; `config.episode.zoneAtrMult` |
| S4-C2 | point-in-time anchor | `familyAnchor` stamp; `anchorAsOfD` reads strictly < D | `02-build-levels.js:stepOneDay`; `lib/events.js:anchorAsOfD` |
| S4-C3 | approach side | most recent regular 5m close strictly before the touch bar; opens-inside → prior session close | `lib/events.js` (approachPos) |
| S4-C4 | close condition | separation ≥ 1.0·u AND ≥ 1 full session fully outside; per-excursion max separation | `lib/events.js`; `config.episode` |
| S4-C5 | probe / rejection tally | probeCountInEpisode = distinct zone entries; rejected = Σ(probes−1) over emitted episodes | `lib/events.js` |
| S4-C6 | cross-level dedup | tier desc → nearest anchor (to bar close) → elder familyId; losers shadowed, episode still advances | `lib/events.js` (clusterByAnchor) |
| S4-C7 | eventId / sequenceIndex | `${levelFamilyId}_ep${seq2}`; seq 0-based = touchHistory length at open; re-attributed to survivor on merge | `lib/events.js:finalize` |
| S4-C8 | GAP_BREAK detection | first regular bar entirely beyond the far boundary + zero session intersections; family stays ARMED | `lib/events.js` |
| S4-C9 | anomaly-scan MAD floor | MAD ≥ 0.05·|median| (diagnostics-only, v3) | `config.diagnostics.anomalyScan`; `02-build-levels.js:scanWarnings` |
| S4-C10 | cross-strata event floor | correlations `insufficient` when total events < 20 (diagnostics-only, v3) | `config.diagnostics.anomalyScan`; `02-build-levels.js:scanWarnings` |

*Recorded 2026-07-12 — LevelStory Session 4.*
