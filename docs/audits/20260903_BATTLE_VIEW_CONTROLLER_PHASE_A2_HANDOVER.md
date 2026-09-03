# Battle View controller — Phase A2 (A2.0 → A2.2) handover

**Date:** September 3, 2026
**For:** the founder (the smoke after A2.2), Sol (the D-76 pass), and the A2.3 / A2.4 session.
**Prepared by:** Claude Code, under `docs/BUILD_RULES.md`.
**Inputs:** `PHASE_A2_SEED_TAPE_AND_PIECE_V1.md` (the seed) and **`20260902_BATTLE_VIEW_CONTROLLER_PHASE_A2_PHASE0_REPORT.md` — Phase A2 rulings and amendments after Phase 0 (V1)**, which wins wherever the two disagree. Both were attached to the build session; the rulings document is committed on this branch as the Phase 0 report's companion.
**Branch:** `claude/phase-a2-tape-piece-javcyf` — the branch the rulings document names. The harness assigned this session `claude/phase-a2-rulings-amendments-slkui4`; per the rulings document ("the harness-assigned branch of any later session is not used") and the founder's confirmation at session start, it is unused.
**Base:** `056a4c14` (the Phase 0 report, this branch's docs-only first commit) on `bf4bc84f` = `origin/main`.
**Commits:** A2.0 `b2c18b0f` · A2.1 `5ed5fa8c` · **A2.1b `ff98084f`** · A2.2 `57824041` · the handover and ledger rows `c9ecbd97` · **the adversarial review's confirmed fixes `a16e6d37` and after**.
**Flag:** `BATTLE_VIEW_CONTROLLER_ENABLED = false`, unchanged. No new flag. Smoke override `?battleViewController=1`.
**STOP:** this session ends here, for the founder's smoke after A2.2. **A2.3 (the piece scope) and A2.4 (the peek line and the desktop collapse) are the next session's**, as the rulings document sequences them. No PR opened.

---

## 1. Founder smoke — after A2.2

Open the branch's **Vercel preview** (the deployment for `claude/phase-a2-tape-piece-javcyf`; its URL is on the Vercel dashboard — this environment has no Vercel or Firestore access). Open a **live BaggerBomb battle** and append `?battleViewController=1`.

Phase A's eleven steps still hold. These are the new ones.

1. **Tap a piece that the last check named.** The panel now opens with:
   - `Bagger $153.12 · Bust $144.28` and, under it, `from the scoring path`. Check the arithmetic against the row's own percent: at the bagger price the row's `%` would read exactly `+{baseATR}`, at the bust price exactly `−{baseATR}`. **No stop line and no alert line** — neither has a persisted source (D-78, D-79).
   - `This piece today`, unchanged.
   - `From the {t} check`, the state label, and **only the sentences of that check that name this piece**, verbatim. The whole paragraph is gone from the row.
   - `Read the full check` — tap it: the **book panel** opens (beneath the score header, above the board). That is where the whole paragraph lives now.
   - The facts line and `Ask a follow-up · 1 message`, unchanged.
2. **Tap a piece the check did NOT name.** `Not named at the {t} check` — a truthful state, with `Read the full check` still there. Tap a piece on a tick that recorded no words at all (an outage): no "not named" line, because the label already carries the tick.
3. **The plan at deploy (A2.1b — Sol's to sustain or revert).** On a battle deployed by the model, the book panel carries the brief under `The plan at deploy · {date}`, and a row whose tier rationale names it carries those sentences under `At deploy · Core tier` with the same date beneath. On a **tournament** battle and on an **algorithmic-fallback** deploy the section is absent whole — no label, no placeholder.
4. **Scroll the chat.** It is now a tape:
   - Every executed swap is a card: `1:31 PM · GILD → MOS · Core`, `Banked 8.0 pts`, the motive verbatim, and beneath it **whose words it is** — `The agent's own words` on the model's own swap, `The system's reason` on a risk-manager, guardrail or R11 exit. `↳ from directive` rides the card when the model echoed one.
   - Every decided check is a card: `At the 3:46 PM check · Held`, the first sentence, `Read more` for the rest. A downgraded / failed / guardrail-forced / outage check carries the same label the Why? panel gives it.
   - A run of quiet checks reads `4 checks · no change`.
5. **A tick woken by a price drop** reads `Woken by a price drop` beneath the label, on the check card and inside Why?. No other trigger type says anything yet (§5).
6. **The dashboard Desk, after the last check of a session** (roughly 3:46 PM ET onward, before the close): `Checked 3:46 PM · last check today` instead of a bare `Checked 3:46 PM`. **This one is not behind the controller flag** — the Desk has none. See §4 item 40.
7. **Remove the query string.** Everything flag-off is exactly what ships today; the two goldens prove the first paint byte for byte.

**Expect (not bugs):** a swap that a guardrail forced but that never executed produces **no** trade card (it is not in `trades[]`); a `hold` feed line renders nothing (the check card owns that tick); a trade narration stays a message beside its card.

---

## 2. Files touched — A2 cumulative (26 files at `57824041`)

| Area | Files |
|---|---|
| Adapter | `src/adapters/baggerbombAdapter.js` (`deriveLastCheckOfSession`, the `lastCheckOfSession` field), `baggerbombAdapter.test.js` |
| Desk (D-71, shared string) | `src/components/Dashboard/desk/deskCopy.js` (`postureLastOfSession`), `AgentDesk.jsx`, `AgentDesk.render.test.jsx` |
| Battle View selectors | `src/screens/battleView/selectWhyState.js` (the fifth state, `symbolPattern` / `namesSymbol` / `splitSentences` / `extractSentences`, `deriveTierPrices`, `state.triggers`), `deriveTurnLine.js`, `deriveReceipts.js` (`directiveFilings` extracted), **`selectDeployPlan.js`** (new), **`buildTape.js`** (new) |
| Battle View surfaces | `WhyPanel.jsx` (V2), **`TapeCards.jsx`** (new), `battleViewCopy.js` |
| Chat | `src/components/Agent/AgentChat.jsx` (the `tapeEntries` prop; the tape merged into the one `combinedTimeline`; the card replaces `TradeTickerCard` under the flag) |
| Screen | `src/screens/AgentBattleScreen.jsx` (the `thresholdBaseline` lift; the `deployPlan` and `tapeEntries` memos; `handleReadFullCheck`; the panel props) |
| Theme guards | `src/theme/tokens.guard.test.js`, `tokenGuardBaseline.json`, `motion.guard.test.js`, `motionGuardBaseline.json` — the three new battleView files added to both lists **in the commits that created them** (hazard 34) |
| Tests | `selectWhyState.test.js`, `selectDeployPlan.test.js`, `buildTape.test.js`, `WhyPanel.render.test.jsx`, `TapeCards.render.test.jsx`, `deriveTurnLine.test.js`, `AgentBattleScreen.controller.jsdom.test.jsx` |
| Docs | this handover; the A2 review record; the ledger (D-69 → D-79) |

**Nothing under `api/`.** No fenced file edited. Fenced functions **called**: none. Fenced files **READ by test tripwires** (permitted, BUILD_RULES §1): `api/_utils/agentGuardrails.js` (the `guardrail_` prefix and the `forced_exit` / `reinforced_haiku` actions), `api/agent/decide.js` (the prescribed-tournament brief and the `Algorithmic selection` fallback template). Non-fenced files read by tripwires: `api/cron/agent-evaluate.js`, `api/_utils/agentTriggerGate.js`. No archetype-table importer added. No Firestore read or write, no fetch, no model call.

---

## 3. Strings

**Every string the seed §3 ruled for A2.0 → A2.2 ships, character-exact**, except the two the rulings document struck:

| Seed §3 string | Shipped | Where |
|---|---|---|
| `Bagger {$} · Bust {$}` | `Bagger $153.12 · Bust $144.28` | `battleViewCopy.tierPrices` |
| `Stop {$}` | **struck** (ruling 2 / D-79 — no persisted price; the entry basis is fenced-private) | — |
| `Alert line {$}` | **struck** (ruling 3 / D-78 — a wake-up trigger, not a rule) | — |
| `from the scoring path` | ✓ | `battleViewCopy.fromScoringPath` |
| `the agent's rule` | **struck** with the alert line — no line remains that it could foot | — |
| `From the {t} check` | ✓ | `battleViewCopy.fromCheck` |
| `Read the full check` | ✓ | `battleViewCopy.readFullCheck` |
| `Not named at the {t} check` | ✓ | `battleViewCopy.notNamedAtCheck` |
| `The plan at deploy · {date}` | ✓ (A2.1b) | `battleViewCopy.planAtDeploy` |
| `Read more` | ✓ | `battleViewCopy.readMore` |
| `{t} · {out} → {in} · {tier}` | ✓ | `battleViewCopy.tradeCardLine` |
| `Banked {n} pts` | ✓ | `battleViewCopy.banked` |
| `At the {t} check · Held` | ✓ (composed from `atCheck` + the state label, so it cannot disagree with Why?) | `battleViewCopy.checkCardLabel` |
| `{n} checks · no change` | ✓ | `battleViewCopy.checksNoChange` |
| Desk: `Checked {t} · last check today` | ✓ | `deskCopy.postureLastOfSession` |
| `In the chat · {n}`, `{sym} · All`, `Collapse the chat` / `Expand the chat` | **not built** — A2.3 / A2.4 | — |

**From the rulings §2 directive 10, beyond the seed's §3:** `No decision recorded at this check · the evaluation did not complete` (D-69) · `A guardrail called for a swap · it did not go through` / `The guardrail's reason · the position stayed as it was` (D-70) · `Woken by a price drop` · `The agent's own words` (standalone; the Phase A footer that embedded it is unchanged) · `The system's reason` · `At deploy · {tier} tier` · `↳ from directive` (added to the copy module for the card, same characters; the shipped inline copy in `AgentChat.jsx:1059` **stays** — it is the flag-off path and the golden pins it. The two are pinned equal by the card's render test).

Copy guard (`deskHonesty.test.js`, 197 rows, scans `battleViewCopy.js` and every component in `src/screens/battleView/`): clean. `Woken by` is not on the forbidden list, and no new string carries a forbidden verb.

---

## 4. CONSTRAINED — for the ledger (Phase A's items 1–36 stand; A2 adds 37 →)

37. **The row's eyebrow changed.** A row now reads `From the {t} check`; `At the {t} check` is the **book panel's** eyebrow only. One string each, so a row can never claim to be the whole check. The seed named both strings and did not say which panel keeps which; this is the reading that lets each carry its own meaning.
38. **`Read the full check` opens the book panel, it does not scroll to it.** The book panel sits beneath the score header, above the board; a row lower down the board may be below the fold when it opens. No scroll or focus move was added (Phase A's focus rules are the sheet's, and a scroll would fight the mobile sheet). If the founder wants the panel brought into view, that is a small follow-up.
39. **The fifth state's pair is carried but not rendered.** `selectWhyState` puts the guardrail override's `symbol → replacementSymbol` on the state (Phase 0 §3 specifies where the pair comes from, because the entry's own `symbolOut`/`symbolIn` are null on a downgraded HOLD). No surface renders it this phase — the label is fixed text and the system's rationale already names the symbols. It is there for a later surface that wants it.
40. **D-71 is NOT behind the controller flag.** The Desk has no controller flag, and D-71 was ruled as a shared Desk string (seed §2, "Desk string (shared), Desk golden updated in the same commit"). So a real user on the dashboard sees `Checked 3:46 PM · last check today` where they previously saw `Checked 3:46 PM`, from the moment this merges — during a live battle, after the last quarter-hour slot of the session. It is a strict improvement (the bare line read as a starved cron) and it is what the ruling asked for, but it is the one user-visible change in A2 that does not wait for the flip. **Flagged for the founder explicitly.**
41. **The tape's "positions unchanged" is enforced by ADJACENCY, not by a position snapshot.** D-77 requires the position set to be unchanged across a collapsed run. No evaluation entry carries the position set, so the guard is structural: every executed swap is a trade card in the same stream, so a swap between two checks breaks their adjacency and their run. A position change that leaves no `trades[]` record would slip it — none exists today (`trades[]` is the one list of executed swaps, Phase 0 §2.6).
42. **A message between two quiet checks breaks the run.** A collapsed line occupies one slot in the stream, so it may only ever stand for a contiguous slice. This is stricter than D-77's letter and is the only ordering that can work.
43. **The motive's author is the persisted `source`, not a prefix match.** Ruling 5 describes the three system cases by their rationale text (`Guardrail override (…)`, `Risk manager: …`, the R11 message). The code reads `trades[].source` instead — one persisted fact rather than three string matches, and it catches the R11 case, whose rationale is a bare `statusMessage` with no recognisable prefix. A test tripwire reads the cron to prove the two descriptions agree. An unknown `source` defaults to `The system's reason`: under-crediting the agent is the safe direction under C1.
44. **`source` is read, never rendered.** Hazard 12 / D-64 keep `source` off the screen; using it as a discriminator is a read. The built entry carries no `source` key at all, so no card can surface it by accident.
45. **The check card calls `selectWhyState` with each entry's own timestamp.** The selector's `>=` join exists to tell the latest check from a stale one; every entry on the tape is the latest check of its own moment. Passing the battle's `lastScoredAt` would render every card but the newest as `No decision recorded`.
46. **`deriveTierPrices` returns null for a short.** `thresholdPriceChange` is direction-adjusted upstream, so a short's bagger is a price *decrease*, and no persisted short exists to check that inversion against (the agent layer is long-only in V1). Omitting is the honest answer until one does; the branch is dormant today.
47. **The deploy plan's fallback gate is a string match, by necessity.** The doc carries no `models` stamp, so `innerMonologue.strategy` beginning `Algorithmic selection` is the only available discriminator (Phase 0 §2.4 says so). A source tripwire reds if `decide.js` rewords the template, rather than letting the gate fail open and ship the template as the agent's plan.
48. **The deploy plan renders model-authored prose verbatim**, exactly as Why? already renders `rationale` verbatim (C1). The copy guard scans source files, not persisted text, so a brief containing a forbidden verb would render it. That is the standing property of every verbatim surface on this screen, not a new one.
49. **`Banked {n} pts` renders a negative value as it stands** (`Banked -3.2 pts`) — a locked loss is a scoreboard fact. `Banked 0.0 pts` likewise.
50. **A2.1b is revertible in isolation** (`ff98084f`): reverting it removes `selectDeployPlan.js` and its guard entries, the two copy helpers, the panel's section and the screen's memo and props, and leaves A2.1's Why? V2 intact. It is the commit Sol's pass acts on. **This was not true when A2.1b was written** — it introduced `TIER_LABEL`, which A2.2 then consumed, so the revert silently deleted the declaration and left every trade card throwing (review L5-F1). It is now a `tierLabel()` function neither commit's diff resembles, verified by performing the revert in a scratch worktree.
51. **The motive's author is the RATIONALE, not `source`** (review L1-F3 / L1-F4). `isEngineAuthoredMotive` matches three prefixes — `Guardrail override`, `Risk manager:`, `Deterministic guardrail enforcement` — each pinned to its writer by a source tripwire. A new engine writer with a new sentence shape would be labelled the agent's, which is why the tripwires enumerate the shapes: whoever adds one sees the list.
52. **A machinery-provenance code reaches the screen inside the engine's own verbatim sentence** (`Guardrail override (guardrail_stopLoss): …`). C1 renders a motive verbatim; hazard 29 keeps that class off the screen. **A founder copy question**, recorded rather than decided — the render test pins the token's presence, so flipping the expectation is a one-line change when it is ruled.
53. **`{n} checks · no change` also requires the two cards to render the same line**, not only D-77's data conjuncts (review L1-F6). Every evaluation entry carries a trigger and exactly one type has a ruled string, so adjacent quiet checks routinely differed in what they showed while agreeing on every data conjunct — folding them deleted a line the player was shown. A scoring-tier crossing still folds: that is D-77's stated exclusion (the live score moves every tick and the board shows it), refuter-confirmed as design rather than defect, and now pinned by a row.

---

## 5. The other trigger types — CC's list, with a proposed string each (ruling 3)

`api/_utils/agentTriggerGate.js` persists nine types (`agent-evaluate.js:2651` writes `triggers.map(t => t.type)`). One is ruled and ships; the other eight render **nothing** until each has its own founder-ruled sentence. Proposals, each a scoreboard fact and none a forecast:

| Type | Gate | Proposed string |
|---|---|---|
| `price_drop` | an active asset at ≤ −0.5× ATR from entry | **`Woken by a price drop`** — RULED, ships |
| `forced_open` | the first evaluation of the battle | `Woken by the first check of the battle` |
| `forced_close` | the final-hour phase | `Woken by the final hour` |
| `threshold_proximity` | within 0.2× ATR of a bonus or penalty tier | `Woken by a piece nearing a scoring tier` |
| `bench_outperformance` | a bench name up ≥ 0.5× ATR while an active is flat or down | `Woken by a bench name outrunning the book` |
| `vwap_deviation` | an active asset's VWAP deviation | `Woken by a move away from the day's average price` |
| `bandwidth_squeeze` | a Bollinger-bandwidth percentile | `Woken by a volatility squeeze` |
| `nr7_contraction` | the NR7 flag | `Woken by a narrow-range day` |
| `news_catalyst` | a matching FantasyTimes story | `Woken by a news story on a piece` |

`triggers` is an array; the first RULED type in the persisted order wins. An unknown type renders nothing — never a raw type string.

---

## 6. Bugs outside this task — carried forward, not fixed (BUILD_RULES §3)

The Phase 0 report §7 listed four; the rulings §5 triaged them. Unchanged by A2:

1. **A guardrail-forced swap's feed line is attributed to the model** (`source: 'haiku'` with the model's pre-override line, while the trade says `source: 'guardrail'`). Own small task, `api/`, non-fenced. *A2 sidesteps it: the tape reads `trades[]`, whose `source` is correct.*
2. **`guardrail_forced_swap` is announced before the swap executes.** Same task. *A2 sidesteps it: a card comes from `trades[]`, so an announced-but-unexecuted swap gets none.*
3. **The shipped chat's trade filter misses three swap actions.** Superseded under the flag by the `trades[]` spine; the flag-off fix rides the flip's follow-up PRs.
4. **Stale cap comment** (`agent-evaluate.js:2715` says 50; the cap is 100). Rides bug 1's PR.

Nothing new was found outside the task in this session.

---

## 7. What A2.3 and A2.4 need from here

- **A2.3 (the piece scope).** `In the chat · {n}` counts tape entries naming the symbol: messages via the detector, plus trade cards (the pair) and check cards (their excerpt names it). The detector extraction (`findKnownTickers` out of `renderMessageWithEntities.jsx`) is **not** done — it is A2.3's first move, and ruling 8 governs it. The symbol rule the tape and the panel already share is `symbolPattern()` in `selectWhyState.js`; the detector's rule is a different one (roster membership) and must stay flag-off byte-identical. The roster union (`book ∪ portfolio.bench ∪ watchlist.hotBench ∪ agentContext.equippedWatchlist.tickers`) is under the flag only (hazard 27).
- **A2.4 (the peek line and the desktop collapse).** Ruling 7: the hook, enabled on both shells; desktop reads two states; **the detent survives a breakpoint crossing**, and the A4 guard row in `AgentBattleScreen.layout.jsdom.test.jsx` that asserts "a breakpoint crossing brings the sheet back at peek" **moves to assert the new behaviour**. The peek line is the newest tape entry — `buildTape` already produces the entries; the newest is the last of the merged, folded stream, which lives in `AgentChat`. Expect to lift the merge or pass the newest line down.
- Both need new battleView files on **both** theme-guard lists with baseline entries in the same commit (hazard 34).

---

## 8. Verification

- **Full suite:** 574 files, **9816 passed**, 63 skipped, 0 failed (9642 before the review pass).
- **`vite build`:** green (the pre-existing chunk-size warning only).
- **Flag-off goldens:** `agentBattleScreen.tabbed.html` and `agentChat.tabbed.html` unchanged and passing — the first paint is byte-identical flag-off. A new composition test closes the seam they could not see (§9).
- **Theme guards:** green with the three new files listed and their baselines committed alongside, and both guards now assert the directory mechanically (hazard 34).
- **Copy guard:** green.
- **Adversarial review:** `docs/audits/20260903_BATTLE_VIEW_CONTROLLER_PHASE_A2_BUILD_REVIEW.md`.

---

## 9. Review — what it changed

Five isolated lenses and two refuters; **43 findings raised, 31 CONFIRMED, 23 fixed on this branch**; 56 source mutations executed. The full record is the file above. What the founder should know:

1. **A ruling was implemented wrong and the review put it back.** A2.2 discriminated the motive's author on `trades[].source`; ruling 5 named the **rationale**, and two independent findings proved the ruling right. `source` records who chose the *exit*, not who wrote the *sentence*, and it was wrong in both directions — a guardrail-forced swap that **executed** rendered the cron's sentence as the agent's words on one card while the card beside it called the same string the system's. That was the most severe finding of the review and it is routine, not exotic: any user stop-loss that fires and executes.
2. **D-71's stated equivalence was false.** `deriveDueAt`'s clamp is blind to the calendar date, so the line claimed yesterday's check was today's on day 2 of a battle. Fixed with a day conjunct; a refuter then re-rated it LOW because multi-day battles are unreachable at HEAD (`AGENT_BATTLE_DURATION_MODE = 'fullday'` is hardcoded). Worth knowing when the D-14 multi-day arc lands.
3. **A2.1b was not revertible in isolation** — the reason D-76 gave for making it its own commit. It is now, verified by actually reverting it.
4. **The flag-off goldens could not see a tape leak** through the screen → chat wiring. Removing both flag gates leaked the whole tape into the shipped page with 3506 tests green. A new mounted composition test closes it.
5. **Five of the selectors' C1 gates were unenforced at their call site** — every one of lens 4's five surviving mutations. The unit tests were strong; the wiring was not. The mounted suite now varies the subscribed document.
6. **Eight findings are recorded and NOT fixed** (§5 of the record), each with a reason. One needs a founder ruling: the cron writes `Guardrail override (guardrail_stopLoss): …` into the rationale we render verbatim, so a machinery-provenance code reaches the screen. C1 says render verbatim; hazard 29 says no provenance codes. **May the parenthetical be dropped when rendering an engine motive?**
7. **Two process defects are disclosed** rather than smoothed over: the five lenses shared one snapshot (which mutation-checking corrupts — one false red and two contradictory failures, both caught and re-verified), and four of the five were handed the Phase 0 report where the rulings document should have been. The build itself was written against the correct document, and the one lens that noticed reconstructed the binding text from the ledger and matched every ruled string.

---

*Prepared September 3, 2026 against `bf4bc84f` (= `origin/main`, Phase A merged). Every line number cited was read in the build session.*
