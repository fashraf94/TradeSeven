# Astra review of Film Room D1 — the game's flow

**DO NOT MERGE**

**PR #1102 · November 21, 2026 · reviewed head `368dc113b47e77aee34d59657ac3517091762231`**

An actual older tape produces “Won by 46” with only one score in the key. The current writer can also produce an earlier day's tape that the front calls a win. The off-path comparison found first-open state lost on moment links and after an explicit dismissal. In Chromium, the admission transition swallowed a keyboard or pointer activation already in progress. These are reasons to fix the head independently of Amendment A.

## §1 Findings

Locations refer to the reviewed head. Screen files are under `src/screens/filmRoomV2/`. Each reproduction uses recorded fixture data, synthetic input, or both.

### F1 · A margin uses a hidden opponent

**Criterion 3** · `filmRoomFlow.js:97`, `filmRoomFlow.js:115`

Render the committed Sep 23 fixture from `ec3fd0dfd`, immediately before B1 added `score.opponentBasis`. Its recorded finals are −47 and −93. The front renders **Won by 46**, **You −47**, zero CPU entries and zero CPU paths. The number harness returns no defects because it falls back to the raw opponent at `__fixtures__/filmRoomHarness.jsx:865`.

**Proposed fix and test.** Derive a numeric margin only when both final values are present **in the rendered key**. Use the existing final-total fallback when only the player's number qualifies. Have the oracle require both bindings. Pin the historical fixture, an unknown basis and a normal CPU battle.

### F2 · An unknown final day is treated as confirmed

**Criteria 3, 5** · `filmRoomFlow.js:58`

Assemble Sep 23 with a missing trading-day list, a Sep 24 completion, final scores +80/+20 and a last Sep 23 check of −47. The writer returns `isFinalDay: null`. The front returns **Won by 60**, **You +80** and a +80 endpoint at the Sep 23 close. The writer explicitly preserves uncertainty at `api/_utils/filmTape/tapeAssemble.js:1204`. Both the test and the harness reproduce the permissive predicate.

**Proposed fix and test.** Require evidence that the selected day is final. Use a validated last-day match if supporting an older tape without the field. Otherwise use its date and last-check values and omit both final endpoints. Pin false, null, missing and true separately, including a later completion and a genuine legacy final.

### F3 · The first-open mark can be lost permanently for the visit

**Criteria 1, 9** · `FilmRoomScreenV2.jsx:271`, `:306`, `:539`

On a fresh viewer, open at a valid moment or supply a rejected moment under `allowlist`. The flow skips its verdict and never marks the visible notice, even after the cards verdict settles. Independently, on a regular open, click **Got it** while the verdict is held, let it answer no, and stay on the tape. Dismissal clears the state that the mark effect needs. In both cases main wrote the seen map once and head wrote it zero times. The next visit repeats the notice.

**Proposed fix and test.** Treat an irrevocable tape entry as settled for this purpose. Record a displayed notice on explicit dismissal as well. Test valid and rejected links, dismiss then deny/fail/time out, remount, and the DA-12 control that leaves a tentative tape without interacting.

### F4 · Admission can swallow an activation

**Criterion 9** · `FilmRoomScreenV2.jsx:298`, `:506`

In Chromium, hold the verdict, focus **Study**, hold Space, admit, then release. Repeat with mouse-down on Study, admit, mouse-up. Both leave the player on the front with focus on `BODY`. Study never opens. A focus-only move to the soon-removed control also loses focus. A completed click and the tablist's arrow-key handling do keep the tape.

**Proposed fix and test.** Preserve a user's tape interaction from the start of the pointer or keyboard gesture. Preserve deliberate keyboard focus on a disappearing tape control. Let native activation run once and retain unattended admission. Pin down/verdict/up for pointer and Space, ordinary Enter and an untouched control.

### F5 · Day counts are labelled as whole-game counts

**Criteria 8, 3** · `FilmRoomScreenV2.jsx:83`, `:140`, `:492`

Supply a battle without its trading-day list and a written final tape with `isFinalDay: true, dayNumber: 3`. The front says **This game**. The tape behind the door says **three-day battle**. The one fallback date in the picker is being used as the battle length.

**Proposed fix and test.** Use the same recorded length evidence as the subtitle. Say **This game** only for a known one-day battle. Test the three-day fallback, unknown length and a confirmed one-day battle with the same nonempty rows.

### F6 · The viewer's time zone can change a pin's number, time and position

**Criteria 5, 6** · `filmRoomFlow.js:23`, `:280`

