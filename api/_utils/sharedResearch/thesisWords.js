// api/_utils/sharedResearch/thesisWords.js
//
// Shared Research — THE THESIS BUILDER'S OWN WORDING RULES, pure (Amendment B §B4.2
// rules 3 and 4, rulebook §6; B3 review RB-1, RB-2, RB-3). Builder lines only: the
// card's proposal lines, the shared reason a confirm keeps and the builder's reply.
// B1's checks (stepSchema.js forbiddenIn, promisesService) stay exactly as they are
// and run first; these add what the builder's own words need and the ledger's never
// did, so no ledger answer moves.
//
//   NAMES_A_PRICE      a wrong-if option names a price, a price target or a share-price
//                      move (rule 4: price lines are the player's own)
//   BUILDER_FORECAST   a share-price move with no figure ("its stock will rise"), praise
//                      ("a great play", "the clear winner") and odds in words ("a
//                      nine-in-ten chance") — rulebook §6: never call a stock a good
//                      purchase, a great play or a winner, never say where its price is headed
//   BUILDER_PROMISE    the thesis watched, tracked, tested or held by anyone or anything,
//                      an alert, "keep an eye on" — rulebook §6's last line
//   lineFailOf         rule 3 on one line: B1's forbidden patterns, the stray-ticker scan,
//                      B1's service promise, these two, and every number held

import { forbiddenIn, strayTickersOf, strayNumberOf, sentencesOf, promisesService } from './stepSchema.js';
import { gameUniverse } from './companies.js';

/** A price, a price target or a share-price move: a wrong-if option names a business condition only (rule 4). */
export const NAMES_A_PRICE = new RegExp([
  String.raw`\$\s?\d`,
  String.raw`\b\d[\d,.]*\s*(?:dollars?|usd)\b`,
  String.raw`\bprice\s+targets?\b|\btarget\s+price\b`,
  String.raw`\b(?:share|stock)\s+prices?\b`,
  String.raw`'s\s+(?:share\s+|stock\s+)?price\b`,
  String.raw`\bprice\s+(?:drops?|dropped|falls?|fell|declines?|declined|sinks?|sank|slides?|slid|rises?|rose|climbs?|climbed|halves|halved)\b`,
  String.raw`\b(?:stock|shares?)\s+(?:falls?|fell|drops?|dropped|declines?|declined|closes?|closed|trades?|traded|sinks?|sank|slides?|slid|rises?|rose|halves|halve|halved|doubles?|doubled|tumbles?|tumbled|plunges?|plunged)\b`,
  String.raw`\b(?:closes?|closing|trades?|trading)\s+(?:below|above|under|over)\b`,
  String.raw`\btrades?\s+(?:lower|higher|down|up)\b`,
  String.raw`\bsells?\s+off\s+(?:after|on|as|when|following|into)\b|\bsell-?off\b`,
  String.raw`\b52[-\s]week\b`,
].join('|'), 'i');

/** "market share" is business prose; the subject a price move needs is the stock, its shares or its price. */
const PRICE_SUBJECT = String.raw`(?:(?<!market\s)\bshares\b|\bstock\b|\b(?:share|stock)\s+price\b|\bits\s+price\b)`;
const MOVE = String.raw`(?:rise|rally|climb|soar|jump|surge|gain|fall|drop|sink|slide|double|triple|outperform|beat\s+the\s+market|go\s+(?:up|down)|head\s+(?:up|down|higher|lower))`;
const ODDS_WORDS = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten)[-\s]in[-\s](?:two|three|four|five|six|seven|eight|nine|ten|a\s+hundred)`;
/** Forecasts, praise and odds the builder's own lines may never hold (rulebook §6). Tested per sentence. */
export const BUILDER_FORECAST = Object.freeze({
  price_move: new RegExp(String.raw`${PRICE_SUBJECT}[^.!?]{0,40}\b(?:will|should|could|may|might|(?:is|are)\s+(?:going|set|likely|poised|bound)\s+to|to)\s+(?:\w+ly\s+)?${MOVE}`, 'i'),
  praise: /\b(?:clear|obvious|big(?:gest)?)\s+winner\b|\bgreat\s+(?:play|buy|bet|pick|investment)\b|\bgood\s+(?:buy|purchase|investment|bet)\b|\bmust[-\s]own\b|\bno[-\s]brainer\b|\bcan(?:'|no)t\s+lose\b|\btop\s+pick\b/i,
  odds_in_words: new RegExp(String.raw`\b${ODDS_WORDS}\s+chance\b|\b(?:high|strong|good|fair|low)\s+(?:odds|probability|likelihood)\b`, 'i'),
});

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WATCH_VERBS = String.raw`(?:watch|watched|track|tracked|monitor|monitored|test|tested|hold|held|follow|followed|alert|notify|check\s+on|keep\s+(?:an\s+eye|watch|tabs)\s+on)`;
/** The builder's promises (rulebook §6's last line), the partner's own name a subject too. */
export function builderPromiseOf(text, partnerName = null) {
  const name = typeof partnerName === 'string' && partnerName.trim().length >= 2 ? `|${escapeRe(partnerName.trim())}` : '';
  const subjects = String.raw`(?:we|I|the\s+app|the\s+agent|your\s+agent|the\s+idea\s+book${name})`;
  const res = [
    new RegExp(String.raw`\b(?:the|this|your)\s+thesis\s+(?:will|is\s+going\s+to|gets?)\s+(?:be\s+)?(?:\w+ly\s+)?${WATCH_VERBS}\b`, 'i'),
    new RegExp(String.raw`(?<![\p{L}\p{N}_])${subjects}(?![\p{L}\p{N}_])\s+(?:will|'ll|(?:is|are|am)\s+going\s+to)\s+(?:\w+\s+){0,2}${WATCH_VERBS}\b`, 'iu'),
    /\bwill\s+(?:alert|notify|warn|ping)\s+you\b/i,
    /\bkeep\s+(?:an\s+eye|watch|tabs)\s+on\b/i,
  ];
  return sentencesOf(String(text ?? '')).some((s) => res.some((re) => re.test(s)));
}

/** The builder-only wording a text breaks: 'forecast:<name>' or 'builder_promise', else null. */
export function builderWordingOf(text, partnerName = null) {
  for (const s of sentencesOf(String(text ?? ''))) {
    for (const [name, re] of Object.entries(BUILDER_FORECAST)) if (re.test(s)) return `forecast:${name}`;
  }
  return builderPromiseOf(text, partnerName) ? 'builder_promise' : null;
}

/**
 * Rule 3 on one builder line: B1's forbidden patterns, the stray-ticker scan, B1's service promise, the builder's own
 * wording, and the number rule (a number must sit in a Source-backed finding the line cites — `held`). The rule's name
 * when it breaks one, else null.
 */
export function lineFailOf(text, held, { partnerName = null, universe = gameUniverse } = {}) {
  if (forbiddenIn(text, { partnerName }).length) return 'forbidden';
  if (strayTickersOf(text, universe).length) return 'stray_ticker';
  if (promisesService(text, partnerName)) return 'service_promise';
  const w = builderWordingOf(text, partnerName);
  if (w) return w;
  if (sentencesOf(text).some((s) => strayNumberOf(s, held) !== undefined)) return 'unsupported_number';
  return null;
}
