# Measurement — Jev as a directive direction judge

**In plain terms (for the founder).** We showed Jev 209 filings, three times each: 92 where the filed adjustment was the right one for the player's ask, 92 where it was a random wrong one from the same menu, 24 where it was the exact opposite end of the same dial, and the real Sep 14 Speculator case. With the cut-off fixed at 0.5 on half the asks and everything scored on the other half, **Jev raised no false alarm on any correct filing, caught every opposite-direction filing, and caught 97.8% of the random wrong ones.** Its one miss was the same case all three times: a Diversifier ask to spread across more sectors, filed as DV-07 ("fill an under-represented sector on the next add") instead of DV-02 ("widen the spread"). Jev scored that near-neighbour 0.66–0.72, above the cut-off; Haiku caught it. **On Sep 14 it would have flagged the filing:** it gave "Swap Core for Support (Full Defense)" → SP-05 a 0.04 probability of carrying out the ask, called the ask a `core_conflict` (the class under which the gate writes nothing), and said no item on the Speculator menu fits — all three times. Haiku, asked the same questions once, got every reported case right, at about 26 times the cost and roughly three times the latency. Two things this run could **not** measure: real harness misses and refusals (sets B and F), because the Sep 17 harness saved totals only and no per-case records; and messy real-player asks beyond the single Sep 14 case — the 92 asks are the harness's own authored phrasings, each written to target one id.

## Executive verdict

| | |
|---|---|
| **Verdict** | **PASS** — every row of the frozen table is met. No failing row. |
| Cut-off | `filing_matches_ask` < **0.50** = flagged. Chosen on odd-indexed asks only (312 judgments, perfectly separated there); every number below is even-indexed asks only. |
| Spend | **$0.442** for the run (Jev $0.0450, Haiku $0.3971) plus ≈ $0.002 for the probe. Cap was $5. No abort, no 429 exhaustion, no 5xx. |
| Calls | Jev 627 / 627 succeeded. Haiku 209 / 209 succeeded, 0 parse failures. |
| Sets B and F | **Empty — not measurable at this HEAD** (step-0 finding 2). |
| Rider (grounding chat pairs) | **Skipped cleanly** (§7). |
| Product files touched | None. Three new files; `git diff --stat` shows new files only. |

This report measures. It does not recommend adoption; adoption is a separate spec.

### The table, against the frozen bars (even-indexed asks; Jev = 3 judgments per case, Haiku = 1)

| Set | Bar | Jev | Haiku |
|---|---|---|---|
| A false alarms (overall / worst archetype) | ≤ 5% / ≤ 10% | **0.0%** (0/138) / **0.0%** | 0.0% (0/46) / 0.0% |
| C caught | ≥ 95% | **97.8%** (135/138) | 100% (46/46) |
| D caught (n = 12 cases, 36 Jev judgments) | ≥ 85% | **100%** (36/36) | 100% (12/12) |
| E flagged + out of character | yes | **yes** (3/3 flagged, 3/3 `core_conflict`) | yes (1/1) |
| 3-repeat agreement (105 cases) | ≥ 98% | **100%** on the flagged/not-flagged verdict | n/a |

---

## 1. Session and step-0 gate

