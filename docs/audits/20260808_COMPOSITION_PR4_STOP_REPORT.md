# Composition PR 4 — STOP Report (the identity event, deployed INACTIVE)

**Date:** Aug 8, 2026 · **Branch:** `claude/composition-pr4-identity-event` @ **`55943b6d`** (11 commits; base `origin/main` @ `3c396b14`) · **Pushed at STOP — NO PR opened.** · **Supersedes** the earlier revisions of this report (the Aug‑7 chat‑only version and the `dd907699` revision): this one reflects the tree AFTER Sol's second re‑review fold.

**Review record:** `docs/audits/20260807_COMPOSITION_PR4_CODE_REVIEW.md` (the §2 two‑pass adversarial review + the Sol‑12 fold table + the Sol‑re‑review‑9 fold table). **Runbook:** `docs/composition/ACTIVATION_RUNBOOK.md`. **Ledger:** `docs/composition/ACTIVATION_PRECONDITIONS.md`.

## Status — nothing pending a ruling

| Review round | Outcome | State at `55943b6d` |
|---|---|---|
| Founder rulings (Aug 7) | Substitutions RATIFIED · §7 sign‑off GRANTED · F2 ruled GENESIS · L1‑1 ruled no‑gate | All folded (batches 3–9) |
| §2 two‑pass adversarial review | 18 findings | All fixed/disclosed; 13 mutations killed |
| Sol pre‑activation review (Aug 8) | 12 findings, all valid | All folded (batch 10); Sol confirms **10 of 12 fully closed**, residual = rollback execution + temporary write windows |
| Sol second re‑review (Aug 8) | **9 findings accepted (5 code + 4 runbook)** | **All folded (batch 11)** — this report's delta |

## Executive verdict

| Area | Status |
|---|---|
| A. Identity artifacts (inactive) | ✅ v3 minted alongside v1+v2; catalog CI lock; version‑parameterized resolver; activation record service (7‑field descriptor); candidate defaults object (A24); genesis descriptor (F2) |
| B. Fenced work (ONE §7 sign‑off) | ✅ decide.js splice (both directions) + FC‑1 flow‑pin threading + the probe‑actor threading; FC‑1‑CLOSE; manifest shape — logic in `compositionGenerationFence.js` |
| C. Ledger PR‑4 rows | ✅ B1, B2, B4, M6, B9, M10, B1‑EXT, B3‑EXT, B8‑FINAL, A7‑LOCK, M7‑E2E, BARE‑CELL‑INVARIANT — with acceptance suites |
| D. Flip obligations | ✅ ON‑state goldens promoted; endpoint tx fakes reconciled; F7 candidate round‑trip + record‑state + malformed‑reject rows |
| E. Runbook | ✅ steps −1 → 9 + THE ROLLBACK PROTOCOL (Rollback‑A/B) + the 8A/8B split on the mechanical probe gate; strict run log |
| Dark guarantee | ✅ flags dark, no record, no epoch doc: byte‑identical (zero added keys, zero added reads on server paths — falsifiable via the read‑logging fixture); full suite **7,383 passed / 53 skipped**; rules emulator **130/130**; `vite build` clean |

## The batch‑11 delta — Sol's second re‑review, all 9 folded

**#1 CLIENT‑SDK EPOCH BINDING — verified, then built.** The verification answer: NO — the rules' `epochWriteOpen()` checked only `state == 'open'`; no client write carried an epoch token. Built: `captureWriteEpochToken()` captures `composition/writeEpoch.epochId` **when the mutation is formed** (time‑boxed; a failed capture yields a tokenless write, which post‑genesis is DENIED — fail closed, retryable); all **eleven** client‑SDK identity‑write sites stamp `writeEpochId` (`forgeService` ×8, `agentService.createAgent`, the `useTraits` param save, the `useForge` rename); the renamed **`epochWriteAdmitted()`** requires token EQUALITY whenever the epoch doc exists (absent = pre‑genesis fail‑open, byte‑identical today). **Emulator‑proven: an E0‑formed mutation submitted after E1 opens is DENIED at commit** — B1's "every identity write" closed on the one path no server pin can see.

**#4 PROBE‑ONLY GATE — mechanically enforced.** A new epoch state **`'probe'`** carrying `probeIdentities`: the server chokepoints (`validateWriteEpochInTx`, the provisioner‑lease acquisition) admit only a threaded, LISTED actor — `actor` is threaded through all 11 settings endpoints, decide's projection commit, both deploy gates, and casualClone; any unthreaded or unlisted writer rejects `probe_only` **fail‑closed by construction** ('probe' is present‑but‑not‑open to code that predates the arm). The rules layer requires `request.auth.uid ∈ probeIdentities` plus the current token. Negative controls on both halves (server: probe + non‑probe identity ⇒ 409, zero writes; emulator: unlisted uid denied, stale token denied). **Rollback‑B reuses this gate verbatim.**

