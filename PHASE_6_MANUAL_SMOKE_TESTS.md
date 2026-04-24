# Forge Expansion Sprint — Phase 6 Manual Smoke Tests

**Branch:** `claude/forge-expansion-sprint-v3`
**Purpose:** Manual verification checklist for Flash to run before merging the sprint branch to main.
**Scope:** Post-Phase-6 smoke pass. Phase 6.0–6.1 scripted verification already confirms static correctness, schema consistency, and pipeline integrity. This document covers the UX-and-LLM-behavior edges that scripted tests can't validate deterministically.

**How to run:** work through the six scenarios in order. Each takes 2–5 minutes. Stop if any deviates significantly from expected — the sprint branch isn't merge-ready until the issue is understood.

---

## Test 1 — Inferred short duration

**Setup:** Open Workshop, start a new conversation.

**User message:** "I want to catch the next earnings reaction in tech."

**Expected Gemma behavior:**
- Does NOT ask about duration in any turn (infers silently).
- Recommendations bias toward short-horizon rules: volume confirmation, tight time exits, earnings exits.
- Gemma does NOT recommend long SMAs (100, 200) or patient profit targets (25%+).

**Expected thesis state (inspect via browser devtools or Firestore console):**
- `activeThesis.recommendedDurationDays: 5`
- `activeThesis.catalyst` mentions earnings

**Click Compile. Expected modal state:**
- Duration picker preselected to `1 week` (5 days) chip
- "From Workshop" badge visible next to the picker
- StrategyDimensions card state reflects Gemma's recommendations (e.g., earnings exit enabled, time exit ≤ 3 days)

**Pass criteria:** all three expected sections match. If duration chip shows 4 weeks instead, M2/Phase 5.5 chain broke — stop and investigate.

---

## Test 2 — Inferred long duration

**User message:** "Build me a sector rotation strategy I can run for the month."

**Expected Gemma behavior:**
- Silent inference of 20 days.
- Proposes sector momentum filter (likely top-N mode, 1M timeframe).
- Discusses trend alignment (50 or 100-day SMA) as a fit for longer horizon.
- Does NOT recommend tight 2-3 day time exits.

**Thesis state:**
- `recommendedDurationDays: 20`
- `activeThesis.entryLogic` references sector and/or trend alignment

**Modal state after Compile:**
- Duration picker on `4 weeks` (20 days) chip with "From Workshop" badge
- Sector Strategy card: `sectorFilterEnabled: true`, `sectorFilterMode: 'top_n'`
- Entry Aggression card: `trendAlignmentEnabled: true`, `trendAlignmentSmaPeriod: 50` or `100`

---

## Test 3 — Ambiguous → ask → answer

**User message:** "I want to trade momentum stocks with tight risk control."

**Expected Gemma behavior:**
- First response asks the duration question naturally, something like: "How long do you want to test this? 1 week stress-tests whether your entries fire; 4 weeks gives the trend room to play out."
- Provides `suggestedActions` with 2–3 duration options as chips.

**Reply to Gemma:** "let's do 2 weeks."

**Expected follow-up behavior:**
- Gemma does NOT re-ask about duration.
- Gemma does NOT apologize for the earlier question.
- `recommendedDurationDays` flips to `10` on the next turn's thesis.
- Gemma pivots to next-missing thesis field (likely exit logic — since momentum + tight risk partially describes entry/risk, exit is still blank).

**Modal state after Compile (however many turns later):**
- Duration picker on `2 weeks` chip with "From Workshop" badge

---

## Test 4 — SE-09 sector momentum filter, specific mode

**User message:** "Let me pick specific sectors to trade: Technology and Healthcare only."

**Expected Gemma behavior:**
- Proposes sector momentum filter with `specific_sectors` mode.
- Asks no ambiguous duration question (the thesis is neutral on duration; expect `recommendedDurationDays: null` or Gemma asks about duration after sector question is resolved).

