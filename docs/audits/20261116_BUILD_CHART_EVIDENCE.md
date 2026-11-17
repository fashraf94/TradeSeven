# Build report — the chart's evidence: the daily sweep and the read route

**Date:** Monday 16 Nov 2026 · **Built by:** Claude Code (Opus) · **Prompt:** *The chart's evidence: the daily sweep and the read route*, V1.1 (AssetResearch planning chat, 15–16 Nov 2026) · **Spec of record:** `docs/specs/CHART_EVIDENCE_SPEC_V1.md` · **Base:** built on `main` at `71bc6bde` (#1073; the prompt was checked against `cb23d73`, and #1073 changed only CI sharding); rebased before the push onto `main` at `88d34457` (#1077, #1075, #1074 merged meanwhile), with no conflict, and every final check run again on the rebased trees.

## Preamble

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first (and again when the session resumed after a pause on 16 Nov; nothing was pushed before it). The session's worktree branch `claude/chart-evidence-sweep-read-8baaef` was at `71bc6bde`, equal to `origin/main`, tree clean. PR A's branch was cut from `origin/main`; PR B's from A; PR C's from B. `main` was fetched again before the push: it had moved to `88d34457`, and all three branches were rebased onto it (none was pushed before). None of the files this build cites in the store, the observer, Slice 2, the rankings config or the route precedent changed; `firestore.rules` gained 20 lines above this build's block.
- **Markers.** VERIFIED: the line was read at the cited commit in this session. MEASURED: a production read made this session (Phase 0 point 7 only). INFERRED: a conclusion from code not run. ASSUMED: rests on a document not read here.
- **Production.** Read only for Phase 0 point 7, by one script (`tf-horizon.mjs`, scratchpad, read instant 2026-11-16T21:10:41Z): field-limited `select().get()`, `count()` and `doc().get()`; it passed the write-verb grep before it ran; credentials were parsed in place from the main checkout's `.env.local`, never printed or copied. No index was created.
- **No provider call and no model call** anywhere in the build, its tests or its checks. Tests that exercise the store's default provider stub `fetch` and a fake key.
- **No uids or emails** appear here or in any PR. Owners are A and B.

---

## 1. Verdicts

