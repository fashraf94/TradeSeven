# Research modal — Direction V2, Amendment C: the two-view shell

**Date:** November 12, 2026 · **Status:** design of record for the shell build.
**Destination:** `docs/design/research-modal/RESEARCH_MODAL_DIRECTION_V2_AMENDMENT_C_20261112.md`, committed as the first commit of the shell build branch, with the two design files beside it:
- `docs/design/research-modal/Research Modal - Round 4 (two-view shell) (standalone).html`
- `docs/design/research-modal/Research Modal - Round 5 (standalone).html`

Project copy: `claude/RESEARCH_MODAL_DIRECTION_V2_AMENDMENT_C_TWO_VIEW_SHELL_NOV12_2026.md`.

**Amends:** Direction V2 (Oct 17), Amendment A (Oct 17), the Build Plan V1 (Oct 29), Amendment B (Nov 2), and the Build C sheet spec (Nov 7). Where this amendment and an earlier document disagree, this one wins.

## 1. In plain terms

Opening a stock no longer shows a chart with a drawer of tabs under it. It shows one of three full-screen views, switched by three pills in the header:

- **Analysis** opens first. In battle it's the equipped archetype's lens on the stock (Build C's content, laid out as round 5 drew it). In browse it's the stock's facts.
- **Chart** is the full-canvas chart: 1D/1W candles, the automatic trend lines, the SMA · S/R · Idea pills, and the record's pins. Later it carries the technical read (Build B).
- **💣** (in battle only) is Bomb mode as built.

Under the Analysis content sit four tabs with today's full content: *What's moving · Ranks · Smart Money · Sector*. The Analysis view has a second state for a stock opened from a Battle Research question. That state is designed (round 5, screens R–R3) and is built later, after the Battle Research pass.

## 2. What was decided (Nov 8 – Nov 12)

| # | Ruling |
|---|---|
| **R-23** | **The voice label is the player's agent name plus the archetype:** *Shadow · Trend Follower*. The agent's name is the player's own (never hardcoded). A rule is always named as the archetype's. Amends R-12. |
| **R-24** | **The Analysis view has two states,** opened on its own and opened from a research question, designed in one round (round 5 V2, Nov 12). |
| **R-25** | **The first research version uses fields that exist today:** technical rank, today's move, overlap with holdings, game eligibility, and the size of one scoring rung. Entry fit, a separate momentum score and a comparison with SPY are absent until their fields and read paths are confirmed. |
| **R-26** | **Tap first.** Every action works by tap. Drag comes after a phone test of the shell. |
| **R-27** | **Header control H1:** three filled pills of equal width, the active one filled, with space between them. In browse, two. In battle the 💣 pill may warm with the heat accent when a held stock is in the red zone or the Danger Zone. The control replaces the *Why?* door; *What's moving* becomes the first tab. |
| **R-28** | **The shell is Build C's delivery.** Build C's record logic (the stance, the latest sentence, the three questions, the packs, the Ask, the pins, FQ-9's open-on-💣) is reused unchanged. Build C's layout (the shorter chart above a drawer, the drawer's mid snap and footer geometry) is replaced by the shell. The shell ships under Build C's flag, `RESEARCH_MODAL_SHEET_MODE`: `'off'` is today's modal byte for byte, `'allowlist'` is the shell for the allowlisted owners' battle mounts, `'on'` is the shell on every v2 mount, browse included. No third flag. |
| **R-29** | **The pinned Ask stays as Build C built it:** the evidence rows are free; the Ask sends the open question to the archetype for one message from the per-battle chat 10, labelled *Ask {Agent}: {question} · 1 msg*. Round 5's state 1 shows exactly that. The free-text Ask box belongs to state 2 and is built with it. |
| **R-30** | **A door that doesn't exist yet is absent.** *Work this idea* (browse) waits for Shared Research's door. The technical-read strip in the Chart view waits for Build B. No placeholder rows. |
| **R-31** | **Overlap carries the Correlation Lab's label and window.** A relationship is called *established* only when the Lab's own rule holds (both the 20-session and 60-session readings clear its floor); otherwise *emerging* or *weak*, with the number and the window beside it. Never a bare 0.86. |
| **R-32** | **Ranking labels are precise.** The Ranks tab names its group and date: *Utilities · technical rank · Wed Nov 11*, never *All stocks* when the rank is within a sector. A research position counts only the names that have the reading: *#1 of 9 ranked · 10 on bench* when one name has no price yet. |
| **R-33** | **The agent's identity stays visible in the research state:** a compact *{Agent} · {Archetype}* label near the context strip (R-23's label, no new card). |
| **R-34** | **State 2 is dark in the shell build.** The Analysis view is built as an ordered list of blocks so the research blocks (the context strip, *For this question*, the finding, the compare, the prepared answers) can be prepended by the later build. No prop, no branch and no UI for state 2 ships now. |
| **R-35** | **Stocks first.** The shell applies to stocks. A crypto, index or sector-ETF asset keeps today's layout under every flag value; their shells are a follow-up. |

## 3. The Analysis view, state 1 (round 5 screens A, A2, D)

**In battle, top to bottom:**
1. The header: ticker, name, price and day change, then the three pills.
2. The holding line, when held: *Holding since Tue · entry $154.76 · +4.3% since entry · +15 banked* (Build C's facts).
3. *What it decided*: *{Agent} · {Archetype} · 1:15*, then the latest sentence, quoted (Build C's latest line).
4. *Ask about {SYM} · see the evidence first · free*: the three questions as rows, ordered by the archetype (Build C's packs). A tapped row opens its pack: the numbered items with their source lines and *see on chart*; an answered Ask shows its reply with *filed to chat*.
5. One quiet line: *Wall St {rating} · {n} analysts · About {name} ›*. *About* opens the profile inline.
6. The tab strip *What's moving · Ranks · Smart Money · Sector*, stuck under the header while its content scrolls. Each tab shows exactly today's content, restyled only to the shell's spacing and type.
7. The pinned action row: the Ask (R-29) and *→ Cockpit*.

**In browse:** the header with two pills; the five preset questions of today's Analysis tab as one collapsed row, *Ask about this stock* (kept until Build D replaces them); the Wall St · About line; the four tabs; the action row with whatever action the mount passes today (watchlist, draft or acquire).

**Hierarchy, not boxes:** spacing and type weight, few borders, one accent per block.

## 4. The Chart view (round 4 screen B, with round 5's correction)

The chart at full canvas: 1D/1W, the candles, the automatic trend lines, the SMA · S/R · Idea pills, and Build C's pins (entry, calls, the latest check). **No stop price anywhere.** Today's Technical tab content (indicators, levels, with its honesty fixes) sits below the chart in the same scroll, and a level tapped there still highlights on the chart. The technical-read strip waits for Build B (R-30). The same action row.

## 5. The 💣 view

Bomb mode as built (#1031, #1041, #1043), inside the new header: the plot at the Chart view's height, then the bar, *What has to happen* and the levels table. FQ-9 holds: a measured held stock inside the red-zone or Danger Zone band at open opens on 💣.

## 6. State 2, for the later build (round 5 screens R, R1, R2, R2b, R3, R-later)

Recorded here so the shell is built once. The order on open: the header and pills; the context strip (the question, each refinement in its own words, the group, the active conditions as chips, the readings' time, *‹ Back to ranking*, and the *{Agent} · {Archetype}* label); *For this question*; the finding with *Use across my bench*; *Compare with a holding*; the prepared answers; the game line; the Wall St · About line; the four tabs; the action row with a free-text Ask and *→ Cockpit*.

Three rules from the Battle Research chat (Nov 12): the modal keeps the active conditions visible beside the question; a compare keeps the question's measure, and under an overlap question measures against the holdings that remain after the swap; the original question stays fixed, and each refinement's wording, group, conditions, ordering, timestamps and result are kept for the Film Room. Movement before entry is never points.

**Validation when it's built:** the tap flow on a phone — apply a condition, undo it, compare a holding, return to the same result, open the prepared cockpit action.

## 7. Builds, in order

1. **The shell build** (this amendment, §3–§5): `BUILD_PROMPT_RESEARCH_MODAL_SHELL_NOV12_2026.md`.
2. The flip of `RESEARCH_MODAL_SHEET_MODE` to `'allowlist'`, then `'on'`, each its own founder PR after the phone check.
3. **The Battle Research field inventory** (read-only, alongside): `DISCOVERY_PROMPT_BATTLE_RESEARCH_FIELD_INVENTORY_NOV12_2026.md`.
4. The joint review of round 5 and the research-surface frames, then the integration addendum and the state 2 build.
5. Build B (the technical read) into the Chart view, when the setup-evidence read route exists.
