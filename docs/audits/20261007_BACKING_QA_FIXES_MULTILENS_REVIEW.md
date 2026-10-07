# Backing — QA fixes (rounds 1–3): the BUILD_RULES §2 multi-lens adversarial review

**Date:** 2026-10-07. **Reviewed commit:** `915d03a6` on `backing/qa-fixes` (24 files, +979 / −116 against `main` at `8ce61c3d`) — the ≥10-file threshold. **The fix-forward commit:** `e38b3098` (the confirmed findings; 16 files, +390 / −79). **The build report:** `docs/audits/20261007_BACKING_QA_FIXES_BUILD_REPORT.md`.

## 0. Verdict

| | Count |
|---|---|
| Findings raised by the five lenses | 27 (R1 ×8, R2 ×3, R3 ×6, R4 ×6, R5 ×4), 4 of them duplicates across lenses → 23 distinct |
| Handed to the refuters | 23 distinct (every one) |
| CONFIRMED | 23 — of which 2 only in part (R1-7 confirmed as a readability nit, refuted as a factual contradiction; R5-4 confirmed as a real residue, refuted as reachable in the tester's round 2 and placed out of this PR's scope) |
| REFUTED outright | 0 |
| Blocking | 0 |
| Fixed in `e38b3098` | 17 distinct findings (with rows) |
| Accepted as designed / deferred, recorded | 6 (R1-5 = R2-3 design trade-off; R1-7 counsel copy; R5-4 separate tasking; R1-8 comment only; R1-1 = R4-5 resolved by the docs commit in this PR; R3-6 runbook sentence) |

No refuter was able to overturn a finding outright. The refuters did move severities and scope (R2-1 "partly visible, not fully off-screen"; R2-2 "not blocking: each commit was a user Confirm"; R5-3 "the source-text pin catches the obvious spelling, not a laundered one — the row is still worth it"), which is the adversarial pass doing its job.

## 1. Method

