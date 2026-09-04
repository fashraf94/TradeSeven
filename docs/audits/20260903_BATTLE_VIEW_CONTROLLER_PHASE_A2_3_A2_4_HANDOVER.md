# Battle View controller — Phase A2 (the rulings addendum, A2.3 and A2.4) handover

> **SUPERSEDED IN PART, Sep 3 (evening), by the flip-prep PR (D-86 → D-90).**
> Three things below are no longer true and are left in place rather than
> rewritten, because a handover is a record of what was handed over:
>
> - **Ruling 4 is superseded by D-89.** `Read the full check` no longer opens
>   the book panel above the board and focuses its heading; it opens that
>   check's own CARD in the conversation, expanded and focused. The conformance
>   row and smoke step 6 below both describe the old behaviour.
> - **The check card's eyebrow changed** from `At the {t} check · {state}` to
>   `Status check · {t} · {state}` (D-86). The copy table below has the old one.
> - **Two of this document's own recorded items are resolved by removal, not by
>   a fix:** §5's "scrolls against the panel's collapsed box" and "on mobile at
>   the FULL detent, focus lands underneath the sheet" both described the panel
>   landing that D-89 deleted. Neither needs the founder ruling it asked for.
>
> §5 item 12 (the unread source) is ruled and built as D-88.

