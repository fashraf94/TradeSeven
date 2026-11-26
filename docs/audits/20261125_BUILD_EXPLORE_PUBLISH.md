# Build — Explore: the publish step (the founder's command for checking, matching and publishing stories)

**Date of the run:** Wed Nov 25, 2026 · **Base:** `origin/main` at `1cb1c627` (PR #1113's merge), after `git fetch origin main` at the start of the session · **Branch:** `claude/explore-publish` · **Builder:** Claude Code (Opus), worktree `explore-publish-command-4fc383` · **Attachments (K-0):** `docs/design/explore/20261125_EXPLORE_EDITORIAL_STANDARD_V1_4.md`, `docs/design/explore/20261125_NOTE_STORY_RECORD_V1_4.md`, committed byte for byte (SHA-256 `7b764294…` and `b10dc955…`, equal to the files received).

> **The founder's rulings, Nov 26, 2026** (§14), built in `7f4f398a`:
> - **SQ-6:** keep rule 1's number edge, as built. A quote that begins or ends inside a number in the document is not found.
> - **SQ-7:** accept decimal zeros. A value matches a number token that differs from it only by trailing zeros after the decimal point: 46 in "$46.0", 0.8 in "0.80". Nothing else loosens.
> - **SQ-5:** a question with no id, or with an id another question of the story already uses, is **refused**, not noted. Every other noted finding stays a note.
> - **SQ-8:** stays as built. An empty `leadsToStory` (null or "") is refused.
>
> Each ruling has a row and a mutant (§10). Every check was run again on the new head (§8–§10).

## 1. Verdict

| | |
|---|---|
| **What this PR is** | **Draft. Nothing is published by it.** It adds no screen and changes none. Nothing in the app calls it. It adds no route, cron, rule, index or flag, and changes nothing under `src/`. It is one command for the founder's own checkout, `scripts/explore-publish.mjs`, over server code in `api/_utils/explore/`. The command can `check` a story, `match` its quotes, store it as a `draft`, `publish` it, `unpublish` it, and show `status`. It writes the `exploreStories` collection and nothing else, and only behind the founder list and `--go`. |
| **The quote test (K-6)** | The step fetches every cited document itself, reads its text, and looks for each quote word for word under one written rule, `rule: 1`. A figure is recorded as **sourced** only if this run found its quote in text this run read. Nothing an author wrote, and nothing stored earlier, survives as a match. No model is called, anywhere. |
| **Live evidence on the pilots (K-14)** | The run on the final code confirmed **10 of the 12 sources by machine**, and **3 of the 4 carried figures** arrive as sourced. Two sources were missed. **Amazon's site** reset the connection; it is intermittent, and answered once in three runs, with the quote found. **The NextEra PDF** writes "fixed" with a ligature it does not spell out. Both are honest misses (§7, §13). |
| **The pilot records** | Both pass `check` as written. The only notes are the two stored-measure keys: the research server's list does not exist yet. |
| **Checks** | Run again after the founder's rulings, on the merged tree `7f4f398a`. **Full suite:** 1,665 files passed, 14 skipped; 38,661 rows passed; **0 failed**. **`lint:gate`:** clean. **Rules suite:** 48 files, 889 rows. **Client bundle:** byte-identical to `main`. **Baselines:** unchanged. **Mutation battery: 82 of 82 killed.** The run before the rulings, on `892ae2c3`, was green too: 38,643 rows, and 78 of 78 mutants. |
| **Review (K-15)** | Three lenses and one refuter. 43 findings were raised; 21 were confirmed and fixed, including **two blockers**. (1) An author's `match` value could survive in places the step does not write. (2) The version rule could be bypassed through unpublish and then draft. One finding was refuted. The rest were readings of the rules, each listed in §11. |
| **The founder's rulings (Nov 26)** | **SQ-6:** the number edge is kept. **SQ-7:** decimal zeros are accepted, and nothing else loosens. **SQ-5:** a question with no id, or a repeated id, is refused. **SQ-8:** stays as built. All are built and checked (§14). SQ-1 to SQ-4 are applied as their defaults. The page draws no company leads for V1.4 records; this is reported for the page's build (§15). |
| **What this session did not do** | It made no write to any real database, sent no `--go`, read no credential and called no model. Only the three live read-only `match` runs reached the network. |

## 2. What was built, in plain terms

Nothing in the repo could write an Explore story. Now the founder has one command, run from his own checkout:

```
node scripts/explore-publish.mjs <check | match | draft | publish | unpublish | status> …
```

- **`check`** reads a story file and says whether it meets the editorial standard. It refuses what the build prompt's K-4 list refuses, and it asks the page's own code (`storyOf`) whether the page would draw the story once published.
- **`match`** then fetches every source's link itself and looks for every quote in the document, word for word. It prints, source by source, whether a machine confirmed the quote, and figure by figure, whether the figure will reach an investigation as **sourced** or as **not checked**.
- **`draft`** stores the story where no player can read it. **`publish`** checks and matches again from scratch and makes it readable. **`unpublish`** takes a story back to draft in one step. **`status`** lists what is stored.

Every write needs the founder's uid on `MANDATE_FOUNDER_UIDS` and `--go`. No model and no data provider is called, nothing is added to the app, no screen changes and nothing in the app calls the command.

**The quote match is the point of the build.** A figure reaches an investigation as sourced only when this step fetched the document itself and found the quote in it, word for word, under one written rule (rule version 1). A person's reading or a model's never counts. When the step could not read a document (refused, timed out, a scanned PDF, a ligature the PDF does not spell out) the source is recorded as `read` and the founder must say yes on the command line to publish anyway.

## 3. The preamble's six findings

| # | Finding | Where |
|---|---|---|
| 1 | Branch `claude/explore-publish` cut from `origin/main` `1cb1c627c2e3e7c02e7e9de9d0ffb4ef1ab870f7`; tree clean. | VERIFIED |
| 2 | **`storyOf` returns `null` for exactly six reasons:** an id that is not a string or fails `STORY_ID` (`exploreView.js:163`); data that is not an object (`:164`); `sample` present and not `false` (`:165`); `status !== 'published'` (`:166`); a blank title, or a version that is not a safe whole number ≥ 0 (`:167–168`); no question with text (`:169–170`). **`exploreView.js` imports nothing**, so Node code may import it under BUILD_RULES §4; `storyCheck.test.js` imports it unmocked as the dependency guard and pins that its source has no import. | VERIFIED |
| 3 | **The precedent's route:** `scripts/practice-field-founder.mjs` loads credentials only in `productionDb()` (`:768–773`: `scripts/loadLocalEnv.js` `requireFirebaseCreds()` then `api/_utils/firebaseAdmin.js` `getFirebaseAdmin()`); its founder gate is `founderAllowlist()` (`api/_utils/practiceField/founderControls.js:65`, `MANDATE_FOUNDER_UIDS`, read at call time; a shell variable wins over `.env.local`, `loadLocalEnv.js:61–73`). This build uses the same functions. One difference, on purpose: the precedent opens the database before its gates (`practice-field-founder.mjs:756`); this command loads the environment file first, then checks the gates, and opens the database only at its first read — so `check` and `match` of two linked stories never open it at all. | VERIFIED |
| 4 | **PDF library: `unpdf` 1.7.0**, MIT, 2,029,109 bytes unpacked, **no dependencies** (one optional peer, `@napi-rs/canvas`, used only for rendering and not installed), bundles pdf.js 5.6.205 (Node ≥ 20.19), published 2026-07-24, integrity `sha512-MiDhbougTETO…`. A `devDependency`. It runs in-process with `isEvalSupported: false`, no font face and no URL, so it fetches nothing. **Not chosen:** `unpdf` 2.x (its `engines` require Node ≥ 24; CI runs Node 20, `.github/workflows/tests.yml:76`), `pdfjs-dist` directly (its optional dependencies install a native canvas binary). | VERIFIED |
| 5 | **The fixed list of stored measures does not exist yet.** No module in `api/`, `src/` or `scripts/` holds one, and `src/constants/compareMeasures.js` (where the Work an idea chat says it will live) is not on `main`. Per K-4(l) and the chat's addition 3, each `storedKey` is **noted** "not checked: the list is not built yet", and the check takes the list as an argument (`checkStories(…, { storedKeys })`): given a list, a key not on it is refused. | VERIFIED |
| 6 | **Baselines** (WSL, `TZ=UTC`, 8 workers, at `1cb1c627`): `src/components/Explore/` 9 files passed + 1 skipped = **233 passed, 18 skipped** (`exploreView.test.js` 59, `explore.guard.test.js` 50, `explore.screens.jsdom` 45, `explore.review.jsdom` 26, `explore.sheet.jsdom` 19, `explore.founder.jsdom` 17, `explore.page.jsdom` 14, `__fixtures__/exploreReads.test.js` 2, `explore.requests.jsdom` 1, `explore.browser.test.js` 18 skipped); `scripts/practice-field-founder.test.js` **82**; `test/rules/exploreBookmarks.rules.mjs` **35**. | VERIFIED |

## 4. Routine choices made here

1. **A story file's name is its document id.** `ai-buildout.json` is the story `ai-buildout`. The pilot records carry no id, and K-13 wants them word for word, so the id cannot live in the file.

2. **One transaction for a set, not a write batch** (K-11 says "written in one batch"). The stories are read and planned again inside the transaction, then written in its single commit, or not at all. This is stronger than a batch: the version rule is decided on what is stored at the moment of the write.

3. **Where the dates come from.**
   - `publishedAt` and `revisedAt` come from Firestore's server clock (`FieldValue.serverTimestamp()`), so they are true timestamps the page's query can order by.
   - `readAt` is the time this machine received the document (ISO).
   - `documentDate` is an ISO instant when the document names its zone, otherwise its calendar date `YYYY-MM-DD` (item 10).

4. **The version rule covers any write over a story that was ever published,** a draft included (review A4/S1). Over such a story:
   - a lower version is refused;
   - the same version with different content is refused ("raise the version"), because a saved thesis keeps the story version it was built on;
   - the same content at the same version is allowed again.

   A draft that was never published may be overwritten freely. A draft is never written over a story that is published now (SQ-4).

5. **What "existing" means for links (K-4(e)).**
   - For `check`, `match` and `draft`: among the files, or stored in any status.
   - For `publish`: among the files, or **published**. A deep story's way back must lead to a story players can read, and an overview's door must open one. That is why an overview and its deep story can be published together in one command.

6. **The word count (K-4(d))** counts every whitespace-separated token that holds a letter or a digit, over all paragraphs. A body written as one string is counted too. "$51.4" is a word; a spaced dash is not. The pilots count 136 and 261.

7. **K-7's whole-number token.** It is read under the word-for-word rule (review H3), so the check and the match read the same string.
   - Digits glued to a letter before them are a label ("Q1", "FY2027"), not a number.
   - Digits after a decimal point are a fraction (".5%" holds no 5).
   - Digits before a fraction slash belong to the fraction ("5½" holds no 51).
   - A negative value must be written as negative: a minus or hyphen that does not follow a letter or digit, or accounting parentheses. A currency sign may sit between ("-$5", "($110)"). So "12-18 months" is a range.
   - The decimals are as given, except for trailing zeros after the decimal point (the founder's ruling SQ-7): `46` is found in "$46.0" and in "$46.00", and `0.8` in "0.80". Nothing else loosens: `46` is not found in "460" or "46.01".

8. **"The same currency" in the two formulas.** A unit names its currency first: a code ("USD millions"), a sign ("$ millions") or a word ("US dollars, millions"). A unit with none cannot be in the same currency as anything, so a `ratio` of two `GW` figures is refused.

9. **What counts as a page's visible text.**
   - jsdom parses the page with scripting off and no resource loading. Pages are walked by sibling links without recursion, and a page past 1 M elements is refused.
   - These are not visible text: `script`, `style`, `noscript`, `template`, `head`, `iframe`, `object`, `embed`, and any element with the `hidden` attribute or an inline style of display none or visibility hidden.
   - A space is put at the edges of every block, every table cell, and every superscript and subscript. So a table row reads "Revenue $ 3,661 $ 1,365", and a footnote mark never joins the figure before it.
   - Text hidden by a style sheet class is still read. This is a stated limit.
   - A PDF is a PDF whatever the server calls it: the `%PDF-` signature is read first. PDFs are read in a worker thread with a 1,024 MB heap and 60 s, and refused past 2,000 pages or 20 M characters (review S3).

10. **A document's own date.**
    - A page's comes from its published-time tags only: `article:published_time` and twelve similar names, then `<time itemprop="datePublished">`.
    - A PDF's comes from its `CreationDate`.
    - It is never read in this machine's time zone (review H9).
    - The `Last-Modified` header is the server's date, not the document's, and is not used.

11. **Every non-public address is refused,** not only private, loopback and link-local:
    - shared, multicast and reserved ranges;
    - documentation and benchmarking ranges, `3fff::/20` included;
    - ORCHIDv2, IPv4 mapped into IPv6, 6to4, Teredo, and the old 6to4 relay.

    A host is refused if any one of its addresses is not public. The connection is made to the checked address, because the request's own `lookup` is the checked one.

12. **The fetch limits.**
    - 20 seconds per document, redirects included.
    - 20 MB, counted both as received and after decompression.
    - The body of a redirect or of any non-2xx answer is destroyed, and the request is aborted once the fetch returns (review S2).
    - The user agent is `FantasyTrades-ExplorePublish/1 (+<contact>)`, with the contact read from `EXPLORE_PUBLISH_CONTACT`.

13. **Findings beyond K-4's letter are noted, never refused,** per the founder's "build the letter" ruling. The one exception is the founder's ruling SQ-5: a question with no id, or with an id another question already uses, is refused. Examples of notes:
    - a source that nothing cites;
    - a missing `wrongIfSeed` or `watch`;
    - connection and question counts outside §2's ranges;
    - a benchmark that is not one of the idea book's funds;
    - the featured group not first in `tickers`;
    - a one-sided link from an overview;
    - the banned words;
    - a question over 120 characters;
    - a stored measure carrying its own label;
    - the date check.

    The review turned five of these into refusals, where the letter or the integrity of a match needed it: two sources sharing an id, a company or stored key named twice, a measure of neither kind, a result on a computed cell, and a specific question's group outside the list. The founder's SQ-5 added the sixth, the question id. Every other note stays a note.

14. **The fixture PDFs are marked `binary`** in `.gitattributes`, one narrow line. They are built byte by byte, and their cross-reference table holds byte offsets, which a line-ending conversion on checkout would break.

## 5. The commands, with examples

Every command takes `--uid <uid>` and `--json`. Exit codes: 0 done; 2 refused (a gate, the check, an unmatched quote, the version rule, or no `--go`); 1 failed.

The outputs below are real runs of the command at the final head, on the in-memory database the tests use, with the fixture fetcher (pages holding every quote; in this run the Microsoft and Amazon links answer 403). Long lines are cut.

**`status`** — reads the collection only.
```
$ node scripts/explore-publish.mjs status --uid <uid>
founder        yes   (MANDATE_FOUNDER_UIDS, this machine)

collection     exploreStories: 0 stories
(exit 0)
```

**`check`** — no fetch, no write; the collection is read only for a story a file links to that is not among the files (here, none).
```
$ node scripts/explore-publish.mjs check --file ai-buildout.json --file dominion-data-centers.json --uid <uid>
founder        yes   (MANDATE_FOUNDER_UIDS, this machine)

STORY ai-buildout   overview   version 5   0 refused, 0 unmatched, 2 noted
  NOTED     K-4(l)  questions[0].measures[1].storedKey = "revenueGrowthYOY" — not checked: the list is not built yet (src/constants/compareMeasures.js)
  NOTED     K-4(l)  questions[0].measures[2].storedKey = "fcfMargin" — not checked: the list is not built yet (src/constants/compareMeasures.js)

STORY dominion-data-centers   deep   version 1   0 refused, 0 unmatched, 0 noted
(exit 0)
```

**`match`** — check, then fetch each link once and look for every quote; the report per source (link, type, `by`, the reason when `read`, the dates, the author's `dated`), per figure, and the summary. §7 has the live run in full.

**`draft --go`** — check, match, then store both as drafts (`publishedAt: null`). Without `--go` it prints each document it would write and stops (exit 2).

**`publish`** — matches AFRESH (here, from the stored drafts by `--id`) and refuses while a quote is unmatched:
```
$ node scripts/explore-publish.mjs publish --id ai-buildout --id dominion-data-centers --uid <uid> --go
founder        yes   (MANDATE_FOUNDER_UIDS, this machine)
contact        set   (EXPLORE_PUBLISH_CONTACT, for the user agent)
REFUSED (unmatched): ai-buildout: a quote was not confirmed by machine. Nothing was written. To publish anyway, add --accept-unmatched: each figure below then arrives in an investigation as not checked.
read           exploreStories: ai-buildout, dominion-data-centers

STORY ai-buildout   overview   version 5   0 refused, 4 unmatched, 9 noted
  UNMATCHED K-8     sources[3] = "https://microsoft.com/en-us/investor/earnings/fy-2027-q1/press-release-webcast" — by 'read': the server answered 403
  UNMATCHED K-8     sources[4] = "https://aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report" — by 'read': the server answered 403
  UNMATCHED K-8     questions[0].measures[0].cells[0].matched = "Azure revenue increased 48%" — not found in source "s4" (https://microsoft.com/…): the server answered 403; it will arrive in an investigation as not checked
  UNMATCHED K-8     questions[0].measures[0].cells[1].matched = "AWS segment sales increased 39% …" — not found in source "s5" (https://aboutamazon.com/…): the server answered 403; …
  NOTED     K-11    sources[0].match, … = null — the record arrived with match results (written in the file, or stored by an earlier run); this step never keeps one: …
  …
(exit 2)
```

**`publish --accept-unmatched --go`** — publishes, and says so for each unmatched figure:
```
ACCEPTED UNMATCHED  ai-buildout cloud-leaders/Cloud growth MSFT: published unmatched (--accept-unmatched): this figure will arrive in an investigation as not checked
ACCEPTED UNMATCHED  ai-buildout cloud-leaders/Cloud growth AMZN: published unmatched (--accept-unmatched): this figure will arrive in an investigation as not checked

WRITTEN  ai-buildout   replace: first publish (the stored draft is replaced)

WRITTEN  dominion-data-centers   replace: first publish (the stored draft is replaced)
STORED   ai-buildout   published   publishedAt 2026-11-25T17:00:00.000Z
STORED   dominion-data-centers   published   publishedAt 2026-11-25T17:00:00.000Z
(exit 0)
```
Run again unchanged, each story is `NO CHANGE … already published at version 5 with this content: nothing is written`, and `KEPT AS STORED` says the stored match results stay and this run's match is not recorded (raise the version to record a fresh one).

**`status`** after the publish:
```
ai-buildout   overview   published   version 5   published 2026-11-25T17:00:00.000Z
  The AI buildout: who gets paid, and in what order
  door           power → dominion-data-centers
  match          7 sources: 5 by machine, 2 read; figures: 2 of 4 sourced

dominion-data-centers   deep   published   version 1   published 2026-11-25T17:00:00.000Z
  Dominion has 54 GW of data centers on paper and 4.8 GW on the meter
  way back       ai-buildout / power
  match          5 sources: 5 by machine, 0 read; figures: 0 of 0 sourced
```

**`unpublish`** — without `--go`, then with it:
```
$ node scripts/explore-publish.mjs unpublish --id dominion-data-centers --uid <uid>
founder        yes   (MANDATE_FOUNDER_UIDS, this machine)
REFUSED (go): not written: add --go to write it
NOTED     "ai-buildout" is published and links to a story being unpublished; it stays published

WOULD WRITE  dominion-data-centers   unpublish: back to draft: players can no longer read it
{
  "status": "draft"
}
(exit 2)

$ node scripts/explore-publish.mjs unpublish --id dominion-data-centers --uid <uid> --go
…
WRITTEN  dominion-data-centers   unpublish: back to draft: players can no longer read it
(exit 0)
```

**A uid not on the founder list** reads nothing:
```
$ node scripts/explore-publish.mjs status --uid someone-else
founder        no   (MANDATE_FOUNDER_UIDS, this machine)
REFUSED (founder): the uid is not on MANDATE_FOUNDER_UIDS in this machine's environment (.env.local): nothing was read
(exit 2)
```

## 6. Every K-4 rule and its row

Each row starts from a pilot record, breaks exactly one thing, and asserts the exact list of refusals on that story, each naming its field (`api/_utils/explore/storyCheck.test.js`, "every K-4 rule refuses …").

| K-4 | One thing broken | Refused, on that story (rule · field) |
|---|---|---|
| (a) | deep story: a blank title | K-4(a) `title` |
| (a) | overview: version 5.5 | K-4(a) `version` |
| (a) | deep story: no question with text | K-4(a) `questions` |
| (a) | deep story filed as `dominion data centers.json` (an id the page refuses) | K-4(a) `id`; K-4(e) `parent.connectionId` (the overview's door names the real id) |
| (b) | `sample: true` | K-4(b) `sample` |
| (b) | `sample: false` (the page would draw it; the step refuses any value) | K-4(b) `sample` |
| (c) | `kind` missing | K-4(c) `kind` |
| (c) | `kind: 'feature'` | K-4(c) `kind` |
| (d) | overview body at 151 words | K-4(d) `body` |
| (d) | deep-story body at 301 words | K-4(d) `body` |
| (e) | deep story without `parent` | K-4(e) `parent` |
| (e) | `parent.storyId` names no story | K-4(e) `parent.storyId` |
| (e) | `parent.storyId` names a deep story | K-4(e) `parent.storyId` |
| (e) | `parent.connectionId` names no connection of the overview | K-4(e) `parent.connectionId` |
| (e) | the parent connection's `leadsToStory` removed | K-4(e) `parent.connectionId` |
| (e) | overview `leadsToStory` names no story | K-4(e) `connections[chips].leadsToStory` |
| (e) | overview `leadsToStory` names an overview | K-4(e) `connections[cloud].leadsToStory` |
| (f) | a ticker outside `ALL_TICKERS` | K-4(f) `tickers[9]` |
| (f) | a retired ticker | K-4(f) `tickers[9]` |
| (f) | eleven tickers | K-4(f) `tickers` |
| (f) | an `about` symbol outside the list | K-4(f) `about[0].symbol` |
| (f) | a lead symbol outside the list | K-4(f) `connections[3].leads[0].symbol` |
| (f) | a group symbol outside the list (its lead and cell renamed with it) | K-4(f) `connections[1].leads[4].symbol`; K-4(f) `questions[0].group[3].symbol` |
| (g) | a connection without `id` | K-4(g) `connections[2].id` |
| (g) | a repeated connection `id` | K-4(g) `connections[3].id` |
| (g) | `basis: 'supported'` | K-4(g) `connections[0].basis` |
| (g) | a blank `unknown` | K-4(g) `connections[1].unknown` |
| (g) | `whereToLook` missing | K-4(g) `connections[2].whereToLook` |
| (g) | "Source cited" with no `sourceIds` | K-4(g) `connections[0].sourceIds` |
| (g) | no unsourced connection left | K-4(g) `connections` |
| (h) | a connection cites `s9`, which does not exist | K-4(h) `connections[0].sourceIds[3]` |
| (h) | a cell cites `s9` | K-4(h) `questions[0].measures[0].cells[0].sourceId` |
| (h) | an input cites `s8` | K-4(h) `…cells[3].inputs[1].sourceId` |
| (h) | a source with no `url` | K-4(h) `sources[4].url` |
| (h) | a source on `http` | K-4(h) `sources[3].url` |
| (i) | two featured questions | K-4(i) `questions` |
| (i) | no featured question | K-4(i) `questions` |
| (i) | `fromConnection` names no connection | K-4(i) `questions[2].fromConnection` |
| (i) | `shape: 'why'` | K-4(i) `questions[1].shape` |
| (j) | a group of two | K-4(j) `questions[0].group` |
| (j) | a group of nine | K-4(j) `questions[0].group` |
| (j) | a group company that is not a lead of the question's connection | K-4(j) `questions[0].group[0].symbol` |
| (j) | two measures | K-4(j) `questions[0].measures` |
| (j) | six measures | K-4(j) `questions[0].measures` |
| (j) | one stored measure | K-4(j) `questions[0].measures` |
| (j) | a reported measure missing a group company's cell | K-4(j) `questions[0].measures[0].cells` |
| (j) | a cell for a company outside the group | K-4(j) `questions[0].measures[0].cells[4].symbol` |
| (k) | a stated figure not inside its excerpt (49 in "Azure revenue increased 48%") | K-7 `…cells[0].value` |
| (k) | an input's figure not inside its excerpt | K-7 `…cells[3].inputs[0].value` |
| (k) | `formula: 'difference'` | K-4(k) `…cells[3].formula` |
| (k) | one input for `growth_from_year_ago` | K-4(k) `…cells[3].inputs` |
| (l) | a blank `storedKey` | K-4(l) `questions[0].measures[1].storedKey` |

The founder's SQ-5 (Nov 26) adds two refusals, under rule `SQ-5`: a question with no id (missing, blank, or not a string), and an id another question of the story already uses. Five rows are in `review.test.js`. Beside these 53 rows: the limits exactly (150 and 300 words, ten tickers, three companies, five measures) pass; a lead with `symbol: null` passes; a deep story checked alone reads its parent from the collection, and a publish counts only a published parent ("publish them together"); two files naming one id are refused; K-7's 20 token rows; the two formulas' ten rows (addition 2); the stored-measure list's two rows (addition 3).

## 7. The live match on the two pilot records (K-14)

Real runs, read-only, over the network, of `match` on both pilot files as committed (`api/_utils/explore/__fixtures__/pilot/`):

```
MANDATE_FOUNDER_UIDS=k14-build-session EXPLORE_PUBLISH_CONTACT=explore-publish@example.com \
node scripts/explore-publish.mjs match --file …/ai-buildout.json --file …/dominion-data-centers.json --uid k14-build-session --json
```

None wrote anything. **The database was never opened**: both stories were given together, so every link resolved among the files. No credential was read, because this worktree has no `.env.local`. The contact is a placeholder on purpose: this build session may not put the founder's own address into requests to outside sites, and his runs use his own. The prompt asked for one run. The review round changed the matching rule twice, so the run was repeated on the code as it then stood, and the last run is the evidence of record:

| Run | Code | When (UTC) | Sources by machine | Carried figures sourced | What moved |
|---|---|---|---|---|---|
| 1 | `defe7581` (before the review) | 2026-11-26 05:24 | 10 of 12 | 3 of 4 | — |
| 2 | `01db6180` (after the honesty, agreement and safety fixes) | 06:05 | **11 of 12** | **4 of 4** | Amazon's newsroom answered this time, and its quote was found |
| 3 | **`892ae2c3`, the final code** | 06:29 | **10 of 12** | **3 of 4** | Amazon reset the connection again |

**The evidence of record (run 3):** 10 of the 12 sources were confirmed by machine, and 3 of the 4 carried figures arrive as sourced. Nine distinct links were fetched, once each; Dominion's PJM presentation serves four sources across the two stories. The only thing that differs between the runs is Amazon's site, which reset the connection in two of three runs and answered in one. Nothing in the code decides that.

| Story | Source | Document | `by` | Why, when `read` | Document's own date |
|---|---|---|---|---|---|
| ai-buildout | s1 | NVIDIA release (HTML) | **machine** | | none found |
| ai-buildout | s2 | Alphabet 10-Q (PDF) | **machine** | | 2026-10-29 |
| ai-buildout | s3 | Dominion to PJM (PDF) | **machine** | | none found |
| ai-buildout | s4 | Microsoft release (HTML, one redirect to `www.`) | **machine** | | none found |
| ai-buildout | s5 | Amazon release (HTML, one redirect to `www.`) | read | `www.aboutamazon.com` reset the connection (ECONNRESET); in run 2 it answered and the quote was found | (run 2: 2026-10-29) |
| ai-buildout | s6 | Oracle release (HTML) | **machine** | | none found |
| ai-buildout | s7 | CoreWeave release (HTML): the table row "Revenue $ 3,661 $ 1,365" | **machine** | | none found |
| dominion-data-centers | s1–s3 | Dominion to PJM (PDF), three quotes | **machine** ×3 | | none found |
| dominion-data-centers | s4 | Virginia SCC final order (PDF) | **machine** | | 2025-11-25 |
| dominion-data-centers | s5 | NextEra–Dominion joint release (PDF) | read | It was read, but the quote is not in its text. The PDF draws "fi" in "fixed" as one ligature glyph with no letter mapping, so the text reads "a ␀xed exchange ratio of 0.8138 shares…". This was checked by hand from this machine (§13). | 2026-05-18 |

| Carried figure (ai-buildout, "Cloud leaders", Cloud growth) | Run 3 |
|---|---|
| MSFT 48 (s4) | found → **sourced** |
| AMZN 39 (s5) | not fetched → **not checked** (found in run 2) |
| ORCL 121 (s6) | found → **sourced** |
| CRWV growth from 3,661 and 1,365 (s7, both inputs) | both found → **sourced** |

The deep story carries no figures, because its questions are specific. Its one unmatched source means `publish` refuses it without `--accept-unmatched`, and the overview too, whenever Amazon resets. **The date check** passes for every document that carries its own date. The other seven sources are noted "no date was found in the document itself: check `dated` by hand".

The founder's rulings of Nov 26 (SQ-5, SQ-7) change the check, not the matcher. `matchRule.js`, `matchStory.js`, `fetchSource.js` and the extraction are byte-identical between `892ae2c3` and `7f4f398a`, so run 3 stands as the evidence of record. Both pilots still pass `check`.

The full text report of run 3, as the command prints it:

```
founder        yes   (MANDATE_FOUNDER_UIDS, this machine)
contact        set   (EXPLORE_PUBLISH_CONTACT, for the user agent)

STORY ai-buildout   overview   version 5   0 refused, 2 unmatched, 8 noted
  UNMATCHED K-8     sources[4] = "https://aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report" — by 'read': the request failed (ECONNRESET: read ECONNRESET)
  UNMATCHED K-8     questions[0].measures[0].cells[1].matched = "AWS segment sales increased 39% year-over-year to $46.0 billion." — not found in source "s5" (https://aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report): the request failed (ECONNRESET: read ECONNRESET); it will arrive in an investigation as not checked
  NOTED     K-4(l)  questions[0].measures[1].storedKey = "revenueGrowthYOY" — not checked: the list is not built yet (src/constants/compareMeasures.js)
  NOTED     K-4(l)  questions[0].measures[2].storedKey = "fcfMargin" — not checked: the list is not built yet (src/constants/compareMeasures.js)
  NOTED     standard §4 sources[0].dated = "Nov 2026" — no date was found in the document itself: check `dated` by hand
  NOTED     standard §4 sources[2].dated = "Sep 2026" — no date was found in the document itself: check `dated` by hand
  NOTED     standard §4 sources[3].dated = "Oct 2026" — no date was found in the document itself: check `dated` by hand
  NOTED     standard §4 sources[4].dated = "Oct 2026" — no date was found in the document itself: check `dated` by hand
  NOTED     standard §4 sources[5].dated = "Sep 2026" — no date was found in the document itself: check `dated` by hand
  NOTED     standard §4 sources[6].dated = "Nov 2026" — no date was found in the document itself: check `dated` by hand
  sources
    s1   machine  html, read 2026-11-26T06:30:02.037Z, no document date, source says Nov 2026
         https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Third-Quarter-Fiscal-2027/default.aspx
    s2   machine  pdf, read 2026-11-26T06:30:03.186Z, document dated 2026-10-29T00:26:35.000Z, source says Oct 2026
         https://s206.q4cdn.com/479360582/files/doc_financials/2026/q3/GOOG-10-Q-Q3-2026.pdf
    s3   machine  pdf, read 2026-11-26T06:30:06.546Z, no document date, source says Sep 2026
         https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf
    s4   machine  html, read 2026-11-26T06:30:07.844Z, no document date, source says Oct 2026, 1 redirect(s)
         https://microsoft.com/en-us/investor/earnings/fy-2027-q1/press-release-webcast
    s5   read     nothing received, no document date, source says Oct 2026, 1 redirect(s)
         why: the request failed (ECONNRESET: read ECONNRESET)
         https://aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report
    s6   machine  html, read 2026-11-26T06:30:10.644Z, no document date, source says Sep 2026
         https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Q1-Results-Driven-by-Triple-Digit-Growth-in-Cloud-Infrastructure-Revenues/default.aspx
    s7   machine  html, read 2026-11-26T06:30:12.007Z, no document date, source says Nov 2026
         https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Third-Quarter-2026-Results/default.aspx
  carried figures
    MSFT   48       from s4: found → arrives as sourced
    AMZN   39       from s5: NOT found → arrives as not checked
    ORCL   121      from s6: found → arrives as sourced
    CRWV   growth_from_year_ago: 3661 from s7 found; 1365 from s7 found → arrives as sourced
  summary        4 carried figure(s): 3 will arrive as sourced, 1 as not checked

STORY dominion-data-centers   deep   version 1   0 refused, 1 unmatched, 3 noted
  UNMATCHED K-8     sources[4] = "https://s205.q4cdn.com/611413639/files/doc_news/NextEra-Energy-and-Dominion-Energy-to-Combine-Creating-the-Worlds-Largest-Regulated-Electric-Utility-Business-and-North-Americas-Prem-UUH80.pdf" — by 'read': the excerpt was not found word for word in the document's text
  NOTED     standard §4 sources[0].dated = "Sep 2026" — no date was found in the document itself: check `dated` by hand
  NOTED     standard §4 sources[1].dated = "Sep 2026" — no date was found in the document itself: check `dated` by hand
  NOTED     standard §4 sources[2].dated = "Sep 2026" — no date was found in the document itself: check `dated` by hand
  sources
    s1   machine  pdf, read 2026-11-26T06:30:06.546Z, no document date, source says Sep 2026
         https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf
    s2   machine  pdf, read 2026-11-26T06:30:06.546Z, no document date, source says Sep 2026
         https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf
    s3   machine  pdf, read 2026-11-26T06:30:06.546Z, no document date, source says Sep 2026
         https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf
    s4   machine  pdf, read 2026-11-26T06:30:15.431Z, document dated 2025-11-25T17:58:08.000Z, source says Nov 2025
         https://npr.brightspotcdn.com/b6/ac/706130b64d2b8eee6a9832b97e48/20251125-virginiascc-dominionenergyruling.pdf
    s5   read     pdf, read 2026-11-26T06:30:17.255Z, document dated 2026-05-18T11:46:53.000Z, source says May 2026
         why: the excerpt was not found word for word in the document's text
         https://s205.q4cdn.com/611413639/files/doc_news/NextEra-Energy-and-Dominion-Energy-to-Combine-Creating-the-Worlds-Largest-Regulated-Electric-Utility-Business-and-North-Americas-Prem-UUH80.pdf
  summary        0 carried figure(s): 0 will arrive as sourced, 0 as not checked
```

## 8. Tests, suite and baselines

All final checks ran on the final code head `7f4f398a`, which carries the founder's rulings of Nov 26. They had also all passed on `892ae2c3`, before the rulings: 38,643 rows, 78 of 78 mutants, and the bundle identical. That head is the merged tree: `origin/main` was fetched again before the runs and is still `1cb1c627`, which the branch contains.

**How they ran:** in WSL, in a private worktree of `~/pd-ci` (`~/pd-expub`), with Node 20.20.2, `TZ=UTC` and 8 workers, the full suite under `flock /tmp/pd-suite.lock`, and a fresh `npm ci` for this branch's lockfile. The worktree was made afresh for the re-run.

| Check | Result |
|---|---|
| Full suite (`npx vitest run --maxWorkers=8`) | **Test Files 1,665 passed, 14 skipped (1,679). Tests 38,661 passed, 197 skipped (38,858). 0 failed.** Exit 0. |
| `npm run lint:gate` | Exit 0 |
| `npm run test:rules` (Firestore emulator, JDK 21) | **48 files, 889 tests passed.** Exit 0 |
| `vite build`, minified, of `main` and of this head | Both exit 0. See §9. |

**The new test files (396 rows).**

| File | Rows |
|---|---|
| `api/_utils/explore/storyCheck.test.js` | 113 |
| `review.test.js` | 120 |
| `fetchSource.test.js` | 58 |
| `matchStory.test.js` | 29 |
| `matchRule.test.js` | 22 |
| `scripts/explore-publish.test.js` | 54 |

**The preamble's baselines are unchanged.** Each count below is the same as at `1cb1c627`.

| File | Rows |
|---|---|
| `exploreView.test.js` | 59 |
| `explore.guard.test.js` | 50 |
| `explore.screens.jsdom` | 45 |
| `explore.review.jsdom` | 26 |
| `explore.sheet.jsdom` | 19 |
| `explore.founder.jsdom` | 17 |
| `explore.page.jsdom` | 14 |
| `__fixtures__/exploreReads.test.js` | 2 |
| `explore.requests.jsdom` | 1 |
| `explore.browser.test.js` | 18 skipped |
| `scripts/practice-field-founder.test.js` | 82 |
| `test/rules/exploreBookmarks.rules.mjs` | 35 |

**One guard reddened on the way, and was fixed in its own commit, `84b25ecd`.**
- **The guard:** the early full suite, before the review, failed one row. `compositionProtectedStores.scan.test.js`, "DENY-BY-DEFAULT", lists every unresolved write site in `api/` and `scripts/`.
- **The fix:** the writer's two sites are on `compositionProtectedStoresAllowlist.json` at count 1, with notes:
  - `storyWriter.js` `commitSet` (one `tx.set` on `exploreStories/{id}`);
  - `commitUnpublish` (one `tx.update`, `status: 'draft'`).

**`git diff --stat origin/main`.**
- 31 files, +5,262/−1, before this report.
- Nothing under `src/`.
- Nothing under `src/components/SharedResearch/`, `src/components/CommandCenter/` or `api/forge/`.
- No `vercel.json`, rule, index or flag.
- No route: every new file is under `api/_utils/`, which Vercel does not serve, or `scripts/`.

## 9. The bundle

**The client bundle is byte-identical to `main`'s.** Both builds ran in the same tree and from the same install: `main` at `1cb1c627`, and the final code at `892ae2c3`. Every one of the 125 files in `dist/` has the same SHA-256 in both.

It was not identical before the review. The early comparison at `84b25ecd` showed every chunk renamed. The cause was one CSS rule, `.table-cell{display:table-cell}`. Tailwind v4 scans `api/` too, and it had read the word "table-cell" in a comment in `extractText.js`. The safety lens confirmed this independently (S4). The comment was reworded, and no other word in the new files mints a rule.

Nothing under `src/` imports this code or `unpdf`. A row in `scripts/explore-publish.test.js` pins that. `unpdf` is a `devDependency` used only by `pdfText.js`, which only the command reaches.

The report commit is checked again on the pushed head (§17).

## 10. The mutation table

**82 of 82 mutants killed; none survived, none broken, none crashed, none skipped** (the runner's defined ids against the ids it ran: 0 missing).

The battery ran at `7f4f398a` in the WSL tree. Each mutant is one exact-string replacement in one file, and its anchor must occur exactly once (otherwise BROKEN, and the mutant is not run). It runs only the test files named. It is KILLED only on a non-zero exit with failed rows. The file is then restored from its saved bytes and checked by SHA-256. The tree was clean before and after (`git status`).

M01–M18 are the build prompt's eighteen. A1–A4 cover the three additions and the invariant. X01–X18 are further guards. R-* cover the review round's fixes. R-SQ7a/b and R-SQ5a/b cover the founder's rulings of Nov 26; SQ-6 is guarded by R-H2a/b, and SQ-8 by R-A12.

| Id | Mutant | Files run | Result | First failing row |
|---|---|---|---|---|
| M01 | a source is recorded 'machine' when the fetch failed | matchStory.test.js | KILLED (8 failed) | a page whose text sits only inside a script → https://ir.example.com/script-only |
| M02 | the author's matched: true survives (the matcher keeps it) | matchStory.test.js | KILLED (1 failed) | the author's match and matched never survive: removed by the check, and never kept if handed in anyway |
| M02b | the author's matched survives the check (not removed) | storyCheck.test.js, review.test.js, explore-publish.test.js | KILLED (5 failed) | review H4: a no-op keeps the stored story and its match, and says so — no "will arrive as not checked" for it |
| M03 | the rule is applied to the quote but not to the text | matchStory.test.js | KILLED (4 failed) | the page's curly quotes, en dash and non-breaking space, quoted with straight ones and a hyphen → https://ir.e |
| M04 | matching ignores case | matchRule.test.js, matchStory.test.js | KILLED (2 failed) | case changed → cloud revenue increased 48% |
| M05 | a quote found only inside a script counts | matchStory.test.js | KILLED (2 failed) | a page whose text sits only inside a script → https://ir.example.com/script-only |
| M06 | a private address is fetched (10/8 passes the address check) | fetchSource.test.js, matchStory.test.js | KILLED (5 failed) | 10.0.0.5 → public false |
| M06b | a private address is fetched (the lookup checks nothing) | fetchSource.test.js, matchStory.test.js | KILLED (5 failed) | a host is refused when ANY address it resolves to is not public |
| M07 | publish reuses a stored match | explore-publish.test.js | KILLED (1 failed) | publish --id matches the stored story AFRESH: a stored match is never reused |
| M08 | an unmatched story publishes without the flag | explore-publish.test.js | KILLED (2 failed) | an unmatched story is refused without --accept-unmatched: every unmatched quote listed, nothing written |
| M09 | a writing command writes without --go (draft, publish) | explore-publish.test.js | KILLED (1 failed) | without --go prints exactly what it would write, and writes nothing |
| M09b | unpublish writes without --go | explore-publish.test.js | KILLED (1 failed) | unpublish: the one-step way back; publishedAt kept; published again later at the same version, revisedAt set |
| M10 | a story storyOf drops is published | storyCheck.test.js | KILLED (4 failed) | K-4(a): a blank title |
| M11 | a sample field is accepted | storyCheck.test.js, explore-publish.test.js | KILLED (3 failed) | a story the check refuses writes nothing and fetches nothing |
| M12 | a ticker outside ALL_TICKERS is accepted | storyCheck.test.js | KILLED (5 failed) | K-4(f): a ticker outside ALL_TICKERS |
| M13 | a deep story publishes with no parent link | storyCheck.test.js | KILLED (1 failed) | K-4(e): a deep story without a parent |
| M14 | a broad question with one stored measure is accepted | storyCheck.test.js | KILLED (1 failed) | K-4(j): one stored measure |
| M15 | a cell's figure outside its quote is accepted | storyCheck.test.js | KILLED (13 failed) | K-4(k): a stated cell whose figure is not inside its excerpt |
| M16 | the same version with different content overwrites | explore-publish.test.js | KILLED (1 failed) | the same version with different content is refused ("raise the version"), and nothing in the set is written |
| M17 | publishedAt moves on a later version | explore-publish.test.js | KILLED (2 failed) | a higher version is written: publishedAt kept from the first publish, revisedAt set now |
| M18 | the command writes to another collection | explore-publish.test.js | KILLED (12 failed) | check on the deep story alone reads its parent from the collection; with no parent there, it is refused |
| A1 | addition 1: a match block without the rule's version | matchStory.test.js | KILLED (7 failed) | a refusal: by 'read', nothing recorded as read, the reason in the report |
| A1b | addition 1: the rule's version is not 1 | matchRule.test.js, matchStory.test.js, explore-publish.test.js | KILLED (8 failed) | with --go stores both as drafts with this run's match results, in exploreStories alone |
| A2a | addition 2: a third formula is accepted | storyCheck.test.js | KILLED (2 failed) | K-4(k): an unknown formula |
| A2b | addition 2: growth_from_year_ago in two units | storyCheck.test.js | KILLED (1 failed) | growth_from_year_ago in two units |
| A2c | addition 2: growth_from_year_ago over one period | storyCheck.test.js | KILLED (1 failed) | growth_from_year_ago over one period |
| A2d | addition 2: a year-ago figure of zero | storyCheck.test.js | KILLED (1 failed) | growth_from_year_ago with a year-ago figure of zero |
| A2e | addition 2: a ratio over two periods | storyCheck.test.js | KILLED (1 failed) | ratio over two periods |
| A2f | addition 2: a ratio across currencies | storyCheck.test.js | KILLED (2 failed) | ratio across two currencies |
| A2g | addition 2: a ratio's denominator of zero | storyCheck.test.js | KILLED (1 failed) | ratio with a denominator of zero |
| A2h | addition 2: a computed cell carrying its result (under any name) | storyCheck.test.js, review.test.js | KILLED (2 failed) | K-4(k), on the extra key |
| A3a | addition 3: a key off the given list passes | storyCheck.test.js | KILLED (1 failed) | with the list, a key not on it is refused, and a key on it passes without a note |
| A3b | addition 3: without the list a key passes silently | storyCheck.test.js | KILLED (3 failed) | pass check together (links: any), with only the stored keys noted |
| A4 | invariant: matched without readAt and textHash | matchStory.test.js | KILLED (1 failed) | INVARIANT: a cell or input is matched only on a source whose readAt and textHash are both set |
| X01 | a redirect is not checked again | fetchSource.test.js | KILLED (1 failed) | a redirect to an http link is refused |
| X02 | redirects are not capped | fetchSource.test.js | KILLED (1 failed) | more than 5 redirects are refused |
| X03 | the size limit is not applied | fetchSource.test.js, matchStory.test.js | KILLED (2 failed) | a document over the size limit is refused |
| X04 | the time limit is a thousand times longer | fetchSource.test.js | KILLED (1 failed) | a time-out ends the request |
| X05 | the founder gate admits any uid | explore-publish.test.js | KILLED (7 failed) | check: a uid not on the founder list reads nothing, fetches nothing, writes nothing |
| X06 | the contact gate is gone | explore-publish.test.js | KILLED (3 failed) | match without a contact address fetches nothing and reads nothing (SQ-2) |
| X07 | the batch is not one: a refused story is skipped, the rest written | explore-publish.test.js | KILLED (4 failed) | a draft is never written over a published story |
| X08 | a draft is written over a published story | explore-publish.test.js | KILLED (1 failed) | a draft is never written over a published story |
| X09 | a lower version is written | explore-publish.test.js | KILLED (1 failed) | a lower version is refused |
| X10 | the no-op writes anyway | explore-publish.test.js | KILLED (3 failed) | the same version with the same content is a no-op that says so |
| X11 | unpublish leaves the story published | explore-publish.test.js | KILLED (2 failed) | review A4: unpublish, then a draft of OTHER content at the same version, is refused — the rule cannot be walke |
| X12 | hidden elements count as visible text | matchStory.test.js, review.test.js | KILLED (2 failed) | a hidden paragraph is not visible text → https://ir.example.com/release |
| X13 | no space at block and cell edges | matchStory.test.js | KILLED (1 failed) | a table row in a page → https://ir.example.com/release |
| X14 | documentDate copied from the author's dated | matchStory.test.js | KILLED (7 failed) | a refusal: by 'read', nothing recorded as read, the reason in the report |
| X15 | K-7 drops the decimals (48 found in 48.5) | storyCheck.test.js | KILLED (6 failed) | 51.4 in "were $51.4 billion for the three months" → true |
| X16 | an http source passes the check | storyCheck.test.js | KILLED (1 failed) | K-4(h): a source whose url is not https |
| X17 | eleven tickers pass | storyCheck.test.js | KILLED (1 failed) | K-4(f): eleven tickers |
| X18 | the word limit is one word looser | storyCheck.test.js | KILLED (2 failed) | K-4(d): an overview's body at 151 words |
| R-H1 | H1: match keys stripped at the top level only | review.test.js, storyCheck.test.js | KILLED (4 failed) | every `match` and `matched` key is removed at any depth, and each is named |
| R-H2a | H2: a quote may start inside a number | review.test.js, matchRule.test.js | KILLED (4 failed) | "48% this quarter" in "grew 148% this quarter" → false |
| R-H2b | H2: a quote may end inside a number | review.test.js, matchRule.test.js | KILLED (5 failed) | "Revenue was $3,661" in "Revenue was $3,661.4 million" → false |
| R-H3 | H3: K-7 reads the excerpt without the rule | review.test.js, storyCheck.test.js | KILLED (4 failed) | a figure dash or em dash before the figure is a minus sign for the check, as it is for the match |
| R-H4 | H4: a no-op story is listed as published unmatched | explore-publish.test.js | KILLED (1 failed) | review H4: a no-op keeps the stored story and its match, and says so — no "will arrive as not checked" for it |
| R-H5 | H5: two sources under one id pass | review.test.js | KILLED (1 failed) | K-4(h), on the second |
| R-H6 | H6: sup and sub are not edges | review.test.js | KILLED (1 failed) | are edges |
| R-H7 | H7: an inline hiding style is ignored | review.test.js | KILLED (2 failed) | display none |
| R-H9 | H9: a zone-less date-time read in this machine's zone | review.test.js | KILLED (1 failed) | "2026-10-29T20:05:00" → "2026-10-29" |
| R-A2 | A2: a company named twice in a group passes | review.test.js | KILLED (1 failed) | a company named twice is refused |
| R-A3 | A3: a specific question's group is not ticker-checked | review.test.js | KILLED (1 failed) | K-4(f) |
| R-A4 | A4: a draft over a story that was published skips the version rule | explore-publish.test.js | KILLED (1 failed) | review A4: unpublish, then a draft of OTHER content at the same version, is refused — the rule cannot be walke |
| R-A12 | A12: a null or empty door passes as no door | review.test.js | KILLED (2 failed) | leadsToStory null is refused under K-4(e); an absent key is no door at all |
| R-A15 | A15: featured counted on the raw record | review.test.js | KILLED (1 failed) | the one featured question with no text leaves no card: refused |
| R-A20 | A20: the date check never notes | review.test.js | KILLED (1 failed) | the date check: the document's own month and year against `dated` |
| R-S2a | S2: an unread body is drained, not destroyed | review.test.js | KILLED (3 failed) | a 302 answer's body is destroyed, never drained |
| R-S2b | S2: the request is not aborted when the fetch returns | review.test.js | KILLED (1 failed) | the request's signal is aborted when fetchDocument returns, whatever the answer |
| R-S3a | S3: no page limit | review.test.js | KILLED (1 failed) | the page limit refuses the PDF, and the run goes on |
| R-S3b | S3: the worker's time limit is a hundred thousand times longer | review.test.js | KILLED (4 failed) | a PDF is read in a worker thread, to the same text as in this thread |
| R-S3c | S3: no text limit | review.test.js | KILLED (1 failed) | the text limit refuses the PDF, and the run goes on |
| R-S3e | S3: no element limit | review.test.js | KILLED (1 failed) | a page nested 5,000 deep is read by the walk without recursion; a page past the element limit is refused by na |
| R-S5a | S5a: 3fff::/20 is public | review.test.js | KILLED (2 failed) | 3fff::1 → public false |
| R-F1 | refuter 1: digits after a decimal point read as a number | review.test.js, storyCheck.test.js | KILLED (2 failed) | 5 in "up .5% on the year" → false |
| R-F1m | refuter 1: a quote may start after a decimal point | review.test.js, matchRule.test.js | KILLED (1 failed) | the match: "5% on the year" in "up .5% on the year" → false |
| R-F2 | refuter 2: the top of a fraction read as a number | review.test.js | KILLED (2 failed) | 51 in "rose 5½% on the year" → false |
| R-F3 | refuter 3: a currency sign hides the minus or the parentheses | review.test.js | KILLED (4 failed) | -110 in "Net loss ($110)" → true |
| R-SQ7a | SQ-7: decimal zeros no longer accepted (back to the letter) | review.test.js, storyCheck.test.js | KILLED (10 failed) | 46 in "to $46.0 billion." → true |
| R-SQ7b | SQ-7 loosened past the ruling: zeros stripped from a whole number too ("460" read as 46) | review.test.js, storyCheck.test.js | KILLED (6 failed) | 46 in "about 460 sites" → false |
| R-SQ5a | SQ-5: a question without an id passes | review.test.js | KILLED (3 failed) | no id |
| R-SQ5b | SQ-5: two questions with one id pass | review.test.js | KILLED (2 failed) | an id the first question already uses |

## 11. The review (K-15)

**Shape (K-15, BUILD_RULES §2).** The diff is past the threshold: more than 10 files and more than 1,500 lines. The review was run as follows:

- Three lenses (honesty, safety, agreement) ran at the same time, each on its own LF `git archive` tree of `defe7581`, read-only on git.
- One refuter ran on a fourth tree. It was handed every finding and tried to refute each with its own repro.
- Every agent's repro scripts were deleted, and every temporary edit was restored and checked by SHA-256.

The refuter reports one side effect. Its vitest runs rewrote vitest's own results cache, `node_modules/.vite/vitest/…/results.json`, in the shared install. That file is a cache and holds no package.

The round ran once. Fixes are in three commits:

| Commit | What it fixes |
|---|---|
| `e2f1df59` | The honesty and agreement lenses |
| `01db6180` | The safety lens |
| `892ae2c3` | The refuter's own findings, and two reverts to the letter |

Each fix has a row in `api/_utils/explore/review.test.js`, or in the command's test where it belongs, and a mutant (§10).

**Totals: 43 findings raised.**
- **21 CONFIRMED and fixed.** Two were blockers: H1/A1 and A4/S1.
- **1 REFUTED:** A25.
- **The rest were rulings,** each listed below with what was done.

| Id | Finding | Refuter | Done |
|---|---|---|---|
| **H1 / A1** | An author's `match`/`matched` survived anywhere outside the four places the step writes: top level, connections, questions, stored measures, a stated cell's `match`. A STOP condition. | **CONFIRMED (blocker)** | Every `match`/`matched` key is removed at any depth and named in a K-11 note (`storyRecord.js` `authorRecordOf`). |
| H2 | A quote whose edge cuts a number was "found": "48%" inside "148%", "Sales were 3" inside "3,661". | RULING: K-6's letter is a plain substring. | **Built stricter. The founder kept it (SQ-6, Nov 26).** Rule 1 holds the Work an idea chat's own condition, "the figure sits inside its own matched excerpt", where the excerpt sits in the document. A quote that begins or ends on a digit must not continue a number. |
| **H3** | K-7 read the excerpt without the rule, so "−48%" written with a figure dash passed as +48, and "48­5%" passed as 48. | **CONFIRMED (severe)** | K-7 reads `underRule(excerpt)`, the string the matcher looks for. |
| H4 | A same-version no-op printed "will arrive as not checked" while the store kept the earlier machine match. | CONFIRMED (low) | A no-op says `KEPT AS STORED`, and only written stories get acceptance lines. |
| **H5 / A7** | Two sources under one id: a cell could be matched beside a same-id source with nothing read. | **CONFIRMED (severe)** | Refused under K-4(h). |
| H6 | `<sup>1</sup>` after "$51.4" read as "$51.41". | RULING: tightening. | `sup` and `sub` are text edges. This only reduces matches. |
| H7 | Inline `display:none` and `visibility:hidden` text was matched. | RULING (the letter leans to the lens) | Not visible text. CSS-class hiding is a stated limit. |
| H8 | No row pinned the text hash under the rule, "any other type has no text", or the body's hidden elements. | CONFIRMED | Rows added. Mutants R-H6, R-H7, X12 and others kill them. |
| H9 | A zone-less page date depended on this machine's time zone. | CONFIRMED (HTML part) | A date with a zone is recorded as an ISO instant; a date without one as `YYYY-MM-DD` (`documentDate.js`). |
| A2 | Groups and measures were counted as entries, not as companies or measures. | CONFIRMED | Counted as companies and distinct stored keys. A repeat, or a measure of neither kind, is refused. |
| A3 | A specific question's `group` was never ticker-checked. | CONFIRMED | K-4(f) checks every question's group. |
| **A4 / S1** | The version rule could be bypassed: unpublish, then `draft` with other content at the same or a lower version, then publish. | **CONFIRMED (blocker)** | The version rule holds for any write over a story that was ever published, a draft included. |
| A5 | Ids were trimmed for lookup but stored untrimmed. | CONFIRMED (low) | Ids and stored keys are used exactly as written. Spaces at the ends are noted. |
| A6 | A computed cell could carry its result under another name. | CONFIRMED (low) | A computed cell carries `symbol`, `formula` and `inputs` only. |
| A8 | A body written as one string escaped the word limit. | CONFIRMED (low) | Counted. |
| A9 | "46" in "$46.0 billion" was refused. | RULING: the letter backs the refusal. | A fix accepting decimal zeros was built, then reverted to the letter, then put to the founder. **He ruled to accept decimal zeros (SQ-7, Nov 26)**: trailing zeros after the decimal point only. Built. |
| A10 | The currency had to be an ISO code. | RULING: stricter than "same currency". | Signs and words are recognised too: "$", "US dollars", "euros". |
| A11 | Units and periods were compared untrimmed. | CONFIRMED (minor) | Compared trimmed. |
| A12 | `leadsToStory: null` or `""` was refused. | RULING: K-4(e) applies to null. | A fix reading these as "no door" was built, then reverted to the letter. **The founder kept the letter (SQ-8, Nov 26).** |
| A13 | A draft is refused over a published story, even at a higher version. | RULING: the letter backs it. | Kept. |
| A14 | Under `publish`, "existing" means published or in the same set. | RULING | Kept. Stated in §4 item 5. |
| A15 | "Exactly one featured" was counted on the raw record. | RULING: the letter counts the record. | **Counted on the page's own view** (K-2): a featured question with no text gives no card. Stricter. |
| A16, A20, A22, A23 | Notes not given: a label that cites a source, the date check, banned words, long questions, a cited connection with no "Known", the question-id wording. | RULINGS / A23 confirmed | All added as **notes**, never refusals. |
| A17 | A computed cell has no `matched` of its own. | RULING (the letter leans against) | Kept. It is the only reading K-8 can live with; §12 asks the Work an idea chat to confirm it. |
| A18 | `match` fetches although the check refused. | RULING | Kept: `match` reports everything. `draft` and `publish` stop before any fetch. |
| A19 | "decreased 5%" can carry only +5. | RULING (the letter is silent on sign) | Kept. Said in §13. |
| A21 | Unmatched figure rows named no link. | CONFIRMED (cosmetic) | The link is named. |
| A24 | The page's view drops `{ symbol, name }` leads, so the pilots draw no company leads. | RULING (out of scope: `src/`) | **Reported for separate tasking** (§15). |
| A25 | A bad file name exits 1, not 2. | **REFUTED** | No change. |
| A26 / H-flaky / S5c | The `src/` scan row could pass its 5 s limit under load. | Not reproduced; the margin is thin. | Its own 60 s limit. |
| S2 | The body of a redirect or of a non-2xx answer was drained, not destroyed: endless, outside both limits, and the process could not exit. | **CONFIRMED (severe)**: 1.88 GB arrived after a 404 had returned. | Destroyed, and the request is aborted when the fetch returns. Proven with a stand-in `request`, so no socket. |
| S3 | Extraction had no time or work limit. A flat page was superlinear; repeated PDF pages, or a deflate bomb, could end in an uncatchable OOM. | **CONFIRMED (severe)** | PDFs are read in a **worker thread** with a 1,024 MB heap limit and a 60 s hard limit, and refused past 2,000 pages or 20 M characters. Pages are walked by sibling links, linearly and without recursion, and refused past 1 M elements. |
| S4 | The comment word "table-cell" minted `.table-cell{display:table-cell}` in the client CSS. | CONFIRMED | Reworded. The bundle is identical (§9). |
| S5a | `3fff::/20`, `2001:2::/48`, `2001:20::/28` and `192.88.99.0/24` were accepted as public. | RULING (K-5 names only private, loopback and link-local) | Refused. Stricter is safe. |
| S5b | `--go --help` imported `firebase-admin/firestore`. | Reproduces, no effect. | `--help` now loads nothing extra. |
| Refuter's own 1–3 | ".5%" was carried as 5, "5½%" as 51 (NFKC writes 5 1/2), "($110)" as +110. | Found by the refuter. | Fixed in K-7 and in rule 1's edges alike. |
| Refuter's own 4 | "3 661", with a space as thousands separator, is refused for 3661. | Minor | Kept, which is the safe side. Said in §13. |

## 12. For the Work an idea chat: what `match` and `matched` mean

Everything below is written by server code in one run of `match`, `draft` or `publish` (`api/_utils/explore/matchStory.js`), from that run alone.

Nothing an author wrote survives, and nothing stored by an earlier run survives:
- any `match` or `matched` key, at any depth of the record, is removed before anything reads it (`storyRecord.js` `authorRecordOf`);
- the matcher replaces any it is handed;
- `publish` always fetches and matches afresh, `--id` included.

**On each source: `match: { by, readAt, documentDate, textHash, rule }`**

| Field | Meaning | When it is set |
|---|---|---|
| `by` | `'machine'` or `'read'` | `'machine'` **only** when all of these hold in this run: the step fetched the link itself over https, with every redirect re-checked and the address public; it read text from it (an HTML page's visible text, or a PDF's text); and it found the source's own `excerpt` in that text under rule `rule`. Anything else is `'read'`: the fetch refused, failed or timed out; the type has no text; no text could be read, or a reading limit was met; the excerpt is missing; or it was not found. |
| `readAt` | ISO time | When this run received the document. `null` when nothing was received. |
| `textHash` | SHA-256, hex | Of the document's extracted text under the rule. `null` when there was no text. |
| `documentDate` | ISO instant, `YYYY-MM-DD`, or `null` | A date from the document's own metadata: a page's published-time tag, or a PDF's creation date. A date that names its zone is an ISO instant; one that does not is its calendar date. Never the author's `dated`, and never this machine's time zone. |
| `rule` | `1` | The version of the word-for-word rule (addition 1), defined below. |

**Rule 1**
- NFKC.
- Typographic quotes become straight quotes.
- Every dash, and the minus sign, becomes a hyphen.
- Soft hyphens are removed.
- Runs of whitespace, non-breaking included, become one space, and the ends are trimmed.
- Case is kept.
- A quote matches when it is a substring of the text **at a place where it does not cut a number**:
  - a quote that begins with a digit must not continue a number before it (a digit, a decimal point, a thousands comma after a digit, or a minus sign);
  - a quote that ends with a digit must not run on into one (a digit, or a decimal point, comma or fraction slash followed by a digit).

  So "48% this quarter" is not found in "grew 148% this quarter". This edge is stricter than K-6's plain substring. It is built because the substring letter would record a different figure as sourced, which your condition forbids: "the figure sits inside its own matched excerpt, written as the table will show it". **The founder kept it (SQ-6, Nov 26).**

**On each stated cell and each input of a computed cell: `matched`**

`true` **only** when that cell's or input's own `excerpt` was found, under the rule, in its source's text fetched in this run. Otherwise `false`.
- So `matched: true` appears only on a source whose `readAt` and `textHash` are both set. This is the invariant, pinned by the INVARIANT row in `matchStory.test.js` and by mutant A4.
- A cell can be `matched: true` on a source whose own excerpt is `'read'`, because the cell's quote is in the document and the source's is not; the reverse can also happen. Each stands on its own excerpt.
- A source id names exactly one source: two sources sharing an id are refused.
- **A question id names exactly one question** (the founder's SQ-5). A question with no id, or with an id another question already uses (compared trimmed, as the page compares them), is refused. So the question id an investigation sends always names one question of the story.

Two kinds of cell carry no `matched`:
- **A computed cell carries no `matched` of its own** (it has no excerpt); each of its inputs carries one. It never carries a result, under any name: the check refuses one (addition 2), and this step computes nothing. **Please confirm this reading** (review A17). K-6 says "on each cell … otherwise `false`" and exempts only `notReported`. Read literally, every computed cell would be unmatched for ever, and K-8 would refuse each story that carries one.
- **A `notReported` cell carries no `matched`.** A match cannot prove an absence.

**How a figure should arrive in an investigation** (the summary line of every report):
- **sourced:** a stated cell with `matched: true`, or a computed cell whose inputs are all `matched: true`;
- **not checked:** any other carried figure;
- a `notReported` cell is the story's own claim.

**What else the investigation can rely on**
- K-7 (SQ-1) refuses any stated cell or input whose `value` is not written in its own excerpt as a whole number token. The one tolerance is the founder's SQ-7: trailing zeros after the decimal point. A value of 46 is carried from "$46.0"; the excerpt still holds that figure, and the table shows 46. The excerpt is read under the same rule, so a matched excerpt always holds its figure as written, with its sign.
- A story published with an unmatched figure needed `--accept-unmatched` on that command line, which is never stored.
- A same-version republish changes nothing and keeps the earlier run's match. A fresh match needs a higher version, as the standard's §10 refresh does.

**Not yet:** the research server's list of stored-measure keys (`src/constants/compareMeasures.js`) is not on `main`. Until it lands, a `storedKey` is checked only for being present and unrepeated, and the report notes each key. When the list lands, import its keys at `STORED_MEASURE_KEYS` in `scripts/explore-publish.mjs`; the check then refuses any key not on it (`checkStories(…, { storedKeys })`).

## 13. For the content chat: which links a machine could read

Across the three live runs on the two pilots (§7), the nine distinct links fell into three groups:
- **seven:** always read, and every quote found;
- **one** (the NextEra PDF): always read, but the quote never found;
- **one** (Amazon): found once, and reset the connection twice.

| Kind of link | Result | Note for authors |
|---|---|---|
| Company release pages (NVIDIA; Microsoft, after a redirect; Oracle; CoreWeave) | Read, and every quote found. **The CoreWeave table row "Revenue $ 3,661 $ 1,365" is included.** | A table row is found when it is quoted cell by cell, one space between cells, as the page shows it. |
| Company filing PDF (Alphabet's 10-Q) | Read, quote found, with the PDF's own date. | — |
| Presentation PDF (Dominion to PJM), three quotes | Read once, all three found. | One fetch serves every source and figure that cites the link. |
| Regulator order PDF (Virginia SCC) | Read, quote found, with the PDF's own date. | — |
| Joint release PDF (NextEra and Dominion) | **Read, quote not found.** The PDF draws "fi" in "fixed" as a ligature glyph with no letter mapping. | Avoid a word with a ligature (fi, fl, ff) in a PDF quote, or start the quote after it. "exchange ratio of 0.8138 shares of NextEra Energy for each share of Dominion Energy they own" is in the text as written. |
| Amazon's newsroom (`aboutamazon.com` → `www.`) | **Intermittent.** It reset the connection in two of three runs; in one it answered, and the quote was found. | Run `match` again before publishing. If it still resets, cite the same sentence from Amazon's 8-K exhibit or IR site. |

**In general, a machine cannot read:**
- a page whose text is drawn by scripts after it loads (the step never runs a page's scripts);
- a scanned PDF (images, no text);
- a site that refuses or resets automated requests;
- a plain `http` link;
- anything that does not answer within 20 seconds, is over 20 MB, or (for a PDF) is over 2,000 pages.

In each case the source is `read`, its figures arrive as not checked, and the report says why.

**Writing quotes and figures that a machine can confirm:**
- **Quote exactly as the document writes it,** including its punctuation and case. Curly quotes, dashes and non-breaking spaces are evened out by the rule; nothing else is. Text the page hides does not count.
- **Do not cut a number with a quote:** a quote must not start or end in the middle of one. "48% this quarter" quoted from "148% this quarter" is not found.
- **A figure's value is written as the excerpt writes it:**
  - decimals as given, except trailing zeros after the decimal point (the founder's SQ-7): 46 is carried from "$46.0", but not from "460" or "46.01";
  - with its sign: a decline written in words ("decreased 5%") carries +5, while −5 needs "−5%" or "(5)";
  - never a fraction ("5½") or a footnote mark;
  - a space used as a thousands separator ("3 661") is not read as one number.
- **Every question has its own id.** A question with no id, or with the id of another question of the same story, is refused (the founder's SQ-5).
- **The date check:** each source's `dated` should name the month and year of the document's own date, where the document gives one. Where it gives none, the report says to check it by hand.

## 14. Founder questions

| # | Question | Default (applied) |
|---|---|---|
| **SQ-1** | A cell whose figure is not inside its own quote. | Refused, with no override (K-7). Built. |
| **SQ-2** | The contact address in the user agent. | Read from `EXPLORE_PUBLISH_CONTACT`. Without it, `match`, `draft` and `publish` refuse and fetch nothing. Built. |
| **SQ-3** | A link that is not `https`. | Refused by the check (K-4(h)) and by the fetcher, on every redirect too. Built. |
| **SQ-4** | A write over a story that was published, then unpublished: same version with different content, or a lower version. | Refused ("raise the version"), as over a published story, because theses keep the story version. Built. |
| **SQ-5** | The remaining noted findings (§4 item 13): should any be refused? | **Ruled Nov 26:** a question with no id, or with an id another question of the story already uses, is **refused**. Every other noted finding stays a note. Built (`storyCheck.js`, rule `SQ-5`); rows and mutants R-SQ5a/b. |
| **SQ-6** | Rule 1's number edge: a quote that begins or ends inside a number in the document is not found. K-6's letter is a plain substring. | **Ruled Nov 26: kept as built.** Without it, "48%" is found inside "148%" and a different figure is recorded as sourced. Rows and mutants R-H2a/b. |
| **SQ-7** | Should K-7 accept decimal zeros: 46 found in "$46.0", 0.8 in "0.80"? A JSON value cannot keep them, and SQ-1 allows no override, so such figures cannot be carried today. | **Ruled Nov 26: accepted.** A value matches a token that differs from it only by trailing zeros after the decimal point. Nothing else loosens: "460", "46.01" and "4.05" are other numbers. Built (`storyRecord.js` `figureInExcerpt`); rows and mutants R-SQ7a/b. |
| **SQ-8** | `leadsToStory: null` or `""`: a broken door (K-4(e)), or "not written yet" like an absent key? | **Ruled Nov 26: stays as built.** Refused; the author omits the key for "not written yet". Rows and mutant R-A12. |

## 15. Out of scope, reported for separate tasking

- **The page draws no company leads for any V1.4 story, the pilots included** (review A24). `src/components/Explore/exploreView.js:139` reads a connection's `leads` with `textsOf`, which keeps strings only. The V1.4 record's leads are `{ symbol, name }` objects, so the page's view has `leads: []`. The fix belongs to the page's build (Explore Build 2), and `src/` is outside this build.

## 16. The founder's run sheet (from his checkout of `main`, after the merge)

Set `EXPLORE_PUBLISH_CONTACT` once (an email address or an https link the sites can reach you at), in `.env.local` or the shell. Put the two pilot files somewhere, named `ai-buildout.json` and `dominion-data-centers.json` (they are in the repo at `api/_utils/explore/__fixtures__/pilot/`).

1. `node scripts/explore-publish.mjs status --uid <your uid>` — the collection is empty: `exploreStories: 0 stories`.
2. `node scripts/explore-publish.mjs check --file ai-buildout.json --file dominion-data-centers.json --uid <your uid>` — both pass (`0 refused`); two keys are noted "not checked: the list is not built yet".
3. `node scripts/explore-publish.mjs match --file ai-buildout.json --file dominion-data-centers.json --uid <your uid>` — the report says, source by source, which quotes a machine confirmed (§7 has this session's run: 10 of 12).
4. `node scripts/explore-publish.mjs draft --file ai-buildout.json --file dominion-data-centers.json --uid <your uid> --go` — both are stored as drafts. No player can read them.
5. `node scripts/explore-publish.mjs publish --file ai-buildout.json --file dominion-data-centers.json --uid <your uid> --go` — **without** `--accept-unmatched` it refuses and lists every unmatched quote. Nothing is written.
6. `node scripts/explore-publish.mjs unpublish --id ai-buildout --id dominion-data-centers --uid <your uid> --go` is the one-step way back, once anything is published.

Every writing command without `--go` prints exactly what it would write and writes nothing.

## 17. The PR description

**Draft. Nothing is published by this PR. No screen changes. Nothing in the app calls this code.** The founder merges.

Nothing in the repo could write an Explore story. This adds the founder's command, `scripts/explore-publish.mjs`, with six subcommands:
- **check:** checks a story against the editorial standard V1.4.
- **match:** fetches every cited document itself and looks for every quote in it, word for word. It calls no model and no provider.
- **draft:** writes the story as a draft.
- **publish:** writes the story as published. A story with an unmatched quote needs `--accept-unmatched`.
- **unpublish:** takes a published story back to draft.
- **status:** lists what is stored.

Every write needs the uid on `MANDATE_FOUNDER_UIDS` and `--go`. It writes `exploreStories` only. Build report: `docs/audits/20261125_BUILD_EXPLORE_PUBLISH.md`.

### Changes

**The step's server code** (`api/_utils/explore/`)
- `storyCheck.js:424` `checkStories` covers K-4 and K-7.
  - The page's own `storyOf` is the one source for its hard rules (K-2). It is asked about the story as it would be once published, and `pageDropReasonsOf` (`:57`) names each reason by asking `storyOf`.
  - Exactly two formulas are allowed; `currencyOf` is at `:92`.
- `storyRecord.js`, the record as the step reads it:
  - `authorRecordOf` (`:80`) removes every `match`/`matched` key at any depth;
  - `figureInExcerpt` (`:153`) is K-7, read under the rule;
  - `FORMULAS` is at `:30`.
- `matchRule.js`, the word-for-word rule:
  - `RULE_VERSION = 1` (`:25`), `underRule` (`:34`);
  - `quoteIn` (`:70`), which does not cut a number at a quote's edge.
- `fetchSource.js`, the fetcher:
  - `fetchDocument` (`:197`) and `httpsTransport` (`:150`): https only, ≤5 redirects re-checked, 20 s, 20 MB, an unread body destroyed;
  - `vettedLookup` (`:124`) and `isPublicAddress` (`:113`): every non-public address is refused, and the connection goes to the checked address;
  - `contactOf` (`:40`): the user agent's contact comes from `EXPLORE_PUBLISH_CONTACT`.
- `extractText.js`, a page's visible text:
  - `htmlTextOf` (`:104`) uses jsdom with nothing run and nothing loaded;
  - the walk is iterative, with a limit of 1 M elements.
- `pdfText.js` and `pdfWorker.js`: a PDF's text, read in a worker thread with a 1,024 MB heap, 60 s, 2,000 pages and 20 M characters as limits.
- `documentDate.js`: the document's own date, never the author's `dated`, and never the machine's time zone.
- `matchStory.js`, which writes what is recorded:
  - `matchStories` (`:106`) fetches each link once per run;
  - `matchBlockOf` (`:64`) writes `{ by, readAt, documentDate, textHash, rule }`;
  - `excerptMatched` (`:76`) gives `matched: true` only on a source with `readAt` and `textHash` both set;
  - `summaryOf` (`:174`).
- `storyWriter.js`, the only writer:
  - `COLLECTION = EXPLORE_RECORD_KIND` (`:28`);
  - `planWrite` (`:73`) holds the version rule, over any story that was ever published;
  - `commitSet` (`:129`) is one transaction per set;
  - `commitUnpublish` (`:149`).

**The command** (`scripts/explore-publish.mjs`)
- `parseArgs` (`:135`) and the gates `readGates` (`:197`).
- `runCommand` (`:268`) is a thin door: it never writes Firestore itself.
- `runCli` (`:449`).
- `STORED_MEASURE_KEYS` (`:73`) is `null` until `src/constants/compareMeasures.js` lands.

**Tests:** 396 rows in `api/_utils/explore/{storyCheck,review,fetchSource,matchStory,matchRule}.test.js` and `scripts/explore-publish.test.js`. None makes a network call: the fetcher is injected and answers from committed documents.

**Fixtures** (`api/_utils/explore/__fixtures__/`):
- the two pilot records, word for word from the note's Appendix;
- `release.html` and `script-only.html`;
- `text.pdf` and `table.pdf`, built by `makeDocs.mjs`;
- `fixtureFetch.js`, test support.

**Other files**
- `api/_utils/compositionProtectedStoresAllowlist.json:553–554`, plus notes at `:865`: the writer's two write sites.
- `.gitattributes:20`: the fixture PDFs are binary.
- `package.json:67`: `unpdf` 1.7.0 as a devDependency (MIT, no dependencies). `package-lock.json` changes by that one entry.
- `docs/design/explore/`: the two attachments, byte for byte (K-0).

### Fenced code
**No fenced file is edited. No fenced function is called.** The command reuses `founderAllowlist` from `api/_utils/practiceField/founderControls.js` (not fenced) and `canonicalContentHash` from `api/_utils/canonicalHash.js` (not fenced).

### Checks
All checks ran on `7f4f398a`, the final code with the founder's rulings, which is the merged tree, in WSL with `TZ=UTC` and 8 workers.
- **Full suite:** 1,665 files passed, 14 skipped; 38,661 rows passed, 197 skipped; 0 failed.
- `lint:gate`: exit 0.
- `test:rules`: 48 files, 889 rows.
- **Client bundle:** identical to `main` (125 files).
- **Baselines:** unchanged.
- **Mutation battery:** 82 of 82 killed.
- **Review:** 3 lenses and 1 refuter (K-15). The two blockers, H1 and A4, and every confirmed finding are fixed.
- **Live K-14 match on the pilots:** 10 of 12 sources confirmed by machine, 3 of 4 carried figures sourced. Amazon's site is intermittent, and the NextEra PDF's ligature is never found.

### The founder's rulings
The founder's rulings of Nov 26 are built (report §14):
- **SQ-6:** the number edge is kept.
- **SQ-7:** decimal zeros are accepted, and nothing else loosens.
- **SQ-5:** a question with no id, or a repeated id, is refused.
- **SQ-8:** stays as built.
