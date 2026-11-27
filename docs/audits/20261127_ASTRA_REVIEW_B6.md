# Astra review · Practice Field B6 · 27 November 2026

**DO NOT MERGE. Books for other players: NOT READY.** Three accepted desk notes failed the player-facing wording bar. One changed the meaning of a note. Two displayed a retired desk name. All three went through a successful fake-model close, the stored close row and the owner’s normal book reader. The six requested fixes passed. Evidence comes from `PF/agentRun.js:519`, `PF/bookView.js:169`, `PF/bookView.js:242`, `PF/bookView.js:781`, and the failing rows below.

`PF/` denotes `api/_utils/practiceField/`. `Build` denotes `docs/audits/20261126_BUILD_B6_BEFORE_THE_PLAYERS.md`. Product and test references are relative to the candidate unless marked base. `Local/` denotes the reviewer’s isolated evidence directory, `.claude/worktrees/astra-b6-evidence/`, in the parent workspace.

## Three blockers for the fix round

### B6-A01 · A line break turns an ordinary word into a desk name · bar (c)

The desk wrote the following two lines. The reader returned the sentence underneath them. The base returned the original two lines. The words “long shadow” describe the effect of rising rates. “Desk action” begins the trading decision. The candidate replaces one word from each statement with the name of a desk. `PF/bookView.js:169`, `PF/bookView.js:224`, `PF/bookView.js:242`, `Local/proof.test.mjs:118`.

```text
Rising rates still cast a long shadow
Desk action: hold JPM.
```

```text
Rising rates still cast a long Atlas’s desk action: hold JPM.
```

**Fix.** Keep phrase matching to one line, including the optional article before a name or an ID. The failing row should round-trip byte for byte. The same-line control `The Shadow desk holds JPM.` should still read `Atlas’s desk holds JPM.` R-5 expressly keeps line breaks. The current test at line 77 expects a break to disappear. This example also demonstrates a change of meaning beyond the formatting discrepancy. Likelihood depends only on a desk writing a multiline note with a heading. `Build:292`, `PF/bookView.b6.test.js:43`, `PF/bookView.b6.test.js:77`, `PF/bookView.js:174`, `PF/agentTool.js:185`.

### B6-A02 · Underscore emphasis leaves the old name on screen · bar (d)

| Stored model note | Candidate shows | Expected |
|---|---|---|
| `I agree with _Shadow desk_ today.` | `I agree with _Shadow desk_ today.` | `I agree with _Atlas’s desk_ today.` |
| `I agree with *Shadow desk* today.` | `I agree with *Atlas’s desk* today.` | Same as shown |

The underscore is a word character for the matcher’s `\b`. Both boundaries fail in the first row. The screen renders the returned string as plain text, so the player can read the literal old name. A second reader row with `__Archetype desk__` also retained the name. **Fix.** Recognize paired, standalone emphasis underscores as delimiters around an old desk name and preserve the delimiters. Keep the existing ID-token rule. Likelihood depends only on which common emphasis punctuation a desk uses. `PF/bookView.js:169`, `PF/bookView.js:171`, `PF/bookView.js:236`, `src/components/PracticeField/IdeaBookScreen.jsx:387`, `src/components/PracticeField/IdeaBookParts.jsx:65`, `Local/proof.test.mjs:85`, `Local/proof.test.mjs:118`.

### B6-A03 · A valid agent name reintroduces the other desk’s old name · bar (d)

| Caller’s saved agent name | Stored model note | Candidate shows | Expected with the existing fallback |
|---|---|---|---|
| `Archetype Desk` | `The Shadow desk holds JPM.` | `Archetype Desk’s desk holds JPM.` | `Your agent’s desk holds JPM.` |

