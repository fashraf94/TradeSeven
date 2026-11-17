# Replay pack — the mandatory review (BUILD_RULES §2)

**Date:** 16 Nov 2026 · **Branch:** `claude/trader-game-replay-pack` (PR #1079) · **Subject:** the replay pack's scripts (`scripts/experiments/trader-game-replay/`) and its report (`docs/audits/20261115_REPLAY_PACK_TRADER_GAME.md`).

**Why a review.** With Parts D and E added, the cumulative branch diff crossed 1,500 lines (8 files, about 1,900 lines at commit `f0bdb728`). BUILD_RULES §2 then requires the following, and this record covers each:

- an adversarial review across several lenses, with every finding handed to a refuter;
- an explicit `vite build`;
- mutation checks where tests are added;
- a written record.

## Summary

| | Result |
|---|---|
| Lenses | 4 independent reviewers: Part A rescore; export and data safety; Parts B and E; Parts C and D |
| Findings | 35 (7 + 8 + 9 + 11 table rows; M1–M7 counted as one row, B1′ raised by a refuter) |
| Verified | Every finding was handed to a separate refuter told to disprove it with a concrete repro |
| Verdicts | **29 CONFIRMED, 5 PARTLY, 1 REFUTED** (X8, mostly). Four claims inside confirmed findings were also refuted: A1's repro numbers, C2's offsets (characters, not bytes), B1's "85 of 100" statistic, and E1's call count (1–3 high) |
| Reported numbers that changed | Part B: the model's hold share (the lens confirmed the earlier correction), eligible checks, reading (ii), and **the delay cost's sign under the convention that matches the stored fills (−10 → +11)**. Part C: the prefix percentages (about −1.4 points). Part E: the combined gate (6.19 / 10 → 6.2–6.5 / 8–10) and the proposal count. Part A: none. Part D: none |
| Cost rows, Part D tables, spend | Unchanged ($1.35) |
| `vite build` | Exit 0 on a fresh `npm ci` in a short-lived WSL worktree. Run on `f0bdb728`, then again on the final head before push |
| Mutation checks | 4 mutants on Part A's new self-test rows and committed-frame check: all 4 killed |

## Method

- **Isolation.** Reviewers worked on `git archive` snapshots of the branch head, with LF line endings. Each snapshot used a junction to the shared `node_modules`, and each reviewer had its own copy of the export data. They were read-only on git and on the working tree.
- **What reviewers could run.** The offline parts. They were forbidden to run the export (it reads production) or Part D's paid steps.
- **Refuters.** Each refuter received the findings, not the author's conclusions, and was told to disprove each one with a command or a `file:line`.
- **Fixes.** Applied by the coordinator in the working tree after the verdicts. Then every offline part was re-run twice and once under `TZ=UTC`, and all outputs were byte-identical.

## Findings and dispositions

Severity is the lens's: **high** changes a reported number; **medium** could on other data, or is an unchecked claim; **low** is clarity.

### Lens 1 — Part A rescore (`partA-rescore.mjs`)

| Id | Sev. | Finding | Verdict | Disposition |
|---|---|---|---|---|
| A1 | med | The previous-close guard fired only when the entry-based legs differed. A stored bonus whose true baseline would not clear could be kept. | CONFIRMED in mechanism. The lens's repro numbers were **REFUTED**: a Star gives 59/59, not 37/37. | Fixed: any stored bonus with an unknown baseline now excludes its battle. No effect here (0 of 35 such positions hold a bonus). |
| A2 | med | The CPU opponent's residual check never ran: every measured CPU holds crypto, so "stock positions reproduce" was asserted, not tested. | CONFIRMED (the per-position values are right) | Fixed: each measured stock leg (agent and CPU) is now checked against its committed frame. All 13 battles pass. |
| A3 | med | A legacy sale's unit came from the receipt, not the executor's precedence (`scoring.thresholds` first). | CONFIRMED (no divergence here) | Fixed: the executor's precedence. |
| A4 | med | Battle 001 is excluded as "touch record unknown", though its day-1 record bounds it and allows no bonus. | CONFIRMED | Kept excluded under Q21. The report now notes that including it gives 44 kept, Δ 0. |
| A5 | low | The "both sides" bonus share mixes scopes, and "banked" was a misnomer. | PARTLY | Wording fixed in the report. |
| A6 | low | The self-test missed the guard, the day-1 shape, the join, measured sales and the CPU side. | CONFIRMED | Self-test extended (guard, both touch-record shapes). The rest is noted as covered by the real-data gate only. |
| A7 | low | (a) join fallback; (b) a measured crypto sale is routed to the legacy path; (c) a null touch record is excluded; (d) "activated the evening before" is wrong. | CONFIRMED (0 instances for a–c) | (d) wording fixed; (b) listed as a limit; (a) and (c) kept (conservative). |

### Lens 2 — export and data safety (`exportReplay.mjs`, all scripts, the report)

| Id | Sev. | Finding | Verdict | Disposition |
|---|---|---|---|---|
| X1 | med | The `--out` guard only protected this worktree. The main checkout, 8.3 short names, `\\?\` and `\\localhost\C$` paths, and junctions got through. | CONFIRMED (latent; the run wrote to Documents) | Fixed: real paths, this checkout plus the main checkout, segment-boundary match. Tested offline: all bypasses now rejected, Documents allowed. |
| X2 | low | Text-level id replacement leaves hashes over ids stale (`receiptHash`, `manifestHash`). | CONFIRMED (no step recomputes them) | Documented in the script header and the report. |
| X3 | low | The leak scan was circular (only collected ids), and a comment wrongly said keys were collected. | PARTLY: no account id escaped; the scan's coverage was overstated | Fixed: a uid-shape scan was added, plus file deletion on a hit. Comment and report wording fixed. The shape scan over the existing export finds 0. |
| X4 | info | 20-character document ids, agent names, chat text and watchlist names remain in the out-of-tree export. | CONFIRMED (none in the report) | Listed in the report's preamble. |
| X5 | low | The report committed a Windows profile path with the OS user name. | PARTLY (that prefix already appears in 74 files on `main`) | Replaced with a relative description. |
| X6 | info | The pseudonymized request text is not the bytes sent: 8 requests are 42 bytes shorter. | CONFIRMED, and wider: 4 Part D rows were resent with `acct-NN` in place of the id | Part D now checks each request against the stored SHA-256 (146 of 150 match). The report discloses the 4 rows. |
| X7 | low | Raw error text was printed; a failed leak scan left its files; an existing `--out` was overwritten silently. | CONFIRMED | Fixed: error class and code only; files deleted on a leak; a non-empty `--out` is refused. |
| X8 | nit | "All six outputs"; the read description omitted two read paths. | Mostly **REFUTED** (already fixed in the reviewed head); the read-path line stood | Read description fixed. |

### Lens 3 — Parts B and E (`partB-schedule.mjs`, `partE-gate.mjs`)

| Id | Sev. | Finding | Verdict | Disposition |
|---|---|---|---|---|
| B1 | high | The delay cost priced fills at the check's own tape minute, but stored fills match the tape one check earlier. | CONFIRMED. The lens's statistic (85 of 100) did not reproduce; the refuter got 56 of 68 and the author 73 of 82. The direction and every delay number reproduce exactly. | Fixed: both conventions reported. Lag 1 (matches 73 of 82 stored fill prices) gives **+11** (median +2); lag 0 gives −10. The headline now says "small and mixed". |
| B2 | high | Two checks that exit before the gate (reward frame unavailable) were counted as eligible. | CONFIRMED | Fixed: eligible means the check reached the gate. Now 468; reading (ii) 9.90 / 9.55 / 9.42. |
| E1 | high | The combined gate ignored what a dropped call carries forward (`forced_open`; unseen news). | CONFIRMED. The call count was about 1–3 high: the refuter found 198 certain and about 200 with the probable carries, against the simulation's 201. Missed stays 8. | Fixed: a simulation with nothing carried (192 / 10), `forced_open` carried (194 / 10, exact), and news carried too (201 / 8, upper bound). Reported as a range. |
| E2 | high | A failed call was counted as a blocked swap proposal. | CONFIRMED | Fixed: answered calls only (31 proposed, 28 blocked; 18 failed). |
| B3 | low | All 29 hurdle-floor blocks were called "below the floor"; 1 was "no positive bench candidate". | PARTLY (the block is still a hurdle-floor block; only "below" overstated it) | Wording fixed. |
| B4 | low | Per-leg rounding: the unrounded lag-0 total is −8. | PARTLY (not a defect: the game rounds per asset) | Noted in the report (rounding matches the game). |
| B5 | low | The "level" event wording overstated "uncrossed penalty" for legacy battles. | CONFIRMED | Wording fixed. |
| B1′ | low | Side effect found by the B1 refuter: pricing the move event with the same one-check lag gives 61 event checks at X = 0.5 instead of 62 (9.39 calls per battle-day). | CONFIRMED | Left at the check's own minute; noted here. |
| M1–M7 | — | Issues that would matter only on other data: a stock bought at the last scheduled check; a guardrail fill; the command window; `isStock`; the stale-bar fallback; incoming stock sold early; one swap per check. | CONFIRMED in code; none affects this data | Listed as limits; no effect here. |

### Lens 4 — Parts C and D (`partC-cost.mjs`, `partD-models.mjs`)

| Id | Sev. | Finding | Verdict | Disposition |
|---|---|---|---|---|
| C1 | high (about 1.4 points) | The prefix percentages were a ratio of medians, not a median share. | CONFIRMED | Fixed: per-pair median shares (71.0 / 70.9; 26.5; 27.2). |
| C2 | med | The cross-battle claims ("byte 83", "only the first 8 bytes repeat") are contradicted by the data. | CONFIRMED (b: PARTLY, the offsets were characters, not bytes) | Rewritten from the script's new per-byte, per-line output. |
| C3 | low | The 71.1% share includes two sections after the changing lines, so it is not "no reordering". | CONFIRMED (cost effect $0.0002 per battle-day) | Wording fixed; both shares stated. |
| C4 | high (0.1 points) | INTRADAY MOMENTUM is 0.9%, not 1.0%. | CONFIRMED | Fixed. |
| C5 | high (off by one) | "40 use the estimates" should be 39 plus 1 synthetic. | CONFIRMED | Fixed. |
| C6 | low | "Upper bound" holds only if the timed-out calls were not billed. | CONFIRMED | Both cases stated. |
| C7 | low | The first changing byte is on line 2, not line 1. | CONFIRMED | Fixed. |
| C8 | med (other data) | The section regex would split a bare ticker line. | CONFIRMED (clean here) | Fixed: a single word needs a lower-case note. Size map unchanged. |
| D1 | high (5 rows) | `max_tokens` is 2,048 on 5 sampled rows, not 3,072. | CONFIRMED (no effect) | Fixed in the report. |
| D2 | low | An invalid call printed as HOLD→HOLD in the decisions tally. | CONFIRMED | Fixed: labelled "invalid". |
| D3 | low | The limits omitted the temperature confound and the latency rows' make-up. | CONFIRMED | Both added. |

## Checks

- **`vite build`:** exit 0 on `f0bdb728` in a fresh WSL worktree (`npm ci`, then `npx vite build`); the only output is the usual large-chunk warning. The final head is built the same way before the push; its result is in the PR.
- **Census tests that walk `scripts/`** (run directly on Windows):
  - 9 of 10 pass.
  - `api/_utils/setupEvaluator/golden.test.js` fails to load: its import, `scripts/experiments/tf-setup-golden-baseline-check.mjs`, has a shebang and is checked out with CRLF here. This is a known Windows-only issue, unrelated to this branch.
- **Mutation checks (Part A's additions).** All 4 killed:
  1. The old guard expression is restored: the self-test throws.
  2. The guard is disabled: the self-test throws.
  3. The day-1 shape is ignored: the self-test throws.
  4. The committed-frame check is mis-wired: kept battles drop from 43 to 40.
- **Determinism:** all five parts (A, B, C, E, and D's `analyze`) were run twice and once under `TZ=UTC`: byte-identical.
- **Lint:** default config and gate config, `--max-warnings 0`: clean.
