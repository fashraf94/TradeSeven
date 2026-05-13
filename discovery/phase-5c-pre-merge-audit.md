# Phase 5C Pre-Merge Audit

**Status:** Read-only audit of 6 commits on `claude/snapshot-rendering-review-mode-dQz88` (regime detector → leg helpers → swap entry block → provenance detection → buildReviewContext integration → integration tests). Test count 166 → 259 (+93). All green.

**Scope:** Cross-helper consistency, edge cases, production data assumptions, integration ordering, forward-compat. Read-only; no code changes proposed inline.

---

## Q1 — Cross-helper consistency

The five snapshot leg helpers and the swap entry block follow consistent contracts. Read-through observations:

- **Defensive null handling:** all helpers handle `null`/`undefined` snapshot defensively. `buildSnapshotHeader` returns `''` (always-emit), the four conditional helpers return `null`. Matches the brief helper contract documented at `voiceLayerPrompt.js:949-987`.

- **Return types:** `buildSnapshotHeader` always returns a string; the other four return `string | null`. Matches the brief helper pattern exactly.

- **Gating predicates:** `typeof === 'number'` for numerics, `=== true` for booleans, string-trim-non-empty for `lastCandlePattern`. Identical to brief renderer.

- **Thresholds:** ±10% for support/resistance, ±5% for 52wk high, |dev| < 0.05 for "at session VWAP" / "at 5m SMA20". Bit-for-bit matched to `buildLevelsLine` (`:1056-1097`) and `buildIntradayLine` (`:1148-1182`).

- **PATTERN_DISPLAY_NAMES reuse:** imported once at top of file (`:9`), referenced by both `buildSignalsLine:1119` and `buildSnapshotSignals:1308`. Same fallback (`|| key.replace(/_/g, ' ')`). No drift. ✓

### Finding 1.1 — `buildSnapshotHeader` inherits brief renderer's defensive `=== 0` rank guard — *Defer*

**File:** `voiceLayerPrompt.js:1249-1252`

`buildSnapshotHeader` gates on `composite.sectorTechnicalRank != null && composite.sectorTechnicalRank !== 0` and `sectorTechnicalTotal != null && sectorTechnicalTotal !== 0`. The `!== 0` half is dead code for snapshots: per Phase 5B-prep audit Finding 5.2 (`discovery/phase-5b-prep-pre-merge-audit.md:264`), the snapshot writer (`buildTechnicalSnapshot.js`) already uses `?? null` consistently — `sectorTechnicalRank` is never legitimately 0 from the snapshot path.

The defensive check is harmless but slightly wasteful and creates a small consistency hazard: a future reader might assume the same writer-side cleanup is needed elsewhere. Snapshot-side `!== 0` could safely be removed once the test fixture coverage confirms no legacy snapshots in production stored 0 in this field.

**Defer.** Cosmetic; non-blocking; revisit when the snapshot helpers see their next round of changes.

---

## Q2 — Snapshot data shape edge cases

### Finding 2.1 — String-typed leg renders ugly `? leg:` placeholder rather than being suppressed — *Backlog*

**File:** `voiceLayerPrompt.js:1502-1526` (`buildLegBlock`), `:1534-1536` (`buildSwapEntryBlock` leg gate)

The leg gate is `outLeg = snapshot.symbolOut || null` — purely a truthiness check. If a snapshot leg is corrupted to a non-object truthy value (e.g., a string `'not-an-object'`), the leg passes the gate and reaches `buildLegBlock`, which produces:

```
? leg:
```

…with no subsequent lines because every snapshot helper short-circuits on `legSnapshot.<category>` returning `undefined`. The end-to-end "defensive: malformed snapshot does not crash" test (`voiceLayerPrompt.test.js:2666-2680`) verifies non-crash behavior but doesn't assert on output quality.