**#5 MALFORMED FAILS CLOSED at the compile boundary.** The four‑state contract, aligned with the production loader: no record → LIVE; valid genesis/v2 → LIVE; valid v3 → CANDIDATE; **present‑but‑malformed or unrecognized version → REJECT** (the catch‑to‑LIVE swallow is gone; a well‑formed record naming v5 throws too — never a silent cell‑source guess). Endpoint mutation rows: a malformed record and a v5 record each ⇒ non‑200 with zero agent/build writes.

**#6 BIRTH PROVENANCE — stamped, not narrowed.** Every fresh born‑with seed stamps `identityVersionAtBirth` + `activationGenerationAtBirth`: server paths from their pinned descriptor (`birthProvenanceStamp`; dark ⇒ zero new keys, A23), the client birth from the record read (absent ⇒ zero keys), and clone paths INHERIT the source's stamps (`INHERITED_LOADOUT_FIELDS`; a reseeded training clone restamps at its own pin). The rollback protocol's reconciliation now **queries** these fields (`activationGenerationAtBirth >= <rolled‑from generation>`) — never trait‑id inference. The honest‑divergence regression row stays.

**#8 THE NAMESPACE‑BELT MUTATION ROW.** The apply writer is extracted to `compositionCandidateApply.js` (entries‑first / sentinel‑last preserved); its mutation row redirects the write set toward `agents/*` and proves the run aborts **before any Firestore write lands** — zero writes. Cited next to #5 in runbook step 3.

**Runbook (#2/#3/#7/#9).** The rollback protocol now pauses + positively acknowledges ALL external admin **before** `state:'closing'` — in the numbered order, not by reference. Verification splits **Rollback‑A** (target epoch closed; read‑only loader/descriptor checks + the seed‑plan RESOLUTION) and **Rollback‑B** (the #4 probe gate on the restored epoch; provenance‑queried reconciliation; real birth/compile probes), mirroring 8A/8B on the same mechanism. Step 1's post‑close VERIFY uses the **non‑writing** seed‑plan resolution instead of a probe birth. The run log is strict‑ordered (−1 → 0 → … → 8A → 8B → 9) with R1–R8 rollback rows appended at invocation.

## Prior rounds (already folded; summarized)

- **Genesis (F2 ruling):** generation 1 = the genesis descriptor (live identity, reserved id + null‑sentinel pair, open‑epoch‑paired, first‑write‑only); the loader short‑circuits to base‑only; first real activation = generation 2; rollback‑to‑genesis proven (activation battery + loader contract + birth parity).
- **The seven ratified substitutions** landed in the candidate defaults object with complete‑set birth equality both sides.
- **§2 review (two passes):** 18 findings fixed/disclosed; 13 mutations killed, originals md5‑restored; falsifiability repairs (read‑logging fixture, census call‑shape legs, per‑leg probe floors).
- **Sol's 12:** the rollback protocol + interleaving row; stuck‑lease refusal + attributed resolution; the destructured‑write detector (zero occurrences pinned); record‑scoped `candidateMode` (the F5 split‑brain closed); the `--during-close` window; runbook ordering (pause‑before‑closing, 8A/8B, post‑watermark battle hard gate, SHA pinning + old‑invocation drain, pre‑genesis snapshot smoke); claim narrowing (#1/#12) with the honest‑divergence row.

## Open (by design, not blocking)

1. **F7 (snapshot bundling)** verifies at runbook step 1's deployed‑lambda smoke against a real deployment.
2. **X6** — endpoint candidate compiles carry `metadata_missing` until the separately‑sequenced base‑metadata arc.
3. **Arbitrary‑generation rollback (#12)** stays FILED behind immutable per‑revision override snapshots / a frozen final epoch revision; this event claims rollback‑to‑genesis (2 → 1) only.

## Verification (HEAD `55943b6d`)

Full vitest **7,383 passed / 53 skipped** (439 files) · rules emulator **130/130** (incl. the straddle + probe rows) · `vite build` clean · registry catalog lock green · every ratchet that fired during the fold did so as designed and was reconciled by hand (B3 deny‑by‑default on the apply module, the stale‑key pruner on migration‑scan's moved writes, the writer‑census rules‑text pin on the gate rename, the derived‑write census call‑shape leg on the actor‑threaded commit, the A36 importer sweep on the apply writer's id‑function import) · cumulative diff ~75 files / ~20k insertions.
