# Shared Research — "Work an idea" · Concept V2: the thesis builder

**Date:** Nov 16, 2026 · **Author:** the Shared Research build-spec chat (Claude) · **Status:** direction from the founder's first live test (Nov 16); the decisions in §9 apply on their defaults unless he amends by number.
**Changes:** concept V1 (revised Nov 7) and build spec V1.2 in the *method*, the *step's output* and the *work view*. The records, the sourcing rules, the cost controls, the gate and the save are kept (§7).
**Corrected by:** build spec Amendment B (Nov 16) §B1 on one point: the knowledge-base method needs no new version; the thesis builder is a frame around the method (§7 item 1 and the KB note in §10 below are superseded). Design rounds 3 and 3b picked the sentence card (C-B).
**Scope:** design only. It authorizes no build. Order of work: a Claude Design round (brief: `SHARED_RESEARCH_CLAUDE_DESIGN_ROUND3_THESIS_BUILDER_NOV16_2026.md`) → the founder picks → a build-spec amendment → two builds (server, client).
**Destination:** `docs/design/shared-research/20261116_WORK_AN_IDEA_CONCEPT_V2_THESIS_BUILDER.md`, committed with the first V2 build (no docs-only PR). Project copy under `claude/`.
**Checked against:** `main` @ `71bc6bd` (Shared Research live on the allowlist: #1048, #1059, #1064, #1068; KB-1 #1062), the Practice Field shared contract V2 §4.1, concept V6.1 §4.

---

## 0. In plain terms

**V1 investigates. V2 builds a thesis.** Today the partner follows the evidence wherever the weakest link is, and there is always a weakest link, so it never ends and the screen becomes a growing list. In V2 every tap fills one part of a **thesis card**, and the investigation ends when the card is complete: a thesis the player can save, that the agent's idea book can test over weeks.

**The six parts of the card:** the theme · the segment · the names (one stock or a small group) · why · what would prove it wrong · the time frame.

**The screen becomes a conversation.** The partner says one short thing, shows what changed on the card, and offers two or three choices (plus "you pick, and tell me why", plus the player's own words). Evidence is not a separate list: it sits behind each part of the card, one tap away.

**What does not change:** nothing is called a fact without a source; no ticker is invented; a dead end is still an honest ending; there is no confidence score and no buy or sell call.

---

## 1. What the first live test found (founder, Nov 16)

1. **The sourcing works, and it caught a wrong story.** A FantasyTimes story read as if the PPI report came out that day. The investigation found the primary source (the October release, published Nov 13) and said so. The value was plain to see. The story itself is a defect for the reporter desk (§10).
2. **The process feels like a list, and endless.** Going back and forth between the evidence and the partner's words is too much. Every step produces a new follow-up question; nothing says how close the work is to done.
3. **It needs a destination.** The purpose is to refine a raw thought into a thesis that can be tested from a medium- to long-term position in the portfolio, then watched for news that helps or hurts it.
4. **The shape he wants:** "I want to play AI" → the partner breaks the theme into segments → the player picks one, or asks the partner to pick and say why → the stocks tied to that segment, and why they are tied → one stock or a group → the investigation runs for that choice → a thesis comes out that can be monitored and tested.
5. **The feel he wants:** talking to an agent (the Forge workshop chat), or watching the thesis grow, not an updating list.

**Why V1 behaves this way.** It is the design, not a bug: V1's method says "one next action, aimed at the weakest link in the chain", and its screen shows the record. V2 changes both.

---

## 2. The thesis card

One card per investigation. It is the destination, the progress meter and the save preview in one object.

| Part | What it holds | When it counts as set |
|---|---|---|
| **Theme** | The player's idea in a phrase ("AI buildout") | At the start: the player's words, the story's subject, or the drop's topic. Never evidence. |
| **Segment** | The part of the theme this thesis is about ("GPUs and accelerators") | The player picks one from the partner's map, or accepts the partner's pick. **Optional**: skipped when the player starts from a stock or the theme has no useful split. |
| **Names** | One to four stocks from the game's list | Each name has a **Source-backed connection** to the theme or segment (V1's "supported" rule, unchanged). A name without one is a lead and cannot be set. |
| **Why** | One to three reasons the names earn from the theme, and the strongest point against | At least one Source-backed reason per name. The point against is always shown beside it, never hidden. |
| **Wrong if** | What would prove the thesis wrong, in words; optionally a price line per name | The player picks or writes one statement. A price line ("wrong below $X on a daily close") stays optional. |
| **Time frame** | Swing · positional · longterm (10 / 30 / 60 sessions) | The player picks. The partner may say which fits the "why" and say why. |

**Each part shows where it came from:** "you chose", "you wrote", or "{Agent} suggested, you confirmed". Each part's sources open from the part itself.

**The thesis sentence** is composed from the parts ("{Names} earn from {segment} because {why}. Wrong if {wrong if}. Over {time frame}.") and the player can edit it before saving. The server checks the edit the way V1 checks the idea statement: named companies must be the picked ones; numbers must sit in sourced facts.

**"Thesis ready"** = Names, Why, Wrong if and Time frame are set. The card says so, the partner stops proposing research, and the actions become **Save thesis** and **Keep researching** (which uses remaining steps to strengthen a part the player names).

---

## 3. The conversation

**One turn** = the partner's message (short: what it found, in two or three sentences) + what changed on the card + **choices**.

**Choices are of two kinds, and the screen says which:**
- **Research choices** cost one step (one web retrieval, one model turn — as today): "Map the segments", "Find the listed companies in this segment", "Check what could break it".
- **Free choices** cost nothing and call no model: picking a segment from a map already shown, one stock or the group, a time frame, a wrong-if from options already shown, accepting the partner's pick.

**"You pick, and tell me why."** On any choice the player may hand the pick to the partner. The partner answers with its pick and its reasons, each reason labelled (Source-backed or its own reasoning), and the player confirms or picks differently. The card records it as suggested and confirmed. The partner never fills a part silently.

**The player's own words** stay available at every turn (V1's "direction"): it costs a step and may redirect the work, but it never changes the theme mid-investigation. A different theme is a new investigation.

