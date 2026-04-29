# Consensus Layer V2 Deployment Audit — Findings

**Date:** 2026-04-29
**Branch:** `claude/audit-consensus-layer-v2-J1SOV`
**Spec:** `FANTASYTIMES_NEWSROOM_CONSENSUS_LAYER_SPEC_V2.md`
**Auditor:** Claude Code (read-only static audit + targeted file verification)

---

## Status Summary

- **Overall deployment status:** PARTIALLY DEPLOYED
- **Reporters affected by gaps:** Alex (macro-alert path) and Kim (sector column publish path)
- **Most critical reader (Kai):** fully wired, no action required

The consensus utility itself (`api/_utils/fantasyTimesConsensus.js`) is complete and spec-compliant. Most writer endpoints are wired correctly. Two specific gaps remain: `generate-macro.js` never records macro-triggered catalysts to consensus, and `generate-column.js` (Kim) is missing the publish interceptor that Kai already has. One Firestore rule on `fantasyTimesSuppressions` is mis-permissioned (public read instead of server-only).

---

## Phase 1 (Infrastructure) — PASS

### `api/_utils/fantasyTimesConsensus.js` — PASS

All six required exports are present and match the V2 spec:

| Function | Lines | Spec compliance |
|---|---|---|
| `seedConsensus(date)` | 22-130 | Initializes `catalysts: {}` (Map, not Array) at line 123, `sectors: {}` at line 124. Pulls today's earnings AND yesterday's after-close earnings (lines 27-29). Uses `set({merge: true})` at line 127. PASS. |
| `appendCatalyst(date, ticker, data)` | 136-153 | Uses `set({merge: true})` Map upsert pattern at lines 139-147 with `[ticker]:` key. NOT legacy `arrayUnion`. PASS. |
| `appendEconomics(date, eventData)` | 159-181 | Uses `arrayUnion` at line 163. PASS. |
| `appendEarningsResult(date, ticker, resultData)` | 187-206 | Merges into earnings results via `set({merge: true})` at lines 190-200. PASS. |
| `buildConsensusBlock(date, period)` | 243-368 | Time-aware weighting via `rankCatalysts` (212-241). Period-aware formatting (pre_market, midday, post_close) at 311-359. Caps at top 10 catalysts at line 240. PASS. |
| `checkEarningsAttribution(storyBody, earningsValidList)` | 374-428 | Regex at line 379: `/\b(earnings\|EPS\|Q[1-4]\s+(results\|report\|beat\|miss)\|guidance\|revenue\s+(beat\|miss))\b/gi`. 100-char ticker context window at 391-410. Cross-references valid set at 413-414. PASS. |

### `api/_utils/fantasyTimesPrompts.js` — PASS

`FACT_CHECK_RULES` defined at lines 86-96 with three explicit guards:
1. **EARNINGS ATTRIBUTION RULE** (line 91) — never attribute moves to earnings unless ticker is in `EARNINGS_VALID`
2. **CATALYST CONSISTENCY RULE** (line 93) — covers both alignment with confirmed catalysts AND the unknown-catalyst hedging case ("if no confirmed catalyst, use hedging language")
3. **SECTOR ACCURACY RULE** (line 95) — use sector ETF data, do not generalize from one stock

Combined with the existing `ANTI_SLOP_RULES` (lines 59-84), this satisfies the 5-guard spec. The "unknown catalyst handling" guard the spec calls out is folded into rule 2's hedging language clause.

### `src/prompts/fantasyTimesPrompts.js` — DRIFT (out of scope)

Client mirror of prompt constants exists. Constants (REPORTER_PROFILES, ANTI_SLOP_RULES, FACT_CHECK_RULES, KAI_SYSTEM_PROMPT) match the server file. **Drift detected in `ALEX_SYSTEM_PROMPT` and `ALEX_MACRO_SYSTEM_PROMPT`**: the server version has explicit guidance to prefer specific company catalysts over generic macro narratives; the client version is more restrictive and lacks this guidance. Out of scope per the audit's hard constraints (reporter prompt voices). Flagged for a separate session.

