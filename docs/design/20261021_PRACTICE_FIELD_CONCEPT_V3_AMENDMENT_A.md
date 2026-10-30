# Practice Field concept V3 — Amendment A: alignment with the Trend Follower evaluator

**Date:** 21 Oct 2026 · **Author:** the Practice Field chat (Fable) · **Status:** **Adopted by founder, 21 Oct 2026**, with his corrections folded in (this revision supersedes the same-day draft)
**Amends:** Practice Field concept V3 (14 Oct). **Reviewed against:** the shared contract V1 and the situation registry v2 on `main` (`stalled` live since Film Room B1.1), `TREND_FOLLOWER_SETUP_DEFINITION_V1.md` (blessed 24 Sep), Fable's archetype review of 21 Oct, and the slice-1 preparation prompt.
**Scope:** design only. It supplies integration context for slice 1 and nothing more. Drill screens, the voting calls, Forge changes and the situation-registry implementation stay in their own build tasks, and nothing here authorises implementation. Practice Field design continues alongside the archetype work.

## 1. What already agrees

- **Identity as a gate, not a paragraph.** V3's one door (nothing reaches the agent as learning except a proven play) and the evaluator's `valid | invalid | unknown` verdicts rest on the same principle. The Oct 13 ablation and the Oct 14 scorer are the evidence for both.
- **Refinements are versioned candidates.** V3 §8.5 already says a play passes proof before it installs and a failed play stays on the shelf with its result. LLY two-close and XBI break character are `tf-setup-v2` candidates.
- **Game points and market returns are kept apart.** V3's reveal shows the swap tax (the sale at the delayed quote plus the lost badge history) separately from what each stock did. That decomposition is the separation the archetype arc wants.
- **Daily evidence and intraday monitoring are separate.** A drill replays one check to that day's close on the tape's bars; a completed-daily-bar verdict is a dated fact as of the prior session's close. Neither claims to judge a 15-minute bar.
- **Missing evidence is a state.** The tape's coverage rule refuses a drill on missing bars; the registry's `stalled` definition pauses on a missing price; the evaluator's `unknown` fits the same vocabulary.
- **The first situation is live.** `stalled` has been tagged on every tape day since B1.1, so the first camp's moments exist on real film today.

## 2. The amendments (adopted 21 Oct 2026)

**A1 — Two evidence sets, labelled and not equal.**
- *What the agent was shown:* the stored request's evidence stamp and bench block. Until P4, this is the agent's only information.
- *Dated evidence:* per leg, `setupVersion`, verdict, reason, `asOf` and `basis`, computed by the evaluator from completed bars before the moment's session. It is shown to the player and kept on the record; it is not in the agent's request until P4.
- Because the two information sets differ, the drill names the information set beside each decision, and the reveal is never presented as a comparison of judgment under equal conditions.
- Dated evidence computed after the fact is labelled **retrospective**, and the drill records its reconstruction limits: the bar source and basis, the as-of date, whether the holding's activation references (activation date, the anchor swing low, the idea it was deployed under) were recorded at the time or are absent, and any fact the platform did not store at the time. A fact that depends on an absent reference reads `unknown`.
- *Alternatives:* the bench names in the request at that check.

**A2 — Five separate fields, never summed.**
- (a) *Evidence check:* per leg, a list of specific rule checks against the dated evidence, each a fact:
  - for an entry: `entry_on_invalid(reason)` — the name's entry verdict was `invalid(extended | no_setup | regime)` — or `entry_on_unknown`;
  - for a holding: `chart_leg_broken(reason)` — `close_below_slow`, `structure_break` or `regime_flip` — recorded as a fact and never as "holding was wrong": under the two-leg holding policy a hold is incorrect only when both legs are broken, and the sector leg is not typed in V1;
  - `unsupported_claim` when a stated reason names a fact the dated evidence marks unknown or contradicts: listed, not graded;
  - `none`, or `unknown` when the required evidence is missing.
  - A `valid` entry verdict establishes qualification, not an obligation. Passing on a valid name because of exposure, a stronger alternative or a game constraint is legitimate and records no violation. The check assesses specific rule violations and unsupported claims; it leaves judgment to the player and the record.
- (b) the agent's vote; (c) the player's call; (d) follow-through, for installed plays only, on game days; (e) outcome: points to the close, the swap tax, and each leg's market move as components.
- "Who was closer" is (b) and (c) read against (e), with their information sets named. It is shown, never graded.

**A3 — Uncertainty.**
- The player's menu gains *can't tell from this*, the player's explicit uncertainty choice. It is recorded as an abstention and never scored as wrong.
- An evaluator `unknown` is shown as unknown, and (a) reads `unknown`.
- The five-ask split is reported as **vote agreement**: how many of the five repeated answers agree, a measure of response consistency. 3 of 5 shows disagreement across repeated answers. It is never converted into calibrated confidence or a probability of success.
- The agent's own abstention arrives with P4's intent (`enter | wait(reason) | reject(reason)`) and is listed as a known gap until then.