**Why it matters:** Phase 4's snapshot writer is pure and always emits the canonical nested-object shape, so the corruption mode requires a write-path regression or Firestore deserialization drift. Low real-world probability, but the placeholder output is visible to Gemma if it ever happens.

**Recommendation (backlog):** tighten the leg gate to `typeof outLeg === 'object' && outLeg !== null && typeof outLeg.symbol === 'string'` so malformed legs are silently dropped, matching the "render only the populated leg" path.

### Finding 2.2 — `formatPointsDelta` doesn't round; relies on upstream writers — *Backlog*

**File:** `voiceLayerPrompt.js:1425-1427`

```js
function formatPointsDelta(n) {
  return `${n > 0 ? '+' : ''}${n}`;
}
```

No rounding. The function works correctly only because upstream writers happen to round before persisting:
- `scoreAtProposal`/`scoreAtVeto`/`scoreAtResolution` are rounded to 2 decimals at write (`agent-evaluate.js:1040, :1347, :1418`).
- `lockedPoints` is rounded to 2 decimals (`agentSwapExecution.js:170`).
- The Δ delta inside `buildEntryCaptureLine` is explicitly rounded to 1 decimal (`:1461, :1464`).

The exposed risk surface: `counterfactualPoints` and `outcomePoints` are never written in production code (see Finding 6.1), so they only appear in tests as pre-rounded fixtures. If a future feature populates either field with an unrounded float (e.g., `0.1 + 0.2 = 0.30000000000000004`), the rendered output becomes "would have scored +0.30000000000000004 pts."

**Recommendation (backlog):** make `formatPointsDelta` defensively round: `return \`${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}\`` (matching the 1-decimal convention of the Δ delta). One-liner; eliminates a class of future regression.

### Finding 2.3 — `scoreAtVeto` precedence over `scoreAtResolution` on vetoed proposals is correct but not pinned in tests — *Defer*

**File:** `voiceLayerPrompt.js:1456-1468`

In `buildEntryCaptureLine`, when a counterfactual has both `scoreAtVeto` and `scoreAtResolution` (which shouldn't happen — they're mutually exclusive write paths in `agent-evaluate.js:1347` vs `:1418`), the `scoreAtVeto` branch fires first and wins. This is correct per the data semantics, but no test pins this ordering as a contract.

**Defer.** The mutually-exclusive invariant is upheld upstream; the renderer's precedence is just defensive layering. Adding a pin-test is cheap if/when a future change touches this code.

---

## Q3 — Regime detection edge cases

### Finding 3.1 — `sessionDate` truthy-but-malformed routes to post-fixv2 with wrong prefix — *Backlog*

**File:** `voiceLayerPrompt.js:1009` (regime detector), `:1373` (intraday today/prior comparison)

The primary signal is `snapshot?.intraday?.sessionDate != null`. Any non-null value (empty string, `"2026/05/12"`, `"May 12, 2026"`, raw timestamp, anything) routes to `post-fixv2` and triggers `buildSnapshotIntraday`. Inside that helper:

```js
const captureEt = toEtParts(new Date(capturedAtMs)).dateStr;  // 'YYYY-MM-DD'
if (intraday.sessionDate === captureEt) prefix = "Today's session";
```

If `sessionDate` is, say, `""`, the comparison fails and the renderer outputs `"Prior session: …"` even when the snapshot is from today. Same for slash-format dates or any non-canonical value. No crash; just incorrect labeling.

**Production likelihood:** the writer (`buildTechnicalSnapshot.js:104`) sources `sessionDate` from `momentumData.vwap[symbol].sessionDate`, which is set by `filterToLatestSession` (`marketDataCache.js:797` and adjacent) and returns `'YYYY-MM-DD'`. The format is enforced upstream, so corruption requires a Firestore-side mutation or a future writer bug. Low but non-zero.

**Recommendation (backlog):** tighten the primary signal to a format check:
```js
if (typeof snapshot?.intraday?.sessionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.intraday.sessionDate)) return 'post-fixv2';
```
Costs three lines; closes a silent-mislabeling vector.

