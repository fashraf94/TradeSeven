# N1 Mitigation — Adversarial Build Review (mon-0845 disable + stranded precheck)

**Date:** 2026-09-12 · **Branch:** `tournament/n1-mitigate-mon0845`
**Reviewed at:** `af00718e` (the mitigation commit); fixes landed as `5c50e96f`.
**Why this record exists:** the cumulative branch diff is **12 files / 769 insertions**, which crosses the BUILD_RULES §2 **≥10 files** mandatory-review threshold. §2 requires the findings, dispositions and CONFIRMED/REFUTED split to be written down in `docs/audits/` and cited from the PR. This is that record.

Scope note: the file count is inherent to the prescribed build (three enforcement points → 3 source files + error mapping + client door + client copy; four test files; two scripts), not scope creep. §8 was considered and no scope reduction was available below the threshold.

---

## 1. Executive verdict

| | |
|---|---|
| Review performed | **Yes — 3 adversarial lenses on isolated snapshot trees, all 3 completed** |
| Findings raised | **11** |
| CONFIRMED and fixed | **9** |
| CONFIRMED and deliberately NOT fixed (disclosed) | **2** (F1 scope limit, C4 coverage gap) |
| REFUTED | **0** |
| Fenced files touched (§1) | **0** |
| Full suite | exit 0 — `Test Files 655 passed \| 3 skipped (658)`, `Tests 12368 passed \| 64 skipped (12432)` |
| `vite build` (§2 requirement) | exit 0 |
| Mutation checks | 7 applied, each killing exactly its own guard row |

**Two findings were dangerous**, both in the operational scripts rather than the product code, and both would have damaged real data if the founder had acted on the script output:

- **B1** — the precheck labelled every never-fired pod "TREAT AS STRANDED" and then printed the command to expire it. It would have fired on the upcoming Monday's own freshly-claimed pod.
- **B2** — the apply script could have silently expired a live, in-progress draft with humans seated.

Neither was caught by the author's own mutation checks, the full suite, or the build. They were caught by an adversarial reviewer instructed to refute, with an executable repro. That is the §2 mechanism working as designed.

---

## 2. Method, and an honest note on it

**Reviewer isolation (§2):** one `git archive af00718e` extraction per reviewer under the session scratchpad, path-distinct (`review/L1`…`L5`), `node_modules` symlinked, reviewers read-only on git and on the shared working tree.

**First attempt failed.** Five lenses were launched and **all five died on an API session rate limit (429) before producing any findings**. No results were used from that attempt. This is recorded because §2's disclosure rule exists precisely for it.

**Second attempt** consolidated to three lenses on a different model; all three completed:

| Lens | Coverage | Outcome |
|---|---|---|
| **A** | Disable semantics, gate completeness, §1/§4/§6/§9/§10/§11 rules compliance, blast radius | 4 findings (F1–F4) |
| **B** | The two operational scripts — correctness, safety, founder-facing honesty | 6 findings (B1–B5 + an info row), 2 with executable repros |
| **C** | Test integrity — mutation-checking every new row | 4 findings (C1–C4) |

**One process defect worth recording:** Lens C's snapshot tree arrived contaminated by a *prior, rate-limited* lens that died mid-mutation, leaving `hourEt: 11` in its copy of the slot config. Lens C detected the 2 unexplained baseline failures, cross-checked against the real repo read-only, restored, and re-established a clean baseline before doing its own work. The real repo was never affected (verified: `hourEt: 8`, `git status` clean throughout). **Lesson for §2's isolation rule: a reviewer killed mid-mutation leaves a poisoned tree, so a fresh extraction per attempt — not per reviewer — is the safer discipline.**

---

## 3. Findings, dispositions, CONFIRMED/REFUTED

### Lens B — the scripts

