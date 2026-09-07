# Phase A3 handover — the smoke fixes, Bench's shape, and A3.6 (V1)

**Date:** September 4, 2026 (evening)
**Branch:** `claude/character-pane-phase-a3-rulings-rq17ta`
**Preview branch:** **`smoke/character-pane`** — this head plus one commit, the three flag lines lit. Never merged; delete it after the PR lands.
**Base:** `8e63ea65` = `origin/main`
**Status:** built, reviewed by five lenses, refuted by a sixth, fixed, pushed. **No PR opened — the founder opens it.**
**Read first:** `docs/audits/20260904_BATTLE_VIEW_CHARACTER_PANE_A36_BUILD_REVIEW.md`. This handover says what is here; the record says what was wrong with it.

---

## 1. Executive verdict

| # | Item | Verdict |
|---|---|---|
| 1 | The three smoke fixes | **Built**, each with one root cause. F2's was a rule the repo had already written down twice. |
| 2 | Bench, sentence-first | **Built.** The ruling's own mutation reds two rows. |
| 3 | The bench-organization discovery | **Read-only. Nothing built**, as instructed. Q1 half-found, Q2 not found — §6. |
| 4 | A3.6 (D-97) | **Built** — and it shipped three P1s the review caught. |
| 5 | F2's ruled ordering | **Built** after the founder's ruling: the archetype line goes first, on a derived breakpoint. |
| 6 | The arrival fade | **"Once per mount" stands as built**, ruled; both consequences recorded at the mechanism. |
| 7 | Flag-off / pane-off | **Byte-identical**, mutation-proven, both goldens unchanged all session. |
| 8 | Fence and ratchet | **Zero §1 contact.** The §2.3 ratchet was RED from A3.2 and is fixed — §7. |
| 9 | Tests | **10,644 pass · 64 skipped · 0 failing · 606 files.** A FULL-repo figure. |
| 10 | `vite build` | Exit 0. Guards ×3 green. Goldens ×2 green. Ratchet green. |

**The headline:** A3.6's "never on mount" — the guarantee the feature rests on, stated in its own module header — was broken on every page load, and every instrument I built passed the whole time. Two independent lenses found it. Twelve of my test rows could not fail under the defect they named. And the branch had been CI-red for a session while I reported it green, because every run had been scoped to `src/`.

---

## 2. Preamble — git verification (BUILD_RULES §3)

| Item | Value |
|---|---|
| `git fetch origin` | Run first, every session. |
| Branch | `claude/character-pane-phase-a3-rulings-rq17ta`, clean tree throughout. |
| Container | Restarted once mid-session; all work was committed and pushed, nothing lost but background agents, which were re-run. |
| Test invocation | `./node_modules/.bin/vitest` — a bare `npx vitest` fetches from the registry and hangs. |
| **Scope discipline** | **Every test figure in this document is the whole repo.** The previous handover's figures were `src/`-scoped and reported as if they were the suite; that is what hid a red `api/` test for a session. |

---

## 3. The commits

| # | SHA | What |
|---|---|---|
| 1 | `4651781d` | docs: the A3 rulings, the seed, today's smoke rulings (**debt 5 closed**) |
| 2 | `2ff1b1f6` | **F1** — the pane is the desktop right column on every section |
| 3 | `ca80e009` | **F2** — box the presence face; the name never truncates |
| 4 | `8cd2d40a` | **F3** — the phone's mark is fixed to the visual viewport |
| 5 | `9fcc29bc` | drop `CharacterPane`'s dead `returnFocusRef` |
| 6 | `e30d2456` | **Bench, sentence-first** — one card per sentence, the roster as chips |
| 7 | `c16866ce` | docs: the bench-organization discovery (read-only) |
| 8 | `0705c073` | **the §2.3 ratchet** — record `CharacterPane` in the import baseline |
| 9 | `8401e89a` | **A3.6** — the bagger moment and the trade card's arrival fade |
| 10 | `a91a0aa0` | docs: ledger — D-92's shape, D-97 built |
| 11 | `41020b08` | **review fixes (1)** — three P1s and the rows that lied |
| 12 | `b145eaea` | **review fixes (2)** — the fourth lens's fifty-two mutations |
| 13 | `b954b082` | docs: the build review record |
| 14 | `20524c7c` | **F2's ruled ordering** — the archetype goes first |
| 15 | `2d6ee6e3` | the arrival fade: once per mount, ruled — recorded |
| 16 | `a0ab5dc5` | docs: the record's §7 — the refutation pass |

---

## 4. What is here

### 4.1 New modules