The caller’s own agent held JPM. Its permitted name inserts the retired archetype label into that agent’s note. Agent creation accepts the name, the book reader verifies its owner, and the formatter appends the possessive. **Fix.** When constructing the Practice Field display label, use the existing agent fallback if the given name contains a whole retired desk name. Apply that decision once so the heading, byline and prose agree and the player’s saved name stays intact. I applied the brief’s literal screen wording bar to a name a player can choose. Likelihood is limited to a colliding name, after which the failure is deterministic. `src/components/Agent/AgentCreationFlow.jsx:333`, `src/components/Agent/AgentCreationFlow.jsx:637`, `PF/bookViewRead.js:174`, `PF/bookView.js:146`, `PF/bookView.js:156`, `PF/bookViewCopy.js:61`, `Local/proof.test.mjs:118`.

**Reproduction for all three.** Seed a founder book and its medium JPM fixture, give the verified owner the name in the row, and run the first normal session. Have the fake transport return `toolResponse(holdAll(request, { note }))`. Both desks completed their calls. The agent desk’s stored source was `model` and its stored note equalled the input. Read with `readBookView(db, {uid, agentOn: true})` and inspect that desk’s `note.text`. The complete serialized store equalled its pre-read bytes in each replay. `PF/__testsupport__/agentFixtures.js:90`, `PF/__testsupport__/agentFixtures.js:111`, `PF/__testsupport__/agentFixtures.js:134`, `PF/bookViewRead.js:237`, `Local/proof.test.mjs:118`.

## One inherited observation

**B6-A04 · Founder fixture byline.** A fixture with origin `founder_fixture` and thesis author `agent` displayed the founder’s original text with the byline `Atlas’s desk` on both revisions. B6 correctly protects the text. The older byline function still consults only the author field. The founder door forces the origin while retaining the submitted author. Likelihood is limited to a founder submitting a fixture with that author label. Recorded outside the three-blocker fix round. `PF/founderControls.js:346`, `PF/bookView.js:563`, `PF/bookView.js:579`, `PF/bookView.b6.test.js:191`, `Local/proof.test.mjs:146`.

## Both model requests

- Compared 72 request pairs built by the two actual checkouts across six archetypes, identity versions 1–3, both desks and both saved-thesis switch states. Each system text removed exactly two lines and added five. Every retained line, including repeated blanks, stayed in order. The message, full tool schema and tool choice matched their base counterparts. Each desk retained its slot restrictions, character, applicable chart and thesis instructions, rails, and answer rules. `PF/agentPrompt.js:73`, `PF/agentPrompt.js:102`, `PF/agentPrompt.js:122`, `PF/agentPrompt.js:205`, `PF/agentPrompt.b6.test.js:140`, `PF/agentPrompt.b6.test.js:168`, `Local/compare.cjs:14`.
- The new scaffold consistently identifies the two roles in plain words. No retired name appeared in the controlled requests. Unique test strings placed in the book’s profile name, chat and owner ID appeared nowhere in the model request. The saved-card string appeared only in the agent desk’s enabled request, in the quoted saved-thesis input. Prior notes, open-idea theses and enabled saved theses retain their ruled quotation behavior. The founder’s given agent name supplies display copy only. `PF/agentPrompt.js:148`, `PF/agentPrompt.js:169`, `PF/agentPrompt.js:176`, `PF/agentRun.js:369`, `PF/agentPrompt.b6.test.js:117`, `PF/bookViewRead.js:174`, `Local/proof.test.mjs:26`.
- Prompt and agent brief versions went from 1 to 2. Tool version stayed 1. The archetype’s identity version still comes from the epoch. The run’s 27 requests used the fake transport. This verifies what the model receives. Its first live notes and token usage are unobserved. `PF/agentConfig.js:121`, `PF/agentPrompt.js:50`, `PF/agentPrompt.js:75`, `PF/agentTool.js:56`, `PF/agentPrompt.b6.test.js:198`, `PF/agentPrompt.b6.test.js:210`.

## Screen coverage and ownership

