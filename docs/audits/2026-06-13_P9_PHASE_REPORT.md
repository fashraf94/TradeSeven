# P9 — Phase Report: LAUNCH (Rules Deploy · Five-Days-Clean Reconciliation · Security Pass · The Flag Flip)

**Phase:** P9 (the launch checklist — the final phase; not a build). **Branch:** `claude/festive-volta-5d44az` · **HEAD at start:** `0b6f799` · **tree:** clean.
**Date:** 2026-06-13. **Repo:** shallow clone; no history deepening performed.
**Posture of record:** confirm, don't change. P9 produced almost no new code; what it produced is one dev-only verification surface, two `docs/` artifacts, and a **staged-but-unmerged** one-line flag flip.

---

## 0. Executive summary

| Item | Outcome |
|---|---|
| Stage 0 launch-readiness audit | **DONE** — go/no-go, every line VERIFIED at HEAD; all five blocks green except the founder-only Console deploy. See `2026-06-13_P9_STAGE0_LAUNCH_READINESS_ASSESSMENT.md`. |
| The five Firestore rules blocks | **Confirmed present + correct**; the founder confirmed the Console deploy (the blocking gate) is done. |
| Five-days-clean reconciliation | **Made runnable** — a "Reconcile ledger" button + green/red verdict card on the dev screen (the launch criterion as a report, not a manual curl). |
| Consolidated security pass | **All holds** — verified server-authoritative at HEAD; one doc-accuracy nuance on the claim cap (code is stronger than the ledger text). |
| Flag-flip blast radius | **Re-confirmed** at HEAD; no env override; first-user path stated honestly. |
| The flag flip | **NOT flipped.** Staged as its own one-line commit + documented in the runbook; the founder merges it LAST, after the deploy + a GREEN reconciliation. |
| Fence / cron / rules | **Zero fence contact. Zero new cron (38/40 unchanged). No firestore.rules change.** |
| Tests | 138/138 tournament tests green at HEAD; the changed dev screen lints clean. |

**The shape of this phase is the success shape:** the flag was not flipped by the session (its prerequisite — the Console deploy — is a founder action that cannot be verified from here), and the only code added is a dev-only verification report. Everything else was confirmation.

---

## 1. What was verified (Stage 0 — read-only)

The full go/no-go is the companion assessment. In brief, each block was walked and VERIFIED at HEAD:

- **Block 1 (rules-deploy gate):** all five blocks present in `firestore.rules` (`:302/:312/:322/:334/:339`), each authenticated-read + server-only-write; every client read in `LeagueScreen`/`tournamentGroupService.js` maps to a granting block; the WHY-projection endpoint is Admin-SDK and rule-exempt by design. The blocks are inert until the Console deploy — the one blocking gate, a founder action. The flip cannot precede it (else every client read 403s).
- **Block 2 (reconciliation):** the reconcile engine (`tournamentAgentLedger.reconcileGroupLedger:591`) and endpoint (`api/tournament/reconcile-ledger.js`, the declared P9 verification surface) are correct; `unverifiable_holder` (`:674`) is the correct-until-P4 state now replaced by verified holders post-deploy.
- **Block 3 (security pass):** claim window/day-5/cap (`place-claim.js:67/:102/:129`), flip cap (`flip.js:150`), the WHY allowlist (`tournamentBattleView.js:36-51`, conceal-by-default by construction), server-only mutation (`tournamentActions.js`/`tournamentGroupService.js` reads-only), deploy auth (`decide.js:46-55,:129-139`), the dev/prod boundary (test-locked `p4Flips.test.js:56-82`) — **all holds.**
- **Block 4 (flag-flip blast radius):** `TOURNAMENT_TAB_ENABLED` (`featureFlags.js:78`) gates `App.jsx:9563`, `BottomNav.jsx:10-12`, `DesktopSidebar.jsx:14-16`; no env override; `TOURNAMENT_DEPLOY_ENABLED` already `true`; first-user path = the empty-state poster until a founder-formed group (no self-serve join at V1).
- **Block 5 (watch-ledger triage):** W1–W5 / O1–O2 triggers scale-based and not fired at V1; X1 (training-game short, `BaggerBombTrainingBattleViewV4.jsx:396-420`/`:624`) confirmed live at HEAD, touches no tournament surface — **non-gating, its own ticket.**

