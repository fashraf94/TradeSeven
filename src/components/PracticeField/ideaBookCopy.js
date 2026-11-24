// src/components/PracticeField/ideaBookCopy.js
//
// Practice Field build B3 — the idea book screen's own chrome words and layout rule (the view, built on the server, carries
// every word about the book itself; api/_utils/practiceField/bookViewCopy.js). Data and pure functions only.

/** The screen's own chrome words (the view carries everything about the book). */
export const IDEA_BOOK_COPY = Object.freeze({
  title: 'Idea book',
  breadcrumb: 'Command Center / Idea book',
  afterCloseWord: 'after the close',
  back: 'Back to Command Center',
  tabs: Object.freeze([['pos', 'Positions'], ['desks', 'Desks'], ['history', 'History']]),
  heads: Object.freeze(['Symbol', 'Mark', 'P/L Open', 'P/L Day']),
  headsDesk: Object.freeze(['Symbol', 'Mark', 'To its line', 'P/L Open', 'P/L Day']),
  ledgerHeads: Object.freeze(['Name', 'Entry', 'Now', 'Line']),
  cash: 'Cash',
  since: 'Since yesterday',
  todaysCall: 'Today’s call',
  gap: 'Gap',
  vsSpy: 'vs SPY',
  shares: 'Shares',
  positionValue: 'Position value',
  itsCalls: 'Its calls',
  passedOn: 'Ideas the desk passed on',
  writtenAfter: (date) => `written after the close, ${date}`,
  afterClose: (desk, date) => `${desk} · after the close, ${date}`,
  draft: (date) => `Draft · ${date}`,
  finished: 'Finished ideas',
  idea: 'The idea',
  lastCall: 'Last call',
  close: 'Close',
  openResult: (names, words) => `${names}, ${words}. Open the result`,
  loading: 'Reading the book…',
  empty: 'No idea book yet.',
  emptySub: 'When your agents open one, it shows here.',
  error: 'The book could not be read just now. It reads again when you come back to this page.',
  waitingData: 'Waiting on data',
  sellsLabel: (word, rest) => `${word} · ${rest}`,
});

export const layoutOfWidth = (w) => (w >= 900 ? 'desk' : w < 360 ? 'p320' : 'p390');

/** The entry card's second line: today's change, or why there is none. Composed from the view's strings; no arithmetic. */
export function entryTodayOf(line) {
  if (line.paused) return { text: 'Paused', dir: 0 };
  if (line.first?.kind === 'opens') return { text: `${line.first.label} ${line.first.value}`, dir: 0 };
  const t = line.today;
  if (!t) return null;
  if (t.waiting) return { text: t.waiting, dir: 0 };
  return { text: `${t.text} (${t.pct}) today`, dir: t.dir };
}
