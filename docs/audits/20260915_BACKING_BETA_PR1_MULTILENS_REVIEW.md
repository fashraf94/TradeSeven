# Backing Beta PR 1 — Multi-Lens Adversarial Review (BUILD_RULES §2)

**Date:** September 15, 2026
**Branch:** `backing/pr1-wallet-week-rules`
**Base:** `main` @ `a007a2b5dfe0ac1471c4edacebfcfeddc3ec05e8`
**Reviewed commit:** `e8e16538` (13 files, +3,042/−1)
**Spec:** `FANTASYTRADES_BACKING_BETA_SPEC_V1_3.md` §12 PR 1 + Amendment A §A6
**Fence status:** NON-FENCED. No BUILD_RULES §1 file read or written. §2.3 import-boundary ratchet not tripped.

---

## 1. Why this review, and how it was run

BUILD_RULES §2 makes review mandatory at ≥10 files **or** ≥1500 lines; this diff is 13 files / ~3,042 lines. `/code-review` does not exist in this environment, so the mandate was met operationally.

**Five independent lenses**, then **three refuters** instructed to *refute* each finding with a concrete repro:

| Lens | Dimension |
|---|---|
| A | Domain correctness of the window / week math |
| B | Ledger and economy integrity |
| C | Dark-merge guarantee, scope, and the fence |
| D | Test integrity (the mutating lens — ran last) |
| E | Firestore security rules and data access |

**Reviewer isolation (founder ruling Sep 2, 2026).** Eight path-distinct `git archive e8e16538` extractions under the session scratchpad, `node_modules` symlinked, one per reviewer; every reviewer read-only on git and on the shared working tree. The mutating lens (D) ran last. Verified throughout: shared tree `git status --porcelain` empty, HEAD unchanged, and none of lens D's mutation fingerprints present anywhere in the repo.

**Verdict: 3 BLOCKER/MAJOR confirmed, 9 rescoped, 14 refuted, 18 test-integrity gaps closed. No live functional defect — the PR is dark and nothing calls it — but three real latent hazards and a large unratcheted-guarantee surface.**

The refutation pass earned its keep: it **killed two fixes the coordinator had already started**, and **corrected the design of a third**.

---

## 2. What the lenses proved CLEAN (and how hard)

Recorded because a review that only lists defects misrepresents the diff.

| Claim | Evidence |
|---|---|
| Week arithmetic | 1,357 Mondays (2015–2040); 9,497 ET day boundaries; 56,861 samples vs an independently-written oracle; 2,103,840 minute-granularity containment samples; all 9 real NYSE holiday Mondays + a synthetic year-boundary one; all four slot closes; the A-C6 label-where-a-Monday-is-needed class. **0 defects.** |
| §2 one-allowance-per-pool | 77,025 open-window cross-checks (lens A) + 45,100 edge-exact samples (refuter). **0 mismatches.** Holds by construction. |
| Ledger invariant under the documented contract | 800 randomized 24-operation sequences, re-checked after **every** step. **0/800 violations.** |
| Read-freeness / §8 composability | 5 primitives composed after 1 `readWallet` ⇒ exactly 1 read. Confirmed. |
| Concurrency shape | Whole-doc `tx.set` from the transaction's own read = the `tournamentRank.js` idiom; doc is in the read set, so a contended commit aborts and retries correctly. |
| Rules | 24 mutations × 28 rows ⇒ **zero vacuous rows**; 36 collection-group probes all denied (with a control proving a mid-path `{document=**}` does not open collection-group scope); full verb × identity matrix clean; all 7 pre-existing rules suites green (162/162) against the new ruleset. |
| Fence & darkness | Full 9-file transitive import graph of the three new modules: no fenced file, no scoring engine, no `createAgentBattle`, no archetype-table importer. Client bundle contains none of the backing copy, constants or collection names. |
| Flag-pin discipline | FLIP MAP executed literally (3 edits) ⇒ green suite; unreconciled flip ⇒ reds with the FLIP MAP as its printed remedy. |
| Allowlist ratchet | Verified in both directions (write added, write removed, unlisted site added). |
| Constants module | 26/26 mutations killed — the strongest-guarded file in the diff. |

---

## 3. CONFIRMED findings and their fixes

### 3.1 Composition contract was prose, not mechanism — **MAJOR** (lens B 1)

