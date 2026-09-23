# The Cockpit — Design Direction V3

**Date:** 2026-09-23 · **Author:** Fable · **Follows:** Brief V1, Direction V2, and the two Claude Design mockups (Top Layer; Top Layer V2) · **For:** the next Claude Design round, then the spec.
**One line:** V1 had the right cards at the wrong density; V2 had the right density on the wrong subject. V3 is V1's cards and states at V2's density, with the chat as the driver.

---

## 1. The spine — chat drives, cockpit acts, board shows

The chat is the window into the agent's thinking (unchanged, as shipped). The cockpit is where what the agent says becomes something the player can do. The board is the result — the player against the opponent.

**The binding (R-8):** every cockpit card is born from a line the agent wrote — a check's bench note, a holding note, a fork it named, a question it asked, a list of names it said it was watching — and the card cites that line ("from the 1:30 check" · "from chat 12:47"). Tapping the citation opens the chat scrolled to that line. In the chat, a line that spawned a card carries a small "→ cockpit" chip. Because cards are derived from the record, nothing on the cockpit can be decorative (P2 holds by construction), and the agent's honest labels travel with the card.

## 2. Placement (R-9, replaces R-4)

- The **Command Center hub** — the BaggerBomb screen the player comes from (agent, deploy, the live-battle card) — is untouched.
- The **cockpit lives inside the Battle View, between the board and the chat.** Desktop: three columns, **Board · Cockpit · Chat**. Mobile: three tabs in that order, cockpit default, with the header (scores · tug-of-war · turn line · vintage line) pinned above every tab so you-versus-them is one glance from anywhere.
- **Chat remains exactly as shipped.** The cockpit adds the "→ cockpit" chip to lines that spawned cards and nothing else.
- **One tap from anywhere:** the agent's mark sits in the app bar / sidebar whenever a battle is live and opens the Battle View on the cockpit tab.

## 3. Card kinds — what spawns each, what it shows, its one control

| Kind | Spawned by | Tile shows | Control | States (from V1, kept) |
|---|---|---|---|---|
| **Monitoring** | a check naming the bench names it is watching | "Watching · HOOD · NOW · TSLA" | tap a name → stock modal / research sheet | current · stale (from an earlier check) |
| **Called shot** | an anticipation entry with a condition | "HOOD into Support · if it holds $125" | *Go if it triggers · Hold off · Ask me first* | watching · your call filed · acted · held off · asking you · expired · dropped |
| **Confirmation** | a holding note whose default is to act ("I cut CRM if it loses $258") | "Cutting CRM · if it loses $258" | *Confirm · Hold off · Ask me first* | same as called shot (the label differs, the record does not) |
| **Two-way** | a fork the agent named | "Core slot · ZS or INTC" | *Pick ZS · Pick INTC*, with *Research* on each | open · your pick · the agent picked (→ *Agree for next time?*) · expired |
| **Research objective** | the agent asking the player to look into something (Scouting Assignments V2) | "Look into · is ZS's print before Friday?" | *Research* → then one of the agent's offered answers (chips) | open · researching · answered · agent moved on · expired |
| **Guarding** | the capture record / the dials | "Guarding · stop −6% · trail off · VWAP off" | *Dials* door | armed · evaluated and held · not evaluated · disarmed · fired |

The call log and the Record stay behind the agent's mark (tap → *Your calls · Its record*) with the calls count as a badge. One fork at a time (R-6 stands). A research objective's answer is one of the agent's own offered options so it files like a chip; anything else goes to chat.

## 4. Card anatomy — tile and sheet (R-7 amended)

A **tile** is one row: eyebrow (kind · citation), one plain line, a state tag, the one control. No sentence, no fact line, no receipt on the tile.

A tap opens the **sheet**: the agent's exact sentence (verbatim, "the agent's own words"), the facts with their as-of, the default ("If you say nothing · it rotates it in"), the receipt history (*Filed 1:38 PM* → *Heard at the 1:45 PM check*), and two doors — *Why?* and *Open in chat at this line*. Every V1 state survives here; the stack does not.

One **vintage line** under the header (kept from V2) replaces per-card fact lines; *not seen by the agent* stays reserved for the diagnostic pane.

## 5. Ordering — needs you first (R-11)

Top to bottom: open two-ways and research objectives → called shots and confirmations with no call yet → shots with a call filed (waiting on the check) → monitoring → guarding → today's resolved items (acted · held off · answered) and expired ones folded under **Earlier**, dimmed. A tile moves when its state changes, at the check — the only event (V2 §5 stands).

