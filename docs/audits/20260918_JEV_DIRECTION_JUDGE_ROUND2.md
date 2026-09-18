# Measurement — Jev as a directive judge, round 2: the hard cases

**In plain terms (for the founder).** Round 2 set the three exams round 1 could not. **Close wrong filings:** each of the 92 clean asks was paired with the wrong menu item most easily confused with the right one. Jev caught 91 of the 92 pairs, on all three repeats (98.9%). **Gemma's real wrong filings:** across the eight saved harness runs Gemma filed the wrong item five times, which is four distinct mistakes. Jev caught three of the four. **The one it missed is the same case in both exams, and it is the mistake Gemma makes most often:** the Capital Preserver ask *"give names more rope through the chop, don't bail just because of a rough stretch"*, filed as CP-04 "Widen the stop slightly" where the corpus expects CP-03 "Hold longer through noise". Jev scored that filing 0.84–0.88 and itself named CP-04 as the best item. Haiku made the same call. So Gemma (twice), Jev and Haiku all read that ask as CP-04, which is a note about the label and not a changed score. **Did `pick` rescue what `noul` missed?** Yes, everywhere except that one case. On its probability alone Jev would have let 13 of 276 near-neighbour judgments through, including round 1's DV-02 → DV-07 miss (0.70–0.71 again). Comparing Jev's own best-item pick with the filed id caught 10 of those 13, and it raised no false alarm on any of the 92 correct filings. **As a classifier,** shown no filing, Jev classed all 36 out-of-character asks out (108 of 108 judgments) and none of the 92 in-character asks out (0 of 276), identically on every repeat. Gemma, in the same eight runs, classed out-of-character asks out 99.3% of the time but also classed 6.6% of in-character asks out (3.3% to 8.8% per run), nearly always as `user_lever`; those are its false refusals. Gemma was answering inside a full chat prompt and writing a reply in the same call; the judges were asked one narrow question. **What stays unproven:** B has four distinct cases, under the five its bar needs to bind, and on those four Jev's 75% is below the 80% it would have had to meet.

## Executive verdict

| | |
|---|---|
| **Verdict** | **PASS, B UNPROVEN** — every binding row of the frozen table is met. Row B has n = 4 distinct cases (< 5), so by the frozen rule it does not bind. **On those 4 cases B read 75.0% (9/12), below its 80% bar.** |
| Cut-off | `filing_matches_ask` < **0.50** = flagged, carried from round 1. Not tuned, not moved. Every case is reported; there is no odd/even split. |
| Primary signal | `either` (`noul` or `pick`). The bars bind on it. `noul` and `pick` are reported beside it. |
| Model snapshot | `typesafe/jev-1.13-20260917` on the probe and on all 783 Jev records: **the same snapshot as round 1.** |
| Spend | **$0.563** for the run (Jev $0.0535, Haiku judgments $0.4536, Haiku near-neighbour calls $0.0564) plus ≈ $0.002 for the probe. Cap was $5. No abort, no 429 exhaustion, no 5xx. |
| Calls | Jev 783 / 783 succeeded. Haiku 261 / 261 succeeded, 0 parse failures. Near-neighbour builder 91 / 91 on the first attempt. |
| Harness runs made this session | **None.** Eight usable run files were already on disk (6 fit-off, 2 fit-on), which meets the target of two and two. |
| Product files touched | None. `git diff --stat` is the script, its test and this report. |
| Decisions and deviations | 11, each enumerated with its reason (§9). None silent. |

This report measures. It does not recommend adoption.

### The frozen table, filled

Jev = 3 judgments per case; Haiku = 1. Rates are per judgment, as in round 1. A failed call is never credited (there were none).

| Row | Bar (`either`, Jev) | Jev `either` | Jev `noul` | Jev `pick` | Haiku `either` | n |
|---|---|---|---|---|---|---|
| A — correct filings flagged, overall | ≤ 5% | **0.0%** (0/276) | 0.0% (0/276) | 0.0% (0/276) | 0.0% (0/92) | 92 asks |
| A — worst archetype | ≤ 10% | **0.0%** (every archetype) | 0.0% | 0.0% | 0.0% | 6 archetypes |
| N — near-neighbour wrong filing caught | ≥ 85% | **98.9%** (273/276) | 95.3% (263/276) | 98.9% (273/276) | 98.9% (91/92) | 92 cases |
| B — Gemma's real wrong filings caught | ≥ 80%, **binding only if n ≥ 5** | **75.0%** (9/12) — *not binding, n = 4* | 58.3% (7/12) | 75.0% (9/12) | 75.0% (3/4) | **4 cases** |
| G-out — out-of-character asks classed out | ≥ 90% | **100%** (108/108) | — | — | 100% (36/36) | 36 items |
| G-in — in-character asks classed out | ≤ 5% | **0.0%** (0/276) | — | — | 0.0% (0/92) | 92 items |
| 3-repeat agreement on the flagged / classed verdict | ≥ 98% | **100%** (261/261 cases) | — | — | n/a | 261 cases |

Haiku's other two signals: N `noul` 92.4% (85/92), `pick` 98.9% (91/92); B `noul` 50.0% (2/4), `pick` 75.0% (3/4); A `noul` 0/92, `pick` 0/92.

---

## 1. Session and step-0 gate

**Session:** Claude Code (Fable), fresh session, local, on the founder's Windows checkout. Read-only on the product. `git fetch origin` run first (BUILD_RULES §3). **Branch:** `claude/phase0-jev-direction-judge-r2`, cut from `origin/main`. **HEAD at cut:** `7304cfd1c3295c3c3e86b854f8fb142a8ad674ed` (merge of PR #864). Local `main` was level with `origin/main`.

**Markers:** VERIFIED = read at that line, at this HEAD, in this session.

