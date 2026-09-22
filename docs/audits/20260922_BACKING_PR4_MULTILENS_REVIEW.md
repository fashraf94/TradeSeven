# Backing Beta PR 4 — multi-lens adversarial review record

**Branch:** `backing/pr4-screens` · **Reviewed commit:** `51ac1bb` (the build) · **Fix commits:** `34b51ef` (the four lenses' findings), `14c1920` (the mutation lens's four blind rows), `d537342` (Refuter A's residuals and new findings), `0e65bba` (Refuter B's) · **Base:** `main` at `463a375`
**Commit identity:** after the review, the five commits were re-authored to Claude <noreply@anthropic.com> (the repository's commit-verification hook); the trees are byte-identical to the reviewed ones (the review snapshots were cut from those same trees), so the shas cited throughout are the re-authored ones: build `51ac1bb` (reviewed as `c0424fd`), fixes `34b51ef` (was `883b68d`), `14c1920` (was `f2d11b0`), `d537342` (was `805e673`), `0e65bba` (was `80cf123`).
**Rule:** BUILD_RULES §2 — review is mandatory at ≥10 files or ≥1,500 lines (this branch: 65 files, ~7,200 lines at `51ac1bb`). Multi-lens, adversarial, independently refuted, `vite build` run explicitly, mutation-checked, written down here.
**Reviewer isolation (founder ruling, Sep 2, 2026):** every reviewer worked on its own `git archive <sha>` extraction under the session scratchpad with `node_modules` symlinked, read-only on git and on the shared working tree. One extraction per reviewer, path-distinct; the mutating lens ran last, on its own tree cut from the fix commit.

## 1. Scope

Backing Beta V1.3 §5 / §12 PR 4 as amended by Amendments A and B: the landing strip, the pod list (Surface A), the team card (Surface B) with its server projection, the stake control (Surface C) with the attestation step, Your Backing (Surface D), the scouting pitch (endpoint, rules, two edit homes), the derived-line module, the copy module and its guard, the dark pin, and the design references. Everything behind `BACKING_BETA_ENABLED = false`.

Not in scope and not reviewed as this PR's: Surface E, private/trainer stats, telemetry, the refund primitive, pool/stake/settlement logic (PR 1–3), bracket activation, the fenced files (none touched).

## 2. Method

| Lens | Brief | Tree | Agent |
| --- | --- | --- | --- |
| SEAL | Founder's brief: "leak the sealed pool through the UI" — ordering, emphasis, animation, relative sizes, counts above three, anything inferring a per-team position while open | `lens-seal` (51ac1bb) | 1 read-only reviewer |
| FABRICATION | Founder's brief: "find fabricated data" — fixture tape, invented derived clauses, placeholder copy passed off as real | `lens-fabrication` (51ac1bb) | 1 read-only reviewer |
| DARK | The flag-off guarantee: byte identity per host, no new read or request while dark, call-time reads, the routes' 404-after-auth, vacuity of the dark rows, the ratchets, §10/§11 | `lens-dark` (51ac1bb) | 1 read-only reviewer |
| DOMAIN | Domain correctness and wiring end to end: the projection, the pitch route, the hooks' lifecycle, the stake control against the endpoint, Your Backing, the strip derivation, the mounts, §1/§4/§9/§10/§11 | `lens-domain` (51ac1bb) | 1 read-only reviewer |
| MUTATION | The six required mutation checks plus vacuity probes of the rows the fixes added | `lens-mutation` (34b51ef) | 1 mutating reviewer, last |
| REFUTATION | Every SEAL/FAB finding (Refuter A) and every DARK/DOM finding (Refuter B) handed over with the instruction to refute it with a concrete repro on the original tree, then to verify each fix on the fixed tree | `refute-a`/`refute-b` (51ac1bb) + `fixed-a`/`fixed-b` (34b51ef) | 2 reviewers |

Seven agents in total. Each reviewer's report is reproduced in substance below; the full reports are in the session transcript.

## 3. Findings and dispositions

Severities as the lenses gave them. **Disposition** is the coordinator's; the refutation verdicts are in §5.

### SEAL lens — 6 findings (0 blocker / 0 major / 1 minor / 5 notes)

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| SEAL-1 | MINOR | `deriveStripState` put a live stake into the WEEK/standing state whenever its pool document was null and its pod not listed, ranking a pod that had not battled (seat order as a rank, `+0.0%`). Production was safe only indirectly (the week-key split). | **FIXED** — an unknown pool is skipped; a standing needs a banked close (`backingStripState.js`; rows added to `backingStripState.test.js`). |
| SEAL-2 | NOTE | The client reads a dev pod's pool at `backingPools/{groupId}` while the writer keys it `dev-{groupId}`; the pod list excludes dev pods for every viewer, so the §11 gate-4 smoke cannot be driven through this UI. | **RECORDED** — needs the server listing change too; the activation PR's item. |
| SEAL-3 | NOTE | The rules comment above the pool block still describes the pre-Amendment-B open state (pre-existing on `main`). | **RECORDED** — the rules file is untouched beyond `teamPitches`. |
| SEAL-4 | NOTE | The backers-call sub-line worded the spread signal more explicitly than §B6 (information-equivalent). | **FIXED** with DOM-3 — the open pool now renders §B6's `POOL_STRIP` lines verbatim. |
| SEAL-5 | NOTE | The revealed-status set exists on both client and server (they agree; the divergence direction is safe). | **RECORDED.** |
| SEAL-6 | NOTE | Seats carry the League's ambient orb motion; identical for every seat, driven by nothing pool-related. | **RECORDED** — the League's own motif. |

Clean (verified by the lens, with citations in its report): the public pool document while open carries exactly the capped pair and the close; the cap has one implementation; the freeze is a property of the document (public writes only when the capped values move); the stake reply and every refusal payload carry only own/public facts; the team-card projection returns no pool key; every client subscription is owner- or authed-read as the rules grant; no animation, count-up or proportional width exists in the new files; the copy module names no pot, share, pays × or count above three outside the revealed formatters.

### DARK lens — 6 findings (1 blocker / 1 major / 1 minor / 3 notes)

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| DARK-1 | **BLOCKER** | `EquipStation.jsx` mounted the dark `ScoutingLine` inside an unconditional `<div style={{ marginTop: 12 }}>`: an empty 12px element while dark, a 12px shift of every section below it on the mobile Command Dashboard (measured in Chromium: `#cmd-equip` 218 → 230px). The other five mounts were byte-identical to main. | **FIXED** — mounted bare; the lit line carries its own margin in compact mode. |
| DARK-2 | MAJOR | No dark row could fail under DARK-1: the flag-off rows were substring-absence checks, the flag-on-minus-strip equality cancels an element present in both states, and no test rendered EquipStation. | **FIXED** — `backingDark.test.jsx` renders EquipStation flag off and on, and holds every host mount BARE at the source (an element opened right before the mount and closed right after it reds). Run against the unfixed tree first: both new rows red on EquipStation (§4, check 7). |
| DARK-3 | MINOR | The importer ratchet enumerated importers of the constants and the api helpers only; no row covered the hooks, the service or the components. | **FIXED** — `backingBetaFlags.test.js` enumerates the hosts of the three gated mounts and of the service by exact list, and sweeps every backing module's outside importers against the host set. |
| DARK-4 | NOTE | The flag's FLIP-MAP docstring omitted `POST /api/team/pitch`. | **FIXED** (docstring). |
| DARK-5 | NOTE | `BackingScreen` carried no flag read; correct today (only the strip can open it), fragile for a future direct mount. | **FIXED** — an outer gate reads the flag at call time; the inner component owns the hooks; the call-time row lists the file. |
| DARK-6 | NOTE | The §10/§11 guard lists do not cover the new files (they hold anyway: zero raw hex, zero inline transition literals). | **RECORDED** — the guarded-file list expands by a deliberate decision, not in a surface PR. |

Clean: LeagueHome, LeagueLobbyDesktop, PodCard and IdentityPanel byte-identical to reconstructed `main` under the lens's harness; every hook opens its read only inside an effect gated on `enabled`; the service has no module-evaluation side effect beyond the `firebase/config` import every League service already carries; both routes climb security → method → auth → flag 404 → validation → Firestore, matching the PR 1–3 and SHOW_IT shape, with the dark suite mocking the flag to an explicit false and asserting zero Firestore touches; the only hardcoded flag pins are pre-existing.

### FABRICATION lens — 17 findings (0 blocker / 4 major / 7 minor / 6 notes)

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| FAB-1 | MAJOR | "Your stakes have settled" / "Settled" derived from `group.status === complete`, while a pool can sit unresolved after the week (held, or a settlement error — spec §7). | **FIXED** — settled is the pool's status (or the stake's); a complete pod with an unresolved pool reads "settling" on the strip and the card. |
| FAB-2 | MAJOR | Surface D's "This week · drafted Monday" showed the current day's battle `initialPortfolio` (each weekday's battle opens on the prior close) and the current roster after claims. | **FIXED** — retitled "This week · both layers / What X and Y hold"; the current book is the source; per-layer pending copy. |
| FAB-3 | MAJOR | The CPU card said the house drafts three "from the archetype template"; the three come off a fixed ranked-pool board with no archetype input, only the six use the archetype's rankings. | **FIXED** — copy states what the house does. |
| FAB-4 | MAJOR | The first-week body "The three-stock draft lands Monday — after this pool closes." is false for slot pods, which draft at the fire. | **FIXED** — branches on the pod's formation path; Your Backing's pending/awaiting copy reworded. |
| FAB-5 | MINOR | "The why · in their agent's words" headed a rationale that can be a guardrail or risk-manager note; the WHAT projection withholds which. | **FIXED** — "The why · as recorded on the trade". |
| FAB-6 | MINOR | An absent or empty draft record marked every roster name "Claimed". | **FIXED** — no record → `drafted: null`; "claimed" only from a claim record; "On the roster at close" otherwise. |
| FAB-7 | MINOR | The agent's "drafted six" fell back to the closing portfolio. | **FIXED** — no opening book → `drafted: null` picks from the closing book ("In the book at close"). |
| FAB-8 | MINOR | The CPU seat carried "contents private · may change nightly". | **FIXED** — no loadout marker on a CPU seat. |
| FAB-9 | MINOR | "Day N of 5" is the calendar weekday, not banked closes (a holiday Monday reads "Day 2 of 5" over zero stops). | **RECORDED** — the day is the battle week's weekday by design; the rail shows banked stops separately; complete-but-settling now has its own sub-line. Refuter A's ruling in §5. |
| FAB-10 | MINOR | The allowance displayed 1,000 when the wallet subscription errored or had not loaded. | **FIXED** — a `known` flag; unknown → "Reading your points…", no figure, no control. |
| FAB-11 | MINOR | "Backed" was asserted from the HTTP reply with a request-amount fallback. | **FIXED** — a reply without `stake.amount` is a failure; the pod list re-reads the ledger after success. |
| FAB-12 | NOTE | `lastWeek.placement` recomputed rather than read from the recorded placement. | **FIXED** with DOM-4. |
| FAB-13 | NOTE | "FIRST WEEK · no tape yet" keyed on tape absence, not on the record. | **FIXED** — first week = no tape AND no completed week; otherwise "No tape on file". |
| FAB-14 | NOTE | `rp` defaulted to 0 → "0 RP". | **FIXED** — null → dash. |
| FAB-15 | NOTE | "Full film room" lands on the pre-existing fixture-laced Spectate (`REASONING` map, rivalry copy). | **RECORDED** — Amendment A §A7 item 3, the §11 gate-3 item; not this PR's code. |
| FAB-16 | NOTE | Loose copy: "N more and this pool plays", "Closes when the pool closes", "Confirm 0 BP", "Pot 0 BP · 0 backers" on a refunded pool, the Predictions label on current-week pods. | **FIXED** except the Predictions label (rev3 §1 mandated). |
| FAB-17 | NOTE | The harness fixture used a sector outside `COMPANY_SECTORS`' vocabulary; the README could say "invented" plainly. | **FIXED.** |

Clean: no backing file, hook or service imports the fixture modules; `isFixtures` is never read on the backing path; `fetchTapePod` is real data only; `deriveWeekLine` requires sector data for every held name and no tie before "leaned", both lists before "Held n of m", both integer counts before "moves"; every day label comes from a recorded timestamp; `lastCompletedWeekFor` requires complete + base-layer + banked + the pod's namespace; the attestation step is visibly marked draft while `TERMS_VERSION` ends in `-draft`; the disclosures and fine print render verbatim; no client reads `agents`.

### DOMAIN lens — 14 findings (0 blocker / 1 major / 6 minor / 7 notes)

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| DOM-1 | MAJOR | A live stake on a slot pod whose pool closed at its fire (Wed/Sat/Sun) was invisible to the strip and Your Backing until Monday: the in-play read was keyed to the current week only and the STAKED state was built from open pools only. | **FIXED** — `useMyBacking` reads both week keys; listed pods with open or closed pools carry the viewer's stakes; the strip reads "Closed · plays Monday" / "locked"; Your Backing shows the locked card. |
| DOM-2 | MINOR | The diversifier's canonical disposition "Spreads the bets so no single one can sink you." reached the card as the approach line (and every Quick-Play pod's third CPU is a diversifier). | **FIXED** — the projection emits an approach only when it passes the backing lexicon (word-start match on `FORBIDDEN_TERMS`); the diversifier's line is omitted, not rewritten. **Founder decision needed:** a backing-safe canonical line for the diversifier. |
| DOM-3 | MINOR | Amendment B §B6's `POOL_STRIP` strings (shipped in PR 1 for PR 4 to render) were not rendered; the open pool spoke the copy module's prose. | **FIXED** — `BackersCall` renders them verbatim. |
| DOM-4 | MINOR | The finish was re-derived from `players[]` order while "Last 3 wks" read the recorded placement — two sources for one fact. | **FIXED** — the recorded placement (`appliedGroups` / the history event); null when unrecorded. |
| DOM-5 | MINOR | = FAB-2. | **FIXED.** |
| DOM-6 | MINOR | Your Backing listed voided stakes as plain "Backed" rows. | **FIXED** — "· void" / "· settled" beside the amount. |
| DOM-7 | MINOR | The display name came from two sources (the pod's `seatNames` on the row and the strip; a live `users` read on the card). | **FIXED** — the card uses the pod's seat name first. |
| DOM-NOTE-1 | NOTE | With `BACKING_BETA_ENABLED = true` and `ELIGIBILITY_ATTESTATION_ENABLED = false` the control blocks at the step. | **RECORDED** — the flip PR flips both (spec §12); noted for the smoke. |
| DOM-NOTE-2 | NOTE | = SEAL-2. | **RECORDED.** |
| DOM-NOTE-3 | NOTE | Bracket-game rank events would count as weeks and spend the lookback (inert: no production round-1 writer). | **RECORDED.** |
| DOM-NOTE-4 | NOTE | `useTeamCard.refresh` docstring promised a caller that does not exist. | **FIXED** (docstring). |
| DOM-NOTE-5 | NOTE | The in-play week key was memoised once per mount. | **FIXED** — read each render. |
| DOM-NOTE-6 | NOTE | The pitch route accepts anonymous accounts (attest/stake refuse them). | **RECORDED** — a pitch is not a stake. |
| DOM-NOTE-7 | NOTE | `pitch.test.js`'s §4 comment named one of the two src imports. | **FIXED** (comment). |

Clean: no fenced file touched, no fenced function called; both routes' check order; seat resolution through the stake path's own derivation; the clone-excluding agent lookup; the projection's six fields; the draft-stream, claim-log, legs and trades shapes all match their writers; the response shape matches every field the client reads; the pitch normalisation order and the empty clear; the rules block and its emulator suite; the protected-store scanner passes without an allowlist entry; the tape link closes the desktop overlay before Spectate opens; the hooks' cleanup and the stale-reply drop; every refusal reason the stake endpoint returns has a sentence; the attestation version match; the mounts' placement; both pitch homes derive the uid from the viewer's own agent subscription.

## 4. Mutation checks

Run by the MUTATION lens on `lens-mutation` (34b51ef), each mutation applied to the snapshot's source, the named test file run, the file restored and re-run green. The six the founder required, then the vacuity probes of the rows the fixes added.

Each entry: the mutation → the row that reds, with its assertion. 34 mutations were run; 30 were caught by the rows as committed in `34b51ef`; the 4 that were not are closed in the final commit, each new row proved red under its mutation on a scratch copy before commit (§4.3).

### 4.1 The six the founder required

| # | Mutation (file · edit) | Test file | Result |
| --- | --- | --- | --- |
| 1 | `PodList.jsx` — render `pool.potTotal` inside the open branch | `PodList.test.jsx` | **REDS** "SEAL — MUTATION CHECK #1 …": `leaked "1200" while open: expected '…' not to contain '1200'`. Variants: formatted `uniqueBackers` → reds (`leaked "5 backers"`); per-team `stakeTotal` bare and formatted → reds (`leaked "700"`); **bare `String(pool.uniqueBackers)` and bare `String(pool.paysX)` → NOT CAUGHT at `34b51ef`** (the fixture's "5" had an innocent twin in the close time; "2.4" was only listed as "2.40") — closed, §4.3. |
| 2 | `deriveWeekLine.js` — a missing sector defaults to `'technology'`; separately, the every-held-name requirement dropped | `deriveWeekLine.test.js` | **REDS** "MUTATION ROW — a lean is never invented when sector data is absent or partial": `expected 'Held 2 of 3 all week · 4 moves · lean…' not to contain 'leaned'` (both variants). |
| 3 | `BackingLandingStrip.jsx` — `if (!BACKING_BETA_ENABLED) return null;` deleted | `backingDark.test.jsx`, `backingLanding.test.jsx` | **REDS, 6 rows**: the jsdom "a mounted landing (effects running) opens NO backing read" (`expected <div …> to be null`), the source-literal row, and all four byte-equality rows of the landing suite. Observation recorded by the lens: the two SSR flag-off rows stay green under this mutation because `renderToString` runs no effects; the guarantee is carried by the mounted row, the literal row and the landing suite. |
| 4 | `backingCopy.js` — "No pods to back yet." → "No pods to wager on yet."; separately a JSX attribute string and bare JSX text in `TeamCard.jsx` | `backingCopy.guard.test.js` | **REDS**: `"wager" appears in src/components/League/backing/backingCopy.js …` plus the guard's own non-vacuity row; the two `TeamCard.jsx` plants red the per-file row (the directory walk covers component files). |
| 5 | `useTeamCard.js` — `collection(db, 'agents')`; separately `doc(db, 'agents', id)`; separately a template-literal `` `agents` `` | `TeamCard.test.jsx` | **REDS** "PROJECTION ONLY — MUTATION CHECK #5 …": `src/hooks/useTeamCard.js names the agents collection` — all three spellings. |
| 6 | (a) `BackingLandingStrip.jsx` returns `<div style={{ height: 120 }} />` while dark; (b) flag on, an empty `<div data-funnel-placeholder style={{ minHeight: 160 }} />` inside the slot above the strip; (c) `LeagueLobbyRedesign.jsx` wraps `{backingSlot}` in `<div style={{ marginBottom: 18 }}>` (both mounts, and each alone) | `backingLanding.test.jsx`, `backingDark.test.jsx` | (a) **REDS, 6 rows** (the literal row, the four byte-equality rows, the loading row). (c) **REDS** the source guard "LeagueLobbyRedesign.jsx mounts {backingSlot} bare — no host element of its own around it" for every variant — while the landing suite's byte-equality stays green, exactly the blind spot that row was added for. (b) **NOT CAUGHT at `34b51ef`** — `excise()` removes the whole slot, so a placeholder riding inside it cancels — closed, §4.3. |

### 4.2 Vacuity probes of the rows the fixes added

| # | Mutation | Test file | Result |
| --- | --- | --- | --- |
| 7 | DARK-1 wrapper re-introduced in `EquipStation.jsx` | `backingDark.test.jsx` | **REDS, 2 rows**: the EquipStation flag-off row (`not to match /<div style="margin-top:12px"><\/div>/`) and the bare-mount source guard (`<ScoutingLine is the sole child of a host <div>`). |
| 8 | DARK-5 — `BackingScreen`'s `if (!BACKING_BETA_ENABLED) return null;` deleted | `backingDark.test.jsx` + every file naming BackingScreen | **NOT CAUGHT at `34b51ef`** (207 tests green: the call-time row only required the token, the literal row covered the strip only, nothing mounted the screen dark) — closed, §4.3. |
| 9 | FAB-1 — `\|\| group?.status === COMPLETE` re-added to the settled test (strip and card) | `backingStripState.test.js`, `YourBacking.test.jsx` | **REDS**: "FAB-1: a complete pod whose pool has NOT resolved is settling — WEEK, never 'Last week banked'" (`expected 'between' to be 'week'`); "FAB-1: … reads Settling — never Settled" (`to contain '>Settling<'`). |
| 10 | DOM-1 — the listed-pod loop skips closed pools again | `backingStripState.test.js` | **REDS, 2 rows**: the two DOM-1 rows (`expected 'quiet' to be 'staked'`; `expected 1 to be 2`). |
| 11 | FAB-10 — `walletKnown = true` | `StakeControl.jsdom.test.jsx` | **REDS** "FAB-10: until the wallet's record has been read, nothing stakeable renders …" (`expected null not to be null`). |
| 12 | FAB-11 — the reply check dropped and the request-amount fallback restored | `StakeControl.jsdom.test.jsx` | **REDS** "FAB-11: a success reply that carries no stake is not 'Backed' …" (`expected <div data-backing="backed"…> to be null`). |
| 13 | DOM-2 — `approach: disposition` unconditionally | `api/tournament/team-card.test.js` | **REDS** "the approach is the canonical per-archetype copy — and ONLY when it passes the backing lexicon" (`expected 'Spreads the bets so no single one can…' to be null`). |
| 14 | FAB-6 — an absent draft record treated as `[]` again | `api/tournament/team-card.test.js` | **REDS, 2 rows** (`humanLayerFrom with no draft record …`; `a missing draft stream omits the drafted list …`). |
| 15 | Attestation-first gate removed | `StakeControl.jsdom.test.jsx` | **REDS, 3 rows** of "attestation first". |
| 16 | Fresh requestId — hoisted per mount; separately module-level | `StakeControl.jsdom.test.jsx` | **REDS** "a refusal shows the plain sentence, never 'Backed' — and the retry carries a NEW requestId" (`expected [ 'req-1', 'req-1' ] to deeply equal [ 'req-1', 'req-2' ]`), both forms. The lens notes the neighbouring "Confirm sends a FRESH requestId" row sees only the first id; the retry row is the guard. |
| 17 | DOM-4 — placement recomputed with `rankByScores` again | `api/tournament/team-card.test.js` | **REDS** "DOM-4: the finish is the placement the rank writer RECORDED …" (`expected 1 to be null`). |
| 18 | DARK-3 — an unused `import useMyPitch` added to a file outside the hosts | `src/config/backingBetaFlags.test.js` | **REDS** "every HOST that mounts a backing surface is enumerated …" (`src/components/League/LeagueDeskParts.jsx reaches src/hooks/useMyPitch.js from outside the enumerated hosts`). |

### 4.3 The four gaps, closed in the final commit

Each new row was run green on the working tree, then proved red under its mutation on a scratch copy of the tree (the copy restored and re-run green afterwards):

| Gap | New row | Proof |
| --- | --- | --- |
| 8 — BackingScreen's gate | `backingDark.test.jsx`: a jsdom mount of `BackingScreen` while dark renders `''` and opens no read, and lit it fetches the pod list; the `return null` literal row now covers `BackingLandingStrip.jsx`, `ScoutingLine.jsx` and `BackingScreen.jsx` | gate deleted → 2 rows red: `expected '<div data-backing="screen" …' to be ''`; `src/components/League/backing/BackingScreen.jsx returns null while dark: expected … to contain 'if (!BACKING_BETA_ENABLED) return nul…'` |
| 6b — a placeholder inside the slot | `backingLanding.test.jsx`: the slot's first child is the strip button (`/data-backing="strip-slot"[^>]*><button[^>]*data-backing="strip"/`), on the no-bracket and the bracket landing | placeholder inserted → both mobile rows red: `expected '<div style="position:relative;…' to match /data-backing="strip-slot"[^>]*><butto…/` |
| 1b — bare `uniqueBackers` | `PodList.test.jsx` seal row: distinctive planted figures (`uniqueBackers: 47`, `paysX: 3.7`, `teamsBacked: 4`) and the bare spellings `'47'`, `'3.7'`, `'3.70'`, `'47 backers'` on the visible text | `String(pool.uniqueBackers)` rendered while open → `leaked "47" while open` |
| 1d — bare `paysX` | same row | `String(pool.paysX)` rendered while open → `leaked "3.7" while open` |

## 5. Refutation pass

Every finding was handed to a refuter with the instruction to refute it with a concrete repro on the original tree (`51ac1bb`) and, where a fix was claimed, to verify it on the fixed tree (`34b51ef`). Both refuters ran their repros as scratch vitest suites (never a read-only opinion): Refuter A's 24 repro rows all reproduce the asserted defects on the original, its 28 verification rows all pass on the fixed tree, and it copied the fixed tree's six test files onto the ORIGINAL code — 35 rows red there, every fix-named row among them.

### 5.1 Refuter A — the SEAL and FABRICATION findings

| ID | Claim | Disposition verdict | Note |
| --- | --- | --- | --- |
| SEAL-1 | CONFIRMED | FIX-VERIFIED | Same inputs → QUIET; a closed pool in battle before any bank → WEEK with `rank: null, score: null`. |
| SEAL-2 | CONFIRMED (unreachable today: no production caller materialises a dev pool) | DISPOSITION-OK | The client half belongs with the server half in the activation PR. |
| SEAL-3 | CONFIRMED (pre-existing) | DISPOSITION-OK | Comment-only, outside the PR's rules diff. |
| SEAL-4 | CONFIRMED | FIX-VERIFIED | BackersCall rendered for count 0..3 × spread met/unmet: exactly the §B6 strings; one defence-in-depth residual → R-A-7. |
| SEAL-5 | CONFIRMED | DISPOSITION-OK | `POOL_STATUS` lives in the Admin-SDK module; after the FAB-16 fix the drift mode is an omission. |
| SEAL-6 | **REFUTED** as a seal concern | DISPOSITION-OK | The orb animates on `state` alone; no pool input reaches it; the brief bars animation *implying activity*. |
| FAB-1 | CONFIRMED | FIX-VERIFIED | A resolved pool is never "Settling" (verified both ways). |
| FAB-2 | CONFIRMED | FIX-VERIFIED | `portfolio` is on the battle view's public top level; one residual in the per-layer pending copy → R-A-2. |
| FAB-3 | CONFIRMED | FIX-VERIFIED | The new copy matches `buildCpuUserBoard` (ranked-pool slice) and the archetype-ranked six. |
| FAB-4 | CONFIRMED | FIX-VERIFIED | Residual on a CLOSED pool → R-A-6. |
| FAB-5 | CONFIRMED | FIX-VERIFIED | |
| FAB-6 | CONFIRMED | FIX-VERIFIED | Also through the route: no draft stream → `drafted: null`, `claimedIn` only from a claim record. |
| FAB-7 | CONFIRMED | FIX-VERIFIED | |
| FAB-8 | CONFIRMED | FIX-VERIFIED | |
| FAB-9 | CONFIRMED | **DISPOSITION-CHALLENGED** | The calendar reading is wrong in exactly the weeks spec §4 names (a holiday-short week banks its day 5 on the following Monday; Tue–Fri holidays too): the header and the rail disagree ~9 weeks a year. **Accepted — fixed in `d537342`:** the day is the pod's own banking record (`deriveCurrentTradingDay`, the League's reading), the calendar only while no pod document has been read. |
| FAB-10 | CONFIRMED | **FIX-INSUFFICIENT** | A third path: `allowanceLeft(wallet, weekKey)` returned the full allowance whenever `weekKey` was falsy — a known wallet with 200 left read "1,000" on the screen header until the pod list resolved the week. **Fixed in `d537342`:** an unknown week is unknown (`null` → "—" / "Reading your points…"), pinned by `src/hooks/useBackingWallet.test.js`. |
| FAB-11 | CONFIRMED | FIX-VERIFIED | A genuine replay reply still reads "Backed · … · Already recorded". |
| FAB-12 | CONFIRMED (handler-level: a recorded 2 rendered as 1) | FIX-VERIFIED | |
| FAB-13 | CONFIRMED | FIX-VERIFIED | |
| FAB-14 | CONFIRMED | FIX-VERIFIED | A real zero still reads "0 RP". |
| FAB-15 | CONFIRMED (NOTE) | DISPOSITION-OK | Pre-existing; the pre-flip gate-3 item. |
| FAB-16 | CONFIRMED | FIX-VERIFIED for every named string; the Predictions label DISPOSITION-OK (rev3 §1) | One UX residual → R-A-8. |
| FAB-17 | CONFIRMED (cosmetic) | FIX-VERIFIED | The agent picks' `sector` is never rendered; the lean clause reads `COMPANY_SECTORS` over the human's held names. |

**Refuter A's new findings, all accepted and closed in `d537342`** (each with a row that reds under it):

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| R-A-1 | MINOR | A holiday-short week's stakes dropped out of every read on the Monday that week banks day 5 and settles; its "Last week's result" state was unreachable (neither the current nor the window's key names it). | `backingWeekKeys(now, upcoming)` reads last week's key too; both mounts use it; the dark suite asserts one stake subscription per key. |
| R-A-2 | MINOR | "<agent> · six built Monday morning" asserted for any seat the battle view had no battle for — including the agent-layer-absent hold PR 3 models. | "<agent> · no book on file yet" — what is known, not when a book was built. |
| R-A-3 | MINOR | = the FAB-10 residual. | As above. |
| R-A-4 | MINOR | The DOM-1 fix dropped a listed pod whose pool is terminal (insufficient / refunded), or whose stake is voided, from the strip entirely (QUIET where the original read BETWEEN). | Every stake is classified by pool, stake and pod status; a terminal pool or a non-live stake is settled. |
| R-A-5 | NOTE | Monday before the list rolls, a listed pod already in battle read "Closed · plays Monday · locked". | The listed pod's `groupStatus` is read; in battle → WEEK. |
| R-A-6 | NOTE | The first-week body spoke of the draft as ahead of the close on a pool that had closed. | Branches on the pool's status. |
| R-A-7 | NOTE | BackersCall printed `count` raw when `met` was false — a shape the writer never produces, but "Backers 5 of 3" would print. | Clamped to the floor in the text (the chairs already were). |
| R-A-8 | NOTE | The pre-chosen preset was captured once; a wallet landing after the control left nothing chosen. | The preset follows the allowance until the viewer chooses. |

Refuter A: REFUTED 1 · CONFIRMED 22 · FIX-INSUFFICIENT 1 · DISPOSITION-CHALLENGED 1 · new findings 8.

### 5.2 Refuter B — the DARK and DOMAIN findings

Refuter B reconstructed `main`'s version of every host from the branch diff (`patch -R`, zero rejects) and SSR-diffed the five hosts against it under identical mocks; its mutation run (the eight fixed test files over the ORIGINAL sources) reds 37 rows, every fix-named row among them.

| ID | Claim | Disposition verdict | Note |
| --- | --- | --- | --- |
| DARK-1 | CONFIRMED | FIX-VERIFIED | Exactly one `<div style="margin-top:12px"></div>` on the original; gone on the fix. |
| DARK-2 | CONFIRMED (narrowed: MobilePresenceIdentity.smoke does SSR EquipStation, for the presence flag — nothing asserted its flag-off DOM) | FIX-VERIFIED | Its own replica of the bare-mount rule reports "sole child of <div>" for the original EquipStation and "bare" for the other four hosts. Limits → R-B-7. |
| DARK-3 | CONFIRMED | FIX-VERIFIED | A ratchet: it also passes on the original (same importers); the sibling constants row reds there only because of the lexicon import. Limits → R-B-6. |
| DARK-4 | CONFIRMED | FIX-VERIFIED | A docstring; no row pins the FLIP-MAP's route list (acceptable). |
| DARK-5 | CONFIRMED | FIX-VERIFIED | Hook order safe by construction (outer gate holds no hook). |
| DARK-6 | CONFIRMED | DISPOSITION-OK | The guards are explicit-list ratchets that expand as surfaces migrate; nothing to catch. |
| DOM-1 | CONFIRMED | **FIX-INSUFFICIENT** | The named defect is gone (STAKED, "Closed · plays Monday", the locked card), but with the same inputs the Backing screen's header still read "Close pending" and ignored `settling`, and Your Backing's header read a calendar battle day above the locked card. **Fixed in `0e65bba`:** one state→words mapping (`stripLines`) for the strip and the header; "Locked in · plays Monday" when no backed pod has started. |
| DOM-2 | CONFIRMED (narrowed: the repo's copy guard, whole-word, would not have flagged "bets" — the claim stands on the lexicon's intent) | FIX-VERIFIED | Side effect → R-B-5. |
| DOM-3 | CONFIRMED | FIX-VERIFIED | |
| DOM-4 | CONFIRMED (a concrete tie: recorded 2, the card said 1) | FIX-VERIFIED | The writer stores the event under `appliedGroups[groupId]`, so the shape matches production. |
| DOM-5 | CONFIRMED | FIX-VERIFIED | `portfolio` is on the battle view's non-owner allowlist. |
| DOM-6 | CONFIRMED | FIX-VERIFIED | The stake statuses are exactly live/voided/won/lost; none goes unmarked. |
| DOM-7 | CONFIRMED | FIX-VERIFIED | Residual by design: a seat absent from `seatNames` shows the users-doc name on the card and the raw id on the row. |
| DOM-NOTE-1 | CONFIRMED | DISPOSITION-OK | Suggested a tripwire binding the flip order — **added in `0e65bba`** (`backingBetaFlags.test.js`: backing never lights without attestation). |
| DOM-NOTE-2 | CONFIRMED | DISPOSITION-OK, remedy note completed | The smoke needs the server listing change AND the client half (the `dev-` pool id in `subscribePool`, the strip/Your Backing join) — both recorded in §7. |
| DOM-NOTE-3 | CONFIRMED (inert) | DISPOSITION-OK | |
| DOM-NOTE-4 | CONFIRMED | FIX-VERIFIED | |
| DOM-NOTE-5 | CONFIRMED | FIX-VERIFIED | A key change closes both old subscriptions and opens the new set; the roll still needs a render. |
| DOM-NOTE-6 | CONFIRMED | DISPOSITION-OK | A pitch is validated public copy, not a stake or an attestation; anonymous accounts can also be seated. |
| DOM-NOTE-7 | CONFIRMED | FIX-VERIFIED | |

**Byte identity (flag false, fix commit vs reconstructed `main`, react-dom/server):** LeagueHome (three fills, plus `hasAgent=false`), LeagueLobbyDesktop (three fills), PodCard (all nine base pods), IdentityPanel (two agents) — identical byte for byte. EquipStation (two agents) — identical except React `useId` tokens inside the presence-face SVG (`_R_h9_` → `_R_12h_`): the bare mount took the station's root children array from 7 to 8 entries, which crosses a power of two and re-encodes every nested id. No layout, text or visible change; `{false && …}` would not restore it (a `false` entry still occupies a slot). **Closed in `0e65bba`:** the reassurance lines and the scouting line now share one root entry (a fragment), the root stays at seven, and the coordinator's scratch harness (the branch file vs `main`'s file, two agents, flag false) proves the two renders byte-equal, ids included.

**Refuter B's new findings and their dispositions:**

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| R-B-1 | MINOR | The screen header was not updated with the strip's DOM-1/FAB-1 copy: "Close pending" for a fire-closed pool; "Settles after Friday's close" for a settling week. | **FIXED in `0e65bba`** — `stripLines` (one mapping); the dark suite mounts the lit screen on a fire-closed pod and pins "Your backing · 1 pod · Closed · plays Monday". |
| R-B-2 | MINOR | Your Backing's header fabricated a battle day for a week that had not started. | **FIXED in `0e65bba`** — "Locked in · plays Monday" when no backed pod has started. |
| R-B-3 | NOTE | = R-A-5 (Monday before the list rolls). | Fixed in `d537342`. |
| R-B-4 | NOTE | = R-A-4 (a non-live stake on a listed pod). | Fixed in `d537342`. |
| R-B-5 | NOTE | One lexicon, two matchers (the guard whole-word, the route word-start: "between" failed the route). | **FIXED in `0e65bba`** — `src/constants/backingLexicon.js`, one matcher for both: whole words and their plain inflections ("bets", "betting", "bettor", "wagered", "gambling"), never inside another word; pinned by `backingLexicon.test.js`. |
| R-B-6 | NOTE | The host ratchet is blind to `@/` alias imports, computed dynamic imports and alias re-exports. | **FIXED in `0e65bba`** for the alias spellings (`from`/`import(` of the backing dir, the six hooks and the service); computed dynamic imports remain a documented limit. |
| R-B-7 | NOTE | The bare-mount guard's opener regex is evaded by a wrapper whose attributes carry `>` (`onClick={() => …}`); the EquipStation row pins the literal wrapper only. | **FIXED in `0e65bba`** — JSX brace expressions are stripped before the opener is looked for; a synthetic row pins both cases. A general flag-off-equals-main comparison remains a review-harness check, not an in-tree row. |
| R-B-8 | NOTE | The EquipStation `useId` residual above. | **FIXED in `0e65bba`** (see byte identity). |

Refuter B: REFUTED 0 · CONFIRMED 20 · FIX-INSUFFICIENT 1 · DISPOSITION-CHALLENGED 0 · new findings 8.

### 5.3 Totals

| | Lens findings | Refuted | Confirmed | Fix insufficient at first pass | Dispositions challenged | New findings from the refuters |
| --- | --- | --- | --- | --- | --- | --- |
| A (SEAL + FAB) | 23 | 1 | 22 | 1 | 1 | 8 |
| B (DARK + DOM) | 20 | 0 | 20 | 1 | 0 | 8 |
| **Total** | **43** | **1** | **42** | **2** | **1** | **16** |

Every CONFIRMED finding with a fix disposition is fixed; every FIX-INSUFFICIENT residual, the challenged disposition and every new finding the refuters raised is either fixed (14 of 16) or recorded as pre-existing / out of this PR's scope (SEAL-2/DOM-NOTE-2's dev-namespace smoke path, DOM-NOTE-1's flip order beyond the tripwire). Nothing is left silent.

## 6. Verification on the fix commit

All on the branch's final source commit `0e65bba` unless stated; the record itself is the only file the commit after it adds.

| Check | Result |
| --- | --- |
| `npm run test:run` (full, never through `tail`) | exit 0 · `Test Files  754 passed | 3 skipped (757)` |
| Earlier full runs on the branch | `51ac1bb`: `Test Files  752 passed \| 3 skipped (755)` · `34b51ef`: `Test Files  752 passed \| 3 skipped (755)` · `14c1920`: `Test Files  752 passed \| 3 skipped (755)` — all exit 0. The 3 skipped files are pre-existing (`firestore.rules.emulator.test.js` and two others skipped on `main`). |
| `npm run test:rules` (Firestore emulator, `firebase emulators:exec`, jar downloaded this session) | exit 0 · `Test Files  11 passed (11)` · `Tests  242 passed (242)` · `test/rules/teamPitchesDenials.rules.mjs` 12 passed. `firestore.rules` is unchanged between `51ac1bb` (the run) and `0e65bba`. |
| `vite build` | exit 0 on `51ac1bb` (27.5s), `34b51ef` (31.6s) and `0e65bba` (29.7s); the CSS-syntax and chunk-size warnings are pre-existing on `main`. |
| `npm run lint:gate` | exit 0 on `51ac1bb`, `34b51ef` and `0e65bba`. |
| `eslint` (the full rule set) over every changed source file | clean at each commit. |
| Fenced files (BUILD_RULES §1) | none touched; no fenced function called directly (the archetype tables are reached only through the pre-existing sanctioned importer `api/_utils/archetypeRegistry.js`). |
| Screenshots | re-rendered from the fixed components at each visible copy change (`docs/design/backing/screenshots/`, harness in `scripts/backing-screenshots/`). |

## 7. Left for the founder

- **DOM-2:** the diversifier's canonical approach line contains "bets" and is omitted from the backing card until a backing-safe canonical line exists. Every Quick-Play pod's third CPU seat is a diversifier, so the omission is visible on every such card.
- **SEAL-2 / DOM-NOTE-2:** the dev-namespace smoke path (§11 gate 4) cannot be driven through this UI. Both halves belong to the activation PR: the server must list dev pods (`listablePod`) and materialise a dev pool for the founder (`allowDev`), and the client must subscribe to `dev-{groupId}` pools (from the joined group's `isDev`, or a `poolId` on the stake document) and join them on the strip and Your Backing.
- **FAB-15:** the film-room link lands on the pre-existing Spectate, whose `REASONING` fixture map and rivalry copy are Amendment A §A7's gate-3 item.
- **DOM-NOTE-1:** the flip must flip both flags (spec §12); a tripwire row now reds a backing-only flip.
- **SEAL-3:** a stale comment above the pool rules block (pre-existing).
- **R-B-6 (residual):** the host ratchet resolves relative and `@/` alias spellings; a computed dynamic import would still slip it (a documented limit).
- **DOM-7 (residual by design):** a seat the pod did not name shows the users-document name on the card and the raw id on the row.
