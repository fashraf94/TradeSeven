# BaggerBomb Archetype Candidate Refresh — Independent Review

**Change reviewed:** Codex commit `a2ae2204` on base `39053aed` (local branch `codex/baggerbomb-archetype-refresh`, no PR yet)
**Reviewer:** Claude (Opus 5.5) · Oct 18, 2026
**Method:** read-only. Fresh clone of `fashraf94/TradeSeven`; its HEAD was exactly the pinned base `39053aed`. Appendix B was applied in a separate worktree, and all seven resulting files match the post-image blob ids in the commit's own `index` lines (`9b64860`, `367d4ae`, `61039d9`, `cc82210`, `faea973`, `0202151`, `32b371c`), so the tree tested here is the commit's content. Mutations ran on a third copy. No production data, no model calls, nothing pushed or edited on any shared branch.
**Not available to me:** `BaggerBomb-Archetype-Refresh.patch` and the `evidence/*.log` files, so their SHA-256 values are not verified here.

---

## 1. Verdict

| Question | Answer |
|---|---|
| **Verdict** | **Changes required (small) before merge. Real-data evidence required before it goes live.** No source defect found in the new code. |
| Is the convergence real? | **Yes — larger than reported.** Each new battle's deploy menu (built from the agent's own strategy shortlist) is replaced by the shared BaggerBomb-fit menu at its very first check, then rebuilt up to about 8 times a trading day. Before this patch, all six archetypes pick swap-ins from the same list (minus what each already holds) for practically the whole battle. |
| Does the patch fix it? | **Yes, for which stocks are on the list.** Each archetype's stored hot bench now follows its own V1 rank, and those names reach the evaluator. **Not for order:** the model sees the names in the rankings doc's order, not the archetype's. |
| Does anything else change? | **No.** No fenced file, flag, entry gate, quote, risk rule, prompt, executor or schedule changed. The old selection code moved verbatim into the `else` branch. |
| Main risk | It goes live for every ordinary BaggerBomb battle within about an hour of market time, with no switch, and the first refresh cannot be seen on preview. V1 carries ranking flaws your own audits already ruled out (sector-size tilt, no calm preference for Capital Preserver, Contrarian "cheap" = low quality). Nobody has looked at the six menus on real data. |
| Tests | Strong at the selector level (7 of 10 mutations caught). Two orchestration gaps. The fixture cannot see V1's sector term. |
| Trading performance | **Not established.** Nothing in this change or this review measures it. Distinct lists and lower overlap are not evidence of better decisions. |

**Recommendation:** have Codex put the new menu behind a dark flag, add the two missing orchestration tests and name the battle in the diagnostic (§11); then merge dark. Before the flip, run the read-only menu dry run in §7 and read the six menus yourself.

---

## 2. In plain terms

- **What the agent chooses from mid-battle.** Apart from its 3 bench stocks and up to 5 news catalysts, the agent's swap-in choices are its "hot bench": 15 stocks (up to 20 with equipped names). Today that list is the same top-15 by BaggerBomb fit for every archetype, minus what each one already holds. After this change a Speculator's list leans to the most volatile names, a Fundamental Investor's to the strongest fundamentals, and so on — using the same scoring the deploy step already uses.
- **What stays the same.** When to enter, how big a swap's margin must be, risk rules, the prompt, the trade executor, the refresh timing, and League/tournament battles.
- **What it trades away.** On Codex's test fixture, the Fundamental Investor's and Capital Preserver's lists drop from an average BaggerBomb fit of 89 to 60. The lists become more "in character" (the Fundamental Investor's sub-40 names go from 6 of 15 to 0) but less "game fit." Real-market numbers are unknown until the dry run.
- **What the player sees.** The Battle View's battle-universe list keeps the stored order (`src/data/battleUniverse.js:58-71`), so it follows the archetype's order; the model sees composite order. No screen or prompt claims the list is ranked by fit (searched).

---

## 3. Blocking finding

**B1 — Ships live with no switch** · Blocking (process) · CONFIRMED

