# Cockpit Build 2a — the cockpit screen, built dark

**HEAD at branch creation:** `4dfc48d931c587cef4d587b8802190bf371c3eb0` (main, after `git fetch origin && git checkout main && git pull`)
**Branch:** `claude/cockpit-build2a-screen` · **code head:** `cca32e6d` · this report is the next commit (docs only)
**Smoke preview (NEVER MERGE):** https://trade-seven-flpand3zh-fais-projects-bc179554.vercel.app
— branch `claude/cockpit-build2a-smoke` at `2f2accb2` = `cca32e6d` + one smoke commit
**Spec:** `docs/COCKPIT_BUILD2A_SPEC_V1_0.md` · **Contract:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_C.md` · **Rules:** `docs/BUILD_RULES.md` (binding)
**Date:** 2026-10-03

---

## 0. In one paragraph

Everything in spec §3–§11 is built, in order, and ships dark. `CALL_RECORDS_MODE` stays `'off'`, `COCKPIT_UI_ENABLED` ships `false`, and no allowlist value is anywhere in the repo.

With the flag off, the Battle View renders byte for byte what `4dfc48d9` renders. Both flag-off renders were captured at base and at head and compared (§6.3).

When it is lit, the screen works like this:

- **Desktop:** the character pane gains a Cockpit section, first in the list and the default.
- **Phone:** a Board · Cockpit switch over a two-screen swipe track.
- **Server:** it decides who sees it (`GET /api/agent/cockpit-status`, the allowlist read at call time); the client never decides.

The review:

- Six lenses and five refuting verifiers produced 12 MAJOR findings; all were confirmed (L5-1 only in part) and all are fixed.
- Every other finding was fixed or recorded for the founder or the framework chat (§11). No finding was refuted outright; two sub-claims were.
- The mutation battery ran 120 mutations: 114 killed. Of the six survivors, five are now killed by new rows. The sixth was an equivalent mutant on dead code, which is removed.

The full suite fails exactly the same 16 files / 32 tests as the base snapshot on this machine; nothing new fails.

---

## 1. Setup and pins

| Check | Result |
|---|---|
| `docs/audits/20261002_PHASE0_BUILD2_COCKPIT.md` on main (PR #927 merged) | present at `4dfc48d9`; proceeded |
| `COCKPIT_BUILD2A_SPEC_V1_0.md` SHA-256 | `e9771179f544a1fcd72f5a6522b3ec0d9782759833c484175d4be8d5b5b3f108`, matched on the attachment and on the committed blob |
| `CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_C.md` SHA-256 | `7f56e4af5315d700ae8f49cb5eb17513c08e846cb176f0a8034f7c54b5004ac6`, matched on the attachment and on the committed blob |
| First commit | `198ca4a9`: those two files only, unmodified (2 files, +435). Neither changes afterwards: `git diff 198ca4a9 cca32e6d` on both paths is empty |

**Commits:**

| SHA | What |
|---|---|
| `198ca4a9` | docs: the spec and the amendment, byte for byte |
| `daefc72c` | S-8: port 1A-C into the live 'on' text; freeze the pre-port 1A arm |
| `28b2dc35` | server: Amendment C-1 to C-5, the shared answer table, the server allowlist, the status endpoint, the rollback check |
| `100836c6` | tokens: the four `--ft-call-*` state aliases (39 → 43) |
| `ee088ae8` | client: readers, feed, sheet, phone Board · Cockpit, pane sections, chat integration (dark) |
| `6acbd080` | review fixes, server |
| `b6e120b7` | review fixes, client |
| `3595158d` | mutation battery: five killing rows, one dead guard removed |
| `cca32e6d` | what the final full run caught: one source pin, one load race in a test |

Branch diff vs `4dfc48d9` (code head): 77 files, +8,951 / −324.

---

## 2. What changed, in plain terms

### 2.1 Server. Calls-mode code only, inert at `'off'`

**Amendment C:**
- **C-1:** a top-level `watching` list with `watchingSource`. It is validated with HEAD's rules for `declarations.watching` (see §3).
- **C-2:** a call minted on a held name is an upside call. It takes no answer; the endpoint returns 400 `illegal_answer`, reason `upside_call`.
- **C-3:** counterpart usability. An exit counterpart must be:
  - in the check's universe;
  - not held;
  - not the call's own symbol;
  - not cooldown-locked. The locked set is frozen at the model seam from `battle.portfolio.bench`, as of `promptBuiltAt` (review L1-3).

  An unusable counterpart is stored as `null`, and `counterpartRaw` keeps at most 40 code points of what was said.
- **C-4:** `saidOk` per call.
- **C-5:** `mintedMode` on every record. The readers keep only `'on'`.

**The rest of the server:**
- **The shared answer table** (`answers.js`): the endpoint and the tile buttons read one legality table.
- **The server allowlist** (`api/_utils/callRecords/allowlist.js`): `COCKPIT_ALLOWLIST_UIDS`, read at call time.
  - `GET /api/agent/cockpit-status` answers for the battle's owner only, with `no-store`.
  - A change to the env var reaches production only with a production redeploy (Vercel applies env changes to new deployments only; review L1-2).
- **The rollback check:** `scripts/shadow-read-call-records.mjs --rollback-check --since=<ISO instant>`.
  - **Window:** the calendar's last five trading sessions, with a floor at `2026-10-02` (the end of the shadow era), so shadow-era calls never pool with 'on' calls (L1-1).
  - **`--since` is required.** The check fails closed without it.
  - **Trip rule** (as the founder's Oct 4 ruling set it, this report's §13; the build shipped 150 and 3/386): trips only at ≥ 60 calls, a rate above 3 %, and a one-sided Fisher p < 0.05 against 7/386, round 3's qualified 1A-C rate.
  - **Verdicts:** `NO ALLOWLIST` is its own verdict, with exit code 2 (L1-6).

### 2.2 The model-visible text (S-8)
- The live 'on' tool text carries the 1A-C wording port. It serializes to `7388755a…` (13,623 chars).
- The experiment's pre-port 1A arm is frozen at `81499cbc…`.
- Every other arm's bytes are unchanged: off `91c19f51`, shadow `b2478d31`, D `2a90e67b`, and the rest; V1 re-hashed all eight.
- C-3 changes what the model reads in one more place, `call_go` / `call_hold` directive text, when a counterpart is unusable (L1-5 / L2-2). It is listed in §11.

### 2.3 The screen. Dark: nothing renders unless the flag is on AND the server says on

**Readers** (`useCockpitRecords`):
- Calls, declarations (Monitoring), callEvents, and one getDoc per observation.
- Each orders by one field (no composite index), gates inside its effect, opens nothing while off, and tears its listener down.
- Each returns `{status, value}`: off, loading, ready or error. A failed or undelivered read is never shown as an empty list (L3-2).

**The feed** (`cockpitModel` + `CockpitFeed`):
- Groups: Needs you · Waiting · Earlier (10 shown, then "Show all"), plus the Monitoring row.
- Each tile shows:
  - a kind label and an eyebrow;
  - the call's line and its state tag (one tag table: `COCKPIT_FACT_TAGS`);
  - the answer buttons: agreeing is free, an override costs a message.
- Restated calls fold into one thread (C-6).
- "One call at a time" restates the endpoint's own predicate, with a parity test over 512 rows.
- Refusals print the §8.3 lines.

**The sheet** (`CockpitSheet`): a modal dialog with the call's sentence (when `saidOk`, never on an upside call), the default line, earlier wordings, receipts in check order, and the "From the {t} check →" link into the chat.
- Focus is trapped and restored by tile id.
- Escape and Tab work wherever focus sits.
- Content behind it is `inert`.

**Desktop:**
- The pane's sections are computed: `Cockpit · Chat · Bench · Tape` while cockpit-on, otherwise unchanged.
- A remembered section missing from the list is repaired to the list's first entry.
- "Chat · {n}" shows the unread count while another section shows, capped at "9+".
- The four "open Chat" doors still open Chat.

**Phone:**
- A Board · Cockpit switch (count = Needs you), over a native scroll-snap track.
- A swipe commits on scroll end, or after an idle where `scrollend` is missing.
- Under reduced motion the switch is instant.
- The overlay pane keeps `Chat · Bench · Tape`.

**Chat:**
- Cockpit filings carry the "From the cockpit" label.
- The unread count never counts the player's own answers (L3-1).
- Receipts derive from the ungated exchanges (L3-9).

### 2.4 Tokens and guards
- **Tokens:** `--ft-call-yours/acted/dropped/muted` alias existing tokens (39 → 43). `tokenBaseline.json` and `cssTokens.test.js` move together.
- **Guard registration:** every new file is registered with the token guard and the motion guard (GUARDED_FILES plus baselines).
- **Flag pins:** `COCKPIT_UI_ENABLED` is pinned by `cockpitUiFlags.test.js` (flagPinGuard, DARK_BY_DESIGN).

---

## 3. Anchors re-verified at HEAD: where HEAD differed (HEAD followed)

| Anchor | At HEAD | What the build did |
|---|---|---|
| `AgentBattleScreen.jsx` line anchors | drifted: :614-616 → :1025, :2098 → :2792, :1118-1124 → :1665, :1201-1206 → :1826 | used the HEAD lines |
| S-2: the model seam carries the held set | it did not (`observe.js`) | the held set, and now the cooldown-locked set, are frozen at that same seam (`freezeModelObservation` → `callsCtx.held` / `callsCtx.locked`). That is the passable case S-2 allows, not a STOP |
| The declarations record's check time | it has no `promptBuiltAt` | Monitoring resolves "From the {t} check" through the battle's evaluations by `evalId` |
| §7.3 "whose call has no `playerResponse.heardEvalId`" | the endpoint's `isCallDirectivePendingAt` keeps a HEARD call directive pending until it expires, and an expired one blocks nothing | the buttons follow the endpoint (a parity test runs both on one table). The line says which case it is: unheard → the spec's line; heard or not loaded → "stays active until {t}" (§11) |
| C-1's parenthetical ("in the universe … de-duplicated") | `declarations.watching` has no universe check and no de-duplication at HEAD or at base | the top-level list follows the operative clause ("exactly the rules that apply"); conflict recorded at `validate.js` and in §11 |
| "{n} messages left" from the battle's own counter (§5) | a LEAGUE battle's answers charge the group's daily budget (`call-response.js`), which the battle document does not carry | a league battle shows no number, never one the endpoint does not enforce; a regular battle shows its own counter against its limit (`AgentBattleScreen.jsx:2599-2605`) |

The rest re-verified as written, including the precedent anchors for the computed sections and the repair (`SearchDiscover.jsx:24`, `BackingDesk.jsx:67-72`, `BackingScreen.jsx:143-148`).

---

## 4. STOP conditions: none tripped

| Condition | Evidence |
|---|---|
| A fenced file touched (BUILD_RULES §1) | none in the diff. `agent-evaluate.js` (the seam) is not fenced; `agentScoring.js` was read, not changed |
| S-7: the shared copy module does not bundle cleanly for the client | it bundles. The flag-off build tree-shakes the cockpit, so S-7 was proven on a flag-on build: exit 0, no server-only sources, no allowlist strings |
| S-8: the 1A-C port does not serialize to `7388755a…` | it does (13,623 chars). Re-checked after the review's L2-3 deletion: all eight arms identical |
| S-2: the seam does not carry the held set and it cannot be passed from that seam | it is passed from that seam (§3) |

---

## 5. No flag flips

**At `cca32e6d`:**
- `src/config/featureFlags.js:2826` reads `export const CALL_RECORDS_MODE = 'off';`
- `:2897` reads `export const COCKPIT_UI_ENABLED = false;`

**Allowlist values:** the only assignments to `COCKPIT_ALLOWLIST_UIDS` in the repo are synthetic placeholders ('uid-a', 'owner-uid-1', ',,,') set on `process.env` inside two test files.

**Bundles:**
- **Flag-off build:** no `COCKPIT_ALLOWLIST_UIDS`, no `firebase-admin`.
- **The name `CALL_RECORDS_MODE`:** it appears in the flag-off bundle, the smoke bundle and the base bundle alike. It is the key in the bundled `featureFlags` namespace, pre-existing since Build 0, with its public `'off'` value.

---

## 6. Tests and builds

### 6.1 Full suite (vitest, LF archive of the commit, exit code asserted)

On this Windows machine (`core.autocrlf=true`), suites run on `git -c core.autocrlf=false archive` snapshots.

| Tree | Exit | Test Files | Tests |
|---|---|---|---|
| base `4dfc48d9` | 1 | 16 failed · 829 passed · 6 skipped (851) | 32 failed · 17,320 passed · 87 skipped (17,439) |
| **head `cca32e6d`** | **1** | **16 failed · 847 passed · 6 skipped (869)** | **32 failed · 17,836 passed · 87 skipped (17,955)** |

- **The failure sets are identical**, file for file and test for test: zero new failures.
- **What the branch adds:** 18 test files and 516 tests, all passing.
- **The 16 pre-existing failures** are on this machine at base:
  - mandate / wire import scans: `mandateNativeEsm.smoke`, `wireModelCall.imports`, `mandateModelCall.imports`, `mandateUniverseSnapshot.imports`, `mandateMoneyRounding.scan`, `agentSafeWireEntry.boundary`;
  - `StockChart.controlledSession`, `agentReadCensus.guard`, `decisionRecord`, `dateUtils`, `ruleSupportStatus`, `traitLibraryCandidate.composition`, `LeagueSpectate.honesty`, `archetypeRegistry`, `fantasyTimesConsensus.n4`;
  - the chat row of `AgentBattleScreen.flagOff.golden` (a timezone string, §6.3).

**What the final run caught.** The previous full run was at `ee088ae8`, before the review fixes. A run at `3595158d` failed two files the base does not: 18 | 34. Both are fixed in `cca32e6d`:

- `AgentBattleScreen.controller.test.jsx` pins the seen effect's source. The L4-2 fix added one conjunct and one dependency, and the pin moves with it. With the flag off nothing is ever pending, so the flag-off effect is the shipped one, and the render-time clear's byte pin is untouched.
- `useCockpitRecords.jsdom.test.jsx` waited a fixed ten loop turns for the lazy firebase import, and under full parallel load the import took longer. `settle()` now waits for the same two modules to finish loading, and listeners are found by polling.

### 6.2 Builds and gates

| Check | Result |
|---|---|
| `vite build`, flag off, at `3595158d` (tests are the only change since) | exit 0. The same four pre-existing CSS warnings as base |
| Main chunk, flag off | 4,618,896 → 4,630,984 B (+12,088 B; gzip +4.24 kB). The cockpit copy and `BoardCockpit` load eagerly (L3-8, §11) |
| Flag-on build (S-7) | exit 0, no server-only source, no allowlist string |
| Smoke build (`2f2accb2`) | exit 0, no allowlist string |
| `npm run lint:gate` (no-undef, rules-of-hooks) on the LF snapshot of `cca32e6d` | exit 0 |

The working tree's git-ignored `.vercel/output/` (a local Vercel build from Aug 19) makes the gate fail in the working tree itself, with 1,379 errors in minified function bundles. The committed tree has no such directory.

### 6.3 Flag-off is the shipped screen

`AgentBattleScreen.flagOff.golden`'s chat row fails at base too: the golden reads "3:02 PM" (captured in UTC), and this machine renders "10:02 AM" (local time).

To make the claim anyway, the golden's own harness rendered both photographs at base and at head:

| Photograph | At base and at head |
|---|---|
| The screen | SHA-256 `1a8d7353…`, 53,281 B, identical, and equal to its golden |
| The chat | SHA-256 `90f2a952…`, 18,647 B, identical |

---

## 7. The §12 review (BUILD_RULES §2)

### 7.1 How it ran

**Trigger:** 64 files on the branch diff at `ee088ae8`, far past the threshold.

**Isolation:** every reviewer worked on its own `git archive` snapshot of `ee088ae8` (LF), read-only on git and on the shared working tree. node_modules was a junction. Product files touched for repros were restored byte-exact (sha256-checked). Real-browser checks were served on 127.0.0.1 only.

**Lenses (6):**
- **L1:** server and Amendment C.
- **L2:** model-visible text.
- **L3:** client data and activation honesty.
- **L4:** desktop UI.
- **L5:** phone, accessibility and reduced motion.
- **L6:** copy and honesty.

**Refuting verifiers (5).** Each was told to REFUTE every finding with an executed repro:

| Verifier | Findings | Method |
|---|---|---|
| V1 | L1 + L2 server items | 3 repro files, the base modules side by side |
| V2 | L6 + L2-1 | 24 repro rows on the real flip / heard writers, the real endpoint and the mounted feed |
| V3 | L4 + the shared sheet items | jsdom, plus a real Chromium 152 harness |
| V4 | L5 | jsdom, plus a real Chrome harness at 375×812 |
| V5 | L3 | 23 rows, including the mounted screen; three fix variants executed |

### 7.2 Verdicts and dispositions

Every finding went to a verifier except L3-8, a bundle measurement, which is re-measured in §6.2.

**Headline:** 12 MAJOR, all confirmed (L5-1 in part), all fixed. No finding was refuted outright. Two sub-claims were REFUTED:
- **L5-1, the lock-leak harm:** `index.css` puts `overflow-x: hidden` on `html` and `body`, so the leaked body lock never reached the viewport.
- **L5-5(e):** Chromium does not focus an element inside a hidden panel, and the chat's layout effect lands focus on the check card.

Fixes landed in `6acbd080` (server) and `b6e120b7` (client).

| ID | Sev. | Verdict | Disposition |
|---|---|---|---|
| L1-1 rollback window pooled shadow-era calls | MAJOR | CONFIRMED | **Fixed:** calendar last five sessions, `notBefore 2026-10-02`, `--since` required (fails closed) |
| L1-2 "immediate" rollback | MAJOR | CONFIRMED | **Fixed:** "remove the uid and redeploy production" in the TRIP line, comments and test titles; spec §10.4 erratum in §11 |
| L1-3 C-3 lock / watchlist / cross-type | MINOR | PARTIAL (cooldown half) | **Fixed:** cooldown-locked set frozen at the seam (`benchCooldownLocked`). Watchlist-only and cross-type are not in C-3's enumeration → §11 |
| L1-4 C-1 parenthetical vs HEAD | MINOR | CONFIRMED | **Recorded:** the code follows the operative clause; amendment text → §11 |
| L1-5 / L2-2 C-3 changes consumers | MINOR/NOTE | CONFIRMED | **Recorded**, with consumer pins in `amendmentC.test.js` (`call_go` text, `planFlip` acted, `go_now` eligibility) → §11 |
| L1-6 empty allowlist read as NO DATA | MINOR | CONFIRMED | **Fixed:** `NO ALLOWLIST` verdict, exit code 2 |
| N2 404 vs 403 | NOTE | CONFIRMED | **Recorded:** matches `call-response.js` → §11 |
| N3 `held` overwritten per seam call | NOTE | CONFIRMED (latent) | **Recorded:** one call site; unreachable today |
| N4 stale `malformed_block` comment | NOTE | CONFIRMED | **Fixed** |
| N5 ask/keep on an upside call → 400 `deferred` | NOTE | CONFIRMED | **Recorded:** the client maps every 400 to one line |
| L2-1 'on' text describes features 2a hides | NOTE | CONFIRMED (facts) | **Recorded:** S-8 prescribes the text byte for byte → framework chat |
| L2-3 dead `import * as schema` | MINOR | CONFIRMED | **Fixed:** all eight arms' bytes unchanged |
| L3-1 own answers counted as unread | MAJOR | CONFIRMED | **Fixed:** the unread chain runs over the tape minus `_fromCockpit` entries (V5's executed alternative) |
| L3-2 failed read shown as "No calls yet" | MAJOR (V5: MINOR) | CONFIRMED | **Fixed:** `{status, value}` readers; no empty state, tags or receipts until ready; a read-error line |
| L3-3 stale belief override | MINOR | CONFIRMED | **Fixed:** keyed by battle, cleared once the subscription moves |
| L3-4 1410 px listener with the flag off | MINOR | CONFIRMED | **Fixed:** `useMinWidthWhen(px, enabled)` |
| L3-5 "Battle ended" can't show | NOTE | CONFIRMED | **Recorded:** spec §4 vs §7.4 → §11 |
| L3-6 status freshness; in-place switch | NOTE | CONFIRMED | `enabled` now requires the subscribed document to be this battle; freshness → §11 |
| L3-7 silent drop of a second tap | NOTE | CONFIRMED | **Fixed:** every button waits while any answer is in flight |
| L3-8 main chunk growth | NOTE | (measured) | Re-measured +12,088 B at head → §11 |
| L3-9 receipts from the gated list | NOTE (V5: receipt half MINOR) | CONFIRMED | **Fixed:** receipts and the filings walk derive from the ungated exchanges. A UI-flag-only rollback is procedure (§10) |
| L4-1 feed never scrolls after the sheet | MAJOR | CONFIRMED (Chromium) | **Fixed:** React owns the lock (`overflowY: sheetOpen ? 'hidden' : 'auto'`); tested declaratively |
| L4-2 pre-load messages get no count | MINOR (founder) | CONFIRMED | **Fixed:** the seen-marker holds while the status is pending; 8 s request timeout; label capped at "9+" (fits the measured 423 / 1410 budget) |
| L4-3 answering loses focus | MINOR | CONFIRMED | **Fixed:** focus returns by tile id, with a fallback |
| L4-4 modal didn't cover the pane header | MINOR | CONFIRMED | **Fixed:** the pane's controls are `inert` while the desktop sheet is open |
| L4-5 / L5-6 check link at 16 px | MINOR | CONFIRMED | **Fixed:** the inner span is sized |
| L4-6 / L5-3 `all: unset` removed the focus ring | MAJOR | CONFIRMED (Chromium) | **Fixed:** explicit reset that leaves outline alone |
| L4-7 off-path label gate unguarded | NOTE | CONFIRMED | **Fixed** with L4-8; guarded (mutation C58 killed) |
| L4-8 count on the phone | NOTE (V3: MINOR) | CONFIRMED | **Fixed:** `chatUnread={cockpitOn && isDesktop ? … : 0}` |
| L4-9 width budget | NOTE | CONFIRMED | 423 / 1410 hold at "Chat · 9+" (338.4 px) |
| L4-10 link lands on the trade card on a swap check | NOTE | CONFIRMED (intended, D-89) | **Recorded** as a deviation → §11 |
| L5-1 mark over the phone sheet | MAJOR | PARTIAL (harm of the lock leak refuted) | **Fixed:** the mark and bubble are not rendered while the phone sheet is open |
| L5-2 track flips mid-gesture | MAJOR | CONFIRMED | **Fixed:** commit on `scrollend` or after an idle; a swipe is never answered with a programmatic scroll; the latch clears |
| L5-4 pinch-zoom collapses the phone cockpit | MAJOR | CONFIRMED | **Fixed:** zoom-corrected height on the phone cockpit branch only, with a 480 px floor |
| L5-5 sending drops focus; Escape dead | MAJOR (phone) / MINOR (desktop) | CONFIRMED / PARTIAL (e refuted) | **Fixed:** `aria-disabled` while sending; document-level Escape / Tab while open; focus guard; the panel is the first Shift+Tab stop; "Show all" focuses the first revealed tile |
| L5-7 sheet id never cleared | MINOR | CONFIRMED | **Fixed:** cleared when its tile leaves the feed or the cockpit turns off |
| L5-8 refusal announced twice | MINOR | CONFIRMED | **Fixed:** the layout and header behind the phone sheet are `inert` |
| L5-9 muted text below 4.5:1 | MINOR | CONFIRMED | **Fixed locally:** small muted text uses `text-secondary`, no Earlier opacity. The spec's `--ft-call-muted` alias stays → §11 |
| L5-10 targets under 36 px | MINOR | CONFIRMED (passes 2.2 AA) | **Fixed:** switch tabs and chips are 36 px |
| L5-11 a–g | NOTES | CONFIRMED | **Fixed:** root height asserted; scroll ref passed to the track; `aria-roledescription` removed; duplicate landmark names removed; `aria-haspopup="dialog"`; first position `auto`; sheet takes the bottom inset; unused copy removed |
| L6-1 open call with `actedEvalId` ignored | MAJOR | CONFIRMED | **Fixed:** an act on ANY thread member is the tag ("Acted at the {t} check"), with no buttons; an act without an event still gets a receipt |
| L6-2 older agreement worn by the newer wording | MAJOR | CONFIRMED | **Fixed:** tag from the newest (or live) call; "You agreed · {t}, on the {t} wording" as an answer line. C-6 key → framework chat |
| L6-3 sheet dropped the original wording | MINOR | CONFIRMED | **Fixed:** `slice(1)`, the oldest labelled "Called at the {t} check"; the test re-pinned |
| L6-4 "Dropped · price line out of range" asserts a reason the record lacks | MINOR | CONFIRMED | **Fixed** as bare "Dropped" → founder ruling, §11 |
| L6-5 `directive_pending` line | MINOR | CONFIRMED | **Fixed:** wording from `pendingCallId`'s evidence, else "is still active"; the kept refusal ages out once the block lifts |
| L6-6 "deadline has passed" under a resolved call | MINOR | CONFIRMED | **Fixed:** no refusal line on a resolved call |
| L6-7 live buttons past the deadline | MINOR | CONFIRMED | **Fixed:** no answers when `expiresAt <= now` (the endpoint's guard); Waiting |
| L6-8 "in force until" | NOTE | CONFIRMED | **Fixed:** "stays active until {t}" / "is still active" |
| L6-9 an upside call's own sentence | NOTE | CONFIRMED | **Fixed:** hidden on upside calls |
| L6-10 two intent renderers | NOTE | PARTIAL | **Recorded:** `renderIntentLine` has no consumer → founder's choice, §11 |
| L6-11 receipts / tags | NOTE | CONFIRMED | (b) **Fixed:** receipts sorted by the check each names. (a) and (c) → §11 |

---

## 8. Mutation battery (BUILD_RULES §2: mutation-checked)

The harness (`battery.mjs`) runs only against a snapshot tree:
- **CONTROL** first: every named test file green unmutated.
- Then one mutation at a time: an exact `find` occurring once; the named files run; the file is restored byte-exact.

**Run on `b6e120b7`:** 120 mutations: 26 server, 94 client, across 27 files. CONTROL: 22 files, 513 tests green. **114 killed, 6 survived.**

| Survivor | What | Disposition |
|---|---|---|
| C11 | the tag ignores an act on another thread member | **killed:** new row, an act on an EARLIER wording with no answer on it (the old row's acted member also carried the live directive, which masked it) |
| C17 | the slot's own call blocked by its own directive | **killed:** new row, the endpoint's `thisCallId` exemption at the tile |
| C37 | repair to the default, not the first entry | **killed:** new row on a list whose default is not first. Every shipped list puts its default first, so the screen cannot tell them apart |
| C39 | "Chat · {n}" while Chat shows | **killed:** new `CharacterPane.cockpit.jsdom.test.jsx`. The screen marks the chat seen the moment it shows, so it never hands the pane this state |
| C72 | a settled swipe answered with a programmatic scroll | **killed:** new row with a controlled parent, resting short of the snap point (the old row's `onScreen` was a spy, so the effect never re-ran) |
| C87 | an answer tap also opens the sheet | **equivalent:** the buttons are siblings of the open button and the backdrop is a sibling of the panel. No click handler sits above them and the app has no document click listener. The dead `stopPropagation` is removed; "a button answers … and does NOT open the sheet" still pins the property |

Each new row was run against its mutation on an LF snapshot, and each fails on exactly that row. **Final: 119 killed, 1 equivalent (removed).**

The off-path mutations are among the killed: L4-7/L4-8, L3-1, L3-4, L3-9, L4-1, L4-2, L5-1, L5-4 and the flag pins.

---

## 9. The smoke branch

**Where:** `claude/cockpit-build2a-smoke` at `2f2accb2` (NEVER MERGE). It is `cca32e6d` plus one commit that:
- sets `COCKPIT_UI_ENABLED = true`;
- adds `src/screens/cockpitSmokeFixtures.js`;
- wires `?cockpitFixtures=` into `AgentBattleScreen.jsx`.

It was first built on `b6e120b7` (`d58fb39e`) and rebased onto `cca32e6d` after the battery removed the dead `stopPropagation`. That one line is the only product difference between the two.

**Preview:** https://trade-seven-flpand3zh-fais-projects-bc179554.vercel.app
- Sign in.
- Open a Battle View.
- Add `?cockpitFixtures=1`, `=pending` or `=heard` to the URL.
- Desktop (≥ 768 px wide) shows the pane's Cockpit section; phone width shows Board · Cockpit.

**What fixture mode does:**
- It bypasses the status check and every reader.
- It feeds in-memory records of the stored shape (Amendment C fields, `mintedMode: 'on'`), timed in today's quarter-hour slots so deadlines are live.
- It never reads the call records and never POSTs. The rest of the screen is live.

**Coverage map:**

| Spec rows | In the smoke |
|---|---|
| §7.3 the answer matrix | every row, on both shells. The buttons come from the shared legality table, as in production |
| §7.4 every state tag | Live, Filed · not yet heard, You agreed, Acted, Replaced by a later answer, No matching trade, Heard, Battle ended, Expired, Hit, Acted at…, Dropped |
| §8.3 every refusal line | a tap on any button of a Needs-you tile returns that tile's row: AAPL 409 `already_answered` · AMD 409 `expired` · AMZN 409 `parent_not_active` · AVGO 409 `belief_mismatch` · CRM 409 `directive_pending` · CRWD 409 `budget` · GOOGL 429 · INTC 404 `cockpit_unavailable` · META 400 · MSFT 403 · MU 401 · NFLX 500 · NVDA no response · ORCL 200 (accepted; the tile does not change, with no optimistic state) |
| One call at a time | `=pending`: an unheard call directive in the slot (overrides disabled, the spec's line). `=heard`: heard, still disabled until it expires (HEAD's endpoint rule), "stays active" line |
| The check-card link and its missing-card line | calls name the battle's own newest checks; one names a check not in the chat |

**jsdom probe of the fixture mode at `d58fb39e`:**
- **Desktop:** 28 tiles, 14 in Needs you, every tag above present.
- **Phone:** the same.
- No cockpit-status request.

---

## 10. §13: what the build changes for activation (none of it is done here)

1. **Merging this PR changes nothing for players:** the flag-off render is byte-identical (§6.3), and no request or listener opens with the flag off.
2. **Publish the owner-read rules** for `calls` / `declarations` / `callEvents` / `callObservations` before lighting anything (spec §13, step 3). Until then a lit reader shows the read-error line, never "No calls yet" (L3-2).
3. **Allowlist:** set `COCKPIT_ALLOWLIST_UIDS` in Vercel's production environment, then **redeploy production**. An env change does not reach the running deployment.
4. **The flips are their own PRs:** `CALL_RECORDS_MODE` → `'on'` and `COCKPIT_UI_ENABLED` → `true`. Each flag value moves with its pin.
5. **The rollback check after the flip:**
   - Have `COCKPIT_ALLOWLIST_UIDS` locally in `.env.local`; `vercel env pull` defaults to development, and an empty allowlist now answers `NO ALLOWLIST` with exit code 2.
   - Run `node scripts/shadow-read-call-records.mjs --rollback-check --since=<ISO instant of the flip PR's production deploy>`. Without `--since` it refuses to run.
   - **When it trips** (founder ruling Oct 4, this report's §13): only when all three bars hold — at least **60** calls-enabled model calls, a rate **above 3 %**, and a one-sided Fisher **p < 0.05** against round 3's qualified 1A-C rate, **7 of 386** (the live 'on' text's own). 4 of 60, 5 of 75 and 6 of 100 trip; 3 of 60, 4 of 75 and 5 of 100 do not (`rollbackRecipe.test.js` pins all six).
   - On `TRIP`: remove the uid from `COCKPIT_ALLOWLIST_UIDS`, redeploy production, and report (spec §10.4).
   - A rollback that only flips the UI flag is not the prescribed path (L3-9).

---

## 11. For the founder and the framework chat

*Oct 4: the founder ruled on every item below, and Amendment C revision 2 answers items 15–18. See this report's §13.*

**Founder rulings (the spec's text is binding; the build deviates or the text needs a fix):**
1. **§7.4 "Dropped · price line out of range" → bare "Dropped" (L6-4).** The call record carries no reason. `validate.js` can drop for `no_observation`, which the old tag would misstate, and the reason lives only in the declarations record's `minted[]`.
2. **§7.3 one-call-at-a-time wording.** HEAD's endpoint keeps a heard call directive pending until it expires. The buttons follow the endpoint; the line says "stays active until {t}" when the answer was heard.
3. **An agreement on an earlier wording (L6-2)** is shown as "You agreed · {t}, on the {t} wording", not as the newer wording's tag.
4. **Acted on an open call (L6-1):** §7.4 maps Acted only for a hit. The build tags any thread member's `outcome.actedEvalId` as "Acted at the {t} check". The flip writes that field only from a committed trade matching the whole call.
5. **§10.4 erratum:** removal is not "immediate". It takes a production redeploy.
6. **L6-11:**
   - (a) A chat or chip instruction that replaces a cockpit answer also reads "Replaced by a later answer".
   - (c) A killed thread keeps "Filed · not yet heard", which promises a hearing that cannot come.
7. **L4-10:** on a check that also swapped, "From the {t} check →" lands on the trade card. That is D-89's intended redirect, not the literal check card.
8. **L5-9:** the spec's `--ft-call-muted` alias (`text-muted`) reads 4.27:1 on a tile at 9.5–10.5 px. The build uses `text-secondary` for small muted text; the alias stays as specified.
9. **L6-10:** `copy.js renderIntentLine` has no consumer, and its exit wording omits the symbol. Retire it, or fix and adopt it.
10. **L3-8:** the flag-off main chunk grows +12,088 B (gzip +4.24 kB). The cockpit copy and `BoardCockpit` load eagerly for every user.
11. **L3-5:** "Battle ended" (§7.4) cannot show. The cockpit needs an active battle, and `ended_with_battle` is written only once the battle is not active (§4 vs §7.4).
12. **L3-6:** after a rollback, an open tab stays cockpit-on until a reload, a status change or a 404.
13. **N2:** the status endpoint's 404 for a missing battle vs 403 for another owner's reveals whether a battle exists. This matches `call-response.js`; no change.
14. **N1:** one battle cannot reach the 150-call sample bar in a five-session window, so the rollback check's power comes from pooling allowlisted battles. *Still true at the Oct 4 ruling's 60-call minimum (this report's §13): an agent battle lasts one trading day (`api/_utils/agentBattleService.js`, `fullday`) and the evaluate cron runs at most 36 times a weekday (`vercel.json`), so one battle gives at most 36 calls.*

**At the amendment's blessing:**

15. **C-1's parenthetical** ("in the universe … de-duplicated") misdescribes HEAD's `declarations.watching` rules (L1-4). Correct the text, or rule the checks in; ruling them in would change shadow/on records.
16. **C-3 changes model-visible text** beyond spec §0's list (L1-5 / L2-2):
    - an unusable counterpart drops from the `call_go` / `call_hold` text ("…exit for TBD." → "…exit.");
    - `planFlip`'s acted match no longer requires the named counterpart;
    - an entry with a not-held counterpart becomes `go_now`-eligible;
    - "Acted" on an "X or Y" counterpart now fires for a trade that brought in neither.
17. **C-3's general clause** ("that the swap could bring in") would also exclude watchlist-only and stock↔crypto counterparts, which the swap refuses. They are not enumerated, so the build keeps them usable.

**For the framework chat:**

18. **C-6's key** (day, symbol, direction, slot, side, 1 %) ignores `defaultAction`. A Confirmation the player agreed to can fold with a later hold-default called shot. Add `defaultAction` to the key.
19. **L2-1:** the live 'on' tool text (S-8, byte for byte) tells the model the player reads fork sentences, picks one, sees `playerAsk` and "can answer" every call. 2a shows none of that, and upside calls take no answer. Fix it in the next model-visible revision.

---

## 12. Where things are

- **This report:** `docs/audits/20261003_BUILD2A_COCKPIT_SCREEN.md`. **Out-of-repo copy** (BUILD_RULES §3): `…/scratchpad/20261003_BUILD2A_COCKPIT_SCREEN.md`.
- **Review repros:** the reviewers' scratch files under the session scratchpad (`review/V1…V5`).
- **The battery:** `mutation/battery.mjs`, `mutations.json`, `out/results.json`; the follow-up runs are in `kill/`.
- **The PR:** opened from `claude/cockpit-build2a-screen` to `main`. No merge, no flip, no CI watching.

---

## 13. Founder rulings (Oct 4)

**PR #928 merged before this polish.** It merged at `74e00a86` (merge commit `23842a83`, Oct 4, 16:05 CDT). The polish commits sit on `claude/cockpit-build2a-screen` above that head, `321e1ab2` to this section's commit.

### 13.1 In one table

| What | Result |
|---|---|
| Rulings recorded as approved | §11 items 1–5, 7, 8, 10–13 and 19 (§13.2); items 6 and 9 through changes 1, 2 and 4; changes 1–5 (§13.3) |
| Amendment C revision 2 | Committed byte for byte. The new pin is `4329b8f3…` (§13.4) |
| Changes 1–5 | Built, each with tests (§13.3) |
| BUILD_RULES §2 review | Required: the polish reached 10 files at `bd5f8e0c`, and 13 with the fixes. 4 lenses and 3 refuting verifiers. 15 findings: 10 CONFIRMED, 4 PARTIAL, 1 REFUTED; none MAJOR. 7 fixed, 1 settled by keeping the ruling's literal rule, 6 recorded for the founder and the amendment's blessing, and the refuted one needs nothing (§13.5) |
| Mutation battery | 27 of 27 at `bd5f8e0c`, then 32 of 32 after the fixes. Each mutation was killed by the rows written for it (§13.6) |
| Full suite and build | At the code head `57482715`: the failure set equals the base's, 16 files / 32 tests; `vite build` exit 0 (§13.7) |
| The flip | Prepared as a draft PR, one commit (§13.8) |

### 13.2 Approved as built (§11's items, now rulings)

| Ruling | What stands | §11 |
|---|---|---|
| Bare "Dropped" | The call record carries no reason, so the tag says only the fact | 1 (L6-4) |
| One override at a time follows the endpoint | A heard call directive keeps blocking until its deadline; the line says "stays active until {t}" | 2 |
| "You agreed · {t}, on the {t} wording" | An agreement given on an earlier wording is an answer line, never the newer wording's tag | 3 (L6-2) |
| Acted on any thread member | `outcome.actedEvalId` on any call of a thread is the thread's tag, "Acted at the {t} check" | 4 (L6-1) |
| Allowlist removal needs a production redeploy | The spec §10.4 erratum: an environment change reaches new deployments only | 5 |
| `text-secondary` for small muted text | The `--ft-call-muted` alias stays as specified | 8 (L5-9) |
| The check link lands on the trade card on a swap check | D-89's intended redirect | 7 (L4-10) |
| The +12 kB eager bundle | The cockpit copy and `BoardCockpit` load for every user | 10 (L3-8) |
| L3-5, L3-6 and N2 as they are | "Battle ended" cannot show; an open tab stays cockpit-on until a reload, a status change or a 404; the status endpoint's 404 vs 403 matches `call-response.js` | 11, 12, 13 |
| L2-1 deferred | The live 'on' text's description of features 2a hides is fixed in Build 2b's text revision, with a replay | 19 |

### 13.3 Changes 1–5

| # | Change | Commits | Tests |
|---|---|---|---|
| 1 | "Replaced by a later answer" becomes "Replaced by a later instruction", on the tag and on its receipt. Any later filing (chat, chip or cockpit) writes the `superseded` event, and the event does not say which (L6-11 a) | `426f9770` | The tag and receipt pins move; a new row files the replacement from chat and pins both lines |
| 2 | A filed directive no check has heard reads "Filed · not yet heard" only while it is still the battle's current one: the slot holds its thread, live, by the answer endpoint's own pending predicate (now one function, `liveCallSlotOf`). Killed, expired, suppressed or gone from the slot, it reads "Filed · not heard" (L6-11 c). A replacement whose event has loaded still reads "Replaced by a later instruction". Teal, like every state of the player's answer (ruling R2A-5). THIS TURN shows a call slot only while the same predicate holds it live (§13.5, P1-4) | `4a468f1d`, `57482715` | Model rows for every way out of the slot; four mounted rows in which the tile, THIS TURN and the one-call-at-a-time block read one predicate |
| 3 | Amendment C-6 rev 2: the thread key adds `defaultAction`, and a call without one never folds | `ca573ac4` | The key row; the reversed-default row, now two tiles; the missing-part row |
| 4 | `copy.js renderIntentLine` retired. Its only importer at HEAD was its own test file, and its wording dropped the call's own symbol (L6-10). The Build 1a spec's line carries a supersession note | `d6dc308e` | Its tests removed; one row pins that the module exports no intent renderer |
| 5 | `--rollback-check`: the minimum sample moves from 150 to 60 calls, and the baseline from 3/386 to 7/386, round 3's qualified 1A-C rate (the live 'on' text's own). The rate bar (> 3 %) and the one-sided Fisher p < 0.05 stay | `bd5f8e0c` | The six trip points: 3/60 no trip (p 0.139), 4/60 trip (0.047); 4/75 no (0.086), 5/75 trip (0.031); 5/100 no (0.078), 6/100 trip (0.032). The sample, rate and significance bars each on their own. The shadow-era repro, re-cut |

**Which bar bites under change 5 (pinned):**
- Against 7 of 386 the significance bar decides at every sample size from the minimum: the smallest count over 3 % is never significant from 60 to 1,000 calls.
- No count at or under 3 % is ever significant from 60 to 5,000 calls, so the rate bar stands behind the significance bar. Its own enforcement is shown on a quieter, synthetic baseline.
- The shadow-era repro (L1-1) moves from 11 to 12 invalid of 260, because 11/260 no longer trips (p 0.058). It now shows the floor's point directly: without the `2026-10-02` floor, one shadow session dilutes the trip away (13 of 390, p 0.13).

### 13.4 Amendment C revision 2

- Committed byte for byte at `321e1ab2`: SHA-256 `4329b8f3bf69575ea0562be08aaafb49cf697045b934769b882b39e3368d1e21`, 10,702 bytes, matching on the attachment and on the committed blob. This replaces §1's revision-1 pin (`7f56e4af…`).
- The review checked every sentence of revision 2 against the code. C-1 to C-5 are accurate. What the blessing should weigh is in §13.9.

### 13.5 The review (BUILD_RULES §2)

**Trigger:** 10 files on `74e00a86..bd5f8e0c`. The fixes took it to 13.

**Isolation:** each reviewer and verifier worked on its own `git archive` snapshot of `bd5f8e0c` (LF), with node_modules as a junction, read-only on git and on the working tree. Product files touched for a repro were restored byte-exact (SHA-256 checked).

**Ids:** this review's ids are P1-n to P4-n. The L1-n to L6-n ids elsewhere in this report belong to Build 2a's own review.

**Lenses (4):**
- **P1:** change 2's slot logic.
- **P2:** Amendment C revision 2 and change 3.
- **P3:** change 5's math.
- **P4:** copy and honesty, the retirement, test integrity, flag-off.

**Refuting verifiers (3).** Each was told to refute with an executed repro:
- **PV1:** P1-1, P1-3, P1-4, P1-5.
- **PV2:** P1-2, P1-6, P1-7, P4-4.
- **PV3:** P2-2 to P2-5, P3-1, P3-2, P4-5.

| Id | Sev. | Finding | Verdict | Disposition |
|---|---|---|---|---|
| P1-4 = P4-2 | MINOR | While cockpit-on, THIS TURN took the raw call slot, so an expired-but-unretired or killed directive showed as queued above a tile reading "Filed · not heard" (§9) | CONFIRMED (PV1, mounted) | **Fixed** (`57482715`): a call slot reaches the strip only while `liveCallSlotOf` holds it live. Flag-off is unchanged |
| P1-5 | NOTE | Nothing guarded the screen's slot wiring: `directive: null` passed every screen test | CONFIRMED (PV1: 635 tests pass under the mutation) | **Fixed:** four mounted rows |
| P1-6 = P4-6 | NOTE | The new row was muted (#6e7681 at 9.5 px, about 4.2:1). R2A-5 says teal for "filed", and spec §7.4 maps "directive filed, not heard" to teal | CONFIRMED (PV2) | **Fixed:** teal |
| P4-4 | NOTE | Two comments and one test title said a replaced directive reads "Filed · not heard". At 'on' every replacement writes its event in the same commit, so it reads "Replaced…" | CONFIRMED (PV2) | **Fixed** |
| P3-1 | MINOR | §2.1's trip rule and §11's N1 still stated 150 and 3/386; §10 cited a §13 that did not yet exist | PARTIAL (PV3): the stale lines are confirmed. "N1 is false at 60" is refuted: a battle lasts one trading day and the evaluate cron runs at most 36 times a weekday | **Fixed** in this section's commit |
| P3-2 | NOTE | "Floor" named both the session floor and the minimum sample | CONFIRMED (PV3) | **Fixed** |
| P4-5 | NOTE | The docs still carried the old copy, `renderIntentLine` and the open items | PARTIAL (PV3): the specs are byte-pinned and deviations go in this report (precedent); §9's table is accurate for the smoke build it names. The Build 1a spec's line and §11's open items are confirmed | **Fixed:** §11's opening note, this section, the Build 1a spec's supersession note |
| P1-3 | MINOR | "An empty slot means the directive left" is wrong while the battle and its calls arrive through separate listeners | PARTIAL (PV1): only retirement empties a call slot, confirmed. The mixed state rendering is refuted: one remote event, one React commit, 20 of 20 in headless Chromium. WebKit and Firefox untested | **Literal rule kept.** A deadline-gated "empty means current" variant was tried and withdrawn: under clock skew it says "not yet heard" for a slot the sweep already retired. The row is retitled and pins the retirement state |
| P1-1 = P2-1 = P4-3 | MINOR | C-6's "live directive answer" means a filed directive on an open call, not the slot's. A thread whose directive left the slot still offers no answer on its restated call, though the endpoint would accept both. Revision 2 dropped revision 1's definition without listing it | CONFIRMED (PV1: endpoint 200 on both) | **Recorded** (§13.9, 1) |
| P1-2 = P4-1 | MINOR | The tile reads the call's `heardEvalId`, which can lag the battle's evaluation stamp that the chat card reads. In the lag the tile says "Filed · not heard" while the chat says "Heard at …" | CONFIRMED (PV2). The lag predates the polish (before it, the tile said "not yet heard"); the polish changes the words for the left-slot part | **Recorded** (§13.9, 2) |
| P1-7 | NOTE | The `directive_pending` refusal line outlives the slot; the 60 s clock delays the flip | CONFIRMED (PV2). The refusal half is wider than claimed (up to about 90 s) and is new with the tag; the clock half predates the polish | **Recorded** (§13.9, 3) |
| P2-3 | NOTE | C-3's knock-on bullets misdescribe two mechanisms | CONFIRMED (PV3) | **Recorded** (§13.9, 5) |
| P2-4 | NOTE | "A heard call directive keeps the slot until its deadline" is too strong | PARTIAL (PV3): the chat and chip half is out of the bullet's scope (Amendment B.3); "until its deadline" stands corrected | **Recorded** (§13.9, 6) |
| P2-5 | NOTE | C-2 says "400 `illegal_answer` for every answer", but ask and keep answer 400 `deferred` | CONFIRMED (PV3; N5) | **Recorded** (§13.9, 7) |
| P2-2 | NOTE | C-6 defines threads by pairs, but the code folds the connected set | REFUTED (PV3): "belong … when" is a sufficient condition. With one tile per thread, the connected set is the finest partition C-6 allows (1,500 random sets) | No change |

**Checked and clean:**
- The `overrideBlockOf` refactor is behaviour-identical (the 512-row parity table).
- Thread ids are minted fresh for every filing, so a directive that left the slot can never re-match it.
- The client's live predicate matches what the cron hears.
- Change 1 is true for every writer.
- Change 4 has zero references left anywhere.
- With the flag off, every changed export is unreachable and THIS TURN's value is unchanged.
- Change 5's math was re-derived three independent ways (exact BigInt, scipy, `Fraction`), agreeing within 4.4e-14.
- Change 3 reads revision 2 correctly, and its rows kill every mutation tried.

### 13.6 Mutation battery

**Harness:** `battery2.mjs`. CONTROL runs first. Each mutation runs alone on a snapshot. A mutation counts as killed only when the rows written for it are among the tests that fail, read from the JSON reporter by full name.

**Runs:**
- **At `bd5f8e0c`:** 27 mutations over changes 1–5; all 27 killed by their own rows.
- **At `57482715`:** 32 mutations: the 27, re-aimed, plus P1-3's and the screen's THIS TURN and slot wiring. All 32 killed by their own rows; CONTROL was 210 tests green.

### 13.7 Tests and builds

On this Windows machine the suite runs on `git -c core.autocrlf=false archive` snapshots, as in §6.1.

| Tree | Exit | Test Files | Tests |
|---|---|---|---|
| base `4dfc48d9` (§6.1) | 1 | 16 failed · 829 passed · 6 skipped (851) | 32 failed · 17,320 passed · 87 skipped (17,439) |
| **code head `57482715`** | **1** | **16 failed · 847 passed · 6 skipped (869)** | **32 failed · 17,854 passed · 87 skipped (17,973)** |

- **The failure sets are identical**, file for file and test for test. The polish adds 18 tests (Build 2a's head had 17,955).
- **Ten workers** (`--maxWorkers=10`, on a tree read once beforehand). At the default parallelism the slowest film-tape files and one screen suite timed out (7 tests, every one "Test timed out in 5000ms"). Those four files pass alone, 153 of 153.
- **`vite build`** (the same snapshot): exit 0, with the same four pre-existing CSS warnings. The main chunk is 4,630,398 B (Build 2a's head: 4,630,984 B).
- **This section's commit is docs only.** The build and the suite on the exact pushed heads are reported with the PRs.

### 13.8 The flip, prepared as a draft

**Where:** branch `claude/cockpit-build2a-flip`, one commit on this polish's head, opened as a **draft** PR to `main`: "flip: cockpit on (allowlisted owners only)". Merge it only after this polish is on `main`, and only after `COCKPIT_ALLOWLIST_UIDS` is set in Vercel production.

**What the one commit changes:**
- `CALL_RECORDS_MODE = 'on'` and `COCKPIT_UI_ENABLED = true`.
- Both pins (`callRecordsFlags.test.js`, `cockpitUiFlags.test.js`). The UI flag's accessor row and registration row are turned around.
- The `DARK_BY_DESIGN` entry is dropped (`flagPinGuard.test.js`).
- The docstrings' "shipped" marker moves.
- The tests that pinned the pre-flip state. A dry run of the flip on this head found 23 tests in 6 files:
  - the two flag rows;
  - the reflections cron suite's "'off' (the live default)" row, now hermetic: the suite pins `CALL_RECORDS_MODE: 'off'` in its own flag mock, as the other cron suites do;
  - the cockpit screen suite's 7 off-path rows, which read the shipped accessor and now force it off;
  - 13 rows in the pane, layout and quote-availability suites (the unread marker, the character's bubble, the chat sheet, the faces' inputs), written against the cockpit-off screen. They now pin the accessor off. The lit-flag, server-says-off path stays covered by the cockpit suite.

**With the variable empty, every battle resolves 'off'** (`api/_utils/callRecords/mode.js`): no tool-schema change, no call records, no cockpit. Two things still change for everyone:
- **Every Battle View asks `GET /api/agent/cockpit-status` once**, and the server answers off. The chat's seen-marker waits for that answer, up to the 8 s timeout (L4-2).
- **The 15-minute call sweep opens its global gate.** It reads its cursor and pages its queue and the last seven days of battles. It skips every battle that resolves off, and it settles away queue rows whose battle no longer exists.

### 13.9 Open for the founder and the framework chat

1. **(P1-1) C-6's "live directive answer".**
   - Revision 2 dropped revision 1's definition, "(a filed directive whose call is still open)". The code still uses it.
   - So a thread whose directive left the slot offers no answer on its restated call, though the endpoint would accept both answers.
   - Choose: restore the definition (the code already conforms), or define "live" by the slot (a code change).
2. **(P1-2) One source for "heard".**
   - The tile reads the call's `heardEvalId`; the chat card reads the battle's evaluation stamps.
   - The call's stamp can lag until the next 15-minute sweep: the heard phase ends unconfirmed, a transport failure follows the prompt, or the phase is skipped on budget.
   - In that window the tile says "Filed · not heard" (before the polish, "not yet heard") while the chat says "Heard at …".
   - Choose: read one source, or use the server's own words, "not confirmed heard".
3. **(P1-7) The refusal line and the coarse clock.**
   - The `directive_pending` line ("…hasn't been heard yet. One call at a time.") can stand for up to about 90 s after the pending directive leaves the slot: the 30 s grace runs on the 60 s clock. The tile beside it then reads "Filed · not heard".
   - The 60 s clock can also keep "not yet heard", and the override block, up to 60 s past expiry.
4. **(P1-2 residual) "Not yet heard" after the last check.** It still shows for a current directive that no check can hear before its lifetime ends, for example one filed after the session's last check.
5. **(P2-3) C-3's knock-on bullets.**
   - `call_hold`'s text never names a counterpart; only `call_go`'s text changes.
   - Legality has no counterpart dimension. What changes is the eligibility guard `counterpart_not_held`, for both `call_go` and `call_hold` on an entry.
   - The `amendmentC.test.js` pin covers `call_go` only.
6. **(P2-4) "A heard call directive keeps the slot until its deadline."** A kill or an acted retirement ends it sooner. For a next_check call, the predicate runs 15 minutes past the deadline.
7. **(P2-5) C-2's "400 `illegal_answer` for every answer".** Ask and keep answer 400 `deferred` before the call is read (N5).
8. **`copy.js renderSaidLine`.** It has no consumer and lacks the upside exclusion: the same retire-or-fix choice as `renderIntentLine`.
9. **The event reader's window.** It keeps 150 events. A long-lived open call whose `superseded` event falls outside it reads "Filed · not heard" rather than "Replaced…".
10. **Line cites.** Revision 2's C-1 line cites have drifted: `agent-evaluate.js:2862` is now `:2866-2870`.

### 13.10 Founder rulings (Oct 5)

The founder approved the last fixes on Oct 5. They sit on `claude/cockpit-build2a-screen` above `88b93cc5`, from `f1fa317b` to this section's commit, and reach `main` through PR #930.

| What | Result |
|---|---|
| Amendment C revision 3 | C-6 defines a live directive answer by the slot. C-2, C-3's knock-on bullets, C-8 and the standing condition now state what the code does, each citing the tests that pin it. Every other byte of revision 2 is unchanged (`a6e372bb`, corrected by the review at `68dc3c89`) |
| C-6 rev 3 in the tile | A thread whose answer left the slot offers answers on its newest call again (`7df41399`). After the review, a live answer on any call of the thread holds it, and otherwise the tile shows the thread's most recent answer (`68dc3c89`) |
| The refusal line | Clears for good when its call resolves, is answered or leaves the feed (`26be3e35`). After the review, the prune reads the calls alone (`68dc3c89`) |
| `copy.js renderSaidLine` | Retired: still no consumer (`f1fa317b`) |
| Accepted as they are | The tile/chat "heard" lag; the flip's per-view status check; the sweep's skip pass |
| §13.9's items | 1, 5, 6, 7 and 8 resolved; 2 accepted; 3, 4, 9 and 10 still open |
| BUILD_RULES §2 review | Required: 11 files at `a6e372bb`, 15 with the fixes and this section. 4 lenses and 3 refuting verifiers. 23 findings after merging duplicates: 18 CONFIRMED, 5 PARTIAL, none refuted outright; none MAJOR after verification. 16 fixed (`68dc3c89`), 6 recorded for the founder, 1 needs nothing |
| Mutation battery | 18 of 18 at `a6e372bb`; 29 of 29 at `68dc3c89`. Each mutation was killed by the rows written for it |
| Full suite and build | On the exact pushed heads, reported with the PRs (this section's commit is docs only) |
| The flip | Rebased onto this head; still one commit, still a draft (#931) |

#### Amendment C revision 3

- **The file:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_C.md`. Written at `a6e372bb` and corrected by the review at `68dc3c89`: SHA-256 `1bc733ca76aa544302122be809c8ee83ef5d46904266e6d48dd80f648617312f`, 18,806 bytes (LF). Revision 2 was `4329b8f3…` (§13.4).
- **What changed, and only there:** the title and the date line, a "What revision 3 changes" list, C-2's answers bullet, C-3's three knock-on bullets, C-6's live-answer bullet, C-8's "Open for 2b" and the standing condition "One override at a time". A `git diff` against revision 2 has exactly these hunks.
- **Every cited test exists and pins its claim.** A script resolves each of the 36 quoted titles to exactly one row. The review added the five pins nothing covered:
  - `amendmentC.test.js` "rev 3 — the rest of each consumer";
  - `call-response.test.js` "an ACKNOWLEDGMENT on another call is accepted while a call directive is pending";
  - `api/agent/chat.test.js` "Amendment C rev 3: at ENFORCE and calls ON the call slot is LIVE";
  - `controlPromptRenderer.test.js` "a KILL writes the log and nothing else";
  - a suppressed slot in `cockpitModel.test.js`'s "C-6 rev 3" row.
- **Left as they are, since the ruling named the passages:** the header's Status ("Blessing gates the Build 2a merge", stale since #928 merged) and C-1's line cites (§13.9 item 10).
- **The 2a spec still says "every answer → 400 `illegal_answer`"** for an upside call (S-4, §11). Revision 3's C-2 governs. The spec is byte-pinned, as N5 and §13.9 item 7 recorded.

#### The code

| Ruling | What the code does now | Commits | Tests |
|---|---|---|---|
| 2a. C-6 rev 3 | `tileOf` (`src/screens/battleView/cockpitModel.js`): only a LIVE directive answer, on any call of the thread, holds the newest call's buttons back, and it is the answer shown. Otherwise the tile shows the thread's most recent answer: a directive answer as its tag and answer line, live or not; an agreement on an earlier wording as its answer line; the newest call's own answer as its tag | `7df41399`, `68dc3c89` | Model rows for each way out of the slot (killed, expired, suppressed, replaced by chat or by another call, emptied); an agreement after a left-slot directive, on both defaults; a third wording; an older member's live answer; the answer filed last |
| 2b. The refusal line | `staleRefusalIds` names every kept refusal no tile shows any more. The screen drops them through `useCockpitAnswer`'s `dropOutcomes`, only while the calls are read. A line that cleared because its call resolved, was answered, aged out or left the feed cannot come back | `26be3e35`, `68dc3c89` | One model row, one hook row, five mounted rows |
| 2c. `renderSaidLine` | Retired. Its only importer was its own test file. `SAID_UNVERIFIED_LABEL` stays: its one reader is the cockpit sheet, which shows a `said` only from the record's `saidOk` and never on an upside call | `f1fa317b` | Its tests removed; one row pins that no said renderer is exported |

**2b's scope, read literally.** A line clears when its own call's record changes state or response, or the call leaves the feed. Two cases stay outside it:
- **A `directive_pending` line whose blocking directive leaves the slot.** The refused call's record does not change, so the line still ages out on its 30 s grace, read on the 60 s clock (§13.9 item 3, still open). What did change: once aged out, it no longer returns when a block shows again. The block line says the same thing.
- **The agent acting on the refused call (Q2-4).** An acted stamp changes the record but is not in the ruling's list, so the line stays under "Acted …". Recorded for the founder.

#### Accepted as they are (founder, Oct 5)

1. **The tile/chat "heard" lag** (§13.9 item 2, P1-2). The tile reads the call's `heardEvalId`; the chat card reads the battle's evaluation stamps. For up to 15 minutes the tile can say "Filed · not heard" while the chat says "Heard at …". They converge by the next check.
2. **The flip's per-view status check** (§13.8). Every Battle View asks `GET /api/agent/cockpit-status` once, and the chat's seen-marker waits for the answer, up to 8 s.
3. **The sweep's skip pass** (§13.8). The 15-minute call sweep reads its cursor, pages its queue and the last seven days of battles, and skips every battle that resolves off.

#### §13.9's items, now

| # | Item | Now |
|---|---|---|
| 1 | C-6's "live directive answer" (P1-1) | **Resolved:** revision 3 defines it by the slot, and the tile follows (2a) |
| 2 | One source for "heard" (P1-2) | **Accepted** as it is |
| 3 | The refusal line and the coarse clock (P1-7) | **Open.** 2b does not reach it (above). The C-6 hold-back is now a third reader of the 60 s clock: for up to 60 s after a slot's lifetime ends, the tile withholds answers the endpoint would accept (Q1-6) |
| 4 | "Not yet heard" after the last check | **Open** |
| 5 | C-3's knock-on bullets (P2-3) | **Resolved:** revision 3 |
| 6 | "Keeps the slot until its deadline" (P2-4) | **Resolved:** revision 3's standing condition and C-8 |
| 7 | C-2's 400 code (P2-5) | **Resolved:** revision 3 |
| 8 | `renderSaidLine` | **Retired** (2c) |
| 9 | The event reader's window | **Open** |
| 10 | Line cites (C-1's `agent-evaluate.js:2862`) | **Open:** revision 3 changed only the passages the ruling named |

#### The review (BUILD_RULES §2)

**Trigger:** 11 files on `88b93cc5..a6e372bb`; 15 with the fixes and this section.

**Isolation:** each lens and each verifier worked on its own `git archive` snapshot of `a6e372bb` (LF), with node_modules as a junction, read-only on git and on the working tree. Every mutated file was restored byte-exact (SHA-256). vitest's run-order cache (`node_modules/.vite/vitest/…/results.json`) is written through the junction by any run; nothing else under node_modules was.

**Ids:** Q1-n to Q4-n for the lenses, QV1 to QV3 for the verifiers.

**Lenses (4):**
- **Q1:** C-6 rev 3 in the code.
- **Q2:** the refusal line's lifecycle.
- **Q3:** revision 3 against the code, sentence by sentence, and its cites.
- **Q4:** breadth: the retirement, test integrity, honesty, flag-off, comments.

**Refuting verifiers (3).** Each was told to refute with an executed repro:
- **QV1:** Q1-1 to Q1-4, Q1-6, Q4-7.
- **QV2:** Q2-1 to Q2-7, with Q4-1 and Q4-4.
- **QV3:** Q3-1, Q3-2, Q3-5 to Q3-8, Q4-2, Q4-5 with Q1-5, Q4-6, Q4-8.

| Id | Lens sev. | Finding | Verdict (verifier's sev.) | Disposition |
|---|---|---|---|---|
| Q1-1 = Q3-3 = Q4-3 | MAJOR / MINOR / MINOR | Once a left-slot directive's thread offered answers again, an agreement on the newest call left the old directive as the tile's tag and answer line; the agreement showed only in the sheet's receipts. Every line was true of its record, but the one answer the tile stated was the opposite of the one just accepted | CONFIRMED, MINOR (QV1: 12 of 12 end to end, through the real endpoint) | **Fixed** (`68dc3c89`): the tile shows the most recent answer |
| Q1-2 = Q3-4 | MINOR / NOTE | Only the newest filed directive was tested for live. With an older member's directive live and a newer one's gone, the thread offered an agreement and showed the replaced answer, while THIS TURN showed the live one | CONFIRMED, MINOR (reachable from tiles alone; Q3-4's "stale client only" refuted) | **Fixed:** any member's live answer holds the thread |
| Q1-3 | MINOR | The rev 3 row had no "replaced by another call's live directive" case; a mutant holding every filed thread back while any call slot was live survived 840 tests | CONFIRMED, MINOR | **Fixed:** the case is in the row |
| Q3-1 | MINOR | The chat rows cited for "replaces a live call directive" run at integrity 'off', where the slot is suppressed, so not live; a chat that refused a live slot passed 325 tests | CONFIRMED, MINOR | **Fixed:** a row at 'enforce' with calls on, now cited |
| Q4-2 | MINOR | "Legality has no counterpart dimension" was pinned for one fixture; a counterpart dimension on confirmations or on act-default exits survived 1,234 tests | CONFIRMED, broader, MINOR | **Fixed:** the row covers every default, direction and kind |
| Q2-1 | MINOR | The prune waited for all three reads, though a refusal line reads only the calls: with the sheet open across a failed events or declarations read, an old line came back after a fold and a resurface | CONFIRMED, NOTE (it needs one listener refused while the others are served) | **Fixed:** gated on the calls read; a mounted row |
| Q2-2 = Q4-4 | MINOR / NOTE | No row pinned the read guard | CONFIRMED, NOTE (Q4-4's recheck example refuted: a recheck never restarts the readers) | **Fixed:** a mounted row (the readers restarting) |
| Q2-3 = Q4-1 | NOTE / MINOR | The mounted "answered" row cannot fail without the drop; the case where the drop matters most, an aged-out `directive_pending` line returning under a later block, had no screen row | CONFIRMED, NOTE | **Fixed:** that row; the answered row's title says what it pins |
| Q3-2 = Q4-9 | MINOR / NOTE | "not suppressed (integrity mode not 'enforce')" reads two ways | PARTIAL, NOTE (ambiguous, not backwards) | **Fixed:** reworded; "Live means" lists every condition |
| Q3-5 | NOTE | C-2 omitted the repeat and `already_answered` checks that come first | PARTIAL, NOTE (unreachable on an upside call) | **Fixed** |
| Q3-6 | NOTE | "A kill ends its liveness without clearing it" was unpinned: a kill that cleared the slot passed 1,377 tests | CONFIRMED, NOTE | **Fixed:** a pin |
| Q3-7 | NOTE | Comments, test titles and report lines still said a heard directive blocks "until it expires" | CONFIRMED, NOTE | **Fixed** in the code and the titles; the report lines are noted in §13.11 |
| Q3-8 | NOTE | Six wording points | PARTIAL, NOTE (item 1 refuted) | **Fixed** (items 2–5); item 6, the header's Status, is noted above |
| Q4-5 + Q1-5 | NOTE | Touched docblocks that no longer matched the code | PARTIAL, NOTE ((c) refuted) | **Fixed** |
| Q4-6 | NOTE | `overrideBlockOf`'s docblock said "until it expires" | CONFIRMED, NOTE | **Fixed** |
| Q4-7 | NOTE | Two titles said "live directive" with no slot | CONFIRMED, NOTE (QV1: retitle, do not add a slot, or the acted guard goes unguarded) | **Fixed** |
| Q1-4 | NOTE | A tile can show its own "You said hold off …" beside "Waiting · your last answer hasn't been heard yet.", which is about another call's answer | CONFIRMED, NOTE (dense, not false) | **Recorded** for the founder: the block line could name the pending call |
| Q1-6 | NOTE | The C-6 hold-back runs on the 60 s clock | CONFIRMED, NOTE (it errs on the safe side) | **Recorded** with §13.9 item 3 |
| Q2-4 | NOTE | When the agent acts on a refused open call, the line stays under "Acted …"; a "try again" line can also stand on a tile with no buttons past the deadline | CONFIRMED, NOTE | **Recorded** for the founder: does an acted stamp count as "the record behind its tile changes"? |
| Q2-5 | NOTE | A refusal that lands after its call folded is never shown, and is now dropped at once. "Sending…" and then no line predates the round | CONFIRMED, NOTE | **Recorded:** within the ruling (the call left the feed) |
| Q2-6 | NOTE | An in-place battle switch through a cockpit-on battle drops the first battle's lines; through a cockpit-off one it keeps them | CONFIRMED, NOTE (no UI path found for an in-place switch) | **Recorded** |
| Q2-7 | NOTE | `26be3e35`'s message gives no before-and-after for the aged-out `directive_pending` line | PARTIAL, NOTE | **Recorded** here (2b's scope) |
| Q4-8 | NOTE | Two `copy.test.js` titles carry rationale their rows do not assert | CONFIRMED (literal), no action | **No change:** the Oct 4 `renderIntentLine` precedent |

**Outside the round, for separate tasking (QV1's aside).** The deadline guard (L6-7) also reads the 60 s clock. Up to 60 s behind a call's deadline, the tile still offers both answers, and the endpoint refuses them with 409 `expired`.

#### Mutation battery

The harness is `battery2.mjs`, as in §13.6: CONTROL first, each mutation alone on a snapshot, killed only when the rows written for it are among the failures.
- **At `a6e372bb`:** 18 mutations (2a ×5, 2b ×6, 2c ×2, revision 3's pins ×5). All 18 killed by their own rows; CONTROL was 281 tests green.
- **At `68dc3c89`:** 29 mutations: the 18, re-aimed at the fixed code, plus 11 for the review's rows (P01 to P11, including QV3's two legality mutants). All 29 killed by their own rows; CONTROL was 420 tests green.

#### Tests and builds

This section's commit is docs only. The suite and `vite build` on the exact pushed heads of #930 and #931 are reported with the PRs, as in §13.7.

### 13.11 What else changed in this report

- §2.1's trip-rule line, §10 item 5 (when it trips), §11's opening note, and §11 item 14 (N1 is still true at 60).
- §9's smoke coverage table is accurate for the smoke build it names, `2f2accb2`. The rebased smoke shows the new copy:
  - "Replaced by a later instruction".
  - `?cockpitFixtures=1`: the unheard QCOM answer reads "Filed · not heard", because no slot holds it.
  - `=pending`: the same answer reads "Filed · not yet heard".
- **Out-of-repo copy** (BUILD_RULES §3): `…/scratchpad/20261003_BUILD2A_COCKPIT_SCREEN.md`, in this session's scratchpad.
- **The review's scratch files:** `…/scratchpad/review/` (`L1`–`L4` for the lenses, `V1`–`V3` for the verifiers, each with its `review-scratch/`), and `battery2.mjs` with `mutations.json` and `mutations3.json` beside it.
- **Superseded by revision 3 (Oct 5):** the Oct 3–4 lines that say a heard call directive blocks "until it expires" or "until its deadline": §3's deviations table, §9's smoke table, §11 item 2 and §13.2 ruling 2. They stand as the record of their dates; revision 3's standing condition states what the code does.
- **The Oct 5 review's scratch files:** `…/scratchpad/review-oct5/` (`Q1`–`Q4` for the lenses, with `Qn-findings.md`; `V1`–`V3` for the verifiers, with `Vn-verdicts.md` and `Vn-work/`), and `mutations4.json` and `mutations5.json` with `battery4.log` and `battery5.log`.
