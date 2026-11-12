# Build report — Research modal: the two-view shell (Build 2), dark

**Run:** 2026-11-12 · **Spec of record:** `docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md` · **Design of record:** `docs/design/research-modal/RESEARCH_MODAL_DIRECTION_V2_AMENDMENT_C_20261112.md` (first commit, byte-identical) · **Branch:** `claude/research-modal-shell` · **PR:** draft, not merged · **Flag:** `RESEARCH_MODAL_SHEET_MODE = 'off'`

**Smoke (phone):** https://trade-seven-k3oqeyevx-fais-projects-bc179554.vercel.app/?sheetFixture=held_tf — and `held_cp`, `held_legacy`, `bench_incumbent`, `unexamined`, `budget_out`, `held_redzone` (opens on 💣, FQ-9) and `browse_ceg` (Constellation Energy from search, two pills, *Add to Watchlist*). The mode is forced `'on'` there; the Ask and What's moving are answered by canned *SMOKE ONLY* replies (no model, no provider).

## 1. Verdict

| | Status | What the player sees (flag on) | What they saw before |
|---|---|---|---|
| **The flag** | Built and shipped **dark**: `'off'`. With it off the modal, the battle screen and every mount render as on `main` (four kill-switch goldens unchanged). | Nothing changes until the founder's flip PRs (`'allowlist'`, then `'on'`). | — |
| **The gate** | Built (SB-2): one call, `sheetModeOn`, for every v2 mount on its displayed asset. | `'allowlist'`: the shell in an allowlisted owner's battles only. `'on'`: every stock, browse included. Crypto, index, sector ETF: today's modal at every value. | — |
| **The header** | Built (SB-3, R-27): three filled pills of equal width (two in browse); 💣 warms while the red zone or Danger Zone is live (reading 9); the day's change only; no *Why?* door. | *Analysis · Chart · 💣* under the stock row. | A *Why?* door in a one-row header. |
| **Analysis in battle** | Built (SB-5): the holding line, *What it decided · {Agent} · {Archetype} · 1:15*, the three questions (each opens its pack in place, *see on chart ›* on each pinned item), *Wall St · About*, the four tabs. | Opens on this, no chart; measured above the fold at 375×812. | A chart with a drawer of tabs. |
| **Analysis in browse** | Built (SB-6): *Ask about this stock* (today's five questions, folded), *Wall St · About*, the four tabs, the mount's own action. | The stock's facts; no partner speaks. | The same drawer. |
| **The tabs** | Built (SB-7): *What's moving · Ranks · Smart Money · Sector* — today's components, today's props; Ranks names its group and day (R-32); the strip sticks. What's moving loads on a tap. | The full content of today's tabs under the reading. | Tabs in the drawer; *Why?* as a popup. |
| **The Chart view** | Built (SB-8): the chart at full height with 1D/1W, trend lines, SMA · S/R · Idea, the record's pins; the Technical tab below. | The chart, then indicators and levels; a level tapped lights the chart. | The chart above the drawer; Technical a tab. |
| **The 💣 view** | Built (SB-9): Bomb mode as built, at the Chart view's height. | The Fuse / red zone, the bar, *What has to happen*, the levels table. | 💣 as a chart pill + the Bomb tab. |
| **The action row** | Built (SB-10): Build C's Ask (*Ask {Agent}: …*) and *→ Cockpit*, pinned under every view; the mount's action in browse. | Above Safari's toolbar (100dvh). | Build C's row in the drawer's footer (never shipped). |
| **B1** | Fixed (SB-11): the rung item's pin is the displayed rung price. | The pin's line and the fact agree to the cent ($103.78). | A cent apart ($103.77 / $103.78). |

**Ready for the founder's merge · dark · the allowlist flip is a separate founder PR.**

## 2. Founder questions, as ruled (defaults applied)

| # | Question | Ruled |
|---|---|---|
| **SQ-1** | Where does today's Technical tab content go? | Below the chart in the Chart view, same scroll; a level tapped still lights the chart. |
| **SQ-2** | Crypto, index and sector-ETF assets? | Today's layout at every flag value (R-35); their shells are a follow-up. |
| **SQ-3** | The browse Analysis tab's five preset AI questions? | Kept as one collapsed row, *Ask about this stock*, until Build D replaces them. |

## 3. Readings — built one way, put to you

1. **What's moving loads on a tap.** It is the first tab, so it mounts as the modal opens; loading it there would send `/api/why-moving` (a provider call) on every open, which this build may not add. It shows *Why is AAPL +2.28%?* and *Look it up · from the wire and the day's bar ›*; one tap sends the request the old *Why?* door sent. Round 5 A draws it already loaded.
2. **What's moving's number is the header's** (BUILD_RULES §9). Today's *Why?* popup prints the battle asset's own `percentChange` — for a held position its change since entry (+2.6% on the fixture) — under a header showing the day's change (+2.28%). The shell's tab prints (at two decimals, as the header does) and sends the day's change and the header's price, the change only once known (the rule the controlled view's popup already followed). The request's numbers are frozen at the tap, so a live tick never aborts and re-sends it (each re-send can be a provider call; review A4/B1); *Retry* is a new tap with the numbers then on screen. With the day's series failed the header shows no change pill rather than the since-entry change (review A5). The popup itself is unchanged (found on the way, §12).
3. **"The holding line, when held"** is built as Build C's stance for every kind — held, *On the bench · flagged at …*, *Looked at … · not held now* (your FQ-2 on screen), *Not examined in this game*. Its move reads Build C's *+2.4%*, not round 5's *+4.3% since entry*.
4. **Pills of equal width** — R-27's letter. Round 5 H1's drawing gives 💣 a fixed 64 px.
5. **The Ask** reads *Ask {Agent}: {question}* (R-29) with Build C's cost line *· 1 message · N left* (SB-10, "as built"), not round 5's *Ask · 1 msg*. The reply card's sending and failure lines (`AskReply.jsx`, reused unchanged) are handed the same name, so *Juno is answering…* / *Juno didn't answer* match the row (review A2); the answered card keeps *Its answer · {Archetype}* beside the agent's tag (refuter NEW-1). The row is pinned under every view, but the card lives on Analysis: an Ask sent from Chart or 💣, or one that lands while the player looks there, brings the player to Analysis; away from Analysis an asked row reads *Asked Juno · the answer is on Analysis* (review A1).
6. **Build C's crypto sheet (BC-15) is no longer reachable** (R-35): a crypto holding gets today's modal at every value until the crypto shell.
7. **Mounts with Bomb mode but no sheet** (the BaggerBomb battle view, the free-agent bar) get three pills over the browse content at `'on'`, and open on Analysis rather than their `defaultTab` 💣.
8. **The smoke's tabs read public market data**, read-only (§9). Everything else on the smoke is fixtures.
9. **R-27's "warms … in the red zone or the Danger Zone"** is read as the *live* zones: approaching, the banked moment, Danger. After the bell Bomb mode freezes the zone and greys its own chip ("the zone is never live"), so the pill stays cool (review A3). The first build warmed on `isZoneMode`, which includes the frozen views; the refuter called this a reading for you, not a defect.
10. **The shell appearing mid-modal** (a late allowlist verdict on a cold load, or an index or sector ETF → stock navigation on a bomb-context mount) re-decides the view from the timeframe today's modal was on: on the bomb series, 💣 (Chart, with the in-chart 💣 pill, when Bomb mode is rolled back); otherwise Analysis, keeping the chart's timeframe and fetching nothing (review B2). Before, Analysis sat on top of the 1-minute red-zone poll.

## 4. Commits (`claude/research-modal-shell`, cut from `origin/main` `68a237a8`; `origin/main` `c37baa0d` merged in before the final checks)