- **Source:** the new call runs unconditionally for tiered and absent-mode battles (`api/cron/agent-evaluate.js:1495-1507`). Rebuilds fire on each new trading day and each fresher rankings doc (`:262-264`, `:1482-1490`), and rankings recompute once premarket plus seven times intraday (`vercel.json:149-154`).
- **Effect:** merge plus deploy changes every ordinary BaggerBomb battle's candidate list within about an hour of market time. Crons do not run on Vercel preview (`docs/BUILD_RULES.md:80`), so there is no smoke surface, and rollback means revert plus redeploy. This runs against your dark-by-default rule (new behavior ships behind a false flag; the flip is its own PR).
- **Smallest correction:** one call-time flag (false) in `src/config/featureFlags.js`, registered with its pin in the flag-pin guard's dark set; the flip is a separate PR after §7. Alternative: an explicit founder waiver for this change.

No source-level blocking defect was found.

---

## 4. Findings

| ID | Finding | Label | Severity | Where | Practical effect | Smallest correction |
|---|---|---|---|---|---|---|
| F1 | Deploy menu is lost at the first check | CONFIRMED | Supports the change | Battle watchlist = deploy watchlist (`api/_utils/agentBattleService.js:289`); initial `cronState` has no hot-bench stamps (`:313-322`); rebuild rule `agent-evaluate.js:262-264`, `:1482-1490`; no other writer of `lastHotBenchComputedAt` | The comparison's "initial hot bench keeps a route from strategy" lasts only until the first check. After the patch the deploy shortlist is still replaced at the first check — now by V1 rank instead of the model-curated shortlist. | None in this patch. Product question, §9. |
| F2 | Archetype order does not reach the model | CONFIRMED (probe P1) | Medium (wording) | Bench is built by walking the rankings doc (`agent-evaluate.js:1600-1634`); the doc is sorted by composite (`api/cron/compute-index-intelligence.js:1455`); the bench CSV keeps that order (`api/_utils/agentEvalPromptAssembly.js:1507-1535`) | The model gets the right names in composite order. A Contrarian's top names (low composite) appear last. | Describe the change as "membership." Showing archetype order to the model is a fenced prompt change — separate. |
| F3 | V1's known flaws become the live menu policy | CONFIRMED (source); real effect UNTESTED | High (evidence gap) | `api/_utils/archetypeScoring.js:112-129`; prior findings F2/F3/F4/F12 in `docs/audits/RANKS_ARCHETYPE_AUDIT_PHASE0_FINDINGS.md:204-224`; V2 rulings R2/R4/R10 in `docs/specs/ARCHETYPE_RANK_INTERFACE_V2_BUILD_SPEC_V1_3.md:34` | With the real universe's sector sizes (19–28 names, `api/_utils/rankingConfig.js`), V1 adds a fixed bonus by sector: Capital Preserver +11.3 for Energy vs 0 for Technology, Diversifier +9.6 vs 0, Fundamental Investor +3.2 vs 0 — whatever the stock and whatever the agent holds. That is a sector tilt, not diversification. Capital Preserver has no low-volatility preference (ATR weight is positive). Contrarian "cheap" means low composite quality. | §7 dry run before the flip. Not a reason to rework V1 in this patch. |
| F4 | The fixture cannot see V1's sector term | CONFIRMED | Medium (evidence) | `api/_utils/__fixtures__/archetypeCandidateMenu.js:3-5` (8 sectors × 12 names) | V1's sector term is zero for every fixture stock, so the six-archetype cases never exercise 30–35% of Diversifier's and Capital Preserver's weights. Menus still pass because expectations come from the same scorer; the "distinct preferences" exhibit is weaker than it looks. | Add an unequal-sector variant (sizes 19–28) to the rank-preservation cases. |
| F5 | Off-universe equipped names are priced but never usable | CONFIRMED on base and patch (probe P2) | Low (pre-existing) | Priced every check (`agent-evaluate.js:1103-1117`, `:1577-1588`); a bench row needs a rankings row (`:1612-1624`) | A name the player equipped that is outside the 239-name universe stays on the list and costs an EODHD call every check, but the evaluator can never swap it in. | Separate ticket. |
| F6 | Diagnostic does not say which battle | CONFIRMED | Low | `agent-evaluate.js:1502` | Fires on every rebuild (about 8 a day) for a battle with an unknown archetype, without the battle id or the stored value. | Include `battle.id` and the raw archetype value. |
| F7 | Missing inputs are scored as average | CONFIRMED; REFUTED as a material boost | Low | `archetypeScoring.js:122-126`; the producer writes null for missing fundamentals, composite and fit (`compute-index-intelligence.js:1313-1318`, `:1388`, `:1400`) | The old path sorted a missing fit to the bottom; V1 scores missing inputs as 50. Probe: a no-fundamentals stock lands mid-pack (49th–69th of 97), not near the top. It can still sit in a Fundamental Investor's list whose identity refuses unknown quality. | Count it in the dry run. |
| F8 | The new caller and the V2 flip | UNTESTED (forward) | Medium for the V2 flip; none today | V2 flag false (`src/config/featureFlags.js:2054`); V2 `baggerBomb` minimum 35 (`api/_utils/archetypeScoringV2.js:92-98`); no `onEvent` → `console.warn` (`:166-172`); null fit excluded (`:415-418`); the spec's census says "nine callers" (`spec:196`, `:228`) and the flip list (`:238-244`) does not name this caller | At the V2 flip every live menu changes at the same moment as the deploy shortlists, outside the §6 observation window (which watches rankings, not menus). A short V2 list gives a short menu with no top-up; coverage warnings print on every rebuild for every battle. | Add this caller to the flip checklist: an `onEvent` sink, an explicit minimum, a top-up rule and a menu dry run. |
| F9 | The "existing failure" is a time-zone artifact | CONFIRMED | Info | `api/cron/agent-evaluate.meetingCopy.test.js:146` fails only under `TZ=Asia/Tokyo` (base and patch alike); passes under `America/Chicago` and `UTC` | Codex ran at +0900. Not caused by this patch. | Separate ticket (pin the time zone in that test). |
| F10 | `watchlist.monitoring` has no reader | CONFIRMED (search) | Info | Written at `agent-evaluate.js:1550` and `api/agent/decide.js:694`; no reader in `api/` or `src/` outside tests | The 18-name monitoring list affects nothing the agent or player uses today, apart from a count in the status feed. | Drop "initial deploy monitoring" from the follow-up list unless something will read it. |
| F11 | The hot bench decides which news wakes the model | CONFIRMED | Info | News tickers include the hot bench (`agent-evaluate.js:2704-2707`); catalysts come from those stories (`:2709-2758`) | Different menus change which stories wake the model, so wake rate and model spend per archetype can move. | Measure after the flip (§7 Stage B). |

