// api/_utils/__fixtures__/eodhdNewsCapture.js
// PROVENANCE: captured from EODHD /news by the Huddle S1 build (Amendment C V1.2 §C13),
// 2026-11-07T20:23:18.640Z (Saturday, Nov 7 2026), TWO calls — the authorized spend, no more:
//   /news?s=AAPL.US&limit=3&fmt=json   and   /news?s=PFE.US&limit=3&fmt=json
// (PFE was chosen as the symbol likely to carry a press-wire item; it carried none.)
// The API token is stripped: it was only ever in the request URL, which is not stored.
//
// OBSERVED (every item of both responses):
//   keys       exactly 7 — date, title, content, link, symbols, tags, sentiment
//   date       ISO 8601 with an explicit UTC offset, '2026-11-07T18:43:37+00:00' (UTC)
//   link       present on every item, an absolute https URL (hosts: finance.yahoo.com,
//              seekingalpha.com); C1's required url holds
//   content    present on every item (full article text, 3,699–7,866 characters);
//              TRUNCATED here to its first 240 characters, the original length kept as
//              `contentLength` (a key the fixture adds, never read as a vendor key)
//   symbols    present, an array of EODHD codes, US and non-US listings and indices
//              ('AAPL.US', '9MW.F', 'IXIC.INDX', 'PFE:CA.US', …); an item tagged with a
//              symbol is often ABOUT ANOTHER COMPANY (AAPL's three items are about MRVL,
//              GIL and CSCO; one PFE item is about XERS)
//   tags       present, an array (0–7 strings)
//   sentiment  present, { polarity, neg, neu, pos }
//   id         ABSENT — no item carries an id (C1: newsId is derived from the url)
//   source     ABSENT — there is no `source` key (api/news/stock.js:65 reads one and
//              always gets its 'Unknown' fallback); the source label is the link's host
// Contradiction with C1: none — C1's url and vendor date are both present. Not proven
// by this capture: a press-wire item (none came back), so the press-wire host list in
// api/_utils/evidence/eodhdNews.js is unexercised by real data.