| # | Severity | Finding | Disposition |
|---|---|---|---|
| **B1** | **CRITICAL** | Precheck reported every never-fired FORMING pod as `3/5 — TREAT AS STRANDED`. Parts 1–3 are all *absence* of downstream artifacts, equally true before a pod runs; part 4 fails (0 days banked) and part 5 fails (no `resolvedAt`) → exactly 3/5, always. The same row then printed "A stranded pod played its week with NO agent layer" **and** the expire command. Reproduced by the reviewer (`false_positive_repro.mjs` → `partsHeld: 3 / 5`, `TREAT AS STRANDED`). | **CONFIRMED — FIXED.** Verdict is now status-gated: `stranded` is reachable only for `battle`/`complete`/`voided`. Never-fired → `not started`; drafting → `MID-DRAFT`; signature cells print `n/a (not played)`. Re-reproduced against the fix: all 7 status×parts cases now verdict correctly. |
| **B2** | **HIGH** | Apply script's pre-read is outside the write transaction, and **both** `forming→expired` and `drafting→expired` are legal (`tournamentGroupService.js:52-53`), so `transitionStatus` would expire a pod that began drafting in the dry-run→apply window. | **CONFIRMED — FIXED.** Switched to `expireGroup` with `expectedStatus` + `expectedUpdatedAt` + `expectedProgressVersion`. The third pin is load-bearing: a mid-draft pick writes only the `draft/state` sibling and never moves the group's `updatedAt`. **Deliberate deviation** from the prompt's `transitionStatus` — see §4. |
| **B3** | **HIGH** | The "mechanically read-only" claim was false. The proxy blocked mutating *methods* but returned write-capable *getters* raw: `ref.parent`, `ref.firestore`, `snap.ref` each reach `.set()` again. Reproduced (`proxy_escape_repro.mjs`) — three write paths succeeded with no throw. Not exploited by the script's own code, so real write risk was zero, but the documented guarantee was untrue. | **CONFIRMED — FIXED.** Escape getters blocked on property access; docstring now states precisely what is and is not guaranteed. Re-verified: all three reproduced routes blocked, legitimate chained reads still work. |
| **B4** | MEDIUM | Part 5 (`resolvedAt`) is stamped at the draft handoff; for a pod that passed through `AWAITING_OPEN` it carries the earlier sub-transition instant, so the cell can read "no" for a genuinely stranded pod. | **CONFIRMED — documented.** Marked corroborating, never decisive; the verdict does not hinge on part 5. |
| **B5** | LOW (latent) | `values.some(v => v !== 0)` treats `agentPoints: undefined` as non-zero, which would flip off the "silent zero" signal and hide a stranded pod. Unreachable via the real writer (`computeBankingUpdate` always stamps a number). | **CONFIRMED — FIXED.** Missing values now reported separately rather than counted as "the agent scored". |
| — | INFO | No crashes on missing `players`/`groupMembers`/`dailyScores`, absent orchestrator state doc, absent rank doc, CPU-only or dev pods. | Clean. |

### Lens C — test integrity

| # | Severity | Finding | Disposition |
|---|---|---|---|
| **C1** | HIGH | `rejects.not.toThrow(sentinel('unknown_slot'))` is **vacuous**. Proven: under the mis-throw mutation the test fails at the *preceding* anchored assertion, so this line never executes; and once the `^…$` message is pinned, "not the other message" is a tautology of the same deterministic call. No mutation can make it the first failure. | **CONFIRMED — FIXED.** Replaced with a row comparing **two different calls** (disabled vs unknown). Mutation-confirmed: collapsing the two refusals now fails the new row on its own. |
| **C2** | HIGH | `expect(res.body.error).not.toBe('unknown_slot')` — same anti-pattern, same mechanism (fails at the earlier status assertion, never reached). | **CONFIRMED — FIXED.** Same treatment; both responses now asserted across two calls. |
| **C3** | HIGH | The e2e `vi.mock` hand-reimplemented all three predicates, so with production `isSlotEnabled → true` **and** `isSlotIdDisabled → false` the e2e still passed **4/4**. Zero regression protection for those functions. | **CONFIRMED — FIXED** (independently, before C reported). Fixture now overrides only the slot *data* and inherits the real predicate. Mutation-confirmed: breaking the production predicate now fails **all four** e2e rows. |
| **C4** | LOW | `LiveDraftPicker.jsx` — the third enforcement point — has no disabled-state test. | **CONFIRMED — NOT FIXED, disclosed.** See §4. |
| — | CLEAN | Over-blocking is well covered: `findDueSlotGroups → if (true)` fails 4 tests; `isSlotEnabled → false` fails 26. A mitigation that accidentally disabled all four slots would be caught loudly. | Clean. |
| — | CLEAN | 7 rows confirmed genuine guards (each fails under the defect it names). Object-rest on the frozen slot objects verified correct. | Clean. |

### Lens A — semantics, rules, blast radius

| # | Severity | Finding | Disposition |
|---|---|---|---|
| **F1** | CONFIRMED GAP (dormant) | The gate covers `FORMING→DRAFTING` only. `findDraftingSlotGroups`, `driveSlotDraftAutopick` and `applyCompetitivePick` have no disabled check, so a pod already DRAFTING reaches `battle` and hits N1. | **CONFIRMED — NOT FIXED, disclosed.** See §4. |
| **F2** | Footgun | `slot.enabled !== false` meant `enabled: null` / `0` / `'false'` all read as **enabled** — a typo'd disable would ship the slot live while the author believed it was off. | **CONFIRMED — FIXED.** Inverted to fail-safe (only absent or literal `true` is enabled); `isSlotIdDisabled` derived from the same predicate. Mutation-confirmed. |
| **F3** | Minor | The e2e `vi.mock` on `liveDraftSlots.js` brushes §4's "never mocked" wording, though `importOriginal()` still loads the real module and the sibling `liveDraftLifecycle.test.js` provides a clean unmocked guard. | **CONFIRMED — hardened** (same fix as C3). |
| **F4** | Informational | `docs/LIVE_DRAFT_PREVIEW_SMOKE.md:145` still instructed a manual tester to exercise the `mon-0845` margin, now impossible (409). | **CONFIRMED — FIXED.** Struck through with reason and a pointer to where the margin is still proven in code. |

