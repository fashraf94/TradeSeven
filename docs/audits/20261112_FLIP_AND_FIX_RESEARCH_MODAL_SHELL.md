# Flip and fix — the research modal shell: the allowlist (PR A), then the pre-'on' fixes (PR B)

**Run:** Thu Nov 12 – Fri Nov 13, 2026 · **Model:** Claude Opus 5.5, one local Claude Code session (desktop app worktree `.claude/worktrees/t0c-merge-prep-main-e9a684`) · **Brief:** the founder's "Flip and fix prompt — the research modal shell: allowlist, then the pre-'on' fixes" (Nov 12).

**Preamble.** `git fetch origin` ran first. `origin/main` was `9ca96ff2`, which contains PR #1045's merge (`92a80c89`, the two-view shell), so the brief's STOP does not apply. During the build `origin/main` moved twice — `34f9c6f9` (PR #1051, Practice Field T0b) and `29e8f4de` (PR #1047, Practice Field T0c), mandate files only, nothing in the research modal; both PRs merged both before their final checks (re-fetched before the push). Read first, as the brief asks: `docs/BUILD_RULES.md`; the shell build report (§3, §12, §14); the shell spec V1 and Amendment C; the Battle Research inventory (§4 F3, §12 H3); the Nov 8 Bomb mode flip report; the named source files. Fenced files (BUILD_RULES §1): none edited, none called. No production read or write; no provider call.

**Three rulings asked during the build** (the founder answered in the session, Nov 12):
1. **BS-4's source:** *one small doc read* — `stockTechnicalScores/{SYM}`, read once when a non-held stock's 💣 preview shows (no door held the reading for free: the battle screen keeps no rankings doc, and Firestore has no local cache here).
2. **BS-4's decimals:** *the preview at one decimal*, as the bench sheet prints it (BUILD_RULES §9). The ladder takes the exact reading.
3. **BS-4's reach:** *measured battles only.* A legacy-scored battle's non-held stock keeps the screen's threshold — that scorer's own number.

**The founder merges. Nothing reaches players until they do.**

---

## Executive verdict

| # | Item | Result |
|---|---|---|
| 1 | **PR A** `claude/research-modal-sheet-allowlist` | **Ready for the founder's merge.** One flip commit `a2debb0b` (2 files, +11 / −8): the literal `'off'` → `'allowlist'`, its pin row, the docstring's CURRENT line, and a pin assertion that holds the CURRENT line to the live value. Then `origin/main` merged twice (`a7bc2da3`, final tree `4839d0a3`). |
| 2 | **FA-2: who it reaches** | **The founder and FT_QA, in their own agent battles.** The shell turns on only for an agent Battle View mount whose owner the cockpit-status `allowlisted` verdict admits (the server-only `COCKPIT_ALLOWLIST_UIDS`); every browse, draft and search mount stays today's modal; the server's sheet Ask admits only those owners. No STOP (§1). |
| 3 | **PR A red rows** | **0 in both suites** with `'allowlist'`: full suite 31,223 rows exit 0, rules 748 rows exit 0 — and again on the final merged tree `4839d0a3` (31,312 / 748), with `lint:gate` and the minified build exit 0. The four mode-off goldens stay as kill-switch rows. Why nothing went red: §2. |
| 4 | **PR A builds** | Kill switch (head with the literal back to `'off'`) against `main`: **0 of 57 non-map files differ.** Value only (head against `main` with only the literal set): **0 of 57 differ**; against `main` unchanged, one line of the entry chunk differs (`"off"` → `"allowlist"`). |
| 5 | **PR A mutation** | **7 of 7 killed**, every file restored (SHA-256). |
| 6 | **PR B** `claude/research-modal-shell-preon` | **Ready for the founder's merge.** BS-1 to BS-5 built; the §2 review ran (four lenses, two refuters) and its fixes are in. Code final at `e30c0b08` (the build, the review fixes, `main` merged); the head adds this report. |
| 7 | **BS-1** | Bomb-only mounts (BaggerBomb battle view, free-agent bar) open on 💣 under the shell, as off it. |
| 8 | **BS-2** | *See on chart* holds the item, not its slot; an item that leaves the pack closes. The refuter's $103.83 repro is the row. |
| 9 | **BS-3** | The price and change narrow at 320 px; ✕ stays on screen. **Found:** the app prints `$712345.67` (no thousands separator); the shell report's 2.2 px clip came from a measurement that substituted `$712,345.67`. |
| 10 | **BS-4** | In a measured battle a non-held stock's 💣 preview takes the rankings' ATR reading (ACN: 4.05 %, not 6.48 %), labelled *estimated rung size · ATR reading 4.0% · as of 12:05 PM*; no reading → *No ladder yet*, never 2.5. **Note:** 4.05 prints **4.0%** on both the bench sheet and the preview (`(4.05).toFixed(1)` is "4.0"). |
| 11 | **PR B off path** | The four mode-off goldens: test files and golden data untouched by this branch, all passing — byte-identical to main. |
| 12 | **PR B mutation** | **36 of 36 killed**, every file restored (SHA-256): the brief's six, every review fix, and the nine survivors lens C found (each now killed by a row added for it). |
| 13 | **Both together** | **Green.** PR B's final head with PR A's flip applied: full suite `Test Files 1412 passed \| 10 skipped (1422)`, `Tests 31260 passed \| 120 skipped (31380)`, exit 0; rules 41 files, 748 rows, exit 0. No STOP. |
| 14 | **Review threshold** | **PR A: under** (2 files, 19 lines; the report rides on PR B). **PR B: met** — 26 files (24 + this report + its README row); before this report, +1,039 / −37 across 24 files. The review ran: §7. |

---

## §1 FA-2 — who `'allowlist'` reaches (read-only, VERIFIED at the cited lines)