The real assembler accepted a directive timestamp of `2026-09-23T14:00` and preserved it at `directives[].filedAt`. Feed that **same saved document** to head twice. In UTC it was pin 1, **10:00 AM** ET, 7.7% across the axis. In America/Chicago it was pin 4, **3:00 PM** ET, 84.6% across. A second directive with an explicit Z remained noon ET.

**Proposed fix and test.** Admit only unambiguous recorded instants to chart geometry. Keep valid offset and Z forms, including minutes without seconds. Apply DA-10 to an unplaceable event and break a check run at an unplaceable check. Replay the identical bytes in two time zones and assert identical pins, numbers, clocks and groups.

### F7 · Two singleton paths can draw straight through a missing check

**Criterion 5** · `FilmRoomFlow.jsx:145`

On an active day place scores **8, missing, 8** at 14:00, 14:01, 14:02 UTC. At chart width 350 the two actual SVG paths span x **25.9–27.9** and **27.7–29.7** at the same height. Both cross the missing instant at x **27.82**, even before applying stroke caps. Counting two DOM paths passes.

**Proposed fix and test.** Render a singleton as a point at its own instant. Where marks or caps would otherwise visually close a known gap at the current resolution, reserve a visible interruption or use a distinct missing-data treatment. Test pixel geometry at the missing instant and that the two real scores remain locatable.

### F8 · The unknown-session fallback invents time or stacks events at a fictitious origin

**Criteria 3, 5** · `filmRoomFlow.js:173`, `:176`, `:296`, `:303`

With an unmaintained calendar year and one 10:15 AM ET check, the axis reads **10:15, 10:15, 10:16**. It draws the battle final one minute after the only check. With no checks and directives three hours apart, the domain is null. Both events get `frac=0, v=0`, merge at the left, and the overflow count is zero.

**Proposed fix and test.** Handle a single recorded instant as a degenerate domain with a single time label and point representation. Without a time basis, preserve events through the full-tape count or an explicitly untimed presentation. Keep a recorded final in the key when there is no defensible place to draw it. Test zero checks, one, and several at one instant.

### F9 · Two edge cases contradict the confirmed pin-placement rulings

**Criterion 5** · `filmRoomFlow.js:171`, `:236`, `:246`, `:303`

**DA-3:** scored check +80 at 14:30 ET, scoreless check at 15:30, isolated final +5 at 16:00. A 15:55 directive in the break gets **+5**. The nearest scored *check* is +80. **DA-2:** a scored check at 16:30 widens a regular day's chart. A 16:10 directive is placed **95.24%** across, inside the axis, although it falls after the 16:00 session close.

**Proposed fix and test.** In a break, select from scored checks, excluding the synthetic endpoint. Keep the actual session bounds available for the DA-2 edge decision independently of the drawing extent needed by late checks. Test both cases plus an ordinary within-run interpolation and an ordinary pre-open pin.

### F10 · Game flow can lead to the same no-tape page

**Criterion 9** · `FilmRoomScreenV2.jsx:422`, `:423`, `:457`

Open the Sep 23 front, enter the full tape, pick a missing Sep 22 and let it settle. The header still says **Game flow**. Press it. The missing page stays on screen, the same button changes to **Dashboard**, and the external back callback has run zero times. It takes another press to leave.

**Proposed fix and test.** Once the destination day is known to have no front, expose the normal back action, or implement a deliberate return to the last written front with the correct day and focus. The existing no-tape back convention favors the former. Test a definite miss, a failed read and a missing answer arriving after a pending return.

### F11 · A delayed return takes focus back from the player

**Criterion 9** · `FilmRoomScreenV2.jsx:361`, `:422`

From the tape pick a written day whose read is held, press **Game flow**, then deliberately focus a day chip in the loading frame. Release the read. The door takes focus from the chip. The screen already has a guard for deferred jumps that remember the initiating focus.

**Proposed fix and test.** Give the deferred door jump the same focus-origin guard. Keep the existing behavior when the player has left focus on the back control. Test both endings.

### F12 · A refreshed owner can inherit the previous owner's flow answer

**Criterion 1** · `FilmRoomScreenV2.jsx:275`, `:279`

Component-level replay with the same battle ID and React key. A is admitted. Render updated props naming B and hold B's own answer. The front persists on the first and subsequent pending paints, then disappears when B answers no. The verdict reader's cache distinguishes owners, but the screen's answer state distinguishes only battles. This requires changed owner metadata on the same mounted ID. The ordinary clone entry and a new battle ID did not exhibit it.