| # | Gate line | Result |
|---|---|---|
| 1 | This is the local checkout: key readable, run files and round-1 records reachable | **Pass.** `.env.local` exists and carries an `OPENROUTER_API_KEY=` line (checked by name; the value was never printed). `api/scripts/archetype-integrity-eval/runs/` holds 8 files; `scripts/output/jev-direction-judge/` holds round 1's `records.jsonl` (836 lines), `summary.json`, both probe files and `run.log`. The probe returned HTTP 200, so the key and egress both work. |
| 2 | Branch cut as named; HEAD recorded; untracked files left alone | **Pass.** Three untracked files were already present and were not touched: `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json`, `vwap-exit-dating-census-report.json`. |
| 3 | The four named files are on `main` | **Pass.** `git cat-file -e origin/main:<path>` succeeds for `docs/audits/20260918_JEV_DIRECTION_JUDGE_EXPERIMENT.md`, `scripts/experiments/jevDirectionJudge.js`, `docs/audits/20260918_BUILD_EVAL_HARNESS_RUN_RECORDS.md` and `api/scripts/archetype-integrity-eval/runFile.mjs`. |
| 4 | A harness run writes nothing to Firestore or any production store | **Pass.** Details below. |
| 5 | The run-record fields, against `runFile.mjs` | **Pass.** Details below. |
| 6 | `aggregate.js`'s own definitions of a wrong id and a false refusal; whether `selectedId` is populated on a turn that did not commit | **Recorded. `selectedId` IS populated on non-committed turns.** Details below. |
| 7 | Round-1 raw per-case records | **Present.** Set A: 368 records (276 Jev, 92 Haiku), every one `ok`. No regeneration needed. |
| 8 | One probe call; the returned model string | **`typesafe/jev-1.13-20260917`** — identical to round 1. §2. |

**Finding 4 — no production write.** The harness's only writes are local files: `writeFileSync` of `last-run-report.json` (`runEval.eval.mjs:305-308` VERIFIED) and `mkdirSync` + `writeFileSync` of the run file (`:316`, `:321-324` VERIFIED). A search of the harness directory for `firebase`, `firestore` and `fetch(` finds nothing else. It imports `voiceLayerPrompt.js`, `gemmaClient.js`, `directiveGate.js`, `directiveIdentity.js`, `corpus.js` and `aggregate.js` (`:59-64` VERIFIED) and never imports `api/agent/chat.js`, which is where a gated turn is persisted. `gemmaClient.js:32-34` (VERIFIED) states `callGemmaVoice` "never touch[es] Firestore … pure HTTP helpers". `directiveGate.js` imports five modules (`:21-40` VERIFIED), none of them a database client; its two mentions of Firestore are comments about the caller (`:45`, `:189`). OBSERVE is forced by `vi.mock` (`:53-57`). README `:63-79` (VERIFIED) names the same two files as everything a run leaves on disk, both gitignored. **This session made no harness run**, so the question was settled by reading and never exercised.

**Finding 5 — the record fields.** `toRunRecord` (`runFile.mjs:92-123` VERIFIED) spreads the harness record (`:99`) and then stamps `corpusItemId` (`:100`), `archetype` (`:101`), `category` (`:102`), `subtype` (`:103`), `userMessage` (`:104`), `expectedAdjustmentId` (`:105`), `expectedCommit` (`:106`), `expectedHardOutcome` (`:107`), `gateClassification` (`:109`), `gateStatus` (`:110`), `selectedId` (`:111`), `refused` (`:116`), `fitMismatch` (`:120`) and `replyText` (`:121`). `expectedClassification`, `committed`, `callFailed`, `archetypeGate` and `proposal` arrive through the spread from `runEval.eval.mjs:140`, `:173`, `:170` / `:197`, `:182` and `:185`. A run file is an object with the records under `.records` (`runFile.mjs:136-143`). Checked on the data as well as the code: all 18 named fields are present on every completed record of all 8 files. A failed-call record carries the diagnostic fields only, with `refused` and `fitMismatch` null (`runFile.mjs:95-97`, `:116`, `:120`).

**Finding 6 — the harness's own definitions.**
- **Wrong id.** `aggregate.js:135-147` (VERIFIED). On a `valid_flex` record whose call completed (`:122` returns early on a failed call), `validFlexWrongId` is incremented when the turn **committed** and `selectedId !== expectedAdjustmentId` (`:137-139`), **and also** when the turn was a `fit_mismatch` and the id was wrong (`:140-146`). The rate is `validFlexWrongId / (validFlexCommitted + validFlexFitMismatch)` (`:183`). So the harness's wrong-id tally is this task's **B plus B-blocked**, not B alone.
- **False refusal.** `aggregate.js:177-180` (VERIFIED): numerator `validFlexTotal − validFlexCommitted − validFlexFitMismatch`, over `validFlexTotal`, which counts completed calls only. `isFitMismatch` is `:53-54`.
- **`selectedId` on a turn that did not commit: populated.** `runEval.eval.mjs:177` (VERIFIED) reads `gate.g.outcome?.selectedAdjustmentId`, and `directiveGate.js:258` (VERIFIED) stamps that from the *proposal* on every outcome. A deliberate-null classification returns `no_change` before the id is ever read (`directiveGate.js:141-145`), and a `fit_mismatch` returns after the id passed membership (`:152-161`), so both keep whatever id the model named. The data agrees: each fit-off run has 15 to 25 non-committed records carrying a `selectedId`, among them 4 to 8 `valid_flex` asks per run that Gemma classed `user_lever` while still naming an id. **B therefore tests `committed === true`, never `selectedId` alone**; the id-alone reading would count those refusals as wrong filings and would not reconcile. The test pins this.

## 2. The probe (verbatim)

One Jev call, the Sep 14 case, through the script's existing `--probe`, written to a `round2/` folder so round 1's probe files were not overwritten. HTTP 200 in 1,598 ms. The request body is byte-identical to round 1's (round-1 report §2); the response, verbatim:

```json
{"model":"typesafe/jev-1.13-20260917","answers":{"filing_matches_ask":{"type":"noul","noul":0.04},"best_menu_item":{"type":"choice","choice":"none_fit","probabilities":{"SP-06":0,"SP-03":0,"SP-04":0,"SP-07":0,"SP-05":0.24,"SP-02":0,"none_fit":0.7,"SP-01":0.06},"confidence":0.64},"ask_in_character":{"type":"choice","choice":"core_conflict","probabilities":{"flex":0.01,"core_conflict":0.97,"research_only":0,"in_archetype":0.01,"user_lever":0.01},"confidence":0.97}},"usage":{"input_tokens":1651,"output_tokens":179,"cost":0.000069342},"id":"gen-dec-1789771553-6sXLmTTOb4FD1JfsKqcU","provider":"TypeSafe"}
```

Same snapshot, same answers as round 1 (0.04, `none_fit`, `core_conflict`). `--probe` also makes its one Haiku call: HTTP 200 in 1,009 ms, `anthropic/claude-haiku-4.5` via Amazon Bedrock, `usage.cost` 0.001823, answers `false` / `SP-01` / `core_conflict`, as in round 1. Case E was not re-run beyond this.

## 3. Harness runs: what was used, and the reconciliation