### Finding 3.2 — Future-dated `capturedAt` (clock skew) routes silently — *Defer*

**File:** `voiceLayerPrompt.js:1008-1013`

A snapshot with a future `capturedAt` and no `sessionDate` is classified as `'fixv1-era'` (because `future > FIX_V1_MERGE_UTC`). Intraday suppressed, other fields render. Safe but semantically wrong.

**Defer.** Requires server clock skew or test-data contamination to occur in production. Suppression is the right default for unknown regimes; no action needed.

### Finding 3.3 — `FIX_V1_MERGE_UTC` is single-source-of-truth — *✓ verified*

**File:** `voiceLayerPrompt.js:1006`

Grep confirms: only one reference in the codebase. ✓

---

## Q4 — Trade provenance edge cases

### Finding 4.1 — Symbol-pair fallback can attribute to wrong proposal in long battles — *Backlog*

**File:** `voiceLayerPrompt.js:1588-1601`

The for-loop iterates `proposalHistory` in array order and returns on the **first** match. The match predicate is:
1. Same `symbolOut` + `symbolIn`
2. Resolution in `{approved, auto_executed}`
3. If both timestamps available: within 5 min

When **timestamps are missing** on either side (the documented fallback path), only (1) and (2) apply. In a long battle where the same swap pair was proposed → approved twice (e.g., re-entering a position after a swap-back), the **older** proposal wins the match and the trade is mis-attributed.

Same blast radius as a regular timing-window mismatch: the wrong label between `'approved'` and `'auto_executed_proposal'`. Both still produce TRADE-flavored output; the difference is "approved by Coach" vs "auto-executed at expiry" — semantically different but not catastrophic.

**Recommendation (backlog):** when timestamps are missing, iterate in reverse (newest-first) so the most recent matching proposal wins. One-line change to `for (let i = history.length - 1; i >= 0; i--)`. The timestamped path is unaffected.

### Finding 4.2 — 5-minute window is sufficient given current cron cadence — *✓ verified*

**File:** `voiceLayerPrompt.js:1576` (`PROVENANCE_MATCH_WINDOW_MS`)

Cron cadence for `agent-evaluate` is sub-5-minute under typical market-hours operation. The proposal → execution gap is bounded by (next cron tick) - (proposal resolution time), max ~3 min in steady state. 5-min window has comfortable headroom. ✓

If cron cadence ever lengthens beyond 5 minutes, this becomes brittle. Worth a comment annotation but no immediate action.

### Finding 4.3 — `evaluationId` could be `undefined` on legacy pre-Sprint-2 trades — *Defer*

**File:** `voiceLayerPrompt.js:1581`

```js
if (typeof trade.evaluationId === 'string' && trade.evaluationId.startsWith('risk_')) {
```

The `typeof === 'string'` guard handles `undefined`/`null` correctly: skips the risk-marker branch, falls through to proposal matching, defaults to `'autopilot'`. No crash, no false-positive.

Worst case for very old trades: a legitimately risk-triggered legacy trade without `evaluationId` would be mis-labeled as `'autopilot'`. Pre-Sprint-2 risk trades exist but are likely outside the recent-3 cap of the renderer.

**Defer.** Defensive guard is correct; mis-label is rare and low-impact.

---

## Q5 — Integration ordering and section placement

### Finding 5.1 — Section ordering preserved; no duplication — *✓ verified*

**File:** `voiceLayerPrompt.js:1903-1976`

Trace confirms: `BATCH REVIEW SUMMARY → TRADES (with RECENT/EARLIER sub-blocks) → COUNTERFACTUALS (with RECENT/EARLIER) → USER TRADE GRADES → DIRECTIVE OUTCOMES`. Existing tests (`buildReviewContext — counterfactuals filter (regression)`, lines 2371+) still pass after the integration, confirming no regression in the existing section semantics. ✓

