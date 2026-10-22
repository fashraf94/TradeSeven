# Astra — Film Room B2 card review

**DO NOT MERGE — F1 fails criterion 4 for an owner-inconsistent ledger entry.**

**Date:** 2026-10-22. **PR:** [#988](https://github.com/fashraf94/TradeSeven/pull/988), `claude/film-room-b2-card` (draft per the supplied brief).

The create-replay branch returns an existing ledger entry without checking that entry's `ownerId`. I reproduced the endpoint response with the real handler over the test Firestore handle, then reproduced the store behavior with the real Admin SDK against the Firestore emulator. **This requires an inconsistent stored entry under an agent the caller owns, and the matching op id and request. I did not find a client path that produces that state, or inspect production for it.** The failure is a conditional authorization boundary failure, not evidence of a current customer-data incident.

No other new blocker is established by this review. The ordinary ownership attacks, current model boundary, cards-off bytes, rendered copy/class checks, hub contract and RE-1 field comparisons passed within the limits below. The full Linux run had one archive-metadata failure, reproduced on the base; its focused rerun passed with pinned Git metadata. That full run is not reported as green.

## Review pins and method

| Item | Verified value |
| --- | --- |
| Reviewed head | `c84716ef9c1e9ede707f021988e1d62aa436ee93` |
| Code head | `0e5ff5265e67fe8128765e3f59b879e4c81137a6`; only `docs/README.md` and the build report differ above it |
| Base and fetched `origin/main` | `7818a1b315589dd95cffbf3708df685fa3d9eb9d` |
| Head / effective merged tree | `2dcfda7c6b5d9095c2bd437896ac69b00f7e3308` |
| Diff | 67 files; 5,675 additions, 35 deletions |
| Archive command | `git -c core.autocrlf=false -c core.eol=lf archive <SHA>` |
| Head archive SHA-256 | `e18b769361f72f94a09416445a8ba339023bcd0a493b458c817afdb13f917959` |
| Base archive SHA-256 | `126956ed480db93d8d198f8f8eeb9406f0ddf4d1d9df3bac94c03b1c50b27b4d` |
| Blob verification | All 4,104 head and 4,061 base blobs match Git at extraction and at completion; zero mismatches |

Fetched before remote comparisons, and refreshed main and PR refs during the review. Source citations below refer to the reviewed head, preserved in [the isolated head snapshot](../../head). All current-source claims marked VERIFIED below were read or executed in this review. Test probes, captures and logs are external to the supplied checkout. A passing defect probe means its assertion reproduced the defect; it does not mean the product behavior passed acceptance.

Applied the specified Build B spec and Amendments A–G, the supplied Amendment H verbatim as governing input, shared-contract §§5/7/9, and screen Amendment E R1–R15. The builder's report was treated as claims. RH-14's production refresh remains a founder-reported fact; no production verification was attempted. Earlier B1/B1.1 dispositions were used for scope continuity, not as evidence that this head passes.

## §1 — Findings and the ten criteria

### F1 — Create replay can disclose a ledger entry whose own owner is someone else

**Criterion:** 4. **Disposition:** merge blocker under the specified document-owner boundary. **VERIFIED, conditional stored-state precondition.**

**Code:** `api/_utils/filmRoom/cardStore.js:176` authenticates the parent agent in the transaction. At `cardStore.js:180` it reads all plays without filtering their owners. At `cardStore.js:184`, a matching fingerprint returns the existing document without checking `existing.ownerId`. `api/film-room/card.js:125` sends that document to the caller. In contrast, `cardStore.js:208` rejects a foreign entry on retirement, `cardStore.js:239` drops it from ordinary reads, and `firestore.rules:463` makes the entry's own `ownerId` the read authority.

**Repro:**

1. Create a valid card under an agent owned by caller A. Keep the op id and request.
2. In synthetic Admin setup only, change that entry's `ownerId` to B, leaving its fingerprint and all other fields unchanged.
3. `readCards(...uid=A...)` returns no card. The client rules also deny A a direct read of a foreign-owned entry under A's parent agent.
4. Replay the create with A, the same op id and the same request. The store returns `idempotent: true` and the complete B-owned entry. The handler repro returns HTTP 200 with the foreign entry; the counter/retire controls withhold it.

The real-emulator repro changes **only `ownerId`**. It does not rely on changing the note while preserving an old fingerprint. The handler test additionally demonstrates that an arbitrary synthetic foreign note is carried in the response. Evidence: [handler repro and logs](../../evidence/probes-initial.log), [real-emulator results](../../evidence/store-emulator-final.json), [emulator probe](../../head/test/rules/astraCardStore.rules.mjs), [handler probe](../../head/api/film-room/card.astra.test.js).

**Reachability limit:** normal create stamps `ownerId: uid` (`cardStore.js:120`); client writes to plays are denied. Agent client updates cannot change ownership (`firestore.rules:332`) and client deletes are denied (`firestore.rules:347`). A malformed/migrated/Admin-written entry is therefore a prerequisite not shown to arise through the current customer flow. Also required: the matching op id and request, and a battle/tape that passes the current create preflight. This is not a general ability to enumerate another owner's cards. It still returns a document to a non-owner under the exact authority used by the rules and sibling server operations, which is why it maps to criterion 4 rather than a new criterion.

**Proposed fix, not made:** validate the existing entry's owner before either replay or conflict processing; reject a missing or different owner without disclosing the entry. Filter the transaction's cap input to `ownerId === uid`, matching `readCards`. Add foreign-owner and missing-owner replay controls through the handler, plus real-emulator coverage. Ordinary same-owner replay must remain idempotent.

### Criterion disposition

| Criterion | Result and evidence boundary |
| --- | --- |
| 1 — number class | No breach found. Original sweeps plus added depth/layout/tape-state and receipt matrices passed. RG-3 basis and RH-10 slot classes were exercised. |
| 2 — screen voice | No breach found in the mounted states. All six copy/number/sign/quotation/stored-note/name sweeps passed; RH-11's note textarea exemption was preserved. |
| 3 — stated fact versus tape | No new tape contradiction established. Stale retirement contradicts the ledger, not the tape; it is B1 below, not an expanded criterion 3. |
| 4 — ownership/client writes | **F1 fails conditionally.** Direct Firestore rules and ordinary endpoint/counter ownership controls passed. |
| 5 — off/legacy bytes | Passed the twelve independent base captures and current-head comparisons, non-admission/failure cases, and added slow-verdict/API-seam comparisons. Legacy/route files are unchanged. |
| 6 — hub shape | Passed all 47 `reviewAvailability` checks on the focused rerun: exactly `ready`, `target`, `availability`. |
| 7 — one door | No current ledger-to-model path found; seven assembled outputs were byte-identical with our own card/nominated/retired entries. Census bypasses are guard weaknesses, not a demonstrated current model read (B2). |
| 8 — source/ownership | Sequential counterfeit-moment and ownership attacks were refused. The unavailable-day behavior is governed by RH-6. A source-refresh race is recorded in B3 with its unavailable-day dependency; no complete-day race was established. |
| 9 — tape fields | Passed 32 base/head document pairs. Only the two eligible recorded absent-entry cases changed `coverage.tags`; no other tape field changed. |
| 10 — opponent from `none` | No new breach. RB-5/untaped-route checks passed; tournament creation is refused before reading tape. |

## §2 — Ownership, endpoint attacks and one door

### Rules and the counter

**VERIFIED:** The entire rules suite passed **437 tests in 26 physical files**. The additional plays suite passed **14 tests**, including a missing-`ownerId` document. Tested owner and other-user gets/lists, owner-filtered versus unconstrained lists, anonymous calls, privileged claims (`admin` and service-role claims), and client create/update/delete. Foreign and ownerless entries fail closed. A document's own owner may read it even if its parent is missing: that is the specified document-owner rule, not a parent-owner rule. No client write was admitted. The rules diff is exclusively the new plays block and its comments (`firestore.rules:448`–`466`).

**VERIFIED:** `cardCounter.js:90`–`96` queries collection group `tape` with `ownerId == uid`, inclusive date bounds and exactly the five-field mask `tags`, `etDate`, `ownerId`, `agentId`, `battleId` (`cardCounter.js:40`). Our hostile query double returned both a foreign-owner document and an ownerless document despite the query; the code dropped both. No foreign sentinel reached a recurrence. This validates the query construction and post-filter, not production index readiness.

Recurrences require the card's agent, its situation, and a first tagged-check timestamp strictly after `createdAt`; equal time and another agent were excluded. The response has battle/day plus the seven moment fields, with no price, score or result (`cardCounter.js:140`–`151`). Weekly tag/moment counts derive from items/moments (`cardCounter.js:111`), and ET dates/Monday weeks were checked including the November DST boundary. The default is the accepted 120-day lookback; with inclusive endpoints its raw date range contains 121 dates. The oldest open Watch card floors the default, bounded by 400 inclusive dates; a supplied 400-date range passed and 401 failed (`cardCounter.js:77`, `:80`, `:171`–`173`). RH-4 is not reopened. Weekly counts remain returned and not rendered under RH-9.

### Card request and store

**VERIFIED refusal sequence:** security/gate, authentication and method; parsed ids/day/moment/question/note/route; battle existence and ownership; battle-agent identity; tiered eligibility; tape read and tape ownership; stored tags; exact moment; taped archetype; menu question/version; transaction agent ownership/archetype; existing operation; current archetype match; cap. See `cardsGate.js:77`, `cardRequest.js:90`, `card.js:76` and `cardStore.js:174`. This is the actual order, including the existing-entry branch before the new-entry archetype/cap tests.

Executed original refusal rows and independent extensions:

- Missing battle: 404. Foreign battle or wrong battle-agent: 403, with no foreign document in the response. Non-tiered/tournament: 409 `untaped`. Missing/foreign tape: 404. Failed tape read: 503 `tape_unreadable`. Absent tags: 409 `tags_unavailable`.
- Sub-range, superset, whole-day range, other symbol and other situation: 409 `moment_not_found`, no write. Wrong menu/version: 400. Missing taped archetype: 409. Current agent/taped archetype mismatch: 409 `archetype_changed`; repeated requests did not create shelved-at-birth entries.
- Same op id/body: same entry. Different body under that op id: 409 `op_conflict`. A tags-version-only refresh preserves the request fingerprint's replay behavior. Reserved ids are refused. The normal error bodies tested disclose no foreign content; F1 is a successful replay response, not an error-body leak.
- **Real emulator concurrency:** starting at four open cards, two concurrent creates yield one success and one `cap_reached`, ending at five. Two retire operations with the same expected version yield one success and one `version_conflict`.
- **Real emulator shelving:** changing the agent archetype drops the open count to zero and retirement refuses `shelved`; restoring the archetype restores the four still-open cards. The ledger documents before and after are byte-equivalent objects: no shelving write. Screen controls show the shelved receipt's no-next-action sentence and remove Retire.
- **Note boundary:** 280 emoji code points accepted, 281 refused; empty refused. All 65 Cc characters were tested at the middle, leading edge and trailing edge (195 cases). All middle positions and all C1 cases were refused. Ten edge cases were trimmed away and accepted; see B4.
- **Oversized input:** a 5 MiB unused property was accepted by a direct handler invocation with otherwise valid fields. This does not test the hosting platform's HTTP body-size enforcement. No new criterion is inferred.
- **Rate limiter:** the real middleware admitted ten card requests per synthetic IP/minute and rejected the eleventh with 429, then admitted after the window. Counter is configured for 30/minute (`counter.js:25`). This is local per-process behavior, not a distributed-rate-limit claim.

With the flag off, normal card and counter requests return 404 without auth/Firestore access; non-admitted owners also receive 404 without Firestore access. The shared rate limiter runs first (`cardsGate.js:78`), so an over-limit off request can return 429, still without auth or data reads. The build's unconditional “both endpoints answer 404” wording has that middleware qualification.

### One door

**VERIFIED current source:** re-ran the census over its eight named path groups and 18 roots: evaluator, deploy, chat/cockpit chat sheet, voice, reflection, batch review, debate and tournament boards. The current import graph has no ledger reachability or plays read detected; the whole-API importer inventory remains limited to the Film Room modules/routes (`oneDoor.census.test.js:206`).

Planted ordinary plays reads in **each root**: detected. Static and quoted dynamic imports through a middle module to the ledger: detected. Tested alternative spellings and found misses listed in B2. Consequently this is a bounded source census, not proof against every possible JavaScript spelling.

**VERIFIED executed assembly:** re-ran acceptance C with our own distinctive notes at `card`, `nominated` and `retired`, populated under the same agent passed to the real assemblers. All seven strings matched their empty-ledger controls exactly: evaluator system, identity, live context, portfolio CSV, deploy strategy system/user, and portfolio system. The read log was live: both runs read `institutionalHoldings/NVDA` and `institutionalAggregates/latest` and had more than five reads, with no plays read. A deliberate plays read appeared in the log; a deliberately appended ledger note changed prompt bytes. The ledger was separately readable and had the three intended stages.

No model was called. Runtime prompt comparisons cover these seven assembly functions; the other model paths are covered by source census, not fabricated end-to-end executions. Future camp stages were not invented for this B2 build.

## §3 — Backlog and accepted work

### B1 — Successful retire can keep showing the old stage after counter failure

**VERIFIED; no named blocker assigned.** File a Watch card, retire it successfully, then make the counter refresh return 503. Stored stage becomes `retired`, but the receipt continues to show `Stage · card`, the Watch next-action sentence, and Retire. The list is also stale. `filmRoomCards.js:201` preserves the previous counter; `:217` returns the successful mutation; `ledgerOf` at `:140`–`143` always prefers an existing counter row over that result. The receipt consumes that row at `FilmRoomCardRegions.jsx:245`.

Proposed: reconcile a successful mutation into the local ledger using its version, or mark the receipt unresolved until a fresh authoritative read. Preserve an error indicator for failed counters. This is a real failure path, but the contradiction is to the ledger; it does not by itself satisfy criterion 3's tape wording. Evidence: `ASTRA_STALE_RETIRE` in [screen probe log](../../evidence/probes-screen.log).

### B2 — Census can miss equivalent source spellings

**VERIFIED synthetic guard weakness; no current criterion-7 breach found.** `oneDoor.census.test.js:113` misses `import(\`./leaf.js\`)` and `import(variable)`; `:137` misses `collection('pla' + 'ys')`, `collection('pl\u0061ys')` and `collection(String.fromCharCode(...))`. These planted reads/imports evade the guard. They are not present as a discovered current ledger read on a model path.

Proposed: parse imports/expressions, resolve constant strings, and explicitly flag unresolved dynamic imports in protected roots for review. Keep runtime positive controls. No finite regex test warrants the claim “every spelling.” Evidence: [census probe](../../head/api/_utils/filmRoom/oneDoor.census.astra.test.js) and [miss log](../../evidence/probes-initial.log).

### B3 — Source validation and create commit are separate; RH-6 constrains the demonstrated race

**VERIFIED race, bounded reachability.** `card.js:86` reads the tape and `:95` checks the exact moment before the separate store transaction at `:124`; that transaction does not re-read the tape. Replacing its tags between those steps permits creation from a now-absent moment in a synthetic overwrite control.

A stronger control used the real writer: an incomplete day initially stores ACN moment `4–4`; restore missing tick/evaluation 5 and run `writeTapeDay` before the create transaction; the stored moment becomes `4–5`, yet create returns 200 with source `4–4`. **Both days have unavailable tag coverage in this repro.** It depends on the endpoint behavior that RH-6 already schedules for refusal. I did not establish a complete-day refresh that causes this mismatch, so this is not promoted into a second merge blocker by ignoring RH-6's disposition.

Proposed: include source-day validation in the transaction or validate a source revision atomically at commit. When implementing RH-6, rerun a source-refresh race; merely refusing the initial unavailable day is not general atomicity evidence. Evidence: `ASTRA_SOURCE_RACE` and `ASTRA_REAL_SOURCE_RACE` in the [initial](../../evidence/probes-initial.log) and [screen/route](../../evidence/probes-screen.log) logs.

### B4 — RH-3's “refused, not stripped” does not hold at whitespace-control edges

**VERIFIED; no named blocker.** `cardRequest.js:57` trims before the Cc check at `:59`. Leading/trailing U+0009 through U+000D are removed, so e.g. `"\nabc"` files as `"abc"`. All remaining Cc cases are refused. Thus length-after-trim and nonempty are implemented, but the supplied “every Cc … refused, not stripped” wording is not literally true of the raw input. Proposed: check Cc on raw input before trimming. This is a documented mismatch within RH-3's accepted-as-built disposition, not an added merge criterion. [195-case probe](../../head/api/film-room/card.astra.test.js).

### Accepted dispositions retained

- RH-1 tempo-dial routing, RH-2 cross-battle recurrence navigation, and RH-6 unavailable-day refusal/exclusion/count are screen-pass work required before any flip. Today the endpoint accepts stored moments despite unavailable coverage (`card.js:94`), and the counter includes such days; its current five-field mask cannot inspect `coverage.tags`. RH-6 will need a deliberate read-contract change or equivalent trusted coverage evidence, with updated tests.
- RH-5/7/8/9/10/11/12/13 stand: archetype refusal; written-once slots version; struck battle-day count; unrendered weekly counts; recorded slot classes; note-text exemption; op-id identity; recorded-count fallback. RH-14's stated refresh is accepted without a new backfill requirement.
- RG-1 Meetings/RE-3, W5, X3-5, FR-02–FR-05, delay wording, Glance coverage and the five leftovers remain as ruled. Earlier B1/B1.1 and Amendments B–F are not reopened.
- Cold-start cost, the 404/403 house posture, and base-golden provenance posture remain accepted. The double capture was independently repeated here. The HTTP body-size and rate-limit qualifications above do not create new gates.

## §4 — Execution, merged tree, CI and handoff

### Executed checks

| Check | Actual result |
| --- | --- |
| Linux full suite, reviewed effective merged tree, `TZ=UTC`, two workers | **23,029 passed; 1 failed; 89 skipped.** 1,076 physical files: 1,067 passed, 1 failed, 8 skipped; 609.89 s. |
| Sole Linux failure | `scripts/experiments/archetype-menu-dry-run/capture.test.js:128`; the offline CLI calls `git rev-parse HEAD` in `scripts/experiments/archetype-menu-dry-run/capture.mjs:44`, which fails in a bare archive directory without `.git`. |
| Base archive control | Same file: 8 passed, same 1 failed with “not a git repository.” |
| Pinned-metadata head control | Same file: **9/9 passed** after attaching private detached Git metadata naming the exact reviewed SHA. No source edit or commit. This was a focused rerun, not a second full suite. |
| `npm run lint:gate` | Passed, exit 0. |
| `npm run build` (`vite build`) | Passed, exit 0, 15.65 s. Chunk-size advisory remains. |
| Full Firestore rules | **437/437**, 26 physical files, demo project only. |
| Independent plays rules | **14/14**, including missing owner and hostile contexts. |
| Real Admin SDK emulator transaction controls | **2/2**, containing cap race, retire CAS, reversible shelving and F1 replay assertions. |
| Initial route/census/own-ledger assembly probes | **67/67** across three files; includes successful assertions of the documented defects. |
| Screen/route matrix and real-refresh probes | **68/68** across two files. Includes 40 mounted tape-state/depth/layout/detail/form views. |
| Added receipt and slow/off-seam matrices | **2/2 selected tests**, 44 intentionally unselected rows. Thirty receipt views: five route/state cases × three depths × two layouts; 24 additional golden comparisons (twelve each for armed off seam and unresolved verdict). |
| Counter, goldens, hub and legacy closure batch | 75 passed, 1 failed. The Windows failure was `reviewAvailability.test.js:403` at the default 5 s timeout during dynamic writer import under concurrent load. |
| Isolated hub/rate control | **48/48**, one worker with 30 s timeout: all 47 hub tests plus the real rate-limit test. No assertion failure remained. |
| Base/head close-pass field comparison | 16 fixture configurations × first write/refresh = **32 pairs**. Thirty identical; two allowed RE-1 differences only. |
| Independent base goldens | Two fresh base captures, twelve HTML files each; all 24 hashes match one another and the committed head goldens. Head golden suite passed. |
| Start/end archive blob checks | 4,104 head / 4,061 base, zero mismatches both times. |

**RE-1 detail:** ordinary, no-trigger, budget, completed, early-close, skipped/pre-capture, recorded/recomputed, absent-entry, additional-check-reason and mixed-basis configurations were compared at the same clock. No timestamps, run counters or existing fields were stripped from the comparison. Only the recorded, absent-entry-only configuration changed `tape.coverage.tags.status` from `unavailable` to `complete` and its note to `null`, on first write and refresh. The returned byte-length metadata also changed from 54,320 to 54,269; that is not a tape field. `tagsCoverage` implements the exception at `api/_utils/filmTape/tapeTags.js:416`. [Exact field and golden comparison](../../evidence/comparison.json).

**Screen detail:** original controls and added matrices used recorded, recomputed, unavailable and absent-tag tapes; moments, available tagged-check details, forms, receipts, Since last time and My cards. Receipt matrix covered Watch/card, Practice/nominated, Set/card, retired and shelved. Exact RG-5 sentences and no-action state sentences passed with fresh counters; the failed-refresh exception is B1. No outcome content appeared in moment rows. These are React/jsdom DOM checks at phone/desktop media-query branches, not a real-browser screenshot or visual-layout certification. The founder's screen pass remains necessary as already ruled.

**Platforms:** Windows Node **22.20.0**, Java **21.0.11** for emulator and independent probes; WSL2 Linux x86_64 (`5.15.167.4-microsoft-standard-WSL2`) Node **22.22.2**, Vitest **4.0.17**, `TZ=UTC` for the full suite, lint and build. Linux dependency reuse was permitted only after comparing its `package-lock.json` to the archive. This does not reproduce the builder's Node 20 environment. An initial attempted base control used an expired temporary extraction path and failed before reaching a test; the completed controls above use fresh durable extractions. No product conclusion is based on that setup failure.

### Fences and current main

**VERIFIED:** No BUILD_RULES §1 file or `api/cron/agent-evaluate.js` is in the diff; no new legacy-table importer was found. `FilmRoomRoute.jsx`, the legacy `FilmRoomScreen.jsx` and `reviewAvailability.js` are unchanged. Rules add only the plays block. Indexes add only `tape` / `COLLECTION_GROUP` / `ownerId ASC, etDate ASC` at `firestore.indexes.json:648`. Flags append only the cards-mode definition, allowed-state constant and documentation; `FILM_ROOM_CARDS_MODE` is still **`'off'` at `src/config/featureFlags.js:3368`**. No trading call-site change was found.

At the final remote-ref refresh at audit completion, current `origin/main` remained `7818a1b3`, already an ancestor of this head. Therefore the tree obtained by merging current main into the head is exactly the reviewed head tree; there is no merge conflict and no additional merged-source delta. No merge was performed in the supplied checkout.

PR #986 advanced during the review from `b71c0317766e7a3ec13a4a1e90e8c741403e8838` to final fetched head `9dbbb830ffe5d561d5820068a4a8bfecd8b63d1d`; #987 remained `1e9380ad0ed104087198dab13d6d8184cf3b36ee`. Neither final head was an ancestor of current main; main's tip remained the #985 merge. **Neither #986 nor #987 was included in the current-main integration tested here.** This is the fetched Git ancestry result, not a claim about their current UI status or later merges.

**Hosted CI at `c84716ef`: unavailable.** The connected PR/check interfaces could not supply it; the checks tool returned “Can't connect to GitHub. Try again.” No successful CI result, deployment or live admission is inferred. No CI monitoring was set up.

This was a single-reviewer adversarial pass across ownership, request/store concurrency, source lifecycle, model boundaries, screen contracts, off bytes and test provenance. There was no separate subagent refutation pass; the paired controls and real-emulator repeat are not represented as one.

### Founder handoff and preserved state

**New pre-merge work:** close F1's entry-owner check and owner-filtered cap gap, retaining same-owner idempotency, and run the focused foreign/missing-owner regression controls. If the founder chooses to rule owner-inconsistent server state outside criterion 4, that must be an explicit disposition; this review does not silently assume it. B1–B4 remain backlog/conditional concerns as classified, rather than extra exit criteria.

No additional rules/index deployment step is established beyond the build report's owner-controlled process. No deployment was attempted. The already-required RH-1/RH-2/RH-6 and RG-1 screen work still precedes any flip; the source's dark flag is not evidence that a deployed environment is dark, admitted or populated. Founder inspection of hosted CI remains necessary because it was not visible here.

The supplied checkout remains on `main` at `7818a1b315589dd95cffbf3708df685fa3d9eb9d`, with no tracked modifications and the same six pre-existing untracked files:

- `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`
- `docs/audits/20261014_SWAP_IDENTITY_SHADOW_READ.md`
- `exit-dials-live-census-report.json`
- `planted-census.json`
- `shadow-read.json`
- `vwap-exit-dating-census-report.json`

No checkout/source edits, commits, pushes, merges, deploys, production reads or model calls were made. Fetches updated remote-tracking metadata only. All review artifacts are under the external `b2` folder containing this report. Probes and test artifacts were added only to isolated snapshots; final tracked-blob verification remained exact.

Evidence entry points: [full-suite results](../../evidence/full-suite.json), [base failure control](../../evidence/archive-base-control.json), [pinned-metadata rerun](../../evidence/pinned-metadata-rerun.json), [rules results](../../evidence/rules-suite.json), [independent rules](../../evidence/rules-independent.json), [final emulator results](../../evidence/store-emulator-final.json), [final screen matrices](../../evidence/final-screen.json), [hub/rate rerun](../../evidence/rate-hub.json), [lint log](../../evidence/lint.log), [build log](../../evidence/build.log), [head final blob check](../../evidence/head-blobs-end.json), [base final blob check](../../evidence/base-blobs-end.json).