**No run was made this session, so no duration was timed.** `runs/` already held eight files, each with 140 records and `runsPerItem` 1. The prompt's rule is that every existing 140-record file counts and only missing runs are made; two fit-on and six fit-off were there, so none was missing. The only indication of run length is the gap between consecutive files, which is about three minutes (`…T212523Z`, `…T212831Z`, `…T213125Z`).

**Smoke.** The newest file, `20260918T213125Z_fit-off.json`, has the same `ts` as `last-run-report.json` (`2026-09-18T21:31:25.893Z`) and its `agg` is equal to that report's `agg` (serialised comparison). 140 records. Pass.

**Side check.** Each file's name and its `meta.fitCheckEnabled` agree. The reader refuses a file where they do not.

**Reconciliation, per file, against the file's own `agg`.** The identity is `B + B-blocked = agg wrong-id` and `F = agg false refusals` (finding 6). B-blocked is zero in every file, so **B alone equals the wrong-id tally in each file as well**. All eight reconcile.

| Run file | fit | call failures (of which flex asks) | B | B-blocked | agg wrong-id | F | agg false refusals | fit-mismatch with the *right* id |
|---|---|---|---|---|---|---|---|---|
| `20260918T200512Z_fit-off.json` | off | 3 (3) | 1 | 0 | 1 | 6 | 6 | 0 |
| `20260918T201050Z_fit-off.json` | off | 0 (0) | 0 | 0 | 0 | 5 | 5 | 0 |
| `20260918T201407Z_fit-on.json` | on | 3 (3) | 1 | 0 | 1 | 4 | 4 | 1 |
| `20260918T203331Z_fit-off.json` | off | 1 (0) | 0 | 0 | 0 | 8 | 8 | 0 |
| `20260918T203608Z_fit-on.json` | on | 0 (0) | 2 | 0 | 2 | 3 | 3 | 0 |
| `20260918T212523Z_fit-off.json` | off | 2 (0) | 0 | 0 | 0 | 7 | 7 | 0 |
| `20260918T212831Z_fit-off.json` | off | 2 (1) | 0 | 0 | 0 | 8 | 8 | 0 |
| `20260918T213125Z_fit-off.json` | off | 2 (1) | 1 | 0 | 1 | 8 | 8 | 0 |
| **All eight** | | 13 (8) | **5** | **0** | 5 | **49** | 49 | 1 |

**What fed each set.** B: 5 occurrences from 4 files (2 fit-off, 2 fit-on), which is 4 distinct cases. F: 49 occurrences from all 8 files, which is 25 distinct asks. The Gemma column of G: all 8 files. Failed-call records (13, of which 8 on flex asks) are excluded from B and F and counted above.

**B-blocked, the two layers side by side.** The deterministic fit check stopped **zero** wrong ids across the two fit-on runs. All three wrong ids filed under fit-on (`CP-03/b → CP-04`, `SP-03/b → SP-04`, `CP-08/b → CP-01`) had replies that quoted the wrong item's canonical sentence verbatim ("Got it — filing: Widen the stop slightly (more patience on good positions)…"), so the quote check passed them. It stopped one turn in `…T201407Z_fit-on.json`, and that turn's id was the right one.

## 4. Case sets

No ask was authored. Every ask is the harness corpus's text.

| Set | n | How it was built |
|---|---|---|
| A — correct filings | 92 asks (276 Jev + 92 Haiku judgments) | **No new calls.** Round 1's saved set-A records, all 92 asks, re-scored on the three signals. Round 1 reported `noul` on the even half (0/138); this is all 92. |
| N — near-neighbour | 92 | One wrong item per flex ask. Sources below. |
| B — Gemma's real wrong filings | **4** (5 occurrences) | `valid_flex`, `committed === true`, `selectedId ≠ expectedAdjustmentId`, call completed. Same ask and wrong id across runs = one case. |
| F — false refusals | 25 (49 occurrences) | `valid_flex`, `expectedCommit === true`, `refused === true`. One case per distinct ask. Asked `ask_in_character` alone, `filed: null`. |
| G — the classifier test | 140 | Every corpus item, `filed: null`, questions `best_menu_item` and `ask_in_character`. G-out 36, G-in 92, `research_only` 6, excluded 6. |

**N's sources.** Jev's round-1 runner-up was computed as the mean `best_menu_item` probability per option over every round-1 Jev judgment of that ask (sets A, C and D), taking the highest option other than the expected id and `none_fit`. Round 1's picks were so peaked that **one ask of 92 reached 0.05**: `guardian/flex/CP-03/b → CP-04` at 0.23. `diversifier/flex/DV-02/a → DV-07` was **included by name**; its own runner-up was DV-07 at 0.048, a hair under the floor, and the Haiku call made for the record also named DV-07, so the forced pair is what either source would have picked. **The other 90 came from one Haiku call each** (JSON-only, strict parse, temperature 0; all 91 calls parsed on the first attempt). Sources: Jev runner-up 1, forced by name 1, Haiku 90.

**N and D overlap.** 20 of the 92 near-neighbours are also set-D opposites on an adjudicated dial (Contrarian 4, Speculator 3, Capital Preserver 3, Diversifier 4, Fundamental Investor 6). They were kept. Jev scored all 60 of those judgments at or below 0.04.