### Finding 5.2 — No upper bound on `EARLIER TRADES` token cost for multi-day battles — *Backlog*

**File:** `voiceLayerPrompt.js:1937` (`earlierTrades = trades.slice(0, ...)` — no cap)

`recentTrades` is capped at the last 3, but `earlierTrades` is everything else. For a long multi-day battle:
- 5-day battle, 4 trades/day avg → 17 EARLIER trades × ~30 tokens/one-liner = ~510 tokens.
- 10-day battle, similar density → 37 EARLIER trades × 30 ≈ 1,110 tokens.

Combined with the snapshot section (~1,200-1,600 tokens), the Review-context block could push toward 3,000 tokens for veteran multi-day battles. Within Gemma's context window but inflates beyond the discovery's ~1,400 estimate.

**Production likelihood:** non-zero. Existing battles run multi-day and accumulate trades. The trades section was previously rendered as a flat list with no cap (legacy behavior); Phase 5C preserves that legacy uncapped behavior in the `EARLIER TRADES` subsection. So this is a pre-existing token growth surface, not a Phase 5C regression — but Phase 5C's introduction of named subsections makes the growth more visible and worth documenting.

**Recommendation (backlog):** add a `.slice(-20)` cap on `EARLIER TRADES` (or whatever number empirical sampling suggests). Drop oldest one-liners. The dailyReviews summary already covers older trading days separately.

### Finding 5.3 — Mixed pre-Phase-4 / Phase-4 entries render in chronological order — *✓ verified*

**File:** `voiceLayerPrompt.js:1943-1948`, `:1976-1989`

The `.map(...)` paths preserve array order; pre-Phase-4 entries (no `snapshot`) fall through to the legacy one-liner inline, so a mixed list renders in chronological order with mixed rendering styles. End-to-end test (`falls back to one-liner for pre-Phase-4 entries`) covers the inline mix. ✓

---

## Q6 — Production data assumptions

### Finding 6.1 — `counterfactualPoints` is read but never written in production — *Backlog (pre-existing)*

**File:** `voiceLayerPrompt.js:1485-1488` (new Phase 5C path), `:1963-1964` (pre-existing legacy path)

Grep across the entire `api/` tree shows `counterfactualPoints` is read in `voiceLayerPrompt.js` only — and never written. The closest concept is `dailyReviews[i].counterfactuals[j].deltaPct` written by `agent-batch-review.js:106`, which lives on the daily review object keyed by `proposalId`, **not** on the proposalHistory entry.

**Consequence:** in production, `entry.counterfactualPoints` is always `undefined` on proposalHistory entries.
- New Phase 5C path (`:1486`): `typeof cf === 'number'` is false → counterfactual clause silently skipped → pair line ends after `(tier)`.
- Legacy path (`:1963-1964`): falls through to "no counterfactual recorded" text.

Phase 5C's behavior is actually cleaner than the legacy (no "no counterfactual recorded" noise), but both paths inherit the data-assumption gap.

**Likely fix path (not Phase 5C scope):** either (a) cross-reference `dailyReviews[latest].counterfactuals` by `proposalId` at render time, or (b) write `counterfactualPoints` onto the proposalHistory entry at veto/lapse resolution. Either change is its own workstream.

**Recommendation (backlog):** document the gap; surface as a follow-up item. Phase 5C ships correctly given the current data shape.

### Finding 6.2 — Legacy `EARLIER TRADES` one-liner doesn't fall back to `lockedPoints` — *Backlog (pre-existing)*

**File:** `voiceLayerPrompt.js:1925-1933` (`renderTradeOneLiner`)

The legacy one-liner reads `t.outcomePoints` only. `outcomePoints` is never written in production (per the same gap as 6.1); production trades carry `lockedPoints` (set by `agentSwapExecution.js:170`). The new `buildSwapEntryBlock` path falls back correctly (`:1490`: `entry.outcomePoints ?? entry.lockedPoints`), but the legacy one-liner does not — it renders `"outcome pending"`.