### Refuted

| ID | Suspected issue | Result |
|---|---|---|
| R1 | Scope creep into fenced or shared files | **REFUTED.** All eleven §1 fenced files, `featureFlags.js`, `watchlistEquip.js`, `archetypeScoringV2.js` and `vercel.json` are byte-identical to base. The only production code touched is the refresh block (`agent-evaluate.js:1492-1545`), one import line and two comment lines in the same file, plus the new module. The import-boundary baseline and the V2 caller census were updated in the same commit as BUILD_RULES §1 requires. Calling `computeArchetypeRankings` is §1-permitted. |
| R2 | The old path behaves differently | **REFUTED.** Ignoring indentation, the legacy block differs only in two hoisted declarations (`let newHotBench` / `const newMonitoring` become assignments). The fixed-expectation tournament/League cases pass on base and patch. |
| R3 | Tournament or flat6 battles leak into the new path | **REFUTED.** Tournament context resolves only for `baggerbomb_tournament` with a live group (`api/_utils/tournamentAgentLedger.js:306-325`), and the menu returns null for any explicit non-tiered mode (`api/_utils/archetypeCandidateMenu.js:14`). League training pods ride flat6 (`api/_utils/gameModePolicy.js:8-11`). Absent mode takes the new path, matching the engine's own default; an empty or unknown explicit mode falls back to the old path, which is the safe direction. |
| R4 | Unknown or malformed identity silently mapped to an archetype | **REFUTED.** Own-key check (`archetypeCandidateMenu.js:15`). `'unknown'` is a real stored value (`agentBattleService.js:185`) and takes the old path with a warning. |
| R5 | A downstream step undoes the membership difference | **REFUTED for in-universe names.** Every hot-bench name with a rankings row that is not held or benched becomes a bench row; later checks reuse the stored list; probe P1 shows identical members in the model's bench table. Exception: F5. |
| R6 | Equipped policy differs from the legacy helper | **REFUTED, apart from the intended change.** Same cap of 20, equipped names always kept, held/bench excluded, displaced ranked names lead monitoring. Differences: overflow trims in archetype order instead of fit (intended); duplicate equipped names are now removed (the legacy helper could store a duplicate). |
| R7 | Copy elsewhere says the list is fit-ranked | **REFUTED.** No such claim in `src/` or the agent prompt assemblers. |
| R8 | More EODHD calls | **REFUTED for today's code.** List size per battle is unchanged and every fetch is a per-battle `forceRefresh` (`agent-evaluate.js:1117`; `api/_utils/marketDataCache.js:622`), with no sharing across battles. If the Price Authority work later shares one hot set across battles, distinct menus would enlarge it — measure the union in §7. |
| R9 | Node version risk | **REFUTED (low).** Only Node 16.9+ features (`Object.hasOwn`, `Set`). I ran Node 22.22.0; Codex ran 24.19.0; neither ran Node 20. |

