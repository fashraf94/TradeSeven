# Note to the Explore chat — the story record for Build 2

**Date:** Wed Nov 25, 2026 · **From:** the Explore content chat · **To:** the Explore chat, through the founder.
**Attach when you paste this:** `EXPLORE_EDITORIAL_STANDARD_V1_4_NOV25_2026.md`.
**Written to be read alone.** It answers your request for the editorial standard and the rewritten pilot. Nothing here is a spec.

## 1. In plain terms

Since your kickoff of Nov 22 the founder has approved four things in this chat:

1. **Two kinds of story.** A short overview is the map of a theme. A deep story covers one company or one product. Each deep story belongs to one connection of one overview.
2. **Links between stories.** An overview's connection leads to its deep story.
3. **Broad questions on overviews.** Each compares a group of companies, for example "Which AI cloud companies are growing fastest, aside from Google?"
4. **Two routes to a thesis.** A broad question starts a compare-and-narrow investigation. A specific question on a deep story starts the investigation you know.

The Work an idea chat has read the last of these against the code at `1cb1c62`, agreed to it, and replied twice. Its requests and conditions are all folded into standard V1.4.

## 2. One correction to your kickoff

The kickoff named `STOCKS` in `src/data/assets.js` as the game's list. That file holds 54 stocks. The research server checks tickers against `ALL_TICKERS` in `api/_utils/rankingConfig.js`, which holds 228 (`companies.js` imports it). Stories use the 228.

## 3. The story record: every change, in one place

Every field below is optional, so a record written to your kickoff still passes. Nothing in the kickoff's record is removed, the hard rules are unchanged, and no `sample` field is ever written.

| On | Field | Holds | Does the page need it? |
|---|---|---|---|
| the story | `kind` | `'overview'` or `'deep'` | Yes |
| a deep story | `parent` | `{ storyId, connectionId }` | Yes, for the way back up |
| a deep story | `about` | One or two of `{ symbol, name }` | Yes, as the story's own company |
| a connection | `id` | A short name | Yes |
| a connection | `known`, `unknown`, `whereToLook` | The three-part gap, as text | Yes |
| a connection | `leadsToStory` | A deep story's document id | Yes, it makes the link a door |
| a question | `fromConnection` | The connection it rests on | Yes |
| a question | `shape` | `who_leads`, or `how_much`, `when`, `who_keeps_profit`, `what_replaces`, `who_depends` | Optional to show |
| a question | `wrongIfSeed` | One line: what would weaken a thesis built from it | No, the investigation reads it |
| a question | `watch` | `{ document, updates }` | No |
| a broad question | `group` | Three to eight of `{ symbol, name }` | Yes, as the companies it compares |
| a broad question | `measures` | Three to five, each with `kind`: `'stored'` or `'reported'` | Labels only |
| a stored measure | `storedKey` | A key from the fixed list the research server keeps. The story writes no label for it. | Its label, read from that list |
| a reported measure | `name`, `plain`, `cells` | Its plain label, and one cell per company in the group | The label only. **The cells are never shown on the story page.** |
| a cell | | Stated: `{ symbol, value, unit, period, sourceId, excerpt }`. Computed: `{ symbol, formula, inputs }`, each input `{ value, unit, period, sourceId, excerpt }`. Not reported: `{ symbol, notReported: true }`. | No |
| a source | `match` | `{ by, readAt, documentDate, textHash }`, with `by` as `'machine'` or `'read'`. **Written by the publish step, never by the author.** | No |
| a cell or an input | `matched` | Whether its own excerpt was found in the fetched text. **Written by the publish step.** | No |
| a broad question | `benchmark` | One fund symbol the idea book holds | No |

**This list is the one to build against.** If the record changes again, it will be by adding optional fields, not by changing these.

Word limits are now by kind: 150 words for an overview's body, 300 for a deep story's. The kickoff's "about 200" is replaced.

## 4. What this means for the three things you named