The regular scene rows passed for model notes, action reasons, draft theses, live desk-authored theses, History theses and exit reasons, and the slot settled today. The mapper draws ID-to-slot pairs from the caller’s live and loaded finished ideas. Whole known IDs and optional articles worked in ordinary prose. Longer tokens, unknown IDs, bare “Shadow”, and the ruled same-slot readings retain the expected behavior. Founder prose survived exactly, including a deliberate old name and ID. Saved cards supply prompt input through a separate reader. A saved-thesis-sourced draft stores the model’s own thesis field. The book view reads no saved-card document. `PF/bookView.js:193`, `PF/bookView.js:579`, `PF/bookView.js:604`, `PF/bookView.js:687`, `PF/bookView.js:765`, `PF/bookView.js:781`, `PF/bookView.js:865`, `PF/bookView.js:871`, `PF/bookView.js:991`, `PF/bookView.b6.test.js:87`, `PF/bookView.b6.test.js:181`, `PF/agentDrafting.js:63`, `PF/agentSources.js:197`, `PF/bookViewRead.js:228`.

The endpoint takes the verified UID. The reader checks the claim’s book kind, owner and open status, scopes ideas and History to that book, and uses an agent’s given name only after its owner matches. The foreign-agent fixture displayed the caller fallback. Direct and store-backed reads preserved the stored row. The existing two-exit timing case remains the recorded B5 exception. `api/practice-field/book.js:43`, `PF/bookViewRead.js:83`, `PF/bookViewRead.js:150`, `PF/bookViewRead.js:174`, `PF/bookViewRead.js:198`, `PF/bookViewRead.js:223`, `PF/bookView.b6.test.js:232`, `PF/bookView.b6.test.js:350`.

## Founder’s book and figures

| Offline comparison | Independent result | Evidence |
|---|---|---|
| Agent on, 13 sessions, current constants | 27 calls, 14 agent and 13 archetype. Both stores had 26,201 leaves and 830,895 bytes. Exactly 144 leaves differed. Restoring each changed value from the separately executed base reproduced its entire serialized dump byte for byte. | `PF/__testsupport__/agentEndToEndRun.js:60`, `PF/agentEndToEnd.test.js:172`, `PF/__testsupport__/fixtures.js:638`, `Local/compare.cjs:7` |
| Changed records | 26 manifest versions, 13 agent-brief identity versions, 26 each of manifest input hash, SHA-256 and byte count, and 27 attempt input hashes. Every change was on a close row. All other stored fields matched. | `PF/agentPrompt.js:214`, `PF/foundersLiveBook.test.js:54`, `Local/compare.cjs:8` |
| Founder on the player list, older book constants | Reproduced build §5.2’s first row on both trees. Base `c1fca0d6…`, B6 `2a2d555e…`, 830,894 bytes each. The merge simulation also reproduced `bede24af…` and `aa04926e…`. The committed tests restored the corresponding base hashes. | `PF/foundersLiveBook.test.js:45`, `PF/foundersLiveBook.test.js:85`, `PF/foundersLiveBook.test.js:111`, `Build:331` |
| Agent off | The pinned 443,534-byte dump matched byte for byte, SHA-256 `61b9432787d2a6d1de9df0dc410a16d83bc799d772f391db13556071b8d88c89`. A separate 13-session run compared the actual store bytes and returned results at 39 evaluation windows, 13 closes and 13 disabled agent passes. All 65 matched. Zero transport calls. | `PF/endToEnd.test.js:106`, `PF/endToEnd.test.js:355`, `PF/agentIsolation.test.js:49`, `Local/proof.test.mjs:64`, `Local/compare.cjs:19` |
| Player view at each close | Exactly 25 changed leaves, all `desks[].note.text` (13 archetype, 12 agent). Every figure matched. I counted 4,058 leaves in the bare views and 4,071 with one session date attached to each view. The builder gives 4,071 without specifying that envelope. The failed agent call accounts for its thirteenth note. | `PF/__testsupport__/agentEndToEndRun.js:38`, `PF/bookView.js:779`, `PF/bookView.js:1065`, `Build:338`, `Local/proof.test.mjs:43`, `Local/compare.cjs:11` |