**Click Compile. Modal state:**
- Sector Strategy card when expanded: `sectorFilterEnabled: true`, `sectorFilterMode: 'specific_sectors'`
- Multi-select checkbox grid visible with "Technology" and "Healthcare" selected
- Other 9 sectors unselected

**In Firestore (agents/{id}/bundles/{bundleId}):**
- `dimensionValues.sectorStrategy.sectorFilterSelected: ['Technology', 'Healthcare']`
- `ruleSnapshots` array contains a snapshot with `sourceRef: 'se-09'`, `paramValues: { mode: 'specific_sectors', selectedSectors: ['Technology', 'Healthcare'] }`

---

## Test 5 — Advanced fields reveal + conditional sub-params

**Setup:** open any compiled strategy in the entry modal. Go to Step 2 (Strategy Dimensions). Confirm the "Show advanced" toggle is OFF (default).

**Verification steps:**
1. Expand the Exit Discipline card. Observe baseline fields only: profit target, time exit days, technical exit toggle + RSI threshold (when enabled).
2. Click "Show advanced" in the Workshop header. Observe the expanded card now shows `Advanced` subsection with extra fields: `timeExitMinGainPct`, `earningsExitOnlyIfProfitable`, `technicalExitTrigger` alternatives, etc.
3. With technical exit enabled, switch the trigger segmented control between `rsi_overbought`, `macd_bearish`, `either_rsi_or_macd`, `below_sma`. For each:
   - `rsi_overbought`: RSI threshold chip picker visible (baseline)
   - `macd_bearish`: no sub-params visible
   - `either_rsi_or_macd`: RSI threshold chip picker visible
   - `below_sma`: SMA period chip picker visible (advanced — only when toggle on)
4. Turn "Show advanced" back OFF. Confirm the advanced subsection disappears entirely (not just collapses — it's not rendered at all).

**Pass criteria:** each sub-param reveal matches the trigger choice, and toggling Show advanced OFF hides the advanced subsection cleanly.

---

## Test 6 — End-to-end M2 fix (Deploy-to-Agent verification)

**Purpose:** confirm the mid-sprint M2 audit finding is actually fixed in the production flow. This is the load-bearing regression test for Phase 4.5.

**Setup:**
1. Start a new Workshop conversation (or use manual-configure path).
2. In Step 2 of the entry modal, move the **Stop-loss slider** to **5%** (explicitly, not the 8% default).
3. Confirm the modal displays `5%` on the Risk Posture card before launching.
4. Launch as a 5-day solo session (duration picker → `1 week`).

**Wait or simulate:**
- Let the session run to completion (5 trading days) OR simulate completion via dev tooling if available.

**At end-of-session:**
1. Navigate to the completed entry's SeasonReview screen.
2. Click Deploy-to-Agent.
3. Inspect the agent's guardrails in Firestore (`agents/{agentId}` doc, `guardrails` field) OR via the agent dashboard.

**Critical assertion:**
- Agent's `stopLoss` guardrail value: **`5`** (the user's choice), NOT **`8`** (pre-fix default).
- Agent's directives array contains: `dir-stop-loss` with text mentioning `5%`.

**This is the M2 fix in production.** If the agent receives `8%` instead, the Phase 4.5 canonical reader migration regressed — stop and investigate before merging.

**Additional spot-checks while you're there:**
- If you set any other slider (e.g., `profitTargetPct: 12`), verify the guardrail / directive carries `12`.
- If you toggled `addToWinnersEnabled: true`, verify the agent's directives include `dir-add-to-winners`.

---

## Sign-off

- [ ] Test 1 passed (short-duration inference)
- [ ] Test 2 passed (long-duration inference)
- [ ] Test 3 passed (ambiguous → ask → answer)
- [ ] Test 4 passed (SE-09 specific sectors)
- [ ] Test 5 passed (advanced + conditional reveal)
- [ ] Test 6 passed (**M2 fix Deploy-to-Agent verification — critical**)

When all six boxes tick: branch is merge-ready. Open the PR using the draft at `PHASE_6_PR_DESCRIPTION.md`.

If any test failed: **do not merge.** Report the failure details and we debug before the PR opens.