---

## 5. Answers to the ten questions

**Q1 — Real mechanism?** Yes. Refutation attempts: (a) "the deploy shortlist keeps menus archetype-specific" — refuted, it is overwritten at the first check (F1); (b) "different holdings make menus differ anyway" — only through exclusions; with the same book the old sort has no archetype input, so the list is identical by construction (base `agent-evaluate.js:1492-1527`); (c) "the evaluator picks from elsewhere" — swap-ins come from the stored 3-name bench, the hot bench and at most 5 catalysts, so the hot bench is the bulk. **By layer:** selection order — lost before; now stored, but not shown to the model (F2). Membership — lost before; restored. Model choice — unmeasured. Executed trade — unmeasured, and still subject to the same gates, including the archetype-specific hurdle floor. **From synthetic inputs only:** that the six V1 menus differ, and by how much. **Needs production evidence:** how often real menus differ, whether the model chooses differently, and outcomes.

**Q2 — Integration trace (all VERIFIED at the patched tree):**

| Step | Behavior | Where |
|---|---|---|
| Frozen archetype | `agentContext.archetype` stamped at creation, read once per check; same value the evaluator's physics uses | `agentBattleService.js:185`; `agent-evaluate.js:1061`, `:1800` |
| Full-universe ranking | Whole rankings array passed; exclusions applied after ranking | `agent-evaluate.js:1499`; `archetypeCandidateMenu.js:20-22` |
| Held/bench exclusions | Portfolio plus bench, crypto included | `agent-evaluate.js:1095-1100`, `:1500` |
| Equipped union | Deduplicated, excluded if held, kept if off-universe, protected under the cap | `archetypeCandidateMenu.js:23-40` |
| Saved watchlist | Written with the computed-at stamp | `agent-evaluate.js:1547-1556`, `:1574` |
| Price acquisition | New hot-bench names fetched | `agent-evaluate.js:1577-1588` |
| Synthetic bench | Needs a rankings row; not held or benched; rankings-doc order | `agent-evaluate.js:1600-1634` |
| Model input | Bench table and bench technical block in bench order | `agentEvalPromptAssembly.js:1507-1535`, `:1553-1604` |

Membership survives to the model for in-universe names; presentation order does not (F2).

**Q3 — Equipped contract.** Overlap: kept once, at its rank position. Duplicates: removed. Held/bench: excluded. Off-universe: kept and priced but never a usable row (F5, pre-existing). Overflow: ranked non-equipped names trimmed in archetype order, equipped placed after. More than 20 equipped: all kept, hot bench is equipped-only, monitoring gets 18 ranked names. Displacement: displaced ranked names lead monitoring. Unit-tested; the orchestration overflow case does not discriminate (§6).

**Q4 — Mode boundary.** Safe (R3, R4). The old branch keeps its behavior (R2).

**Q5 — Shared technical entry checks.** No change to scoring formulas, HFT config, gates, quotes, risk, prompt, executor, cadence or flags (R1). These checks were never fully shared, though — see Q10.

**Q6 — Tests.** See §6.

