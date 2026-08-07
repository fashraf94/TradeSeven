# League Scoring Anomaly — Phase 0.5: Live Data Adjudication

**Date:** 2026-07-18
**Branch:** `claude/league-scoring-anomaly-v6b19j` · **HEAD at run:** `b095af54` · no new branch
**Type:** READ-ONLY live-data run (Admin SDK + EODHD). No Firestore writes, no code edits, no fence contact.
**Status:** ⛔ **BLOCKED — the live run could NOT be executed in this session** (no credentials). The fork is **UNADJUDICATED**. This artifact records the blocker, hands off the exact read-only procedure, and pre-registers the tables for population. **No data below is fabricated.**

---

## ⛔ Why this run is blocked (verified, not assumed)

Phase 0.5's own prereq: *"run in the LOCAL environment where the Firebase Admin service account and EODHD key exist."* This session is a remote code-execution container with **the repository but none of those credentials.** Verified this session:

| Requirement | Check | Result |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `env` | **UNSET** |
| `FIREBASE_CLIENT_EMAIL` | `env` | **UNSET** |
| `FIREBASE_PRIVATE_KEY` | `env` | **UNSET** |
| `GOOGLE_APPLICATION_CREDENTIALS` / ADC | `env` + `~/.config/gcloud` | **UNSET / absent** |
| `EODHD_API_KEY` | `env` | **UNSET** |
| service-account JSON | `find /home/user` | **none** (only `.env.example` template) |
| `gcloud` CLI | `command -v gcloud` | **not installed** |
| `firebase-admin` package | `node_modules` | **not installed** |

There is **no path to read production Firestore or EODHD from here.** Fabricating the R1.2 decisive table, the doc census, the badge/churn forensics, or the AAPL recompute would invent the very numbers the pre-registered fork exists to decide — so **nothing is fabricated.** The run must be executed where the credentials live.

**Also noted (unrelated):** the session flagged a `Robinhood` MCP server needing authorization — irrelevant to this phase; not used.

---

## ▶️ How to complete this run (read-only, ~1 minute)

A ready-to-run script implementing **R1.1–R1.6 + Run 2 exactly** is delivered alongside this report as **`phase0_5_live_queries.mjs`** (kept **outside the repo tree**, per the phase rule — do **not** commit it). It performs **only** `.get()` reads and HTTPS GETs (self-audited: zero `.set/.update/.delete/.add/.create/runTransaction`/`FieldValue`), and prints paste-ready tables.

```bash
# in the env where the Firebase Admin service account + EODHD key exist:
npm i firebase-admin                    # if needed
export FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... EODHD_API_KEY=...
POD_UID=7ML6i7WyfuaAtJjl16Smh2kETPw1 node phase0_5_live_queries.mjs
# optional: GROUP_ID=<id>  RECOMPUTE_SYMBOL=AAPL
# safety re-audit before running:
grep -nE '\.(set|update|delete|add|create)\(|runTransaction|FieldValue' phase0_5_live_queries.mjs   # only the header comment should match
```
Paste the script's sections into the templates below and re-derive the one-paragraph fork verdict against the pre-registered predictions.

---

## Pre-registered fork (verbatim from the tasking — report against these)

**FORK 1 — long-window accumulation (pod ≈ Jul 1).** Predicts: `agentBattles` doc count per seat ≈ **10–13** (≫ the 2 banked user days + 1 live); Σ`bankedBadgePoints` and Σ`lockedPoints` spread across many docs; **`agentPoints ≈ compositePoints`** (user half small); per-doc daily values individually plausible (each within a one-day envelope). ⇒ **honest arithmetic over a broken window.**

**FORK 2 — real defect (pod genuinely ~3 days old, created post-fix).** Predicts: doc count ≈ **3/seat**. Then legitimate accumulation cannot reach −2676.5 (badge ceiling ≈ −630 over 3 days; churn legs would need impossible per-leg losses; quiet-book base is noise) ⇒ **a defect outside H1–H6 exists; escalate to per-doc/per-leg reconciliation (A2/A4).**

**Do not blend the forks.** State which the data supports, or that neither cleanly fits (show the residual).

