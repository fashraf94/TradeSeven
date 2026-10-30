# Fix — the WSL clock that jumps, plus the two worst test rows

**Date:** Oct 29, 2026 (evening CDT; Oct 30 UTC) · **Branch:** `claude/fix-wsl-clock-step-rows` · **Base:** `main` @ `b1823fdd` (PR #1010 merged as `7d6c3a2f`)

**In plain terms:** the Linux test machine's clock was being pulled by two time-keepers at once — one following the Windows clock, one following internet time — and whenever Windows' clock drifted about a second off internet time, they fought, and the loser jumped the clock forward 1–2 seconds every ~34 seconds. The internet-time one (Ubuntu's own) is now switched off, the Windows-following one keeps the clock smooth, and a 10-minute measurement after the change saw no jump at all; the two most exposed test rows were also made immune, and no product code changed.

| Question | Answer |
|---|---|
| Is the clock fixed? | **Yes, in the Ubuntu distro, no restart needed.** One reversible command: `timedatectl set-ntp false`. Undo: `timedatectl set-ntp true`. |
| What stepped the clock? | **Ubuntu's `systemd-timesyncd`**, fighting **WSL's own `chronyd`** (which runs in the WSL VM, outside the distro). chronyd follows the **Windows host clock**; timesyncd follows **internet NTP**. When the two references disagree by ≥ 0.4 s, timesyncd steps the clock to internet time at every 32 s poll and chronyd slews it back. Reproduced on demand (§1.4). |
| Not the cause | Hyper-V TimeSync (`hv_utils`): it steps only when the guest is ≥ 5 s behind (kernel source). A slow guest oscillator: chronyd corrects a −4 % frequency fault in ~2 s (§1.5). PR #1010's "guest clock runs 3–5 % slow" was chronyd's slew-back between steps — reproduced (−2.7 to −6.8 %). |
| Why it stopped on its own tonight | The Windows clock was re-synced (Windows Time event 35, Oct 29 19:11 CDT); the steps were last seen 18:53 CDT and are absent from 21:32 CDT on. Windows' offset on Oct 29 itself was not measured (**ASSUMED**, §1.3). |
| Before / after | **Before**, live: 0 steps in 5 min (host ≈ internet time today). **Before**, reproduced: **7 steps of +1.7 to +2.3 s every 32.2 s**. **After**, same fault + nine −4 % frequency knocks: **0 steps in 10 min**. **After**, plain 10 min on a fresh distro start: **0 steps in 10 min**. Pass bar (no step over 50 ms): **met**. |
| Machine changes | One persistent change (above), logged with its undo (§2). Every experiment's temporary change was reverted and checked. `.wslconfig` and Windows untouched, no WSL restart. Nothing pending. |
| The two rows | `chat.test.js` waitUntil row: now on #1010's `deadlineClock`, asserts **0 virtual ms**. `film-tape-backfill.e2e.test.js` candle row: its own **20 s** budget (the row already fakes Date; vitest's own timeout reads the real wall clock). Test files only. |
| Row checks | 20 runs under #1010's step harness: **0 red** for both rows, with #1010's byte-identical module and with a corrected copy. Under the same harness plus CPU load, `main` was red 10 of 10, the fix 0 of 10. Mutation: **6 of 6** production mutants killed by the rows they name. A +1.3 s wall-clock step forced inside the turn reddens `main`'s chat row, not the new one. `main`'s chat row also missed a 500 ms wait the new one catches. |
| Full suite (Linux, `TZ=UTC`, 8 workers, lock) | **27,452 rows, 27,363 pass, 0 fail, 89 skipped** (1,251 files, 227 s), on the fix commit `93d91219`; a clock monitor beside it saw 0 steps in 8 min |
| `lint:gate` | **exit 0** on `93d91219` (`vite build` exit 0 too); the pushed head adds only this report, and its own runs are in the PR description |

---

## Preamble

- `git fetch origin` first: `origin/main` = `b1823fdd`, which already contains PR #1010 (merge `7d6c3a2f`, `gh pr view 1010`: MERGED 2026-10-29T18:39Z), so `api/_utils/__fixtures__/deadlineClock.js` is on `main`. Tree clean at start. **VERIFIED.**
- The desktop app cut the local branch as `claude/wsl-clock-jumps-test-flakes-84504f` at `main`; it is pushed by refspec to the prompt's name, `claude/fix-wsl-clock-step-rows`.
- Machine: Dell XPS 17, i9-13900H, Windows 11 Home 26200, WSL 2.3.26.0, kernel 5.15.167.4-microsoft-standard-WSL2, Ubuntu 24.04.1 (systemd 255). WSL checks before any change: `flock -n /tmp/pd-suite.lock true` succeeded, no `node`/`vitest` processes, `wsl -l -v` showed Ubuntu (and docker-desktop, Stopped). **VERIFIED.**
- Root inside the distro: `sudo` there needs a password, so root commands ran as `wsl -d Ubuntu -u root -- …` (the WSL owner's route), every one from a script file in the session scratchpad.
- Linux test runs: a private git worktree `/home/flashash/pd-ci-clock` of `~/pd-ci` (the shared clone's HEAD untouched) with its own `npm ci` (main's lockfile `40382e64…` ≠ pd-ci's `22fa2b71…`), Node 20.20.2 / npm 10.8.2.
- No production file, no fenced file, no flag. Fenced functions called: none.

## 1. Cause and evidence (Part A)

### 1.1 Who sets this clock

All WSL distros share one kernel clock. Four things can set it:

| Setter | Where | Reference | How it corrects | Evidence |
|---|---|---|---|---|
| **`chronyd`** | the WSL VM itself, outside every distro (not in Ubuntu's or the WSLg system distro's process list) | **PHC0** = `/dev/ptp_hyperv`, the Windows host clock; updates every 8 s | frequency + slew; never stepped in any run here | kernel syscall trace (`clock_adjtime` from `chronyd`, global pid 246, every 8 s); `chronyc tracking` via the system distro: `Reference ID 50484330 (PHC0)`, `Stratum 1`, `Update interval 8.0 seconds` |
| **`systemd-timesyncd`** | Ubuntu, enabled for WSL by Ubuntu's own drop-in `/usr/lib/systemd/system/systemd-timesyncd.service.d/wsl.conf` | `ntp.ubuntu.com` | **steps** (`ADJ_SETOFFSET`) whenever an offset is ≥ 0.4 s; poll stays at its 32 s minimum while offsets exceed 0.2 s | `systemctl status`, `timedatectl show-timesync` (`PollIntervalMinUSec=32s`) |
| `hv_utils` (Hyper-V TimeSync) | kernel | host time samples | `do_settimeofday64` on a host SYNC (VM start / resume); with `timesync_implicit=1` (set here) also when the guest is **≥ 5 s behind** | WSL kernel `drivers/hv/hv_util.c` @ `linux-msft-wsl-5.15.167.4`: `adj_guesttime` → `hv_implicit_sync` (`threshold_ts.tv_sec += 5`) |
| Windows Time (`w32time`) | the host | `time.windows.com` | sets the **host** clock, which chronyd then follows | Manual, trigger-start; `SpecialPollInterval` 32768 |

No `chrony`, `ntp` or `openntpd` exists in Ubuntu. Two of these discipline the clock continuously, to **different references**: chronyd to the Windows clock, timesyncd to internet time.

### 1.2 The history in the journal

The WSL journal on disk starts Oct 29 17:12 UTC. Every "Clock change detected" line (systemd-resolved logs one per clock step), counted per WSL boot:

| Boots (UTC) | Clock changes |
|---|---|
| 16 boots, Oct 29 17:12 → 23:53 (one of them 17:36–22:27, 514 lines) | **every boot**, 638 in all; 561 of 637 gaps between consecutive lines are 30–36 s (typically 34.0–34.8 s) |
| 6 boots, Oct 30 02:32 → 03:41 (incl. 7.7 and 9.7 min ones) | **none** |

On the host (Windows System log, read only): hibernate resumes on Oct 29 at 10:05 and 17:29 CDT each set the Windows clock from the 1-second real-time clock (Kernel-General 1: "changed to …T22:29:48.**500000000**Z"). Windows Time logged "now synchronizing" (event 35) only at Oct 28 18:09 and **Oct 29 19:11 CDT**. A Modern Standby ran 20:52–21:17 CDT. Steps were last logged 18:53 CDT and are absent from 21:32 CDT on.

### 1.3 Before: the live clock, measured

A monitor samples `CLOCK_REALTIME`, `CLOCK_MONOTONIC`, `CLOCK_MONOTONIC_RAW` and the host clock (PTP) every 100 ms and logs any jump of REALTIME − MONOTONIC over 5 ms (a slew moves both clocks; only a step moves the difference). It also records each timesyncd NTP exchange (offset, delay) once a second.

| Run (UTC) | Setup | Steps > 5 ms | Guest vs host clock | NTP offsets |
|---|---|---|---|---|
| A, 03:41–03:46, 5 min | as found (timesyncd + chronyd) | **0** | +2 ppm; REALTIME − host −0.9 → −0.3 ms | +17.3, +19.1, +17.1 ms |

So tonight the Windows clock and internet time agree to ~17 ms, below timesyncd's 0.4 s step line, and nothing steps. What the Windows clock's offset was on Oct 29 was not measured: that it was ≥ ~0.4 s behind internet time is **ASSUMED**, from the forward direction of the steps, the RTC-set resumes and the infrequent Windows syncs above.

### 1.4 The steps, reproduced on demand

To test the two-references explanation, B3 made timesyncd's reference disagree with the host clock by a fixed +1.3 s: a local NTP server answering with the **host** clock (PTP) + 1,300 ms, and a runtime drop-in in `/run` pointing timesyncd at it. chronyd was left alone. 5 minutes, 04:06–04:11 UTC:

| Step | Size | At (UTC, before the step) | After the previous | timesyncd's NTP offset just before |
|---|---|---|---|---|
| 1 | **+2,120.3 ms** | 04:07:17.70 | — | +2,120.3 ms |
| 2 | +2,341.9 ms | 04:07:52.12 | 32.3 s | +2,341.9 ms |
| 3 | +1,885.6 ms | 04:08:26.66 | 32.2 s | +1,885.6 ms |
| 4 | +1,864.9 ms | 04:09:00.85 | 32.3 s | +1,864.9 ms |
| 5 | +1,769.5 ms | 04:09:34.92 | 32.2 s | +1,769.5 ms |
| 6 | +1,722.8 ms | 04:10:08.98 | 32.3 s | +1,722.8 ms |
| 7 | +1,806.1 ms | 04:10:42.91 | 32.2 s | +1,806.1 ms |

- Each step equals the offset timesyncd had just measured, to the 0.1 ms: **timesyncd made every step.**
- Between steps the guest clock ran **2.7 to 6.8 % slow** against the host (−26,889 to −67,740 ppm per segment) while REALTIME − host fell from +1,300 ms to between −420 and −1,042 ms: **chronyd slewing the clock back** to the host, overshooting a little, so the next offset is a little over 1.3 s. chronyd's own reading, sampled every 4 s, showed the same: "1.339 s fast of NTP time" just after the first step, "0.961 s fast" 4 s later.
- The journal logged "Clock change detected" at 34.0–34.6 s intervals (the poll plus the step itself) — **the Oct 29 signature**. PR #1010's monitor saw +0.8 to +1.75 s every ~33.5 s, which by the same overshoot suggests a host offset of roughly 0.5–1.3 s (**ASSUMED**).

Reverted on exit and checked: drop-in removed, timesyncd restarted on `ntp.ubuntu.com`, server stopped.

### 1.5 What it is not

- **A slow guest oscillator.** B1 set the kernel's `tick` to 9600 (a −4 % clock) with timesyncd running: no step in 5 min and the clock stayed at +0 ppm against the host, because chronyd rewrote `tick` within ~2 s (the trace: 9600 at 04:02:05.59, 9997 at 04:02:07.64). Any frequency error is corrected in seconds here.
- **Hyper-V TimeSync.** B2 did the same with timesyncd **stopped**: no step in 200 s, +10 ppm against the host. `hv_utils` never fired: chronyd keeps the guest far inside its 5 s line.
- So PR #1010's two assumptions are corrected: the stepper is timesyncd (not Hyper-V TimeSync), and the 3–5 % "slow guest" was chronyd dragging the clock back after each step.

**Cause, in one line:** two clock disciplines with different references — WSL's chronyd (the Windows clock) and Ubuntu's timesyncd (internet time) — so any Windows-vs-internet offset over ~0.4 s becomes a forward step every ~34 s. **VERIFIED** by reproduction; the size of Oct 29's Windows offset is **ASSUMED**.

## 2. Machine changes

### 2.1 Made (persistent)

| When (UTC) | Command | What it changed | Undo |
|---|---|---|---|
| Oct 30 04:12:04 (Oct 29 23:12 CDT) | `wsl -d Ubuntu -u root -- timedatectl set-ntp false` | stopped `systemd-timesyncd`; removed two symlinks, both → `/usr/lib/systemd/system/systemd-timesyncd.service`: `/etc/systemd/system/sysinit.target.wants/systemd-timesyncd.service` and `/etc/systemd/system/dbus-org.freedesktop.timesync1.service` | `wsl -d Ubuntu -u root -- timedatectl set-ntp true` (re-creates both and starts it) |

- Why this one: timesyncd is the redundant discipline. WSL's chronyd already keeps the clock on the Windows clock, by slewing; the drop-in that enables timesyncd under WSL says it exists "so WSL clock is synced on resume from suspend of the host", which the VM's chronyd and `hv_utils` now do.
- What it costs: the Linux clock now follows the Windows clock instead of internet time. Windows re-syncs rarely (trigger-start, `SpecialPollInterval` 32768 s), so after a hibernate the clock can be ~1 s off internet time — exactly the case that used to produce steps, now harmless. No test depends on absolute accuracy.
- Survives a distro restart: after the change Ubuntu stopped and started again (its systemd started 04:22:49 UTC); timesyncd stayed `disabled` / `inactive` and nothing started it. The WSL VM's chronyd kept tracking PHC0 throughout.
- Not done: no package installed or removed, no `.wslconfig` edit, no WSL restart, nothing on Windows.

### 2.2 Temporary, reverted (each checked)

| Experiment | Temporary change | Reverted by |
|---|---|---|
| B1, B2, B4, trace | kernel `tick` set to 9600 (the clock 4 % slow) | chronyd within ~2 s each time; scripts also reset `tick` 10000 on exit. Final read: `tick=10000` |
| B2 | `systemctl stop systemd-timesyncd` | `systemctl start` on exit (`active`) |
| B3 | `/run/systemd/timesyncd.conf.d/zz-wsl-clock-step-sim.conf` (`NTP=127.0.0.1`) + a local NTP server on 127.0.0.1:123 | file removed, timesyncd restarted (`ServerName=ntp.ubuntu.com`), server stopped |
| B4 | the same local server, kept running to show nothing consults it | stopped on exit (0 requests seen) |
| trace | four syscall trace events (`/sys/kernel/tracing/events/syscalls/sys_enter_{adjtimex,clock_adjtime,clock_settime,settimeofday}`) | disabled on exit |

### 2.3 Pending

None. No Windows-side step is needed for the steps. The `C:\Users\fashr\.claude\CLAUDE.md` WSL section carries one line recording the change and its undo.

## 3. Measurements, before and after

All 100 ms samples, threshold 5 ms; pass bar: no step over 50 ms.

| Run | Setup | Fault | Length | Steps > 5 ms | Max step | Guest vs host |
|---|---|---|---|---|---|---|
| A | before (timesyncd + chronyd) | none (live) | 5 min | 0 | 0.0 ms | +2 ppm |
| B1 | before | `tick` −4 % | 5 min | 0 | 0.0 ms | +0 ppm |
| B2 | timesyncd stopped | `tick` −4 % | 200 s | 0 | 0.0 ms | +10 ppm |
| **B3** | **before** | **internet ≠ host by 1.3 s** | 5 min | **7** | **+2,341.9 ms** | −4.9 % (slewing back) |
| **B4** | **after** | the same 1.3 s server + `tick` −4 % every 60 s (9 knocks) | **10 min** | **0** | **0.0 ms** | −47 ppm; REALTIME − host +27.9 → 0.0 ms |
| **B5** | **after**, fresh distro start | none (live) | **10 min** | **0** | **0.0 ms** | −0 ppm; REALTIME − host 0.0 ms |

## 4. The two rows (Part C)

Both re-located on `main` @ `b1823fdd` before editing: the census lines had not moved. Test files only. Line numbers below are at the fix commit `93d91219`.

### 4.1 `api/agent/chat.test.js:1832` — "with the runtime hook installed the write is handed to waitUntil — no wait at all, even for a hung logger"

- **On `main` (`:1831-1841`):** real timers and real `Date`; it measured "no wait" as `Date.now() − startedAt < SHADOW_LOG_CAP_MS / 2` (1,000 ms). A wall-clock step inside the turn reads as a wait. The turn itself is under 1 ms here, so the odds per run were tiny, but the probe below shows the failure is certain whenever a step lands inside it.
- **Now (`:1835-1845`):** the row runs on #1010's `deadlineClock` (`setTimeout`, `clearTimeout` and `Date` faked together), settles the handler with `clock.settle(SHADOW_LOG_CAP_MS / 2, handler(req, res))`, and asserts `atMs === 0`: the turn settled before the virtual clock moved at all. Both original assertions are kept (`statusCode` 200, one `waitUntil` hand-off). The claim is now proven more tightly than before: "not one virtual ms" instead of "under 1,000 ms of wall clock" (mutant C3 below). The import is the fixture only (`:13`), no product import. The block's `afterEach` already restores real timers (`:1752`).

### 4.2 `api/cron/film-tape-backfill.e2e.test.js:161` — "the next candle morning enriches every backfilled day inside the retry window"

- **Why neither the fixture nor fake timers fits:** this file already fakes `Date` (`:72`), so the row's own logic never sees the wall clock. Its one exposure is **vitest's row timeout**: `@vitest/runner` 4.0.17 captures `const now$2 = Date.now` when it loads (`node_modules/@vitest/runner/dist/index.js:1183`) and fails a row that resolves with `now$2() − startTime >= timeout` (`:1229`). That is the real wall clock, read before any test can fake it, so a step inside the row is added to its measured time. Nothing inside a test file can change that reading; the levers are the row's budget or its cost, and the cost is the claim itself (a full candle pass over the backfilled range).
- **Now:** the row has its own 20 s budget (`}, 20_000);` at `:175`, house precedent `api/agent/decide.carriage.test.js:196`) and a comment saying why (`:155-160`). Every assertion is unchanged.
- Measured here: 1.54–1.67 s (median ~1.59 s) over 84 unloaded runs; 3.5–7.3 s (medians 5.5 s on `main`, 5.8 s on the fix) under 20 CPU burners. Earlier notes recorded 4.4 s at base under parallel load and 6 s under default parallelism (Oct 7). 20 s covers a 6 s row plus a step, and the harness's ×2.3 reading of a ~5 s row, while still catching a hang.

### 4.3 Mutation results

Each mutant changes **production** code a row names (except the two probes, which are test-side), runs the row's whole file in the Linux tree (`TZ=UTC`), and is restored from git; `git status` was required clean after each one (clean at the end). File row totals never moved (97 / 7).

| Id | Mutant | Fixed row (`93d91219`) | `main`'s row (`b1823fdd`) |
|---|---|---|---|
| C0 | control | pass | pass |
| C1 | the runtime hook is never used (`chat.js:189` → `return false;`): a hung logger is settled in-request under the 2 s cap | **killed** — still pending after 1,000 virtual ms (one other row, "a runtime hook that THROWS…", also red) | killed — no `waitUntil` hand-off |
| C2 | handed to `waitUntil` AND still waited on (`chat.js:220` → `return write;`) | **killed** — still pending after 1,000 virtual ms | killed, after a real 2 s wait (`expected 2003 to be less than 1000`) |
| C3 | a 500 ms wait on the `waitUntil` path (`chat.js:240`) | **killed** — `expected 500 to be +0` | **survives**: 500 < 1,000 |
| P1 | probe: the real wall clock steps +1,300 ms inside the turn (during the model call) | **passes** — the row reads only the virtual clock | **red** — `expected 1300 to be less than 1000` |
| F0 | control | pass | — |
| F1 | the candle retry window is 5 sessions, not 10 (`src/constants/filmTape.js:110`): the backfill's first day ages out | **killed** — 5 written, 6 expected | — |
| F2 | a written tape past the fourth is not reported (`candlePass.js:809`) | **killed** — 4 written, 6 expected | — |
| F3 | the first candle attempt is counted twice (`candlePass.js:382`) | **killed** — `attempts` | — |

The backfill row's assertions did not change, so F1–F3 show it still proves its claim; what its fix changes is only the budget, exercised in §4.4.

### 4.4 The rows under #1010's step harness

The harness is #1010's scratch module, loaded into every node process with `NODE_OPTIONS=--import`: `Date.now` steps +1,300 ms every 1,000 ms of monotonic time, at a random phase. Both files, `--maxWorkers=8`, `TZ=UTC`, JSON reporter.

One finding about the harness itself: **#1010's module reads `performance.now()` on every call, and vitest 4's default fake timers fake `performance` too** (`node_modules/vitest/dist/chunks/vi.2VT5v0um.js:3559`: every timer except `nextTick` and `queueMicrotask`). So in a file that calls `vi.useFakeTimers()` with the defaults, a virtual advance becomes injected wall-clock steps, and vitest's own timeout reading then fails the row. Four `chat.test.js` rows do exactly that (the three "prologue" rows at `:1270`, `:1276`, `:1284` and "the cap is CLAMPED", `:1848`, which advances 29 virtual seconds). They go red under the module on `main` and on the fix alike, every run; they are not exposed to real WSL steps, which never follow a fake clock. #1010's own rows faked only `setTimeout`, `clearTimeout` and `Date`, so this never showed there. A corrected copy (v2) binds the real `performance.now` once at load; the steps are otherwise identical.

| Batch | Tree | Module | Load | Runs | Red runs | Part C rows red | Other red rows |
|---|---|---|---|---|---|---|---|
| **after** | fix | **#1010's, byte-identical** | none | 20 | 20 | **0** | the 4 fake-timer rows, 20 × each (the module's flaw) |
| after | fix | rebuilt from #1010's report (same flaw) | none | 20 | 20 | **0** | the 4 fake-timer rows, 20 × each |
| **after** | fix | v2 (real monotonic schedule) | none | 20 | **0** | **0** | 0 |
| before | `main` | rebuilt (same flaw) | none | 1 | 1 | 0 | the same 4 rows |
| before | `main` | v2 | none | 20 | 0 | 0 | 0 |
| before, loaded | `main` | v2 | 20 CPU burners | 10 | **10** | **10** (the candle row, timed out) | 0 |
| after, loaded | fix | v2 | 20 CPU burners | 10 | **0** | **0** | 0 |

Unloaded, `main` stays green too: the chat turn lasts under 1 ms (a 1-in-1,000 chance per run that a step lands inside it, hence the probe P1), and the candle row's 1.6 s reads at most ~4.2 s. Under 20 CPU burners the candle row's real time rose to 3.5–7.3 s. On `main` it timed out in all 10 runs; part of that is the load alone, since its median (5.5 s) is already past 5 s, and the harness's steps take the rest. On the fix it passed all 10 inside its 20 s budget.

## 5. Checks

- **Full suite**, Linux (WSL, Node 20.20.2), `TZ=UTC npm run test:run -- --maxWorkers=8` under `flock /tmp/pd-suite.lock`, nothing beside it, on `93d91219` (`main` + the two rows; `origin/main` re-fetched before it, still `b1823fdd`): **27,452 rows, 27,363 pass, 0 fail, 89 skipped**, 1,251 files, 227 s. Both Part C rows passed (the candle row at 2,559 ms). A clock monitor ran alongside for 480 s: **0 steps**, no sampling gap over 250 ms.
- The pushed head adds only this report. The only test that reads `docs/audits/` reads one fixed fixture JSON (`api/_utils/intraday/seed.test.js:14`).
- **`lint:gate`**: exit 0 on `93d91219`; its run on the pushed head is in the PR description.
- **`vite build`**: exit 0 on `93d91219` (built in 14 s; two CSS syntax warnings, not from this change); its run on the pushed head is in the PR description.
- The rules suite (emulator) was not run: no rules file changed.
- CI's `vitest (unit)` check was not watched (BUILD_RULES §2).

## 6. The rest of the census (unfixed, as instructed)

PR #1010's §5 rows 2–7, 9 and 10, left as they are: `candlePass.test.js:162` (also `:291`, `:326`), `film-tape-candles.test.js:75`, `agentBattleScreenHuddle.test.js:103/108/117`, the heavy AgentBattleScreen / FilmRoomV2 jsdom rows, `backingLanding.test.jsx:253/280`, the League raw-ids guards, `researchRecords/store.test.js:43-46`, `useCockpitRecords.jsdom.test.jsx:77`. With the clock no longer stepping on this machine their wall-clock exposure here is gone; what remains is ordinary CPU load, as on CI.

## 7. For the founder

- Nothing to decide for the fix. If a later WSL update stops running its own chronyd (check: `wsl --system -- chronyc tracking` shows `PHC0`), re-enable timesyncd with the undo above.
