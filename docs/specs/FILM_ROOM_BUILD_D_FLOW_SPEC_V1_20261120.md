# Film Room Build D spec V1 — the game's flow (2026-11-20)

**Status:** the Film Room chat's spec. The founder approved the direction, the design and the rulings FL-1 to FL-5 on 20 Nov, and approves the rest by sending the D1 build prompt.
**Design of record:** `docs/design/20261120_FILM_ROOM_FLOW_MOCKUP.html` (Claude Design, round 3). Where this spec and the mock-up differ, this spec governs, and §12 lists every difference.
**Destination:** `docs/specs/FILM_ROOM_BUILD_D_FLOW_SPEC_V1_20261120.md`, with one `docs/README.md` row. No docs-only PR.

## 0. In short

- **The Film Room's front becomes a picture of the game.** One chart shows the player's score against the opponent's across the day. Pins mark the swaps and the player's directives. The selected pin's panel shows the fact and the words the tape holds. A row of counts follows.
- **The tape is unchanged and sits behind one door.** Glance, Study and Deep dive are exactly as they are on `main`.
- **Build D has two parts.**
  - **D1, this spec's build:** the page. It reads only the tape day the screen already reads. It has no model call, no cron, no new record and no rules change.
  - **D2, a later prompt:** the agent's overnight words on the swap pins.
