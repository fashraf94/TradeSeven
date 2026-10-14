# Phase 0 — Cockpit Build 2b discovery: the timing read, seams, and live counts

**Date:** 2026-10-14 · **Branch:** `claude/phase0-build2b-cockpit` (the Code tab's worktree branch is `claude/phase0-build2b-cockpit-6caf52`; pushed under the prompt's name) · **Code HEAD:** `d5d8fa9b` (= `origin/main` after `git fetch origin`, the #957 merge; every `file:line` below is at it — the branch's own commits add this report, the script and the design pass, no product code) · **First commit:** `6e539963` = `docs/design/COCKPIT_DESIGN_PASS_V1.md`, byte for byte (SHA-256 `4241e860fbfde428b43657de180e79d18f2e521bc772c8bc7bc0ff69984f990e`, verified on the attached file, the staged blob and the committed blob) · **Tree:** clean at start.
**Scope:** the two allowlisted accounts, labelled **founder** and **FT_QA** (no uid in this file or the script), on the cockpit-on ET sessions **Oct 6–14** (week 1 = Oct 6–9, week 2 = Oct 12–14), beside the founder's pre-flip battles: *off* (Sep 21–25, Oct 2 and Oct 5 — entries with no `declarationsPhase`) and *shadow* (Sep 28–Oct 1). Facts only; no recommendations.
**Read-only:** Firestore reads through the Admin SDK (`.env.local` credentials, loaded as the existing read scripts load them), `git` reads, nothing else. No product source, flag, rule, index or schema changed. No model API call: every token figure is read from the stored tick bodies' `usage`. The raw dump went to the git-ignored `reads-raw/` folder; nothing raw is committed.
**The accounts:** the prompt's two uid placeholders arrived unfilled. The uids were taken from the week-1 read's git-ignored raw dump (`reads-raw/cockpit-week1/`, the battles' owner fields under their `founder` / `FT_QA` labels) on this machine, passed inline for each run (`COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA>`), never written to `.env.local`, a committed file or this report.
**Markers (BUILD_RULES §3):** a code claim cites `file:line` and is **VERIFIED** when read in this session at HEAD; **ASSUMED** when taken from a document, a subagent's read not re-read here, or inferred; **COMPUTED** when the script produced it from Firestore.
**BUILD_RULES §2:** the branch diff is 3 files, 1,246 insertions (the design pass 209, the script 585, this report 452), no deletions — under the review threshold (10 files or 1,500 lines), so no §2 review was run.
**Sources:** `scripts/build2b-discovery.mjs` (new; every table under "Generated" is its output, inserted verbatim) and the code reads below. Four read-only Explore subagents mapped B3, B7, B8 and B9/B1's breadth; every line they cited that this report relies on was re-read here (VERIFIED) or is marked ASSUMED.

---

## Executive table

| Question | Answer |
|---|---|
| When was this read? | **2026-10-14 12:36 ET, inside the session.** Oct 14 has no check yet in either account: the founder's battle `vwuCE…` (created 11:38 ET, `baggerbomb_agent`, expires 20:00 ET) had **no evaluation entry after four cron slots** (`cronState.lastEvaluatedAt` null); FT_QA has no Oct 14 battle. Every Oct 14 row below is therefore empty; a re-read after the close is the one thing that would move these tables. |
| What ran? | 16 battle-days: founder 13 (momentum_chaser; Oct 6–9, 12, 13), FT_QA 3 (diversifier; Oct 6, 7, 12). 249 checks, 154 calls, 133 declarations records; 0 calls open at read. |
| Did timeouts rise with the cockpit (DP-7)? | **Yes, and they stayed up in week 2.** Founder: 16.0% of model calls (32 of 200; 7.0% in the shadow weeks, 8.4% off); week 2 alone 30.4% (7 of 23). FT_QA 38.5% (15 of 39). Every timeout is the SDK's 20-second limit; the 22-second backstop never fired. The ten Oct 8 API refusals are outside every rate. |
| Is it the declarations block? | The numbers say three things. A check's time is set by how much the agent writes: output tokens and call time correlate 0.99 (founder). The answers got longer at the top: 28% of readable founder answers are ≥ 1,500 tokens at `on`, 12% in shadow, 16% off. But completed declaring and non-declaring checks differ by about 90 tokens and 1.2 s at the median, and the declarations block is 9% of the answer's characters (FT_QA 10.5%). The Diversifier writes 1,537 tokens at the median (founder 1,291) and its call takes 19.3 s at the median. Timeouts cluster at 12:00–13:00 ET for the founder (23%, 17%) and at 14:00–15:00 ET for FT_QA (40%, 50%). |
| Input size | The `on` tool schema is 13,625 characters against 8,539 off (+5,086, the declarations property); input tokens at the median 14,701 (on), 14,235 (shadow), 13,150 (off). The Diversifier's prompt is 349 tokens larger than the founder's at the median. |
| Headroom for a 30 s timeout | The admission requirement is 48 s today and would be 58 s (five worst-case checks per 290 s invocation instead of six); no on-window tick exceeded 48 s (max 44.2 s). The post-call allowance (12 s) cannot be measured on its own from the records. |
| Called shots per check | Founder raw mean 1.23 (2 of 117 declaring checks wrote more than 3; the validator kept none above 3); FT_QA 1.81 (none above 3). The cap of 6 was never approached. |
| What would lead the Now card? | Founder: an exit with no replacement at 38% of checks, a hold-default shot 24%, a Confirmation 13%, a live command alone 3%, nothing 21%; the lead changed at 31% of consecutive checks. FT_QA: the no-replacement exit at 85%. |
| How many chips in the Also-live strip? | Open threads per check: founder battles average 0.7–5.1 (max 10); FT_QA 1–7.1 (max 9). |
| The replacement step | 103 exit calls with no usable replacement (founder 90, 6.9 per battle-day; FT_QA 13). At the founder's 88 readable checks the agent's own lists held ≥ 2 available names for 39 calls (44%) and ≥ 1 for 58 (66%); FT_QA 5 and 10 of 13. The bench itself showed ≥ 2 available names at every readable check but one. |
| Two commands wanted | Zero refusals in the window and no filing replaced a live command. Two or more overrideable symbols were open at 61% of the founder's checks and 72% of FT_QA's. |
| Stale commands | 1 of 3: the VLO "Go now" (Oct 6) outlived its stock by 11 prompts; the ZS (Oct 9) and META (Oct 12) commands did not. |
| Following your call | 9 calls were minted under a live command on their symbol, direction and side (6 ZS, 3 META); every one matched the command's default and sat within 1% of its level. |
| Week 2 beside week 1 | Founder 2 battle-days, 23 checks, 30.4% timeouts (14.1% in week 1), 3 answers (1 override, 2 agreements), nothing broken; FT_QA 1 battle-day, 6 checks, 2 calls, no answer. The sweep closed every week-2 past-deadline call 0.6 min after its deadline (week 1: up to 31 min). |
| The seams, one line each | B1 a new `commandsUsed` key is a fence question (the battle doc's shape); B2 one refusal branch stands between today and "replace"; B3 one writer, six call sites, only the model path feeds the calls pipeline; B4 the terminal tag branches never read `actedEvalId`; B5 the prompt's only bench score is the platform's `technicalScore` — no agent score exists; B6 the text reaches only the decider's prompt; B7 the screener is unreachable from a battle and has no symbol scope; B8 the calls are already in scope where the rows render; B10 PR #958 is the one live collision. |

---

## Part A — the timing read (DP-7)

Read at 2026-10-14T16:36:01.963Z (2026-10-14 12:36 ET) · HEAD `6e539963` · #931 merged 2026-10-05T17:35:34-05:00 (`693dc323`). Battles owned by the two accounts: 102 (founder 98, FT_QA 4); read in full (expiry on/after 2026-09-21, or active): 35. Windows: on = ET sessions 2026-10-06, 2026-10-07, 2026-10-08, 2026-10-09, 2026-10-12, 2026-10-13, 2026-10-14 (week 1 = 2026-10-06, 2026-10-07, 2026-10-08, 2026-10-09; week 2 = 2026-10-12, 2026-10-13, 2026-10-14); pre-flip = 2026-09-21 up to the #931 merge instant, shadow when the entry carries `declarationsPhase`, off otherwise.

| Account · archetype | Window | Battles | Battle-days | Checks | ET days |
|---|---|---|---|---|---|
| FT_QA · diversifier | on | 3 | 3 | 39 | 2026-10-06, 2026-10-07, 2026-10-12 |
| founder · contrarian | pre-flip · off | 1 | 1 | 15 | 2026-09-21 |
| founder · momentum_chaser | on | 13 | 13 | 210 | 2026-10-06, 2026-10-07, 2026-10-08, 2026-10-09, 2026-10-12, 2026-10-13 |
| founder · momentum_chaser | pre-flip · shadow | 9 | 9 | 157 | 2026-09-28, 2026-09-29, 2026-09-30, 2026-10-01 |
| founder · momentum_chaser | pre-flip · off | 7 | 7 | 119 | 2026-09-22, 2026-09-23, 2026-09-25, 2026-10-02, 2026-10-05 |

- Active at read: founder `vwuCE…` (expires 2026-10-14 20:00 ET). Open calls at read (on window): 0. `declarationsPhase` values on the on-window checks: `expected` ×133, `none` ×116.

### A1 · Timeout rate and callMs

**In plain terms.** The founder's timeout share is 16.0% of model calls over the cockpit-on window (32 of 200), against 7.0% in the shadow weeks and 8.4% off; week 2's two battle-days ran 30.4%. FT_QA (Diversifier) is at 38.5% over three battle-days. Every timeout is the SDK's own 20-second limit (`timeoutKind: sdk`); the 22-second backstop never fired. The ten API-refused checks (Oct 8, HTTP 400 "usage limits") are outside every rate here. Among completed checks the median call is 1.2 s longer when the check declares (15.5 s vs 14.3 s, founder), while the p90 and p95 are not; the whole distribution's median moved from 15.3 s (shadow) to 16.0 s (on). By hour, the founder's timeouts cluster at 12:00 (22.7%) and 13:00 ET (17.0%) and thin out by 15:00 (9.1%); FT_QA's at 14:00–15:00 ET (40%, 50%). By day: Oct 7 23.1%, Oct 12 46.2% (6 of 13), Oct 9 5.9%.

A *model call* is a dispatched check (finite `callMs`) that the API did not refuse; API-refused checks (`failureClass` = an HTTP status) are left out of every rate and listed in their own column. A timed-out check has no answer, so it cannot be classified as declaring: the declaring / non-declaring split covers completed checks (no `haikuError`), and timeouts stand beside them. `callMs` p50 · p90 · p95 in ms.

| Account · archetype | Window | Checks | Model calls | API-refused (separate) | Timeouts | `timeoutKind` | Other failures | callMs p50 · p90 · p95 (model calls) | Declaring / completed | callMs, completed declaring | callMs, completed non-declaring |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | on | 39 | 39 | 0 | 15 / 39 (38.5%) | `sdk` ×15 | none | 19280 · 20005 · 20007 (n=39) | 16 / 24 | 18458 · 19326 · 19485 (n=16) | 16800 · 19496 · 19496 (n=8) |
| founder · contrarian | pre-flip · off | 15 | 15 | 0 | 1 / 15 (6.7%) | `sdk` ×1 | none | 16190 · 18982 · 20007 (n=15) | 0 / 14 | n/a | 15738 · 18112 · 18982 (n=14) |
| founder · momentum_chaser | on | 210 | 200 | 10 | 32 / 200 (16.0%) | `sdk` ×32 | `invalid_tool_result` ×1 | 15996 · 20004 · 20005 (n=200) | 117 / 167 | 15491 · 18946 · 19263 (n=117) | 14295 · 19027 · 19833 (n=50) |
| founder · momentum_chaser | pre-flip · shadow | 157 | 157 | 0 | 11 / 157 (7.0%) | `sdk` ×11 | `invalid_tool_result` ×4 | 15303 · 19583 · 20004 (n=157) | 4 / 142 | 17607 · 19031 · 19031 (n=4) | 14883 · 17883 · 18758 (n=138) |
| founder · momentum_chaser | pre-flip · off | 119 | 119 | 0 | 10 / 119 (8.4%) | `sdk` ×10 | `invalid_tool_result` ×3 | 15784 · 19358 · 20004 (n=119) | 0 / 106 | n/a | 15456 · 18401 · 19022 (n=106) |

By ET hour of the check (on window):

| Account · archetype | ET hour | Checks | Model calls | API-refused (separate) | Timeouts | `timeoutKind` | Other failures | callMs p50 · p90 · p95 (model calls) | Declaring / completed | callMs, completed declaring | callMs, completed non-declaring |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | 11:00 | 3 | 3 | 0 | 1 / 3 (33.3%) | `sdk` ×1 | none | 18458 · 20006 · 20006 (n=3) | 2 / 2 | 17086 · 18458 · 18458 (n=2) | n/a |
| FT_QA · diversifier | 12:00 | 6 | 6 | 0 | 2 / 6 (33.3%) | `sdk` ×2 | none | 19206 · 20004 · 20004 (n=6) | 4 / 4 | 18399 · 19230 · 19230 (n=4) | n/a |
| FT_QA · diversifier | 13:00 | 8 | 8 | 0 | 2 / 8 (25.0%) | `sdk` ×2 | none | 18133 · 20004 · 20004 (n=8) | 3 / 6 | 19311 · 19326 · 19326 (n=3) | 16609 · 18133 · 18133 (n=3) |
| FT_QA · diversifier | 14:00 | 10 | 10 | 0 | 4 / 10 (40.0%) | `sdk` ×4 | none | 19280 · 20004 · 20005 (n=10) | 5 / 6 | 18483 · 19485 · 19485 (n=5) | 16800 · 16800 · 16800 (n=1) |
| FT_QA · diversifier | 15:00 | 12 | 12 | 0 | 6 / 12 (50.0%) | `sdk` ×6 | none | 19496 · 20007 · 20008 (n=12) | 2 / 6 | 17387 · 18529 · 18529 (n=2) | 17383 · 19496 · 19496 (n=4) |
| founder · momentum_chaser | 09:00 | 12 | 12 | 0 | 2 / 12 (16.7%) | `sdk` ×2 | none | 16250 · 20004 · 20005 (n=12) | 7 / 10 | 16250 · 19174 · 19174 (n=7) | 14856 · 19865 · 19865 (n=3) |
| founder · momentum_chaser | 10:00 | 1 | 1 | 0 | 0 / 1 (0.0%) | none | none | 10947 · 10947 · 10947 (n=1) | 1 / 1 | 10947 · 10947 · 10947 (n=1) | n/a |
| founder · momentum_chaser | 11:00 | 2 | 2 | 0 | 1 / 2 (50.0%) | `sdk` ×1 | none | 18105 · 20005 · 20005 (n=2) | 1 / 1 | 18105 · 18105 · 18105 (n=1) | n/a |
| founder · momentum_chaser | 12:00 | 44 | 44 | 0 | 10 / 44 (22.7%) | `sdk` ×10 | none | 17571 · 20004 · 20005 (n=44) | 26 / 34 | 17082 · 19047 · 19265 (n=26) | 16989 · 18158 · 18158 (n=8) |
| founder · momentum_chaser | 13:00 | 47 | 47 | 0 | 8 / 47 (17.0%) | `sdk` ×8 | none | 16897 · 20004 · 20005 (n=47) | 32 / 39 | 15763 · 19136 · 19550 (n=32) | 15491 · 19094 · 19094 (n=7) |
| founder · momentum_chaser | 14:00 | 52 | 50 | 2 | 7 / 50 (14.0%) | `sdk` ×7 | `invalid_tool_result` ×1 | 15165 · 20002 · 20004 (n=50) | 29 / 42 | 13477 · 17766 · 17883 (n=29) | 16384 · 19833 · 19908 (n=13) |
| founder · momentum_chaser | 15:00 | 52 | 44 | 8 | 4 / 44 (9.1%) | `sdk` ×4 | none | 12537 · 19789 · 20004 (n=44) | 21 / 40 | 14287 · 19012 · 19192 (n=21) | 9568 · 17911 · 18985 (n=19) |

By ET day (on window):

| Account · archetype | ET day | Checks | Model calls | API-refused (separate) | Timeouts | `timeoutKind` | Other failures | callMs p50 · p90 · p95 (model calls) | Declaring / completed | callMs, completed declaring | callMs, completed non-declaring |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | 2026-10-06 | 15 | 15 | 0 | 7 / 15 (46.7%) | `sdk` ×7 | none | 19485 · 20004 · 20005 (n=15) | 6 / 8 | 18399 · 19485 · 19485 (n=6) | 16255 · 17383 · 17383 (n=2) |
| FT_QA · diversifier | 2026-10-07 | 18 | 18 | 0 | 6 / 18 (33.3%) | `sdk` ×6 | none | 19230 · 20006 · 20007 (n=18) | 7 / 12 | 19206 · 19326 · 19326 (n=7) | 16800 · 19496 · 19496 (n=5) |
| FT_QA · diversifier | 2026-10-12 | 6 | 6 | 0 | 2 / 6 (33.3%) | `sdk` ×2 | none | 18483 · 20008 · 20008 (n=6) | 3 / 4 | 18483 · 18529 · 18529 (n=3) | 17741 · 17741 · 17741 (n=1) |
| founder · momentum_chaser | 2026-10-06 | 50 | 50 | 0 | 6 / 50 (12.0%) | `sdk` ×6 | none | 14856 · 20003 · 20003 (n=50) | 28 / 44 | 12911 · 19012 · 19047 (n=28) | 15491 · 19151 · 19908 (n=16) |
| founder · momentum_chaser | 2026-10-07 | 52 | 52 | 0 | 12 / 52 (23.1%) | `sdk` ×12 | none | 16897 · 20004 · 20004 (n=52) | 26 / 40 | 15312 · 19192 · 19265 (n=26) | 14231 · 19027 · 19833 (n=14) |
| founder · momentum_chaser | 2026-10-08 | 34 | 24 | 10 | 4 / 24 (16.7%) | `sdk` ×4 | none | 17593 · 20004 · 20005 (n=24) | 17 / 20 | 17593 · 18946 · 19861 (n=17) | 14791 · 17031 · 17031 (n=3) |
| founder · momentum_chaser | 2026-10-09 | 51 | 51 | 0 | 3 / 51 (5.9%) | `sdk` ×3 | `invalid_tool_result` ×1 | 14287 · 19136 · 20003 (n=51) | 32 / 47 | 14287 · 17833 · 19136 (n=32) | 12875 · 18999 · 19865 (n=15) |
| founder · momentum_chaser | 2026-10-12 | 13 | 13 | 0 | 6 / 13 (46.2%) | `sdk` ×6 | none | 19263 · 20005 · 20006 (n=13) | 7 / 7 | 17682 · 19263 · 19263 (n=7) | n/a |
| founder · momentum_chaser | 2026-10-13 | 10 | 10 | 0 | 1 / 10 (10.0%) | `sdk` ×1 | none | 16140 · 18985 · 20008 (n=10) | 7 / 9 | 16091 · 18357 · 18357 (n=7) | 16384 · 18985 · 18985 (n=2) |

- API-refused checks, by day and message: `on · founder · momentum_chaser · 2026-10-08 · 400: {"type":"error","error":{"type":"invalid_request_error","message":"You…` ×10.

### A2 · Output tokens vs callMs; the declarations block's share

**In plain terms.** 168 of the founder's 200 on-window model calls left a readable answer (the 32 timeouts stored their request and no response); 24 of 39 for FT_QA; 146 of 157 shadow and 109 of 119 off; the Sep 21 contrarian battle has no bodies (capture began Sep 22). Output tokens and call time move together almost exactly (founder 0.99; shadow 0.96; off 0.93): a 500–999-token answer takes 9.9 s at the median, 1,000–1,499 takes 14.6 s, 1,500–1,999 takes 18.7 s with a p95 of 19.9 s, a hair under the limit. What changed at `on` is the share of long answers: 47 of 168 readable founder answers (28%) are ≥ 1,500 tokens, against 17 of 146 (12%) in shadow and 17 of 109 (16%) off. Declaring and non-declaring completed checks differ little (1,299 vs 1,213 tokens at the median), and the declarations block is 8.8% of the answer's characters on average (FT_QA 10.5%; the four shadow declarations 14.6%). Raw called shots correlate 0.62 with output tokens (FT_QA 0.71). The Diversifier's answers are longer throughout: 1,537 tokens at the median. No answer hit the 3,072-token ceiling.

A body is *readable* when the stored response carries `usage.output_tokens` (a timed-out check stores its request and no response). The declarations share is a character-share proxy: the JSON length of the tool input's `declarations` block over the JSON length of the whole tool input (no token counter is called).

| Account · archetype | Window | Bodies readable / model calls | Timeouts with a request and no response | corr(output tokens, callMs) | Output tokens p50 · p90 · p95 | …declaring checks | …non-declaring checks | Declarations share of the tool input (mean · median) | corr(raw called shots, output tokens) | `max_tokens` stops |
|---|---|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | on | 24 of 39 | 15 | 0.86 | 1537 · 1788 · 1793 (n=24) | 1591 · 1793 · 1898 (n=16) | 1476 · 1681 · 1681 (n=8) | 10.47% · 11.55% (n=16) | 0.71 | 0 |
| founder · contrarian | pre-flip · off | 0 of 15 | 0 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| founder · momentum_chaser | on | 168 of 200 | 32 | 0.99 | 1291 · 1658 · 1700 (n=168) | 1299 · 1658 · 1703 (n=117) | 1213 · 1650 · 1700 (n=51) | 8.79% · 9.15% (n=117) | 0.62 | 0 |
| founder · momentum_chaser | pre-flip · shadow | 146 of 157 | 11 | 0.96 | 1212 · 1524 · 1589 (n=146) | 1555 · 1663 · 1663 (n=4) | 1207 · 1497 · 1586 (n=142) | 14.56% · 16.68% (n=4) | 0.32 | 0 |
| founder · momentum_chaser | pre-flip · off | 109 of 119 | 10 | 0.93 | 1256 · 1579 · 1664 (n=109) | n/a | 1256 · 1579 · 1664 (n=109) | n/a | n/a | 0 |

| Account · archetype | Window | Output tokens | Checks | callMs p50 · p90 · p95 | Declaring | Raw called shots (mean) |
|---|---|---|---|---|---|---|
| FT_QA · diversifier | on | 500–999 | 1 | 12225 · 12225 · 12225 (n=1) | 1 / 1 (100.0%) | 0 |
| FT_QA · diversifier | on | 1000–1499 | 9 | 16800 · 18529 · 18529 (n=9) | 4 / 9 (44.4%) | 0.3 |
| FT_QA · diversifier | on | 1500–1999 | 14 | 18483 · 19485 · 19496 (n=14) | 11 / 14 (78.6%) | 1.9 |
| founder · momentum_chaser | on | 500–999 | 35 | 9852 · 11641 · 11949 (n=35) | 18 / 35 (51.4%) | 0.1 |
| founder · momentum_chaser | on | 1000–1499 | 86 | 14647 · 16989 · 17173 (n=86) | 65 / 86 (75.6%) | 0.8 |
| founder · momentum_chaser | on | 1500–1999 | 47 | 18726 · 19789 · 19861 (n=47) | 34 / 47 (72.3%) | 1.6 |
| founder · momentum_chaser | pre-flip · shadow | 500–999 | 44 | 10645 · 12692 · 13827 (n=44) | 0 / 44 (0.0%) | 0 |
| founder · momentum_chaser | pre-flip · shadow | 1000–1499 | 85 | 15694 · 17649 · 18088 (n=85) | 1 / 85 (1.2%) | 0.0 |
| founder · momentum_chaser | pre-flip · shadow | 1500–1999 | 17 | 18687 · 19860 · 19874 (n=17) | 3 / 17 (17.6%) | 0.4 |
| founder · momentum_chaser | pre-flip · off | 500–999 | 26 | 10414 · 12570 · 13506 (n=26) | 0 / 26 (0.0%) | 0 |
| founder · momentum_chaser | pre-flip · off | 1000–1499 | 66 | 15716 · 18122 · 18291 (n=66) | 0 / 66 (0.0%) | 0 |
| founder · momentum_chaser | pre-flip · off | 1500–1999 | 17 | 18401 · 19358 · 19863 (n=17) | 0 / 17 (0.0%) | 0 |

### A3 · Input size per check

**In plain terms.** Every dispatched check's request is readable, timeouts included. The `on` request is 46,217 characters at the median (founder), 1,240 more than shadow and 5,536 more than off; the difference sits in the tool schema (13,625 characters at on, 13,166 shadow, 8,539 off: the declarations property) and in the messages (16,343 vs 15,893). In tokens the completed checks read 14,701 at the median (shadow 14,235, off 13,150; p95 16,705). The Diversifier's prompt is 46,382 characters and 15,050 tokens at the median, 349 tokens more than the founder's. The BENCH TECHNICAL CONTEXT block (B5) is in 207 of 210 founder prompts and in all 39 of FT_QA's.

Request characters come from the stored request (system + the three messages + the tool schema), so they cover timed-out checks too; input tokens come from the response's `usage.input_tokens`, so completed checks only.

| Account · archetype | Window | Requests readable / dispatched | Request chars p50 · p90 · p95 | System chars p50 | Message chars p50 | Tool schema chars p50 | Input tokens p50 · p90 · p95 | Prompts with a BENCH TECHNICAL CONTEXT block |
|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | on | 39 of 39 | 46382 · 48256 · 48659 (n=39) | 16261 | 16496 | 13625 | 15050 · 15806 · 15837 (n=24) | 39 of 39 |
| founder · contrarian | pre-flip · off | 0 of 15 | n/a | n/a | n/a | n/a | n/a | 0 of 0 |
| founder · momentum_chaser | on | 210 of 210 | 46217 · 51132 · 51561 (n=210) | 16249 | 16343 | 13625 | 14701 · 16579 · 16705 (n=168) | 207 of 210 |
| founder · momentum_chaser | pre-flip · shadow | 157 of 157 | 44977 · 48316 · 49963 (n=157) | 16249 | 15562 | 13166 | 14235 · 15551 · 16054 (n=146) | 153 of 157 |
| founder · momentum_chaser | pre-flip · off | 119 of 119 | 40681 · 45888 · 46019 (n=119) | 16249 | 15893 | 8539 | 13150 · 15126 · 15157 (n=109) | 115 of 119 |

### A4 · The model timeout and the admission budget at HEAD

**The constants (all VERIFIED):**

| Quantity | Value | Where |
|---|---|---|
| The SDK's per-request timeout on the one `messages.create` call | 20,000 ms | `api/cron/agent-evaluate.js:2902` `{ timeout: 20_000, signal: abortCtrl.signal }` |
| The AbortController backstop, armed after the build | 22,000 ms | `agentEvalTransport.js:14` `HAIKU_CALL_CEILING_MS = 22_000`; armed `agent-evaluate.js:2876` |
| The prompt-build ceiling (a race, before the call) | 10,000 ms | `agentEvalTransport.js:36`; the race `agent-evaluate.js:2831-2840` |
| The post-call allowance | 12,000 ms | `agentEvalTransport.js:15` `HAIKU_POST_CALL_ALLOWANCE_MS = 12_000` |
| The calls phase's admission reserve at shadow/on | 4,000 ms | `publish.js:60` `CALLS_RESERVE_MS = 4_000`, `:87-88` `callsReserveMsFor` |
| **The admission requirement at `on`** | **48,000 ms** = 10,000 + 22,000 + 12,000 + 4,000 | `agentEvalTransport.js:178-189` (`requiredMs` is the sum, "never a literal"); the gate `agent-evaluate.js:2744`, the skip `:2759-2782` (`budget_skipped`) |
| The handler's soft budget | 290,000 ms | `agent-evaluate.js:206` `TIME_BUDGET_MS = 290_000` |
| The handler's hard kill | 300 s | `:202` `config = { maxDuration: 300 }`; `:550` `HARD_CEILING_MS` |
| Battles per invocation | serial, deferred past the budget | `:446-447` `for (const [index, battle] of activeBattles.entries())` … `if (elapsed > TIME_BUDGET_MS) { … break; }` |
| The per-battle lock | 120,000 ms | `:205` `EVALUATING_LOCK_TIMEOUT_MS = 120_000` |
| SDK retries | 0 | `:211-219` (`maxRetries: 0`, "2 retries × the 20s per-request timeout ≈ 60s per battle") |
| The cron cadence | every 15 min, 13:00–21:45 UTC, weekdays | `vercel.json:157-158` |

**The arithmetic for a 30 s model timeout** (DP-7 option 1), shown two ways:

1. **The backstop follows the timeout** (the code's own rule: "a defense-in-depth backstop 2s above it", `:2866`). `HAIKU_CALL_CEILING_MS` → 32,000; the requirement → 10,000 + 32,000 + 12,000 + 4,000 = **58,000 ms** (+10,000). Against the handler: 290,000 / 48,000 = 6.04 worst-case checks fit today, 290,000 / 58,000 = **5.0** at 30 s; the gate admits a check only while `remaining ≥ 58,000`, so the last admitted check still ends inside the 290 s budget and the 10 s buffer to the kill (`:206`) is untouched. The lock (120,000) stays above one check (58,000).
2. **The admission budget held at 48,000** (the requirement's terms changed so the sum stays): 48,000 − 10,000 − 32,000 − 4,000 = **2,000 ms** for post-call work, against 12,000 today. The records cannot say how long the post-call work takes on its own: `tickMs` spans the whole tick from admission under the lock to the final update (`agent-evaluate.js:893`, `:4162`), so `tickMs − buildMs − callMs` (the table below) holds the pre-build work — quotes, the risk loop, triggers — as well as the post-call work. The table below gives those sums.

**What the checks actually took (COMPUTED):** no on-window tick exceeded the 48 s requirement: tickMs p95 33.3 s (founder), 41.6 s (FT_QA), max 44.2 s. The build is 2–3 ms at the median; the call 16.0 s (founder) and 19.3 s (FT_QA); the rest of the tick (the pre-build fetches and risk loop plus the post-call work) 8.9 s at the median and 16.4 s at p95 for the founder, 12.9 s and 21.6 s for FT_QA, against 7.2 s and 12.5 s in the shadow weeks.

From the evaluation entries: `buildMs` (the prompt build), `callMs` (the model call) and `tickMs` (the whole tick, from admission under the lock to the final update, so it also holds the pre-build work: quotes, the risk loop, triggers). The rest = tickMs − buildMs − callMs, the pre-build and post-call work together; the records do not split the two. Model calls only; ms.

| Account · archetype | Window | Model calls | buildMs p50 · p90 · p95 | callMs p50 · p90 · p95 | tickMs p50 · p90 · p95 | The rest (tickMs − buildMs − callMs) p50 · p90 · p95 | tickMs > 48,000 | tickMs max |
|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | on | 39 | 3 · 8 · 9 (n=39) | 19280 · 20005 · 20007 (n=39) | 32165 · 36195 · 41620 (n=39) | 12932 · 17828 · 21602 (n=39) | 0 | 44199 |
| founder · contrarian | pre-flip · off | 15 | 5 · 9 · 11 (n=15) | 16190 · 18982 · 20007 (n=15) | n/a | n/a | 0 | n/a |
| founder · momentum_chaser | on | 200 | 2 · 5 · 6 (n=200) | 15996 · 20004 · 20005 (n=200) | 26200 · 32284 · 33291 (n=200) | 8881 · 14179 · 16383 (n=200) | 0 | 41951 |
| founder · momentum_chaser | pre-flip · shadow | 157 | 2 · 6 · 7 (n=157) | 15303 · 19583 · 20004 (n=157) | 22857 · 27583 · 29137 (n=157) | 7245 · 11663 · 12471 (n=157) | 0 | 32257 |
| founder · momentum_chaser | pre-flip · off | 119 | 3 · 9 · 9 (n=119) | 15784 · 19358 · 20004 (n=119) | 24427 · 30588 · 31701 (n=88) | 8198 · 12459 · 15026 (n=88) | 0 | 33552 |

### A5 · Called shots per declaring check

**In plain terms.** A declaring check carried 1.23 raw called shots on average (founder; 45 of 117 declaring checks carried none, the watching-only records) and 1.81 for FT_QA. The agent wrote more than three shots at 2 of 133 declaring checks (both the founder's, four shots each); after the validator's removals no record kept more than three. The cap of six was never approached. DP-7's option 2 (a cap of 3) would have touched two checks in the window.

Raw = the agent's `declarations.calledShots` as written in the tool input; kept = the record's list after validation (cap 6, `validate.js` DECLARATION_CAPS.shots).

| Account · archetype | Window | Declaring checks | Raw shots: histogram | Raw > 3 | Raw mean | Kept shots: histogram | Kept > 3 | Kept mean |
|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | on | 16 | `0` ×3, `1` ×1, `2` ×8, `3` ×4 | 0 | 1.81 | `0` ×3, `1` ×2, `2` ×8, `3` ×3 | 0 | 1.69 |
| founder · momentum_chaser | on | 117 | `0` ×45, `1` ×19, `2` ×36, `3` ×15, `4` ×2 | 2 | 1.23 | `0` ×45, `1` ×27, `2` ×35, `3` ×10 | 0 | 1.09 |
| founder · momentum_chaser | pre-flip · shadow | 4 | `1` ×1, `2` ×1, `3` ×2 | 0 | 2.25 | `1` ×1, `2` ×1, `3` ×2 | 0 | 2.25 |

---

## Part B — seams (every claim `file:line` at HEAD, VERIFIED unless marked)

### B1 · Commands (DP-3): where `chatBudgetUsed` is charged, and what `commandsUsed` would touch

**Today.** The answer endpoint charges the chat budget on directive rows only (acknowledgments write no charge, `api/agent/call-response.js:209-222`): it reads `parent[BATTLE_CHAT_BUDGET.field]` (`:264`), refuses `budget` at the cap (`:265`, the 409 body `:305-307`), computes `remaining` (`:266`) and hands `{ chatBudgetUsed: used + 1 }` to the shared writer with the slot (`:267`, `:281-284` `fields: { directive: slot, ...battleBudgetUpdate }`). League battles charge the per-day document instead (`:252-262`). The field and cap are one constant, `directiveFiling.js:97` `BATTLE_CHAT_BUDGET = { field: 'chatBudgetUsed', limit: 10 }`, shared with chat and the chip route.

**A separate `commandsUsed` (7 per battle, overrides and picks) touches:**

| Seam | Where | Note |
|---|---|---|
| The endpoint transaction | `call-response.js:264-268` (read, cap, remaining), `:283` (the written fields), `:289`/`:315` (`remaining` in the response), `:87` (`budget` reason) | the only writer the design names |
| The battle doc | a new top-level key. The creation literal sets `chatBudgetUsed: 0` (`api/_utils/agentBattleService.js:284`, fenced, read-only); the evaluator backfills a missing one (`agent-evaluate.js:983`) | BUILD_RULES §1 fences the `createAgentBattle` doc shape *as a concept*; the League counter lives in its own collection for that reason (`agentChatBudget.js:7-12`: "a new battle-doc key would touch the fenced createAgentBattle shape"). Whether a key the endpoint alone writes (absent read as 0) is fence contact is a founder question (below), not settled here |
| Rules | `firestore.rules:455-459`: the owner's client update is `hasOnly([...])` over ten keys, none of them a budget; `:452-453` owner read of the whole doc | server (Admin SDK) writes bypass rules, so a server-written `commandsUsed` needs no rule change and the client reads it with the doc |
| The client header | `AgentBattleScreen.jsx:2625-2633` computes `messagesLeft` from `chatBudgetUsed` and `BATTLE_CHAT_BUDGET.limit` (desktop only, `:2625`); `CockpitFeed.jsx:317-318` renders it (`data-cockpit-messages-left`); copy `battleViewCopy.js:974` | the bullet meter replaces this text |
| The buttons | `battleViewCopy.js:997-998` `'Hold off · 1 message'`, `'Go instead · 1 message'`; consumed `cockpitModel.js:263-267`; the refusal line `battleViewCopy.js:1135` `'No messages left — nothing was filed.'` | |
| Chat's own budget reads, unchanged by DP-3 | `chat.js:380-382` (`MODE_BUDGET.battle` = the same constant), `:523-542` (the gate; 403 `chat_budget_exceeded`), `:1121` (`FieldValue.increment(1)`); the chip route `file-directive.js:261-266` (an explicit count in its transaction); the composer `AgentChat.jsx:696-697` (a hard-coded `10`), `:1620` `{chatBudgetUsed}/10 battle`, `:1030-1031` (the exhausted line) | two limit sources already: the screen imports the constant (`AgentBattleScreen.jsx:90`, ASSUMED), the composer hard-codes 10 |
| Pins | `call-response.test.js:446` "the budget: a standard battle charges chatBudgetUsed once per accepted directive and refuses at the cap…"; the creation-doc photograph `p4Equivalence.battery.test.js:606` (`chatBudgetUsed: 0` in its snapshot) | ASSUMED (subagent-read titles) |

### B2 · Replace, not refuse (DP-4)

**The `directive_pending` path.** Directive rows run the guards in order (`call-response.js:224-246`): open and inside the deadline (`:225-226`), the parent active (`:227`), the belief (`:228-229` — `expectedDirectiveThreadId` must equal the slot's thread, so the client already names the directive it is about to displace), eligibility (`:230-232`), the agent binding (`:233-239`), then **the refusal**: when `isCallDirectivePendingAt` (`directiveUtils.js:136-150` — call-family slot, mode on, not past `expiresAtMs`, not killed, not suppressed, a *different* call `:148`) holds, the endpoint stores `refused` on the call (`:243-244`) and returns 409 `directive_pending` (`:245`).

**What replacing needs — and what already exists.** The write that follows the guards already performs a replacement: `fileDirectiveTransactional` (`:281-284`) is handed `priorSlot: parent.directive`; the writer stamps the new exchange `supersedes: { directiveThreadId, at }` when the prior slot is call-family and another thread (`directiveWriter.js:192-197`, `:239-241`) and creates the `superseded` call event at `on` in the same transaction (`:261`); the slot itself is overwritten whole (`directiveFiling.js:77-89` — "latest-wins is by construction"). This is the same writer the chat filing (`chat.js:1108`, `tx` null → the slot re-read at commit, `directiveWriter.js:268-295`) and the chip (`file-directive.js:291-299`) use. The replaced call's tile already reads "Replaced by a later instruction" from that event (`battleViewCopy.js:1111`; `cockpitModel.js:224-225`; the sheet receipt `:513-514`). Compare-and-clear (`directiveWriter.js:64-67`, `retireCallDirective`) is the retirement primitive, used by the heard pass and the sweep, not by a replacement. **So the only code between today and "a new command replaces the live one" is the refusal at `:241-246`**; the confirmation DP-4 asks for is an input to that branch (the belief already carries the slot's thread), plus the one-line tile copy.

**The chat composer seam.** The composer is `AgentChat` (`src/components/Agent/AgentChat.jsx:576`; mounted `AgentBattleScreen.jsx:2917` and `:3665`). It receives `currentDirectiveThreadId` (`:650`, from `AgentBattleScreen.jsx:2937`) and uses it only as the chip's filing belief (`:669`, `:1089`); it "never reads battle.directive itself" (`:599`). The slots above the input, top to bottom: the error line (`:1594`), the budget row (`:1605-1631`), the input row (`:1633`). A "sending a directive replaces your cockpit command on AMD" line needs the slot's `family` and `action.symbol` (`directiveFiling.js:30-31`), which the screen holds (`AgentBattleScreen.jsx:2481-2489`) and does not pass; on the phone the chat sheet's peek height hard-codes the budget row (`useChatSheet.js:35-37`, `SHEET_PEEK_PX`), so a new line moves it.

### B3 · Retire on exit (DP-6): every route a held symbol leaves the book

**One writer.** The fenced executor is the only production code that removes a symbol from `portfolio.star/core/support`: `api/_utils/agentSwapExecution.js:493` ``[`portfolio.${resolvedTier}`]: newTier``, with the trade row appended `:489`/`:497`, in one transaction `:502` (fenced; read-only). The trade's `source`, `trigger`, `exitReason`, `evaluationId` come from the caller's metadata (`:403`), filtered by `executorMetadata.js:34-38`. Six call sites, all in `api/cron/agent-evaluate.js` (not fenced); the comment at `:745-746` still says "five".

| Route | Call site | Trade stamps | Fenced files involved | Calls hook after it | Executor result carried to the calls pipeline |
|---|---|---|---|---|---|
| 1 · the model's own swap (guardrail stop/trailing/target exits ride this path too, `:3608`) | `:3713` | `source` haiku or guardrail `:3608`; `trigger` = the trigger list `:3614`; `evaluationId` = `evalId` `:3617`; `exitReason` `:3627` | the executor | the model phase `:4605-4606` (`runModelCallsPhase`, `publish.js:326` model_result only) | **yes** — `:3726` `carryExecutorResult` (`observe.js:211-222`) → `flip.js:283` and the heard pass |
| 2 · the risk loop | `:2071` | `trigger`/`exitReason` = `riskResult.reason` (`:1998`, `:2014`): `bust_avoidance`, `vwap_failure`, `stepped_trail`, `stagnation` (`agentRiskManager.js:131,144,168,189`); `source` `'archetype'` for stagnation else `'risk_manager'` (`:1989`); `evaluationId` `risk_<reason>_<symbol>_<ts>` (`:2007`) | `agentRiskManager.js` (the verdict and the replacement pick) | none of its own; the tick's later exit runs its hook | **no** — only the incoming names are marked `replacedInPrompt` (`:2856`) |
| 3 · forced exits | no call of their own: `applyGuardrails` returns `action: 'forced_exit'` (`agentGuardrails.js:544`) and executes through route 1 or 4; `forced_exit_no_bench` (`:517`) never executes (ASSUMED) | — | `agentGuardrails.js` | — | — |
| 4 · the R11 suppression pass (a guardrail exit while a gameplan meeting is pending or being created) | `:5796` | guardrail source; `evaluationId` `<reason>_<symbol>_<ts>` (ASSUMED, `:5736-5748`) | the executor, `agentGuardrails.js` | `runExitCallsHook` at `:2464`/`:2546` — a non-model exit, so `flip.js:283` passes no result | **no** |
| 5 · gameplan meeting executor | `:6155` (per approved leg, `:6064`) | `gameplan_rotation`, source `gameplan_meeting` (ASSUMED, `:6159-6166`) | the executor | the tick's later exit hook | **no** |
| 6 · proposal execution | `:5063` (approved), `:5337` (expired copilot) | haiku source | the executor | — | **no**; dormant: `LAUNCH_EXECUTION_MODE = 'autopilot'` (`executionAuthority.js:25`) short-circuits at `:4966` |

Not routes: battle completion writes `status: 'completed'` and leaves the book (`:6767`); `agent-daily-scores.js:175`/`:194` rewrites the portfolio map without changing membership (ASSUMED); the canonical open sweep and user flips write group documents (`canonicalOpenSweep.js:141`, `api/tournament/flip.js:234`); no `delist`/`halt`/`forceExit` writer exists (NOT FOUND).

**Where a live call directive on the departed symbol could be retired, with a receipt.** The directive names its symbol as `action.symbol` (exit), `action.counterpart` (entry) or `action.swapOut` (pick) (`callActions.js:155-161`). The primitive needs a transaction and a fresh parent (`directiveWriter.js:64-67`). The points where both the fresh document and the trade are in hand: route 2 after the re-read at `:2264` (`riskSwapResult` in scope); route 4 after `:5937`; route 5 per leg at `:6292`; route 1 inside the heard transaction (`heard.js:117-140`, which today retires only the heard thread, under the `:103` rule) and the flip transaction (`flip.js:218-256`, which reads the fresh parent and the executor result and does not retire). A "retired" receipt is a new event kind: `events.js:31-33` lists eight (`declared, answered, heard, acted, no_matching_trade, expired, ended_with_battle, superseded`).

### B4 · Labels (DP-6)

- **Tag order.** `cockpitModel.js:199-250` `callTag` branches on the call's state first: `hit` reads `outcome.actedEvalId` and tags Acted (`:205-211`); `expired_unresolved` (`:213`), `ended_with_battle` (`:214`) and `invalidated` (`:215`) never consult it; an `open` call tags Acted first (`:218-222`), then the newest event fact — superseded, no matching trade, heard — by its instant (`:223-239`), then its own answer (`:240-244`), else Live (`:245`). `tileOf` picks the thread's acted member as the tag source (`:401-403`), but the terminal branch still wins — the week-1 AMZN case. "Acted wins" is those two terminal branches reading `actedEvalId` as `hit` does.
- **The sweep's terminal-vs-deadline ordering.** `sweep.js:196`: a non-active parent → `ended_with_battle` (`battle_ended`) before any deadline test; only an active parent reaches `decideSweepExpiry` (`:197-199`; past the deadline → `expired_unresolved`, `:127`). The one-label rule needs the deadline compared with the battle's end before the parent's status is read.
- **"Following your call".** At mint, `buildMintCandidate` takes the in-memory `battle` (`candidate.js:277`), so `battle.directive` is in scope at `composeCall` (`:214-254`) — today the battle is read only for provenance and expiry (`:143-165`, `:285`). At read, `buildCockpitFeed` holds the directive and the calls (`cockpitModel.js:454-461`), `liveCallSlotOf` names the live slot (`:279-286`), and the answered call is in `calls` by `directive.callId`, so the symbol / direction / side / 1 % comparison can run in `tileOf` (`:387`) from records alone; a mint-time field would freeze the fact at the check. Because `defaultAction` is in the C-6 key (`:119-124`), a call that follows a `call_go` (default act) never folds into the hold-default thread it answers — the six ZS restatements of week 1 were six Needs-you tiles.
- **"Filed · no check left today".** The two directive tags are `battleViewCopy.js:1101-1102` (`answer:directive`, `answer:directive_left_slot`), chosen at `cockpitModel.js:240-242` by whether the slot's live thread is the answer's. The server already decides "no later check can hear" (`sweep.js:155-159`, `noLaterCheckCanHear`, from a retained check whose prompt postdates the lifetime end); the client has the cadence (`nextDecisionAt`, `deriveTurnLine.js`, ASSUMED) and the session close is `horizon.js` `sessionCloseAfter` (imported by `sweep.js:60`; Node-clean — `cockpitModel.js:37` already imports `horizon.js`).
- **The deadline guard on the server's clock.** The tile offers answers while `deadline > nowMs` (`cockpitModel.js:404-407`) with the screen's `nowMs` = `cockpitNowMs` (`AgentBattleScreen.jsx:2520`, from `useCoarseNow`, `:984`: a 60-second tick, `useCoarseNow.js:15` `COARSE_NOW_INTERVAL_MS = 60 * 1000`, `:20-22`, refreshed on tab visibility); the endpoint refuses at `Date.now()` (`call-response.js:225-226`). No server instant reaches the client today: the cockpit-status response carries `{ on, allowlisted }` and nothing else (`api/agent/cockpit-status.js:90-93`), and the records carry only their own timestamps.
- **The mint's invalidated reason.** `candidate.js:217` `reason = invalidationReason(row, observation)` decides `state: 'invalidated'` (`:245`); the reason is written only to the record's `minted[]` (`:311`), never on the call; the tag table says why "Dropped" is bare (`battleViewCopy.js:1085-1090`). A field on the call joins `composeCall`'s literal (`:220-252`); it is not in `MUTABLE_CALL_FIELDS` (`:58`), so it enters the canonical form (`:97-110`) publication compares.

### B5 · The replacement step (DP-5): what mint holds for each bench row

- **The prompt** (fenced assembler, read-only): the BENCH CSV `Symbol,Sector,$Current,Daily%,ATR%,Status` (`agentEvalPromptAssembly.js:1495`), `Status` = `available` or `locked until <cooldownUntil>` (`:1505-1510`); the BENCH TECHNICAL CONTEXT block, one section per non-crypto bench name with a rankings or technical document (`:1535-1586`), ending in `Composite: technicalScore=…, technicalRank=…` (`renderBenchCompositeLine`) — **the only per-bench score in the prompt, and it is the platform's rankings score (`rankingsMap`, `indexIntelligence/stockRankings`), not a score the agent produced.** The flat6 (tournament) portfolio CSV drops the Tier column (`:1459-1466`), so a stored prompt does not say which tier a held name sits in.
- **The observation** (`observe.js:128-141`): `callsCtx.held` (`:130`), `universe` (`:131`), `locked` (`:133-134`, `benchCooldownLocked` `:103-110` — bench names whose `cooldownUntil` is after `promptBuiltAt`) and `observation.symbols[sym] = { px, fetchedAtMs }` for every held and bench name (`:135-140`). No score; availability only as the lock set.
- **The agent's own lists.** Anticipation candidates are the evaluation entry's `candidates` stamp (`tickStamps.js:366-367`, from the linted `anticipationCandidates`, `agent-evaluate.js:4309`); the watch list is the declarations record's `watching` (`candidate.js:298`, `:321` `watchingSource`).
- **Storing `replacementOptions[]` on the exit call.** `composeCall` (`candidate.js:214-254`) has `held`, `universe` and `locked` in scope (`:219`, `:309`) and the validated `block.watching` is in the enclosing function (`:298`); the anticipation candidates are not among `buildMintCandidate`'s inputs (`:277`) and would be handed in from the cron's calls hook; the bench score is in neither — it lives in the prompt builder's `rankingsMap`, not in the calls context. Options stored on the call become immutable fields in the canonical form (`:97-110`, `:348`).
- **C-3's entry mint rule vs `counterpart_not_held`.** Mint keeps an entry's counterpart iff it is held *anywhere* at the seam (`candidate.js:193-201`, `held.includes(cp)`; `held` = every held symbol, `agent-evaluate.js:2853`); filing refuses a `call_go`/`call_hold` on an entry when the counterpart is not held in the call's *slot tier* (`callActions.js:137-139`, `heldIn(battle, slot)` `:104-107`, `:123`). Aligning mint to the slot test nulls a counterpart held in another tier — then the `call_go` text loses "…for X" (`:92-93`) and the acted match's other leg is unconstrained (`flip.js:157`); aligning filing to any-tier accepts a counterpart the swap could not take (a swap moves one tier). Exits differ too: mint requires the counterpart in the universe, not held, not locked (`:198`); filing checks only that the exit's symbol is still held in its slot (`:133-135`). The count of entry calls whose kept counterpart sat in another tier cannot be read from the stored prompts of flat6 battles (no Tier column); it is not reported.

### B6 · `call_replace` (Amendment C-8)

- **The registry.** `callActions.js:37` `CALL_ACTIONS_TEXT_VERSION = 'callActions.v1'`, `:38` three kinds; answer → kind `:71-77`; the three templates `:80-101`; eligibility `:119-142` (an unknown kind is refused `unknown_kind`, `:120`; the pick branch `:125-131` is the model for "IN in the universe, not held, swap-out still held"); the plan `:149-179` with the slot's `action` (`:155-161`) and `textVersion` (`:176`). A v2 adds a kind, an answer word (`answers.js:26` `ANSWERS_1A`; the wire check `call-response.js:152-157`), a template, an eligibility branch and `action: { direction: 'exit', symbol: OUT, slot, pickSymbol: IN }`.
- **The canonical text's path into the agent's prompt.** `battle.directive` (the slot the writer sets) → `agentEvalPromptAssembly.js:1234-1242` (**fenced**): `resolveControls({ directive: isDirectiveActive(battle.directive, battle) ? battle.directive : null, … })` then `renderControlBlocks` → `controlPromptRenderer.js:213-216` (not fenced): `ACTIVE DIRECTIVE (from your Coach):\n"${directive.text}"`, rendered only under `ARCHETYPE_INTEGRITY_MODE` `'enforce'` (`:36`). Activeness for a call directive: `directiveUtils.js:90`, `:115-124` (mode on, instant ≤ `expiresAtMs`). The same resolution runs in `agent-evaluate.js:1748` (epoch telemetry) and `:4280` (the heard stamp's prompt-inclusion fact). The chat agent's voice prompt does not carry it: `voiceLayerPrompt.js` surfaces `battle.directive` only when `isDirectiveActive` holds (`:3708`, `:3735`), and for a call-family directive that predicate needs the cron's in-memory check context and fails closed for every other reader (`directiveUtils.js:84-90`); the chat's calls block renders the calls and the answer words, not the directive text (`callsBlock.js`, `chat.js:615`). The text itself is minted in `callActions.js` (not fenced); contract V1.4 §2 makes any model-visible text a fenced-class review regardless of file.
- **The acted match.** `flip.js:146-162` `matchesWholeTrade`: an exit matches `symbolOut === symbol && (counterpart == null || symbolIn === counterpart)` (`:160`). A `call_replace` needs IN from the *directive*, the way a pick's selection reaches the matcher: `heard.js:87` `selectedPickOf(parent, thread)` → `threads.js:34-37` (`action.pickSymbol`), passed as `selectedSymbol` (`heard.js:94`) and read only on the pick branch (`flip.js:153-154`); the flip's own stamp does the same (`:223`, `selectedPickFor`).
- **The heard pass's retirement.** `heard.js:103` `retire = (acted && (kind === 'pick' || defaultAction === 'hold')) || (noMatch && kind === 'pick' && legTraded)`: an acted `call_go` on a hold-default exit is retired; a directive on a Confirmation (default act) is outside the rule (today only `call_hold` stands there, and it stays). "No matching trade" (`:99-100`) is silent for a shot whose leg traded without the whole match and loud for a pick — a replace whose OUT left for another IN sits between the two rules.

### B7 · The screener as a cockpit sheet

- **Components and props.** `SearchDiscover` (`src/components/Search/SearchDiscover.jsx:27` `({ user, isMobile, isDesktop, setScreen, stocksData })`) hosts the Screen tab, which lazily mounts `ScreenerView` (`:13`, `:191-195`). `ScreenerView.jsx:58` `({ onOpenResearch, isMobile })`. Rows: `RankRow.jsx:29` `({ stock, rank, type, maxScore, onTap })`, `ReturnRow.jsx:58` `({ stock, rank, value, maxAbs, onTap, tokens })`, `IndustryRow` (not tappable; ASSUMED). The whole row is the tap target (`RankRow.jsx:40`, `ReturnRow.jsx:74` `onClick={() => onTap?.(stock)}`); the tap builds a research asset (`ScreenerView.jsx:239-243`) and opens `AssetResearchModal` — the same modal the battle screen opens on a symbol tap (`AgentBattleScreen.jsx:1750-1756` `handleSymbolClick`, mounted `:3849-3850`).
- **Data.** One endpoint: `POST /api/screener/chat` with `{ userMessage, sessionId }` (`ScreenerView.jsx:106-108`), results kept at `:201` and listed at `:580`. The server runs a model-written screen spec over `indexIntelligence/stockRankings` (`api/screener/chat.js:324`, `:332`) in `screenStocks.js:479` (`universe.filter`), sorted and cut at `:497-499` (`DEFAULT_LIMIT 10`, `MAX_LIMIT 25`, `:68-69`). The client never filters.
- **Mount points.** The Search screen only (`App.jsx:9777`); both navs hide on gameplay screens (`:10141`, `:12418`), so the screener is unreachable from a battle today; `AgentBattleScreen.jsx` and `battleView/` import none of it (ASSUMED, subagent grep).
- **Scoping to the battle's available bench.** No prop, state or body field restricts the symbol set (`ScreenerView.jsx:58`, `:108`; the endpoint reads `userMessage, sessionId, previousSpec`, `chat.js:137`, ASSUMED for the full list). The spec grammar can express it — `symbol` is a scalar field (`screenStocks.js:29-30`), `in` an operator (`:58`, `:126`, up to 100 values `:74`) — but only if the model writes it. The battle's bench is already a function: `battleUniverse.js:65` `selectBenchRoster`, `:92` `selectBattleUniverse`; the research route refuses symbols outside it (`research.js:273-275`). A scope filter attaches at `screen.results` (`ScreenerView.jsx:201`) on the client or at `universe.filter` (`screenStocks.js:479`) on the server.
- **"Pick as replacement".** Rows are single flex lines with no action slot (the last child is the score or return label; `RankRow.jsx:111-121`, ASSUMED); a nested button sits inside the row's `onClick`. The only button today is list-level, "Save as watchlist" (`ScreenerView.jsx:550-576`, ASSUMED).
- **Show It's gate.** `SHOW_IT_ENABLED = false` (`featureFlags.js:2420`); `isShowItOn()` = controller on && the flag (`:2435-2436`); the screen reads it (`AgentBattleScreen.jsx:975`) and passes `handleShowIt` (`:2007`, POST `/api/agent/research` `:2020`) to the three doors — the Why panel, the bench chip (`PaneBench.jsx:88`, `:121`) and the chat chip (ASSUMED) — only while on; the route 404s while the flag is false (`research.js:226`), then checks owner / active / agent (`:266-268`), the universe (`:273-275`) and the cap of 3 (`researchCap.js:36`; `research.js:280-281`, re-read in the transaction `:350`). "Show It where it exists today" exists as dark code.
- **Layout.** `ScreenerView` is width-agnostic apart from a placeholder (`isMobile`, `:58`; ASSUMED `:365-367`); it themes through `useTheme` tokens, not the Battle View's `--ft-*` (ASSUMED); no virtualization; `ScreenerView.jsx` 934 lines, `SearchDiscover.jsx` 229 (wc), rows and adapter ≈ 400 + 380 (ASSUMED).

### B8 · Board-row dots

- **Where rows render.** Desktop and phone render the same row component: `TacticalRow` (`src/components/BaggerBomb/TacticalRow.jsx:699`), created once in `boardRows` (`AgentBattleScreen.jsx:2788-2799`, `tier={tier.key}` `:2803`, `onSymbolClick` `:2806`) and placed three ways: the phone Board panel of the cockpit track (`:3466`), the desktop board scroller and the phone with the cockpit off (`:3485`), the flag-off Matchups tab (`:3643`). The phone track takes `board` and `cockpit` as elements (`BoardCockpit.jsx:136`, `:227-228`). The symbol cell is `AssetSide` (`TacticalRow.jsx:64`), the `div` at `:418` holding `{symbol}` (`:441`); the player side is the left `AssetSide` (`:792`), the CPU side the right (`:818`). No row receives `calls`, `cockpit` or `battle.directive`; no shipped code draws a mark on a row (the only dots are the cockpit tile's, `CockpitFeed.jsx:169`, `:186`).
- **How the calls could reach the rows without a second listener.** `useCalls` (`useCockpitRecords.js:103-104`; `READER_OFF` while off `:88`; `mintedMode === 'on'` only `:93`) is called in `AgentBattleScreen` at `:1180`, beside `useMonitoring` (`:1181`) and `useCallEvents` (`:1182`), gated by `cockpitOn` (`:1176` = `isCockpitUiOn()` `:1169` && the status endpoint `:1170`). The feed is built there too (`:2525-2526`) and reaches `CockpitFeed` by props (no context). `boardRows` is built in the same function body (`:2788`), after both, so the calls array, the feed (open tiles with `call.symbol`) and the live slot (`thisTurnDirective`, `:2481-2489`; `liveCallSlotOf`) are all in lexical scope where every `<TacticalRow>` is created: a per-row prop (open-call symbols; the live command's `action.symbol`) needs no new read. The rows' flag-off contract adds props only under a flag (`:2810`, `:2818`, `:2826`, ASSUMED), because the flag-off goldens photograph the row.
- **Earlier rulings.** D-53 ("rows carry no directive mark") and discovery Q5 ("a per-row mark contacts the fenced row shape") predate call-family directives, which do carry a symbol (`directiveFiling.js:31`) (ASSUMED, subagent-read documents).

### B9 · Cross-arc, map only: a per-situation "ask the agent about the score" button

- **The path today.** A canned question can only travel as plain chat text: the endpoint reads `agentId, battleId, message` and `mode` (`api/agent/chat.js:425-426`, `:432`), and every battle-mode turn calls the model (`:794` `callGemmaVoice`). There is no no-model or predefined-question route in chat (the chip route `file-directive.js` and `call-response.js` are the no-model siblings). The client already sends predefined text this way: ask chips (`AgentChat.jsx:1161-1163` → `sendMessage` → POST `:1012`, `:1018`).
- **The score in its prompt.** `buildBattleState` (`voiceLayerPrompt.js:1121`) renders `Score: You ${currentScore} — Opponent ${opponentScore} (LEADING / TRAILING / TIED by …)` (`:1142-1143`, `:1156`), pushed on every battle-mode prompt (`:3249`, `:3326`). So the chat agent does see the opponent's score; `activeScore`, `bankedScore`, rank and `dailyGrades` are not in the battle-mode prompt (ASSUMED, subagent read). (The Practice Field read's "the brain never sees the opponent score" concerned the decider's prompt.)
- **Its budget.** One chat message per use: `MODE_BUDGET.battle` is the same `chatBudgetUsed` / 10 (`chat.js:380-382`), gated `:523-542`, charged `:1121`.
- **Its cost per use.** One Gemma call (`gemmaClient.js:45-48`: OpenRouter, `google/gemma-4-26b-a4b-it`, `max_tokens` 800), two when the directive gate's repair fires (`directiveGate.js:51-52`); timeouts 19 s / 24 s (`chat.js:112-113`, `maxDuration` 30 `:73`); token usage is not captured (ASSUMED). The repo's only price is the Sep 20 cost audit's **illustrative** figure: list prices $0.042 in / $0.22 out per million (`docs/audits/2026-09-20_FANTASYTRADES_PERFORMANCE_LATENCY_COST_AUDIT.md:335`), a 4,000/300-token assumption (`:386`), ≈ $0.00025 per chat reply (`:405`); the prompt guide's design-time size is ~4,515 tokens (`VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md:684`). No measured per-call cost exists in the repo (NOT FOUND).

### B10 · Collisions: open branches and PRs touching B1–B8's files

Measured against the 44 files B1–B8 cite (the endpoint, chat, chip, directive writer/utils/filing, the calls pipeline, the control renderer, the evaluator, the two fenced assemblers and services, `firestore.rules`, the cockpit's five files and three hooks, `AgentBattleScreen.jsx`, the screener pair, the composer pair, `featureFlags.js`). `git fetch origin` first; open PRs read through the GitHub REST API.

| Branch or PR | Last commit | Overlap with the B set | Note |
|---|---|---|---|
| **PR #958** `codex/baggerbomb-stock-thresholds-dormant-v1` (45 files; local twin `claude/baggerbomb-thresholds-takeover-324d11`) | Oct 14 | `api/cron/agent-evaluate.js`, `src/screens/AgentBattleScreen.jsx`, `src/config/featureFlags.js`, and four fenced files (`agentBattleService.js`, `agentEvalPromptAssembly.js`, `agentRiskManager.js`, `agentSwapExecution.js`) | the one live collision: B3's call sites and B5/B6's assembler |
| `origin/codex/shadow-cpu-activation-closeout-20261012` (19 files) | Oct 12 | `featureFlags.js`, `AgentBattleScreen.jsx` | no PR open |
| `origin/codex/shadow-cpu-activation-prep-20261006` | Oct 6 | the same two | superseded by the closeout (ASSUMED) |
| `origin/flip/eodhd-quick-wins`, `origin/perf/eodhd-quick-wins` | Oct 7 | `agent-evaluate.js`, `featureFlags.js` | no PR open |
| `origin/claude/cockpit-build2a-smoke` | Oct 4 | `featureFlags.js`, `AgentBattleScreen.jsx` | the never-merged smoke branch |
| **The crypto-slot fix** | — | none | only the Phase 0 audit exists (`origin/claude/phase0-crypto-slot`, docs only, Oct 14; local `claude/crypto-slot-prompt-2786d6` holds the same audit); no fix branch |
| **Reflection fix part 2** | — | none | the local branch `claude/reflection-outage-fix-p2-c79d3e` sits at `main` with no commit |
| **P1c** | — | none | no branch under any `p1c` name |
| PRs #760, #761, #762 (mandate flags, Aug 14) | Aug 14 | `featureFlags.js` (+ tests) | stale |
| PRs #451, #427, #422 | Jun–Jul | none | a Markdown upload and two dependabot bumps |
| 12 older unmerged remote branches (Jan–Sep) | before Oct 1 | 1–4 files each (`b2-directive-transaction` 4, `battle-view-controller-phase-a-v5gog5` 4) | listed for completeness; none has an open PR |

---

## Part C — live counts (Oct 6–14, both accounts)

Every count is taken at a check's instant (its declarations record's mint, or the entry's final update) on the records as read; Oct 14 has no check. Threads follow Amendment C-6; a thread *needs you* when its newest call is not an upside call, nothing on it is answered, and its deadline is ahead. The script prints up to eight verbatim examples per section, the first eight by time.

### C1 · Now-card candidates

**In plain terms.** With DP-1's priority the founder's Now card would lead with an exit the agent will make and no usable replacement at 80 of 210 checks (38%), a hold-default called shot at 51 (24%), another Confirmation at 27 (13%), the status of a live command alone at 7 (3%), and nothing at 45 (21%). FT_QA: the no-replacement exit at 33 of 39 (85%). The lead (priority and thread) changed at 62 of the founder's 197 consecutive check pairs (31%); the priority alone at 39 (20%). Battles differ: `N6UPR…` and `3vzKW…` led with a no-replacement exit at 14 and 15 of their 17–18 checks; `CtzRn…` led with hold-default shots at 16 of 18 and changed thread 11 times. The eight examples all fall in one battle's restated CTVA thread, the first eight priority-1 checks by time.

At each check's instant (its declarations record's mint, or its final update) the open calls are folded into C-6 threads; a thread *needs you* when its newest call is not an upside call, no call in it is answered, and its deadline is ahead. DP-1's priority: 1 = a Confirmation (exit, default act) with `counterpart` null; 2 = any other Confirmation; 3 = a called shot the agent plans to hold on; 4 = a live command and nothing above; none otherwise. A *lead change* is a check whose lead (priority and thread, a thread named by its oldest call so a restatement is not a change) differs from the previous check of the same battle.

| Battle | Account | ET day | Checks | Lead = 1 (exit, no replacement) | 2 (Confirmation) | 3 (hold-default shot) | 4 (live command only) | none | Lead changes (thread) | Lead changes (priority only) |
|---|---|---|---|---|---|---|---|---|---|---|
| `CtzRn…` | founder | 2026-10-06 | 18 | 1 | 0 | 16 | 0 | 1 | 11 | 3 |
| `cXFPX…` | founder | 2026-10-06 | 17 | 3 | 0 | 7 | 3 | 4 | 4 | 3 |
| `zC5A8…` | founder | 2026-10-06 | 15 | 0 | 0 | 12 | 0 | 3 | 7 | 1 |
| `bzYya…` | founder | 2026-10-07 | 18 | 9 | 0 | 8 | 0 | 1 | 7 | 4 |
| `N6UPR…` | founder | 2026-10-07 | 17 | 14 | 0 | 0 | 0 | 3 | 3 | 1 |
| `Zz3Ne…` | founder | 2026-10-07 | 17 | 1 | 0 | 1 | 0 | 15 | 4 | 4 |
| `5gnep…` | founder | 2026-10-08 | 17 | 12 | 3 | 2 | 0 | 0 | 4 | 4 |
| `PMhbP…` | founder | 2026-10-08 | 17 | 2 | 13 | 0 | 0 | 2 | 5 | 4 |
| `3vzKW…` | founder | 2026-10-09 | 18 | 15 | 0 | 0 | 0 | 3 | 3 | 1 |
| `nBukr…` | founder | 2026-10-09 | 17 | 4 | 11 | 0 | 0 | 2 | 3 | 4 |
| `uKKR6…` | founder | 2026-10-09 | 16 | 10 | 0 | 0 | 1 | 5 | 2 | 2 |
| `rFoJH…` | founder | 2026-10-12 | 13 | 1 | 0 | 5 | 3 | 4 | 7 | 7 |
| `L7wzt…` | founder | 2026-10-13 | 10 | 8 | 0 | 0 | 0 | 2 | 2 | 1 |
| `iIt9g…` | FT_QA | 2026-10-06 | 15 | 11 | 0 | 0 | 0 | 4 | 2 | 1 |
| `bDveg…` | FT_QA | 2026-10-07 | 18 | 17 | 0 | 0 | 0 | 1 | 2 | 1 |
| `NoWNY…` | FT_QA | 2026-10-12 | 6 | 5 | 0 | 0 | 0 | 1 | 1 | 1 |

- founder: 210 checks — lead 1 ×80, 2 ×27, 3 ×51, 4 ×7, none ×45; lead changes 62 (priority-only 39) over 197 consecutive pairs. FT_QA: 39 checks — lead 1 ×33, 2 ×0, 3 ×0, 4 ×0, none ×6; lead changes 5 (priority-only 3) over 36 consecutive pairs.
- Examples (priority 1): founder `3vzKW…` eval_004 (12:17 ET): priority 1 — CTVA exit below 13.08 (confirmation, default act, this_session, counterpart null); founder `3vzKW…` eval_005 (12:32 ET): priority 1 — CTVA exit below 12.8 (confirmation, default act, this_session, counterpart null); founder `3vzKW…` eval_006 (12:47 ET): priority 1 — CTVA exit below 12.95 (confirmation, default act, this_session, counterpart null); founder `3vzKW…` eval_007 (13:03 ET): priority 1 — CTVA exit below 12.95 (confirmation, default act, this_session, counterpart null); founder `3vzKW…` eval_008 (13:17 ET): priority 1 — CTVA exit below 12.95 (confirmation, default act, this_session, counterpart null); founder `3vzKW…` eval_009 (13:32 ET): priority 1 — CTVA exit below 12.95 (confirmation, default act, this_session, counterpart null); founder `3vzKW…` eval_010 (13:47 ET): priority 1 — CTVA exit below 12.95 (confirmation, default act, this_session, counterpart null); founder `3vzKW…` eval_011 (14:03 ET): priority 1 — CTVA exit below 12.95 (confirmation, default act, this_session, counterpart null).

### C2 · Open calls at once

**In plain terms.** The strip holds every open thread but the Now card, so its chip count is the open-thread count below minus one when a card shows. The founder's battles averaged 0.7 to 5.1 open threads per check with maxima of 2 to 10 (`CtzRn…` 10, `bzYya…` 9); FT_QA's `bDveg…` averaged 7.1 with a maximum of 9 (13 calls before folding). Threads needing you averaged up to 5.1 (founder `zC5A8…`) and 6.3 (FT_QA `bDveg…`), maxima 9 and 8.

At each check's instant: the open calls after C-6 folding (threads), upside calls included — the strip holds every open call but the Now card. Per battle: mean and max over its checks.

| Battle | Account | ET day | Checks | Open threads: mean | max | Open calls (unfolded): mean | max | Threads needing you: mean | max |
|---|---|---|---|---|---|---|---|---|---|
| `3vzKW…` | founder | 2026-10-09 | 18 | 5.1 | 7 | 5.3 | 8 | 3.9 | 5 |
| `5gnep…` | founder | 2026-10-08 | 17 | 2.5 | 4 | 2.5 | 5 | 2.4 | 4 |
| `bDveg…` | FT_QA | 2026-10-07 | 18 | 7.1 | 9 | 9 | 13 | 6.3 | 8 |
| `bzYya…` | founder | 2026-10-07 | 18 | 4.1 | 9 | 4.1 | 9 | 4.1 | 9 |
| `CtzRn…` | founder | 2026-10-06 | 18 | 5.1 | 10 | 5.2 | 11 | 4.2 | 9 |
| `cXFPX…` | founder | 2026-10-06 | 17 | 2.5 | 6 | 2.6 | 7 | 1.5 | 5 |
| `iIt9g…` | FT_QA | 2026-10-06 | 15 | 2.6 | 5 | 3.9 | 9 | 2.6 | 5 |
| `L7wzt…` | founder | 2026-10-13 | 10 | 3.1 | 4 | 3.8 | 5 | 3.1 | 4 |
| `N6UPR…` | founder | 2026-10-07 | 17 | 1.1 | 2 | 1.8 | 3 | 0.9 | 2 |
| `nBukr…` | founder | 2026-10-09 | 17 | 4.9 | 8 | 5.7 | 9 | 4.8 | 8 |
| `NoWNY…` | FT_QA | 2026-10-12 | 6 | 1 | 2 | 1 | 2 | 1 | 2 |
| `PMhbP…` | founder | 2026-10-08 | 17 | 3.4 | 5 | 4.2 | 6 | 3.4 | 5 |
| `rFoJH…` | founder | 2026-10-12 | 13 | 3.3 | 6 | 3.7 | 7 | 1.1 | 3 |
| `uKKR6…` | founder | 2026-10-09 | 16 | 2.3 | 3 | 3.9 | 8 | 0.6 | 1 |
| `zC5A8…` | founder | 2026-10-06 | 15 | 5.1 | 8 | 5.9 | 11 | 5.1 | 8 |
| `Zz3Ne…` | founder | 2026-10-07 | 17 | 0.7 | 3 | 0.7 | 3 | 0.2 | 2 |

### C3 · The replacement step

**In plain terms.** 103 exit calls would show "Who comes in?": founder 90 across 13 battle-days (6.9 per battle-day; 35 Confirmations, 55 hold-default shots), FT_QA 13 (7 and 6). At the founder's 88 readable minting checks the bench showed at least two available names 87 times; the agent's anticipation candidates held ≥ 1 available name for 43 calls and ≥ 2 for 13; its watch list ≥ 1 for 34 and ≥ 2 for 33; either list ≥ 1 for 58 (66%) and ≥ 2 for 39 (44%). FT_QA: either ≥ 1 for 10 of 13 and ≥ 2 for 5. Week 2 ran higher: either ≥ 2 for 8 of the founder's 13 week-2 calls. The B5 line at the end: 12 entry calls kept a counterpart; for the 7 whose prompt carries a Tier column the counterpart sat in the call's own slot tier every time; the other 5 are flat6 prompts, which carry no tier.

The calls that would show "Who comes in?": Confirmations (exit, default act) and hold-default exit called shots whose `counterpart` is null. At the minting check: the names in the agent's anticipation candidates (`candidates[].symbol`) and in its declarations record's watch list that the same prompt's bench showed as `available`. A check with several such calls counts once per call.

| Account | ET day | Exit calls, no replacement | …Confirmations | …hold-default shots | Prompt bench readable | Bench ≥ 2 available | Candidates available ≥ 1 · ≥ 2 | Watch list available ≥ 1 · ≥ 2 | Either ≥ 1 · ≥ 2 | Available bench names (mean) |
|---|---|---|---|---|---|---|---|---|---|---|
| founder | 2026-10-06 | 27 | 3 | 24 | 27 of 27 | 27 | 6 · 1 | 8 · 7 | 11 · 7 | 15.9 |
| founder | 2026-10-07 | 16 | 10 | 6 | 16 of 16 | 16 | 11 · 0 | 9 · 9 | 13 · 9 | 20.4 |
| founder | 2026-10-08 | 8 | 5 | 3 | 6 of 8 | 6 | 2 · 0 | 1 · 1 | 3 · 1 | 15.8 |
| founder | 2026-10-09 | 26 | 11 | 15 | 26 of 26 | 25 | 11 · 5 | 10 · 10 | 18 · 14 | 17.7 |
| founder | 2026-10-12 | 8 | 3 | 5 | 8 of 8 | 8 | 8 · 2 | 3 · 3 | 8 · 3 | 24 |
| founder | 2026-10-13 | 5 | 3 | 2 | 5 of 5 | 5 | 5 · 5 | 3 · 3 | 5 · 5 | 24 |
| FT_QA | 2026-10-06 | 5 | 4 | 1 | 5 of 5 | 5 | 2 · 0 | 0 · 0 | 2 · 0 | 20.4 |
| FT_QA | 2026-10-07 | 7 | 2 | 5 | 7 of 7 | 7 | 7 · 0 | 5 · 4 | 7 · 4 | 19.1 |
| FT_QA | 2026-10-12 | 1 | 1 | 0 | 1 of 1 | 1 | 1 · 0 | 1 · 1 | 1 · 1 | 23 |

- Examples: founder `CtzRn…:eval_002:call:0` PANW exit above 415 (called_shot, default hold, this_session, counterpart null) — eyeing (candidates) none; watching MSFT, AMD, EMR; bench available 15; founder `CtzRn…:eval_002:call:1` BE exit above 304 (called_shot, default hold, this_session, counterpart null) — eyeing (candidates) none; watching MSFT, AMD, EMR; bench available 15; founder `CtzRn…:eval_002:call:2` ZS exit above 217 (called_shot, default hold, this_session, counterpart null) — eyeing (candidates) none; watching MSFT, AMD, EMR; bench available 15; founder `CtzRn…:eval_003:call:0` GEV exit below 1020.68 (called_shot, default hold, this_session, counterpart null) — eyeing (candidates) AVGO; watching AVGO; bench available 3; founder `zC5A8…:eval_004:call:1` LRCX exit below 325 (called_shot, default hold, this_session, counterpart null) — eyeing (candidates) CTVA, PWR; watching CTVA, PWR, AVGO, KLAC; bench available 18; founder `CtzRn…:eval_005:call:0` GEV exit below 1042.87 (called_shot, default hold, this_session, counterpart null) — eyeing (candidates) none; watching AMD, CTVA, PWR, CEG; bench available 18; founder `CtzRn…:eval_005:call:1` AMAT exit below 524.21 (confirmation, default act, next_check, counterpart null) — eyeing (candidates) none; watching AMD, CTVA, PWR, CEG; bench available 18; founder `zC5A8…:eval_005:call:0` BE exit above 300 (called_shot, default hold, this_session, counterpart null) — eyeing (candidates) none; watching none; bench available 17.
- B5 (C-3's entry mint rule vs the filing check counterpart_not_held): entry calls with a kept counterpart 12; counterpart in the call's slot tier 7, in another tier 0, tier unreadable from the stored prompt (no Tier column) 5.

### C4 · Two commands wanted

**In plain terms.** No override was filed while another call's directive was live (no `directive_pending` refusal is stored) and no filing replaced a live command, so the one-at-a-time limit never bit. The want shows another way: two or more overrideable calls on different symbols were open at 129 of the founder's 210 checks (61%; at least one at 161) and at 28 of FT_QA's 39 (72%).

(a) Overrides filed while another call's directive was live: the endpoint stores the refusal on the call (`refused.reason = directive_pending`); a chat or chip filing that replaced a live call directive carries a `supersedes` stamp. (b) At each check's instant: the threads needing you whose newest call takes an override (every non-upside open call does), by distinct symbol — checks where two or more symbols were open at once.

- (a) Refusals stored (`directive_pending`): 0 — none. Filings that replaced a live call directive (`supersedes`), by source: none.
| Account | ET day | Checks | Checks with ≥ 1 overrideable symbol | Checks with ≥ 2 overrideable symbols |
|---|---|---|---|---|
| founder | 2026-10-06 | 50 | 40 | 39 |
| founder | 2026-10-07 | 52 | 33 | 20 |
| founder | 2026-10-08 | 34 | 32 | 29 |
| founder | 2026-10-09 | 51 | 40 | 29 |
| founder | 2026-10-12 | 13 | 8 | 4 |
| founder | 2026-10-13 | 10 | 8 | 8 |
| FT_QA | 2026-10-06 | 15 | 11 | 11 |
| FT_QA | 2026-10-07 | 18 | 17 | 17 |
| FT_QA | 2026-10-12 | 6 | 5 | 0 |

- (b) Examples: founder `CtzRn…` eval_002 (09:46 ET): ZS, BE, PANW; founder `CtzRn…` eval_003 (12:02 ET): GEV, ZS, BE; founder `CtzRn…` eval_004 (12:17 ET): GEV, ZS, BE; founder `zC5A8…` eval_004 (12:17 ET): LRCX, AMD; founder `CtzRn…` eval_005 (12:32 ET): AMAT, GEV, ZS, BE; founder `zC5A8…` eval_005 (12:46 ET): BE, LRCX, AMD; founder `CtzRn…` eval_006 (12:47 ET): GEV, ZS, BE; founder `CtzRn…` eval_007 (13:02 ET): GEV, ZS, BE.

### C5 · Stale commands

**In plain terms.** Three commands were filed in the window, all the founder's and all `call_go`: VLO (Oct 6), ZS (Oct 9), META (Oct 12). One went stale: the risk loop sold VLO for CEG (stagnation, 13:17 ET) 40 minutes after the filing and 11 later prompts still carried the command. The ZS and META commands kept their stock to the close (11 and 7 prompts).

Every call-family directive filed in the window, from any route. Live = from its filing until the earliest of its lifetime end, the next directive filing of any kind, or (for a go / pick) its `acted` event. A trade whose `symbolOut` is the command's symbol inside that interval, from any source, makes the command stale; the prompts carrying it after are the later checks whose `heard` stamp names its thread.

| Account | Battle | Kind | Text | Filed | Live until | Prompts that carried it | Trades taking its symbol out while live | Prompts carrying it after the trade |
|---|---|---|---|---|---|---|---|---|
| founder | `cXFPX…` | call_go | If VLO below $417.19 by today's close, go ahead and exit for MPC. | 2026-10-06 12:37 ET | 2026-10-06 16:00 ET | 13 | VLO→CEG 13:17 ET (archetype · stagnation) | 11 |
| founder | `rFoJH…` | call_go | If META above $750.00 by today's close, go ahead and bring it in for GME. | 2026-10-12 14:15 ET | 2026-10-12 16:00 ET | 7 | none | 0 |
| founder | `uKKR6…` | call_go | If ZS below $228.00 by today's close, go ahead and exit. | 2026-10-09 13:06 ET | 2026-10-09 16:00 ET | 11 | none | 0 |

- Commands in the window: 3; stale: 1.

### C6 · Following your call

**In plain terms.** Nine calls were minted under a live command on their own symbol, direction and side: the six ZS restatements of Oct 9 and three META restatements of Oct 12. Every one carried the default the command asked for (act) and a level within 1% of the answered call's, so under DP-6 all nine would read "Following your call" and take no answer; today each was a Needs-you tile, because the default is part of the C-6 key (B4).

Calls minted while a live command (C5's interval) on the same symbol and direction existed, whose `condition.side` is the answered call's; split by whether the new call's default matched the command (a `call_go` asks for act, a `call_hold` for hold), and by whether its level is within 1% of the answered call's.

- Calls minted under a live command on their symbol, direction and side: `founder · default matches · level within 1%` ×9.
- Examples: founder `uKKR6…:eval_007:call:0` ZS exit below 228 (confirmation, default act, this_session, counterpart null) minted 13:31 ET under "If ZS below $228.00 by today's close, go ahead and exit." → matches; now `expired_unresolved`; founder `uKKR6…:eval_008:call:0` ZS exit below 228 (confirmation, default act, this_session, counterpart null) minted 13:46 ET under "If ZS below $228.00 by today's close, go ahead and exit." → matches; now `expired_unresolved`; founder `uKKR6…:eval_010:call:0` ZS exit below 228 (confirmation, default act, this_session, counterpart null) minted 14:16 ET under "If ZS below $228.00 by today's close, go ahead and exit." → matches; now `expired_unresolved`; founder `uKKR6…:eval_011:call:0` ZS exit below 228 (confirmation, default act, this_session, counterpart null) minted 14:31 ET under "If ZS below $228.00 by today's close, go ahead and exit." → matches; now `expired_unresolved`; founder `uKKR6…:eval_014:call:0` ZS exit below 228 (confirmation, default act, this_session, counterpart null) minted 15:16 ET under "If ZS below $228.00 by today's close, go ahead and exit." → matches; now `expired_unresolved`; founder `uKKR6…:eval_015:call:0` ZS exit below 228 (confirmation, default act, this_session, counterpart null) minted 15:31 ET under "If ZS below $228.00 by today's close, go ahead and exit." → matches; now `expired_unresolved`; founder `rFoJH…:eval_008:call:0` META entry above 750 (called_shot, default act, this_session, counterpart GME) minted 14:31 ET under "If META above $750.00 by today's close, go ahead and bring it in for G…" → matches; now `expired_unresolved`; founder `rFoJH…:eval_010:call:0` META entry above 750 (called_shot, default act, this_session, counterpart GME) minted 15:01 ET under "If META above $750.00 by today's close, go ahead and bring it in for G…" → matches; now `expired_unresolved`.

### C7 · Week 2 beside week 1

**In plain terms.** Week 2 is two founder battle-days (Oct 12, 13) and one FT_QA battle-day (Oct 12), 29 checks in all, so its rates are coarse. Founder: timeouts 7 of 23 (30.4%; week 1 14.1%), no malformed answer, 7 declaring checks and 8.5 calls per battle-day (9.4 and 10 in week 1), 3 answers (the META override and two agreements), no acted call, nothing broken: every declaring check wrote its record, no Amendment C field is missing, every terminal call has its receipt, writer and event. FT_QA: 6 checks, 2 calls, no answer. One change of pace: every week-2 past-deadline call was closed by the sweep 0.6 minutes after its deadline (14 of 14), where week 1 ranged 0.6–31.1 minutes.

| Account · archetype | Week | Battle-days | Checks | Model calls | API-refused | Timeouts | invalid_tool_result | Declaring checks / battle-day | Calls / battle-day | Calls by kind · direction · default | Answered | Call events by kind | Call states at read | Acted (`actedEvalId`) | Anything broken |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | week 1 | 2 | 33 | 33 | 0 | 13 / 33 (39.4%) | 0 | 6.50 | 12.50 | `called_shot:entry·act` ×4, `called_shot:entry·hold` ×8, `called_shot:exit·hold` ×6, `confirmation:exit·act` ×7 | 0 (0 overrides, 0 agreements) | `declared` ×11, `expired` ×23 | `expired_unresolved` ×23, `hit` ×2 | 0 | publication gaps 0; Amendment C fields missing none; integrity 0; sweep lag past_deadline (min) 12.22 · 0.60 · 0.6–31.1 (n=21) |
| FT_QA · diversifier | week 2 | 1 | 6 | 6 | 0 | 2 / 6 (33.3%) | 0 | 3 | 2 | `confirmation:exit·act` ×2 | 0 (0 overrides, 0 agreements) | `declared` ×2, `expired` ×2 | `expired_unresolved` ×2 | 0 | publication gaps 0; Amendment C fields missing none; integrity 0; sweep lag past_deadline (min) 0.60 · 0.60 · 0.6–0.6 (n=2) |
| founder · momentum_chaser | week 1 | 11 | 187 | 177 | 10 | 25 / 177 (14.1%) | 1 | 9.36 | 10 | `called_shot:entry·act` ×6, `called_shot:entry·hold` ×16, `called_shot:exit·hold` ×51, `confirmation:exit·act` ×37 | 4 (2 overrides, 2 agreements) | `answered` ×4, `declared` ×64, `ended_with_battle` ×44, `expired` ×42, `heard` ×2 | `ended_with_battle` ×44, `expired_unresolved` ×42, `hit` ×21, `invalidated` ×3 | 1 | publication gaps 0; Amendment C fields missing none; integrity 0; sweep lag past_deadline (min) 19.66 · 31.10 · 0.6–31.1 (n=24) |
| founder · momentum_chaser | week 2 | 2 | 23 | 23 | 0 | 7 / 23 (30.4%) | 0 | 7 | 8.50 | `called_shot:entry·act` ×3, `called_shot:entry·hold` ×1, `called_shot:exit·hold` ×7, `confirmation:exit·act` ×6 | 3 (1 overrides, 2 agreements) | `answered` ×3, `declared` ×8, `expired` ×15, `heard` ×1 | `expired_unresolved` ×15, `hit` ×2 | 0 | publication gaps 0; Amendment C fields missing none; integrity 0; sweep lag past_deadline (min) 0.60 · 0.60 · 0.6–0.6 (n=12) |

---

## Questions for the founder

1. **The Oct 14 battle with no check.** The founder's battle created at 11:38 ET on Oct 14 (`baggerbomb_agent`, expires 20:00 ET) had no evaluation entry at 12:36 ET, after four cron slots; `cronState.lastEvaluatedAt` is null. Was it meant to start checking today? The read instant also leaves Oct 14 out of every table; a re-read after the close would fill it.
2. **Reading DP-7's numbers.** Timeouts track answer length; long answers are more common at `on`; yet declaring and non-declaring completed checks differ by about a second, and the Diversifier writes long answers with or without a declaration. Which reading governs the replay: the text (fewer, shorter declarations), the timeout, or both?
3. **The command counter and the fence.** A `commandsUsed` key on the battle document is a new key on the fenced `createAgentBattle` shape, as a concept; the League counter went into its own collection for that reason. Is a key the endpoint alone writes acceptable, or does the counter live elsewhere?
4. **"Eyeing" for the replacement step.** With two names as the bar, the three readings give 13, 33 and 39 of the founder's 88 calls (candidates, watch list, either). Which list does "Shadow is eyeing" draw from?
5. **The retire-on-exit receipt.** It needs a new call-event kind; the eight kinds today do not include one. Amendment D, or a reuse of `superseded`?
6. **The screener's scope.** The screener has no symbol filter the client can set; the only way to scope it to the bench today is a filter the model happens to write. Server-side scope (the bench list sent with the request) or client-side filtering of the model's results?
7. **The sweep's pace.** Week-2 past-deadline receipts arrived 0.6 minutes after the deadline; week 1's took up to 31 minutes. Did the reflections cron's timing change with the fix merged Oct 11 (#953)?
8. **FT_QA's week 2.** The QA account played Oct 12 only (6 checks from 14:18 ET), answered none of its 2 calls, and its week-1 battles still carry the 38.5% timeout share. Is that the plan for the QA account?

---

## Reproduction

```
COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA> node scripts/build2b-discovery.mjs --raw reads-raw/build2b --out <tables.md>
node scripts/build2b-discovery.mjs --from-raw reads-raw/build2b/build2b-raw.json --out <tables.md>   # the same bytes, except the read instant
```
