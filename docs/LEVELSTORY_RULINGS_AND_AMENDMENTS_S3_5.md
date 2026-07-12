# LEVELSTORY — RULINGS & AMENDMENTS (SESSION 3.5 — LINEAGE REWORK)

**Status:** Spec amendments of record for Session 3.5 (the LS3-* rework). The adversarial review of Session 3 cleared every lookahead path and returned DO NOT SHIP on seven mechanical defects; this session's founder prompt rules the fixes. Recorded per the S3.5 prompt §10.
**Session:** LevelStory Session 3.5 — lineage rework on branch `claude/level-study-session3-levels-lineage-8v31gp`.
**Config:** `STUDY_CONFIG_VERSION = 3` — v2 was the unified-geometry rework; v3 is the founder-directed distanceUnit guard recalibration (amendment 7 / S35-C10). Version 1/2 are never reused; every v3 artifact stamps `configVersion: 3`.
**Precedence:** this document → `LEVELSTORY_RULINGS_AND_AMENDMENTS_S3.md` → `LEVELSTORY_RULINGS_AND_AMENDMENTS_S2.md` → Addendum → parent spec.

---

## §A — Spec amendments (founder-ruled, per the S3.5 prompt)

### Amendment 1 — Tradability (supersedes parent §5.3's universal `firstKnownDate + 1` formula)

> **`firstTradableDate` is the first registry session whose prior-close information set contains every input required to construct the dated level.**

Yields per source: fractal = session after the confirmation close; AVWAP = session after both fractal confirmation and observable ≥5% significance; daily pivot = the session it applies to; **weekly pivot = the first trading session of the new week** (a Monday-holiday week keys off its first actual trading day — tested). The universal `+1` formula is retired — it was the source of the S3-C7 contradiction. Config: `levels.availability.tradability`.

### Amendment 2 — Unified distance scale (supersedes ALL fixed-percent geometry in parent §5.1/§5.4) — LS3-01

```
u(symbol, D) = clamp( 0.25 × ATR(14, daily, D−1),  0.5% × price(D−1),  1.5% × price(D−1) )
```

Every geometric threshold is an ordered multiple of `u`: `kCluster 0.5 ≤ kConfluence 0.5 < kMerge 0.8 < kMatch 1.0 < kSplit 1.6` — asserted at config load (`config.js:validateGeometry`, throws on violation; `tests/19` proves each violation throws). Multiples are ⚠ provisional (S35-C2); the ordering is not negotiable.