---

## Phase 2 (Writers) — PARTIAL

| Endpoint | File | Required Calls | Status |
|---|---|---|---|
| Alex (Mover) | `api/fantasytimes/generate-mover.js` | `appendCatalyst` (write), consensus read for continuity, `checkEarningsAttribution` interceptor, FACT_CHECK_RULES injected | **PASS** |
| Alex (Macro) | `api/fantasytimes/generate-macro.js` | `appendCatalyst` for each triggered ticker, `checkEarningsAttribution`, FACT_CHECK_RULES injected | **FAIL — `appendCatalyst` not imported, never called** |
| Scan Movers | `api/fantasytimes/scan-movers.js` | `appendCatalyst` with `confidence: 'low'` before Alex's full story | **PASS** |
| Neta (Econ) | `api/fantasytimes/generate-econ.js` | `appendEconomics` after publish, FACT_CHECK_RULES | **PASS** |
| Doug (Recap) | `api/fantasytimes/generate-recap.js` | `appendEarningsResult` after publish, FACT_CHECK_RULES | **PASS** |
| Pre-market warmup | `api/cron/pre-market-warmup.js` | `seedConsensus(today)` | **PASS** |

### Detailed findings — `generate-mover.js` (PASS)

- Line 17: imports `appendCatalyst` and `checkEarningsAttribution`.
- Lines 148-160: reads existing catalyst for continuity (NEWSROOM CONTEXT injected at line 201).
- Lines 240-270: publish interceptor; suppression on violation.
- Lines 326-339: `appendCatalyst` with dynamic confidence based on `atrMultiple`, wrapped in try/catch.
- `[CONSENSUS]` logs at lines 251, 269.
- FACT_CHECK_RULES injected via `ALEX_SYSTEM_PROMPT` (string interpolation in prompts file).

### Detailed findings — `generate-macro.js` (FAIL)

- Line 15: imports `checkEarningsAttribution` only — **`appendCatalyst` is missing from the import**.
- Lines 131-165: earnings-attribution interceptor present and wired correctly (`[CONSENSUS] BLOCKED Alex macro` log at line 142).
- Line 209: story published via `db.collection('fantasyTimesStories').add(storyDoc)`.
- Lines 211-225: handler logs the publish and returns response — **no consensus write** for any of the macro-triggered tickers.
- **Impact:** when 5+ tickers fire a macro alert, none of them get an `alex_macro` entry in `fantasyTimesConsensus/{date}.catalysts`. Subsequent individual mover stories will have no shared attribution to align with, and Kai's pulse won't see the macro narrative reflected in consensus.

### Detailed findings — `scan-movers.js` (PASS)

- Line 12: imports `appendCatalyst`.
- Lines 98-111: appends with `confidence: 'low'`, `source: 'scan_movers'`, `reporter: 'system'` BEFORE Alex's full story (line 134).

### Detailed findings — `generate-econ.js` (PASS)

- Line 19: imports `appendEconomics`.
- Lines 340-351: appends after Firestore publish at line 336.
- `NETA_RECAP_SYSTEM_PROMPT` includes FACT_CHECK_RULES via interpolation.

### Detailed findings — `generate-recap.js` (PASS)

- Line 18: imports `appendEarningsResult`.
- Lines 314-325: appends after Firestore publish at line 306.
- `DOUG_RECAP_SYSTEM_PROMPT` includes FACT_CHECK_RULES via interpolation.

### Detailed findings — `pre-market-warmup.js` (PASS)

- Line 16: imports `seedConsensus`.
- Lines 246-252: calls `seedConsensus(todayStr)` with ET-formatted date.

---

## Phase 3 (Readers + Interceptor) — PARTIAL