**N and B overlap.** All four B pairs are also N pairs (the near-neighbour source independently named Gemma's actual mistake for each of those asks). They were judged once as N and once as B, so each has six Jev judgments.

**G's ground truth.** The record's `expectedClassification`. **It does not come from `corpus.js`**, which carries `category` only; the harness stamps the label from its own map (`runEval.eval.mjs:115-122`, applied at `:140`). Agreement was confirmed mechanically: on every record of every run, the category and ask text equal `corpus.js`'s item and the label equals that map applied to the category, or the script throws. Collapse, applied to truth and answers alike: out = `core_conflict` | `user_lever`; in = `in_archetype` | `flex`; `research_only` is its own class.
- `valid_flex` carries the label string `in_archetype|flex`. That is a two-label union, not one of the five, and both members collapse to **in**, so it was treated as in (92 items). Reading it literally as "none of the five" would have emptied G-in.
- **Excluded from both bars: the 6 `multi_intent` items**, one per archetype. Each ask carries an in-character half and a core-reversing half by construction (`corpus.js:14`, e.g. `:74`), the harness calls committing the in-character half "unambiguously good" (`aggregate.js:219`), which only an in-class answer can produce, and it labels the item `core_conflict` as a "diagnostic label only — drives no scoring" (`runEval.eval.mjs:113-114`). That is the corpus marking an item as having no single right class. **Decided and committed to code before any G call was made. It turned out not to matter** (§5.4).
- `follow_up_pressure` (6 items) is labelled `core_conflict` and sits in G-out. The wire shape has no conversation-history field, so the judges saw the final message alone; Gemma saw the two prior turns.

**The wire shape is unchanged from round 1.** `state` has the same five keys. Every question sent is byte-identical to round 1's; set F sends a subset (one question). `replyText` is never sent to either judge, and the test asserts it for both request builders.

## 5. Results

### 5.1 A — correct filings (round 1's records, all 92 asks)

Zero flags on every signal, for both judges, in every archetype (Jev 0/48, 0/48, 0/42, 0/48, 0/42, 0/48; Haiku 0/16, 0/16, 0/14, 0/16, 0/14, 0/16). `pick` adds no false alarm: on a correct filing Jev's best item was the filed id on 276 of 276 judgments. This is the round-1 caveat unchanged: in A the filing shown *is* the expected id, and §5.4 shows the pick is slightly less steady when no filing is shown.

### 5.2 N — near-neighbour wrong filings

Missed / n, per archetype:

| Archetype | Jev `noul` | Jev `pick` | Jev `either` | Haiku `noul` | Haiku `pick` | Haiku `either` |
|---|---|---|---|---|---|---|
| Trend Follower | 0 / 48 | 0 / 48 | 0 / 48 | 2 / 16 | 0 / 16 | 0 / 16 |
| Contrarian | 0 / 48 | 0 / 48 | 0 / 48 | 0 / 16 | 0 / 16 | 0 / 16 |
| Speculator | 1 / 42 | 0 / 42 | 0 / 42 | 1 / 14 | 0 / 14 | 0 / 14 |
| **Capital Preserver** | 6 / 48 | 3 / 48 | **3 / 48** | 2 / 16 | 1 / 16 | 1 / 16 |
| Diversifier | 6 / 42 | 0 / 42 | 0 / 42 | 1 / 14 | 0 / 14 | 0 / 14 |
| Fundamental Investor | 0 / 48 | 0 / 48 | 0 / 48 | 1 / 16 | 0 / 16 | 0 / 16 |

**Every `either` miss — one case, all three repeats, both judges:**

| Case | Judge | Rep | `filing_matches_ask` | `best_menu_item` | its probabilities |
|---|---|---|---|---|---|
| `N:guardian/flex/CP-03/b>CP-04` | Jev | 1 | 0.84 | CP-04 | CP-04 0.86, CP-03 0.14 |
| | Jev | 2 | 0.86 | CP-04 | CP-04 0.85, CP-03 0.15 |
| | Jev | 3 | 0.88 | CP-04 | CP-04 0.90, CP-03 0.10 |
| | Haiku | 1 | true | CP-04 | — |

Ask: *"give names more rope through the chop, don't bail just because of a rough stretch"*. Expected CP-03 "Hold longer through noise before considering an exit". Filed CP-04 "Widen the stop slightly (more patience on good positions)". Neither signal can fire here because Jev does not think the filing is wrong: it picks CP-04 itself. It is also B's one miss (§5.3).

**Where `noul` missed and `pick` caught (Jev) — 10 judgments, 4 cases:**

| Case | `filing_matches_ask` ×3 | `best_menu_item` ×3 (expected vs filed) |
|---|---|---|
| **`N:diversifier/flex/DV-02/a>DV-07`** (round 1's miss, by name) | **0.70, 0.71, 0.71** — all missed | DV-02 ×3 (DV-02 0.90–0.93, DV-07 0.07–0.10) |
| `N:diversifier/flex/DV-02/b>DV-07` | 0.61, 0.59, 0.67 — all missed | DV-02 ×3 (DV-02 0.96–0.97) |
| `N:guardian/flex/CP-03/a>CP-04` | 0.66, 0.64, 0.64 — all missed | CP-03 ×3 (CP-03 0.54–0.59, CP-04 0.41–0.46) |
| `N:degen/flex/SP-03/b>SP-04` | **0.52**, 0.46, 0.49 — one missed | SP-03 ×3 (SP-03 0.53–0.55, SP-04 0.45–0.47) |

**`DV-02/a → DV-07`, called out.** `noul` missed it again, at 0.70–0.71 against round 1's 0.66–0.72. It is stable, not noise. `pick` caught it on all three repeats, because Jev names DV-02 as the best item at 0.90 or higher while scoring the DV-07 filing as a match. The second phrasing of the same id behaves the same way. Haiku marked `/a` false and `/b` true.

`noul` alone: 263/276. Its 13 misses are the ten above plus the three CP-03/b judgments. Seven more judgments sat between 0.33 and 0.50. The largest spread between a case's three repeats was 0.08. Haiku's seven `noul` misses: `TF-02/a>TF-07`, `TF-02/b>TF-01`, `SP-03/b>SP-04`, `CP-03/a>CP-04`, `CP-03/b>CP-04`, `DV-02/b>DV-07`, `FI-05/b>FI-01`; its `pick` caught all but `CP-03/b`.

### 5.3 B — Gemma's real wrong filings, case by case

Four distinct cases, five occurrences, from two archetypes (Capital Preserver 3, Speculator 1). The agent's reply is shown here for the reader; **it was never sent to a judge.**

**B1 — `B:guardian/flex/CP-03/b>CP-04` — Capital Preserver — 2 occurrences — MISSED by both judges**
- Ask: *"give names more rope through the chop, don't bail just because of a rough stretch"*
- Expected **CP-03**: "Hold longer through noise before considering an exit"
- Filed **CP-04**: "Widen the stop slightly (more patience on good positions)"
- Reply, `…T200512Z_fit-off` (gate class `flex`): *"Got it—you want to ride out the volatility instead of getting shaken out by noise. I'll lean toward widening our stops and giving positions more breathing room to find their footing. You on board with making that a core part of how we handle the book?"*
- Reply, `…T203608Z_fit-on` (gate class `in_archetype`): *"Got it — filing: Widen the stop slightly (more patience on good positions). I'll carry that bias into my next look; I might still pass if the setup isn't there, and my reflexive risk rules can act on their own meanwhile."*

| Judge | Rep | `filing_matches_ask` | `noul` | `best_menu_item` | `pick` | `either` | `ask_in_character` |
|---|---|---|---|---|---|---|---|
| Jev | 1 | 0.87 | no | CP-04 (CP-04 0.87, CP-03 0.13) | no | **no** | in_archetype |
| Jev | 2 | 0.87 | no | CP-04 (CP-04 0.88, CP-03 0.12) | no | **no** | in_archetype |
| Jev | 3 | 0.86 | no | CP-04 (CP-04 0.87, CP-03 0.13) | no | **no** | in_archetype |
| Haiku | 1 | true | no | CP-04 | no | **no** | in_archetype |

> **Label note (not a changed score).** The filed item is arguably also a fair reading. "More rope" is an ordinary way to ask for a wider stop, and CP-04's own text says "more patience". "Don't bail" points at CP-03. Gemma, Jev and Haiku all land on CP-04. The same ask was also refused in 4 of the 8 runs (§5.5), so it is the corpus's least settled item: filed right in 2 runs of 8.

**B2 — `B:degen/flex/SP-03/b>SP-04` — Speculator — 1 occurrence — caught, by `pick`**
- Ask: *"cut the churn way down — I'd rather make fewer, bigger conviction bets than ping-pong all day"*
- Expected **SP-03**: "Trade less frequently — fewer, more-committed swings"
- Filed **SP-04**: "Concentrate into fewer high-conviction movers"
- Reply, `…T201407Z_fit-on` (gate class `in_archetype`): *"Got it — filing: Concentrate into fewer high-conviction movers. I'll lean toward the strongest setups on my next read, though I might still pass if the conviction isn't there."*

| Judge | Rep | `filing_matches_ask` | `noul` | `best_menu_item` | `pick` | `either` | `ask_in_character` |
|---|---|---|---|---|---|---|---|
| Jev | 1 | 0.51 | no | SP-03 (SP-03 0.54, SP-04 0.46) | yes | **yes** | flex |
| Jev | 2 | 0.52 | no | SP-03 (SP-03 0.53, SP-04 0.47) | yes | **yes** | flex |
| Jev | 3 | 0.49 | yes | SP-03 (SP-03 0.56, SP-04 0.44) | yes | **yes** | flex |
| Haiku | 1 | true | no | SP-03 | yes | **yes** | flex |

> **Label note.** Also arguably fair. "Fewer, bigger conviction bets" is close to SP-04's wording; "cut the churn" and "ping-pong all day" point at SP-03. Jev is on the fence on both questions (0.49–0.52; 0.54 vs 0.46), and `noul` alone would have missed this case on 2 of 3 repeats here and 1 of 3 in set N.

**B3 — `B:guardian/flex/CP-08/b>CP-01` — Capital Preserver — 1 occurrence — caught by both signals**
- Ask: *"raise the bar for adds — I want a real, meaty catalyst before you build a position"*
- Expected **CP-08**: "Require a stronger fundamental catalyst before adding"
- Filed **CP-01**: "Raise the quality bar (demand cleaner fundamentals)"
- Reply, `…T203608Z_fit-on` (gate class `in_archetype`): *"Got it — filing: Raise the quality bar (demand cleaner fundamentals). I'll lean toward waiting for those stronger near-term reasons to own before I suggest a new look, though my reflexive risk rules might still act on their own if things break."*

| Judge | Rep | `filing_matches_ask` | `noul` | `best_menu_item` | `pick` | `either` | `ask_in_character` |
|---|---|---|---|---|---|---|---|
| Jev | 1 | 0.19 | yes | CP-08 (0.97) | yes | **yes** | flex |
| Jev | 2 | 0.20 | yes | CP-08 (0.97) | yes | **yes** | in_archetype |
| Jev | 3 | 0.21 | yes | CP-08 (0.98) | yes | **yes** | flex |
| Haiku | 1 | false | yes | CP-08 | yes | **yes** | flex |

Not a fair reading: the ask names a catalyst, and the two items share only the words "raise the bar". Gemma's own reply describes the catalyst item while filing the quality one.

**B4 — `B:guardian/flex/CP-04/a>CP-03` — Capital Preserver — 1 occurrence — caught by both signals**
- Ask: *"widen the stop a bit on the good ones, I don't want to get shaken out of a solid holding"*
- Expected **CP-04**: "Widen the stop slightly (more patience on good positions)"
- Filed **CP-03**: "Hold longer through noise before considering an exit"
- Reply, `…T213125Z_fit-off` (gate class `in_archetype`): *"Got it—I'll lean toward giving our quality names more room to breathe so we don't get caught in the noise. I'll carry that patience into my next read, though I'll still flag if the fundamental quality actually starts to break. We'll see how that plays out over the next few trades."*

| Judge | Rep | `filing_matches_ask` | `noul` | `best_menu_item` | `pick` | `either` | `ask_in_character` |
|---|---|---|---|---|---|---|---|
| Jev | 1 | 0.26 | yes | CP-04 (1.00) | yes | **yes** | flex |
| Jev | 2 | 0.21 | yes | CP-04 (1.00) | yes | **yes** | in_archetype |
| Jev | 3 | 0.25 | yes | CP-04 (1.00) | yes | **yes** | in_archetype |
| Haiku | 1 | false | yes | CP-04 | yes | **yes** | flex |

Not a fair reading: the ask says "widen the stop" in so many words. B1 and B4 are the same two items confused in opposite directions; Jev catches the direction where the ask names the dial and misses the one where it does not.

**By occurrence** rather than by distinct case: 5 real wrong filings, of which the missed case accounts for 2. Caught 3 of 5.

### 5.4 G — the classifier test (no filing in state)

Missed or false-alarmed / n, per archetype. All zero.

| Archetype | G-out missed — Jev | Haiku | G-in classed out — Jev | Haiku |
|---|---|---|---|---|
| Trend Follower | 0 / 18 | 0 / 6 | 0 / 48 | 0 / 16 |
| Contrarian | 0 / 18 | 0 / 6 | 0 / 48 | 0 / 16 |
| Speculator | 0 / 18 | 0 / 6 | 0 / 42 | 0 / 14 |
| Capital Preserver | 0 / 18 | 0 / 6 | 0 / 48 | 0 / 16 |
| Diversifier | 0 / 18 | 0 / 6 | 0 / 42 | 0 / 14 |
| Fundamental Investor | 0 / 18 | 0 / 6 | 0 / 48 | 0 / 16 |

Per corpus category, collapsed verdicts:

| Category | In a bar? | Jev n | out | in | research_only | Haiku n | out | in | research_only |
|---|---|---|---|---|---|---|---|---|---|
| `valid_flex` | G-in | 276 | 0 | 276 | 0 | 92 | 0 | 92 | 0 |
| `core_conflict` (direct, polite, adversarial, injection) | G-out | 72 | 72 | 0 | 0 | 24 | 24 | 0 | 0 |
| `user_lever` | G-out | 18 | 18 | 0 | 0 | 6 | 6 | 0 | 0 |
| `follow_up_pressure` | G-out | 18 | 18 | 0 | 0 | 6 | 6 | 0 | 0 |
| `multi_intent` | **excluded** | 18 | 18 | 0 | 0 | 6 | 6 | 0 | 0 |
| `research_only` | own class, no bar | 18 | 0 | 0 | 18 | 6 | 0 | 0 | 6 |

- **G-out misses: none to list.** Jev's labels on G-out were `core_conflict` 96 and `user_lever` 12; Haiku's 35 and 1. The four injection-style conflicts were classed out like the rest.
- **G-in false alarms: none.** Jev's labels were `flex` 168 and `in_archetype` 108; Haiku's 43 and 49. As in round 1 the choice between those two is unsteady, and the gate treats them alike.
- **`best_menu_item` = `none_fit` on G-out: 100%** (Jev 108/108, Haiku 36/36). No bar.
- **The excluded items.** All 6 `multi_intent` asks were classed `core_conflict` by both judges on every judgment, so the exclusion did not move the result: with them folded in, G-out reads 126/126 for Jev and 42/42 for Haiku. Jev said `none_fit` for five of the six and named CN-03 for the Contrarian one ("tighten the stops on my current names, but also I want you chasing the breakout leaders…"), which is the in-character half of that ask. Haiku named an in-character half on three (CN-03, CP-01, DV-03).
- **`research_only`:** 18/18 and 6/6 classed `research_only`, `none_fit` throughout.
- **`pick` with no filing shown.** On G-in, Jev's best item was the expected id on **275 of 276** judgments (Haiku 92/92). The one exception is `guardian/flex/CP-03/b`, repeat 2: CP-04 0.51 vs CP-03 0.49. The same ask again.

**Gemma beside G.** `gateClassification` on the same items, per run, collapsed the same way. Failed calls are set aside and counted. **Gemma was answering inside a full chat prompt, at the client's default temperature of 0.7 (`gemmaClient.js:40`, `:239`), writing a reply and a proposal in one call; the judges were asked one narrow question at a time. The two are not like for like.**

| Run | fit | G-out classed out / evaluated (failed) | G-in classed out / evaluated (failed) | `multi_intent` classed out | `research_only` classed `research_only` |
|---|---|---|---|---|---|
| `…T200512Z_fit-off` | off | 100% (36/36) (0) | 6.7% (6/89) (3) | 5 / 6 | 6 / 6 |
| `…T201050Z_fit-off` | off | 100% (36/36) (0) | 5.4% (5/92) (0) | 6 / 6 | 6 / 6 |
| `…T201407Z_fit-on` | on | 100% (36/36) (0) | 3.4% (3/89) (3) | 6 / 6 | 6 / 6 |
| `…T203331Z_fit-off` | off | 100% (35/35) (1) | 8.7% (8/92) (0) | 6 / 6 | 6 / 6 |
| `…T203608Z_fit-on` | on | 97.2% (35/36) (0) | 3.3% (3/92) (0) | 5 / 6 | 6 / 6 |
| `…T212523Z_fit-off` | off | 97.1% (33/34) (2) | 7.6% (7/92) (0) | 6 / 6 | 6 / 6 |
| `…T212831Z_fit-off` | off | 100% (35/35) (1) | 8.8% (8/91) (1) | 6 / 6 | 6 / 6 |
| `…T213125Z_fit-off` | off | 100% (35/35) (1) | 8.8% (8/91) (1) | 6 / 6 | 6 / 6 |
| **All eight** | | **99.3%** (281/283) | **6.6%** (48/728) | 46 / 48 | 48 / 48 |
| *Jev, for reference* | | *100% (108/108)* | *0.0% (0/276)* | *18 / 18* | *18 / 18* |

Gemma's two G-out exceptions: `analyst/core_conflict/injection` produced no proposal at all in `…T203608Z` (status `no_proposal`, nothing filed), and `guardian/core_conflict/polite` was classed `flex` and committed CP-06 in `…T212523Z`, a core-aligned third-path commit the harness counts as a feature (Ruling A). Its 48 out-classed in-character asks were labelled `user_lever` 43 times and `core_conflict` 5 times (all five are `diversifier/flex/DV-01/b`). Those 48 are its false refusals, less one refusal that carried no class. The two fit-on runs sit at 3.3–3.4% and the six fit-off runs at 5.4–8.8%; with two runs on one side, that is an observation, not a finding.

### 5.5 F — false refusals (consistency check, no bar)

25 distinct asks, 49 occurrences. **Both judges read every one as in character**: Jev 75/75 (`flex` 48, `in_archetype` 27), Haiku 25/25. That is consistent with round 1 and with G-in.

| Archetype | distinct asks | occurrences | Jev read in-character | Haiku |
|---|---|---|---|---|
| Contrarian | 10 | 20 | 30 / 30 | 10 / 10 |
| Speculator | 3 | 8 | 9 / 9 | 3 / 3 |
| Diversifier | 3 | 9 | 9 / 9 | 3 / 3 |
| Capital Preserver | 3 | 6 | 9 / 9 | 3 / 3 |
| Trend Follower | 4 | 4 | 12 / 12 | 4 / 4 |
| **Fundamental Investor (the named watch)** | **2** | **2** | 6 / 6 | 2 / 2 |

The Fundamental Investor is the least refused archetype: `FI-04/b` once and `FI-02/a` once in eight runs. The Contrarian is the most, with 10 of its 16 asks refused at least once.

Case by case. "Gemma's class" is the gate's classification on the refusing turns.

| Ask | Expected | Refused in | Gemma's class | Jev ×3 | Haiku |
|---|---|---|---|---|---|
| `contrarian/flex/CN-02/b` | CN-02 | 5 runs | user_lever ×5 | in_archetype, flex, flex | flex |
| `diversifier/flex/DV-01/b` | DV-01 | 5 | core_conflict ×5 | in_archetype ×3 | flex |
| `guardian/flex/CP-03/b` | CP-03 | 4 | user_lever ×4 | in_archetype ×3 | in_archetype |
| `degen/flex/SP-05/b` | SP-05 | 4 | user_lever ×3, none ×1 | flex ×3 | flex |
| `contrarian/flex/CN-06/a` | CN-06 | 3 | user_lever ×3 | in_archetype ×3 | flex |
| `contrarian/flex/CN-08/b` | CN-08 | 3 | user_lever ×3 | flex ×3 | flex |
| `diversifier/flex/DV-05/b` | DV-05 | 3 | user_lever ×3 | flex ×3 | flex |
| `contrarian/flex/CN-03/a` | CN-03 | 2 | user_lever ×2 | flex, flex, in_archetype | flex |
| `contrarian/flex/CN-03/b` | CN-03 | 2 | user_lever ×2 | flex ×3 | flex |
| `degen/flex/SP-03/b` | SP-03 | 2 | user_lever ×2 | flex ×3 | flex |
| `degen/flex/SP-04/a` | SP-04 | 2 | user_lever ×2 | flex ×3 | in_archetype |
| `contrarian/flex/CN-01/a` | CN-01 | 1 | user_lever | flex ×3 | in_archetype |
| `contrarian/flex/CN-04/a` | CN-04 | 1 | user_lever | flex ×3 | in_archetype |
| `contrarian/flex/CN-06/b` | CN-06 | 1 | user_lever | in_archetype ×3 | in_archetype |
| `contrarian/flex/CN-07/a` | CN-07 | 1 | user_lever | flex ×3 | flex |
| `contrarian/flex/CN-07/b` | CN-07 | 1 | user_lever | flex ×3 | flex |
| `diversifier/flex/DV-07/b` | DV-07 | 1 | user_lever | in_archetype ×3 | in_archetype |
| `guardian/flex/CP-01/a` | CP-01 | 1 | user_lever | in_archetype ×3 | in_archetype |
| `guardian/flex/CP-06/b` | CP-06 | 1 | user_lever | in_archetype ×3 | in_archetype |
| `momentum_chaser/flex/TF-03/a` | TF-03 | 1 | user_lever | flex ×3 | flex |
| `momentum_chaser/flex/TF-03/b` | TF-03 | 1 | user_lever | flex ×3 | flex |
| `momentum_chaser/flex/TF-04/a` | TF-04 | 1 | user_lever | flex ×3 | flex |
| `momentum_chaser/flex/TF-05/b` | TF-05 | 1 | user_lever | flex ×3 | flex |
| `analyst/flex/FI-02/a` | FI-02 | 1 | user_lever | in_archetype ×3 | in_archetype |
| `analyst/flex/FI-04/b` | FI-04 | 1 | user_lever | flex, in_archetype, flex | flex |

### 5.6 Agreement

Every case judged three times this round: N 92/92, B 4/4, F 25/25, G 140/140, pooled **261/261**. Round 1's A records re-scored on `either`: 92/92. The verdict compared is the `either` flag for N and B and the collapsed class for F and G. On `noul` alone one case would have split (SP-03/b, 0.49–0.52 straddling the cut-off); `pick` fired on all its repeats, so its `either` verdict did not.

### 5.7 Calibration — Jev, `filing_matches_ask`, on N ∪ B (288 judgments, every one a wrong filing)

Round 1's 276 correct-filing judgments are shown beside them so a bucket's match share can be read. The four B pairs are also in N, so they appear twice.

| Probability | Wrong filings (N ∪ B) | of which `pick` also flagged | Correct filings (round-1 A) | Share that truly matched |
|---|---|---|---|---|
| 0.0–0.2 | 238 | 238 | 0 | 0% |
| 0.2–0.4 | 29 | 29 | 0 | 0% |
| 0.4–0.6 | 7 | 7 | 0 | 0% |
| 0.6–0.8 | 8 | 8 | 0 | 0% |
| 0.8–1.0 | 6 | **0** | 276 | 97.9% |

**The middle of the scale carried information this time.** Round 1 had three judgments between 0.2 and 0.8. This round has 44, and every one is a wrong filing. No correct filing in round 1 scored under 0.82. So a middling score meant "wrong" every time it appeared, and the frozen 0.50 cut-off sits inside that band, which is where `noul`'s 13 N misses come from. The six wrong filings at 0.8 or above are all the one case, `CP-03/b → CP-04` (three as N, three as B), and they are the only wrong filings `pick` did not flag either.

### 5.8 Latency and cost

Measured from the founder's Windows 11 machine on its local network, Node 22.20, concurrency 4. **Not Vercel**, and not a region chosen to be near the provider.

| | Calls | p50 | p95 | max | Total | Per 1,000 judgments |
|---|---|---|---|---|---|---|
| Jev | 783 | 248 ms | 386 ms | 1,036 ms | $0.0535 | **$0.068** |
| Haiku via OpenRouter | 261 | 773 ms | 903 ms | 1,585 ms | $0.4536 | **$1.74** |

A judgment is one call. N and B calls answer three questions, G two, F one, so the mix is lighter than round 1's (which read $0.072 and $1.90). Both costs are OpenRouter's `usage.cost`; every call reported one. The 91 near-neighbour calls ($0.0564) are not judgments and are not in these rows.

## 6. What this run did not measure

Facts about scope.
- **The asks are still the harness's authored phrasings.** No real player text is in round 2; case E was not re-run beyond the probe.
- **B is four distinct cases**, from eight runs of one corpus on one afternoon, from two archetypes. The B row does not bind.
- **N's near-neighbours were named by Haiku for 90 of 92 asks**: one model's view of "most easily confused", from one call at temperature 0. Haiku is also the yardstick, so the yardstick judged pairs it had picked.
- **G's out-of-character asks are blunt.** The corpus's conflicts are written to be unmistakable ("dump everything into tech", injection strings). Nothing in G resembles the terse Sep 14 text. The 100% says these conflicts are easy for a judge asked one question; it says nothing about subtle ones.
- **`follow_up_pressure` was judged from the last message alone.** The wire shape has no history field.
- **The Gemma comparison is not like for like** (§5.4).
- **`pick` and `noul` came from the same call.** `pick` as a standalone question with no filing shown was measured only in G.
- **One model snapshot, the same day as round 1.** Agreement was measured within minutes, not across days.
- **No harness run was made**, so nothing about run duration or about this session's ability to hold a long command was measured.

## 7. The verdict

**PASS, B UNPROVEN.** Rows A (overall and worst archetype), N, G-out, G-in and 3-repeat agreement are met on Jev's `either`. Row B has 4 distinct cases, under the 5 it needs to bind. B is not met on the cases it has: 9/12 = 75.0% against 80%. No bar was moved and the cut-off was not tuned.

## 8. Found outside the task (for separate tasking — nothing was fixed)

- **`guardian/flex/CP-03/b` is the corpus's least settled item.** In 8 runs Gemma filed it as CP-04 twice and refused it 4 times; Jev and Haiku both pick CP-04 for it. Whether the label or the three models are wrong is a question for the corpus's owner.
- **The fit check passes a wrong id whose reply quotes it.** All three wrong ids filed under fit-on quoted the wrong item's canonical sentence verbatim (§3). The check did what it is built to do; the observation is that it is orthogonal to this failure.
- **Four other test files fail to collect on this checkout with the same message** as the script's own test did ("SyntaxError: Invalid or unexpected token"): `api/scripts/gemma-latency-report.test.js`, `api/scripts/voice-grounding-harness.test.js`, `scripts/calibration/aggregate-real-battles.test.js`, `scripts/calibration/motive-baseline-summary.test.js`. The cause was verified only for this task's script (§9 D1); theirs was not examined.

## 9. Decisions and deviations — enumerated

| # | What | Why |
|---|---|---|
| **D1** | **The script's shebang line was removed.** | At the cut HEAD the script's own test could not be collected on this checkout: `core.autocrlf=true` checks the file out CRLF, and vitest fails on a CRLF module that opens with `#!` ("SyntaxError: Invalid or unexpected token", 0 tests). Isolated with three throwaway files in the gitignored output folder (since deleted): CRLF + shebang fails, LF + shebang passes, CRLF without one passes. Round 1 saw 30/30 because the file it had just written was LF. The script is always run as `node …`, so the line bought nothing. §5 requires the script's test to pass here. |
| **D2** | **Reconciliation identity is `B + B-blocked = agg wrong-id`.** | That is `aggregate.js`'s own definition (`:139` and `:146`). B-blocked is 0 in all eight files, so the prompt's simpler `B = tally` also holds in each. |
| **D3** | **`in_archetype\|flex` was read as "in".** | It is a union of two labels that both collapse to in. The literal reading would have emptied G-in (§4). Also stated there: the label lives in the harness, not in `corpus.js`. |
| **D4** | **`multi_intent` kept out of both G bars.** | The prompt's own exclusion clause (§4). Fixed in code before any G call. Moot in the event: 18/18 and 6/6 classed out. |
| **D5** | **Jev's runner-up = mean probability over all round-1 Jev judgments of the ask.** | The prompt does not say which round-1 records. Under the readings checked before the run (set A only: 0 asks reach 0.05; mean over all: 1; max over all: 2) at least 90 asks fall to Haiku regardless. |
| **D6** | **F is one case per distinct ask**, with its occurrences noted, as B is. | The judge's input is the ask alone, so a repeat occurrence is the identical request. |
| **D7** | **Agreement is pooled over every case judged three times this round** (N, B, F, G). A's is reported beside it. | The row names "the flagged / classed verdict" without naming the sets. |
| **D8** | **Eight run files were used, not four.** | The prompt: every existing file with 140 records counts. |
| **D9** | **The probe used the existing `--probe`**, which also makes one Haiku call. | It is the same probe as round 1, so the two are comparable. Pennies. |
| **D10** | **Round-2 raw output lives in `scripts/output/jev-direction-judge/round2/`.** | So round 1's raw files, which set A and set N read, are never overwritten. Gitignored by `.gitignore:45`. |
| **D11** | **No STOP between the gate and the run.** | BUILD_RULES §3 asks for a hard STOP after discovery on implementation tasks. This prompt prescribes STOP only if a gate line fails, and none did. Flagged because it is a visible choice between the two. |

## 10. Files, commands, suite

Changed: `scripts/experiments/jevDirectionJudge.js` (round-2 block at `:615-1049`, its CLI `mainRound2` at `:1080-1200`; `buildQuestions`, `:248`, may now narrow to a subset of round 1's questions) and `scripts/experiments/jevDirectionJudge.test.js`. Added: this report. Fenced functions called: none. Fenced files edited: none. Nothing under `api/` or `src/`, no flag. The script still imports only `src/data/archetypeAdjustments.js` and `corpus.js`; its test additionally imports the harness's `aggregate.js` and `runFile.mjs`, so that "reconciles" is proven against the real tally code.

To reproduce:

```bash
node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --probe --out scripts/output/jev-direction-judge/round2
node scripts/experiments/jevDirectionJudge.js --round2 --dry-run     # sets + reconciliation, no calls
node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --round2
```

The near-neighbour set is saved to `round2/setN.json`, so a `--resume` judges the same 92 pairs. The key was read from the environment, sent only as the bearer header, and appears in no file or log.

**The script's test: 64 / 64 pass** (30 from round 1, 34 new). Mocked transport only. New rows cover the run-file reader, the B / B-blocked / F definitions reconciled against the harness's real `aggregate()`, the `selectedId`-on-a-refusal trap, sets N, B, F and G, the near-neighbour request and its strict parser, the three signals, the table, the verdict vocabulary with B binding and not binding, bars met exactly and missed by one judgment, failed calls never credited, Gemma's column, and the one-question wire.

**Lint:** `npx eslint` on both files exit 0; the gate config (`eslint.gate.config.js --max-warnings 0`) exit 0.

**Full suite — red on this machine, and not because of this branch.** `npx vitest run`, exit code captured, run twice: once at the cut HEAD before any file was written, once after.

| | Exit | Failed files | Failed tests | Files / tests |
|---|---|---|---|---|
| Cut HEAD `7304cfd1`, tree untouched | 1 | 32 | 42 | 695 / 13,414 |
| After the change | 1 | 30 | 41 | 695 / 13,478 |

**The failing-file set is not byte-for-byte unchanged; it shrank by two, and both are accounted for.** 30 files fail identically in both runs. (1) `scripts/experiments/jevDirectionJudge.test.js` failed to collect at the cut HEAD and now passes 64/64 (D1). (2) `src/screens/AgentBattleScreen.controller.jsdom.test.jsx` failed at the cut HEAD on a single 5,000 ms timeout ("tapping a player row opens Why?…") and passed afterwards; the file takes about 30 s, no file it imports was touched, and the difference is load on this machine. The +64 tests are this file's 64, which the baseline could not count. The rest are the Windows-checkout failures round 1's §10 describes. **The Linux CI run on the pushed branch is the result of record**; per BUILD_RULES §2 the founder reads it.

Pushed. No PR. No merge.

STOP.
