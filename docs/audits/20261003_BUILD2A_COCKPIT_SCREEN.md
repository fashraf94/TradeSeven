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
  - **Trip rule:** trips only at ≥ 150 calls, a rate above 3 %, and a one-sided Fisher p < 0.05 against 3/386.
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
   - On `TRIP`: remove the uid from `COCKPIT_ALLOWLIST_UIDS`, redeploy production, and report (spec §10.4).
   - A rollback that only flips the UI flag is not the prescribed path (L3-9).

---

## 11. For the founder and the framework chat

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
14. **N1:** one battle cannot reach the 150-call sample bar in a five-session window, so the rollback check's power comes from pooling allowlisted battles.

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

- **This report:** `docs/audits/20261003_BUILD2A_COCKPIT_SCREEN.md`. **Out-of-repo copy** (BUILD_RULES §3): `C:\Users\fashr\AppData\Local\Temp\claude\C--Users-fashr-portfolio-duel\ff2b1fea-5396-449d-a63c-cfd4ce540dae\scratchpad\20261003_BUILD2A_COCKPIT_SCREEN.md`.
- **Review repros:** the reviewers' scratch files under the session scratchpad (`review/V1…V5`).
- **The battery:** `mutation/battery.mjs`, `mutations.json`, `out/results.json`; the follow-up runs are in `kill/`.
- **The PR:** opened from `claude/cockpit-build2a-screen` to `main`. No merge, no flip, no CI watching.