**Q7 — Is V1 an adequate first step?** Partly. For Trend Follower, Speculator and Fundamental Investor, V1's lead weights line up with their identities (technical, volatility, fundamentals). For Capital Preserver, Diversifier and Contrarian, V1 has documented flaws (F3). On the synthetic fixture, V1 menus still contain fewer identity-violating names than the shared-fit menu — Fundamental Investor 6 → 0 names below 40, Capital Preserver 10 → 7 high-ATR names, Speculator 3 → 0 low-ATR names, Contrarian 5 → 1 weak names — at a cost in BaggerBomb fit (89 → 60 for Fundamental Investor and Capital Preserver; 89 → 83 for Speculator and Contrarian). That is fixture evidence only. **The specific defect that could justify foundation work first is the sector-size tilt for Capital Preserver and Diversifier** (F3); the §7 dry run decides it. **V2 fit:** the caller is registered with `baggerBomb` mode and ranks the full universe, which is what V2 needs; its eligibility and minimum-candidate behavior need decisions before the flip (F8).

**Q8 — Real-data comparison.** See §7.

**Q9 — Turnover and congestion.** See §8.

**Q10 — Blocking vs separate.** Blocking: B1 only. Separate tasks: §9. **Pre-existing archetype-specific timing rules that conflict with shared entry criteria** (none expanded here):
- **Eval identity blocks are live** (`featureFlags.js:1642`) and give each archetype its own entry doctrine (`api/_utils/evalIdentityBlocks.js:103-138`): Trend Follower "late and confirmed beats early and wrong"; Contrarian needs "a recovery reason and a technical turn," with its own momentum counter-indicative; Fundamental Investor treats price momentum as "never a reason, only timing"; Capital Preserver is "hard to enter," with upside and momentum "genuinely last."
- **Archetype-locked hurdle floor** — the margin a swap-in must beat the holding by: 0.2–0.3 ATR for Speculator up to 0.5 for Capital Preserver (`api/_utils/agentArchetypeConfig.js:50-58`, `:166-176`, `:201-208`; read at `api/_utils/agentRiskManager.js:356-379`; used at `agent-evaluate.js:1991`, `:3697`).
- **Swap caps and forced rotation** differ: 12 per 60 minutes for Speculator, 2 per 120 minutes for Capital Preserver, forced rotation off for Capital Preserver (`agentArchetypeConfig.js:177`, `:199`, `:209`).
- **Preset defaults** differ by archetype (aggressive / balanced / defensive), and presets drive regime strategies and risk levers.
- **Inert:** `convictionMods` and `regimePreferences` are only projected by the registry (`api/_utils/archetypeRegistry.js:149-150`); nothing enforces them.

---

## 6. Test gaps tied to risks

**Re-run of Codex's evidence:** the new orchestration suite on unchanged base gives 7 failed / 3 passed — matching Codex. The 3 that pass on base include the overflow case, which is gap T1.

**Mutation check** (separate snapshot, the two new suites):

| Mutation | Caught? |
|---|---|
| M1 Rank after exclusions | Yes (8 tests) |
| M2 Ignore resolved tournament context | Yes (unit) |
| M3 Accept any explicit mode | Yes (unit) |
| M4 Trim overflow by shared fit | Yes (6 unit tests) |
| M5 Drop displaced names from monitoring | Yes (6 unit tests) |
| M6 Keep held equipped names | Yes (unit) |
| M7 Cron drops bench from exclusions | Yes (orchestration) |
| M8 Cron passes `isTournament: false` | **No** |
| M9 Cron passes no `gameMode` | **No** |
| M10 Equipped placed before ranked names (under cap) | **No** |

| Gap | Concrete risk | Smallest fix |
|---|---|---|
| T1 | The orchestration overflow case passes on base, so a later edit routing overflow back through the fit-based helper is not caught at the real boundary. | Assert the exact hot bench: the first 20 − k ranked non-equipped names in archetype order, then the equipped names. |
| T2 | M9 survives: if the cron stopped passing `gameMode`, a flat6 battle whose group does not resolve (missing, or status not `battle`) would take the archetype path. | One case: `baggerbomb_tournament` with tournament context null → expect the legacy fit list. (M8 surviving is acceptable — production cannot produce a tiered battle with resolved tournament context.) |
| T3 | F4 — the sector term is invisible on the fixture. | Unequal-sector variant (sizes 19–28) for the six rank-preservation cases. |
| T4 (optional) | M10 — under-cap order is unpinned; it only affects the stored order the Battle View list shows. | Pin `[...ranked, ...equipped]` in one unit case. |