**Progress is always visible:** the card's parts (n of 6), and steps left. The partner aims each proposed research choice at **the next unset part**, not at the weakest link. When a part cannot be set (no listed company, no source), it says so and offers the honest ending.

**A typical path, single stock:** map the segments (1 step) → pick a segment (free) → find the names (1) → one stock or group (free) → build the why (1–2) → what could break it (1) → pick wrong-if and time frame (free) → ready. **About four to five steps**, inside today's budget of ten. At the measured ~2.5¢ a step, a finished thesis costs roughly 10–15¢.

---

## 4. Starting points

| Start | What is prefilled | First research choice |
|---|---|---|
| **Own words** ("I want to play AI") | Theme | Map the segments |
| **A story** | Theme, from the story's subject; the story stays "From FantasyTimes", never a fact | **Verify the story against its primary source** (V1's rule, kept: this is what caught the PPI story), then map |
| **A SignalDrop** | Theme from the drop's topic; candidate names from the drop, as leads | Verify the drop's claim, then connect the names |
| **A stock** (later; the stock modal's "Work this idea" door) | Names | Build the why; Segment skipped |

---

## 5. Endings

- **Thesis ready → Save thesis.** One server write, as today: a committed list, the idea's first version, the research record closed. The save screen is the finished card; there is no second preview to review.
- **"Use it in my next game"** stays a separate, optional action after saving.
- **No thesis.** If no listed company has a sourced connection, or the "why" cannot be sourced, the partner says so and the investigation concludes with what it found. **No stock is ever picked to complete the card** (concept V1 §4.7, kept).
- **Out of steps before ready.** The card stays as it is; the player may save it only if it is ready, otherwise conclude or come back another day (a new investigation may start from the same theme).
- **Leave it open, discard it:** as today.

---

## 6. After saving: testing and watching

The saved thesis is the idea record the Practice Field already reads (build spec §0, §5.5). The card's parts map onto the idea book's contract (shared contract V2 §4.1):

| Thesis card | Idea record (saved today) | Practice Field idea contract |
|---|---|---|
| Thesis sentence | `statement` | Thesis, one sentence — the agent drafts its own from recorded sources; the saved thesis is such a source |
| Names (1–4) | the list's tickers | Names, 1–4 in the pilot |
| Time frame | `horizonEnum` | Slot: short 10 / medium 30 / long 60 |
| Wrong if, price line | `invalidation` (daily close) | Wrong-if line per holding, completed-session close |
| Wrong if, in words | inside the statement (until the framework adds a field, §10) | An event condition, recorded as observational in release 1 |
| Why, with sources | `evidenceRefs` (the kept findings) | Sources by id |

**Watching for news that helps or hurts the thesis** is the Practice Field's side, and it is the right next ask (§10): the book shows, per thesis, **what has been found for it and against it since it was saved**, each item sourced and dated, against the thesis's own "why" and "wrong if". **Not a confidence score**: the app has no measured basis for one, and the honesty rules forbid a number it cannot back. A count of sourced items for and against is honest; "confidence 72%" is not.

---

## 7. What is kept, what changes

**Kept, untouched:** the research record and its findings; every validator rule from the B1 rounds (sources, dates, tickers, numbers, supersession, forbidden patterns); the companies rule (supported needs a sourced relationship); the cost controls and daily ceilings; the gate and the allowlist; the provenance stamp; the adoption transaction and its idempotency; the Start view's three doors; the hub door.

**Changes, server (a build of its own):**
1. **The method.** A new method text, "thesis builder", replaces "follow the chain, aim at the weakest link": the six parts, what each needs, the order, when to stop. Own-words investigations take their method from the knowledge base since KB-1, so the KB chat carries the same change for that entry (§10).
2. **The step's output** gains two things: **card updates** (which part, the proposed value, the findings it rests on) and **choices** (label, kind — research or free —, what it would do). The validator checks a card update like a claim: its findings must exist and be current; a Name needs its supported connection; a Why needs a Source-backed finding.
3. **The session** holds the card (each part: value, state, who chose, the finding ids) and applies free choices with no model call.
4. **The read** returns the card and the current choices.
5. **Save** composes from the card; the checks stay.

**Changes, client (a second build):** the work view becomes the card plus the conversation; evidence opens from a part (and one "All evidence" door for the full record, which is V1's list, kept for the curious); the adoption screen becomes the finished card. V1's list-first work view is retired.

**Honesty additions for the thesis's wording:** a thesis says what a company *earns from, is exposed to or depends on* and what would prove that wrong. It does not say a stock is "a great play", a buy, or will go up; V1's rule against advice and price forecasts already covers the partner's words and now covers the card.

---

## 8. Known limits (said on the screen where they bite)

- **Names come only from the game's stock list.** A theme whose best companies are not on the list ends as a lead, honestly.
- **The segment map is the partner's reasoning** until a source backs a segment; it is labelled that way. It is a way to choose where to look, not evidence.
- **A group is small** (four names at most) because each name must earn its own sourced connection and the idea book's pilot holds one to four names per idea.
- **One theme per investigation.**

---

## 9. Founder decisions (defaults apply unless amended by number)

| # | Decision | Default |
|---|---|---|
| **V2-1** | What "ready" requires | Names, Why (one Source-backed reason per name), Wrong if, Time frame. Segment optional. |
| **V2-2** | Group size | One to four names, matching the idea book's pilot. |
| **V2-3** | Free choices | A choice that needs no research costs no step and calls no model. |
| **V2-4** | The partner picking | Allowed as a recommendation with labelled reasons; the player confirms; never silent. |
| **V2-5** | Wrong-if in words | Required for "ready"; saved inside the thesis sentence until the framework adds a field for it. A price line stays optional. |
| **V2-6** | V1's list view | Retired as the main view; kept as "All evidence". |
| **V2-7** | The step budget | Stays ten; revisit with the allowlist's measured paths. |
| **V2-8** | The word on the screen | "Thesis" for the card and the saved object's title; the record stays an idea underneath. |

---

## 10. Needs for other chats (paste-ready when the direction is confirmed)

**To the FantasyTimes / reporter desk owner (Command Center chat) — a defect, independent of V2:**
> From the Shared Research chat. Founder's live test, Nov 16: an Economics Desk story, "PPI Comes in Softer Than Expected, Eases Near-Term Rate Shock Risk", read as if the release were that day's. The investigation's primary source (bls.gov) dates the October release Nov 13. Ask: a story about a data release should carry the release's own date in its text, and should not present a release older than the story's day as news of the day. Shared Research treats every story as unverified until a primary source confirms it, so nothing wrong was saved; the fix belongs at the desk.

**To the Practice Field chat:**
> From the Shared Research chat. Concept V2 turns "Work an idea" into a thesis builder whose output is: a one-sentence thesis, one to four names, a time frame (your three slots), a wrong-if in words plus an optional price line per name, and the sourced reasons. It maps onto your idea contract §4.1 (table in our concept §6). Two asks, neither blocking: (1) the founder wants a saved thesis **watched for news that strengthens or weakens it** — we propose the book shows sourced, dated items for and against since the save, against the thesis's own why and wrong-if, and no confidence score; whose build is that, and what would you need on the saved record? (2) is a wrong-if in words usable to you as an `observational` event condition as it stands?

**To the framework chat:**
> From the Shared Research chat. Concept V2 adds a wrong-if in words to a saved thesis. Until there is a field for it, it is saved inside the statement. Ask: an additive, non-hashed field on the idea version for it (and for the per-part provenance: chosen by the player, or suggested and confirmed), on the `deployedBattleIds` precedent. Still open from before: the `attribution` field and an `outcome` the Film Room writes.

**To the KB chat:**
> From the Shared Research chat. Since KB-1, own-words investigations run on your accepted method. Concept V2 changes what a method must do: build six parts toward a thesis and stop when they are set, instead of following a chain to its weakest link. The baseline method changes with the V2 server build; the own-words package needs the same shape (a new version), or own-words falls back to the baseline by your loader's rule.

**To the Command Center chat (hub):** nothing changes. The door, the props and the summary line stand; the sheet's inside changes.
