# Explore editorial standard — V1.4

**Date:** Wed Nov 25, 2026 · **From:** the Explore content chat · **Status:** draft for the founder. It replaces V1.3 of the same day. Nothing is published by this document.
**Where this goes:** the founder reads it first. After he approves it, attach it once to the Explore chat with `NOTE_TO_EXPLORE_CHAT_STORY_RECORD_V1_4_NOV25_2026.md`, and once to the Work an idea chat, which needs no note with it.
**Written to be read alone.**

**What changed from V1.3:** the Work an idea chat confirmed that a figure carried by a story can arrive in an investigation as sourced, at no research step, on six conditions. All are adopted here. The publish step matches every excerpt in server code and records the result (§4). Each carried figure has its own excerpt, and a computed figure carries its inputs instead of its result (§6, §9). A stored measure names a key from a fixed list (§6). One stored measure is held back (§6). The record's field list in §9 is the one Explore Build 2 can build against.

## 1. What an Explore story is

A standing explanation of how money moves through a business or a product, ending on what is still unknown. It is not news. News is an event that lands on a story.

Every story has two readers: the player, and the player's agent reading alongside.

**The dividing line with Work an idea:** a story never answers its own question, and an investigation never redraws the story's map.

## 2. Two kinds of story

| | Overview | Deep story |
|---|---|---|
| Job | The map of a theme. It is the main door into an idea. | One link of the map, in depth. It is where a player learns what they own. |
| About | A theme or a product people use | One company or one product |
| Title | Names the theme | States one tension, with its numbers where it can |
| Body | 150 words at most | 300 words at most |
| Connections | Three to five. Each names a group of companies and is a door to deep stories. | Two to five, around the one company or product |
| Questions | One to three, broad. Each compares a group. | One to three, specific. Each rests on one gap. |
| Leads to | A thesis about the leaders of a group | A thesis about one business |

A deep story belongs to one connection of one overview. The chain drawn on an overview is therefore also its table of contents.

## 3. What every story contains

1. **A chain you can retell in one breath:** who pays whom, for what, and when.
2. **Real numbers,** each with its unit, its period, its source and its date.
3. **One evidence label on every connection** (§4).
4. **A three-part gap on every connection** (§5).
5. **At least one connection that is not sourced.**
6. **An ending on one specific gap,** not a summary.
7. **Plain words.** A term a new investor would not know is explained or left out.

## 4. Evidence rules

| Label on the page | Use when |
|---|---|
| Source cited | A listed source describes this relationship. |
| Reporter's reading | It is the reporter's own reasoning or arithmetic. The sentence says so: "Kim's reading is that…". |
| No source yet | Nobody has checked. |

- A cited source shows that a relationship exists. It does not show how much it matters. The words "Supported", "Verified" and "Confirmed" are never used.
- A company is a lead, never a pick. No "buy", no "sell", no price target, no forecast.
- **A story never ranks a group, and never shows the compare table.** It names the group and the measures. The figures it carries for the investigation (§6) are not shown on the story page. The player does the picking.
- The story's date and each source's date are kept apart.
- Never close a gap to look thorough, and never invent a source.
- **Quote check.** Every excerpt is one sentence or one table row at most, copied word for word from the document at its link, and found there again before the story goes out. The publish step makes this match in server code: it fetches the link itself, looks for the excerpt word for word, and records the result. A person's reading, or a model's, does not count as a match.
- **Date check.** A source's date is the document's own date, read from the document.
- **Source order.** Company filings and releases first, then regulators and industry bodies, then established news outlets.
- **The knowledge base is a map, not a source.** Another FantasyTimes story is never a source.
- **Stock list.** A ticker must be in `ALL_TICKERS` in `api/_utils/rankingConfig.js`, which holds 228 stocks and is the list the research server checks.

## 5. The gap, in three parts

Every connection states:

| Part | What it holds |
|---|---|
| Known | What a cited source establishes. Blank if nothing is cited. |
| Unknown | One specific missing fact. |
| Where to look | The kind of public document that would settle it. |

If "where to look" cannot be written, no question may rest on that gap.

## 6. Questions

### Rules for every question