**Session:** Claude Code (Fable), fresh session, read-only on the product. `git fetch origin` run first (BUILD_RULES §3). **Branch:** `claude/phase0-jev-direction-judge`, cut from `origin/main`. **HEAD at cut:** `350909113c449932025b01704096e3d549c60a5a` (merge of PR #844). Local `main` was at `a7ba95ce`, seven commits behind `origin/main`; the branch was cut from the fetched remote ref, not from local `main`.

**Markers:** VERIFIED = read at that line at this HEAD this session.

| # | Gate line | Result |
|---|---|---|
| 1 | Tree clean, branch cut as named | **Pass with a note.** No tracked modifications, nothing staged. Three **untracked files were already present** when the session opened and were not touched: `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json`, `vwap-exit-dating-census-report.json`. New files were added by explicit path. |
| 2 | The Sep 17 pre-flight harness | **Located; labels present; per-case outputs NOT saved.** Details below. |
| 3 | Menu, dial annotations, charter zones, `cautiousRegister` readable from Node | **Pass.** `src/data/archetypeAdjustments.js` is "Zero-import, Node-clean" by its own header (`:7` VERIFIED) and imports nothing. |
| 4 | `20260915_PHASE0_DIRECTIVE_GATE.md` on main, Sep 14 case verbatim | **Pass with a note** on the agent's reply. Details below. |
| 5 | Env var name and Haiku model id | **Pass.** `OPENROUTER_API_KEY` (`api/_utils/gemmaClient.js:119` VERIFIED); `claude-haiku-4-5-20251001` (`api/agent/decide.js:522` VERIFIED — §1-fenced, the string was copied and nothing imported; same id at `api/_utils/agentEvalTransport.js:48`). |

**Finding 2 — the harness.** `api/scripts/archetype-integrity-eval/` (README `:1-113` VERIFIED).
- **Fixture set:** `corpus.js` — `RAW` (`:27-187`), flattened by `buildCorpus()` (`:208-258`). 140 items; 92 are `valid_flex`.
- **Expected label:** every `valid_flex` item carries `expectedAdjustmentId: id, expectedCommit: true` (`corpus.js:218` VERIFIED); every item carries `expectedHardOutcome` (`:195-202`, stamped at `:256`). The STOP condition "cases carry no expected label" does **not** fire.
- **Invocation:** `npx vitest run --config vitest.eval.config.mjs`; the pre-flight is `EVAL_FIT_CHECK=1 npx vitest run --config vitest.eval.config.mjs` (README `:37-49`; `runEval.eval.mjs:14,:23`).
- **Saved outputs:** one file, `api/scripts/archetype-integrity-eval/last-run-report.json`, gitignored by the directory's own `.gitignore:2`. It holds `{ meta, agg, hardZeroBreaches, ts }` and **nothing per case** — the write at `runEval.eval.mjs:290-293` (VERIFIED) serialises the aggregate and the breach lists only; the per-item `records` array (`:258-265`) is discarded. The copy on disk is `ts 2026-09-18T03:50:31Z` (Sep 17, 22:50 local), `fitCheckEnabled: false` — the **baseline** run, which overwrote whatever the pre-flight run wrote. Its totals: 92 flex asks, 86 filed, 1 wrong id (a Capital Preserver case), 6 refusals (Trend Follower 1, Contrarian 1, Speculator 1, Capital Preserver 1, Diversifier 2, **Fundamental Investor 0**), 0 fit mismatches.
- **Consequence.** Which asks Gemma filed correctly, which one it mis-filed, and which six it refused are not recoverable. The spec's fallback ("B is whatever one fresh harness run produces") does not help: a fresh run writes the same aggregate-only file, and changing that means editing a file under `api/`, which this task may not touch. **No fresh harness run was made** — it would have spent ~140 Gemma calls and produced no per-case data. Sets B and F are therefore empty (§6). The script accepts `--records <file>` in the harness's own record shape, so both sets run the day those records exist.

**Finding 4 — the Sep 14 case.** From `docs/audits/20260915_PHASE0_DIRECTIVE_GATE.md` (on main via commit `6132fe5d`, VERIFIED): player's text `"Swap Core for Support (Full Defense)"` (`:77`); filed id `SP-05` (`:82`); canonical text `Spread across more names (diversify the chaos)` (`:43`). **The agent's reply is not quoted whole in that document** — it appears as two fragments, "that's the lean I'm carrying now" (`:110`) and "heavy Support floor" (`:112`). The joined sentence is on main in `docs/audits/20260916_BUILD_DIRECTIVE_FIT_CHECK.md:30` (VERIFIED): *"that's the lean I'm carrying now — trading Core momentum for a heavy Support floor"*. It was taken from there, not from memory, and may itself be an excerpt of a longer reply. It is recorded for completeness only: the wire shape's `state` has no reply field, so **the reply was never sent to either judge.** The new test pins all four strings against the two documents.

**Finding 3, detail — the dial annotations.** The fit-check build renders them in `renderMenuAnnotations` (`api/_utils/voiceLayerPrompt.js:2760-2781` VERIFIED): `[cautious register]` from `getCautiousRegister`, and `[opposite of X]` from `getConflictGroups`. That function is not exported, is flag-gated, and its module imports two §1-fenced files (`agentEvalPromptAssembly.js` at `:9`, `agentArchetypeConfig.js` at `:14`), so it was **not** imported. The script reads the same two sources directly from the data module: `cautiousRegister` (`archetypeAdjustments.js:89,:116,:143,:175,:203,:230`) and `ADJUSTMENT_CONFLICT_GROUPS` (`:342-410`), and adds the group's `dimension` as the dial name. Nothing was restructured.

**Class labels for `ask_in_character`.** The gate's own five: `VALID_CLASSIFICATIONS` at `api/_utils/directiveGate.js:75` (VERIFIED) — `in_archetype`, `flex`, `core_conflict`, `user_lever`, `research_only`. Each option's description quotes the shipped prompt's words for that class (`voiceLayerPrompt.js:101`, `:109`). "Out of character" for row E means `core_conflict` or `user_lever`; `research_only` is a null-write class (`directiveGate.js:76`) but says nothing about character, so it is excluded. The test reads the gate's source line and fails if the five labels drift.

## 2. The probe (verbatim)

One call before the run, on case E. **The live shape matches the published shape.** Fields the spec did not list but the live response carries: `id`, `provider`, `usage.input_tokens`, `usage.output_tokens`. The returned model string is dated — `typesafe/jev-1.13-20260917` — and was identical on all 627 run records. `typesafe/jev-1.13` does not appear in OpenRouter's public `/api/v1/models` list (445 models, checked this session); it is reachable only on the Decisions path. HTTP 200 in 645 ms.

Request body (the bearer header is not shown and was never written anywhere):

```json
{
  "model": "typesafe/jev-1.13",
  "state": {
    "archetype": "degen",
    "charter": {
      "immutableCore": "Chase volatility (high ATR), not safety — the chart that's on fire, regardless of what the company does (fundamentals weight ~0). Will not buy boring, stable, low-volatility blue-chips or pick for quality. Becoming a capital preserver or fundamental investor is a core reversal.",
      "tunableExecution": "Recklessness lives in SELECTION; discipline lives ONLY at the exit floor. A tuneable hard stop, wider than Contrarian's by design (tight stops get knocked out by normal high-ATR noise before the thesis plays) — the survival floor that lets a real degen last past week one. Under fear it tightens the stop a touch and offers an archetype-fitting volatile hedge (not boring protection), with an honest off-ramp.",
      "protectedBias": "Wide-default stop with small fear-tightening, a volatility threshold (ATR floor it hunts above), churn rate, and concentration dials. More cautious = tighten the still-wide stop / hunt less-extreme (still high-ATR) volatility / size down — never buy stable names or go to cash. Tuning the intensity of the chaos, never removing it.",
      "outOfScopeUserLever": "Doesn't own boring protection, shorts, or hedges as a mechanic. Adjusts its own book by conversation; hands the user toward real levers (tournament: flip a short / claim a volatile inverse; standard: coach a high-ATR inverse/high-beta screen or equip a watchlist) and, for a genuinely scared casual user, names the honest off-ramp (a hedge on their side, or a different agent for the battle).",
      "cautiousRegister": [
        "SP-01",
        "SP-02",
        "SP-06"
      ]
    },
    "menu": [
      {
        "id": "SP-01",
        "text": "Tighten the downside stop",
        "cautiousRegister": true,
        "dial": null,
        "oppositeOf": []
      },
      {
        "id": "SP-02",
        "text": "Hunt slightly-less-extreme volatility (still high-ATR, not top decile)",
        "cautiousRegister": true,
        "dial": null,
        "oppositeOf": []
      },
      {
        "id": "SP-03",
        "text": "Trade less frequently — fewer, more-committed swings",
        "cautiousRegister": false,
        "dial": null,
        "oppositeOf": []
      },
      {
        "id": "SP-04",
        "text": "Concentrate into fewer high-conviction movers",
        "cautiousRegister": false,
        "dial": "concentration breadth",
        "oppositeOf": [
          "SP-05"
        ]
      },
      {
        "id": "SP-05",
        "text": "Spread across more names (diversify the chaos)",
        "cautiousRegister": false,
        "dial": "concentration breadth",
        "oppositeOf": [
          "SP-04"
        ]
      },
      {
        "id": "SP-06",
        "text": "Reduce position size on new entries",
        "cautiousRegister": true,
        "dial": null,
        "oppositeOf": []
      },
      {
        "id": "SP-07",
        "text": "Require a stronger momentum/technical trigger before piling in",
        "cautiousRegister": false,
        "dial": null,
        "oppositeOf": []
      }
    ],
    "playerAsk": "Swap Core for Support (Full Defense)",
    "filed": {
      "id": "SP-05",
      "text": "Spread across more names (diversify the chaos)"
    }
  },
  "questions": {
    "filing_matches_ask": {
      "type": "noul",
      "instructions": "Does the filed adjustment carry out what the player asked for?",
      "criteria": {
        "true": "Same dial, same direction, same intent.",
        "false": "Different dial, opposite direction, or a different intent."
      }
    },
    "best_menu_item": {
      "type": "choice",
      "instructions": "Which single menu item best carries out the player's ask?",
      "criteria": {
        "SP-01": "Tighten the downside stop — [cautious register]",
        "SP-02": "Hunt slightly-less-extreme volatility (still high-ATR, not top decile) — [cautious register]",
        "SP-03": "Trade less frequently — fewer, more-committed swings",
        "SP-04": "Concentrate into fewer high-conviction movers — [dial: concentration breadth; opposite of SP-05]",
        "SP-05": "Spread across more names (diversify the chaos) — [dial: concentration breadth; opposite of SP-04]",
        "SP-06": "Reduce position size on new entries — [cautious register]",
        "SP-07": "Require a stronger momentum/technical trigger before piling in",
        "none_fit": "No item on this menu carries out the ask."
      }
    },
    "ask_in_character": {
      "type": "choice",
      "instructions": "Against this archetype's charter, where does the player's ask sit?",
      "criteria": {
        "in_archetype": "The ask is in-character for this archetype.",
        "flex": "The ask is tunable at the margin without reversing the immutable core.",
        "core_conflict": "The ask would REVERSE the archetype's immutable core.",
        "user_lever": "The ask is a user lever the agent doesn't pull itself (short / flip / claim).",
        "research_only": "A pure research/opinion question; no adjustment is being asked for."
      }
    }
  }
}
```

Response, verbatim:

```json
{"model":"typesafe/jev-1.13-20260917","answers":{"filing_matches_ask":{"type":"noul","noul":0.04},"best_menu_item":{"type":"choice","choice":"none_fit","probabilities":{"SP-06":0,"SP-07":0,"SP-01":0.06,"SP-04":0,"SP-05":0.25,"SP-03":0,"SP-02":0,"none_fit":0.6900000000000001},"confidence":0.64},"ask_in_character":{"type":"choice","choice":"core_conflict","probabilities":{"user_lever":0.01,"core_conflict":0.96,"in_archetype":0.01,"research_only":0,"flex":0.02},"confidence":0.95}},"usage":{"input_tokens":1651,"output_tokens":179,"cost":0.000069342},"id":"gen-dec-1789757603-IHjC2TWCahPBcyRArluU","provider":"TypeSafe"}
```

The Haiku probe (same case, `POST /api/v1/chat/completions`, model `anthropic/claude-haiku-4.5`, temperature 0, assistant turn prefilled with `{`) returned HTTP 200 in 1039 ms, served by Amazon Bedrock, `usage.cost` 0.001823. Its message content, verbatim, was the continuation of the prefilled brace:

```

  "filing_matches_ask": false,
  "best_menu_item": "SP-01",
  "ask_in_character": "core_conflict"
}
```

## 3. Case sets

Built by `buildCases()` from the harness fixtures; **no asks were authored.** RNG: mulberry32, **seed 20260918**.

| Set | n cases | How it was built |
|---|---|---|
| A — correct filings | 92 | Every `valid_flex` ask paired with its expected id and that id's canonical text. |
| B — real misses | **0** | No per-case harness records exist (finding 2). |
| C — random wrong | 92 | Every A ask paired with a different id drawn from the same menu. |
| D — opposite direction | **24** | Every A ask whose expected id sits in an adjudicated conflict group, paired with the other member. Contrarian 4, Speculator 4, Capital Preserver 4, Diversifier 4, Fundamental Investor 8. **Trend Follower 0** — its menu has no same-dial opposites (`archetypeAdjustments.js:343-345`). |
| E — named | 1 | The Sep 14 Speculator case. |
| F — refusals | **0** | No per-case harness records exist. |

**Deviation in A, stated.** The spec defines A as cases where the *filed* id equals the expected id. With no saved filings, A is every labelled ask under its expected id. The gate can only ever file an id's canonical text (`directiveGate.js`, allowlist-ids-only), so this is exactly the pair Gemma produced on the 85 it got right, plus the 7 it refused or mis-filed, where the label is still ground truth.

**The odd/even split.** Each ask has one index (its position among the 92). C and D cases inherit the index of their source ask, so no ask sits on both sides. The corpus stores two phrasings per id back to back, so the tuning half is every "b" phrasing and the reporting half every "a" phrasing: every menu id is represented on both sides, by different sentences. Even half: 46 A, 46 C, 12 D cases. E has one case and is reported as is.

**How a judgment is counted.** Jev's rates are per judgment (each of the three repeats counts), which is what a single production call would experience. A failed call or failed parse is never credited: it counts as a false alarm on A and as a miss elsewhere (there were none).

## 4. Results

### 4.1 Per archetype — A, C, D (even-indexed asks; wrong / n)

| Archetype | A false alarms — Jev | A — Haiku | C missed — Jev | C — Haiku | D missed — Jev | D — Haiku |
|---|---|---|---|---|---|---|
| Trend Follower (`momentum_chaser`) | 0 / 24 | 0 / 8 | 0 / 24 | 0 / 8 | n = 0 | n = 0 |
| Contrarian | 0 / 24 | 0 / 8 | 0 / 24 | 0 / 8 | 0 / 6 | 0 / 2 |
| Speculator (`degen`) | 0 / 21 | 0 / 7 | 0 / 21 | 0 / 7 | 0 / 6 | 0 / 2 |
| **Capital Preserver (`guardian`)** | **0 / 24** | 0 / 8 | **0 / 24** | 0 / 8 | **0 / 6** | 0 / 2 |
| Diversifier | 0 / 21 | 0 / 7 | **3 / 21** | 0 / 7 | 0 / 6 | 0 / 2 |
| **Fundamental Investor (`analyst`)** | **0 / 24** | 0 / 8 | **0 / 24** | 0 / 8 | **0 / 12** | 0 / 4 |

**Guardian and Analyst, called out:** clean on every set for both judges. Guardian's D cases are the stop-width dial (CP-04 widen vs CP-05 tighten) — the pair most like the Sep 14 failure in shape — and Jev scored all six opposite filings at or below 0.32. Analyst carries two dials (rotation patience, concentration breadth) and twice the D cases; all twelve caught.

**The one Jev miss**, all three repeats: `C:diversifier/flex/DV-02/a>DV-07`, probabilities 0.66, 0.68, 0.72. The expected id is DV-02 "Widen the spread (target more sectors)"; the wrong filing shown was DV-07 "Prioritize filling an under-represented sector on the next add". Both move the book toward more spread; they are not in a conflict group. Jev still named DV-02 as the best menu item on all three repeats while scoring the DV-07 filing as a match. That takes Diversifier's C row to 85.7% caught; the C bar is overall-only, and overall is 97.8%. Haiku marked the same filing false.

**Not in the reported numbers, stated for completeness:** on the odd (tuning) half, Jev separated every case (lowest correct filing 0.84, highest wrong filing 0.28). Haiku had one miss there — `C:analyst/flex/FI-05/b>FI-01`, judged a match.

### 4.2 Margin around the cut-off

Jev returns probabilities to two decimals. On the even half the lowest score on a correct filing was **0.82** and, the DV-07 case aside, the highest score on a wrong filing was **0.32**. Any cut-off from 0.33 to 0.66 gives the identical table. 136 of 209 cases returned the same probability on all three repeats; the largest within-case spread was 0.06.

### 4.3 `best_menu_item` — top-1 agreement with the expected id (reported, no bar)

| | On A (even) | On A (all 92 asks) | On C ∪ D (even — the filing shown is wrong) |
|---|---|---|---|
| Jev | 138 / 138 | 276 / 276 | 174 / 174 |
| Haiku | 46 / 46 | 92 / 92 | 58 / 58 |
| Gemma (the voice layer itself) | — | **85 / 92 = 92.4%** | — |

Gemma's figure is from the saved Sep 17 baseline run (`last-run-report.json`: 86 filed, 1 wrong id, 6 refusals), one pass, fit check off. It is the whole 92, not the even half, because per-case results were not saved; and Gemma was writing a reply and a proposal in one call under the full chat prompt, while the judges were asked one narrow question. The two are not like for like. Both judges picking the expected id even when shown a wrong filing says they are reading the ask, not echoing the filing.

### 4.4 Calibration — Jev, `filing_matches_ask` (even half, A ∪ C ∪ D, 312 judgments)

| Probability | n | Share that truly matched |
|---|---|---|
| 0.0–0.2 | 168 | 0% |
| 0.2–0.4 | 3 | 0% |
| 0.4–0.6 | 0 | — |
| 0.6–0.8 | 3 | 0% |
| 0.8–1.0 | 138 | 100% |

**Monotone: yes** (non-decreasing across the filled buckets). The scores are bimodal rather than graded: the three judgments in 0.6–0.8 are the one DV-07 case and all three were wrong, so on this corpus the middle of the scale carries no information either way.

### 4.5 `ask_in_character`

Every A, C and D judgment landed on `in_archetype` or `flex` for both judges — never an out-of-character label on an in-character ask. But the choice between those two is unsteady: Jev's three repeats agreed on the label for 90.5% of cases, and the label shifted with the filing shown (A: 127 `in_archetype` / 149 `flex`; C: 100 / 176). The gate treats the two identically, so nothing downstream moves; the label is not a reliable way to tell `in_archetype` from `flex`. On E all four judgments said `core_conflict`.

### 4.6 Latency and cost

Measured from the founder's Windows 11 machine on its local network, Node 22.20, concurrency 4 — **not Vercel**, and not a region close to the provider by design.

| | p50 | p95 | max | Total cost | Per 1,000 judgments |
|---|---|---|---|---|---|
| Jev (627 calls, 3 questions each) | 329 ms | 1,847 ms | 2,988 ms | $0.0450 | **$0.072** |
| Haiku via OpenRouter (209 calls) | 905 ms | 2,531 ms | 4,701 ms | $0.3971 | **$1.90** |

A "judgment" is one call answering all three questions. Both costs are OpenRouter's `usage.cost`; every call reported one.

## 5. Set E — what it would have done on Sep 14

`degen` · ask "Swap Core for Support (Full Defense)" · filed SP-05 "Spread across more names (diversify the chaos)".

| | `filing_matches_ask` | `ask_in_character` | `best_menu_item` |
|---|---|---|---|
| Jev ×3 | 0.04, 0.04, 0.04 → **flagged** | `core_conflict` ×3 (probe: 0.96) | `none_fit` ×3 (probe: none_fit 0.69, SP-05 0.25, SP-01 0.06) |
| Haiku ×1 | false → **flagged** | `core_conflict` | SP-01 |

The two judges disagree on the third question: Jev says nothing on the Speculator menu carries out "Full Defense"; Haiku offers SP-01 (tighten the stop), the first id in the charter's cautious register.

## 6. Sets B and F — case by case

**B: no cases. F: no cases.** Neither exists at this HEAD (step-0 finding 2). The named watch for F, the Analyst, had 0 refusals of 16 in the one saved aggregate; nothing per-case can be said about any archetype.

## 7. Rider — grounding chat pairs: skipped

The pairs live in the production `shadow/conversations/` stream and are read by `api/scripts/voice-grounding-harness.js`. Two conditions fail. **(1)** That script's read path imports `api/agent/chat.js` and `api/_utils/voiceLayerPrompt.js` (`voice-grounding-harness.js:79,:85` VERIFIED), whose import graph includes §1-fenced modules; this task may import nothing from fenced files, so "the same path the walk already uses" is not available to it. **(2)** The shadow record's grounding fields are "the mode, both prompts, both history windows" (`api/agent/chat.js:393-396` VERIFIED). A "receipts block" is not one of them — it would have to be cut out of `systemPromptNew` by new extraction logic — and no validator shadow verdict is stored beside the pair, so the rider's state and its comparison column would both be authored here rather than read. No request was sent under `data_collection: "deny"` or otherwise; no player chat text left the machine. The script still carries the `deny` switch (`buildJevRequest(c, { denyDataCollection: true })`, tested) for whoever specs the rider properly.

## 8. What this run did not measure

Facts about scope, not qualifications of the verdict.
- **The asks are clean.** All 92 were authored for the harness, two phrasings per menu id, each aimed at one id. Both judges named the expected id 100% of the time, which says the set is unambiguous. The only real player text in the run is case E, n = 1.
- **No real misses, no refusals** (B, F).
- **C's wrong ids are random**, so most are far from the ask. The one near-neighbour that came up is the one Jev missed. D is the adversarial set and is small: 12 reported cases.
- **One model snapshot, one afternoon.** `typesafe/jev-1.13-20260917` on an alpha path that may move.
- **Haiku ran through OpenRouter** (`anthropic/claude-haiku-4.5`, canonical `anthropic/claude-4.5-haiku-20251001`, served by Bedrock), because the experiment has one key and one spend source. The Trading Brain calls Anthropic directly with `CLAUDE_API_KEY` (`decide.js:91`); same snapshot, different route, so its latency here is not the Trading Brain's.

## 9. Found outside the task (for separate tasking — nothing was fixed)

- `runEval.eval.mjs:290-293` discards the per-item `records` it has in hand. Writing them into the gitignored `last-run-report.json` would make B, F and any future per-case reading possible. It is an edit under `api/` and was not made.
- The saved report is overwritten by every run, so the Sep 17 pre-flight numbers (`EVAL_FIT_CHECK=1`) no longer exist on disk; only the later baseline run does.

## 10. Files, commands, suite

New files only:
- `scripts/experiments/jevDirectionJudge.js` — the experiment. Imports two zero-import data modules (`src/data/archetypeAdjustments.js`, `api/scripts/archetype-integrity-eval/corpus.js`) and nothing else from the repo. Fenced functions called: none. Fenced files edited: none.
- `scripts/experiments/jevDirectionJudge.test.js` — 30 tests, mocked transport only.
- this report.

To reproduce (mirrors the `--env-file` idiom of `api/scripts/voice-grounding-harness.js`):

```bash
node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --probe
node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --run
```

Raw per-case records, the probe files and `summary.json` are in `scripts/output/jev-direction-judge/` (gitignored by `.gitignore:45`). The key was read from the environment, sent only as the bearer header, and appears in no file or log.

**Full suite — NOT green on this machine, and not because of this branch.** `npx vitest run`, unpiped, exit code captured: **exit 1** — 27 failed files / 36 failed tests out of 694 files / 13,431 tests. The new test file passed 30 / 30.

The failures are this Windows checkout, not the change. Their messages are backslash paths (`expected [ 'apihealth.js' ] to deeply equal [ 'api/health.js' ]`), CRLF source text under `core.autocrlf=true` breaking source-hash and source-snapshot tripwires, `ERR_UNSUPPORTED_ESM_URL_SCHEME` on `C:` imports, and a local `.env` value reaching a test that expects a stub. To check rather than assume, the same command was run on a clean `git archive` extraction of the cut HEAD `35090911` in the session scratchpad, with none of the new files present: **exit 1 there too, 33 failed files / 40 failed tests.** 26 of this branch's 27 failing files fail identically on that clean snapshot. The 27th, `api/_utils/p4Equivalence.battery.test.js`, fails on three "source is frozen" snapshots of `api/agent/decide.js` whose printed diff shows every line identical except its line ending; `decide.js` is unmodified (`git status` shows no tracked change). No test that scans the tree reaches the new files: the §2.3 import-boundary ratchet walks `api/` and `src/` only (`api/_utils/archetypeRegistry.test.js:243-244`), and the new script imports no legacy archetype table. The Linux CI run on the pushed branch is the suite result of record; per BUILD_RULES §2 the founder reads it.

STOP.