**Date:** September 3, 2026
**Branch:** `claude/phase-a2-tape-piece-javcyf` (the branch the rulings named; the harness's own session branch is not used).
**Base:** `112b307d`, the A2 review's last fix. **Head at handoff:** see §8.
**Built from:** `PHASE_A2_RULINGS_ADDENDUM_V1_1.md` (newest, wins), with `PHASE_A2_RULINGS_AND_AMENDMENTS_V1.md` and `PHASE_A2_SEED_TAPE_AND_PIECE_V1.md`.
**Status:** built, reviewed, pushed. **STOP for the founder's smoke.** No PR opened.

---

## 1. Executive verdict

| # | Ruled | Built | Where |
|---|---|---|---|
| ruling 1 | D-80 — translate the guardrail's provenance code, or drop the parenthetical | ✅ | `selectWhyState.renderMotive`, `battleViewCopy.guardrailTypeWords` |
| ruling 2 | D-81 — the other eight trigger strings, `near` not `nearing` | ✅ | `battleViewCopy.wokenByType` — **not named in the addendum's §4 Go list**; built because "Accepted" is a build instruction where rulings 3/5/6/7 carry explicit no-build dispositions, and because D-81 is one of the ledger rows §3 asks this session to leave behind |
| ruling 3 | D-82 — D-71 stays unflagged | ✅ (nothing to build; recorded) | ledger |
| ruling 4 | `Read the full check` scrolls into view and focuses | ✅ | `AgentBattleScreen`, `WhyPanel` |
| ruling 5 | tap targets in trade cards — deferred | — | not built, by ruling |
| ruling 6 | A2.1b stays | — | untouched |
| ruling 7 | the sheet hook on both shells; the detent survives a crossing | ✅ | `useChatSheet`, `AgentBattleScreen` |
| item 8 | D-83 — a check is named by its cron slot | ✅ | `deriveTurnLine.slotLabel` |
| item 9 | D-84 — the tape's four visual kinds | ✅ | `TapeCards.jsx` |
| item 10 | D-85 — the current price on the player's row | ✅ | `TacticalRow.jsx` |
| item 11 | the chat's send-failure line under the flag | ✅ | `battleViewCopy.chatSendFailed`, `AgentChat` |
| A2.3 | the detector, the roster, `In the chat · n`, the scope chip | ✅ | `findKnownTickers.js`, `selectSymbolRoster.js`, `scopeTape.js` |
| A2.4 | the peek line, the strip, the desktop collapse | ✅ | `derivePeekLine.js`, `PeekStrip.jsx` |

**One thing the founder should see before anything else:** D-83 now ships on the **Desk** as well. The first build scoped it to the flagged surfaces; the review found (twice, independently) that the turn line's strings ARE the Desk's, shared under a D-62 comment that says the two "cannot disagree" — and that the repo's own tests had begun to encode the contradiction. Fixing it at the shared seam is what the ledger row asks for ("on every surface").

**And a correction to that, which the founder should read second:** the review first recorded this as a *second unflagged* A2 change, user-visible today. Refuter A checked and it is not. `featureFlags.js:1887` has `COMMAND_CENTER_SYNC_ENABLED = false`, and `CommandDashboard.jsx:546` renders `<AgentDesk>` only when `sync` is non-null, which that dark flag prevents — so both surfaces consuming the flooring are dark and nothing changed for a real user. D-82's remains the only unflagged change in A2. What is true is that the Desk's posture line will read `Checked 12:45 PM` where it used to read `Checked 12:47 PM` the moment `COMMAND_CENTER_SYNC_ENABLED` flips. §4 item 54 has the reasoning, corrected.

---

## 2. Founder smoke — what to look at

On a live battle with the controller flag ON:

1. **A guardrail-forced swap.** Its trade card reads `Guardrail override (stop-loss): …` — not `(guardrail_stopLoss)` — footed `The system's reason`. No `_`-joined code anywhere on the screen.
2. **One tick, three surfaces.** The turn line, the Why? eyebrow and the check card all name the same check by the same quarter-hour (`12:30 PM`, never `12:31 PM` beside `12:30 PM`).
3. **The tape reads as four kinds.** Scroll the chat: the character's bubbles, your own right-aligned bubbles, the directive cards — and the check/trade cards now FLAT, edged, mono-headed, one sentence with `Read more`. A record should never look like something that spoke.
4. **The board.** Your side of each row shows `$264.75` beside the `%`; the CPU side shows no price.
5. **Tap a piece → `In the chat · 3`.** Tap that: the chat filters to that piece with a `NVDA · All` chip, and there are exactly three entries. Tap the chip: the whole tape returns where you left it.
6. **`Read the full check`** on a row low on the board: the book panel opens AND scrolls into view, with focus on its heading. Tap it again with the panel already open — it should still scroll and focus.
7. **Desktop collapse.** The `▾` on the chat column folds it to a strip at the bottom of the board; the board takes the full width; the strip shows the turn line and the newest tape line (`Filed 3:50 PM · Widen the spread`). A new feed entry puts a dot on the strip. `▴` restores.
8. **The crossing.** Collapse on the desktop, narrow the window to a phone width: the sheet is at PEEK. Open it, widen: the column is back. (Phase A reset it to peek every time; ruling 7 changed that.)
9. **A failed send** (offline, or a 500): `The character couldn't answer just now · nothing was sent`. Note what else happens — **the words you typed are gone from the composer**. That is shipped behaviour, not this phase's, and it is now pinned by a test so a ruling has somewhere to land (§5 item 6).
10. **THE ONE THING ONLY A BROWSER CAN SETTLE — the collapsed desktop's scrolling.** Collapse the chat on a desktop window with a board TALLER than the window. The **board** should scroll inside itself while the strip stays pinned at the bottom of the viewport with its unread dot on screen. If instead the whole PAGE scrolls and the strip is somewhere below the board, the collapse is still wrong: refuter A reasoned from the flexbox spec that the first construction (a wrapped row) sizes each line to its content and breaks the board's own scroller, and the fix rebuilt the collapse as a `flexDirection: 'column'` so the board has a bounded height. jsdom does no layout, so this is the one claim in the whole phase that has no executable guard. The same look settles §5 item 2 (the mobile sheet's clearance).
11. **The turn line's `next ~`, watched for two minutes.** After a check lands, `next ~1:00 PM` should be on screen until 1:00 and then be gone — never still saying `next ~1:00 PM` at 1:02. (It did, briefly, for as long as the last check was late; that is fixed.)

**And on the DASHBOARD:** the Desk's posture line names the check's quarter-hour — `Checked 12:45 PM · next ~1:00 PM`, never `12:47`. The minute is the cron's slot rather than its write latency. Nothing to check today: `COMMAND_CENTER_SYNC_ENABLED` is dark and the Desk does not render.

---

## 3. Strings added this session

All in `battleViewCopy.js` unless noted.

- `guardrailTypeWords`: `stop-loss` · `trailing stop` · `profit target` (D-80) — the founder's existing swap-ledger taxonomy, kept in step by a source tripwire.
- `wokenByType` +8 (D-81): `Woken by the first check of the battle` · `Woken by the final hour` · `Woken by a piece near a scoring tier` · `Woken by a bench name outrunning the book` · `Woken by a move away from the day's average price` · `Woken by a volatility squeeze` · `Woken by a narrow-range day` · `Woken by a news story on a piece`.
- `inTheChat(n)` → `In the chat · {n}` (D-73).
- `scopeChip(sym)` → `{sym} · All` (D-73).
- `sheetExpand` → `Expand the chat` (D-74).
- `chatSendFailed` → `The character couldn't answer just now · nothing was sent` (item 11).

Copy guard green. **One character is a request to the design chat:** `chatSendFailed` uses an ASCII apostrophe, as every other possessive in the module does (`The agent's own words`, `The guardrail's reason`); if the typographic form is wanted it is a one-character change and would be the only curly apostrophe in the file.

---

## 4. CONSTRAINED — for the ledger (Phase A's 1–36 and A2's 37–53 stand; this session adds 54 →)

54. **D-83 is applied at the SHARED seam, so the Desk names the slot too — and both surfaces are dark.** The build first scoped `slotLabel` to `deriveTurnLine` and the four `battleViewCopy` check labels; the review found the turn line's strings ARE the Desk's (`postureLive` / `postureLate` / `postureLastOfSession` / `postureClosed`, shared under a D-62 comment saying the two "cannot disagree"), and that the repo's tests had begun to encode the contradiction. The flooring moved into `deskCopy`'s four composers, which is what "on every surface" asks for. Refuter A then established that nothing is user-visible: `COMMAND_CENTER_SYNC_ENABLED = false` (`featureFlags.js:1887`) and `CommandDashboard.jsx:546` gates `<AgentDesk>` on it, so the Desk does not render at all today. The change lands with that flag, not before it. **No founder ruling is blocked on this; it is recorded so the flip is not a surprise.** The original framing, kept because the record should show what changed:
    > **D-83 is scoped to the flagged surfaces.** `slotLabel` is applied inside `deriveTurnLine` (which only the controller renders) and to the four check labels in `battleViewCopy`. The **Desk** composes `postureLive` / `postureLastOfSession` / `postureClosed` from its own adapter and still names the exact minute. Today the two cannot be seen together and the flag is dark; after the flip they can differ by up to 14 minutes on one check, which D-62 says they must not. The addendum's item 8 lists battle-view surfaces only and does not rule the unflagged Desk, and D-82 records that A2 already ships exactly one unflagged Desk change — so a second one was not taken unasked. **A founder ruling, one line either way.**
55. **The peek line uses the full ET time.** The seed's examples mix `Filed 3:50 PM` with a bare `3:46`; a bare time has no meridiem and would be a second time format this phase would have to invent. Every kind reads `{t} · {what}` with the formatter the rest of the surface uses.
56. **`In the chat · {n}` counts the RECORD, the scoped view also shows what is in flight.** The count is computed on the screen from `chatExchanges` + `tapeEntries`; the chat's own stream additionally carries its optimistic bubbles. For the few hundred ms between a send and the server's write, a just-sent message is in the scoped view and not yet in the count. Counting an unwritten message would be the worse error.
57. **A scoped stream does not fold.** `{n} checks · no change` stands for a contiguous slice of the whole tape; a filtered tape has different adjacency. Scoping shows the individual cards, which is also what makes `n` equal the list's length.
58. **Scoping jumps the stream to its newest entry.** Unruled, and chosen because the surface's premise is newest-at-the-bottom: a carried-over `scrollTop` from a long tape lands the reader in clamped whitespace on a short one. Clearing restores the whole tape's position, which IS ruled.
59. **The desktop's expand opens at HALF, never FULL.** Ruling 7 names the crossing `desktop open → mobile half`; opening at full would land a phone user at full.
60. **The mobile shell keeps peek as its opening detent, the desktop half.** `useChatSheet` now takes an `initialDetent`, read on the first render only, off an `isDesktop` resolved synchronously from `window.innerWidth`. A device that crosses the breakpoint before any interaction therefore carries the detent it started with — which is the ruling ("the detent survives"), but it means a phone that widens to tablet arrives COLLAPSED rather than with the column open.
61. **A record's `Read more` reveals text the SCOPE did not count.** The check card counts by its EXCERPT (the sentence it shows); a piece named only in the ninth sentence is not counted and its card does not appear in the scoped view — even though expanding that card would show the name. This is the ruling's own wording ("check cards — their excerpt names it") and the honest reading: a card that appears to say nothing about your piece should not be offered as one that does.
62. **The detector and `symbolPattern` remain two rules.** A2's review measured them (75 disagreements in 2401 differential inputs, all underscore-adjacent) and refuted the merge. Messages use the detector because it decides what the chat underlines; the decider's prose uses `symbolPattern` because that is what the Why? panel extracts with.
63. **`deriveChatMessages` and `findKnownTickers` are lifts, not rewrites.** Both are shipped, unflagged code paths now importing a new module. Byte-identity is carried by the chat golden and by differential rows; any future change to either module changes a real user's screen.
64. **D-81 makes fewer runs fold.** A run folds only when two adjacent quiet checks would render the same card (review L1-F6), and the trigger line is part of the card. With one ruled string, two quiet checks agreed unless one was a price drop; with nine, they agree only when the gate woke them for the same reason. More individual check cards will show on a quiet day. Correct, but a visible density change.
65. **`TacticalRow.jsx` is not on the theme-guard list.** D-85's price uses that file's own `HOLO_COLORS` identifier idiom; no hex is authored (§10 migrates raw hex, never identifiers). The file is a candidate for the list when the rows PR touches it.
66. **The scope survives a piece leaving the board.** `scopeSymbol` is screen state; if the agent swaps the scoped piece out, the chip stays until the player clears it. The entries it filters to are still that piece's, so the view remains truthful; it is recorded because a reader may expect the chip to clear itself.

---

## 5. Recorded, not fixed — for the founder

The full list, with the reasoning for each, is §5 of the review record — seventeen items. The nine worth a founder's minute, and items 6–9 came from the refuters after the lenses had finished:

1. ~~**The Desk names the slot now, unflagged**~~ — **corrected: it is flagged.** `COMMAND_CENTER_SYNC_ENABLED` is dark and gates the whole Desk, so this is latent until the flip, not live today (§4 item 54).

2. **The mobile peek sheet grew a row and its clearance did not.** `SHEET_PEEK_PX = 172` is a measured sum from the A4 review; peek is `height: auto`, so the sheet really does grow by the new peek line, while the board still reserves `SHEET_PEEK_PX + 32`. jsdom does no layout, so this is unmeasurable in tests. **Worth a look in the smoke: does anything at the bottom of the board sit under the sheet?**

3. **`Read the full check` on mobile at the FULL detent** moves focus to a heading underneath the sheet. Lowering the detent from the door would break the sheet's own focus rules, which ruling 4 says to keep intact. A ruling, not a review call.

4. **The 504 and the other send failures keep their own words.** Item 11 named one string; `Agent took too long. Try again.` is arguably the same class and was left alone rather than widened.

5. **"nothing was sent" is unprovable on the thrown-fetch branch.** A request that reached the server and wrote the exchange before the connection dropped charges the budget while the banner promises it did not. The ruling scopes the string to *a server error*, and the shipped code had one string for both branches, so the build is faithful to the ruling's words.

6. **A failed send destroys the player's draft.** The composer is cleared at the top of `sendMessage` and neither failure branch puts it back, so item 11's new sentence is true — nothing was sent — and the typed words are gone anyway, with retyping the only way to retry. Found while rewriting a guard that could not fail; pinned as shipped behaviour on both paths. Not fixed: the send path is shipped code this phase does not touch, and restoring the draft changes the flag-off path too.

7. **`nothing was sent` can be FALSE, and it needs its own tasking.** `api/agent/chat.js` writes the exchange and increments the budget in ONE `battleRef.update()` INSIDE the `try` whose `catch` returns the 500 (`:687` / `:692`, `catch` at `:749`, the 500 at `:788` — against `origin/main` @ `caa49301`; the numbers moved under this branch, the shape did not) — so a throw after that point charges the player while the banner promises it did not. The file flags the same asymmetry about its League charge and not about this one. Reproduced on the real send path: `1/10` and "nothing was sent" on screen together. `api/` is behind the §1 fence, so this is recorded, not fixed. This supersedes item 5 below, which understated it.

8. **Four of the nine trigger strings read as claims about the tapped piece.** Every conditional trigger is per-symbol but only the TYPE is persisted, so a piece at +0.00 % can render `Woken by a price drop` from another holding's trigger. Two of the nine strings were written with the hazard in mind ("Woken by **a piece** near a scoring tier"); four were not. Not fixed because ruling 2 gave those strings verbatim — rewriting them overrides the ruling. The repair is the wording the two careful ones already use.

9. **Scoping to a piece can make the tape SEVEN TIMES LONGER.** The count is over the unfolded stream and the scoped view deliberately does not fold, while the unscoped view does. On an ordinary quiet day the door reads `In the chat · 28`, the unscoped stream is four lines and the scoped stream is 28 near-identical records. Each of D-73, D-77 and D-84 is right; their product is not. Every repair is a ruling — fold the scoped stream too, count only messages, or say something other than `In the chat · n`. **The sharpest single item in the record.**

---

## 6. Bugs outside this task — carried forward, not fixed (BUILD_RULES §3)

The four in the A2 handover §6 are unchanged: the guardrail-forced swap's feed attribution, the pre-execution announcement, the shipped chat's trade filter, the stale cap comment.

**TWO NEW.** The first, found by refuter B, is §5 item 7: `api/agent/chat.js` appends the exchange and increments the chat budget in one `battleRef.update()` INSIDE the `try` whose `catch` returns the 500 (verified still true against `origin/main` @ `caa49301`, after `main` moved that file under this branch), so the client's `nothing was sent` can be false — a message spent, believed free, re-sent, charged twice out of ten. `api/` is behind the §1 fence; this wants its own tasking, and the fix is on the server (move the write past the last throw, or narrow the client's sentence to the thrown-fetch branch). The second was found by the review's copy lens: `src/components/GameTape/GameTapeView.jsx` renders `citedForgeRules || citedRules` — raw `_`-joined machinery identifiers (`swap_window_cap`, `vwap_cascade_guard`, `risk_*`) — and renders `entry.action` as an eyebrow, which produces `GUARDRAIL_FORCED_SWAP`. It is the same class D-80 just closed on the tape, on a shipped surface that is **one header tap away** under the controller flag. Not fixed here (BUILD_RULES §3); it is a copy question first, and the D-80 pattern (`renderMotive` + `guardrailTypeWords`) plus `leagueSwapLedger.js`'s `DETERMINISTIC_LABELS` are the precedents a ruling would build on.

---

## 7. Files — 40 changed this session (3258 +, 250 −)

**New, source (7):**
`src/utils/findKnownTickers.js` (the detector, lifted) · `src/components/Agent/deriveChatMessages.js` (the message derivation, lifted) · `src/screens/battleView/selectSymbolRoster.js` · `.../scopeTape.js` · `.../derivePeekLine.js` · `.../PeekStrip.jsx`

**New, tests (7):**
`src/utils/findKnownTickers.test.js` · `src/screens/battleView/{selectSymbolRoster,scopeTape,derivePeekLine}.test.js` · `src/components/Agent/{AgentChat.tapeKinds.render,AgentChat.sendFailed,AgentChat.scope.jsdom}.test.jsx` · `src/components/BaggerBomb/TacticalRow.currentPrice.render.test.jsx`

**Changed, source (9):**
`src/screens/AgentBattleScreen.jsx` · `src/components/Agent/AgentChat.jsx` · `src/components/BaggerBomb/TacticalRow.jsx` · `src/utils/renderMessageWithEntities.jsx` · `src/screens/battleView/{battleViewCopy.js,selectWhyState.js,deriveTurnLine.js,buildTape.js,TapeCards.jsx,WhyPanel.jsx,ChatSheet.jsx,useChatSheet.js}`

**Changed, guards and baselines (4):** `src/theme/{tokens.guard.test.js,motion.guard.test.js,tokenGuardBaseline.json,motionGuardBaseline.json}` — four new battleView files on both lists with their baseline entries, added by hand so the regeneration's reordering does not ride along.

**Changed, docs (1):** the design framework's ledger (D-80 → D-85; D-73 / D-74 marked built).

**Nothing under `api/`.** No fenced file edited; `agent-evaluate.js`, `agentGuardrails.js`, `agentBattleService.js`, `agentTriggerGate.js` and `tournamentAgentLedger.js` are READ by source tripwires only. No model call, no write, no new Firestore read beyond the subscribed doc.

---

## 8. Verification

- **Full suite:** 584 files, **10,026 passed**, 63 skipped, 0 failed (9,819 at the branch's previous handoff).
- **`vite build`:** green — the pre-existing chunk-size warning only.
- **Flag-off goldens:** `agentBattleScreen.tabbed.html` and `agentChat.tabbed.html` unchanged and passing. The review found they cannot see three of this session's flag gates; those now have rows in the composition test instead (§9). Refuter A confirmed the void-golden finding by `grep -c`: zero `Open research for` spans in either file.
- **Theme and motion guards:** green, with the four new battleView files on both lists and their baseline entries in the same commits. The directory-completeness row caught one omission before the suite did.
- **Copy guard:** green.
- **Adversarial review:** `docs/audits/20260903_BATTLE_VIEW_CONTROLLER_PHASE_A2_3_A2_4_BUILD_REVIEW.md` — five lenses on five trees, two refuters on two more, **~200 executed mutations** (63 by refuter A alone, every one re-run from a verified-clean baseline).
- **Commits:** ruling 1 first, as ruled; then items 8–11 each its own; then D-81; then A2.3 in two; then A2.4; then the ledger; then the lenses' fixes; then refuter B's; then refuter A's.
- **STOP.** The branch is pushed and stops here for the founder's smoke. No PR — the founder opens it.

---

## 9. Review — what it changed

Five isolated lenses, each on its own tree, each handed all three rulings documents — the addendum's §2 process rule, in force for the first time and closing both process defects the A2 review disclosed. Then two refuters on fresh trees at the fixed head. **60 findings, 43 confirmed and fixed.** What the founder should know:

1. **A ruling had been built at half its stated scope, and the repo's own tests had started to disagree with each other about it.** D-83 says a check is named by its slot *on every surface*; the build applied it inside the battle view only. But the turn line renders the DESK's strings, shared deliberately so the two cannot disagree — so one instant had begun to read `12:47 PM` in the Desk's test and `12:45 PM` in the turn line's. Two lenses found it independently. The fix moves the flooring to the shared seam, which is why the Desk changes.
2. **Two flag gates on shipped surfaces could be deleted with the whole suite green** — the chat's ticker roster, and the receipts memo — and the artefact ruling 8 names as the proof of the detector extraction contains no entity spans at all. The dark-merge held in the code and not in the suite. Three new composition rows and two new test files close it.
3. **The desktop collapse was destroying the player's typed draft.** `{chat}` was rendered in two tree positions, so React remounted it on every collapse. A4 paid for the draft-survival rule explicitly; the column is now the chat's one home and the collapse is a CSS reflow.
4. **`In the chat · 0` did the opposite of what it was ruled to do** — three lenses found it — and two of the build's own comments described the ruled behaviour while the code did the reverse.
5. **Eight assertions could not fail under the defects they named**, including one written in this session's own fix pass. All rewritten. This is the rule that keeps a green suite meaningful, and it is the easiest one to fail quietly.
6. **Three comments over-claimed and were corrected rather than left standing** — two "the golden proves it" claims that it did not, and one "these cannot disagree" that omitted the one input where they do.

**Then the refuters, and they were worth their trees.** Refuter B found four things the lenses had all walked past, three of them on the screen a player actually reads: `Guardrail override` printed **twice** on every guardrail-forced exit (the cron composes a prefix onto a sentence that already has one, and ruling 1's worked example elided exactly that spot with a `…`); a model swap printing the agent's sentence **twice, back to back**, because the trade card and the check card are built from the same string and item 9 had just made them the same visual kind; a check card that visibly says GILD dropped from GILD's own scope, because the filter read the excerpt and the pair is in the heading; and the scoped stream showing a `GILD → MOS` grading card one line under a filter that had just dropped GILD.

Refuter A attacked the fixes with 63 mutations and found that **five of them were unguarded** — the scope door's chat-opening clause, the sheet's adopt effect, the scope auto-clear, one of the four D-83 check labels, the Invalid-Date guard — every one deletable with a green suite. It also found that **the D-83 fix over-reached**: flooring the `next ~` argument made the turn line name a time already in the past for as long as the last check was late, against `deskCopy`'s own "never a fabricated time" rule. And it found the twin of a fix the lenses had made: the *other* Why? door still asked the breakpoint instead of the detent, dropping a player on a collapsed desktop into a prefilled composer with the conversation folded shut. All fixed.

**Both refuters corrected the review record itself**, which is the part worth taking seriously: A established that the Desk change this record twice called "unflagged" is behind a dark flag and was never user-visible, and that the review had named the wrong half of one fix as the load-bearing one. A review that cannot be corrected is not a review.