---

## 7. Smallest next production-data audit

**Stage A — before the flip; read-only; zero model credits.**
- **Inputs:** the live `indexIntelligence/stockRankings` doc saved at each rebuild point (premarket plus 7 intraday) for 5 market days, with that day's regime from `indexIntelligence/marketContext`; every active tiered or absent-mode `agentBattles` doc at the same instants (portfolio, bench, `agentContext.equippedWatchlist.tickers`, `agentContext.archetype`, `watchlist`).
- **Why save the doc:** it is overwritten on every recompute, and ranking snapshots keep only `axes` / `arch_scores` / `arch_scores_v2` per stock (`api/_utils/rankingSnapshots.js:109-113`) — no BaggerBomb fit, sector or raw inputs — so snapshots alone cannot rebuild the legacy menu.
- **Computation:** run the merged menu function and the legacy statements offline on the same inputs, (a) for each real battle's own book and (b) for one control book (same held/bench/equipped) across all six archetypes.
- **Dates and regimes:** 5 market days that include at least one up day and one down day by the stored regime; if the week has only one regime, extend until both appear.
- **Metrics, per archetype per instant:** overlap with the legacy menu; pairwise cross-archetype overlap (control book); identity conformance — share of names failing the archetype's own admission language (Fundamental Investor fundamentals < 40 or missing; Capital Preserver ATR percentile > 0.75; Speculator ATR percentile < 0.5; Contrarian weak quality); BaggerBomb fit given up vs legacy; sector mix (distinct sectors, top-sector share, Technology share for Capital Preserver and Diversifier); share of names with a missing input scored as 50; names in/out between consecutive rebuilds; new price fetches per rebuild; union size across battles; and a consistency check that recomputed V1 scores equal the doc's stored `arch_scores`.

**Stage B — after the flip; from existing tick capture and stored decisions; no added credits.** Per archetype, against the pre-flip week: model wakes per battle-day (news-triggered separately), proposals naming a hot-bench stock and that stock's menu rank, executed swap-ins from the hot bench and their gate block reasons (hurdle floor), cockpit calls per battle-day, distinct symbols per battle-day, and repeated-symbol calls. **Fallback frequency:** the deploy records only `deployProgress.fallbackKind` (`decide.js:737-740`), overwritten per deploy — confirm where it persists and count it per deploy over the window.

Stage A needs a production read (a local script on your machine, or a read-only ops session). It is not a model replay and spends no credits.

---

## 8. Turnover and congestion

- **What can churn:** up to about 8 rebuilds per trading day, each able to replace all 15 names. Under legacy the list moves with shared fit; under V1 it moves with each archetype's blend (Trend Follower's is 40% technical score; Speculator's is 60% ATR percentile).
- **Observe:** names in/out per rebuild (count and overlap with the previous list); distinct symbols on the hot bench per battle-day; calls naming a stock that left the list by the next check; repeated-symbol calls under different price conditions (your congestion pattern); model wakes, including news-triggered ones (F11); refresh-tick price fetches.
- **Threshold review, without inventing a number:** Week 0 (Stage A) gives legacy actuals and the V1 counterfactual at the same instants, as paired distributions per archetype. You set the review bar from those distributions (for example, "look at any archetype whose median names-out per rebuild exceeds legacy's by more than N," with N taken from the Week 0 data). Week 1 after the flip compares actuals to that bar. If an archetype exceeds it, the options to weigh then are rebuilding the archetype path only on a new trading day, or keeping incumbents that are still within a wider rank band. The V2 spec's stability check (≤ 4 of top 10 between closing snapshots, `spec:271`) is a ranking diagnostic; do not reuse it as a menu threshold.

---

## 9. Separate tasks (keep distinct)