1. Can be answered from public sources in about ten research steps.
2. Leads toward named, listed companies without naming the answer.
3. Asks about the business, not the stock price.
4. States what is unknown.
5. Is not yes or no.
6. Stands apart from the story's other questions.
7. Reads plainly: one sentence, under 120 characters where possible.
8. Names the connection it comes from.
9. Says what would weaken a thesis built from it, in one line.
10. Names its watch document: the report where the answer shows up again, and how often it comes out.

### Broad questions, on overviews

A broad question compares a group. A reader with no experience should understand it on first read.

- **Its shape is "who leads":** which companies in this group are ahead on something that matters. Example: "Which AI cloud companies are growing fastest, aside from Google?"
- **It names its group:** three to eight companies from one connection, all in the 228-stock list.
- **It names its measures:** three to five, each in plain words, and each marked as one of two kinds.
  - **Stored:** a number the app already holds for every stock, from the weekday rankings job. At least two measures are stored. A stored measure names a key from the fixed list the research server keeps. That list, not the story, holds the measure's plain label and its unit.
  - **Reported:** a number only the company's own report gives, such as the growth of one business line. The story carries each company's figure with its own excerpt, and the figure must appear inside that excerpt as the table will show it.
- **A computed figure carries its inputs, not its result.** Where a report gives two figures but not the rate, the story carries both, each with its excerpt, and names the formula. The research server does the arithmetic.
- **How a carried figure arrives in an investigation.** One whose excerpt the publish step matched arrives as sourced, citing the company's document, at no research step. One that was only read arrives as not checked and can be checked with a step.
- **"Not reported" is the story's own claim.** If a company does not report the measure, the story says so. That cell is never treated as sourced, because a match cannot prove an absence.
- **Not every stored number can be a column.** Debt compared with earnings is held back: the rankings job writes the same placeholder for every company that holds more cash than debt. Net cash in dollars and capital spending as a share of sales become usable once the rankings job stores them.
- **It suggests a benchmark:** one fund the idea book already holds, such as XLK or QQQ, for the picks to be watched against.
- **Its "what would weaken it" line has two halves:** the picks trail the benchmark over the window, or they lose their lead on the measures at the next earnings report.

### Specific questions, on deep stories

A specific question rests on one stated gap and has one of five shapes: how much, when, who keeps the profit, what could replace it, or who depends on whom. A story's questions use different shapes.

### The agent's question

It is made for one player and is not stored in the story.

- At most one per story.
- Built from one stated gap, or one group, plus something true about the player.
- It says why it is asking.
- It uses no fact that is not in the story or in the player's own record.
- If the agent has nothing personal to add, it shows no question.

## 7. Links, and the editor

- An overview's connection leads to its deep stories. A deep story names its parent connection.
- A link is a claim. It is made only when both stories describe the same relationship.
- A connection with no deep story is a candidate for the next one. The ones players tap most are written first.

**The editor** is a job with no byline. It owns the links, the list of what gets written next, the check in §11, and the candidates that come back from investigations (§8).

## 8. How a story hands off: two routes to a thesis

| | Route A: compare and narrow | Route B: close the gap |
|---|---|---|
| Starts from | A broad question on an overview | A specific question on a deep story |
| The investigation | Shows the group side by side on the measures, with each company's sales in the quarter and the quarter's end date. The player chooses which measures count and picks one to four names. | Spends its research steps on the one gap. |
| The point against | Comes from the measures the player did not choose. No thesis is saved without it. | Comes from the research. |
| The thesis says | "These lead the group on what I judge by, and I expect them to beat the benchmark." | "This will happen to this business. Wrong if…" |
| The portfolio shows | The picks against the benchmark, and at each earnings report whether they still lead on the measures. | The watch document set beside the wrong-if line. |

What the story supplies on each route:

| Thesis part | Route A | Route B |
|---|---|---|
| Theme | The overview's subject | The parent overview's subject |
| Segment | The question's connection | The deep story's subject |
| Names | Picked from the question's group | The story's company, plus the connection's companies |
| Judged by (new part) | Chosen from the question's measures | Not used |
| Why | Each picked name's numbers on the chosen measures | The story's cited sources, then research |
| Wrong if | Seeded by the question | Seeded by the question |
| Benchmark (new choice) | Suggested by the question | The idea book's default |
| Time frame | Suggested by the watch document | Suggested by the watch document |

Four rules hold on both routes:

