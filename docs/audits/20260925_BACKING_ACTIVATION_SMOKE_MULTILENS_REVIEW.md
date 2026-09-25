# Backing activation — founder smoke path: multi-lens adversarial review record

**Branch:** `backing/activation-smoke` · **Reviewed snapshot:** the build commit `be288e92` (working-tree snapshot `ba712d37`, identical content) · **Fix commits:** `26c6d429` (the review fixes and their rows) · `37f590aa` (two follow-up rows) · `5783c5df` (one row made leak-proof) · the record commit (this file). · **Base:** `main` (`5b09de57`).
**Rule:** BUILD_RULES §2 — review is mandatory at ≥10 files or ≥1,500 lines (this branch at `be288e92`: 50 files, +3,751 / −589). Multi-lens, adversarial, independently refuted, `vite build` run, mutation-checked, written down. The prompt briefed one lens: **"light backing for someone who isn't the founder, or on the live site."**
**Reviewer isolation (founder ruling, Sep 2, 2026):** every lens and every refuter worked on its own `git archive` extraction of the reviewed snapshot under the session scratchpad (`review/lens-{light,dev,wiring,script}`, `review/refute-{light,dev,wiring,script}`), `node_modules` symlinked, read-only on git and on the shared working tree; a read-only `git archive main` extraction (`review/base-main`) served comparisons. The coordinator's mutation pass — the mutating lens — ran LAST, after every lens and refuter had reported, on its own extraction (`review/mut`, `run_mutants.mjs`: one substitution per mutant, the named suites run, the file restored byte-identical by sha256). No reviewer wrote to `/home/user/TradeSeven`.

## 0. Verdict

**Ship, with the fixes below applied (commit(s) after `be288e92`, listed in §7).** Four lenses, four refuters, one mutation pass. **No BLOCKER anywhere.** The prompt's one briefed question — can anything light backing for someone who isn't the founder, or on the live site — was answered NO by the LIGHT lens and re-answered NO by its refuter with a wider matrix (uids that are prefixes, supersets, affixes, case or unicode variants of the allowlisted one; whitespace, quotes, trailing commas and other separators in the allowlist; every `VERCEL_ENV` and `BACKING_SMOKE_ENABLED` variant; the allowlisted uid carried in a body, query or header by a NON-allowlisted token → 404 on every door and `{ lit: false }`, zero Firestore touches; the bare hook with the real flag module → dark). The two flip tripwires were shown NOT to fire from the override and TO fire from a code flip.

Findings by severity as filed: 3 MAJOR (DEV-2, SCRIPT-01, SCRIPT-02) · 16 MINOR · 27 NOTE; after refutation: 2 MAJOR (SCRIPT-01, SCRIPT-02 — both runbook, both fixed), 15 MINOR (all fixed or declared), the rest NOTE. Every finding rated MINOR or above is either **fixed in this branch with a guard row** or **declared to the founder** (§9); nothing was dropped silently. Refutation outcomes: DEV 7 CONFIRMED / 1 RE-RATED down / 1 PARTIALLY REFUTED / 0 REFUTED; LIGHT 8 CONFIRMED / 1 PARTIALLY REFUTED / 1 ASSUMED-stands / 0 REFUTED; SCRIPT 9 CONFIRMED / 1 PARTIALLY REFUTED / 1 RE-RATED down / 0 REFUTED; WIRING — §5.

Two things the record wants read before the merge: the **founder decisions** in §9 (the seating deviation; the pitch door lit under the override, its one write declared; the draft-terms attestation; the two Sunday deadlines), and the **separate tasking** in §8 (the League field shows any `isDev` pod of the current week to every viewer — pre-existing on `main`, made reachable by a smoke pod left past Monday).

## 1. Scope

The prescribed "CC (Fable) — Backing Activation PR: Founder Smoke Path (no flag flip)", both code flags `false` throughout:

- **A. The smoke override** — `api/_utils/backingSmoke.js` (`smokeOverrideFor`, `backingLitFor`, `eligibilityLitFor`: preview-only, `BACKING_SMOKE_ENABLED === 'true'`, the verified uid in `BACKING_SMOKE_UIDS`; production ignored entirely); every user backing route and the attest door read through it after auth (the admin re-run and the Friday duty hook keep the bare flag — no caller uid); `GET /api/backing/lit` tells the client the server's decision; `src/hooks/useBackingLit.js` + `src/components/League/backing/BackingLitProvider.jsx` (mounted once in `src/main.jsx`) carry it to every surface gate and the pod card's label; the dark suites and pin suites extended.
- **B. Dev namespace only** — the smoke listing (`smokeListablePod`), `allowDev` materialization for a smoke session, the `smoke_requires_dev` belts in the stake primitive, the dev marker on a smoke session's telemetry, `poolId` on new stake documents and the client's subscription by it.
- **C. The script** — the stake transaction extracted verbatim into `api/_utils/backingStake.js` (`placeStake`); `scripts/backing-smoke.js` + `scripts/backingSmokeLib.js` (seed / advance / refund / status / cleanup, `--dry-run`, the isDev-and-marker refusal, the manifest, the per-collection cleanup verdict).
- **D. The runbook** — `docs/BACKING_SMOKE_RUNBOOK.md`.

Not in scope and not reviewed as this PR's: the flip PR; counsel's copy; any fenced file (none touched, none called); the rules block (unchanged).