| Item | Verdict |
|---|---|
| Phase 0 (seven points) | Done. No finding contradicts a ruling. Point 7 (the observer's 0 pointers) is **by design**: both pre-flip Trend Follower battles were past their 3-day catch-up horizon when the observer's code first reached `main`. Nothing fixed. |
| PR A — the read route | Built dark (`CHART_READ_MODE = 'off'`): every caller gets 404 before any read. Read only: `readSnapshot` and nothing else of the store; no provider call, no write, no model call. |
| PR B — the sweep | Built dark (`SETUP_EVIDENCE_SWEEP_ENABLED = false`): the cron answers `{ skipped: true }` before the Firestore handle is taken. Hard stop 400 provider requests a trading session, counted in a transaction before each request. |
| PR C — the switch | One commit: the flag `true`, its pin, the `DARK_BY_DESIGN` entry dropped. |
| Review (BUILD_RULES §2) | Three lenses, three refuters, 18 lens findings: 13 confirmed, 5 partly, 0 refuted; the refuters found 9 more (RF-1–RF-9) and overturned two of the builder's fixes. All fixed or recorded as a reading; one question for the founder (R-17). Mutation battery: **79 of 79 killed** (§5). |
| Checks | On the rebased code heads (`main` `88d34457`): full Linux suite — every row of this build green on A, B and C; the only red is **three rows `main` itself fails** (Film Room C2's write gate meets a line from the security pack; §6, §11); `npm run test:rules` exit 0 on B and C, 45 files and 810 rows; `lint:gate` exit 0 on A, B and C; `vite build` exit 0, and **every JS, CSS and HTML file byte-identical to `main`'s build** on each (58 files). Before the rebase (`71bc6bde`), the B and C suites were 0 failed. |
| Cost when on | 228 provider requests a session at the floor, about 230–275 expected, hard stop 400; model calls 0; the route costs no provider call. |
| Founder steps | Merge A, then B, then C (merge commits). Optional: publish the rules (no behaviour change). The morning after the first full trading day, run the day-after check (§9). |

---

## 2. Phase 0 — the seven findings

**1. The store's contract** (`api/_utils/setupEvidence/`, six modules; VERIFIED at `71bc6bde`).
- *The injected clock:* `now` is a function, read before the claim, before the request and again when the response arrives (`acquire.js:49` `readClock`, `:97` `requestStartedAtMs`, `:105` `received`); a plain Date is refused.
- *The lease:* `claimSnapshot` takes a 120 s lease under a per-call token in one transaction (`store.js:35` `LEASE_MS`, `:42` `leaseIsLive`); a live lease elsewhere answers `pending`, never waits (`index.js:64`); a programming error after the claim releases the lease under its token before it throws (`index.js:80`).
- *Create-once:* the final document is written only by `tx.create` (`store.js:116`, `:150`); a lost race reads the winner.
- *The four dispositions:* `DISPOSITIONS` (`classify.js:45`) — final, confirm, retryable, programming error (`SetupEvidenceProgrammingError`, `classify.js:53`).
- *The 30-minute confirm rule:* a confirm-class result is final only when a fetch that STARTED at least 30 minutes after the first observation reproduces it (`store.js:37` `CONFIRM_AFTER_MS`, `:148`).
- `readSnapshot` (`index.js:35`) is one `get` of the final document (`store.js:48`), never a claim, never a fetch.

**2. The Slice 2 tenant as precedent** (`api/_utils/setupMenuLabels/`; VERIFIED). A counting `fetchPayload` wrapper (`tenant.js:341`); a per-run cap (`constants.js:58`, 12); concurrency 3 (`constants.js:60`); an admission deadline `min(tenantStart + 20 s, handlerStart + 100 s)` (`tenant.js:212`); one state transaction at a time in a run (`tenant.js:90` `serialiser`); a counts-only health line (`tenant.js:161`). The sweep keeps all five, with its own numbers.

**3. Can a cron be added?** Yes. `BUILD_RULES.md` §6 records 45 of 100 entries and "Vercel's per-project cron limit is 100 on all plans — raised January 2026; verified by the founder's reviewer 2026-09-18" (VERIFIED). `vercel.json` held 45 (VERIFIED by count). The sweep takes it to 46; three tests pin the count (`api/agent/research.dark.test.js`, `api/cron/agent-evaluate.measuredFollowup.test.js`, `api/cron/compute-index-intelligence.axes.test.js`) and move with it, as does §6's count line. The SW-1 fallback (an eighth reflections tenant) was not needed.

**4. The symbol list.** `ALL_TICKERS` (`rankingConfig.js:381`) holds 228 unique tickers (VERIFIED by running it), equal to the 228 rows the rankings carry (MEASURED by the discovery, 15 Nov). Every one is in the store's key form (`key.js:25` `SYMBOL_RE`, `:26` length ≤ 12): none would be refused. One holds a hyphen, `BRK-B`, already the store's form (the provider symbol `BRK-B.US`). None is crypto (`isCryptoSymbol` false for all 228). No conversion is needed for the sweep; the route converts a client's `BRK.B` (R-6).

**5. A session whose bars the provider has not published.** The adapter computes the expected session from the calendar before any row and refuses `missing_bar { expected, latest }` with no `after` when the newest row is not it (`dailyBarsAdapter.js:186`); the store classifies a `missing_bar` without `after` as RETRYABLE (`classify.js:86`–`87`): nothing final is written, the lease is released, the next run retries. The store's build report says the same ("A newest-session `missing_bar` is never finalised by the store", `docs/audits/20261030_BUILD_SETUP_EVIDENCE_STORE.md:145`). VERIFIED; the sweep's tests reproduce it on the real store. Note: a bar present but incomplete (no adjusted close, a zero row) is confirm-class, not retryable (ruling Q1 of that report, `:189`).

**6. Rules and deploys.** `firestore.rules` ends in a catch-all `match /{document=**} { allow read, write: if false; }` (VERIFIED, `firestore.rules:1516` at `71bc6bde`; `:1536` at `88d34457`), so a new server-only collection is denied with no rule change and no deploy. The precedent (Slice 2's `setupMenuLabelState`) still names each server-only collection with an explicit block, a tripwire and an emulator suite; this build does the same for `setupEvidenceSweepState`. Publishing the rules changes no behaviour; it is an optional founder step (PR C). Slice 2's flip waited on "rules published" because its state needed an **index exemption** for a per-symbol map (`setupMenuLabelsFlags.js:25`–`26`); the sweep's state has no such map, so no index change and no deploy is required.

**7. The loose end — why the observer holds 0 activation pointers.** **By design (spec V1.9 §4.3–§4.4), not a defect, and not a config fault.** The observer picks candidates by `createdAt` within 14 days with no status filter (`activationEvidence/constants.js:46`), but a battle whose catch-up horizon (its cutoff + 3 calendar days, `constants.js:48`; `schedule.js:92`–`94`) has passed is marked finished and its activations abandoned, with no pointer written (`tenant.js:340`–`348`). MEASURED (read instant 2026-11-16T21:10:41Z): of the two owners' in-scope Trend Follower battles, only two were inside the 14-day window when the flag went on — owner A's (created 31 Oct 03:17 UTC, last trading day 2 Nov, horizon 2026-11-06T01:30Z) and owner B's (created 30 Oct, horizon 2026-11-03T01:30Z) — and both horizons had passed before the observer's code first reached `main` (PR #1026, 2026-11-06T23:08Z; the flip, PR #1028, merged 2026-11-07T17:58Z). The rest were outside the window; one of A's was a tournament battle, excluded by game mode. Neither owner has played a tiered Trend Follower battle since the flip (A created 5 battles, other archetypes; B none). The observer state holds 5 of A's battles, all excluded by archetype. **Observability gap, for separate tasking:** the observer's health line carries no abandoned, finished or excluded counts (`tenant.js:162`–`173`), so this outcome was invisible in the logs; and no document says that battles finished more than 3 days before the flip are never covered. Nothing was fixed.

---

## 3. The rulings as built

| Ruling | Built in | Note |
|---|---|---|
| RR-1 read only | `api/research/setup-read.js` | `readSnapshot` + `lastCompletedSessionAt`; the test runs the REAL `readSnapshot` over a db that throws on any claims touch, write, transaction or query, with `fetch` stubbed to throw |
| RR-2 any signed-in player | the route, step 3–4 | no battle read |
| RR-3 the symbol | `symbolOf` | case-insensitive, "." → "-"; crypto first; reading R-6 |
| RR-4 the session | `sessionsToTry`, `readSetup` | at most two reads; `behind` |
| RR-5 three answers | `answerOf` (projection) | by the record's `status`; reading R-1 |
| RR-6 what leaves | `api/_utils/setupRead/projection.js`, `setupReadContract.js` | the field list in spec §4.4, plus `adjustmentMetadata` (R-1) |
| RR-7 the flag | `researchModalFlags.js`, `chartReadMode.js`, `chartReadFlag.test.js`, `flagPinGuard.test.js` note | ships `'off'` |
| RR-8 the order | the handler | per-user limit 30/min (R-7); 503 for a calendar gap (R-8) |
| RR-9 the import guard | `setupEvidenceImportGuard.test.js` | route, its test, the fixture, the projection test; the library stays six modules |
| SW-1 own cron | `api/cron/setup-evidence-sweep.js`, `vercel.json` | 45 → 46 |
| SW-2 one run | `api/_utils/setupEvidenceSweep/sweep.js` | the brake: `unpublished`, `shared_refusal`, `provider_failing` (R-3, R-14, R-17); programming errors (R-11) |
| SW-3 when | `30 12,22,23 * * 1-5` | §7; the non-session rule (R-4) |
| SW-4 the allocation | `state.js` `reserveProviderRequest`, the counting wrapper | per session (R-2); 400 |
| SW-5 state | `setupEvidenceSweepState/{session}`, `firestore.rules` block, tripwire, denial suite | counts only |
| SW-6 the flag | `setupEvidenceSweepFlags.js`, its pin, `FLAG_SOURCE_MODULES`, `DARK_BY_DESIGN` | ships `false` |
| SW-7 nothing else | — | no store, evaluator, observer, Slice 2, rankings-cron or fenced file edited; one census ROW in Slice 2's test file lists the sweep (below) |
| SW-8 logging | `healthLineOf` | counts and closed-list keys; R-10 |
| SW-9 the import guard | `setupEvidenceImportGuard.test.js` | the files that name the store (spec §5.6); the cron does not, so it is not listed — the guard fails on a listed file that does not name the store |

**Readings** (each in the spec, §1.3): R-1 `refused` = the record's status, with `adjustmentMetadata` added to the projection; R-2 the cap per session; R-3 the brake (eight outcomes of one kind in a row); R-4 no work on a non-session day; R-5 the times; R-6 the symbol conversion; R-7 30 a minute per player; R-8 503 on a calendar gap; R-9 what "provider client import" means for a route that must import the store's index; R-10 a health line per non-skipped run; R-11 how a programming error surfaces; R-12 an unset cron secret never matches; R-13 the explicit rules block; R-14 its `provider_failing` kind (review L2-1); R-15 the 12:30 run is a session's last (review L1-4); R-16 a refusal at the counter still adds an attempt to the store's claim, at most three a run, and a transient counter failure closes admission (review L1-5, L2-6, RF-5); R-17 its `shared_refusal` kind, and the founder question behind it (§11).

**Existing tests changed** (none weakened; the flag-guard note for `CHART_READ_MODE` is in A, everything else in B): the three cron-count pins 45 → 46; `flagPinGuard.test.js` (a note for `CHART_READ_MODE` in A; the sweep's module and `DARK_BY_DESIGN` entry in B); `setupEvidenceImportGuard.test.js` (listings); `compositionProtectedStoresAllowlist.json` (the state's two `tx.set` sites); Slice 2's census row A1.1 in `api/_utils/setupMenuLabels/tenant.test.js`, which pins the callers of `getOrAcquireSnapshot` — the sweep is the third caller by design (SW-2), and the row's title now says so; the tenant module itself is untouched, and the first full-suite run found this census, the only red row; and the import guard's cron row, which now matches the store's name in camel, kebab, snake and dotted case and admits exactly the sweep's entry, with its header saying who calls the store (review L3-2, RF-9).

**Fenced files (BUILD_RULES §1):** none edited; no fenced function called.

---

## 4. Review (BUILD_RULES §2)

### 4.1 How it ran

- **Three lenses**, each a separate reviewer on its own `git archive` snapshot of the code as built (reviewer isolation, BUILD_RULES §2: read-only on git and the shared tree): **1** the store's contract (the clock, the lease, create-once, the dispositions, the confirm rule, safety on repeat); **2** security and cost (the route's order, what leaves the server, read-only, the cap and its counting, the one provider path); **3** off means off (both flags at their shipped values). Each returned findings with a concrete repro: a test it wrote and ran, or an exact trace.
- **Three refuters**, one per lens, each on a fresh snapshot of the code as reviewed, told to refute every finding with a repro and to judge the builder's fix diff. They refuted no finding outright, cut five down (a severity, a cited path, a sub-claim), and **overturned two of the builder's own fixes** (RF-1, RF-3 below) — the adversarial pass earned its keep there.
- **Every confirmed finding has a test that fails without its fix**, proven by a mutant in the battery (§5) unless the finding was documentation only.
- Commits are named by their subject (each fix names its finding ids) because PR B's and PR C's hashes are minted after this report is committed on PR A; `git log --grep "L2-1"` finds each. PR A's fix commits: `61d5dfef`, `6a85233c`.

### 4.2 The findings

Severity is the lens's; the verdict is the refuter's. "Reading" = recorded in spec §1.3 rather than changed in code.

| id | Sev. | Finding | Verdict | Disposition | Commit (PR) |
|---|---|---|---|---|---|
| L1-1 | MED→LOW | The unpublished brake also fired on a gap inside the window (confirm class), mislabelled `unpublished` | PARTLY (a throttle with a wrong label, not a wrong outcome) | Fixed, then reworked after RF-1/RF-2: one brake, kinds `unpublished` / `shared_refusal` / `provider_failing` | "the sweep's brake and programming errors (review L1-1 to L1-3)"; "one same-kind brake…"; "the brake's shared kind covers every confirmable refusal" (B) |
| L1-2 | LOW | A final found by reading did not break the streak | PARTLY (real; the builder's fix opened RF-3) | Fix reverted; ruled: a read final does NOT break a streak (protects the cap) — reading R-3 | "one same-kind brake…" (B) |
| L1-3 | MED | Programming errors other than `TypeError`, and `TypeError`s in the sweep's own state code, were counted and passed over | CONFIRMED for the class (the cited evaluator path is unreachable) | Fixed: any error without a numeric gRPC code is a programming error, surfaced from the store path, the counter, the record and the state read | "the sweep's brake and programming errors…"; "one same-kind brake…" (B) |
| L1-4 | LOW | The 12:30 run is a session's last: what it defers is never retried for that session | CONFIRMED | Reading R-15 (no code change; the route answers `behind`) | — |
| L1-5 | NIT | A refusal at the counter still adds an attempt to the store's claim | PARTLY (unbounded for a transient counter failure) | Reading R-16; the transient case closes admission (RF-5) | "one same-kind brake…" (B) |
| L2-1 | MED | An outage or a missing key spent the session's whole 400 on failures | CONFIRMED (and an outage in run 1 alone left 56 names unmeasured) | Fixed: `provider_failing` brake | "a provider-failure brake; the cap's last place closes admission (review L2-1, L2-6, L2-8)" (B) |
| L2-2 | MED→LOW | The 429 row could not fail (every read after the first was a cache hit) | PARTLY (code correct) | Row: an uncached symbol at the limit | "a hollow record is never served; route rows that bite" — `6a85233c` (A) |
| L2-3 | LOW | Two route mutants survived: limiter before the symbol; cache keyed by symbol only | CONFIRMED (the cache mutant's harm: a false `behind: false` for ≤ 60 s) | Rows: a bad symbol at the limit is 400; across the close the cache never serves the session before | `6a85233c` (A) |
| L2-4 | LOW | A hollow record (`entry = { checks: [] }`) was served `measured` with every field null | CONFIRMED (no false rejects on 12 real store records) | Fixed: verdict on its list, nine checks with ids; else 500 | `6a85233c` (A) |
| L2-5 | LOW | The store's own warning lines name the symbol on every failed or refused fetch | CONFIRMED (no price) | Reading R-10 (the store stays unedited, SW-7); the brakes bound the count | — |
| L2-6 | LOW | At the cap, units in flight each took a claim only to be refused | CONFIRMED (the fix narrows it) | Fixed: the request that takes the cap's last place closes admission; reading R-16 bounds the rest at three | "a provider-failure brake; the cap's last place…" (B) |
| L2-7 | NIT | Spec §6 understated writes (~687 → ~915) and missed a read | CONFIRMED | Spec §6 and §8 below corrected | docs (A) |
| L2-8 | NIT | Mutant survivors (the reserve, a 500 log with the message, `scalar()` as identity); the 228-name row near the 5 s timeout | PARTLY ("reserve set to 0 survives" was wrong: the constants pin kills it) | Rows for each; a 30 s timeout | `6a85233c` (A); "a provider-failure brake…" (B) |
| L3-1 | MED | The 228-name row timed out at 5.1–5.3 s under load; near-certain red on a 2-vCPU runner | CONFIRMED (under-rated) | 30 s timeout | "a provider-failure brake…" (B) |
| L3-2 | LOW | The import guard's "no cron names it" row passed on the cron path's spelling | CONFIRMED | Fixed: camel, kebab, snake and dotted; exactly the sweep's entry | "guard and flip notes (review L3-2, L3-3, L3-5)"; "the refuter of lens 3's follow-ups…" (B) |
| L3-3 | LOW | PR C's notes left out the registration row's inversion | CONFIRMED (the first fix's wording was ambiguous) | Fixed: invert the DARK_BY_DESIGN expect only | same two (B) |
| L3-4 | LOW | Spec §5.5 said no Slice 2 file changed | CONFIRMED | Spec §5.5 corrected (three lines of one census row) | docs (A) |
| L3-5 | NIT | The census row's title named two callers, its list three | CONFIRMED | Retitled | "guard and flip notes…" (B) |

**Found by the refuters** (each confirmed by the builder's own row before the fix):

| id | Finding | Disposition | Commit (PR) |
|---|---|---|---|
| RF-1 | The L1-1 fix let a gap shared by every name be confirmed as 228 permanent refusals in one run | Fixed: the `shared_refusal` kind brakes observations and confirmations alike | "one same-kind brake…" (B) |
| RF-2 | The session-row test read the raw payload; a session row the store's mapper drops (a null high) fooled it | Fixed: the test reads the payload through the store's own `mapDailyRows` | "one same-kind brake…" (B) |
| RF-3 | The L1-2 fix (a read final breaks a streak) let a run with late names between finals spend past the cap (172 of 228 final instead of 228) | Reverted; reading R-3 | "one same-kind brake…" (B) |
| RF-4 | The plain state read swallowed any bug as an unreadable document | Fixed: only a Firestore failure (numeric code) reads as unreadable; a bug is thrown | "one same-kind brake…" (B) |
| RF-5 | A transient counter failure kept admitting: every name took a claim, no request | Fixed: `counter_failed` closes admission | "one same-kind brake…" (B) |
| RF-6 | The programming-error rule rests on the Admin SDK speaking gRPC | Comment at `isProgrammingError` (verified: `getFirestore()` with no settings) | "rows for mixed kinds…" (B) |
| RF-7 | A provider answering 200 with a truncated array makes every name `insufficient_history` (confirm class): the same bulk-refusal risk as RF-1 | Fixed: `shared_refusal` covers every confirmable refusal (gap, short history, bad date, missing fact) | "the brake's shared kind covers every confirmable refusal" (B) |
| RF-8 | "In a row" is completion order across four workers; a missing key still counts ~11 places a run with no network call | Readings R-3, R-14 | — |
| RF-9 | The guard row still passed snake or dotted names; the guard's header still said nothing calls the store | Fixed | "the refuter of lens 3's follow-ups…" (B) |

**Not fixed, by design:** L1-4 and L2-5 are readings; RF-8 is a reading. **For the founder:** R-17 — whether a refusal shared by every name should ever be confirmed is a store-level ruling (§11).

---

## 5. Mutation battery

One mutant per guarded behaviour, each a single exact text replacement on its own `git archive` tree (never the shared tree), the file restored from memory after each, and the target test files run alone. A mutant is KILLED only when vitest exits non-zero AND its JSON report counts at least one failed row; a crash or a missing report is ERROR and is re-run, never counted as a kill. Before each battery a control ran the same 14 test files unmutated: all green (253 rows at the second battery).

| Area | Mutants | What they break |
|---|---|---|
| The route (R) | 18 | read-only (`getOrAcquireSnapshot` swapped in, a claims read), the order of checks (flag after symbol, limiter after the reads, limiter before the symbol, crypto after the ranked list), the symbol (no "." → "-", case), the session (`behind`, one session only, a calendar gap read as absent), the cache (no expiry, a key without the session, a shared array), `Cache-Control`, the allowlist ignored, a 500 log with the symbol or the message |
| The projection (P) | 12 | refused read as measured, the writer stamp leaked, a check's `facts` kept, `basis` written as a literal, no schema / key / leaf checks, lows or dates dropped, the adjustment field written, patterns spread, `scalar()` as identity |
| Client, resolver, flags (C, M, F) | 6 | a body outside the contract resolved, errors resolved, the resolver's guard, `'allowlist'` open, either flag flipped without its pin |
| The sweep (S, B) | 28 | no flag gate, unbounded concurrency, finals not read, no non-session rule, the cap not closing admission, no reservation, the request before the reservation, a programming error swallowed (store, counter, record), no deadline, no reserve, no run record, refused counted measured, reads not stopped at the deadline, the cap's last place not closing admission; the brake: off, never reset, kinds counted together, transport failures not counted, gaps read as unpublished, the raw session row, a read final breaking a streak, confirmations not counted, a counter bug read as transient, a counter failure that keeps admitting, other outcomes not breaking a streak, the session row ignored |
| The state (T) | 7 | the cap off by one, an unreadable document read as zero, the counter zeroed by the record, `completedAt` and `firstRunAt` moving, an open tally, a bug in the read swallowed |
| The cron, the census, the guard (K, N, G) | 8 | no flag gate, an empty secret matching, a 500 log with the message; the census unmasked, a failed read counted absent, a free label printed, a write verb; a second kebab-case cron entry |

**Results.**
- **Battery 1** (73 mutants, on the code after the lens fixes): 70 KILLED, 3 SURVIVED — S06 and S24 (an acquired final also reset the old streaks, so no row isolated the other reset) and S22 (the counter-bug row could pass through the end-of-run record, which failed with the same error). The brake was then rewritten (RF-1–RF-5) and these mutants re-cut for the new code; new rows: alternating kinds, a run of confirmations, a bug in the first reservation only.
- **Battery 2** (79 mutants, on the code after the refuters' fixes): 76 KILLED and 3 ERROR. The two that crashed (the host slept mid-run) were re-run and KILLED. B11 ("other outcomes do not break a streak") SURVIVED. A row was added (late names alternating with confirm-class ones), and the re-run KILLED it.
- **Final: 79 of 79 killed.** No mutant is counted as equivalent.

---

## 6. Checks

Run on Linux (WSL Ubuntu, Node 20.20.2, an install matching `main`'s lockfile), each full suite alone under the session lock, on the code heads rebased onto `main` `88d34457` (A `60b3511d`, B `8ae81d5e`, C `aa614c1f`, by their hashes before the docs commit). The code heads are each PR's last code commit; the pushed heads add only this docs commit on PR A (the spec, this report, two README rows), and no test reads those files (checked: no test reads `docs/README.md`, `docs/specs/CHART_EVIDENCE_SPEC_V1.md` or this report), so the results stand for the pushed heads. `vite build` and `lint:gate` were run again on each exact pushed head (PR descriptions).

| Check | PR A code head | PR B code head | PR C code head (flag on) |
|---|---|---|---|
| Full suite (`--maxWorkers=8`, `TZ=UTC`) | 1,524 files passed, 12 skipped; 34,437 rows passed, 135 skipped; **3 failed, all `main`'s own** | 1,531 files passed; 34,532 rows passed; **3 failed, all `main`'s own** | the same as B |
| The same three rows on `main` `88d34457` alone | fail identically | | |
| `npm run test:rules` (Firestore emulator, Java 21) | — (no rules change) | exit 0; 45 files, 810 rows; the 228-name emulator run 3.9 s | exit 0; 45 files, 810 rows; 4.0 s |
| `lint:gate` | exit 0 | exit 0 | exit 0 |
| `vite build` vs `main` (`88d34457`) | exit 0; 58 of 58 JS/CSS/HTML files byte-identical | exit 0; 58 of 58 | exit 0; 58 of 58 |

**The three red rows are `main`'s, not this build's.** `api/_utils/filmRoom/momentExcerpt.golden.test.js`, "THE WRITE GATE", fails three rows on `main` `88d34457` itself: its scan of `momentExcerpt.js`'s import closure now reaches a `Map#set` at `src/constants/leagueTournament.js:923`, a line the security pack added (#1077, `e9cc59ba`), and #1074 merged after it. Reported for separate tasking (§11); not fixed here (BUILD_RULES §3). It will show red on these PRs' CI as on `main`.

**Before the rebase** (on `71bc6bde`): full suite exit 0 on B and C, 1,513 files and 34,021 rows each, 0 failed (384 s and 286 s); rules 44 files and 795 rows each; lint 0; build byte-identical.

**On the way.** The first full suite (on PR B's first commit) found one red row: Slice 2's census A1.1, which pins the callers of `getOrAcquireSnapshot` — the sweep is the third, by design; listed in the census row (§3). The lens 2 and lens 3 reviewers each measured the 228-name sweep row at 4.9–5.3 s against vitest's 5 s default on a loaded host (L2-8, L3-1); it now has its own 30 s limit. Tailwind: a scan of every candidate in the added lines with Tailwind's own compiler minted no CSS rule (lens 2; a planted bracketed control did), and the built CSS is byte-identical.

---

## 7. The cron times, and why

`30 12,22,23 * * 1-5` UTC — one `vercel.json` entry, three runs a session:

| UTC | Winter (EST) | Summer (EDT) | Why |
|---|---|---|---|
| 22:30 | 5:30 PM | 6:30 PM | after the 4:00 PM close in both seasons, 90 / 150 minutes after it, so the session's bar is more likely published (the repo records no provider publish time; a too-early run is caught by the unpublished brake, R-3) |
| 23:30 | 6:30 PM | 7:30 PM | an hour after the first: its fetch starts well over 30 minutes after the first run's observation, so it confirms the confirm-class names, and it retries what was not ready |
| 12:30 next weekday | 7:30 AM | 8:30 AM | before the 9:30 AM open in both seasons: the catch-up |

Friday's session is caught up on Monday morning. A weekday holiday's runs (e.g. Thanksgiving, 26 Nov) find a non-session day and do nothing; the morning after catches up. `constants.test.js` proves the three times against the calendar in a winter and a summer week.

---

## 8. The cost line

| Item | Figure |
|---|---|
| Provider requests per trading session | **228** at the floor (one `/eod/` read per ranked stock, once); about **230–275** expected (the Slice 2 spec's assumed 20 % confirm-class share needs a second fetch); **hard stop 400**, counted before each request; per UTC calendar day at most 800 in the worst case (R-2), ~230–275 expected |
| Model calls | **0** |
| Firestore per sweep run | 1 state read; 228 record reads; per acquisition the store's own two transactions (claim, final; 2 reads each) plus one counter transaction (1 read, 1 write); one run-record transaction (1 read, 1 write). A run that finds every name final: 230 reads, 1 write. Per session about 915 writes: ~228 records, ~456 claim writes (each claim written when its lease is taken and again when it is cleared), ~230 counter writes, 3 run records (review L2-7) |
| Writes on the state document | one per provider request plus one per run: ~230 in a few minutes on one document — above Firestore's 1-per-second sustained guidance for a single document in a burst; the run serialises them (one in flight), so they never contend within a run; measured on the emulator only (a 228-name run in 4.1 s wall) |
| The route, per call | 0 reads (a cache hit), 1 or at most 2 record reads; no provider call; no write |

---

## 9. The day-after check (the founder's)

The morning after the first full trading day the sweep is on (e.g. Wednesday morning for Tuesday's session):

```
node scripts/census-setup-evidence-sweep.mjs --session YYYY-MM-DD
```

A healthy first day prints, roughly:

```
Records: 228 of 228 ranked stocks (measured 22x, refused 0–5); absent 0; unreadable 0; read failed 0
  valid N by pattern: breakout a, pullback_resume b
  invalid N by reason: extended a, no_setup b, regime c
  unknown N by reason: missing_fact a; missing facts: V a, …
  refused N by reason: basis_discontinuity a, insufficient_history b
Sweep state: read; provider requests counted 228–275 (cap 400); runs 3; run time … s
  first run …T22:30…Z; every name final …T22:3x…Z or …T23:3x…Z (… min after the first run)
```

Read it as: every ranked stock has a record; provider requests between 228 and ~275 and under 400; every name final after the first or second run. Worth a look: `absent` above 0 after the morning run, requests near 400, or `read failed`. The cron's own line in the Vercel logs (`[setupEvidenceSweep] {…}`, one per run) shows why a run stopped early: a `deferred` count under `unpublished`, `shared_refusal`, `provider_failing`, `counter_failed`, `cap` or `deadline`.

---

## 10. What the next build needs from this one

The projection's exact field list (spec §4.4; `src/components/Research/Sheet/setupReadContract.js` `SETUP_READ_FIELDS`), the three answers, the body's keys, and the client read `fetchSetupRead(symbol)`. The Chart view's read binds to these and to `CHART_READ_MODE`. Two notes for it: (1) the swing points and the pullback lows are dated, but the touch bar is not recorded — "which bar touched" must be read from the three lows against `facts.SMA_fast`, a derivation the read must label; (2) `adjustmentMetadata: 'absent'` means the split check could not run (R-1).

---

## 11. For the founder

1. **Merge order:** A, then B, then C, each with a merge commit. B's diff shows A's work until A merges; C's shows B's.
2. **PR C** starts the sweep at the next scheduled run: about 230–275 provider requests a trading day, hard stop 400. To stop it, revert PR C's one commit.
3. **Optional:** publish the rules (`firebase deploy --only firestore:rules`; never indexes with `--force`): no behaviour change, the catch-all already denies the new collection.
4. **Readings to confirm** (approve-by-default unless you say otherwise): R-1 (missing adjustment data reads `measured` with `adjustmentMetadata: 'absent'`, not `refused`), R-2 (the 400 cap is per trading session), R-3 (the brake: eight outcomes of one kind in a row stop a run), R-4 (no work on a weekend or holiday run), R-15 (the 12:30 run is a session's last).
5. **A question (R-17):** the store makes some refusals permanent through its confirm rule (a gap inside the window, a short history). It cannot tell one stock's own from a cause shared by every stock (a closure the calendar lacks, a provider-wide hole, a truncated answer). The sweep's brake bounds a shared cause to about eleven permanent refusals a run, but cannot stop them: that needs a store-level ruling, outside this build (SW-7).
6. **`main` is red on three rows** (`api/_utils/filmRoom/momentExcerpt.golden.test.js`, the write gate): Film Room C2 (#1074) meets a `Map#set` the security pack (#1077) added at `src/constants/leagueTournament.js:923`. It reds every PR's CI, these included, until the gate pins that call as a non-Firestore one or the line changes. For separate tasking; not touched here.
7. **At merge time:** PR B moves the cron count 45 → 46 in three test pins and in BUILD_RULES §6. If `main` gains a cron entry first, those four move to 47 in a one-line follow-up on PR B.
8. **For separate tasking:** the activation observer's log line hides abandoned, finished and excluded counts (Phase 0 point 7).
