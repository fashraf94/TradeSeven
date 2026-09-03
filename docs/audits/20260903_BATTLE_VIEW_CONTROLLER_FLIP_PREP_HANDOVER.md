# Battle View controller — flip-prep (PR 1) handover

**Date:** September 3, 2026
**Branch:** `fix/battle-view-flip-prep`, from `origin/main` @ `09b6aba8` (A2 merged at `1786bd46`).
**Commits:** five, one per seed item, in the seed's order.
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

All five behind `BATTLE_VIEW_CONTROLLER_ENABLED` (dark). No new files — so both theme/motion guard lists (directive 9) were already complete and needed no additions.

---

## 2. Founder smoke — what to look at

With the controller flag on (`?battleViewController=1` until PR 2 removes it):

1. **Tap the score header.** The book panel opens COLLAPSED: `At the {t} check`, the state, `Woken by …`, ONE sentence, `Read more`. It must not push the board off the screen. Tap `Read more` — the rest arrives inside a region that scrolls itself. Tap the `×` — the panel closes and the keyboard focus ring is back on the score header.
2. **`Read the full check` on a LOW row.** It should no longer jump you to the top of the board. The conversation opens (desktop: the column; phone: the sheet to full) at that check's own card, already expanded, focused. **This is the biggest behaviour change in the PR.**
3. **Scroll the conversation.** Every entry says what it is: `Status check · 12:45 PM · Held`, `Bench note`, `Trade note`, `Opener`, `Reply`, `Directive`. Anything the server has not given a type gets no eyebrow at all — if you see a label you do not recognise, that is a defect.
4. **A check whose words contain `**`.** The asterisks must not be on screen; the emphasised clause should read bold. Look for a sentence that got cut in a strange place — the sentence splitter had to learn to see through the markers.
5. **The unread dot.** Arrive at a battle with a conversation you have not read: the dot is on (a fresh arrival treats everything as unseen). Open the chat — it clears. A new check lands while you are collapsed — it returns. A feed-only event (a watchlist refresh, a blocked guardrail) must NOT light it any more, because the tape shows nothing for those.
6. **A failed send** (offline, or a 500): `The character couldn't answer just now` — and nothing about whether it was sent, because the client cannot know.

---

## 3. Strings added or changed this session

All in `src/screens/battleView/battleViewCopy.js` (the guarded copy module — the components type no prose):

- `tapeKindEyebrow(messageType, hasUserHalf)` → `Opener` · `Bench note` · `Trade note` · `Reply` · `null`
- `closeWhyBookName` → `Close the check`
- `checkCardLabel(iso, label)` → **changed**: `Status check · {t} · {state}`; the two absence labels keep `{t} · {label}`
- `chatSendFailed` → **changed**: `The character couldn't answer just now` (the `· nothing was sent` clause removed)

---

## 4. CONSTRAINED — for the founder

1. **The two absence labels keep the old shape.** `No decision recorded at this check` and its two outage variants (D-65, D-69) already end in "at this check", so prefixing them with `Status check ·` says "check" twice. Those cards render `{t} · {label}` instead, which means the one class of check card that does NOT carry the kind eyebrow is the one that failed. Rewording the ruled strings to fit the eyebrow would be a ruling, not a composition — **it is left for a founder line either way.**
2. **The unread dot now lights on arrival.** The seed's rule — "a fresh mount treats everything as unseen" — means opening a battle with an unread conversation shows the dot immediately. That is a visible change from A4, where an empty `statusFeed` fixture meant a quiet first paint. Two committed rows flipped to say so.
3. **`nothing was sent` is gone until the server can attest to it.** Item 5 removed the clause; the underlying server defect (`api/agent/chat.js` charges the budget inside the `try` whose `catch` returns the 500) is still there and still needs its own tasking. **A player who fails a send is now told less than before, on purpose** — the alternative was telling them something false.
4. **`splitSentences` changed for every caller.** Making it see through `**` markers was necessary for item 3 (a marker after a full stop hid the boundary entirely), but it is a shared rule: the Why? row extracts and the tape's first sentences both run through it. Behaviour on text with no markers is unchanged and pinned by a row.
5. **A docstring correction of record.** `splitSentences`'s comment claimed the whitespace lookahead kept `U.S.` intact. It never did — the final stop IS followed by a space, so it splits, and always did. The comment is corrected and the real behaviour asserted rather than the claim left standing.

---

## 5. Verification

- **Full suite:** 589 files, **10,177 passed**, 63 skipped, 0 failed (10,026 at A2's handoff).
- **`vite build`:** green — the pre-existing chunk-size warning only.
- **Flag-off goldens:** `agentBattleScreen.tabbed.html` and `agentChat.tabbed.html` unchanged and passing.
- **Theme, motion and copy guards:** green. No new files, so no guard-list additions were due.
- **Mutations:** every new guard was checked against the deletion it names before its commit. Three survived the first pass and are the reason three fixtures changed — a one-evaluation fixture could not fail "the pinned card is not folded", a one-sentence rationale could not fail "the card starts expanded", and a `font-weight:700` assertion could not tell the model's emphasis from the symbol's.

---

## 6. The review

The cumulative branch diff is **18 files / 1,278 lines**, which crosses BUILD_RULES §2's `≥10 files OR ≥1500 lines` threshold. The seed anticipated this (*"if PR 1 crosses it, the §2 review applies"*), so the mandatory multi-lens adversarial pass was run rather than a single-pass review.

*(Filled in at handoff — see §7.)*

---

## 7. Review findings and dispositions

*(Appended when the lenses and refuter report.)*