---

## 2. What was built (post-go — minimal by design)

### 2.1 The five-days-clean reconciliation report (the only code change)
`src/screens/TournamentDevScreen.jsx` — added, mirroring the existing `runDuty`/`lastDuty` idiom:
- state `lastReconcile` + derived `reconcileClean` / `reconcileDivergences`;
- a `reconcile()` action calling `POST /api/tournament/reconcile-ledger` for the attached group (admin-secret, the existing `adminPost` path);
- a **"Reconcile ledger"** button in the battle-phase actions row (same gate as Bank/Process-claims: secret + group in BATTLE);
- a **green/red verdict card**: GREEN when `divergences.length === 0` ("every held symbol resolves to a verified holder"); RED lists each `{type, symbol, details}`.

**Properties:** dev-only (the screen is reachable only via `?tournamentDev=1`, not gated by `TOURNAMENT_TAB_ENABLED`), additive, **no fence contact, no new cron, no new collection, no rules change**, calls only the pre-existing endpoint. Lints clean.

### 2.2 The launch runbook
`docs/FANTASYTRADES_LEAGUE_TOURNAMENT_LAUNCH_RUNBOOK.md` — the ordered go-live sequence (merge P9 → deploy rules → verify a read succeeds → run reconciliation GREEN → security holds → flip LAST) and the post-launch first-week observation plan (first Monday pipeline, first banking, first advancement — each a quiet-success checklist), plus the standing watch items and the honest "what "launched" means" note.

### 2.3 The Stage 0 assessment + this phase report
`docs/audits/2026-06-13_P9_STAGE0_LAUNCH_READINESS_ASSESSMENT.md` (byte-exact with the offered artifact) and this report.

---

## 3. The flag flip — staged, not merged

Per the founder's ruling, the flip is **not** part of this work. It is prepared as:
- the exact one-liner documented in the runbook (`featureFlags.js:78`, `false` → `true`), and
- a separate, ready-to-merge one-line commit branch (staged, not merged),

to be merged **LAST**, by the founder, **after** the rules deploy and a GREEN five-days-clean reconciliation — never bundled with this PR, never before the deploy.

---

## 4. The launch sequence (order of record)

1. Merge the P9 PR (reconciliation report + runbook + reports — **not** the flip).
2. Deploy the five tournament rules blocks in the Firebase Console (founder; the blocking gate).
3. Verify the deploy (a read that would have 403'd now succeeds on the dev surface).
4. Run the five-days-clean reconciliation → GREEN.
5. Security pass holds.
6. Merge the flag-flip commit → `TOURNAMENT_TAB_ENABLED = true` → the tab is live.
7. Begin the first-week observation plan.

---

## 5. Guardrails honored

- **Zero fence contact** — fenced modules (`decide.js`, `agentScoring.js`, etc.) were READ for verification only, never edited.
- **Zero new cron** — `vercel.json` unchanged at 38/40.
- **No firestore.rules change** — the blocks were confirmed, not modified; the deploy is the founder's Console action, never automated.
- **The flag flip is the only intended behavior change, and it ships LAST** — staged, not merged, this session.
- `/code-review` at max effort run on the built code (the dev-screen report).
- Reports are file artifacts in `docs/`; the Stage 0 report also exists outside the repo tree (offered for download).

---

## 6. Out of scope (untouched)

New product surfaces; post-launch arcs (Dossier Sprint 2, Vision Program, Research Companion, trait/evolution, the intelligence systems, the durable eliminated-interstitial pointer, the self-serve registration/join flow); the X1 training-game short fix (its own ticket); any Snake Draft engine modification; the watch-ledger items whose triggers have not fired.

---

*Prepared at the close of P9. The League Tournament is launch-ready; the remaining actions are the founder's: deploy the rules, run the reconciliation to green, then flip the flag — in that order.*
