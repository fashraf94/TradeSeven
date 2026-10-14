# The Cockpit — Design Pass V1 (after live week 1)

**Date:** 2026-10-09 · **Author:** Fable · **Status:** proposal; rulings DP-1 to DP-7 are approve-by-default unless the founder amends them.
**Inputs:** the week-1 read (`docs/audits/20261009_COCKPIT_LIVE_WEEK1_READ.md`, PR #949) · the Build 2a report §13 (`docs/audits/20261003_BUILD2A_COCKPIT_SCREEN.md`) · the Build 2 discovery (`docs/audits/20261002_PHASE0_BUILD2_COCKPIT.md`) · the QA tester's audit (Oct 5) · the framework chat's two Build 2b rules (Oct 5) · founder rulings of Oct 5 (a 7-command cockpit budget, chat keeps its 10) and Oct 7 (research screener inside the cockpit; dials after 2b).
**Destination:** `docs/design/COCKPIT_DESIGN_PASS_V1.md`, committed as the first commit of the Build 2b discovery session. Nothing to do with this file now except read it and rule.
**Governs:** the next cockpit build (2b) and the Claude Design round that precedes its spec. It does not change Build 2a's live behavior; every change here ships behind the existing flags and allowlist.

---

## 0. What the first live week said, in plain terms

- **The loop works.** Both overrides reached the agent at its next check (10 and 9 minutes). It followed them at every later check. The records are clean: zero integrity violations, no failed publication.
- **The agent talks far more than the player answers.** About 10 calls a battle-day. The founder answered 4 of 110 calls in the week; the QA account answered 0 of 25. Most calls expired unanswered. The cockpit makes many small moments where the game needs a few big ones.
- **The agent plans exits without saying what comes in.** 101 exit calls; 12 named a usable replacement. At the checks that made the other 89, the agent was already eyeing an available bench name 6 times in 10. That is the Crossroads the discovery predicted, now measured live.
- **"One instruction at a time" never bit.** Zero second-override refusals. The limit is theoretical this week, but a 7-command budget would make it real.
- **Three honesty gaps showed up**: an instruction that outlived its stock (VLO), an "Acted" that turned into "Battle ended" (AMZN), and one event with two labels ("Expired" vs "Battle ended" by the battle's end time alone).
- **Timeouts rose.** Founder 13.4% of checks (7–8% before the flip); the Diversifier 39%. A timed-out check makes no decision. Whether the cockpit's longer answers cause this is the first thing the next discovery measures (§7).

The design that follows does four things: fewer, bigger moments; buttons that say what they do; a cockpit budget that is really spendable; and the Crossroads built where the data says it lives, on the exit call.

---

## 1. DP-1 · The shape: a spotlight, not a list

The feed stays as the data model (groups, threads, tags). What changes is what the screen leads with.

**The Now card.** One moment, big, at the top. Chosen by priority:
1. an exit the agent **will** make (a Confirmation) with no replacement named → "Who comes in?" (§5);
2. a Confirmation awaiting your word;
3. a called shot the agent plans to hold on;
4. the status of your live command (heard · waiting · acted), when nothing above is open.

The card states the plan as a sentence, not a line: *"Shadow plans to exit AMD if it breaks $610 by today's close. If you say nothing, it exits."* Then the deadline, the cited price, and the buttons (§2). The sheet stays as the detail view.

**The "Also live" strip.** Every other open call as a chip: `AFRM ↓ 66.74 · hold`, `PSX ↓ 250.96 · hold`. Tap a chip and it expands in place (the full tile), tap again to collapse. Restated threads are one chip. Upside calls are chips with no buttons.

**The day line.** Under the strip, one line that keeps score of the coaching: *"Today · 10 calls · 2 hit · 7 expired · you answered 2".* This is the cockpit's scoreboard; the brief said the game keeps score of the coaching.

**Monitoring** stays a row of symbol chips. **Earlier** is collapsed by default behind the day line.

**Board marks.** A small dot on a board row whose symbol has an open call (teal = your command is live on it; neutral = a call is open). Deferred in 2a; it lands here so the board and the cockpit visibly connect.

**Phone:** the Board · Cockpit switch, the pinned header and the needs-you count stay as shipped; the Now card is the first thing on the Cockpit screen.

**Process:** one Claude Design round draws this on the shipped screens (structure, behavior and vocabulary only; skin from the existing tokens), the way V4 was drawn. The paste-ready prompt is §9. The 2b spec is written from that round's winner plus this document.

---

## 2. DP-2 · Buttons that say what they do

The week's screenshot showed two tiles reading "Hold / Go instead" with nothing saying what "Go" would do. Every button names the action; every override names its cost.

| Call | The plan (on the card) | Agrees (free) | Overrides (1 command) |
|---|---|---|---|
| Confirmation (exit, agent will act) | "If you say nothing, Shadow exits AMD" | **Confirm exit** | **Hold off** · 1 |
| Called shot, entry, agent will act | "…Shadow brings MU into Core" | **Go if it triggers** | **Hold off** · 1 |
| Called shot, exit, agent plans to hold | "…Shadow holds AMD and reassesses" | **Hold** | **Exit instead** · 1 |
| Called shot, entry, agent plans to hold | "…Shadow waits on MU" | **Hold** | **Bring it in** · 1 |
| Upside call (held stock, bonus line) | "…nothing changes" | — | — |
| Following your call (§6) | "Shadow is following your command" | — | — |

The plan line moves from the sheet onto the card. The "· 1" is the command cost, drawn as one bullet (§3).

---

## 3. DP-3 · Commands: the cockpit's own budget, shown as bullets

- **7 commands per battle.** An override or a replacement pick spends one. Agreeing is free. Chat keeps its own 10 messages; the cockpit no longer charges chat.
- **Shown as bullets:** a meter of seven dots in the cockpit header (`●●●●●○○ · 5 left`), and one filled dot on each override button. The record field is `commandsUsed`, written by the answer endpoint inside its transaction (contract: Amendment D).
- **At zero:** override buttons read "No commands left" and are disabled; agreeing stays free; the chat is untouched.
- **A replacement (§4) spends a command too.** Changing your mind costs the same as making it up.
- BaggerBomb only; league battles never resolve cockpit-on, so the group budget is untouched.

Honest note: with four answers a week, this budget will not bind yet. It is cheap, it makes the cockpit self-contained, and it is the scarcity the Crossroads will need once exits ask "who comes in?" several times a day.

---

## 4. DP-4 · One live command at a time: replace, never refuse

Today a second override is refused with "one call at a time" until the first command's deadline, usually the close. With a 7-command budget that lock would make six of the seven bullets unusable in practice.

**Rule:** the cockpit holds **one live command**, and a new command **replaces** it:
- Before filing, when a live command exists, the card asks once: *"This replaces your hold-off on AMD. Shadow stops hearing it at its next check."* Confirm files it. (This is the framework chat's rule: a replacement never silently evicts a heard override.)
- The replaced command's tile reads **"Replaced by your later command · 1:38 PM"** (the tag exists) and gets a `superseded` receipt, exactly as a chat directive already does when it replaces a cockpit command.
- The agent's prompt carries the newest command. Heard, acted and no-matching-trade receipts keep working as today.
- The chat composer gets one small line while a cockpit command is live: *"Sending a directive replaces your cockpit command on AMD."* Chat already replaces silently; the line removes the silence.

**What this is not:** several live commands at once. The agent's prompt holds one directive, and widening that touches the fenced prompt assembler. Multi-command is its own build with its own discovery, after 2b, if the live data ever shows players wanting two commands open at once (this week: zero).

---

## 5. DP-5 · The Crossroads lives on the exit call: "Who comes in?"

The data says the choice the agent never formats is the replacement for an exit it is about to make. So the Crossroads is not a new tile. It is the second step of an exit tile.

**When it appears:** on a Confirmation (exit, agent will act) whose replacement is missing, and on a hold-default exit call the moment you choose **Exit instead**. Not on calls that already name a usable replacement.

**The step:** *"Who comes in for AMD?"* with up to four options, each labelled by where it came from:
- **"Shadow is eyeing"** — names from the agent's own lists at that check (its anticipation candidates and its watch list), only if the bench shows them available. These come first.
- **"From your bench"** — the top available bench names by the agent's own bench score in that check's prompt, filling to four.
- **"Browse the bench →"** opens the research screener as a cockpit sheet, scoped to the available bench, with **Pick as replacement** on every row. This is the Oct 7 ruling: research inside the cockpit, with a job.

**What a pick does:** files one command, *"If you exit AMD before today's close, bring in DHR,"* the contract's `call_replace` (Amendment C-8). It spends one command and replaces any live command (§4's warning). Receipts: **heard** at the next check; **acted** when a trade exits AMD and brings in DHR; **no matching trade** when a check that heard it traded otherwise.

**Honesty:** the card never says the agent offered a choice. "Shadow is eyeing" is used only for names from its own lists; "From your bench" names are the platform's. Both labels are stored with the options, so the Film Room can replay what was offered and what you picked.

**Record shape (Amendment D):** the options and their sources are stored **on the exit call** (`replacementOptions[]`, filled at mint when the counterpart is null), not as a separate pick call. This supersedes Amendment C-7's placement; C-7's two fields (`origin`, `options[].source`) keep their meaning on that list. One fewer record family, no extra documents per exit.

**Two rules from the framework chat, both honored:**
- a replacement pick never silently evicts a heard override (§4's confirmation);
- the replacement name shown at mint uses the same "held in this slot" test as the filing check, so the card never shows a name the endpoint would refuse (Amendment D aligns C-3's mint rule with `counterpart_not_held`).

**Research Objective** needs no separate tile: when the agent's own lists name fewer than two available names, "Browse the bench" *is* the research objective, and the pick is its answer.

---

## 6. DP-6 · Receipt and label fixes from the week

| What the week showed | Rule |
|---|---|
| The VLO "Go now" stayed in 11 prompts after the risk check had sold VLO. | A live command is **retired when its symbol leaves the book by any route** (risk loop, forced exit, your pick). Receipt: *"VLO left the book at the 1:17 PM check · command retired."* |
| The AMZN call was acted on, then read "Battle ended". | **Acted wins.** An acted call keeps "Acted at the 2:30 PM check" whatever closes it afterwards. |
| The same expiry reads "Expired" or "Battle ended" by the battle's end time alone. | One label. A call whose deadline falls at or before the battle's end reads **Expired · 4:00 PM**; "Battle ended" only when the battle ended before the deadline. |
| After your ZS "Go now", the agent restated the line six times with its own plan changed to act, each a new Needs-you tile. | A call whose plan matches your live command on that symbol, direction and side (within 1%) reads **Following your call**, folds into your answered thread, and takes no answer. |
| A tap within 60 s of a deadline can be refused as expired. | The card stops offering answers at the deadline on the server's clock, not the 60-second client tick. |
| An answer filed after the day's last check shows "Filed · not yet heard" with no check left. | **"Filed · no check left today"** after the session's last slot. |
| The safety-check script also prints pre-cockpit "violations=89 / tripped=2" lines. | Drop them; count API-refused checks separately from the denominator; add a timeout warning line (warning, not a trip). |
| "Dropped" says nothing about why. | Store the mint reason on the call (`invalidatedReason`) so the tag can read "Dropped · price line out of range" honestly. (Amendment D.) |

Plus the smaller items from 2a §13: the refusal line clears under "Acted"; the sheet's receipts cite the check they name.

---

## 7. DP-7 · Timeouts: measure before deciding

Timeouts are the one number that moved the wrong way. The hypothesis: the live wording makes the agent declare on 37–55% of checks, and a declarations block can run to ~1,460 output tokens, which the model has to generate inside the same 20-second limit as the trade decision. The shadow era doesn't test this (it declared on 4 of 166 checks).

**The discovery measures:** time per check for declaring vs non-declaring checks, output tokens against time, by archetype, this week against the two pre-flip windows; and the Diversifier's own prompt size.

**If confirmed, the options, for a founder ruling after the numbers:**
1. raise the model timeout from 20 s toward 30 s, if the check's admission budget (48 s) allows it;
2. cap the agent at 3 called shots per check instead of 6 (a text change, re-qualified by replay);
3. both.

**The text revision rides the same replay** (round 4, about $15 at batch prices): remove the wording that still tells the agent the player sees forks and research questions; fix the "hold in the direction field" mix-up that drops about 1 called shot in 8 (13 malformed this week); and the shot cap if chosen. Measured against 1A-C's bars. That replay is also where `call_replace`'s model-visible text gets its first exposure.

---

## 8. Sequence

1. **Monday: the 2b discovery** (read-only, local; one Claude Code session). The timing read (§7); the seams for the command counter, the replace rule, retire-on-exit, the options assembly (the bench score at mint), the screener as a sheet; and three counts: Confirmations without a replacement per battle-day, how often two live commands would have been wanted (two overrides inside one deadline window), and the eyeing-name availability per exit. Commits this document.
2. **Over the weekend or in parallel: the Claude Design round** (§9). Founder runs it; one round, the way V4 was chosen.
3. **Amendment D** (commands counter; replace semantics; `replacementOptions` on the exit call, superseding C-7's placement; `call_replace` per C-8 with the mint/filing held-test alignment; retire-on-exit; `invalidatedReason`) → framework chat blessing. Also corrects Amendment C's stale "gates the Build 2a merge" header.
4. **The 2b spec**, from this document, the design winner and the discovery → one Astra round (the design risk is here, unlike 2a) → **build 2b**, fenced-class because `call_replace`'s text is model-visible.
5. **Round-4 replay** for the text revision, before the 2b flip.
6. **Dials** come after 2b as their own build (the always-run safety pass and "your stop beats the agent's lock" are its prerequisites).

**Framework lane:** the record-slice flip (#948) merges any time after the FT_QA allowlist note. **P1c builds after 2b, not alongside it**; both touch the call-record writer.

---

## 9. The Claude Design prompt (paste-ready; attach the V4 mockup HTML and this week's two screenshots)

```
The Cockpit — V5: spotlight, not list. Redraw ONLY the cockpit areas of the two attached shipped screenshots
(desktop: the right pane's Cockpit tab; phone: the Cockpit screen under the Board · Cockpit switch). Keep every
shipped color, token, font and the board exactly as they are; contribute structure, behavior and vocabulary only.
Use the attached V4 mockup for tile anatomy and feel, not for palette.

Draw six screens:
1. Desktop Cockpit tab — the NOW CARD leads: "Shadow plans to exit AMD if it breaks $610 by today's close.
   If you say nothing, it exits." Deadline, cited price, two buttons: [Confirm exit] [Hold off ·●]. Under it a
   second step on the same card: "Who comes in for AMD?" with four option chips — two labelled "Shadow is eyeing"
   (DHR, CEG) and two labelled "From your bench" (PM, MSFT) — and a "Browse the bench →" link. Below the card:
   the ALSO LIVE strip (three chips: "AFRM ↓ 66.74 · hold", "PSX ↓ 250.96 · hold", "AMD ↑ 625 · upside"), the
   DAY LINE ("Today · 10 calls · 2 hit · 7 expired · you answered 2"), the MONITORING chip row, and a collapsed
   EARLIER. Header: "Prices as of the 11:00 AM check · next ~11:15" and a bullets meter "●●●●●○○ · 5 left".
2. Desktop, Now card for a hold-default call: "Shadow plans to hold PSX and reassess if it dips below $250.96."
   Buttons [Hold] [Exit instead ·●].
3. Desktop, Now card showing a live command: tag "Heard at the 1:45 PM check", receipts Filed → Heard, and one
   expanded chip in the strip tagged "Following your call" with no buttons.
4. Desktop, the replace confirmation: a small inline prompt on the card — "This replaces your hold-off on AMD.
   Shadow stops hearing it at its next check." [Replace ·●] [Keep AMD].
5. Phone Cockpit screen: Now card (screen 1's state), bullets meter, strip, day line, Monitoring. The Board ·
   Cockpit switch, the pinned header and the needs-you count stay exactly as shipped.
6. The replacement sheet (phone and desktop): the research screener scoped to the available bench, each row with
   a [Pick as replacement] button, "Show It" where it exists today, and the chosen row confirmed at the top.

Also show one board row with a small teal dot (the symbol has your live command) and one with a neutral dot
(an open call). The Research pill may return on the turn row (it opens the replacement sheet); the Dials pill
stays absent. Vocabulary that must never appear: "Held off", "Asking you", "Ask me first", "Declined", "Honored".
Every override button carries one filled bullet; agreeing buttons carry none.
```

---

## 10. Rulings in this pass (approve-by-default)

| ID | Ruling |
|---|---|
| DP-1 | Spotlight shape: the Now card by the stated priority, the Also-live strip, the day line, collapsed Earlier, board-row dots. One Claude Design round, then the spec. |
| DP-2 | Buttons name their action; the plan line moves onto the card. |
| DP-3 | 7 commands per battle, shown as bullets; overrides and picks spend one; agreeing is free; chat keeps its 10. |
| DP-4 | One live command; a new command replaces it after an explicit confirmation; receipts and tags record the replacement; multi-command deferred to its own build. |
| DP-5 | The Crossroads is the "Who comes in?" step on exit calls: agent's names first, bench names second, the screener for the rest; the pick files `call_replace`; options stored on the exit call. |
| DP-6 | The receipt and label fixes in §6. |
| DP-7 | Timeouts are measured first; the timeout fix and the text revision are ruled on the numbers, and ride one replay. |

**Needs the founder's eye (not approve-by-default):** none. Two things worth a glance: the bullet meter as the display of commands (DP-3), and whether "From your bench" options belong on the card at all or only behind "Browse the bench" (DP-5; the recommendation is on the card, labelled, because the agent's own lists cover only 6 exits in 10).