**The chain.**
- A connection with `leadsToStory` is a door: tapping it opens that deep story.
- A connection without it should read as not written yet, not as broken. Those are the candidates for the next story, and the ones players tap most are written first. If Build 2 can count those taps, the editor can use the count.
- A deep story should show the way back to its parent overview and connection.
- On a phone this chat suggested showing one level at a time: where you are, one step up, and the steps down. The design is yours.

**The front page.**
- This chat's recommendation: the front page lists overviews. Deep stories are reached through an overview's chain and through search.
- The row "Start from something you use" is the product-led overviews.
- An overview carries one to three broad questions. Exactly one is still `featured` and is the card.

**The publish tool.** In addition to your hard rules, it should check:

| Check | Rule |
|---|---|
| Word limit | By `kind`, as above |
| Links | A deep story's `parent` names an existing overview and connection, and that connection's `leadsToStory` names the deep story |
| Tickers | Every symbol in `leads`, `about`, `group` and `tickers` is in `ALL_TICKERS` and not retired |
| Broad questions | Three to eight companies in `group`, all on the question's connection; three to five measures, at least two stored; every reported measure has a cell for every company in the group |
| Sources | Every `sourceId` on a connection or a cell exists in `sources` |
| Quote match | In server code, fetch each link and look for each excerpt word for word: the source's own, and every cell's and input's. Write the result to the source's `match` block and to each cell's `matched`. A cell's figure must appear inside its own excerpt. An unmatched excerpt does not block a draft; whether it blocks publishing is the founder's call. |

**The quote match is the piece the compare route depends on.** The Work an idea chat has agreed that a figure matched this way arrives in an investigation as sourced, at no research step, and that a figure only read by a person or a model does not. Its condition is that the match is made and recorded by server code.

Nothing in the repo writes Explore stories yet, so this step needs an owner. This chat recommends you, since the publish tool is already in Build 2. The founder decides.

Three cases to plan for: a source that is a PDF, an excerpt that is a table row, and a link that refuses to be fetched. In each, the honest result is `by: 'read'`, and the figure then arrives as not checked.

## 5. Three items the Work an idea chat listed for you

1. **Send the question's id** when an investigation starts. The server reads the question's group, measures and benchmark from the story itself, never from the page.
2. **Take the part count from the investigation.** Your read says every thesis has six parts. A compare-and-narrow thesis has seven.
3. **The ten-ticker limit applies to each question's group** on that route. The story's own `tickers` list stays at ten or fewer and holds the featured question's group first.

## 6. What content exists

- **Two pilot records,** in the appendix: one overview and one deep story. Both are drafts written by hand to the standard, with real sources. They are fit to use as fixtures in place of samples.
- **The first real set is not written.** It follows once the founder has approved the shape, so Build 2 should not wait for it. Explore stays dark until the founder has read the stories.
- **The founder has not ruled on the front-page recommendation above.** Please put it to him with your design.

## Appendix: the two pilot records

Both are in your kickoff's shape plus the optional fields above. `status` is `draft` and `publishedAt` is a placeholder.

**Overview — document id `ai-buildout`**

