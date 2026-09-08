# Cumulative code review — record rendering, access control, record durability

**Branch:** `claude/record-rendering-access-control-3fl89z`
**Base:** `origin/main` @ `0e04833d` (fetched at session start; clean tree, on the assigned branch)
**Reviewed at:** `b462da8b` (the five build commits)
**Trigger:** BUILD_RULES §2 — review is mandatory at ≥10 files OR ≥1500 lines on the cumulative branch diff. The build measured **16 files / 986 lines**, so the file threshold was crossed.

**Verdict:** two blocking findings, both in the build's own claims rather than in code it left broken; both fixed. Nine further findings confirmed and fixed, four refuted, three narrowed. The mechanical guards were green throughout — the failures were concentrated in what the build *asserted* about itself.

---

## Executive verdict

| # | Finding | Severity | Disposition |
|---|---|---|---|
| D1-1 | The assembled grounded prompt still shipped `guardrail_stopLoss` — RECENT TRADES prints `trades[].rationale` raw, the same cron string YOUR RECORD renders translated | **blocking** | **CONFIRMED — fixed** (`488e0c2c`) |
| D4-1 | The 2s shadow-settle cap was the only unclamped timeout in the handler; measured 30,400ms against a 30,000ms ceiling | blocking → **material** on refutation | **CONFIRMED (narrowed) — fixed** (`4d8100d0`) |
| D6-1 | The durability block claimed these GCS records are §5 catalog events; the catalog names `chatExchanges[]`, and the same file said so twice | material | **CONFIRMED — fixed.** Refutation found the two anchors that settle it: Implementation Spec §2 says "Nothing rides the fire-and-forget shadow logger", and the Sep 7 Phase 0 report ruled on this exact write — "permitted — BUILD_RULES §5 binds catalog events only". §5 *permits* what commit 5 changed; it is fixed on the cautionary tale, not the rule. |
| D4-3 | `captureConversation` documented "never throws" while calling the runtime hook outside any try/catch — a throw escapes the handler's catch and answers with nothing | material | **CONFIRMED (trigger hypothetical) — fixed** |
| D4-5 | `waitUntil` "so the record completes" overstates a best-effort hook; the cap's residual loss window never stated | material | **CONFIRMED as prose — fixed** |
| D3-1 | A chip minted at 'on' outlives a walk-back; every tap 404s into a line promising a retry that cannot work | material → **narrowed** ("permanently" refuted; D-90 sub-claim refuted) | **CONFIRMED (narrowed) — fixed** |
| D5-2 | The client-side kill switch could be deleted with the whole suite green | material | **CONFIRMED — fixed** |
| D5-1 | The mount-site window truncated at the `>` inside an arrow function; reddened on cosmetic reorders | material | **CONFIRMED — fixed** |
| D5-3/D5-4 | The chat.js source tripwires were both brittle (`2_000`→`2000`) and loose (decoy comment; `void`-prefixed reintroduction) | material | **CONFIRMED — fixed** |
| D6-6 / D4-2 | A fourth member was added to a pinned timing "system" and nothing pinned it | material | **CONFIRMED — fixed** |
| D6-7 | Two headers still promised a rationale rendered "verbatim" | material | **CONFIRMED — fixed** |
| D6-5 | The §2 flag reconciliation named two docstrings; there were three | material | **CONFIRMED — fixed** |
| D1-3 | `renderMotive` called "the ONE place a rationale becomes read text" — Flat6BattleView renders raw and is live | minor | **CONFIRMED — prose fixed; the pane is reported, not changed** |
| D2-1 | The binding predicate's test header stated a reason this branch falsified | minor | **CONFIRMED (reason false, conclusion survives) — fixed** |
| D2-2, D2-3, D3-5, D6-3, D6-4 | Nine stale `file:line` citations, several broken by this branch's own inserted lines | minor | **CONFIRMED — fixed** |
| D5-5, D5-6, D5-7, D5-8, D5-9 | Rows whose titles overclaimed relative to what they falsified | minor | **CONFIRMED — four fixed, one self-declared and left** |
| D6-8/9/10/11 | Stale labels, an omitted import in an enumeration, a wrong precedent count, quotation marks round a paraphrase | minor | **CONFIRMED — fixed** |
| **D4-6** | A throw between capture and settle abandons the success record | claimed material | **REFUTED** — proved impossible: the earlier-started write with equal latency always completes first, and when it does not, the error record is lost too. Not fixed, deliberately. |
| **D1-2** | `GUARDRAIL_TYPE_WORDS` unreachable from any cron-producible rationale | claimed material | **REFUTED in its conclusion** — the table *is* reachable via `reinforced_haiku` with an absent `symbolIn`. The fixture-realism half survived and is covered by a new row. |
| **D3-3** | Spec §10's "the route 404s at 'off'" is stale | claimed minor | **REFUTED** — still true, merely incomplete. |
| **D3-4** | D-104 must be amended | claimed minor | **REFUTED as a build defect** — it is a record of the Sep 7 ruling; amending it is the design chat's act. |
| **D3-6** (leak half) | 400-before-404 leaks the route's existence | claimed minor | **REFUTED** — an authenticated caller reads the same contract in the shipped bundle, and the moved gate leaks *less*. The coverage half was confirmed and fixed. |

