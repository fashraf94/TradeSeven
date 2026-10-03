# Phase 0 — Cockpit Build 2 discovery: the screen seams and the Crossroads counts (read-only)

**Date:** 2026-10-02 (ET) · **Runner:** Claude Code (local session) · **For:** the Build 2 spec (Fable), Astra's review, the founder.
**HEAD:** branch `claude/phase0-build2-cockpit`, cut from `main` @ **`c10f03b09aa2efda99e85c258c5b7f85d8c6485c`** (the merge of PR #926), which equalled `origin/main` after `git fetch origin`. Product code on this branch is byte-identical to that SHA; every `file:line` below is at it.
**Inputs read, in order:** `docs/BUILD_RULES.md`; `docs/audits/20261002_DECLARATIONS_WORDING_ROUND3.md`; `docs/COCKPIT_BUILD1A_SPEC_V1_2.md`; `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` and `…_AMENDMENT_B.md`; `docs/audits/20261002_BUILD1A_ANSWER_LOOP.md`; `docs/design/COCKPIT_SPEC_V1_3.md` §5 (which defers to V1.2 §5, which defers to `docs/COCKPIT_SPEC_V1_1.md` §5 — all three read) and `…_AMENDMENT_A.md`; `docs/design/COCKPIT_DESIGN_DIRECTION_V3.md`; `…_V4.md`; `docs/design/COCKPIT_DESIGN_BRIEF_V1_SEP22.md`; `docs/audits/20260923_PHASE0_COCKPIT.md`. All ten exist at HEAD (`git ls-files`); none is missing.
**Markers:** **VERIFIED** — read at HEAD in this session · **ASSUMED** — inferred, not read or not run · **CORRECTED** — an input or an earlier audit says otherwise; the truth follows · **NOT FOUND** — absent at HEAD · **PRODUCTION** — a live value, not verifiable from the tree.

---

## Session preamble (BUILD_RULES §2, §3)

- `git fetch origin` ran first, then `git checkout main && git pull` ("Already up to date"), then `git checkout -b claude/phase0-build2-cockpit`. HEAD at the start: `c10f03b0…`, equal to `origin/main`.
- The tree had six untracked files at the start, none from this task: `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json`, `lifecycle-ogbL.txt`, `tape-0922.md`, `tape-0928.md`, `vwap-exit-dating-census-report.json`. None is committed.
- **First commit = the mockup, alone** (`6bb3d6e7`): the attached `The Cockpit - V4 (standalone).html`, committed unmodified as `docs/design/COCKPIT_V4_MOCKUP.html` — 1,576,941 bytes, LF only, **SHA-256 `97c8794b8b4f9504131d8005c5733e1d83c31cbcfb001a40ad10b86481bdc654`**; the committed blob hashes the same (`git cat-file blob HEAD:docs/design/COCKPIT_V4_MOCKUP.html | sha256sum`). On a `core.autocrlf=true` checkout the working copy turns CRLF; the blob is the pin.
- **Round 3's raw outputs are present** in `experiments/declarations-wording/raw/round3/` (git-ignored, `.gitignore:108`). The round-1 and round-2 results and samples, and every top-level file of round 3, were hashed before any read and re-verified after the last script run: unchanged (round 1 `results.json` `2719fdae…`; round 2 `results.json` `3fb9006a…`, `sample.json` `b808b811…`; round 3 `results.json` `934a37e5…`, `sample.json` `fd8cd0c4…`, `s2.json` `404fc7fd…`). Nothing raw is committed; no round's `analyze`/`select` was re-run.
- **Read-only on the product.** No product source, flag, rule, index or schema changed; no Firestore access; no API call. **Fence (BUILD_RULES §1):** two fenced files were read, never edited — `api/_utils/agentEvalPromptAssembly.js` (the bench renderers, B9) and `api/_utils/agentSwapExecution.js` (how a swap assigns a slot, B2). The branch diff ∩ the fence list = ∅. The new script's static import graph (9 modules: `validate.js`, `horizon.js`, `marketSchedule.js`, `marketCalendar.js`, `captureConfig.js`, `agentEvalToolResultValidation.js`, `agentEvalToolSchema.js`, `archetypeAdjustments.js`, itself) contains no fenced module, and it calls no fenced function.
- **Import-boundary ratchet:** the script imports `src/data/archetypeAdjustments.js`; the ratchet inventories `api/` and `src/` only (`api/_utils/archetypeRegistry.test.js:243-244`), so no baseline entry. VERIFIED.
- **How Part A was read.** Six read-only reader agents took one seam group each (A1–A2, A3, A4+A6, A5+A7, A8+A10, A11), each forbidden to write. The coordinator then re-read 130 of their load-bearing anchors at HEAD — spot checks in every section — and all matched but one line number (the server's `checkLabel`, cited at `copy.js:38`, is at `:55`; corrected in A8). A9 and all of Part B are the coordinator's own work.
- **Review:** the branch is above 1,500 changed lines (the 396-line mockup, the counts script and this report), so the BUILD_RULES §2 review ran — §R.

---

## Executive verdict

| Question | Answer (facts only) |
|---|---|
| **Is anything blocked?** | **No.** Every seam the brief names exists and is located. Three things Build 2 needs **do not exist yet**: `COCKPIT_UI_ENABLED` (in specs only), any client reader of a battle's subcollections, and any chat-line anchor a tile could link to. |
| **A1 Desktop pane** | One module-level tab list (Chat · Bench · Tape), Chat the default in four places, never persisted. A Cockpit default touches the defaults, the unread chain (unread clears only while Chat is visible), four "open Chat" doors, the hand-listed panels and a hand-entered 327 px width budget. |
| **A2 Mobile** | The **page** scrolls: neither the header nor THIS TURN is pinned today. Chat is **already** behind the floating mark (the pane is a full-screen overlay). One tab list serves both shells. No horizontal pager exists anywhere in `src/`. |
| **A3 Styling** | 39 `--ft-*` tokens; no `dim`, no `ink*`, no `--ft-call-*`. V4's 320 ms bezier and 180 ms fade **match no motion token** (spec V1.1 names `smooth`). The Battle View honesty test bans the words **`watching`**, **`malformed`** and `unknown` in every top-level file there. |
| **A4 Client data** | No client reads any battle subcollection today; the nearest live-list pattern is `subscribeClaims`. In the tree an owner can read calls, declarations, receipts and events (whether production carries those rules is unverifiable). The declarations record has `evalSeq` but exists only for checks that declared something. The `said` lint and the answer texts are server-only. |
| **A5 Answers** | No client calls `call-response` yet. The chip precedent shows one error line chosen by HTTP status — reused, it would read every 409 refusal as "the directive changed" and a 429 as "no messages left". The chip route itself answers 404 to everyone today (grounding is `'shadow'`). |
| **A6 Activation** | Nothing returns or stores the resolved mode. A client could recompute it from its bundled constants, but bundle and server deploy separately. Records prove a *past* check ran at shadow-or-on (calls, declarations) or at `on` (events) — never "now" — and shadow-era records already exist while the mode is `off`. Only the endpoint's 404 answers per request. |
| **A7 Research** | The research modal takes a symbol but has no framing or footer slot and is off the token system; the screener has no prefill; Show It is dark. "Answer" needs a calls reader (GAP) and exists only for picks — **a research objective has no answer path**. "Ask in chat" exists and costs 1 of the battle's 10 messages. |
| **A8 Chat ↔ cockpit** | Chat lines are keyed by array index, with no DOM anchor; the one scroll-to-target lands on check cards. No agent-written exchange carries a `callId` (anticipation lines carry an `evaluationId`). A cockpit filing renders today exactly like a chip filing — nothing on the client reads `source`. |
| **A9 Live text** | The `on` text is `TEXT_1A_OVERRIDES` in `agentEvalToolSchema.js`. **The 1A-C port is an exact 12-line diff, proven on a scratch copy to reproduce round 3's 1A-C bytes (`7388755a…`, 13,623 chars).** It moves six pins in `agentEvalToolSchema.build1a.test.js` and would stop round 3's own scripts from re-running. |
| **A10 Flags** | `COCKPIT_UI_ENABLED` **does not exist**. `CALL_RECORDS_MODE = 'off'` (shadow Sep 26 → rolled back Oct 1); `COCKPIT_ALLOWLIST_UIDS = []`; `VOICE_GROUNDING_MODE = 'shadow'`; `DIRECTIVE_FIT_CHECK_ENABLED = false`. **Held-position parity is not built** and has no spec, flag or acceptance definition. |
| **A11 Mockup** | All six V4 screens are there. Every cockpit element is a GAP in `src/` except the shipped surfaces it sits on. "Ask me first", "Keep holding off", research answers, Dials and "Agree for next time" have no Build 1a path; "Held off" and "Asking you" have no state in the record. |
| **B1 Crossroads Tier 1** | 15 of 386 calls (3.9 %) name two incoming names for one slot as defined — but 10 of the 15 count an *entry on a name already held*. **Excluding held names: 5 of 386 (1.3 %)**, all two separate exits in one tier; **none offers two names for the same outgoing position.** |
| **B2 Tier 2** | `anticipationCandidates` carry **no slot or tier field** (0 of 482); 32 % name a tier only in prose. A swap's incoming name takes the outgoing name's slot, so any bench name can fill any slot: **18 of 386 calls (4.7 %)** name ≥ 2 bench entry candidates. |
| **B3 Prose alternatives** | 15 of 324 kept `said` lines (4.6 %) name alternatives ("NVDA or INTC"); the typed counterpart is one of them in 2 of the 15; 13 have no typed counterpart at all. |
| **B4 Stray keys** | A top-level `watching` list appears on **242 of 386 calls** (225 non-empty) — while the typed `declarations.watching` is non-empty on **2**. 0 % symbol overlap with it; 16 % with the candidates. Top-level `fork`/`playerAsk` are always null. |
| **B5 Counterparts** | 21 of 90 typed counterparts (23 %) are outside the check's universe: `TBD` 7, `entry` 6, `N/A` 4, `undecided` 2, and two "X or Y" strings. |
| **B6 Repeats** | 28 of 316 kept calls (8.9 %) repeat the previous sampled check's call; 160 of 180 sampled pairs are consecutive evaluations. |
| **B7 Mix** | 324 kept calls: exit 218 · entry 106; **58 of the 106 entries are on names already held**; hold 187 · act 137; contrarian 20 rows. |
| **B8 Research seeds** | 165 of 218 exit calls (76 %) name no usable replacement (151 name none): **6.35 per battle-day** (median 5.5, range 1–18). |
| **B9 Tier 3** | Of the 16 menu directives: **3 feasible** as a bench filter (TF-07, CN-04, CN-06), 6 partial, 7 not (exit, stop, sizing or history rules). The detail fields (RSI, RVOL, relative strength) are on 9.8 % of bench rows; `mcap` is `large` on 97 %. |
| **B10 Calls per declaring check** | Of 142 declaring calls: 1 call 21 · 2 calls 71 · 3 calls 39 · 4 calls 11 (none above 4). |
| **Anything needed from you?** | Answers to the open questions at the end (in plain terms). This report makes no design recommendation. |

---

## Part A — screen seams (every claim at `c10f03b0`)

### A1 Desktop: the right pane (Chat · Bench · Tape)

- **The tab list and its state.** The sections are a module constant — `PANE_SECTION` (`src/screens/battleView/useCharacterPane.js:39-43`) and the ordered `PANE_SECTIONS` (`:45-49`), Chat first (`:46`) — with no shell or flag input. The selected tab is local hook state: `useState(PANE_SECTION.CHAT)` (`:77`), reset to Chat when the pane is disabled (`:127-132`) and read as Chat while disabled (`:148`); `openPane` accepts only a listed section (`:97`, via `isPaneSection` `:52-54`); `close()` keeps the section (`:108`). It is never persisted: no storage API in the Battle View, and the screen says so (`src/screens/AgentBattleScreen.jsx:1398-1399`). The one call site passes no default section: `useCharacterPane(paneOn, { lockScroll: !isDesktop, openByDefault: isDesktop })` (`AgentBattleScreen.jsx:611`). VERIFIED.
- **The tab strip.** `SegmentedControl` (`src/screens/battleView/CharacterPane.jsx:119-178`) takes `{ section, onSelect }` and maps the imported list (`:146`): `role="tablist"` (`:133`), `role="tab"` with a roving `tabIndex` (`:152-160`), arrow/Home/End keys (`:120-129`). Selection is a teal background swap (`:168-169`) — **no sliding thumb** (no `motion` or `layoutId` in `:119-178`). Labels: `SECTION_LABEL` (`:60-64`) over `battleViewCopy.js:752-754`. Panels are three hard-coded `panel(…)` calls (`:388-390`), each `hidden={s !== section}` (`:234`) — hidden, never unmounted. VERIFIED.
- **The width budget a fourth tab enters.** The header row (`:274-384`) is face · name · archetype (only when `showArchetype`, `:338`) · controls (`:359-383`: tabs, overflow, collapse). `PANE_HEADER_FIXED_PX = 327` (`:93`; comment "28 padding + 36 face + 20 gaps + 243 controls", `:92`) feeds `ARCHETYPE_MIN_VIEWPORT_PX = ceil((327 + 141) / 0.4) = 1170` (`:96-109`), the width at which the screen shows the archetype (`AgentBattleScreen.jsx:523`, `:2010`). The 243 px is a hand-entered comment; the only test recomputes the formula from the same constants and cannot see a stale figure (`AgentBattleScreen.paneHeader.jsdom.test.jsx:234-241`; jsdom does no layout). A fourth tab adds its label width plus ~22 px to the controls and moves the archetype threshold by 2.5× that (ASSUMED arithmetic; no layout run). VERIFIED except where marked.
- **Resize behavior.** Desktop is `useMinWidth(768)` over `matchMedia` (`AgentBattleScreen.jsx:159-174`, `:517`). The pane renders under two different parents — the desktop column (`:2458-2481`) or the mobile overlay (`:2686-2723`) — so crossing 768 px live mounts a fresh pane and chat (ASSUMED from React reconciliation; no test drives a live crossing). On desktop the pane collapses (`pane.close()` from the header button, `:2008`, `:1427`; the column goes `display: none`, `:2478`) but is not resizable or draggable (no resize or drag handler outside the pane-off `ChatSheet.jsx:182`). Untouched, it opens on desktop (`useCharacterPane.js:119-122`) and stays open when the window narrows to a phone (`useCharacterPane.test.jsx:192-199`); the remembered section carries across shells. VERIFIED except where marked.
- **What a Cockpit default touches (every line keyed on Chat).** The defaults `useCharacterPane.js:77`, `:130`, `:148` and `CharacterPane.jsx:191`. **The unread chain:** `chatOpen = pane.open && pane.section === PANE_SECTION.CHAT` (`AgentBattleScreen.jsx:614-616`) → `chatVisible` (`:1072`) → the seen-marker effect runs only while Chat is visible (`:1711-1714`) → `paneUnread` (`:1729-1738`) → the mark's badge (`:1986`). **Four doors force Chat** — Read the full check (`:1229`), Ask a follow-up (`:1250`), In the chat · n (`:1382`), the bubble (`:1423`) — while the mark opens the remembered section (`:1414`). **Hand-listed wiring:** `SECTION_LABEL` (`CharacterPane.jsx:60-64`), the panels (`:388-390`), the props (`:180-200`), the mount (`AgentBattleScreen.jsx:2012-2024`), the copy (`battleViewCopy.js:752-754`). With Cockpit as the default, `chatOpen` is false at first paint, so unread does not clear until the player opens Chat, and on desktop the badge shows only while the pane is collapsed (`:2449`) (ASSUMED from these lines). VERIFIED.
- **Tests that pin the list and the default.** `AgentBattleScreen.pane.jsdom.test.jsx:450` (`['Chat', 'Bench', 'Tape']`), `:459`, `:965-969` (desktop opens on Chat), `:1237`, `:1280-1310` (unread clears only on Chat); `useCharacterPane.test.jsx:45-49`, `:95` (the `PANE_SECTIONS` order), `:148-155`, `:171-177`. **CORRECTED** (Sep 23 audit §8.2): `showItDoor.jsdom.test.jsx` does not pin the tab list — it renders `PaneBench` alone (`:80`). No pane-on HTML golden exists; both goldens mock the pane off (`__golden__/captureControllerOnGolden.test.jsx:61`, `captureFlagOffGolden.test.jsx:47`). VERIFIED.

### A2 Mobile

- **The layout today, top to bottom.** The root is `minHeight: '100vh'` on a phone (desktop gets `height: viewportHeight`) (`AgentBattleScreen.jsx:2098`); then the top section — back bar (`:2131-2156`), `ArenaHeader` (`:2252-2266`), the Why? panel when open, banners — in a block that is `zIndex: 3` and not sticky (`:2123-2129`); then the layout row (`:2333-2377`) and the board column, `flex: '1 1 auto'` (`:2401`) with `paddingBottom` 96 px for the mark (`:2410`, `AVATAR_CLEARANCE_PX` `:183`). The column's inner block has **no scroller on mobile** (`:2428`) and holds `ThisTurnStrip` (`:2431`), the board rows and the closed trades. **The page scrolls.** **Neither the header nor THIS TURN is pinned on a phone today**; the only sticky elements are the tier headers (`:199-201`). On desktop the header stays put because the root is viewport-high and the board has its own scroller (`:2427`), and THIS TURN scrolls with the board. VERIFIED.
- **Chat behind the floating mark — already the shipped behavior.** With `BATTLE_VIEW_CONTROLLER_ENABLED = true` (`src/config/featureFlags.js:2142`) and `BATTLE_VIEW_CHARACTER_PANE_ENABLED = true` (`:2204`; `isCharacterPaneOn()` `:2213-2215`), the phone renders no chat sheet. The mark (`CharacterAvatar.jsx`, `position: fixed` on mobile, `:143`; placed at `AgentBattleScreen.jsx:2704`) opens the pane as a **full-screen overlay** (`:2705-2722`: fixed, inset 0, z-index 40) over a dimmed board (`:2346`), body scroll locked (`useCharacterPane.js:142`). A tap on the mark opens the remembered section (`:1414`); a tap on its bubble opens Chat (`:1423`). The badge counts non-user tape entries since Chat was last visible (`:1729-1738`). The pane-off bottom sheet (`ChatSheet.jsx`) is not live. VERIFIED.
- **One tab list for both shells.** The same `characterPane` element is placed by either shell (`:2480`, `:2721`); `CharacterPane` has no `sections` prop and maps `PANE_SECTIONS` (`:146`). V4 keeps Chat · Bench · Tape behind the mark on mobile, so the list must become shell-aware; a remembered section missing from the rendered list would show no panel at all, because nothing repairs it (ASSUMED from `:234`, `:121-122`). Precedents for a computed list: `SearchDiscover.jsx:24` (flag-conditional) and `BackingDesk.jsx:67-72`, repaired in `BackingScreen.jsx:143-148`. VERIFIED.
- **A Board ⇄ Cockpit swap.** **No two-screen horizontal pager or translating track exists in `src/`** (NOT FOUND). Native scroll-snap carousels exist outside the Battle View, e.g. `ArchetypePicker.jsx:259-287` (`scrollSnapType: 'x mandatory'` `:265`, `touchAction: 'pan-x'` `:266`). **CORRECTED** (Sep 23 audit §8.5): one framer `drag="x"` does exist, a slide-to-remove chip (`src/components/Forge/Watchlist/TickerChip.jsx:76`), present at that audit's SHA too. Sliding thumbs via `layoutId` exist outside the Battle View, all with raw transition literals (`SeasonModeToggle.jsx:45-46` and three others). **No segmented control in `src/` carries a count**; count precedents are the mark's numeric badge (`CharacterAvatar.jsx:287-311`, the count in its accessible name `battleViewCopy.js:735-739`) and label-with-count copy (`Bookmarks · n`, `battleViewCopy.js:822`). VERIFIED.
- **The THIS TURN row** (`src/screens/battleView/ThisTurnStrip.jsx`, 105 lines). A column (`:38-48`); the label row `:49-57` has one child, `{COPY.thisTurn}` (`:56`); the empty state is `{COPY.nothingQueued(turn?.nextDecisionAt ?? null)}` (`:100`) → "Nothing queued · next check ~{t}" (`battleViewCopy.js:550-553`), with `nextDecisionAt` = last scored + 15 min (`deriveTurnLine.js:14-15`, `:138-141`). The right end of both the label row and the empty line is free (single-child blocks). V4 §2 puts the pills on the "Nothing queued · next check" line (`COCKPIT_DESIGN_DIRECTION_V4.md:18`). The strip is built at `AgentBattleScreen.jsx:1742-1749` and rendered once inside the board column (`:2431`). A test pins its absolute `<div` count (`ThisTurnStrip.render.test.jsx:153-160`) and bans words including `watching` (`:99-102`). **No "Prices as of" line exists anywhere in `src/`** (NOT FOUND); the header's turn line says "Checked {last} · next ~{next}" (`src/components/Dashboard/desk/deskCopy.js:149`). VERIFIED.
- **Reduced motion.** Framer's `useReducedMotion()` (latched at mount) becomes a `reducedMotion` prop (`AgentBattleScreen.jsx:540-541`) passed to the pane, header, mark and chat; `motionToken(name, { reducedMotion })` returns `instant` (`src/theme/motion.js:155-163`); `src/index.css:549-560` cuts every CSS transition and animation to 0.01 ms under reduced motion. VERIFIED.

### A3 Styling

- **Colour tokens.** 39 `--ft-*` tokens in one unlayered `:root` (`src/theme/tokens.css:42-213`), published in `src/theme/tokenBaseline.json` (23 hex, 9 rgb triplets, 7 aliases; pinned in `src/theme/cssTokens.test.js:77`, `:107-108`, `:129-132`). Bridge: `cssVar` (`src/theme/cssTokens.js:168-170`), `readToken` for Framer Motion (`:183-191`), `readTokenRgb` (`:212-220`). Semantic tier: `--ft-accent`, `--ft-warp-tint`, `--ft-success` (emerald), `--ft-danger` (red), `--ft-warning` (amber), `--ft-game-baggerbomb`, `--ft-game-draft` (`tokens.css:202-212`). Bases exist for purple (`:135`), emerald (`:123`), gold (`:147`, no `-rgb`), copper (`:155`) and muted text (`:109`); **there is no "dim", no `ink*` and no hairline token** (hairlines compose `rgba(var(--ft-scrim-rgb), .07 / .12)`, e.g. `ChatSheet.jsx:155`, `:176`). The shipped player colour is **teal** and the CPU's is **copper** (`ArenaHeader.jsx:13-17`, `:82-83`; pinned `ArenaHeader.render.test.jsx:118-131`). **No `--ft-call-*` token exists** (zero hits in `src/` and `api/`). VERIFIED.
- **Motion tokens.** Six locked names in `src/theme/motion.js`: `snappy` spring 300/25 (`:103`), `fade` 0.2 s (`:106`), `smooth` 0.3 s easeOut (`:109`), `bouncy` (`:112`), `gesture` (`:124`), `instant` 0 s (`:127`); accessor `motionToken` (`:155-163`); the LOCKED table (`motion.test.js:37-44`) fails on a seventh name (`:54`, `:95`). **V4's 320 ms `cubic-bezier(.2,.9,.2,1)` and 180 ms cross-fade match no token**, and the bezier appears nowhere in `src/`. Spec V1.1 §5 names `motionToken('smooth')` for the slide and `instant` for reduced motion (`docs/COCKPIT_SPEC_V1_1.md:108`). VERIFIED.
- **`GUARDED_FILES`.** `src/theme/tokens.guard.test.js` (`:52-100`, 39 entries) and `src/theme/motion.guard.test.js` (`:57-103`, 36 entries) both list all 35 non-test files of `src/screens/battleView/`, and both scan that directory and fail when a new top-level file is missing from the list or its baseline (`tokens.guard.test.js:193-209`; `motion.guard.test.js:148-164`). A new cockpit file there joins both lists and both baselines in the same commit; the motion entry needs a hand-written authority (a regenerated `UNTAGGED` fails `motion.guard.test.js:189-203`). The scans are not recursive, so a subdirectory would be invisible to them (ASSUMED from the `readdirSync` filters). `AgentBattleScreen.jsx` itself is on neither list. VERIFIED except where marked.
- **The forbidden-terms and honesty tests.** `src/components/Dashboard/desk/deskHonesty.test.js` scans **every top-level non-test file in `src/screens/battleView/` automatically** (`:84-104`; asserted `:247-249`), whole-word and case-insensitive, identifiers included (`:207`). Its bans include **`watching`** (`:107`), `eyeing`, `considering`, and **`malformed`** and **`unknown`** (`:129-150`). V4's "👁 WATCHING" header, the declarations field `watching`, and spec V1.2's `useDeclarations` state `malformed` (`docs/design/COCKPIT_SPEC_V1_2.md:131`) all collide with it. Component-tied bans: `ThisTurnStrip.render.test.jsx:100-102`, `AgentBattleScreen.controller.test.jsx:199-201`, `WhyPanel.render.test.jsx:424-426`, `AgentChat.receipts.render.test.jsx:95-97` (`Holding`, `Declined`, `Honored`, `Superseded`). On the server, the `said` lint (`api/_utils/callRecords/copy.js:256-258`, label "agent's own wording (unverified)" `:261`) has no non-test consumer at HEAD, and `copy.js:201` renders "Superseded by a later filing" — a word `battleViewCopy.js:23-24` lists as unproven for the Battle View. The "not seen by the agent" header is pinned and walked repo-wide (`src/data/intradayDiagnosticCopy.js:17`; `intradayDiagnosticCopy.test.js:95-118`). VERIFIED.
- **How derived state-accent tokens get added.** One commit ever added aliases — `6c37ae93`, the Task 1 substrate, with its pins in `e51e17c0`; the only later addition is copper + `-rgb` (`b171c537`), which moved `cssTokens.test.js`'s counts (37 → 39; 22/8 → 23/9) and both guard lists in the same commit. A new alias needs `tokens.css` and `tokenBaseline.json` entries, a row in the `SEMANTIC` table and the alias count (`cssTokens.test.js:42-50`, `:129-132`), and the 39 pin (`:77`). VERIFIED (`git log -S` and reads).
- **The V4 state colours against shipped conventions.** "your call" and "held off" are both purple in V4 (`COCKPIT_DESIGN_DIRECTION_V4.md:32`), but no Battle View file uses purple and the player is teal; "dropped" is copper, the CPU's colour (`tokens.css:149-154`); "expired dim" has no token. Spec V1.1 §5 maps differently: "teal for filed/held, emerald acted, gold asking, muted expired, warning dropped" (`docs/COCKPIT_SPEC_V1_1.md:111`), and `--ft-warning` is amber, which the Battle View already uses for failure states and the pending-proposal dot (`TapeCards.jsx:63-65`; `AgentBattleScreen.jsx:2554`). VERIFIED.

### A4 Client data

- **No client reads a battle's subcollections live.** The Battle View's data is one whole-document listener: `onSnapshot(doc(db, 'agentBattles', id))` (`src/hooks/useAgentBattle.js:26-28`), spread whole (`:32`), unsubscribed on unmount (`:46`), with no flag or `enabled` input. In all of `src/` the only reads of an `agentBattles/{id}/…` path are two one-shot `getDoc`s — `intradayViews` (`src/screens/battleView/useIntradayView.js:31`, "Never a subscription" `:4`) and `tape` (`src/utils/reviewAvailability.js:91`, behind `FILM_ROOM_V2_ENABLED = false`). Nothing on the client reads `calls`, `declarations`, `callEvents` or `callObservations`. VERIFIED.
- **The closest patterns for `useCalls` / `useDeclarations`.** A live subcollection list: `subscribeClaims` (`src/services/tournamentGroupService.js:104-116`) — `query(collection(db, …, groupId, 'claims'), orderBy('createdAt', 'desc'), limit(20))`, `onSnapshot`, the unsubscribe returned; used by `useArenaModel.js:67-72`. A gate that tears the reader down when off: `useIntradayView.js:26-41` (gate inside the effect, returns `null` when off), `src/hooks/useMasteryProfile.js:29-56` (lazy Firebase import on the lit path, unsubscribe on teardown, `null` when the flag is off), `useLiveComposites.js:31-49`. Client gates are read through accessors at render, never the bare constant (`featureFlags.js:2427-2430`). VERIFIED.
- **What an owner can read, per the rules in the tree.** The battle document: owner read (`firestore.rules:451-453`); the client may update only ten keys, none of them `cronState`, `evaluations`, `directive` or `chatExchanges` (`:456-459`). Beneath it, `declarations` (`:485-489`), `calls` (`:490-494`), `callObservations` (`:495-499`), `callEvents` (`:506-510`) and `intradayViews` (`:470-474`) each allow a read when the **parent battle's** `ownerId` is the caller (a `get()` on the parent) and deny every write; other users are denied (`test/rules/callRecordsRulesSuite.mjs:121-136`, which also lists each collection ordered by the single field a Build 2 client would use: `calls` `mintedAt`, `declarations` `evalSeq`, `callEvents` `at`, `callObservations` `observedAtMs`). `callSweepQueue` and `callSweepState` are server-only (`:972-974`, `:979-981`). **Whether production carries these rules is PRODUCTION** — Build 0 and Build 1a list their publication as a manual deployment step (`docs/audits/20261002_BUILD1A_ANSWER_LOOP.md:455`). VERIFIED (tree).
- **Indexes.** `firestore.indexes.json` declares two `calls` composites (`state ASC, mintedAt ASC` `:579-596`; `state ASC, mintedAt DESC` `:597-614`) and none for `declarations`, `callEvents` or `callObservations`. A query ordered by one field (`mintedAt`; `evalSeq` descending with `limit(1)`; `at`) needs no composite; an equality on one field plus an order on another does (ASSUMED Firestore semantics; it matches the spec's "no composite index", `docs/design/COCKPIT_SPEC_V1_2.md:100`). Production index state: PRODUCTION.
- **Every field a tile needs, and where it lives** (S = written at shadow, O = written at resolved `on`):

| Tile need | Document · field | Writer (`file:line`) | When |
|---|---|---|---|
| Which tile (shot · confirmation · two-way) | `calls/{callId}` · `kind` (`called_shot`, `confirmation`, `pick`) | `api/_utils/callRecords/candidate.js:147` (`composeCall` `:141-174`), created once `publish.js:186-188` | S, O |
| The plain line | `symbol`, `direction`, `slot`, `counterpart`, `condition {side, level}`, `horizon {phrase, expiresAt, basis}`; picks: `slot`, `swapOut`, `options[{symbol, why}]` | `candidate.js:152-158` | S, O |
| The default ("If you say nothing · …") and the legal answers | `defaultAction` (`act`/`hold`; null on a pick) | `candidate.js:159`; legality `call-response.js:111-129` | S, O |
| The agent's own words | `said` (≤ 280 chars), shown only if it passes the lint | `candidate.js:160`; lint `copy.js:256-258` (server-only) | S, O |
| The state tag | `state`, `stateChangedAt`, `stateSource` | mint `candidate.js:165-167`; flips `flip.js:233-235` (S, O); sweep `sweep.js:204` (O) | S, O |
| "Your call filed" · "Waiting · one call at a time" | `playerResponse`, top-level `directiveThreadId`, `refused` | `call-response.js:238-240`, `:262-266`, `:300-301` | O |
| "Acted" | `outcome.actedEvalId`, `outcome.receiptRef` | `flip.js:228-232`; `heard.js:134`; `sweep.js:204` | S, O / O |
| The pick the player chose | **not on the call**: the directive record's `action.pickSymbol`, and the answered event's id and text | `threads.js:33-37`; `events.js:38-40`; `copy.js:142-147` | O |
| Receipts history (Filed → Heard → Acted) | `callEvents/{eventId}` `{kind, at, callIds, text, saidOk, evidence {evalId, promptBuiltAt, checkLabel}, promptDirectiveThreadId?}` | `events.js:66-83`; writers `publish.js:190-216`, `call-response.js:239-241`, `:307-308`, `heard.js:130-138`, `flip.js:245-249`, `sweep.js:211-215`, `directiveWriter.js:93-111` | **O only** |
| The price check behind a hit or expiry | `callObservations/{callId}` `{callId, evalId, observedAtMs, px, source, replacedInPrompt}` | `receipt.js:35-46`; `flip.js:231`; `sweep.js:203` | S, O / O |
| Monitoring · Research objective | `declarations/{evalId}` · `watching` (≤ 6 symbols), `playerAsk {question, options[2..4], symbol?}` | `candidate.js:221-229`; `publish.js:185` | S, O |
| The citation ("from the 1:30 check") | a call's `evidence.priceAsOf` (= the check's `promptBuiltAt`) or `evalId` → `evaluations[].promptBuiltAt`; an event's `evidence.promptBuiltAt` / `checkLabel` | `candidate.js:128-131`; `agent-evaluate.js:3983` | S, O |
| The vintage line ("Prices as of … · checks at ~…") | prices: the check itself (`vintages.quote: 'tick'`) → its `promptBuiltAt`; next check: `scoreState.lastScoredAt` + 15 min | `tickStamps.js:267`; `src/adapters/baggerbombAdapter.js:40`, `:322-338` | — |

  Facts that bear on the readers: the declarations record carries **`evalSeq` and `mintedAt`** (`candidate.js:224-225`) but no `promptBuiltAt` and no mode field; it is written **only for checks that declared something** (`candidate.js:249-252`), so `orderBy('evalSeq', 'desc').limit(1)` returns the latest *declaring* check, not the latest check; a fully malformed block leaves no record (its reasons survive only in `cronState.callsDiag.removed`, latest check only, `publish.js:274`). `callId` is `${battleId}:${evalId}:call:${n}` (`candidate.js:44-47`). VERIFIED.
- **Server-only pieces.** The `said` lint (`copy.js:256-258`) and the canonical answer texts (`callActions.js`, "SERVER ONLY", `:4`) have no client copy (no `saidPassesLint`, `renderCallLine`, `deadlineText` or `checkLabel(` in `src/`). About 20 non-test `src/` files already import Node-clean `api/_utils/*` modules (e.g. `src/data/characterState.js:32-33`), none of them under `api/_utils/callRecords/`; BUILD_RULES §4 speaks only to `api/` → `src/` (`docs/BUILD_RULES.md:64-68`). The call-records modules' import graphs use no Node-only API (ASSUMED that they bundle cleanly; no build of such an import was run). VERIFIED except where marked.

### A5 Answers

- **The chip's authenticated path — the precedent.** Two clients post to `/api/agent/file-directive`: the Battle View chat (`src/components/Agent/AgentChat.jsx:1070`) and the League arena (`useArenaEngine.js:138`, through `fetchWithAuth`). The chat takes the token inline — `getAuth().currentUser`, `await user.getIdToken()`, `Authorization: Bearer …` (`:1064-1073`) — and sends `{ agentId, battleId, adjustmentId, expectedDirectiveThreadId }` (`:1076`), the belief being `battle.directive.directiveThreadId` off the subscribed document (`:654-656`; passed at `AgentBattleScreen.jsx:1939`). There is no optimistic receipt (the Filed line arrives through the listener, `:1053-1057`, `:1086-1088`) and no retry (`:1060`); a failure shows **one line chosen by HTTP status alone** — the response body is never read (`:1078-1082`). The server verifies the Firebase token (`requireAuth` → `verifyIdToken`, `api/_utils/authMiddleware.js:52-62`) and does everything in one transaction. **At HEAD the chip route answers 404 to every caller**: it is gated on `getVoiceGroundingMode(uid) === 'on'` (`api/agent/file-directive.js:176-178`) and grounding is `'shadow'`. VERIFIED.
- **`POST /api/agent/call-response` as built** (`api/agent/call-response.js`): an IP limiter (20 per 60 s, `:159`) → 405 → `requireAuth` → body checks → **a per-battle limiter keyed `${uid}:${battleId}` (20 per 60 s, `:87`, `:192-194`), before any read** → one transaction → the status switch. It returns `200` (filed `{ callId, playerResponse, directiveThreadId, event, directive, remaining }`, ack, or repeat, `:330-336`); `400` with `error` ∈ `invalid_request` (`:171-190`), `deferred` (ask/keep, `:174-176`), `unknown_call`, `illegal_answer`, `ineligible_action`, `agent_binding` (`:318-325`); `403 forbidden` (`:316-317`); **`404 cockpit_unavailable`** when the parent is missing or resolves to anything but `on`, before any call is read (`:204`, `:208`, `:314-315`); **`409 { error: 'refused', reason }`** (`:156`, `:326-329`) for `already_answered`, `expired`, `parent_not_active`, `belief_mismatch` (+ `currentDirectiveThreadId`), `directive_pending` (+ `pendingDirectiveThreadId`, `pendingCallId`; the only refusal also written to the call, `:262-267`) and **`budget`** (`:279`, `:286`); and **`429 rate_limited`** (`:192-194`). Both limiters live in memory per function instance (`:48-49`, `:94`; `api/_utils/rateLimit.js:4-5`, `:11`). VERIFIED.
- **How each would reach the player.** **No client code calls call-response** (zero hits in `src/`). If the cockpit reused the chip's status-only mapper `filingFailureLine(status)` (`src/data/decisionRecord.js:786-791`): **every 409 reason** — `directive_pending`, `expired`, `budget` included — would read "The current directive changed before this could be filed — nothing was filed." (`:673`); **429** would read "No messages left to file with — nothing was filed." (`:674`), although call-response signals budget as a 409 and uses 429 for rate limiting; **404 `cockpit_unavailable`** would read "That option is no longer on the menu — nothing was filed." (`:675`); **400** would fall through to "The directive could not be filed just now." (`:676`). The spec's "Waiting · one call at a time" for `refused` (`docs/COCKPIT_SPEC_V1_1.md:109`) is NOT FOUND in `src/`. Errors render as one inline red line above the budget row, without `role` or `aria-live`, cleared by the next send (`AgentChat.jsx:648`, `:1581-1590`). **GAP:** no copy keyed to a 409 `reason` exists. VERIFIED.
- **The belief value is available.** `battle.directive` (with `directiveThreadId`) is in the client snapshot, because the whole document is spread (`useAgentBattle.js:32`), and it is owner-readable (`firestore.rules:451-453`); the client cannot write it (`:456-459`). VERIFIED.

### A6 Activation

- **The resolver, and why a client could recompute it — but not verify it.** `resolveCallRecordsMode(battle)` (`api/_utils/callRecords/mode.js:72-77`): global `off` or `shadow` → that mode; global `on` → `on` only when `battle.ownerId` is in `COCKPIT_ALLOWLIST_UIDS`, else `off`. Its inputs are two constants in `src/config/featureFlags.js` (`:2826`, `:2852`) and the owner id. That module **is in the client bundle** (`featureFlags.js:2316`; 71 non-test `src/` importers, e.g. `AgentBattleScreen.jsx:17`) and the owner's battle snapshot carries `ownerId`, so a client could compute the same answer from its bundled constants. But the bundle a player is running and the server constants actually deployed are separate artifacts of one Vercel project (`vercel.json:2-7`; `package.json:8`), and whether they agree at a given moment is PRODUCTION; importing the allowlist into client code would also put its uids in the bundle (ASSUMED as to tree-shaking). VERIFIED except where marked.
- **Nothing returns or stores the resolved mode.** No API route returns it (chat's response `mode` key is the chat mode, `api/agent/chat.js:483-488`); the in-memory `__callsMode` and `__checkInstantMs` are non-enumerable and never persisted (`mode.js:94-101`; pinned `mode.build1a.test.js:146-153`). A precedent for a server-resolved, per-viewer gate exists elsewhere: `GET /api/backing/lit` returns `{ lit }` (`api/backing/lit.js:42`), consumed by `useBackingLit` ("THE CLIENT NEVER DECIDES", `useBackingLit.js:11-17`). VERIFIED.
- **Server-written signals an owner can read (rules in the tree), and what each does not prove:**

| Signal | Written at | Proves | Does not prove |
|---|---|---|---|
| `evaluations[i].declarationsPhase` (`agent-evaluate.js:4154-4157`) | shadow, on | that check resolved shadow or on | shadow vs on; the mode now; anything beyond the last 150 entries |
| `cronState.declarationsPhase`, `cronState.callFlips` (`publish.js:346-347`, `:410`; `flip.js:411-412`) | shadow, on | the latest such check ran the calls hooks | shadow vs on |
| `cronState.callsDiag.heard` (`publish.js:276-277`, `:399-406`) | **on only** | the latest model check ran at resolved `on` | the mode now (the next check overwrites it) |
| a `declarations` or `calls` document | shadow, on | some check declared at shadow or on | shadow vs on (records carry no mode); the mode now |
| an on-only call field (`playerResponse`, `refused`, `stateSource: 'sweep'`) or **any `callEvents` document** — every event writer gates on `on` (`publish.js:334-337`, `flip.js:409`, `heard.js:172`, `sweep.js:395-396`, `call-response.js:208`, `directiveWriter.js:111`) | **on only** | a transition committed while the battle resolved `on` | the mode now: removing the owner from the allowlist, or a rollback, freezes the records in place (`featureFlags.js:2817-2818`) |
| `404 cockpit_unavailable` from call-response (`call-response.js:204`, `:208`, `:314-315`) | per request | for the owner, that the deployed server resolves this battle to something other than `on` right now | — (with a real call id at `on`, the same request can write) |

  **Shadow-era records already exist in production.** The Sep 26 – Oct 1 shadow window left records "frozen in place" (`4d8c498f`); the shadow read counted 9 calls, 4 declarations records, 9 receipts and `declarationsPhase` on 166 entries (`docs/audits/20261001_CALL_RECORDS_SHADOW_READ_1.md:33`, `:100-103`). So existence signals are already true on some battles while the mode is `off`. No `callEvents` can date from that window (events are written only at `on`, and Build 1a merged later). VERIFIED (tree and docs); live counts PRODUCTION.

### A7 Research

- **`AssetResearchModal`** (`src/components/draft/AssetResearchModal.jsx`, 1,335 lines). 17 props (`:82-107`) — `asset`, `onClose`, `defaultTab`, `defaultTimeframe`, `wsPrice`, `realtimeExtremes`, `version`, `isGameContext`, `showActionButton`, **one `actionConfig` button slot** (`:99`; rendered only when `showActionButton`, `:1200`; its `onClick` receives the DOM event, not the asset, `:1237-1271`) and draft-only props. **No `context`, `framing`, `footer` or `children` prop.** A portal (`:358`) at z-index 1100/1101, full-viewport only at ≤ 430 px (`:339-347`; `useIsMobile.js:70`), otherwise a centred 90vw × 90vh panel; no Escape handler, no scroll lock; **not token-guarded** (39 lines carry a six-digit hex; no `--ft-` use; `HOLO_COLORS`, `:3`). The Battle View mounts it once (`src/screens/AgentBattleScreen.jsx:2761-2772`: `defaultTab="baggerbomb"`, `defaultTimeframe="bomb"`, **`showActionButton={false}`**, no `actionConfig`) from `researchAsset` state (`:555`), set by `handleSymbolClick` (`:1118-1124`), which the board row, the trade card and the chat's ticker spans call (`TacticalRow.jsx:344-347`; `TradeTickerCard.jsx:67-68`, `:83-84`; `AgentChat.jsx:422`). Nothing under `src/screens/battleView/` opens it. VERIFIED.
- **The screener** (`src/components/Search/SearchDiscover.jsx`, a whole screen at `src/App.jsx:9756`; `ScreenerView.jsx`, prompt-driven `POST /api/screener/chat`, `:106-110`) has **no prefill prop** — `initialSymbol`, `initialQuery`, `prefill` NOT FOUND. VERIFIED.
- **`isShowItOn()`** = `isBattleViewControllerOn() && SHOW_IT_ENABLED` (`featureFlags.js:2435-2437`), with `SHOW_IT_ENABLED = false` (`:2420`; `DARK_BY_DESIGN`, `flagPinGuard.test.js:123-124`) — not a grounding gate (`:2395`). Its route, `POST /api/agent/research { agentId, battleId, symbol }`, answers 404 after auth while dark (`api/agent/research.js:226`), caps at 3 per battle (`src/data/researchCap.js:36`), appends a code-composed card to `chatExchanges` (`:354`, `:407-428`) and **charges no message** (`:34-37`). Doors: the Why? panel (`WhyPanel.jsx:616-643`) and the Bench pane (`PaneBench.jsx:88`); the card's "Equip" door renders only with an `onEquip`, and no caller passes one (`ResearchCard.jsx:122-142`; `AgentChat.jsx:425`). VERIFIED.
- **What the "answer" outcome would need.** The call-response body needs `battleId` (available), `callId`, `answer: 'pick'` (legal only on a `pick` call, `call-response.js:113-114`), `pickSymbol` (one of the call's `options[].symbol`) and `expectedDirectiveThreadId` (available from the snapshot). **GAP:** `callId`, `kind` and `options` reach the client only through a `calls` reader, which does not exist; the modal knows only the symbol it shows and passes nothing to `actionConfig.onClick`. **A research objective has no answer path at all:** `playerAsk` is not a call (`api/_utils/callRecords/validate.js:13-18`, `:326-333`); it lives only on the declarations record; the contract calls its tile read-only, never filing (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:39`); and the live 1a text tells the model "no answer is expected in this version" (`agentEvalToolSchema.js:432-434`) — while Direction V3 draws answer chips on it (`docs/design/COCKPIT_DESIGN_DIRECTION_V3.md:29`). The only answerable choice is a fork (a `pick`), and none was offered in round 3's 1,318 calls. VERIFIED.
- **What the "ask in chat" outcome would need.** The path exists: `composerPrefill { text, nonce }` (`AgentBattleScreen.jsx:571`), set by `handleAskFollowUp(symbol)` (`:1232-1252`) to "About {SYM} — " (`battleViewCopy.js:305`), consumed by the composer — a typed draft wins (`AgentChat.jsx:918-946`) — after which the pane opens on Chat. Any component mounted in `AgentBattleScreen` can call it (the Why? panel does, `WhyPanel.jsx:592`); the modal's mount receives no such prop today, and the handler does not close the modal (z-index 1100 sits above the pane's 40). **A send costs one of the battle's 10 messages** (`chatBudgetUsed`, `api/_utils/directiveFiling.js:97`; `api/agent/chat.js:378-381`) — the same pool chip filings and call-response directive answers draw from (`call-response.js:285-288`); acknowledgments and repeats cost nothing. VERIFIED.

### A8 Chat ↔ cockpit

- **How chat exchanges render.** The battle document arrives by `onSnapshot` (`src/hooks/useAgentBattle.js:26-28`) → `chatExchanges` (`:54`) → one `<AgentChat>` (`AgentBattleScreen.jsx:1919-1923`) → `deriveChatMessages` → `<MessageBubble key={item.id}>` (`src/components/Agent/AgentChat.jsx:1548-1549`). **CORRECTED path:** the projection is `src/components/Agent/deriveChatMessages.js` (not under `battleView/`); its ids are the array index — `exchange-${i}-user` / `exchange-${i}-agent` (`:54`, `:65`). A bubble carries **no `data-*` identity attribute and no DOM id** (`AgentChat.jsx:343-348`), and the projection drops `source`, `callId`, `anticipationContext.symbol`/`evaluationId`, `tradeContext`, `researchId` and `supersedes`. Tape cards do carry an anchor: `data-tape-entry-id` (`TapeCards.jsx:293`, `:329`) with ids `tape-check-${evalId}` (`buildTape.js:202-207`). The one scroll-to-target in the chat lands on a check card (`AgentChat.jsx:888-915`); nothing scrolls to a bubble. VERIFIED.
- **A cockpit filing renders today, as a chip filing.** No client code reads an exchange's `source`. The cockpit thread exchange is `messageType: 'directive_filed'` (`api/agent/call-response.js:136-154`), so it renders as the directive card with its Filed/Replaced/Expired receipt and Heard line (`AgentChat.jsx:437-443`; `deriveReceipts.js:38-109`), the peek line (`derivePeekLine.js:93-95`) and the mark's bubble (`deriveBubble.js:163-171`). Only the server's two history windows filter cockpit filings below `on` (`api/_utils/chatHistoryWindow.js:32`, `:50-54`) — the client gate is Build 2's (`docs/COCKPIT_BUILD1A_SPEC_V1_2.md:39`). VERIFIED.
- **The anchor fields Build 1a writes.** The thread exchange `{ …, source: 'cockpit', callId, directiveThreadId, timestamp, messageType: 'directive_filed' }` — written on directive answers only; an acknowledgment writes no exchange (`call-response.js:136-154`, `:230-243`, `:294-305`). The call: `playerResponse` and a top-level `directiveThreadId` (`:300-301`). The directive record: `family: 'call'`, `callId`, `kind`, `action`, `answerId`, `filedAt`, `textVersion` (`api/_utils/directiveFiling.js:34-47`). A replaced call-family slot: `supersedes: { directiveThreadId, at }` (`api/_utils/directiveWriter.js:42-47`). Calls: `callId = ${battleId}:${evalId}:call:${n}` (`api/_utils/callRecords/candidate.js:44-47`). Events: deterministic ids and `evidence: { evalId, promptBuiltAt, checkLabel }` (`api/_utils/callRecords/events.js:43-83`). **No agent-written exchange carries a `callId`:** anticipation exchanges carry `anticipationContext.evaluationId` (`voiceLayerAnticipation.js:133-138`, `:363-368`) and trade narrations `tradeContext.evaluationId` (`voiceLayerTradeNarration.js:247-254`); the cron dispatches anticipation with an `evalId` and no call id (`agent-evaluate.js:4488-4508`). `data-call-id` appears in no code (docs only, e.g. `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:48`). VERIFIED.
- **Two clocks on the labels.** The server's `checkLabel` renders "the HH:MM check" in 24-hour ET (`api/_utils/callRecords/copy.js:43-58`); the client's `slotLabel` renders "12:30 PM" floored to the slot (`src/screens/battleView/deriveTurnLine.js:66-70`). VERIFIED.
- **Where a "→ cockpit" chip and a tile → chat link would attach.** The agent line is `MessageBubble` (`AgentChat.jsx:279-465`); its chip slot holds suggested actions on the last agent message only (`:444-462`). The teal-outline "Ask a follow-up · 1 message" chip V4 names lives in the Why? panel, not the chat (`WhyPanel.jsx:589-606`; copy `battleViewCopy.js:304`). For the reverse link, `openPane(next, invoker)` takes a section only — no scroll target (`useCharacterPane.js:86-98`); the scroll state `openCheck = { id, nonce }` (`AgentBattleScreen.jsx:1201-1206`) always targets the latest check (`handleReadFullCheck` takes no argument, `:1202-1204`). **GAP:** no door accepts a message, call or `evalId` target, and no bubble has an anchor; a check card *is* addressable by `evalId` (`tape-check-${evalId}`). VERIFIED.

### A9 Live text: the `on` tool text and the 1A-C port

- **Where the `on` text lives.** The cron sends `tools: [buildTradeDecisionTool({ declarations: callsCtx.mode })]` (`api/cron/agent-evaluate.js:2791`). For `'on'` the builder returns `TRADE_DECISION_TOOL_1A` (`api/_utils/agentEvalToolSchema.js:477-482`), built once as `withDescriptionOverrides(TRADE_DECISION_TOOL_WITH_DECLARATIONS, TEXT_1A_OVERRIDES)` and deep-frozen (`:457`). `TEXT_1A_OVERRIDES` (`:437`) is D's five overrides (`ARM_D_OVERRIDES`, `:408-410`) with `declarations: TEXT_1A_DECLARATIONS` (`:424-431`) and `playerAsk: TEXT_1A_PLAYER_ASK` (`:432-434`). `withDescriptionOverrides` writes five leaves (`:444-454`); **the fork's own `said` is not one of them**, so in the live `on` tool it is the shared base text "… Stored only; not shown to the player." (`:342`) — the same bytes the shadow tool carries. VERIFIED.
- **Arm 1A-C** (`scripts/declarationsWordingArms.mjs:101-107`) is the `on` tool with exactly two leaves changed: (a) the block description `ARM_1AC_DECLARATIONS` (`:76-83`) — the 1a block with `TEXT_1A_SENTENCE` replaced by `ARM_1AC_SENTENCE` "… an answer that changes your default reaches you as a directive at a later check." (`:72-73`; asserted by `assertRound3Arms`, `:229-232`); (b) the fork's `said` description `ARM_1AC_FORK_SAID` "One sentence the player reads with this choice. State only the slot, the options and why each fits; add no conditions." (`:86-87`). It serializes to **SHA-256 `7388755a59d31522417f0a7501ec4d7c6601dd1f8138a70da8659c467ee293a6`, 13,623 chars / 13,633 UTF-8 bytes** (1A: `81499cbc…`, 13,595 / 13,605). VERIFIED (computed this session).
- **The exact diff.** Applied to a scratch copy of the HEAD blob (never to the repo file), the patched module's `on` tool serializes **byte-for-byte to round 3's 1A-C** (same SHA-256, 13,623 chars, 13,633 bytes), and D (`2a90e67b…`), shadow and off serialize unchanged. VERIFIED (executed in the session scratchpad).

```diff
--- a/api/_utils/agentEvalToolSchema.js
+++ b/api/_utils/agentEvalToolSchema.js
@@ -421,5 +421,5 @@ export const D_SENTENCE_REPLACED =
   'The player may answer Go, Hold off, or Ask me first; an answer reaches you as a directive at a later check.';
 export const TEXT_1A_SENTENCE =
-  'The player may answer Go or Hold off; an answer reaches you as a directive at a later check.';
+  'The player may answer Go or Hold off; an answer that changes your default reaches you as a directive at a later check.';
 export const TEXT_1A_DECLARATIONS =
   'Optional. The conditional calls you are holding right now. The player sees each one as a tile in their cockpit and can ' +
@@ -428,5 +428,5 @@ export const TEXT_1A_DECLARATIONS =
   'would make you act, or make you hold. Most checks where a position is under pressure or a candidate is close to your entry ' +
   'qualify. Leave it null only when you have no conditional view. At most 6 called shots. Every call is graded against real ' +
-  'prices. The player may answer Go or Hold off; an answer reaches you as a directive at a later check. ' +
+  'prices. The player may answer Go or Hold off; an answer that changes your default reaches you as a directive at a later check. ' +
   'Nothing in this block executes a trade by itself, and it does not change this check\'s decision.';
 export const TEXT_1A_PLAYER_ASK =
@@ -434,6 +434,9 @@ export const TEXT_1A_PLAYER_ASK =
   'player; no answer is expected in this version.';
 
+export const TEXT_1A_FORK_SAID =
+  'One sentence the player reads with this choice. State only the slot, the options and why each fits; add no conditions.';
+
 /** The 1a overrides: D's, with the two edits. */
-export const TEXT_1A_OVERRIDES = Object.freeze({ ...ARM_D_OVERRIDES, declarations: TEXT_1A_DECLARATIONS, playerAsk: TEXT_1A_PLAYER_ASK });
+export const TEXT_1A_OVERRIDES = Object.freeze({ ...ARM_D_OVERRIDES, declarations: TEXT_1A_DECLARATIONS, playerAsk: TEXT_1A_PLAYER_ASK, forkSaid: TEXT_1A_FORK_SAID });
 
 /**
@@ -442,5 +445,5 @@ export const TEXT_1A_OVERRIDES = Object.freeze({ ...ARM_D_OVERRIDES, declaration
  * Returns an UNFROZEN deep clone; callers freeze what they keep.
  */
-function withDescriptionOverrides(base, { declarations, horizonPhrase, said, fork, playerAsk }) {
+function withDescriptionOverrides(base, { declarations, horizonPhrase, said, fork, playerAsk, forkSaid }) {
   const tool = structuredClone(base);
   const decl = tool.input_schema.properties.declarations;
@@ -451,4 +454,5 @@ function withDescriptionOverrides(base, { declarations, horizonPhrase, said, for
   decl.properties.fork.description = fork;
   decl.properties.playerAsk.description = playerAsk;
+  if (forkSaid !== undefined) decl.properties.fork.properties.said.description = forkSaid;
   return tool;
 }
```

  Facts that shape the diff: D carries no fork-`said` override, and D's bytes are the replay comparator (`agentEvalToolSchema.build1a.test.js:150-157`), so the new key is optional; editing the shared text at `:342` instead would change the shadow tool, whose size is pinned (+4,627 chars, `build1a.test.js:94-98`). After the diff, the docstrings "D with EXACTLY TWO EDITS" (`:412-419`) and "with the two edits" (`:436`) describe three edits. The text is model-visible: fenced-class coordinated review applies whatever the path (contract V1.4 §2; `build1a.test.js:7-8`).
- **The pins it moves** (each assertion evaluated against the patched copy). In `api/_utils/agentEvalToolSchema.build1a.test.js`: **`:35-37`** (`TEXT_1A_SHA256`/`CHARS`/`BYTES`, asserted `:102-107`) → `7388755a…`/13,623/13,633; **`:109-117`** "exactly two leaves vs D" → three (adds `…fork.properties.said.description`); **`:122`** the `TEXT_1A_SENTENCE` literal; **`:139`** `TEXT_1A_OVERRIDES` gains `forkSaid`; **`:145`** `/an answer reaches you as a directive at a later check/` no longer matches. Still holding: `:84-98`, `:115-116`, `:123-125`, `:136-138`, `:144`, `:146`, and D's bytes `:150-157`. The cron's calls-on test checks structure only (`agent-evaluate.tickStamps.callsOn.test.js:285-293`); the input-budget test sizes the shadow tool, not `on` (`composition.m7e2eBudget.test.js:202`). VERIFIED.
- **Round 3's own scripts after a port.** `scripts/declarations-wording-experiment.mjs:816` pins `TOOL_SHA256['1A'] = 81499cbc…`, checked by `reuseGate3` (`:860`) before `s2`, `estimate` and `submit`; `assertRound3Arms()` throws "1A → 1A-C leaves []" (simulated on a scratch copy of the arms module importing the patched schema); and `analyze --round=3` re-hashes every submitted request (`:1341-1344`), so the 1A records would STOP it. Round 3 could not be re-run or re-analyzed from its own scripts without moving those pins too. The round-3 and Build 1a reports keep their pins as historical records. VERIFIED.

### A10 Flags and gates

| Flag | Value at HEAD | Line (`src/config/featureFlags.js`) | Pin | `DARK_BY_DESIGN` |
|---|---|---|---|---|
| `COCKPIT_UI_ENABLED` | **does not exist** | — (in specs only: `docs/COCKPIT_SPEC_V1_1.md:23`, `:106`; `docs/design/COCKPIT_SPEC_V1_2.md:24`; `…_V1_3.md:25`) | — | — |
| `CALL_RECORDS_MODE` | `'off'` | `:2826` (modes `:2829`) | `callRecordsFlags.test.js:47`, `:51` | no (a string; absence asserted `callRecordsFlags.test.js:67`) |
| `COCKPIT_ALLOWLIST_UIDS` | `Object.freeze([])` | `:2852` | `cockpitFlags.test.js:38-39` | no (absence asserted `:58`) |
| `RESPONSE_FORK_ATTRIBUTION_ENABLED` | `false` | `:2870` | `cockpitFlags.test.js:72`; `events.test.js:119` | **yes** (`flagPinGuard.test.js:186-187`) |
| `VOICE_GROUNDING_MODE` (the grounding flag) | `'shadow'` | `:2271`; per-player `getVoiceGroundingMode(uid)` `:2322-2327` (canary list from the env, PRODUCTION) | `voiceGroundingFlags.test.js:54` | no (a string) |
| `DIRECTIVE_FIT_CHECK_ENABLED` | `false` | `:887` | `directiveFitCheckFlags.test.js:23` | **yes** (`:172-173`) |
| `SHOW_IT_ENABLED` / `isShowItOn()` | `false` | `:2420` / `:2435-2437` | `showItFlags.test.js:28` | **yes** (`:123-124`) |
| `TICK_STAMPS_ENABLED` / `TICK_CAPTURE_ENABLED` | `true` / `true` | `:2372` / `:2717` | `tickStampsFlags.test.js:34` / `tickCaptureFlags.test.js:34` | no |
| `BATTLE_VIEW_CONTROLLER_ENABLED` / `…_CHARACTER_PANE_ENABLED` | `true` / `true` | `:2142` / `:2204` | `battleViewControllerFlags.test.js:34`; `characterPaneFlags.test.js:47` | no |

- **`CALL_RECORDS_MODE` history.** `off` at creation (`970a5a4d`, Sep 24) → `shadow` (`64ecd855`, Sep 26) → **back to `off`** (`4d8c498f`, Oct 1: "shadow read #1 trigger" — anticipation candidates per check moved −30.4 % against the 25 % limit; `docs/audits/20261001_CALL_RECORDS_SHADOW_READ_1.md` §5). The per-battle resolver gives `on` only to an allowlisted owner (`api/_utils/callRecords/mode.js:72-77`). VERIFIED (`git log -G`, reads).
- **The pin guard sees only booleans:** `flagPinGuard.test.js:214` matches `export const X_ENABLED = true|false`, so string and list flags (`CALL_RECORDS_MODE`, `COCKPIT_ALLOWLIST_UIDS`, `VOICE_GROUNDING_MODE`) carry direct pins instead. VERIFIED.
- **Held-position parity: not built.** The Brief defines it in one clause — "so cards about held names can show what they show for bench names" (`docs/design/COCKPIT_DESIGN_BRIEF_V1_SEP22.md:77`); no document at HEAD gives acceptance criteria, and no spec, flag or branch exists for it (it is listed as unbuilt and fenced in `docs/audits/20260923_PHASE0_COCKPIT.md:307`, `:317`, and as a waiting change in `docs/20260923_INTEGRITY_FINDINGS_REGISTER_V2.md:248`). In the evaluator prompt (fenced assembler, read only), **bench names get a technical block** — trend and 200-day position, RSI/MACD/divergence, BB %B, volume/RVOL, relative strength, levels, candle, technical score (`agentEvalPromptAssembly.js:1535-1586`) — **held names get none**: their CSV row (with the Levels cell live since the profit-target executor flip, `:1434-1487`), stock regimes, risk status and the intraday snapshot (`:1770-1863`); both get fundamentals (`api/_utils/fundamentalsRender.js:121-197`). The cron already fetches technical scores for held names too (`agent-evaluate.js:1314-1316`, `:1508-1513`). On the client, the evidence stamp is held-only (`api/_utils/tickStamps.js:89-91`) and the bench pane shows no per-name numbers (`PaneBench.jsx:5-9`). VERIFIED.
- **The other Brief §8 gates.** Grounding `'on'`: not yet (`'shadow'`; whether the 20-pair read is done is PRODUCTION). Fit-check flip: halted Sep 18 (`docs/audits/20260918_FLIP_DIRECTIVE_FIT_CHECK.md:1-6`). Capture flip: done (`TICK_CAPTURE_ENABLED = true`). Spec V1.3 also gates Build 2 on `CALL_RECORDS_MODE = 'on'` and Build 1 (`docs/design/COCKPIT_SPEC_V1_3.md:16`). VERIFIED.

### A11 Mockup vs repo (structure and vocabulary; the skin comes from tokens)

- **How the mockup was read.** The committed file is a bundler page: line 381 is a JSON manifest of base64, gzip-compressed resources (React, ReactDOM, Babel, 24 component sources, fonts) and line 393 is the page template. The sources were unpacked (`JSON.parse` + `gunzip`) into the session scratchpad and are cited here as `<component>.jsx:line` — the name in each source's header comment (manifest ids: `cockpit4-app.jsx` `2187d2c6`, `cockpit4-screen.jsx` `2fb985c6`, `cockpit4-feed.jsx` `3d72b29d`, `cockpit3-fixtures.jsx` `c296e310`, `cockpit3-sheets.jsx` `ad5dc9a7`, `cockpit3-tiles.jsx` `1b126aac`, `cockpit3-state.jsx` `8c666b75`, `cockpit-fixtures.jsx` `e4993b91`, `cockpit-cards.jsx` `c76f3014`, `cockpit2-fixtures.jsx` `9c0eed69`, `cockpit2-sheets.jsx` `b202c92c`, `pane-sections.jsx` `d7f47c42`, `pane-avatar.jsx` `8033dc65`, `ctl-board.jsx` `e3488baa`). Only `Cockpit4App` mounts (`cockpit4-app.jsx:91`, the only `createRoot`); V1–V3 code is loaded as shared fixtures, state and sheets, never as its own screen.
- **The screens.** All six V4 §8 asked for are present as presets (`cockpit4-app.jsx:20-28`): (1) mobile board with the segmented control and pills; (2) mobile cockpit at 1:38 PM; (3) the slide frozen at −50 %; (4) a tile's sheet (HOOD); (5) the check landing; (6) desktop at 1440 px with the Cockpit tab. Screen 5 is a static after-the-check snapshot: the re-sort shows only as its result, and no receipt renders on a tile (tiles carry none by design, `cockpit3-tiles.jsx:1-4`).
- **Each element → the repo component it would extend, or GAP:**

| Mockup element | Mockup | Would extend (repo) | Status at HEAD |
|---|---|---|---|
| Score header + turn line | `cockpit-screen.jsx:33-57` | `ArenaHeader.jsx` (`AgentBattleScreen.jsx:2252-2266`), `TurnLine.jsx:25-66` | present; the mockup's 15 "pips" do not exist (one dot + text) |
| Header, THIS TURN and the segmented control pinned above the track | `cockpit4-screen.jsx:137-143` | the mobile layout (`AgentBattleScreen.jsx:2094-2129`) | **GAP** — nothing is pinned on a phone (A2) |
| THIS TURN row with doors at its right end | `cockpit4-screen.jsx:18-30` | `ThisTurnStrip.jsx` | present; stacked and inside the board scroller, where the mockup draws one pinned line "{answer} · {SYM} · Filed {t}" |
| Research and Dials pills | `cockpit4-screen.jsx:9-14` | — | **GAP** (no exit-dials code anywhere in `src/` or `api/`; the mockup's Research pill is hard-wired to ZS) |
| "Board · Cockpit [n]" segmented control with a sliding thumb | `pane-sections.jsx:6-18` | nearest: `CharacterPane.jsx` `SegmentedControl` (`:119-178`, no thumb, no count) | **GAP** |
| The slide track (drag starts at 8 px, commits at 22 %) | `cockpit4-screen.jsx:58-73` | — | **GAP** (no pager; the 320 ms bezier and 180 ms fade match no token, A3) |
| Board rows with call "marks" (Directive · Acted · Held off) | `ctl-board.jsx:122-133`, `:166-212` | `TacticalRow.jsx:623-776` under `TierHeader` | rows present; **marks GAP** (`TacticalRow` takes no mark or receipt props) |
| Feed group headers — ⚡ Needs you · ⏱ Waiting on the check · 👁 Watching · 🛡 Guarding · Earlier | `cockpit4-feed.jsx:8-11`, `:98-106` | styling precedent `TierHeader` (`AgentBattleScreen.jsx:187-237`) | **GAP** |
| A tile: dot · eyebrow "{KIND} · {cite}" · state tag · plain line · one control | `cockpit4-feed.jsx:66-85` | — | **GAP** |
| Tile sheet: title, the agent's sentence, facts with as-of, the default line, receipts, Why?, Open in chat at this line | `cockpit3-sheets.jsx:38-60` | `WhyPanel.jsx` (a panel, not a sheet) | **GAP** — no bottom-sheet primitive in `battleView/`; "Open in chat at this line" GAP (A8) |
| Research sheet: symbol pre-loaded, the agent's framing, Answer · Flag for next deploy · Ask in chat | `cockpit3-sheets.jsx:63-83` | `AssetResearchModal` + the prefill path (A7) | modal present; framing, answer and flag **GAP**; ask-in-chat present |
| Dials sheet | `cockpit-cards.jsx:261-277` | — | **GAP** |
| "Your calls · Its record" sheet | `cockpit2-sheets.jsx:76-84` | — | **GAP** |
| Floating mark, bubble, unread badge | `pane-avatar.jsx:41-51` | `CharacterAvatar.jsx` | present (the shipped bubble is "sharp and unstriped", D-98, `CharacterAvatar.jsx:32-37`) |
| Desktop pane header: tabs "Cockpit 4 · Chat · Bench · Tape" | `cockpit4-screen.jsx:76-94` | `CharacterPane.jsx:274-384` | present minus the Cockpit tab and the counts (A1) |
| Desktop cockpit top row: vintage line + pills | `cockpit4-screen.jsx:118` | — | **GAP** — no vintage line in the Battle View |
| Chat "→ cockpit {KIND}" chip under a spawning line | `cockpit3-sheets.jsx:106` | `MessageBubble` (`AgentChat.jsx:279-465`) | **GAP** (A8) |
| "Backed week" chip | `cockpit4-screen.jsx:37` | — | **GAP** |

- **Each tile's controls against the Build 1a answers** (`api/agent/call-response.js:82-83`, `:111-129`):

| Tile (as drawn) | Mockup controls | Build 1a |
|---|---|---|
| Called shot — entry, act default | "Go if it triggers" · "Hold off" · "Ask me first" (`cockpit-fixtures.jsx:133`) | `go` = acknowledgment; `hold` = directive `call_hold`; **`ask` → 400 `deferred`** |
| Confirmation — exit, act default | "Confirm" · "Hold off" · "Ask me first" | "Confirm" = `go` (acknowledgment); `hold` = directive; `ask` deferred |
| Called shot — hold default | **not drawn** | `hold` = acknowledgment; `go_now` = directive `call_go` — the mockup's "Go if it triggers" would be 400 `illegal_answer` here |
| Called shot — "asking you" | "Go now" · "Keep holding off" | `go_now` is illegal on an act-default call; `keep` is deferred; the "awaiting answer" class is empty in 1a (`callsBlock.js:15-16`) |
| Two-way | "Pick ZS" · "Pick INTC" (+ "Research · ZS") | `pick` = directive `call_pick` "Bring in ZS for CF at the next check." (`callActions.js:96-99`); Research GAP |
| Two-way — "the agent picked" | "Agree for next time?" · "Yes" · "No" | `agree` / `disagree` = acknowledgments: **no directive, nothing kept "for next time"** (`call-response.js:14-20`, `:230-243`) |
| Research objective | "Research · ZS", then the agent's offered answers | **GAP — no answer path** (A7) |
| Monitoring | each name → the research sheet | read-only; `watching` carries no current / stale state (GAP) |
| Guarding | "◎ Dials" | **GAP** — the capture record holds no guard state (its checks are pair validation, lock, distressed veto, hurdle, swap cap, conviction, reservation, execution: `api/_utils/tickCapture/captureConfig.js:174-183`) |

- **The states against the record.** The mockup's shot states — Watching · Your call filed · Acted · Held off · Asking you · Expired · Dropped (`cockpit2-fixtures.jsx:64`) — map as: Watching ← `open` with no response; Your call filed ← `playerResponse` set; Acted ← `outcome.actedEvalId` and the `acted` event (written only on a thread answered with a directive); Expired ← `expired_unresolved` or `ended_with_battle`; **Held off has no fact** ("THERE IS NO 'HELD' FACT", `api/_utils/callRecords/heard.js:22`; "Holding" stays out as unproven, `battleViewCopy.js:24`); **Asking you** has no 1a state; **Dropped**'s nearest is `invalidated` (no observation, non-finite or implausible level, `validate.js:78`, `:345-352`). Record facts the mockup has no state for: `no_matching_trade`, `superseded` (the shipped "Replaced" receipt), the six 409 refusals, "answer expired before this check", the deadline (no tile shows a horizon), and the message a directive answer costs.
- **Vocabulary.** Already in the repo, same words: "Hold off", "Go now", "Pick", "Agree", "Disagree" (`copy.js:128-130`); "Filed 1:38 PM", "Heard at the 1:45 PM check", "Not heard at the {slot} check", "Files: …" (`src/data/decisionRecord.js:567-616`); "Nothing queued · next check ~{t}" (`battleViewCopy.js:550-553`); "Checked {t} · next ~{t}" (`deskCopy.js:149`); "About ZS — " (`battleViewCopy.js:305`); "Why?" (`:134`). **Different:** the citation — client "From the 1:30 PM check" (`battleViewCopy.js:157-160`), server "the 13:30 check" (`copy.js:55-58`), mockup "from the 1:30 check"; and a call's `said` must carry "agent's own wording (unverified)" (`copy.js:261`), where the mockup foots it "The agent's own words" — the repo's label for a check's rationale (`decisionRecord.js:150`). **Absent:** every group header, the six kind labels ("Monitoring", "Called shot", "Confirmation", "Two-way", "Research objective", "Guarding"), "from chat {t}", "Filed · not yet heard", "Its default stood", the vintage line, "Today · day 3", "New", "→ cockpit", "Exit dials", "Your calls · Its record".
- **The mockup's own fidelity claims.** Match: the `CMD` tokens and primitives (`commandUI.jsx:16-81`), the `TacticalRow` row anatomy, the speculator menu (`archetypeAdjustments.js:145-151`), the Filed / Heard / Files stamps. Mismatch: no `ClosedScoreHeader` exists (`cockpit4-screen.jsx:159-160`); the "shipped board, untouched" adds marks; the turn line has no pips; the mark is not `MechSVG` (the Battle View shows `AgentPresenceMount`, `AGENT_PRESENCE_ENABLED = true`, `featureFlags.js:1338`); the bubble's tail and stripe were superseded (D-98); the answer chips are tinted fills, not the shipped transparent teal-outline chip (`WhyPanel.jsx:589-605`), and state no message cost although directive answers charge one (`call-response.js:268-289`). Inside the mockup: the guard sheet renders "Profit target +5% · undefined" (`cockpit-fixtures.jsx:148` has no `armed` key); its guard sentence says "The capture build is dark", but `TICK_CAPTURE_ENABLED = true`; and its "Needs you" count is 4 where V4 §8's example says 2, because it merges two groups (`cockpit4-feed.jsx:8`, `grs: [0, 1]`). VERIFIED (mockup sources and repo).

---

## Part B — counts from round 3's raw outputs

### Method

- **Script:** `scripts/build2-discovery-counts.mjs` — `node scripts/build2-discovery-counts.mjs [--json=<path>]` from the repo root. It reads data **only** from `experiments/declarations-wording/raw/round3/` (`sample.json`, `s2.json`, `calls/*.json`, and `results.json` as a cross-check), plus the source *text* of `scripts/declarations-wording-experiment.mjs` once (that script cannot be imported: it dispatches a command at load). No Firestore, no network, no clock in the output; it writes nothing unless `--json=<path>` is passed. Two runs give byte-identical output (the block below is its stdout, spliced in verbatim between the markers).
- **Arms and denominators.** Primary arm **1A-C**, both reps: 193 checks × 2 = **386 calls**; 1A and 1A-CF beside it. S2 is used only in B9.
- **Kept rows** are the calls validator's — `captureDeclarations` (`api/_utils/callRecords/validate.js:364-374`) — called exactly as round 3 calls it: the horizon bound to the check's own instants (`horizon.js:166`) and **round 3's per-check universe builder** — the battle roster as read on 2026-10-02 plus every held and bench name the check's prompt showed (`promptSymbols`, `scripts/declarations-wording-experiment.mjs:1290-1301`, used at `:1361`). The script carries a verbatim copy of `promptSymbols` and **stops** unless the copy equals round 3's text byte for byte and round 3's `analyze3` still validates with that universe. It also **stops unless its kept rows reproduce round 3's published `results.json` exactly** for all three arms: declaring calls, minted calls per declaring call, kind mix, horizon mix, removals, and the per battle-day pacing rows.
- **Raw where a count says raw:** B2 (`anticipationCandidates` — the calls validator never sees them) and B4 (top-level keys). Trade-invalid calls are included, as in round 3's declaration measures (production would mint nothing for them); every count states how many of its hits sit on one.
- **Per battle-day:** a battle-day is one battle's sampled checks on one ET day (round 3 sampled every recoverable check). Each value is the mean of the two reps; the line gives mean · median · min–max across the 13 battle-days (12 momentum_chaser, 1 contrarian), the median being round 3's lower-middle value, plus the number of battle-days with at least one.
- **Examples** are seeded picks (fixed seed), primary arm first; they are the agent's own text from the kept rows. No player text appears anywhere in this report.

<!-- BEGIN GENERATED: node scripts/build2-discovery-counts.mjs -->
<!-- generated by scripts/build2-discovery-counts.mjs — do not edit by hand -->
### Inputs and the cross-check

- Raw folder: `experiments/declarations-wording/raw/round3/` — `sample.json` SHA-256 `fd8cd0c4990581c9…`, `s2.json` `404fc7fd3adf847e…`, `results.json` `934a37e584c4d996…`, 1318 call records (digest `db5e8352a233f0ba…`).
- Main sample: 193 checks, 13 battles, 13 battle-days (momentum_chaser 185, contrarian 8); 386 calls per arm (2 reps).
- Universe builder: this script's `promptSymbols` equals round 3's byte for byte, and round 3's `analyze3` validated with roster ∪ `promptSymbols` (asserted against `scripts/declarations-wording-experiment.mjs` at SHA-256 `1cc9504cc287d2da…`, LF-normalized).
- **Kept rows reproduce round 3's published counts exactly** (declaring calls, minted calls per declaring call, kind mix, horizon mix, removals, per battle-day pacing): 1A-C 142 / 386 declaring · 1A 130 / 386 declaring · 1A-CF 135 / 386 declaring. The script stops before printing anything if any of these differs.
- Trade-invalid calls (production captures declarations only on a valid trade result): 1A-C 7 · 1A 13 · 1A-CF 12 of 386. Counts below include them, as round 3's declaration measures do; each count states how many of its hits sit on such a call.

### B1 — Crossroads Tier 1: one slot, two or more incoming names

Incoming = an entry row's `symbol`, or an exit row's `counterpart`; only names in the check's universe count (the unfiltered figure is shown beside). "Same swap-out" = two incoming names for the same outgoing name (an entry row's `counterpart`, or an exit row's own `symbol`).

| Measure | **1A-C** (primary) | 1A | 1A-CF |
|---|---|---|---|
| Calls with ≥ 1 qualifying slot (per call; as defined) | 15 / 386 (3.9 %) | 15 / 386 (3.9 %) | 25 / 386 (6.5 %) |
| …of calls with ≥ 2 kept called shots | 15 / 121 (12.4 %) | 15 / 106 (14.2 %) | 25 / 116 (21.6 %) |
| …without the universe filter | 17 / 386 (4.4 %) | 15 / 386 (3.9 %) | 25 / 386 (6.5 %) |
| Qualifying slots, by row mix | 15: entry-only 8, mixed 4, exit-only 3 | 15: entry-only 13, exit-only 1, mixed 1 | 25: entry-only 15, mixed 7, exit-only 3 |
| …of which ≥ 2 incoming names share one swap-out | 0 / 15 (0.0 %) | 0 / 15 (0.0 %) | 1 / 25 (4.0 %) |
| **With held names excluded from "incoming"** (per call) | 5 / 386 (1.3 %) | 1 / 386 (0.3 %) | 5 / 386 (1.3 %) |
| …qualifying slots, by row mix · sharing one swap-out | 5: exit-only 5 · 0 | 1: exit-only 1 · 0 | 5: exit-only 3, mixed 2 · 1 |
| Hits on a trade-invalid call (as defined · held excluded) | 0 · 0 | 0 · 0 | 0 · 0 |
| Per battle-day (qualifying calls, as defined) | all 13: 0.58 · 0 · 0–5.5 (≥ 1 on 5 of 13) · MC 12: 0.63 · 0 · 0–5.5 · CN 1: 0 · 0 · 0–0 | all 13: 0.58 · 0 · 0–6 (≥ 1 on 4 of 13) · MC 12: 0.63 · 0 · 0–6 · CN 1: 0 · 0 · 0–0 | all 13: 0.96 · 0.5 · 0–8.5 (≥ 1 on 7 of 13) · MC 12: 0.96 · 0 · 0–8.5 · CN 1: 1 · 1 · 1–1 |
| Per battle-day (qualifying calls, held excluded) | all 13: 0.19 · 0 · 0–2 (≥ 1 on 2 of 13) · MC 12: 0.21 · 0 · 0–2 · CN 1: 0 · 0 · 0–0 | all 13: 0.04 · 0 · 0–0.5 (≥ 1 on 1 of 13) · MC 12: 0.04 · 0 · 0–0.5 · CN 1: 0 · 0 · 0–0 | all 13: 0.19 · 0 · 0–1 (≥ 1 on 4 of 13) · MC 12: 0.21 · 0 · 0–1 · CN 1: 0 · 0 · 0–0 |

Examples (verbatim kept rows of the qualifying slot; held-excluded hits first):

1. [1A-C] DRgA4… eval_019 · momentum_chaser · rep 2 — qualifies with held names excluded
   - slot **star** (exit-only)
     - `HOOD` exit · star (counterpart DHR) · below 123.48 · `this_session` · act — "HOOD trades below entry ($123.48) before close, I rotate to DHR (Healthcare momentum)."
     - `AMD` exit · star (counterpart INTC) · below 617.71 · `this_session` · act — "AMD trades below entry ($617.71) before close, I rotate to INTC (Tech leadership)."
2. [1A-C] DRgA4… eval_008 · momentum_chaser · rep 1 — qualifies with held names excluded
   - slot **star** (exit-only)
     - `HOOD` exit · star (counterpart GME) · below 120.78 · `this_session` · act — "HOOD trades below $120.78 (Bust threshold -1.0x ATR) by end of session, I exit to protect the locked +6 pts."
     - `AMD` exit · star (counterpart NVDA) · below 608.94 · `this_session` · act — "AMD trades below $608.94 (Bust threshold -1.0x ATR) by end of session, I exit to protect Star tier."
3. [1A-C] d3T2J… eval_006 · momentum_chaser · rep 2 — qualifies with held names excluded
   - slot **core** (exit-only)
     - `MU` exit · core (counterpart AMAT) · below 1065 · `next_check` · hold — "MU trades below $1,065 (NR7 lower bound) by next check, I would reconsider hold."
     - `PANW` exit · core (counterpart DHR) · below 378 · `next_check` · hold — "PANW trades below $378 (-0.45x ATR) by next check, defensive exit becomes plausible."
4. [1A-C] DRgA4… eval_011 · momentum_chaser · rep 2 — qualifies with held names excluded
   - slot **star** (exit-only)
     - `HOOD` exit · star (counterpart COIN) · below 123.12 · `this_session` · act — "HOOD trading below $123.12 (entry -0.29%) would signal NR7 failure; I would rotate to COIN."
     - `AMD` exit · star (counterpart INTC) · below 610.96 · `this_session` · act — "AMD trading below $610.96 (entry -1.1%, approaching Bust threshold) would trigger defensive exit to INTC."
5. [1A-C] DRgA4… eval_012 · momentum_chaser · rep 1 — qualifies with held names excluded
   - slot **star** (exit-only)
     - `HOOD` exit · star (counterpart COIN) · below 123.48 · `this_session` · hold — "HOOD trades below $123.48 (entry price) by end of session, I will evaluate a defensive exit."
     - `AMD` exit · star (counterpart NVDA) · below 617.71 · `this_session` · hold — "AMD trades below $617.71 (entry price) by end of session, I will evaluate a defensive exit."
6. [1A] DRgA4… eval_011 · momentum_chaser · rep 1 — qualifies with held names excluded
   - slot **star** (exit-only)
     - `HOOD` exit · star (counterpart COIN) · above 132.4 · `this_session` · act — "HOOD trades above $132.40 (breakout of +0.5x ATR) by close of session."
     - `AMD` exit · star (counterpart INTC) · above 660.5 · `this_session` · act — "AMD trades above $660.50 (breakout of +0.5x ATR) by close of session."
7. [1A-CF] lk1Cm… eval_003 · momentum_chaser · rep 1 — qualifies with held names excluded
   - slot **core** (mixed, same swap-out)
     - `LRCX` exit · core (counterpart AMAT) · below 318.5 · `next_check` · hold — "LRCX trading below 318.5 (entry - 0.3x ATR) by next check would signal NR7 setup failure; would favor exit to bench and entry of AMAT."
     - `BE` entry · core (counterpart LRCX) · above 295.59 · `this_session` · hold — "BE holding above current price (295.59) through close would keep it on watch; if LRCX NR7 setup fails, would rotate LRCX out and bring BE into Core."
8. [1A-CF] DRgA4… eval_003 · momentum_chaser · rep 1 — qualifies with held names excluded
   - slot **star** (exit-only)
     - `HOOD` exit · star (counterpart MU) · below 122 · `this_session` · hold — "HOOD trades below $122 before close, I would rotate to MU if the breakout setup fails."
     - `AMD` exit · star (counterpart INTC) · below 610 · `this_session` · hold — "AMD trades below $610 before close, I would consider INTC as a replacement if momentum breaks."

### B2 — Tier 2: `anticipationCandidates` (raw tool input)

| Measure | **1A-C** (primary) | 1A | 1A-CF |
|---|---|---|---|
| Calls with ≥ 1 candidate (per call) | 279 / 386 (72.3 %) | 276 / 386 (71.5 %) | 281 / 386 (72.8 %) |
| Candidates | 482 | 463 | 479 |
| Key sets (sorted keys: count) | direction,rationale,signalSource,signalSummary,symbol,threshold 472, direction,signalSource,signalSummary,symbol,threshold 10 | direction,rationale,signalSource,signalSummary,symbol,threshold 454, direction,signalSource,signalSummary,symbol,threshold 9 | direction,rationale,signalSource,signalSummary,symbol,threshold 474, direction,signalSource,signalSummary,symbol,threshold 5 |
| `direction` values | potential_exit 273, potential_entry 209 | potential_exit 260, potential_entry 203 | potential_exit 265, potential_entry 214 |
| `direction` × the symbol as the prompt showed it | potential_exit · held 273, potential_entry · bench 180, potential_entry · held 29 | potential_exit · held 257, potential_entry · bench 182, potential_entry · held 21, potential_exit · bench 3 | potential_exit · held 261, potential_entry · bench 190, potential_entry · held 24, potential_exit · bench 4 |
| Keys outside the schema's six | — | — | — |
| Candidates carrying a `slot`/`tier`-named key | 0 | 0 | 0 |
| Candidates whose text names a tier word (star/core/support) | 154 / 482 (32.0 %): potential_entry:support 54, potential_exit:support 44, potential_entry:core 39, potential_exit:core 8, potential_exit:star 6, potential_entry:star 3 | 156 / 463 (33.7 %): potential_entry:support 49, potential_entry:core 44, potential_exit:support 43, potential_exit:core 10, potential_exit:star 7, potential_entry:star 3 | 164 / 479 (34.2 %): potential_exit:support 45, potential_entry:support 44, potential_entry:core 40, potential_entry:star 13, potential_exit:core 13, potential_exit:star 9 |
| Calls with ≥ 2 distinct `potential_entry` symbols | 24 / 386 (6.2 %) | 26 / 386 (6.7 %) | 30 / 386 (7.8 %) |
| …of which ≥ 2 are names the check's bench showed (any could take any slot) | 18 / 386 (4.7 %) | 20 / 386 (5.2 %) | 24 / 386 (6.2 %) |
| …of which ≥ 2 name the same tier word | 7 / 386 (1.8 %) | 6 / 386 (1.6 %) | 5 / 386 (1.3 %) |
| Calls with candidates on a trade-invalid result | 4 | 10 | 6 |
| Per battle-day (calls with ≥ 2 entry candidates) | all 13: 0.92 · 0.5 · 0–3.5 (≥ 1 on 7 of 13) · MC 12: 1 · 0.5 · 0–3.5 · CN 1: 0 · 0 · 0–0 | all 13: 1 · 0.5 · 0–4 (≥ 1 on 8 of 13) · MC 12: 1.08 · 0.5 · 0–4 · CN 1: 0 · 0 · 0–0 | all 13: 1.15 · 0.5 · 0–4.5 (≥ 1 on 9 of 13) · MC 12: 1.25 · 0.5 · 0–4.5 · CN 1: 0 · 0 · 0–0 |

Examples (calls whose `potential_entry` candidates name the same tier word; verbatim `signalSummary` and `threshold`):

1. [1A-C] jR53k… eval_003 · momentum_chaser · rep 2
   - `ETN` — "NR7 detected (narrowest 7-day range at $7.39) with BB width at 75th percentile — classic volatility contraction setup preceding directional breakout." / "If ETN breaks above $440.62 (+0.32%) on volume >1.1x average, it would qualify for Volatility Squeeze Breakout strategy (S1) and warrant consideration for Core tier upgrade."
   - `PLTR` — "Up +3.58% today with fresh MACD bullish cross, RSI 67 (optimal momentum zone per S3), and technicalScore 86 (rank 9) — strong breakout candidate." / "If PLTR holds above $191.61 (current price) through the next 15-min check and volume remains >1.0x, I would consider rotating it into Core tier to capture momentum before it extends further."
2. [1A-C] DRgA4… eval_007 · momentum_chaser · rep 2
   - `GME` — "GME up 4.24% today (0.76x ATR) with bullish short-term trend and strong intraday momentum in risk_on regime." / "If GME holds above $23.50 and HOOD or AMD fails to break out of NR7 by 2:00 PM, GME becomes a viable Consumer Discretionary rotation candidate for Support tier."
   - `DHR` — "DHR up 2.90% today (0.70x ATR) with clean uptrend and technicalScore=84 (rank 12), outperforming Healthcare sector." / "If DHR sustains above $223.00 and META or MSFT breaks below their support levels, DHR becomes a Core tier candidate for sector diversification."
3. [1A-C] bzfCE… eval_010 · momentum_chaser · rep 1
   - `MSFT` — "MSFT is +1.88% on a risk_on day with technicalScore 78 and all three trends (short/intermediate/long) pointing up; trading 19.66% above SMA200." / "If MSFT sustains above $520 (current support $489.56 is 5.4% below) and volume confirms the move, it becomes a viable swap candidate for a bleeding position in the next 2h."
   - `PANW` — "PANW is +3.85% with technicalScore 83, all trends up, and 60.63% above SMA200 — the strongest bench performer today." / "If PANW holds above $403 (current level) and shows volume confirmation into the final 2h, it becomes a high-conviction swap candidate if an active position breaks below its support."
4. [1A-C] NTNj4… eval_001 · momentum_chaser · rep 1 · trade result INVALID (production would mint nothing)
   - `AMD` — "NR7 contraction flagged with directional_expansion regime — classic volatility squeeze setup ready to break." / "If AMD breaks above $637.75 (+1.1% from entry) on volume >1.2x average, I would consider upgrading conviction for a potential rotation into Core."
   - `CRWD` — "NR7 contraction with directional_expansion regime — similar squeeze setup to AMD, primed for breakout." / "If CRWD breaks above $259.65 (+3.0% from entry) on volume >1.2x average, I would increase hold conviction and watch for threshold proximity to +1.0x ATR."
   - `DHR` — "Bench candidate with technicalScore 89 (rank 1), all three trends up, +11.24% above SMA200 — highest-quality setup available." / "If DHR breaks above $227.50 (+1.4% from current) on volume >1.2x, I would seriously evaluate a swap into Core, contingent on which active position shows the weakest forward EV."
5. [1A-C] DRgA4… eval_006 · momentum_chaser · rep 1
   - `NVDA` — "NVDA showing +0.60% daily strength with technicalScore 88 (top 4 rank) and all three trends up, but bearish divergence on momentum is a caution flag." / "If NVDA breaks above its +1.90% resistance level ($232.62) on volume > 1.2x and holds above VWAP, it becomes a Core-tier upgrade candidate over a stalling position."
   - `DHR` — "DHR up +2.80% today (0.67x ATR) with technicalScore 84 and all three trends up; outperforming the market in Healthcare sector." / "If DHR continues to hold above VWAP and reaches +1.0% ATR gain (+$6.62, or +3.0%) by next evaluation, it becomes a viable Core-tier swap candidate."
6. [1A-C] DRgA4… eval_002 · momentum_chaser · rep 2
   - `MU` — "MU is up +2.77% on strong relative strength (rsPercentile 96) with positive MACD histogram and RSI 63 in the preferred 50-70 zone, trading above 200-day SMA (+63.35%)." / "If MU sustains above 1100 and MSFT's BB squeeze breaks upward (confirming sector momentum), I would consider rotating MSFT (Support tier, lowest impact) into MU for higher momentum capture."
   - `GME` — "GME is up +3.84% with bullish engulfing pattern and positive technical score (87, rank 7), but Consumer Discretionary sector is not in top momentum list and fundamentals show revenue decline (-18.7%)." / "If GME breaks above 25.00 and sustains volume > 1.2x average, it would warrant consideration as a Support-tier rotation out of GOOGL (which is NR7 but Communication Services is choppy regime)."
7. [1A-C] DRgA4… eval_001 · momentum_chaser · rep 1
   - `MU` — "MU is up +3.59% with rsPercentile=96 and technicalScore=82 (rank 14), showing genuine relative strength in a flat market." / "If MU holds above +3.0% and maintains rsPercentile >= 90 through the next check, I would consider rotating it into Core as a momentum upgrade over ETN (-0.12%)."
   - `INTC` — "INTC is up +0.41% with rsPercentile=100 (leading all names) and technicalScore=84 (rank 10), but RSI=71 is approaching S10 threshold (avoid above 75)." / "If INTC pulls back to RSI <= 70 while holding above the 50-day MA, it becomes a cleaner entry for Core tier. Watch for a dip-buy setup rather than chasing current levels."
8. [1A] DRgA4… eval_006 · momentum_chaser · rep 1
   - `GME` — "GME up 4.55% today (0.81x ATR) with bullish momentum, but Consumer Discretionary sector is weak; would only swap if HOOD or AMD breaks down." / "If HOOD falls below $121.50 (-0.5x ATR) and GME holds above $23.50, I would consider rotating GME into Support tier."
   - `DHR` — "DHR up 2.80% with clean uptrend and technicalScore=84, but lacks the NR7 catalyst or extreme volatility setup that HOOD/AMD carry." / "If MSFT's BB squeeze resolves downward (price breaks below $494), I would rotate DHR into Support to replace MSFT."

### B3 — Prose alternatives in a kept `said` ("X or Y", "X/Y")

A run of tickers joined by "or" or "/" (commas allowed inside; a comma-only list is not counted), with ≥ 2 distinct names in the check's universe. Lexical.

| Measure | **1A-C** (primary) | 1A | 1A-CF |
|---|---|---|---|
| Kept called-shot rows naming alternatives | 15 / 324 (4.6 %) | 15 / 297 (5.1 %) | 14 / 322 (4.3 %) |
| Calls with ≥ 1 such row (per call) | 12 / 386 (3.1 %) | 14 / 386 (3.6 %) | 12 / 386 (3.1 %) |
| Typed `counterpart` is one of the named alternatives | 2 / 15 (13.3 %) | 1 / 15 (6.7 %) | 0 / 14 (0.0 %) |
| Typed `counterpart` present but not among them | 0 / 15 (0.0 %) | 0 / 15 (0.0 %) | 0 / 14 (0.0 %) |
| No typed `counterpart` | 13 / 15 (86.7 %) | 14 / 15 (93.3 %) | 14 / 14 (100.0 %) |
| The row's own `symbol` is one of them | 0 / 15 (0.0 %) | 0 / 15 (0.0 %) | 0 / 14 (0.0 %) |
| Hit rows on a trade-invalid call | 0 | 1 | 0 |
| Per battle-day (hit rows) | all 13: 0.58 · 0 · 0–2 (≥ 1 on 6 of 13) · MC 12: 0.63 · 0 · 0–2 · CN 1: 0 · 0 · 0–0 | all 13: 0.58 · 0 · 0–2.5 (≥ 1 on 6 of 13) · MC 12: 0.63 · 0 · 0–2.5 · CN 1: 0 · 0 · 0–0 | all 13: 0.54 · 0 · 0–2 (≥ 1 on 6 of 13) · MC 12: 0.58 · 0 · 0–2 · CN 1: 0 · 0 · 0–0 |

Examples:

1. [1A-C] DRgA4… eval_019 · momentum_chaser · rep 1 — alternatives {NVDA | INTC}
   - `META` exit · core · below 725 · `this_session` · act — "META trading below $725.00 (approximately -3.5% from entry, or -0.53x ATR) would trigger a defensive swap to NVDA or INTC before Bust penalty risk escalates."
2. [1A-C] DRgA4… eval_001 · momentum_chaser · rep 1 — alternatives {MU | INTC}
   - `MSFT` exit · support · below 489.01 · `this_session` · hold — "MSFT trades below $489.01 (support) by end of session, I would consider rotating to a stronger bench candidate like MU or INTC."
3. [1A-C] bzfCE… eval_006 · momentum_chaser · rep 2 — alternatives {MSFT | EMR}
   - `PWR` exit · support · below 630 · `this_session` · act — "PWR trades below 630.00 (approaching -0.5x ATR), I would rotate to MSFT or EMR to stop the bleed."
4. [1A-C] xKLKt… eval_004 · momentum_chaser · rep 2 — alternatives {EMR | TXN}
   - `PANW` exit · core · below 324.22 · `next_check` · act — "PANW breaks below support S324.22 by the next check, I rotate it out to EMR or TXN to stop the bleed."
5. [1A-C] DRgA4… eval_007 · momentum_chaser · rep 2 — alternatives {DHR | NVDA}
   - `META` exit · core · below 743.41 · `this_session` · act — "META trades below $743.41 (my -1.0x ATR bust level) before day's close, I consider rotating to DHR or NVDA for sector strength."
6. [1A-C] NTNj4… eval_008 · momentum_chaser · rep 2 — alternatives {EMR | DHR}
   - `AMD` exit · star (counterpart EMR) · below -4.5 · `this_session` · act — "AMD trading below -4.5% (Bust threshold) by 3:00 PM would trigger a defensive exit to EMR or DHR to protect banked points."
7. [1A-C] DRgA4… eval_013 · momentum_chaser · rep 1 — alternatives {COIN | DHR | NVDA}
   - `META` exit · core · below 725.24 · `this_session` · act — "META trading below -0.5x ATR (-3.3% from entry, $725.24) would trigger a swap to a stronger bench candidate (COIN, DHR, or NVDA)."
8. [1A-C] jR53k… eval_005 · momentum_chaser · rep 1 — alternatives {PLTR | MU}
   - `INTC` exit · star · below 119.43 · `this_session` · act — "INTC trading below -1.0x ATR ($119.43) would trigger Bust penalty (-10 pts at 2.0x multiplier = -20 pts locked). I would rotate to PLTR or MU if this level breaks."

### B4 — Stray top-level `watching` / `fork` / `playerAsk` (raw tool input)

| Measure | **1A-C** (primary) | 1A | 1A-CF |
|---|---|---|---|
| Calls with any of the three at top level (per call) | 242 / 386 (62.7 %) | 250 / 386 (64.8 %) | 238 / 386 (61.7 %) |
| Top-level `watching` present · value types | 242 / 386 (62.7 %) · array 242 | 250 / 386 (64.8 %) · array 250 | 236 / 386 (61.1 %) · array 236 |
| Top-level `fork` present · value types | 18 / 386 (4.7 %) · null 18 | 17 / 386 (4.4 %) · null 17 | 7 / 386 (1.8 %) · null 7 |
| Top-level `playerAsk` present · value types | 18 / 386 (4.7 %) · null 18 | 17 / 386 (4.4 %) · null 17 | 7 / 386 (1.8 %) · null 7 |
| Top-level `watching` non-empty (of all calls) | 225 / 386 (58.3 %) | 226 / 386 (58.5 %) | 225 / 386 (58.3 %) |
| …of calls where it is present | 225 / 242 (93.0 %) | 226 / 250 (90.4 %) | 225 / 236 (95.3 %) |
| Element types · elements in the check's universe | string 852 · 852 / 852 (100.0 %) | string 846 · 846 / 846 (100.0 %) | string 829 · 829 / 829 (100.0 %) |
| For comparison: calls with a non-empty KEPT `declarations.watching` · its symbols | 2 / 386 (0.5 %) · 9 | 2 / 386 (0.5 %) · 11 | 1 / 386 (0.3 %) · 6 |
| Top-level symbols also in kept `declarations.watching` | 0 / 852 (0.0 %) | 0 / 846 (0.0 %) | 0 / 829 (0.0 %) |
| Top-level symbols also among `anticipationCandidates` | 139 / 852 (16.3 %) | 134 / 846 (15.8 %) | 153 / 829 (18.5 %) |
| Top-level symbols in either | 139 / 852 (16.3 %) | 134 / 846 (15.8 %) | 153 / 829 (18.5 %) |
| Calls (non-empty top-level) overlapping `declarations.watching` · wholly inside it | 0 / 225 (0.0 %) · 0 / 225 (0.0 %) | 0 / 226 (0.0 %) · 0 / 226 (0.0 %) | 0 / 225 (0.0 %) · 0 / 225 (0.0 %) |
| Calls (non-empty top-level) overlapping `anticipationCandidates` | 90 / 225 (40.0 %) | 86 / 226 (38.1 %) | 101 / 225 (44.9 %) |
| Calls with non-empty top-level `watching` and a null/absent `declarations` block | 139 / 225 (61.8 %) | 135 / 226 (59.7 %) | 140 / 225 (62.2 %) |
| Non-null top-level `fork` · `playerAsk` (shapes) | 0 · 0 (—) | 0 · 0 (—) | 0 · 0 (—) |
| Per battle-day (calls with non-empty top-level `watching`) | all 13: 8.65 · 8 · 4.5–15.5 (≥ 1 on 13 of 13) · MC 12: 9 · 8 · 5.5–15.5 · CN 1: 4.5 · 4.5 · 4.5–4.5 | all 13: 8.69 · 9 · 5.5–11 (≥ 1 on 13 of 13) · MC 12: 8.96 · 9 · 6–11 · CN 1: 5.5 · 5.5 · 5.5–5.5 | all 13: 8.65 · 8.5 · 6–11.5 (≥ 1 on 13 of 13) · MC 12: 8.88 · 8.5 · 6–11.5 · CN 1: 6 · 6 · 6–6 |

Examples (verbatim top-level `watching` beside the kept `declarations.watching` and the candidate symbols):

1. [1A-C] d3GNk… eval_007 · momentum_chaser · rep 2 — top-level ["SNOW","ACN","GEV","PANW"] · declarations.watching [] · anticipationCandidates ["SNOW","PANW"] · declarations block null/absent
2. [1A-C] jR12B… eval_002 · momentum_chaser · rep 2 — top-level ["TXN","AMAT","NVDA","MAR"] · declarations.watching [] · anticipationCandidates ["LRCX","GME"] · declarations block null/absent
3. [1A-C] NTNj4… eval_004 · momentum_chaser · rep 1 — top-level ["MU","CRWD"] · declarations.watching [] · anticipationCandidates ["AMD","PANW"] · declarations block null/absent
4. [1A-C] jR12B… eval_014 · momentum_chaser · rep 1 — top-level ["AMD","INTC","WBD"] · declarations.watching [] · anticipationCandidates [] · declarations block null/absent
5. [1A-C] jR53k… eval_004 · momentum_chaser · rep 1 — top-level ["MU","GME"] · declarations.watching [] · anticipationCandidates ["PLTR"] · declarations block null/absent
6. [1A-C] NScUW… eval_008 · contrarian · rep 2 — top-level ["ORCL","CRWD","LRCX","META","SHOP"] · declarations.watching [] · anticipationCandidates ["MU","MSFT"] · declarations block object
7. [1A-C] lk1Cm… eval_007 · momentum_chaser · rep 2 — top-level ["MU","TXN","BE","AMAT"] · declarations.watching [] · anticipationCandidates ["BE","MU"] · declarations block object
8. [1A-C] NScUW… eval_010 · contrarian · rep 1 — top-level ["MSFT","MU","KLAC","SHOP"] · declarations.watching [] · anticipationCandidates ["MSFT"] · declarations block object

### B5 — Counterparts outside the check's universe

| Measure | **1A-C** (primary) | 1A | 1A-CF |
|---|---|---|---|
| Kept called-shot rows with a `counterpart` | 90 / 324 (27.8 %) | 41 / 297 (13.8 %) | 58 / 322 (18.0 %) |
| …outside the check's universe | 21 / 90 (23.3 %) | 9 / 41 (22.0 %) | 1 / 58 (1.7 %) |
| Calls with ≥ 1 such row (per call) | 10 / 386 (2.6 %) | 6 / 386 (1.6 %) | 1 / 386 (0.3 %) |
| Every value outside the universe (count) | TBD 7, entry 6, N/A 4, undecided 2, AMD or MAR 1, SNOW or INTC 1 | N/A 3, none 2, EMR or DHR 1, MAR or TXN (pending unlock) 1, PM or MAR 1, TBD 1 | none 1 |
| Exit rows: counterpart class | absent 151, bench (shown) 53, not in universe 14 | absent 162, bench (shown) 26, not in universe 8 | absent 150, bench (shown) 39, held 4 |
| Entry rows: counterpart class | absent 83, held 16, not in universe 7 | absent 94, held 6, not in universe 1 | absent 114, held 14, not in universe 1 |
| Outside-universe rows on a trade-invalid call | 0 | 0 | 0 |
| Per battle-day (outside-universe rows) | all 13: 0.81 · 0 · 0–3 (≥ 1 on 6 of 13) · MC 12: 0.88 · 0 · 0–3 · CN 1: 0 · 0 · 0–0 | all 13: 0.35 · 0 · 0–1.5 (≥ 1 on 5 of 13) · MC 12: 0.38 · 0 · 0–1.5 · CN 1: 0 · 0 · 0–0 | all 13: 0.04 · 0 · 0–0.5 (≥ 1 on 1 of 13) · MC 12: 0.04 · 0 · 0–0.5 · CN 1: 0 · 0 · 0–0 |

Examples:

1. [1A-C] d3T2J… eval_003 · momentum_chaser · rep 1 — `MU` entry · core (counterpart N/A) · above 1070 · `next_check` · hold — "MU trades above $1070 (upper BB extension) within the next 15 minutes, confirming NR7 breakout — I'm watching for this as a hold signal, not an exit trigger."
2. [1A-C] d3GNk… eval_012 · momentum_chaser · rep 1 — `SNOW` exit · support (counterpart undecided) · below 338.73 · `this_session` · hold — "SNOW trading below $338.73 (current entry) would signal NR7 breakout failure; I would exit if it closes below entry."
3. [1A-C] bzfCE… eval_014 · momentum_chaser · rep 2 — `SNOW` entry · core (counterpart AMD or MAR) · above 345.22 · `this_session` · act — "SNOW trades above current level ($345.22) and holds technicalScore ≥75 by 2:00 PM — would favor entry post-window."
4. [1A-C] d3GNk… eval_012 · momentum_chaser · rep 1 — `SNOW` entry · support (counterpart undecided) · above 344.91 · `next_check` · hold — "SNOW trading above $344.91 resistance would confirm NR7 breakout; I would hold through the breakout confirmation."
5. [1A-C] lwXrd… eval_007 · momentum_chaser · rep 2 — `NVDA` exit · star (counterpart TBD) · below 228.38 · `next_check` · hold — "NVDA below entry ($228.38) on the next check would signal downside squeeze break; I would exit before penalty acceleration."
6. [1A-C] DRgA4… eval_015 · momentum_chaser · rep 2 — `HOOD` exit · star (counterpart entry) · below 123.48 · `this_session` · hold — "HOOD below entry ($123.48) by close would signal failed breakout; would reconsider hold."
7. [1A-C] DRgA4… eval_006 · momentum_chaser · rep 2 — `AMD` entry · star (counterpart entry) · above 625.06 · `this_session` · hold — "AMD holds Star if it trades above $625.06 (+1.0x ATR bonus threshold) by end of session."
8. [1A-C] DRgA4… eval_006 · momentum_chaser · rep 2 — `HOOD` entry · star (counterpart entry) · above 131.22 · `this_session` · hold — "HOOD holds Star if it trades above $131.22 (+1.0x ATR bonus threshold) by end of session."

### B6 — Repeats: a kept call matching the previous sampled check's

Match = same `symbol`, `direction`, `slot` and `side`, level within 1 % of the previous level; each rep against the same rep. **Sampled checks:** 193 in 13 battles give 180 (previous, current) pairs per rep; **160 of 180 are consecutive evaluations** (eval number + 1); eval gaps: 1 160, 2 19, 4 1; 0 pairs cross an ET day.

| Measure | **1A-C** (primary) | 1A | 1A-CF |
|---|---|---|---|
| Calls with kept rows and a previous sampled check | 138 | 128 | 130 |
| …with ≥ 1 repeated call (per call) | 27 / 138 (19.6 %) | 23 / 128 (18.0 %) | 30 / 130 (23.1 %) |
| Kept rows that repeat the previous check's | 28 / 316 (8.9 %) | 27 / 292 (9.2 %) | 39 / 311 (12.5 %) |
| …on consecutive-evaluation pairs only | 23 / 280 (8.2 %) | 24 / 257 (9.3 %) | 37 / 277 (13.4 %) |
| Repeating calls on a trade-invalid result | 0 | 1 | 0 |
| Per battle-day (repeated rows) | all 13: 1.08 · 1 · 0–3.5 (≥ 1 on 11 of 13) · MC 12: 1.04 · 1 · 0–3.5 · CN 1: 1.5 · 1.5 · 1.5–1.5 | all 13: 1.04 · 0.5 · 0–5.5 (≥ 1 on 11 of 13) · MC 12: 1.08 · 0.5 · 0–5.5 · CN 1: 0.5 · 0.5 · 0.5–0.5 | all 13: 1.5 · 1 · 0–10 (≥ 1 on 8 of 13) · MC 12: 1.5 · 1 · 0–10 · CN 1: 1.5 · 1.5 · 1.5–1.5 |

Examples (previous → current, verbatim):

1. [1A-C] lk1Cm… eval_004 · momentum_chaser · rep 1 · previous sampled check eval_003 (eval gap 1, 15 min)
   - previous: `BE` entry · support (counterpart TXN) · above 300 · `next_check` · act — "BE holds above $300 (1.0x ATR from open) on the next check, I would rotate it into Support tier, swapping out TXN to capture the momentum extension."
   - current: `BE` entry · support · above 300 · `this_session` · hold — "If BE sustains above $300 (a 2.1% move from current) by end of day, I would consider swapping it into Support tier to replace a lagging position."
2. [1A-C] jR53k… eval_012 · momentum_chaser · rep 1 · previous sampled check eval_011 (eval gap 1, 15 min)
   - previous: `ETN` exit · core · below 438.18 · `this_session` · hold — "ETN holds above entry ($438.18) through session close; if it breaks below, I reassess the NR7 thesis."
   - current: `ETN` exit · core · below 438.27 · `this_session` · hold — "ETN trading below $438.27 (current level) by close would signal NR7 breakdown and warrant exit consideration."
3. [1A-C] DRgA4… eval_019 · momentum_chaser · rep 1 · previous sampled check eval_018 (eval gap 1, 15 min)
   - previous: `META` exit · core · below 725 · `this_session` · act — "META trades below $725.00 (entry -3.4%) before close, I exit Core tier to stop the bleed."
   - current: `META` exit · core · below 725 · `this_session` · act — "META trading below $725.00 (approximately -3.5% from entry, or -0.53x ATR) would trigger a defensive swap to NVDA or INTC before Bust penalty risk escalates."
4. [1A-C] lk1Cm… eval_009 · momentum_chaser · rep 1 · previous sampled check eval_008 (eval gap 1, 15 min)
   - previous: `MU` exit · star · below 1060 · `this_session` · hold — "MU will trade below $1060 (the contraction midpoint) by 2:00 PM, signaling NR7 setup failure."
   - current: `MU` exit · star · below 1065 · `this_session` · act — "MU trading below $1,065.00 (approximately -0.5x ATR from entry) would signal NR7 breakdown; I would rotate it out for AMAT or KLAC."
5. [1A-C] DRgA4… eval_011 · momentum_chaser · rep 2 · previous sampled check eval_010 (eval gap 1, 15 min)
   - previous: `HOOD` exit · star (counterpart GME) · below 123.48 · `this_session` · act — "HOOD trades below entry ($123.48) before close, I would exit to lock gains and redeploy."
   - current: `HOOD` exit · star (counterpart COIN) · below 123.12 · `this_session` · act — "HOOD trading below $123.12 (entry -0.29%) would signal NR7 failure; I would rotate to COIN."
6. [1A-C] d3GNk… eval_011 · momentum_chaser · rep 1 · previous sampled check eval_010 (eval gap 1, 15 min)
   - previous: `SNOW` entry · core (counterpart CRWD) · above 347.5 · `this_session` · act — "SNOW breaks above $347.50 by close would confirm NR7 breakout; would rotate CRWD (lowest gain, +0.19%) into the momentum."
   - current: `SNOW` entry · core · above 344.91 · `this_session` · hold — "SNOW above $344.91 resistance before close would confirm NR7 breakout and lock in momentum setup."
7. [1A-C] NTNj4… eval_009 · momentum_chaser · rep 2 · previous sampled check eval_008 (eval gap 1, 16 min)
   - previous: `AMD` exit · star (counterpart EMR) · below -4.5 · `this_session` · act — "AMD trading below -4.5% (Bust threshold) by 3:00 PM would trigger a defensive exit to EMR or DHR to protect banked points."
   - current: `AMD` exit · star (counterpart ROST) · below -4.5 · `next_check` · act — "AMD trading below -4.5% on the next check triggers exit to protect against Bust penalty."
8. [1A-C] DRgA4… eval_008 · momentum_chaser · rep 2 · previous sampled check eval_007 (eval gap 1, 15 min)
   - previous: `HOOD` exit · star · below 120.78 · `this_session` · act — "HOOD trades below $120.78 (my -1.0x ATR bust level) before day's close, I exit to protect banked points."
   - current: `HOOD` exit · star · below 119.78 · `this_session` · act — "HOOD trades below -1.0x ATR ($119.78) before close, I exit to protect the Star tier multiplier."

### B7 — Mix of kept called-shot rows

**1A-C (primary)** — calls with ≥ 1 entry row 82 / 386 (21.2 %); with ≥ 1 exit row 137 / 386 (35.5 %).

| Archetype | Rows | Direction | Symbol (shown in the prompt as) | Default | Direction × symbol | Kind (contract mapping) |
|---|---|---|---|---|---|---|
| all | 324 | exit 218, entry 106 | held 276, bench 48 | hold 187, act 137 | exit · held 218, entry · held 58, entry · bench 48 | confirmation (exit · act) 114, called_shot (entry) 106, called_shot (exit · hold) 104 |
| momentum_chaser | 304 | exit 204, entry 100 | held 258, bench 46 | hold 175, act 129 | exit · held 204, entry · held 54, entry · bench 46 | confirmation (exit · act) 107, called_shot (entry) 100, called_shot (exit · hold) 97 |
| contrarian | 20 | exit 14, entry 6 | held 18, bench 2 | hold 12, act 8 | exit · held 14, entry · held 4, entry · bench 2 | called_shot (exit · hold) 7, confirmation (exit · act) 7, called_shot (entry) 6 |

Per battle-day — entry rows: all 13: 4.08 · 3.5 · 0.5–10.5 (≥ 1 on 13 of 13) · MC 12: 4.17 · 3.5 · 0.5–10.5 · CN 1: 3 · 3 · 3–3; exit rows: all 13: 8.38 · 7 · 4.5–25 (≥ 1 on 13 of 13) · MC 12: 8.5 · 7 · 4.5–25 · CN 1: 7 · 7 · 7–7; entry rows on a held symbol: all 13: 2.23 · 2 · 0–9.5 (≥ 1 on 9 of 13) · MC 12: 2.25 · 1 · 0–9.5 · CN 1: 2 · 2 · 2–2.

**1A** — calls with ≥ 1 entry row 72 / 386 (18.7 %); with ≥ 1 exit row 125 / 386 (32.4 %).

| Archetype | Rows | Direction | Symbol (shown in the prompt as) | Default | Direction × symbol | Kind (contract mapping) |
|---|---|---|---|---|---|---|
| all | 297 | exit 196, entry 101 | held 261, bench 36 | hold 169, act 128 | exit · held 196, entry · held 65, entry · bench 36 | confirmation (exit · act) 113, called_shot (entry) 101, called_shot (exit · hold) 83 |
| momentum_chaser | 282 | exit 184, entry 98 | held 247, bench 35 | hold 166, act 116 | exit · held 184, entry · held 63, entry · bench 35 | confirmation (exit · act) 102, called_shot (entry) 98, called_shot (exit · hold) 82 |
| contrarian | 15 | exit 12, entry 3 | held 14, bench 1 | act 12, hold 3 | exit · held 12, entry · held 2, entry · bench 1 | confirmation (exit · act) 11, called_shot (entry) 3, called_shot (exit · hold) 1 |

Per battle-day — entry rows: all 13: 3.88 · 3.5 · 0.5–15 (≥ 1 on 13 of 13) · MC 12: 4.08 · 3.5 · 0.5–15 · CN 1: 1.5 · 1.5 · 1.5–1.5; exit rows: all 13: 7.54 · 6 · 2.5–23.5 (≥ 1 on 13 of 13) · MC 12: 7.67 · 4.5 · 2.5–23.5 · CN 1: 6 · 6 · 6–6; entry rows on a held symbol: all 13: 2.5 · 0.5 · 0–13 (≥ 1 on 10 of 13) · MC 12: 2.63 · 0.5 · 0–13 · CN 1: 1 · 1 · 1–1.

**1A-CF** — calls with ≥ 1 entry row 91 / 386 (23.6 %); with ≥ 1 exit row 124 / 386 (32.1 %).

| Archetype | Rows | Direction | Symbol (shown in the prompt as) | Default | Direction × symbol | Kind (contract mapping) |
|---|---|---|---|---|---|---|
| all | 322 | exit 193, entry 129 | held 275, bench 47 | hold 203, act 119 | exit · held 193, entry · held 82, entry · bench 47 | called_shot (entry) 129, called_shot (exit · hold) 104, confirmation (exit · act) 89 |
| momentum_chaser | 299 | exit 181, entry 118 | held 256, bench 43 | hold 186, act 113 | exit · held 181, entry · held 75, entry · bench 43 | called_shot (entry) 118, called_shot (exit · hold) 96, confirmation (exit · act) 85 |
| contrarian | 23 | exit 12, entry 11 | held 19, bench 4 | hold 17, act 6 | exit · held 12, entry · held 7, entry · bench 4 | called_shot (entry) 11, called_shot (exit · hold) 8, confirmation (exit · act) 4 |

Per battle-day — entry rows: all 13: 4.96 · 3 · 1–21.5 (≥ 1 on 13 of 13) · MC 12: 4.92 · 2.5 · 1–21.5 · CN 1: 5.5 · 5.5 · 5.5–5.5; exit rows: all 13: 7.42 · 6.5 · 3–22 (≥ 1 on 13 of 13) · MC 12: 7.54 · 6.5 · 3–22 · CN 1: 6 · 6 · 6–6; entry rows on a held symbol: all 13: 3.15 · 1.5 · 0–20.5 (≥ 1 on 12 of 13) · MC 12: 3.13 · 1.5 · 0–20.5 · CN 1: 3.5 · 3.5 · 3.5–3.5.

Examples (entry rows whose symbol the check showed as HELD — "entry · held" above):

1. [1A-C] bzfCE… eval_014 · momentum_chaser · rep 1 — `AMAT` entry · core (counterpart N/A) · above 514 · `this_session` · hold — "AMAT breaks above $514 (NR7 upper band) by end of day, confirming breakout."
2. [1A-C] xKLKt… eval_011 · momentum_chaser · rep 2 — `AMD` entry · star · above 632.5 · `next_check` · hold — "AMD trades above $632.50 by next check, confirming NR7 breakout."
3. [1A-C] d3T2J… eval_005 · momentum_chaser · rep 1 — `MU` entry · core · above 1079 · `next_check` · hold — "MU will trade above $1,079 (NR7 upper bound) by the next check, confirming the squeeze breakout."
4. [1A-C] DRgA4… eval_013 · momentum_chaser · rep 2 — `HOOD` entry · star · above 132.1 · `this_session` · hold — "HOOD trading above $132.10 (+0.5x ATR, +7.2% from entry) by 4:00 PM would confirm NR7 breakout and lock in the +1.0x ATR bonus path."
5. [1A-C] jR12B… eval_007 · momentum_chaser · rep 2 — `LRCX` entry · star · above 320 · `next_check` · hold — "LRCX trading above $320 by the next check would confirm NR7 breakout and extend the momentum run."
6. [1A-C] DRgA4… eval_004 · momentum_chaser · rep 1 — `ETN` entry · core (counterpart ETN) · above 445.37 · `this_session` · hold — "ETN will trade above +1.0x ATR ($445.37) by end of session if NR7 breakout confirms."
7. [1A-C] NScUW… eval_008 · contrarian · rep 2 — `MSFT` entry · support · above 510.4 · `next_check` · hold — "MSFT will hold above $510.40 (current price) through the next check as the BB squeeze prepares to release."
8. [1A-C] xKLKt… eval_010 · momentum_chaser · rep 1 — `PWR` entry · core · above 651.4 · `next_check` · hold — "PWR will hold above $651.40 through the next check as its NR7 setup matures."

### B8 — Research-objective seeds: exit calls with no usable counterpart

No usable counterpart = the `counterpart` is absent, outside the universe, a held name, or a universe name the check's bench did not show. "Narrow" counts only absent or outside-the-universe.

| Measure | **1A-C** (primary) | 1A | 1A-CF |
|---|---|---|---|
| Kept exit rows with no usable counterpart | 165 / 218 (75.7 %) | 170 / 196 (86.7 %) | 154 / 193 (79.8 %) |
| …why | absent 151, not in universe 14 | absent 162, not in universe 8 | absent 150, held 4 |
| Calls with ≥ 1 such row (per call) | 105 / 386 (27.2 %) | 107 / 386 (27.7 %) | 100 / 386 (25.9 %) |
| Seed calls on a trade-invalid result | 0 | 4 | 5 |
| **Per battle-day (seed rows)** | all 13: 6.35 · 5.5 · 1–18 (≥ 1 on 13 of 13) · MC 12: 6.42 · 5.5 · 1–18 · CN 1: 5.5 · 5.5 · 5.5–5.5 | all 13: 6.54 · 5 · 1–21.5 (≥ 1 on 13 of 13) · MC 12: 6.67 · 4 · 1–21.5 · CN 1: 5 · 5 · 5–5 | all 13: 5.92 · 5.5 · 0.5–18.5 (≥ 1 on 13 of 13) · MC 12: 6.13 · 5.5 · 0.5–18.5 · CN 1: 3.5 · 3.5 · 3.5–3.5 |
| Per battle-day (calls with ≥ 1 seed) | all 13: 4.04 · 4 · 1–9 (≥ 1 on 13 of 13) · MC 12: 4.04 · 4 · 1–9 · CN 1: 4 · 4 · 4–4 | all 13: 4.12 · 4 · 1–10.5 (≥ 1 on 13 of 13) · MC 12: 4.13 · 3.5 · 1–10.5 · CN 1: 4 · 4 · 4–4 | all 13: 3.85 · 3.5 · 0.5–11 (≥ 1 on 13 of 13) · MC 12: 3.96 · 3.5 · 0.5–11 · CN 1: 2.5 · 2.5 · 2.5–2.5 |
| Per battle-day (narrow: absent or outside the universe) | all 13: 6.35 · 5.5 · 1–18 (≥ 1 on 13 of 13) · MC 12: 6.42 · 5.5 · 1–18 · CN 1: 5.5 · 5.5 · 5.5–5.5 | all 13: 6.54 · 5 · 1–21.5 (≥ 1 on 13 of 13) · MC 12: 6.67 · 4 · 1–21.5 · CN 1: 5 · 5 · 5–5 | all 13: 5.77 · 5.5 · 0.5–18 (≥ 1 on 13 of 13) · MC 12: 5.96 · 5.5 · 0.5–18 · CN 1: 3.5 · 3.5 · 3.5–3.5 |

Examples:

1. [1A-C] lwXrd… eval_015 · momentum_chaser · rep 1 — absent — `GME` exit · star · below 23.18 · `this_session` · hold — "GME breaking below -1.0x ATR ($23.18) would trigger -10 Bust penalty before close."
2. [1A-C] DRgA4… eval_009 · momentum_chaser · rep 2 — absent — `AMD` exit · star · below 617.71 · `this_session` · act — "AMD trades below entry ($617.71) before close, I exit to lock gains and protect against Bust penalty."
3. [1A-C] lwXrd… eval_011 · momentum_chaser · rep 1 — absent — `GME` exit · star · below 24 · `next_check` · act — "GME breaks below $24.00 on the next check, I would exit before the NR7 setup fails."
4. [1A-C] DRgA4… eval_019 · momentum_chaser · rep 1 — absent — `AMD` exit · star · below 605.12 · `this_session` · hold — "AMD trading below $605.12 (approximately -2.0% from entry, or -0.28x ATR) by end of session would signal NR7 failure and warrant defensive exit."
5. [1A-C] DRgA4… eval_002 · momentum_chaser · rep 2 — absent — `HOOD` exit · star · below 120.8 · `this_session` · act — "HOOD trades below 120.8 (support level, -2% from entry) before close, I would exit to protect Star tier points."
6. [1A-C] lk1Cm… eval_005 · momentum_chaser · rep 2 — absent — `MU` exit · star · below 1060 · `next_check` · act — "MU trading below $1,060 (lower NR7 bound) on the next check would invalidate the breakout setup; I would exit for a bench alternative."
7. [1A-C] 2yNCA… eval_005 · momentum_chaser · rep 1 — absent — `SHOP` exit · star · below 149.08 · `this_session` · hold — "SHOP trading below $149.08 (entry minus 0.5x ATR) before close would signal momentum failure; I would reconsider holding."
8. [1A-C] jR53k… eval_005 · momentum_chaser · rep 1 — absent — `ETN` exit · core · below 438.18 · `this_session` · hold — "ETN trading below entry ($438.18) on the session would signal a reversal of the NR7 setup; I would evaluate a defensive exit if volume confirms."

### B9 — Tier 3 feasibility: bench-row fields, and the 40 S2 checks

**Field coverage** over every bench row the 188 bench-bearing main-sample contexts show (3121 rows; status available 2930, locked until … 191):

| Field | Rows carrying it |
|---|---|
| Sector (CSV) | 3121 / 3121 (100.0 %) |
| Daily% (CSV) | 3121 / 3121 (100.0 %) |
| ATR% (CSV) | 3121 / 3121 (100.0 %) |
| Status (CSV) | 3121 / 3121 (100.0 %) |
| Trend short/intermediate/long | 3076 / 3121 (98.6 %) |
| sma200_position | 3076 / 3121 (98.6 %) |
| Momentum divergence | 3068 / 3121 (98.3 %) |
| Momentum RSI | 307 / 3121 (9.8 %) |
| Levels | 2139 / 3121 (68.5 %) |
| Recent action | 691 / 3121 (22.1 %) |
| Volatility (BB %B, ATR regime) | 307 / 3121 (9.8 %) |
| Volume (tier, RVOL) | 307 / 3121 (9.8 %) |
| Relative strength (rsPercentile, sector RS) | 307 / 3121 (9.8 %) |
| Composite technicalScore/technicalRank | 3076 / 3121 (98.6 %) |
| mcap (fundamentals) | 3076 / 3121 (98.6 %) |
| rev growth | 3076 / 3121 (98.6 %) |
| EPS rev 30d | 3076 / 3121 (98.6 %) |
| beat rate | 3076 / 3121 (98.6 %) |
| surprise pctl | 3076 / 3121 (98.6 %) |
| PE | 2996 / 3121 (96.0 %) |
| P/B | 3076 / 3121 (98.6 %) |

mcap classes: large 3041, (none) 45, mid 35. Momentum divergence: none 2664, bullish 336, bearish 68, (none) 53.

**Every canonical directive on the two menus** (`getAllowlist`, `src/data/archetypeAdjustments.js`), classified by the stated criteria:

| Id | Canonical text | Class | Bench-row fields (recorded row format) |
|---|---|---|---|
| TF-01 | Prefer fresh breakouts over extended / late-stage entries | partial | "extended / late-stage": Trend line `sma200_position` (every row). "fresh breakout": no field (no breakout date; `Levels` resistance distance on some rows only). |
| TF-02 | Require stronger confirmation before entering | partial | "confirmation": `Volume` tier/RVOL and MACD exist only on detail rows; `Trend` short/intermediate/long and `divergence` (every row) bear on it only indirectly. |
| TF-03 | Narrow to the single strongest sector(s) | partial | "sector": CSV `Sector` (every row). "strongest": no sector-strength field on bench rows (`sector RS` on detail rows only); no sector ranking anywhere in the prompt. |
| TF-04 | Give winners more room before rotating out | not | Rotation timing for held winners — not a bench-name criterion. |
| TF-05 | Reduce position size on new entries | not | Position size — no size field on any held or bench row. |
| TF-06 | Avoid low-liquidity / thin momentum names | partial | "low-liquidity / thin": no volume or dollar-volume field on most rows; `mcap` class (fundamentals, every row) is a proxy; `Volume` tier/RVOL on detail rows only. |
| TF-07 | Lean harder on the stock's own technicals before acting | feasible | "own technicals": `Composite` technicalScore / technicalRank (every row). |
| TF-08 | Pause adds after a failed breakout | not | The agent's own failed breakouts (its history, `CLOSED TRADES THIS BATTLE` on some checks) — no per-name breakout-failure field; `Recent action` is one bar's pattern on some rows. |
| CN-01 | Require a deeper washout before entering (greater oversold depth) | partial | "oversold depth": `RSI` only on detail rows; `sma200_position` (every row) measures distance below the 200-day. |
| CN-02 | Require a clearer technical turn/stabilization before entering | partial | "turn / stabilization": `divergence` and `Trend` short vs intermediate (every row) are proxies; `Recent action` on some rows; no field names a turn. |
| CN-03 | Tighten the downside stop | not | The stop on held names — not a bench-name criterion. |
| CN-04 | Lean harder into the most out-of-favor / lagging names | feasible | "out-of-favor / lagging": `sma200_position` and `Composite` technicalScore (every row). |
| CN-05 | Take profit more eagerly into resistance | not | Profit-taking on held names into resistance (held `Levels`) — not a bench-name criterion. |
| CN-06 | Demand a stronger fundamental reason underneath the name | feasible | "fundamental reason": the FUNDAMENTALS row — rev growth, EPS rev 30d, beat rate, surprise pctl, PE vs sector median (every row). |
| CN-07 | Reduce position size on new entries | not | Position size — no size field on any held or bench row. |
| CN-08 | Hold longer for the reversal before trimming (more patient profit-taking) | not | Patience before trimming held names — not a bench-name criterion. |

**The 40 S2 checks** (momentum_chaser 37, contrarian 3): bench size 16.9 · 16 · 5–27 names. Pass counts are over every bench name shown (locked names included), for the checks of the directive's own archetype; mean · median · min–max per check.

| Directive | Class | Field-decidable part | Reading (counting only, not a proposal) | Checks | Names passing | Checks with 0 · with all |
|---|---|---|---|---|---|---|
| TF-01 | partial | "extended / late-stage" ← sma200_position (distance above the 200-day) | sma200_position ≤ +10% | 37 | 6.62 · 7 · 0–10 | 1 · 0 |
|  |  |  | sma200_position ≤ +20% | 37 | 12.51 · 12 · 2–19 | 0 · 0 |
|  |  |  | sma200_position ≤ +30% | 37 | 14.05 · 14 · 3–19 | 0 · 0 |
| TF-03 | partial | "sector" ← Sector (CSV); "strongest" has no row field — the bounds are the largest and the smallest one-sector group | keep one sector | 37 | largest group 6.24 · 5 · 2–14; smallest 1 · 1 · 1–1 (sectors on the bench 6.76 · 7 · 4–9) | — |
| TF-06 | partial | "low-liquidity / thin" ← mcap class (fundamentals; a proxy) — volume/RVOL only on detail rows | mcap = large | 37 | 16.41 · 16 · 4–26 | 0 · 21 |
|  |  |  | mcap ∈ {large, mid} | 37 | 16.59 · 16 · 4–26 | 0 · 28 |
|  |  |  | RVOL ≥ 1.0 (rows carrying RVOL only) | 37 | 0.54 · 0 · 0–3 | 26 · 0 |
| TF-07 | feasible | "the stock's own technicals" ← Composite technicalScore | technicalScore ≥ 70 | 37 | 14.32 · 15 · 3–21 | 0 · 7 |
|  |  |  | technicalScore ≥ 80 | 37 | 8.19 · 8 · 2–11 | 0 · 0 |
|  |  |  | technicalScore ≥ 90 | 37 | 0.38 · 0 · 0–2 | 24 · 0 |
| CN-01 | partial | "oversold depth" ← RSI (detail rows only); sma200_position (every row) as distance below the 200-day | RSI ≤ 30 (rows carrying RSI only) | 3 | 0 · 0 · 0–0 | 3 · 0 |
|  |  |  | sma200_position < 0 | 3 | 2.33 · 3 · 0–4 | 1 · 0 |
|  |  |  | sma200_position ≤ −10% | 3 | 1 · 1 · 0–2 | 1 · 0 |
| CN-02 | partial | "technical turn / stabilization" ← Momentum divergence (every row); Trend short vs intermediate (every row) | divergence = bullish | 3 | 1 · 1 · 0–2 | 1 · 0 |
|  |  |  | trend short = up while intermediate = down | 3 | 0 · 0 · 0–0 | 3 · 0 |
|  |  |  | either of the two | 3 | 1 · 1 · 0–2 | 1 · 0 |
| CN-04 | feasible | "out-of-favor / lagging" ← sma200_position and Composite technicalScore | sma200_position < 0 | 3 | 2.33 · 3 · 0–4 | 1 · 0 |
|  |  |  | technicalScore ≤ 70 | 3 | 3.67 · 5 · 0–6 | 1 · 0 |
|  |  |  | technicalScore ≤ 60 | 3 | 3.33 · 5 · 0–5 | 1 · 0 |
| CN-06 | feasible | "a stronger fundamental reason" ← the FUNDAMENTALS row (rev growth, EPS rev 30d, beat rate) | rev growth > 0 | 3 | 16 · 22 · 4–22 | 0 · 0 |
|  |  |  | EPS rev 30d > 0 | 3 | 11.33 · 15 · 3–16 | 0 · 0 |
|  |  |  | beat rate ≥ 75% | 3 | 14.67 · 20 · 4–20 | 0 · 0 |

Each S2 check under its own drawn directive's first reading (— = no field-decidable part):

| Battle | evalId | Archetype | Directive | Bench (locked) | Reading | Passing |
|---|---|---|---|---|---|---|
| `2yNCA…` | eval_001 | momentum_chaser | TF-06 | 15 (0) | mcap = large | 15 |
| `2yNCA…` | eval_008 | momentum_chaser | TF-08 | 15 (0) | — | — |
| `2yNCA…` | eval_016 | momentum_chaser | TF-02 | 17 (2) | — | — |
| `DRgA4…` | eval_001 | momentum_chaser | TF-02 | 27 (0) | — | — |
| `DRgA4…` | eval_011 | momentum_chaser | TF-08 | 5 (2) | — | — |
| `DRgA4…` | eval_017 | momentum_chaser | TF-02 | 23 (2) | — | — |
| `NScUW…` | eval_002 | contrarian | CN-06 | 24 (0) | rev growth > 0 | 22 |
| `NScUW…` | eval_006 | contrarian | CN-02 | 5 (1) | divergence = bullish | 0 |
| `NScUW…` | eval_008 | contrarian | CN-01 | 24 (2) | RSI ≤ 30 (rows carrying RSI only) | 0 |
| `NTNj4…` | eval_001 | momentum_chaser | TF-01 | 15 (0) | sma200_position ≤ +10% | 7 |
| `NTNj4…` | eval_010 | momentum_chaser | TF-01 | 17 (1) | sma200_position ≤ +10% | 8 |
| `NTNj4…` | eval_014 | momentum_chaser | TF-02 | 16 (1) | — | — |
| `bzfCE…` | eval_006 | momentum_chaser | TF-08 | 15 (0) | — | — |
| `bzfCE…` | eval_013 | momentum_chaser | TF-06 | 15 (1) | mcap = large | 15 |
| `bzfCE…` | eval_020 | momentum_chaser | TF-02 | 17 (2) | — | — |
| `d3GNk…` | eval_006 | momentum_chaser | TF-06 | 15 (0) | mcap = large | 15 |
| `d3GNk…` | eval_012 | momentum_chaser | TF-03 | 16 (1) | one sector (largest–smallest group) | 7–1 |
| `d3GNk…` | eval_016 | momentum_chaser | TF-03 | 16 (1) | one sector (largest–smallest group) | 7–1 |
| `d3T2J…` | eval_002 | momentum_chaser | TF-03 | 17 (0) | one sector (largest–smallest group) | 5–1 |
| `d3T2J…` | eval_013 | momentum_chaser | TF-01 | 15 (0) | sma200_position ≤ +10% | 5 |
| `d3T2J…` | eval_015 | momentum_chaser | TF-01 | 16 (1) | sma200_position ≤ +10% | 6 |
| `dZYtJ…` | eval_003 | momentum_chaser | TF-02 | 17 (2) | — | — |
| `dZYtJ…` | eval_005 | momentum_chaser | TF-08 | 17 (2) | — | — |
| `dZYtJ…` | eval_009 | momentum_chaser | TF-02 | 20 (3) | — | — |
| `dZYtJ…` | eval_015 | momentum_chaser | TF-06 | 19 (4) | mcap = large | 18 |
| `jR12B…` | eval_004 | momentum_chaser | TF-02 | 17 (2) | — | — |
| `jR12B…` | eval_007 | momentum_chaser | TF-02 | 17 (2) | — | — |
| `jR12B…` | eval_017 | momentum_chaser | TF-02 | 18 (3) | — | — |
| `jR53k…` | eval_004 | momentum_chaser | TF-02 | 5 (1) | — | — |
| `jR53k…` | eval_005 | momentum_chaser | TF-06 | 22 (1) | mcap = large | 21 |
| `jR53k…` | eval_012 | momentum_chaser | TF-08 | 23 (2) | — | — |
| `lk1Cm…` | eval_003 | momentum_chaser | TF-02 | 22 (0) | — | — |
| `lk1Cm…` | eval_007 | momentum_chaser | TF-02 | 22 (0) | — | — |
| `lk1Cm…` | eval_011 | momentum_chaser | TF-02 | 22 (0) | — | — |
| `lwXrd…` | eval_002 | momentum_chaser | TF-06 | 15 (0) | mcap = large | 15 |
| `lwXrd…` | eval_007 | momentum_chaser | TF-06 | 15 (0) | mcap = large | 15 |
| `lwXrd…` | eval_016 | momentum_chaser | TF-08 | 15 (0) | — | — |
| `xKLKt…` | eval_005 | momentum_chaser | TF-06 | 15 (0) | mcap = large | 14 |
| `xKLKt…` | eval_010 | momentum_chaser | TF-06 | 15 (0) | mcap = large | 15 |
| `xKLKt…` | eval_014 | momentum_chaser | TF-01 | 15 (0) | sma200_position ≤ +10% | 6 |

### B10 — Minted calls per declaring call

| Measure | **1A-C** (primary) | 1A | 1A-CF |
|---|---|---|---|
| Declaring calls (per call) | 142 / 386 (36.8 %) | 130 / 386 (33.7 %) | 135 / 386 (35.0 %) |
| …with 0 (watching / playerAsk only) minted | 0 / 142 (0.0 %) | 0 / 130 (0.0 %) | 0 / 135 (0.0 %) |
| …with 1 minted | 21 / 142 (14.8 %) | 24 / 130 (18.5 %) | 19 / 135 (14.1 %) |
| …with 2 minted | 71 / 142 (50.0 %) | 53 / 130 (40.8 %) | 55 / 135 (40.7 %) |
| …with 3 minted | 39 / 142 (27.5 %) | 47 / 130 (36.2 %) | 54 / 135 (40.0 %) |
| …with 4+ minted | 11 / 142 (7.7 %) | 6 / 130 (4.6 %) | 7 / 135 (5.2 %) |
| Largest | 4 | 6 | 6 |
| Rep 1 / rep 2 | rep 1 — 0: 0 · 1: 10 · 2: 36 · 3: 26 · 4+: 4; rep 2 — 0: 0 · 1: 11 · 2: 35 · 3: 13 · 4+: 7 | rep 1 — 0: 0 · 1: 10 · 2: 30 · 3: 27 · 4+: 3; rep 2 — 0: 0 · 1: 14 · 2: 23 · 3: 20 · 4+: 3 | rep 1 — 0: 0 · 1: 12 · 2: 26 · 3: 31 · 4+: 1; rep 2 — 0: 0 · 1: 7 · 2: 29 · 3: 23 · 4+: 6 |
| By archetype | contrarian — 0: 0 · 1: 1 · 2: 5 · 3: 3 · 4+: 0; momentum_chaser — 0: 0 · 1: 20 · 2: 66 · 3: 36 · 4+: 11 | contrarian — 0: 0 · 1: 3 · 2: 6 · 3: 0 · 4+: 0; momentum_chaser — 0: 0 · 1: 21 · 2: 47 · 3: 47 · 4+: 6 | contrarian — 0: 0 · 1: 2 · 2: 6 · 3: 3 · 4+: 0; momentum_chaser — 0: 0 · 1: 17 · 2: 49 · 3: 51 · 4+: 7 |
| Per battle-day (minted calls) | all 13: 12.46 · 10.5 · 5–35.5 (≥ 1 on 13 of 13) · MC 12: 12.67 · 10.5 · 5–35.5 · CN 1: 10 · 10 · 10–10 | all 13: 11.42 · 9.5 · 3.5–38.5 (≥ 1 on 13 of 13) · MC 12: 11.75 · 9.5 · 3.5–38.5 · CN 1: 7.5 · 7.5 · 7.5–7.5 | all 13: 12.38 · 9.5 · 4–43.5 (≥ 1 on 13 of 13) · MC 12: 12.46 · 8.5 · 4–43.5 · CN 1: 11.5 · 11.5 · 11.5–11.5 |
| Per battle-day (declaring calls) | all 13: 5.46 · 5 · 3.5–12.5 (≥ 1 on 13 of 13) · MC 12: 5.54 · 5 · 3.5–12.5 · CN 1: 4.5 · 4.5 · 4.5–4.5 | all 13: 5 · 5 · 2–12.5 (≥ 1 on 13 of 13) · MC 12: 5.04 · 5 · 2–12.5 · CN 1: 4.5 · 4.5 · 4.5–4.5 | all 13: 5.19 · 5 · 2–14.5 (≥ 1 on 13 of 13) · MC 12: 5.17 · 4 · 2–14.5 · CN 1: 5.5 · 5.5 · 5.5–5.5 |

Examples (declaring calls with 4 or more minted calls; their kept rows):

1. [1A-C] DRgA4… eval_006 · momentum_chaser · rep 2
   - `HOOD` exit · star (counterpart entry) · below 115.74 · `this_session` · act — "HOOD exits Star if it trades below $115.74 (Bust threshold at -1.0x ATR) by end of session."
   - `AMD` exit · star (counterpart entry) · below 575.68 · `this_session` · act — "AMD exits Star if it trades below $575.68 (Bust threshold at -1.0x ATR) by end of session."
   - `HOOD` entry · star (counterpart entry) · above 131.22 · `this_session` · hold — "HOOD holds Star if it trades above $131.22 (+1.0x ATR bonus threshold) by end of session."
   - `AMD` entry · star (counterpart entry) · above 625.06 · `this_session` · hold — "AMD holds Star if it trades above $625.06 (+1.0x ATR bonus threshold) by end of session."
2. [1A-C] 2yNCA… eval_014 · momentum_chaser · rep 2
   - `NVDA` exit · core · below 228.93 · `this_session` · hold — "NVDA trading below 228.93 (0.25x ATR reversal from peak +1.36%) would trigger exit consideration under S6 threshold-proximity rule."
   - `GME` entry · star · above 24.95 · `next_check` · hold — "GME breaking above 24.95 (upper NR7 band) would confirm bullish breakout and validate the contraction setup."
   - `AMAT` entry · core · above 515.04 · `next_check` · hold — "AMAT breaking above 515.04 (upper NR7 band) would confirm directional expansion and validate the squeeze resolution."
   - `LRCX` entry · support · above 330.3 · `next_check` · hold — "LRCX breaking above 330.30 (upper NR7 band) would confirm upside resolution of the volatility contraction."
3. [1A-C] xKLKt… eval_006 · momentum_chaser · rep 2
   - `AMD` entry · star · above 635 · `next_check` · hold — "AMD trades above $635 (upper Bollinger Band) by the next check."
   - `INTC` entry · core · above 127 · `next_check` · hold — "INTC trades above $127 (entry price) by the next check."
   - `PWR` entry · support · above 652 · `next_check` · hold — "PWR trades above $652 (+0.5x ATR from entry) by the next check."
   - `PANW` exit · core (counterpart EMR) · below 375 · `this_session` · act — "PANW trades below $375 before the close; if it does, I would evaluate exiting into EMR or HUM post-2:00 PM."
4. [1A-C] jR12B… eval_003 · momentum_chaser · rep 2
   - `LRCX` exit · star · below 320 · `this_session` · act — "LRCX trades below $320 before close, I exit to lock in the +2.94% gain."
   - `TXN` exit · core · below 279 · `this_session` · hold — "TXN breaks below $279 (–0.9% from entry), I reassess for exit to avoid Bust penalty."
   - `GME` exit · support · below 23.16 · `this_session` · act — "GME breaks below $23.16 (–0.5x ATR), the NR7 setup fails and I exit to cut losses."
   - `AMD` entry · support · above 615 · `this_session` · hold — "AMD trades above $615 and SHOP momentum stalls, I consider rotating into AMD as the sector leader."
5. [1A-C] DRgA4… eval_004 · momentum_chaser · rep 1
   - `HOOD` entry · star (counterpart HOOD) · above 130.47 · `this_session` · hold — "HOOD will trade above +1.0x ATR ($130.47) by end of session if NR7 breakout confirms."
   - `AMD` entry · star (counterpart AMD) · above 633.36 · `this_session` · hold — "AMD will trade above +1.0x ATR ($633.36) by end of session if NR7 breakout confirms."
   - `ETN` entry · core (counterpart ETN) · above 445.37 · `this_session` · hold — "ETN will trade above +1.0x ATR ($445.37) by end of session if NR7 breakout confirms."
   - `MSFT` exit · support (counterpart MU) · below 489.01 · `this_session` · hold — "If MSFT breaks below support at $489.01 (losing the squeeze setup), I would consider rotating to MU."
6. [1A-C] DRgA4… eval_005 · momentum_chaser · rep 1
   - `MU` entry · support · above 1152.36 · `this_session` · act — "MU trading above +1.0x ATR threshold ($1,152.36) by end of session would confirm momentum thesis and lock in +15 pt bonus."
   - `GOOGL` exit · support · below 355.66 · `next_check` · hold — "GOOGL trading below current price ($355.66) on next check would confirm downtrend continuation; already exited to MU."
   - `HOOD` entry · star · above 127.5 · `this_session` · hold — "HOOD breaking above $127.50 (+2.4%) would confirm NR7 breakout; holding to capture upside."
   - `AMD` entry · star · above 632.44 · `this_session` · hold — "AMD breaking above +1.0x ATR ($632.44) would confirm NR7 breakout and lock in +30 pt DoubleBagger bonus."
7. [1A-C] DRgA4… eval_013 · momentum_chaser · rep 2
   - `HOOD` exit · star (counterpart DHR) · below 122.3 · `this_session` · act — "HOOD trading below $122.30 (entry -0.93%, reversing more than 0.25x ATR from peak) before close would trigger a defensive exit to DHR."
   - `HOOD` entry · star · above 132.1 · `this_session` · hold — "HOOD trading above $132.10 (+0.5x ATR, +7.2% from entry) by 4:00 PM would confirm NR7 breakout and lock in the +1.0x ATR bonus path."
   - `AMD` entry · star · above 658.78 · `this_session` · hold — "AMD trading above $658.78 (+0.5x ATR, +6.6% from entry) by 4:00 PM would confirm NR7 breakout and lock in the +1.0x ATR bonus path."
   - `META` exit · core (counterpart COIN) · below 722.29 · `this_session` · act — "META trading below $722.29 (entry -3.9%, approaching -0.5x ATR caution zone) would trigger a defensive rotation to COIN."
8. [1A-C] bzfCE… eval_010 · momentum_chaser · rep 1
   - `CRWD` exit · star · below 265 · `this_session` · hold — "CRWD trading below $265 would signal loss of momentum; exit only if it breaks below this level before close."
   - `AMD` exit · core · below 595 · `this_session` · hold — "AMD breaking below $595 would invalidate the NR7 breakout setup; exit if support fails."
   - `MU` exit · core · below 1060 · `this_session` · hold — "MU breaking below $1060 would signal NR7 setup failure; exit if support breaks."
   - `MSFT` entry · core · above 520 · `this_session` · act — "MSFT trading above $520 with volume confirmation would trigger a swap into a bleeding core position."

<!-- END GENERATED -->

### Facts for reading the counts

- **B1/B7 — "entry" on a held name.** `direction: 'entry'` means "bring the symbol into the book" (`agentEvalToolSchema.js:260-264`), but 58 of 1A-C's 106 entry rows name a symbol the check showed as held — usually a level the held name must clear ("AMD trades above $632.50 by next check"). B1's held-excluded row and B7's "entry · held" column separate them.
- **B2 — no slot on a candidate.** The schema's candidate is `{ symbol, direction: potential_entry | potential_exit, signalSummary, threshold, rationale?, signalSource? }` (`agentEvalToolSchema.js:157-192`); production keeps all but `rationale` on the evaluation entry (`api/_utils/tickStamps.js:293-307`, written at `agent-evaluate.js:4119-4126`). A swap's incoming name takes the outgoing name's tier and position (`agentSwapExecution.js:35-41`, `:302-303`), so no data ties a candidate to a slot.
- **B4 — the stray keys are read by nothing.** `watching`, `fork` and `playerAsk` are not top-level properties of the tool (`agentEvalToolSchema.js:11-193`); the cron reads only `toolUse.input?.declarations` for calls (`agent-evaluate.js:2862`), and only from an accepted result (`:2851`); the tick capture stores the whole original tool result (`:2848-2850`).
- **B9 — the bench row format.** The CSV header is `BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status` (`agentEvalPromptAssembly.js:1495`, row `:1513`). The technical block (`:1535-1586`) draws Trend, Levels, Recent action and Composite from the symbol's `stockRankings` entry, and Momentum RSI/MACD, Volatility, Volume and Relative strength from its `stockTechnicalScores` document (`:1546-1575`) — which only some symbols have, hence the 9.8 % coverage. Fundamentals come from `fundamentalsRender.js:179`. **The classification criteria were fixed before any count:** *not* — the directive is not a criterion on bench names (exit timing, stops, sizing, the agent's own trade history); *feasible* — an entry criterion that a field on (essentially) every bench row measures directly, needing only a threshold or cut on it; *partial* — an entry criterion a row field covers only in part, on a minority of rows, or only as a proxy. The readings counted are literal field readings shown at three parameter values, not proposed filters.

---

## Open questions for the founder

Each is a decision the code cannot make. The facts behind it are in the section named.

**The screen**
1. **Which tab opens first on desktop?** If Cockpit opens first, chat messages stay counted as unread until you open Chat — the count only clears while Chat is showing. (A1)
2. **May the phone layout change?** Today the whole phone page scrolls, so the scores and THIS TURN scroll away. V4 keeps them fixed above Board and Cockpit — a change to a shipped screen. (A2)
3. **Which motion?** V4's slide (320 ms, a custom curve) and its 180 ms fade match none of the six locked motion settings; the spec says use the existing 0.3 s "smooth". Use what exists, or add or tune a locked setting? (A3)
4. **Which colours for the states?** V4 makes "your call" and "held off" purple and "dropped" copper, but the player is teal everywhere on this screen and copper is the CPU's colour, and there is no "dim". The spec maps the states differently (teal, emerald, gold, muted, amber). (A3)
5. **Banned words.** The Battle View's honesty test forbids "watching", "malformed" and "unknown" in every file there; V4's "👁 WATCHING" header and the spec's state "malformed" would fail it. Rename, or change the test? (A3)

**Answers and errors**
6. **What tells the screen a battle is cockpit-on?** The app cannot ask the server today. It can recompute the answer from its own copy of the settings, read old records (which only prove the past), or try an answer and get "unavailable". Should a small server answer decide, like the existing Backing "lit" check? (A6)
7. **Different words for different refusals?** Reusing the chip's error line would tell a player "the directive changed" for every refusal — including "your last answer hasn't been heard yet" and "no messages left". The spec's "Waiting · one call at a time" exists nowhere in the app. (A5)
8. **The mockup's controls that have no backend yet** — "Ask me first", "Keep holding off", answering a research objective, "Agree for next time" (which saves nothing for next time), and Dials. Hide them, show them disabled, or wait for Build 1b? (A11)
9. **What should "Held off" and "Asking you" say?** The records cannot prove the agent held off (Build 1a ruled there is no "held" fact), and no "asking you" state exists. (A11)
10. **Show the cost?** An answer that changes the agent's plan costs one of the battle's 10 messages. The shipped chip says so ("· 1 message"); the mockup's answer chips don't. (A7, A11)

**What round 3's data says**
11. **Is Crossroads Tier 1 worth building?** Once names already held are excluded, 5 of 386 calls (1.3 %) name two different incoming names for one slot — and none of them offers two choices for the same position. (B1)
12. **What is an "entry" on a name already held?** 58 of 106 entry calls name a stock the agent already holds — in effect "this holding breaks out". Show them as entries, or as something else? (B7)
13. **The watching list lands where nothing reads it.** The agent writes its watching list outside the field production keeps on 225 of 386 calls; the field the Monitoring tile reads is filled on 2. Accept a mostly empty Monitoring tile, or revisit the wording first (as round 3 did)? (B4)
14. **"Find the replacement" moments.** Most exit calls (151 of 218) name no replacement — about 6 per battle-day. Should those become research objectives? (B8)
15. **Replacements that aren't stocks.** 21 of 90 named replacements are "TBD", "entry", "N/A" and the like. Show nothing, or show "no replacement named"? (B5)
16. **Repeats.** About 1 call in 11 repeats the previous check's call. One tile, or a new tile each time? (B6)
17. **Tier 3 numbers.** No menu directive becomes a bench filter without choosing a number (for example "technical score at least 80"). Three can be measured on every bench name: TF-07, CN-04, CN-06. Set those numbers, and for which directives? (B9)

**The live text and the gates**
18. **Port 1A-C into the live text?** The exact 12-line change is ready and proven. It moves six test pins and stops round 3 from being re-run with its own scripts unless those are re-pinned in the same change. (A9)
19. **Which gates must open before Build 2 ships?** Grounding is `'shadow'`, the fit check is off, call records are off (rolled back Oct 1), and "held-position parity" has no written definition anywhere — what must it include? (A10)

---

## R. Review (BUILD_RULES §2)

_(Filled by the review commit.)_

---

## Reproduction

1. `git checkout claude/phase0-build2-cockpit` (the raw folder `experiments/declarations-wording/raw/round3/` must be present locally; it is git-ignored).
2. `node scripts/build2-discovery-counts.mjs > out.md` — Part B's generated block, byte for byte.
3. The A9 proof: copy `api/_utils/agentEvalToolSchema.js` to a scratch folder, apply the diff in A9, import it and `JSON.stringify(buildTradeDecisionTool({ declarations: 'on' }))` → SHA-256 `7388755a…`.
4. The mockup's sources: line 381 of `docs/design/COCKPIT_V4_MOCKUP.html` is a JSON manifest of base64, gzip-compressed resources and line 393 the page template (a JSON string); `JSON.parse` + `zlib.gunzipSync` recovers each component file A11 cites.