**Proposed fix and test.** Bind the resolved state to the battle **and** the exact owner key used to request it. A mismatched answer must immediately read as pending. Pin A→B and missing→known metadata with an unchanged battle ID.


## §2 The off path and the reads

I ran the same independent React probe on LF archives of main and head. It captured the DOM at React commits and after interaction/settling, collapsed consecutive identical states and compared SHA-256 digests after normalizing generated IDs. It also recorded focus, the underlying verdict fetch, read calls and arguments, and local-storage writes. Both sides used the same synthetic auth, response and tape data. The held-timeout case fired the real verdict reader's 8,000 ms callback under test control.

- **45 paired cases, 90 mounts.** One-day, multi-day, active, missing tape, valid moment, rejected moment, casual clone and explicit dismissal each ran under flow off, pending, denied, failed and timed out. Five further pairs used the actual untaped tournament route with fixture dependencies. The v2 cases traversed Study, Deep dive and Glance, and the multi-day case changed day. The 250 v2 states and 15 tournament states recorded after collapsing consecutive duplicates within each case matched their head counterparts. Observed focus, network-request and read traces matched for these comparisons. The untaped route mounted legacy once per case and made zero verdict or Firestore calls.
- **Storage identified the regression.** All flow-off pairs matched. An ordinary leave while pending deferred the mark as DA-12 allows. After denial, failure or timeout, ordinary visits matched main. Valid moment, rejected moment and dismissal each produced the extra *settled* difference in F3. The interaction race in F4 used admitted owners and real browser input, separately from these non-admission comparisons.
- **Read budget.** The front consumes the existing tape. On a synthetic Firestore boundary the trace is one day-document read, unchanged through pin selection, stepping, Glance and Study. Opening Deep dive adds one series query. Returning through the front and reopening Deep dive reuses the series. A different day on the front adds its tape read only. Chromium independently recorded Sep 23 tape → Sep 23 series on Deep dive → Sep 22 tape. Existing cards counter and carried-idea reads can still run under cards mode. They are shared screen work already present on main. With cards off there was no counter, carried-idea read or cards line. DA-1 covers the verdict request when flow alone needs it. The reader caches definite answers by owner when known, falling back to battle ID.

### The five DA-14 pins

The five flag-mock diffs add 4, 4, 4, 4 and 7 lines. They contain only comments and the getter or mock wrapper. No assertion or committed photograph changed. I reran copies of the full assertion sets in three controls. Each cell gives **failed test cases / total test cases**.

| Suite | Change only the flag to allowlist | Deny flow, preserve original cards and route fixtures | Deny the owner to all three gates |
|---|---:|---:|---:|
| Cards | 98 / 136 | 0 / 136 | 2 / 136 |
| Route golden | 1 / 12 | 1 / 12 | 3 / 12 |
| Route untaped | 0 / 10 | 0 / 10 | 2 / 10 |
| Screen cards-off golden | 2 / 6 | 1 / 6 | 2 / 6 |
| Subject line | 5 / 15 | 0 / 15 | 5 / 15 |

**None of the five complete suites passes a universally denied owner.** Several contain positive admission controls or require cards to become available. The two residual failures under flow-only denial are precise: Route golden expects zero fetches with v2 on and cards off, and the cards-off golden expects zero across two distinct uncached fixture battles. Those are DA-1 combinations. The untaped tournament itself still passes. A negative-owner verdict cannot satisfy an assertion that expressly requires an admitted owner. The controls retained the original request path and assertions and imposed the specified denial at the resolution seams. The independent differential, rather than the flag pins, is what exposed F3.

## §3 The picture

**Lines and numbers.** I rebuilt the Sep 23 tape through the real close and candle passes with the in-memory Firestore fixture and compared its checks with the committed record. Its first player point is +11, its final key is **You −47 / CPU −93**, and its heading is **Won by 46**. The active/earlier-day key uses Glance's `score.lastCheck` bindings. The confirmed-final key uses Glance's `battle.final` bindings. Ordinary margins use integer hundredths of the two formatted values. The +10.004/+5.006 case yields 4.99. F1 and F2 are the cases where choosing the inputs breaks that agreement.

A check lacking its score, instant or both broke the model run. Out-of-order and duplicate-sequence checks produced reproducible runs, including all 24 permutations of a four-row duplicate-sequence/gap example. The SVG connects ordinary recorded vertices with straight segments. Linear interpolation within a run is intentional. F7 shows why separate arrays and separate SVG paths alone do not guarantee a *visible* break. With absent, unknown or non-CPU basis, the CPU key and paths disappeared. A null CPU key likewise suppressed its paths. The current writer requires a numeric player total before it emits a check's scores block, and can independently leave its opponent null.

