# Build report — Shared Research "Work an idea" B1, the server (dark)

**Date:** Nov 12, 2026 · **Session:** local Claude Code (Opus 5.5), own worktree · **Branch:** `claude/shared-research-b1`
**Spec:** `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md` (V1.2), committed verbatim as the branch's first commit, plus §15 (the founder's B1 preamble rulings, Nov 12)
**Base:** `origin/main` @ `c37baa0d1cad220d37a41dae312e3d212ff27d4c` (fetched first, and fetched again before the final checks: unchanged; `ba22a52f` is an ancestor)
**Spec commit:** `78fa99409417f0b679e521538cb26c77067e14e8` (the spec byte for byte, SHA-256 `19da9b97d3f6092e9630a11ae36537edd7d33686f4ef17e97f700d0e7cea3a9a`, LF, plus its `docs/README.md` row) · **§15 commit:** `b335cbd5`
**Code head:** `6af8196a8d70b6971a1979b59ab3fcfff8b62063` · this report and its README row are the one commit on top (docs only)

## Verdict

| | |
|---|---|
| What was built | Spec §6 entire: one route `api/forge/shared-research.js` (GET reads; POST `frame`, `open`, `step`, `close`, `adopt`), the `api/_utils/sharedResearch/` modules, the dark flag and the shared vocabulary in `src/`, the rulebook §4–5, the `firestore.rules` blocks and their emulator test, the §6.11 tests and the §6.12 cost controls. |
| Is it dark? | Yes. `SHARED_RESEARCH_MODE = 'off'`; every action and read answers `404 disabled` before auth. Nothing in the app imports the two new `src/` modules: the minified client bundle equals `main`'s, file for file (§8). |
| Founder rulings | §15 S-1 to S-6 built as ruled; the one probe ran (one call, `claude-sonnet-5-5`, structured output accepted). |
| Tests | Full Linux suite at the code head: exit 0 — **1,420 files passed, 9 skipped (1,429); 31,100 tests passed, 107 skipped (31,207)**. The 18 new test files: 241 rows, all green. Rules suite (emulator): exit 0 — 42 files, 764 tests passed (the new `sharedResearchSessions.rules.mjs`: 16). `lint:gate`: exit 0 (`eslint . --config eslint.gate.config.js --max-warnings 0`, full repo). |
| Mutations | **19 of 19 killed** at the code head (the ten K-9 mutants and nine for the review's fixes); every file restored byte for byte (SHA-256 checked). |
| Review | Four lenses and a refuter (BUILD_RULES §2; the diff crosses the threshold): 27 finding lines — **12 CONFIRMED (11 distinct), 15 PARTLY, 0 refuted**. All CONFIRMED fixed; the PARTLY ones fixed or filed as founder questions. |
| Open for the founder | Eight founder questions (§11), none blocking the dark merge. Before the allowlist flip: deploy the rules and the `researchWork` index (§13). |
| STOP list | Nothing on it was done: no fence contact, no `src/components/**` edit, no golden or idea-version hash moved, no client-supplied origin/ref/finding/summary/kept ids/attribution accepted, no ticker outside the universe written, emulator only, one provider call (the probe), no legacy model id, no new index, no module-scope flag read. |

## 1. Preamble, anchors and the STOP

- `git fetch origin` first; branch cut from `origin/main` @ `c37baa0d`. Spec copied byte for byte (`cmp` against the attachment), LF, 0 CR.
- The F1–F14 anchors were re-verified at `c37baa0d` (one Explore pass, every cited line read). Result: F1, F3, F5–F9, F12–F14 OK; F2 and F10 line drift only (the builder spans `hypothesisRecords/model.js:397-432`; `STATE_REASONS` lives in `src/constants/hypothesisRecords.js:52-82`; `isCockpitOwnerAllowlisted` is in `callRecords/mode.js:73`; `sendHypothesisError` in `hypothesisRecords/http.js:100`); F11 the hub grew (`HUB_SHEETS` has `huddle`; the mount guard's terminals moved) — B2's territory, untouched here. **F4 differed in shape.**
- Preamble STOP (Nov 12): six items where the repo's shape differed from the spec (the drop has no `claims[]`; a finding's `at` cannot be null; `recordId` is capped at 256; the attribution agent has no uid-to-agent resolver; the `symbolKeys` census; the probe's key). The founder ruled all six (§15, appended to the spec on this branch in `b335cbd5` so B2 builds against them).

### §15 as built

| Ruling | Built at |
|---|---|
| **S-1** `parse.dataPoints` are the drop's claims (inference, `from_drop`); "Your drop" is the text, the url + note, or the note / "An image you dropped"; `extractedText` never the player's words; `impliedTickers` never names in scope | `api/_utils/sharedResearch/opening.js:62` (`dropTextOf`), `:49` (`namesInScopeOf`, `validation.validated` only), `:108` (`openingFindingsOf`) |
| **S-2** a retrieval fact's `at` = the model's day if it is a real instant not after the read, else `publishedDate`, else the read time with " · undated" (label ≤ 120); `asOf` = `publishedDate` if before the write, else null | `api/_utils/sharedResearch/stepSchema.js:274` (`modelDayOf`, strict `YYYY-MM-DD`), `:287` (`retrievalLabelOf`), `:301` (`retrievalDatesOf`); rows (a) and (b) in `stepSchema.test.js` and `reviewFixes.test.js` |
| **S-3** `recordId` = the url when ≤ 256, else `url-sha256:` + hex | `stepSchema.js:282` (`retrievalRecordIdOf`) |
| **S-4** the stamp's agent = the owner's ranked agent by `resolveRankedAgent`'s rule (3-line copy + parity test); none → `503 attribution_unavailable`, nothing written; the partner's name in both prompts from that document | `store.js:87` (`rankedAgentOfDocs`), `:94`, `:99` (`partnerNameOf`), `:102` (`attributionOf`); re-read inside the `open` transaction; parity row in `store.test.js` |
| **S-5** no `symbolKeys` in the projection; `extension.test.js` untouched | `companies.js:167` (`projectionOf`); `researchRecords/extension.test.js` green, unedited |
| **S-6** the probe with `CLAUDE_API_KEY` from the parent checkout's `.env.local`, loaded into the probe process only; `modelTurn.js` reads `CLAUDE_API_KEY` | `modelTurn.js:62`; `scripts/sharedResearch/probe.mjs`; the key was never printed, copied or committed |

**S1 outcome (rulebook coordination, spec §6.8).** `docs/design/SHADOW_VOICE_RULES_V1.md` is on `main` (Huddle S1 #1032 and S1.1 #1040 merged). B1 appended §4 "Written openings (Shared Research)" and §5 "Baseline method v0" (34 lines added, 0 removed; §1–3 untouched). `method.js`'s `METHOD.text` equals §5 byte for byte, and the prompt's written-opening rules equal §4's lines; `prompt.honesty.test.js` pins both against the file.

## 2. What was built (`file:line`)

| Area | Where |
|---|---|
| The dark flag | `src/config/sharedResearchFlags.js:18` `SHARED_RESEARCH_MODES`, `:48` `SHARED_RESEARCH_MODE = 'off'` (imports nothing; "Pinned by" comment); pin test `src/config/sharedResearchFlags.test.js`; the "intentionally ABSENT" note at `src/config/flagPinGuard.test.js:309` |
| The shared vocabulary | `src/constants/sharedResearch.js` (imports nothing): entry kinds `:16-18`, beat questions `:26-36`, step intents `:39`, budgets `:45-62`, horizons `:66-74`, roles `:78-80`, unresolved reasons `:82`, labels `:84-121` |
| The route | `api/forge/shared-research.js`: `config.maxDuration` 30 `:47`; deadlines `:50-56`; the shadow log `:66`; `handleGet` `:129`, `handleFrame` `:150`, `handleOpen` `:228`, `handleStep` `:290`, `handleClose` `:431`, `handleAdopt` `:441`, `handler` `:463` |
| The gate | `api/_utils/sharedResearch/gate.js`: `sharedResearchMode` `:37` (read at call time), `sharedResearchOnFor` `:47` (the mode AND idea-record admission), `gateSharedResearchRoute` `:62` (no-store → off 404 → auth → admission 404 → method), `sendSharedResearchError` `:94` |
| The host session | `session.js`: shapes `:89`, `:107`; step admission `:145`; daily counts `:167-190`; `isFramingInFlight` `:192`; the client view without exchange ids `:206` |
| The opening | `opening.js:108` (the story as reporter content, the player's words, the drop and its claims, the stored facts per name, the next action) |
| Companies | `companies.js:100` `companiesOf` (supported only with a current verified relationship carrying the symbol — Correction A), `:167` `projectionOf` |
| The validator | `stepSchema.js:88` `STEP_SCHEMA`, `:142` `FRAME_SCHEMA`, `:203` `forbiddenIn`, `:247` `strayNumberOf`, `:314` `validateFrame`, `:345` `validateStepTurn` |
| The prompt | `stepPrompt.js:28` `WRITTEN_OPENING_RULES`, `:44` step system prompt, `:71` frame system prompt, `:98` the examine target block (Correction B), `:107` the user turn |
| The prompt budget | `promptBudget.js:12-17` (soft 12,000 / hard 16,000 tokens, 40 findings, facts cut to 200 characters), `:32` `fitPrompt` |
| The model adapter | `modelTurn.js:29` `MODELS`, `:30` output caps, `:31` effort, `:33` thinking off, `:42-47` prices, `:51` `costUsd`, `:83` `runTurn` |
| Retrieval | `retrieval.js:68` `retrieve` (one Exa search, 5 results, 8 s, the mover layer's excluded domains; never throws) |
| Adoption | `adoptPreview.js:29` `KEPT_FINDINGS_MAX` 28, `:49` `carriedFor` (Correction C), `:77` `adoptPreviewOf`, `:108` `assertAssertionsSupported`; `store.js:543` `SHARED_RESEARCH_ADAPTER`, `:571` `adoptIdea` |
| The store | `store.js`: `globalStepCeiling` `:58`, `beginFraming` `:223`, `recordFrame` `:245`, `noteFrameFailure` `:261`, `openFromItem` `:305`, `openFromFraming` `:336`, `beginStep` `:378`, `recordStep` `:419`, `failStep` `:465`, `closeInvestigation` `:496` |
| The server's lines | `copy.js:8` (every refusal's player-facing line; the pause line is the spec's own) |
| The method | `method.js:31` `METHOD` (`baseline@v0`) |
| Rules | `firestore.rules:1348` `sharedResearchSessions` (owner read, no client write), `:1354` `sharedResearchQuota` (no client access); `test/rules/sharedResearchSessions.rules.mjs` |
| The registry | `api/_utils/__fixtures__/promptHonestyRegistry.js:61` `'sharedResearch/stepPrompt.js'` (in the commit that created the module, `a11317a7`) |
| The protected-store scan | `api/_utils/compositionProtectedStoresAllowlist.json`: 18 `sharedResearch/store.js` write-site keys and `_notes_shared_research_b1` (`:573`), each transaction described for human review |

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
| 400 | `invalid_request`, `invalid_entry`, `item_kind_unsupported`, `invalid_question`, `invalid_observation`, `invalid_direction`, `invalid_target`, `invalid_adoption` (the builder's refusal, with its reason — K-7), `unsupported_assertion`, `names_not_supported`, `no_valid_tickers`, `prompt_too_large` |
| 409 | `session_not_open`, `step_in_flight`, `budget_spent`, `preview_stale` (with the new preview — K-7), **`findings_full`** (new, review A1) |
| 429 | `daily_limit`, `framing_limit`, **`step_limit`** (new, review C1/C2) |
| 503 | `budget_paused` (the app's daily ceiling, before any call), `attribution_unavailable` (§15 S-4) |
| 500 | `server_error` (with `step_failed` / `frame_failed` lines for the player) |

Every code has its player-facing line in `copy.js`; `copy.guard.test.js` runs the hub's banned list over them, plus "Shadow", "confidence" and "%".

## 6. Routine choices

The spec's own ten (§3) are built as written. The build's own:

1. **Session fields beyond §5.1:** `requestId`, `itemKey`, `entry.names`, `framingStartedAt`, `lastError`, `lastStep` (with the step's search text). Exchange ids are minted by the server and stripped from the client view.
2. **The ET date** comes from the import-free Intl helper (`api/_utils/intraday/etTime.js`); its parity with `mandateClosePass`'s ET date is pinned.
3. **A refresh whose search text equals the last completed step's runs without a retrieval** (`shared-research.js:339`): it would read the same items again.
4. **Two step counts.** Steps are counted at persistence, as D-1 says (the app's `steps`). Step calls are also counted when made, which closes review C1/C2 (failed calls were unbounded):
   - 30 calls a day per player (`STEP_CALLS_PER_DAY` = 3 × 10) → `429 step_limit`;
   - 2 × the ceiling for the app → `503 budget_paused`.
5. **FantasyTimes Level 2 is not built.** Level 0 only: one question per `reporterBeat`, the story as the item (§8).
6. **Stored claims:** the newest 15 `ingestedClaims` per ticker over the existing `(ticker, sourceDate desc)` index. The fact says "15 or more" when the read is full.
7. **"No next step."** When a step proposes no next action and the current one is not already the marker, the validator writes a `no_next_step` next-action finding ("No next step proposed: the question looks answered by the current findings.").
8. **`prompt_too_large`** is the typed 400 (§6.3), with the step marked failed and no model call. With the budget's trims (40 findings × 200 characters) no fixture reaches it.
9. **Two codes the spec's list does not name:** `step_limit` and `findings_full` (§5).
10. **The quota view** adds `stepsToday` and `stepsPerDay` to §5.3's line.
11. **The preview** marks a company over `KEPT_FINDINGS_MAX` (28: the builder's 30 refs less the record and the confirming exchange) as `adoptable: false` with `reason: 'too_many_evidence_refs'`, and carries `keptMax` (review A4).
12. **Company names** come from `peerRankings/{symbol}.name`. A statement names a company by its symbol or its core name (corporate suffixes, ".com" and "&" dropped; 1–2-letter symbols never matched as bare words).
13. **A claim's number (a tightening).** A proposed claim that states a number its company's Source-backed facts do not hold is not written. This is a note, not a failed step, and the draft falls back to the relationship. The spec has no number rule for claims. Withholding is the fail-safe direction, so it ships (the letter-over-reading rule lets tightenings ship) and is listed with FQ-5.
14. **`ACRONYMS`** is a copy of the Huddle list (K-5's letter); a test pins it equal to `api/_utils/huddle/scriptPrompt.js`'s.
15. **The shadow log** is awaited the `api/agent/chat.js` way: `waitUntil` when the runtime has it, else an in-request settle capped at 2 s and clamped to t0 + 29 s. Every model call is logged, failures included (review C4).
16. **Store tests** run on an atomic in-memory Firestore double (`__fixtures__/srFirestore.js`, with transaction-start and before-commit hooks). The repo's `inMemoryFirestore.js` applies transaction writes immediately. The rules run on the emulator.

## 7. Tests and checks

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

## 8. Client bundle identity (K-2)

`npx vite build` in WSL, at this report's head (the pushed head) and at `main` (`c37baa0d`), each in its own worktree. The tree hash is the SHA-256 of the sorted per-file SHA-256 list of `dist/`.

| Build | Files | Tree hash |
|---|---|---|
| `main` @ `c37baa0d` | 111 | `f9fd8e4ac8af4977` |
| pushed head (this report's commit) | 111 | `f9fd8e4ac8af4977` — identical to `main`, file for file |

**One finding along the way (D1, fixed in `5e88467a`).** The first build at the code head differed from `main` only in the CSS. Tailwind v4 scans the whole project, `api/` included, and read the step and frame log prefixes as arbitrary-property classes: each prefix was a bracketed name with a colon inside. Each became one CSS rule. The prefixes now have no colon (`[shared-research] frame error: …`), and the CSS equals `main`'s again.

## 9. Mutation table (K-9)

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

## 10. The review (BUILD_RULES §2)

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

## 11. Founder questions

None blocks the dark merge. Each has a recommendation, and each changes one rule.

| # | Question | As built (the letter) | Recommendation |
|---|---|---|---|
| FQ-1 | The spec disagrees on a completed investigation of the same item. §4 and §6.3: an open **or completed** one answers `existing`. §12: "after the first concluded — allowed". | `existing` for open or completed; an abandoned one allows a new one (`store.js:316`; pinned in `store.test.js`) | §12 (allow a new one after a conclusion). The change: filter on `open` only |
| FQ-2 | A source's `publishedDate` later than the read time | Used as the fact's `at` (S-2's letter: only the model's `at` is ignored when later) | Treat it as absent (fall back to the read time, " · undated"): a future date dates nothing |
| FQ-3 | "considered" | A bare forbidden word (rule 7), so honest prose like "widely considered the leader" fails the step | Forbid it only about the agent, the partner, "I" or "we" |
| FQ-4 | May an inference supersede a Source-backed fact? | Yes (rule 5); the old fact stays readable as superseded | No: a verified fact can be corrected only by another sourced fact, or marked unresolved |
| FQ-5 | Which findings may back a number in the answer or the idea? | Any cited (summary) or carried (idea) finding, inferences and undisclosed figures included (rule 6, §6.6) | Source-backed only. Note routine choice 13: claims already use this rule, as a tightening |
| FQ-6 | Should a drop's parsed claims be scanned for the forbidden patterns? | Only for stray tickers (the STOP list); the wording is quoted as the drop's, "From your drop" | Scan them; a claim that breaks a pattern is not written |
| FQ-7 | Should the preview revision cover the lines? | It is `summary.rev` + `findings.length` (§6.6). A step that adds no finding but moves the complication or missing line changes the carried set with no `preview_stale` | Add the carried ids to the revision |
| FQ-8 | The rate limiter | The existing per-IP limiter (§6.12(6)), shared by GET and POST (30 GET / 10 POST a minute) | Key it by uid, per method. The spec calls it "per-user" |

## 12. Files outside the task

None changed beyond those listed in §2, and nothing found outside the task needs separate tasking.

## 13. The founder's steps

1. Review and merge this PR (dark: nothing changes for any player).
2. **Before the allowlist flip:**
   - `firebase deploy --only firestore:rules` (the `sharedResearchSessions` and `sharedResearchQuota` blocks);
   - deploy the `researchWork (userId, createdAt desc)` index (`firebase deploy --only firestore:indexes`; it is already in `firestore.indexes.json` from the Research Record Extension). B1 adds no index.
3. Optional on Vercel: `SHARED_RESEARCH_GLOBAL_STEPS_PER_DAY`. The default is 150; `0` pauses every step with the spec's honest pause line. `CLAUDE_API_KEY` and the Exa key are the app's existing variables.
4. B2 (the client, dark) is the next session; it builds against this spec with §15.
5. The allowlist flip is a separate one-line founder PR. It moves `SHARED_RESEARCH_MODE` and its pin row in `sharedResearchFlags.test.js` in the same commit.

## 14. Cleanup

The WSL trees `~/pd-ci-srb1` (the branch) and `~/pd-ci-srb1m` (`main`) and the run folder `~/pd-srb1-runs` are removed under the suite lock at the end of the session. The space freed is reported in the session's closing message.

## 15. The PR description

> **Shared Research "Work an idea" — B1, the server (dark)**
>
> Builds spec `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md` §6 entire, with the founder's §15 rulings (Nov 12), behind `SHARED_RESEARCH_MODE = 'off'` (`src/config/sharedResearchFlags.js:48`; every action and read answers `404 disabled` before auth). The client bundle equals `main`'s.
>
> **Changes (`file:line`):**
> - `api/forge/shared-research.js:463`: the one route (`GET` reads; `POST` `frame` `:150`, `open` `:228`, `step` `:290`, `close` `:431`, `adopt` `:441`).
> - `api/_utils/sharedResearch/`:
>   - `gate.js:62` (the gate order of §6.2)
>   - `store.js` (one transaction per write: `:223`–`:571`)
>   - `stepSchema.js:345` (the validator)
>   - `stepPrompt.js:44`, `:71` (the prompts)
>   - `modelTurn.js:29`–`:83` (`claude-sonnet-5-5` and `claude-haiku-5-5`, structured output, prices, cost)
>   - `retrieval.js:68`
>   - `companies.js:100`, `:167`
>   - `adoptPreview.js:77`, `:108`
>   - `opening.js:108`
>   - `session.js`, `promptBudget.js:32`, `copy.js:8`, `method.js:31`
> - `src/constants/sharedResearch.js` (the vocabulary; imports nothing).
> - `src/config/sharedResearchFlags.js` (the flag; imports nothing); the "intentionally ABSENT" note at `src/config/flagPinGuard.test.js:309`.
> - `docs/design/SHADOW_VOICE_RULES_V1.md`: §4 and §5 appended.
> - `api/_utils/compositionProtectedStoresAllowlist.json`: the 18 reviewed write sites, with notes.
>
> **Fenced functions called:** none. **Fenced files edited:** none.
>
> **Registry addition:** `'sharedResearch/stepPrompt.js'` in `PROMPT_CONTRIBUTING_MODULES` (`api/_utils/__fixtures__/promptHonestyRegistry.js:61`), in the commit that created the module.
>
> **Rules diff** (`firestore.rules:1348`–`:1356`): `sharedResearchSessions/{sessionId}` gets owner read (`resource.data.userId == request.auth.uid`) and `allow create, update, delete: if false`. `sharedResearchQuota/{uid}` gets `allow read, write: if false` (Admin SDK only). Proven by `test/rules/sharedResearchSessions.rules.mjs`. No new index.
>
> **Smoke branch:** none (K-11).
>
> **Checks:**
> - Full Linux suite exit 0: 1,420 files passed, 9 skipped; 31,100 tests passed, 107 skipped.
> - Rules suite: exit 0 — 42 files, 764 tests passed (the new `sharedResearchSessions.rules.mjs`: 16).
> - `lint:gate`: exit 0 (`eslint . --config eslint.gate.config.js --max-warnings 0`, full repo).
> - Bundle identical to `main`.
> - 19/19 mutants killed.
> - Four-lens review with a refuter: 12 CONFIRMED (11 distinct), 15 PARTLY, 0 refuted. All CONFIRMED fixed.
>
> Report: `docs/audits/20261112_BUILD_SHARED_RESEARCH_B1.md` (eight founder questions, none blocking).
>
> **Founder steps before the allowlist flip:** `firebase deploy --only firestore:rules` and the `researchWork` index.
>
> Pushed, reported, stopped (BUILD_RULES §2).
