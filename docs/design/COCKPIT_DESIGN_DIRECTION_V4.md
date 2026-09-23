# The Cockpit — Design Direction V4 (placement and look, final)

**Date:** 2026-09-23 · **Author:** Fable · **Follows:** Direction V3 (the tile feed — its §1, §3, §4, §5, §6 carry unchanged) and the third Claude Design mockup · **Inputs:** the founder's placement rulings on the shipped Battle View; the framework-review chat's three constraints and the backed-week ruling.
**One line:** V3 got the functionality right. V4 puts it on the screen that already has the look, and adds nothing to that screen except the cockpit.

---

## 1. Placement (R-13, R-14 — the founder's rulings, adopted)

**Desktop — keep the split.** Board on the left, untouched. The right pane's tabs become **Cockpit · Chat · Bench · Tape**, with **Cockpit as the default**. The pane header (mark · name · archetype · tabs · ··· · collapse) stays as shipped. The three-column layout from the V3 mockup is dropped: it was cluttered because it put two dense columns beside the board, and the pane is already the right width for a feed of one-row tiles.

**Mobile — keep the Battle View as it is.** The cockpit is a second main screen: **Board ⇄ Cockpit**, a sliding segmented control under the turn row plus a horizontal swipe. The header (scores · tug-of-war) and the turn row stay pinned above both. The floating mark keeps opening the pane it opens today — **Chat · Bench · Tape** — so the chat is one tap away on every screen and never a tab on the main screen. **Board is the default** on mobile (it is the visual identity); the Cockpit segment carries a **needs-you count** ("Cockpit · 2").

**The Command Center hub is untouched.** The agent's mark in the app bar / sidebar opens the Battle View whenever a battle is live (unchanged from V3 R-9).

## 2. The two doors (R-15)

**Research** and **Dials** are small icon pills, placed as the V3 mockup placed them: on **mobile**, the right end of the pinned "THIS TURN" row ("Nothing queued · next check ~10:30 AM ·········· [⌕ Research] [◎ Dials]"); on **desktop**, a slim row at the top of the Cockpit tab carrying the vintage line and the same two pills. Research opens the context-loaded research sheet (V3 §6); Dials opens the exit-dials sheet.

## 3. The Board ⇄ Cockpit animation (R-16)

- Both screens live on one horizontal track; the track translates by one screen width. **320 ms, the segmented thumb's ease** (`cubic-bezier(.2,.9,.2,1)`), so thumb and content move as one.
- Swipe: the content follows the finger; on release it settles to the nearer screen with the same ease. The header and turn row do not move; the floating mark persists.
- `prefers-reduced-motion`: cross-fade, 180 ms.
- Nothing else moves between checks. The check remains the only event: sweep, resolves, re-sort, count.

## 4. The vibrancy pass — the V3 tiles in the shipped language

The mockups were drawn in a flat rendering of the tokens; the shipped board has depth. The cockpit inherits it:

- **Group headers** styled like `⭐ STAR PICKS · 2X EACH`: `⚡ NEEDS YOU · 2` (the player's purple), `⏱ WAITING ON THE CHECK`, `👁 WATCHING`, `🛡 GUARDING`, `EARLIER · 3` (dim). Tracked uppercase, gradient wordmark, badge on the right.
- **State indicator** on every tile: the same glowing dot the fuse uses, colored by state (watching grey · your call purple · acted green · held off purple · asking gold · expired dim · dropped copper).
- **Chips** in the shipped `Ask a follow-up · 1 message` teal-outline style; a filed answer becomes a filled chip with a tick.
- **Kind label** in the eyebrow as tracked mono; the citation ("from the 1:30 check") in ink-2.
- Starfield continues behind the feed; tiles sit on the raised surface with the hairline border; no new colors.

## 5. Tile spec — carried from V3, amended by the framework chat

V3 §3 (six kinds), §4 (tile and sheet), §5 (needs-you ordering) and §6 (research as context-loaded sheets, three outcomes, never a trade) carry unchanged. Amendments:

- **Guarding tile states — typed outcomes only, no hedge language:** armed · evaluated and held · not evaluated · disarmed (reason) · **fired · replaced** · **fired · slot empty** · **mode-blocked**. The dials build's precondition is the always-run deterministic guardrail pass (G-1, exit-dials arc); **stop-versus-LOCK precedence is ruled on the framework sheet before the first dial ships.**
- **Called-shot and confirmation tiles are backed by a shot record** carrying, from v1: a **stable shot id**, a **pinned hypothesis version**, a **horizon with expiry state**, and an **evidence-cutoff id**, joined to the capture record and tick receipts so the Film Room can replay called-versus-happened. The tile's *Expired* is the horizon's expiry state; the player's answer references the shot id, never an evaluation index. Today's anticipation entries are prose on an evaluation with no id, so this record is a build (see §7).
- **The symbol-scoped pick directive** (two-way tiles) ships with a four-layer mismatch fixture — selection · commitment · narration · effect — in its acceptance set.
- **Backed weeks:** calls file for the game as usual and dials stay permitted-and-disclosed; the Record glance (ships last, R-3) writes nothing into the frozen brain until week close — the framework sheet owns that rule. When a backed week applies, the cockpit header shows a small **Backed week** chip.

## 6. The only board change — with the dials, not the cockpit (R-17)

The shipped fuse gains a **stop tick and a target tick** when the dials build lands, so a dial the player sets is visible on the rail it governs. V2's full rail-and-marker treatment is otherwise retired; the board stays as shipped.

## 7. Rulings (founder, approve-by-default)

- **R-13** Desktop: keep the split; the right pane's tabs are Cockpit · Chat · Bench · Tape, Cockpit default; the board untouched.
- **R-14** Mobile: keep the Battle View; Board ⇄ Cockpit as animated main screens, Board default with a needs-you count on the Cockpit segment; chat stays behind the floating mark (Chat · Bench · Tape).
- **R-15** Research and Dials pills on the turn row (mobile) and the cockpit's top row (desktop).
- **R-16** The slide animation as §3; the check remains the only other motion.
- **R-17** The board changes only with the dials build (stop and target ticks on the fuse).
- Superseded: V3 R-9's three-column desktop and R-12's rails on the board. V3 R-8, R-10, R-11 stand.

## 8. Next Claude Design round — paste this

> Redraw the cockpit onto the shipped FantasyTrades Battle View, matching its exact visual language (the starfield, the tug-of-war header, the STAR PICKS / CORE HOLDS tier headers with gradient wordmarks and badges, the glowing fuse dots, the teal-outline chips like "Ask a follow-up · 1 message", the tracked mono eyebrows). Do not restyle the board or the header. Mobile (390×844): keep the shipped board; add a sliding segmented control "Board · Cockpit · 2" under the THIS TURN row; add two small icon pills at the right end of the THIS TURN row, "Research" (magnifier, teal) and "Dials" (target, gold); the Cockpit screen is the V3 tile feed with group headers styled like the tier headers — "⚡ NEEDS YOU · 2" in the player's purple, "WAITING ON THE CHECK", "WATCHING", "GUARDING", "EARLIER · 3" dimmed — and each tile showing a glowing state dot, a mono eyebrow (kind · citation), one plain line, and one control in the shipped chip style; the floating agent mark stays bottom-right and opens the shipped Chat · Bench · Tape pane. Desktop (1440 wide): keep the shipped two-column split exactly; the right pane's tabs become "Cockpit · Chat · Bench · Tape" with Cockpit selected; a slim row at the top of the Cockpit tab carries "Prices as of 1:37 PM · checks at ~1:45" and the two pills; the feed below. Deliver six screens: mobile board with the segmented control and pills; mobile cockpit at 1:38 PM; the slide mid-transition (track at −50%); a tile's sheet open; the check landing on the cockpit (sweep, a receipt appearing, the re-sort); desktop with the Cockpit tab selected. No new colors, no new type; no continuous animation.

## 9. Sequence

R-13–R-17 → this prompt to Claude Design (a styling pass; one round) → **discovery prompt** (read-only, Opus) leading with: the shot record (where anticipation entries live today; what a stable id, hypothesis version, horizon and evidence-cutoff id would attach to; the join to tick receipts), the symbol-scoped pick directive and its four-layer fixture, the chat-line → tile derivation from existing records, the research sheet's reuse of the stock modal and screener, the pane-tab and segmented-control seams in the shipped Battle View, and the app-bar mark → **spec V1** → Astra review → build, gated per Brief §8 plus the framework constraints in §5.
