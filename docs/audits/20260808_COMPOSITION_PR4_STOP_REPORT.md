# Composition PR 4 — STOP Report (the identity event, deployed INACTIVE)

**Date:** Aug 8, 2026 · **Branch:** `claude/composition-pr4-identity-event` @ **`dd907699`** (10 commits; base `origin/main` @ `3c396b14`) · **Pushed at STOP — NO PR opened.** · **Supersedes** the Aug‑7 chat‑only STOP report (that version predated the F2 genesis fold and Sol's pre‑activation review; this one is the record of the tree as it actually stands and is committed to `docs/audits/`).

**Review record:** `docs/audits/20260807_COMPOSITION_PR4_CODE_REVIEW.md` (the §2 two‑pass adversarial review + the Sol‑12 fold table). **Runbook:** `docs/composition/ACTIVATION_RUNBOOK.md`. **Ledger:** `docs/composition/ACTIVATION_PRECONDITIONS.md`.

## Status — nothing is pending a ruling

Every open item from the Aug‑7 report has since been ruled or granted by the founder and folded into the tree; Sol's Aug‑8 pre‑activation review returned 12 findings, all folded. This report records the delivered state, not a request.

| Was pending (Aug 7) | Ruling / grant | State at `dd907699` |
|---|---|---|
| 7 substitutions (incl. the 2 beyond item 6) | **RATIFIED** as tabled; reshaped card copy approved | Landed in the candidate defaults object; complete‑set birth equality proven both sides |
| The one §7 fenced sign‑off | **GRANTED** over all three contacts incl. the pass‑2 flow‑pin widening | decide.js splice + FC‑1 + manifest stamp; logic in the dark module |
| F2 — first‑activation rollback (unwritten) | **RULED: GENESIS DESCRIPTOR**, not fix‑forward | `writeGenesisDescriptor` + loader base‑only + rollback‑to‑genesis rows |
| L1‑1 — the client birth read | **RULED: no client gate** (A48 stands); window closes operationally | Time‑boxed read + runbook step −1 (rules deploy minutes after merge) |
| Sol pre‑activation review (Aug 8) | 12 findings, all valid | All 12 folded (batch 10) |

## Executive verdict

| Area | Status |
|---|---|
| A. Identity artifacts (inactive) | ✅ v3 minted alongside v1+v2; catalog CI lock; version‑parameterized resolver (A48 posture); activation record service (7‑field descriptor); candidate defaults object (A24); **genesis descriptor** (F2) |
| B. Fenced work (ONE §7 sign‑off) | ✅ decide.js splice (both directions) + the FC‑1 flow‑pin threading; FC‑1‑CLOSE; manifest shape — minimal fenced diffs, logic in `compositionGenerationFence.js` |
| C. Ledger PR‑4 rows | ✅ B1, B2, B4, M6, B9, M10, B1‑EXT, B3‑EXT, B8‑FINAL, A7‑LOCK, M7‑E2E, BARE‑CELL‑INVARIANT — with acceptance suites; FINAL‑DRYRUN is runbook‑time by design |
| D. Flip obligations | ✅ ON‑state goldens promoted (record‑gated framing); endpoint tx fakes reconciled; F7 candidate round‑trip + record‑state rows |
| E. Runbook | ✅ steps −1 → 9 + the ROLLBACK PROTOCOL + §10 8A/8B split; per‑step VERIFY + ROLLBACK; M10 checklist; run log |
| Dark guarantee | ✅ flags dark, no record; full suite **7,374 passed / 53 skipped**; rules emulator 128/128; `vite build` clean; p4 goldens + honesty sweep byte‑green; "zero reads" now FALSIFIABLE (read‑logging fixture) |

## The F2 GENESIS fold (founder ruling of record)

Before the first activation the runbook writes **generation 1 = the genesis descriptor** `{activeIdentityVersion: 2 (live), boundaryStateVersion: 1, candidateStateId: 'genesis', semanticHash: <reserved null‑sentinel>, activeEpochId: E0, overrideRevision: 0}`, paired in its own transaction with the OPEN epoch doc.

- **`writeGenesisDescriptor`** — first‑write‑only (an existing record aborts), open‑epoch‑paired in‑tx, so the write that arms B1's absent‑doc‑fails‑closed is born with the doc it fails closed without. The genesis ids are RESERVED at `writeActivationRecord` (no candidate run can masquerade).
- **Loader** — genesis short‑circuits to BASE ONLY (zero layer reads; `genesis: true`; `resolveWith` identical to pre‑activation). The null‑sentinel is a reserved *string* (a null hash would be indistinguishable from a malformed record under the per‑field fail‑closed contract); half‑genesis descriptors are malformed and fail closed.
- **Rollback is now representable at every generation.** First real activation = generation 2; `rollbackActivationRecord({toGeneration: 1})` restores the genesis world under a fresh generation — no special case, no tuple reuse. Proven rows: rollback‑to‑genesis (activation battery), base‑only (loader contract at gen 1 and a later generation), birth parity (server + client), genesis‑present pipeline (endpoints).

## The one §7 fenced sign‑off (granted)

`api/agent/decide.js` (projection splice + the review‑F1 catch fix + the pass‑2 pin threading into both battle call sites), `api/_utils/agentBattleService.js` (FC‑1 pin/stamp/commit, 4 points), `api/_utils/agentEvalPromptAssembly.js` (1 call‑site edit), concept‑fence via `resolvedAgentManifest.js`. All logic lives in the dark module `compositionGenerationFence.js`; p4 goldens byte‑green; the diffs are in the audit's fence sweep.

## The seven substitutions (ratified — landed)

RED‑control scope finding: the live DEFAULT_TRAITS seed SEVEN non‑offerable rules — item 6's five plus `momentum_chaser/t‑09` and `contrarian/tv‑07`. All seven ratified under the 3.5 "premise disproven" precedent.

| # | Host (archetype/trait) | OUT | IN | Ladder (subtle/moderate/dominant) |
|---|---|---|---|---|
| 1 | guardian / Steady Anchor | `risk-single-stock-limit` (deprecated) | **`alloc-sector-cap`** | pct **45 / 35 / 25** |
| 2 | diversifier / Smart Money Tracker → **"Crowding Sentinel"** | `tv-04`, `mb-05` | **`i-05` + `r-07`** | i‑05 **3/2/1**; r‑07 **2/1/1** |
| 3 | diversifier / Score Adaptor → **"Balanced Optionality"** | `gs-05`, `gs-06` | **`alloc-even-spread` + `a-09`** | conviction **light/moderate/strong**; a‑09 **1/2/3** + high_upside **0/1/2** |
| 4 | momentum_chaser / Trend Rider **(beyond item 6)** | `t-09` | **`tv-08`** | score **55/60/65**; vol **1/0.8/0.6**; minutes **60/90/120** |
| 5 | contrarian / Bargain Hunter **(beyond item 6)** | `tv-07` | **`fund-value-pe`** | level **sector median / '20' / '15'** |

Reshaped card copy approved as written. Sibling rungs carried verbatim (incl. the 3.5‑repaired tv‑01). Invariant (b) green over the candidate composition wherever cells exist; the birth suite asserts the COMPLETE seeded set per host, so a silent partial seed is impossible.

## The §2 adversarial review (two passes) — what it found and what happened

**Pass 1 (refutation agent):** 9 findings, 7 fixed in‑branch (the decide.js catch swallowing the splice's rejections; activeIdentityVersion↔candidate binding; history‑wide epoch‑reuse rejection; casual‑clone re‑sync lease checks; lease‑id collision; lease‑registry purge; Vercel snapshot bundling config), 2 disclosed as founder decision points (F2 → since ruled genesis; F5 → the fence flag is load‑bearing once activated). F6 was half‑present and completed in response.

**Pass 2 (fresh‑lens agent, dark‑guarantee + test‑integrity):** 9 more, all fixed — the one real dark gap (L1‑1, since ruled + time‑boxed), falsifiability repairs (read‑logging fixture makes "zero reads" and M6's in‑tx property genuinely fail under their defects), the census call‑shape legs (an import alone no longer passes), the FC‑1 build‑gate window (flow pin threaded), complete‑set birth assertions + admin‑SDK‑strict fake, the lease absent‑doc parity hole, and the a7lock per‑leg probe floors. All surviving mutations re‑run and killed, originals md5‑restored.

## Sol's pre‑activation review (Aug 8) — 12 findings, all folded

Sol's verdict: NOT CLEARED, all 12 valid, all concentrated in the runbook/activation state machine; core mechanisms explicitly accepted.

**Machinery.**
- **#2 ROLLBACK PROTOCOL** — a symmetric explicit sequence (close → pause+ack admin → drain to watermark → fresh‑generation repoint → verify load → epoch doc to the target epoch still closed → reopen only after verification). Interleaving row proven; the battle rule answered on the locked‑manifest independence branch (battles are not drained).
- **#3 lease TTL straddle** — the drain REFUSES expired‑but‑unreleased leases (`StuckProvisionerLeaseError`, holders named); explicit attributed `resolveStuckProvisionerLease` (dead‑holder‑only); purge narrowed to released‑only.
- **#10 destructured writes** — `detectWriteMethodExtractions` flags `const {set}=ref` / method‑value / bind extraction as unresolved `extract:*` sites (deny‑by‑default); typeof feature‑detects excluded as unwritable; repo pinned at zero occurrences + 8 detector unit rows.
- **#11 genesis‑present contract** — the one real inference (compile `candidateMode` defaulted to the flag) fixed record‑scoped (`resolveCandidateModeInTx`: flag = dark switch only; candidate cells ONLY under a v3 record), threaded through all ten settings endpoints + the deploy gate; pipeline scoped explicitly to `{candidateStateId, activeIdentityVersion: 3}`.
- **#5 closed‑epoch `--apply`** — verified ABSENT, then built: `--during-close` with the dedicated inverse guard `assertClosedEpochCandidateWindow` (closed‑only; open/closing/absent refuse) + runtime candidate‑namespace path assertion. PR 2's general guard untouched.

**Runbook ordering (#4/#6/#7/#8/#9)** — pause + positive per‑row ack BEFORE `state:'closing'`; step 1 split (deploy → full preflight at the final deployed SHA recorded as THE activation SHA → old‑invocation drain); deployed‑lambda snapshot smoke (v2 bundled + v3 catalog hashes) BEFORE genesis; post‑watermark A26/A35 battle‑drain HARD gate; step 8 split into 8A closed/read‑only and 8B controlled verification‑open (named operator probe identities only; 8B failure ⇒ the rollback protocol).

**Claim narrowing (#1/#12)** — rollback restated: TOTAL while the fleet is frozen (through 8A); during 8B the only v3 base state is the enumerated probe identities, reversed by the named hand reconciliation; after general unfreeze, selector‑total plus that reconciliation. Sol's honest‑divergence regression row records that a v3‑born agent's base docs persist across rollback and diverge from a v2‑born agent's (asserted divergence, not equality). "Total at every generation" removed; arbitrary‑generation rollback FILED post‑event behind immutable per‑revision override snapshots / a frozen final epoch revision.

## Everything else, delivered

- **Descriptor:** the 7‑field union; malformed fails closed per‑field; overrideRevision in the seqlock token; strict generation monotonicity; append‑only history; M6 + R6‑B1 provably inside the activation transaction; A34's `SUPPORTED_BOUNDARY_STATE_VERSIONS` per Q1.
- **A24 wired inactive:** server birth paths (change‑archetype, trainingClone) + the CLIENT birth path (a time‑boxed record read where every failure resolves LIVE) select the version the record names; the ratchet SHRANK (81 importers); births byte‑identical today, proven both sides with complete‑set equality.
- **The runbook** with the §10 checks (negative checks each OBSERVED at 8B, the validator‑path out‑of‑domain rejection, ACTION_COPY checkpoint, M7 live measurement, unfreeze order + released‑only lease purge).
- **X6 honesty:** endpoint candidate compiles record `metadata_missing` until the base‑metadata arc; no gate‑green claimed anywhere.

## Open (by design, not blocking Sol's review)

1. **F7 (Vercel snapshot bundling)** verifies only at runbook step 1's deployed‑lambda snapshot smoke against a real deployment.
2. **X6** — the base‑metadata apply arc is separately sequenced; endpoint candidate compiles carry `metadata_missing` until then.
3. **Arbitrary‑generation rollback (#12)** is FILED post‑event behind its prerequisite; this event claims rollback‑to‑genesis (2 → 1) only.

## Verification (HEAD `dd907699`)

Full vitest **7,374 passed / 53 skipped** (438 files) · rules emulator **128/128** · `vite build` clean · registry catalog lock green (v1+v2 self‑consistent as stored, v3 recomputed from the candidate composition) · both review passes' mutations killed + Sol's fold verified · B3 deny‑by‑default allowlist regenerated at every step (the ratchet caught each new write site, including the fold's `resolveStuckProvisionerLease`, and the #10 detector caught the repo's one extraction‑shaped pattern) · cumulative diff 72 files / ~19.6k insertions.