**One deviation from the prompt, stated up front.** The prompt's `seed` seats "2 humans (the founder + one synthetic dev user)". A seated founder cannot stake on his own pod — §8's own-pod rule is account-level and the pod list marks his own pod not backable — so the prompt's own next clause ("the founder's own stake makes three backers on two teams") cannot hold on that pod. The seed seats TWO synthetic humans (Smoke Rival A / B) and the founder backs as a spectator, which is the walk the prompt describes (attest → stake → close → settle → results). Recorded here and in the PR body for the founder's ruling; the trainer-side surfaces (the seat's sealed strip on the identity bench) are therefore not exercised by this smoke.

## 2. Method

| Lens | Brief | Tree | Agents |
| --- | --- | --- | --- |
| LIGHT | The founder's: "light backing for someone who isn't the founder, or on the live site" — every door, every path to lit, the env parsing, the production ignore, the client's decision-free hook, the ratchets and tripwires | `lens-light` | 1 reviewer |
| DEV | A smoke session writes nothing outside the dev namespace; a production viewer never sees it; the smoke reaches the dev namespace end to end; the script's write set and the cleanup verdict | `lens-dev` | 1 reviewer |
| WIRING | The moved money transaction (diffed against `main`'s route), the rewired route's answers, the allowlist keys, the client subscription and provider lifecycle, dark byte-identity, BUILD_RULES §1/§4/§9/§10/§11 | `lens-wiring` | 1 reviewer |
| SCRIPT | The founder's walk step by step against the primitives' contracts; every UI string the runbook quotes checked against the copy the components render; the troubleshooting table | `lens-script` | 1 reviewer |
| REFUTATION | Every finding of each lens handed to a refuter on its own tree, instructed to refute it with a concrete repro and to judge each proposed fix | `refute-{light,dev,wiring,script}` | 4 refuters |
| MUTATION | The prompt's four named checks, then a guard check per new row — last, on its own tree | `mut` | the coordinator |

Nine agents in total. The full reports stay in the session scratchpad (`review/reports/`, outside the repository); each is reproduced in substance below.

## 3. Findings and dispositions

Severity is the lens's; "now" is the refuter's. **FIXED** = changed in this branch with a guard row (§6 names the mutant); **DECLARED** = a founder decision recorded in §9, the runbook and the PR body; **NOTE** = recorded, no change; **§8** = separate tasking.

### LIGHT — "light backing for someone who isn't the founder, or on the live site"

| ID | Sev → now | Finding | Disposition |
| --- | --- | --- | --- |
| LIGHT-1 | MINOR → MINOR | The three dev-namespace decisions (`smokeOverrideFor(user.uid)` in the event sink, the pod list, the stake route) were unpinned: a body-uid edit shipped green (M7 in the lens's pass). | **FIXED** — `backingBetaFlags.test.js` pins every `smokeOverrideFor(` call in every backing route as exactly `smokeOverrideFor(user.uid)` and requires the three calls to exist; `event.test.js` adds the behavioural row (a foreign uid in the body changes nothing; a non-allowlisted token carrying the founder's uid in the body is dark). |
| LIGHT-2 | MINOR → MINOR | The `<BackingLitProvider>` mount in `src/main.jsx` was unpinned: with it removed the app reads dark and the smoke fails silently at step 3. | **FIXED** — `useBackingLit.test.jsx` pins the import, the nesting `<UserProvider> … <BackingLitProvider> … <App /> …`, exactly one mount, and none on the fixture-page branch. The refuter's LIGHT-R-1: the wrong ORDER is a crash (useUser throws outside UserProvider), not a dark app — said in the row's comment. |
| LIGHT-3 | MINOR → MINOR | A lit door writes outside the dev namespace: `POST /api/team/pitch` → `teamPitches/{uid}`. (= DEV-2.) | **DECLARED** — see DEV-2. |
| LIGHT-4 | NOTE | The founder's attestation under the override is to the DRAFT terms (`beta-2026-09-draft`); D-aa re-asks at the flip and keeps the draft acceptance in `history[]`. | **DECLARED** — runbook step 4 and "What the smoke writes" say so; §9. |
| LIGHT-5 | NOTE (ASSUMED) | Preview-scoped env vars apply to every branch's preview unless branch-limited; a promoted preview would keep `VERCEL_ENV=preview`. | Runbook step 1: limit both variables to the branch; never Promote. Stays ASSUMED (Vercel docs egress-blocked for every reviewer). |
| LIGHT-6 | NOTE | Six route suites carried no positive override row though the dark suites' comment said each did. | The comment in the three dark suites now says what holds: the helper's lit row + the `GATE_OF` pin, and own rows for the five doors whose behaviour differs for a smoke session (the pod list, the stake, the event sink, attest, the pitch — DEV-R-1). Positive rows for the four pure readers → §8. |
| LIGHT-7 | NOTE | `/api/backing/lit` answers `200 { lit: false }` to every signed-in caller in production, by design. | NOTE — documented in the route header; reveals nothing about the rollout state. |
| LIGHT-8 | NOTE → PARTIALLY REFUTED | A failed first ask reads dark with no retry. The refuter showed the named trigger (a null token when the uid first appears) unreachable in every sign-in flow; only a transient-failure corner remains. | NOTE — the runbook's "sign out and in" row covers it; a retry-once → §8. |
| LIGHT-9 | NOTE | Whitespace or quotes around a variable's value fail closed with no diagnostic. | Runbook step 1 and the table say "no spaces and no quotes". |
| LIGHT-10 | NOTE (pre-existing) | The PR 4 fixture-page hostname gate is the one client hostname read; it lights nothing real. | NOTE — the zero-network suite is the guard; WIRE-4 adds a pin. |
| LIGHT-R-1 | NOTE (refuter) | A misplaced provider crashes rather than darkens. | Covered by the LIGHT-2 row (nesting pinned); comment says so. |
| LIGHT-R-2 | NOTE (refuter) | Server `Boolean(flag)` vs client `=== true` asymmetry; no path today. | **FIXED** — `backingSmoke.js` reads both flags `=== true`. |

### DEV — "a smoke session writes nothing outside the dev namespace; a production viewer never sees it"

| ID | Sev → now | Finding | Disposition |
| --- | --- | --- | --- |
| DEV-1 | MINOR → MINOR (widened) | `placeStake` ran the §7 lazy close on a MISSING pod's PRODUCTION pool before the smoke belt; the refuter's probe showed six production documents written (a voided production stake, its wallet, two ledger entries, totals, the pool). Unreachable today (no production pool exists while dark); a contract defect. | **FIXED** — the refuter's variant: `if (smoke !== true) await ensureClosed(…)`, the `no_pod` answer kept (a smoke pod that is gone was cleaned up, dev pool included). Row: smoke + missing pod + orphaned open production pool → `no_pod`, `writeLog` empty, the pool still open; a non-smoke caller still runs the close. |
| DEV-2 | MAJOR → MINOR | The pitch door is lit for a smoke session and writes `teamPitches/{founderUid}` — a production-namespace document the runbook did not declare and cleanup never removes. The refuter re-rated it: reachable only by an edit the runbook never asks for; the founder's own real record, the attestation's class; and the task's term A ("every backing route and every client surface gate reads through it") plus its changed-files list REQUIRE the door and the ScoutingLine gate to read through the override, so the lens's fix (a) contradicts the prompt. | **DECLARED** (fix b) — the door stays on the override as the prompt requires; `teamPitches/{uid}` is named as the second, founder-triggered document outside the dev namespace in the runbook ("What the smoke writes", step 7) and the PR body; the runbook tells the founder to leave the editor alone during the smoke. DEV-R-1's rows pin the behaviour. Founder decision §9: fix (a) — two one-line reverts plus their pins — is available if he rules the other way. |
| DEV-3 | MINOR | `devTargetVerdict` admitted a `backingStakes` document on `groupId` match alone; a bent manifest naming a production pod could have cleanup delete production stakes. | **FIXED** — `validSmokeRun(run)` (smoke prefix, `poolId === 'dev-' + groupId`, a backers list) is the verdict's first check and refuses everything otherwise; a stake must also name the run's dev pool (`poolId`); `resolveRun` and `cleanup` refuse an out-of-shape run before any read. Rows in the "mutation check 4" describe. |
| DEV-4 | MINOR → NOTE | Cleanup's wallet and event sweeps had no per-run scoping (the founder's one dev wallet serves every run). The refuter corrected the consequence: settlement/refund THROW `wallet_missing` and roll back (nothing minted); reachable only by `cleanup --pod=<A>` on a multi-run manifest. (= SCRIPT-R-2.) | **FIXED** anyway — `cleanup` keeps a wallet (and the events that do not name this pod) of any user a STAYING manifest run still names, and prints `· kept:` lines; runbook: one pod at a time, and what `kept` means. |
| DEV-5 | MINOR | The allowance meter read the PRODUCTION wallet during the smoke (1,000 BP for the whole walk while `dev-{uid}` decremented). (= SCRIPT-04.) | **FIXED** — the pod list answers `walletId: dev-{uid}` for a smoke session only (no key for anyone else); `useBackingWallet` takes the named document (4th argument) and re-subscribes when it arrives; `BackingScreen` passes it. Rows in `backing-pools.test.js` and the new `useBackingWallet.subscription.test.jsx`. |
| DEV-6 | NOTE | `status` and `--dry-run` were read-only by inspection, not mechanically (the precheck wraps its handle in a throwing proxy). (= SCRIPT-10.) | **FIXED** — `readOnlyHandle` (the precheck's proxy, exported from the lib and tested: mutators and escape hatches throw on the handle and everything chained from it; reads and Promise results pass) wraps the handle for `status` and every `--dry-run`. |
| DEV-7 | NOTE | The "writes NOTHING" guard covered the seed + the founder's stake only; a leak in settlement or refund passed. | **FIXED** — the writeLog-verdict walk is a helper run after the seed, after advance and after refund rows. |
| DEV-8 | NOTE (pre-existing, new precondition) | A lit non-smoke caller who learns a seeded `smk_` id can stake the dev pod (contained to the dev namespace; needs a lit caller and an unguessable id). | §8 — the flip PR asserts no `smk_` pod / `dev-smk_` pool remains when it deletes the override; runbook step 9 is mandatory. |
| DEV-9 | NOTE (ASSUMED) | `VERCEL_ENV` must be exposed to the functions; fails closed otherwise. | Runbook step 1 and the table. |
| DEV-R-1 | NOTE (refuter) | The pitch door's override behaviour was pinned only as source text. | **FIXED** — `pitch.test.js`: lit preview + allowlisted uid → 200 and exactly one `teamPitches/{uid}` write; production / non-allowlisted / no switch / no deployment variable → 404, nothing written. |
| DEV-R-2 | NOTE (refuter) | = SCRIPT-01. | See SCRIPT-01. |
| DEV-R-3 | NOTE (refuter, impact ASSUMED) | The admin dev-duty surface (`run-duty`, `includeDevGroups: true`) would process the seeded pod if driven mid-run; the crons exclude it. | Runbook: do not press the dev-duty buttons while a test pod exists; §8 for a guard in that surface. |

### WIRING / MONEY — "the moved transaction, the rewired route, the client lifecycle"

| ID | Sev → now | Finding | Disposition |
| --- | --- | --- | --- |
| WIRE-1 | NOTE | `requireStakeArgs` / `invalid_now` typed 400s carry no `message`; unreachable from the route. | NOTE — §8 (give the belt the route's messages if a second caller ever appears). |
| WIRE-2 | NOTE | The in-transaction `smoke_requires_dev` refusal lacked the pre-transaction one's `message`. | **FIXED** — same message; the fresh-read row asserts the whole refusal. |
| WIRE-3 | NOTE | Under React StrictMode in DEV builds the provider asks twice per uid (the stale reply dropped); production asks once. | **FIXED** (comment) — the provider's header says so. |
| WIRE-4 | NOTE | The fixture page's context is now the app's lit context, so a gated default export mounted under it would light and open a real subscription the page suite's mocks would hide. The refuter judged an import pin PARTIAL (a gated surface could arrive through a host module the page already imports). | **FIXED** — `BackingPreviewScreen.test.jsx`: the refuter's behavioural pin — every mobile and desktop state mounted with the two data hooks armed to THROW (a gated surface reaching the page through any module reds it; non-vacuity shown by rendering the real strip against the armed mock) — plus the import pin (named-only imports from the five gated modules). |
| WIRE-5 | NOTE | `poolIdByGroup` was last-writer-wins: a bare stake after a named one would subscribe at `groupId`. | **FIXED** — a stake that names its pool wins whatever the order; row runs both orders. |
| WIRE-6 | NOTE | A failed first ask reads dark for the session (= LIGHT-8). | NOTE — §8. |
| WIRE-7 | NOTE (pre-existing) | The HOSTS ratchet's full-tree walk sat near the 5 s default under parallel jsdom load. | **FIXED** — an explicit 20 s timeout, the write scanner's precedent. |
| WIRE-8 | NOTE (informational) | The 200 reply's `stake` carries `poolId` on a new stake. | NOTE — deliberate, documented, pinned. |
| WIRE-9 | NOTE | `useUser() ?? {}` implied a null-safe contract `useUser` does not have. | **FIXED** — the `?? {}` dropped; a comment says the provider must sit under UserProvider. |
| WIRE-R-1 | NOTE (refuter, repro'd) | = DEV-1, reached from the money side: a smoke request naming a DELETED pod ran the production tombstone close before the smoke belt; the write is the system's own §7 transition and identical to `main`'s for any lit caller (parity row) — only the primitive's header claim was broader than the code. | **FIXED** — see DEV-1 (the refuter's own proposed variant). |
| WIRE-R-2 | NOTE (refuter, pre-existing) | The protected-store scanner's deny-by-default covers Firestore-SHAPED writes only: a write through a helper-returned ref (`poolRefFor(db, g).set(…)`) or to a literal non-protected collection slips (two of nine mutants). Unchanged by this build. | §8. |
| WIRE-R-3 | NOTE (refuter, informational) | `poolIdByGroup` trusts any non-empty string `poolId` (server-written only; the rules deny client writes). | NOTE — optional hardening → §8. |

### SCRIPT / RUNBOOK — "the founder's walk, step by step; every quoted string"

| ID | Sev → now | Finding | Disposition |
| --- | --- | --- | --- |
| SCRIPT-01 | MAJOR → MAJOR (widened) | A smoke pod still in the database at Monday 00:00 ET of its battle week appears in EVERY signed-in player's League tab for that week (the field query has no `isDev` filter; preview and production share one Firestore) — as an "upcoming" card, and after `advance` as a FINAL card whose synthetic composites top the desktop "Leaderboard · the field" rail. Pre-existing on `main` for any `isDev` pod (an admin-seeded pod shows at once); the runbook was silent. | **FIXED in the runbook** — two deadlines at the top (back a team, and `cleanup`, both before Sunday 11:59 PM ET; what a viewer would see otherwise), repeated at steps 2, 9 and in the script's `seed` output. The client filter → §8. |
| SCRIPT-02 | MAJOR → MAJOR (copy) | Ten "what you should see" strings the surfaces never render (the team-card button, the CPU names, "choose 150", "all three chairs filled", "pays ×", "N of 3 backers picked them", "…% of BP backed them", "cancelled", "Nothing to back yet", "eligibility required"), and a straight apostrophe. | **FIXED** — the runbook rewritten with the rendered strings, every one checked against the copy modules (§7). |
| SCRIPT-03 | MINOR | `--winner=cpu-98` was silently overridden (the CPU's agent half too small; the composite named Smoke Rival A). | **FIXED** — the named winner takes the top agent half whatever its kind; row runs every seat as winner (no ties, D-ae intact). |
| SCRIPT-04 | MINOR | = DEV-5. | **FIXED** — see DEV-5 (the pod-list route, so no `lit.js` pin moves — the refuter's caution). |
| SCRIPT-05 | MINOR (widened) | The runbook omitted the deadline that voids the walk; the late path left a `complete` pod on an `insufficient` pool ("Settlement did not pay: terminal") with no troubleshooting row. The refuter widened it to `refund` after an insufficient close, `advance` after `refund` (SCRIPT-R-1) and a second `advance`. | **FIXED** — `advance` refuses unless the pool is open or closed AND the pod is still forming, `refund` refuses an insufficient/refunded pool or a non-forming pod, both BEFORE any write, each with a plain sentence; runbook rows for each. |
| SCRIPT-06 | MINOR → NOTE | `cleanup` ignored `--founder`, so a founder who browsed but never staked left dev-marked events behind (the refuter: swept by the next cleanup of any run he staked in). | **FIXED** — `seed --founder` records the uid in the pod's marker and the manifest; `cleanup` sweeps the run's founder (marker, manifest or `--founder`). |
| SCRIPT-07 | MINOR | `--pod` could not target a pod absent from the local manifest (another machine, a fresh clone), and the refusal told the founder to `seed`. | **FIXED** — the marker carries `backerUids` (and `founderUid`); `runFromLiveGroup` rebuilds a run from the live document only for an `isDev`, smoke-marked pod routing to its `dev-` pool, marked `recovered`; the refusal no longer says "seed". |
| SCRIPT-08 | MINOR → NOTE | A smoke session's pod list opened `dev-` pools on every other `isDev` forming pod of the week (the refuter: exposure narrow — the other isDev writers stamp the current week or are founder-triggered). | **FIXED** — `smokeListablePod` requires the script's marker (`smoke.tool === SMOKE_POD_TOOL`, one constant shared by the predicate and the lib); rows: an unmarked or mis-marked isDev pod is not listed and its pool never opened. |
| SCRIPT-09 | MINOR | "Open the pod's spectate view" had no path (before Monday the only road is "Open the tape"); the stats live on the Dashboard's agent panel (and, the refuter adds, the desktop Backing screen's results section). | **FIXED in the runbook** — step 7 names both. |
| SCRIPT-10 | NOTE | = DEV-6. | **FIXED**. |
| SCRIPT-11 | NOTE (ASSUMED) | = DEV-9. | Runbook. |
| SCRIPT-12 | NOTE | Copy: the seed's NEXT text ("three chairs"), `seed` silently ignoring `--pod`, the muddled Monday diagnosis, the refund NEXT line ("cancelled"). | **FIXED** — the NEXT texts; `parseArgs` reports `--pod` on `seed` as unknown; the runbook's row 2 and step 8. |
| SCRIPT-R-1 | MINOR (refuter) | `advance` on a refunded pod flipped it back to `complete` before settlement refused — re-admitting it to the League field and blocking `refund`. | **FIXED** — the SCRIPT-05 guards (pool status AND pod status, before any write). |
| SCRIPT-R-2 | MINOR (refuter) | Two live runs share the founder's dev wallet; `cleanup --pod=<older>` deleted it under the newer run's live stake → `advance`/`refund` abort `wallet_missing`. | **FIXED** — DEV-4's per-run scoping (a wallet a staying run names is kept); runbook: one pod at a time, a `wallet_missing` row. |
| SCRIPT-R-3 | NOTE (refuter) | Copy: "pays 1.5×" contradicted the runbook's own walk (×1.33); raw UTC ISO closes in `seed`/`status`; the unknown-`--pod` refusal. | **FIXED** — ×1.33 in the runbook; the script prints closes in ET with the raw instant beside; the refusal's hint. |

## 4. The prompt's four named mutation checks

Run on `review/mut`, a fresh `git archive` of the fix commit `26c6d429`, by `run_mutants.mjs`: one substitution per mutant, the named suites run, the file restored byte-identical (sha256 checked — `restored: true` for every mutant). Each check reds its own row and no suite goes green by accident.

| Check | Mutant | File | Result | The row(s) that red |
|---|---|---|---|---|
| M1 (named check 1) | the override honoured in PRODUCTION (`isPreviewDeployment` also true for `production`) | `api/_utils/backingSmoke.js` | 11 failed | 264 passed (275) | the dark rows red across six files — `backingSmoke.test.js` "PRODUCTION ignores the override entirely", `lit.test.js`, the production arms of `backing-routes.dark`, `backing-stake.dark`, `team-card.dark`, `attest.dark`, the pod list's and the event sink's production rows |
| M2 (named check 2) | a NON-allowlisted uid lit (`includes(uid)` → `length > 0`) | `api/_utils/backingSmoke.js` | 12 failed | 161 passed (173) | the non-allowlisted rows red across eight files — the helper's, the lit route's, the three dark suites', attest's, the pod list's and the pitch door's |
| M3 (named check 3) | a smoke stake written to a PRODUCTION pool (both belts removed) | `api/_utils/backingStake.js` | 4 failed | 123 passed (127) | `backingStake.test.js` "refuses a smoke stake on a PRODUCTION pod before any write" and "refuses on the FRESH in-transaction read too", the route's `smoke_requires_dev` row, the lib walk's dev-only row |
| M4 (named check 4) | cleanup admits a non-`dev-` pool id | `scripts/backingSmokeLib.js` | 1 failed | 24 passed (25) | `backingSmokeLib.test.js` "REFUSES a pool, wallet, stake, event, pod or collection outside the dev namespace or outside this run" |

## 5. CONFIRMED / REFUTED

| Lens | Refuter's verdicts | Refuted sub-claims (kept in the record) | New findings |
| --- | --- | --- | --- |
| DEV | 7 CONFIRMED (DEV-1 widened to six production writes; 3, 5, 6, 7, 8, 9) · 1 RE-RATED down (DEV-2 MAJOR → MINOR; fix (b) over (a) against the prompt's term A) · 1 PARTIALLY REFUTED + re-rated (DEV-4: settlement/refund THROW `wallet_missing` and roll back — no minting, no `careerNet ≠ 0`; `status` prints "no wallet yet", not MISMATCH) · 0 REFUTED. C1–C11 re-verified; C3 "moved verbatim" and C8 (the mirrors query `status == 'battle'`) upgraded from ASSUMED to VERIFIED. 57 files / 1,733 tests green in the refuter's tree. | DEV-4's consequence. | DEV-R-1, DEV-R-2, DEV-R-3 (NOTE). |
| LIGHT | 8 CONFIRMED (1, 2, 3, 4, 6, 7, 9, 10) · 1 PARTIALLY REFUTED (LIGHT-8: the null-token trigger unreachable in every sign-in flow) · LIGHT-5 stands as ASSUMED (Vercel docs egress-blocked) · 0 RE-RATED · 0 REFUTED. C1–C14 re-verified with a wider env/uid matrix and route-level body/query/header carries; the tripwires shown not to fire from the override and to fire from a code flip; 11 mutations re-run. | LIGHT-2's "safe direction" (a misplaced provider crashes — LIGHT-R-1); LIGHT-8's trigger. | LIGHT-R-1, LIGHT-R-2 (NOTE). |
| SCRIPT | 9 CONFIRMED (01 and 05 widened; 02 all ten strings reproduced; 03, 04, 07, 09, 10, 11) · 1 PARTIALLY REFUTED + re-rated (SCRIPT-06: "for ever" false — the next cleanup of any run the founder staked in sweeps the orphans) · 1 RE-RATED down (SCRIPT-08 → NOTE) · 1 CONFIRMED with additions (12) · 0 REFUTED. C1–C16 hold (C3's edge sharpened: Sat 23:59:59 ET is exactly 24.0 h and still eligible; refusal starts Sun 00:00:00 ET). | SCRIPT-06's "for ever". | SCRIPT-R-1, SCRIPT-R-2 (MINOR), SCRIPT-R-3 (NOTE). |
| WIRING | 9 CONFIRMED (WIRE-2, 3, 5, 6, 9 with running repros; 1, 4, 7, 8 by reading + rows) · 0 REFUTED · 0 RE-RATED. Every clean claim attacked and held: the refuter's OWN normalized diff of `main`'s transaction body against `placeStake` (eight hunks, none moving a line; the lens's D1–D14 complete; stake ids and debit keys runtime-identical across the boundary, unicode/`/`/newline/200-char inputs); `main`'s route suite unchanged against the build 86/87 (the one = `poolId` on the document); the golden under the provider in six reply modes (false / throw / `'true'` / `{}` / `null` / `[true]`) with a positive control; the allowlist diff exact, seven of nine scanner mutants caught; settlement/refund the same functions every host calls, `ADMIN_SIM` a legal source, dev handling namespace routing only. | Two wording corrections: (i) the write scanner's deny-by-default covers Firestore-SHAPED writes only (WIRE-R-2, pre-existing); (ii) mounted byte-identity under the provider is provable for 9 of 11 hosts — the two that mount the animated agent face are not stable bare-vs-bare (a probe artefact), held by SSR + DOM-absence rows. WIRE-4's proposed import pin judged PARTIAL — a gated surface could arrive through a host module — so the build added the refuter's behavioural pin instead (see WIRE-4). | WIRE-R-1 (NOTE, = DEV-1, repro'd), WIRE-R-2 (NOTE, pre-existing), WIRE-R-3 (NOTE, informational). |

## 6. Per-fix guard checks — the coordinator's mutation pass

The same pass, one mutant per fix or pin (M5–M18 the build's own guards; M19–M34 the review fixes'). 33 of 34 caught on `26c6d429`; M34 survived and got its row (re-run table below).

| Mutant | What it breaks | File | Result | Guard |
|---|---|---|---|---|
| M5 | the pod list lists a smoke user with the PRODUCTION predicate | `api/tournament/backing-pools.js` | 3 failed | 57 passed (60) | the dev-only listing rows |
| M6 | `smokeListablePod` admits a non-dev pod | `api/_utils/backingPools.js` | 1 failed | 59 passed (60) | the mirror-predicate row |
| M7 | the client hook ignores the flag (context only) | `src/hooks/useBackingLit.js` | 19 failed | 53 passed (72) | 19 rows: the flag-on rows of the hook suite and the dark suite |
| M8 | the provider never asks | `src/components/League/backing/BackingLitProvider.jsx` | 5 failed | 67 passed (72) | the provider rows (one ask per uid; the lit answer lights) |
| M9 | a surface reads something other than the hook (BackingScreen) | `src/components/League/backing/BackingScreen.jsx` | 1 failed | 62 passed (63) | the gate-shape source row |
| M10 | `useMyBacking` subscribes at `groupId`, ignoring `poolId` | `src/hooks/useMyBacking.js` | 3 failed | 13 passed (16) | the poolId subscription rows |
| M11 | the telemetry sink drops the smoke marker | `api/backing/event.js` | 2 failed | 9 passed (11) | the `dev:` id + `isDev` rows |
| M12 | `poolId` omitted from a new stake document | `api/_utils/backingStake.js` | 5 failed | 97 passed (102) | the document-shape rows in the primitive's and the route's suites |
| M13 | the lit route answers `{ lit: true }` to everyone | `api/backing/lit.js` | 6 failed | 32 passed (38) | the lit route's dark rows and the routes dark suite |
| M14 | `backingLitFor` ignores the code flag (override only) | `api/_utils/backingSmoke.js` | 47 failed | 32 passed (79) | 47 rows — the flag-on rows everywhere |
| M15 | attest reads the bare flag again | `api/eligibility/attest.js` | 1 failed | 9 passed (10) | the attest dark suite's gate row |
| M16 | the synthetic week banks a ZERO agent half for humans (D-ae hold) | `scripts/backingSmokeLib.js` | 3 failed | 22 passed (25) | the synthetic-week rows |
| M17 | the synthetic checker skips seat-present | `scripts/backingSmokeLib.js` | 1 failed | 24 passed (25) | the synthetic checker row |
| M18 | the stake route passes `smoke`/`allowDev` for EVERY lit caller | `api/tournament/backing-stake.js` | 61 failed | 30 passed (91) | 61 rows — every production stake in the route suite is refused |
| M19 (DEV-1) | a smoke session runs the §7 lazy close on a missing pod again | `api/_utils/backingStake.js` | 1 failed | 10 passed (11) | the DEV-1 row |
| M20 (DEV-3) | the verdict judges targets against a run of any shape | `scripts/backingSmokeLib.js` | 1 failed | 24 passed (25) | the run-shape row |
| M21 (DEV-3) | a stake admitted on `groupId` alone | `scripts/backingSmokeLib.js` | 1 failed | 24 passed (25) | the verdict's refusal row |
| M22 (SCRIPT-08) | the smoke list admits any isDev pod, marker or not | `api/_utils/backingPools.js` | 3 failed | 82 passed (85) | the marker rows in the pod list suite and the lib suite |
| M23 (DEV-5) | the pod list names no wallet for a smoke session | `api/tournament/backing-pools.js` | 1 failed | 59 passed (60) | the `walletId` row |
| M24 (DEV-5) | the wallet hook ignores the named document | `src/hooks/useBackingWallet.js` | 1 failed | 2 passed (3) | the subscription suite's named-document row |
| M25 (SCRIPT-03) | a CPU `--winner` silently overridden again | `scripts/backingSmokeLib.js` | 1 failed | 24 passed (25) | the CPU-winner row |
| M26 (LIGHT-1) | the event sink decides the dev namespace on a BODY uid | `api/backing/event.js` | 2 failed | 22 passed (24) | the ratchet's `smokeOverrideFor(user.uid)` pin and the behavioural row |
| M27 (LIGHT-2) | the provider not mounted at the app root | `src/main.jsx` | 1 failed | 8 passed (9) | the mount row |
| M28 (WIRE-4) | the fixture page imports a gated default export | `src/screens/BackingPreviewScreen.jsx` | 1 failed | 35 passed (36) | the import pin (see §6 note on the behavioural pin) |
| M29 (DEV-6) | the read-only handle lets a mutator through | `scripts/backingSmokeLib.js` | 1 failed | 24 passed (25) | the handle's row |
| M30 (WIRE-5) | a bare stake overwrites the named pool | `src/hooks/useMyBacking.js` | 1 failed | 15 passed (16) | the order-independence row |
| M31 (SCRIPT-07) | a run rebuilt from an UNMARKED live pod | `scripts/backingSmokeLib.js` | 1 failed | 24 passed (25) | the null-never-a-guess row |
| M32 (DEV-R-1) | the pitch door ignores the override | `api/team/pitch.js` | 2 failed | 16 passed (18) | the pitch suite's override rows |
| M33 (SCRIPT-12) | `seed` silently accepts `--pod` | `scripts/backingSmokeLib.js` | 1 failed | 24 passed (25) | the command-line row |
| M34 (LIGHT-R-2) | the server helper lights on a truthy non-boolean flag | `api/_utils/backingSmoke.js` | 11 passed (11) | SURVIVED on the fix commit `26c6d429` (no row distinguished `Boolean(flag)` from `flag === true` while the flag pins hold it boolean); a row was added in the follow-up commit and the mutant re-run — see the re-run table |

**Re-runs on the follow-up commits** (the two rows of `37f590aa`, the leak-proof row of `5783c5df`; a fresh extraction each):

| Mutant | Tree | What it breaks | Result | Guard |
|---|---|---|---|---|
| M28 (WIRE-4) | `37f590aa` | the fixture page imports a gated default export | 1 failed | 36 passed (37) | the import pin |
| M35 (WIRE-4) | `37f590aa` | the REAL strip mounted under the fixture page's lit context through the slot (a host-module arrival, the refuter's case) | 18 failed | 19 passed (37) | the behavioural row (hooks armed to throw) — and 17 page rows besides, since a lit strip under the page's mocks cannot render |
| M34 (LIGHT-R-2) | `37f590aa` | the server helper lights on a truthy non-boolean flag | 7 failed | 5 passed (12) | the new row — the six knock-on reds were the failed row's flag mocks leaking into the rows below; `5783c5df` restores them in a `finally` |
| M34 (LIGHT-R-2) | `5783c5df` | the same | 1 failed | 11 passed (12) — restored byte-identical | the new row alone |

## 7. Verification

| Check | Result |
| --- | --- |
| `npm run test:run` at `be288e92` (the reviewed snapshot) | `Test Files  800 passed \| 3 skipped (803)` · `Tests  15891 passed \| 64 skipped (15955)` · exit 0 (212 s). The 3 skipped files are pre-existing on `main`. |
| `npm run test:run` at `26c6d429` (the fix commit) | `Test Files  801 passed \| 3 skipped (804)` · `Tests  15910 passed \| 64 skipped (15974)` · exit 0 (243 s). |
| `npm run test:run` at the final tree (`5783c5df` + this record) | `Test Files  801 passed \| 3 skipped (804)` · `Tests  15912 passed \| 64 skipped (15976)` · exit 0 (212 s). |
| `npm run test:rules` | **Not run — no Firebase CLI in this environment** (`which firebase` empty). `firestore.rules` is UNCHANGED by this PR (`git diff main -- firestore.rules` is empty): the smoke reads `backingPools/dev-…` (authed-read) and the viewer's own stakes, both already admitted. |
| `vite build` | exit 0 at `be288e92` (23.5 s) and again on the fixed tree (30.7 s); the chunk-size warnings are pre-existing on `main`. |
| `npm run lint:gate` | exit 0 at `be288e92` and again on the fixed tree. |
| Fenced files (BUILD_RULES §1) | none touched — the 19 paths named in BUILD_RULES §1 intersected mechanically with the 54 changed files: empty; no fenced function called. |
| `git diff --stat main..HEAD` | 54 files changed, +4,531 / −598 (the fix commit added 24 files' worth of rows and one new suite). |
| The code flags | `export const ELIGIBILITY_ATTESTATION_ENABLED = false;` (featureFlags.js:2488) · `export const BACKING_BETA_ENABLED = false;` (:2551) — unchanged; the pin suites and the flag-pin guard green. |
| The write scanner | `api/_utils/compositionProtectedStores.scan.test.js` green: the four stake writes' key moved with the transaction (`api/_utils/backingStake.js::placeStake::set::unresolved: 4`), and the script's six sites are allowlisted with a review note (`_notes_backing_activation_smoke`). |

## 8. Reported for separate tasking (BUILD_RULES §3 — found, not fixed here)

1. **The League field shows any `isDev` pod of the current week to every viewer** (SCRIPT-01 / DEV-R-2): `selectBaseLayerField` (`src/constants/leagueTournament.js`) drops `isTraining` and `voided` only, and the desktop "Leaderboard · the field" rail ranks its seats. Pre-existing on `main` (an admin-seeded dev pod shows at once). Proposed: drop `isDev` pods for viewers that are not lit, the posture `listablePod` already takes — a League-field change outside this PR's scope. The runbook's Sunday deadline is the mitigation here.
2. **The flip PR** (DEV-8): when it deletes the override, assert no `smk_` pod and no `dev-smk_` pool remains, and delete `scripts/backing-smoke.js`'s override-dependent path or keep the script for dev walks with the flag on — the founder's call at the flip.
3. **A retry-once in `BackingLitProvider`** on a transient first-ask failure (LIGHT-8 / WIRE-6); today the runbook's "sign out and in" row is the remedy.
4. **Positive override rows for the four pure-reader routes** (my-stats, results, team-labels, trainer-stats — LIGHT-6): covered transitively by the helper's lit row and the `GATE_OF` pin; a row each would prove each door lights for the founder without the flag mock.
5. **The admin dev-duty surface** (`api/tournament/run-duty.js`, `includeDevGroups: true` — DEV-R-3): a guard that skips smoke-marked pods (`smoke.tool`) would make the runbook's "do not press it" line unnecessary. Impact of driving it over a smoke pod is untraced.
6. **The stake primitive's argument belt** (WIRE-1): typed 400s without `message`; unreachable from the route; give them the route's strings if a second caller appears.
7. **The pod-list revealed rows after settlement** read "pays ×1.33" while the results card reads "paid ×1.33" (the SCRIPT refuter's nuance on SCRIPT-02 #5) — a copy consistency question for the copy owner, not this PR.
8. **The write scanner's shape model** (WIRE-R-2): register the ref-returning helpers (`poolRefFor`, `poolTotalsRefFor`, `walletRef`, `stakeRefFor`, `stakeMetaRefFor`) as ref producers so a write through them is scanned; pre-existing, not this build's.
9. **`poolIdByGroup` hardening** (WIRE-R-3): accept only `groupId` or `dev-${groupId}`, else fall back to `groupId`; today the value is server-written only.

## 9. For the founder

Five decisions this build made on your behalf, each reversible:

1. **The seat.** The prompt seats you in the test pod; §8's own-pod rule would then refuse your stake (the walk needs three backers on two teams). The seed seats two synthetic humans (Smoke Rival A / B) and you back as a spectator — the walk the prompt describes. The trainer-side surfaces (your own seat's sealed strip on the identity bench) are therefore not exercised by this smoke.
2. **The pitch door stays lit for you, and its one write is declared.** The prompt's term A lights every door and every surface gate through the override; the scouting-pitch editor on your Dashboard is one of them, and saving a line there writes `teamPitches/<your uid>` — a real record, yours, outside the dev namespace, which the script never touches. The runbook says leave it alone during the smoke and how to clear it if you don't. If you would rather the door stayed dark until the flip, that is two one-line reverts (`api/team/pitch.js`, `ScoutingLine.jsx`) plus their pins — say so and it lands.
3. **Your attestation is to the DRAFT terms** (`beta-2026-09-draft`, "Draft terms · pending counsel review" on the step). When counsel's terms land you will be asked again; your record keeps the draft acceptance in its history. Real, yours, never written or deleted by the script.
4. **Two Sunday deadlines** (back a team; `cleanup`), because the preview and the live site share one database and a test pod left past Monday 00:00 ET shows in every player's League tab until `cleanup` (§8 item 1 for the permanent fix).
5. **The smoke listing is narrower than "only isDev pods":** it lists only pods this script seeded (the marker). A dev pod from another tool is not the smoke's and is not shown to a smoke session.
