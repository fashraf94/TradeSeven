// api/_utils/sharedResearch/everydayNames.js
//
// Research universe Build 3b, build prompt section 5.5 (founder ruling RU-20, Nov 27 2026): EVERYDAY NAMES COUNT. A
// short, hand-typed list that lets "Google" mean Alphabet: an everyday name a player or a source writes for a whole
// company, mapped to exactly one symbol on the research list (the 228 or the directory). Whole companies only: no
// products, no brands a company sells under, no divisions. At most 40 entries, each with a one-line reason.
//
// Used on RESEARCH sessions only in this build (sessionUniverse.js): isSameCompany accepts a listed everyday name for
// its symbol, and the name lookup reads it. A game-list session behaves exactly as before.
//
// DATA ONLY: no import, no code. everydayNames.test.js pins the rules: at most 40; each name maps to one symbol on the
// research list; no name is another listed company's own name (its core name as the lookup reads it) or another
// company's symbol; no two entries share a name.

/** [everyday name, symbol, why] — the name as people write it; matched without regard to case or punctuation. */
export const EVERYDAY_NAMES = Object.freeze([
  ['Google', 'GOOGL', "Alphabet's everyday name, and the company's own name until 2015."],
  ['Facebook', 'META', 'Meta Platforms was named Facebook until 2021.'],
  ['TSMC', 'TSM', 'The usual short name of Taiwan Semiconductor Manufacturing.'],
  ['Taiwan Semi', 'TSM', 'Market shorthand for Taiwan Semiconductor Manufacturing.'],
  ['Taiwan Semiconductor', 'TSM', 'Taiwan Semiconductor Manufacturing without its last word, as sources write it.'],
  ['J&J', 'JNJ', 'The usual short name of Johnson & Johnson.'],
  ['Johnson and Johnson', 'JNJ', 'Johnson & Johnson written with "and".'],
  ['P&G', 'PG', 'The usual short name of Procter & Gamble.'],
  ['Procter and Gamble', 'PG', 'Procter & Gamble written with "and".'],
  ['AmEx', 'AXP', 'The usual short name of American Express.'],
  ['BofA', 'BAC', 'The usual short name of Bank of America.'],
  ['JPMorgan', 'JPM', 'The everyday name of JPMorgan Chase.'],
  ['Goldman', 'GS', 'The everyday short name of Goldman Sachs.'],
  ['Disney', 'DIS', 'The everyday name of The Walt Disney Company.'],
  ['Exxon', 'XOM', 'The everyday short name of Exxon Mobil.'],
  ['ExxonMobil', 'XOM', 'Exxon Mobil written as one word.'],
  ['Lilly', 'LLY', 'The everyday short name of Eli Lilly.'],
  ['Raytheon', 'RTX', 'RTX Corporation was Raytheon Technologies until 2023.'],
  ['Toyota', 'TM', 'The everyday name of Toyota Motor.'],
  ['Honda', 'HMC', 'The everyday name of Honda Motor.'],
  ['AB InBev', 'BUD', 'The usual short name of Anheuser-Busch InBev.'],
  ['Uber', 'UBER', 'The everyday name of Uber Technologies.'],
  ['Palantir', 'PLTR', 'The everyday name of Palantir Technologies.'],
  ['Micron', 'MU', 'The everyday name of Micron Technology.'],
  ['Marvell', 'MRVL', 'The everyday name of Marvell Technology.'],
  ['Arista', 'ANET', 'The everyday name of Arista Networks.'],
  ['Spotify', 'SPOT', 'The everyday name of Spotify Technology.'],
  ['Mercado Libre', 'MELI', 'MercadoLibre written as two words.'],
  ['Pinduoduo', 'PDD', 'PDD Holdings was named Pinduoduo until 2023.'],
].map((row) => Object.freeze(row)));