The Nov 27 early-close control labelled 9:30 AM, 11:15 AM and 1:00 PM ET. A known session with one or no scored checks retains its calendar axis. A late scored check extends the drawing extent and a scoreless outlier doesn't. Multiple distinct check instants on an unknown session define the fallback extent. F8 covers its zero- and one-instant limits. On confirmed final days only, the normal endpoint is at the axis end and equals the key. F2 is the exception to day admission. F9 distinguishes an actual close from the end of an extended drawing.

**Pins and low.** All 720 permutations of six agent swaps, including tied instants, selected the same five named swaps and the same initial agent. The overflow count included the sixth swap, a lower-priority directive and an unplaceable row. For Sep 23 I compared group membership to an independently implemented first-member 44 px rule for all 36 within-section permutations × every integer chart width from 280 through 1440, **41,796 comparisons**. Qualified instants passed. F6 changes the ordering before grouping when a row lacks a zone.

| Viewport | Measured chart | Pin numbers in each group | Sep 23 low |
|---|---:|---|---|
| 320 px | 296 px | 1–2, 3–5 | Overlaps a touch target |
| 390 px | 350 px | 1, 2–4, 5 | Overlaps a touch target |
| 1440 px | 639 px | 1, 2–3, 4, 5 | Overlaps a touch target |

The ranges above identify membership. The reviewed UI still labels merged groups with “+”. At each measured width the model had **eligible=true, overlaps=true, leaves=false** for the −92 check at 1:30 PM, and Chromium rendered zero low labels. The low candidate is the earliest minimum among timed numeric player checks, requires at least three such checks, and is suppressed when it is the line's last point. DA-8 must include the final point when deciding whether the minimum belongs at the end. Normal pin heights interpolate within a run and snap to the nearer recorded check within a gap, earlier on a tie. F9 covers the isolated-final exception. An event with a null instant is counted in “more.” With only unplaceable events the count takes the place of the quiet line.

## §4 Words, facts and counts

I exercised all nine entries in `EXIT_MECHANISMS`, unknown and missing mechanisms, all three declared card states, unknown and missing states, and every combination of complete, partial and unavailable coverage for the two sections. A planted agent-like source and exit reason never turned a missing or unknown mechanism into an agent swap. The five named mechanisms displayed Your agent, Stall rule, Risk rule, Guardrail and Gameplan meeting as specified. Only `agent_decision` counted toward the agent numerator. Only `committed` counted as filed. Each denominator included every row of its section.

Sep 23 showed **1 of 3** for each tile. An incomplete section suppressed its own tile, either incomplete section produced the incomplete-record sentence, and no tiles meant no count heading. F5 affects the scope claimed for otherwise correct numbers.

**Quotation provenance passed.** In 32 mounted renderings I varied card state, the mismatch bit, and literal markup, a long string, an identifier and an empty string. Nonempty text stayed verbatim in its own child bound to `directives[i].playerText` or `.agentReply`. The markup produced zero child elements. Empty text produced no quotation. A true `agentReplyDiffers` suppressed the reply in every state. The quotation, copy and forbidden-word sweeps passed. The front's fixed narration and fact-line button names introduced no judgment word. The player's or agent's own words may naturally contain one.

**One additional copy and layout discrepancy.** `FilmRoomFlow.jsx:271` passes `lines={3}` to the kit. On a long quotation, `FilmRoomKit.jsx:310` adds **Read more** and **Show less**, outside D §11. Chromium measured 70 px of initially visible player text and 2,325 px after expanding it on the front. The reply separately offered the same disclosure. The copy harness skips the entire quotation subtree at `__fixtures__/filmRoomHarness.jsx:979`, including these UI controls. D §7 says the rest is on the tape. This belongs with the preview behavior in §7 below. The words themselves still passed exit criterion 7.

**Cards and CF-5.** Cards on plus available Glance moments yielded the singular/plural cards door with the same count. Untagged/unavailable and zero-moment days had no line. The existing cards path still owns the counter and the carried idea. Under My cards, one or two synthetic installed cards produced exactly one sentence immediately after **Adopted**, with zero copies on the rows. Each adopted digest line retained its sentence, and the receipt chain is untouched. With no adopted group there was no group sentence. CF-5 is the explicitly approved cards-surface change, including when flow is off.

