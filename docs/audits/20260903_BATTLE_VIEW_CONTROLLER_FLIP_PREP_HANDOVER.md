# Battle View controller — flip-prep (PR 1) handover

**Date:** September 3–4, 2026
**Branch:** `fix/battle-view-flip-prep`, from `origin/main` @ `09b6aba8` (A2 merged at `1786bd46`).
**Commits:** fourteen — five build commits, one per seed item in the seed's order, then nine carrying the §2 review's fixes and its record.
**Status:** pushed. **STOP** — the founder opens PR 1. PR 2 (the flip) is a separate branch after PR 1 merges.

---

## 1. What shipped

| # | Item | Commit |
|---|---|---|
| 1 | **D-89** — the book panel opens collapsed, expands into a bounded region, gains a close that returns focus; `Read the full check` retargets from the panel to the check's own card | `c32803a1` |
| 2 | Kind eyebrows on every tape entry, from the persisted `messageType` | `cf361220` |
| 3 | The model's own `**…**` renders as emphasis; strays stripped | `f2f59271` |
| 4 | The unread mark counts what the tape renders, not raw `statusFeed` | `be199ec4` |
| 5 | The send-failure line drops the clause it cannot prove | `f4c2be08` |

Then the review's own commits: `563f5e78` and `60efb5e1` (the coordinator's two findings), `2264e4a2`, `3a86f6fd`, `f7f037f9` and `d3502425` (the lenses' nineteen), and `1a072b43`, `89ac5104`, `9204377b` (the ledger rows and this record's companion). **The five items are the PR; the nine after them are what the review changed about them** — §7 says what and why.

All five behind `BATTLE_VIEW_CONTROLLER_ENABLED` (dark). No new files — so both theme/motion guard lists (directive 9) were already complete and needed no additions.

---

## 2. Founder smoke — what to look at

With the controller flag on (`?battleViewController=1` until PR 2 removes it):

1. **Tap the score header.** The book panel opens COLLAPSED: `At the {t} check`, the state, `Woken by …`, ONE sentence, `Read more`. It must not push the board off the screen. Tap `Read more` — the rest arrives inside a region that scrolls itself, **the deploy brief included** (the review found it rendering outside the bound, which is exactly the defect D-89 exists to close). Tap the `×` — a 44×44 target now, not the 8×14 glyph the first build shipped — and the panel closes with the keyboard focus ring back on the score header. Close and immediately re-open: it must come back **collapsed**.
2. **`Read the full check` on a LOW row.** It should no longer jump you to the top of the board. The conversation opens (desktop: the column; phone: the sheet to full) at that check's own card, already expanded, focused. **This is the biggest behaviour change in the PR.**
3. **`Read the full check` on a check that SWAPPED a piece.** It lands on the **trade card**, expanded — not the check card, which deliberately withholds the same paragraph. This is the review's sharpest fix and the one ruling in §4 that is yours to overturn.
4. **`Read the full check` while the tape is SCOPED to a piece.** Tap a symbol to scope, then use the door on a check the scope filters out. Before the review this was a silent no-op — sheet up, nothing to see. It now clears the scope and lands.
5. **Scroll the conversation.** Every entry says what it is: `Status check · 12:45 PM · Held`, `Bench note`, `Trade note`, `Opener`, `Reply`, `Directive`. Anything the server has not given a type gets no eyebrow at all — **and that now includes a `potential_exit` anticipation**, on purpose (§4 item 1). If you see a label you do not recognise, that is a defect.
6. **A check whose words contain `**`.** The asterisks must not be on screen; the emphasised clause should read bold. Look for a sentence that got cut in a strange place — the sentence splitter had to learn to see through the markers.
7. **The unread dot.** Arrive at a battle with a conversation you have not read: the dot is on (a fresh arrival treats everything as unseen). Open the chat — it clears. A new check lands while you are collapsed — it returns. A feed-only event (a watchlist refresh, a blocked guardrail) must NOT light it any more, because the tape shows nothing for those.
8. **A failed send** (offline, or a 500): `The character couldn't answer just now` — and nothing about whether it was sent, because the client cannot know.

---

## 3. Strings added or changed this session

All in `src/screens/battleView/battleViewCopy.js` (the guarded copy module — the components type no prose):

- `tapeKindEyebrow(messageType, hasUserHalf, anticipationDirection)` → `Opener` · `Bench note` · `Trade note` · `Reply` · `null`. The third argument arrived in review: `Bench note` goes only to a `potential_entry` anticipation, and a `potential_exit` one gets `null` rather than a word that is false for it (§4 item 6).
- `closeWhyBookName` → `Close the check`
- `checkCardLabel(iso, label)` → **changed**: `Status check · {t} · {state}`; the two absence labels keep `{t} · {label}`
- `chatSendFailed` → **changed**: `The character couldn't answer just now` (the `· nothing was sent` clause removed)

