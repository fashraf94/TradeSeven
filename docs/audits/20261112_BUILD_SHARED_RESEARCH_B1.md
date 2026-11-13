# Build report — Shared Research "Work an idea" B1, the server (dark)

**Date:** Nov 12, 2026; the follow-up on the founder's report rulings Nov 12–13 (§16–§18); round 2, Nov 13 (§20–§22) · **Session:** local Claude Code (Opus 5.5), own worktree · **Branch:** `claude/shared-research-b1` · **PR:** #1048 (draft)
**Spec:** `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md` (V1.2), committed verbatim as the branch's first commit, plus §15 (the founder's B1 preamble rulings, Nov 12), §16 (the founder's B1 report rulings, Nov 12) and §17 (the founder's round-2 rulings, Nov 13)
**Base:** cut from `origin/main` @ `c37baa0d1cad220d37a41dae312e3d212ff27d4c` (`ba22a52f` is an ancestor); `origin/main` merged in four times — `9ca96ff2` (#1045, #1046) at `7845d79e`, `29e8f4de` (#1051, #1047) at `890cf292`, `577f17eb` (#1052) at `a6a14275` and `66781ae2` (#1053) at `ae9b28da` (only `docs/README.md` ever overlapped, auto-merged)
**Spec commit:** `78fa99409417f0b679e521538cb26c77067e14e8` (the spec byte for byte, SHA-256 `19da9b97d3f6092e9630a11ae36537edd7d33686f4ef17e97f700d0e7cea3a9a`, LF, plus its `docs/README.md` row) · **§15:** `b335cbd5` · **§16:** `3114fc33` · **§17:** `aab75da7`
**Code heads:** the first pass `6af8196a`; the follow-up `ed069990` (checked on `9e487165`, §18); round 2 `310af3b1`, merged with `main` `66781ae2` at `ae9b28da` (the tree every final check ran on, §22) · this report's commit is the one on top (docs only)

## Verdict

| | |
|---|---|
| What was built | Spec §6 entire: one route `api/forge/shared-research.js` (GET reads; POST `frame`, `open`, `step`, `close`, `adopt`), the `api/_utils/sharedResearch/` modules, the dark flag and the shared vocabulary in `src/`, the rulebook §4–5, the `firestore.rules` blocks and their emulator test, the §6.11 tests and the §6.12 cost controls. |
| Is it dark? | Yes. `SHARED_RESEARCH_MODE = 'off'`; every action and read answers `404 disabled` before auth. Nothing in the app imports the two new `src/` modules: the minified client bundle equals `main`'s, file for file (§22). |
| Founder rulings | §15 S-1 to S-6 built as ruled; the one probe ran (one call, `claude-sonnet-5-5`, structured output accepted). **§16 FQ-1 to FQ-8 and NS-1 built as ruled (§16 below); §17 FQ-9 to FQ-15 (round 2): five built, two kept as built (§20).** The recorded probe still validates unchanged under them. |
| Tests (final, round 2, on the merged tree `ae9b28da`) | Full Linux suite: exit 0 — **1,432 files passed, 10 skipped (1,442); 31,567 tests passed, 120 skipped (31,687)**. The 20 Shared Research test files: 306 rows, all passed (Linux and Windows). Rules suite (emulator): exit 0 — 42 files, 764 tests passed (the new `sharedResearchSessions.rules.mjs`: 16). `lint:gate` (full repo): exit 0. |
| Mutations (final) | **69 of 69 killed** at `310af3b1` (the code the final tree carries; #1053 touched none of it): the earlier 64 (F4 and F4b re-cut to round 2's chain rule) and one for each round-2 change (FQ-9, 10, 11, 14, 15); every file restored byte for byte (SHA-256 checked). |
| Review | First pass: four lenses and a refuter — 27 finding lines, **12 CONFIRMED (11 distinct), 15 PARTLY, 0 refuted** (§10). Follow-up: the second refuter pass (honesty and record integrity) over everything after `dd792e4e` — **18 CONFIRMED (13 honesty, 5 integrity), all fixed**, 16 letter notes (§17). Round 2: no third refuter pass, by the founder's instruction. |
| Open for the founder | **No questions.** FQ-1 to FQ-8 are ruled (§16) and FQ-9 to FQ-15 (§20). What to watch once the allowlist is on is §21. Before the allowlist flip: deploy the rules and the `researchWork` index (§13). |
| STOP list | Nothing on it was done: no fence contact, no `src/components/**` edit, no golden or idea-version hash moved, no client-supplied origin/ref/finding/summary/kept ids/attribution accepted, nothing the server or the model writes carries a ticker the universe does not hold (spec §17 FQ-14: the player's quoted words are the one exception, kept verbatim and masked in everything the model sees), emulator only, one provider call (the probe), no legacy model id, no new index, no module-scope flag read. |

## 1. Preamble, anchors and the STOP

- `git fetch origin` first; branch cut from `origin/main` @ `c37baa0d`. Spec copied byte for byte (`cmp` against the attachment), LF, 0 CR.
- The F1–F14 anchors were re-verified at `c37baa0d` (one Explore pass, every cited line read). Result: F1, F3, F5–F9, F12–F14 OK; F2 and F10 line drift only (the builder spans `hypothesisRecords/model.js:397-432`; `STATE_REASONS` lives in `src/constants/hypothesisRecords.js:52-82`; `isCockpitOwnerAllowlisted` is in `callRecords/mode.js:73`; `sendHypothesisError` in `hypothesisRecords/http.js:100`); F11 the hub grew (`HUB_SHEETS` has `huddle`; the mount guard's terminals moved) — B2's territory, untouched here. **F4 differed in shape.**
- Preamble STOP (Nov 12): six items where the repo's shape differed from the spec (the drop has no `claims[]`; a finding's `at` cannot be null; `recordId` is capped at 256; the attribution agent has no uid-to-agent resolver; the `symbolKeys` census; the probe's key). The founder ruled all six (§15, appended to the spec on this branch in `b335cbd5` so B2 builds against them).

### §15 as built

| Ruling | Built at |
|---|---|
| **S-1** `parse.dataPoints` are the drop's claims (inference, `from_drop`); "Your drop" is the text, the url + note, or the note / "An image you dropped"; `extractedText` never the player's words; `impliedTickers` never names in scope | `api/_utils/sharedResearch/opening.js:71` (`dropTextOf`), `:58` (`namesInScopeOf`, `validation.validated` only), `:118` (`openingFindingsOf`) |
| **S-2** a retrieval fact's `at` = the model's day if it is a real instant not after the read, else `publishedDate`, else the read time with " · undated" (label ≤ 120); `asOf` = `publishedDate` if before the write, else null | `api/_utils/sharedResearch/stepSchema.js:348` (`modelDayOf`, strict `YYYY-MM-DD`), `:364` (`retrievalLabelOf`), `:380` (`retrievalDatesOf`); rows (a) and (b) in `stepSchema.test.js` and `reviewFixes.test.js` |
| **S-3** `recordId` = the url when ≤ 256, else `url-sha256:` + hex | `stepSchema.js:356` (`retrievalRecordIdOf`) |
| **S-4** the stamp's agent = the owner's ranked agent by `resolveRankedAgent`'s rule (3-line copy + parity test); none → `503 attribution_unavailable`, nothing written; the partner's name in both prompts from that document | `store.js:88` (`rankedAgentOfDocs`), `:95`, `:100` (`partnerNameOf`), `:103` (`attributionOf`); re-read inside the `open` transaction; parity row in `store.test.js` |
| **S-5** no `symbolKeys` in the projection; `extension.test.js` untouched | `companies.js:199` (`projectionOf`); `researchRecords/extension.test.js` green, unedited |
| **S-6** the probe with `CLAUDE_API_KEY` from the parent checkout's `.env.local`, loaded into the probe process only; `modelTurn.js` reads `CLAUDE_API_KEY` | `modelTurn.js:62`; `scripts/sharedResearch/probe.mjs`; the key was never printed, copied or committed |

**S1 outcome (rulebook coordination, spec §6.8).** `docs/design/SHADOW_VOICE_RULES_V1.md` is on `main` (Huddle S1 #1032 and S1.1 #1040 merged). B1 appended §4 "Written openings (Shared Research)" and §5 "Baseline method v0" (34 lines added, 0 removed; §1–3 untouched). `method.js`'s `METHOD.text` equals §5 byte for byte, and the prompt's written-opening rules equal §4's lines; `prompt.honesty.test.js` pins both against the file.

## 2. What was built (`file:line`, at the final code)

| Area | Where |
|---|---|
| The dark flag | `src/config/sharedResearchFlags.js:18` `SHARED_RESEARCH_MODES`, `:48` `SHARED_RESEARCH_MODE = 'off'` (imports nothing; "Pinned by" comment); pin test `src/config/sharedResearchFlags.test.js`; the "intentionally ABSENT" note at `src/config/flagPinGuard.test.js:309` |
| The shared vocabulary | `src/constants/sharedResearch.js` (imports nothing): entry kinds `:16-18`, beat questions `:26-36`, step intents `:39`, budgets `:45-62`, horizons `:66-74`, roles `:78-80`, unresolved reasons `:82`, labels `:84-121` |
| The route | `api/forge/shared-research.js`: `config.maxDuration` 30 `:47`; deadlines `:50-56`; the shadow log `:66`; `handleGet` `:130` (with `previous` `:145`), `handleFrame` `:152`, `handleOpen` `:231`, `handleStep` `:295`, `handleClose` `:447`, `handleAdopt` `:457` (the token `:460`), `handler` `:479` |
| The gate | `api/_utils/sharedResearch/gate.js`: the per-uid limiter `uidRateLimitHit` `:52`, `sharedResearchMode` `:69` (read at call time), `sharedResearchOnFor` `:79` (the mode AND idea-record admission), `gateSharedResearchRoute` `:94` (no-store → off 404 → auth → admission 404 → method → per-uid limiter `:112`), `sendSharedResearchError` `:132` |
| The host session | `session.js`: shapes `:89`, `:107`; step admission `:145`; daily counts `:167-190`; `isFramingInFlight` `:192`; the ended/live statuses `:201-203`, `previousSessionOf` `:223`, `previousViewOf` `:230`; the client view without exchange ids `:247` |
| The opening | `opening.js:118` (the story as reporter content, the player's words, the drop and its claims, the stored facts per name, the next action); `dropTopicOf` `:51` |
| Companies | `companies.js:121` `companiesOf` (supported only with a current verified relationship carrying the symbol — Correction A), `:199` `projectionOf` (with `answerStale`, `answerStaleOf` `:187`); `namesCompany` `:68` (does a text name a company), `isSameCompany` `:88` (identity) |
| The validator | `stepSchema.js:91` `STEP_SCHEMA`, `:145` `FRAME_SCHEMA`, `:185` who is the agent, `:205` the subjects, `:235` `forbiddenIn`, `:262` `numberTokensOf`, `:301` `heldDatesOf`, `:321` `strayNumberOf`, `:394` `validateFrame`, `:425` `validateStepTurn` (the chain walk `:435`), `:734` `replacedReplyOf` |
| The prompt | `stepPrompt.js:28` `WRITTEN_OPENING_RULES`, `:44` step system prompt, `:71` frame system prompt, `:93` what the model sees (stray tickers masked), `:106` the examine target block (Correction B), `:115` the user turn |
| The prompt budget | `promptBudget.js:12-17` (soft 12,000 / hard 16,000 tokens, 40 findings, facts cut to 200 characters), `:32` `fitPrompt` |
| The model adapter | `modelTurn.js:29` `MODELS`, `:30` output caps, `:31` effort, `:33` thinking off, `:42-47` prices, `:51` `costUsd`, `:83` `runTurn` |
| Retrieval | `retrieval.js:68` `retrieve` (one Exa search, 5 results, 8 s, the mover layer's excluded domains; never throws) |
| Adoption | `adoptPreview.js:37` `KEPT_FINDINGS_MAX` 28, `:50` `previewRevOf` (the token), `:73` `carriedFor` (Correction C), `:101` `adoptPreviewOf`, `:132` `assertAssertionsSupported`; `store.js:589` `SHARED_RESEARCH_ADAPTER`, `:618` `adoptIdea` |
| The store | `store.js`: `globalStepCeiling` `:59`, `beginFraming` `:224`, `recordFrame` `:248`, `noteFrameFailure` `:264`, `openFromItem` `:311`, `readPrevious` `:349`, `openFromFraming` `:363`, `beginStep` `:405`, `recordStep` `:446`, `failStep` `:500`, `closeInvestigation` `:542` |
| The server's lines | `copy.js:8` (every refusal's player-facing line; the pause line is the spec's own) |
| The method | `method.js:31` `METHOD` (`baseline@v0`) |
| Rules | `firestore.rules:1348` `sharedResearchSessions` (owner read, no client write), `:1354` `sharedResearchQuota` (no client access); `test/rules/sharedResearchSessions.rules.mjs` |
| The registry | `api/_utils/__fixtures__/promptHonestyRegistry.js:61` `'sharedResearch/stepPrompt.js'` (in the commit that created the module, `a11317a7`) |
| The protected-store scan | `api/_utils/compositionProtectedStoresAllowlist.json`: 19 `sharedResearch/store.js` write-site keys and `_notes_shared_research_b1` (`:574`), each transaction described for human review |

**Fenced functions called:** none. **Fenced files edited:** none.

## 3. The SDK and the probe

- **SDK:** `@anthropic-ai/sdk` 0.71.2, no bump. `output_config` (effort and the `json_schema` format) is passed through `messages.create`; the merged Huddle script on `main` sends the same body on 0.71.2, and the probe proved it live.
- **The probe (K-3, §15 S-6):** one call, `scripts/sharedResearch/probe.mjs`, with `CLAUDE_API_KEY` loaded from the parent checkout's `.env.local` into the probe process only (`node --env-file=…`). Model `claude-sonnet-5-5`, structured output accepted, `stop_reason` `end_turn`, 1 attempt, 11.3 s, **5,644 tokens in / 1,390 out, $0.025188**. The fixture `test/fixtures/sharedResearch/step.recorded.json` holds the response, usage and cost only. `stepSchema.recorded.test.js` validates it with no network: Eaton (ETN) supported with its open question, Northfield Thermal a lead, the undated item labeled " · undated".
- What the probe changed (`db7a4188`): the model wrote an inference with `unresolved` support. The build had refused that, a rule the spec does not have (rule 3 refuses only `check_receipt`, `setup` and `observation`), so it is now accepted as an unavailable inference.

## 4. `MODEL_PRICES` (K-4)

Checked against the live pricing page on Nov 12, 2026 (`PRICES_AS_OF = '2026-11-12'`, `modelTurn.js:42`).

| Model | Input $/MTok | Output $/MTok | Used for |
|---|---|---|---|
| `claude-sonnet-5-5` | 2.00 | 10.00 | the step turn (≤ 2,500 output tokens, effort low, thinking off) |
| `claude-haiku-5-5` | 0.10 | 0.50 (prompts ≤ 100K tokens) | the framing turn (≤ 600 output tokens) |

`costUsd(model, usage)` (`modelTurn.js:51`) prices every call; each call's cost goes in the shadow log and the record's turn telemetry. The only module naming a model id is `modelTurn.js`; the K-9 mutant M6 (a legacy id) is killed by six rows.

## 5. Refusal codes

| Status | Codes |
|---|---|
| 404 | `disabled` (mode off, before auth; also when the caller is not admitted), `session_not_found`, `item_not_found` |
| 400 | `invalid_request` (also a `previewRev` that is not the token, §16 FQ-7, and a requestId reused across entry kinds, SI-3), `invalid_entry`, `item_kind_unsupported`, `invalid_question`, `invalid_observation`, `invalid_direction`, `invalid_target`, `invalid_adoption` (the builder's refusal, with its reason — K-7), `unsupported_assertion`, `names_not_supported`, `no_valid_tickers`, `prompt_too_large` |
| 409 | `session_not_open`, `step_in_flight`, `budget_spent`, `preview_stale` (with the new preview — K-7), **`findings_full`** (new, review A1) |
| 429 | `daily_limit`, `framing_limit`, **`step_limit`** (new, review C1/C2), **`rate_limited`** (new, §16 FQ-8: the per-uid limiter, with `Retry-After`) |
| 503 | `budget_paused` (the app's daily ceiling, before any call), `attribution_unavailable` (§15 S-4) |
| 500 | `server_error` (with `step_failed` / `frame_failed` lines for the player) |

Every code has its player-facing line in `copy.js`; `copy.guard.test.js` runs the hub's banned list over them, plus "Shadow", "confidence" and "%".

## 6. Routine choices

The spec's own ten (§3) are built as written. The build's own:

1. **Session fields beyond §5.1:** `requestId`, `itemKey`, `entry.names`, `framingStartedAt`, `lastError`, `lastStep` (with the step's search text). Exchange ids are minted by the server and stripped from the client view.
2. **The ET date** comes from the import-free Intl helper (`api/_utils/intraday/etTime.js`); its parity with `mandateClosePass`'s ET date is pinned.
3. **A refresh whose search text equals the last completed step's runs without a retrieval** (`shared-research.js:346`): it would read the same items again.
4. **Two step counts.** Steps are counted at persistence, as D-1 says (the app's `steps`). Step calls are also counted when made, which closes review C1/C2 (failed calls were unbounded):
   - 30 calls a day per player (`STEP_CALLS_PER_DAY` = 3 × 10) → `429 step_limit`;
   - 2 × the ceiling for the app → `503 budget_paused`;
   - a step refused before its model call (an invalid target, a prompt over the cap, no time left) gives the counted call back on both days, in the same ET day only (refuter SI-2, `failStep` `refundCall`).
5. **FantasyTimes Level 2 is not built.** Level 0 only: one question per `reporterBeat`, the story as the item (§8).
6. **Stored claims:** the newest 15 `ingestedClaims` per ticker over the existing `(ticker, sourceDate desc)` index. The fact says "15 or more" when the read is full.
7. **"No next step."** When a step proposes no next action and the current one is not already the marker, the validator writes a `no_next_step` next-action finding. Since §16 NS-1 it reads exactly "No next step proposed."; a model next action that claims the question is answered is treated as none (refuter SH-s), and the step prompt keeps one place for the marker in its room line (refuter SI-5).
8. **`prompt_too_large`** is the typed 400 (§6.3), with the step marked failed and no model call. With the budget's trims (40 findings × 200 characters) no fixture reaches it.
9. **Two codes the spec's list does not name:** `step_limit` and `findings_full` (§5).
10. **The quota view** adds `stepsToday` and `stepsPerDay` to §5.3's line.
11. **The preview** marks a company over `KEPT_FINDINGS_MAX` (28: the builder's 30 refs less the record and the confirming exchange) as `adoptable: false` with `reason: 'too_many_evidence_refs'`, and carries `keptMax` (review A4).
12. **Company names** come from `peerRankings/{symbol}.name`. A statement names a company by its symbol or its core name (corporate suffixes, ".com" and "&" dropped; 1–2-letter symbols never matched as bare words).
13. **A claim's number.** A proposed claim that states a number its company's Source-backed facts do not hold is not written. This is a note, not a failed step, and the draft falls back to the relationship. First built as a tightening; §16 FQ-5 made it the letter ("routine 13 becomes the letter").
14. **`ACRONYMS`** is a copy of the Huddle list (K-5's letter); a test pins it equal to `api/_utils/huddle/scriptPrompt.js`'s.
15. **The shadow log** is awaited the `api/agent/chat.js` way: `waitUntil` when the runtime has it, else an in-request settle capped at 2 s and clamped to t0 + 29 s. Every model call is logged, failures included (review C4).
16. **Store tests** run on an atomic in-memory Firestore double (`__fixtures__/srFirestore.js`, with transaction-start and before-commit hooks). The repo's `inMemoryFirestore.js` applies transaction writes immediately. The rules run on the emulator.

## 7. Tests and checks (the first pass, at `6af8196a`; the final checks are §18)

| Check | Result |
|---|---|
| Full suite, Linux (WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, `--maxWorkers=8`, Node 20.20.2), at `6af8196a` | **exit 0 · Test Files 1,420 passed, 9 skipped (1,429) · Tests 31,100 passed, 107 skipped (31,207)** · 363 s. The 9 skipped files are the usual emulator, browser-bounds and golden-capture files. |
| The 18 new test files | 241 rows, all passed: `adoptPreview` 13, `companies` 11, `copy.guard` 3, `gate.surface` 2, `gate` 14, `modelTurn` 12, `opening` 7, `prompt.honesty` 9, `promptBudget` 4, `retrieval` 6, `reviewFixes` 28, `session` 11, `stepSchema.recorded` 5, `stepSchema` 47, `store` 31, route 27, flags 6, constants 5 |
| `npm run test:rules` (emulator, WSL, JDK 21) | exit 0 — 42 files, 764 tests passed (the new `sharedResearchSessions.rules.mjs`: 16) |
| `npm run lint:gate` (WSL, full repo) | exit 0 (`eslint . --config eslint.gate.config.js --max-warnings 0`, full repo) |
| §2.3 import-boundary ratchet | `api/_utils/archetypeRegistry.test.js` 20/20 on Linux (no new legacy-table importer). The two `src/` modules' "imports nothing" rows are green. |
| The golden guard | `hypothesisRecords/contentHash.golden.test.js` 18/18 and `sharedResearchVersion.test.js` 12/12, unedited: no idea-version hash moved |
| Census pins | `researchRecords/extension.test.js` 62/62 (S-5), `researchRecordExtension.routes.test.js` 8/8 (the marker census), `equippedHypothesisRefs.census.test.js` 38/38, `unconfirmedOutcome.census.test.js` 10/10, `flagPinGuard.test.js` 6/6, `compositionProtectedStores.scan.test.js` 9/9 |
| The minified build and bundle identity | §8 |

Windows note: on a Windows checkout a set of existing guards fails for platform reasons. Some read backslash paths (for example the archetype ratchet and the `fantasyTimesConsensus` census); others parse CRLF text (for example `agent-evaluate.evalRun`'s rules tripwire and `attest.dark`). Run batch by batch on Windows snapshots of `main` and of the branch, the branch's failing rows were a subset of `main`'s. Every row is judged on Linux, where the run above is green.

## 8. Client bundle identity (K-2) (the first pass; the final comparison is §18)

`npx vite build` in WSL, at this report's head (the pushed head) and at `main` (`c37baa0d`), each in its own worktree. The tree hash is the SHA-256 of the sorted per-file SHA-256 list of `dist/`.

| Build | Files | Tree hash |
|---|---|---|
| `main` @ `c37baa0d` | 111 | `f9fd8e4ac8af4977` |
| pushed head (this report's commit) | 111 | `f9fd8e4ac8af4977` — identical to `main`, file for file |

**One finding along the way (D1, fixed in `5e88467a`).** The first build at the code head differed from `main` only in the CSS. Tailwind v4 scans the whole project, `api/` included, and read the step and frame log prefixes as arbitrary-property classes: each prefix was a bracketed name with a colon inside. Each became one CSS rule. The prefixes now have no colon (`[shared-research] frame error: …`), and the CSS equals `main`'s again.

## 9. Mutation table (K-9) (the first pass; the final battery is §18)

Run at `6af8196a` on a snapshot tree. For each mutant: the edit applied, the targeted Shared Research tests run (`TZ=UTC`), the exit code read (never a pipe), and the file restored from its saved bytes with the SHA-256 compared. Baseline exit 0 before the battery and after it.

| Id | The defect planted | Result | Rows failed |
|---|---|---|---|
| M1 | `companiesOf` promotes a company once `stepsUsed` crosses a number (Correction A) | KILLED | 2 |
| M2 | a retrieval support with a bad index lands verified | KILLED | 1 |
| M3 | a ticker outside `ALL_TICKERS` is written to a finding's symbol | KILLED | 2 |
| M4 | `adoptIdea` writes the list as a draft | KILLED | 2 |
| M5 | the global daily ceiling is ignored (the 151st step calls the model) | KILLED | 4 |
| M6 | `MODELS.step` becomes a legacy id | KILLED | 6 |
| M7 | the route accepts a client-supplied attribution | KILLED | 1 |
| M8 | `preview_stale` skipped when `summary.rev` moved | KILLED | 1 |
| M9 | the gate checks auth before the mode (off leaks a 401) | KILLED | 2 |
| M10 | two examine steps on two companies build the same prompt (Correction B) | KILLED | 2 |
| R-B1 | the identity check dropped (a symbol borrows another company's fact) | KILLED | 2 |
| R-B2 | date parts count as held numbers again | KILLED | 3 |
| R-B4 | the model's date goes through lenient parsing | KILLED | 1 |
| R-B5 | a step may supersede the player's words | KILLED | 1 |
| R-B6 | imperative buy/sell advice passes | KILLED | 1 |
| R-A1 | a full record still makes the paid call | KILLED | 1 |
| R-A2 | an in-flight framing is re-run | KILLED | 1 |
| R-A3 | an older completed `stepId` runs a new step | KILLED | 1 |
| R-C2 | the player's daily step calls are not capped | KILLED | 1 |

**19 of 19 killed; 20 file restorations, 0 mismatches.** Two earlier mutants for B3's verified-only rule were retired with that rule (it went back to the spec's letter: FQ-5).

## 10. The review (BUILD_RULES §2) (the first pass; the second refuter pass is §17)

The branch diff is 47 files and 6,895 lines at the code head (48 files with this report), past the threshold of 10 files or 1,500 lines. Four reviewers, each on its own `git archive` snapshot of `dd792e4e`, read-only on git:

- A, record integrity;
- B, honesty;
- C, cost and gates;
- D, compatibility.

A refuter then re-ran every repro on a fifth snapshot and tried to refute each finding.

The four commits after `dd792e4e` were **not re-reviewed**:

- `8c5ed2bf`, the prices' date;
- `5e88467a`, the D1 fix;
- `6117a872`, the review fixes;
- `6af8196a`, the refuter's ruling.

They are checked by the tests, the nine review mutants above, the full suite and the bundle comparison.

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| A1 | A record one short of 100 findings still made the paid call, which then failed | CONFIRMED | Fixed: `409 findings_full` before any call (`store.js:391`); R-A1 |
| A2 | An in-flight framing was re-run by a repeated `requestId` (two paid calls) | CONFIRMED | Fixed: an in-flight framing (35 s) is not re-run; a late failure never shadows a good frame; R-A2 |
| A3 | An older completed `stepId` ran a new step (counted twice) | CONFIRMED | Fixed: any partner step exchange with that `stepId` replays (`session.js:145`); R-A3 |
| A4 | The preview offered a company no statement can save (over 28 carried) | PARTLY | Fixed: `adoptable`, `reason`, `keptMax` in the preview |
| A5 | A `requestId` reused across actions answered 200 with the framing | PARTLY | Fixed: a `requestId` names one request (`invalid_request`) |
| A6 | The saved refs can differ from the previewed set: the revision (`summary.rev`, `findings.length`, as §6.6 defines it) does not cover the lines | PARTLY | Reported, built to §6.6's definition: **FQ-7** |
| B1 | A symbol paired with another company's name borrowed its fact | PARTLY | Fixed: the named company must match the symbol's name, else no symbol (`identity_mismatch`); R-B1 |
| B2 | Date parts counted as held numbers ("5%", "11%", "2026" passed) | CONFIRMED | Fixed: only a mention of a held fact's own date is excused (`withoutHeldDates`); R-B2 |
| B3 | A number from an inference or an undisclosed figure could reach the summary or the idea | PARTLY | Fixed as verified-only, then put back to the letter (rule 6, §6.6): **FQ-5** |
| B4 | Lenient date parsing ("Nov 5" → 2001-11-05; 2026-02-30 → 03-02) | CONFIRMED | Fixed: a strict calendar day (`modelDayOf`); R-B4 |
| B5 | An inference could retire the player's observation | PARTLY | Fixed for the player's material and the story (`PROTECTED_REASONS`); R-B5. An inference over a verified fact is rule 5's letter: **FQ-4** |
| B6 | Forbidden-pattern misses and false positives | PARTLY | Fixed: the partner's name and "agents" as subjects, soft learning words, per cent, price forecasts, imperative and "is a buy" advice, NFKC with format characters stripped; "partner portal" and "Sell-side" pass; R-B6. "considered" is rule 7's bare word: **FQ-3** |
| B7 | Company names: ".com", "&", "Series C" matching C | CONFIRMED | Fixed (routine choice 12) |
| B8 | A drop's claims and a story's headline were written unscanned | PARTLY | Fixed for tickers (a claim with a stray ticker is not written; a headline's stray ticker is masked). Scanning the drop's wording: **FQ-6** |
| B9 | A colon in prose made a lead ("Switchgear lead times") | CONFIRMED | Fixed: the colon neutralizer |
| B10 | A role came from another company's fact | CONFIRMED | Fixed: the role comes from the same symbol's company |
| B11 | Nits | PARTLY | Fixed: ids with digits in a claim's evidence; the empty-step reply; the undated story label; blank drop text. Put back to the letter: a `publishedDate` later than the read is still the date (S-2): **FQ-2** |
| C1 | Failed calls were bounded only by the per-IP limiter | PARTLY | Fixed: step calls counted when made (routine choice 4); R-C2 |
| C2 | "30 Sonnet steps a day" did not hold (40 persisted by one player) | PARTLY | Fixed by the same `step_limit` |
| C3 | Work after persistence ran with no timer | PARTLY | Fixed in part: `failStep` bounded at 1.5 s, the frame's model inside the deadline, the log settle clamped, the name reads in parallel. The `recordStep` transaction itself has no timer; an overrun is recovered by the `stepId` replay |
| C4 | A paid frame whose write failed left no shadow record | PARTLY | Fixed: the record is written on that failure too |
| C5 | Duplicate of A2 | CONFIRMED | Fixed with A2 |
| C6 | The rate limiter is keyed by IP and shared by GET and POST | PARTLY | Reported (spec §6.12(6) kept the existing limiter): **FQ-8** |
| C7 | `SHARED_RESEARCH_GLOBAL_STEPS_PER_DAY=0` did not pause | CONFIRMED | Fixed: 0 pauses steps |
| C8 | Concurrent steps can overshoot the app's ceiling | PARTLY | As designed (§6.12): the check comes before the call and the count at persistence. Overshoot ≤ the steps in flight at once. No question |
| D1 | Tailwind minted CSS from the log prefixes (bundle identity) | CONFIRMED | Fixed in `5e88467a` (§8) |
| D2 | The gate's flag import was tested only mocked | CONFIRMED | Fixed: `gate.surface.test.js` imports the gate unmocked (BUILD_RULES §4) |

**Totals:** 27 lines. **12 CONFIRMED (11 distinct; C5 duplicates A2), 15 PARTLY, 0 fully refuted** (refuted sub-parts are recorded in the PARTLY lines). Every CONFIRMED finding is fixed.

**The refuter's ruling, applied (`6af8196a`).** The fix pass had built some readings stricter than the spec. Those went back to the letter, and the stricter reading became a founder question (FQ-2 to FQ-6). The one exception is B2: counting date parts was a build reading, not the letter, so its fix stays.

## 11. Founder questions (the first pass): ruled Nov 12 (spec §16)

The founder ruled all eight on Nov 12, plus NS-1; the rulings are spec §16, built as §16 below describes.

| # | Question | As first built | Ruled (spec §16) | Built at |
|---|---|---|---|---|
| FQ-1 | A completed investigation of the same item | `existing` for open or completed | Only an open one answers `existing`. Once the earlier one ended (concluded, saved, abandoned), a new one opens. The open answer and the GET carry `previous` | `store.js:311` (`openFromItem`), `:349` (`readPrevious`); `session.js:201-230`; route `:145`, `:227` |
| FQ-2 | A `publishedDate` later than the read | Used as `at` | Absent: the read time, " · undated" | `stepSchema.js:380`; the prompt hides it too (route `:350`); a story published after the open is undated (`opening.js:123`) |
| FQ-3 | "considered" | A bare forbidden word | Only with the agent, the partner's name, "I" or "we" as its subject | `stepSchema.js:205` (the subjects), `:241`; the frame check gets the partner's name (route `:181`) |
| FQ-4 | An inference over a Source-backed fact | Allowed | Only a verified or an unavailable finding supersedes a verified one | `stepSchema.js:583` (`invalid_supersedes`, detail `…:weaker`; extended by §17 FQ-10) |
| FQ-5 | Which findings back a number | Any cited or carried | Verified only. A breaking summary is withheld and the step lands. Claims follow routine 13 | `stepSchema.js:698` (summary), `:627` (claims); `adoptPreview.js:132` (statement) |
| FQ-6 | Drop claims and the forbidden patterns | Stray tickers only | Scanned; a breaking claim is not written | `opening.js:152`; the partner's name from the route (`:263`) |
| FQ-7 | The preview revision | `{ summaryRev, findingsCount }` | An opaque token over `summary.rev`, `findings.length` and the carried ids in order | `adoptPreview.js:50`; both checks in `store.js:618`; the route accepts only the token (`:460`) |
| FQ-8 | The rate limiter | The per-IP limiter | Per uid, per method, after auth (10 POST, 30 GET a minute); the IP limiter in front | `gate.js:52`, `:112` |
| NS-1 | The no-next-step marker | "No next step proposed: the question looks answered by the current findings." | Exactly "No next step proposed."; never claims the question is answered | `stepSchema.js:78`; `:660` (a model next action claiming "answered" is none) |

## 12. Files outside the task

None changed beyond those listed in §2. One thing found outside the task is filed as a question rather than fixed: FQ-14 (the player's own words may hold a ticker the universe does not hold).

## 13. The founder's steps

1. Review and merge this PR (dark: nothing changes for any player).
2. **Before the allowlist flip:**
   - `firebase deploy --only firestore:rules` (the `sharedResearchSessions` and `sharedResearchQuota` blocks);
   - deploy the `researchWork (userId, createdAt desc)` index (`firebase deploy --only firestore:indexes`; it is already in `firestore.indexes.json` from the Research Record Extension). B1 adds no index.
3. Optional on Vercel: `SHARED_RESEARCH_GLOBAL_STEPS_PER_DAY`. The default is 150; `0` pauses every step with the spec's honest pause line. `CLAUDE_API_KEY` and the Exa key are the app's existing variables.
4. B2 (the client, dark) is the next session; it builds against this spec with §15, §16 and §17 (§16.3 and §20.3 below list what it reads).
5. The allowlist flip is a separate one-line founder PR. It moves `SHARED_RESEARCH_MODE` and its pin row in `sharedResearchFlags.test.js` in the same commit.

## 14. Cleanup

The WSL trees `~/pd-ci-srb1` (the branch) and `~/pd-ci-srb1m` (`main`) and the run folder `~/pd-srb1-runs` are removed under the suite lock at the end of each session (437 MB freed after the first pass). The follow-up recreated them for its checks (376 MB freed after it); round 2 recreated them again: their removal and the space freed are in the session's closing message.

## 15. The first pass's PR description

Superseded by §19, which describes the final branch.

## 16. The follow-up: the report rulings, as built (Nov 12–13)

### 16.1 Order of work

1. `origin/main` `9ca96ff2` (#1045, #1046) merged at `7845d79e`; only `docs/README.md` overlapped.
2. Spec §16 appended in the founder's words, with a short "what B2 reads" (`3114fc33`).
3. The rulings in code, with rows (`a1c04156`, `25120126`).
4. The second refuter pass on `a1c04156` (§17); its findings fixed in `ed069990`.
5. `origin/main` `29e8f4de` (#1051, #1047) merged at `890cf292`; only `docs/README.md` overlapped.
6. Two SH-6 rows (`9e487165`, below); the final checks on that tree (§18); this report.

### 16.2 Each ruling

- **FQ-1.** Ended means `completed` (concluded, or saved as an idea) or `abandoned`; live means `open`.
  - Only a live one answers `existing`.
  - `previous` is the newest ended investigation of the same owner and item created before the answered session, never that session itself. "Newest" is the last created: an item's investigations never overlap, so the last created is the last to end, and a late write cannot reorder them (SI-1).
  - It is `{ sessionId, endedAt, terminalReason }`, with `endedAt` and `terminalReason` from that investigation's record (`concluded`, `saved_to_list` or `user_close`), or `null`.
  - It is on every story or drop `open` answer (a new one, `existing`, a replay) and on `GET ?sessionId=`.
  - In the `open` transaction it is read before any write. The GET reads it with an equality-only query (owner, item): no index.
- **FQ-2.** A `publishedDate` later than the read is treated as absent for `at` and `asOf`: the fact is dated by the read time and its label ends " · undated". The route also blanks it before the prompt, so the model never sees it as the item's date. A story published after the open is undated the same way (a tightening; FQ-2's letter covers retrieval).
- **FQ-3.** The subjects are the agent ("agent(s)", "your/my/our/research partner"), the partner's own name, "I" and "we". "Considered" counts when one of them is its subject: directly, through auxiliaries, negations, adverbs and "too" ("we have thoroughly considered", "we haven't considered"), or as the passive's agent ("considered by your agent", "by us"). "Eaton is widely considered the leader" passes.
- **FQ-4.** A verified finding is superseded only by a verified or an unavailable one. An inference fails the turn with `invalid_supersedes` (detail `…:weaker`), like the other rule-5 refusals; this includes an uncited fact the server reads as an inference.
- **FQ-5.** Only verified findings back a number:
  - **The summary.** One that states a number no verified cited finding holds is withheld (note `summary_withheld:unsupported_number:<n>`). The step's findings land; the record's answer and revisions are unchanged. The step answer says `changed.summaryWithheld: true`, and so does its replay, through `lastStep`. The shadow record carries `validationNotes`. Other summary faults still fail the turn.
  - **The idea's statement.** The carried verified findings only.
  - **Claims.** Routine 13, now the letter.
  - **The prompt** states the rule.
- **FQ-6.** Drop claims run through the forbidden patterns, the partner's own name as a subject included; a breaking claim is not written. "Your drop" still stands.
- **FQ-7.** The token is `pr1.` plus 32 hex characters of the SHA-256 over `[summary.rev, findings.length, [[symbol, that company's carried ids in order], …]]`.
  - It covers each supported company's carried ids, not only their union: a line moving between two facts the union already holds still changes it.
  - One function computes it for the GET's preview, the pre-transaction check and the in-transaction check.
  - The route accepts only a token: anything else, the old object shape included, is a 400 `invalid_request`. A different token is a 409 `preview_stale` with the new preview.
- **FQ-8.** A fixed window per (uid, method), in memory and per function instance like the IP limiter: 10 POST and 30 GET a minute. It runs after the mode, auth, admission and method answers, so 'off' still answers 404 before auth, and a caller who is not admitted gets the 404 and spends no window. Past the limit: 429 `rate_limited`, a `Retry-After` header and the server's line. The IP limiter stays in front, unchanged.
- **NS-1.** The marker reads exactly "No next step proposed." A model next action that claims the question is answered is treated as none (SH-s). The prompt no longer tells the model that a null next action means "answered".

### 16.3 What B2 reads (also spec §16)

- **`previous`**: `{ sessionId, endedAt, terminalReason }` or `null`, on story and drop `open` answers and `GET ?sessionId=`.
- **`previewRev`**: an opaque string, echoed as received.
- **A withheld summary**: `changed.summaryWithheld: true`, on the step answer and on its replay.
- **`429 rate_limited`**: from the per-uid limiter, with `Retry-After`.
- **`quota`**: unchanged in shape. `stepsToday` now counts only calls made (SI-2).

### 16.4 The recorded probe under the rulings

`test/fixtures/sharedResearch/step.recorded.json` was not re-recorded (one call only, §15 S-6). Under the §16 rules and the refuter fixes it validates exactly as before:
- `ok`, no notes;
- the summary stands, because its numbers sit in verified facts;
- the same seven findings (relationship, earnings fact, coverage and product verified; an unavailable inference; the claim; the next action).

## 17. The second refuter pass (honesty and record integrity)

The founder asked for one refuter pass over everything after `dd792e4e`. Two refuters ran it, one per lens:
- **SH, honesty;**
- **SI, record integrity.**

Each worked on its own `git archive` snapshot of `a1c04156` and was read-only on git. Each reported only what a repro it ran showed. Every finding below was then fixed with a row and a mutant (§18), or answered as a letter question (§17.3). The refuters' own repro files were also re-run against the fixed code. Their remaining red rows are three kinds:
- rows that pin a defect's intermediate state;
- the letter cases of FQ-9;
- a turn that ignores the new room line.

### 17.1 Honesty (SH): 13 CONFIRMED, 9 should-fix and 4 nits

| Id | Finding | Severity | Fixed at | Mutant |
|---|---|---|---|---|
| SH-1 | A finding with no company name kept a symbol its fact does not name ("Taiwan Semiconductor supplies chips to Apple." as NVDA), so NVIDIA became supported with a claim | should-fix | `stepSchema.js:459` (`identity_unnamed`: the fact must name the company) | SH1 |
| SH-2 | Identity accepted another company sharing one word ("Meta Materials" as META) | should-fix | `companies.js:88` `isSameCompany`: every word of the name in the stored name | SH2, R-B1 |
| SH-3 | "Considered" slipped through with curly apostrophes, adverbs, negations, "too" and "by your agent" | should-fix | `stepSchema.js:192-215`, `:241` | SH3, SH3b, F3b |
| SH-4 | A partner name with letters outside ASCII ("José", "Élodie") was no subject | nit | `stepSchema.js:192` (the name as a token with Unicode edges) | SH4 |
| SH-5 | "Considered by US regulators" read as "by us" | should-fix | `stepSchema.js:214` (case-sensitive "by me/us") | SH5 |
| SH-6 | A word starting like a month ("declined", "margin") excused a figure | should-fix | `stepSchema.js:274` (real month names only) | SH6 |
| SH-7 | An undated fact's read day excused a date in the summary | should-fix | `stepSchema.js:295` | SH7 |
| SH-8 | A date inside a verified fact's text backed a figure | should-fix | `stepSchema.js:293` (a fact's date parts are no held numbers; the date itself may be named) | SH8, R-B2 |
| SH-9 | Fullwidth and other scripts' digits, "3,75" and ".75" were invisible | nit | `stepSchema.js:251-266` (NFKC; unreadable spellings kept raw, so never held by accident) | SH9 |
| SH-10 | A retrieval title's stray ticker was written into the source label | should-fix | `stepSchema.js:364` (masked) | SH10 |
| SH-11 | A drop's topic reached the session entry unscanned | should-fix | `opening.js:51` `dropTopicOf`; route `:269` | SH11 |
| SH-12 | A fullwidth stray ticker in a drop claim was written | nit | the opening's claims are NFKC'd before the scan | SH12 |
| SH-13 | A finding id in a claim's evidence read as numbers | nit | `stepSchema.js:249` (ids are not numbers) | SH13 |

### 17.2 Record integrity (SI): 5 CONFIRMED, 1 should-fix and 4 nits

| Id | Finding | Severity | Fixed at | Mutant |
|---|---|---|---|---|
| SI-1 | `previous` could name an older investigation: a late `failStep` moved an ended session's `updatedAt` | nit | `failStep` keeps an ended session's `updatedAt` (`store.js:500`); `previous` is the last created (`session.js:207`) | SI1, SI1b |
| SI-2 | The daily step-call count spent a call on refusals that made no model call (an invalid target, `prompt_too_large`, no time left) | should-fix | `failStep` `refundCall` gives it back, on the same ET day only (`store.js:509`); route `:333`, `:373`, `:381` | SI2, SI2b |
| SI-3 | A frame with an item open's requestId answered that item's session | nit | `store.js:232` (`invalid_request`) | SI3 |
| SI-4 | A replay of a step whose summary was withheld lost `summaryWithheld` | nit | kept on `lastStep` (`store.js:471`); route `:313` | SI4 |
| SI-5 | The room line did not count the validator's own marker, so an obedient turn could fail after the paid call | nit | the room line keeps one place back (route `:359`) | SI5 |

A turn that ignores the room line still fails `findings_full` after its call; the A1 guard at 99 findings still holds.

### 17.3 The letter notes: built, reported, or asked

**Built (tightenings that fail safe):**
- the prompt hides a `publishedDate` later than the read (SH L2);
- a story published after the open is undated (SH L3);
- the prompt's next-action line no longer says "answered", and a model next action that claims it is none (SH L4, SH-s);
- the step prompt asks for no sentence about itself (SH L7);
- this report now has the §16 that spec §16 points to (SH L8);
- the allowlist notes name the new reads (SI L8).

**Reported, no change:**
- **SH L1.** The date excuse itself is the B2 reading: a sentence may date a fact by a date the fact carries.
- **SH L5.** The player's own close line, "This answered my question.", is the player's words.
- **SI L3.** FQ-5 as built is stricter than "a verified finding" alone:
  - a summary's numbers come from the findings it cites;
  - a statement's numbers come from the findings the idea carries;
  - a claim's numbers come from its own company's facts.

**Seven founder questions, none blocking** — all ruled on Nov 13 (spec §17); §20 has them as built:

| # | Question | As built | Recommendation |
|---|---|---|---|
| FQ-9 | "Agents" in business prose ("Leasing agents have considered lower rents") and a partner name that is an ordinary word ("Market") count as the agent (SH L6) | Forbidden: the subject check reads them as the agent | Narrow "agent(s)" to the possessive forms ("your/my/our agent"); keep the partner's own name |
| FQ-10 | FQ-4 reads "inference" by status (SI L1, L2): a model "inference" with unresolved support is unavailable and may supersede a verified fact, and a chain verified → unavailable → inference is allowed link by link | Allowed; the old facts stay readable as superseded | Keep. Or forbid an inference anywhere in a chain that began verified |
| FQ-11 | A withheld summary keeps its last revision even when that revision cites a finding the same step superseded (SI L4) | The letter ("keeps its last revision") | Mark that answer as resting on a corrected fact (a flag B2 shows) |
| FQ-12 | The preview token leaves out the support line (it is not carried) and company names (a name change between preview and Save is not stale; the confirm line uses the new name) (SI L5) | As §16 FQ-7's words | Keep |
| FQ-13 | The per-uid window is fixed, so a burst at its edge can pass about twice the limit; the IP limiter in front is one bucket per IP for every method and route on an instance (SI L6, L7) | As ruled | Keep. A sliding window waits for a shared store (Redis or Edge Config), as `rateLimit.js` already notes |
| FQ-14 | The player's own words (an observation, a drop's text) are quoted verbatim, so a ticker the universe does not hold can be written as "Your words" or "Your drop". The STOP list ("anywhere") meets rulebook §4 (1) ("quote them as theirs") | Quoted verbatim (§15 S-1) | Mask a stray ticker in the stored fact and the exchange alike |
| FQ-15 | The step's free-text reply is not number-checked, so a withheld summary's number can still appear there | Unchecked | Apply the summary's number rule to the reply; replace a breaking reply with the plain fallback line |

## 18. The follow-up's checks (round 1, on the merged tree `9e487165`; round 2's are §22)

| Check | Result |
|---|---|
| Full suite, Linux (WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, `--maxWorkers=8`, Node 20.20.2) | **exit 0 · Test Files 1,430 passed, 9 skipped (1,439) · Tests 31,506 passed, 99 skipped (31,605)** · 348 s, at `9e487165` (the JSON report agrees: 0 failed). The 9 skipped files are the usual emulator, browser-bounds and golden-capture files. |
| The Shared Research test files (19 with the new `refuterPass.test.js`) | 293 rows, all passed: route 39, `stepSchema` 49, `reviewFixes` 34, `store` 34, `refuterPass` 24, `gate` 18, `adoptPreview` 14, `modelTurn` 12, `companies` 11, `session` 11, `prompt.honesty` 9, `opening` 7, `retrieval` 6, flags 6, `stepSchema.recorded` 5, constants 5, `promptBudget` 4, `copy.guard` 3, `gate.surface` 2 |
| `npm run test:rules` (emulator, WSL, JDK 21) | exit 0 — 42 files, 764 tests passed (the new `sharedResearchSessions.rules.mjs`: 16) |
| `npm run lint:gate` (WSL, full repo) | exit 0 (`eslint . --config eslint.gate.config.js --max-warnings 0`, full repo) |
| Guards in the suite | the §2.3 ratchet `archetypeRegistry.test.js` 20/20; the golden guard `contentHash.golden.test.js` 18/18 and `sharedResearchVersion.test.js` 12/12 (no idea-version hash moved); `researchRecords/extension.test.js` 62/62; `researchRecordExtension.routes.test.js` 8/8; `unconfirmedOutcome.census.test.js` 10/10; `equippedHypothesisRefs.census.test.js` 38/38; `flagPinGuard.test.js` 6/6; `compositionProtectedStores.scan.test.js` 9/9 |
| The recorded probe | validates unchanged (§16.4) |
| Review threshold | 49 files, +8,135 / −1 against `main` `29e8f4de` at `9e487165` (BUILD_RULES §2: at least 10 files or 1,500 lines) |

**Client bundle identity (K-2).** `npx vite build` in WSL, at `main` `29e8f4de` and at this report's head (the pushed head), each in its own worktree; the tree hash is the SHA-256 of the sorted per-file SHA-256 list of `dist/`.

| Build | Files | Tree hash |
|---|---|---|
| `main` @ `29e8f4de` | 111 | `88a7a9dd054cb814` |
| pushed head (this report's commit) | 111 | `88a7a9dd054cb814` — identical to `main`, file for file |

**The mutation battery.** It ran at `ed069990`, on a snapshot tree. Each mutant was applied, the Shared Research test files were run (`TZ=UTC`) and judged by exit code (never a pipe), and every file was restored from its saved bytes with SHA-256 compared. The baseline exited 0 before the battery and after it. Three first-pass mutants were re-cut to the new code (M8, R-B1, R-B2); F3b replaces the first pass's bare-"considered" reading. **SH6 survived the first run:** every SH-6 row had a percent or a decimal after the number, which the date rule's own lookahead already rejects, so the month test was never reached. Two rows with a plain number were added (`9e487165`); on a re-run SH6 was killed.

| Id | The defect planted | Result | Rows failed |
|---|---|---|---|
| M1 | companiesOf promotes a company when stepsUsed crosses a number (Correction A) | KILLED | 2 |
| M2 | a retrieval support with a bad index lands verified | KILLED | 2 |
| M3 | a ticker outside ALL_TICKERS is written to a finding's symbol | KILLED | 2 |
| M4 | adoptIdea writes the list draft | KILLED | 2 |
| M5 | the global daily ceiling is ignored (the 151st step of the day calls the model) | KILLED | 4 |
| M6 | MODELS.step becomes claude-sonnet-4-6 | KILLED | 6 |
| M7 | the route accepts a client-supplied attribution | KILLED | 1 |
| M8 | preview_stale is skipped when summary.rev moved (the token ignores the revision) | KILLED | 2 |
| M9 | the gate checks auth before the mode (off leaks a 401) | KILLED | 2 |
| M10 | two examine steps on two companies build the same prompt (Correction B) | KILLED | 2 |
| R-B1 | review B1: the identity check is dropped (a symbol borrows another company's fact) | KILLED | 3 |
| R-B2 | review B2: date parts count as held numbers again | KILLED | 6 |
| R-B4 | review B4: the model's date goes through lenient parsing | KILLED | 1 |
| R-B5 | review B5: a step may supersede the player's words | KILLED | 1 |
| R-B6 | review B6: imperative buy/sell advice passes | KILLED | 1 |
| R-A1 | review A1: a full record still makes the paid call | KILLED | 1 |
| R-A2 | review A2: an in-flight framing is re-run | KILLED | 1 |
| R-A3 | review A3: an older completed stepId runs a new step | KILLED | 1 |
| R-C2 | review C1/C2: the player's daily step calls are not capped | KILLED | 1 |
| F1 | FQ-1: a completed investigation of the item answers `existing` again | KILLED | 4 |
| F1b | FQ-1: `previous` may be a later investigation (the created-before filter dropped) | KILLED | 1 |
| F2 | FQ-2: a publishedDate later than the read dates the fact | KILLED | 1 |
| F3 | FQ-3: "considered" is a bare forbidden word again | KILLED | 5 |
| F3b | FQ-3: "considered" with the agent as its subject passes | KILLED | 5 |
| F4 | FQ-4: an inference supersedes a verified finding | KILLED | 1 |
| F4b | FQ-4: an unavailable finding may not supersede a verified one | KILLED | 1 |
| F5a | FQ-5: a summary number may rest on an inference | KILLED | 4 |
| F5b | FQ-5: an unsupported summary number fails the paid step instead of being withheld | KILLED | 7 |
| F5c | FQ-5: an adoption number may rest on a carried unverified finding | KILLED | 2 |
| F5d | FQ-5: a claim number may rest on its company's unverified finding | KILLED | 1 |
| F6 | FQ-6: drop claims skip the forbidden patterns | KILLED | 2 |
| F6b | FQ-6: the route does not pass the partner's name for a drop's claims | KILLED | 1 |
| F7a | FQ-7: the token ignores the carried ids | KILLED | 2 |
| F7b | FQ-7: the token covers only the union of the carried sets | KILLED | 1 |
| F7c | FQ-7: the transaction skips its own revision check | KILLED | 1 |
| F7d | FQ-7: the route accepts a previewRev that is not the token | KILLED | 1 |
| F8a | FQ-8: no per-uid limiter | KILLED | 3 |
| F8b | FQ-8: one window for every method (GETs spend the POST allowance) | KILLED | 1 |
| F8d | FQ-8: the window never resets | KILLED | 1 |
| NS1 | NS-1: the marker claims the question looks answered | KILLED | 2 |
| SH1 | SH-1: a finding naming no company keeps a symbol its fact does not name | KILLED | 1 |
| SH2 | SH-2: identity by one shared distinctive word again | KILLED | 1 |
| SH3 | SH-3: curly apostrophes are not read as straight | KILLED | 1 |
| SH3b | SH-3: "considered by us" passes | KILLED | 2 |
| SH4 | SH-4: the partner's name is never a subject token | KILLED | 6 |
| SH5 | SH-5: "by US regulators" reads as "by us" | KILLED | 1 |
| SH6 | SH-6: a word that starts like a month is a month (killed on a re-run after two rows were added; the first run survived) | KILLED | 1 |
| SH7 | SH-7: an undated fact's read day excuses a date | KILLED | 1 |
| SH8 | SH-8: a date in a fact's text backs a figure | KILLED | 1 |
| SH9 | SH-9: an odd spelling (3,75) is read as another number | KILLED | 1 |
| SH10 | SH-10: a retrieval title's stray ticker is written | KILLED | 1 |
| SH11 | SH-11: a drop topic is kept unscanned | KILLED | 2 |
| SH12 | SH-12: drop claims are not NFKC'd (a fullwidth stray ticker slips) | KILLED | 1 |
| SH13 | SH-13: a finding id's digits are numbers | KILLED | 1 |
| SHs | SH-s (NS-1): a next action claiming the question is answered is written | KILLED | 1 |
| SI1 | SI-1: a late failStep moves an ended session's updatedAt | KILLED | 1 |
| SI1b | SI-1: `previous` sorted by the last update | KILLED | 1 |
| SI2 | SI-2: an invalid target keeps its counted call | KILLED | 1 |
| SI2b | SI-2: a call counted yesterday is refunded into today | KILLED | 1 |
| SI3 | SI-3: an item's requestId answers a framing | KILLED | 2 |
| SI4 | SI-4: the replay loses summaryWithheld | KILLED | 1 |
| SI5 | SI-5: the room line keeps no place for the marker | KILLED | 1 |
| L2 | FQ-2 in the prompt: an item published after the read shows its date | KILLED | 1 |
| L3 | FQ-2 for the story: a story published after the open keeps its future date | KILLED | 1 |

## 19. The PR description

> **Shared Research "Work an idea" — B1, the server (dark)**
>
> Builds spec `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md` §6 entire, with the founder's §15 preamble rulings, §16 report rulings (Nov 12) and §17 round-2 rulings (Nov 13), behind `SHARED_RESEARCH_MODE = 'off'` (`src/config/sharedResearchFlags.js:48`; every action and read answers `404 disabled` before auth). The client bundle equals `main`'s.
>
> **Changes (`file:line`):**
> - `api/forge/shared-research.js:479`: the one route (`GET` reads `:130`, with `previous` `:145`; `POST` `frame` `:152`, `open` `:231`, `step` `:295`, `close` `:447`, `adopt` `:457`).
> - `api/_utils/sharedResearch/`:
>   - `gate.js:94` (the gate order of §6.2, then the per-uid limiter `:112`)
>   - `store.js` (one transaction per write: `:224`–`:618`; `readPrevious` `:349`)
>   - `stepSchema.js:425` (the validator; who is the agent `:185`, the subjects `:205`, the numbers and dates `:249`–`:321`, the replaced reply `:734`)
>   - `stepPrompt.js:44`, `:71` (the prompts), `:93` (what the model sees: stray tickers masked)
>   - `modelTurn.js:29`–`:83` (`claude-sonnet-5-5` and `claude-haiku-5-5`, structured output, prices, cost)
>   - `retrieval.js:68`
>   - `companies.js:88`, `:121`, `:187` (`answerStale`), `:199`
>   - `adoptPreview.js:50` (the preview token), `:101`, `:132`
>   - `opening.js:51`, `:118`
>   - `session.js` (the previous investigation `:201`–`:230`), `promptBudget.js:32`, `copy.js:8`, `method.js:31`
> - `src/constants/sharedResearch.js` (the vocabulary; imports nothing).
> - `src/config/sharedResearchFlags.js` (the flag; imports nothing); the "intentionally ABSENT" note at `src/config/flagPinGuard.test.js:309`.
> - `docs/design/SHADOW_VOICE_RULES_V1.md`: §4 and §5 appended.
> - `api/_utils/compositionProtectedStoresAllowlist.json`: the 19 reviewed write sites, with notes.
>
> **Fenced functions called:** none. **Fenced files edited:** none.
>
> **Registry addition:** `'sharedResearch/stepPrompt.js'` in `PROMPT_CONTRIBUTING_MODULES` (`api/_utils/__fixtures__/promptHonestyRegistry.js:61`), in the commit that created the module.
>
> **Rules diff** (`firestore.rules:1348`–`:1356`): `sharedResearchSessions/{sessionId}` gets owner read (`resource.data.userId == request.auth.uid`) and `allow create, update, delete: if false`. `sharedResearchQuota/{uid}` gets `allow read, write: if false` (Admin SDK only). Proven by `test/rules/sharedResearchSessions.rules.mjs`. No new index.
>
> **Smoke branch:** none (K-11).
>
> **Checks** (on the tree merged with `main` `66781ae2`):
> - Full Linux suite: exit 0, 1,432 files passed, 10 skipped; 31,567 tests passed, 120 skipped.
> - Rules suite: exit 0, 42 files, 764 tests.
> - `lint:gate`: exit 0.
> - Bundle identical to `main`'s.
> - Mutants: 69 of 69 killed.
> - First review (four lenses with a refuter): 12 CONFIRMED (11 distinct), 15 PARTLY, 0 refuted, all CONFIRMED fixed.
> - Second refuter pass over everything after `dd792e4e` (honesty and record integrity): 18 CONFIRMED, all fixed.
> - Round 2 (spec §17, Nov 13): FQ-9, 10, 11, 14 and 15 built with rows and a mutant each; FQ-12 and FQ-13 kept as built. No third refuter pass, by the founder's instruction.
>
> Report: `docs/audits/20261112_BUILD_SHARED_RESEARCH_B1.md`. §16 and §20 have the rulings as built and what B2 reads; §21 has what to watch on the allowlist. No founder questions are open.
>
> **Founder steps before the allowlist flip:** `firebase deploy --only firestore:rules` and the `researchWork` index.
>
> Pushed, reported, stopped (BUILD_RULES §2).

## 20. Round 2: the founder's rulings FQ-9 to FQ-15, as built (Nov 13)

### 20.1 Order of work

1. `origin/main` `577f17eb` (#1052) merged at `a6a14275`; no file overlapped.
2. Spec §17 appended in the founder's words, with the scope line and what B2 reads (`aab75da7`).
3. The rulings in code, with rows (`310af3b1`), on the merged tree.
4. The checks on that tree; then `origin/main` `66781ae2` (#1053) merged at `ae9b28da` just before the push, no file overlapping but `docs/README.md`, and the final checks ran again there (§22); this report. No third refuter pass, by the founder's instruction.

### 20.2 Each ruling

- **FQ-9 — who is the agent** (`stepSchema.js:185`):
  - These count: "the agent", "your/my/our agent", the partner ("your/my/our/research partner"), its own name, "I" and "we".
  - A bare plural "agents" in business prose passes: "Leasing agents have considered lower rents", "AI agents are considered a growth driver", "The agents considered the offer".
  - Two readings stay on the strict side (§21): the possessive plural "your/my/our agents", and the partner phrases.
- **FQ-10 — a chain that began Source-backed** (`stepSchema.js:435`, `:583`). A target is guarded when it is verified, or when its chain began with a verified finding (followed back through `supersedes` across all the record's findings). A guarded target may be superseded only by a finding that is verified or unavailable and is not of kind `inference`. Anything else fails the turn with `invalid_supersedes` (`…:weaker`), like the other rule-5 refusals. So verified → unavailable → inference is refused at the last link, by status or by kind. A chain that began unverified (an inference correcting an inference) is not guarded.
- **FQ-11 — the stale answer** (`companies.js:187`, `:199`; `stepPrompt.js:130`; route `:369`):
  - `record.answerStale` is true when any `summary.basedOn` id is no longer current, and false when there is no answer.
  - While it is true, the step prompt adds: "This answer rests on a finding that has since been corrected. Revise it this step (summary), resting it on current findings."
  - The validator does not force the revision. Adoption is unchanged.
- **FQ-12 and FQ-13** — kept as built.
- **FQ-14 — what the model sees** (`stepPrompt.js:93`). Every text the frame and step prompts render goes through the mask: the observation, the question, the direction, the next action, the answer, every record fact, and the retrieved titles and highlights. The record and the exchange keep the player's words verbatim. **The scope** (spec §17): nothing the server or the model writes carries a ticker the universe does not hold; the player's quoted words are the one exception.
- **FQ-15 — the reply's numbers** (`stepSchema.js:722`, `:734`):
  - The reply's forbidden-pattern check runs first, and a hit still fails the turn.
  - Then every sentence is checked against the Source-backed facts on the record as the turn leaves it (the summary's rule, with dates excused the same way).
  - A failing reply is replaced with "This step added {n} findings. The answer was not updated." ("finding" for one; n counts this step's findings, claims and the next action included). When the same step did revise the answer, the second sentence reads "The answer was updated." (§21).
  - The step lands, and the shadow record notes `reply_replaced:unsupported_number:<n>`.

### 20.3 What B2 reads (also spec §17)

- **`record.answerStale`**: a boolean on every read projection. B2 renders it.
- **A partner exchange's text** may be the replaced reply.

### 20.4 Rows

- `rulingsRound2.test.js`: 10 rows. They cover:
  - who is the agent;
  - the guarded chain, by status and by kind;
  - `answerStale` and the prompt line;
  - the frame and step prompts' masks;
  - the replaced reply: plural, singular, kept, and "was updated".
- Three route rows:
  - a correcting step makes the GET say `answerStale`, and the next prompt asks for the revision;
  - a drop's stray ticker stays verbatim in the record and the exchange, and is absent from the prompt;
  - a replaced reply lands with its findings.

## 21. Watch on the allowlist

Things noticed in round 2. They are not founder questions; they are signals to read in the shadow log and the records once the allowlist is on.

1. **FQ-9's strict side.** "your/my/our agents" (the player's own agents, plural) and "your/my/our/research partner" still count as the agent. FQ-9's list names the singular forms. The possessive plural and the partner phrases are kept because they can only mean the player's agent. Watch forbidden-pattern step failures (`invalid_forbidden`) for false refusals.
2. **FQ-14 reaches retrieved text too.** The mask also covers item titles and highlights, so the model never sees a ticker the universe does not hold; it reads "(symbol not in the app's records)" in its place. Watch for facts that quote that placeholder.
3. **FQ-15's second sentence.** When one step both revises the answer and writes a reply with an unsupported number, the replacement says "The answer was updated." The ruling's "was not updated" would be false there. Count `reply_replaced` notes.
4. **FQ-15 and the player's own figures.** A reply that repeats a number found only in the player's words or a drop claim (neither Source-backed) is replaced too. Watch how often.
5. **FQ-11 asks; it does not force.** A stale answer stays stale until a step revises it, and the prompt asks on every step meanwhile. Watch for answers that stay stale across steps.
6. **A turn that ignores the room line** still fails `findings_full` after its paid call (SI-5's remainder).
7. **The limiters are per instance** (FQ-13, kept). Bursts spread across Vercel instances are not bounded by them; the Firestore step-call counters are the hard daily bound.
8. **The chain walk** (FQ-10) follows `supersedes` through at most the record's 100 findings, and a seen-set stops a cycle.

## 22. The final checks (round 2, on the merged tree `ae9b28da`)

| Check | Result |
|---|---|
| Full suite, Linux (WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, `--maxWorkers=8`, Node 20.20.2) | **exit 0 · Test Files 1,432 passed, 10 skipped (1,442) · Tests 31,567 passed, 120 skipped (31,687)** · 314 s, at `ae9b28da` (the JSON report agrees: 0 failed). The 10 skipped files are the usual emulator, browser-bounds and golden-capture files (#1053 added one browser file). Before the last merge, at `310af3b1`: exit 0, 1,431 files and 31,519 tests passed. |
| The Shared Research test files (20 with `rulingsRound2.test.js`) | 306 rows, all passed: route 42, `stepSchema` 49, `reviewFixes` 34, `store` 34, `refuterPass` 24, `gate` 18, `adoptPreview` 14, `modelTurn` 12, `companies` 11, `session` 11, `rulingsRound2` 10, `prompt.honesty` 9, `opening` 7, `retrieval` 6, flags 6, `stepSchema.recorded` 5, constants 5, `promptBudget` 4, `copy.guard` 3, `gate.surface` 2 |
| `npm run test:rules` (emulator, WSL, JDK 21) | exit 0 — 42 files, 764 tests passed (the new `sharedResearchSessions.rules.mjs`: 16) |
| `npm run lint:gate` (WSL, full repo) | exit 0 (`eslint . --config eslint.gate.config.js --max-warnings 0`, full repo) |
| Guards in the suite | the §2.3 ratchet `archetypeRegistry.test.js` 20/20; the golden guard `contentHash.golden.test.js` 18/18 and `sharedResearchVersion.test.js` 12/12 (no idea-version hash moved); `researchRecords/extension.test.js` 62/62; `researchRecordExtension.routes.test.js` 8/8; `unconfirmedOutcome.census.test.js` 10/10; `equippedHypothesisRefs.census.test.js` 38/38; `flagPinGuard.test.js` 6/6; `compositionProtectedStores.scan.test.js` 9/9 |
| The recorded probe | validates unchanged: `ok`, no notes (its reply passes the new number check) |
| Review threshold | 50 files, +8,585 / −1 against `main` `577f17eb` at `310af3b1` (BUILD_RULES §2: at least 10 files or 1,500 lines) |

**Client bundle identity (K-2).** `npx vite build` in WSL, at `main` `66781ae2` and at this report's head (the pushed head), each in its own worktree. The tree hash is the SHA-256 of the sorted per-file SHA-256 list of `dist/`.

| Build | Files | Tree hash |
|---|---|---|
| `main` @ `66781ae2` | 111 | `300a15d1158f2a24` |
| pushed head (this report's commit) | 111 | `300a15d1158f2a24` — identical to `main`, file for file |

**The mutation battery** ran at `310af3b1` on a snapshot tree. Each mutant was applied, the Shared Research test files were run (`TZ=UTC`) and judged by exit code, and every file was restored from its saved bytes with SHA-256 compared. The baseline exited 0 before the battery and after it. F4 and F4b were re-cut to the round-2 chain rule; R2-FQ9 to R2-FQ15 are new.

| Id | The defect planted | Result | Rows failed |
|---|---|---|---|
| M1 | companiesOf promotes a company when stepsUsed crosses a number (Correction A) | KILLED | 2 |
| M2 | a retrieval support with a bad index lands verified | KILLED | 2 |
| M3 | a ticker outside ALL_TICKERS is written to a finding's symbol | KILLED | 2 |
| M4 | adoptIdea writes the list draft | KILLED | 2 |
| M5 | the global daily ceiling is ignored (the 151st step of the day calls the model) | KILLED | 4 |
| M6 | MODELS.step becomes claude-sonnet-4-6 | KILLED | 6 |
| M7 | the route accepts a client-supplied attribution | KILLED | 1 |
| M8 | preview_stale is skipped when summary.rev moved (the token ignores the revision) | KILLED | 2 |
| M9 | the gate checks auth before the mode (off leaks a 401) | KILLED | 2 |
| M10 | two examine steps on two companies build the same prompt (Correction B) | KILLED | 2 |
| R-B1 | review B1: the identity check is dropped (a symbol borrows another company's fact) | KILLED | 3 |
| R-B2 | review B2: date parts count as held numbers again | KILLED | 6 |
| R-B4 | review B4: the model's date goes through lenient parsing | KILLED | 1 |
| R-B5 | review B5: a step may supersede the player's words | KILLED | 1 |
| R-B6 | review B6: imperative buy/sell advice passes | KILLED | 1 |
| R-A1 | review A1: a full record still makes the paid call | KILLED | 1 |
| R-A2 | review A2: an in-flight framing is re-run | KILLED | 1 |
| R-A3 | review A3: an older completed stepId runs a new step | KILLED | 1 |
| R-C2 | review C1/C2: the player's daily step calls are not capped | KILLED | 1 |
| F1 | FQ-1: a completed investigation of the item answers `existing` again | KILLED | 4 |
| F1b | FQ-1: `previous` may be a later investigation (the created-before filter dropped) | KILLED | 1 |
| F2 | FQ-2: a publishedDate later than the read dates the fact | KILLED | 1 |
| F3 | FQ-3: "considered" is a bare forbidden word again | KILLED | 6 |
| F3b | FQ-3: "considered" with the agent as its subject passes | KILLED | 6 |
| F4 | FQ-4: an inference supersedes a verified finding | KILLED | 2 |
| F4b | FQ-4: an unavailable finding may not supersede a verified one | KILLED | 2 |
| F5a | FQ-5: a summary number may rest on an inference | KILLED | 4 |
| F5b | FQ-5: an unsupported summary number fails the paid step instead of being withheld | KILLED | 7 |
| F5c | FQ-5: an adoption number may rest on a carried unverified finding | KILLED | 2 |
| F5d | FQ-5: a claim number may rest on its company's unverified finding | KILLED | 1 |
| F6 | FQ-6: drop claims skip the forbidden patterns | KILLED | 2 |
| F6b | FQ-6: the route does not pass the partner's name for a drop's claims | KILLED | 1 |
| F7a | FQ-7: the token ignores the carried ids | KILLED | 2 |
| F7b | FQ-7: the token covers only the union of the carried sets | KILLED | 1 |
| F7c | FQ-7: the transaction skips its own revision check | KILLED | 1 |
| F7d | FQ-7: the route accepts a previewRev that is not the token | KILLED | 1 |
| F8a | FQ-8: no per-uid limiter | KILLED | 3 |
| F8b | FQ-8: one window for every method (GETs spend the POST allowance) | KILLED | 1 |
| F8d | FQ-8: the window never resets | KILLED | 1 |
| NS1 | NS-1: the marker claims the question looks answered | KILLED | 2 |
| SH1 | SH-1: a finding naming no company keeps a symbol its fact does not name | KILLED | 1 |
| SH2 | SH-2: identity by one shared distinctive word again | KILLED | 1 |
| SH3 | SH-3: curly apostrophes are not read as straight | KILLED | 1 |
| SH3b | SH-3: "considered by us" passes | KILLED | 2 |
| SH4 | SH-4: the partner's name is never a subject token | KILLED | 7 |
| SH5 | SH-5: "by US regulators" reads as "by us" | KILLED | 1 |
| SH6 | SH-6: a word that starts like a month is a month | KILLED | 1 |
| SH7 | SH-7: an undated fact's read day excuses a date | KILLED | 1 |
| SH8 | SH-8: a date in a fact's text backs a figure | KILLED | 1 |
| SH9 | SH-9: an odd spelling (3,75) is read as another number | KILLED | 1 |
| SH10 | SH-10: a retrieval title's stray ticker is written | KILLED | 1 |
| SH11 | SH-11: a drop topic is kept unscanned | KILLED | 2 |
| SH12 | SH-12: drop claims are not NFKC'd (a fullwidth stray ticker slips) | KILLED | 1 |
| SH13 | SH-13: a finding id's digits are numbers | KILLED | 1 |
| SHs | SH-s (NS-1): a next action claiming the question is answered is written | KILLED | 1 |
| SI1 | SI-1: a late failStep moves an ended session's updatedAt | KILLED | 1 |
| SI1b | SI-1: `previous` sorted by the last update | KILLED | 1 |
| SI2 | SI-2: an invalid target keeps its counted call | KILLED | 1 |
| SI2b | SI-2: a call counted yesterday is refunded into today | KILLED | 1 |
| SI3 | SI-3: an item's requestId answers a framing | KILLED | 2 |
| SI4 | SI-4: the replay loses summaryWithheld | KILLED | 1 |
| SI5 | SI-5: the room line keeps no place for the marker | KILLED | 1 |
| L2 | FQ-2 in the prompt: an item published after the read shows its date | KILLED | 1 |
| L3 | FQ-2 for the story: a story published after the open keeps its future date | KILLED | 1 |
| R2-FQ9 | FQ-9: a bare plural "agents" is the agent again | KILLED | 4 |
| R2-FQ10 | FQ-10: only a verified target is guarded (an inference supersedes a chain's unavailable head) | KILLED | 1 |
| R2-FQ11 | FQ-11: the projection never says the answer is stale | KILLED | 2 |
| R2-FQ14 | FQ-14: the prompts show a stray ticker from the player's words | KILLED | 3 |
| R2-FQ15 | FQ-15: a reply with an unsupported number is kept | KILLED | 3 |