Every primitive commits the whole wallet doc, so composed calls must build on each other. A caller passing the stale doc twice re-minted spent allowance, inflated `careerNet`, and dropped the first entry's `appliedEntries` key **while its entry document still committed** — un-guarding that entry id for replay. Measured at **19%** of naive two-primitive compositions under a rollback-correct harness, and **4/4** of the PR-3 settlement shape (§3/§7 pay or void every stake of a pool at once).

**The refuter corrected the fix twice**, and both corrections were load-bearing:
1. A `WeakMap` keyed on `tx` alone has a **false positive** — PR 3 settles many backers' wallets in one transaction, so the key must be `(tx, ref.path)`.
2. Firestore reuses **one** `Transaction` object across retry attempts, so a naive guard makes a retried settlement read the *discarded* attempt's state, take the replay path, and **silently lose a payout** — while the ledger re-fold still reports zero violations. `readWallet` must therefore clear its own entry.

**Fixed:** module-private `WeakMap<tx, Map<path, wallet>>`; each primitive resolves `latestFor(...)` instead of trusting the caller; `commitWallet` records; `readWallet` clears. Proven with a rollback-correct harness committed as a test: the retried payout survives (`careerNet 500`, applied, not replayed). Un-threaded settlement now yields the correct wallet.

*Byproduct:* the Map helpers originally took `(tx, ref, doc)` and called `.set()`, which the B3-EXT write scanner classifies as an unresolved **Firestore** write. Rather than allowlist a write that does not exist — which would have put a false claim in the human-review file — they now take `(scope, path, nextState)`.

### 3.2 `ensureAllowance` had no ordering guard — **MAJOR** (lens B 4, CONFIRMED at severity)

A `weekKey` behind `lastAllowanceWeek` was treated as a first touch: it expired the **live** week, re-keyed the wallet to a dead one, and locked every stake for the live week out of `debitStake` permanently — **and the §6 cache/ledger re-fold is blind to it**, because the cache still matches the (wrong) current week. Sub-case: `lastAllowanceWeek === weekKey` with the entry missing **refilled** mid-week with no entry recording the loss.

**Fixed:** typed `week_out_of_order` refusal (week labels are `YYYY-Www`, so lexical order is chronological) and a typed `allowance_state_anomaly` rather than a silent refill. `expired` moved inside the write guard so it only ever names BP an entry records.

### 3.3 The "no caller" guarantee was unmechanized — **MAJOR** (lens C 1)

PR 1's central claim is that nothing calls it. It was true, but nothing held it: wiring `touchWallet` — the one function that opens a transaction and **writes** `backingWallets/{walletId}` — into a production cron left **all 12,723 tests green**, byte-identical pass counts. PR 0 had mechanized the equivalent claim with an `importersOf()` helper and did not get reused.

**Fixed:** importer rows pinning the exact importer set of all three PR-1 modules, a non-vacuity row, and a basename sweep covering the `@/` alias spelling `importersOf` cannot resolve. Mutation-verified: the cron wiring now reds.

### 3.4 Whole-doc `tx.set` destroyed `trainerStats` — MINOR now, MAJOR when PR 5 lands (lens B 2)

§6's wallet row names `trainerStats {season, career}` — PR 5's private trainer beta-stats (D-w) — on this same document. `normalize` returned six fields, so every allowance grant erased it. The `tournamentRank` idiom gets away with this only because that doc has one writer; this one will not.

**Fixed:** `normalize` spreads the original document first.

### 3.5 `seasons.{m}.net` is not §2's Net BP — MINOR, **and it constrains PR 3** (lens B 3)

The docstring said `careerNet` and `Σ seasons.*.net` "differ by the stakes not yet settled". Measured: the gap is **Σ ALL stakes, permanently** — a stake never receives a month attribution at all. A backer down 350 BP renders **+650** for the month, and §5 renders this as "Net BP (season)".

The arithmetic is exactly what the build brief prescribes, so this is a documentation defect, not a build error. But the deferral was also false: **PR 1's primitives cannot close it** — `creditPayout(amount: 0)` is refused, and `debitStake` takes no `monthKey`.

**Fixed:** both sentences corrected to state the gap exactly and to say plainly that PR 3 needs a new month-attributing primitive (including the LOST path) or a `stakeAmount` argument. **Raised to the founder as the one PR-1-shaped decision not made unilaterally.**

### 3.6 Dev-namespace id collision — NIT by reachability, fixed anyway (lens B 10 / lens E 1)