The independently generated current-constants SHA-256 values were `d45565abcdeedae9d0da36a09e843c6f5f5d2aff8269e3304034d007a7aacdeb` for the base and `88d3f1d34e1e2ee91b6661facee8fc70e4717ceee7de74060045dd7e6d046c17` for B6. These results use scripted answers and fixed token counts. Production usage feeds the spend record, so the fixture establishes accounting equivalence for those answers and usage figures. `PF/agentEndToEnd.test.js:172`, `PF/__testsupport__/agentEndToEndRun.js:43`, `PF/__testsupport__/agentEndToEndRun.js:51`, `PF/agentRun.js:514`, `Local/compare.cjs:10`.

## The six requested fixes

| Fix | Result on the candidate | Evidence |
|---|---|---|
| B6-4 · SPY after last sale | **Pass.** Monday fill 500, Tuesday close 510, Wednesday sale. Before Wednesday’s close the screen showed **+2.00% since 16 Nov** and Tuesday equity **$99,994.00**. A wrong-date or carried mark gave a dash. A live clean row kept precedence. | `PF/bookViewRead.js:201`, `PF/bookView.js:1034`, `PF/bookView.b6.test.js:302`, `PF/bookView.b6.test.js:311`, `PF/bookView.b6.test.js:320` |
| B6-5 · All three slot caps | **Pass.** Short absent, medium 50%, long 40%, cash 10% gave a null split. Omitting each other slot also withheld the split. The complete epoch gave 70% / 20% / 10%. | `PF/bookView.js:898`, `PF/bookView.b6.test.js:331`, `PF/bookView.b6.test.js:339` |
| B6-6 · Made, then removed | **Pass.** Pending request with a committed book returned 200, the original book and first epoch, with replay true. Pending and never made returned 403 with no book. A mismatched recorded identity returned 409. The new-request gate still ran. | `PF/founderControls.js:247`, `PF/founderControls.js:308`, `PF/founderControls.js:327`, `PF/ideaBook.js:69`, `PF/founderControls.b6.test.js:52`, `PF/founderControls.b6.test.js:69`, `PF/founderControls.b6.test.js:79` |
| B6-7 · Per-entry list | **Pass.** With exactly `fixture-player,bad/path`, the valid player was eligible, unrelated owners were refused, and the founder door refused the malformed owner. The parser keeps both strings, as ruled. `status` printed one warning, reported count 1 in JSON and omitted the malformed value. | `PF/playerList.js:37`, `PF/founderControls.b6.test.js:115`, `PF/founderControls.b6.test.js:124`, `scripts/practice-field-founder.mjs:528`, `scripts/practice-field-founder.mjs:774`, `Local/proof.test.mjs:180` |
| B6-8 · Late parse entry | **Pass.** On the same late JPM row, absent gave zero alerts. Stored `null` and `[]` each gave one `parse_report_missing` alert. A held symbol’s missing entry still alerted. | `scripts/practice-field-founder.mjs:453`, `PF/dailyCoverage.js:64`, `PF/dailyCoverage.js:115`, `scripts/practice-field-founder.b6.test.js:75`, `scripts/practice-field-founder.b6.test.js:91` |
| B6-9 · Deadline before prompt reads | **Pass.** Three books, one served desk, one call, three deferrals. The checked-in fixture recorded zero subsequent prompt-document reads. With saved theses enabled, the independent probe counted three further close-snapshot requests and two saved-list accesses on the base, zero of each on B6. The served desk accessed both inputs before the cutoff. | `PF/agentRun.js:352`, `PF/agentRun.js:369`, `PF/agentRun.js:402`, `PF/agentRun.b6.test.js:87`, `PF/agentRun.b6.test.js:119`, `Local/proof.test.mjs:155` |