export const EODHD_NEWS_CAPTURE = Object.freeze([
  {
    "symbol": "AAPL",
    "status": 200,
    "items": [
      {
        "date": "2026-11-07T18:43:37+00:00",
        "title": "Here’s Why Bank of America and TD Cowen Backed Away From Marvell (MRVL)",
        "content": "We just published a list of the Analysts Just Sounded the Alarm on These 10 Overhyped Stocks and Marvell Technology (NASDAQ:MRVL) ranked 10th on this list.\n\nWall Street had a rough week, and the damage came fast. Thursday's sell-off erased ",
        "contentLength": 4663,
        "link": "https://finance.yahoo.com/markets/stocks/articles/why-bank-america-td-cowen-184337011.html",
        "symbols": [
          "9MW.F",
          "AAPL.US",
          "IXIC.INDX",
          "M2RV34.SA",
          "MRVL.US",
          "NKE.US"
        ],
        "tags": [
          "PRICE TARGET"
        ],
        "sentiment": {
          "polarity": 0.973,
          "neg": 0.047,
          "neu": 0.877,
          "pos": 0.075
        }
      },
      {
        "date": "2026-11-07T18:42:54+00:00",
        "title": "Here’s Why UBS Analyst Jay Sole Downgraded Gildan (GIL)",
        "content": "We just published a list of the Analysts Just Sounded the Alarm on These 10 Overhyped Stocks and Gildan Activewear (NYSE:GIL) ranked 6th on this list.\n\nWall Street had a rough week, and the damage came fast. Thursday's sell-off erased $2.3 ",
        "contentLength": 4605,
        "link": "https://finance.yahoo.com/markets/stocks/articles/why-ubs-analyst-jay-sole-184254231.html",
        "symbols": [
          "AAPL.US",
          "GIL.US",
          "IXIC.INDX",
          "NKE.US"
        ],
        "tags": [
          "EARNINGS PER SHARE",
          "PRICE TARGET"
        ],
        "sentiment": {
          "polarity": 0.992,
          "neg": 0.058,
          "neu": 0.836,
          "pos": 0.107
        }
      },
      {
        "date": "2026-11-07T18:42:15+00:00",
        "title": "Here’s Why Morgan Stanley Analyst Meta Marshall Trimmed Cisco (CSCO) to Equal-weight",
        "content": "We just published a list of the Analysts Just Sounded the Alarm on These 10 Overhyped Stocks and Cisco Systems (NASDAQ:CSCO) ranked 7th on this list.\n\nWall Street had a rough week, and the damage came fast. Thursday's sell-off erased $2.3 t",
        "contentLength": 4592,
        "link": "https://finance.yahoo.com/markets/stocks/articles/why-morgan-stanley-analyst-meta-184215687.html",
        "symbols": [
          "AAPL.US",
          "CSCO.US",
          "IXIC.INDX",
          "NKE.US"
        ],
        "tags": [
          "FOURTH QUARTER",
          "PRICE TARGET"
        ],
        "sentiment": {
          "polarity": 0.99,
          "neg": 0.052,
          "neu": 0.853,
          "pos": 0.095
        }
      }
    ]
  },
  {
    "symbol": "PFE",
    "status": 200,
    "items": [
      {
        "date": "2026-11-07T16:45:02+00:00",
        "title": "Earnings Scoreboard: 86% of reporting firms beat EPS estimates, 78% post Y/Y earnings growth",
        "content": "[Rolled newspaper with the headline Quarterly Results]\nZerbor\n\nEarnings season reaches peak intensity this week as 142 companies report quarterly results, anchored by major releases across mega-cap technology, pharmaceuticals, energy, aeros",
        "contentLength": 7866,
        "link": "https://seekingalpha.com/news/4667797-earnings-scoreboard-86-of-reporting-firms-beat-eps-estimates-78-post-yy-earnings-growth?utm_source=feed_news_all&amp;utm_medium=referral&amp;feed_item_type=news",
        "symbols": [
          "AAPL.US",
          "AAPL:CA.US",
          "AMAT.US",
          "AMD.US",
          "AMD:CA.US",
          "CEG.US",
          "CSCO.US",
          "CVS.US",
          "CVS:CA.US",
          "FERG.US",
          "KKR.US",
          "MCD.US",
          "MCD:CA.US",
          "NRG.US",
          "O.US",
          "OXY.US",
          "PFE.US",
          "PFE:CA.US",
          "PLTR.US",
          "PLTR:CA.US",
          "QCOM.US",
          "QCOM:CA.US",
          "SMCI.US",
          "SMCI:CA.US",
          "TDG.US",
          "TTWO.US",
          "UBER.US",
          "UBER:CA.US",
          "VYLR.US"
        ],
        "tags": [
          "CONSENSUS ESTIMATE",
          "EARNINGS GROWTH",
          "EARNINGS NEWS",
          "ON THE MOVE",
          "QUARTERLY RESULTS",
          "REVENUE GROWTH",
          "SPLIT"
        ],
        "sentiment": {
          "polarity": 0.992,
          "neg": 0.027,
          "neu": 0.887,
          "pos": 0.086
        }
      },
      {
        "date": "2026-11-07T11:13:34+00:00",
        "title": "Xeris Biopharma (XERS) Adds Menassie M. Taddese To Its Board",
        "content": "Xeris Biopharma Holdings (NasdaqGS:XERS) has appointed Menassie M. Taddese to its Board of Directors. Taddese brings nearly 30 years of global biopharma experience, including senior roles at Viatris and Pfizer. His background spans commerci",
        "contentLength": 4121,
        "link": "https://finance.yahoo.com/healthcare/articles/xeris-biopharma-xers-adds-menassie-111334007.html",
        "symbols": [
          "0512.HK",
          "2696.HK",
          "PFE.BA",
          "PFE.DU",
          "PFE.F",
          "PFE.MU",
          "PFE.MX",
          "PFE.US",
          "PFEB.F",
          "PFIZ34.SA",
          "VTRS.US",
          "XERS.US"
        ],
        "tags": [
          "NET INCOME",
          "REVENUE GROWTH"
        ],
        "sentiment": {
          "polarity": 0.967,
          "neg": 0.018,
          "neu": 0.924,
          "pos": 0.058
        }
      },
      {
        "date": "2026-11-06T23:09:01+00:00",
        "title": "Pfizer (PFE) Maps Out $650 Million Connecticut Center For Global Clinical Trials",
        "content": "Pfizer (NYSE:PFE) plans to build a US$650 million manufacturing technology center in Connecticut to support global clinical trials. The planned facility is expected to produce clinical active pharmaceutical ingredients and drug products for",
        "contentLength": 3699,
        "link": "https://finance.yahoo.com/healthcare/articles/pfizer-pfe-maps-650-million-230901925.html",
        "symbols": [
          "PFE.BA",
          "PFE.DU",
          "PFE.F",
          "PFE.MU",
          "PFE.MX",
          "PFE.US",
          "PFEB.F",
          "PFIZ34.SA"
        ],
        "tags": [],
        "sentiment": {
          "polarity": 0.974,
          "neg": 0.027,
          "neu": 0.899,
          "pos": 0.074
        }
      }
    ]
  },
]);

export const OBSERVED_KEYS = Object.freeze(['date', 'title', 'content', 'link', 'symbols', 'tags', 'sentiment']);