Two lenses converged from different angles: `walletIdFor('x', {dev:true}) === walletIdFor('dev-x')`, so one document is both x's dev wallet and the production wallet of a uid spelled `dev-x` — two ledgers in one doc, and an owner-read rule that cannot tell them apart.

**A factual disagreement between reviewers was resolved by direct check.** One refuter asserted no `createCustomToken` exists; it does — `scripts/ws1-observe-walk.js:245` and `scripts/test-signal-drop-pipeline.js:493`, with an operator-supplied `--uid`. So it is operator-reachable, though an actor holding that service-account key already bypasses rules entirely via the Admin SDK.

`backingWallets` is the **first** collection combining a `dev-` id scheme with an *owner-scoped* read; `rankDocId`/`leaderboardDocId` share the shape but are authed-read-all, so they have no owner scoping to subvert.

**Fixed, both halves:** `walletIdFor` refuses a uid already in the dev namespace (typed `invalid_uid`; zero false-positive cost — Firebase Auth mints hyphen-free 28-char uids), and `ownsBackingWallet` excludes `dev-` ids from the plain-uid clause so the rule stands on its own. New emulator rows cover the collision direction, which lens E showed the suite was blind to.
**Reported for separate tasking (BUILD_RULES §3):** the `rankDocId` / `leaderboardDocId` siblings.

### 3.7 Out-of-range instants escaped the "never throws" contract — MINOR (implied by lens D W45)

`msOf` accepted any finite number, but JS Dates are valid only within ±8.64e15 ms, so `battleMondayEtDateFor({ createdAt: 8.64e15 + 1 })` threw a `RangeError` out of a documented total function.
**Fixed:** range-guarded; epoch-ms instants now work and out-of-range returns `null`.

### 3.8 Other confirmed fixes

