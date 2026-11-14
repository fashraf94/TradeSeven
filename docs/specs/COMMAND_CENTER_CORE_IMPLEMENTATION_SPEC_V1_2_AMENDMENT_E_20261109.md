# Command Center core spec V1.2 — Amendment E V1.1: the research door, For-you, and the first visit

**Owner:** Command Center chat · **Date:** 2026-11-14 (V1: 2026-11-09) · **Status:** ruled by this chat; founder decisions in §9.
**Destination:** `docs/specs/COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_E_20261109.md`. This is the first commit of the **hub research door PR** (Part 2), which now lands first. It is never a docs-only PR. V1 was never committed, so this file is the only one at that path. Project copy: none (the project is full).
**Grounded on:** `main` @ `c85f7b41` (#1059, B2 merged). B1 (#1048), KB-0 (#1054) and Huddle S1 are merged.
**Answers:** the Shared Research build-spec chat's note of Nov 13 (B2 report `docs/audits/20261113_BUILD_SHARED_RESEARCH_B2.md` §9–§10), the onboarding spec V1.1 §9 (H1–H6), the Huddle S1 build report's RF-5, and this chat's L3-11 ruling (Nov 8).
**Consumers:** the hub research door PR (Part 2, now first), onboarding O3 (Part 1, later), and Huddle (the order in §4).

Every rule of the core spec and Amendments A–D still holds unless a row here changes it:
- one reader per record, keyed by uid and auth epoch, read once per load and never polled;
- the status line is the only live region;
- one overlay stack;
- nothing the root deploy provider imports reaches hub, Huddle or research code;
- the copy guard's banned words, the motion and token guards, and the activity manifest all stand.

## Changes from V1

| # | V1 | V1.1 | Why |
|---|---|---|---|
| E-1 | Part 1 (O3) first; Part 2 needs it merged | **Part 2 first.** It builds the story selector (with no chip match) and the stories reader itself. O3 adds the chip match and the For-you card later. | Onboarding waits on the first Huddle (U2) and W1; the sheet is merged and dark now |
| E-2 | A lazy edge into a sheet that imported `HubSheet` itself | **The Huddle-shaped wrapper** `CommandCenter/SharedResearchSheet.jsx` renders `HubSheet` around the body. The body (`SharedResearch/SharedResearchSheetBody.jsx`) is **loaded lazily** through `hub/loadSharedResearch.js`, which is the second permitted load-time edge. | B2 built the body as a Huddle-style terminal; the body (~165 KB of source) stays out of the hub chunk until opened |
| E-3 | The Level 0 question table keyed by story type, in `hubCopy.js` | **`questionForBeat(story.reporterBeat)`** from `src/constants/sharedResearch.js` (`BEAT_QUESTIONS`, merged with B1). The type table and F-1 are withdrawn. | One question table, already merged, read by the body too |
| E-4 | The research next action (§3.4) in Part 2 | **Deferred.** It enters with its own amendment after the allowlist week. | Shared Research spec §14 and the B2 note; nothing to rank until real investigations exist |
| E-5 | Admission was "one client helper the B1/B2 spec names" | **Named (§1):** `SHARED_RESEARCH_MODE` read through `hub/hubFlags.js`; at `'allowlist'`, the cached cockpit-status verdict for an owned agent battle | Spec §7.6; the research-sheet precedent |
| E-6 | The stories reader was a client Firestore query | **The existing feed client** `fetchFeed()` (`src/services/fantasyTimesClient.js`, `/api/fantasytimes/feed`), the route the FantasyTimes page uses | Same query, server-side, CDN-cached, no new rule |
| E-7 | Activity rows "open the sheet, or the idea for the saved row" | **All three rows open the sheet on that investigation** (mode `session`) | The sheet shows a saved investigation's idea; one door |
| E-8 | — | **§10:** a HubSheet-level focus rescue, as its own hub PR | B2 review c1: `HuddleSheet` loses focus after Confirm |
| E-9 | — | **§11:** the founder's steps before the allowlist flip | The B2 note §4 |

---

## 0. In plain terms

- **Every admitted player** finds a **"Work an idea"** door at the top of the Research area. It opens Shared Research. When an investigation is open, a line above the door says so, with **Continue**.
- Activity records when an investigation opens, concludes or becomes an idea.
- **Later (O3):** a new player lands on one real FantasyTimes story **above** "Your first BaggerBomb". Returning players see the same story card inside the Research area. Its "Explore this" opens the same sheet.
- Research never stands between a player and a game.

| Part | Contents | Implements | Needs first |
|---|---|---|---|
| **2** | The admission read, the wrapper and its lazy body, the door, the summary line and Continue, the story selector (no chip match) and the stories reader, the research reader, the research Activity rows | **Hub research door PR** | B1, B2, S1 (all merged) |
| **1** | First-visit order (H1), the For-you card and "Explore this" (H2), the chip match in the shared selector, the next action for a new player (H3), Agent created and Interests saved (H4), one name (H5), guards (H6) | **Onboarding O3** | Part 2 merged; O1; W1 for interests; U2 for the first-Huddle card (falls back without it) |

---

## 1. Readers and admission

| Reader | Record and query | Owner of the read | When | Part |
|---|---|---|---|---|
| **Admission** | `SHARED_RESEARCH_MODE` (`src/config/sharedResearchFlags.js`), read at call time through `hub/hubFlags.js`; any value outside `SHARED_RESEARCH_MODES` reads `'off'`. At `'allowlist'`: `readFilmRoomVerdict(battleId, { ownerId: uid })` (`src/utils/filmRoomGate.js`), the cockpit-status verdict cached per owner per page life, shared with Bomb mode and the research sheet | the hub | once per owner per page life; at `'allowlist'` only | 2 |
| **Stories** | `fetchFeed()` → `/api/fantasytimes/feed` (`status == 'published'`, `expiresAt > now`, newest first, `limit 100`) | the hub | once per load, for an admitted player (O3 widens this to every player for For-you) | 2 |
| **Research** | `researchWork` where `userId == uid`, `orderBy createdAt desc`, `limit 20` (owner read, `firestore.rules` researchWork block; index `(userId, createdAt desc)` in `firestore.indexes.json`), filtered in memory to `origin === 'shared_research'` | the hub | once per load, for an admitted player | 2 |
| **Interests** | `playerContext/{uid}` (onboarding W1), one `get` | the hub | once per load | 1 |

**Admission:**
- `'off'`: nobody is admitted. Nothing renders, nothing is read, no request is sent. The hub is today's hub.
- `'on'`: every player is admitted, with no request. The server's idea-record admission still decides.
- `'allowlist'`: admitted only on a definite yes. The verdict route needs a battle the caller owns, so the hub passes an **agent battle id it already holds**: the owned live list first, then the completed window. It never reads anything new to find one. With no owned battle, the player is not admitted (the allowlist accounts all have battles). Until the verdict comes in, the player is not admitted.
- **The server is final.** The sheet gates itself on the route's `404 disabled`.

**The readers:**
- Each lives outside the hub directory (the S1 pattern: `src/hooks/…`), makes one service import, and is called once in `ConnectedHub`.
- The mount guard pins each one, and the activity guard pins its calls one by one.
- **The research reader is bounded on purpose.** A player may have more than 20 newer research records of other origins. Then the hub can miss an open investigation and shows no research line, never "no research". The sheet's own "Continue your research" (`GET ?list=open`) is authoritative.
- No reader announces, polls or refreshes on focus. Errors follow the hub's Retry pattern.
- **The sheet never reads stories.** The hub hands it the selection (§2.2).

---

## 2. Part 1 — onboarding O3 (after Part 2)

### 2.1 H1 · first-visit order

**First visit** means `firstDeploymentOffer(...)` is true (no battle has ever existed) **and** no plan is confirmed.

| Composition | First visit | Otherwise |
|---|---|---|
| Desktop, tablet, stacked | The For-you card renders in the `next` slot, **above** `NextActionCard`. `wideGrid` treats the slot as present when either is shown. | The For-you card renders in the **Research panel**, under the door block (§3.1). The `next` slot is unchanged. |
| Phone | Top of **Overview**, above the next-action card. Overview stays the default (`composition.js` `DEFAULT_PHONE_TAB`). | The **Research** tab, under the door block. Overview is unchanged. |

A returning player's first viewport does not change. The desktop default area stays Equipped Archetype.

### 2.2 H2 · the story selector and the For-you card

**The selector** is `src/selectors/storySelection.js`, a pure module outside the hub directory. Part 2 builds it; O3 extends it. The hub and the For-you card share this one definition. It has no React, no reads, no model and no network.

`selectStories({ stories, nowMs, interests = null }) → { items[≤5], general: boolean }`:
1. **Eligible types (Level 0):** `market_mover`, `macro_alert`, `earnings_recap`, `sector_column`, `econ_recap`.
   - Excluded: `market_pulse` (no question to investigate), `deepdive` (hidden by convention), and the previews `earnings_preview` and `econ_preview` (the event has not happened). This is F-4.
   - This narrows the Shared Research spec §8's `type != 'deepdive'`. The selector is the hub's.
2. **Required:** a non-empty `headline`, a readable `publishedAt`, `expiresAt` after `nowMs`, and an eligible type.
3. **Match (O3, needs W1):** a story matches when its `sector` or one of its `themes` equals a value mapped from one of the player's chips. The chip-to-value table lives with onboarding's chip lists. Typed text is kept and never matched. **In Part 2, `interests` is null:** no story matches, `general` is true, and every `reason` is null.
4. **Order:** matched stories newest first, then the rest newest first. At most five.
5. **Item shape:** the sheet's `item`, as given by the body's props (B2 report §10):
   - `{ itemRef: { recordKind: 'fantasyTimesStories', recordId: story.id }, headline, reporterName, beat: story.reporterBeat, publishedAt (ISO), context: story.subheadline ?? null, question, reason | null }`.
   - `question = questionForBeat(story.reporterBeat)`. When a story later carries its own `research.question` (FantasyTimes note V1.1, Level 2), that question wins.
   - `reason` (O3): "Because you want to explore {chip}" or "Because you know {chip}", only for a real match.

**The For-you card (O3):**
- It shows the headline, "FantasyTimes · {reporter}", the publication time, the subheadline as context, the question, and the reason line or "General selection".
- **"Show another"** steps through the five already read, with no new read.
- **"Explore this"** opens the sheet (mode `item`, with that item, and `direction` from the interests record's typed explore text). It does this for an admitted player. Otherwise it shows a line in place of the button: the gated line (`HUB_COPY.research.disabled`) for a player outside the admission list, or "Research isn't available yet" while the mode is `'off'`.
- **States:** loading (one line), error ("Couldn't load stories" · Retry), empty ("No stories to explore right now"). The game path stays visible in every state.
- The story is shown as **the item**, which is reporter content. It is never shown as a Source-backed finding.

### 2.3 H3 · the next action for a new player

| Condition | Card |
|---|---|
| No battle ever, no plan, **with** U2's first-Huddle switch on | **"Your first BaggerBomb"**, which opens the first Huddle |
| After the first Huddle's confirm, with no battle | The first-deployment card with the hold, plus S1's reconfirm door when the BaggerBomb approach differs from the confirmed one (onboarding §6.2) |
| Without U2 | Today's first-deployment card, unchanged |

### 2.4 H4 · Activity: Agent created, Interests saved

New `ACTIVITY_KINDS.AGENT`, built from records only:
- "{name} created": the agent's `createdAt`. One row, ever.
- "Interests saved": the interests record's `savedAt`. Skip writes no record, so there is no row after Skip.

### 2.5 H5 · one agent, one name (founder ruling OD-2)

- Every player-facing "Shadow" under `src/components/CommandCenter/` becomes the agent's given name. Copy becomes functions of the name, with the fallback "your agent", never "Shadow".
- "Shadow" stays the form's design name in code and the default name suggested at setup. Engine names do not change.
- A guard fails on `\bShadow\b` in any `hubCopy.js` string value, except an allowlisted design-name key.

### 2.6 H6 · guards

- Copy: the banned words still hold; no string pairs the agent's name with "idea"; "{n} findings" is allowed and "sources · N" stays banned.
- Mount and activity guards: the interests reader is pinned like S1's.
- The selector's match rows (§8).

---

## 3. Part 2 — the hub research door (first)

### 3.1 The Research panel

At the top of `panels/ResearchPanel.jsx`, above the "Ideas" eyebrow, **for an admitted player only**:
- **When an open investigation is found** (the research reader's newest record with `state === 'open'`): **"Research in progress · last update {time} · {n} findings"**, with a **"Continue"** link that opens the sheet on that investigation.
  - `{time}` is `telemetry.lastTurnAt` in the hub's ET format, and `{n}` is `findings.length`.
  - With no `lastTurnAt` (opened, not yet stepped): "Research in progress · {n} findings".
  - Read once per load. Never announced.
- **"Work an idea"** (`HubButton`), which opens the sheet's start view.
- **The research read failed:** "Couldn't check your research" · Retry (the hub's pattern), and the door stays.
- **While loading:** no line, and the door shows.

Outside admission, none of this renders. There are no inactive controls.

### 3.2 The wrapper and the lazy body (the second permitted load-time edge)

- **The loader:** `src/components/CommandCenter/hub/loadSharedResearch.js` holds the one `import()` of `../../SharedResearch/SharedResearchSheetBody.jsx`.
  - The promise is kept, so the chunk is requested once per page, and it is reset on failure. This is `AgentForm/loadEngine.js`'s pattern.
  - The mount guard pins it beside the engine edge. Today's hub graph holds exactly one load-time edge; after this, exactly two.
- **The wrapper:** `src/components/CommandCenter/SharedResearchSheet.jsx`, in the Huddle pattern (`HuddleSheet.jsx`).
  - It renders `HubSheet` (width 720, full on phone) with the hub's title, eyebrow and label strings.
  - The body is a module-scope `React.lazy` over the loader, inside `Suspense` with a loading line.
  - **A failed load** shows a line and **Try again**. Try again starts a fresh import and swaps in a new lazy only once that import has loaded, because React keeps a rejected lazy forever (the hub gate's pattern, `CommandCenterHubGate.jsx`).
  - It passes `overlayStack={useHubOverlays()}` and the props below. It holds no read, effect, timer or listener.
- **The body is not a static terminal of the hub graph:** it sits behind the edge. B2's boundary test names the loader as its one importer (§8).
- **Registration:** `HUB_SHEETS.RESEARCH = 'research'`. It is not in `LEGACY`, because a HubSheet registers itself.
  - The sheet's entry (`mode`, `sessionId`, and `item` later) is held with the open sheet and cleared on close.
  - It is mounted at both shells' sheet sites, beside `HuddleSheet`, only while admitted. If admission ends while it is open, it closes, as the Huddle does.
- **Openers in Part 2:** "Work an idea" (mode `start`), "Continue" (mode `session`) and the Activity rows (mode `session`). O3 adds "Explore this" (mode `item`). Focus returns to the opener (HubSheet).
- **Bundle:** the entry chunk stays byte-identical. The body and its screens load as their own chunk. The hub chunk grows only by the wrapper, the loader, the readers, the selector and the copy.

**The body's props** (B2 report §10; the B2 rulings P-4 and P-5):

| Prop | What the hub passes |
|---|---|
| `open` | true while the sheet is up |
| `mode` | `'start'`, `'session'` (and `'item'` from O3; `'signaldrop'` is reserved for a later shortcut) |
| `item` | null in Part 2; O3's For-you item |
| `direction` | null until W1; then the interests record's typed explore text |
| `sessionId` | with mode `'session'` |
| `stories` | `selectStories(...).items`, `[]` while loading or failed |
| `agentName` | the ranked agent's given name, or null (the body says "your agent") |
| `agentId` | **the ranked agent the Loadout card reads** (`selectors/readerInputs.js` `loadoutAgentOf`), the one the server stamps. Null means "Use it in my next game" is not offered |
| `equippedListLabel` | the equipped BaggerBomb list's name as the Loadout shows it, or null |
| `gated` | `!admitted` (false whenever the sheet is open; the server's `404 disabled` gates the body too) |
| `phone`, `onClose` | as for `HuddleSheet` |

**A terminal note for R-S6-2:** the sheet's service imports a writer (`transitionHypothesis`, for equip) outside the hub directory. R-S6-2's "no writer is imported" covers the hub's own imports.

### 3.3 The research Activity rows

New `ACTIVITY_KINDS.RESEARCH`, built from the research reader's records only:

| Row | When | Time |
|---|---|---|
| "Research opened" · sub: the question, clipped | every `shared_research` record | `createdAt` |
| "Research concluded" | `terminalReason === 'concluded'` | `endedAt` |
| "Idea saved from research" | `terminalReason === 'saved_to_list'` | `endedAt` |

- An abandoned investigation gets only its opened row.
- Each row opens the sheet on that investigation (mode `session`).
- Ids are `research.opened:{sessionId}`, `research.concluded:{sessionId}` and `research.saved:{sessionId}`.
- The rows sit under the same cutoff and order rules as every other kind.

### 3.4 The research next action — deferred

`NEXT_ACTION_KINDS.RESEARCH` ("Continue your research", the **last** rule, Later key `research:{sessionId}`) is not built now. It enters with its own amendment after the allowlist week. F-3 (research ranks last) still governs it then.

---

## 4. The next-action order

For the Huddle chat and every implementer. It replaces the C6 / D5 order line where they differ:

1. **A game in session**: its market session is open (`derivePhase(...) === PHASE.LIVE`; ruling L3-11).
2. **Huddle ready**: S1's candidate, or U2's first Huddle when there has never been a battle and no plan exists.
3. **A game waiting**: `PRE_OPEN` or `LIVE_CLOSED`, in `sortLiveBattles` order.
4. **A review.**
5. **The first deployment**, with the reconfirm door when the approach changed.

Later keys: `openGame:{id}`, `huddle:{etDate}`, `review:{id}`, `deploy:first`. Research (§3.4) joins last, when its amendment lands.

---

## 5. Copy (`hubCopy.js`)

| Key | String | Part |
|---|---|---|
| `research.workTitle` / `.workEyebrow` / `.workLabel` | Work an idea / Shared Research / Shared Research · work an idea | 2 |
| `research.door.work` | Work an idea | 2 |
| `research.door.inProgress(time, n)` | Research in progress · last update {time} · {n} findings | 2 |
| `research.door.inProgressCount(n)` | Research in progress · {n} findings | 2 |
| `research.door.continue` | Continue | 2 |
| `research.door.error` | Couldn't check your research | 2 |
| `research.door.loadFailed` / `.tryAgain` | Couldn't open Shared Research / Try again | 2 |
| `activity.researchOpened` / `.researchConcluded` / `.ideaFromResearch` | Research opened / Research concluded / Idea saved from research | 2 |
| `forYou.eyebrow` | For you | 1 |
| `forYou.byline(reporter)` | FantasyTimes · {reporter} | 1 |
| `forYou.general` | General selection | 1 |
| `forYou.because.explore(chip)` / `.know(chip)` | Because you want to explore {chip} / Because you know {chip} | 1 |
| `forYou.explore` / `.another` | Explore this / Show another | 1 |
| `forYou.unavailable` | Research isn't available yet | 1 |
| `forYou.empty` / `.error` | No stories to explore right now / Couldn't load stories | 1 |
| `activity.agentCreated(name)` / `.interestsSaved` | {name} created / Interests saved | 1 |

`research.disabled` is unchanged. The body pins its own gated line equal to it.

---

## 6. What does not change

- the Loadout (pinned at `8d1c945`, onboarding §4.4);
- the Deploy card, the hold and the attempt vocabulary;
- the Partnership panel and S1's Huddle surfaces;
- the idea surfaces' honest line until Huddle S2's receipt;
- the Forge door;
- the default desktop area;
- the status line as the only live region;
- the Research panel's idea card and its reader (`hub/useHubResearch.js`);
- `SHARED_RESEARCH_MODE` (`'off'`).

---

## 7. Dependencies

| Dependency | State | Blocks |
|---|---|---|
| B1 route (#1048), B2 body (#1059), Huddle S1 | merged | — |
| `researchWork (userId, createdAt desc)` index and owner read | in `firestore.indexes.json` and `firestore.rules` | — |
| Rules for `sharedResearchSessions` and `sharedResearchQuota`; the `researchWork` indexes | **deployment pending** (founder, §11) | the allowlist flip, not Part 2 |
| W1 `playerContext/{uid}` | pending (framework) | Part 1's match, reason, `direction`, Interests saved |
| O1 setup route; U2 first Huddle | pending | Part 1 |

---

## 8. Tests

**Part 2:**
- **Mount guard:** exactly two load-time edges (engine, research body), by path, with planted mutations. The wrapper and the loader hold no read, effect, timer or listener. Each new reader and module outside the directory is a pinned terminal. The body's directory makes one import of `sharedResearchService.js`, and no hub file imports it.
- **B2's boundary test:** the dark rows move. The one importer, and the one string that names the directory, is `hub/loadSharedResearch.js`. The service row is unchanged.
- **Admission:** at `'off'`, no request and nothing renders. At `'on'`, admitted with no request. At `'allowlist'`, one verdict call with an owned agent battle id, then cached. No battle means not admitted, with no request. A false verdict renders nothing.
- **Readers:** no read unless admitted; one read per owner and epoch per load; an owner change resets; a former owner's answer is never shown; Retry.
- **Selector:** eligible types only; the required fields; expired stories dropped; newest first; at most five; the beat's question and the default for an unknown beat; `reason` null with no interests; the item's shape.
- **Panel (jsdom):** an admitted player sees the door and the summary, with and without `lastTurnAt`. Off and not-admitted players see neither. The error line has Retry.
- **Sheet (jsdom):** each opener opens the right mode. Focus returns to each opener. One overlay at a time. The loading line, then the body. A failed load shows its line, and Try again loads it.
- **Activity:** opened, concluded and saved rows; an abandoned investigation has only its opened row; a non-`shared_research` record yields none.
- **Bundle:** the entry chunk is byte-identical, and the body is in its own chunk.
- **Real browser** (Edge, the smoke page): open from the door at 390 and 1280, the body loads, Escape closes, and focus is back on "Work an idea".

**Part 1:**
- The selector's match rows: matched first; no reason without a match; typed text never matched.
- The `composition` / `wideGrid` rows.
- The `nextAction` rows for §2.3.
- jsdom: "Explore this" opens the sheet when admitted and shows its line otherwise; "Show another" makes no read.
- The guards: copy (including "Shadow"), mount and activity.

---

## 9. Founder decisions (defaults in bold)

- **F-1** — **withdrawn** (E-3): the questions are `BEAT_QUESTIONS`, merged with B1. Any wording change is a one-line edit to `src/constants/sharedResearch.js`.
- **F-2:** returning players see For-you **inside the Research area** — **yes**.
- **F-3:** research is the **last** next action, when it is built — **yes**.
- **F-4:** previews and Market Pulse are **excluded** from the selection at Level 0 — **yes**.

---

## 10. The HubSheet focus rescue (its own hub PR, after Part 2)

**What B2's review found (c1):**
- `HuddleSheet`'s Confirm disables while its request runs. Chromium then moves focus to `<body>`, so Escape no longer closes the sheet.
- After a successful confirm the buttons unmount, and even Tab cannot bring focus back.

**The fix:** in `HubSheet`, so it covers every sheet.
- When focus falls to `<body>` while a sheet is open, the sheet's own root takes it.
- This covers two cases: after a render that left focus there (a control unmounted), and on a `focusout` with no destination (a control Chromium blurred after disabling it).
- This is the same pair of keepers the Shared Research body proved.

**The proof is real-browser rows** (jsdom lets the defect pass):
- the Huddle's Confirm, at 390 and 1280;
- one row through a Shared Research step;
- a mutant for each keeper.

---

## 11. Before the allowlist flip (founder steps)

1. `firebase deploy --only firestore:rules` (the `sharedResearchSessions` and `sharedResearchQuota` blocks).
2. `firebase deploy --only firestore:indexes` (the `researchWork` indexes).
3. Part 2 merged.
4. The flip: a one-line founder PR that moves `SHARED_RESEARCH_MODE` to `'allowlist'` and its pin row (`sharedResearchFlags.test.js`). Then the spec §12 allowlist cases on the founder's and FT_QA's accounts.
