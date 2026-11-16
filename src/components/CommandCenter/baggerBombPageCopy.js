// src/components/CommandCenter/baggerBombPageCopy.js
//
// League hide — the BaggerBomb page's own words (founder rulings Q1–Q6, Nov 15, 2026). Only what the hub's copy
// (hub/hubCopy.js) does not already say: the page's title and the labels of its four parts. Every line the hub's sections
// already carry (the deploy lines, the games rows, the notes, the history sheet) is the hub's, said by the same component,
// so the page and the hub cannot word one state two ways.

export const BAGGERBOMB_PAGE_COPY = Object.freeze({
  region: 'BaggerBomb',
  eyebrow: 'BaggerBomb',
  title: 'Your BaggerBomb game',
  record: Object.freeze({
    label: 'Record',
    wins: 'Wins',
    losses: 'Losses',
    gamesPlayed: 'Games played',
    /** Where the numbers come from, said once (the hub's own career line says the same of the same stored stats). */
    caption: 'BaggerBomb vs CPU · as recorded',
    loading: 'Checking your record',
    unavailable: 'Record unavailable',
  }),
  live: Object.freeze({
    label: 'Live game',
    none: 'No game live',
    noneSub: 'A game you deploy shows here while it runs.',
    openGame: 'Open game',
  }),
  finished: Object.freeze({
    label: 'Finished games',
    empty: 'No finished games yet',
    emptySub: 'Your finished BaggerBomb games are listed here.',
    history: 'History',
  }),
});