| File | What it owns |
|---|---|
| `battleView/ArenaHeader.jsx` | The arena (D-96). `--ft-teal` vs `--ft-copper`, the shipped `computeTugOfWarWidth` as the one seam, `VS` centred. |
| `battleView/computeTugOfWarWidth.js` | That seam, extracted so both headers share one derivation (§9). |
| `battleView/CharacterAvatar.jsx` | The mark and its bubble. Fixed to the viewport on the phone, absolute in the board column on the desktop. |
| `battleView/deriveBubble.js` | **The one construction site for a bubble** — including `baggerBubble`, after the review found a second one shipping without a colour. |
| `battleView/CharacterPane.jsx` | The pane: a real `tablist`, three panels, hidden-never-unmounted. Owns `ARCHETYPE_MIN_VIEWPORT_PX`. |
| `battleView/useCharacterPane.js` | Its machine: open/section/close, the mobile scroll lock, the desktop's open-by-default. |
| `battleView/PaneBench.jsx` · `PaneTape.jsx` · `PaneOverflow.jsx` | The three sections and the `···`. |
| `battleView/selectBench.js` | Bench, **sentence-first**: one card per sentence naming ≥1 bench symbol, chips on it. |
| `battleView/deriveBaggerMoment.js` | The crossing, from persisted `thresholdHistory` only. Pure. |
| `battleView/useBaggerMoment.js` | Its session state: the seed, the two lifetimes, the timer. |

### 4.2 New strings — all in `battleViewCopy.js`, none inline

`VS` · `Tap for the book` (desktop-only) · `The agent's pane` · `Open the agent's pane` · `{n} new` · `Chat` · `Bench` · `Tape` · `Collapse` · `Close` · `More` · `Report a bug` · `No check yet today` · `Named at the {t} check` · `{name} · equipped` · `The rest of the roster` · `Trades` · `No trades yet` · `Bookmarks · {n}` · `No bookmarks yet` · `No details available` · `Remove this bookmark` · `Activity log` · `Show the activity log` · `Hide the activity log` · **`Bagger hit · {mult}× banked`** · **`Bagger · {sym} hit +{pct}%`** · **`Bagger`**

`Not named at the {t} check` is REUSED from the existing `notNamedAtCheck` — Bench gets no second way of naming a check (D-83).

### 4.3 Tests

Twelve new files. The ones worth knowing about:

- **`useBaggerMoment.test.jsx`** — exists because the review found the hook had none while every sibling did, and it was the half carrying both P1s. Its first describe is the screen's real mount ordering: the first render has no doc.
- **`AgentBattleScreen.paneHeader.jsdom.test.jsx`** — the only harness that turns `isAgentPresenceOn` ON. Every other one mocks it false, which is how F2 shipped. Carries the 390/1280 contract and F2's ordering rows, which **import** the breakpoint and its three parts rather than restating a number.
- **`AgentBattleScreen.bagger.reducedMotion.jsdom.test.jsx`** — its own file because framer latches `prefersReducedMotion` in module scope on the first `useReducedMotion` call. A reduced-motion row sharing a file with ordinary rows is decided by which mounts first, not by the preference.
- **`viewportInset.jsdom.test.js`** — the arithmetic's edges: the negative clamp Android can produce, the rounding, and every unusable reading that would otherwise reach the style as `bottom: NaNpx`.
- **`__golden__/agentBattleScreen.controllerOn.paneOff.html`** — the A2 render photographed at `8e63ea65`. Untouched all session, and it caught two real regressions.

**Both harnesses answer each `min-width` query on its own terms.** There are two now, and one boolean for both would make the ordering rows pass at any width.

---

## 5. What the flip PR contains

**Three lines.** Nothing else.

```
src/config/featureFlags.js       BATTLE_VIEW_CHARACTER_PANE_ENABLED = false → true
src/config/characterPaneFlags.test.js   the pin moves with it
src/config/flagPinGuard.test.js         the DARK_BY_DESIGN entry is dropped
```

`flagPinGuard` couples all three: flipping one without the others reds CI with an actionable message. On `smoke/character-pane` those three lines are already lit, plus two sibling rows and the file's prose, because §2's rule is *"every test assertion **and docstring** that pins the pre-flip state"* — the accessor row asserted false-while-dark, and the header called the flag dark.

**The full repo passes with the pane lit**: 10,639 at the time the preview branch was cut, 0 failing, no render suite red.

---

## 6. The bench-organization discovery (§3 of the tasking)

Read-only. **Nothing built** — verified by a lens: no `sector` / `archetypeScore` / `fit` token anywhere in the Bench path.

