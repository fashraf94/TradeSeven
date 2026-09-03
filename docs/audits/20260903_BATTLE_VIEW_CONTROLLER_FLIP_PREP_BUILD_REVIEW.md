# Battle View controller — flip-prep (PR 1) adversarial build review

**Date:** September 3, 2026
**Branch:** `fix/battle-view-flip-prep`, from `origin/main` @ `09b6aba8`.
**Build reviewed at:** `f4c2be08` (the five seed items). Two further commits landed during the review and are noted where they bear on a finding.
**Threshold:** BUILD_RULES §2 — the cumulative branch diff is **18 files / 1,278 lines**, past `≥10 files OR ≥1500 lines`, so the multi-lens adversarial review is mandatory. The seed anticipated this: *"both are under the ten-file review threshold — if PR 1 crosses it, the §2 review applies."* It crossed.
**Process:** one tree per reviewer (`git worktree --detach` at the review HEAD, `node_modules` symlinked, read-only on the shared repo), the seed's five items handed to every lens.

---

## 1. Why this review matters more than the last one

This is the last review before `BATTLE_VIEW_CONTROLLER_ENABLED` is flipped on for real users. Everything in the A2 arc was dark; a defect that survived a review could be fixed in the next phase before anyone saw it. From PR 2 onward that stops being true.

So the lens that matters most here is L3 (the flag-off guarantee) inverted: not "can a flag-off user see this?" but **"is what a flag-ON user is about to see actually right?"** Every lens was briefed accordingly.

---

## 2. Method

Five lenses, each on its own worktree at `f4c2be08`:

| | Dimension |
|---|---|
| **L1** | ruling fidelity and copy |
| **L2** | wiring, lifecycle and focus |
| **L3** | the dark-merge / flag-off guarantee |
| **L4** | test integrity, by mutation |
| **L5** | cross-phase consistency, the hazard list, §9 |

Then a refuter on a fresh tree at the fixed head, pointed at the fixes.

---

## 3. The coordinator's own pass, before the lenses reported

Two findings, both in this session's own work, both fixed before any lens landed. They are recorded first because they are the same defect class the A2 review kept finding, and finding them in my own build is the point of writing them down.

**C-F1 | HIGH | `src/screens/battleView/buildTape.js` — the pinned card was folded away at two of its three positions.** D-89's `Read the full check` opens a named check's card, and a HOLD with words is `quiet` by D-77's conjuncts, so the ordinary target of that door is the ordinary member of a run. Excluding the pinned check from `joins` was not enough: the `else` branch below puts a quiet check into a NEW run rather than letting it stand alone, so the pinned card was swallowed again by the very next member. Pinning the FIRST of three left all three folded into one line with no card to scroll to; pinning the MIDDLE left it inside the run that started after it. It rendered correctly only when the pinned check happened to be the LAST in the document — which is the shape the committed fixture had, so the mounted row passed with two of the three positions broken. **Fixed at `563f5e78`**, with a unit row asserting all three positions plus the two no-op cases by exact structural equality.

**C-F2 | LOW (a claim, not a behaviour) | `src/screens/AgentBattleScreen.jsx`, and the D-89 ledger row.** The retarget's own justification said the book panel "is the LATEST check for the whole book, which is not necessarily the check the row's extract came from". It always is: both surfaces read `latestDecision`, so they describe the same tick and only the extract differs. The real justification — the panel opens above the board, so a reader on a low row is thrown to the top of the page with no way back — stands on its own. **Corrected at `60efb5e1`** in the code and the ledger. A comment claiming a distinction the code does not make is precisely the class the A2 review found three times; I wrote a fresh one.