| Endpoint | File | Status |
|---|---|---|
| Kai (Pulse) | `api/fantasytimes/generate-pulse.js` | **PASS** — all six checks |
| Kim (Column) | `api/fantasytimes/generate-column.js` | **PARTIAL** — missing `checkEarningsAttribution` and suppression path |

### Detailed findings — `generate-pulse.js` (PASS)

| Check | Result |
|---|---|
| Imports `buildConsensusBlock` and `checkEarningsAttribution` | line 20 |
| `buildConsensusBlock` called before Anthropic | lines 168-174 |
| Block injected into system prompt | line 276 (`KAI_SYSTEM_PROMPT + marketContextBlock + consensusBlock`) |
| FACT_CHECK_RULES injected | via KAI_SYSTEM_PROMPT (line 118 in prompts file) |
| `checkEarningsAttribution` called after generation | line 301 (between toolBlock extraction at 290 and Firestore write at ~400) |
| On failure: suppress, log to `fantasyTimesSuppressions/{date}`, do NOT publish | lines 302-323 |

### Detailed findings — `generate-column.js` (PARTIAL)

- Line 17: imports only `buildConsensusBlock` — **`checkEarningsAttribution` is NOT imported**.
- Lines 277-283: `buildConsensusBlock(today, 'post_close')` called correctly.
- Line 292: block injected into system prompt (`KIM_SYSTEM_PROMPT + consensusContext`).
- Line 304: `storyData = toolBlock.input` extracted from Anthropic response.
- **Lines 305-349: NO interceptor.** Story is built, visual stamped, then written directly to Firestore at line 349.
- No suppression path exists for Kim.
- **Impact:** Kim has the FACT_CHECK_RULES in her prompt (passive guardrail) but no active enforcement at publish time. If she attributes a sector move to fictional earnings, the story publishes anyway. This is the same gap that Kai's interceptor closes.

---

## Firestore State — NOT VERIFIED

A live read of `fantasyTimesConsensus/{today}` and `fantasyTimesSuppressions/{recent-dates}` requires production Firestore credentials and was not performed during this static audit. Defer to Phase 3 verification with admin SDK credentials. Specific live-state checks to run:

- Does `fantasyTimesConsensus/{today}` exist?
- Is `catalysts` an Object (Map, V2) or Array (legacy V1)?
- Are `earnings.reportingToday` AND `earnings.reportedYesterdayAfterClose` populated?
- Sample last 5 trading days — daily consensus seeded by warmup cron?
- Does `fantasyTimesSuppressions/{any-recent-date}` exist? Zero suppressions could mean either "working perfectly" or "Kai's interceptor never fired any violations" — neither is alarming.

---

## Firestore Rules — PARTIAL (one rule mis-permissioned)

`firestore.rules` lines 393-406:

```
match /fantasyTimesConsensus/{date} {
  allow read: if true;
  allow create, update, delete: if false;
}

match /validatedCatalysts/{date} {
  allow read: if true;
  allow create, update, delete: if false;
}

match /fantasyTimesSuppressions/{date} {
  allow read: if true;             ← VIOLATES SPEC (should be `if false`)
  allow create, update, delete: if false;
}
```

| Rule | Spec | Actual | Status |
|---|---|---|---|
| `fantasyTimesConsensus/{date}` | public read, server-only write | public read, server-only write | PASS |
| `fantasyTimesSuppressions/{date}` | server-only read AND write | **public read**, server-only write | FAIL |

Public read on suppressions exposes editorial decisions (which stories were blocked, what the violation was, the suppressed body). This should be tightened to `allow read: if false;` so only the Admin SDK can read suppression records.

**Deploy state:** the `firestore.rules` file in the repo may not match what is actively deployed to the Firebase Console. Per project memory ("Firestore rules for voice layer need manual deploy"), rules in this repo have a history of drifting from production. This rule change requires manual deploy via `firebase deploy --only firestore:rules` or the Firebase Console rules editor.

---

## Crons — HEALTHY