### Rules compliance — clean verdicts on record

| Rule | Verdict | Evidence |
|---|---|---|
| **§1 calibration fence** | **CLEAN** | Zero of the 11 fenced files/concepts in the diff; grepped every changed file for every fenced filename and for `createAgentBattle` / scoring-engine concepts — zero hits. No fenced function newly called. |
| **§2.3 import ratchet** | CLEAN | No new direct importer of any legacy archetype table. |
| **§4 import rule** | **PERMITTED** | `liveDraftLifecycle.js` → `src/config/liveDraftSlots.js`; that module has **zero** imports, trivially Node-clean. Real unmocked dependency-surface guard exists in `liveDraftLifecycle.test.js` (no `vi.mock` anywhere in the file). |
| **§6 cron** | CLEAN | `vercel.json` byte-untouched; budget stays **39/40**. Precision: the registered `live-draft-fire` handler's *behaviour* does change transitively via `findDueSlotGroups` — that is the mitigation's mechanism, not a budget change. |
| **§9 display-agreement** | **CLEAN by construction** | The refusal (`claimSlotSeat`) and the picker's label source (`getSlotOccupancy`) call the **identical** `isSlotEnabled()` over the identical frozen slot entry. One field, one accessor, no parallel copy to drift. |
| **§10 colour / §11 motion** | CLEAN | `LiveDraftPicker.jsx` is in neither guarded-file list nor baseline. No hex literal, no `transition={{` added. `tokens.guard` + `motion.guard` + `flagPinGuard` ran **170/170 pass**. |
| **Blast radius** | CLEAN | Exhaustive search found no other consumer of `LIVE_DRAFT_SLOTS` and no hardcoded four-enabled-slots assumption. `DraftBoardRoom.jsx:285` references the config in a *comment* only, not an import. |

---

## 4. Accepted limits — what was deliberately NOT fixed

**F1 — the DRAFTING→BATTLE path is not gated.** Closing it would mean abandoning a live draft with humans mid-pick, which is the worse failure; a half-finished draft has no good disposition. The window is bounded and currently empty:

- No **new** pod can reach DRAFTING — the claim door and the fire gate are both closed.
- Only a pod already DRAFTING at deploy time is exposed, and a draft completes in ~5 minutes (the S3 margin), so this requires a deploy landing inside one.
- Last `mon-0845` fire was 2026-09-07; next is 2026-09-14 08:45 ET. No such pod exists now.

Mitigated by observability rather than blocking: the limit is recorded at `liveDraftLifecycle.js:133-145` so nothing there looks more closed than it is, and the precheck prints an explicit **"MID-DRAFT RIGHT NOW — NEEDS A DECISION"** block. Properly closing it belongs to the N1 pipeline fix, which makes reaching `battle` *safe* instead of blocking it.

**B2's deviation from the prompt.** The task specified `transitionStatus`. That primitive takes no preconditions, so honouring it literally would have left a window in which a live draft could be expired. The only alternatives were `expireGroup` (purpose-built, already tested, pins all three preconditions, and the pattern the sibling `lifecycle-void-apply.js` already uses) or hand-rolling a transaction that duplicates it — which §4's "never create a local copy" posture rules out. **Founder may overrule; the change is one import and one call.**

**C4 — the picker has no disabled-state test.** The repo has no React Testing Library and its convention is SSR-only smoke rendering, which cannot run the picker's data-loading effect — so the disabled-row logic is unreachable without either adding a test dependency or extracting the row logic to a pure function. Both are scope growth on a mitigation PR (§8). Risk is low: the server 409 is the real gate and **is** tested end to end; the picker is defence-in-depth. Recommended for the fix-B task.

---

## 5. Residual risk

| Risk | Severity | Notes |
|---|---|---|
| A pod already DRAFTING at deploy reaches `battle` and hits N1 | Low | F1. Bounded to a ~5-minute window; none open now. |
| Picker shows a stale claim button to a client with a cached payload | Very low | Server returns 409 regardless; `enabled === false` check treats an absent field as enabled by design. |
| `scripts/` files report `process is not defined` under `npm run lint` | None (pre-existing) | `eslint.config.js:18` declares only `globals.browser`; every existing script errors identically. Not introduced here; flagged for separate tasking per §3. |
| Neither script has been executed | n/a | No Firestore access in the build session. First real run is the founder's, locally, precheck first. |

---

## 6. Provenance

The N1 discovery report this mitigation implements is **not committed to the repository**. It exists only as the discovery session's out-of-tree artifact at `/home/user/2026-09-12_N1_MON0845_AGENT_LAYER_DISCOVERY.md` (BUILD_RULES §3 writes reports outside the tree so a byte-exact artifact exists *for* `docs/audits/`). It should be committed here alongside this review; that was left to the founder rather than widening this PR.