---

## 4. CONSTRAINED — for the founder

Nine items. The first two came out of the review and are the ones that want a line from you; the rest are the build's own constraints.

1. **`potential_exit` anticipations arrive with NO eyebrow (review L1-F1).** `anticipationCandidates[].direction` is a required enum on the eval schema, and it splits the kind in two: `potential_entry` is a bench candidate worth bringing in — a bench note, exactly as ruled — while `potential_exit` is an **active holding** whose signal profile degraded enough that leaving is plausible. Both persist as `messageType: 'anticipation'`, so a map keyed on the type alone called a note about a piece in the player's own book a *bench* note. Only the ruled case now gets the ruled word; the other gets nothing, by the same rule an unknown type does. **This is the only place in this PR where a ruled string turned out not to cover the case it was ruled for.** Two options, both one line: a direction-aware pair, or one direction-neutral word for both.
2. **The swap-tick landing was resolved in code, and the resolution is yours to keep or overturn.** `Read the full check` used to land on a card with no words on every model-swap tick, because RB-F1 makes the check card withhold prose the trade card is already carrying. Two readings were available: the door targets **the card that holds the check's words**, or the check card **renders its words when it is the pinned one** and RB-F1 gets a documented exception. The first was taken — the builder stamps `wordsOn` and the door follows it, so a swap tick lands on the trade card, expanded, with the paragraph plus the pair, the tier, the banked points and the attribution. If you prefer the second reading it is a change of target in one place. §7 says why this was fixed rather than recorded.
3. **The two absence labels keep the old shape.** `No decision recorded at this check` and its two outage variants (D-65, D-69) already end in "at this check", so prefixing them with `Status check ·` says "check" twice. Those cards render `{t} · {label}` instead — which means **the one class of check card that does not say what kind of thing it is, is the one that failed**, and it is the class a player is most likely to misread. Rewording the ruled strings to fit the eyebrow would be a ruling, not a composition; sustaining the stutter argument is equally a decision. **A founder line either way.**
4. **The unread dot now lights on arrival.** The seed's rule — "a fresh mount treats everything as unseen" — means opening a battle with an unread conversation shows the dot immediately. That is a visible change from A4, where an empty `statusFeed` fixture meant a quiet first paint. Two committed rows flipped to say so.
5. **`nothing was sent` is gone from the sentence, but the screen still enacts it in pixels (review L1-F6).** Item 5 removed the clause. The optimistic user bubble is *still* deleted on `!res.ok`, and the row pinning that behaviour justified it with "nothing was sent is then true" — the claim this same PR establishes is sometimes false. **A message that vanishes from the conversation is a stronger instruction to re-send than any sentence.** The rollback is shipped behaviour this PR did not touch and changing it would change the flag-off path too, so the stale justification is corrected and the behaviour is recorded. The server defect underneath (`api/agent/chat.js` charges the budget inside the `try` whose `catch` returns the 500) still needs its own tasking. **A player who fails a send is now told less than before, on purpose** — the alternative was telling them something false.
6. **`splitSentences` changed for every caller, and D-89 added a new consumer of "the first sentence".** Making it see through `**` markers was necessary for item 3 (a marker after a full stop hid the boundary entirely), but it is a shared rule: the Why? row extracts and the tape's first sentences both run through it. Behaviour on text with no markers is unchanged and pinned by a row. Separately: a rationale that opens with an abbreviation can make the collapsed book panel's first sentence the fragment `The U.S.` — pre-existing in the splitter and unchanged here, but newly *visible*, because the collapsed panel is a new consumer.
7. **A docstring correction of record.** `splitSentences`'s comment claimed the whitespace lookahead kept `U.S.` intact. It never did — the final stop IS followed by a space, so it splits, and always did. The comment is corrected and the real behaviour asserted rather than the claim left standing.
8. **Two `tapeEntries` gates, one of them load-bearing (review L3-F3).** Deleting the `controllerOn` conjunct on the `buildTape` memo leaves the suite green; the gate that actually matters is the call site, which is guarded. The consequence today is wasted work with the flag off — but item 2's eyebrow gate now hangs off the same prop, so the pair carries more than it did.
9. **One golden row checks the photograph, not the tree (review L3-F2).** The "no controller markup" row reads the committed `.html` file, so no change to the source can fail it. It is subsumed by the byte-equality row beside it, so it is not a hole — but it is the row a reader would cite for that claim, and it carries no evidence for it.

---

## 5. Verification

Run at `9204377b` — the last commit that touches code. The two commits after it are these documents.