```json
{
  "version": 5,
  "status": "draft",
  "publishedAt": "<timestamp>",
  "kind": "overview",
  "lead": "story",
  "subject": "AI buildout",
  "title": "The AI buildout: who gets paid, and in what order",
  "deck": "Every new AI data center pays a chain of businesses, from chip designers to power companies. Each link has its own story.",
  "reporter": {
    "name": "Kim",
    "beat": "Themes and changing business conditions"
  },
  "evidenceSpan": "Sep to Nov 2026",
  "body": [
    "When a cloud company adds AI capacity, its money moves in order: it buys processors, houses them in a data center, and connects the building to the power grid. Each step pays a different kind of business.",
    "Alphabet, Google's parent, reported $51.4 billion of capital spending in the three months to September 30, 2026, mainly on servers, network equipment and data centers. NVIDIA reported $107.6 billion of Data Center sales in its quarter ended October 25, 2026.",
    "Kim's reading is that chip designers tend to be paid when hardware ships and utilities month by month once a building is switched on, with networking suppliers and landlords in between.",
    "The last step has the widest gap. Dominion Energy, Virginia's main utility, counts about 54 GW of data-center capacity under contract against a billed peak of 4.8 GW."
  ],
  "openQuestion": "Which step in the chain turns AI spending into sales soonest, and which has the most still on paper?",
  "connections": [
    {
      "id": "chips",
      "who": "Chip designers",
      "what": "Design the processors that run AI work and sell them to the companies that fill data centers.",
      "basis": "source_cited",
      "basisLine": "One company release cited. It gives NVIDIA's Data Center sales. It says nothing about the other three.",
      "sourceIds": [
        "s1"
      ],
      "leads": [
        {
          "symbol": "NVDA",
          "name": "NVIDIA"
        },
        {
          "symbol": "AMD",
          "name": "AMD"
        },
        {
          "symbol": "AVGO",
          "name": "Broadcom"
        },
        {
          "symbol": "MU",
          "name": "Micron"
        }
      ],
      "known": "NVIDIA reported Data Center sales of $107.6 billion for its quarter ended October 25, 2026.",
      "unknown": "How much of each other chip company's sales comes from data centers.",
      "whereToLook": "The segment tables in each company's quarterly report."
    },
    {
      "id": "cloud",
      "who": "Cloud companies",
      "what": "Pay for the processors, servers and buildings, then rent the computing power to others.",
      "basis": "source_cited",
      "basisLine": "One company filing cited. It shows Alphabet's spending. It does not name who Alphabet buys from, and it does not cover the other four companies.",
      "sourceIds": [
        "s2"
      ],
      "leads": [
        {
          "symbol": "GOOGL",
          "name": "Alphabet"
        },
        {
          "symbol": "MSFT",
          "name": "Microsoft"
        },
        {
          "symbol": "AMZN",
          "name": "Amazon"
        },
        {
          "symbol": "ORCL",
          "name": "Oracle"
        },
        {
          "symbol": "CRWV",
          "name": "CoreWeave"
        }
      ],
      "known": "Alphabet reported $51.4 billion of capital spending for the three months ended September 30, 2026, mainly on technical infrastructure.",
      "unknown": "Which cloud companies are growing fastest, and how each is paying for it.",
      "whereToLook": "Each company's quarterly results: cloud sales, capital spending, debt and cash."
    },
    {
      "id": "networking",
      "who": "Networking suppliers",
      "what": "Make the switches and cables that link thousands of processors into one system.",
      "basis": "reporters_reading",
      "basisLine": "Kim's reading of how AI systems are built. No filing cited.",
      "sourceIds": [],
      "leads": [
        {
          "symbol": "AVGO",
          "name": "Broadcom"
        },
        {
          "symbol": "CSCO",
          "name": "Cisco"
        }
      ],
      "known": "",
      "unknown": "How much cloud companies spend on networking for each dollar they spend on processors.",
      "whereToLook": "Capital-spending breakdowns on cloud companies' earnings calls, and Broadcom's remarks on its AI networking sales."
    },
    {
      "id": "landlords",
      "who": "Data-center landlords",
      "what": "Own data-center buildings and rent space in them to companies that need room for their machines.",
      "basis": "no_source_yet",
      "basisLine": "Nobody has checked this yet.",
      "sourceIds": [],
      "leads": [
        {
          "symbol": "EQIX",
          "name": "Equinix"
        },
        {
          "symbol": "DLR",
          "name": "Digital Realty"
        }
      ],
      "known": "",
      "unknown": "Whether the large cloud companies rent from landlords or mostly build their own data centers.",
      "whereToLook": "The customer and leasing sections of the landlords' annual reports, and the lease notes in each cloud company's filings."
    },
    {
      "id": "power",
      "who": "Electric utilities",
      "what": "Supply the electricity that data centers run on.",
      "basis": "source_cited",
      "basisLine": "One company presentation cited. It covers Dominion's own territory only.",
      "sourceIds": [
        "s3"
      ],
      "leads": [
        {
          "symbol": "D",
          "name": "Dominion Energy"
        },
        {
          "symbol": "NEE",
          "name": "NextEra Energy"
        },
        {
          "symbol": "DUK",
          "name": "Duke Energy"
        },
        {
          "symbol": "SO",
          "name": "Southern Company"
        },
        {
          "symbol": "CEG",
          "name": "Constellation Energy"
        }
      ],
      "known": "Dominion reported about 54 GW of data-center capacity under contract and a data-center billing peak of 4.8 GW as of August 2026.",
      "unknown": "Which utilities have the most data-center demand under contract, and how fast it turns into sales.",
      "whereToLook": "The utility's quarterly results and the load forecast it files with its grid operator.",
      "leadsToStory": "dominion-data-centers"
    }
  ],
  "sources": [
    {
      "id": "s1",
      "name": "NVIDIA news release: financial results for third quarter fiscal 2027",
      "kind": "Company release",
      "dated": "Nov 2026",
      "excerpt": "Data Center revenue of $107.6 billion, up 110% from a year ago",
      "url": "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Third-Quarter-Fiscal-2027/default.aspx"
    },
    {
      "id": "s2",
      "name": "Alphabet quarterly report (Form 10-Q) for the quarter ended September 30, 2026",
      "kind": "Company filing",
      "dated": "Oct 2026",
      "excerpt": "Capital expenditures, which primarily reflected investments in technical infrastructure, were $51.4 billion for the three months ended September 30, 2026.",
      "url": "https://s206.q4cdn.com/479360582/files/doc_financials/2026/q3/GOOG-10-Q-Q3-2026.pdf"
    },
    {
      "id": "s3",
      "name": "Dominion Energy presentation to PJM: 20-year data center forecast",
      "kind": "Company presentation",
      "dated": "Sep 2026",
      "excerpt": "Data center billing peak load as of August 2026 is 4.8 GW",
      "url": "https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf"
    },
    {
      "id": "s4",
      "name": "Microsoft news release: first quarter results, fiscal 2027",
      "kind": "Company release",
      "dated": "Oct 2026",
      "excerpt": "Azure revenue increased 48%",
      "url": "https://microsoft.com/en-us/investor/earnings/fy-2027-q1/press-release-webcast"
    },
    {
      "id": "s5",
      "name": "Amazon news release: third quarter 2026 results",
      "kind": "Company release",
      "dated": "Oct 2026",
      "excerpt": "AWS segment sales increased 39% year-over-year to $46.0 billion.",
      "url": "https://aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report"
    },
    {
      "id": "s6",
      "name": "Oracle news release: first quarter results, fiscal 2027",
      "kind": "Company release",
      "dated": "Sep 2026",
      "excerpt": "Q1 Cloud Infra (IaaS) Revenue up 121% in USD & up 120% in constant currency to $7.4 billion.",
      "url": "https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Q1-Results-Driven-by-Triple-Digit-Growth-in-Cloud-Infrastructure-Revenues/default.aspx"
    },
    {
      "id": "s7",
      "name": "CoreWeave news release: third quarter 2026 results (financial highlights table, in millions)",
      "kind": "Company release",
      "dated": "Nov 2026",
      "excerpt": "Revenue $ 3,661 $ 1,365",
      "url": "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Third-Quarter-2026-Results/default.aspx"
    }
  ],
  "questions": [
    {
      "id": "cloud-leaders",
      "angleLabel": "Cloud leaders",
      "featured": true,
      "text": "Which AI cloud companies are growing fastest, aside from Google?",
      "unknown": "Which cloud companies are growing fastest, and how each is paying for it.",
      "fromConnection": "cloud",
      "shape": "who_leads",
      "group": [
        {
          "symbol": "MSFT",
          "name": "Microsoft"
        },
        {
          "symbol": "AMZN",
          "name": "Amazon"
        },
        {
          "symbol": "ORCL",
          "name": "Oracle"
        },
        {
          "symbol": "CRWV",
          "name": "CoreWeave"
        }
      ],
      "measures": [
        {
          "kind": "reported",
          "name": "Cloud growth",
          "plain": "How much more the cloud business sold than a year ago.",
          "cells": [
            {
              "symbol": "MSFT",
              "value": 48,
              "unit": "percent",
              "period": "Quarter ended Sep 30, 2026",
              "sourceId": "s4",
              "excerpt": "Azure revenue increased 48%"
            },
            {
              "symbol": "AMZN",
              "value": 39,
              "unit": "percent",
              "period": "Quarter ended Sep 30, 2026",
              "sourceId": "s5",
              "excerpt": "AWS segment sales increased 39% year-over-year to $46.0 billion."
            },
            {
              "symbol": "ORCL",
              "value": 121,
              "unit": "percent",
              "period": "Quarter ended Aug 31, 2026",
              "sourceId": "s6",
              "excerpt": "Q1 Cloud Infra (IaaS) Revenue up 121% in USD & up 120% in constant currency to $7.4 billion."
            },
            {
              "symbol": "CRWV",
              "formula": "growth_from_year_ago",
              "inputs": [
                {
                  "value": 3661,
                  "unit": "USD millions",
                  "period": "Quarter ended Sep 30, 2026",
                  "sourceId": "s7",
                  "excerpt": "Revenue $ 3,661 $ 1,365"
                },
                {
                  "value": 1365,
                  "unit": "USD millions",
                  "period": "Quarter ended Sep 30, 2025",
                  "sourceId": "s7",
                  "excerpt": "Revenue $ 3,661 $ 1,365"
                }
              ]
            }
          ]
        },
        {
          "kind": "stored",
          "storedKey": "revenueGrowthYOY"
        },
        {
          "kind": "stored",
          "storedKey": "fcfMargin"
        }
      ],
      "benchmark": "XLK",
      "wrongIfSeed": "The names you pick trail the benchmark over the window, or lose their lead on your measures at the next earnings report.",
      "watch": {
        "document": "Each company's quarterly results",
        "updates": "Quarterly"
      }
    }
  ],
  "topics": [
    "AI buildout",
    "Chips",
    "Power"
  ],
  "tickers": [
    "MSFT",
    "AMZN",
    "ORCL",
    "CRWV",
    "GOOGL",
    "NVDA",
    "AMD",
    "AVGO",
    "D",
    "EQIX"
  ]
}
```