---

## How the review was run

Six independent lenses, each on its own **snapshot tree** (`git archive HEAD` extraction under the session scratchpad, `node_modules` symlinked), read-only on git and on the shared working tree — the reviewer-isolation rule added Sep 2 after a byte-exact restore overwrote a coordinator's in-flight fixes:

| Lens | Dimension |
|---|---|
| D1 | The motive translation reaching the grounded prompt |
| D2 | The ensure-opener binding tightening and its client wiring |
| D3 | The `file-directive` access gate |
| D4 | Durability, lifecycle, timing budget, concurrency |
| D5 | Test integrity — 53 mutations applied, row by row |
| D6 | BUILD_RULES compliance and prose honesty |

Every finding was then handed to a **refuting** reviewer with instructions to break it with a concrete repro. Four findings fell, three were narrowed, and two refuters produced better fixes than the original findings proposed. The mutation checks below were re-run in the working tree after each fix.

**Reviewer conduct note:** one refuter reported that its `cp -a` source had been caught mid-mutation by a sibling agent and cross-verified byte-identity against four snapshots before running anything. The mutation lens was moved to a dedicated tree as soon as that risk was identified. No reviewer wrote to the shared tree.

---

## Mutation checks (the ones that decide the guards)

| Guard | Mutation | Result |
|---|---|---|
| Grounded prompt carries no code | RECENT TRADES back to raw bytes | RED |
| Flag-off surface frozen | translator applied unconditionally | RED (7 golden rows) |
| Record renders translated | `renderMotive` → identity | RED |
| Author labels distinct | `MOTIVE_SYSTEM` text = `MOTIVE_AGENT` | RED |
| Settle clamped | clamp removed (flat 2s) | RED |
| Hook throw contained | try/catch removed | RED (2 rows) |
| Cap warning attributable | `battleId` dropped | RED |
| No fire-and-forget returns | `void logConversation({…})` added | RED |
| Binding unconditional | `agentId !== undefined &&` restored | RED |
| Client sends the id | `agentId` dropped from the POST body | RED |
| Each caller passes the prop | prop deleted at either mount; third unpropped mount | RED |
| Client kill switch | gate deleted | RED |
| Gate is `=== 'on'` | reverted to `=== 'off'` | RED (2 rows) |
| Gate checked FIRST | gate moved below the body validation | RED |
| Gate before any read | a plain read inserted ahead of it | RED (3 rows) |
| 404 line honest | 404 back to the catch-all | RED |
| Predicate's falsy guard | `agentId.length > 0` dropped | RED |
| Flag pin honest | flag flipped to false | RED (actionable `file:line`) |

`vite build` — the only check that catches a syntax error in `App.jsx`, since no test imports it — run explicitly: **exit 0**.

### Corrections the refuters made to the fixes themselves