*(A 4,000-input fuzz of `splitSentences` ∘ `parseEmphasis` found no counter-example to item 3's byte-equality property, and no degenerate input throws.)*

---

## 4. CONFIRMED findings and their dispositions

**Nineteen confirmed across four lenses, all fixed.** Three defects were found
independently by more than one lens; those are the ones that mattered.

### 4.1 HIGH

| # | Finding | Disposition |
|---|---|---|
| **L2-F2 / L5-F2** | **`startExpanded` was a no-op wherever the card was already mounted — the ordinary case on BOTH shells.** It was read once as a `useState` seed, so the prop flip did nothing unless the card mounted on the pinning commit, which only happens for a quiet check that was inside a fold. On a desktop the column opens at HALF so every card is mounted; on a phone the peek list is only `display: none`, so they are mounted behind it. The door said `Read the full check` and delivered the first sentence with a `Read more` under it. **All three committed rows asserting the expansion used ONE-sentence rationales**, so `not.toContain('Read more')` was true either way — three tautologies, and only the folded-run row ever exercised the path. | **FIXED.** It is a prop now, OR'd with the local state so a card the player opened by hand stays open when the pin moves on. The new row uses a downgraded HOLD — never `quiet`, so never folded, on screen from the first paint — with two sentences, so the claim fails when the code stops making it true. |
| **L1-F1** | **`Bench note` was false for half the notes it labels.** `anticipationCandidates[].direction` is a REQUIRED enum on the eval schema (`agentEvalToolSchema.js:163-170`): `potential_entry` is a bench candidate worth bringing in; `potential_exit` is an ACTIVE HOLDING whose signal profile degraded enough that leaving is plausible. Both persist as `messageType: 'anticipation'` with the direction on `anticipationContext`, so a map keyed on the type alone called a note about a piece in the player's OWN BOOK a bench note. This is the reading-past-the-record error item 2 exists to prevent, one level down: the record disambiguates and the label ignored it. | **FIXED.** `deriveChatMessages` carries the persisted direction; only the ruled case gets the ruled word. The other gets NOTHING, by the same rule an unknown type does — a word for `potential_exit` has to be ruled before it reaches the screen, and inventing one here would be the guess. **Recorded for the founder (§6 item 1).** |
| **C-F1** *(coordinator)* | **The pinned card was folded away at two of its three positions.** See §3. | **FIXED at `563f5e78`.** |

### 4.2 MED

| # | Finding | Disposition |
|---|---|---|
| **L1-F3** | **The expansion bound covered half of what expanding reveals.** The deploy brief rendered as the bounded region's SIBLING, and `strategyBrief` is never truncated — so one tap added 40vh of bounded rationale PLUS an unbounded brief above the board. That is the exact defect D-89 exists to close, on a phone. | **FIXED.** "The rest" is everything the tap reveals; the brief is inside the region. |
| **L2-F3 / L5-F3** | **The door was a silent no-op while the tape was scoped.** `scopeTape` runs before the pin and judges a check by whether its FIRST sentence names the piece, while the door's own gate asks whether the check has words at all — two different questions, so a scoped stream routinely did not contain the check the door pointed at. No card, no scroll, no focus; and on the phone the sheet still swallowed the screen to show a filtered tape with no target in it. Both doors sit in the same panel, one under the other, so it is two taps apart. | **FIXED.** The door clears the scope: the player has asked for one specific check, and a filter hiding it is in the way of the thing they asked for. |
| **L5-F4 / L1-F10** | **The peek strip and the stream folded differently once a check was pinned**, against `derivePeekLine`'s own stated §9 promise. The pinned check is by construction the newest, so this was the ordinary case for any quiet tick; `openCheck` is never cleared, so it lasted the mount. | **FIXED.** `derivePeekLine` takes the same pin. |
| **L1-F5** | **The ruled "visible close control" was a bare 14px glyph with `padding: 0`** — roughly 8×14 CSS px, under the 24×24 minimum and nowhere near a 44px touch target. On a phone the only way out of the panel was near-untappable, defeating the half of D-89 that says a reader must be able to leave. | **FIXED.** 44×44 hit area, negative margins so the glyph stays optically where it was. |
| **L2-F5** | **The book panel's collapsed state survived a close/re-open inside the exit animation**, so a double-tap on the score header re-opened it fully expanded — the "a glance is also a decision to speak" state the ruling exists to prevent. | **FIXED** — the panel's key changes per open, so "starts collapsed" is true by construction rather than by timing. **The guard is a source tripwire, and §7 discloses why.** |
| **L3-F1** | **Item 4's flag-off guarantee was held by the CODE, not the SUITE.** The rework moved the controller's read 720 lines from the flag-off write that feeds it, and the only guard was a source row asserting that write's bytes — so moving the write to AFTER the read left everything green while the shipped Command Center dot never cleared again. | **FIXED (guard added).** A behavioural row mounts flag-off, asserts the dot, clicks the tab, asserts it is gone. It dies under exactly L3's mutation. |

### 4.3 LOW

- **L1-F9** — D-76's book brief was unguarded: deleting the whole block left the entire suite green, because the row that named it had a fixture with no `strategyBrief`. **Guard added.**
- **L3-F4** — the flag-off seam test listed the tape's copy but not item 2's eyebrow words, and `[data-tape-kind]` does not match `data-tape-kind-eyebrow`. It caught the leak only because the CARDS leaked at the same time. **Both added.**
- **L4 ac-02/03/04** — three conjuncts in one expression that cannot fail (`!label` on a type the map already returns null for; a role check after an early return for that role; `=== true` on a boolean). **Removed**, per §2's own rule.
- **L4 ac-05** — the landing scroll's `behavior` was unasserted. **Guarded**, and the reason it is instant rather than reduced-motion-conditional is now written down.
- **L5-F8** — `feedStampOf` left dead by item 4. **Removed.**
- **L5-F9** — the item-4 comment attributed `guardrail_forced_swap` to ruling 9; it is hazard 25's. The true claim is also *larger* than the one written: `api/` writes ~30 action values and `buildTape` produces an entry from none of them. **Corrected.**
- **L1-F7, L1-F11, L1-F12, L5-F7, L5-F6** — comments and documents that over-claimed or described removed behaviour. **All corrected**; the two standing handovers now carry supersession notes naming exactly what is no longer true.

---

## 4.4 The flag-off question, answered

L3's instrument is stronger than either golden and deserves to be the record: it mounted the **real shipped screen** flag-off, let effects run, walked **all three tabs** plus the closed-trades expansion, and dumped `container.innerHTML` at `09b6aba8` and at the review HEAD. **Byte-identical — 113,778 bytes each.** Corroborated by arming `throw` at the top of every new function (`splitSentences`, `parseEmphasis`, `checkEntryId`, `tapeKindEyebrow`, `checkCardLabel`, `RecordProse`, `CheckCard`, the `WhyPanel` body): the three flag-off files pass, so none of it executes.

**A flag-off user sees nothing from this PR.** That is the claim the flip depends on, and it is now measured rather than asserted.

---

## 5. REFUTED

*(Appended.)*

---

## 6. Recorded, not fixed — for the founder

1. **`potential_exit` anticipations have no word (L1-F1's other half).** `Bench note` is the bench's word and now goes only to `potential_entry`. A `potential_exit` note — *"SLB has lost its relative strength; if it loses the 20-day I'd rotate it out"* — is about a piece in the player's own book and arrives with **no eyebrow at all**, which is the honest state until a word is ruled. Two options, both one line: a direction-aware pair (`Bench note` / something for the exit case), or one direction-neutral word for both. **This is the only item in this PR where a ruled string turned out not to cover the case it was ruled for.**
2. **`Read the full check` lands on a card with NO WORDS on every model-swap tick (L1-F2 / L5-F1 / L2-F4 — three lenses, independently).** RB-F1 made the check card withhold its prose when the same tick produced a trade card, because the two carried the identical string. D-89 then pointed this door at that card. Each rule is right alone and they are wrong together: the door's *enablement* reads the evaluation's rationale (non-null on a swap) while its *destination's content* reads the builder's suppression (null on a swap), which is the two-source pattern §9 forbids. Reproduced: the card renders `Status check · 1:30 PM · Swapped · GILD → MOS` and nothing else, focused, while the words sit on the trade card immediately above it — themselves behind an unclicked `Read more`. **Not fixed because the resolution is a ruling, not a repair:** either the door targets the trade card when the check's prose was withheld (and "the check's card" means "the card with the check's words"), or the check card renders its words when it is the pinned one (and RB-F1's no-duplicate rule gets a documented exception). **The sharpest item in this record.**
3. **The outage cards are the only tape entries with no kind word (L1-F14).** `checkCardLabel` drops `Status check ·` for the three D-65/D-69 absence labels because they already end in "at this check". The stutter argument is sound and the founder's strings are untouched — but the one card class a player is most likely to misread is the one that no longer says what kind of thing it is. A decision to sustain or revisit, not a build error.
4. **The screen still enacts `nothing was sent` in pixels (L1-F6).** Item 5 removed the clause from the sentence; the optimistic user bubble is still deleted on `!res.ok`, and the row that pins that behaviour justifies it with *"nothing was sent is then true"* — the claim this same PR establishes is sometimes false. A message that VANISHES from the conversation is a stronger instruction to re-send than any sentence. The rollback is shipped behaviour this PR did not touch, and changing it would change the flag-off path too; the stale justification is corrected, the behaviour is recorded.
5. **`checkCardLabel`'s absence branch and the `U.S.` split interact.** A rationale beginning with an abbreviation can now make the collapsed book panel's "first sentence" the fragment `The U.S.` (L1's note). Pre-existing in `splitSentences` and unchanged by this PR — but D-89's collapsed panel is a new consumer of "the first sentence", so it is newly visible.
6. **Two `tapeEntries` gates, one guarded (L3-F3).** Deleting the `controllerOn` conjunct on the `buildTape` memo leaves the suite green; the load-bearing gate is the call site, which is guarded. Consequence today is wasted work flag-off — but item 2's eyebrow gate now hangs off the same prop, so the pair carries more than it did.
7. **The golden's "no controller markup" row checks the photograph, not the tree (L3-F2).** It reads the `.html` file, so no change to the tree can fail it. Subsumed by the byte-equality row beside it, so not a hole — but it is the row a reader would cite for that claim, and it carries no evidence for it.

---

## 7. Disclosure

*(Appended at handoff.)*