1. **The player picks.** The agent may recommend a measure or a name with a one-line reason. It never fills them in silently. On Route A a name can be picked once it has a sourced figure on at least one measure the player judges by.
2. **The connection is the address.** A thesis keeps the story and connection it came from, so an event a reporter files there reaches every thesis built from it.
3. **The routes join.** After Route A, each picked name's deep story is offered as the next read. It shows what could go wrong with that pick.
4. **Findings flow back.** A source an investigation finds for a "No source yet" connection goes to the editor as a candidate. A player's own observations never flow back.

**Checking the lead later.** A story's reported figures are refreshed each quarter (§10) and the stored ones each weekday. A thesis that keeps its story, its question and the story version it was built on can therefore be re-checked at each earnings report without a new search.

How long each idea runs is the idea book's ruling, not this standard's.

## 9. Proposed additions to the story record

For the Explore chat to accept or rename. None is a hard rule. Nothing in the kickoff's record is removed, and no `sample` field is ever written.

| On | Field | Holds |
|---|---|---|
| the story | `kind` | `'overview'` or `'deep'` |
| a deep story | `parent` | `{ storyId, connectionId }` |
| a deep story | `about` | One or two of `{ symbol, name }` |
| a connection | `id`, `known`, `unknown`, `whereToLook` | A short name and the three parts of §5 |
| a connection | `leadsToStory` | The deep story's document id, when it exists |
| a question | `fromConnection`, `shape` | The connection, and the shape: `who_leads` or one of the five in §6 |
| a question | `wrongIfSeed`, `watch` | Rules 9 and 10. `watch` is `{ document, updates }`. |
| a broad question | `group` | Three to eight of `{ symbol, name }` |
| a broad question | `measures` | Three to five, each with `kind`: `'stored'` or `'reported'` |
| a stored measure | `storedKey` | A key from the research server's fixed list, such as `revenueGrowthYOY`. The story writes no label for it. |
| a reported measure | `name`, `plain`, `cells` | Its label in plain words, and one cell per company in the group |
| a stated cell | | `{ symbol, value, unit, period, sourceId, excerpt }` |
| a computed cell | | `{ symbol, formula, inputs }`. Each input is `{ value, unit, period, sourceId, excerpt }`. `formula` is a named one, such as `growth_from_year_ago`. |
| a company that does not report the measure | | `{ symbol, notReported: true }` |
| a source | `match` | **Written by the publish step, never by the author:** `{ by, readAt, documentDate, textHash }`. `by` is `'machine'` or `'read'`. |
| a cell or an input | `matched` | **Written by the publish step:** whether its own excerpt was found in the fetched text |
| a broad question | `benchmark` | One fund symbol the idea book holds |

**The ten-ticker limit.** The Work an idea chat has agreed that on Route A the server reads the question's group from the story and treats that group as the scope. The story's own `tickers` list stays at ten or fewer and holds the featured question's group first.

**What a thesis keeps.** The story id, the story version, the connection id and the question id. These are on the saved thesis, not on the story.

## 10. Upkeep

- A story is revised when an event changes a connection's label or a number. The new source is added with its own date and `version` goes up.
- A story whose newest source is more than a year old is reviewed or returned to draft.
- A broad question's group is reviewed whenever a company joins or leaves the 228-stock list.
- **Reported figures are refreshed each quarter,** after each company in the group reports. Each refresh raises `version`. A figure is out of date once its company has reported a later quarter. The research server checks this itself against the rankings record. Where that record has no quarter, a match older than 120 days counts as out of date.

## 11. The check before a story reaches the founder

- The chain can be retold in one breath, and the word limit for its kind is met.
- A deep story's title states one tension.
- Every connection has one label and a three-part gap, and at least one is not sourced.
- Every excerpt passed the quote check and every date passed the date check.
- Every ticker is in the 228-stock list.
- Every question meets §6. A broad question can be understood by someone who has never read a company report.
- Every broad question has at least two stored measures, and every reported measure has a figure, or "not reported", for every company in its group.
- No sentence reads as a pick, and no group is ranked.
- An overview and its deep stories point at each other correctly.
- For the first set only: sample agent questions, and one worked example of each route.

## 12. Not decided here

- How the reporters generate stories and file events, and how the editor is built.
- Which reporter writes deep stories about a single company.
- How the agent's question is produced.
- How the page draws the hierarchy.
- Who builds the publish step. This chat recommends the Explore chat, since the publish tool is already in Build 2.
- How long the idea book's slots run.
