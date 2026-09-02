# Deploy Ceremony PR 2 — Terminal-State Honesty: Cumulative Code Review

**Branch:** `claude/elegant-mccarthy-qpyo3q` · **Base:** `42c55447` (`origin/main`, incl. PR #808 and #809)
**Reviewed at:** `9ef92e45`, with a refutation pass that produced `967aa553`
**Trigger:** BUILD_RULES §2 — review is mandatory at ≥10 files. The branch touches 11.
**Method:** 5 agents across 5 independent dimensions, 71 mutations, all findings verified by running code.

---

## Executive verdict

| | |
|---|---|
| **What the PR does** | The ceremony no longer claims "no battle was created" without checking. Every error commit re-reads `agentBattles` before saying anything. |
| **What review changed** | Two HIGH defects the build missed, both proved by three reviewers independently. One of the fixes was then **refuted and replaced**. |
| **Biggest find** | The PR had installed the *mirror* of the defect it fixes — an unverified POSITIVE claim ("Deployment complete") for a deploy the server had refused. |
| **Second biggest** | The PR's central rendering contract — `verifying` renders as theater — had **no guard at all**. Mutating it reddened 0 of 52 rows. |
| **State at close** | 9153 tests green, `vite build` green. 6 findings deliberately deferred, listed below with reasoning. |
| **Known open item** | One false-reveal path survives, narrowly; see OPEN-1. It needs a founder ruling, not a patch. |

---

## Method, and its one flaw

Five subagents, each on an independent dimension, working on snapshot trees under the session
scratchpad with `node_modules` symlinked, read-only on git and on the shared working tree
(BUILD_RULES §2 reviewer isolation):

| | Dimension |
|---|---|
| **A** | Domain correctness — the honesty invariant |
| **B** | Wiring / lifecycle / async correctness |
| **C** | The recovered-battle CTA thread, and regression on the ordinary paths |
| **D** | Test integrity — is every row a guard? |
| **R** | Refutation — attack every applied fix and adjudicate every deferral |

**Method flaw, recorded because it nearly cost a finding.** A, B and C were given the *same*
snapshot that D was mutating. All three detected the contamination independently (one caught
`agentBattleVerify.js` mid-mutation with a `catch { return {found:false} }` swallow) and re-ran
against private copies before reporting. No finding was lost, but the isolation rule means one
tree per reviewer, not one tree per review. R was given an exclusive tree.

---

## CONFIRMED — fixed in this PR

### C-1 · HIGH · The mirror defect: an unverified *positive* claim
*Found independently by A (PROVED, `revA` P1/P1b) and C (PROVED). Fix refuted once, then replaced.*

The check answers *"does an active battle exist for this agent"*, which is **not** an answer to
*"did THIS deploy create one"*. `decide.js` returns 429 at `:178`/`:187` **before** the
`deployProgress` init at `:208`, so on a refused deploy the server writes nothing and the battle
the query finds belongs to a previous deploy. The ceremony rendered *"Deployment complete / Nova
is ready for battle"* — with the **previous** deploy's picks shown as this deploy's — and the CTA
walked the user into it.

A's P1b is the worse instance: when `ensure-casual-clone` fails, `agentDeploy.js:48` leaves the
target as the **ranked** agent, and `deriveDeployGate` (`commandCenterLiveBattles.js:160`)
deliberately permits a casual deploy beside a live ranked battle — so a failed casual deploy
revealed and entered the user's **live league battle**.

This is the honesty invariant inverted: PR 2 removes an unverified negative claim and had
installed an unverified positive one. It is **not** covered by spec §2.1's "a false reveal is
rarer, self-announcing, and recoverable" — that ruling is about gating the reveal on the
*success* seam. Before this PR the error seam never revealed anything.

**First fix — REFUTED (R, both directions).** Gating the reveal on `ourDeployIdRef` made recovery
depend on the §5.3 baseline race the machine's own comment defers to PR 4.
- *Suppressed real recoveries* (R:A1): when the machine's first observation of the target already
  carries our `strategy_running`, nothing differs from the baseline, no pin is taken, and a
  durable battle the query **found** is discarded as "couldn't confirm". Sharper still,
  `subscribeToAgentDoc` (`agentService.js:56-59`) calls `callback(null)` from its onSnapshot
  **error** handler, which `useDeployTargetProgress` records as delivered — so one transient
  listen failure on `agents/{clone}` permanently disabled recovery while the `agentBattles` read
  still succeeded.
- *Did not close the hole* (R:A3/C3): the pin is inferred by **difference**, so a foreign
  `deployId` — Firestore's cache-then-server delivery, another device, a cron write — pins as
  "ours" and still bought a false reveal.

**Replacement — exact, not inferred** (`967aa553`). `decide.js` commits the battle at `:910`.
Every pre-battle refusal returns a 4xx/409/503 (`:106`, `:111`, `:140`, `:153`, `:165`, `:168`,
`:171`, `:178`, `:187`, `:298`, `:337`, `:844`, `:907`), and the **only** status it can return
after that commit is the catch's 500 at `:1012` — precisely the `:929` failure this recovery
exists for. So a status other than 500 *proves* the server refused before it could create
anything. A transport failure (`postIssued`, no status) is genuinely unknowable and stays
eligible; a bail that never reached the POST does not. No snapshot, no clock, no race.

The client already computed this and threw it away: `agentDeploy.js` returned the HTTP status and
both shells dropped it at `CommandDashboard.jsx:249` / `CommandDashboardDesktop.jsx:159`.

### C-2 · HIGH (dev) · StrictMode freezes the machine in `verifying`, forever
*Found independently by A (P9c vs control P9b), B (PROVED) and C (PROVED). CONFIRMED by R.*

A check belongs to the effect that started it — its cleanup abandons the resolution (`alive =
false`) — but `phaseRef` is a **component** ref and survives. React StrictMode mounts → destroys →
remounts the effect in one dev commit, so a check started by pass #1's synchronous `evaluate()`
left the latch closed and pass #2 could never re-arm: the ceremony spun on stage 1 with **no
reveal, no error and no CTA**. `src/main.jsx:25` wraps the app in StrictMode.

B supplied the reachability: `handleCeremonyRetry` bumped `ceremonyRun` unconditionally while
`handleDeploy` bails on `deployDisabled` **before** resetting `deployResult` — and
`deployBlockedByLive` flips true exactly when the durable battle from the founding incident lands
in the live-battle subscription. So: recovered deploy fails → user clicks Retry → fresh machine
mounts onto the stale `{status:'error'}` → hang.

**Fixed** by releasing the latch at the top of the effect, and by making retry remount only if the
deploy will actually re-run. R attacked the release and confirmed it: React runs cleanup before
re-running the effect, so the only latch it can release belongs to an already-abandoned check.

### C-3 · HIGH · The check re-reads a *weaker* predicate than the app's own
*Found by R.* `status: 'active'` is not "live". `decide.js:718-728` treats a past `expiresAt` as
not-live and only sweeps the doc to `completed` lazily, on the next deploy — so an expired battle
sits in the collection still stamped `active` and was revealed as the one this deploy just
created. The whole authority of this check is that it is a direct re-read; re-reading the wrong
predicate forfeits it. **Fixed** with a client-side filter on the doc already fetched (no index,
no second round trip). An absent or unparseable clock is **not** expiry — failing closed there
would discard real recoveries over a field shape.

### C-4 · MEDIUM · `attemptCheck` used the checker captured at check start
*Found by B (PROVED). CONFIRMED by R.* `targetAgentId` can resolve ranked → clone inside the
400 ms gap, and attempt 2 then queried the previous document — "right answer, wrong document",
the exact failure class this PR exists to prevent. **Fixed**: `verifyRef` is read per attempt.

### C-5 · MEDIUM · An off-contract resolution licensed "no battle was created"
*Found by B (PROVED). CONFIRMED by R.* `if (r && r.found)` treated any non-`found` resolution —
`undefined` included — as a definitive "no", with `checkFailed` still false. A broken checker
contract therefore licensed the exact claim the machine may not make without evidence. **Fixed**:
a resolution that is not `{found: boolean}` is a failed check.

### C-6 · MEDIUM · A stale stash silently beat the recovered battle
*Found by C (precedence PROVED, reachability reasoned).* `pendingCeremonyBattleRef` is cleared
only when a CTA fires, so a reveal dismissed with "Back to hub" leaves the previous deploy's
battle in the ref for the rest of the SPA session — and the recovered path preferred it, opening a
stale (possibly expired) battle instead of the one just verified. **Fixed**: extracted to
`pickCeremonyEntry` (`ceremonyData.js`) so the precedence rule is testable, with the recovered
battle winning. R could not construct a case where the stash is more correct.

### C-7 · LOW · `found: true` with no battle payload revealed and dead-ended the CTA
*Found by C and A (both PROVED at the seam; unreachable via the shipped service).* **Fixed**: the
reveal branch requires `battle?.id`.

### C-8 · MEDIUM (fails safe) · A completed answer was discarded by a later throw
*Found by R (A4).* Attempt 1 resolving `{found:false}` then attempt 2 throwing reported
`lost_contact` instead of `confirmed`. Wrong direction is safe, but the stated rule was not the
implemented one. **Fixed**: a completed answer survives a later failure.

### C-9 · MEDIUM · Teardown left work running
*Found by B (PROVED).* Neither the attempt loop nor the 400 ms gap timer consulted `alive`, so a
dismissed ceremony ran a second Firestore read against a tree that was gone. **Fixed**: the
check's timers are cancelled with the effect and liveness is re-checked after every await.

---

## CONFIRMED — test integrity (all from D, 48 mutations)

D found the new suite **falsifiable row by row**, but six *production lines* with no guard at all
and one vacuous oracle. Every item below is now guarded, each by a row that dies under the named
mutation.

| Unguarded line | Mutation D ran | Rows reddened |
|---|---|---|
| `DeployCeremony.jsx` — `verifying` renders as theater | route `verifying` to the error surface | **0 of 52** |
| `useCeremonyStageMachine.js` — `if (!alive) return;` before the commit | delete the line | **0** |
| `DeployCeremony.jsx` — the live region's honesty | revert to `'Deployment failed.'` | **0** |
| `serverErrorSeenRef.current \|\| ourErrorNow` — first half | drop `serverErrorSeenRef \|\|` | **0** |
| — second half | drop `\|\| ourErrorNow` | **0** |
| `CeremonyError.jsx` — the `errorTone` safety default | default → `'confirmed'` | **0** |
| `CeremonyError.jsx` — per-kind headline selection | always `HEADLINE.deploy` | **0** |
| `DeployCeremony.jsx` — the `useCallback` dependency | `[targetAgentId]` → `[]` | **0** |

**The vacuous oracle.** `CeremonyError.jsx` renders *"Nova made its picks, but the battle couldn't
be created"* for `server_post` — a full-strength non-creation claim that does **not** contain the
literal `'no battle was created'`. Every row policing that literal could not fail under the defect
it named. D proved it: deleting a sibling assertion made the row stop reddening under the
tone mutation entirely. The oracle is now a regex covering both claim shapes.

**Two rows that measured the wrong thing.** Row 6 originally advanced the 90 s watchdog with one
synchronous `vi.advanceTimersByTime(95000)` — inside a synchronous advance the 2 s budget timer
runs to expiry while the checker's promise never gets a microtask, so the row committed via the
**budget** and silently duplicated row 8. It was caught during the build because it failed to red
under the mutation it exists to catch. D then found row 9 had the same disease. Both now cross
their thresholds inside asynchronous advances; D's instrumented run confirms every "empty query"
row now genuinely reaches `checkFailed === false`.

**Rows labelled REGRESSION, not guards** (required by spec §7):
- `ceremonyDeployTarget.test.jsx:345` — "falls back to the ranked agent's `lastDeployedAt`":
  deleting the fallback reddens nothing; the 2020 fixture and a null cooldown render identically.
- `ceremonyDeployTarget.test.jsx:350` — same shape; asserts the default.
- `agentBattleVerify.test.js` — "an empty result is a real answer": restates the return shape.

---

## REFUTED

| Finding | Why it does not hold |
|---|---|
| **No composite index covers the 3-equality query** (C, HYPOTHESIS) | Firestore serves equality-only conjunctions by merge join. Decisive: `src/hooks/useAgentBattleId.js:26-32` already ships the identical `agentId`/`ownerId`/`status` query in production, and `decide.js:709-712` runs a 2-equality one server-side, both with no matching index. |
| **`Promise.race` leaves an unhandled rejection when the budget arm wins** (coordinator's own hypothesis, put to B) | B PROVED it twice — standalone Node harness and in-machine with `process.on('unhandledRejection')` plus the browser event. `Promise.race` attaches handlers to *both* arms. Zero unhandled rejections; CI is not at risk. |
| **The attribution gate keyed on `ourDeployIdRef`** (coordinator's first fix) | R refuted it in both directions — see C-1. Replaced, not patched. |
| **`errorKind` populated alongside `phase: 'reveal'` is a bug** (B, LOW) | Adjudicated by R as defensible: `errorKind` is read only by `CeremonyError`, which renders only in phase `'error'`. It is inert, and it usefully records which error the run recovered from. Left as is, deliberately. |

---

## DEFERRED — reported, not fixed

| # | Finding | Disposition |
|---|---|---|
| **D-1** | The recovered path never runs the optimistic `activeAgentBattles` append (`App.jsx:6704-6725`), so if the user *dismisses* the recovered reveal the hub's "No battle live" card can be wrong for up to 120 s (the poll interval) and Deploy stays enabled. | R notes it **composes** with D-6: a second deploy then hits `decide.js:709-728` and gets a fabricated id. One-line fix available. Recommend fixing next. |
| **D-2** | The recovered path skips `captureBattlePrices`. | R argues **fix now**: that call *persists* to `agentBattles/{id}.portfolio.startingPrices`, is one-shot at deploy time, and nothing else writes it — so a recovered battle is *permanently* scored off the ~15-min-delayed baseline. Not cosmetic. One call site. |
| **D-3** | `ceremonyTiming` drift: `markError` moved to the check's resolution (TOTAL absorbs ≤2.1 s), and a run that errored then recovered records as a clean `reveal`. | The duration drift is bounded and fine. R rejects deferring the second half: a recovered run is the most interesting row in the table #809 exists to produce, and `markReveal` erases it. One field in an already `safe()`-wrapped record-only module. |
| **D-4** | `errorKind` stays set in `phase: 'reveal'`. | Defensible; see REFUTED. |
| **D-5** | The §5.3 unsolicited-progress hole: a foreign `deployId` can pin as "ours". | The real fix (round-tripping `deployId` through the POST response) is fenced and assigned to PR 4; the spec says "do not paper over it here". The replacement attribution gate no longer builds on the pin, so PR 2 no longer *raises* its consequence. |
| **D-6** | `decide.js:748-758` returns 200 + `success:true` carrying `existingBattleId`, **not** `agentBattleId`. See §8 finding below. | Pre-existing; BUILD_RULES §3 — report, do not fix. |

---

## OPEN — needs a founder ruling, not a patch

**OPEN-1 · A 5xx before the battle commit, with a pre-existing battle on the target.**
R's B1: the pin/status says "a battle may exist", the server died before `createAgentBattle` at
`:910` (e.g. a strategy-LLM 500), and a *previous* deploy's battle is still active — so the
recovered reveal shows it, with the previous deploy's picks. The HTTP-status gate does not close
this, because a 500 is exactly the status that must stay eligible.

Closing it needs a decision the spec does not make: either scope the query by `gameMode` (the
Command Center is BaggerBomb-only per Framework §3.1, so a league battle on the ranked target
would be excluded), or bound it by creation time against the deploy's own start, or round-trip the
battle id — which is PR 4's fenced change. **Reachability is narrow**: it needs the clone fallback
to fire, a live ranked battle, and a 5xx before `:910`. Recorded rather than improvised.

**OPEN-2 · `CeremonyError`'s retry button does not know about `deployDisabled`.**
R's B2: `canRetry = Boolean(onRetry) && remaining === 0` — with `deployDisabled` true the button
renders **enabled**, labelled "Try again", and clicking changes nothing. Near-deterministic
timing: the countdown is `lastDeployedAt + 120000` and `deployBlockedByLive` flips when the 120 s
poll lands the battle, both anchored to the same event. The retry *bail* added in this PR is
correct; the *surface* was already unaware. Fix is to thread the gate into `cooldownUntil`'s
sibling — a small change, but it is UI-state plumbing beyond this PR's seam.

**OPEN-3 · The watchdog can author a reveal while the POST is still in flight.**
R's C1: the 90 s watchdog fires with `deployStatus: 'pending'`, the check finds a battle, and the
machine commits to "Deployment complete" with no client outcome to corroborate. Currently gated
out by the attribution rule (no `postIssued` outcome yet), so it is closed *incidentally* rather
than by design. Worth a deliberate ruling.

**OPEN-4 · The target-change re-arm is skipped while latched.** R's C2: `evaluate` returns early
in `verifying`, so a ranked → clone flip landing mid-check never clears `ourDeployIdRef`. C-4
gave the *checker* a per-attempt re-read for exactly this window; the pin has no equivalent. Now
that the reveal no longer keys on the pin, the consequence is confined to the tone.

---

## Build-time check (spec §8) — the assumption does NOT hold

> *Confirm that `deployAgent` sets `status: 'success'` only on a 200 carrying a battle id.*

**It does not.** `deployAgent` (`agentDeploy.js:116`) returns success on `response.ok && data.success === true`, and
`agentBattleId` is optional (`:154`, `data.agentBattleId || null`). `decide.js:748-758` — the
"agent already has an active battle" path — returns **200 + `success: true` carrying
`existingBattleId`, not `agentBattleId`**. So `deployResult` becomes
`{ status: 'success', agentBattleId: null }`, and `App.jsx:6722` fabricates
`id: agent_${Date.now()}` — the *ordinary* reveal's CTA then opens a Battle View whose id matches
no Firestore document.

Found independently by A and C. Pre-existing and untouched by this PR (that path is
`status: 'success'`, so no verification runs). Reachability is narrow — it needs a stale
live-battle poll plus the 120 s server cooldown to elapse — but R notes D-1 gives PR 2's own
recovered path a route to it. **Reported for separate tasking per BUILD_RULES §3, not fixed.**

The tournament handler has the same shape at `decide.js:1376-1382`; it is not on the ceremony's
path.

---

## Verification at close

- **Full suite:** 9153 passed, 62 skipped, 550 files. No pre-existing row weakened; two were
  reconciled where the machine's no-checker path legitimately became asynchronous.
- **`vite build`:** green (BUILD_RULES §2 — no test imports `App.jsx`, so the build is the only
  check that catches a syntax error there).
- **Lint:** clean on every new and changed file. `App.jsx` holds at its pre-existing 147 problems.
- **Mutations:** 71 total. The three the spec required, D's 48, plus 20 run by the coordinator
  against the fixes themselves. Every row in the new suites dies under at least one.

## Citation drift (spec §0)

The spec's §6 line numbers match `def0fcbe` exactly. PR #809 (stage-duration instrumentation,
merged as `42c55447`) shifted them: phase enum `:64 → :66`, latch `:111 → :114`, error commits
`+4/+5/+6`. No rebase was required — the branch was already at `origin/main` including #809.
`DeployCeremony.jsx:34/60/73` and `agentBattleService.js:130-132` matched exactly.

The spec names branch `claude/deploy-ceremony-terminal-state-2irgnl`, which does not exist locally
or on origin; this session's designated branch is `claude/elegant-mccarthy-qpyo3q`, cut from
`origin/main`. No discovery commits existed on any terminal-state branch.
