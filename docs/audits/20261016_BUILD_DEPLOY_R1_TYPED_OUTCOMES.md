# Build report — Command Center repair R1: typed deploy outcomes, hand-off ownership, the existing-battle terminal

Prepared 2026-10-16 by Flash (Claude Code). Prompt: "FantasyTrades Command Center — repair R1" (authorizes R1 only: spec V1.2 §5.1, §11.2 row R1, corrections C2 and C3 on the service side). Ships live, no flag; governing rule: created-path parity.

## Verdict

| Question | Answer |
|---|---|
| Built as authorized? | **Yes.** Rulings R-R1-1…R-R1-6 applied (§3). Nothing under `api/` changed; no fenced file edited. |
| Created-path parity? | **Held.** Two independent differential runs (review lenses L1 and L4) replayed base `078fe895`'s `agentDeploy.js` against the head under the same mocks: every created-path effect (fetches, target reports, timing marks, console lines, hand-off arguments) is identical except the added `meta.ownerUid`; every legacy field is byte-identical on every non-created path. Those runs were at `4b4531d1`. The later fix round changed only the orphaned branch, the null-token branch and a non-function `isCurrent`, none of which a created deploy reaches, plus an owner filter on Enter, which passes a same-account Enter through unchanged. The ceremony's recovery admission is byte-identical. |
| The intended change? | The already-running answer (200 `battleCreated:false`) is now `existing_battle`: no create callback, no fabricated `agent_` id, no stash, no false reveal; a new **Already running · Open game** terminal opens the owned server document. |
| Checks | At the code head `e5e98d42`, Linux, CI-shaped (`--maxWorkers=2`): **Test Files 1028 passed | 7 skipped (1035)**, 22,300 tests passed, **0 failed**, exit 0. `lint:gate` exit 0. `vite build` exit 0; the hub chunk is unchanged at 67.58 kB. Mutation: every added or changed row has been the failing row of a non-equivalent mutant (§8.3). `vite build` and `lint:gate` were re-run at the pushed report head (PR description). |
| Review | BUILD_RULES §2 review run: 4 read-only lenses + 13 refuters (one per finding or NIT group, each on its own snapshot) + the mutating lens L5 last. L1–L4: 24 unique findings, 15 CONFIRMED and 9 PARTLY (sub-claims refuted), 0 refuted outright; 8 fixed, 16 recorded (two as founder questions). L5: 15 test gaps. Its refuter re-ran the 11 it could test: 10 CONFIRMED, L5-9 PARTLY. Every gap was closed with a row or recorded. No BLOCKER. The one MAJOR that survived refutation (L4-1) was graded below MAJOR by its own refuter, because nothing live reads `outcome` yet; it is Q1. |
| Founder questions | **Answered 2026-10-16: apply all four fixes as proposed in §11.** Applied in the amendment, §14 (new code head `1d5dd538`). Q1: the stock 503 that can follow a commit is now `uncertain`. Q2: the shells close the ceremony on `orphaned`. Q3: the limiter's `retryAfter` is forwarded. Q4: the Scouting Board closes on an existing battle. |
| Status | Pushed as a draft PR, **STOPPED**: no merge, no CI watching. The PR's Vercel preview is the founder's smoke surface: one real deploy must reveal and enter exactly as today. |

## 1. Branch, HEAD and preamble