| Commit | What |
|---|---|
| `e8d3eba4` | Amendment C + rounds 4 and 5 under `docs/design/research-modal/`, byte-identical to the attachments (SHA-256 `2981cd69…`, `765e6b8c…`, `22be1069…`); the `docs/README.md` row |
| `cc699757` | The shell (SB-1–SB-14), dark |
| `3606d505` | The shell's rows; Build C's modal rows re-driven through the shell |
| `d7b0d2dd` | The spec V1 (SB-15); the fold measured in a browser |
| `339f64a1` | The no-stop row reads each text node (brief mutant 7 first survived on `textContent`'s glued words) |
| `b487a111` | Button labels sized on spans (the app forces 16 px on every `<button>`); What's moving prints the header's change |
| `f55ef1d5` | Review A1–A7, B1–B2 |
| `5674d066` | The spec after review A and B |
| `9dfb4af9` | Review D1–D5, D7, D9 |
| `7a5491f4` | Review C — rows for C1–C12 |
| `6723dbac` | Refuter A/B — an answer landing on Chart, the answered card (NEW-1), What's moving's Retry (NEW-2) |
| `ad3c73f0` | Refuter C/D — the stock row's room at 320 (NEW-D1), long About names (NEW-D2), always-run layout rows |
| `89aace35` | The spec after the refuters |
| `664cb69c` | Merge `origin/main` `c37baa0d` (#1044, docs only) |
| `af1d563d` | A1's switch at the tap — the row the re-cut mutant M26r asked for (test only) |
| *this report* | `docs/audits/20261112_BUILD_RESEARCH_MODAL_SHELL.md` |

Size (the review threshold), the PR's diff against `origin/main` `c37baa0d` before this report: 32 files, +3,714 / −663 — `src/` 27 files, +2,737 / −663 (non-test `src/`: 15 files, +1,173 / −331); `docs/` 5 files, +977 (the design files 851 of them).

## 5. The rows, as built

Counts are the final Linux suite's (§7).

| File | Rows | What it pins |
|---|---|---|
| `src/components/draft/AssetResearchModal.shell.jsdom.test.jsx` (new) | 47 | **SB-2** the gate per mount on its displayed asset: browse at each value, battle at `'allowlist'`, a late verdict, crypto (identity with the mount's own props and requests), index, sector ETF, stock → ETF → back. **SB-3** the pills (three / two, equal width, no *Why?*), the 💣 pill warm in a live zone and cool in a frozen one, no change pill when the day's series fails, `ChartHeader` byte-identical off the shell. **SB-4** opens on Analysis, FQ-9 on 💣, 1W restored on leaving 💣, no refetch on a switch. **SB-5/6** the block order in battle and browse. **SB-7** today's components with today's props, Ranks' label, the sticky strip with no scroll listener. **What's moving**: nothing on open, one POST on a tap through ticks, frozen inputs, Retry with new numbers, the foot. **SB-8** trend lines, pins, Technical below, no stop price in any text node, no technical-read strip. **SB-9**. Review C's rows C1–C12 and the refuter's always-run layout rows (the strip's spacing and padding, the label's clamp read from source, the stuck-strip pick, the stock row's gaps, the About name's ellipsis). **SB-10** in browse. |
| `src/components/draft/AssetResearchModal.sheetModeOn.jsdom.test.jsx` | 51 | Build C's rows re-driven through the shell; **B1** (*next rung · $103.78*, line and fact to the cent); the Ask pinned under every view; **A1** (an Ask from Chart brings Analysis at the tap; an answer or failure landing on Chart brings it; *the answer is on Analysis*); **A2 / NEW-1** (one speaker; the answered card keeps the archetype); the failure lines; the voice label and its time; a `sheetContext` at `'off'` identical to no context. |
| `src/components/Research/Sheet/sheetGate.jsdom.test.jsx` | 24 | Mode × mount × asset; an unknown asset is off. |
| `src/components/Research/Sheet/shellView.test.js` (new) | 17 | The state machine's pure functions. |
| `src/components/Research/Sheet/ranksLabel.test.js` (new) | 9 | The group and the day by rank kind (peer group *Independent Power* vs sector *Utilities*), *All stocks*, ET days. |
| `src/components/draft/CompeteTab.rankLabel.jsdom.test.jsx` (new) | 3 | The label rendered through CompeteTab; *All stocks*; without the prop the markup equals main's (`competeTab.offShell.golden.json`, generated from main's CompeteTab). |
| `src/components/Research/WhyMovingPopup.hook.jsdom.test.jsx` (new) | 4 | The extracted hook and body; the popup unchanged. |
| `src/components/Research/Sheet/sheetCopy.honesty.test.jsx` | 39 | `SHELL_COPY` (no *will*, no agent verbs, no *live*); the new components hold no words; no agent-name literal in `Sheet/` or `ChartHeader`; the rendered label is the battle's `agentName`. |
| `src/components/Research/Sheet/sheet.guards.test.js` | 19 | No hex, `rgb()` or inline transition in `Sheet/` (now `ShellHeader`, `ShellTabs`, `WhatsMoving`, `shellView`, `ranksLabel`) and in the modal's shell-body block. |
| `src/components/Research/Sheet/shellFold.browser.test.js` (new; replaces `sheetFold.browser.test.js`) | 10 (skipped in the suite) | Against a URL in a real browser: the fold at 375×812, 375×844, 390×844, 430×932; the strip sticky; the tabs fit at 320 and 375; a stuck strip kept on a tab change; the action row at 390×664; no sideways scroll at 320; FQ-9; browse. Run against the smoke preview in §13. |
| Kill switch, unchanged files | 4 + 4 + 8 + 4 (+ `chat.sheetModeOff` 4) | `AssetResearchModal.sheetModeOff`, `AgentBattleScreen.sheetModeOff`, `AssetResearchModal.bombModeOff`, `AgentBattleScreen.bombModeOff` goldens — test files and golden data byte-identical to main. |

## 6. The mounts (every `<AssetResearchModal` site: 19 in 17 files)

The brief counts 18 `version={2}` lines; two mounts take the default `version = 2` (`League/draft/DraftBoardRoom.jsx`, `Tournament/awaitingOpen/AwaitingOpenPodView.jsx`), and one `version={2}` hit is a comment (`WatchlistAnalysisView.jsx:456`), as is the `<AssetResearchModal` in `hooks/useAssetResearch.js:27` (a usage example). Off = today's modal. Shell (battle) = the archetype's Analysis view + Build C's action row. Shell (browse) = the stock's facts + the mount's own action. Pills: three with a `bombContext`, else two. Crypto, index and sector ETF: today's modal at every value.

| # | Mount | `'off'` | `'allowlist'` | `'on'` |
|---|---|---|---|---|
| 1–3 | `screens/AgentBattleScreen.jsx` — held (gated), non-held (gated), legacy; the cockpit bench door through them | Off | Shell (battle), 3 pills — an allowlisted owner's battle; else Off | Shell (battle), 3 pills |
| 4 | `screens/BaggerBombBattleView.jsx` (`bombContext` v4 / bench) | Off | Off | Shell (browse), 3 pills |
| 5 | `BaggerBomb/FreeAgentBar.jsx` (`bombContext` bench) | Off | Off | Shell (browse), 3 pills |
| 6 | `screens/FilmRoomScreen.jsx` (`isGameContext`, no `bombContext`) | Off | Off | Shell (browse), 2 pills |
| 7 | `BaggerBomb/AssetPickerModal.jsx` (`actionConfig`) | Off | Off | Shell (browse), its action |
| 8 | `Dashboard/Watchlist/WatchlistContainer.jsx` (*Add to Watchlist*) | Off | Off | Shell (browse), its action |
| 9 | `discover/DiscoverPanel.jsx` | Off | Off | Shell (browse) |
| 10 | `draft/CommandConsole.jsx` (Close) | Off | Off | Shell (browse), Close |
| 11 | `draft/TopPerformersModal.jsx` | Off | Off | Shell (browse) |
| 12 | `FantasyTimes/FantasyTimesFeed.jsx` | Off | Off | Shell (browse) |
| 13 | `FantasyTimes/StoryDetail.jsx` | Off | Off | Shell (browse) |
| 14 | `Forge/Watchlist/WatchlistAnalysisView.jsx` | Off | Off | Shell (browse) |
| 15 | `freeAgency/shared/FreeAgencyResearchModal.jsx` (`actionConfig`) | Off | Off | Shell (browse), its action |
| 16 | `Search/SearchDiscover.jsx` | Off | Off | Shell (browse) |
| 17 | `screens/DraftRoomScreen.jsx` (ON THE CLOCK, Acquire) | Off | Off | Shell (browse), ON THE CLOCK banner + Acquire |
| 18 | `League/draft/DraftBoardRoom.jsx` (default v2; ON THE CLOCK, Acquire, `isAcquirable`) | Off | Off | Shell (browse), ON THE CLOCK + Acquire / Close |
| 19 | `Tournament/awaitingOpen/AwaitingOpenPodView.jsx` (default v2) | Off | Off | Shell (browse), Close |

## 7. Checks (on the final code tree `af1d563d` — the build merged with `origin/main` `c37baa0d` (`664cb69c`) plus one test row)

Read from the exit-code files and the JSON reporter, never through `tail`.

| Check | Tree | Result |
|---|---|---|
| Full suite — WSL, `flock /tmp/pd-suite.lock env TZ=UTC npx vitest run --maxWorkers=8` | `af1d563d` | **exit 0** · `Test Files  1407 passed \| 9 skipped (1416)` · `Tests  30966 passed \| 99 skipped (31065)` · JSON: 0 failed files, 0 failed tests · 287 s |
| Rules suite — WSL, `TZ=UTC npm run test:rules` (JDK 21) | `af1d563d` | **exit 0** · `Test Files  41 passed (41)` · `Tests  748 passed (748)` |
| `npm run lint:gate` | `af1d563d` and `664cb69c` | **exit 0** both (`--max-warnings 0`) |
| `npm run build` (minified) | `664cb69c` | **exit 0** · built in 15.6 s · 4 CSS-minify warnings from existing stylesheets (§12) |
| `npx vite build --minify false`, head and main | `664cb69c`, `c37baa0d` | **exit 0** both · compared in §8 |
| Kill-switch goldens | `af1d563d` | pass; test files and golden data byte-identical to main |
| Mutation | `ad3c73f0` snapshot (+ the `af1d563d` row) | 68 / 68 killed (§10) |
| `shellFold.browser.test.js` against the smoke preview (`SHELL_FOLD_URL`, headless Edge) | `40422a0b` (= `ad3c73f0` + smoke) | **exit 0** · `Tests  10 passed (10)` — the fold at 375×812, 375×844, 390×844, 430×932; the strip sticky; the tabs fit at 320 and 375; a stuck strip kept on a tab change; 390×664; no sideways scroll at 320; FQ-9 and browse |
| The pushed head's build | the commit that adds this report | run on the exact pushed commit after the push (a report cannot hold its own commit's result); the result is in the PR description |

`af1d563d` adds one test row to `664cb69c`, so the builds and the dist comparison on `664cb69c` stand for it.

## 8. Flag-off build identity (unminified Linux builds, source maps excluded)

`npx vite build --minify false` of the head `664cb69c` (`~/pd-ci-shell`) and of `origin/main` `c37baa0d` (`~/pd-ci-shellk`), the same install (lock `40382e64edb6`), both exit 0. Compared with source maps excluded; `af1d563d` after it adds a test row only, which no build includes.

- **Raw:** 103 non-map lines of `diff -rq` differ — every one a renamed chunk or `index.html`, because the entry chunk's hash changed and every chunk that imports it names it.
- **Masked** (chunk hashes masked in file names *and* contents, files paired by stem): **57 files each side; 55 identical; 2 differ; none only in one side.**

| File (masked) | Size main → head | Why it differs |
|---|---|---|
| `assets/index-HASH.js` (the entry chunk) | 9,192,241 → 9,224,039 B | The modal and its new modules. Changed sources (from the map): `AssetResearchModal.jsx`, `ChartHeader.jsx`, `WhyMovingPopup.jsx` (the hook and body extracted; the popup's DOM unchanged), `CompeteTab.jsx` (the `rankLabel` prop, off by default), `researchModalFlags.js` (the docstring; the literal stays `'off'`), `Sheet/AnalysisSheet.jsx`, `Sheet/packs.js` (B1), `Sheet/sheetCopy.js`; added: `Sheet/ShellHeader.jsx`, `ShellTabs.jsx`, `WhatsMoving.jsx`, `shellView.js`, `ranksLabel.js`, and `sheetMode.js` (moved in — below). Flag-off behaviour of this chunk is held by the four kill-switch goldens and lens B's 25/25 differential. |
| `assets/AgentBattleScreen-HASH.js` | 440,663 → 440,183 B | `Sheet/sheetGate.js` changed (SB-2's battle answer, same result at every value: `sheetGate.jsdom.test.jsx`), and `Sheet/sheetMode.js` left this chunk: the modal now imports it, so Rollup hoists it into the entry chunk the battle screen already imports. |

`index.html` differs only in the entry chunk's name (`index-DnXQDk3t.js` → `index-Cy6KjETM.js`). Nothing else in the app's output changed.

## 9. The smoke branch

**Preview:** https://trade-seven-k3oqeyevx-fais-projects-bc179554.vercel.app/?sheetFixture=held_tf (Vercel deployment `success` for `40422a0b`; the served entry chunk carries this build's last strings — `data-shell-about-group`, `data-shell-voice-time`, *the answer is on Analysis* — and the *SMOKE ONLY* loader).

**Branch:** `claude/research-modal-shell-smoke` @ `40422a0b`, never merged. Two commits on the code head `ad3c73f0` (the final head's non-test `src/` is byte-identical to it: since then only docs and one test row), made by git plumbing (a temp index, `hash-object`, `commit-tree`, `update-ref`; this tree and its index untouched) and pushed with `--force-with-lease`:

| Commit | What |
|---|---|
| `9968a91e` | *SMOKE ONLY, NEVER MERGE*: `RESEARCH_MODAL_SHEET_MODE` forced `'on'` (1 file, +2 / −1) |
| `40422a0b` | *SMOKE ONLY, NEVER MERGE*: the `?sheetFixture=` loader in `src/main.jsx`, `src/smoke/ShellSmokeScreen.jsx` and `src/smoke/sheetFixtures.battles.json` (Build C's committed fixtures) |

**What it reads.** Battle, user, agent and chat records: none — the battles are Build C's committed fixtures, shaped from real battle documents by the corrected-battle harness. Series, quotes and profiles are generated on the page. The Ask is answered by a canned reply marked *SMOKE ONLY* (no model call, no budget charged); What's moving by a canned explanation marked *SMOKE ONLY* (no provider call). The clock is the fixture's instant, Wed Oct 14 2026, 1:07 PM ET. The Ranks, Smart Money and Sector tabs are today's components and read what they read today — public market data only, read-only (`/api/stocks/peer-rankings`, `/api/stocks/sector-rankings`, and the read-if-true market documents `indexIntelligence/stockRankings`, `stockTechnicalScores/{SYM}`, `institutionalHoldings/{SYM}`) — so their real content shows.

**States:** `held_tf`, `held_cp`, `held_legacy`, `bench_incumbent` (opens on a pack), `unexamined`, `budget_out`, `held_redzone` (AAPL at $103.40, 0.36 % under +30, market open: opens on 💣, FQ-9), `browse_ceg` (Constellation Energy from search, two pills, *Add to Watchlist*). Measurement parameters, smoke only: `&name=` the agent's name, `&arch=` the archetype, `&long=1`, `&bomb=0`, `&delay=N`, `&fail=1`.

## 10. Mutation

**68 mutants, 68 killed, 0 survived** — judged by the test run's **exit code**, on an LF `git archive` snapshot of `ad3c73f0` (the final head's `src/` is byte-identical apart from the one row added for M26r). One mutant at a time: the anchor must match exactly once (else BROKEN), the listed test files run (a baseline of every listed file on the unmutated tree first: 208 passed), the original bytes are restored and proved by SHA-256 — 68 of 68 restored.

- **The brief's mutations 1–7** are M1–M7, with 7 twice (M7 a stop price string, M7b a stop price line). M7 survived the first battery: `textContent` glued *Idea* and *Stop* into one word, so the row now reads each text node (`339f64a1`).
- **M8–M35** pin the build's own promises and the review A/B/D fixes; **MC01–MC22** are lens C's holes, one per promise it found unpinned; **MR1–MR10** pin the refuters' findings.
- **Re-runs.** The WSL lint and builds ran beside part of the first battery, so the 26 mutants that ran in that window (M9–M35) were run again with the host quiet: 26 of 26 killed. Three anchors had moved under the refuter fixes (M26, M27, MC18 — BROKEN, 0 matches); each was re-cut on the final code (M26r, M27r, MC18r). **M26r survived its first run**: the refuter fix that brings the player to Analysis when an answer lands produced the same end state, so no row held the Ask in flight. A row now does (`af1d563d`, *the switch is at the tap*), and M26r is killed by it.
- Each row's "first failing row" is the first row the runner printed, truncated.

| id | brief | the defect planted | file | verdict | first failing row |
|---|---|---|---|---|---|
| M1 | 1 | the browse mount resolves on at 'allowlist' | `Research/Sheet/sheetMode.js` | **KILLED** (exit 1) | SB-2 — every v2 mount resolves the shell through sheetModeOn, on its displayed asset > browse: 'off' and 'allowlist' are |
| M2 | 2 | a crypto asset gets the shell | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | SB-2 — every v2 mount resolves the shell through sheetModeOn, on its displayed asset > R-35: a crypto battle mount with  |
| M3 | 3 | the Why door renders under the shell | `Research/ChartHeader.jsx` | **KILLED** (exit 1) | SB-3 — the header control (H1): filled pills of equal width; no Why? door > the Why? door is gone under the shell (What' |
| M4 | 4 | the Analysis view fetches on open (What's moving asks on mount) | `Research/Sheet/WhatsMoving.jsx` | **KILLED** (exit 1) | §3: no new price request — the shell reads what the modal already loads > the shell in battle vs mode off on the same 1D |
| M5 | 5 | the Ranks label drops the date | `Research/Sheet/sheetCopy.js` | **KILLED** (exit 1) | CompeteTab rankLabel (R-32) > names the selected badge's group and day — the peer group for the fundamental rank, the se |
| M6 | 6 | the pin uses go.rung.price again (B1) | `Research/Sheet/packs.js` | **KILLED** (exit 1) | BC-8 — the record on the Chart view, one label open; "see on chart ›" opens an item's pin there > a rung item draws its  |
| M7 | 7 | a stop price string appears in the Chart view | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | SB-8 — the Chart view: the full-canvas chart with its trend lines and pins, the Technical content below > no stop price  |
| M8 |  | leaving 💣 always restores 1D | `Research/Sheet/shellView.js` | **KILLED** (exit 1) | SB-4 — three views, one at a time; the state machine > 💣 sets the timeframe 'bomb'; leaving it restores the Chart view' |
| M9 |  | the strip is not sticky | `Research/Sheet/ShellTabs.jsx` | **KILLED** (exit 1) | SB-7 — the tab strip: today's components, today's props; sticky, no scroll listener > the strip sticks under the header  · quiet re-run: KILLED exit 1 |
| M10 |  | 'on' needs an agent battle again (browse off at 'on') | `Research/Sheet/sheetMode.js` | **KILLED** (exit 1) | SB-2 — every v2 mount resolves the shell through sheetModeOn, on its displayed asset > browse: 'off' and 'allowlist' are · quiet re-run: KILLED exit 1 |
| M11 |  | the battle screen's answer drops its battle-id guard | `Research/Sheet/sheetGate.js` | **KILLED** (exit 1) | useSheetModeForBattle > 'on' answers on for an agent battle and asks nothing; no battle id → off · quiet re-run: KILLED exit 1 |
| M12 |  | the 💣 pill warms while it is the active one | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1) | SB-3 — the header control (H1): filled pills of equal width; no Why? door > the 💣 pill warms only while the view model  · quiet re-run: KILLED exit 1 |
| M13 |  | the 💣 pill never warms | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | SB-3 — the header control (H1): filled pills of equal width; no Why? door > the 💣 pill warms only while the view model  · quiet re-run: KILLED exit 1 |
| M14 |  | FQ-9 dropped: the shell always opens on Analysis | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | FQ-9 (2026-11-08) — with Bomb mode on, a measured held stock in the red zone at OPEN opens on 💣 > inside the band ($103 · quiet re-run: KILLED exit 1 |
| M15 |  | see on chart toggles the open item closed | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | BC-8 — the record on the Chart view, one label open; "see on chart ›" opens an item's pin there > the Chart view draws t · quiet re-run: KILLED exit 1 |
| M16 |  | a time pin on 1W keeps the chart on 1W | `Research/Sheet/shellView.js` | **KILLED** (exit 1) | BC-8 — the record on the Chart view, one label open; "see on chart ›" opens an item's pin there > a time pin on 1W: the  · quiet re-run: KILLED exit 1 |
| M17 |  | What's moving's foot names no one in battle | `Research/Sheet/WhatsMoving.jsx` | **KILLED** (exit 1) | What's moving — the Why? popup's content inline, loaded on a tap, never on open > opening the modal sends no explanation · quiet re-run: KILLED exit 1 |
| M18 |  | a sheetContext at 'off' turns the shell on (the modal trusts the prop, not the mode) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | mode off: the builder is never called > a sheetContext handed over at 'off' is ignored: the modal reads the mode itself  · quiet re-run: KILLED exit 1 |
| M19 |  | the Analysis view unmounts while hidden (its tab reloads on return) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | SB-4 — three views, one at a time; the state machine > no refetch on a view switch: Analysis ↔ Chart asks the hook for n · quiet re-run: KILLED exit 1 |
| M20 |  | the Ask is addressed to the archetype, not the agent (R-29) | `Research/Sheet/AnalysisSheet.jsx` | **KILLED** (exit 1) | BC-1 — the mount opens on the Analysis view: 1D, no chart, the archetype speaking > Layer 0 on open, the 1D series reque · quiet re-run: KILLED exit 1 |
| M21 |  | the voice label drops the agent's name (R-23) | `Research/Sheet/AnalysisSheet.jsx` | **KILLED** (exit 1) | BC-1 — the mount opens on the Analysis view: 1D, no chart, the archetype speaking > Layer 0 on open, the 1D series reque · quiet re-run: KILLED exit 1 |
| M22 |  | the rank label always reads All stocks for the technical rank | `Research/Sheet/ranksLabel.js` | **KILLED** (exit 1) | CompeteTab rankLabel (R-32) > names the selected badge's group and day — the peer group for the fundamental rank, the se · quiet re-run: KILLED exit 1 |
| M23 |  | browse shows the five preset questions unfolded | `Research/Sheet/AnalysisSheet.jsx` | **KILLED** (exit 1) | SB-5, SB-6 — the Analysis view: an ordered list of blocks (R-34) > in browse: the folded preset questions, the Wall St · · quiet re-run: KILLED exit 1 |
| M24 |  | the Chart view's plot keeps the old fixed chart height | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | the Chart view's skeleton and error box stand in for the whole chart — its 44 px control row and its plot (after review  · quiet re-run: KILLED exit 1 |
| M25 |  | What's moving prints the battle asset's own percentChange (§9: the header's change) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | SB-3 — the header control (H1): filled pills of equal width; no Why? door > the header's change is the day's only: with  · quiet re-run: KILLED exit 1 |
| M7b | 7 | a stop price line titled on the Chart view | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | SB-8 — the Chart view: the full-canvas chart with its trend lines and pins, the Technical content below > no stop price  · quiet re-run: KILLED exit 1 |
| M26r |  | A1: an Ask from Chart / 💣 stays on that view (its card hidden) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | BC-7 — the Ask > the switch is at the tap: while an Ask sent from Chart is in flight, its card already shows on Analysis · re-cut as M26r (the refuter fixes moved its anchor); first run SURVIVED (exit 0); killed by the row added after it |
| M27r |  | A2: the reply card names the archetype while the row names the agent | `Research/Sheet/AnalysisSheet.jsx` | **KILLED** (exit 1) | BC-7 — the Ask > while it is answering, the row and the card name the same speaker (review A2) · re-cut as M27r (the refuter fixes moved its anchor) |
| M28 |  | A3: a shut market's frozen red zone warms the pill | `Research/Sheet/shellView.js` | **KILLED** (exit 1) | SB-3 — the header control (H1): filled pills of equal width; no Why? door > a shut market's frozen zone never warms the  · quiet re-run: KILLED exit 1 |
| M29 |  | A4/B1: What's moving's request follows the live props (re-sent on every tick) | `Research/Sheet/WhatsMoving.jsx` | **KILLED** (exit 1) | What's moving — the Why? popup's content inline, loaded on a tap, never on open > one tap is ONE request: live ticks whi · quiet re-run: KILLED exit 1 |
| M30 |  | A5: the header's change falls back to the asset's own percentChange | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1) | SB-3 — the header control (H1): filled pills of equal width; no Why? door > the header's change is the day's only: with  · quiet re-run: KILLED exit 1 |
| M31 |  | A7: What's moving's title at one decimal beside the header's two | `Research/Sheet/sheetCopy.js` | **KILLED** (exit 1) | What's moving — the Why? popup's content inline, loaded on a tap, never on open > opening the modal sends no explanation · quiet re-run: KILLED exit 1 |
| M32 |  | B2: the shell appearing mid-modal always shows Analysis (over the bomb series) | `Research/Sheet/shellView.js` | **KILLED** (exit 1) | SB-2 — every v2 mount resolves the shell through sheetModeOn, on its displayed asset > the shell appearing on an open mo · quiet re-run: KILLED exit 1 |
| M33 |  | D2: the quote's time shrinks with the name (cut first) | `Research/Sheet/AnalysisSheet.jsx` | **KILLED** (exit 1) | the latest sentence and the label keep the fold with a long sentence and a long name (after review D3) > the quoted sent · quiet re-run: KILLED exit 1 |
| M34 |  | D9: a raw hex in the modal's shell body | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | the sheet's modules carry no colour literal and no inline motion > AssetResearchModal.jsx — the shell's body block: zero · quiet re-run: KILLED exit 1 |
| M35 |  | D9: a raw hex in the shell header (now guarded) | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1) | the sheet's modules carry no colour literal and no inline motion > ShellHeader.jsx: zero hex, zero rgb()/rgba(), zero tr · quiet re-run: KILLED exit 1 |
| MC01 |  | C1: the Analysis box stays displayed under Chart and 💣 | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C1: one view on screen at a time — the Analysis box is hidden under |
| MC02 |  | C2: What's moving keeps one instance across stocks (no key) | `Research/Sheet/ShellTabs.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C2: stock → stock inside the shell: the header's back arrow, the An |
| MC03 |  | C2: no scroll reset for a stock reached by navigation | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C2: stock → stock inside the shell: the header's back arrow, the An |
| MC04 |  | C2: the shell header loses its back arrow | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C2: stock → stock inside the shell: the header's back arrow, the An |
| MC05 |  | C3: the header's ✕ does not close | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C3: the header's ✕ closes the modal; its change pill points down on |
| MC06 |  | C3: the change arrows swapped | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C3: the header's ✕ closes the modal; its change pill points down on |
| MC07 |  | C4: Acquire hidden under the shell | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C4: a draft mount under the shell keeps ON THE CLOCK and Acquire; t |
| MC08 |  | C4: ON THE CLOCK hidden under the shell | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C4: a draft mount under the shell keeps ON THE CLOCK and Acquire; t |
| MC09 |  | C5: a Bomb-only mount gets two pills | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C5: a mount with Bomb mode but no sheet (the free-agent bar, the Ba |
| MC10 |  | C5: a Bomb-only mount opens the hook on the bomb series | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C5: a mount with Bomb mode but no sheet (the free-agent bar, the Ba |
| MC11 |  | 💣 → Analysis leaves the hook on the bomb series | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C6: after an FQ-9 open on 💣 (in the red zone, on its minute series |
| MC12 |  | C6: the Chart view starts its memory on 1W | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C6: after an FQ-9 open on 💣 (in the red zone, on its minute series |
| MC13 |  | C6: a price pin on 1W moves the chart to 1D | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C6b: a price pin on 1W keeps the chart on 1W (its line is drawn the |
| MC14 |  | C7: the view is never measured (plots on the floor) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C7: the Chart and 💣 plots take the view's MEASURED height (a 600 p |
| MC15 |  | C8: the technical rank named by the peer group | `Research/Sheet/ranksLabel.js` | **KILLED** (exit 1) | CompeteTab rankLabel (R-32) > names the selected badge's group and day — the peer group for the fundamental rank, the se |
| MC16 |  | C8: the universe technical rank never reaches the label | `draft/CompeteTab.jsx` | **KILLED** (exit 1) | CompeteTab rankLabel (R-32) > the technical badge on the universe rank (no sector rank in the doc): "All stocks", at the |
| MC17 |  | C8: CompeteTab's markup changes for every caller | `draft/CompeteTab.jsx` | **KILLED** (exit 1) | CompeteTab rankLabel (R-32) > absent (every caller but the shell): no label, and the markup is main's CompeteTab's, byte |
| MC18r |  | C9: What's moving's Retry does nothing | `Research/Sheet/WhatsMoving.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C9: What's moving after a failed answer: its Retry asks again; a ba · re-cut as MC18r (the refuter fixes moved its anchor) |
| MC19 |  | C9: the foot drops the archetype when no agent is named | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C9: What's moving after a failed answer: its Retry asks again; a ba |
| MC20 |  | C10: the legacy in-chart 💣 pill gone with Bomb mode rolled back | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C10: Bomb mode rolled back under the shell: two pills, and the Char |
| MC21 |  | C11: a crypto battle mount opens the hook on 1D | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | SB-2 — every v2 mount resolves the shell through sheetModeOn, on its displayed asset > R-35: a crypto battle mount with  |
| MC22 |  | C12: browse not sized from the visible viewport | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > C12: a browse mount on a phone under the shell is sized from the vi |
| MR1 |  | refuter A1: an answer landing on Chart leaves the player there | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1) | BC-7 — the Ask > an answer — or a failed turn — that lands while the player looks at Chart brings them to its card; away |
| MR2 |  | refuter A1: away from Analysis the row still says "the answer is below" | `Research/Sheet/AnalysisSheet.jsx` | **KILLED** (exit 1) | BC-7 — the Ask > an answer — or a failed turn — that lands while the player looks at Chart brings them to its card; away |
| MR3 |  | refuter NEW-1: the answered card handed the agent name too | `Research/Sheet/AnalysisSheet.jsx` | **KILLED** (exit 1) | BC-7 — the Ask > the answered card keeps "Its answer · {Archetype}" beside the agent's tag — the agent named once (refut |
| MR4 |  | refuter NEW-2: Retry re-sends the first tap's numbers | `Research/Sheet/WhatsMoving.jsx` | **KILLED** (exit 1) | review C — the promises the first rows did not pin > Retry is a new tap: it sends the change and price on screen at the  |
| MR5 |  | refuter D1: the strip back on 18 px gaps and 16 px sides | `Research/Sheet/ShellTabs.jsx` | **KILLED** (exit 1) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) > D1 / D4: the strip spans the  |
| MR6 |  | refuter D4: no per-tab padding (tap box = label) | `Research/Sheet/ShellTabs.jsx` | **KILLED** (exit 1) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) > D1 / D4: the strip spans the  |
| MR7 |  | refuter D1: the label clamp removed | `Research/Sheet/ShellTabs.jsx` | **KILLED** (exit 1) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) > D1 / D4: the strip spans the  |
| MR8 |  | refuter D3: no scroll back to a stuck strip on a tab pick | `Research/Sheet/ShellTabs.jsx` | **KILLED** (exit 1) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) > D3: a tab picked while the st |
| MR9 |  | refuter D7: a long About name cannot ellipsize | `Research/Sheet/AnalysisSheet.jsx` | **KILLED** (exit 1) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) > D6 / D7: the stock row gives  |
| MR10 |  | refuter D6: the stock row back on 8 px gaps | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) > D6 / D7: the stock row gives  |

## 11. The review (BUILD_RULES §2)

**Threshold:** met — 32 files and 4,377 changed lines against ≥10 files or ≥1,500 lines.

**How it ran.** Four lenses on `b487a111`, each on its own `git archive` snapshot under the scratchpad (read-only on git and on this tree): **A** display honesty, **B** wiring and the flag-off path, **C** test integrity (the mutating lens, last, on its own tree), **D** phone layout, tokens and motion (headless Edge at 320–430 px against a local build and the Vercel preview). Then two refuters on fresh snapshots of `7a5491f4` (the fixes), each told to refute every finding at `b487a111` with a concrete repro and to re-check each fix: **R1** for A and B, **R2** for C and D. A last round of fixes (`6723dbac`, `ad3c73f0`) answered the refuters; every fix carries a row, and every row a mutant (§10).

**Split:** 34 findings — **34 CONFIRMED, 0 REFUTED** (C1, C6 and C7 confirmed in part: four of their variants were already caught by existing rows, recorded below). The refuters found **5 new defects** in the fixes, all fixed. Lens B's off-path differential (head beside base copies of the modal, `ChartHeader` and `WhyMovingPopup`, at `'off'` with Bomb mode on and off, 25 mount kinds and steps, `innerHTML` + every request + every chart call) found **25/25 identical**, with a control row at `'on'` that differs.

| # | Lens · severity | Finding at `b487a111` | Refuter | Disposition | Pinned by |
|---|---|---|---|---|---|
| A1 | A · **must-fix** | The Ask row is pinned under every view, but its reply and failure cards live in the Analysis box, hidden on Chart and 💣. A 504 from Chart left *"Something went wrong… a message may have been used"* invisible and the row ready for a second paid tap; an answer read *the answer is below* over no answer. | R1 CONFIRMED; the first fix **incomplete** — an Ask from Analysis answered while the player is on Chart still hid its card | Fixed (`f55ef1d5`, `6723dbac`): an Ask from Chart or 💣 goes to Analysis first; an answer or failure that lands off Analysis brings the player there; away from Analysis an asked row reads *Asked Juno · the answer is on Analysis* | 3 rows; M26r, MR1, MR2 |
| A2 | A · should-fix | The row said *Juno is answering…* while the card said *Trend Follower is answering…* | R1 CONFIRMED; the fix introduced **NEW-1** | Fixed (`f55ef1d5`): the card's sending and failure lines take the agent's name | M27r, M20 |
| NEW-1 | R1 · new | The A2 fix also renamed the answered card: *Its answer · Juno* plus a *Juno* tag, no archetype | — | Fixed (`6723dbac`): only the sending and failure lines are renamed; the answered card keeps *Its answer · Trend Follower* | MR3 |
| A3 | A · should-fix | The 💣 pill warmed in the frozen `closed` / `dangerClosed` modes, while Bomb mode greys its own chip there | R1 CONFIRMED as behaviour; "a reading for you" (R-27 then named `isZoneMode`) | Built as reading 9: live zones only (`isLiveZoneMode`); the spec changed with it | M28, M13, M12 |
| A4 = B1 | A should-fix · B **must-fix before the flag leaves `'off'`** | What's moving's request followed the live `dailyChange`: each tick aborted and re-sent `/api/why-moving` (4 POSTs for one tap and three ticks; worse after an error), each re-send possibly a provider call | R1 CONFIRMED; the fix introduced **NEW-2** | Fixed (`f55ef1d5`): the request's numbers are frozen at the tap | M29, M4 |
| NEW-2 | R1 · new | *Retry* re-sent the first tap's numbers under a header that had moved | — | Fixed (`6723dbac`): Retry is a new tap and re-freezes | MR4, MC18r |
| A5 | A · should-fix | With the day's series failed, the shell header showed the battle asset's since-entry change as the day's (▲ 2.63% for 2.28%) | R1 CONFIRMED | Fixed (`f55ef1d5`): no change pill until the day's change is known; a flat day shows ▲ 0.00% | M30 |
| A6 = B4 | A note · B note | The request paired the live change with the price from when the modal opened | R1 CONFIRMED | Fixed (`f55ef1d5`): the header's price, frozen with the change | row (price 104 with change 3.07) |
| A7 | A · note | Title at one decimal beside the header's two (+2.3% / ▲ 2.28%) | R1 CONFIRMED | Fixed (`f55ef1d5`): two decimals | M31 |
| A8 | A · note | *see on chart ›* holds an item by its index: a tick that reshuffles the pack moves the chart's caption to another item with no tap | R1 CONFIRMED (repro A8b), not fixed | Reported (§12): Build C's index state, exposed by the shell | — |
| A9 | A · note | The sheet's price lines are not part of the candle series' autoscale; a line outside the bars' range can be off the pane | R1 CONFIRMED by source (lightweight-charts 5.1.0) | Reported (§12) | — |
| A10 | A · note | A flagged-only name reads *What it decided* on Analysis and *What it flagged* on the Chart caption | R1 CONFIRMED, not fixed | Reported (§12): Build C's wording | — |
| B2 | B · should-fix | The shell turning on mid-modal (a late allowlist verdict, an index/ETF → stock navigation) showed Analysis over the bomb series — the 1-minute red-zone poll ran behind it | R1 CONFIRMED (B2-late, B2-harm, B2-etf, B2-rollback) | Fixed (`f55ef1d5`): reading 10 | M32; 3 rows |
| B3 | B · note | With Bomb mode rolled back, Chart → legacy in-chart 💣 → Analysis → Chart lands on 1D | R1 CONFIRMED, not fixed | Reported (§12): rollback configuration only | — |
| C1 | C · **must-fix** | "One view at a time" unpinned: rows read the wrapper's `data-shell-view`, not which box shows | R2 CONFIRMED in part (Chart-under-💣 already caught) | Row added (`7a5491f4`) | MC01 |
| C2 | C · **must-fix** | Stock → stock inside the shell unpinned: without `key={symbol}` What's moving POSTs the old stock with no tap; the back arrow and scroll reset unpinned | R2 CONFIRMED | Rows added | MC02, MC03, MC04 |
| C3 | C · **must-fix** | The header's ✕ and its change arrow unpinned | R2 CONFIRMED; C3a (✕ after a navigation) still open | Rows added | MC05, MC06 |
| C4 | C · should-fix | Draft mounts (ON THE CLOCK, Acquire, Close) had no row under the shell | R2 CONFIRMED | Rows added | MC07, MC08 |
| C5 | C · should-fix | Bomb-only mounts (no `sheetContext`) never rendered at `'on'` | R2 CONFIRMED | Rows added | MC09, MC10 |
| C6 | C · should-fix | State-machine edges: leaving 💣 after FQ-9, a price pin on 1W, the 1W test comparing a colour with itself | R2 CONFIRMED for the wiring; **REFUTED** for C6b/C6c (the `shellView.test.js` unit rows already killed them) | Rows added | MC11, MC12, MC13 |
| C7 | C · should-fix | The plot's measured height never exercised (jsdom measures 0, every row on the 240 floor) | R2 CONFIRMED in part (C7a already killed); C7b (re-measure on resize) still open | Row with a 600 px view → 484 px | MC14, M24 |
| C8 | C · should-fix | Ranks label: fixtures used *Utilities* for both group and sector; no row compared CompeteTab off the shell with main | R2 CONFIRMED; the golden's provenance checked (main's blob) | Rows + `competeTab.offShell.golden.json` generated from main's CompeteTab | MC15, MC16, MC17 |
| C9 | C · should-fix | What's moving's Retry and the foot's archetype fallback unpinned | R2 CONFIRMED | Rows added | MC18r, MC19 |
| C10 | C · should-fix | Bomb mode rolled back under the shell never tested | R2 CONFIRMED | Row added | MC20 |
| C11 | C · should-fix | The R-35 crypto identity row left out the battle mount's own props | R2 CONFIRMED; the request comparison does not record `getVolatilityThresholds` | Row extended | MC21 |
| C12 | C · note | Reduced motion, S/R reset on leaving Chart, browse at 100dvh unpinned; the agent-name scan matched two names only | R2 CONFIRMED; A13/A14 still unpinned | 100dvh row added (MC22); the agent-name row's title now names the two names it scans (*Shadow*, round 5's sample; *Juno*, the fixtures') — the label itself is pinned to read the battle's `agentName` | MC22 |
| D1 | D · should-fix | At 320 the four tabs overflowed and *Sector* read *Secto* | R2 CONFIRMED; holds after the fix (7.3 px slack at 320, ≥34 at 375; Verdana would overflow) | Fixed (`9dfb4af9`): labels `clamp(12px, 3.6vw, 13.5px)`, 6 px gaps, 10 px sides | MR5, MR7 |
| D2 | D · should-fix | The voice label was one ellipsis span, so the quote's time was cut first | R2 CONFIRMED; holds (the time is always whole) | Fixed: the time in its own span that never shrinks | M33 |
| D3 | D · should-fix | A tab change while the strip was stuck threw the view back up (strip 110 → 538) | R2 CONFIRMED; holds | Fixed: the tab body keeps the view's height; a pick scrolls back to a stuck strip | MR8, MC14 |
| D4 | D · should-fix | Each tab's tap box was only its label (Ranks 36 px) | R2 CONFIRMED; holds (44×44) | Fixed: per-tab padding | MR6 |
| D5 | D · note | Small targets: pack back 28×32, header back 32 px, ✕ 40 px, no aria-labels | R2 CONFIRMED; holds (36×44, 36×44, 44×44, *Back* / *Close*) — and made D6 worse (NEW-D1) | Fixed | C2/C3 rows |
| D6 | D · note | At 320 only the name shrinks in the stock row; a long symbol + price + change + back arrow pushed ✕ past the edge | R2 CONFIRMED; **worse after D5** | See NEW-D1 | — |
| NEW-D1 | R2 · new | After D5, GOOGL $1,234.56 ▼ 12.34% with a back arrow clipped ✕ by 4.1 px at 320 | — | Fixed (`ad3c73f0`): 6 px gaps, `0 2px 0 12px` padding | MR10 |
| D7 | D · note | The Wall St line wrapped and left its "·" at the end of line 1 | R2 CONFIRMED; holds for the dot | Fixed: the dot travels with About | — |
| NEW-D2 | R2 · new | After D7, a long About name could not wrap (*…Taiwan Semiconductor Manufacturing Company Limited* 77 px past at 320) | — | Fixed (`ad3c73f0`): the name ellipsizes, the chevron stays | MR9 |
| D8 | D · note | The shell's 16 px gutter is 8 px narrower than the drawer's; SectorTab's *2.4x slower* badge clips (it clips at 12 px too) | R2: arithmetic, not reproduced | Reported (§12) | — |
| D9 | D · note | The colour and motion guard did not reach the shell header or the modal's shell body | R2 CONFIRMED; holds; D9c (an `rgba()` in the modal outside the scanned block) still open | Fixed: `ShellHeader` moved into `Sheet/`; a block scan of the modal's shell body | M34, M35 |
| D10 | D · note | A phone in landscape gets the desktop box; the view is under the plot's 240 px floor | R2 CONFIRMED by arithmetic | Reported (§12) | — |
| NEW-D3 | R2 · new | D1, D3 and D4 had rows only in the browser file, which skips without `SHELL_FOLD_URL` | — | Fixed (`ad3c73f0`): always-run jsdom rows (the strip's spacing and padding, the clamp read from source — jsdom drops `clamp()` from serialized styles — and the stuck-strip pick with rect and `scrollTop` spies) | MR5–MR8 |

The reviewers' and refuters' full reports, probes and logs stay in the session scratchpad (`review/reports/`, `review/snap-*`); every probe file was written inside its own snapshot, and every mutated source was restored and checked by SHA-256 (§15).

## 12. Found on the way (reported, not fixed)

Outside this build's scope, or a Build C behaviour the shell only exposes. None is reachable with the flag `'off'`.

1. **Today's *Why?* popup prints the since-entry change as the day's** on the battle mounts that are not controlled: it sends and titles the asset's own `percentChange` (+2.6% on the held fixture) under a header showing the day's +2.28%. The shell's tab no longer does (reading 2); the popup is unchanged, since every flag-off byte must stay main's.
2. **The controlled popup re-sends on a tick.** The held battle's controlled mount re-creates its request when a controlled quote updates mid-request (code read, lens B): the same abort-and-resend the shell fixed by freezing the request (A4). Today's popup, flag off.
3. **A8 — *see on chart ›* holds an item by its index** (Build C's `activeItem`): a tick that reshuffles the pack can move the Chart's caption to another item with no tap (refuter repro A8b: `rung_distance` drops at $103.83 and `check_read` takes its slot). A fix is to hold the item's id; it touches Build C's `useSheetView`.
4. **A9 — the sheet's price lines are outside the candle series' autoscale** (`StockChart.jsx`; lightweight-charts 5.1.0 merges only bars and primitives): an idea level or banked rung outside the visible bars can be drawn off the pane while its *see on chart ›* link is offered. Not reproduced in a browser.
5. **A10 — *What it decided* (Analysis) vs *What it flagged* (the Chart caption)** for a flagged-only name whose check rationale names it. Build C's wording, unchanged.
6. **B3 — with Bomb mode rolled back**, Chart → the legacy in-chart 💣 → Analysis → Chart lands on 1D, not the bomb chart the player left (`switchView` sees a bomb timeframe and restores the chart's). Rollback configuration only.
7. **D6 remainder — the stock row at 320 px** shrinks only the name. Measured on the preview after NEW-D1's fix, with a back arrow (a stock reached by navigation): GOOGL $1,234.56 ▼ 12.34% fits (0.2 px spare); **BRK.A $712,345.67 ▲ 1.23% puts ✕'s 44 px tap box 2.2 px past the edge**, and the refuter's synthetic BRK.B $712,345.67 ▼ 12.34% 7.5 px past. In both the ✕ glyph stays whole (it sits 13 px inside its box; `header-320-brkb.png`). Without a back arrow, and at 375 px and wider, every case fits with 2 px spare. A fix is a narrower price at narrow widths (a `clamp()` font size, as the tabs got); left as a note, the lens's own grade.
8. **D8 — the shell's 16 px gutter** is 8 px narrower than the drawer's 12 px a side; today's SectorTab *2.4x slower* badge already clips its own card at 320 with 12 px and clips 8 px more here. 360 px and up are clean.
9. **D9c — the colour guard's block scan** covers the modal's shell body between its markers; shell code elsewhere in `AssetResearchModal.jsx` (one `rgba()` at the modal box) passes unscanned. Clean by grep today.
10. **D10 — a phone in landscape** (wider than 430 px) gets the desktop 90vw × 90vh box; the view is shorter than the plot's 240 px floor (844×390: a 171 px view).
11. **C3a, C7b, A13, A14 — gaps the refuters left open**: ✕ after a navigation (✕ calling `onBack || onClose` survives), the plot re-measured on a resize (jsdom's ResizeObserver is a stub; `shellFold.browser.test.js` covers it in a browser), reduced motion in both fades, and S/R reset on leaving Chart. Each is correct in the code; none has a row that fails without it.
12. **C11's channel note — the crypto identity row** compares history, quote, profile, `fetchWithAuth` and `getDoc`; `getVolatilityThresholds` is not recorded. (Its path is unchanged by this build.)
13. **The minified build's 4 CSS warnings** (`Unexpected "*"`, `"0%"`, `"50%"` in `bv2Heat` and the climb namespace's comments) come from existing stylesheets; this build adds no CSS.

## 13. Phone renders (375×812)

Headless Edge at 375×812 (device scale 2, touch) against the smoke preview; animations off. The app's font stack draws **Segoe UI** here (Inter is never loaded; an iPhone draws SF Pro), so widths are close, not exact. Copied to `C:/Users/fashr/Documents/FantasyTrades/ResearchModal/Shell/` with `measures.json` and `measure320.json`.

| File | What it shows | Measured |
|---|---|---|
| `1-analysis-battle.png` | `held_tf` on open: Analysis, no chart — the holding line, *What it decided · Juno · Trend Follower · Wed 12:45*, the three questions, Wall St · About, the strip, What's moving unasked (*Why is AAPL +2.28%?* beside the header's ▲ 2.28%) | header 1–110; holding line 126–212; *What it decided* 234–298; **last question ends at 472, the action row starts at 740**; strip at 560; no sideways scroll |
| `1b-analysis-battle-whole-fold-marked.png` | The whole Analysis scroll laid out, the action row's top (teal) and the 812 px fold (white) dashed | — |
| `2-analysis-smart-money.png` | Scrolled to Smart Money with real holders | **the strip stuck at 110–155**, under the header |
| `3-chart.png` | The Chart view: 1D, the trend channel, the record's pins (*● What it decided · Wed 12:45*), SMA · S/R · Idea, *Price levels* (Technical) below | action row 740–811 |
| `4-bomb.png` | The 💣 view: the plot at the Chart view's height, then the bar and *What has to happen* | action row 740–811 |
| `5-browse-ranks.png` | `browse_ceg`: two pills, Ranks open with real data, the label *Utilities · fundamental rank · Thu Nov 12*, *Add to Watchlist* | strip at 121 |
| `6-pack-open.png` | *Does this protect the lead?* opened in place | — |
| `7-header-320-brkb.png` | The stock row at 320 px with a back arrow and the refuter's synthetic BRK.B $712,345.67 ▼ 12.34% (text substituted) | ✕'s box 7.5 px past the edge, its glyph whole (§12.7) |

**At 320 px** (`measure320.json`): a long About name (*Taiwan Semiconductor Manufacturing Company Limited*) ellipsizes with its chevron 16 px inside the view at 320, 375 and 390, no sideways scroll; with the agent named *Bartholomew Ashcroft* the voice label wraps whole, its time ` · Wed 12:45` uncut, and the last question still ends at 486 against the action row at 628 (320×700).

## 14. The founder's phone checklist (on the smoke preview, iPhone)

1. **Open a held stock** (`held_tf`): Analysis first, no chart. The holding line, *What it decided* and the three questions are visible without scrolling. The action row is pinned above Safari's toolbar.
2. **Tap a question:** the pack opens inline. *See on chart* switches to the Chart view with the pin's caption open.
3. **Scroll to the tabs:** the strip sticks under the header. Ranks, Smart Money and Sector show everything today's tabs show.
4. **Chart view:** candles at full height, the trend lines, SMA · S/R · Idea, the entry and check pins, the technical content below.
5. **💣 view:** Bomb mode as you know it, with the levels table under the bar.
6. **Browse fixture (`browse_ceg`):** two pills, the collapsed *Ask about this stock* row, Wall St · About, the four tabs, the watchlist action.
7. **Flag off on the live app:** nothing has changed anywhere.

## 15. What ran where, and cleanup

| What | Where |
|---|---|
| Lint gate, minified build, unminified builds, dist comparison | WSL Ubuntu, detached worktrees of `~/pd-ci`: `~/pd-ci-shell` (the head) and `~/pd-ci-shellk` (main), `node_modules` linked to the install whose lockfile hash matches (`40382e64edb6`); outputs under `~/pd-shell-runs/` |
| Full suite | WSL, `~/pd-ci-shell`, `flock /tmp/pd-suite.lock env TZ=UTC npx vitest run --maxWorkers=8`, JSON reporter; read from `suite.exit` and the JSON, never through `tail` |
| Rules suite | WSL, `~/pd-ci-shell`, `TZ=UTC npm run test:rules` with the local JDK 21 |
| Mutation battery | Windows, an LF `git archive` snapshot of `ad3c73f0` under the session scratchpad (`mut-tree`, `node_modules` by junction) — the final head's `src/` is byte-identical to it. The WSL builds ran beside part of it, so every mutant that ran in that window was run again with the host quiet (a load timeout would read as a kill) |
| Review lenses and refuters | Windows, one `git archive` snapshot each under the scratchpad (`review/snap-A` … `snap-R2`) |
| Phone renders, the fold rows, the 320 measures | Headless Edge (playwright-core) against the smoke preview; the app's font stack draws Segoe UI here (Inter is never loaded), not SF Pro |
| The smoke branch | Git plumbing from this checkout; pushed with `--force-with-lease` |

**Cleanup.** After the push, under `flock /tmp/pd-suite.lock`: the pushed head is built in `~/pd-ci-shell`; then my three trees — `~/pd-ci-shell` (187 MB), `~/pd-ci-shellk` (181 MB), `~/pd-ci-shellm` (177 MB, the earlier smoke check) — have their `node_modules` links removed first (they point at another session's install, `~/pd-af0`, which is left untouched), are removed with `git -C ~/pd-ci worktree remove --force` and pruned, and `~/pd-shell-runs` (195 MB) is deleted: about 740 MB before, sizes measured without `node_modules`. The measured space freed is in the PR description (a report cannot hold what happens after its own commit). The scratchpad snapshots (`review/snap-*`, `mut-tree`) lose their `node_modules` junctions; no other session's tree is touched.