- **Q1, sector per bench symbol: FOUND for part of the roster.** `createAgentBattle` stamps `sector` onto every *persisted* bench entry and the whole doc reaches the client. The hot bench and the equipped watchlist are **bare strings** — and the hot bench is rebuilt every tick, so that gap is most of the roster on most days. The client `SECTORS` map is not a substitute: 236 symbols of top-holdings coverage, and a second source for a fact the doc already carries (§9).
- **Q2, the archetype fit score: NOT FOUND**, on two independent grounds. `archetypeScore` is a whole-universe computation (its sector-diversity term reads counts across the entire input), so there is no "score this one name" call to make — and `archetypeScoring.js` is §1-fenced besides. The one reachable source returns scores for the top **ten** plus the equipped watchlist, and needs a `watchlistId` the battle doc does not carry.
- **"Ranked by composite score" is not that number.** `compositeScore` enters `archetypeScore` **inverted**, so showing one as the other would tell the player their agent likes a name for the reason it likes it least.

Full report: `docs/audits/20260904_BATTLE_VIEW_BENCH_ORGANIZATION_DISCOVERY.md`, §4 sets out the one option worth a founder line.

---

## 7. What went wrong, and what it cost

Three things worth carrying forward.

**A scoped run is not a suite.** The branch was red on `api/_utils/archetypeRegistry.test.js` for a whole session while the handover published a `src/`-only figure as the suite. The founder's first sight of it would have been a red check on a branch reported green. Every figure here is full-repo.

**Every instrument can pass while the feature is broken.** A3.6's headline guarantee failed on every load; its module header asserted the opposite; sixteen mutations the build itself ran all killed. What found it was a lens reproducing the screen's *real* mount ordering — something no harness in the tree did, because they all hand the doc over synchronously.

**A comment can be a false guard.** `TapeCards` credited the goldens with proving a branch they demonstrably do not (collapsing it leaves both green). A reader trusting that comment would have removed it. Comments that claim a test protects them are now checked like tests.

---

## 8. NOT built, deliberately

- **Bench organization** — §6. Needs a founder line before anything is built.
- **The D-14 day-grouping prerequisite** — recorded in the ledger, unreachable under fullday.
- **Double and ten baggers** — ruling 10: the same path, a different constant, ruled later.
- **From the mocks, confirmed absent:** the avatar's 420 ms brighten and badge pop; the `New` divider, `Today ·` header and `{sym} · n entries`; the dashed Assignments placeholder; the Chat tab's count pill; bench `%`; `Read · Equip`; the `Command Center` back label; the mock's own seam arithmetic; the `+` sign and glow; lower-case `vs`.

---

## 9. Debts, for separate tasking (BUILD_RULES §3)

1. **`AgentBattleScreen.jsx:289`** — the shipped A2 header mounts the presence face **unboxed**: the same defect F2 fixed in the two A3 headers. Flag-off and golden-frozen, so it belongs to a cleanup PR.
2. **`TacticalRow.jsx` is on neither guard list** and now paints token colour and `motionToken` motion. Compliant by rule and verified by hand, but hazard 42's shape one file over.
3. **`featureFlags.js:257-259`** — `LEAGUE_BATTLEVIEW_ROUTING_ENABLED`'s flip was written `= true;` where its docstring prescribes `true || (…)`, leaving an orphaned expression statement. Value right, code misleading.
4. **The bagger bonus is flat (+15), not scaled by conviction.** `{mult}` names a multiplier that was not applied to the bonus the line is about. Ruled deliberately (ruling 8), recorded because it is the same one-row-two-sources family.
5. **`viewportInsetFrom`'s `offsetTop` half is inert** — `offsetTop` changes fire `scroll`, the hook listens for `resize`, and an unchanged height bails out of the render anyway. The zoom half works.
6. **Three latent re-announce doors** in the bagger seed, all unreachable through the shipped screen — a book that grows after the seed, one that empties and refills, and a different battle swapped onto the same fiber.
7. **Repo-wide eslint false positive**: `'motion' is defined but never used` on every file using `motion.div`. A config problem that buries real findings.
8. Pre-existing lint in `TacticalRow.jsx`; Phase 0 §8's four debts; the previous handover's five.
9. **`useSessionCompositeTrail.test.jsx` fails standalone** — reproduces at `8e63ea65`, predates this branch. Task card queued.

---

## 10. For the founder, before the PR

The preview is **`smoke/character-pane`**. Look at:

1. **A tablet in portrait** (768–1170 px). This is where F2's ordering ruling now bites: the archetype line should be gone and the agent's name whole. Before the ruling the name became a vertical stack of single letters.
2. **The desktop pane on Bench and Tape** — F1. All three sections in the right column, never below the board.
3. **The phone's mark while scrolling** — F3. It should stay bottom-right in the viewport, not sail away with the board.
4. **Bench** — one card per sentence, chips on it; one `Not named at the {t} check` line and one wrapped chip row beneath.
5. **A bagger, if one occurs** — the row bursts once and stops, the footer says `Bagger hit · {mult}× banked`, the character says `Bagger · {sym} hit +{pct}%`. **Nothing should announce on a page load**; if it does, the seed is broken again.