1. **One gate per mount.** Every v2 mount resolves `shellOn = sheetModeOn(resolveSheetMode(), { agentBattle: battleSheet, verdict: battleSheet, asset })` on its displayed asset (`src/components/draft/AssetResearchModal.jsx:229`). Under `'allowlist'` that is on only when `agentBattle === true && verdict === true` (`src/components/Research/Sheet/sheetMode.js:54`), and `battleSheet` is "a `sheetContext` was handed over".
2. **Only the agent Battle View hands a `sheetContext`** — its three mounts (`src/screens/AgentBattleScreen.jsx:4246`, `:4261`, `:4276`), each only when `sheetModeOn` (`:1250`, `useSheetModeForBattle`) is true. A grep of `src/` finds no other `sheetContext` prop. Every browse, draft and search mount passes none, so at `'allowlist'` it resolves off: today's modal (rows: `AssetResearchModal.shell.jsdom.test.jsx` "browse: 'off' and 'allowlist' are today's modal").
3. **The verdict.** `useSheetModeForBattle` asks `readFilmRoomVerdict` once the battle names its owner (`src/components/Research/Sheet/sheetGate.js:35-46`); anything but a 200 whose body has `allowlisted: true` reads off (`src/utils/filmRoomGate.js:76-91`, `:116-131`). The endpoint answers only for the caller's own battle (`api/agent/cockpit-status.js:108`, 403 otherwise) with `allowlisted: isCockpitOwnerAllowlisted(battle.ownerId)` (`:114`) — the allowlist **alone**, not the cockpit's release cohort (`:110-113`).
4. **The list.** `isCockpitOwnerAllowlisted` (`api/_utils/callRecords/mode.js:73-80`) reads `readCockpitAllowlist()`, the environment variable **`COCKPIT_ALLOWLIST_UIDS`**, at call time (`api/_utils/callRecords/allowlist.js:27-28`, `:47-53`). Server-only: no `src/` module may import it, so the client never learns a uid.
5. **The server's sheet Ask.** `chat.js` refuses a sheet Ask with 403 `research_ask_off` unless `researchAskAllowed(user.uid)` (`api/agent/chat.js:454`), which at `'allowlist'` is `isCockpitOwnerAllowlisted(ownerId)` (`api/_utils/researchAsk.js:110-118`), before any read or charge; step 7 then requires `battle.ownerId === user.uid` (`chat.js:480`).

**Labels, no uids.** The committed records name two accounts on that list: **the founder and FT_QA** (`docs/audits/20261029_ACTIVATION_FILM_ROOM_CARDS_ALLOWLIST.md`; the Nov 8 flip report §3). Today's production value is not in the repo (ASSUMED for production; the founder can confirm in Vercel → Environment Variables → `COCKPIT_ALLOWLIST_UIDS`). Nothing in the code admits anyone else, so no STOP.

**One wire difference for every owner.** With Bomb mode at `'on'` (it no longer asks), `'allowlist'` brings back one `GET /api/agent/cockpit-status` per owner per page life on the Battle View, through the Film Room gate's cache (the Film Room route asks only in the Film Room). A player who is not admitted gets `allowlisted: false` and today's modal. The endpoint is rate-limited and reads one document.

## §2 PR A — red rows and checks

| Suite (WSL, Node 20.20.2, `TZ=UTC`) | Tree | Result | Red |
|---|---|---|---|
| Full suite, `flock /tmp/pd-suite.lock`, 8 workers | `a2debb0b` | **exit 0** · `Test Files 1409 passed \| 9 skipped (1418)` · `Tests 31124 passed \| 99 skipped (31223)` | **0** |
| `npm run test:rules` (JDK 21) | `a2debb0b` | **exit 0** · `Test Files 41 passed (41)` · `Tests 748 passed (748)` | **0** |
| Full suite, after the first `main` merge | `a7bc2da3` | **exit 0** · `Test Files 1411 passed \| 9 skipped (1420)` · `Tests 31202 passed \| 99 skipped (31301)` | **0** |
| `npm run test:rules`, after the first `main` merge | `a7bc2da3` | **exit 0** · `41 passed (41)` · `748 passed (748)` | **0** |

| Disposition | Rows |
|---|---|
| Kill-switch (held `'off'` by mock) | 0 new. The four mode-off goldens (`AssetResearchModal.sheetModeOff`, `AgentBattleScreen.sheetModeOff`, `AssetResearchModal.bombModeOff`, `AgentBattleScreen.bombModeOff`) hold their flags in their own mocks and stay as kill-switch rows, unchanged and green. |
| Rewrite / Delete | 0 / 0 |
| Pin moved | 1 — `researchModalSheetFlag.test.js` (title and value), in the flip commit, plus the CURRENT-line assertion |

**Why nothing went red (checked, not assumed).** The swept tree's literal read `'allowlist'` (`researchModalFlags.js:122` in the WSL tree); the moved pin row ran and passed (JSON: `is 'allowlist' — …` passed; 0 failed of 31,223); mutants P1/P1b show it fails on any other value. Every suite that names the sheet flag holds it in its own mock (a getter or a fixed value). Suites that render the Battle View without naming it now take the allowlist path, which asks the verdict once the battle names its owner and resolves off until a yes; none of them is admitted and none asserts the absence of that ask.

**Builds (unminified, maps excluded; `~/pd-ci-sheetflipk`, lock `40382e64edb6`):**

| Comparison | Non-map files | Raw `diff -rq` entries |
|---|---|---|
| Kill switch (`a2debb0b` with the literal back to `'off'`) vs `main` `9ca96ff2` | 57 / 57 | **0** |
| Head `a2debb0b` vs `main` with only the literal set to `'allowlist'` | 57 / 57 | **0** |
| Head vs `main` unchanged | 57 / 57 | 103 (renamed chunks); masked, the entry chunk differs by one line: `const RESEARCH_MODAL_SHEET_MODE = "off";` → `"allowlist";` and `index.html` by the entry's name |

**PR A's final tree** `4839d0a3` (`main` `29e8f4de` merged): `npm run lint:gate` **exit 0** (`--max-warnings 0`); minified build **exit 0** (built in 14.95 s; two CSS-minify warnings from existing stylesheets); full suite **exit 0** · `Test Files 1411 passed | 9 skipped (1420)` · `Tests 31213 passed | 99 skipped (31312)`; `npm run test:rules` **exit 0** · 41 files, 748 rows. `main` moved twice during the build (`34f9c6f9`, `29e8f4de`, both Practice Field mandate work, nothing in the research modal); the flip commit is unchanged by either merge.

**Mutation (PR A; `~/pd-ci-sheetflip` @ `a2debb0b`; a baseline of the listed files first, 103 rows, exit 0):**

