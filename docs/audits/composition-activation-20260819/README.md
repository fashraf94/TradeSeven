# Composition activation — run record and closeout (PR 5)

**Event:** the `ARCHETYPE_IDENTITY_VERSION` composition activation, identity **v2 → v3**.
**Run:** 2026-08-19 → 2026-08-20, founder-operated, step by step, from `docs/composition/ACTIVATION_RUNBOOK.md`.
**Outcome: COMPLETE.** The activation record is at **generation 2**, identity **v3** is active, and the fleet is **open** on epoch `E1-20260820` at incarnation 2.

The runbook itself is the log of record — every step's row was written live, into the working tree, and **deliberately left uncommitted until this PR** (see the 1.2 block for why: recording a row is a commit, and step 1.2 forbids any commit or deploy from the ACTIVATION SHA pin onward). This directory carries the machine artifacts those rows cite.

---

## The constants of record

| | |
|---|---|
| **THE ACTIVATION SHA** | `ca62b2b0f4236d2bc3bd93fcce7eab5d56d0f4b4` (PR #779) — pinned at 1.2, held unbroken through 8B |
| **Genesis** | generation 1 · identity v2 · epoch `E0-20260819` · `candidateStateId: 'genesis'` |
| **The flip** | generation 2 · identity **v3** · epoch `E1-20260820` · candidate `composition-migration-2026-08-19T23-59-09-930Z` |
| **Ratified `semanticHash`** | `1b76ddbe5a3687d583125d4e68c02e03322a7a6c67469e971366fed60ea52f26` |
| **THE WATERMARK** | `2026-08-19T23:42:49.557Z` (epoch millis `1787182969557`) |
| **v2 catalog lock** | `4b44df0be60866bc042fb4adce99281878256f13d74ae0ec02924ee4778d731e` |
| **v3 catalog lock** | `5cd3cca189cd0292e7d86787f1583868e0867b16ec93e8b3dcbbf2361d55be66` |
| **A7-LOCK** | `ACTIVATION_EVIDENCE.json` sha256 `ad2875a7c87131f0458ca7e42a2be80ec72ab2d2322b4a988d07aabcbb1a5902` — **unmoved for the whole run** |

## The migration, as ratified and applied

62 agents scanned · **6 affected** · **20 overlay entries** · clamp 13 / replace 3 / unequip 4 · needsBinding **0** · residuals **empty** · `activeIdentityVersion: 3`.

Population: 5 training clones + **1 real user agent** (`F3WIPUHnLzLA22l7atLV`, "Donny"), ratified knowingly by the founder on the corrected framing — his two entries are clamps, not unequips, and excluding him would have left the fleet unable to pass zero-residual. All 4 unequips and all 3 replaces fall on training clones.

## Artifacts in `reports/`

| File | What it evidences |
|---|---|
| `preflight-7c70ae6be637.json` | step 0 re-run at `7c70ae6b` — 5/5 green |
| `preflight-ca62b2b0f423.json` | **step 1.2 at THE ACTIVATION SHA** — 5/5 green, `treeClean: true`; the pin's evidence |
| `composition-migration-…23-50-27-479Z.json` | FINAL-DRYRUN run 1 |
| `composition-migration-…23-50-48-544Z.json` | FINAL-DRYRUN run 2 — M12 agreement (same `semanticHash`, different `runHash`) |
| `composition-migration-…23-59-09-930Z.json` | the `--apply` report; **this runId is the live `candidateStateId`** |
| `lease-ops-list-…21-33-27-729Z.json` | 0 active / 0 stuck |
| `lease-ops-drain-…23-42-26-751Z.json` | 1.9 dry drain — `WOULD_DRAIN_IMMEDIATELY` |
| `lease-ops-drain-…23-42-33-030Z.json` | 1.9 live drain — `{drained: true}` |
| `RULES_DEPLOY_RECORD.filled.json` | the B9 record; 1.4 verified the three-way sha equality |

## Honest limits on what this run proves

Recorded because several results are **true but empty**, and an empty result is not a clearance:

- **The 1.9 lease drain** returned `{drained: true}` over a registry holding **0 documents**. The behavioural evidence that the drain drains lives in `compositionLeaseOps.test.js`'s closed-epoch block, not here.
- **The step-6 stale-artifact sweep** found the comparator's only location (`agents/{id}/compiledBuilds/{mode}`) **empty**, so "every stale artifact rejects" is vacuously true. The comparator was driven directly instead, across all six presence-aware arms.
- **Step 5's candidate pipeline** has no tooling; it was substituted with an in-memory resolution (zero writes) that proves the compile path resolves candidate cells and **explicitly does not** produce stored manifests or shadow captures.
- **Most 8B probes did not execute.** See the debt list.
- **`no gate-green is claimed by this event`** — the §II honest-expectations rider stands; `metadata_missing` / `compat_cell_missing` validation entries on candidate builds are expected.

## Outstanding debt

The full list, with owners, is in **`DEBT.md`** beside this file. The one **blocking** item:

> **`COMPOSITION_MIGRATION_FEED_ENABLED` MUST NOT FLIP** until the ACTION_COPY headline + param-label substitution ships.
