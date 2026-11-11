# The cockpit's release switch — BUILD_RULES §2 review (2026-11-10)

Review of the build described in `docs/audits/20261110_COCKPIT_RELEASE_READINESS.md` §9–§10 (branch `claude/cockpit-release-readiness`; the local branch is `-d2754a`). Dark: no control document exists, nothing is deployed, no flag moved.

**Finding ids are `RS-L<lens>-<n>`** (RS = release switch; the readiness report's own ids and the Armory/Huddle reviews' `AR-`/`A2R-`/`AF-` prefixes are not reused). A finding the refuter found that the lens missed is `RS-L<lens>-M<n>`.

**Heads.** The five lenses reviewed `1cc36adb`. The refuters re-ran each lens's repros against the same bytes (a fresh `git archive` of `1cc36adb` per refuter). The fixes below landed after them; the final verification (full Linux suite, `lint:gate`, `vite build`, the rules suite, the mutation battery) is on the pushed head, ``e5618ddd` (code head `171e053c`; the commits after it are docs-only)` — §6.

---

## 1. Method (what BUILD_RULES §2 asks, and how it was met)

| §2 requirement | How |
|---|---|
| **Multi-lens, adversarial** | Five independent lenses, each a separate subagent told to *break* the claims, read-only: **L1** domain correctness (`release.js`, the `mode.js` resolver); **L2** wiring and lifecycle (every site's await, the cached view's life, Huddle's seam); **L3** the dark / flag-off guarantee and the model-visible surface; **L4** test integrity (**mutating**: it ran its own mutants against the new tests); **L5** the stage-read script, the rollback check, the rules pin and uid hygiene. |
| **Snapshot trees** | One `git archive` extraction of `1cc36adb` per reviewer (LF, path-distinct, `node_modules` junctioned to the parent install): `scratchpad/snaps/L1…L5` for the lenses, `R1,R2,R3,R5` for the refuters. No reviewer touched the main working tree or ran a git write; every plant or mutant a reviewer applied in its own tree was restored and checked byte-identical (`cmp`). |
| **Independently verified (refuters)** | Every finding was handed to a second reviewer instructed to **refute** it with a concrete repro (one refuter per lens, each in its own fresh snapshot). Verdicts: **CONFIRMED** (tried and could not refute, repro stated), **NARROWED** (real but narrower or lower-severity than claimed), **REFUTED** (premise false, or the behaviour is the spec / a founder ruling). |
| **`vite build`** | `npm run build` on the pushed head — §6. |
| **Mutation-checked where it adds tests** | The build's own battery of 83 mutants (§5) plus lens 4's own. A row that cannot fail under the defect it names is not a guard; lens 4's own battery left 20 test mutants and 8 checker mutants alive and the build's own left one (M50); each was fixed with a row that kills it. |
| **Written down** | This record, cited from the PR; the report's §10.9 summarises it. |

Reviewers returned **text only**; the lens and refuter reports were read in full, and every cite below is to the build's own tree (function and test names, plus `file:line` where it helps).

## 2. Summary

**45 findings from five lenses; every one went to a refuter.** Reported severity: 0 blocker, 9 major, 18 minor, 18 nit. After the refuters: **0 blocker, 2 major** (RS-L4-2 and RS-L4-3 — both *test* gaps, not code defects; the code failed closed and was wired at every site), the rest minor or nit. **Nothing in the lens or refuter reports contradicts the dark claim**: with no control document every battle resolves as before and nothing model-visible changes (lens 3 and its refuter: a 12,480-case differential, 0 differences).

| Lens | Findings | Reported (major / minor / nit) | **CONFIRMED** | **NARROWED** | **REFUTED** |
|---|---|---|---|---|---|
| L1 domain correctness | 9 | 0 / 2 / 7 | 6 | 2 | 1 |
| L2 wiring and lifecycle | 10 | 3 / 3 / 4 | 5 | 4 | 1 |
| L3 the dark guarantee | 4 | 0 / 3 / 1 | 1 | 3 | 0 |
| L4 test integrity | 11 | 4 / 4 / 3 | 8 | 3 | 0 |
| L5 stage read, rollback check, rules | 11 | 2 / 6 / 3 | 9 | 2 | 0 |
| **Total** | **45** | **9 / 18 / 18** | **29** | **14** | **2** |

Plus **three misses the refuters found** (RS-L5-M1, RS-L5-M2, RS-L2-M1), and two questions from lens 1 answered by trace (§3).

**The two REFUTED** are RS-L1-2 (a failed refresh empties the cohort — *the stated spec*; the consequence was real but unpriced, so it is mitigated and put to the founder as Q1 — ruled 2026-11-11: keep it as built) and RS-L2-10 (the extra read for League/CPU battles — the design). **The 14 NARROWED** are real defects with a narrower exposure or a lower severity than the lens claimed; none was dismissed.

**What changed because of the review** (all with a row that fails without it, §5): reads are numbered by start so a stale read cannot undo the kill switch; the evaluator's once-per-run read retries once, a late-landing read corrects a timeout, `cockpit-status` asks twice and the sweep bounds its read by its starvation floor; a failed read logs one line and the stage read and rollback check print the control status; the stage read separates the cohort's own checks from the pilot's and counts the `other` failure class; sweep lag buckets by deadline session; the rollback TRIP says to save its output before disabling; every site's await is pinned as one unconditional line, with behavioural rows at chat and file-directive and a per-file resolver census; the rules pin is proven against planted grants and also fails a wildcard-collection grant.

**Found, not fixed:** eight items (§4, F-1…F-8). The three questions for the founder (Q1–Q3) were **ruled on 2026-11-11** (§4; the readiness report's §9.1), and F-3 was given its timing.

---

## 3. Findings, by lens

Severity shown as *lens → refuter* where the refuter changed it. **Disposition**: FIXED (a change plus a row that fails without it), MITIGATED (the cost is bounded, not removed), ACCEPTED (spec / ruling; stated in the report), LEFT (found, not fixed — §4), QUESTION (the founder's call — §4).

### Lens 1 — domain correctness (`release.js`, the resolver)

Verdict of the lens: no blocker or major; the bucket math, the parse, the cohort test and the resolver differential (300 rows against the pre-build resolver: identical, except two hostile-getter inputs that now answer `off` instead of throwing) are sound.

| Id | Sev | Finding | Refuter | Disposition |
|---|---|---|---|---|
| RS-L1-1 | minor → nit | A slower, earlier-started read lands last and overwrites a newer one: a stale `ok` undoes a newer `disabled` (the kill switch). Not reachable from a request path (none forces; two non-forced reads share one); needs two overlapping invocations in one instance. | **NARROWED** — defect real, exposure narrower | **FIXED**: reads are numbered by start; a result lands only if newer than the last applied (`release.test.js` "RS-L1-1" rows; mutant M42). |
| RS-L1-2 | minor (design) | One failed refresh replaces a good cached view with an empty one; the evaluator forces once per run, so one blip empties the cohort for the whole run. | **REFUTED as a defect** — fail-closed on error/timeout is the brief's spec (readiness §C3 :262); the lost command is a real *unpriced* consequence | **MITIGATED**: a forced read retries once; a read that times out but lands later replaces the failure; `cockpit-status` asks once more; the sweep makes one attempt; a `[release]` line is logged. **QUESTION Q1** (stale-while-error). |
| RS-L1-3 | nit | `inflight = run.finally(…)` is a handler-less derived chain; a throwing `ttlMs` (BigInt) leaks an `unhandledRejection`. | CONFIRMED (unreachable: no caller passes `ttlMs`) | **FIXED**: every option is sanitised; the tracked chain is `run.then` and `run` cannot reject. |
| RS-L1-4 | nit | "Never throws" is false for direct callers (`ensureReleaseView(db, null)`, `getReleaseView(null)`). | CONFIRMED (unreachable) | **FIXED**: argument handling is inside the `try`. |
| RS-L1-5 | nit | `parseReleaseDocument` "never throws" fails on a throwing getter; inherited fields parse `ok`. | CONFIRMED (unreachable via Firestore `.data()`) | **FIXED**: own fields only, inside `try`. (`shareBp: -0` parses `ok` and admits nobody — left.) |
| RS-L1-6 | nit | A bad `nowMs` (NaN/garbage) makes a stale view look fresh; a future `readAtMs` is trusted; a huge `ttlMs` pins the cache. | CONFIRMED (no production caller passes either) | **FIXED**: `!(age <= MAX)`, a future-dated view is not trusted, TTL and bound clamped. |
| RS-L1-7 | nit | The cache is not keyed by `db` handle. | CONFIRMED (one Admin handle per process) | LEFT (documented in `release.js`). |
| RS-L1-8 | nit | `isInReleaseCohort` does not re-validate the view's fields (a hand-built view admits by coercion). | CONFIRMED (unreachable: views come only from the parser) | **FIXED**: the view's fields are re-checked. |
| RS-L1-9 | nit | (a) the brief says a 1 s bound, the code 1,500 ms; (b) the sweep's forced read can spend its 2 s starvation floor; (c) a non-finite `timeoutMs` warns and fails closed. | (a) **REFUTED** (the brief was stale — §10.1 says 1,500 ms); (b) NARROWED nit; (c) CONFIRMED (unreachable) | (b) **FIXED**: the read is bounded by what is left above the floor (mutant M51); (c) clamped to 30 s. |

Questions the lens put, answered by the refuter's trace: **Q1** — tiered battles of *any* player type are in the cohort, **casual clones included** (`createAgentBattle` is called only at `decide.js` tiered and tournament sites; clone battles come through the tiered path); League is not. **Q2** — a battle with no `gameMode` is outside the cohort and fails closed. Both went to the founder (§4): the casual-clone question was ruled 2026-11-11 (they stay in the cohort and count toward "at most 5").

### Lens 2 — wiring and lifecycle

Verdict of the lens: every handler awaits the view before it resolves the mode; no path resolves with a never-loaded view (traced: chat, call-response, bench, status, file-directive, Huddle's `applyPlanToBattle`, the evaluator, the sweep; transaction retries are self-consistent); the client bundle cannot reach `node:crypto`; the `on`/`allowlisted` split is as claimed.

| Id | Sev | Finding | Refuter | Disposition |
|---|---|---|---|---|
| RS-L2-1 | major → **minor** | One failed or timed-out forced read puts every cohort battle `off` for the whole tick, with no retry and no last-known-good; a `next_check` command answered by a cohort player is then not heard (its directive lives to slot + 15 min; the next slot's check lands after it). | **NARROWED** — arithmetic reproduced (heard → not heard → not heard); not a spec violation (fail closed is the spec; §9 did not price the lost command); the evaluator's cold-start trigger does not apply (the forced read comes after the battles query, so the channel is warm); the document does not exist yet | **MITIGATED**: one retry of the forced read (M45, M49); late landing (M43, M44); warn line (M47). The residual (both attempts fail) is stated in §10.1. **QUESTION Q1.** |
| RS-L2-2 | major → **minor** | `cockpit-status` answers `200 {on:false}` on a failed or slow control read; the client re-asks only on a status change, so a cohort player's cockpit stays hidden. | **NARROWED** — reproduced server and client; "until reload" is "until the player re-enters the battle or reloads"; the recheck-sees-cached-failure claim is unproven; no-re-ask-on-off is pre-existing | **MITIGATED**: the route asks once more after its battle read when the first read failed, and a late landing refreshes the cache (M52). **The hook is not changed** (a `src/` client change is outside the prompt) — **LEFT F-3**. |
| RS-L2-3 | major → **minor** | Three of the six handler sites (chat, file-directive, Huddle's `applyPlan`) have only the static check; a dead-branch ensure passes every test. | **CONFIRMED** — plant reproduced (chat 144 / file-directive 182 rows green) | **FIXED**: the pin is an unconditional `await ensureReleaseView(db);` line (dead-branch and `{ nowMs: 0 }` plants fail it: M53, M54); behavioural rows added in `chat.test.js` and `file-directive.test.js` (M69, M70); Huddle stays pin + census + caller pin (no mock-db unit test exists for `applyPlanToBattle`; its emulator suite was not run here — Huddle is dark). |
| RS-L2-4 | minor | The census pins literal `resolveCallRecordsMode(` per file, so "a new site cannot appear unwired" is false (second call in a listed file, an alias, an `isReleaseCohortBattle` caller, a namespace import, `processAgentBattle`). | **CONFIRMED** — plants stayed green | **FIXED**: the census is by identifier over `api/` and `scripts/`, per-file counts are pinned, namespace imports and re-exports are banned, `processAgentBattle` and Huddle's rule functions have caller pins (M71). |
| RS-L2-5 | nit | A `>= 0` assertion cannot fail; the static check passes a dead-branch ensure. | CONFIRMED | **FIXED** (removed; the exact-line pin). |
| RS-L2-6 | minor, latent | With Huddle on, the evaluator is not "one read per run": `applyPlanToBattle`'s non-forced ensure re-reads once the TTL lapses, mid-run, and can spend up to 1.5 s of Huddle's own 3 s sweep deadline. | **NARROWED** — reproduced (2 reads); `DRB_HUDDLE_ENABLED = false`; a successful mid-run re-read is arguably benign (a fresher kill switch) | LEFT (**F-2**) — Huddle is dark; the seam is wired so it is correct the day Huddle lights. |
| RS-L2-7 | minor | Nothing records a failed read; it looks like "not in cohort". | **CONFIRMED** | **FIXED** in part: a `[release] control view <status> — the release cohort is EMPTY…` line; the stage read and the rollback check print the control status. No run-record or sweep-summary field (a schema change outside the prompt) — **F-4**. |
| RS-L2-8 | nit | The 2 s starvation floor is checked before the control read, which can spend 1.5 s. | NARROWED | **FIXED** (M51). |
| RS-L2-9 | nit | `cached = view` is unconditional (= RS-L1-1). | CONFIRMED | **FIXED** (M42). |
| RS-L2-10 | nit | Brief says 1 s; the extra read for League/CPU/non-agent battles. | **REFUTED** as a defect — the brief was stale; the read is the design (the resolver is synchronous), cached 60 s, behind the limiters | ACCEPTED. |

### Lens 3 — the dark / flag-off guarantee

Verdict of the lens: **could not refute the claim**. With no control document every battle resolves exactly as before; 27 changed files, none a §1 fenced file; the only `src/` change is a doc comment and a test title; the 'on' tool text, the calls block and every prompt are untouched; `allowlisted` is the allowlist alone (readers traced). The refuter ran a 12,480-case differential (4 allowlist settings × 8 db behaviours × forced/unforced × 52 battles): **0 differences**.

| Id | Sev | Finding | Refuter | Disposition |
|---|---|---|---|---|
| RS-L3-1 | nit | "Exactly as today" is not literally true at the shipped global `on`: one extra cached `get` per 60 s per instance, one per evaluator/sweep run, up to +1.5 s on a slow first request. | **NARROWED** — the read list is accurate; the claim is true of *resolution*, loose only about the read count; sub-claim (d) ("cockpit-status's exact-reads row was loosened") is **wrong** — it still asserts one battle read, one control read, total 2 | ACCEPTED: §10.1 says it plainly. |
| RS-L3-2 | minor → nit | The control read spends sweep budget the 2 s floor does not reserve. | NARROWED — needs a hanging read, a 2.0–3.4 s budget and a slow state read | **FIXED** (M51). |
| RS-L3-3 | minor (test gap) | A dead-branch ensure at chat / file-directive / applyPlan passes every test. | **CONFIRMED** | **FIXED** (= RS-L2-3). |
| RS-L3-4 | minor, lit-state | A single failed forced read flaps a cohort battle (no stale-while-revalidate). | **NARROWED** — by spec; widened: a blip at `off` can let a non-call directive displace a live call slot without the `superseded` event (by reading) | **MITIGATED** (= RS-L1-2). **QUESTION Q1.** |

### Lens 4 — test integrity (mutating)

Verdict of the lens: the pure logic is well guarded (bucket formula, boundaries, TTL both sides, the cohort exclusions at unit **and** handler level, the global gates, the differential dark-proof is non-vacuous); the gaps were in the glue and the fail-closed transitions. **Every one of its survivors had exit 0 and the full row count (308 rows over the 10 files)** — none was a crashed worker. The refuter reproduced them: 330/330 rows green under the survivors over 12 files, and 1,215/1,215 over 53 files for the chat, file-directive and Huddle sites.

| Id | Sev | Finding | Refuter | Disposition |
|---|---|---|---|---|
| RS-L4-1 | major → **minor** | `call-response.test.js`: the row "global off/shadow, and on for a NON-allowlisted owner → 404 … no call read" passes in order only because an earlier row primed the module-level release cache; alone it fails; shuffled it fails on 5 of 28 seeds (one seed turns a 404 guard into a 200). | **CONFIRMED** — reproduced (alone; seeds 3, 9, 12, 20, 101; 4 of 20 further seeds). Minor: the direction is a false RED under reorder or filter, and CI does not shuffle | **FIXED**: `resetReleaseView()` in the top-level `beforeEach` and an `afterEach` in the release describe; the reads assertion tolerates exactly one control read at global `on`. Re-verified: the row alone and the five failing seeds pass; 3 more seeds across the other release suites pass. |
| RS-L4-2 | **major** | The fail-closed claim has no ACTIVE → failure transition row: after a good read, an error, a hang, a deleted document or a Console typo would leave the cohort ON (fail-open until the 10-minute cut-off) and every test is green (R25b, R26b survive). | **CONFIRMED** — a spec violation ("fail closed, everywhere") in the *tests*; the code does fail closed | **FIXED**: a row takes an active view to error / hang / deleted / typo / disabled and asks for an empty cohort (M63, M64 killed). |
| RS-L4-3 | **major** (S18/S19 → minor) | Three of the sites (chat, file-directive, Huddle) have only the static check (S7–S9 survive); a second resolver site inside an already-listed file is invisible to the per-file census (S18, S19). | **CONFIRMED** (S18/S19 narrowed to minor — a new file with a resolver does fail the census) | **FIXED**: behavioural rows at chat and file-directive (M69, M70), exact-line pins (M53, M54), per-file resolver-identifier counts (M71). Huddle: pin + census + caller pin (**F-7**). |
| RS-L4-4 | major → **minor** | The live `--rollback-check` wiring is pinned by `toContain` on comment-bearing source: `const cohort = null`, a commented-out forced read and a commented-out `process.exitCode = 2` all survive (B2, B3b, B5). | **CONFIRMED** — wiring of a read-only operator script; the pure check is tested | **FIXED**: the pins run on comment-stripped code and pin `const cohort = getReleaseView();` and the read-before-use order (M72–M74). |
| RS-L4-5 | minor | The default 1,500 ms bound is unexercised (R20: default → 60 s survives); `cockpit-status.test.js` is titled "fails or never answers" but only throws. | **CONFIRMED** | **FIXED**: a fake-timer row proves the default (M65); the status row's title says what it does. |
| RS-L4-6 | minor | R5 a `timeout` view cached the full 60 s; R6 a forced read joins an in-flight non-forced read; R7 the bound timer is never cleared. | **CONFIRMED** (R6 effectively unreachable: forced callers never start a non-forced read in their process) | **FIXED** (M66, M67, M68). |
| RS-L4-7 | minor | The stage read's `main()` wiring has no behavioural row: inverted cohort ternaries (Z1, Z2), the control read deleted (Z3), the CPU skip deleted (Z4), the field mask widened to `portfolio`/`evaluations` (Z5, breaks the "masked" claim), the window floor flipped (Z8). | **CONFIRMED** | **FIXED**: the reading is an exported `gatherStage(db, …)` driven through a fake Admin handle (the masks, the window, the CPU skip, the cohort basis, the control line, a render with no id in it); M75–M80. |
| RS-L4-8 | minor → nit | The row that plants a second forced read in the sweep asserts `>= 0` (always true); C13 survives. | **NARROWED** — a real second forced read in `sweep.js` is KILLED (3 rows); only the checker's own planting row was hollow | **FIXED** (removed; named planted assertions; M81). |
| RS-L4-9 | nit | Eight checker conditions have no planted defect (C1, C5, C6, C7, C11, C12, C13, C17). | **NARROWED** — they overlap other checks (`calls !== 1` subsumes C17; the moved-after-resolver check catches C1; a missing import throws at runtime in the behavioural suites) | **FIXED**: each now has a planted row that asserts the *named* problem (M81, M82). |
| RS-L4-10 | nit | `cockpit-bench.test.js`: `expect(bucketOf(…)).toBeLessThan(10000)` cannot fail (the value is `% 10000`). | CONFIRMED | **FIXED** (removed). |
| RS-L4-11 | nit | The static NO GRANT row cannot see a wildcard path (`match /cockpitConfig/{docId}` yields 0 blocks; `allow read;` without an `if`; `match /{col}/release`). | **NARROWED** — the emulator rows (get, list and five write verbs × four identities) would fail on any real grant | **FIXED**: every spelling of a block for the path is matched, **and** a row fails any match block that opens on a wildcard first segment other than the two that exist today; the pin is proven against planted grants. |

Informational (lens 4): `read.catch(() => {})` in `readOnce` is dead (confirmed by the refuter; harmless, left); `Math.min(RELEASE_READ_TIMEOUT_MS, …)` in the sweep is equivalent in production (the one caller injects no `nowMs`). Sweep's `force` was killed only by static rows before — now behavioural (M83).

### Lens 5 — the stage read, the rollback check, the rules pin, uid hygiene

Verdict of the lens: no blocker; the ET bucketing, the arm classification, the baseline flags, the cohort basis, the evaluator trips, the cost arithmetic, the rollback pooling (allowlist-only Markdown identical in 10 old-vs-new combinations), the root default-deny cover and the uid hygiene (0 uid / auto-id / hex-id shaped tokens in any added line) are sound.

| Id | Sev | Finding | Refuter | Disposition |
|---|---|---|---|---|
| RS-L5-1 | major → **minor** | `on` checks are pooled with the allowlisted pilot's (League included): a cohort regression passes silently (100 clean pilot + 10 cohort with 2 timeouts vs 50 `off` → "Trips: none"). | **NARROWED** — dilution reproduces; §C3 says `on` vs `off` per session (pooling is the letter); with n = 0 `off` from real owners (readiness :58) the flag would read "no baseline", not silence | **FIXED**: the cohort's own `on` checks are a separate arm (`cohortFlagOf`, a per-battle flag that carries no id), flagged and tripped on their own (M55, M61, M62, M75, M76). |
| RS-L5-2 | major → **minor** (should-fix) | The "no Firestore write call" row strips `.set(` before it greps, so a Firestore `.set(` is invisible (a planted `set` on the control document: 28/28 green). | **CONFIRMED** | **FIXED**: a receiver-checked scan (only the two local Maps may `.set`) plus planted rows (`ref.set`, a chained `set`, `update`, `delete`, `add`, a transaction, a batch, a bulk writer). |
| RS-L5-3 | minor | The `other` failure class (truncated_response, build_timeout, 429/5xx) is counted but appears in no table or flag. | CONFIRMED | **FIXED** (M56). |
| RS-L5-4 | minor → nit | `ended_with_battle` settles clamp to a lag of 0. | NARROWED (needs an early completion or cancel) | **FIXED**: counted apart (M58). |
| RS-L5-5 | minor | Lag is bucketed by the stamp's ET day; the sweep rider runs on weekends, so a Friday-close call stamped Saturday is in no row. | **CONFIRMED** | **FIXED**: bucketed by the session of the deadline (M57). |
| RS-L5-6 | nit | A `replace` after a `go` acknowledgment counts as two commands. | CONFIRMED (reachable) | LEFT — stated in the script's KNOWN LIMITS (**F-5**). |
| RS-L5-7 | nit | Overdue queue rows over-count mid-session (a `next_check` row is due at its slot, held to the close). | CONFIRMED | LEFT — KNOWN LIMITS (**F-5**). |
| RS-L5-8 | minor | A failed control read silently makes `--rollback-check` allowlist-only: a cohort regression can read NO TRIP when the read failed. | **CONFIRMED** (TRIP → NO DATA on error/timeout/disabled) | **FIXED**: a control-status line, a failed read says the cohort was **not measured** (M59, M60); byte-identical output when no view is supplied. |
| RS-L5-9 | nit | The static NO GRANT pin is narrower than its title: `match /cockpitConfig/{docId} {` yields 0 blocks; a one-line grant evades both static checks. | CONFIRMED | **FIXED**: every spelling is matched (`{docId}`, a literal document, `{doc=**}`, the collection-group form) and the pin is proven against planted grants. |
| RS-L5-10 | nit | `--json` gains `window.cohort`/`window.control`; "allowlisted" labels remain in Section I. | CONFIRMED | LEFT (**F-6**): relabelling would change the allowlist-only Markdown that is pinned byte-identical. |
| RS-L5-11 | nit | The "largest run" columns are independent maxima; holidays print a zero row; ordinals re-assigned per read; a platform-killed run writes no record; `--out` can overwrite a repo path. | CONFIRMED (bundle); `--out` is **not** a defect (the operator's own argument) | LEFT — KNOWN LIMITS (**F-5**). |
| RS-L5-M1 | (missed) | After the kill switch is thrown (or the share lowered, the salt changed), `--rollback-check` re-pools an empty or smaller cohort: TRIP while active, NO DATA once disabled — and the TRIP text tells the founder to disable. | found by the refuter | **FIXED**: the TRIP text says **SAVE THIS OUTPUT FIRST**. |
| RS-L5-M2 | (missed) | `cohortRead`'s "outside the allowlist" basis does not apply `isCpuUserId`. | found by the refuter — moot (CPU seats never dispatch, so they have no `on` ticks) | NOTED. |
| RS-L2-M1 | (missed) | The report's §9 table cites "§10.4" for the League refusal at every handler. | found by the L2 refuter (the snapshot ended at §9) | §10.4 now carries it. |

---

## 4. Found, not fixed — and the founder's rulings (2026-11-11)

### Found, not fixed

| # | What | Why it was left | Where it lives |
|---|---|---|---|
| **F-1** | A failed control read is still an empty cohort when both attempts fail (the evaluator) or on the one attempt (a request path, the sweep): every cohort battle in that evaluator run is an `off` check, and a `next_check` command a cohort player answered in that slot is then not heard. An allowlisted owner never loses a check this way. | Fail closed is the prompt's spec; what to keep through a failure was the founder's call (Q1) and is **ruled: keep it as built** (below). The build bounded the cost (retry once, late landing, status retry, one log line); it did not remove it. **Revisit only if a stage read ever shows a failed control read.** | §10.1; RS-L1-2, RS-L2-1, RS-L3-4 |
| **F-2** | With Huddle on, the evaluator is not "one read per run": `applyPlanToBattle`'s non-forced ensure re-reads once the TTL lapses mid-run and can spend up to 1.5 s of Huddle's own 3 s sweep deadline. | Huddle is dark (`DRB_HUDDLE_ENABLED = false`); a successful mid-run re-read is arguably benign (a fresher kill switch); the seam is wired so it is correct the day Huddle lights. Worth re-reading when Huddle's flag moves. | RS-L2-6 |
| **F-3** | The client hook (`useCockpitStatus`) re-asks only on a status change, so a wrong `on: false` (both control reads failed on a cold status function) hides the cockpit until the player re-enters the battle or reloads. | A `src/` client change is outside this build (the prompt: no model-visible change, wiring at the handler entries). The server side asks twice and a late read refreshes the cache, so it takes a real Firestore stall past 3 s on a one-document read. The fix is a hook retry plus a `retry` body — its own small change. **Timing ruled 2026-11-11: before the first share above 0; it rides with the first-time intro build.** | RS-L2-2 |
| **F-4** | No run-record or sweep-summary field records a failed control read; it leaves a `[release] control view …` log line and the stage read and rollback check print the control status. | A field on `agentEvalRuns` / the sweep summary is a schema change outside the prompt. | RS-L2-7 |
| **F-5** | The stage read's stated limits: commands vs acknowledgments are classed by the call's *current* answer kind (a `replace` after a `go` counts as two commands); the overdue-queue-row count is raw (a `next_check` row is due at its slot but the sweep holds it to the close, so mid-session it over-counts); owner ordinals are re-assigned per read; the "largest run" columns are independent maxima; weekends are skipped and a market holiday prints a zero row; a run killed at the platform ceiling writes no `agentEvalRuns` record. | None enters a trip; each is in the script's header (KNOWN LIMITS). | RS-L5-6, -7, -11 |
| **F-6** | `--rollback-check`'s Section I heading and its Coverage line still say "allowlisted"; `--json` gains `window.cohort` and `window.control` (`null` when not supplied). | Relabelling would change the allowlist-only Markdown that is pinned byte-identical. | RS-L5-10 |
| **F-7** | The Huddle seam has no mock-db unit test (`applyPlanToBattle` has none today); it is pinned by an exact-line await check, the census, a caller pin and the lens-2 trace. Its emulator suite `test/rules/huddleApply.rules.mjs` was not run here. | Huddle is dark. | RS-L2-3 |
| **F-8** | Two code nits left as documented: the cache is not keyed by the `db` handle (one Admin handle per process); `shareBp: -0` parses `ok` and admits nobody. | Unreachable in production. | RS-L1-7, RS-L1-5 |

### The founder's rulings on the questions (2026-11-11; the readiness report's §9.1)

1. **Q1 — stale-while-error. RULED: keep it as built — fail closed, with the one retry.** "The kill switch has to be fast exactly when the store is struggling." Revisit only if a stage read ever shows a failed control read. *The question was:* should the cohort keep the last good view through a short control-read failure (say ≤ 60 s; `disabled` and a deleted document still take effect at once), instead of failing closed to the allowlist? *As built:* fail closed, as the prompt says, with a retry. *Cost of the alternative:* a failed read after a `disabled: true` write could keep the cohort on for up to that grace — the kill switch is slower exactly when the store is struggling.
2. **Q2 — casual clones. RULED: they stay in the cohort and count toward "at most 5 real concurrent battles"; no new condition.** "Nearly every BaggerBomb battle runs on the player's casual clone, so a clone battle is that player's normal battle." *The question was (the report's §9 question 2, confirmed by trace):* a casual clone's battle is a tiered agent-mode battle of a real owner, so it is in the cohort when its owner is (`createAgentBattle` is called only at the tiered and tournament sites; clones come through the tiered path). Do they count toward the "at most 5 real concurrent battles"? If they do not, the cohort test needs one more condition (a non-clone `agentId`); the stage read counts them as ordinary agent-mode battles.
3. **Q3 — C5 item 3 (the League slot label). RULED: "can follow" for this release**, since League is outside the cohort; it becomes the first item of the League cockpit arc. *(The report's §C5 row, its header counts and G15 are updated in place.)*
4. **F-3 — the `useCockpitStatus` re-ask. TIMING RULED: before the first share above 0; it rides with the first-time intro build.** So the prerequisites for the first share above 0 are Amendment H and this re-ask; `shareBp: 0` may be written at any time.

## 5. The mutation check

The build carries its own battery of **83 mutants** (`scratchpad` only; not committed — the list is reproduced here by group). Each mutant edits ONE file (exact string → string), runs the named test files with vitest, and the **exit code plus a full row count** is the verdict (a crashed worker reads as a pass otherwise; the first `% 9999` mutant broke collection and was re-cut as `% 10001`); the file is then restored from the committed LF blob and the restore proved by hash, and `git status` is checked clean after the battery.

| Group | Mutants | What they flip |
|---|---|---|
| Bucket and cohort | M01–M10, M38 | the modulus, the byte order, `<` vs `<=`, League and non-agent modes admitted, a CPU seat (flag and `cpu-` id) admitted, an empty owner admitted, an inactive view admitted, the parse checks of `disabled` / `shareBp` / `salt` |
| View and cache | M11–M18, M39, M42–M49, M63–M68 | disabled ignored, the 60 s cache, force ignored, concurrent reads, a read error admitting everyone, the timeout, the stale cut-off, the failure TTL, the read bound, the sequence guard, late landing, the forced retry, the warn line, a future-dated view, an active view surviving a failure, the default bound, a timeout cached for the full TTL, force joining an in-flight read, the timer |
| Resolver | M19–M21 | the cohort ignored, the allowlist path narrowed (League), a read below global `on` |
| Sites | M22–M29, M37, M40, M52–M54, M69–M71, M83 | `allowlisted` following the resolver; each site's await removed, in a dead branch, or dated 1970; the evaluator and sweep reads dropped or non-forced; a second resolver site; the status retry |
| Sweep | M50, M51, M83 | a retry, an unbounded read, a non-forced read |
| Rollback check | M30, M31, M59, M60, M72–M74 | the verdict ignoring an active cohort, the cohort not pooled, the control line missing or reporting a failed read as read, the glue commented out |
| Stage read | M32–M36, M41, M55–M58, M61, M62, M75–M80 | the wall boundary, the baseline flag, the shadow era, the allowlist ternaries, the sweep deadline, the cohort arm, the `other` class, the lag bucketing, `ended_with_battle`, the cohort flag, the field mask, the window, the CPU skip, the control read |
| Checkers | M81, M82 | a condition of the site checker deleted |

**Result: 83 / 83 killed on the final code.** History: 41 / 41 on the first build; round-2 mutants for the review fixes 20 / 21 on the first tests (**M50** survived — the sweep's retry had no row — then killed); lens 4's own survivors (20 mutants and 8 checker mutants) each fixed with a row that kills them (M63–M82); four older mutants (M16, M17, M18, M28) had their anchors updated after the fixes moved the code and were re-run (the runner now reports a broken or skipped mutant instead of dropping it silently).

**What "killed" does and does not mean here.** Several guards are **source-text pins**, not behavioural proofs: `releaseSites.test.js` (the awaits, the census), the stage read's `main()` call, the rollback script's glue, the rules pin. They guard against the named defect, and each is planted against; but at **Huddle's seam** there is no behavioural row at all (**F-7**). The behavioural rows are at call-response, bench, status, chat, file-directive, the evaluator and the sweep. Lens 4 recorded two equivalent mutants (a dead `.catch`, and the sweep's `Math.min` — one caller injects no clock); this battery recorded none.

## 6. Verification on the final head

| Check | Result |
|---|---|
| Full suite — `vitest run --maxWorkers=8`, `TZ=UTC`, under `flock /tmp/pd-suite.lock` | **1,400 files; 30,545 tests: 30,438 passed, 107 skipped, 0 failed; exit 0** |
| `npm run lint:gate` (`--max-warnings 0`) | **exit 0** |
| `npm run build` (`vite build`) | **exit 0** |
| `npm run test:rules` (Firestore emulator, Java 21) | **41 files, 741 tests passed; exit 0** — including `cockpitReleaseDenials.rules.mjs` (the runtime denials for four identities with positive controls, and the static pins) |
| Mutation battery | **83 / 83 killed** (review record §5) |
| uid hygiene | all 3,889 lines added in `origin/main..HEAD` scanned for both known uids (10-character windows) and for uid-shaped tokens: **none** |
| Production | two read-only runs of the stage read (`.get()` only, no uid in its environment); nothing else touched production; **no write, no deploy, no flag, no environment variable changed** |

**The merge with main.** `origin/main` @ `7f883c9c` (#1032, Huddle S1) is an ancestor of the branch (merged at `a0a4ba87`); it was re-fetched before the run and had not moved. The run is therefore on the tree CI would test (the PR merged with main), in WSL (Ubuntu), in a private worktree of `~/pd-ci` at the exact commit.

**Notes.** (1) The first rules attempt exited 1 because **another session's emulator held port 8080**; the rules step was re-run alone once the ports were free and is green (the suite, lint and build ran once, on the same commit). (2) On Windows two **pre-existing** rows are red on a CRLF working tree — `agent-evaluate.tickStamps.pins` (an anti-vacuous check) and an `agent-evaluate.evalRun` row that counts "exactly ONE block … allow read, write: if false;" (a file this build extended, but not its rows); both are green on Linux, the CI platform. (3) The checked commit is `e5618ddd` (code head `171e053c`); the commit that records these numbers is docs-only, and `vite build` was re-run on the exact commit that was pushed (below).