| id | Mutant | Result | First failing row |
|---|---|---|---|
| P1 | the literal changed: `'allowlist'` → `'on'` | **KILLED** (2 of 11) | the pin row `is 'allowlist' — a kill switch …` |
| P1b | the literal changed the other way, `→ 'off'` (the flag moved, its pin not) | **KILLED** (2 of 11) | the same |
| A1 | `'allowlist'` on without the verdict (`sheetMode.js`: `agentBattle === true`) | **KILLED** (3 of 71) | `sheetModeOn — pure … allowlist needs an agent battle` |
| A2 | the battle hook takes any answer as a yes (`verdict: true`) | **KILLED** (1 of 24) | `useSheetModeForBattle 'allowlist' with a false verdict … stays off` |
| A3 | the server's sheet Ask drops the allowlist (`return mode === 'allowlist'`) | **KILLED** (1 of 21) | `researchAskAllowed … 'allowlist' only the listed owner` |
| N1 | `'allowlist'` on for a mount with no agent battle (pure gate) | **KILLED** (4 of 71) | `browse: 'off' and 'allowlist' are today's modal` |
| N2 | `'allowlist'` on for a browse mount (the modal's call names every mount a verdicted battle) | **KILLED** (2 of 47) | the same |

Every file restored from `git show HEAD:<file>` and checked by SHA-256; the tree clean after the last.

## §3 PR B — the rows as built

PR B cut from `origin/main` `9ca96ff2`; `34f9c6f9` (#1051) and `29e8f4de` (#1047) merged in before the final checks. Commits:

| Commit | What |
|---|---|
| `b9306d5a` | BS-1 |
| `d7d7c357` | BS-2 |
| `f26b3682` | BS-3 |
| `967313ed` | BS-4 |
| `299b6bc7` | BS-5 (both specs) |
| `d0a2da22` | merge `origin/main` `34f9c6f9` |
| `4ea7b3c0` | review A/B fixes (LA-1/LB-2 freshness, LA-2 $0 rung, LA-5/LB-1 whys + retry, LB-3 per symbol, LA-4 wording) |
| `d89477d0` | refuter R1 fixes (NEW-1 reward-route rows, NEW-2 retry off the shell, NEW-3 spec copy row) |
| `f15404aa` | review D fixes (D1 symbol gives way, D2 bound separators, D3 harness) |
| `5fdd469a` | review C rows (C1–C28, V1) |
| `33e8b459` | a retry simplification, superseded by the next commit (§7, NEW-R2-1) |
| `f21f4ff9` | refuter R2 fixes (NEW-R2-1, NEW-R2-2, NEW-R2-3) |
| `e30c0b08` | merge `origin/main` `29e8f4de` |
| *this report* | `docs/audits/20261112_FLIP_AND_FIX_RESEARCH_MODAL_SHELL.md` |

### BS-1 — Bomb-only mounts open on 💣 (reading 7, changed)

- `shellView.bombOnlyOpensOnBomb({ defaultTab, defaultTimeframe })` (`src/components/Research/Sheet/shellView.js:41`): `defaultTab === 'baggerbomb'` or a bomb timeframe (`'bomb'`, `'spectate'`).
- The modal adds it to the open-on-💣 decision only for a mount with a `bombContext` and **no** `sheetContext` (`src/components/draft/AssetResearchModal.jsx:241`). The BaggerBomb battle view always passes `defaultTimeframe="bomb"`; the free-agent bar passes `defaultTab="baggerbomb"` and `defaultTimeframe="bomb"`. Both open on 💣 at `'on'`, on the 30-minute series, as they do off the shell.
- **FQ-9 unchanged**: the agent Battle View's mounts hand a `sheetContext`, so they never take this term.
- Rows (`AssetResearchModal.shell.jsdom.test.jsx`): the free-agent bar opens on 💣 (three pills, the 30-minute series; Analysis from there is the browse content); the BaggerBomb battle view with `defaultTab` null and `'baggerbomb'` (a V4 context) opens on 💣; a Bomb-mode mount asking for neither opens on Analysis; a battle mount opens on Analysis outside a zone and on 💣 inside one (FQ-9). Review C5's row, which pinned reading 7 as first built, is rewritten to the ruling. Unit row in `shellView.test.js`.

### BS-2 — *See on chart* holds the item, not its slot

- `packs.itemKeyOf(item)` = `kind|symbol` (`src/components/Research/Sheet/packs.js:206`), from fields every item already carries: no field is added (the items are the Ask's `researchAsk.items` and the facts golden's).
- `useSheetView` keeps the open item's key (`src/components/Research/Sheet/useSheetView.js:165`). An item that leaves the pack closes and stays closed if it returns: reopening it is a new tap. `tapItem(i)` stores the key of the item in that slot (`:255`).
- Rows: the refuter's repro (`AssetResearchModal.sheetModeOn.jsdom.test.jsx`): on catch-up, `rung_distance` open at $103.78; a tick to **$103.83** drops it and `check_read` takes its slot; the Chart shows no titled line and the idle caption; on Analysis no item is marked open (`check_read` is not); the price back at $103.20 brings `rung_distance` back **closed**. Uniqueness (`packs.test.js`): `candidateItems` builds at most one item per kind, and every pack's keys are unique, for all six archetypes at three prices, with and without an incumbent.

### BS-3 — The stock row at 320 px

- `SHELL_PRICE_FONT = clamp(12px, 3.6vw, 14px)`, `SHELL_CHANGE_FONT = clamp(10px, 2.95vw, 11.5px)` (`src/components/Research/Sheet/ShellHeader.jsx:23-24`): 12 / 10 px at 320, 13.5 / 11.06 px at 375, the old 14 / 11.5 px from 390 up (identical there: lens D measured 18 combinations each at 390 and 430). The name keeps its ellipsis.
- **Review D1:** the symbol also gives way, but only after the name is gone (`minWidth: 0`, `flexShrink: 0.001`, ellipsis; `:83`), so ✕ stays on screen whatever the font. No real ticker is cut anywhere from 320 to 430 px (refuter R2: 8 symbols × 3 prices × 7 widths).
- **Found:** the app prints a price with no thousands separator (`priceFormat.priceText`: `$712345.67`). The shell report's "BRK.A $712,345.67 puts ✕ 2.2 px past the edge" came from a measurement that substituted the comma form, 7.7 px wider. With the app's own string, BRK.A with a back arrow already fit at 320 (name 3.5 px); only the comma form and the synthetic ▼ 12.34% pushed ✕ (lens D, on the smoke preview). BS-3 adds margin.
- Rows: an always-run row reads both clamps and the symbol's style from source and the DOM (jsdom drops `clamp()`); `shellHeader.browser.test.js` (run with `SHELL_HEADER_BROWSER=1`, skipped in CI) renders the real header inside the phone modal's box (100vw, border-box, 1 px border — lens D found it faithful to the preview to the pixel) in headless Edge: at 320 and 375, GOOGL, BRK.A, BRK.A with a comma, BRK.B with a comma and ▼ 12.34%, and WWWWW, each with and without the back arrow, ✕'s 44 px box within the row's content edge, the name ellipsized and holding ≥ 8 px (WWWWW: the symbol gives way); the clamps at 320 / 390 / 430. **21 of 21 pass** on the final code. With the price clamp removed, 3 rows fail.

| 320 px, back arrow | Name left | ✕ right edge (row content edge 317) |
|---|---|---|
| GOOGL $1234.56 ▼ 12.34% | 21.3 px | 317.00 |
| BRK.A $712345.67 ▲ 1.23% | 20.3 px | 317.00 |
| BRK.A $712,345.67 ▲ 1.23% | 13.7 px | 317.00 |
| BRK.B $712,345.67 ▼ 12.34% | 9.2 px | 317.00 |
| WWWWW $712,345.67 ▼ 12.34% | 0 (symbol 89.5 → 61.4 px) | 317.00 |

Segoe UI and Consolas drew here (CDP `getPlatformFontsForNode`); **SF Pro and SF Mono on an iPhone are unmeasured.**

### BS-4 — the 💣 preview's rung size for a stock the agent does not hold

- **Where** (`AssetResearchModal.jsx:443`, `atrArm`): a `kind: 'agent'` context whose `stockModel` is `'corrected'` (the battle is scored by the measured ATR model; `agentBombContext` now names it, `selectBombRecord.js:89`); not crypto; not held for the displayed symbol; and not a row carrying its own committed reward route (`stockRewardRoute`: the CPU's held stock, or the agent's own after the battle ends — refuter NEW-1).
- **The read** (`src/components/Research/BombMode/atrReading.js`): one Firestore read of `stockTechnicalScores/{SYM}` per stock for the modal's life (`atrReads`, per symbol), only while the 💣 view shows (under the shell) or the Bomb tab or bomb series shows (off it) (`:464`). A reading counts only when it is finite, positive, carries a time, and is at most **96 hours** old (`ATR_READING_MAX_AGE_MS`, `:41`) — the cron never deletes a document, so a dropped name keeps its last one (review LA-1/LB-2). A failed read is the answer only until the view, tab or timeframe next changes; then it is asked once more (NEW-2); a view change never re-sends a read in flight (NEW-R2-1); a retry in flight shows *loading* (NEW-R2-2). **No provider call; the thresholds request (`/api/volatility/thresholds`, which can reach EODHD) is not sent on this arm** (`:502`).
- **The ladder** (`bombView.buildLadder`, `:50`): after the held arm, `previewLadder({ previousClose, threshold: reading })` with `atrReading: { pct, asOfMs }`. The screen's threshold (`scoring.thresholds[sym]`, else `baseATR` = atrPercentile × 8, else 2.5) is never used there. ACN: rungs at 4.05 %, not 6.48 %. `previewLadder` now refuses a rung at or below $0 (review LA-2: a reading ≥ 50 % drew Meltdown under $0 and printed `$undefined`; `ladder.js:165`) — no existing preview reaches that (the thresholds route caps a stock at 15 %, crypto at 25 %; baseATR at 8).
- **The label** (`bombCopy.previewNeedsAtr`): *Preview · rungs if it entered at yesterday's close ($300.00) · estimated rung size · ATR reading 4.0% · as of 12:05 PM*, at the bench sheet's one decimal (`atrReadingText`, the same `toFixed(1)` as `cockpit2bModel.js:654`), the time the rankings run's (`updatedAt`; a weekday from an earlier day: *as of Tue 4:05 PM*, unambiguous inside 96 hours), separators bound with no-break spaces (review D2).
- **No ladder**: *No ladder yet* with the arm's own why — `atr_unavailable` *"This stock has no usable ATR reading from a recent rankings run, so no rung size is shown."*; `atr_loading` *"The ATR reading or yesterday's close hasn't loaded."*; `atr_failed` *"The ATR reading couldn't be read. It's asked again when you change view or tab."* Never the 2.5 default.
- **Unchanged**: held measured ladders; the held-preview line (legacy stocks, crypto); V4 and bench contexts; a non-held crypto; legacy-scored and `'unavailable'`-model battles; reward-route rows; Bomb mode off (no `bombContext`).

Rows: `AssetResearchModal.bombAtr.jsdom.test.jsx` (new, 30 rows on the corrected-battle harness, both flags held by mock) and `bombView.test.js` (ATR-arm unit rows), `bombCopy.honesty.test.jsx` (the ATR preview and the three new states rendered and scanned), `selectBombRecord.test.js` and `AgentBattleScreen.bombModeOn.jsdom.test.jsx` (three equality rows that pinned the context's exact shape now name `stockModel` — rewritten, not loosened). The brief's four:

| Brief row | As built |
|---|---|
| ACN-like: the preview uses 4.05, not 6.48 | The screen hands 6.48; the reading is 4.05; the bagger rung is **$312.15** on the Fuse and the sheet (300 × 1.0405), never $319.44; one read; no thresholds request |
| The bench sheet's number equals the preview's | `benchSheetOf` with `atrPct: 4.05` prints **`ATR 4.0%`**; the preview prints **`ATR reading 4.0%`** — the same number, the same rule |
| An unranked name shows *No ladder yet* | `atr_unavailable`, its why, no rung drawn, no $307.50 (300 × 1.025) |
| A held measured stock unchanged | its frozen receipt ladder; its reading never read |

Plus: a stale (15 days) or untimed reading; a 55 % reading on a $40 close; a failed read (`atr_failed`) asked again on a tab change off the shell and on reopening 💣 under it; loading while in flight; one read per stock (ticks, A→B→A, an unranked name across reopens); a stock changed mid-read; a view change mid-read; the off-shell tab gate; held → in-modal navigation to a non-held peer; the CPU's held stock and a finished battle's (NEW-1); legacy, `'unavailable'`, crypto, bench, V4 and no-context mounts read nothing.

### BS-5 — the specs

`docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md` §10 (new): the ten readings — 1–6 and 8–10 **kept as built**, 7 **changed** (BS-1) — and BS-1 to BS-4 as built; §3, §4 rows 4–5 and §6.6 follow BS-1. `docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md`: "BS-4" in its refinement section (overrides §3.7 for a non-held stock in a measured battle).

## §4 BS-4's number: the two stored copies, and what the modal reads

- **One value, one batch.** `api/cron/compute-index-intelligence.js` builds `stockScores` once per run; `stockTechnicalScores/{SYM}` is `batch.set(ref, { ...score, updatedAt })` (`:1245-1249`), and the rankings row's `techRaw.atrPercent` is `tech.atrPercent` off the same object (`:1298`, `:1413`); both go in one `batch.commit()` (`:1564`), so within a run they cannot disagree. The bench sheet reads the rankings copy (`api/agent/cockpit-bench.js:190`). VERIFIED.
- **Across runs they can** (review LA-3, CONFIRMED, not fixed): the bench sheet fetches when it opens, the modal reads when 💣 opens, and the rankings run hourly in the session. A bench opened at 11:58 (11:00 run) and a 💣 opened after the 12:00 run can print 4.1 % and 4.0 %; the bench prints no time for its ATR (its `asOf` is the price cache's). §8.
- **Why the per-stock copy.** The founder ruled "one small doc read": the rankings doc is several hundred KB; `stockTechnicalScores/{SYM}` is about 1 KB, public, and the Ranks tab already reads it.
- **What the number is.** The scorer's 14-true-range formula, but not the swap's bars: a swap measures 15 completed, adjusted sessions; an intraday run includes today's partial bar and mixes raw highs and lows with the adjusted close (inventory §4.1 (b); review LA-4). Hence *estimated*. The founder may prefer the pre-market reading (§8).

## §5 Checks — PR B, and both together

PR B's final head `e30c0b08` with PR A's flip commit `a2debb0b` applied (`git cherry-pick --no-commit`) in `~/pd-ci-sheetflipk`, the literal reading `'allowlist'`:

| Check | Result |
|---|---|
| PR B alone — full suite, `flock /tmp/pd-suite.lock`, 8 workers, `TZ=UTC` (`e30c0b08`) | **exit 0** · `Test Files 1412 passed \| 10 skipped (1422)` · `Tests 31260 passed \| 120 skipped (31380)` · 267 s |
| PR B alone — `npm run test:rules` | **exit 0** · `Test Files 41 passed (41)` · `Tests 748 passed (748)` |
| PR B — `npm run lint:gate` | **exit 0** (`--max-warnings 0`) |
| PR B — `npm run build` (minified) | **exit 0** · built in 14.69 s · two CSS-minify warnings from existing stylesheets |
| PR B — the four mode-off goldens | test files and golden data **untouched** by the branch (`git diff origin/main...HEAD` lists none of them), all passing in both suites — byte-identical to `main` |
| PR B — `shellHeader.browser.test.js` (headless Edge, Windows) | **21 of 21** |
| **Both together** — full suite (`e30c0b08` + `a2debb0b`, literal `'allowlist'`) | **exit 0** · `Test Files 1412 passed \| 10 skipped (1422)` · `Tests 31260 passed \| 120 skipped (31380)` · 308 s |
| **Both together** — `npm run test:rules` | **exit 0** · `Test Files 41 passed (41)` · `Tests 748 passed (748)` |

An earlier run on the pre-review head `d0a2da22` + `a2debb0b` was also green (`Test Files 1412 passed | 10 skipped (1422)`, `Tests 31227 passed | 116 skipped (31343)`; rules 748, exit 0).

## §6 Mutation (PR B)

**36 mutants, 36 killed, 0 survived**, judged by each run's **exit code**, on PR B's final code `e30c0b08` (an LF WSL worktree, `~/pd-ci-preon`). One mutant at a time: every edit's anchor must match exactly once (else BROKEN); a baseline of every listed file ran first on the unmutated tree (**260 rows, exit 0**); each file was restored from `git show HEAD:<file>` and proved by SHA-256 — 36 of 36 restored; the tree clean after the last.

- **The brief's six** are B1 (and B1b, the pure rule), B2, B3, B4, B5 and B6r.
- **B6** went BROKEN in the second battery: refuter NEW-1's fix extended the line its anchor ended on. Re-cut as **B6r**, which drops both held exclusions from the arm and puts the reading ahead of the held ladder.
- **B22** survived the second battery as an equivalent mutant: the NEW-2 fix had put the view counter in the read's deps, so the failed-at-view bookkeeping was redundant. Simplifying to that form (`33e8b459`) let a view change re-send a read in flight (refuter NEW-R2-1); the final form (`f21f4ff9`) keeps the bookkeeping and takes the counter out of the deps, and B22 is now killed by the NEW-2 row.
- **B25–B33** are lens C's survivors, each killed by the row added for it; **B34–B35** pin refuter R2's fixes.

| id | brief | the defect planted | file | verdict | first failing row (truncated) | restored (SHA-256) |
|---|---|---|---|---|---|---|
| B1 | 1 | brief 1: a bomb-only mount opens on Analysis (the BS-1 term dropped from the open decision) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 3 of 52) | review C — the promises the first rows did not pin BS-1: the free-agent bar (defaultTab 💣, defaultTimeframe b | yes |
| B1b | 1 | brief 1: a bomb-only mount opens on Analysis (the pure rule answers no) | `Research/Sheet/shellView.js` | **KILLED** (exit 1, 4 of 70) | review C — the promises the first rows did not pin BS-1: the free-agent bar (defaultTab 💣, defaultTimeframe b | yes |
| B2 | 2 | brief 2: the caption follows the index again (the slot is stored and read back) | `Research/Sheet/useSheetView.js` | **KILLED** (exit 1, 1 of 52) | BC-8 — the record on the Chart view, one label open; "see on chart ›" opens an item's pin there BS-2 (shell re | yes |
| B3 | 3 | brief 3: the price font stops clamping | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1, 1 of 52) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) BS-3: the price and t | yes |
| B4 | 4 | brief 4: the preview draws from atrPercentile × 8 again (the screen's threshold wins on the ATR arm) | `Research/BombMode/bombView.js` | **KILLED** (exit 1, 13 of 62) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading ACN-like: the scr | yes |
| B5 | 5 | brief 5: an unranked name draws the 2.5 default (no reading falls back to the screen's threshold) | `Research/BombMode/bombView.js` | **KILLED** (exit 1, 10 of 62) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading an unranked name  | yes |
| B6r | 6 | brief 6: a held measured ladder takes the ATR reading (both held exclusions dropped from the arm, the reading ahead of the held ladder) — re-cut: the NEW-1 fix moved its anchor | `draft/AssetResearchModal.jsx, Research/BombMode/bombView.js` | **KILLED** (exit 1, 6 of 62) | BS-4 — unchanged: every other ladder a held measured stock keeps its frozen receipt ladder, and its reading is | yes |
| B7 |  | a legacy-scored battle takes the ATR arm (the measured-battle condition dropped) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 2 of 30) | BS-4 — unchanged: every other ladder a legacy-scored battle's non-held stock keeps the screen's threshold (tha | yes |
| B8 |  | a non-held crypto takes the ATR arm | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — unchanged: every other ladder a non-held crypto in a measured battle keeps the screen's threshold (its  | yes |
| B9 |  | the thresholds request (a possible provider call) still goes out on the ATR arm | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 2 of 30) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading a stock with no t | yes |
| B10 |  | the label prints two decimals, not the bench sheet's one | `Research/BombMode/bombCopy.js` | **KILLED** (exit 1, 7 of 127) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading ACN-like: the scr | yes |
| B11 |  | an earlier session's reading loses its day ('as of 4:05 PM') | `Research/BombMode/bombView.js` | **KILLED** (exit 1, 2 of 62) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading a reading from an | yes |
| B12 |  | an item that left the pack reopens when it returns (the close-on-leave dropped) | `Research/Sheet/useSheetView.js` | **KILLED** (exit 1, 1 of 52) | BC-8 — the record on the Chart view, one label open; "see on chart ›" opens an item's pin there BS-2 (shell re | yes |
| B13 |  | BS-1 reaches the battle mounts too (a sheetContext mount opens on 💣 by its defaultTab) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 8 of 52) | SB-2 — every v2 mount resolves the shell through sheetModeOn, on its displayed asset an agent battle mount who | yes |
| B14 |  | the change font stops clamping | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1, 1 of 52) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) BS-3: the price and t | yes |
| B15 |  | the context never names a measured battle (stockModel lost) | `Research/BombMode/selectBombRecord.js` | **KILLED** (exit 1, 25 of 41) | mode 'on' — the in-battle contract the CPU's row of a shared ticker: a preview, never the agent's ladder | yes |
| B16 |  | a failed read says the name is unranked (the two no-reading states collapse) | `Research/BombMode/bombView.js` | **KILLED** (exit 1, 5 of 62) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading a document with n | yes |
| B17 |  | review A1/B2 fix: the freshness gate dropped (a stale or untimed reading is taken) | `Research/BombMode/atrReading.js` | **KILLED** (exit 1, 3 of 62) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading review A1 / B2: a | yes |
| B18 |  | review A2 fix: previewLadder draws a rung at or below $0 again | `Research/BombMode/ladder.js` | **KILLED** (exit 1, 2 of 62) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading review A2: a read | yes |
| B19 |  | review A5/B1 fix: a failed read is kept as the answer (never asked again) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 3 of 30) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading review A5 / B1: a | yes |
| B20 |  | review B3 fix: one slot, not one per stock (a stock returned to is read again) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading review B3: a stoc | yes |
| B21 |  | refuter NEW-1 fix: a row with its own reward route (the CPU's held stock, a finished battle's) takes the ATR arm again | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 2 of 30) | BS-4 — unchanged: every other ladder refuter NEW-1: the CPU's own held measured stock keeps what it showed bef | yes |
| B22 |  | refuter NEW-2 fix: a failed read is never the answer for a view (failedAtView dropped) — off the shell it is never asked again | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 4 of 30) | BS-4 — a non-held stock in a measured battle previews its rungs at the rankings' ATR reading a document with n | yes |
| B23 |  | review D1 fix: the symbol cannot shrink again | `Research/Sheet/ShellHeader.jsx` | **KILLED** (exit 1, 1 of 52) | refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them) BS-3: the price and t | yes |
| B24 |  | review D2 fix: the ATR line goes back to breakable separators | `Research/BombMode/bombCopy.js` | **KILLED** (exit 1, 1 of 32) | buildLadder — BS-4: the ATR arm (a non-held stock in a measured battle; the modal hands atrReading only there) | yes |
| B25 |  | review C1: off the shell the read fires on any tab | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — the read's wiring in the modal (review C) C1: off the shell the read waits for the Bomb tab — a mount o | yes |
| B26 |  | review C2: any record on the context (a held stock left by navigation) blocks the arm | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — the read's wiring in the modal (review C) C2: from the agent's held measured stock, a navigation inside | yes |
| B27 |  | review C3: an 'unavailable' model counts as measured | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — unchanged: every other ladder review C3: a battle whose stock model cannot be read ('unavailable') is n | yes |
| B28 |  | review C5: a read in flight says the name has no reading | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 2 of 30) | BS-4 — the read's wiring in the modal (review C) C5: while the read is in flight the preview says the reading  | yes |
| B29 |  | review C23: the loading state's why falls back to the threshold copy | `Research/BombMode/BombPlot.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — the read's wiring in the modal (review C) C5: while the read is in flight the preview says the reading  | yes |
| B30 |  | review C6: an unranked name is read again on every 💣 reopen | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — the read's wiring in the modal (review C) C6: an unranked name is read once for the modal's life, not o | yes |
| B31 |  | review C26: the read effect ignores a symbol change mid-read | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — the read's wiring in the modal (review C) C26: a stock changed while its read is in flight — the new st | yes |
| B32 |  | review C28: "as of" compares days in UTC, not ET | `Research/BombMode/bombView.js` | **KILLED** (exit 1, 1 of 32) | buildLadder — BS-4: the ATR arm (a non-held stock in a measured battle; the modal hands atrReading only there) | yes |
| B33 |  | review C15: "as of" printed with no time | `Research/BombMode/bombCopy.js` | **KILLED** (exit 1, 1 of 32) | buildLadder — BS-4: the ATR arm (a non-held stock in a measured battle; the modal hands atrReading only there) | yes |
| B34 |  | refuter NEW-R2-1: the view counter back in the read deps (a view change re-sends a read in flight) | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 2 of 30) | BS-4 — the read's wiring in the modal (review C) refuter NEW-R2-1: a view change while a read is in flight nev | yes |
| B35 |  | refuter NEW-R2-2: a retry in flight shows the failure, not loading | `draft/AssetResearchModal.jsx` | **KILLED** (exit 1, 1 of 30) | BS-4 — the read's wiring in the modal (review C) refuter NEW-R2-2: while the retry after a failure is in fligh | yes |