## 6. Research in the cockpit (R-10)

Yes — as a **sheet, with context**, not as a new tool: the same stock modal and screener the platform already has, opened from a card with the symbol and the agent's framing pre-loaded, or from a standing **Research** door on the cockpit header for curiosity. Three outcomes, no fourth: **answer** a two-way or an objective; **flag for next deploy** (a watchlist write, so it reaches the Record); **take it to chat** (prefilled "About ZS —"). Research never places a trade, and the sheet never implies it can. *Show it* (the agent's own read, Phase C) appears inside the sheet once grounding is on.

## 7. What moves to the board (R-12)

V2's rails, the guard ticks, and the dials moving the stop and target markers move to the **board**, where you-versus-them lives. The board gets better; the cockpit stops imitating it. A called shot's condition is a target tick on the board too — the board and the cockpit show the same record from two sides.

## 8. Kept from V1 and V2

V1: the loop, every state, the vocabulary, the states board, the agent's mark and bubble. V2: the vintage line, the doors behind the mark, the *Dials* door, the sheet shell, the check as the only event, no continuous motion.

## 9. Rulings (founder, approve-by-default)

- **R-5 withdrawn** for the cockpit; redirected to the board (R-12).
- **R-8** The chat is the driver: every card cites the agent's line that spawned it, and that line gets a "→ cockpit" chip.
- **R-9** Placement: Board · Cockpit · Chat inside the Battle View; Command Center hub untouched; the agent's mark is the global door.
- **R-10** Research in the cockpit as context-loaded sheets of the existing tools; three outcomes; never a trade.
- **R-11** Needs-you-first ordering, with the day's resolved items folded under *Earlier*.
- **R-12** Rails, guard ticks and dial markers live on the board.

## 10. Next Claude Design round — paste this

> Redraw the cockpit as the middle tab of the mobile Battle View (390×844) and as the middle column of the desktop Battle View (Board · Cockpit · Chat, 1280 wide). Keep the existing header (scores, tug-of-war, turn line) pinned, with one vintage line under it ("Prices as of 1:37 PM · checks at ~1:45"), a small Research door and a Dials door on the right. The cockpit is a feed of action tiles born from chat lines. Six tile kinds, each one row — eyebrow (kind · "from the 1:30 check" or "from chat 12:47"), one plain line, a state tag, one control: Monitoring ("Watching · HOOD · NOW · TSLA", names tappable); Called shot ("HOOD into Support · if it holds $125", chips Go if it triggers · Hold off · Ask me first); Confirmation ("Cutting CRM · if it loses $258", chips Confirm · Hold off · Ask me first); Two-way ("Core slot · ZS or INTC", Pick ZS · Pick INTC, a Research link under each); Research objective ("Look into · is ZS's print before Friday?", a Research button, then the agent's three offered answers as chips); Guarding ("Guarding · stop −6% · trail off · VWAP off", a Dials door). No sentences or fact lines on tiles. Order: open two-ways and objectives, then shots with no call, then shots with a call filed, then Monitoring, then Guarding, then an "Earlier" fold holding today's resolved and expired tiles, dimmed. Tapping a tile opens a bottom sheet with: the agent's exact sentence labeled "the agent's own words", the facts with as-of, the default line ("If you say nothing · it rotates it in"), the receipts (Filed 1:38 PM · Heard at the 1:45 PM check), and two doors — Why? and Open in chat at this line. Tapping a citation or a name opens the chat scrolled to that line, or the stock modal, as a sheet; the research sheet shows the existing stock modal/screener with the symbol pre-loaded and three actions at the bottom: Answer, Flag for next deploy, Ask in chat. The agent's mark sits bottom-right with its bubble, an unread count and a calls badge; tapping it opens Your calls · Its record. On the desktop layout, the chat column is the shipped chat with a small "→ cockpit" chip on the three lines that spawned tiles. Deliver eight screens: mobile 1:38 PM before any call; a called-shot tile tapped (sheet open); a two-way tile with Research opened (research sheet); a research objective answered; the check landing (tiles re-sorting, receipts appearing, the bubble updating); the Earlier fold open; market closed; the desktop three-column view at 1:38 PM. No continuous animation; the check is the only event.

## 11. Sequence

R-8–R-12 rulings → this prompt to Claude Design → discovery prompt (leads: the symbol-scoped pick directive; the chat-line → card derivation from existing records; the research sheet's reuse of the stock modal and screener; the app-bar mark) → spec V1 → Astra review → build, gated per Brief §8.