*(Phase-0 code prior, NOT a finding: the code makes FORK 1 the more likely shape — day index is `max+1` and calendar-decoupled (tournamentBanking.js:126), the agent crons stayed alive re-banking `bankedBadgePoints` daily while user-banking was ESM-dead until Jul-15, and the agent half is the only ATR-independent large term. But this is a prediction to be tested by the doc census, not a substitute for it.)*

---

## Run 1 — the pod (`7ML6i7WyfuaAtJjl16Smh2kETPw1`'s training group) — PENDING LIVE RUN

**R1.1 — Pod identity** *(populate from script §R1.1)*
`groupId:` ⟨pending⟩ · `createdAt:` ⟨pending⟩ · `isTraining:` ⟨pending⟩ · `baselinePolicy:` ⟨pending⟩ · `startAnchor:` ⟨pending⟩ · `dailyScores` days + `recordedDate`/`recordedAt`/`recordedBy`: ⟨pending — expect entries ≥ Jul-16 only⟩

**R1.2 — Decisive A1 table** *(populate from script §R1.2; MUST reproduce the displayed orbs or the mismatch itself is the finding)*

| Seat (odUserId) | isCpu | `agentPoints` (Σ docs) | Σ`bankedBadgePoints` | Σ`lockedPoints` | Σ`activeScore` | `1.5×totalPoints` | `compositePoints` | **doc count** | term carrying mass |
|---|---|---|---|---|---|---|---|---|---|
| Seat 1 Diversifier (−384.5) | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ |
| Seat 2 User Capital Preserver (−734.0) | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ |
| Seat 3 Contrarian (−810.5) | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ |
| Seat 4 Trend Follower (−2676.5) | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ | ⟨⟩ |

**R1.3 — Doc census per seat (fork adjudicator)** *(populate from script §R1.3)* — per doc: `createdAt`, `status`, `currentScore`, `bankedBadgePoints.total`, tradeCount. **≈10–13/seat ⇒ FORK 1; ≈3/seat ⇒ FORK 2.** ⟨pending⟩

**R1.4 — Badge forensics** *(script §R1.4)* — largest-Σ`bankedBadgePoints` seat's `breakdown` per day + per-asset tier; **flag any tier fired on a day whose move < 1× the symbol's `scoring.thresholds[sym].threshold`** (residual H1). ⟨pending⟩

**R1.5 — Churn forensics** *(script §R1.5)* — Trend-Follower seat: every `trades[].lockedPoints` reconciled against its stored `entryPrice/exitPrice`. **Any leg that doesn't reconcile within rounding ⇒ real corruption (escalate).** ⟨pending⟩

**R1.6 — Hand recompute** *(script §R1.6)* — user's AAPL day-1 leg vs EODHD official open/close; expected vs stored side-by-side (base-off ⇒ H2/H5 baseline; tier-off ⇒ H1 ATR). ⟨pending⟩

## Run 2 — Ranked blast-radius sample (D1) — PENDING LIVE RUN

*(script §RUN 2)* One ranked (non-training, non-dev) `status==battle` group: same R1.1–R1.3 tables; state plainly whether it carries the **same signature** (agent-side dominance, doc count ≫ banked-day count, magnitudes outside a 3-day envelope). **Also:** across ALL ranked BATTLE groups, the current **max `dailyScores` day index** — confirms/corrects that day-5 `lockTopTwo` ingestion first fires ~Tue Jul 21. ⟨pending⟩

---

## Fork verdict — UNADJUDICATED (pending the live run)

The fork **cannot be decided in this session**: it turns entirely on the R1.3 doc census and the R1.5 per-leg reconciliation, both of which require Admin-SDK reads unavailable here. **No verdict is asserted.** When the script is run where credentials exist: if doc-count ≈10–13/seat with `agentPoints ≈ compositePoints` and per-doc/per-leg values each reconcile → **FORK 1 (honest arithmetic over a broken window)**; if doc-count ≈3/seat and the magnitudes exceed a 3-day envelope or any `lockedPoints`/tier fails to reconcile → **FORK 2 (real defect — escalate to A2/A4 localization before any fix)**. If R1.2's assembled terms fail to reproduce −384.5/−734.0/−810.5/−2676.5 at all, **stop and report that mismatch as the finding.**

**HARD STOP.** No fixes, no Firestore writes, no fence contact. Fix framing (§7) is the founder's next call **after** the live run populates this report.