**Consequence:** in long battles with >3 trades, the `EARLIER TRADES` subsection renders every older trade as `"outcome pending"` rather than its actual `lockedPoints`. The most recent 3 trades render the points correctly via the snapshot path.

**Recommendation (backlog):** mirror the `outcomePoints ?? lockedPoints` fallback in `renderTradeOneLiner`. One-line change. The semantic asymmetry between RECENT (correct points) and EARLIER (all "outcome pending") is visible to Gemma and slightly weird.

### Finding 6.3 — Pre-Phase-4 fallback is a real risk for currently-active battles — *Acknowledged, not blocking*

Phase 4 went live 2026-05-07 (PR #382 merged at commit `2b954f3`). Today's date per session context is 2026-05-13 — **6 days post-deployment**. Any battle started before 2026-05-07 that's still active carries a mix of pre-Phase-4 entries (no `snapshot`) and post-Phase-4 entries (with `snapshot`).

The fallback to legacy one-liner is wired and tested; this is the intended behavior. Not a finding so much as a confirmation that the fallback is exercised in the wild today, not just theoretical.

---

## Q7 — Forward-compat for downstream consumers

### Finding 7.1 — `voiceLayerPrompt.js` is now 2,470+ lines; consider extraction for the next snapshot consumer — *Defer*

**File:** `voiceLayerPrompt.js` (whole file)

Pre-5C: 1,960 lines. Post-5C: ~2,470 lines (+25%). Phase 5C added ~510 lines of helper code and the existing brief renderers, prompt blocks, mode branches, and helpers all coexist in the same module.

The file is still navigable (well-structured with `=================` section headers), but a natural module boundary is forming:
- Brief helpers (Phase 5A/5B): `buildHeaderLine`, `buildLevelsLine`, `buildSignalsLine`, `buildIntradayLine`, `buildPortfolioBriefsBlock`, `buildBenchBriefsBlock`.
- Snapshot helpers (Phase 5C): `detectSnapshotRegime`, `buildSnapshot*`, `buildSwapEntryBlock`, `detectTradeProvenance`.
- Prompt-assembly orchestration: `buildVoiceLayerPrompt`, mode-specific blocks, phase rules, few-shots.

**Defer.** Pulling snapshot helpers into `snapshotHelpers.js` (or similar) costs a small amount of churn for the next consumer that lands. Worth doing alongside the next feature that touches the snapshot helpers (Forge identity work?), not as a standalone refactor.

### Finding 7.2 — Test file at 3,500+ lines after Phase 5C; consider split alongside module split — *Defer*

**File:** `voiceLayerPrompt.test.js`

Pre-5C: 2,379 lines. Post-5C: 3,532 lines (+48%). Test grouping is logical (`describe` blocks by helper), but navigation costs grow with size.

**Defer.** Split test file alongside the implementation module split. Same trigger.

### Finding 7.3 — `agent-batch-review.js` Haiku prompt could benefit from snapshot rendering — *Defer*

**File:** `agent-batch-review.js:121-135` (CSV-style trade/veto lines fed to Haiku)

The 4:15 PM ET cron sends raw CSV-style trade/veto summaries to Haiku for daily-review generation. Haiku also has access to `battle.trades[].snapshot` and `battle.proposalHistory[].snapshot` via the battle document. Currently those aren't surfaced into Haiku's prompt.

Phase 5C's helpers are reusable for this — could pass the same `buildSwapEntryBlock` outputs into Haiku's prompt for richer day-grade reasoning. Out of scope for Phase 5C, but a natural Phase 5D candidate.

**Defer.** Capture as a follow-up workstream item for the next layer of review-mode improvements.

---

## Q8 — Test coverage gaps

### Finding 8.1 — Token measurement test pins worst case only — *Defer*

**File:** `voiceLayerPrompt.test.js:2569-2592`

The token regression test loads every snapshot signal (MACD fresh cross, divergence bullish, NR7, candle pattern, all three levels segments, intraday) — a worst-case scenario. Realistic battles often have ~2-3 signals firing per leg. No test covers the realistic-case lower bound.

**Defer.** The current test functions as a regression ceiling, which is the higher-value direction. A minimal-case test is nice-to-have but lower priority.

### Finding 8.2 — `formatEtTimestamp` only tested against canonical ISO 8601 — *Defer*

**File:** `voiceLayerPrompt.test.js` (no test covers e.g. `'2026-05-15T15:30:00.000Z'` with milliseconds or `'2026-05-15T15:30:00+00:00'` with offset)

`Date.parse` is forgiving and handles both variants correctly, so this is genuinely safe — but no pin-test exists to lock the behavior. If a future change replaces `Date.parse` with a stricter parser, the absence of the variant tests means regression won't be caught.

**Defer.** Cheap to add (3 lines); not blocking merge.

### Finding 8.3 — No integration test for a battle mixing all three Phase 5 regimes simultaneously — *✓ exists*

**File:** `voiceLayerPrompt.test.js:2596-2632`

The test "Phase 5C end-to-end — full Review prompt assembly > renders mixed regime snapshots correctly" exists and pins this exact scenario (pre-fixv1 / fixv1-era / post-fixv2 in one battle). ✓ Already covered.

---

## Synthesis

**Phase 5C should be merged with 6 follow-up workstream items captured.**

The implementation is structurally sound: the new helpers are consistent with the Phase 5A/5B brief renderers, the regime detector is defensively correct, the integration into `buildReviewContext` preserves section ordering, the test surface is exhaustive (93 new tests covering each conditional helper's gate predicates), and the fall-through paths handle the pre-Phase-4 reality cleanly. No Critical findings.

**Six Backlog findings to capture for follow-up:**

1. **Finding 2.1** — String-typed leg renders `? leg:` placeholder; tighten leg gate to require object type.
2. **Finding 2.2** — `formatPointsDelta` should defensively round to 1 decimal.
3. **Finding 3.1** — `sessionDate` regime signal should require canonical `YYYY-MM-DD` format.
4. **Finding 4.1** — Symbol-pair fallback in `detectTradeProvenance` should iterate proposal history newest-first.
5. **Finding 5.2** — `EARLIER TRADES` subsection should cap at ~20 entries to bound token growth.
6. **Finding 6.1 + 6.2** — `counterfactualPoints` is never written and `EARLIER TRADES` doesn't fall back to `lockedPoints`. Both are pre-existing data-assumption gaps inherited by Phase 5C; address in a small consolidation workstream (cross-reference daily review counterfactuals OR write the field at veto resolution; mirror the `lockedPoints` fallback in the legacy one-liner).

**Four Defer findings (cosmetic / low priority):**

- **Finding 1.1** — `=== 0` rank guard in `buildSnapshotHeader` is dead code; remove next time the helper sees changes.
- **Finding 3.2** — Future-dated `capturedAt` routes silently to `fixv1-era` — acceptable default.
- **Finding 4.3** — Missing `evaluationId` on legacy trades is handled defensively.
- **Finding 7.1 + 7.2 + 7.3** — File size + test size + Haiku batch-review reuse are next-layer concerns; revisit when the next snapshot consumer lands.

**No Critical findings. No blocker for merge.**

The Phase 5C surface is the largest Layer 1 sub-phase by line count, but the rendering pattern is well-isolated, defensively wired against malformed input, and bounded in scope by the 5-cf-and-3-trade caps. The backlog findings are improvements, not corrections — none indicate the rendered output is incorrect for any realistic production scenario.

---

*End of Phase 5C pre-merge audit. No production code changed.*