| Task | Why it is separate | Note |
|---|---|---|
| Portfolio construction fallback | Fenced `decide.js` | Align with V2 Job 3 (`spec:246`). |
| Initial deploy monitoring | Nothing reads `watchlist.monitoring` (F10) | Deprioritize. |
| First-check overwrite of the deploy shortlist | F1 | Product decision: should the model's own research shortlist seed the mid-battle list? |
| V2 activation | F8 | Add this caller to the flip checklist. |
| Underlying archetype design | F3 | V2 rulings R2/R4/R10 already address the V1 terms. |
| Archetype timing rules vs shared entry criteria | Q10 list | Needs a founder ruling. |
| Off-universe equipped names | F5 | EODHD cost plus a player-facing gap. |
| Time-zone-dependent tests | F9 and §12 | Pin the time zone. |
| Cockpit Build 2 | No code dependency either way | Sequencing in §10. |

---

## 10. Sequencing with cockpit Build 2

1. Codex revision (§11) → PR → **merge dark**. Behavior unchanged; Build 2 unaffected.
2. **Stage A dry run** (one market week, read-only) → your read of the six menus against today's.
3. **Flip as its own PR**, not in the middle of a Build 2 measurement week. Flip before Build 2's data read, so its consolidation design is built on the candidate mix the agents will actually have, and give it one trading week before taking the cockpit baseline.

Build 2's code does not depend on this patch, and this patch does not touch cockpit code.

---

## 11. Revision request for Codex (copy as-is)

> Revise `a2ae2204` on `codex/baggerbomb-archetype-refresh` before publishing. No other changes; do not touch fenced files.
> 1. **Dark flag.** Add a flag (e.g. `ARCHETYPE_REFRESH_MENU_ENABLED = false`) to `src/config/featureFlags.js` with its `// Pinned by:` pointer and pin, registered in the flag-pin guard's dark set. Read it at call time, never at module scope. While false, the refresh must take the legacy path. Force it on in the new suites with the existing `vi.mock` getter pattern, and add one orchestration case showing flag-off output equals the base fit list.
> 2. **Overflow case.** In `agent-evaluate.archetypeMenu.test.js`, make "keeps equipped priority during overflow" assert the exact hot bench (first 20 − k ranked non-equipped names in archetype order, then the equipped names), computed independently, so it fails on base.
> 3. **Unresolved flat6 case.** Add an orchestration case with `gameMode: 'baggerbomb_tournament'` and tournament context resolving to null; expect the legacy fit list.
> 4. **Diagnostic.** Include `battle.id` and the raw archetype value in the `[archetype-menu]` warning.
> 5. **Optional.** An unequal-sector fixture variant (sector sizes 19–28) for the six rank-preservation cases.
> 6. **PR text.** Describe the effect as hot-bench membership (the model sees composite order), name `computeArchetypeRankings` as the fenced function called and confirm no fenced file was edited, state that crons do not run on preview, and attach this review under `docs/audits/`.

---

## 12. What I ran, and what I did not

**Ran (Node 22.22.0, Vitest 4.0.17):**
- The six targeted suites on the patch: 111 / 111 pass.
- Codex's wider set (52 files) on the patch under `America/Chicago`: 1,136 / 1,136 pass, including `meetingCopy` (63 / 63).
- `meetingCopy` under `TZ=Asia/Tokyo`: 1 failed / 62 passed on both base and patch (F9).
- The new orchestration suite on unchanged base: 7 failed / 3 passed.
- Import-boundary, flag-pin and registry guards: pass. Changed-file lint gate: pass.
- Full suite on the patch under `America/Chicago`: 22,521 passed, 8 failed in 4 files, 65 skipped. Seven of the failures (StockChart, dateUtils, AgentBattleScreen golden) fail identically on base under the same time zone and pass under `UTC`; the eighth (`film-tape-backfill.e2e`) failed only under full-suite load and passes alone. None touch this change.
- A second full run under `UTC` was cut off at 677 of 1,044 files; up to that point its only failure was the same `film-tape-backfill.e2e` load flake. It is not a complete green run.
- 10 mutations (§6), probes P1–P3 (bench order, off-universe name, news tickers) on the patch, P2 also on base, the fixture illustration in Q7, and the sector-bonus computation from `rankingConfig.js`.

**Did not run:** `vite build` (the patch is server-only and below the BUILD_RULES §2 review threshold; Codex reports it passed), Node 20, anything against production data, and any model call.