**A4 — Two play classes.**
- *Control plays* compile to a control the player could set anyway (a lean, a dial, a rule parameter) and install on fidelity + no harm.
- *Rule-version plays* change a fixed baseline (any `tf-setup` number or pattern). They mint a `tf-setup-vN` candidate, whose proof is the evaluator's replay on unseen history under the Learning Charter, and they install only through the existing qualification and Forge route, with the prior version retained for rollback. A rejected candidate is a valid result.
- A player agreeing is not evidence for either class.

**A5 — Development and confirmation.** The drills that produced a play are its development cases and are excluded from its proof. The play records both sets of moment ids and, for a rule-version play, the baseline version it was measured against.

**A6 — The reserved holding-invalidation situation.** `thesis_broken` is reserved in the situation registry (id and title only, like `down`), defined once slice 1's invalidation output and the holding references it needs exist. An entry verdict of `invalid(extended)` or `invalid(no_setup)` on a candidate never tags the held name.

**No amendment:** progression. V3 has no XP; the playbook slot is the only progression; completing drills, agreeing with the agent or a winning trade earn nothing. The game-day record is shown in counts, never summed into a score.

## 3. The first shared exercise: "Chase or hold"

**The moment.** A `stalled` check on the player's own film. The bench holds candidates. Oct 9's tape day is the worked example from the Film Room handover: ACN stalled, AFRM and SHOP waiting, the platform's rule forced a pivot into HUM at a 14-point loss.

**The evidence (dated, retrospective-labelled).**
- Each candidate: `valid(breakout) | valid(pullback_resume) | invalid(extended) | invalid(no_setup) | invalid(regime) | unknown`, as of the prior close.
- The held name: its chart-leg state, evaluated only where the required references exist. `close_below_slow` and `regime_flip` need only the bars. `structure_break` needs the anchor swing low recorded at activation, which no holding before slice 1 carries, so on historical film it reads `unknown`. The activation date and the idea the name was deployed under are verified from the record before any "intact" or "broken" is shown; where they are missing, the state is `unknown`. Nothing is reconstructed from a chart or a screenshot.

**The calls.** The player: hold, swap to a named candidate, or can't tell from this. The agent: its five-ask vote on the stored request, reported as vote agreement.

**The reveal.** Points to the close with the swap tax separate and each leg's market move as components, plus the evidence check as A2: entering an `invalid(extended)` name is `entry_on_invalid(extended)`, a chase; passing on a valid candidate records no violation; holding a name with `chart_leg_broken` is a fact beside the sector context, not a verdict on the hold. The two information sets are named beside the two calls.

**Why first.** It needs only the first camp's pieces plus slice 1's evaluator and adapter, and the record checks above. It tests evidence use (extended as a new entry is not invalidation of a holding), thesis interpretation, and the player's judgment about whether a pivot clears the swap tax. It attaches human judgment to M2's question of whether `invalid(extended)` entries lose to holding; the Oct 14 finding that swaps lost to holding in every cut is the reason to ask.

## 4. Work that continues now, needing nothing from the evaluator

- Film Room B2 (cards, ledger, screen slots), in build.
- The first camp on top of B2: the drill, the vote, the reveal with the swap tax, the menus. The dated-evidence fields are built as optional and read "evaluator not available" until slice 1 lands.
- The reset of the failure-built wisdom paragraphs (any weekend) and the archetype carry-over build.
- The drills' own API key and spending limit (founder, Console).
- Slice 1 and its preparation pass. They are new files, which reduces overlap with the Film Room, cockpit and framework work; the builder still runs the preparation prompt's focused checks of current `main` and of the evaluator's dependencies before building.

Each of these stays in its own build task. This amendment is design context for all of them and integration context for slice 1.

## 5. Dependencies that require verified evaluator output

- The dated-evidence fields and the evidence check (A1, A2).
- The `thesis_broken` definition (A6), and `structure_break` on future film, which needs the anchor swing low recorded at activation.
- Rule-version plays and their confirmation replay (A4, A5), including the LLY and XBI candidates.
- The first shared exercise as specified above.
- Menu labels at deploy (slice 2) and the brain splice (P4) are archetype-arc work, not Practice Field dependencies. The Practice Field does not wait for P4.

## 6. Founder rulings of 21 Oct 2026

1. **Shared framework, separate rules.** Common data helpers (the daily-bars adapter), evidence records (facts with source, as-of date and basis), dating and versioning are shared across archetypes. Each archetype's rules are separate. Slice 1 stays focused on the Trend Follower. This ruling does not commission a six-archetype engine and does not assume that generalising adds no work.
2. **A1–A6 adopted,** with the corrections now folded into §2 and §3.

The Practice Field does not wait for the archetype project, and the archetype project does not wait for the Practice Field. Implementation remains governed by the separate build assignments.