- Calendar round-trip guard (`2026-13-45` / `2026-02-30` gave silent wrong windows; `9999-99-99` threw) and a **Monday guard** on the exported `backingWeekFor`, making a documented contract mechanical.
- Slot pods now derive their fallback Monday from `scheduledDraftAt`, not the claim instant.
- Typed `invalid_now` in all three primitives (`0`/`null` had stamped 1970 on the ledger's only audit timestamp; an unparseable value threw an untyped `RangeError` that PR 2 would map to a 500).
- `requireId` rejects `/` (the only separator that actually breaks a document path — `.`/`..` are safe because every entry id carries a `type:` prefix).
- Corrupt cached numerics floor/round to integers rather than minting fractional BP. *A reviewer's suggestion to zero them was rejected as needlessly destructive; flooring can only under-credit.*
- Allowlist note: the false "nested transaction" justification removed; entry field count stated exactly.
- `firestore.indexes.json` EOF byte restored so the diff is **28 insertions, 0 deletions**.
- Header prose corrected: the duplicated-helper count (~9 lines, two helpers) and the inherited `etDateToUtcNoon` misnomer, whose rename belongs with the original (BUILD_RULES §3).

### 3.9 Test integrity — 18 gaps closed (lens D)

Lens D ran **181 catalogued mutations**: 141 killed, **40 survived**. Every surviving mutation named a row that could not fail under its own defect — BUILD_RULES §2's definition of a non-guard. Closed, then **re-verified by re-running each mutation**:

| Mutation | Was | Now |
|---|---|---|
| All six `POOL_INELIGIBLE` wire values renamed | green | **red** |
| `isDev`/`isTraining` `=== true` → truthiness | green | **red** |
| unreadable-`now` branch replaced with `throw` | green | **red** |
| clock/fire `>=` → `>` (exact tie) | green | **red** |
| `POOL_INELIGIBLE` / `ENTRY_TYPES` unfrozen | green | **red** |
| `BACKING_WALLETS_COLLECTION` value renamed | green | **red** |
| `readWallet` returns `{}` instead of `null` | green | **red** |
| `requireId(stakeId)` dropped from `debitStake` | green | **red** |
| `touchWallet` passes `new Date()` instead of `now` | green | **red** |
| `DARK_BY_DESIGN` entry **deleted** | green | **red** |
| new export added to either `api/` module | green | **red** |

Also corrected: the `assertLedgerAgrees` header **overstated its own independence** — its season fold restates the writer's `monthKey` stamping rule, so it is blind to the symmetric case (writer stops stamping *and* stops bucketing). The header now states that limit exactly, and an explicit row pins each credit entry against **the caller's** `monthKey` — a value the fold never sees. Two FLIP-MAP rows that matched a surviving prefix (`/PR 1 — NONE/` still matched a line that went on to name a route; `404s` still matched a docstring rewritten to say routes 404 *before* auth) now pin whole phrases.

---

## 4. REFUTED — findings that did not survive

Recorded because a review that never refutes itself has not been run adversarially.

| Finding | Why it fell |
|---|---|
| **`poolEligible` is `true` before `opensAt`** (MAJOR) | It is the **materialization** predicate, not an is-open check. §4 materializes pools lazily, so `closesAt − max(now, opensAt)` is the pool's life *if created now*. §2 verified intact across 122,125 samples. The 780/780 population used claim offsets `claimSlotSeat` cannot produce (`nextSlotFireInstant` caps `createdAt` at <7 days). |
| **The last 24h of every window is unreachable** (MAJOR) | An already-open pool is governed by its own pool doc and PR 2's server-clock window. The "33–67%" band is an arithmetic tautology of choosing 36–72h windows; a Monday-formed pod is 14%. The implied fix reds the row that pins the behavior by name. |
| **Close the 999 ms tiling sliver** | Would red **17 of 50 tests** and contradict §4's "Sunday 23:59 ET". The 1 s gap is asserted on purpose. Lens A's claim that the containment row "cannot fail" was itself false — it does fail under the defect its title names. |
| **Require a `stake:` entry before crediting** | Would refuse legitimate payouts after any `appliedEntries` rebuild, and a stakeless payout is impossible under §8's one-transaction-per-stake. Paid-and-refunded is deliberate: §7's admin-refund paths can follow a settlement, and exclusivity lives on the stake doc's `status`. |
| **Scope creep** (5 items) | All five are prescribed **verbatim** by the founder's build brief. Judging against §12's one-line summary row was the error. |
| **§4 dependency-surface prose is false** | It is §4's own parenthetical, present verbatim in 20 pre-existing files; §4's three operative requirements are met, and the new `src/` surface is locked by a mutation-proven zero-import source scan — structurally stronger than a runtime guard. |
| **`backingStakes` `excluded`/`fingerprint` are owner-readable** | PR 1 writes no stake; the fields and their access are spec §6's. Firestore rules cannot filter fields, so no PR-1 change could address it. *Reported for separate tasking against PR 2.* |
| **`backingPools` is enumerable** | Identical to `tournamentGroups`/`tournamentRanks` today and specified as authed-read by §6; sealed data sits behind `read: if false`, and rules cannot backstop Admin SDK writes at all. |
| **Collection-group coverage gap** | Closure is structural — Firestore admits a collection-group query only via a recursive-wildcard rule, and none exists. Rows added anyway as cheap hardening. |
| Trailing-newline / rules-SHA / expiry `at` / non-Monday argument / `opensAt > closesAt` / `etDateToUtcNoon` DST claim | Each either prescribed by spec, already handled and tested, or factually mis-stated. |

---

## 5. Post-fix state

- `npm run test:run` — **exit 0**, `Test Files  670 passed | 3 skipped (673)`, `Tests  12695 passed | 64 skipped (12759)`
- `npm run test:rules` (real emulator) — **exit 0**, `Test Files  8 passed (8)`, `Tests  196 passed (196)`; `backingDenials.rules.mjs` 34 rows
- `npx vite build` — clean
- `npm run lint:gate` — clean, 0 warnings
- Flags still `false`; zero fenced files; `src/constants/leagueTournament.js` untouched; `vercel.json` untouched (cron count still 39/40)
- `firestore.indexes.json` diff: 28 insertions, 0 deletions

---

## 6. Disclosures

- **Every lens completed.** No lens was skipped or partially run.
- One reviewer's factual claim (no `createCustomToken` in the repo) was **wrong** and was corrected by direct check before it changed a decision.
- Lens D audited `e8e16538` while the working tree moved ahead with fixes; it flagged this itself and spot-checked which findings still applied. All 40 surviving mutations were re-run against the final tree.
- A Firestore emulator leaked by a reviewer (port 8080) was reaped before the final `test:rules` run.
- **Open for the founder — the one decision PR 1 did not make:** how PR 3 attributes a stake to its ladder month (§3.5). PR 1's primitives cannot express it, and `seasons.{m}.net` must not be rendered as §5's "Net BP (season)" until it is resolved.

---

*Review run September 15, 2026. 5 lenses + 3 refuters, 8 isolated snapshot trees. Fixes applied on the branch; PR opened, not merged.*