## §7 The review (BUILD_RULES §2)

**Threshold: met** — 26 files (24 + this report and its README row; before it, +1,039 / −37 = 1,076 lines) against ≥ 10 files or ≥ 1,500 lines.

**How it ran.** Four lenses, each on its own `git archive` snapshot under the session scratchpad (read-only on git and on this tree): **A** display honesty and correctness, **B** wiring, lifecycle and the flag-off path (both on `d0a2da22`); **C** test integrity — the mutating lens, its own tree, 33 mutants — and **D** phone layout, tokens and motion (headless Edge against the smoke preview and a static harness) (both on `4ea7b3c0`). Then two refuters on fresh snapshots, each told to refute every finding with a repro and to re-check every fix: **R1** for A and B (on `4ea7b3c0`), **R2** for C and D (on `5fdd469a`). Every fix carries a row and every row a mutant (§6).

**Split:** 37 items — **33 CONFIRMED** (3 in part), **1 REFUTED in part**, 3 notes recorded only; the refuters found **5 new defects** in the fixes, all fixed. Lens B's flag-off check: the four kill-switch goldens pass byte-identical, no golden data changed; with no `bombContext` nothing reads.

| # | Lens · severity | Finding | Refuter | Disposition | Pinned by |
|---|---|---|---|---|---|
| LA-1 = LB-2 | A must-fix · B should-fix | A stale `stockTechnicalScores` doc (the cron never deletes) shown as current; "as of" only a weekday | R1 CONFIRMED; fix HOLDS (96 h inclusive; a current name's longest gap is 62.5 h) | Fixed `4ea7b3c0`: 96-hour freshness, no time → no reading | rows; B17 |
| LA-2 | A must-fix | A reading ≥ 50 % → Meltdown ≤ $0, `$undefined` | R1 CONFIRMED; fix HOLDS, no existing preview changes | Fixed: `previewLadder` refuses a non-positive rung | rows; B18 |
| LA-3 | A should-fix | Bench and modal can show readings from different hourly runs | R1 CONFIRMED | **Not fixed** — §8.1 | — |
| LA-4 | A should-fix | Comment and spec over-claimed "nearly the swap's bars" | R1 CONFIRMED; fix HOLDS | Fixed: wording | — |
| LA-5 = LB-1 | A, B should-fix | Failed/loading why spoke of a "threshold"; a failed read never retried | R1 CONFIRMED; fix **INCOMPLETE** off the shell → NEW-2 | Fixed `4ea7b3c0` + `d89477d0` | rows; B16, B19, B22, B28, B29 |
| LA-6 | A should-fix | The CPU's held stock (and a navigated held stock, and a finished battle's) gets the ATR preview | R1: author's rebuttal **REFUTED** for measured reward-route rows (they showed *No ladder yet* before); **holds** for a navigated held stock (it showed a preview before) → NEW-1 | Fixed via NEW-1 | B21 |
| LA-7 | A note | `'unavailable'` model treated like legacy | R1 CONFIRMED, not a regression | Kept; row added (C3) | B27 |
| LA-8 | A note | One decimal beside the table's two (4.0 % vs +4.05 %) | R1 CONFIRMED | Founder's ruling — §8.2 | B10 |
| LA-9 | A note | "as of" is commit time, minutes after the quotes | R1 CONFIRMED | Kept — §8 | — |
| LB-3 | B note | One read per visit, not per stock | R1 CONFIRMED pre-fix; fix HOLDS | Fixed: per-symbol map | B20 |
| LB-4 | B note | A finished battle's held name takes the arm | R1 CONFIRMED, new | Fixed via NEW-1 | B21 |
| LB-5 | B note | BS-4 has no switch of its own | R1 CONFIRMED | Kept — §8.3 | — |
| NEW-1 | R1 · should-fix | Reward-route rows drew an "if it entered" preview where they said *No ladder yet* | — | Fixed `d89477d0`: the arm excludes `stockRewardRoute` | B21; 2 rows |
| NEW-2 | R1 · should-fix | Off the shell a failed read never retried on the default mount | — | Fixed `d89477d0` / `f21f4ff9`: asked again on the next view, tab or timeframe change | B22; row |
| NEW-3 | R1 · doc | The spec's Copy row omitted the new strings | — | Fixed | — |
| D1 | D · low | The symbol could not shrink; WWWWW pushed ✕ 19.5 px off | R2: fix HOLDS (no real ticker cut 320–430) | Fixed `f15404aa` | B23; browser row |
| D2 | D · low | "·" could start a line; "PM" alone | R2: fix HOLDS | Fixed: no-break spaces | B24 |
| D3 | D · low | Harness bound looser than the row edge; a vacuous check; wrong pointer | R2: fix HOLDS, adds no detection while D1 is in | Fixed | — |
| C1 | C · should-fix | Off-shell tab gate unpinned | R2: row kills it | Row | B25 |
| C2 | C · should-fix | Held → navigation to a non-held peer unpinned | R2: killed | Row | B26 |
| C3/C31 | C · should-fix | `'unavailable'` model unpinned | R2: killed | Row | B27 |
| C5/C23 | C · should-fix | Loading state and copy unpinned | R2: killed | Row | B28, B29 |
| C6 | C · should-fix | One read for an unranked name unpinned | R2: killed | Row | B30 |
| C26 | C · should-fix | A symbol change mid-read unpinned | R2: killed (the late-answer half rests on the per-symbol map) | Row | B31 |
| C28 | C · note | "as of" day in UTC vs ET | R2: killed | Row | B32 |
| C15 | C · note | No "as of" without a time | R2: killed | Row | B33 |
| C19 | C · note | `itemKeyOf`'s symbol half pinned only by a literal | R2 CONFIRMED, still open | Note — equivalent today (one kind per pack, one symbol per item) | — |
| V1 | C · should-fix | The mode-off half of a row was vacuous; "V4" not mounted | R2: the split rows are not vacuous | Retitled; bench and V4 rows | — |
| NEW-R2-1 | R2 · low | The NEW-2 fix put the view counter in the read's deps: a view change re-sent a read in flight (3 reads for 1) | — | Fixed `f21f4ff9`: the counter is read at the ask only; `33e8b459`'s simplification (B22 survived as equivalent there) is replaced | B34; row |
| NEW-R2-2 | R2 · low | A retry in flight showed *failed*, not *loading* | — | Fixed | B35; row |
| NEW-R2-3 | R2 · nit | A stale comment | — | Fixed | — |