**Deep story — document id `dominion-data-centers`**

```json
{
  "version": 1,
  "status": "draft",
  "publishedAt": "<timestamp>",
  "kind": "deep",
  "parent": { "storyId": "ai-buildout", "connectionId": "power" },
  "about": [{ "symbol": "D", "name": "Dominion Energy" }],
  "lead": "story",
  "subject": "Dominion's data centers",
  "title": "Dominion has 54 GW of data centers on paper and 4.8 GW on the meter",
  "deck": "Most of what is promised to Virginia's main utility is not firm yet, and what is firm arrives slowly. From 2027 its largest customers owe minimum payments.",
  "reporter": { "name": "Kim", "beat": "Themes and changing business conditions" },
  "evidenceSpan": "Nov 2025 to Sep 2026",
  "body": [
    "Dominion Energy, the main electric utility in Virginia, told the grid operator PJM in September 2026 that about 54 GW of data-center capacity was under contract. The peak its data centers had actually been billed for, as of August, was 4.8 GW. One gigawatt (GW) is roughly what a large power plant produces.",
    "The 54 GW is three different promises. About 12.0 GW is under electric service agreements and 9.4 GW under construction letters. Dominion calls both firm. The other 32.5 GW is engineering letters, an earlier step, and Dominion leaves 59% of those out of its own forecast.",
    "Firm does not mean fast. Dominion says a data center takes about five years to ramp up and settles at 63% of its contracted capacity. Kim's arithmetic: at that rate the firm 21 GW would mature at roughly 13 GW of demand.",
    "How Dominion gets paid is changing too. Virginia's regulator ordered a new rate class, effective January 1, 2027, for customers of 25 megawatts or more. Contracts run 14 years, with minimum charges of 85% of contracted demand for the wires and 60% for generation. Kim's reading is that this makes part of the revenue arrive whether or not the load does.",
    "One more fact sits over all of this. In May 2026 NextEra Energy agreed to buy Dominion, paying 0.8138 NextEra shares for each Dominion share. The companies expected closing in 12 to 18 months, subject to approvals.",
    "Nothing cited here says which companies hold the contracts, or how much of the 54 GW will fall under the minimum charges."
  ],
  "openQuestion": "How fast does the firm part of Dominion's 54 GW become power it bills, and how much of it is covered by minimum payments?",
  "connections": [
    {
      "id": "customers",
      "who": "Data-center customers",
      "what": "Reserve capacity years ahead, then pay Dominion as their buildings start drawing power.",
      "basis": "source_cited",
      "basisLine": "One Dominion presentation cited, three lines from it. It counts 55 data-center companies and names none of them.",
      "sourceIds": ["s1", "s2", "s3"],
      "leads": [
        { "symbol": "AMZN", "name": "Amazon" },
        { "symbol": "MSFT", "name": "Microsoft" },
        { "symbol": "GOOGL", "name": "Alphabet" },
        { "symbol": "DLR", "name": "Digital Realty" },
        { "symbol": "EQIX", "name": "Equinix" }
      ],
      "known": "About 21 GW is firm: 12.0 GW of service agreements and 9.4 GW of construction letters. The billed peak was 4.8 GW in August 2026. Dominion's stated ramp is five years, settling at 63% of contracted capacity.",
      "unknown": "How fast the firm 21 GW becomes billed load, year by year.",
      "whereToLook": "Dominion's quarterly results and the yearly load forecast it files with PJM."
    },
    {
      "id": "regulator",
      "who": "Virginia's utility regulator",
      "what": "Sets what Dominion may charge, including minimum payments from its largest customers.",
      "basis": "source_cited",
      "basisLine": "One regulator order cited. It sets the rules. It does not say how many existing contracts they cover.",
      "sourceIds": ["s4"],
      "leads": [],
      "known": "From January 1, 2027, customers of 25 MW or more sign 14-year contracts with minimum charges of 85% of contracted demand for distribution and transmission and 60% for generation.",
      "unknown": "How much of the 54 GW will fall under the minimum charges.",
      "whereToLook": "Dominion's rate filings with the Virginia regulator, and its annual report."
    },
    {
      "id": "acquirer",
      "who": "The acquirer",
      "what": "Has agreed to buy Dominion for shares. The deal still needs approvals.",
      "basis": "source_cited",
      "basisLine": "One joint company release cited. It gives the terms as announced.",
      "sourceIds": ["s5"],
      "leads": [
        { "symbol": "NEE", "name": "NextEra Energy" }
      ],
      "known": "Announced May 18, 2026: 0.8138 NextEra shares for each Dominion share, with closing expected in 12 to 18 months.",
      "unknown": "When regulators will rule on the deal, and what conditions they attach.",
      "whereToLook": "The merger cases at the Virginia regulator and the federal energy regulator, and both companies' quarterly reports."
    },
    {
      "id": "builders",
      "who": "Grid equipment makers",
      "what": "Sell the turbines, transformers and switchgear a utility needs to serve new load.",
      "basis": "no_source_yet",
      "basisLine": "Nobody has checked this yet.",
      "sourceIds": [],
      "leads": [
        { "symbol": "GEV", "name": "GE Vernova" },
        { "symbol": "ETN", "name": "Eaton" }
      ],
      "known": "",
      "unknown": "Which suppliers Dominion is buying from, and how much it plans to spend.",
      "whereToLook": "The capital plan in Dominion's annual report, and suppliers' remarks on utility orders."
    },
    {
      "id": "onsite",
      "who": "On-site power suppliers",
      "what": "Sell data centers their own power supply, which could cut what they need from the utility.",
      "basis": "reporters_reading",
      "basisLine": "Kim's reading of an alternative data centers have. No source cited.",
      "sourceIds": [],
      "leads": [
        { "symbol": "BE", "name": "Bloom Energy" }
      ],
      "known": "",
      "unknown": "How many data centers in Dominion's territory plan to generate their own power.",
      "whereToLook": "Bloom Energy's customer announcements, and data-center operators' filings."
    }
  ],
  "sources": [
    {
      "id": "s1",
      "name": "Dominion Energy presentation to PJM: 20-year data center forecast (market overview)",
      "kind": "Company presentation",
      "dated": "Sep 2026",
      "excerpt": "Data center billing peak load as of August 2026 is 4.8 GW",
      "url": "https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf"
    },
    {
      "id": "s2",
      "name": "Dominion Energy presentation to PJM: 20-year data center forecast (ramp and utilization)",
      "kind": "Company presentation",
      "dated": "Sep 2026",
      "excerpt": "Dominion's industry average ramp period is 5 years maturing at a utilization rate of 63%",
      "url": "https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf"
    },
    {
      "id": "s3",
      "name": "Dominion Energy presentation to PJM: 20-year data center forecast (contract stages)",
      "kind": "Company presentation",
      "dated": "Sep 2026",
      "excerpt": "19 GW (59%) of ELOAs excluded from the forecast",
      "url": "https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf"
    },
    {
      "id": "s4",
      "name": "Virginia State Corporation Commission, Final Order, Case No. PUR-2025-00058",
      "kind": "Regulator order",
      "dated": "Nov 2025",
      "excerpt": "The Company shall implement a new rate schedule, Rate Schedule GS-5, as set forth below, effective January 1, 2027.",
      "url": "https://npr.brightspotcdn.com/b6/ac/706130b64d2b8eee6a9832b97e48/20251125-virginiascc-dominionenergyruling.pdf"
    },
    {
      "id": "s5",
      "name": "NextEra Energy and Dominion Energy joint news release on their agreement to combine",
      "kind": "Company release",
      "dated": "May 2026",
      "excerpt": "a fixed exchange ratio of 0.8138 shares of NextEra Energy for each share of Dominion Energy they own",
      "url": "https://s205.q4cdn.com/611413639/files/doc_news/NextEra-Energy-and-Dominion-Energy-to-Combine-Creating-the-Worlds-Largest-Regulated-Electric-Utility-Business-and-North-Americas-Prem-UUH80.pdf"
    }
  ],
  "questions": [
    {
      "id": "paper-to-meter",
      "angleLabel": "Paper to meter",
      "featured": true,
      "text": "How fast is Dominion's firm data-center capacity turning into power it actually bills?",
      "unknown": "How fast the firm 21 GW becomes billed load, year by year.",
      "fromConnection": "customers",
      "shape": "when",
      "wrongIfSeed": "The billed peak stays near 4.8 GW in the next yearly forecast while firm contracts keep growing.",
      "watch": { "document": "Dominion's quarterly results and its yearly load forecast to PJM", "updates": "Quarterly; the forecast yearly" }
    },
    {
      "id": "minimums",
      "angleLabel": "Minimum payments",
      "featured": false,
      "text": "How much of Dominion's contracted data-center capacity will fall under the new minimum charges?",
      "unknown": "How much of the 54 GW will fall under the minimum charges.",
      "fromConnection": "regulator",
      "shape": "how_much",
      "wrongIfSeed": "Rate filings show contracts signed before 2027 are exempt from the minimum charges.",
      "watch": { "document": "Dominion's rate filings with the Virginia regulator", "updates": "When filed; base rates are reviewed every two years" }
    },
    {
      "id": "own-power",
      "angleLabel": "Own power",
      "featured": false,
      "text": "What share of new data centers in Dominion's territory plan to supply their own power?",
      "unknown": "How many data centers in Dominion's territory plan to generate their own power.",
      "fromConnection": "onsite",
      "shape": "what_replaces",
      "wrongIfSeed": "Dominion's contracted capacity keeps rising while on-site power deals in Virginia stay rare.",
      "watch": { "document": "Dominion's contract totals each quarter, and Bloom Energy's customer announcements", "updates": "Quarterly" }
    }
  ],
  "topics": ["AI buildout", "Power", "Utilities"],
  "tickers": ["D", "NEE", "AMZN", "MSFT", "GOOGL", "DLR", "EQIX", "GEV", "ETN", "BE"]
}
```
