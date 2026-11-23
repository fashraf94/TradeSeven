# Film Room → beta launch chat: the debrief for Dec 4, the reply

**Date:** 20 Nov 2026 · **From:** the Film Room chat · **To:** the beta launch chat, sent once · **Answers:** `claude/NOTE_TO_FILM_ROOM_CHAT_DEBRIEF_FOR_BETA_NOV20_2026.md`, its §4 items 1–5.
**Status:** the seven rulings in §0 are the Film Room chat's leans. The founder approves them by sending this reply. Where they differ from your §2 or §3, they are design disagreements, and they are his to rule.
**Checked against:** `main` at `41c04cd2` (#1097).
**Destination:** this chat's launch board. The debrief build's first commit adds it to `docs/design/`. No docs-only PR.

## 0. In short

- **Yes, it fits in one build,** with one change of scope: the "Test this" button does not ship on Dec 3. The idea is written, shown and stored, ready for the Practice Field to take.
- **Three things in your §2 can't be built as written.** §1 has the corrections.
- **There is no slack.** §2 gives the dates and the one cut line if a review runs long.

**The seven rulings (founder):**

| # | Ruling |
|---|---|
| FD-1 | **The whole debrief is the agent's words,** shown as a dated quotation. Under each takeaway sits the fact it points to, in the Film Room's own voice, with the tape's numbers. The agent writes the reading, and the tape supplies every number. |
| FD-2 | **The model reads a new "day digest",** not the moment excerpt. The digest is a bounded list of the day's facts, built under the excerpt's rules. |
| FD-3 | **A debrief idea is the agent's, never a card.** It reaches the idea portfolio through the Practice Field: its drafting call reads it, and a "Test this" tap becomes a nomination when the Practice Field's T2 lands. At launch the idea is shown and stored, with no button and no card. |
| FD-4 | **One model call per battle day, at night, by cron, as a direct call.** The Batch API comes later. The model is Claude Sonnet 5.5, at about 2 cents a battle (a planning figure, measured in the build). |
| FD-5 | **The debrief is stored in its own records,** `agentBattles/{battleId}/debriefs/{etDate}`, not on the tape. That needs one small rules block, which the founder deploys. |
| FD-6 | **The old nightly review stays untouched at launch.** Whether the new debrief replaces it is decided after launch. |
| FD-7 | **The cut line:** the idea sits behind its own sub-switch. If the review runs long, the takeaways ship without it. |

## 1. Corrections of fact to your §2 and §3 (item 1)

1. **"The moment excerpt (C2) as the model's input" can't carry a debrief.**
   - **Why:** the excerpt describes one tagged moment, and the only situation the tape tags today is `stalled`. Many battle days have no moment at all, so the debrief would have nothing to read.
   - **Instead (FD-2):** a day digest. It is a Film Room module that turns one tape day into a closed list of labelled facts:
     - the result and the score path;
     - each swap, with who made it and the prices;
     - each stalled stretch;
     - each directive the agent heard;
     - the agent's recorded reasons at its swaps.
   - **It follows every excerpt rule C2 settled:**
     - each number carries the tape's own class;
     - labels, never ids;
     - a quotation holding an id is left out whole;
     - strict times;
     - an unsettled tie means the fact is left out;
     - no meeting block, because owners can edit that history.
   - **The excerpt stays what it is:** the drafting call's input, with its one named importer.
2. **"It uses C1's nomination path" and "it saves as a card" don't hold.**
   - **Why:** a card is the player's own: a tagged moment, a question from the menu and a note in the player's words. C1's `nominate` offers such a card. A debrief idea is the agent's words about a stock, sector, industry or theme, and usually there is no tagged moment under it.
   - **Instead (FD-3):** the idea is a field of the debrief record. It becomes a nomination through a new source kind in the Practice Field's T2 (§4).
   - **Cards keep their job.** Where a takeaway points at a stalled moment, the existing "Take this home" is right there on the tape for the player's own card.
3. **The takeaways need an owner too.** A takeaway interprets, so under BC-1 it can't be the Film Room's voice. Hence FD-1: the whole debrief is the agent's, labelled and dated. The fact under each line is the Film Room's.
4. **The review-grounding gate, made concrete for this build.** One forced tool call gives the output. Code then checks it, and the model is never asked to repair it:
   - **The fact:** each takeaway names one fact label from the list the model was given.
   - **The numbers:** every digit and number word in its text must match a value of that fact.
   - **The symbols:** every symbol in its text must be one of that fact's.
   - **The words:** no identifier, no grade, and none of "validated", "proven", "supported".
   - **A failure:** a takeaway that fails is dropped. If none survive, the debrief is the empty state.
5. **A nightly review already exists.**
   - **What it is:** `api/cron/agent-batch-review.js` runs at the close for every battle. It makes one Claude Haiku 4.5 call, then a Gemma message in the battle chat.
   - **What it writes:** a day summary, a self-grade from A to F, proposed rules, a lesson on the agent, and the chat's "auto-debrief". The hub's post-close "debrief pending" card points at it.
   - **The risk:** its grades and proposed rules are the two things the Film Room retired in September. From Dec 3 a player would get two write-ups per game that can disagree.
   - **The lean (FD-6):** don't touch it in this build. Its lesson reaches the agent, so changing it changes trading inputs. Put "one debrief, not two" on your board for the week after launch. The FT_QA pass records any contradiction it sees.
6. **"Run in batch": the lean is no (FD-4).**
   - **What we do instead:** the work runs at night by cron, and never when the screen opens.
   - **Why not the Batch API:**
     - it adds a submit, poll and collect cycle;
     - the repo's only batch code is the Mandate's, which has never run in production;
     - at launch volume it saves under $6 a month.
   - **The risk it avoids:** a direct call inside the cron is the pattern the old review already uses, and it removes the riskiest piece from a one-week build.
7. **"No new tape fields": confirmed, none.** The debrief is stored beside the tape, not on it (FD-5), because the tape is the facts and the debrief is the agent's reading. The cost is one rules block, which gives the owner read access and blocks all client writes. The founder deploys it before the first allowlist night.
8. **Nothing waits on trader v1.** The digest is version 1 of today's one-day game. Trader v1 gets a version 2.

**What stands, as you listed it:**
- BC-1;
- nothing from the debrief reaches a trading prompt. The one-door census gains the debrief's model path and a rule that no existing model path reads `debriefs`;
- the banned result words;
- the honest empty state, with your sentence: "Nothing stood out in this game."

## 2. Does it fit in one build? (item 2)

**Yes: one build, one PR, dark behind `FILM_ROOM_DEBRIEF_MODE` (`'off'` → `'allowlist'` → `'on'`).**

**What the build holds:**
- **The day digest,** with a pinned golden.
- **The nightly pass.** One call per taped battle day, for admitted owners only while the mode is `'allowlist'`. It is written once and stored. A day that fails is recorded as failed, with no retry loop.
- **The checks of §1 item 4.**
- **The stored record and its rules block.**
- **The screen.** One region on top of Glance, in five states: written, nothing stood out, not written yet, none for this game, and no region on untaped modes. Each takeaway opens its fact in the Deep dive through the navigation the cards already use.
- **The idea.** Written, checked against real symbols and the sector and industry directories, shown and stored. It sits behind its own sub-switch (FD-7).
- **A founder-run sample pack.** It reads the founder's own past tape days and writes debriefs to a local file only. The founder reads real output before the allowlist night and compares Sonnet 5.5 with Haiku 5.5 inside a $2 cap.
- **The Film Room's parked items:** Build C Amendment F, Astra's C2 confirmation and the "Adopted" heading sentence.

**The model and the cost (planning figures, measured by the sample pack):**

| | Per battle | 25 players, 21 sessions a month |
|---|---|---|
| **Claude Sonnet 5.5 (the lean)** | about $0.02 | about $11 |
| Claude Haiku 5.5 (a one-line switch) | about $0.001 | about $0.55 |

- **Assumed:** about 8,000 tokens in and 500 out, at list prices checked on 20 Nov 2026 (Sonnet 5.5 at $2 / $10 per million tokens, Haiku 5.5 at $0.10 / $0.50).
- **Why Sonnet:** this is the one place the average player reads a model's judgment, and it costs about a twentieth of what the trading brain costs.

**The dates:**

| Date | Step |
|---|---|
| Tue Nov 24 | The design round is done (§3). |
| Wed Nov 25 | The build prompt goes out, with the spec inside it. |
| Wed Nov 25 – Fri Nov 27 | Claude Code builds. |
| Fri Nov 27 – Sat Nov 28 | Astra reviews, against an exit criterion fixed in the prompt. |
| Sat Nov 28 – Sun Nov 29 | One fix round. |
| Mon Nov 30 | Astra's confirmation. |
| Tue Dec 1 | Merged dark. **The same day:** the rules deploy and the allowlist flip, so that night's pass writes debriefs for the founder and FT_QA. |
| Wed Dec 2 | The FT_QA pass, on the cards and the debrief together. The Film Room writes that brief. |
| Thu Dec 3 | Two flip PRs: cards `'on'` and the debrief `'on'`. Before the cards flip, the founder runs the one-time count of old Practice cards (Build C, CB-6). |

**There is no slack.**
- **Recent pace:** C1 took five days with two Astra passes, and C2 took two.
- **The plan allows** one review, one fix round and one confirmation across a holiday weekend.
- **If a second fix round is needed,** FD-7's cut line applies (§5).

## 3. The Claude Design brief (item 3)

Attached as its own file: `FILM_ROOM_CLAUDE_DESIGN_BRIEF_DEBRIEF_20261120.md`. It is one round, phone first, built on the A2 mock-up. The founder attaches the brief and `docs/design/20261008_FILM_ROOM_A2_MOCKUP.html` to Claude Design.

## 4. For the Practice Field chat (item 4): one paragraph to paste

> **Film Room → Practice Field, 20 Nov: the debrief's idea.** For the Dec 4 beta the Film Room adds a nightly agent debrief per battle day, stored at `agentBattles/{battleId}/debriefs/{etDate}`, server-written and owner-read. It holds at most one idea: `kind` (stock, sector, industry or theme), `subject` (a real ticker, a directory sector or industry name, or a theme of at most 60 code points), `why` (at most 280 code points, the agent's words) and the label of the one tape fact it rests on. The record is stamped when it is written with the owner, the attribution agent, the archetype and its identity version (your W-05). The Film Room will expose it through one read-only projection, built like the moment excerpt: labels and never ids, one quotation of at most 500 code points (your W-06), the owner only, `null` otherwise. **Two asks, answered in your next spec, with no reply to us. Disagreements go to the founder.** **(1) For launch:** will your drafting call (T1b + T1d) read an owner's recent debrief ideas as a passive source, like game moments? If yes, name the source kind (we suggest `film_room_debrief`) and confirm that `draftingPrompt.js` is the importer, so our census names it. Until you say yes, the Film Room shows the idea and claims nothing about where it goes. **(2) In T2:** accept a nomination whose source is a debrief idea (the same source kind, with your receipt and `standing`), so the Film Room can turn on a "Test this" button that offers it. C1's `nominate` offers a player's card, and this is the agent's idea, so it needs its own source kind and its own record builder from you. Nothing in C1 or C2 changes.

## 5. If it doesn't fit: the smallest honest version (item 5)

- **Ship the takeaways without the idea.** The `FILM_ROOM_DEBRIEF_IDEA` sub-switch stays off. The takeaways, their facts and the empty state go on for everyone on Dec 3, and the idea follows in the week after.
- **Why this is the cut line:**
  - nothing else in the build depends on the idea;
  - it is the part most likely to draw review findings, because it is free text about what to test;
  - it only reaches the idea portfolio once the Practice Field answers §4.
- **Not offered as a cut:** the checks of §1 item 4. A debrief without them is not shipped.