R2's other notes (unpinned, low): the off-shell bomb series on a non-Bomb tab (X11), the view token without the timeframe (X7) or the shell view (X8), the `cancelled` guard (X9, harmless — answers are keyed by symbol); D3's tighter bound fires only for a WWWWW-sized overflow now that the symbol gives way, and the WWWWW rows do not assert the symbol is cut.

Reports, probes and logs stay in the session scratchpad (`review/`); every probe was written inside its own snapshot and deleted; every mutated source was restored and checked by SHA-256.

## §8 Found on the way (reported, not fixed)

1. **Bench and 💣 can print readings from two runs (LA-3).** The bench sheet fetches its rows when opened; 💣 reads when opened; the rankings run hourly. The bench prints no time for its ATR. A fix is to hand the bench row's own `atrPct` through the bench → modal door, or to print the rankings time on the bench. For the founder.
2. **One decimal vs two (LA-8, ruled).** The label prints 4.0 %; the levels table prints the rung as +4.05 %; `toFixed(1)` rounds 4.05 down and 4.15 up (binary floats). Ruled one decimal to match the bench; recorded.
3. **BS-4 has no switch of its own (LB-5).** With Bomb mode `'on'` in production and the sheet `'off'`, BS-4 changes every measured battle's non-held 💣 preview as soon as PR B merges — one Firestore read per such open (the battle mounts open on the Bomb tab). The only kill switch is Bomb mode `'off'` (all of Bomb mode). No golden pins the bomb-on/sheet-off non-held path; `bombAtr.jsdom` holds it as behaviour rows.
4. **The intraday reading vs the swap's (LA-4).** The founder may prefer the pre-market run's reading (completed bars, closer to a swap). Today the document holds the latest run's.
5. **A navigated held stock** (a held name reached inside the modal) shows a preview, as before this PR; with BS-4 it is the ATR preview. Its measured ladder is not shown there (pre-existing).
6. **`priceText` prints no thousands separator** (BS-3): `$712345.67`. The shell report's §12.7 measurement used `$712,345.67`.
7. **Bench ATR at one decimal hides the second**: ACN reads `ATR 4.0%` on the bench for 4.05.
8. **The `'unavailable'` model's non-held rows** keep the screen's threshold (atrPercentile × 8) while its held rows say no rung is drawn (LA-7, pre-existing).
9. **"as of" is the batch commit time** (`serverTimestamp`), minutes after the run's quotes (LA-9).