All five printed lines underlying B4’s measurements matched byte for byte across the two commits. Examples include 7 ordinary and 7 early-close fires, all 24 desks completing 30-second calls in 4–5 fires depending on starting offset, a 50-second all-desk threshold in the two measured offset scenarios, and 148 of 300 symbols needed. The deadline applies when assembling a fresh request. A previously stored answer can still use the close snapshot to finish an admission. Q-2’s late no-call case remains as ruled. `PF/agentPassAtTwelve.test.js:159`, `PF/agentPassAtTwelve.test.js:177`, `PF/agentPassAtTwelve.test.js:199`, `PF/agentPassAtTwelve.test.js:240`, `PF/agentPassAtTwelve.test.js:295`, `PF/agentRun.js:271`, `PF/agentRun.js:558`, `PF/agentRun.b6.test.js:126`, `Local/compare.cjs:22`.

## Product diff and verification limits

I read every product hunk in the eight changed files. Two change the prompt wording and its versions, one checks time before prompt reads, two project the screen text, SPY and the split, two recover a previously committed creation, and one changes founder-script diagnostics. The four-field creation identity is the same one used by the existing transaction. The changed SPY and split code computes display values. The diff contained no changes to sizing, admission economics, entry, sales, settlement, the ledger, spend charging, the model tool, client, rules or indexes. `PF/agentConfig.js:121`, `PF/agentPrompt.js:102`, `PF/agentRun.js:352`, `PF/bookView.js:898`, `PF/bookView.js:1034`, `PF/bookViewCopy.js:73`, `PF/founderControls.js:327`, `PF/ideaBook.js:262`, `scripts/practice-field-founder.mjs:453`, `scripts/practice-field-founder.mjs:528`, `Build:382`.

- **Independently run.** Candidate Practice Field suite **1,940 passed in 69 files**. Base comparison suites **20 passed in four files**. Eight additional evidence checks completed on each tree. These capture the outputs above, including the failing acceptance rows. Candidate Linux money-rounding scan **3/3 passed**. On Windows the same scan failed two assertions on both revisions. Its walker produces native path separators while its prefix checks and assertions expect forward slashes. `Local/head-practice.log:616`, `Local/base-baseline.log:51`, `Local/head-evidence.log:10`, `Local/base-evidence.log:10`, `api/_utils/__fixtures__/mandateEvalPathClosure.js:34`, `api/_utils/__fixtures__/mandateEvalPathClosure.js:50`, `api/_utils/mandateMoneyRounding.scan.test.js:128`.
- **Builder-reported.** Full Linux suite **39,069 passed**, emulator rules **889/889**, battery **48/48**, and the two-lens/refuter outcome. The full suite includes socket-based tests, the rules command starts Firestore, and the exact mutation manifest lives in the builder’s scratchpad. The independent runs above used local fixtures, test doubles and synthetic process environments. The only remote operation in this review was `git fetch origin`. `Build:350`, `Build:354`, `Build:366`, `Build:424`, `Build:428`, `api/_utils/gemmaClient.test.js:179`, `package.json:14`, `Local/run.cjs:8`.

## Revisions and decision

| Revision | Verified Git object |
|---|---|
| Pinned base and merge base with fetched main | `a88c204a019d7521a17b1d79dcad598a1b03d143` · `.git/worktrees/astra-review-b6-pinned-base/HEAD:1` |
| Candidate and fetched B6 branch | `16c72537d487c0a5c727aa824ffaf73a5afb835f` · `.git/worktrees/astra-review-b6-pinned-head/HEAD:1` |
| Code freeze | `7a7e1c0965d891cecfbbcc644ced329747db601d`. The diff from the freeze to the candidate contains only the build report and docs index. `Build:3`, `Build:346` |
| Fetched main at review time | `a2e05fa97f537ad43b2b77d444748fd1d2dd7b50`. The review and replay comparisons use the two pinned worktrees above. `.git/refs/remotes/origin/main:1` |

**DO NOT MERGE. Books for other players: NOT READY.** The single fix round covers B6-A01 through B6-A03. Confirmation is limited to those changes, their failing rows and the adjacent controls. `PF/bookView.js:156`, `PF/bookView.js:169`, `PF/bookView.js:174`, `Local/proof.test.mjs:118`.

Report location: `C:\Users\fashr\Documents\Codex\20261127_ASTRA_REVIEW_B6.md`.