All required FantasyTimes crons present in `vercel.json`. Pre-market warmup runs before market open (9:25 AM ET, with 13,14 UTC dual-hour pattern providing implicit DST coverage). Pulse runs three times daily (pre_market, midday, post_close). Column runs Monday preview and Friday wrap. Econ recap runs every 30 minutes during trading hours. Scan-movers runs every 15 minutes during trading hours. No missing schedules per spec.

---

## Recommended Fixes (Prioritized)

### Fix 1 — Wire `appendCatalyst()` into `generate-macro.js` (CRITICAL)

**File:** `api/fantasytimes/generate-macro.js`
**Effort:** ~10 lines
**Impact:** Closes the most significant wiring gap — macro events were being published without their attribution being shared with the rest of the newsroom.

1. Line 15: add `appendCatalyst` to the import alongside `checkEarningsAttribution`.
2. After line 209 (post-publish), add a try/catch loop iterating `triggers`. For each trigger ticker, call `appendCatalyst(today, trigger.symbol, { source: 'alex_macro', confidence: 'high', reporter: 'alex_macro', catalyst: <macro headline>, ... })`.
3. Log `[CONSENSUS] appendCatalyst fired for <ticker> (Alex macro story <id>)` on success and a non-blocking error on failure.

### Fix 2 — Add publish interceptor to `generate-column.js` (HIGH)

**File:** `api/fantasytimes/generate-column.js`
**Effort:** ~30 lines (mirror `generate-pulse.js` lines 292-326)
**Impact:** Brings Kim's column to parity with Kai's pulse — earnings attribution violations will be caught and suppressed instead of published.

1. Line 17: add `checkEarningsAttribution` to the import.
2. Between line 304 (`storyData = toolBlock.input`) and line 349 (Firestore write), insert the interceptor: read consensus earnings list, run `checkEarningsAttribution`, on failure write to `fantasyTimesSuppressions/{today}` with `reporter: 'kim'` and `columnType`, then return without publishing.
3. Move/reuse the existing `today` variable from line 278 if needed to avoid duplication.
4. Log `[CONSENSUS] checkEarningsAttribution: PASS|BLOCKED for Kim <columnType>`.

### Fix 3 — Tighten `fantasyTimesSuppressions` Firestore rule (HIGH)

**File:** `firestore.rules` line 404
**Effort:** 1-line change
**Impact:** Editorial suppression decisions become server-only.

```diff
 match /fantasyTimesSuppressions/{date} {
-  allow read: if true;
+  allow read: if false;
   allow create, update, delete: if false;
 }
```

**Manual deploy required:** `firebase deploy --only firestore:rules`. The repo edit alone does not propagate to production.

### Fix 4 — Diagnostic `[CONSENSUS]` logs (LOW)

Bundled into Fixes 1 and 2 above. Required so production logs prove the new wiring fires at runtime.

---

## Out-of-Scope Findings

These were observed but fall outside the audit scope:

1. **Server↔client prompt drift in ALEX_SYSTEM_PROMPT and ALEX_MACRO_SYSTEM_PROMPT.** Server version (in `api/_utils/fantasyTimesPrompts.js`) has guidance to prefer specific company catalysts over generic macro narratives; client version (in `src/prompts/fantasyTimesPrompts.js`) lacks this. Reporter prompt voices are explicitly out of scope per the hard constraints. Flag for a separate session.

2. **Firestore rules deploy state.** Per project memory, rules in this repo have drifted from production before. Recommend a one-time audit comparing `firestore.rules` (HEAD) vs Firebase Console rules version history to confirm the entire FantasyTimes rule block is actually deployed, not just Fix 3.

3. **Live Firestore state verification.** Map-vs-Array catalyst shape and daily-seed health checks need admin SDK credentials. If a live read reveals `catalysts` is an Array on any recent date, that document was created by legacy V1 code and a migration discussion is warranted — but the V2 utility is correct, so new dates will be Maps.
