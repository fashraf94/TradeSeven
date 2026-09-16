# Backing Beta PR 2 — cumulative multi-lens adversarial review

**Date:** September 16, 2026
**Branch:** `backing/pr2-pools-stake-endpoint`
**Reviewed at:** `a8e8fbf4` (the branch's single build commit, cut from `main` @ `b7913c91`)
**Scope:** spec V1.3 §12 PR 2 — pools, the stake endpoint, the pod list — plus carry-ins E1 (the sealed stake meta), E2 (the net-BP month attribution) and E3 (the scanner allowlist).
**Why a review at all:** BUILD_RULES §2 — the cumulative branch diff is 19 files / ~4,700 lines, past both thresholds.

---

## Executive verdict

*(filled in below, after the lens tables)*

---

## How the review was run

Five independent lenses, each on its **own isolated snapshot tree** (BUILD_RULES §2 reviewer isolation, the Sept 2 founder ruling): one `git archive a8e8fbf4` extraction per lens, path-distinct, under the session scratchpad, with `node_modules` symlinked. Every lens was **read-only on git and on the shared working tree** — no writes to the repo, no `git checkout --`, no stash, no commit, no push. Mutation checks ran inside each lens's own tree and were reverted there.

| Lens | Brief |
|---|---|
| **A** | Double-spend, replay and cap evasion against the stake transaction — two racing requests with the same and with different `requestId`s, and a close racing a stake. *(the explicitly briefed lens)* |
| **B** | Domain correctness against spec V1.3 §1–§8 and Amendment A §A2/§A3 — the close order, the window, the economy, the §6 shapes, the "not in this PR" list. |
| **C** | The dark-merge guarantee, wiring and blast radius — flag reads, reachability while dark, the shared in-memory-Firestore fixture's other consumers, the rules block, the moved PR 0/PR 1 pins, and five prescribed mutation checks. |
| **D** | Test integrity and prose honesty — vacuous rows, the hand-written concurrency simulator, the E2 block's arithmetic, the ledger fold's independence, and every docstring claim. |
| **E** | Security, authorization and data exposure — the seal, authorization on the stake body, the rules, the fingerprint salt, path safety, log leakage, cost. |

Every finding was handed back to its lens with an instruction to **refute** it with a concrete repro. Findings that survived are **CONFIRMED**; the rest are recorded **REFUTED**, with the reasoning.

---

## Coordinator's own checks (run on the working tree, not by a lens)

| Check | Result |
|---|---|
| `npm run test:run` | *(recorded in the verification section below)* |
| `npm run test:rules` (emulator available) | 8 files / 201 tests, exit 0 |
| `npx vite build` | clean, exit 0 (BUILD_RULES §2 — the only check that catches a syntax error in `App.jsx`) |
| `npm run lint:gate` | clean, exit 0 |
| Fenced files touched (BUILD_RULES §1, all eleven) | **zero** |
| `vercel.json` / cron budget (§6) | untouched; 39 of 40 |
| Writes to `tournamentGroups` / `agents` / `agentBattles` | **none** (§12 "not in this PR") |

### Rules-block mutation check, measured

BUILD_RULES §2: *"a row that cannot fail under the defect it names is not a guard."* The new
`match /backingStakes/{stakeId}/private/{doc}` block and its five rows in
`test/rules/backingDenials.rules.mjs` were mutation-checked against the real emulator, three ways:

| Mutation to `firestore.rules` | Result | Reading |
|---|---|---|
| The whole new block **deleted** | suite stays **GREEN** (39/39) | Firestore denies by default, so the block is an explicit *statement on the page* — the `backingPools/{id}/private` sibling's own stated convention — not the mechanism that denies. The rows are **not** a guard against the block's own removal. |
| `match /backingStakes/{stakeId}/{document=**}` carrying the **parent's owner condition** | suite stays **GREEN** | Correctly so: the meta doc has no `userId`, so `resource.data.userId == request.auth.uid` is false for it and the read stays denied. The wildcard is not the defect it looks like. |
| The block's read **relaxed** to `if request.auth != null` | **RED — 3 of the 5 rows fail** | This is the defect class that matters, and the shape a future "let the backer see their own meta" convenience would take. The rows are a genuine guard against it. |

All three results are now written into the test file itself, beside the row they describe, so the
limit is executable documentation rather than a reviewer's memory.

---
