# R2 closeout — provisioner-lease operations tooling (steps 1.9 / 8B)

**Branch:** `ops/lease-drain-tooling` · **Base:** `main` @ `91ad40b7` (1.1 merged as PR #771, deployed) · **Session:** 2026-08-17
**Freeze exception:** activation-gating script — logged. `git fetch origin` run first (§3); branch cut fresh from `main`, tree clean.

**Why now:** step 1.2 pins THE ACTIVATION SHA and forbids any commit after it, so drain tooling written later would re-open step 1 from 1.1. R2 must close first.

---

## Executive verdict

| Item | Result |
|---|---|
| The gap R2 named | **CLOSED** — `drainProvisionerLeases` / `purgeReleasedProvisionerLeases` had **zero** callers anywhere; the operator had no command to run at the close |
| Deliverable | `scripts/composition/lease-ops.js` (CLI) over `api/_utils/compositionLeaseOps.js` (testable logic) |
| Subcommands | `list`, `drain`, `resolve`, `purge` — dry-run default, `--apply` to write |
| **Works with the epoch CLOSED** | **VERIFIED, not assumed** — dedicated test block against a seeded `{state:'closed'}` epoch |
| Live smoke | `list` and `drain` (dry) run clean against production, read-only |
| Suite | 12 failed files / 21 failed tests — **identical to the `f59e76f3` baseline**, zero new failures |
| `vite build` | green |
| B3 protected-store ratchet | **tripped and satisfied** — two new call sites registered with human-review notes |
| Fenced files edited | **NONE** |

---

## 1. What was actually missing

`grep` over all non-test code for `drainProvisionerLeases`, `purgeReleasedProvisionerLeases` and `listUnreleasedProvisionerLeases` returns **zero callers** — no cron, no endpoint, and nothing under `scripts/composition/`. The runbook named the functions at 1.9 and 8B and stopped there. At the close the operator would have been hand-authoring an invocation, inside a closed epoch, under time pressure — with a stuck lease already blocking the drain.

## 2. Shape

Logic in `api/_utils/compositionLeaseOps.js`, CLI in `scripts/composition/lease-ops.js` — the `compositionRunbookGates.js` split, so the runbook's behaviour is unit-proven rather than trusted to a script that runs once, live.

| Subcommand | Writes? | Behaviour |
|---|---|---|
| `list` | never | Every unreleased lease: holder, leaseId, acquiredAt, expiresAt, and **stuck** |
| `drain` | never | Dry: ONE classification pass, no polling — `WOULD_DRAIN_IMMEDIATELY` / `WOULD_WAIT` / `WOULD_REFUSE`. `--apply`: the 1.9 call, polls until nothing is active |
| `resolve` | yes | #3's attributed act; requires `--lease-id --operator --reason --apply` |
| `purge` | yes | The 8B call; requires `--operator --apply`; released-only |

Three decisions worth stating:

**`stuck` is never re-derived.** The row's flag is taken from which bucket `listUnreleasedProvisionerLeases` put the lease in, so this report and the drain's refusal cannot disagree about what "stuck" means. That is BUILD_RULES §9 applied to an operator tool, and it is pinned by a boundary row: a lease expiring exactly at `now` is stuck in both the listing and the drain.

**A refusal is structure, not a throw.** `runDrain` catches `StuckProvisionerLeaseError` and returns named holders plus a **pre-filled, runnable** `resolve` command per lease. Operator and reason stay as `<placeholders>` — the tool must never look like it made the "holder is dead" call itself. A test asserts the placeholder survives.

**Dry-run means dry-run, including no waiting.** The drain preview does one pass instead of blocking up to 150s, so rehearsing the 1.9 step is instant.

**Added beyond the three requested subcommands:** `resolve`. The ask was that a refusal pre-fill "the exact `resolveStuckProvisionerLease` invocation" — but a raw JS call is not runnable from a shell, so the pre-filled command is a `lease-ops.js resolve …` line, and that subcommand has to exist for the pre-fill to mean anything. Attribution is unchanged: operator and reason are yours.

## 3. The closed-epoch claim — verified, not assumed

Step 1.9 runs with the epoch **closed**, so "these still work when closed" is the claim the tool rests on. `compositionLeaseOps.test.js` has a dedicated block that seeds `composition/writeEpoch = {state:'closed'}` and runs **every** operation against it: list, drain-preview, live drain, resolve (and the drain clearing afterwards, still closed), purge.

That block opens with an **anti-vacuous row** asserting the fixture really is closed at the address the fence reads — if the seed were wrong or the doc address drifted, every row under it would prove nothing.

The underlying reason it works: none of these helpers consults the write-epoch fence. They are Admin-SDK reads plus, for the two mutating ones, direct doc writes; the rules layer governs client SDK only. But that is the explanation, not the evidence — the evidence is the block.

## 4. Verification

| Check | Result |
|---|---|
| `compositionLeaseOps.test.js` | 19 rows green |
| Live CLI smoke, read-only | `list` → `0 active, 0 STUCK`; `drain` (dry) → `WOULD_DRAIN_IMMEDIATELY`; both wrote report artifacts |
| Usage paths | bad/missing subcommand, `resolve` without `--operator`, `purge --apply` without `--operator` all refuse with usage |
| Artifacts | `scripts/composition/out/` — already gitignored (`.gitignore:104`), so run output is never committed |
| Full suite | 12 failed / 473 passed — identical failing set to baseline, **zero new** |
| `vite build` | green |

**The B3 ratchet fired, which is the system working.** `compositionProtectedStores.scan.test.js` flagged two new unlisted write sites. Both are B3-EXT one-hop call sites passing `db` at arg index 0; neither adds a write *surface* — they delegate to helpers whose definition-side writes are already listed. Registered in `compositionProtectedStoresAllowlist.json` with a human-review note, per the file's own rule. `list` and `drain` carry no entry: they read only.

## 5. Runbook wiring

Tooling nobody can find is no better than none, so the runbook now names the commands inline:

- **Step 1.9** — dry form first, then `drain --apply`, with the `resolve` line for a refusal and the note that all of it works closed.
- **Step 8B** — the `purge` dry/apply pair, restating that stuck leases are never purged.

---

## 6. REPORTED, NOT FIXED — `ensure-casual-clone`'s `maxDuration: 10`

Measured rather than asserted. A read-only sample of ranked agents (the copy **source** for a re-sync):

| docs copied per re-sync | value |
|---|---|
| max | **202** (176 rules + 26 bundles) |
| second heaviest | 180 |
| median | 9 |
| mean | 68 |

`copyAgentSubcollections` (`trainingClone.js:150-158`) writes them **sequentially** — `await cloneRef.collection(sub).doc(id).set(...)` in a loop, one round trip per doc. At a conservative 25–50 ms per round trip, 202 docs is **5–10 s against a 10 s ceiling**. So yes: for the heaviest agents the ceiling is plausibly what mints orphans, and a kill there leaves the lease unreleased (`finally` does not run on a platform kill) → stuck at +120 s → refuses the drain.

**But the scoping matters, and it cuts against urgency:**

- **The casual endpoint cannot mint orphans during the activation window at all.** Step −1 sets `CASUAL_CLONE_CONCURRENCY_ENABLED=false` for the whole window and restores it only at step 9. The exposure is **post-step-9 steady state**.
- **The path that IS live during the window is training-pod provisioning**, whose entry points carry `maxDuration: 300` (`activate-training-pod.js:29`, `cron/tournament-orchestrator.js:26`) — 30× the headroom.
- **S1 already cut the mint rate**: an all-existing tick now takes no lease at all, and the live registry currently reads **0 leases**.
- **And an orphan is no longer a blocker.** Before this branch it meant hand-writing a resolution inside a closed epoch; now it is one attributed command that the drain itself prints.

**The shape, for your ruling:**

| Option | What it is | Cost / risk |
|---|---|---|
| **A — raise the ceiling** | `maxDuration: 10 → 60` in `ensure-casual-clone.js`. One line; 300 is available on this plan (the tournament handlers use it). | Trivial. Buys headroom; does **not** address the underlying sequential cost. Safe to land here. |
| **B — batch the copy** | Replace the sequential loop with a `db.batch()` (500-doc limit; 202 fits) or chunked `Promise.all`. Turns 202 round trips into one, cutting re-sync to well under a second. | **This is the real fix** — but `copyAgentSubcollections` is SHARED with the training path, which **is** live during the window. Changing its write batching during an activation is exactly the kind of change that should not ride a tooling PR. |
| **C — do nothing** | Rely on the scoping above plus the new `resolve` tooling. | Defensible: the window is protected, the rate is down, and recovery is now one command. |

**My recommendation: A now if you want anything in this branch, B as its own task after the activation, never B during the window.** A is one line with no behavioural change beyond headroom; B touches a function the live training path depends on and deserves its own diff, its own tests, and its own review — not this one. I have applied **neither** pending your word.