- **After launch:** the counts across games (the agent's habits), and one idea drawn from them.

**The rulings:**

| # | Ruling |
|---|---|
| FL-1 | **The purpose is habits.** The Film Room's data is used to show what the agent, or the player, repeatedly chooses to do (§1). |
| FL-2 | **The front is the game's flow:** the result, the chart with pins, the pin panel, the counts, the door to the tape. No sentence from the agent sits under the result. |
| FL-3 | **The opponent's line reads the tape's own per-check opponent score.** No tape field is added. |
| FL-4 | **Pins that would overlap merge into one,** and its panel steps through them. |
| FL-5 | **At most five pins.** The agent's own swaps come first, then the player's directives, then every other swap. They are shown in time order. |
| FL-6 | **One mark for the day's low,** placed by code. |
| FL-7 | **The lines start at the first check.** Nothing is drawn before it, and nothing is joined across a check with no score. |
| FL-8 | **A swap pin has two kinds:** the agent's own (`agent_decision`), and every other maker. The panel names the maker from the recorded mechanism. |
| FL-9 | **D1 ships two counts:** the swaps that were the agent's own call, and the directives filed. The other tiles in the mock-up wait until each has a definition the tape supports. |
| FL-10 | **"Directives acted on" is never claimed.** The tape records sequence, never compliance (Build A, BA-9). The count is "directives filed". |
| FL-11 | **No idea row in Build D.** An idea drawn from one game is noise. It returns with the habits across games. |
| FL-12 | **The front shows no number-kind marks.** Every number on it still has a declared class in code and in tests. The marks stay on the tape. |
| FL-13 | **The existing formatters win over the mock-up's strings** (BUILD_RULES §9): points through `fmtPoints`, prices through `fmtPrice`, clocks through `etClock`. |
| FL-14 | **The gate is `FILM_ROOM_FLOW_MODE`,** a string tri-state like `FILM_ROOM_CARDS_MODE`. It merges at `'allowlist'`, which admits the cockpit allowlist's owners. |
| FL-15 | **The existing no-tape page stands.** The mock-up's state 6 is not built. |
| FL-16 | **With cards on, the front points at them in one line.** The card regions themselves stay on the tape. |

## 1. What a habit is (FL-1)

- **A pattern** is anything that repeats across games. It makes no claim about the cause.
- **A habit** is a pattern in what the agent or the player chose to do. It passes three tests:
  1. **It repeats.** It is counted over several games and shown as a count ("4 of 11"), never as a percentage.
  2. **It was a choice.** The tape attributes it to the agent or the player, not to a platform rule, the market or chance.
  3. **It can be changed.** There is something to test in the idea portfolio or to equip in the Forge.
- **Only habits feed ideas and the Forge.**
- **A reading of a count is never the Film Room's.** "Your agent holds names that go quiet" interprets a count, so under BC-1 it can only be the agent's quoted words.
- **D1 shows one game's counts.** They become habits when a later build counts them across games. Their definitions are fixed here so that the later counts mean the same thing.
- **The four jobs** a habit belongs to are Trading, Reading the market, Working with you and Research. D1 has counts for the first and the third.

## 2. The gate (FL-14)

- **The flag:** `FILM_ROOM_FLOW_MODE` in `src/config/featureFlags.js`, with `FILM_ROOM_FLOW_MODES = ['off', 'allowlist', 'on']`. The value at merge is `'allowlist'`. An unknown value resolves to `'off'`.
- **How it resolves:** per battle owner, as the cards do. `src/utils/filmRoomGate.js` gains `resolveFilmRoomFlowMode` and `filmRoomFlowOn(mode, verdict)`, after `resolveFilmRoomCardsMode` and `filmRoomCardsOn`. The verdict is the one `readFilmRoomVerdict` already returns, from its cache. D1 adds no second request for a battle.
- **Off is off.** With the mode `'off'`, and under `'allowlist'` for an owner the verdict doesn't admit, the screen is `main`'s screen byte for byte at every paint, with the same requests.
- **While an `'allowlist'` verdict is on its way,** the screen shows the off layout. The front appears when the verdict admits the owner.
- **The front needs the v2 screen.** A battle the legacy screen serves is untouched.

## 3. When the screen opens on the front

The screen opens on the front when all of these hold:
- the flow resolves on for the battle's owner;
- the screen was not opened at a moment (`openAt` is null);
- the selected day has a written tape.

Otherwise it opens as it does on `main`. A day with no tape shows the existing no-tape page (FL-15).

## 4. The front, top to bottom

**The header** holds the back control, the day's pills, and the day picker for a multi-day battle. It doesn't hold the title, the subtitle, the depth control, the number-kind legend, the card regions or the first-open notice. Those belong to the tape and appear there as they do on `main`.

1. **The heading.**

| The day | The heading |
|---|---|
| A completed battle's final day, result `win`, both final scores recorded | "Won by {n}" |
| The same, result `loss` | "Lost by {n}" |
| The same, result `draw` | "Draw" |
| A completed battle's final day, anything else | "Final {total}" |
| Any other day | The day's date, from `etDateLabel` |

   - **`{n}` is computed from the two final scores as the key displays them** (BUILD_RULES §9): the difference of the two `fmtPoints` values, shown without a sign.
2. **The key.** "You {total}" with a solid line mark, then "CPU {opponent}" with a dashed line mark.
   - **On a completed battle's final day** the values are `battle.final`'s. On any other day they are the last check's.
   - **The CPU entry appears only** when the tape's `score.opponentBasis` is `cpu_portfolio` and the value is a number.
3. **The chart** (§5).
4. **The legend.** One small row naming the pin kinds that are on the chart: "Agent's swap", "Other swap", "Your directive". A kind with no pin isn't listed. With no pins there is no legend.
5. **The pin panel** (§7), or the quiet line when there are no pins.
6. **The counts** (§8).
7. **The cards line** (§9), when it applies.
8. **The door:** one link, "Open the full tape".

## 5. The chart

- **The lines.** One point per check that holds a numeric score: the player's from `checks[].scores.total`, the opponent's from `checks[].scores.opponent`, each at the check's `at`.
  - **A check with no score breaks the line.** Nothing is joined across it (FL-7).
  - **The opponent's line is drawn only** under the key's CPU condition (FL-3).
  - **On a completed battle's final day,** each line's last point is `battle.final`'s value, drawn at the axis's end. The lines then end at the values the key shows.
- **The time axis** is the day's session, from `sessionOf(etDate)`, early closes included. It carries three labels: the open, the midpoint and the close. When the calendar doesn't know the session, the axis runs from the first check to the last.
- **The value axis** covers both lines and zero, with padding. It carries no numbers. It has a zero line and at most two faint guides.
- **The player's line is solid and the opponent's dashed.** No green or red.
- **The low mark (FL-6).** A small tick and one label under the player's lowest check: "Low {value} · {clock}".
  - The earliest check wins a tie.
  - It is shown only when the day has at least three scored checks and the low isn't the line's last point.
  - It is left out when its label would overlap a pin's touch area or leave the chart.
- **Built as the Deep dive's chart is:** hand-built SVG. No chart library is added.
- **Nothing animates.**

## 6. The pins

- **Sources.** Every `actions[]` row is a swap pin, at its `at`. Every `directives[]` row is a directive pin, at its `filedAt`.
- **Position.** A pin sits on the player's line at its instant: its height is interpolated between the neighbouring checks. An instant outside the line takes the nearest check's height.
- **Kinds (FL-8):**

| Kind | When | Shape |
|---|---|---|
| The agent's swap | `exitMakerOf(action).by` is `agent` | A filled circle |
| Another swap | Any other maker, `unrecorded` included | A hollow circle |
| Your directive | A `directives[]` row | A diamond |

- **At most five (FL-5).** When the day holds more, the five are chosen in this order: the agent's swaps, then the directives, then the other swaps, each group in time order. The chosen pins are shown and numbered in time order. The panel's foot then reads "{n} more on the full tape".
- **Merging (FL-4).** After the five are chosen, pins that would sit closer than 44 px apart at the rendered width become one pin.
  - **The grouping** walks the pins in time order. A pin joins the current group when its centre is closer than 44 px to the group's first pin. Otherwise it starts a new group.
  - **A merged pin** is drawn at its first member's position. It takes the shape of its highest-priority member and shows the lowest number followed by "+".
  - **Its panel** steps through its members in time order, with "Previous" and "Next".
  - **The merge is a pure function** of the pins and the chart's width, so it is tested without a browser.
- **A pin is a button.** Its touch area is at least 44 px. Its accessible name is its fact line. The pins are reachable by keyboard in time order. The chart itself is not a tap target.
- **The selected pin on opening** is the agent's first swap, or the first pin when there is none. When it sits inside a merged pin, the panel opens on it. The selected pin wears the mock-up's teal ring.

## 7. The pin panel

It sits under the legend, in the page. One pin is always selected.

**A swap pin**
- **The fact line:** "{maker} · {out} → {in} · {clock}", then " · sold at {price}" when the tape records the exit price.
  - A symbol the tape doesn't hold reads "not recorded".
  - **The maker comes from the recorded mechanism only:**

| `mechanism` | The maker's words |
|---|---|
| `agent_decision` | Your agent |
| `archetype_rotation` | Stall rule |
| `platform_risk_manager` | Risk rule |
| `guardrail` | Guardrail |
| `gameplan_meeting` | Gameplan meeting |
| anything else | Maker not recorded |

- **No words follow in D1.** D2 adds the agent's overnight words here.
- **The link:** "Open this on the full tape". It opens the tape at that swap, through the navigation the screen already has.

**A directive pin**
- **The fact line:** "Your directive · {clock} · filed" or "Your directive · {clock} · not filed", from `directiveCardOf`.
- **The player's words:** the row's `playerText`, as a quotation marked "You".
- **The agent's reply:** the row's `agentReply`, as a quotation with the agent's mark. It is left out when the row's `agentReplyDiffers` is true: the reply then describes a filing that didn't happen, and the tape is the place that explains it.
- **Both quotations use the screen's existing quotation treatment,** each bound to its own tape path. They are clamped to three lines, with the rest on the tape.
- **The link:** as a swap's. It opens the tape at that directive.

**When the actions' or the directives' coverage is not `complete`,** one quiet line sits under the panel: "Some of this day's record is incomplete. The full tape says what."

**With no pins,** the panel's place holds one line: "Nothing stood out in this game."

## 8. The counts (FL-9, FL-10)

A row of tiles under a heading. The heading is "This game" for a one-day battle and "This day" for a day of a longer one.

| Job label | Count | Caption | Shown when |
|---|---|---|---|
| Trading | {x} of {y} | swaps were its own call | the day has a swap and the actions' coverage is `complete` |
| Working with you | {x} of {y} | directives filed | the day has a directive and the directives' coverage is `complete` |

- **Trading:** `y` is the number of `actions[]` rows. `x` is the number whose maker is the agent.
- **Working with you:** `y` is the number of `directives[]` rows. `x` is the number whose `cardState` is `committed`.
- **A count is "x of y".** Never a percentage, a score, a grade, a meter or a bar.
- **Each count is a declared derived aggregate** in `SCREEN_AGGREGATE_CLASSES` (FL-12).
- **With no tile to show,** the heading is left out too.
- **A tile is not a tap target** in D1.

## 9. The cards line (FL-16)

- **When:** cards resolve on for the battle's owner, and the tape view's Glance would offer at least one moment to take home for this day.
- **The line:** "1 moment to take home, on the full tape" or "{n} moments to take home, on the full tape".
- **A tap opens the tape,** as the door does.
- **Nothing else about cards is on the front.** With cards off, the front has no cards line and asks for nothing the cards read.

## 10. The door and the way back

- **"Open the full tape"** shows the screen as it is on `main`, on Glance, for the same day.
- **On the tape,** when it was opened from the front in this visit, the header's back control returns to the front and reads "Game flow". Otherwise the back control is `main`'s.
- **On the front,** the back control leaves the Film Room, as it does on `main`.
- **A change of day on the front** shows that day's front, or the no-tape page.
- **Focus** moves as the screen's other doors move it: to the tape's panel on opening, and back to the door on returning.

## 11. The fixed copy

All of it lives in `src/screens/filmRoomV2/filmRoomCopy.js`, as the screen's copy does.

| Where | Copy |
|---|---|
| Heading | "Won by {n}" · "Lost by {n}" · "Draw" · "Final {total}" |
| Key | "You" · "CPU" |
| Legend | "Agent's swap" · "Other swap" · "Your directive" |
| Low mark | "Low {value} · {clock}" |
| Makers | "Your agent" · "Stall rule" · "Risk rule" · "Guardrail" · "Gameplan meeting" · "Maker not recorded" |
| Swap fact | "{maker} · {out} → {in} · {clock}" · " · sold at {price}" · "not recorded" |
| Directive fact | "Your directive · {clock} · filed" · "Your directive · {clock} · not filed" |
| Speaker | "You" |
| Stepper | "Previous" · "Next" |
| More pins | "{n} more on the full tape" |
| Pin link | "Open this on the full tape" |
| Incomplete | "Some of this day's record is incomplete. The full tape says what." |
| No pins | "Nothing stood out in this game." |
| Counts | "This game" · "This day" · "Trading" · "Working with you" · "{x} of {y}" · "swaps were its own call" · "directives filed" |
| Cards line | "1 moment to take home, on the full tape" · "{n} moments to take home, on the full tape" |
| Door | "Open the full tape" |
| Back, on the tape | "Game flow" |

**No judgment words.** The front never says a swap, a directive or a game was good or bad. "Won", "Lost" and "Draw" are the recorded result.

## 12. Where the mock-up doesn't govern

| The mock-up | This spec |
|---|---|
| The legend reads "Stall-rule swap". | "Other swap" (FL-8). |
| The legend always lists three kinds. | Only the kinds on the chart. |
| The lines start at 9:30 AM from zero, on a sample shape. | The lines are the tape's, from the first check (FL-7). |
| No low mark. | The low mark (FL-6). |
| "sold at $468.12". | `fmtPrice`'s form, with no currency sign (FL-13). |
| Four tiles; "directives acted on". | Two tiles; "directives filed" (FL-9, FL-10). |
| The idea row and its sheet. | Not built (FL-11). |
| The agent's sentence under the result. | Not built (FL-2). |
| The agent's dated words on a swap pin, and "Your agent's words arrive by the next morning." | D2. |
| A directive's fact line has no state. | It ends in "filed" or "not filed". |
| State 6, "No tape was kept for this game." | The existing no-tape page (FL-15). |
| State 3 keeps tiles with no pins. | The same rule as every day: a tile needs a row to count. |
| The later states. | Not built. |

Everything else is the mock-up's: the layout at 390 and 320 wide and on desktop, the type, the spacing, the colours, the pin shapes, the selected ring, the panel and the tiles.

## 13. What D1 doesn't build

- **The agent's overnight words** (D2): the model call, its record, its rules block, its checks and the census's new path.
- **The counts across games,** and the tiles for Reading the market and Research.
- **The idea** and "Test this".
- **Anything for trader v1.** Build D reads today's one-day game's tape, version 2.
