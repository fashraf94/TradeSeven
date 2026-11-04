# Stock Research Modal — Build Plan V1

**Date:** October 29, 2026 · **Closes:** the design phase (rounds 1–3; direction V2 of Oct 17 is frozen with the four spec notes in §1) · **Opens:** Phase 0 and the build sequence
**Status:** founder rulings R-16–R-18 (§2) approve-by-default. The one action after approval is the Phase 0 prompt (`PHASE0_PROMPT_RESEARCH_MODAL_OCT29_2026.md`).

## 1. Design freeze — round 3 read and four spec notes

Round 3 realized R-12–R-15: Layer 0 above the fold; archetype voice with the real six names and the agent's given name as a chip; numbered, sourced, pinned evidence packs whose order visibly changes between Trend Follower and Capital Preserver; plain reasons with the raw rule one tap behind. The three round files (batch 1 Bomb mode, batch 2 Analysis & Technical, round 3 three layers) are the design of record and are committed by Phase 0 under `docs/design/research-modal/`.

Spec notes (no further design round):
- **S-1** The Technical tab's Layer 0 "what the chart says" is a template from the three verdicts and the named setup in V1 (free, deterministic); the archetype's voice arrives on Ask. (Founder may instead rule one cached call per stock per trading day, the six-lens cost model.)
- **S-2** Every pack item labeled "its rule, in plain words" maps to a rule or constraint that exists in that archetype's config; when none exists for that question, the item is omitted. Never invented.
- **S-3** Q-5 confirmed: the Ask names the archetype; the agent's given name is a chip.
- **S-4** Q-6 confirmed: Shadow does not appear in the modal in V1.

## 2. New rulings (approve-by-default)