- **Isolation (BUILD_RULES §2, the reviewer-isolation ruling):** five path-distinct `git archive` extractions of `915d03a6` under the session scratchpad (`snap-r1` … `snap-r5`, LF, `node_modules` junctioned), one per lens; read-only on git and on the shared working tree; the mutating lens (R5) ran last on its own tree with per-file `.orig` copies and `cmp`-verified restores. The refuters reused the read-only lenses' trees (`snap-r1`, `snap-r3`, `snap-r4`), restored and `cmp`-verified every temporary edit.
- **Lenses:** R1 domain correctness (each item A–G against the ask and the surrounding invariants); R2 wiring and lifecycle (React state, effects, the remount seam, hooks, data flow); R3 the dark-merge / flag-off guarantee and namespace isolation; R4 test integrity and cross-phase consistency (rows vs mutations, docs vs product, golden, allowlist, imports); R5 the mutating lens (reproduce the author's 15 mutations; 23 vacuity probes of its own).
- **Refutation:** every distinct finding was handed to one of three refuters (A: the UI seam and the tests; B: scripts, namespace, docs; C: the mutating lens's findings) instructed to refute it with a concrete repro. Verdicts and evidence are in §3.
- **The author's own mutation checks** (15, run before the review on a scratch tree) are in the build report §7; R5 reproduced all 15 and found M-B reds 11 rows across three files, not the 4 the author counted (the five mobile-golden rows and the two desktop-seam rows red too).

## 2. The findings, by lens (as raised)

### R1 — domain correctness
- **R1-1** should-fix · the build report cited by seven files is absent at `915d03a6` (= R4-5).
- **R1-2** should-fix · the stacked-layout scroll effect does not re-run on Add from the receipt (= R2-1).
- **R1-3** should-fix · an agent-less seat WITH a recorded week heads its book column "{player}'s agent · 6" (`TeamCard.jsx:228`).
- **R1-4** nit · the agent-less row keeps the role tag "agent · runs 6" beside "No agent on this seat yet."
- **R1-5** nit (by design) · every onToStake remounts, so a second CTA press while a FORM is open discards its state (= R2-3's mechanism).
- **R1-6** nit · seed writes the pod and the manifest before the fence (= R3-4's first half).
- **R1-7** nit (copy) · the two adjacent refund lines read as a contradiction to a lay reader.
- **R1-8** nit · the preview fixture's `wallet.left - amount` deserves a comment.

### R2 — wiring and lifecycle
- **R2-1** should-fix · `moved` (`BackingDesk.jsx:255–261`) ignores `stakeEntry`, so at 769–980px the fresh form mounts below the fold unseen.
- **R2-2** should-fix · a Confirm in flight is abandoned by the card's CTA: the busy control unmounts, `setResult` is lost, a second Confirm can commit a second stake (two clicks, previously three).
- **R2-3** nit · the attestation step's ticked boxes reset on a second CTA press.

### R3 — dark-merge and namespace isolation
- **R3-1** should-fix · `COMPOSITION_EPOCH_FENCE_ENABLED` is TRUE at HEAD; cleanup's fence call preceded the single delete loop, so a closed epoch would leave the whole dev namespace unswept.
- **R3-2** should-fix · the dev record's accuracy baseline read PRODUCTION rank docs (`readRanksFor` without `{ dev }`), reachable as a real figure when a smoke session stakes a non-smoke `isDev` pod with real seats.
- **R3-3** nit · three "zero I/O while dark" sentences describe a retired posture.
- **R3-4** nit · a fence throw in seed printed a bare code with no cleanup hint (recoverable by a plain `cleanup`).
- **R3-5** nit · during a smoke the "mine" tab is the dev record and the "trainer" tab production (no mixed figure; the founder is never a smoke seat).
- **R3-6** nit · the five whole-collection `agents` scripts would count the two smoke agents if run mid-smoke.

### R4 — test integrity and cross-phase consistency
- **R4-1** should-fix · the "item B, the ladder" row's fixtures admit at most one preset, so the old largest-first default does not red it (item B is guarded by three other rows).
- **R4-2** nit · the item C row's "`left − amount` reds this row" claim is false: 1,000 − 250 = 750 = the reply.
- **R4-3** should-fix · the runbook's §7 "Smoke Rival A · 250 BP · settled" is stale; the label is the agent's name.
- **R4-4** nit · the runbook's loadout quote is truncated.
- **R4-5** should-fix · = R1-1.
- **R4-6** nit · the "cleanup's agent sweep" row re-implements the sweep inline rather than driving the script.

### R5 — the mutating lens
- **R5-1** medium · the script's sweep, its consider loop and the seed's fence are not guarded (three script-side deletions survive 115/115).
- **R5-2** low · the pure receipt row cannot distinguish "every debit" from "the last debit".
- **R5-3** low · the namespace decision's uid source is unpinned behaviourally (`?uid=` laundering survives).
- **R5-4** low (scope) · Your Backing's reveal still reads "{player}'s agent" for an agent-less seat.

## 3. The refutation pass — verdicts, evidence, dispositions

| Finding | Refuter | Verdict | Decisive evidence (short) | Disposition |
|---|---|---|---|---|
| R2-1 = R1-2 | A | **CONFIRMED** (minor) | Repro on the real screen with `matchMedia` matching ≤980px and `scrollIntoView` recorded: Add from the receipt gives no third scroll; with the entry in the key: `['card','right','right']`, and no scroll on the pods refresh. Nuance: the form begins ~62px under the CTA, partly visible. | **Fixed** (`BackingDesk.jsx` `moved` carries `stakeEntry` for the stake view) + row "R2-1 — STACKED". Mutation M-R2-1 red. |
| R2-2 | A | **CONFIRMED** (should-fix, not blocking) | Deferred `placeStake` on the real screen: the card CTA is enabled while busy; pressing it unmounts the busy control; the receipt never renders while `onBacked` fires; two distinct requestIds commit (stake 250 then a top-up to 500). The server cannot stop it (distinct requestIds are distinct debits by design). | **Fixed** (`StakeControl` `onPending` around `placeStake` and the attestation call, cleared on reply and on unmount; `BackingScreen`'s desktop `onToStake` / `onOpenSeat` / `onToCard` / `onSection` wait; the preview page the same) + row "R2-2 — a Confirm IN FLIGHT". Mutation M-R2-2 red. Mobile's pre-existing three-click class (the TopBar back during a request) is unchanged and noted. |
| R2-3 | A | CONFIRMED (nit) | `AttestationStep`'s ticks are local state inside the keyed control; a second CTA press remounts them unticked. No data loss. | **Accepted as designed**; the in-flight attestation half is covered by the R2-2 guard. |
| R1-3 | A | **CONFIRMED** (one line, inside OBS-001's scope) | Rendered `team.agent: null` + `lastWeek.agent: null` (and `agentName: null`): "Agent seat" above and "Draco's agent · 6" below on one card. Live path: an owner who deleted their agent after a played week (the user layer still banks; no battles exist). | **Fixed** (`CARD.tape.agentCol(lastWeek.agent?.agentName ?? (hasAgent ? agentName : CARD.agentSeat))`) + row. Mutation M-R1-3 red. |
| R1-4 | A | CONFIRMED (nit) | The six are NOT run for an agent-less seat: the orchestrator refuses the pipeline on a synthetic board for a real group. | **Fixed** (no role tag without an agent; `LayerRow` renders the role only when given) + assertion in the agent-less rows. Mutation M-R1-4 red. |
| R1-5 | A | CONFIRMED (behaviour change, by design) | Pre-fix the second press was a no-op; post-fix it remounts. The only state-preserving alternative needs the host to know the control's phase — the receipt special case the ask forbade. | **Accepted as designed**; recorded for the founder (report §8). |
| R4-1 | A | CONFIRMED (nit, test honesty) | The old `reverse().find` leaves the ladder row green; the presets, D-ag, R-A-8 and desktop top-up rows red (4/33). | **Fixed** (a 250-left case: 100, never 250) — the row now reds under the old default. Mutation M-R4-1 red. |
| R4-2 | A | CONFIRMED (nit) | `wallet.left − reply.stake.amount` leaves row 1 green (750 = 750); rows 2–3 red. | **Fixed** (the wallet mock says 900: `wallet.left` shows 900, `left − amount` 650, the reply 750). Mutation M-R4-2 red. |
| R4-6 | A | CONFIRMED (low) | The script has top-level side effects and no exports; the lib's header is "no Firestore handle". | **Fixed** with R5-1 (below). |
| R3-1 | B | **CONFIRMED** (should-fix, minor) | `COMPOSITION_EPOCH_FENCE_ENABLED = true` since 2026-08-16; a stub-db run of the real modules: closed/probe/closing → `EpochClosedError`, one read. Cleanup's fence sat before the one delete loop. The epoch is non-open only inside a founder-run composition runbook window. | **Fixed** (two sweeps: the dev namespace unconditionally; the agents behind the fence, KEPT with the run in the manifest while the epoch is held — the next cleanup finds them by id and by owner). Source-text tripwire pins the order. |
| R3-2 | B | **CONFIRMED** (should-fix) | `rankDocId` takes `{ dev }`; dev rank docs are written for `isDev` pods; a throwaway route run (smoke session, settled dev pool with a real seat holding production history) scored `accuracy.career.pools: 1` from PRODUCTION history. Reachable by a hand-crafted stake on a non-smoke `isDev` pod. | **Fixed** (`readRanksFor(db, ids, { dev })`; teams gathered only from the record's namespace via the shared `isDevPool`) + row 5. Mutation M-R3-2 red. The optional belt in `placeStake` (refuse a non-smoke `isDev` pod for a smoke session) is the stake primitive — out of this PR's scope; flagged. |
| R3-3 | B | CONFIRMED (nit) | Three sites. | **Fixed** (the script header, the cleanup comment, the allowlist note now say the fence is live and what it does). |
| R3-4 = R1-6 | B | CONFIRMED (both halves) | seed wrote the pod and the manifest before the fence; the half-seeded state IS recoverable by a plain `cleanup` (no agents on disk → no fence call). | **Fixed** (the fence is checked before the first write — a dry run forewarns — and an `EpochClosedError` stops with "nothing written … seed again once it reopens"). Tripwire pins fence-before-pod-write. |
| R3-5 | B | CONFIRMED (nit) | Two tabs, two replies; no figure sums both; unreachable as a mix. | **Fixed** (a runbook sentence). |
| R3-6 | B | CONFIRMED (nit) | All five scripts are dry-run or read-only by default; none is scheduled (package.json, vercel.json, workflows). | **Fixed** (a runbook paragraph). |
| R4-3 | B | CONFIRMED | `teamLabelFor` → `{ label: agentName, secondary: playerName }`; after the smoke's settlement no `agentId` is recorded (no battles), so the ownerId lookup still names "Smoke Scout". | **Fixed** (runbook §7). |
| R4-4 | B | CONFIRMED | `CARD.loadout` ends "· may change nightly". | **Fixed** (runbook §4). |
| R1-7 | B | CONFIRMED as a readability nit; **REFUTED as a factual contradiction** | `creditRefund` cancels the stake's debit on `careerNet` and never touches the allowance: "shows no change" (net 0) and "go back to your record" are one fact. | **Left** — the prompt's own wording, a single named constant for counsel; flagged (report §8). |
| R1-8 | B | CONFIRMED (nit) | The only `left − amount` in the tree; the page mounts only on dev / preview hosts. | **Fixed** (a comment). |
| R1-1 = R4-5 | B | CONFIRMED (PR-level) | Seven citations; the file is absent at `915d03a6`. | **Resolved by the docs commit** in this PR (the build report and this record). |
| R5-1 (⊇ R4-6) | C | **CONFIRMED** (should-fix) | Three script-side deletions survive every suite; the writer census's CLI guard is a bare `toContain`; source-text ordering pins are an accepted pattern here (`backingBetaFlags.test.js` pins auth-before-flag by `indexOf`). | **Fixed** (the sweep extracted to `scripts/backingSmokeSweep.js` — reads only, the script and the row call it; two source-text tripwire rows over comment-stripped `backing-smoke.js`: in `seed` the fence precedes the pod write and the agents write; in `cleanup` the shared sweep call, the consider loop, and namespace-delete → fence → agent-delete order, with no inline owner query). Mutations M-R5-1a/b/c red. |
| R5-2 | C | CONFIRMED (nit) | A last-debit-only fallback leaves the suite 37/37; the proposed case reds it. | **Fixed** (the case added). Mutation M-R5-2 red. |
| R5-3 | C | CONFIRMED (low) | Mutant A is caught by the source-text pin; mutant B (`((user) => smokeOverrideFor(user.uid))({ uid: req.query.uid ?? user.uid })`) keeps the pinned spelling and survives both suites. | **Fixed** (row 4: smoke env on, `?uid=<allowlisted>`, a non-allowlisted token → production, its own wallet only). Mutation M-R5-3 (mutant B) red. |
| R5-4 | C | **CONFIRMED out of scope**; refuted as reachable in round 2 | The smoke seats carry no picks and no battles, so the reveal rendered "The books show once the pod has drafted."; the ask's item D is "no line on the TEAM CARD"; a Your Backing fix needs the team-labels route to carry an agent-exists bit (the labels payload cannot tell "no agent" from "unprintable name", and `YourBacking.test.jsx` pins the latter). | **Separate tasking** (report §8). |

## 4. Verification of the fix-forward commit `e38b3098`

- **Full suite** on an LF `git archive` of `e38b3098` (pre-read, `--maxWorkers=10`): `Test Files  16 failed | 850 passed | 6 skipped (872)` and `Tests  32 failed | 17961 passed | 87 skipped (18080)`. The 16 failing files are exactly the known Windows-only set and their 32 rows are identical to the base's (`8ce61c3d`, the same 16 files re-run on an LF snapshot: branch-only 0, base-only 0). The film-tape timeout seen on the first commit's run did not recur.
- `npm run lint:gate` exit 0 and `vite build` exit 0 ("built in 49.95s") on a second, path-distinct extraction of `e38b3098`.
- The protected-store write scan and the writer census green: the batch.delete's key moved from `::cleanup::delete` to `::deleteAll::delete` (count 1) with its note; the new `scripts/backingSmokeSweep.js` writes nothing.
- Both flags still `false`; no fenced file; the stake / settle / refund routes and the seal untouched by either commit.
- The two source-scan rows that time out under a full parallel run on this machine (`backingBetaFlags` "EVERY importer…", `backingRawIds.guard` "walks the visible text…") pass alone (18/18) — the known load class, not a change.

## 5. The mutation checks added by the fix-forward commit (run on a scratch LF tree of `e38b3098`; every mutated file `cmp`-verified against the commit afterwards)

| Mutation | Rows that went red |
|---|---|
| M-R2-1 drop the entry count from `moved` (BackingDesk) | "R2-1 — STACKED" (1; 4 green) |
| M-R2-2 drop the pending guard on the desktop `onToStake` | "R2-2 — a Confirm IN FLIGHT" (1) |
| M-R1-3 the book column keeps the fallback name | "a recorded week on an agent-less seat" (1) |
| M-R1-4 the agent-less row keeps the role tag | the first-week agent-less row + the recorded-week row (2) |
| M-R4-1 the old largest-first default | the ladder row (now the 250 case) + the four rows that already caught it (5) |
| M-R4-2 the receipt computes `left − amount` | item C rows 1–3 (3) — row 1 now sees it (650 ≠ 750) |
| M-R5-2 the fallback checks only the last debit | the pure row (1) |
| M-R5-1a seed: the fence dropped before the first write | the seed tripwire (1) |
| M-R5-1b cleanup: the shared sweep call dropped | the cleanup tripwire (1) |
| M-R5-1c cleanup: the unconditional namespace delete dropped | the cleanup tripwire (1) |
| M-R5-3 the namespace decided for `?uid=` through a laundered call that keeps the pinned spelling | row 4 (1) |
| M-R3-2 the dev record reads production rank docs | row 5 (1) |

## 6. What the review did not find (stated so the record is not read as silence)

- No blocking finding. No fenced file, no stake / settle / refund route, no seal line and no flag was touched by either commit (R3 verified both flags `false`, the dark pin green on an LF tree, the 404 preceding the smoke decision, no module-scope side effect in any client diff).
- The E gate (every `agents` reader that queries by anything but an id or `ownerId`) was independently re-run by R3 and matched the author's list exactly: five operator scripts and the archived, rules-denied client leaderboard; no cron, deployed route, `collectionGroup` or listing; the smoke pod is never listed by the orchestrator and never a live-draft pod.
- The golden's 12 moved rows were each explained by R2 and R4 independently (B: the pre-chosen preset; C: the allowance line; G: the refund line) and no row that should have moved was missing.
- The receipt's allowance figure is bound to the same wallet field as the points meter and never on screen beside it (R1, R2: not a §9 display-agreement violation).
