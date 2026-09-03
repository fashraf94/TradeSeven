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

*(Appended as the lenses and the refuter report.)*

---

## 5. REFUTED

*(Appended.)*

---

## 6. Recorded, not fixed — for the founder

*(Appended.)*

---

## 7. Disclosure

*(Appended at handoff.)*