| # | Ruling | What it changes |
|---|---|---|
| R-16 | **One instrument, three clocks.** The in-battle sheet — the pinned chart, the three questions, the evidence packs, the Ask and its answer — is built as one component that takes a *clock* (`live` now; `replay` and `drill` reserved) and a *record source*. The modal is its first mount. The Film Room mounts `replay` (the record pinned on the battle day; questions turned retrospective; evidence labeled with its reconstruction limits), the Practice Field mounts `drill` (frozen at a dated moment, no later prices; "My read" is the player's call), each in its own arc. This arc builds no second or third clock, only the boundary. | One chart-with-record for the modal, the Film Room's per-symbol view and the drill, instead of three. |
| R-17 | **The modal reads setup evidence; it does not measure it.** The Technical tab's Daily-setup verdict comes from the setup evaluator's record (slice 1 today, ID-1's per-session per-symbol snapshots when they land), labeled with the evaluator and the session. Where no record exists for the equipped archetype or the stock, the row says *not measured for {archetype} yet*. The modal's own calculator keeps producing the facts grid (shipped after F1–F9) and the weekly-trend and intraday rows. | Build B waits for the framework arc's store; the player never sees two answers to "is this a setup." |
| R-18 | **One evidence vocabulary with Shared Research; the modal's Phase 0 goes first.** Pack items, pins and the Ask's filed exchange use existing records (receipts, tape, calls, callEvents, setup snapshots, facts) and the ID-1 evidence shape where it applies; Phase 0 proposes no new store. The Phase 0 report is attached to the Shared Research feasibility review as an input (§5), so Shadow's investigations and the archetype's stock reads describe evidence the same way and file an Ask the same way. | The hub's research and the modal's research can open into each other later without a translation layer. |

## 3. The arc map (who owns what the modal touches)

| Arc · owner chat | Status (Oct 29) | What the modal takes from it | What the modal gives it |
|---|---|---|---|
| **Cockpit** · this project's cockpit chat | 2b live for founder + FT_QA since Oct 23; exit dials next | the call records and callEvents (pins, "what you told it"), the chat/cockpit budgets, the → Cockpit door | the sheet as the scouting view for "Who comes in?" candidates (question preset: *better than what's stalled?*); the red-zone tile |
| **Command Center hub / Shared Research** · CC chat | hub live for all (Oct 28); next: casual-clone Character build, then the read-only Shared Research feasibility review | nothing in V1 (Shadow is out of the modal) | the Phase 0 report as an input to the feasibility review (§5); later, "For you" stock items open the sheet; "Save to our research" in browse mode |
| **Framework / ID-1** · framework chat | ID-1 shared setup-evidence contract in Phase 0 (Oct 28); snapshot store + acquisition helper land first | the setup-evidence record the Technical tab renders (R-17); the evidence item shape | a reader; a carriage requirement only if Phase 0 finds a gap (sent as a cut) |
| **Archetype restructure** · ChatGPT + framework | slice 1 (Trend Follower setup evaluator) on `main`; per-archetype rule sets to follow | pack ordering (weights/constraints) and six-lens verdict inputs | the six-lens agreement rate (concept §4) — a diagnostic the restructure can use |
| **Film Room** · Film Room chat | B2 card merged dark; B2.1 screen pass next (incl. per-symbol chart coverage) | the tape (pins for `replay`), the take-home card shape | the pinned chart as the per-symbol chart (R-16); a "watch idea" card opens the sheet in browse |
| **Practice Field** · Practice Field chat | paused; reset build not run | nothing | the `drill` clock (R-16); "My read" as the drill call |
| **Agent visual redesign** · marketing-video chat | armored forms passing on iPhone; replacing MechHead faces | the archetype's mark as the voice attribution when it lands | — |

Zero-overlap: Bomb mode (Build A). It reads the battle record and the thresholds, draws on the modal's own chart, and no other arc touches those surfaces.

## 4. Build sequence and gates

| Step | What | Gate to start | Overlap handled |
|---|---|---|---|
| 0 | **Phase 0** (read-only; commits the design of record and the report on a docs branch) | approve §2 | answers every question in §6 of the prompt, incl. the scoring cadence and the Ask path |
| A | **Bomb mode** — the Fuse, the red zone's three states, one sheet, the ladder with brick ticks; retires the synthesized candle. Dark behind `RESEARCH_MODAL_BOMB_MODE` (off → allowlist → on, the cockpit pattern) | Phase 0 merged | none |
| C | **The sheet, live clock** — pinned chart, three questions, packs, Ask, → Cockpit, plain vocabulary; built to the R-16 boundary. Dark behind `RESEARCH_MODAL_SHEET_MODE` | Phase 0; the Shared Research feasibility report returned (so the Ask and evidence shapes agree); cockpit 2b's first live read done; a one-line answer from the Film Room chat on whether B2.1 has started a per-symbol chart (if yes, the sheet imports it; if no, the sheet owns it and the Film Room imports) | cockpit (Ask budget, call records), Film Room (the chart), Shared Research (vocabulary) |
| B | **Technical unfolded** — Layer 0 verdicts + setup + template narration, Layer 1 facts-and-level, Layer 2 the grid; Daily setup read from the evaluator record (R-17) | ID-1's snapshot store and helper on `main` | archetype restructure / framework |
| D | **Six lenses + My read** — verdicts from per-archetype rule sets, one cached voice call per stock per day, My read stored with user provenance | the restructure's per-archetype rule sets exist; Phase 0's universe agreement rate reviewed | archetype restructure |

A and C are the ship pair — Bomb mode is launch-visible and fence-free; the sheet is the game-changer. B and D ride arcs that are already moving. If usage forces one build at a time, the order stands as written.

## 5. The cut for the Shared Research feasibility review (paste when that review runs)

Add to the feasibility prompt, after its Question five, with `docs/audits/<date>_PHASE0_RESEARCH_MODAL.md` attached:

> **Question six, the stock research modal.** The attached Phase 0 report maps the stock research modal's evidence packs (per-stock facts and records, ordered by the equipped archetype), its Ask (one chat message carrying a pack as context) and the player's "my read" onto existing records. Map Shared Research's initial findings, branches, user direction and archetype assessment onto the same records and the same evidence-item shape. Where the two would need different shapes or different Ask paths, say so and propose the one shape both can use; do not propose a parallel store. Note where a stock-scoped item in "For you" or "Our research" would open the modal's sheet rather than a new surface.

## 6. Integration hooks (designed into the R-16 boundary; built later by their owners)

- **Cockpit:** "Who comes in?" candidates open the sheet in our-lens mode with *Is this better than what's stalled?* preset and the incumbent as the comparison. The red zone's cockpit tile (*EOG in the red zone · $0.06 to +15*) opens Bomb mode.
- **Shared Research:** a stock-scoped "For you" item opens the sheet with its question preset; browse mode gains *Save to our research* once the record exists.
- **Film Room:** the sheet's `replay` clock is the per-symbol chart on the tape; the take-home "watch idea" card opens the sheet in browse mode on that stock.
- **Practice Field:** the sheet's `drill` clock; the three questions are the drill situations; "My read" is the call, scored by the "did better" record.
- **Agent visual redesign:** the archetype's mark replaces the text attribution chip when the forms ship.