- `git fetch origin` first (BUILD_RULES §3): `origin/main` = `078fe895` (PR #978, S2a, merged — the precondition holds). Re-fetched before the final checks: unchanged.
- Worktree branch `claude/deploy-r1-typed-outcomes-ca0c16` (the app's suffix), cut at `078fe895`, clean at start. Pushed as `claude/deploy-r1-typed-outcomes` by refspec.
- Commits: `df8b6c8a` R1 code and tests · `7c665c3e` the identity reader's rows · `4b4531d1` mutation round 1 (survivor rows, the leak-free ceremony harness, the hub translator over every result) · `969c7da1` review fix round · `1e65feb1` the rows L5 found missing · `e5e98d42` App's guard pinned as a top-level statement · `bc53176f` the first report · `1d5dd538` the amendment after the founder's rulings (§14) · the amended report.
- Code head `e5e98d42`; report head = the PR head.
- **Amended after the founder's rulings:** code head `1d5dd538`, the amendment commit. The amended report follows it. See §14.

## 2. Starting check (BUILD_RULES §3)

Every anchor below was re-read at main `078fe895` in this session (VERIFIED). Where the prompt's approximate line drifted, both are given.

| Anchor | Prompt | At 078fe895 | Reading |
|---|---|---|---|
| `no-agent` preflight | ≈:35 | `src/services/agentDeploy.js:43` | `{ success:false, postIssued:false, error:'no-agent' }` — VERIFIED |
| `auth-required` preflight | ≈:71 | `agentDeploy.js:79` | after `await getIdToken()` at :76 — VERIFIED |
| Clone ensure | ≈:87–114 | `agentDeploy.js:92–118` | `setDeployTarget(clone)` inside the try at :105; fallback marks :110/:115 — VERIFIED |
| POST / network | ≈:122–137 | `agentDeploy.js:129–145` | network → `deploy_network`, `httpStatus:null` — VERIFIED |
| Non-JSON branch | ≈:150–164 | `agentDeploy.js:161–172` | `deploy_http_${status}` — VERIFIED |
| JSON failure branch | ≈:165–179 | `agentDeploy.js:173–187` | review-due line :180, stock-admission line :181 — VERIFIED |
| Hand-off + catch | ≈:182–224 | `agentDeploy.js:189–233` | callback at :193 with `agentBattleId: data.agentBattleId \|\| null`; catch returns `deploy_handoff` + `battleId` :223–231 — VERIFIED |
| Final return | ≈:227 | `agentDeploy.js:235` | `{ success:true, agentBattleId: data.agentBattleId \|\| null }` — VERIFIED |
| Consumers | ≈:240 / ≈:150 | `CommandDashboard.jsx:240`, `CommandDashboardDesktop.jsx:150` | both pass `setDeployTargetId`; `AgentDashboard.ARCHIVED.jsx:21` imports it but nothing mounts it — VERIFIED |
| decide.js existing 200 | ≈:795–805 | `api/agent/decide.js:795–805` | `success:true, portfolioUpdated:true, battleCreated:false, reason, existingBattleId, portfolio, bench, innerMonologue, strategyBrief` — the spec's reading holds — VERIFIED |
| decide.js 429s | ≈:184 / ≈:193 | `decide.js:184`, `:193` | `Deploy already in progress` / `Please wait 2 minutes between deploys`, no header — VERIFIED |
| decide.js created 200 | ≈:1008 | `decide.js:1024–1036` (`battleCreated:true` at :1027; :1008 is the shadow log's `battleCreated:true`) | VERIFIED |
| Retry-After | "confirm none" | none in `decide.js`; **but** `api/_utils/rateLimit.js:77` sets `Retry-After` on the 429 that `applySecurityMiddleware` (`decide.js:108`, 3 requests / 60 s per IP) sends before the handler runs, body `{ success:false, error:'Rate limit exceeded', message, retryAfter }` | VERIFIED — a third 429, see §4 |
| Complete stamp vs existing check | — | `decide.js:722` (`lastDeployedAt`) and `:737` (`deployProgress.stage:'complete'`) in the decision write, before the existing-battle query at `:755` | an existing answer arrives beside a complete checkpoint and a fresh cooldown — VERIFIED |
| App optimistic entry | ≈:6652–6820 | `src/App.jsx:6719–6740` | `isDeploySkyCouplingOn() && agentBattleId`, no `ownerId` — VERIFIED |
| Fabricated id | — | `App.jsx:6743` | the server's id, or else a fabricated `` `agent_${Date.now()}` `` — VERIFIED |
| Fresh-price overwrite | — | `App.jsx:6783–6805` | `captureBattlePrices(...).then(updateDoc)` — VERIFIED |
| Stash vs navigation | — | `App.jsx:6811–6816` | — VERIFIED |
| `handleEnterCeremonyBattle` / `handleOpenAgentBattle` | ≈:6640 / ≈:6825 | `App.jsx:6640`, `:6827` | — VERIFIED |
| Ceremony inputs / `enterBattle` / error copy | ≈:80–96 / :163 / :145 | `DeployCeremony.jsx:79–98`, `:163`, `:144–145` | — VERIFIED |
| Stage machine phases / recovery admission | ≈:109 / ≈:300–352 | `useCeremonyStageMachine.js:109`, `:327–352` | — VERIFIED |
| `pickCeremonyEntry` | — | `ceremonyData.js:124–128` | — VERIFIED |
| `findActiveBattleForAgent` | — | `src/services/agentBattleVerify.js:97` | agentId + ownerId (auth uid) + status, from the server; BaggerBomb-only, unexpired — VERIFIED |
| Hub `SERVICE_OUTCOMES` | — | `attemptVocabulary.js:46–53` | the six strings — VERIFIED |
| Mount guard | — | `commandCenterHub.mount.guard.test.js:415–427` (permitted terminals), `:604–622` (the main graph reaches the hub only through App → gate and picker; test files are outside the walk, `:285–299`) | — VERIFIED |

**STOP check.** No created-path behavior change is needed in either shell; no fenced file needs editing (nothing under `api/` changes); the existing-battle 200's shape is what the spec reads. Recorded and continued.

## 3. The rulings as applied

| Ruling | As built |
|---|---|
| **R-R1-1** constants outside the hub | `src/constants/deployOutcomes.js` holds the six frozen strings. `agentDeploy.js` imports them; `src/constants/deployOutcomes.test.js` asserts `DEPLOY_OUTCOMES` equals the hub's `SERVICE_OUTCOMES` key for key and that the service's import specifiers name nothing under `CommandCenter`. The hub directory is untouched except one test row (below); the mount guard passes unmodified. |
| **R-R1-2** existing battle | The 200 with `battleCreated:false` and a real `existingBattleId` is typed **before** the hand-off and returns `{ outcome:'existing_battle', success:false, existingBattleId, postIssued:true, httpStatus }`; no callback, no stash, no navigation, no id. Both shells map it (through `deployResult.js`) to ceremony status `existing`; the ceremony's new terminal opens the owned server document through the shells' `onOpenAgentBattle` (= App `handleOpenAgentBattle`). Ceremony off: the shells open the same document directly (`openExistingBattleDirectly`), no toast. |
| **R-R1-3** status → outcome | As in §4's table. JSON 4xx and every JSON 503 → `refused` (`code` on review-due; `reason` on the two decide.js 429s); network, non-JSON, other JSON 5xx, a JSON 2xx without `success:true`, and a 200 naming no battle → `uncertain`. Every legacy field is byte-identical to `078fe895` on every non-created path (L1's and L4's differential runs). **One open ruling question:** the stock 503 with `reason:'corrected_creation_failed'` can follow a commit (review L4-1, CONFIRMED) — typed `refused` as ruled; see §11 Q1. |
| **R-R1-4** identity guard | `signedInUid()` (`src/services/deployIdentity.js`, `getCurrentUser()` = the `auth.currentUser` the active poll reads) captured at entry; checked after the token, after the clone ensure (before the clone is reported or POSTed), after the POST (and in its network catch), after the body read, and immediately before the hand-off. `orphaned` carries `postIssued` = whether the POST went out, logs one warning, and leaves the server battle alone. A null token caused by an account change is `orphaned`; nobody signed in at entry stays `auth-required`. `options.isCurrent` is checked beside the uid; only a literal `true` passes; a throw, or an `isCurrent` that is not a function, fails closed. |
| **R-R1-5** App hand-off | `handleCreateAgentTrainingBattle` takes the id through `handoffBattleId` and the owner from `agentMeta.ownerUid`; with no real id, or another account signed in, it returns `null` before the append, the build, the overwrite, the stash and the navigation. The price overwrite re-checks immediately before its write. The optimistic entry (`buildOptimisticBattleEntry`) carries `ownerId` and `localOrigin:true`. The stash is recorded with its owner, and **Enter** — the ceremony deploy's navigation — filters `pickCeremonyEntry`'s inputs by the signed-in uid (`ownedCeremonyEntryInputs`; review L2-1), leaving `pickCeremonyEntry` untouched. |
| **R-R1-6** ceremony additive | The stage machine commits `deployStatus === 'existing'` to its own latched `existing` phase before any progress bookkeeping; `DeployCeremony` renders `CeremonyExisting` for it; `attemptId` + `onPhaseChange({ attemptId, phase, errorTone })` fire on mount and at every machine transition (reported from the machine's own setters, so a `verifying` that never paints is still reported). The recovery admission block, `pickCeremonyEntry`, `CeremonyReveal` and `CeremonyError` are byte-identical to base. |

## 4. The result table as built (status → outcome → legacy fields)

Every row is pinned field-for-field in `src/services/agentDeploy.outcomes.test.js` (`toEqual`), and run through the hub's own `translateServiceResult` in the same file's last block. `—` = the field is absent, exactly as before R1.

| Server answer (source) | `outcome` | `success` | `status` | `httpStatus` | `postIssued` | `error` | `details` | other |
|---|---|---|---|---|---|---|---|---|
| no `agentId` (client preflight) | `refused` | false | — | — | **false** | `no-agent` | — | — |
| no token (client preflight) | `refused` | false | — | — | **false** | `auth-required` | — | — |
| uid changed or gone after the token / the clone ensure | `orphaned` | false | — | — | false | — | — | no POST, no clone report |
| uid changed or gone after the POST / the body read / before the hand-off | `orphaned` | false | — | — | true | — | — | no hand-off; the server battle is left alone |
| network failure (fetch rejected) | `uncertain` | false | — | null | true | `deploy_network` | the error message | — |
| non-JSON body, any status (Vercel 502/504 pages, HTML 500, empty) | `uncertain` | false | s | s | true | `deploy_http_${s}` | the first 300 chars or statusText | — |
| JSON 500 (decide.js single catch, `:1074`), 502, 504, any other JSON 5xx but 503 | `uncertain` | false | s | s | true | `data.error` | `data.details` | `errorPhase` |
| JSON 409 `hypothesis_review_due` (carriage refusal) | `refused` | false | 409 | 409 | true | `hypothesis_review_due` | the server's `message` (table C's due line) | `code: 'hypothesis_review_due'`, `errorPhase` |
| JSON 429 `Deploy already in progress` (`decide.js:184`) | `refused` | false | 429 | 429 | true | the words | — | `reason: 'in_progress'` |
| JSON 429 `Please wait 2 minutes between deploys` (`decide.js:193`) | `refused` | false | 429 | 429 | true | the words | — | `reason: 'cooldown'` |
| JSON 429 `Rate limit exceeded` (`rateLimit.js:78`, before the handler) | `refused` | false | 429 | 429 | true | `Rate limit exceeded` | — | no `reason`. **Amended (Q3, §14):** `retryAfter` is the body's finite seconds; the header is never read |
| JSON 503 `Stock admission unavailable` (`decide.js:1073`) | `refused`. **Amended (Q1, §14):** `uncertain` when `reason:'corrected_creation_failed'` | false | 503 | 503 | true | the words | the player line (`stockAdmissionLine`), kept in both cases | — |
| JSON 503 `pricing_unavailable` (`:897`) / missing rankings (`:364`) | `refused` | false | 503 | 503 | true | `data.error` | `data.details` | — |
| JSON 400 / 401 / 403 / 404 / other 409s / any other 4xx | `refused` | false | s | s | true | `data.error` | `data.details` | — |
| JSON 2xx whose `success` is not `true` | `uncertain` | false | s | s | true | `data.error` | `data.details` | — |
| **200 `battleCreated:false` + real `existingBattleId`** (`decide.js:795`) | `existing_battle` | false | — | 200 | true | — | — | `existingBattleId`; **no callback** |
| 200 naming no battle (no real id for its flag; either id empty, padded or not a string) | `uncertain` | false | 200 | 200 | true | `deploy_no_battle_id` | fixed line | `battleId: null`; no callback |
| 200 `battleCreated:true` (or no flag) + real `agentBattleId` (`decide.js:1024`) | `created` | **true** | — | — | — | — | — | `agentBattleId` (real, never null) |
| the same, App's hand-off threw | `handoff_failed` | false | 200 | 200 | true | `deploy_handoff` | the throw's message | `battleId` = the real id |

## 5. What R1 built, by `file:line` (at the code head)

Production files: 12 (6 new, 6 edited). Test files: 17 (11 new, 6 edited — see §6). Plus this report. Nothing under `api/`.

**Service**

**`src/constants/deployOutcomes.js`** (new)
- `:25-32`: `DEPLOY_OUTCOMES`, the six frozen strings.

**`src/services/deployIdentity.js`** (new)
- `:14`: `signedInUid()`, which is `getCurrentUser()?.uid`. It returns null when nobody is signed in or auth cannot be read (fail closed).

**`src/services/agentDeploy.js`**
- `:63`: `REFUSAL_REASONS_429`.
- `:81`: `isDefinitiveRefusal`. Its comment block (`:65-80`) states the Q1 exception.
- `:85`: `realId`.
- `:96`: `deployAgent(…, options = {})`.
- Every return carries an outcome: `:97`, `:163`, `:238`, `:266`, `:285-295`, `:307`, `:319`, `:370`, `:382`.
- Identity:
  - capture at `:107`;
  - `stillOwned` at `:109-115`;
  - `orphaned` (with its warning) at `:116-124`;
  - guards at `:161` (null token across a change), `:168` (after the token), `:209` (after the clone ensure, before its report), `:236` (network catch), `:247` (after the POST), `:254` (after the body read), `:332` (before the hand-off).
- Existing battle checked before the hand-off: `:303-312`.
- Malformed 200: `:315-325`.
- `ownerUid` in the hand-off meta: `:346`.

**App hand-off**

**`src/components/Dashboard/deployHandoff.js`** (new)
- `:25`: `handoffBattleId`
- `:31`: `isHandoffOwnerCurrent`
- `:48`: `buildOptimisticBattleEntry` (adds `ownerId` and `localOrigin`)
- `:82`: `ownedCeremonyEntryInputs` (the Enter owner filter)
- `:97`: `appendOptimisticBattle`

**`src/App.jsx`**
- `:131-132`: imports.
- `:6629`: `pendingCeremonyOwnerRef`.
- `:6645-6664`: `handleEnterCeremonyBattle` filters `pickCeremonyEntry`'s inputs (`:6653`, `:6658`).
- `handleCreateAgentTrainingBattle` (`:6663`):
  - id and owner at `:6677-6680`;
  - entry at `:6747`;
  - no fabricated id at `:6762`;
  - overwrite re-check at `:6817`;
  - owner beside the stash at `:6836`.

**Shells**

**`src/components/Dashboard/deployResult.js`** (new)
- `:18`: `isExistingBattleResult`.
- `:23`: `deployResultFor` (existing becomes `status:'existing'`; the rest is the pre-R1 ternary).

**`src/components/Dashboard/CommandDashboard.jsx`**
- `:42`: imports.
- `:209`: `reportDeployTarget`.
- `:248`: the deploy call.
- `:263-273`: the mapping, and the ceremony-off existing open.
- `:653-654`: ceremony props.

**`src/components/Dashboard/CommandDashboardDesktop.jsx`**
- `:29`, `:148`, `:158`, `:173-183`, `:387-388`: the same, in that order.

**Ceremony**

**`src/components/Dashboard/deployCeremony/existingBattle.js`** (new)
- `:38`: `ownsExistingBattle`.
- `:50`: `resolveExistingBattle` (live list first, then the verifier; id and owner required).
- `:73`: `openExistingBattleDirectly` (default readers at `:75`).

**`src/components/Dashboard/deployCeremony/CeremonyExisting.jsx`** (new)
- `:21`: copy.
- `:42-49`: resolution.
- `:51-59`: Open, with the owner re-checked.
- `:69-92`: the one primary button, `aria-disabled` while reading.

**`src/components/Dashboard/deployCeremony/DeployCeremony.jsx`**
- `:48`: new props.
- `:94-97`, `:120`: the `onPhaseChange` echo.
- `:171`: live text.
- `:218-232`: the existing body.

**`src/components/Dashboard/deployCeremony/useCeremonyStageMachine.js`**
- `:112`: `onPhaseChange` input.
- `:118`, `:135-143`: the setters with the report.
- `:401`: the latch.
- `:417-421`: the existing branch.
- `:564`: the mount report.
- The recovery admission (`:355-…`) is byte-identical to base.

**Fenced functions called:** none newly. `deployAgent` still only calls `POST /api/agent/decide` and `/api/agent/ensure-casual-clone`, as before. **Edited:** none.

## 6. Existing tests R1 edited, and why

"Existing shell tests must pass unmodified": no shell test was edited (the shells' only tests — `commandCenterHub.mount.guard.test.js` and `activeNavigation.shelvedSurfaces.test.jsx` — pass unchanged). Six other existing test files were edited, each a deliberate pin move named here:

| File | Edit | Why |
|---|---|---|
| `src/services/agentDeploy.refusal.test.js` | the authService mock gains `getCurrentUser`; the 409 `toEqual` gains `outcome:'refused'` and `code` | R-R1-4 makes the deploy require a signed-in uid (without one every deploy orphans); R-R1-3 adds `outcome` (and `code` on review-due) beside the unchanged legacy fields |
| `src/services/agentDeploy.stockAdmission.test.js` | same mock; the late-start `toEqual` gains `outcome:'refused'` | same |
| `src/components/Dashboard/deployCeremony/ceremonyDeployTarget.test.jsx` | same mock; the plain-success `toEqual` gains `outcome:'created'` | same. Its "a 200 carrying only `existingBattleId` yields NO battle id" row passes **unmodified** (the malformed-200 return carries `battleId:null`) |
| `src/components/Dashboard/deployCeremony/ceremonyTiming.test.jsx` | same mock only | same |
| `src/App.deploySettle.test.js` | the shape and idempotence rows now assert the extracted builder's real output and pin that the settle block routes through `buildOptimisticBattleEntry` / `appendOptimisticBattle`; the gate, read-path and service-ordering rows are unchanged | R-R1-5 extracts the entry builder; the file's own header said it was a source guard only because the builder was not exported |
| `src/components/CommandCenter/hub/selectors/attemptVocabulary.test.js` | the row "No typed outcome exists in the service yet: R1 adds it" now pins R1's typed returns and asserts the outcome exists | S2a wrote it to flip at R1; the untyped fixture rows stay as the translator's fail-closed inputs |

## 7. Checks

All on Linux (WSL Ubuntu, a private clone, Node 20.20.2 / npm 10.8.2 as CI, `TZ=UTC`) unless stated.

| Check | Where | Result |
|---|---|---|
| Full suite, CI-shaped (`vitest run --maxWorkers=2`) | code head `e5e98d42` | **Test Files 1028 passed | 7 skipped (1035)**; 22,300 tests passed, 0 failed, 88 skipped; exit 0; 566 s. (Also at `1e65feb1`: identical counts, exit 0.) |
| Full suite, CI-shaped | first code head `4b4531d1` | **Test Files 1026 passed \| 7 skipped (1033)**; 22,272 tests passed, 0 failed, 88 skipped; exit 0; 471 s |
| `npm run lint:gate` | `e5e98d42` | exit 0 (also exit 0 at `4b4531d1`) |
| `vite build` | `e5e98d42` | exit 0, built in 17.4 s (also exit 0 at `4b4531d1`). The hub chunk is `CommandCenterHub-*.js` 67.58 kB, identical to S2a's: R1 adds nothing to it. |
| R1 test set on Windows (worktree) | through the fix rounds | green. The only red rows are the known Windows path-separator rows in `agentReadCensus.guard`, plus the S1 mount-guard src walk, which hit 5.2 s under parallel load and passes alone in 1.0 s. Neither reproduces on Linux. |

The rules suite (`test:rules`) was not run: R1 touches no `firestore.rules`.

## 8. The BUILD_RULES §2 review record

The cumulative diff is 27 files (13 production, 14 test). The full review therefore ran.

### 8.1 How it ran

- **Snapshots.** Every reviewer worked in its own `git -c core.autocrlf=false archive` extraction under the session scratchpad, with `node_modules` as a junction, read-only on git and on the worktree. There were 4 lens trees and 13 refuter trees at `4b4531d1`, plus L5's tree at `969c7da1`.
- **Lenses.** Four read-only lenses (L1–L4) ran in parallel at `4b4531d1`:
  - L1: created-path parity in both shells, ceremony on and off
  - L2: ownership at every boundary
  - L3: the existing-battle terminal
  - L4: the result table against decide.js's actual responses
- **Refuters.** Every finding went to a refuter told to break it with its own repro. That was 13 refuters: one for each MAJOR/MINOR finding, and three for the grouped NITs. Verdicts are CONFIRMED, PARTLY (the mechanism holds, but part of the claim was refuted or its scope narrowed) or REFUTED.
- **Fix round.** CONFIRMED and PARTLY items with an R1-scoped fix were then fixed (commit `969c7da1`).
- **Mutating lens.** L5 (test integrity) ran last, on its own tree of `969c7da1`. It found no defect in the head code: 6 MINOR and 9 NIT test gaps. Each was confirmed by its own refuter (F15) and closed by rows in `1e65feb1` and `e5e98d42` (§8.2, L5 table).
- **Repro evidence.** Lenses and refuters used: differential runs of base against head (L1: 32 rows; L4: 30 rows), jsdom rows against the real ceremony, stage machine, service and verifier with only Firestore mocked, the real `@google-cloud/firestore` 7.11.6 transaction runner (F2), and headless Edge 155 with the real component and the real `useModalFocus` (L3, F6).

### 8.2 Findings, verdicts and dispositions

**Tally (L1–L4):** 24 unique findings. 15 CONFIRMED, 9 PARTLY, 0 fully REFUTED.

These sub-claims were refuted inside PARTLY verdicts:
- L3-1: "first eligible of 5", and "forever"
- L3-2: "Tab escapes the modal" (Chromium)
- L3-4: "the 429 is caused by the sheet"
- L3-7: "can never resolve"
- L2-1: "a ruling violation"
- L3-5: "misleading copy"

Fixed in R1: 8. Recorded: 16. Founder questions: Q1 and Q2 (with Q3 and Q4 optional).

| Id | Sev. (after refute) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| L4-1 | MAJOR → below MAJOR | A stock-admission 503 `corrected_creation_failed` can follow a landed commit (lost commit acknowledgement → SDK retry → `ALREADY_EXISTS`, wrapped at `agentBattleService.js:339`). R1 types it `refused`. | CONFIRMED (real SDK, 13/13) | **Kept as ruled; Q1.** Comment states it; root cause flagged §12 |
| L2-1 | MAJOR → MINOR | Enter (the ceremony's deferred navigation) had no owner check after a cross-tab account switch | PARTLY: real, not a regression, not a literal ruling violation | **Fixed:** owner recorded beside the stash; Enter filters `pickCeremonyEntry`'s inputs (`ownedCeremonyEntryInputs`); `pickCeremonyEntry` untouched |
| L2-2 / L4-6 | MINOR | `orphaned` → legacy error shape → a still-mounted ceremony verifies under the new account; its "Try again" becomes live for that account | CONFIRMED | **Kept as ruled; Q2.** R1's comments no longer claim "no result shown" |
| L2-3 | MINOR | A non-function `isCurrent` was ignored (the epoch check failed open) | CONFIRMED | **Fixed** |
| L3-1 | MINOR | The live list and the verifier see different documents (league battles) | PARTLY | **Documented + pinned row**; S2b's targeted read closes it |
| L3-2 | MINOR (a11y) | Retry → disabled node → focus to `<body>`; Enter then does nothing | PARTLY (Tab stays in the dialog in Chromium) | **Fixed:** one primary button, `aria-disabled` while reading; verified in Edge by the refuter |
| L3-3 | MINOR → NIT | Retry is not deduplicated or throttled (spec §6 :217) | PARTLY: S2b's contract | Recorded for S2b |
| L3-4 | MINOR → NIT | Scouting Board sheet stays open after the existing terminal | PARTLY: the 429 is not caused by it | Recorded; Q4 (one-liner) |
| L3-5 | MINOR | The theater shows a portfolio built and discarded for an already-running agent | PARTLY: server-side, not a regression (pre-R1 then also showed a false reveal) | Recorded; §12 (fenced) |
| L4-2 | MINOR | The limiter's `Retry-After`/`retryAfter` is dropped; the S2a guard's premise is false | CONFIRMED | Recorded; Q3 |
| L4-3 | MINOR | Most refusals reach the hub with `line: null` | PARTLY: `details` frozen by ruling | Recorded for S2b |
| L1-1 | NIT | Orphaned deploys were silent | CONFIRMED | **Fixed:** one warning naming the case |
| L1-2 / L2-7 | NIT | App could decline while the service reports created | CONFIRMED unreachable | Recorded |
| L2-4 | NIT | A null token across an account change returned `auth-required` | CONFIRMED | **Fixed** |
| L2-5 | NIT | A→B→A inside one await is undetected | CONFIRMED, by ruling | Recorded (S2b epoch) |
| L2-6 | NIT | A stale "Open game" (and the new account's agent name) after a switch; it fails closed | CONFIRMED | Recorded (shell-level close, S2b) |
| L3-6 | NIT | An existing 200 that lands after a watchdog verification is lost | CONFIRMED, not a regression | Recorded |
| L3-7 | NIT | `{status:'existing'}` without an id is accepted | PARTLY: unreachable, does not stall | Recorded |
| L3-8 | NIT | StrictMode reports `theater` twice (dev only) | CONFIRMED | Recorded for S2b |
| L3-9 | NIT | Dialog label and duplicate "Back to hub" | CONFIRMED, same as the error terminal | Recorded |
| L3-10 | NIT | The existing read has no deadline | PARTLY: the SDK bounds an unreachable backend at ~10 s | Recorded for S2b |
| L3-11 | NIT | Interpretation 10 was wrong; ceremony-off Deploy re-enables during the open read | CONFIRMED (rollback path only) | Interpretation corrected (§9); recorded |
| L4-4 | NIT | The 401 fixture body was not the server's | CONFIRMED | **Fixed** |
| L4-5 | NIT | R-R1-3's stated reason for 502/504 is wrong (the gate admits only 500); R1's own comment cited the FAILURE MODEL backwards | CONFIRMED | **Fixed** (comment); report note |

**L5 (mutating lens, at `969c7da1`).** No defect in the head code. It found 6 MINOR and 9 NIT items, all test gaps, each with a proven surviving mutant. Its refuter (F15) re-ran every mutant: all MINORs CONFIRMED, L5-9 PARTLY. All closed:

| Id | Gap | Closed by |
|---|---|---|
| L5-1 | The ordinary created→reveal transition was never reported to `onPhaseChange` in a row | A clock-driven row (M49 killed) |
| L5-2 | App's builder arguments were unpinned. R1 had lost base's `activatedAt` pin, a real regression of the guard. | All ten arguments pinned at the call site (M37–M41 killed) |
| L5-3 | The existing terminal's "Back to hub" was untested | A row (M17, M20 killed) |
| L5-4 | The live-list mirror was untested; a refactor would re-read on every shell render | Two rows (M21, M22 killed) |
| L5-5 | `openExistingBattleDirectly`'s default readers were untested | A row with the defaults (M26, M27 killed) |
| L5-6 | The existing terminal under reduced motion was untested | Its own file (M52 killed) |
| L5-7 | The focus row's `activeElement` asserts cannot fail in jsdom | Those asserts removed and the row renamed; node identity and `disabled` carry it |
| L5-8 | The AD02 row passed even when every deploy orphaned | `outcome` asserted (I3x killed) |
| L5-9 | The outcomes file depended on the clone flag without stating it | Flag stated; flag-off boundary rows added (FO1 killed) |
| L5-10 | The null-token branch's `isCurrent` leg was untested | A row (M3 killed) |
| L5-11 / F43 | Source guards cannot see control flow | The ownership guard is now pinned as a top-level statement (M43 killed). The general limit stands. |
| L5-12 | Two weak assertions | Corrected |
| L5-13 | Stale prose | The edited rows' titles and comments are corrected. `__fixtures__/attemptFixtures.js` comments still say "returns today"; this is left as is (an S2a fixture file) and recorded. |
| L5-14 | `realId` exists in four places with no agreement row | Recorded |
| L5-15 | The mutation runner skipped `ceremonyTiming.test.jsx` | Added from run 6; no earlier verdict changed |

### 8.3 Mutation records

How the runs worked:
- Every run used an LF `git archive` snapshot.
- Each mutant is a single exact find/replace (or a short list of them), and the find string must match exactly once.
- After every mutant, the file was restored byte for byte and verified.
- A test file that fails to load counts as BROKEN, not as killed.
- Test set: the R1 test files. That is 14 at first; from `1e65feb1` it is 17, adding `ceremonyTiming`, the flag-off file and the reduced-motion file (review L5-15).

| Run | Head | Mutants | Result |
|---|---|---|---|
| 1 | `7c665c3e` | 99 (service, identity, hand-off, App, mapping, shells, resolver, terminal, ceremony, machine, constants) | 97 killed. **2 survived**: C7 (Open live while the read is pending) and U2 (the latch without `existing`). Both got a row. **Found:** a failing ceremony row timed out at vitest's 5 s limit (`STACK_TRACE_ERROR`), and its wait loop leaked `act()` calls into later rows, so kills cascaded. The harness was fixed: a row-generation counter, 3 s waits, a 15 s row timeout. |
| 2 | `4b4531d1` | the same 99 | 99/99 killed. Row coverage: 138/186 added or changed rows were the failing row of at least one mutant. |
| 3 | `4b4531d1` | 33 targeted at the 48 uncovered rows | 32 killed. E12 is equivalent (it sits behind the earlier uid type check). |
| 4 | `969c7da1` (after the fix round) | 152 (runs 1–3 combined with stale anchors repointed, plus 21 for the fix round) | 149 killed, **3 equivalent**: E12; F1 (the explicit non-function `isCurrent` check, where the try/catch already fails closed); K3 (`open()` re-checks `found`). Row coverage 199/201, then **201/201** after 2 targeted mutants (F9, H15). |
| L5 | `969c7da1` | 32 written by the mutating lens | 9 equivalent survivors (M4–M7, M16, M24, M28, M32, M35). **14 real survivors**, all test gaps; the head had no defect. Rows were added in `1e65feb1`. |
| 6 | `1e65feb1` | L5's 14 real survivors, I3x (every deploy orphaned) and FO1 (the flag-off guard) | **16/16 killed**, each by the row written for it. |
| 7 | `e5e98d42` | L5's M43 (App's guard wrapped in `if (false)`) | killed by the strengthened source pin. |

Every added or changed row at the pushed head has been the failing row of at least one non-equivalent mutant. The L5-7 focus row was rewritten; the `document.activeElement` asserts it dropped could never fail in jsdom, so they were never guarded. The amendment's rows are covered in §14.

## 9. Builder interpretations, as they stand after review

1. Every JSON 503 decide.js sends is `refused` (pricing, missing rankings, stock admission). **Except in one case it is not definitive** — L4-1, Q1. **Amended (§14):** that one reason is now `uncertain`.
2. The rate limiter's 429 is `refused` with no `reason`; its `Retry-After` / `retryAfter` is not forwarded (Q3). **Amended (§14):** the body's `retryAfter` is now forwarded; the header is still not read.
3. A real `agentBattleId` with no `battleCreated` flag stays `created` (parity); `battleCreated:false` wins over a present `agentBattleId`.
4. The uid guard is strict: a token obtained while nobody is signed in is never used; nobody signed in at entry ends at `auth-required`; a null token caused by an account change is `orphaned` (L2-4).
5. `options.isCurrent` is checked beside the uid; only a literal `true` passes; a throw or a non-function fails closed (L2-3).
6. No guard after the hand-off callback resolves: App's handler is synchronous to its return (its only awaits are inside the fire-and-forget price write, which re-checks the owner), so nothing can change in between (L1-2 / L2-7, refuted as reachable by a 0–300 microtask sweep).
7. `orphaned` maps in the shells to the legacy error shape, by the shell rule — Q2. **Amended (§14):** the shells now close the ceremony on `orphaned`.
8. The existing terminal resolves from the shell's live list first (skipping `localOrigin` and non-active entries), then the target-scoped verifier, and requires the server's id and the signed-in owner; Retry re-reads, never POSTs. A league battle is reachable only through the live list (L3-1, documented and pinned).
9. `onPhaseChange` is reported from the machine's own setters at every transition, plus once on mount (StrictMode reports mount twice in development — L3-8).
10. **Corrected (L3-11):** before R1, ceremony-off + an existing battle was not silent — it navigated into the fabricated battle and toasted "Agent deployed". After R1 it opens the owned document, or shows nothing if it cannot (as ceremony-off refusals always have).

## 10. What S2b, S3 and R2 inherit

**S2b (the provider and bridge)**

Outcomes and identity:
- `deployAgent(agentId, onCreate, onTarget, { isCurrent })`: pass a **function**. A precomputed boolean now fails closed. The function is checked beside the uid.
- A→B→A is undetected without the epoch.
- `orphaned` is a local disposition. It carries `postIssued` and logs one warning.

Before S2b wires `outcome` to Retry (amended, §14):
- Q1 is answered. The stock-admission 503 with `reason:'corrected_creation_failed'` is `uncertain`, so it goes through reconciliation like any other `uncertain`. Every other stock reason stays `refused`.
- Results carry `reason` only on decide's two 429s (`in_progress`/`cooldown`). `code` appears only on review-due.
- Refusal words beyond `details` are S2b's to compose, from `evidence.error`, `reason` and `httpStatus` (L4-3).
- The limiter's 429 carries `retryAfter`, the body's seconds (Q3). S2b converts it to `retryAfterUntil` with its own clock (the S2a reducer's `cooldownUntilFrom`).

The ceremony bridge:
- Use `attemptId` and `onPhaseChange` (reported at every transition).
- Ignore repeats (StrictMode).
- Close the ceremony on any auth/epoch change, at the change itself (L2-2, L2-6). Since the amendment, the legacy shells close it on `orphaned`, but only when the result arrives.

The existing battle:
- R1's terminal reads the live list, then the verifier.
- S2b owns the targeted owned read of the server's id: deduplicated, 30 s Retry cooldown, a deadline. This resolves league ids and voided-group ids (L3-1, L3-3, L3-10).
- An existing answer stamped `lastDeployedAt` server-side, so a 120 s cooldown follows it (decide.js:722).

Admission:
- Make deploy controls existing/cooldown-aware (L3-4).
- `canStart`/`canCommit` before `begin` (S2a §6).

The optimistic entry:
- It now carries `ownerId` and `localOrigin:true`.
- Activity excludes it until the server document replaces it.

**S3 (the readers)**
- The active poll still keeps the former owner's list, including the optimistic entry, until its next run (deps `[screen, isPageVisible]`). The uid/epoch-aware poll is S3's.
- The poll keeps league battles. The existing terminal relies on that to resolve a league id.

**R2 (the hold)**
- R1 adds no hold or claim behaviour. The ceremony mounts exactly where it did.
- `onPhaseChange` is available for the provider-owned beat.


## 11. Founder questions

**Answered 2026-10-16: apply all four fixes as proposed below.** Applied in §14. The questions are kept here as they were asked.

**Q1 — the stock 503 that can follow a commit (review L4-1, CONFIRMED on the real SDK).**
- R-R1-3 names "503 stock admission" `refused`, and R1 types it so.
- The refuter proved one reason can follow a landed battle commit: `corrected_creation_failed`, raised when a commit's acknowledgement is lost and the SDK's retry meets `ALREADY_EXISTS`.
- **Today's impact:** none. Nothing live reads `outcome`. The shipped ceremony shows its error terminal before and after R1. Retry self-corrects to `existing_battle`. The path is limited to allowlisted pilot owners, and is probably dormant behind the control document.
- **S2b's impact:** "Deployment failed" plus Retry over a real battle.
- **Asked:** keep the ruling, or amend it with one line?
  ```js
  // agentDeploy.js — inside the JSON-failure branch
  const refused = isDefinitiveRefusal(status) && !(status === 503 && data.reason === 'corrected_creation_failed');
  ```
  The amendment changes no legacy field.
  - Its cost: the pre-commit collector failures with the same reason become `uncertain` too. That means one check read, and the player line is lost in the hub.
  - Its limit: it does not cover the narrower B2 case (§12).

**Q2 — how the legacy shells show `orphaned` (review L2-2, CONFIRMED).**
- The shell rule maps "every other outcome" to the legacy error shape, and R1 follows it.
- When another tab signs out or switches accounts, the dashboard stays mounted (UserContext never changes `screen`). The ceremony then verifies the former owner's deploy under the new account and shows "Couldn't confirm the deploy" with a "Try again" that would deploy the **new** account's agent.
- Spec §5.2/§5.4 say "closes for former owner".
- **Asked:** keep the literal mapping, or close the ceremony on `orphaned` (two identical lines per shell)?
  ```js
  if (ceremonyOn) {
    if (result?.outcome === DEPLOY_OUTCOMES.ORPHANED) setCeremonyOpen(false);
    else setDeployResult(deployResultFor(result));
  }
  ```
  - The created path is untouched.
  - It closes when the result arrives, not at the switch itself; that is S2b's epoch.

**Q3 — forward the rate limiter's `retryAfter` (review L4-2; optional).**
- The limiter in front of decide.js sends `Retry-After` and a body `retryAfter`. R1 drops both.
- **Asked:** forward the body's seconds additively on that refusal (`...(Number.isFinite(data.retryAfter) ? { retryAfter: data.retryAfter } : {})`), or leave it for S2b?
- Forwarding would move one R1 row, and would not trip the S2a guard, which matches only the hyphenated header name.
- Separately, the S2a guard's title and the S2a report's "no Retry-After exists today" are false for this endpoint.

**Q4 — close the Scouting Board after an existing battle (review L3-4; optional).**
- Before R1 the sheet closed on the existing 200's false `success:true`. Now it stays open beneath the terminal.
- **Asked:** restore the close?
  ```js
  // ScoutingBoardSheet.jsx:129
  if (r?.success || isExistingBattleResult(r)) onClose?.();
  ```
- It changes only where the user lands. It does not prevent the 429.


## 12. Found outside R1 (for separate tasking; not fixed)

- **`api/_utils/agentBattleService.js:339`, fenced:**
  - It wraps commit-phase errors as `StockThresholdRefusal('corrected_creation_failed')`. `decide.js:985/:1073` then restores the cooldown and answers 503 over a possibly committed battle (Q1).
  - B2: another stock reason (`creation_selection_changed`) can follow a commit if the control document changes during the retry backoff. This is narrow.
- **`api/agent/decide.js`, fenced:**
  - The existing-battle check runs after both model calls and after the decision write. Every already-running deploy spends two model calls, overwrites `lastDecision` and stamps the 2-minute cooldown (L3-5).
  - The check has no group filter, so it can name a voided-group league battle that neither client source shows (L3-1).
- **`src/services/agentBattleVerify.js:23-25` FAILURE MODEL:** "A status OTHER than 500 proves the server refused before it could create anything" is false for the Q1 503.
- **`useCeremonyStageMachine.js` ≈:390 (pre-existing, fenced by R-R1-6):** the `confirmed` tone requires a server error signal and a completed check, but does not explicitly require `found === false`. Noted by F13; not touched.
- **S2a guard premise:** `selectors.purity.guard.test.js:263` is titled "the server sets no Retry-After header today". The S2a report says the same. Both read only decide.js; the limiter in front of it sets one (Q3).


## 13. Files outside the repository, and next

- This report's byte-identical copy: `C:/Users/fashr/Documents/FantasyTrades/CommandCenter/20261016_BUILD_DEPLOY_R1_TYPED_OUTCOMES.md` (sha256 in the PR description).
- The scratchpad holds the review material: the brief, the lens findings, the refuter verdicts, the mutation specs and results, and the WSL logs.
- **Next (as of the first report):** the founder answers Q1 and Q2 (and optionally Q3 and Q4). An independent Fable review of this PR follows. R2 runs separately. S2b waits for reviewed R1 and R2. The founder has since answered all four; see §14.

## 14. Amendment after founder rulings

**Ruling (2026-10-16):** "Apply all four fixes as proposed in report §11." The four fixes are below.

**New code head: `1d5dd538`.** The amended report is the next commit, and the PR head.

| Ruling | Change, by `file:line` at `1d5dd538` | Effect |
|---|---|---|
| **Q1** | `src/services/agentDeploy.js:85` `mayFollowCommit` (a 503 whose `reason` is `corrected_creation_failed`); `:289` `refused` excludes it. | That 503 is now `uncertain`. Its player line stays in `details`, and every legacy field is unchanged. Every other stock-admission reason stays `refused`. The hub's translator reads it as uncertain / lost contact. The shipped ceremony is unchanged: `deployResultFor` maps `refused` and `uncertain` to the same error shape. |
| **Q2** | `src/components/Dashboard/deployResult.js:28` `isOrphanedResult`; `CommandDashboard.jsx:42`, `:266-267`; `CommandDashboardDesktop.jsx:29`, `:176-177`. Both shells are edited identically. | With the ceremony on, an `orphaned` deploy closes the ceremony instead of being mapped to the error shape. The former owner's deploy is no longer verified under the new account, and no "Try again" can deploy the new account's agent. **Residual:** the ceremony closes when the result arrives, not at the account switch itself. That is still S2b's epoch. |
| **Q3** | `src/services/agentDeploy.js:301` | On a JSON failure, a finite numeric `retryAfter` in the body is forwarded as `retryAfter` (seconds). Only the shared rate limiter's 429 sends one. The header is never read, so the S2a guard that forbids the hyphenated header name in this file stays green. Nothing reads the field today; S2b converts it into a cooldown. |
| **Q4** | `src/components/Dashboard/ScoutingBoardSheet.jsx:20` (import), `:132` | The sheet closes on `existing_battle` as well as on a created deploy, as it did before R1 typed that answer. It still stays open on every failure, including `orphaned`. Only where the user lands changes; a later tap still meets the 2-minute cooldown. |

**Created-path parity:** unaffected. Q1 and Q3 are inside the JSON-failure branch. Q2 acts only on `orphaned`. Q4 adds a close only for `existing_battle`; a created deploy closes the sheet exactly as before.

**Rows added or moved:**
- `agentDeploy.outcomes.test.js`:
  - the `corrected_creation_failed` 503 is `uncertain`, with its line kept;
  - four other stock reasons stay `refused`;
  - the hub translator reads that 503 as uncertain;
  - the limiter row now pins `retryAfter: 41`;
  - a non-finite `retryAfter` (string, null, NaN, absent) forwards nothing.
- `deployResult.test.js`: `isOrphanedResult` is true only for `orphaned`.
- `deployShells.r1.guard.test.js`: the ceremony-on branch now pins the orphaned close, and the import pin moved.
- New file `ScoutingBoardSheet.close.test.jsx` (7 rows, the real sheet): created and `existing_battle` close it; refused, uncertain, handoff_failed, orphaned and a shell catch leave it open.

**Mutation (run 8, LF snapshot of `1d5dd538`):** 10 mutants (Q1a–c, Q3a–b, Q2a–c, Q4a–b). **10/10 killed**, each by the row written for it. Baseline 360/360.

**Checks at `1d5dd538`:**

| Check | Result |
|---|---|
| R1 test set (18 files, Windows worktree) | **360 passed**, 0 failed |
| `vite build` (Linux) | exit 0; hub chunk unchanged at 67.58 kB |
| `lint:gate` (Linux) | exit 0 |
| Full suite, CI-shaped (Linux) | **Test Files 1029 passed \| 7 skipped (1036)**; 22,318 tests passed, **0 failed**, 88 skipped; exit 0 |

**Review:** the four changes are the one-line fixes §11 proposed, applied as the founder ruled. Each is mutation-checked, and their rows were written to the refuters' findings (L4-1 / F2, L2-2 / F3, L4-2 / F10, L3-4 / F8). No lens re-ran over them. The independent Fable review follows.

**Superseded by this amendment:**
- §4: the stock-503 row and the limiter row. Marked inline.
- §9: interpretations 1, 2 and 7. Marked inline.
- §10: the S2b items for Q1, Q3 and the shells' close. Updated.
- §11: all four questions, now answered.
- The earlier PR-description errata (the report commit's SHA, and §8.3's wording) are folded into §1 and §8.3.

**Unchanged and still open for separate tasking:** everything in §12, including the stale S2a guard premise, the fenced root cause at `agentBattleService.js:339`, and the B2 case Q1 does not cover.