**Value reasoning (v2 starting values):** `kMatch = 1` makes the unit ≈ the S3 match radius (0.25 ATR / 0.5% floor), now with the load-bearing cap (⚠ S35-C1: 0.25·ATR hits the cap at ATR = 6% of price — COIN's median is 6.5%). `kMerge = 0.8` preserves the S3 merge:match ratio (0.4%:0.5%), now scale-invariant. `kConfluence = kCluster = 0.5` bounds a snapshot's DIAMETER to half the match radius. `kSplit = 1.6` demands separation well beyond one match radius yet reachable (two matched snapshots can sit up to ~2·kMatch apart). Additional load-asserted invariant: **kConfluence < kMerge** — under live support (Amendment 6) merge evidence requires two DISTINCT snapshots (gap > kConfluence·u) with anchors within kMerge·u; `kMerge ≤ kConfluence` would make merges structurally unreachable.

**Bounded-diameter grouping (S35-C7/C8, dissolves LS3-08):** greedy centroid-chaining is replaced by deterministic left-greedy bounded-diameter grouping — over price-ascending items, a group absorbs the next item only while `price − firstMemberPrice ≤ k·u` (`lib/level-sources.js:boundedGroups`). A snapshot's span therefore never exceeds `kConfluence·u < kSplit·u`: **a single snapshot can never breach the split threshold — a theorem, not a rule.** The S3 "≥2 snapshots" split guard is deleted; a build-time assertion and `tests/19` (theorem test over a full TSLA fixture window) carry it.

**S35-C9:** all geometric comparisons are absolute price distances vs multiples of `u` (the S3-C9 midpoint-percent convention is retired with the fixed-percent scales).

### Amendment 3 — Warmup lineage replay (new; the parent spec was silent) — LS3-02

Lineage is **one continuous state machine** from the first session where the distance unit is defined (⚠ S35-C3: ATR(14) available at prior close — the structural trailing window fills as history accrues) through the warmup into the study window. Warmup sessions build state only and are never emitted. The study opens with a **checkpoint** (`02-build-levels.js:takeStudyStartCheckpoint`) carrying, per live family: true `bornDate`, EMA anchor, status, all counters, pending role state, and the full role log. Every family carries `preStudy` / `preStudyAgeSessions` — nothing is silently left-censored. Elder status now reflects real pre-study age (tested: `tests/18` constructs a case where S3 would have inverted eldership).

- ⚠ S35-C4: **matchHistory is cleared at the checkpoint** — warmup match history is state-building only; study artifacts may only reference study-window snapshots.
- Genealogy dates (`bornDate`, warmup-era `mergedDate`/`retiredDate`, role-log entries) legitimately predate `studyStart` — that is the point of the fix. The no-warmup rule binds **emitted registry sessions, statistics, and Session-4+ event detection**; `computeStats` aggregates study-window events only (asserted in `tests/18`).

### Amendment 4 — Merge effective timing + full state-transfer operator — LS3-03 / LS3-05

**A merge detected from D's information set applies to D:** the D registry's snapshot ownership is rewritten absorbed → survivor (`lib/lineage.js` merge phase) and same-day role EVENTS on the absorbed id are suppressed (the absorbed family's own roleLog is retained untouched — append-only, provenance under `mergedFrom`). Single `mergedDate` field. Regression-guarded in `assertRegistryInvariants` (ownership follows the merge-timing rule) and tested at both grains (`tests/17` merge-date ownership; `tests/13` scenario b).

Merge operator — every state field explicit (config `levels.lineage.merge.transfer`):

| Field | Rule |
|---|---|
| `touchHistory` | union, sorted by (timestamp, familyId, snapshotId) |
| `sequenceIndex` | ⚠ S35-C5: recomputed as merged touchHistory length — the only rule coherent under repeated merges (max undercounts the union; sum double-counts shared episodes) |
| `matchHistory` | union; absorbed entries tagged `fromFamilyId`; sorted (date, snapshotId) |
| `roleLog` | survivor-owned; absorbed log retained on the absorbed record, never rewritten |
| pending role state | survivor's only; absorbed's discarded (measured against a dead anchor) and cleared |
| EMA anchor | survivor's; absorbed anchor recorded on the merge event for audit |
| counters | fired pair-run reset; survivor's other runs persist unchanged |
| S4 hooks (`episode`/`rearm`/`cooldown`) | transfer absorbed → survivor where survivor is empty; survivor wins conflicts (absorbed value audited on the merge event) — the contract Session 4 inherits |

### Amendment 5 — Role state machine (new; parent §5.4 defined neither hysteresis nor the role frame) — LS3-04

Roles derive from the **family anchor** — the same frame Session 4's episode zones use, so roles and zones can never disagree on gap days. Zone = anchor ± `0.25·u`; flip evidence = a D−1 close beyond the OPPOSITE zone boundary by ≥ `0.25·u` (the zone half-width reused; no new constant); a flip requires **3 consecutive matched registry sessions** of evidence and is recorded on D only after the third confirming close occurred on D−1 — D's own close is never used (lookahead). Explicit pending state (`pendingSide`, `pendingRun`, `pendingStartDate`). Resets: close back inside the zone; close on the current-role side; **gray band** (outside the zone but short of the flip margin — the consecutive-evidence reading of "sustained"); no matching snapshot; split; retirement. On merge: survivor's pending only.

⚠ S35-C6 knob honesty: **3 sessions × 0.25u is a policy default, not a proven optimum.** Post-fix flip rates are reported in the rework report; the knob graduates only through the Session-7 manual-review demotion path.

### Amendment 7 — distanceUnit guard recalibration (config v3, founder-directed) — S35-C10

The v2 clamp band `floorPct 0.5%, capPct 1.5%` (inherited from parent §5.4) was measured to **bind pathologically**: over the 9 fixture equities' study window the floor bound 49–96% of the low-volatility names' sessions (KO 96%, JNJ 92%, PG 88%, MSFT 62%, AAPL 49%) and the cap bound 64% of COIN's — so for those names the GUARD, not ATR, set the distance scale, re-introducing the volatility-confound the unified scale exists to remove (S3.5-b rework report §9).

**Founder ruling:** set `floorPct` / `capPct` from the measured per-session `0.25×ATR%` distribution so **each guard binds in ≤10% of symbol-sessions for every symbol** — i.e. `floorPct ≤ min_s p10(0.25×ATR%)` and `capPct ≥ max_s p90`, keeping each guard live only at its tail. Measured across the 9 fixture equities (all three volatility strata), study + full history: `min_s p10 ≈ 0.27` (KO), `max_s p90 ≈ 2.66` (COIN, full history). Chosen with margin:

```
floorPct = 0.26   (worst floor-bind 6.1%, KO / full history)
capPct   = 2.7    (worst cap-bind   9.0%, COIN / full history)
```

Both ≤10% for every symbol in both windows. `atrMultiple` (0.25) and the `multiples` block are unchanged. Config `STUDY_CONFIG_VERSION` → **3** (post-build knob change; version 1/2 never reused; the S3.5 report's v2 gate numbers remain valid for the [0.5, 1.5] band).

**Full-universe finalization (stays on v3 — completes, not supersedes, the calibration; nothing consumes v3, artifacts rebuilt).** The criterion is codified as `research/level-study/tools/measure-clamp-binding.js` (reads `data/normalized`, applies the ≤10% rule, prints per-symbol binding + recommended floor/cap). Status: **`floorPct = 0.26` is FINAL** — set by the lowest-vol name (KO, `min_s p10 = 0.270`); PLTR/BE are high-vol and cannot lower it. **`capPct = 2.7` is PENDING** — set by the highest-vol name's p90; the founder reports BE mean ATR% 6.94 > COIN 6.50, so BE likely pushes `max_s p90` above 2.66 and `capPct` above 2.7. The two-symbol measurement (PLTR/BE) is a founder-local step (the S3.5-b container had no PLTR/BE data and no network); running the tool prints the finalized `capPct`, updated as a single literal with the version staying 3.

Effect (9-equity fixture gate, v2→v3): the F2/F3-share confound dissolves — ATR%↔F3-share −0.67 → **−0.15**, levels/day↔F3-share −0.76 → **−0.19**, ATR%↔merges +0.59 → **−0.07**. Split scarcity is unchanged (that is the separate, still-open `kSplit` magnitude question — not touched here).

### Amendment 6 — Live support for run accumulation (structural dissolution of LS3-09)

A merge or split run only advances on a session where the family receives a matching snapshot. Consequences, all by construction:

- A family with `zeroSupportRun = 19` **cannot** complete a merge run — the retire-vs-merge conflict is impossible (`tests/17` compound case).
- Split and merge cannot co-fire on one family-session (split evidence needs both member snapshots matched to the family; a would-be merge partner within kMerge·u would out-compete the family for one of them under nearest-anchor matching) — empirically asserted plus the sequential compound tested (`tests/17`).
- **Residual precedence table** (implementation order == causal order, per session): match → split detection/execution → role machine + anchor updates → retirement of unsupported families → merge detection/execution (with same-session ownership rewrite). The only same-session compound that can occur is a split followed by an unrelated merge of OTHER families; events record in causal order.
- Documented consequence: a converging pair that collapses **fast** (level gap drops below kConfluence·u in fewer than 5 sessions) produces one starving family that retires rather than merges; slow convergences pass through the (kConfluence, kMerge]·u window and merge. This is the intended geometry — merges are for structures that demonstrably co-exist while distinct.

---

## §B — Session-3.5 choice register (⚠, greppable in config as `S35-C*`)

| # | Choice | Value | Where |
|---|---|---|---|
| S35-C1 | distanceUnit cap (v2) | ~~1.5% of price~~ **superseded by S35-C10** | `config.js` geometry.distanceUnit |
| S35-C2 | threshold multiples (v2 starting values) | 0.5 / 0.5 / 0.8 / 1.0 / 1.6 | `config.js` geometry.multiples |
| S35-C10 | distanceUnit floorPct / capPct (v3) | 0.26% / 2.7% (each guard binds ≤10% of symbol-sessions ∀s; measured) | `config.js` geometry.distanceUnit (amendment 7) |
| S35-C3 | warmup replay start rule | first session with ATR(14) at prior close | `config.js` lineage.warmupReplay |
| S35-C4 | matchHistory cleared at checkpoint | true | `config.js` lineage.warmupReplay |
| S35-C5 | sequenceIndex merge rule | recompute from merged touchHistory | `config.js` lineage.merge.transfer |
| S35-C6 | role machine knobs provisional | 3 sessions × 0.25u | `config.js` lineage.roleMachine |
| S35-C7/C8 | bounded-diameter grouping (cluster/confluence) | left-greedy span ≤ k·u | `lib/level-sources.js:boundedGroups` |
| S35-C9 | distance measure | absolute price distance vs k·u | replaces S3-C9 |

Retired S3 choices: S3-C4/C5 (centroid-chaining), S3-C7 flag (dissolved by Amendment 1), S3-C9 (midpoint %), S3-C12 (snapshot-side roles), S3-C14 (split guard — now a theorem), S3-C15 (superseded by the Amendment-4 operator table).

*Recorded 2026-07-12 — LevelStory Session 3.5.*