The refutation pass was not only a filter on findings; it corrected three things in the repairs:

- **The `waitUntil` precedent count was still wrong after the first fix.** "Six sibling routes" became "nine"; the real figure is **eight** (nine files in `api/agent/` use it, and `equip-bundle.js` is one of them). Corrected.
- **The §5 framing was true but unanchored.** The rewrite asserted these are not catalog events without citing what makes that so. It now quotes Implementation Spec §2 and the Phase 0 ruling on this write by name, so the claim is checkable rather than merely asserted.
- **The repaired mount-site window was still brittle in one direction.** Splitting on the closing `/>` fixed the arrow-function truncation and the prop-reorder false positive, but a prop *wrapped across lines* still read as absent. The match is whitespace-insensitive now, and `it.each` is driven off the discovered mounts rather than a fixed pair — so a third unpropped mount reds on its own row as well as on the count. Verified green on a reflow, red on a deletion at either mount, red twice on a third mount.

One claim in an earlier commit message did not survive: `voiceLayerGrounding.js`'s IMPORTS paragraph was described as "ending mid-sentence". It was a complete sentence on a short line — the signature of an in-place deletion, not a truncation. The substantive half (a four-import list enumerated as three, which dropped `archetypeAdjustments.js` out of the §4 guard's stated scope) stands and is fixed.

---

## Reported, not fixed (for separate tasking)

1. **`Flat6BattleView.jsx:328-329` renders `evaluations[].rationale` and `.hypothesis` as stored bytes.** Live on five mount paths; a League owner sees the cron's `guardrail_*` code and its doubled prefix today. Putting it on the shared renderer changes what a player reads — a founder-gated surface change, not a sweep. The docstring in `decisionRecord.js` now names it as the exception rather than claiming it away.
2. **Spec §6.1 (`VOICE_LAYER_GROUNDING_SPEC_V1_2.md:97`) still states the route's gate as `≠ 'off'`.** It is the live contract, and the build's own supersession note originally missed it (that note is corrected). The spec re-versions rather than being patched by a build session; D-104 and spec §10 are records of the Sep 7 ruling and are the design chat's to amend.
3. **The shared grounding fixture stores an undoubled guardrail rationale** (`voiceGroundingFixtures.js:89`, `:194`) that the ordinary forced-exit path never emits. Not changed here: the fixture feeds the flag-off goldens, whose own header requires regeneration from a pre-grounding snapshot. New rows cover the production doubled shape and the fallback shape instead.
4. **Four sibling handlers still write the same `conversations` stream fire-and-forget** — `api/forge/workshop-chat.js:465` and `:608`, `api/forge/watchlist-analysis.js:590`, `api/screener/chat.js:417`.
5. **Inherited stale anchors in touched files** that predate this branch: `ensure-opener.js:49`, `:119`, `:214`, `:245` (four `decide.js` citations), `selectWhyState.js:112`, and three in `chat.test.js`.
6. **`ensure-opener.js`'s `422 'battle has no agentId'` branch is now unreachable** through the handler — a battle with no `agentId` matches no body id, so the unconditional binding check refuses it first. Retained as defence in depth against a reordering; its row says so rather than pretending to guard it.
7. **`GUARDRAIL_TYPE_WORDS`'s translation branch is dead on every ordinary forced exit** — the dedupe consumes the parenthetical first. Its one live cron path is `reinforced_haiku` with an absent `symbolIn`, now covered by a row.

---

## Fence and ratchet

No §1-fenced file was edited. Fenced functions **called** (as they already were): `computeTimeRemaining` and `getArchetypeLabel` from `voiceLayerPrompt.js`. No new direct importer of a legacy archetype table, so the §2.3 baseline is unchanged — `archetypeRegistry.test.js` green. The §1 flag-split prose rule needs no registry entry for `decisionRecord.js`: the sweep is `api/_utils`-only and reaches modules through same-directory `./` imports of the two fenced assemblers, neither of which imports it. `agentEvalPromptAssembly.honesty.test.js` green.