## §5 The doors, focus and touch

- **Ordinary navigation passed.** I exercised 20 individual chosen-event links across one-day, earlier multi-day, active and casual-clone entries. Each swap focused the Study card for the correct original row and its time-order ordinal. Each directive focused `#directives` per DA-5. An empty written day still opened Glance. The ordinary door put focus on Glance's panel, Game flow returned focus to the door on a written day, and a subsequent front back invoked the external handler once. Returning from Deep dive and entering the tape anew opened Glance.
- **Day changes.** A chip retained focus through a pending front frame and through the settled written or missing day in the corresponding committed rows. The missing day reached directly from the front had the normal exit. Changing to a missing day **after entering the tape** gave the different result in F10. A written day that arrived after a deliberate focus move reproduced F11.
- **Moment entry.** Valid and rejected `openAt` values opened tape with the ordinary back control, including under allowlist. The valid, admitted prepared-case jump remains the existing navigation. F3 concerns the notice state on these entries.
- **Pin controls.** Chromium's accessibility tree named each button with its members' fact lines and exposed its pressed state. The actual Tab sequences were **1, 3** at 320, **1, 2, 5** at 390, and **1, 2, 4, 5** at 1440. Touch selected the last group at each width. On the 390 merged group, Space at the first and last stepper limits left member 2 or 4 selected and retained focus. The fixture's ordinary buttons measured 44 × 44 with rounded corners. Hit testing and touch activation worked inside the targets.
- **DA-11 geometry.** With pre-open and post-close directives, the 320 layout exposed only **34 px** of each 44 px button horizontally. At 390 it exposed **42 px** on both ends. At 1440 both had the full **44 px**. These are the assigned edge-inset cases. F4 is a separate input race before the front appears.

## §6 Amendment A

| Ruling | Safety, completeness and interaction with the head | Test to pin the fix |
|---|---|---|
| **DA-4 · Equal displayed finals** | Safe for two displayed finals. Make the zero decision on their numeric hundredths, so +0 and −0 agree. Keep the recorded win/loss word and remove the margin binding. F1 still needs its own guard when the key has no CPU entry. | Render win and loss with raw scores that round equal, opposite signed rounded zeros, a genuine draw, and a one-hundredth difference. Check visible text, the two key bindings, and absence of a margin node for an unnumbered result. Include the historical no-basis fixture. |
| **DA-8 · Low includes final** | Safe and complete for the stated case if the **drawn player final** participates in the minimum and a tie with that final suppresses the mark. The final must not count toward three scored checks. Keep the first tied check rule when the endpoint is higher. | Final below, equal to and above the minimum, with a deliberately clear label box. Repeat on an earlier day and with only two scored checks. Existing Sep 23 overlap tests alone cannot distinguish these implementations. |
| **DA-9 · Missing player final** | Safe if heading, both key bindings and both line endings share one decision. Changing only heading and key would append a last-check value at the close as a false final, or retain a CPU-only final. F2 determines whether the day is eligible in the first place. | On a confirmed final day leave player final null, set CPU final different from its last check, and check the date, both last-check paths and zero final endpoints. Repeat with no checks. With a real player final and a missing opponent/result, retain **Final {total}**. |
| **DA-11 · Inset the time axis** | Safe if there is one drawable x-range for the SVG, pin groups and panel, drop line, final dots, labels and low-overlap boxes. The chart and panel currently invoke grouping separately. Moving only the buttons would break agreement and could create overlap. Both phone widths need the change. | Test both edges at 280, 320, 390 and desktop. In Chromium check the viewport intersection and hit targets. At just below, exactly at and just above 44 px verify identical group membership in chart and stepper. Re-pin the fixture after final DA-15 marker sizing. |
| **DA-15 · Show the range** | Safe with two **bound** member ordinals and one fixed en dash. The visual mark may widen independently of the 44 px hit target. A hit target wider than the grouping threshold can overlap its neighbor. Preserve the highest-priority shape, selected member and fact-line accessible name. | Exercise a two-member and three-member group, step through 2–4, and place another group 44 px away. Check the label, both ordinal bindings, each accessibility name, hit testing and layout with DA-11 in place. |
| **DA-16 · Visually hide attribution** | Safe and complete for attribution. A default-false prop can apply visually hidden styling to the existing direct-child span at `FilmRoomKit.jsx:311`. Leave its text, timestamp child and path attributes intact. I applied that styling to rendered fixture DOM. Chromium still exposed “the player” in its accessibility snapshot, and the existing quotation oracle passed. Removing the child instead produced “no attribution.” This prop alone does not address the long-quote disclosure in §4. | Compare existing call sites' serialized markup with the prop omitted and false. For the front, assert an intact direct attribution child, exact source/time, visible clipping and both speakers in the browser accessibility tree. Mutate/omit the attribution and require the oracle to fail. A DOM-only oracle cannot prove assistive visibility. |

