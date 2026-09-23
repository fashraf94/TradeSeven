# Backing Beta PR 5 — multi-lens adversarial review record

**Branch:** `claude/backing-pr5-results-stats-refunds-7859p9` (the harness-assigned branch; the task prompt named `backing/pr5-results-stats-refunds` — see the PR body) · **Reviewed commit:** `363bde92` (the build) · **Fix commits:** `f49e200b` (WIRE-1/2/3, MONEY-1/2/5), `db640016` (HON-2/3/4/5/6/8/9/10/18, DARK-2/4/5, WIRE-8), `5286050e` (MONEY-3/4/7/R-1/R-3/R-4, WIRE-4), `b5d14874` (HON-3(b)/HON-R-2/HON-R-3/HON-11/HON-12/HON-19/HON-R-1, DARK-1/3/6/R-1/R-4) · **Base:** `main`.
**Rule:** BUILD_RULES §2 — review is mandatory at ≥10 files or ≥1,500 lines (this branch at `363bde92`: 62 files, +6,013 / −75). Multi-lens, adversarial, independently refuted, `vite build` run, mutation-checked, written down.
**Reviewer isolation (founder ruling, Sep 2, 2026):** every lens and every refuter worked on its own `git archive 363bde92` extraction under the session scratchpad (`review/lens-{money,dark,honesty,wiring}`, `review/refute-{money,dark,honesty,wiring}`), `node_modules` symlinked, read-only on git and on the shared working tree; probes and mutants ran only in those trees and every mutated file was restored byte-identical (`cmp` / `sha256sum`). The mutating lens (the coordinator's six required checks and the per-fix guard checks) ran on `tar` copies of the working tree under `scratchpad/mut/`. No reviewer touched `/home/user/TradeSeven`.

## 1. Scope

Backing Beta V1.3 §12 PR 5 plus the §2G carry-ins, mobile layout only, dark behind `BACKING_BETA_ENABLED = false`: (A) the refund primitive `refundPool` with its triggers (settlement routing of voided/expired/deleted pods; the admin endpoint's `action: 'refund'`); (B) settle-on-read moved from the pod list to the results reader; (C) `GET /api/backing/results` and the results card (Surface E) in the Spectate final state and on the Backing screen; (D) `GET /api/backing/my-stats` and `GET /api/backing/trainer-stats` with their mobile home under the pitch; (E) `POST /api/backing/event`, `stake_confirmed` written server-side, the client emitter; (F) the read-only admin Sybil watch; (G) the Diversifier's backing-safe approach line and the dev preview page's results/stats states.

Not in scope and not reviewed as this PR's: desktop layouts, the activation PR's dev-namespace smoke, the gate-3 honesty fixes, any public ranking, any fenced file (none touched), any change to close/validity/stake logic beyond the `stake_confirmed` write.

## 2. Method

| Lens | Brief | Tree | Agent |
| --- | --- | --- | --- |
| MONEY | Founder's brief: "lose or duplicate someone's points through a refund" — idempotency, races, the wallet pairing, the month, the namespaces, the gates, the results reader as a settlement host, the race harness's integrity | `lens-money` (363bde92) | 1 read-only reviewer |
| DARK | The flag-off guarantee: byte identity per host, no read or request while dark, the four routes' 404-after-auth, ratchet completeness, vacuity of the dark rows, tokens and lexicon | `lens-dark` (363bde92) | 1 read-only reviewer |
| HONESTY | BUILD_RULES §9 on every figure and word: the card's provenance, the stats' definitions and the naive baseline, telemetry truthfulness, copy, the Diversifier line, the Sybil report's claims | `lens-honesty` (363bde92) | 1 read-only reviewer |
| WIRING | End-to-end wiring and lifecycle: settle-on-read's guards, pagination, every new Firestore query against the indexes, `stake_confirmed` placement, hooks and effects, the import rule, test integrity | `lens-wiring` (363bde92) | 1 read-only reviewer |
| MUTATION | The six required mutation checks (§4) and the per-fix guard checks (§6) | `mut/*` (tar copies of the working tree) | the coordinator |
| REFUTATION | Every finding of each lens handed to a refuter, on its own tree, with the instruction to refute it with a concrete repro on the original tree and to assess each proposed fix | `refute-{money,dark,honesty,wiring}` (363bde92) | 4 read-only refuters |

Nine agents in total. Each report is reproduced in substance below; the full reports are in the session transcript and under `scratchpad/review/reports/`.

## 3. Findings and dispositions

Severities as the lenses gave them, with the refuter's ruling where it moved. **Disposition** is the coordinator's; the CONFIRMED/REFUTED split is §5.

### MONEY lens — 8 findings (0 blocker / 0 major / 4 minor / 4 notes); refuter added 5

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| MONEY-1 | MINOR (test) | The "concurrently" race row's inline comment named the REFUND's in-transaction gate as its mutation check; on the harness the refund commits first deterministically, so the row exercises the SETTLEMENT's gate only (the refund's gate is carried by the two "lands between" / "two refunds" rows). | **FIXED** (`f49e200b`) — the comment names the rows that carry mutation check 2; no timing pin added (the refuter showed a pin would flip with any added read). |
| MONEY-2 | MINOR (test) | The crash-mid-refund row crashed at one write only (the 3rd); a refund that skipped the PRIOR-voided stakes' wallet reads passed 40/40 while, from a partial store, it would mint a one-stake backer's wallet from nothing. | **FIXED** (`f49e200b`) — the row sweeps every write position (21), pinning the 3rd and 8th shapes; reds 1/41 under the lens's mutant P6 (§6). |
| MONEY-3 | MINOR (posture) | `refundPool` refunded AROUND a `won`/`lost` stake in a `closed` pool (out-of-band shape), sealing a recoverable book as `refunded` with a payout the ledger never credited then shown on the card (MONEY-R-2). | **FIXED** (`5286050e`) — a RETURNED `corrupt_book` refusal with zero writes (the refuter refuted the proposed THROW: on the versioned harness a mixed read would turn a race into a hard error — MONEY-R-1); row added with the Console repair re-run. |
| MONEY-4 | MINOR (stuck state) | A 96–120-stake book settles but can never be refunded (5 writes per refunded stake vs 3 per loser); the admin route's header promised an "admin void" exit that does not exist; "≤ 40 stakes per pool" is ASSUMED and unenforced (five backers at the per-backer cap reach 100). Inherited class (PR 3's settlement holds the same way above 120 stakes). | **FIXED (prose) + RECORDED** (`5286050e`) — the constant's doc and the route's header state the stuck state, the real Console procedure and its two traps (the group's own reason; release with `settle` + `overrideHold`, since `refund` + `overrideHold` writes `admin` and skips a stake voided under another reason — MONEY-R-5); a batched refund (priors costed at 0 once applied, wallets read before the ceiling) is the follow-up; a per-pool stake cap is a §2/§3 founder call. |
| MONEY-5 | NOTE | The ledger month was unpinned for the refund across a month boundary (a holiday Monday whose day 1 banks next month). | **FIXED** (`f49e200b`) — row added (voided → the banked day's month; expired → the pool's Monday); reds under a pool-only month (§6). |
| MONEY-6 | NOTE | One backer's out-of-band-deleted wallet aborts the refund for every backer (`wallet_missing`), stranding the pool `closed` until restored. | **RECORDED** — inherited posture (PR 3 finding 17); recoverable. |
| MONEY-7 | NOTE | A future per-stake void on a `closed` pool that does not re-derive `private/totals` would overpay: settlement reads the sealed pot, and the Σ guard measures against it. | **RECORDED** in the route's header beside MONEY-4 (not a PR 5 defect). |
| MONEY-8 | NOTE | Any authenticated viewer can trigger settlement/refund of any pod through `GET /api/backing/results?groupId=`; the outcome is viewer-independent, gated, idempotent and rate-limited; a viewer can move a `closed` pool into a `stake_ceiling` hold. | **RECORDED** for the security lens; not a money defect. |
| MONEY-R-1 | NOTE | The versioned harness hands a body a MIXED read (one document before, the next after a competing commit) that the server's pessimistic read locks never do; any new THROWN abort in a read phase that depends on two documents agreeing turns a race into a hard error on the harness. | **FIXED** (`5286050e`) — stated in the harness header; the refund's refusals are returned. |
| MONEY-R-2 | NOTE | In MONEY-3's terminal state the card showed `payout 700`, `net +400` under `outcome: refunded` while the ledger held −300. | **FIXED** with MONEY-3 (the state is refused). |
| MONEY-R-3 | NOTE | A malformed stake amount reached the refund's writes phase before the wallet primitive refused it. | **FIXED** (`5286050e`) — refused before the first write; row added. |
| MONEY-R-4 | NOTE | `monthKeyForPool`'s docstring ("which no voided pool can reach") was made false by the refund. | **FIXED** (`5286050e`). |
| MONEY-R-5 | NOTE | The hold-release ACTION silently decides whether a Console-voided stake is refunded. | **RECORDED** in the route's header (folded into MONEY-4). |

Clean (verified by the lens and re-verified by the refuter, citations in their reports): the `refund:`/`loss:`/`payout:` keys suffice and the `loss:{id}` "collision" is benign (one writer through the gate, an identical entry a no-op on replay); a crash mid-refund converges through the `prior` re-visit; two refunds racing → one `refunded`, one `already_refunded`, one pool write; refund vs settlement in both orders and concurrently (exactly one commits, the loser conflicts and answers); the SDK retry on one Transaction object resets the wallet memo; a backer's second stake is applied on the first pair's returned wallet AND the per-transaction memo; dev stakes reach dev wallets only; one `monthKey` feeds both halves of every pair so `seasons.{m}.net` moves by exactly zero; the cheap gate and the in-transaction switch enumerate every status; `settlePool`'s routing for a missing/voided/expired group in every pool state; the 95/96 ceiling boundary; the hold written only from `closed`; `wallet_missing` thrown in the reads phase before any write; the results reader as a host: close-if-open, the `!== closed` skip, the freeze in front of the call, `resolving` never touched, two viewers on one voided pod → exactly one refund; the admin route: `reason` required and logged only, the freeze not gating the refund by design, `simulatedNow` dev-only; stats and results count a voided stake as neither backed nor won and net it at zero.

### DARK lens — 9 findings (0 blocker / 1 major / 4 minor / 4 notes); refuter added 4

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| DARK-1 | MAJOR (test) | The bare-mount source guard in `backingDark.test.jsx` was VACUOUS on every real host: `stripBraces` (the PR 4 R-B-7 rewrite, `0e65bbaa`) dropped every character at brace depth ≥ 1, and every host mounts inside a block-bodied function, so `soleChildWrapped` could never be true; a sole-child wrapper around either PR 5 mount passed 28/28. Nothing ships wrapped (the lens's SSR diff harness proved byte identity). | **FIXED** (`b5d14874`) — the guard strips ATTRIBUTE-VALUE brace expressions only (a function body survives; the R-B-7 case `onClick={() => open()}` is still covered), the self-test row repeats both cases inside a function body, and a POSITIVE CONTROL wraps every real host's mount in memory and demands the guard say so. A planted wrapper around the Spectate mount now reds (§6). |
| DARK-2 | MINOR (test) | The emitter's per-session dedup was never reset between rows, so a dark emit of a key a lit row had already sent (`window_viewed`) was swallowed by the "makes NO request" rows in `backingDark.test.jsx` and `BackingPreviewScreen.test.jsx`. | **FIXED** (`db640016`) — `__resetBackingTelemetry()` in both suites' `beforeEach`; the refuter's planted dark emit reds with it. |
| DARK-3 | MINOR (test) | Only `LeagueHome` and `Spectate` had a MOUNTED-dark "no read" row; `EquipStation`, `LeagueLobbyDesktop`, `IdentityPanel` were SSR-only, and the importer ratchet lets an enumerated HOST import any hook, so a host-side hook call while dark slipped both suites. | **FIXED** (`b5d14874`) — one row mounts all four hosts (the pod sheet included, DARK-R-1) dark and asserts no element, no read, no request; a planted hook in `EquipStation` reds (§6). |
| DARK-4 | MINOR | No exact importer list for the four PR 5 server helpers; `routesNamed` is token-only, so a route named without `backing` that imports a helper carried no obligation. | **FIXED** (`db640016`) — exact lists for `backingEvents` / `backingResults` / `backingStats` / `backingSybilWatch`, and a row holding every `api/` route that reaches any backing helper to the enumerated doors (the refuter refuted "extend `routesNamed`": `attest.js` is gated by the other flag). |
| DARK-5 | MINOR | `backing-settle.dark.test.js` carried no refund body; a refund branch placed ahead of the flag slipped it. | **FIXED** (`db640016`) — refund, hold-release and bogus-action bodies added. |
| DARK-6 | NOTE | `import.meta.glob` is a spelling the importer walk cannot see (one precedent in the repo). | **FIXED** (`b5d14874`) — a glob sweep beside the alias row. |
| DARK-7 | NOTE | A wrapper shared with a sibling (two children) is outside the guard's sole-child definition; the SSR-diff harness catches it. | **RECORDED** — a known limit. |
| DARK-8 | NOTE | `flagPinGuard`'s "Pinned by" row is satisfied by any mention in the docstring window (the FLIP MAP prose names the file too). | **RECORDED** — a pre-existing guard outside this PR's files (BUILD_RULES §3); the strict line-only match is verified safe by the refuter. |
| DARK-9 | NOTE | The "would be a 400" dark row is redundant (not vacuous) for the two stats routes, which validate no input. | **RECORDED**. |
| DARK-R-1 | MINOR (test) | `PodSheet` (part of an enumerated HOST) was never mounted dark. | **FIXED** with DARK-3. |
| DARK-R-2 / R-3 | NOTE | A capitalized wrapper component, or a `>` inside a quoted attribute, is invisible to the opener regex under both strippers. | **RECORDED** — known limits beside DARK-7. |
| DARK-R-4 | NOTE | The SSR rows never asserted `svc.calls`. | **FIXED** with DARK-3 (the mounted rows assert it). |

Clean: every host PR 5 touched renders byte-identically to `424b2e85` with the flag false, SSR and mounted (the presence face's rAF frame aside, identical after normalising), React ids identical, zero service or `fetchWithAuth` calls in every dark mount; both mounts bare; call-time gates with every hook behind them; the preview page imports only the pure surfaces and its gate is unchanged; the four routes read the bare constant after `requireAuth` and answer the shared 404 body; the dark suite mocks the flag to an explicit false; `stake_confirmed` refused from the client; the ratchets red a planted importer, route, alias, forbidden term, `agents` read and flag flip; `backingEvents` is `read, write: if false` (pre-existing rules); zero raw hex or transition literals in the new files.

### HONESTY lens — 21 findings (0 blocker / 5 major / 7 minor / 9 notes); refuter added 3

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| HON-1 | MAJOR | = WIRE-1 (the results reader showed pre-close stake copies after a lazy close). | **FIXED** (`f49e200b`) — see WIRE-1. |
| HON-2 | MAJOR → MINOR (refuter: tie-only) | On a tie the card printed each winner's own "if this team wins" table figure beside "won"; the realized ratio is `pool.paysX`. | **FIXED** (`db640016`) — every winner shows the pool's one realized "paid ×N"; every other team shows §3's table figure conditionally ("×N had they won"); tie row added on the team rows. |
| HON-3 | MAJOR | A `closed` pool whose pod was still in battle rode into a results week beside a terminal sibling as "Settling · This pod is complete" — contradicted by Your Backing's "Day 1 of 5 · In play" on the same screen. | **FIXED** (`db640016` then reshaped in `b5d14874` per the refuter): a results week lists the pools that HAVE a result or are WAITING on one (decided, held, or `closed` with nothing left to play), never a closed pool of a pod still playing (Your Backing's); the projection carries the pod's status and the card's settling sentence follows it ("still playing its week" vs "complete"); rows added. |
| HON-4 | MAJOR | "Net BP" season and career counted an in-play stake differently under one label: the wallet's `careerNet` is debited at placement, its season bucket moves only at settlement. | **FIXED** (`db640016` + `b5d14874`) — §2's one definition in both columns (the season subtracts the BP still in play on that month's pools, attributed by the pool's month), the "In play" line states the BP out, and the rule is on the card. Rows added. |
| HON-5 | MAJOR → MINOR (refuter) | The runbook and the Sybil report's footer claimed `excluded` drops a stake from "stats and social counts"; only trainer stats read the flag; the results card's counts are the close's frozen figures. | **FIXED** (`db640016`) — my-stats honours the flag too (counts and net); the runbook, the report and the module header state exactly what the flag reaches; the frozen card counts are a recorded limit for a founder ruling on §8. |
| HON-6 | MINOR | "pays ×3.33" beside a losing team, present tense. | **FIXED** with HON-2. |
| HON-7 | MINOR | = WIRE-3 (the Sybil script could not see a dev pod's pool). | **FIXED** (`f49e200b`); the unit fixture re-keyed to the writer's shape (WIRE-R-2, `db640016`). |
| HON-8 | MINOR | `--json` printed whole digests. | **FIXED** (`db640016`) — the report object carries 12-character prefixes; row added. |
| HON-9 | MINOR | "Last week's result" over any week and any final pod. | **FIXED** (`db640016`) — "Results" / "This pod's result". |
| HON-10 | MINOR → NOTE (refuter: malformed document only) | Zero fallbacks for absent figures. | **FIXED** (`db640016`) — rendered as absent; row added. |
| HON-11 | MINOR → NOTE (refuter: §2's own rule) | The season column did not name its month. | **FIXED** (`b5d14874`) — "This season · Oct 2026". |
| HON-12 | MINOR | The baseline read the rank doc's `history`, capped at 20 events, so an old pool's "no prior week" exclusion drifted as events rolled off. | **FIXED** (`b5d14874`) — the baseline judges over the doc's UNCAPPED `appliedGroups` map (the refuter's smaller fix; no settlement change), `history` only for a legacy doc; row added. |
| HON-13 | NOTE | A hedged pool counts as won when any stake won, against a single-pick baseline (§2 allows the hedge). | **RECORDED**. |
| HON-14 | NOTE | "Last week" = the last rank event applied before the pool's close; a Monday catch-up can push it a week back. | **RECORDED**. |
| HON-15 | NOTE | `stake_confirmed.humanTeams` is the stake-time count; the pool's `humanTeams` is stamped at close. | **RECORDED** — segment from the pool at analysis. |
| HON-16 | NOTE | `dwellMs` is the first visit's, includes load, no `pagehide` emit; StrictMode's 0 ms in DEV. | **FIXED** in part (WIRE-4: the sub-frame dwell is skipped); the rest **RECORDED** as an analysis note. |
| HON-17 | NOTE (refuter: arguably MINOR) | Lobby pods carry no `seatNames`, so the winner line prints a raw uid (the PR 4 DOM-7 residual, extended to the headline). | **RECORDED** — owner stays DOM-7 (stamp `seatNames` at lobby formation; tournament code, outside this PR). |
| HON-18 | NOTE | The preview's "insufficient" fixture met the floor it said it failed. | **FIXED** (`db640016`). |
| HON-19 | NOTE | The Diversifier twin used "book" (bookmaker vocabulary, lexicon-clean) and describes an unenforced cap the canonical line also claims. | **FIXED** (`b5d14874`) — "Keeps the portfolio spread across many sectors so no single one can sink you." |
| HON-20 | NOTE | Per-team share rounding (33+33+33; 0% at pots over 10,000 BP). | **RECORDED** — accepted. |
| HON-21 | NOTE | An unknown pool status renders the "Settling" tag with `data-outcome="unknown"`. | **RECORDED** — malformed status only. |
| HON-R-1 | NOTE (test) | The FREEZE row's title contradicted its own assertion. | **FIXED** (`b5d14874`) — retitled, and the frozen closed pool of a complete pod is now listed as settling (HON-R-3). |
| HON-R-2 | MINOR | `results_viewed` was emitted for pools showing no result (settling / held). | **FIXED** (`b5d14874`) — emitted for a result only, on both hosts. |
| HON-R-3 | MINOR | A lone unsettled pool of a past week (a hold, a frozen week, a failed settlement) was listed nowhere once Your Backing's window rolled; it appeared only when a sibling happened to be terminal. | **FIXED** (`b5d14874`) — with HON-3's reshaping: a waiting pool is listed as waiting; row added. |

Clean: payout per stake is `stake.payout` (three suites pin 714 vs 715); share = the close's `stakeTotal ÷ potTotal`, labeled exactly, no crowd/probability words; backers/pot/unique backers are the close's figures; winners and ties from `winnerOdUserIds`; `myNet` over decided stakes; the loadout marker on the viewer's own stakes only, never a CPU seat; refunds score-neutral in both `careerNet` and the season bucket; every refund reason a plain sentence; the stats routes owner-only by the token uid; nothing ranks; telemetry week labels agree; `stake_confirmed` server-owned; the emits deduplicated; the lexicon clean in every new string; the preview names its fixtures; the Sybil proxy read-only over every mutator and escape hatch.

### WIRING lens — 11 findings (0 blocker / 1 major / 2 minor / 8 notes); refuter added 3, refuted 1

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| WIRE-1 | MAJOR | `loadPod` compared the pool's status with itself, so the viewer's stakes were re-read only when the primitive ran; a lazy close that voided them itself (`insufficient`, the deleted-pod tombstone, a `seat_left` void with the pass then stopping at NOT_FINAL/FROZEN) left the reply with pre-close copies — "stakes void" above a row reading "settling". | **FIXED** (`f49e200b`) — the status is captured before the pass and the stakes re-read on any change (the refuter's variant A: no extra reads on a still-open pod); row added. |
| WIRE-2 | MINOR | At the scan cap with an empty page the cursor named the first UNexamined week, which the next page's `< before` filter skipped for ever. | **FIXED** (`f49e200b`) — the cursor is the last week EXAMINED; row added (also cuts a 78-read re-scan to 3 on the non-empty case). |
| WIRE-3 | MINOR | = HON-7. | **FIXED** (`f49e200b`). |
| WIRE-4 | NOTE | DEV-build StrictMode's mount-time cleanup recorded a 0 ms dwell and, through the dedup, swallowed the real one. | **FIXED** (`5286050e`) — a dwell under one frame is not recorded (in the caller, as the refuter required). |
| WIRE-5 | NOTE | `stake_confirmed.humanTeams` comes from the pre-transaction group read. | **RECORDED** — telemetry-grade; the pool's own `humanTeams` is the durable key. |
| WIRE-6 | NOTE | The three readers read all of the viewer's stakes ever (≤ 20/week by allowance). | **RECORDED** — a week floor when history grows. |
| WIRE-7 | NOTE | `BackingResults` remounts on every card→list return and re-fetches. | **RECORDED** — idempotent. |
| WIRE-8 | NOTE | `loadMore` had no run guard. | **FIXED** (`db640016`). |
| WIRE-9 | NOTE | Fixture pods could reach the results route. | **REFUTED** — `LEAGUE_NEXT_ARC_ENABLED = true` at HEAD; the real adapter never hands back fixtures. |
| WIRE-10 | NOTE | `loadPod`'s "never throws" covered the settle pass only. | **FIXED** (`f49e200b`) — docstring. |
| WIRE-11 | NOTE | Under the freeze settle-on-read skips the refund arm too, matching the primitive. | **RECORDED** — design-consistent; WIRE-R-3 adds that the lazy CLOSE is not freeze-gated on any host (its voids and refunds land under a freeze), consistent with the admin route's rationale. |
| WIRE-R-1 | NOTE | The pod list carries the same pre-close stake copies after ITS lazy close (PR 2 code; the strip classifies by pool status first, so only the pod row's §B6 line can show a stale total in the Monday 00:00–09:30 ET window). | **RECORDED for separate tasking** (BUILD_RULES §3: outside this PR's diff). |
| WIRE-R-2 | NOTE (test) | The Sybil unit fixture modelled a dev stake with a `dev-` group id, a shape no writer produces. | **FIXED** (`db640016`). |
| WIRE-R-3 | NOTE | See WIRE-11. | **RECORDED**. |

Clean: settle-on-read state by state (open past close → closed then judged; closed + complete → settled, source `settle_on_read`; closed + battle → NOT_FINAL; voided/expired/deleted → the primitive routes to the refund; resolving/resolved/refunded/insufficient → NOT_CLOSED; frozen → in front of the CALL); exactly once per request (`weeksOf` de-duplicates); every new Firestore query has the index it needs (`(teamOdUserId, status)` composite added; the rest single-field equality, document gets, or single-field range + order); `stake_confirmed` after the commit, never on replay or refusal, deterministic id, failure caught; the hooks' stale-reply guards; `pod.id` on the production Spectate path is the tournament group id; no circular import through `backedPodsFor`; no extensionless import reachable from `api/`; every `api/`→`src/` import Node-clean and loaded for real by its test; the Sybil proxy throws on every mutator and escape hatch and its three query shapes need no composite index.

## 4. The six mutation checks (BUILD_RULES §2 "mutation-checked where it adds tests")

Each ran on its own `tar` copy of the working tree with `node_modules` symlinked (`scratchpad/mut/m1…m6`); the named suite alone was run; the rows that red are listed beside the mutation. Every check reds exactly the row(s) it names. (Taken at the build; re-taken on the final tree in §6.)

| # | Mutation (in the copy) | Suite | Result |
| --- | --- | --- | --- |
| 1 | `refundPool`: skip `recordStakeLoss` (credit only) | `api/_utils/backingRefund.test.js` | **18 failed / 22 passed** — every net-zero row red ("pairs creditRefund with recordStakeLoss for EVERY voided stake…", "a backer with a prior season record keeps it: the pair moves the bucket by exactly zero", the trigger rows' ledger assertions, the retry and race rows' net-zero assertions) |
| 2 | `refundPool`: remove the in-transaction status gate | `api/_utils/backingRefund.test.js` | **2 failed / 38 passed** — "the SETTLEMENT lands between the refund's read and its commit…" and "TWO refunds racing…" red |
| 3 | `BackingResultsCard`: render `stake × pays ×` for a won stake | `src/components/League/backing/BackingResultsCard.test.jsx` | **1 failed / 8 passed** — "MUTATION CHECK 3 — renders the stake document's payout (714), never stake × pays × (715)" red |
| 4 | `backing-stake.js`: let the `stake_confirmed` write's failure propagate | `api/tournament/backing-stake.test.js` | **1 failed / 83 passed** — "MUTATION CHECK 4 — a THROWING telemetry write never fails the stake…" red |
| 5 | `my-stats.js`: honour a `uid` query parameter | `api/backing/my-stats.test.js` | **1 failed / 6 passed** — "a `uid` / `userId` / `odUserId` query parameter is IGNORED…" red |
| 6 | `results.js` `settleOnRead`: drop the `TOURNAMENT_ADVANCEMENT_FROZEN` check | `api/backing/results.test.js` | **3 failed / 14 passed** — "MUTATION CHECK 6 — FROZEN: the primitive is NEVER CALLED…", "settleOnRead names why it did not call…", "the FREEZE holds across the whole page…" red |

## 5. Refutation

Four refuters, one per lens, each on its own `git archive 363bde92` tree, each instructed to refute every finding with a concrete repro on the original tree and to assess every proposed fix.

| Lens | Findings | CONFIRMED | REFUTED | Severity moved | New (lens missed) |
| --- | --- | --- | --- | --- | --- |
| MONEY | 8 | 8 | 0 | 0 (MONEY-4's reachability argument corrected: the "≤ 40" figure is unenforced) | 5 (MONEY-R-1…R-5) — and MONEY-3's proposed THROW refuted in favour of a returned refusal |
| DARK | 9 | 9 | 0 | 0 | 4 (DARK-R-1…R-4) — and DARK-4's "extend `routesNamed`" alternative refuted (it would red `attest.js`) |
| HONESTY | 21 | 21 | 0 | HON-2 → MINOR, HON-5 → MINOR, HON-10 → NOTE, HON-11 → NOTE (HON-17 argued up) | 3 (HON-R-1…R-3) — and HON-3's proposed FILTER refuted in favour of listing waiting pools honestly |
| WIRING | 11 | 10 | 1 (WIRE-9) | WIRE-8's impact narrowed | 3 (WIRE-R-1…R-3) |

**49 findings, 48 CONFIRMED, 1 REFUTED, 15 added by the refuters.** Three proposed fixes were refuted as shaped and replaced (MONEY-3's throw, HON-3's filter, DARK-4's route-name extension); the record above names the replacement in each disposition.

## 6. Verification on the final tree

Every check below was taken on the final commit of the branch (the sha is in the PR body), on the shared working tree, after every fix above.

| Check | Result |
| --- | --- |
| `npm run test:run` | _see the PR body for the verbatim `Test Files` line and the exit code_ |
| `npm run test:rules` (Firestore emulator v1.21.0, downloaded in-session) | `Test Files  11 passed (11)` · `Tests  242 passed (242)` · exit 0 |
| `npx vite build` | exit 0 |
| `npm run lint:gate` | exit 0 |
| Fenced files touched | none (every file is outside BUILD_RULES §1's list) |
| The six mutation checks, re-taken on the final tree | _see the PR body_ |

Per-fix guard checks, each on an isolated `tar` copy (`scratchpad/mut/*`): the refund crash-position sweep reds under "prior wallets not read" (P6: 1/41 red); the ledger-month row reds under "pool month only" (P4: 1/41 red); a sole-child wrapper planted around the Spectate mount reds the rewritten bare-mount guard; a hook planted in `EquipStation`'s body reds the mounted-dark row.

## 7. What is deferred, and to whom

- **A batched refund** (priors costed at 0 once applied, wallets read before the ceiling) closes MONEY-4's stuck state; until then the admin route's header carries the Console procedure. A per-pool stake cap at the stake endpoint would make both holds unreachable by construction — a §2/§3 product decision for the founder.
- **The results card's backer counts under `excluded`** (HON-5): the close's frozen figures are not adjusted; amending spec §8 to "trainer and owner stats and the admin analysis", or tasking a read-time subtraction, is a founder ruling.
- **`seatNames` on lobby pods** (HON-17): stamp at lobby formation from the members' display names — DOM-7's owner, tournament code.
- **The pod list's pre-close stake copies after its own lazy close** (WIRE-R-1): PR 2 code, reported for separate tasking.
- **`flagPinGuard`'s "Pinned by" match on the pointer line only** (DARK-8): a shared guard outside this PR; the strict match is verified safe.
- Read horizons for the three readers as history grows (WIRE-6); the pod-list-time `humanTeams` segmentation key (HON-15 / WIRE-5); the analysis notes for `dwellMs` (HON-16) and the hedged-pool accuracy (HON-13).
