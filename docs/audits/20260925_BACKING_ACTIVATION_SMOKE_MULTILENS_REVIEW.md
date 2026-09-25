# Backing activation — founder smoke path: multi-lens adversarial review record

**Branch:** `backing/activation-smoke` · **Reviewed snapshot:** the build commit `be288e92` (working-tree snapshot `ba712d37`, identical content) · **Fix commits:** _(filled in §3/§6)_ · **Base:** `main` (`5b09de57`).
**Rule:** BUILD_RULES §2 — review is mandatory at ≥10 files or ≥1,500 lines (this branch at `be288e92`: 50 files, +3,751 / −589). Multi-lens, adversarial, independently refuted, `vite build` run, mutation-checked, written down. The prompt briefed one lens: **"light backing for someone who isn't the founder, or on the live site."**
**Reviewer isolation (founder ruling, Sep 2, 2026):** every lens and every refuter worked on its own `git archive` extraction of the reviewed snapshot under the session scratchpad (`review/lens-{light,dev,wiring,script}`, `review/refute-{light,dev,wiring,script}`), `node_modules` symlinked, read-only on git and on the shared working tree; a read-only `git archive main` extraction (`review/base-main`) served comparisons. The coordinator's mutation pass — the mutating lens — ran LAST, after every lens and refuter had reported, on its own extraction (`review/mut`, `run_mutants.mjs`: one substitution per mutant, the named suites run, the file restored byte-identical by sha256). No reviewer wrote to `/home/user/TradeSeven`.

## 0. Verdict

_(filled in after the refuters and the mutation pass)_

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

_(filled in from the reports)_

## 4. The prompt's four named mutation checks

_(filled in from the mutation pass)_

## 5. CONFIRMED / REFUTED

_(filled in)_

## 6. Per-fix guard checks — the coordinator's mutation pass

_(filled in)_

## 7. Verification

| Check | Result |
| --- | --- |
| `npm run test:run` at `be288e92` | `Test Files  800 passed \| 3 skipped (803)` · `Tests  15891 passed \| 64 skipped (15955)` · exit 0 (212 s). The 3 skipped files are pre-existing on `main`. |
| `npm run test:rules` | **Not run — no Firebase CLI in this environment** (`which firebase` empty). `firestore.rules` is UNCHANGED by this PR (`git diff main -- firestore.rules` is empty): the smoke reads `backingPools/dev-…` (authed-read) and the viewer's own stakes, both already admitted. |
| `vite build` | exit 0 (23.5 s); the chunk-size warnings are pre-existing on `main`. |
| `npm run lint:gate` | exit 0. |
| Fenced files (BUILD_RULES §1) | none touched; no fenced function called. |
| The code flags | `export const ELIGIBILITY_ATTESTATION_ENABLED = false;` (featureFlags.js:2488) · `export const BACKING_BETA_ENABLED = false;` (:2551) — unchanged; the pin suites and the flag-pin guard green. |
| The write scanner | `api/_utils/compositionProtectedStores.scan.test.js` green: the four stake writes' key moved with the transaction (`api/_utils/backingStake.js::placeStake::set::unresolved: 4`), and the script's six sites are allowlisted with a review note (`_notes_backing_activation_smoke`). |

## 8. Reported for separate tasking (BUILD_RULES §3 — found, not fixed here)

_(filled in)_

## 9. For the founder

_(filled in)_