The remaining confirmations stand with the qualifications already tested above. DA-1 and DA-12 describe narrower exceptions than F3. DA-2 and DA-3 need the F9 combinations to hold. DA-5, DA-6, DA-7, DA-10, DA-13 and DA-14 keep their stated meanings.

## §7 Backlog

Keep the approved resize/regroup focus loss, NUM-6's scored rows tied to the millisecond with one missing sequence, the intentional Sep 23 low-label omission, and the swap-panel space reserved for D2. D2's overnight words, cross-game habit counts and the idea remain later work. The governed mock-up differences and accepted C1/C2 work add no release gate here.

The long-quotation expansion is a separate preview/copy discrepancy. A front-only fixed three-line preview and the existing tape link would meet D §§7 and 11. Keep the tape kit's normal disclosure available to its existing callers. Pin the long-text case in a browser that measures overflow and limit the copy sweep's exemption to bound quoted text and its approved attribution. This discrepancy adds no independent provenance or judgment blocker.

## §8 Review record

| Check | Evidence |
|---|---|
| **Tree identity** | Remote refs resolved to head `368dc113b47e77aee34d59657ac3517091762231` and main `cf35151b9528cbdf32a6452b7ffec29c7b058f2f`. Main is the merge base. The merged tree is head tree `835e9f4f1026e7568cb4080c9139f495f19da722`. Since code head `bed627b5`, only the report and docs index changed. |
| **LF verification** | `git -c core.autocrlf=false -c core.eol=lf archive` for both refs. Independently hashed every tracked blob including Git's type/length prefix. **5,521 head and 5,505 base blobs, zero mismatches.** Diagnostic harnesses lived in separate copies. |
| **Platform** | WSL2 Ubuntu 24.04.1, Linux x86-64, Node 22.22.2, Vitest 4.0.17, Vite 7.1.12, Temurin 21.0.13, headless Chromium 147.0.7727.15. Gates ran with `TZ=UTC`. The explicit timezone counterexample also ran under America/Chicago. Dependency install lock SHA-256 matched `e457c10d0317872bff6bdb9ee1925cd0d5594159edbf5ba56fd8e5939c2fdd72`. |
| **Full suite** | **Pass**, `vitest run --maxWorkers=8`, 1,593 files passed, 13 skipped. **36,532 tests passed, 179 skipped, zero failed**, 407.29 s. The initial plain archive had three failures because offline record tools invoke `git rev-parse HEAD`. I supplied a private detached Git identity for the exact archive. All 31 tests in those three files then passed, followed by the full green rerun. |
| **Rules** | **Pass**, `npm run test:rules`, 46 files and **839/839** assertions, 302.95 s, local Firestore emulator with project `demo-tradeseven-rules`. |
| **Lint and build** | **Pass**, `npm run lint:gate`, exit 0. **Pass**, `vite build`, exit 0 in 34.55 s. |
| **Fences** | Compared all 30 changed paths and their relevant hunks, +4,536/−26. No API, rules/index, deployment, package/lock, hub, Practice Field, §1 calibration file, named fenced screen/data component, committed golden or fixture data changed. Under `__fixtures__` only the permitted harness and its self-test changed. `filmRoomModel.js` adds seven aggregate declarations to the existing table. `FilmRoomCardRegions.jsx` has one three-line CF-5 hunk. The five flag pins retain all prior assertions. **Criterion 11 passes.** |
| **CI** | One successful GitHub Actions lookup filtered to this PR head. **Tests #655**, run **44872367052**, was **completed / success**. The local verification above was independent. [GitHub Tests run](https://github.com/fashraf94/TradeSeven/actions/runs/44872367052) |

**Before merging.** Include F1–F12 in the fix round alongside the six code rulings. Recheck their reproductions on the resulting merged tree, particularly the historical tape, moment-link storage and real-browser input. Criteria 2, 11 and 12 passed at this head. The founder needs a new ruling only if an exit-criterion failure is deliberately accepted. I found no additional prerequisite for the founder to perform in production. This review used local synthetic data and read-only GitHub metadata.