- **Full suite:** 591 files (589 passed, 2 skipped), **10,191 passed**, 63 skipped, **0 failed**. A2's handoff was 10,026; the A4-era 10,177 figure in the skeleton was from before the review's guards landed.
- **`vite build`:** green in 19.4s — the pre-existing chunk-size warning only, no new one.
- **Flag-off goldens:** `agentBattleScreen.tabbed.html` and `agentChat.tabbed.html` are **byte-unchanged on disk** (`git status` clean under `src/screens/__golden__/`, last touched at `23717042`, before this branch), and both flag-off suites pass. The capture suite stays skipped, as designed — a golden is re-captured only from a commit whose flag-off output legitimately changed, never from the tree under test.
- **Theme and motion guards:** `tokens.guard.test.js`, `motion.guard.test.js` and `flagPinGuard.test.js` — 114 rows, green. `battleViewCopy.js` is enumerated in both guard lists. No new files this PR, so no guard-list additions were due.
- **Mutations:** ~140 executed across the build and the review, 94 by the review's test-integrity lens alone. Every new guard was checked against the deletion it names before its commit. **Ten real gaps were found and closed; seventeen surviving mutants are provably equivalent, with the argument written down for each.** Three fixtures changed during the build for the same reason — a one-evaluation fixture could not fail "the pinned card is not folded", a one-sentence rationale could not fail "the card starts expanded", and a `font-weight:700` assertion could not tell the model's emphasis from the symbol's.

---

## 6. The review

The cumulative branch diff is **26 files / 2,232 lines** (21 files and 1,992 lines under `src/`), which crosses BUILD_RULES §2's `≥10 files OR ≥1500 lines` threshold on both counts. The seed anticipated this — *"if PR 1 crosses it, the §2 review applies"* — so the mandatory multi-lens adversarial pass was run rather than a single-pass `/code-review`.

Five lenses, each on its own `git worktree --detach` tree at the review head `f4c2be08`, all five seed items handed to every lens: **L1** ruling fidelity and copy, **L2** wiring, lifecycle and focus, **L3** the flag-off guarantee, **L4** test integrity by mutation, **L5** cross-phase consistency and the hazard list. Then a refuter on a fresh tree, pointed at the fixes.

**~140 executed mutations, 94 of them L4's alone.** The full record is `docs/audits/20260903_BATTLE_VIEW_CONTROLLER_FLIP_PREP_BUILD_REVIEW.md`; §7 below is its summary, and the disclosures at the end of it are the part worth reading in full.

**The flag-off question, answered by measurement rather than assertion.** L3 mounted the real shipped screen with the flag off, let effects run, walked all three tabs plus the closed-trades expansion, and dumped `container.innerHTML` at `09b6aba8` and at the review head: **byte-identical, 113,778 bytes each**. Corroborated by arming `throw` at the top of every function this PR added — the three flag-off suites still pass, so none of it executes. A flag-off user sees nothing from this PR, which is the claim PR 2 rests on.

---

## 7. Review findings and dispositions

**Nineteen confirmed defects, all fixed. Three refuted. Seven recorded for a founder line.** The three findings that matter most are the three that more than one lens found independently — that is the signal the multi-lens shape exists to produce.

### The three found more than once

1. **The door landed on a wordless card on every model-swap tick** (three lenses). RB-F1 makes the check card withhold its prose when the same tick produced a trade card, because the two carry the identical string; D-89 then pointed `Read the full check` at that card. Each rule is right alone and they are wrong together — the door's *enablement* reads the evaluation's rationale (non-null on a swap) while its *destination's content* reads the builder's suppression (null on a swap), the two-source pattern directive 9 forbids. **Fixed:** the builder stamps each check entry with `wordsOn`, the id of the card that actually holds its words, and the door follows it. On a swap tick the reader lands on the trade card, expanded. This was first written down as a founder ruling and then re-classified — see §7 of the review record.
2. **`startExpanded` was a no-op wherever the card was already mounted** — the ordinary case on both shells (two lenses). It was read once as a `useState` seed, so the flip did nothing unless the card mounted on that same commit. The door said `Read the full check` and delivered one sentence with a `Read more` under it. **All three committed rows asserting the expansion used one-sentence rationales**, so the assertion was true either way — three tautologies. **Fixed:** it is a prop now, OR'd with local state so a card the player opened by hand stays open when the pin moves on.
3. **The door was a silent no-op while the tape was scoped** (two lenses). `scopeTape` judges a check by whether its first sentence names the piece; the door's gate asks only whether the check has words — two different questions, so a scoped stream routinely did not contain the check the door pointed at. **Fixed:** the door clears the scope.

### The rest of the confirmed set, in one line each