## §9 The founder's live checklist

After PR A merges and deploys, in a live agent battle, on an iPhone, signed in as the founder. Times are Central (the market runs 8:30 AM – 3:00 PM CT); the app prints Eastern.

1. **Open a held stock:** Analysis first, no chart; the holding line, *What it decided* and the three questions visible without scrolling.
2. **Chart view on real data:** candles in red and green by how each day closed; the price axis fits the candles; the volume bars sit low and vary. A screenshot of anything off.
3. **Tap a question, then Ask once:** the answer shows on Analysis, and the count drops by one.
4. **💣:** as you know it. Then open a bench name's 💣: its rung size matches the bench sheet's ATR column (after PR B merges). *(Both print one decimal: ACN's 4.05 reads "ATR 4.0%" on the bench and "ATR reading 4.0%" in 💣.)*
5. **A stock from search:** today's modal, unchanged (browse waits for `'on'`).

## §10 What ran where, and cleanup

| What | Where |
|---|---|
| Full suites, rules suites, lint gate, builds, dist comparisons, both mutation batteries | WSL Ubuntu (Node 20.20.2, JDK 21, `TZ=UTC`): detached worktrees of `~/pd-ci` — `~/pd-ci-sheetflip` (PR A), `~/pd-ci-sheetflipk` (`main`, the kill-switch and value-only builds, both-together), `~/pd-ci-preon` (PR B) — `node_modules` linked to `~/pd-af0` (lock `40382e64edb6`, equal on every tree). Outputs under `~/pd-preon-runs`. Full suites under `flock /tmp/pd-suite.lock`, 8 workers, one at a time; exit codes and the JSON reporter read directly, never through `tail`. |
| Targeted rows while building | Windows, the worktree, with the parent checkout's vitest |
| Review lenses and refuters | Windows, one `git archive` snapshot each under the scratchpad (`review/snap-A` … `snap-R2`) |
| BS-3 browser rows; lens D's measurements | Headless Edge (playwright-core); Segoe UI / Consolas drew |
| Smoke preview (lens D, the 320 px calibration) | https://trade-seven-k3oqeyevx-fais-projects-bc179554.vercel.app/?sheetFixture=held_tf — the shell's smoke (fixtures only, read-only public market tabs) |

**Cleanup.** After the last check, under `flock /tmp/pd-suite.lock`: each tree's `node_modules` link removed first (it points at `~/pd-af0`, left untouched), then `git -C ~/pd-ci worktree remove --force` and `worktree prune` for `~/pd-ci-sheetflip`, `~/pd-ci-sheetflipk`, `~/pd-ci-preon`, and `~/pd-preon-runs` deleted. The space freed is in the PR descriptions (a report cannot hold what happens after its own commit). No other session's tree was touched.