- **`checkEntryId`'s whole contract was unguarded** — five mutations walked the suite, because every mounted assertion computed its expected selector by calling the function under test. The shape is a literal now, for both ids.
- **The expansion bound covered half of what expanding reveals** — the deploy brief rendered as the bounded region's sibling and is never truncated, so one tap added an unbounded block above the board. That is the exact defect D-89 exists to close. The brief is inside the region.
- **The ruled "visible close control" was a bare 14px glyph with no padding** — roughly 8×14 CSS px. Now a 44×44 hit area with negative margins, so the glyph stays optically where it was.
- **The peek strip and the stream folded differently once a check was pinned**, against `derivePeekLine`'s own stated directive-9 promise. It takes the same pin now.
- **The panel's collapsed state survived a close/re-open inside the exit animation**, so a double-tap re-opened it expanded. The panel's key changes per open, so "starts collapsed" is true by construction.
- **Item 4's flag-off guarantee was held by the code, not the suite** — the only guard was a source row, so moving the flag-off write to after the controller's read would have left everything green with the shipped Command Center dot never clearing again. A behavioural row mounts flag-off, asserts the dot, clicks the tab, asserts it is gone.
- **`splitSentences`'s central promise was tested only where it cannot fail** — the fixture put the emphasis on the first sentence, where `rawStart` is 0 and an off-by-one on the end index cannot show. Re-guarded on a later sentence.
- **A directive-9 row whose two sides were one code path** — `stripEmphasisMarkers` compared against the function's own body retyped. Rewritten against the independent definition.
- **Nine LOW items:** an unguarded book brief; two gaps in the flag-off seam list; three conjuncts that cannot fail, removed per §2's own rule; an unasserted scroll behaviour; a dead helper; a restored NaN guard; two unreachable branches removed; `''` missing from a "never invents one" list; and five comments or documents that over-claimed — all corrected, with supersession notes on the two standing A2 handovers naming exactly what is no longer true.

### The coordinator's own two, before any lens reported

- **The pinned card was folded away at two of its three positions.** Excluding the pinned check from the run-join was not enough — the branch below started a *new* run with it, so the next quiet check swallowed it again. It rendered correctly only when the pinned check was last in the document, **which is the shape the committed fixture had**, so the mounted row passed with two of three positions broken. Fixed with a unit row asserting all three positions by exact structural equality.
- **A comment claiming a distinction the code does not make.** The D-89 justification said the book panel might show a different check than the row's extract; both read `latestDecision`, so it is always the same tick. Corrected in code and in the ledger. This is the class the A2 review found three times, and I wrote a fresh one.

### What did not stand

Three findings were refuted. Two lenses reported ledger rows D-86 → D-90 missing; they were committed *after* the lens trees were cut — refuted by timeline, not on the merits, and recorded as this run's own process defect. Seventeen of the twenty-seven surviving mutants are provably equivalent, with the argument given for each. And L1's "one exchange, two kind eyebrows" is the reply plus the nested `ExecutionCard`, which is D-84's fourth visual kind stacked below — what the reader sees is what was ruled.

### The disclosure worth carrying forward

**L4's mutation harness lied to it once, in the dangerous direction.** Its first batch reported 15 of 15 KILLED. `--reporter=basic` is not a valid flag in this vitest, so the process exited non-zero on every run and every mutation read as caught. It was noticed only because two mutations L4 had proved equivalent by hand came back "killed". A broken mutation harness produces false **confidence**, not false alarm — prove the harness can report a survivor before trusting a run of kills.

Two smaller ones: one guard was written and deleted twice before landing as a source tripwire, because framer's `AnimatePresence` unmounts synchronously under this repo's jsdom harness (measured at 0/10/30/100 ms with reduced motion forced off), so the defect it names cannot be reproduced in a mounted test and both jsdom rows passed with the fix removed. And the trees were cut before the ledger commit landed, which is the process defect above.

---

## 8. What this branch does NOT do

- **It does not flip the flag.** `BATTLE_VIEW_CONTROLLER_ENABLED` is still `false`; every one of the five items is dark. The flip is PR 2 on `flip/battle-view-controller`, after this one merges, and it is four files and one commit.
- **It does not touch `COMMAND_CENTER_SYNC_ENABLED`.** The Desk stays dark.
- **It does not open a pull request, watch CI, or merge.** The branch is pushed and stops. **The founder opens PR 1.**

---

*Prepared September 3–4, 2026. Verified at `9204377b`, the last code commit: full suite green, `vite build` green, both flag-off goldens byte-unchanged. The companion record is `docs/audits/20260903_BATTLE_VIEW_CONTROLLER_FLIP_PREP_BUILD_REVIEW.md` — §6 there is the founder's list in full, and §7 the disclosures.*
