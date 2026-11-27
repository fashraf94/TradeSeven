// src/components/Explore/__fixtures__/stories.js — fixture support (Explore Build 1, build prompt K-16; Explore Build 2,
// build prompt K-19).
//
// THREE SAMPLE STORIES in the record's shape, for the jsdom rows and the fixture preview ONLY. Each carries
// `sample: true`, so the page's own reader (exploreView.js storyOf) drops it if it ever came from the collection; a
// sample is never researched and never written anywhere (FQ-1). Every sample company is labelled as one where it is
// named ("KSTL (sample company)"), and is plain text, never a button. The real tickers (NVDA, V, MA, NEE, DUK) are named
// only as the kind of company a story is about: never with a quotation, and never under a "Source cited" connection,
// whose only sources here are samples (review A-10).
//   1. the Round 1 mockup's AI-buildout story, rewritten so that every sentence resting on the reporter's reading
//      says so in its own words (E-8), and every connection carries one of the three bases (E-1);
//   2. a product-led story, "Who earns when you tap to pay?" (E-2);
//   3. a utilities story with two featured questions (one investigation per story, E-5).
// Build 2 (K-19) rewrote the three into the new shape — a `kind`, a `subject`, connection ids, leads as `{ symbol,
// name }` (a sample company: a name only), the three-part gap, and each question's `fromConnection` — keeping every
// field an earlier row reads. They stay samples.
//
// THE TWO PILOT RECORDS (./pilot/*.json): the content chat's note of Nov 25, Appendix, word for word — real drafts,
// not samples (no `sample` field, no "Sample" tag). They are drafts with a placeholder `publishedAt`, so the page drops
// them as they sit; PILOT_OVERVIEW and PILOT_DEEP are the page's own reader over each AS IT WOULD BE once published (a
// real instant, `status: 'published'`), as the publish step itself asks (api/_utils/explore/storyCheck.js asPublished).
// The overview is the newest overview, so it is the front page's hero.
//
// THE OLD SHAPE: OLD_SHAPE_RECORD is the AI sample as Build 1 wrote it (leads as text, no kind, no subject, no gap, no
// branch on its questions), so the rows can show that a story in the old shape still reads (Amendment B §4.3).

import { storyOf } from '../exploreView';
import AI_BUILDOUT from './pilot/ai-buildout.json';
import DOMINION from './pilot/dominion-data-centers.json';

export const SAMPLE_AI = Object.freeze({
  id: 'sample-ai-buildout',
  version: 2,
  status: 'published',
  publishedAt: '2026-11-20T14:00:00.000Z',
  kind: 'overview',
  lead: 'story',
  subject: 'AI data centers',
  title: 'AI growth reaches beyond the chips',
  deck: 'Chips, networking and power equipment serve different parts of the buildout. Each is a different business connection to examine.',
  reporter: { name: 'Kim', beat: 'Themes and changing business conditions' },
  evidenceSpan: 'May to Sep 2026',
  body: [
    'When a company announces a new AI data center, the headline usually goes to the chips inside it. Chips are only one line on the bill.',
    'A data center is a building full of computers that has to be wired together, powered and kept cool. Each of those jobs belongs to a different kind of business. Chip designers sell the processors that do the AI work. Networking companies sell the switches and cables that let thousands of processors act as one machine. Power-equipment makers sell the transformers, switchgear and backup systems that connect the building to the grid.',
    "These businesses share a customer, but not a calendar. Kim's reading is that chips tend to be ordered close to when they are needed, that power equipment is often ordered long before a site opens, and that networking tends to follow the chips. No filing behind this story states that order.",
    'That difference matters for anyone trying to follow the money. A company can appear in every AI story and still earn only a small part of its sales from the buildout. The sample filings behind this story name what two suppliers sell; they say less about how much each one depends on this spending.',
  ],
  parts: [
    { name: 'Chips', job: 'Do the AI work', timing: "Often ordered close to when they are needed (Kim's reading)" },
    { name: 'Networking', job: 'Links the chips into one machine', timing: "Tends to follow chip orders (Kim's reading)" },
    { name: 'Power equipment', job: 'Connects the site to the grid', timing: "Often ordered long before a site opens (Kim's reading)" },
  ],
  openQuestion: 'Which of these connections is large enough to matter to the business?',
  connections: [
    {
      id: 'chips', who: 'Chip designers', what: 'Sell the processors that run AI work to data-center operators.', basis: 'source_cited',
      basisLine: 'Two sample company filings cited. Each describes what the company sells.', sourceIds: ['s1', 's2'],
      leads: [{ name: 'KSTL (sample company)' }, { name: 'HLDN (sample company)' }],
      known: 'Two sample filings describe what KSTL and HLDN sell to cloud customers.',
      unknown: "How much of each supplier's sales depends on AI spending.",
      whereToLook: 'The segment tables in each sample company’s quarterly report.',
    },
    {
      id: 'networking', who: 'Networking suppliers', what: 'Sell the switches and cables that link processors together.', basis: 'reporters_reading',
      basisLine: "Kim's reading of how these systems are built. No filing cited.", sourceIds: [], leads: [{ symbol: 'NVDA', name: 'NVIDIA' }],
      known: '',
      unknown: 'How much networking a data center buys for each processor.',
      whereToLook: 'Capital-spending breakdowns on cloud companies’ earnings calls.',
    },
    {
      id: 'power', who: 'Power-equipment makers', what: 'Sell transformers, switchgear and backup systems to new sites.', basis: 'no_source_yet',
      basisLine: 'No source ties a company to this yet. The sample industry overview below describes lead times and names no company.', sourceIds: [],
      leads: [{ name: 'VLTA (sample company)' }, { name: 'GRDN (sample company)' }],
      known: '',
      unknown: "Whether any filing ties these companies' orders to data centers.",
      whereToLook: 'Order backlogs in the sample companies’ reports.',
    },
  ],
  sources: [
    { id: 's1', name: 'KSTL quarterly report', kind: 'Company filing · sample company', dated: 'Aug 2026', excerpt: 'Accelerator sales to cloud customers grew during the quarter.', url: null },
    { id: 's2', name: 'HLDN quarterly report', kind: 'Company filing · sample company', dated: 'Sep 2026', excerpt: 'The company designs custom chips with its largest customers.', url: null },
    { id: 's3', name: 'Grid equipment overview', kind: 'Industry overview · sample trade body', dated: 'May 2026', excerpt: 'Operators report long lead times for transformers and switchgear.', url: null },
  ],
  questions: [
    {
      id: 'q-chips', angleLabel: 'Chip suppliers', featured: true, sourceIds: ['s1', 's2'], leads: ['NVDA', 'KSTL (sample company)', 'HLDN (sample company)'],
      text: 'Which chip suppliers have evidence of meaningful exposure to AI spending?',
      unknown: "How much of each supplier's sales depends on AI spending.",
      fromConnection: 'chips',
    },
    {
      id: 'q-power', angleLabel: 'Power equipment', featured: false, sourceIds: ['s3'], leads: ['VLTA (sample company)', 'GRDN (sample company)'],
      text: 'Which power-equipment businesses have a sourced connection to the buildout?',
      unknown: "Whether any filing ties these companies' orders to data centers.",
      fromConnection: 'power',
    },
  ],
  topics: ['AI buildout', 'Energy grid'],
  tickers: ['NVDA'],
  sample: true,
});

export const SAMPLE_TAP = Object.freeze({
  id: 'sample-tap-to-pay',
  version: 1,
  status: 'published',
  publishedAt: '2026-11-19T15:30:00.000Z',
  kind: 'overview',
  lead: 'product',
  productName: 'Tap to pay',
  subject: 'Tap to pay',
  title: 'A tap at the register touches several businesses',
  deck: 'A phone or card held to a reader starts a chain of companies, each with its own part of the fee.',
  reporter: { name: 'Ari', beat: 'Payments' },
  evidenceSpan: 'Jun to Oct 2026',
  body: [
    'Tapping a card or a phone at a register takes about a second. Behind that second sit several businesses: the card network that carries the message, the processor that the store pays, the bank that issued the card, and sometimes the maker of the phone.',
    "Each of them can take a part of the fee. Ari's reading is that the card networks tend to earn on every tap, while processors often compete hard on price for large stores. The sample sources behind this story describe the chain; they do not say how the fee is split for any one store.",
  ],
  parts: [
    { name: 'Card network', job: 'Carries the payment message', timing: 'On every tap' },
    { name: 'Processor', job: 'Connects the store to the network', timing: 'Paid by the store' },
    { name: 'Issuing bank', job: "Holds the shopper's account", timing: 'Can earn part of the fee' },
  ],
  openQuestion: 'Which business in the chain keeps the largest part of the fee?',
  connections: [
    {
      id: 'networks', who: 'Card networks', what: 'Carry the payment between the store and the bank.', basis: 'reporters_reading',
      basisLine: "Ari's reading of how a tap travels. The sample report below describes contactless growth, not the networks.", sourceIds: [],
      leads: [{ symbol: 'V', name: 'Visa' }, { symbol: 'MA', name: 'Mastercard' }],
      known: '', unknown: 'How much of each tap the networks keep.', whereToLook: 'The networks’ annual reports, by revenue line.',
    },
    {
      id: 'processors', who: 'Payment processors', what: 'Sell stores the service that accepts taps.', basis: 'source_cited',
      basisLine: 'One sample company filing cited. It describes what the company sells.', sourceIds: ['p2'], leads: [{ name: 'PAYQ (sample company)' }],
      known: 'A sample filing describes PAYQ selling payment acceptance to merchants.', unknown: 'What a processor earns on one tap.', whereToLook: 'The sample company’s pricing notes.',
    },
    { id: 'phones', who: 'Phone makers', what: 'Build the wallet a shopper taps with.', basis: 'no_source_yet', basisLine: 'Named in the story; no source cited yet.', sourceIds: [], leads: [] },
  ],
  sources: [
    { id: 'p1', name: 'Payments industry report', kind: 'Industry report · sample trade body', dated: 'Oct 2026', excerpt: 'Contactless purchases rose as a share of in-store card payments.', url: null },
    { id: 'p2', name: 'PAYQ annual report', kind: 'Company filing · sample company', dated: 'Jun 2026', excerpt: 'The company sells payment acceptance to merchants of every size.', url: null },
  ],
  questions: [
    {
      id: 'q-tap', angleLabel: 'The payment chain', featured: true, sourceIds: ['p1', 'p2'], leads: ['V', 'MA', 'PAYQ (sample company)'],
      text: 'Who earns when you tap to pay?',
      unknown: 'How the fee is split between the network, the processor and the bank.',
      fromConnection: 'networks',
    },
    {
      id: 'q-fees', angleLabel: 'Fees', featured: false, sourceIds: [], leads: [],
      text: 'Which part of a tap-to-pay purchase carries the largest fee?',
      unknown: 'Whether any filing states the split for a typical store.',
      fromConnection: 'processors',
    },
  ],
  topics: ['Payments'],
  tickers: ['V', 'MA'],
  sample: true,
});

export const SAMPLE_UTILITIES = Object.freeze({
  id: 'sample-utility-load',
  version: 4,
  status: 'published',
  publishedAt: '2026-11-17T13:00:00.000Z',
  kind: 'overview',
  lead: 'story',
  subject: 'Utility load',
  title: 'Data centers ask the local utility for more',
  deck: 'New sites need power before they open. The utilities that serve them often plan years ahead.',
  reporter: { name: 'Dana', beat: 'Utilities and infrastructure' },
  evidenceSpan: 'Mar to Aug 2026',
  body: [
    'A large data center can ask its utility for as much power as a small town. The utility often has to plan the lines and the plants years before the site switches on.',
    "Dana's reading is that utilities in regions with many new sites tend to raise their long-term plans first. The sample filing behind this story describes one such plan; it does not say how much of the plan the data centers will pay for.",
  ],
  parts: [],
  openQuestion: 'Does the new demand show up in what the utilities earn, or only in what they spend?',
  connections: [
    {
      id: 'regional', who: 'Regional utilities', what: 'Sell power to new data-center sites.', basis: 'source_cited', basisLine: 'One sample utility filing cited.', sourceIds: ['u1'],
      leads: [{ name: 'GRDP (sample utility)' }], known: 'A sample resource plan revised large-customer demand upward.', unknown: 'How much of that demand is under contract.', whereToLook: 'The utility’s resource plan and rate filings.',
    },
    {
      id: 'fast-growing', who: 'Utilities in fast-growing regions', what: 'Plan for more load from large customers.', basis: 'reporters_reading', basisLine: "Dana's reading. No filing cited.", sourceIds: [],
      leads: [{ symbol: 'NEE', name: 'NextEra Energy' }, { symbol: 'DUK', name: 'Duke Energy' }], known: '', unknown: 'Which utilities have raised their plans most.', whereToLook: 'Each utility’s long-term load forecast.',
    },
  ],
  sources: [
    { id: 'u1', name: 'GRDP resource plan', kind: 'Regulatory filing · sample utility', dated: 'Aug 2026', excerpt: 'Forecast demand from large customers was revised upward.', url: null },
  ],
  questions: [
    {
      id: 'q-earn', angleLabel: 'Earnings', featured: true, sourceIds: ['u1'], leads: ['NEE', 'DUK'],
      text: 'Do any utilities earn more because data centers moved in?',
      unknown: 'Whether regulators let the new spending into the rates.',
      fromConnection: 'regional',
    },
    {
      id: 'q-spend', angleLabel: 'Spending', featured: true, sourceIds: ['u1'], leads: ['NEE', 'DUK'],
      text: 'Which utilities are spending ahead of the new demand?',
      unknown: 'How much of the spending the data centers pay for.',
      fromConnection: 'fast-growing',
    },
  ],
  topics: ['Energy grid'],
  tickers: ['NEE', 'DUK'],
  sample: true,
});

/** The three, newest first (the stories read's order). */
export const SAMPLE_RECORDS = Object.freeze([SAMPLE_AI, SAMPLE_TAP, SAMPLE_UTILITIES]);

/**
 * The fixture preview's view of a sample: the page's own reader over the record WITHOUT its sample mark (which the
 * reader drops on sight), then marked `sample: true` so every screen labels it as one. Only fixtures call this.
 */
export function previewStoryOf(record) {
  const { sample, ...rest } = record;
  const view = storyOf(record.id, rest);
  return view && sample === true ? { ...view, sample: true } : null;
}

export const SAMPLE_STORIES = Object.freeze(SAMPLE_RECORDS.map(previewStoryOf));

// ── the pilot records (the note's Appendix, word for word) ───────────────────────────────────────────────────────

/** The two records exactly as the note gives them (drafts, placeholder dates). */
export const PILOT_RECORDS = Object.freeze({ 'ai-buildout': AI_BUILDOUT, 'dominion-data-centers': DOMINION });
/** The instants the fixtures publish them at: the overview first, the deep story an hour later (both newer than the samples). */
export const PILOT_PUBLISHED_AT = Object.freeze({ 'ai-buildout': '2026-11-25T15:00:00.000Z', 'dominion-data-centers': '2026-11-25T16:00:00.000Z' });
/** A pilot record as it would be once published: its own fields, `status: 'published'`, a real instant. */
export const asPublishedPilot = (id) => ({ ...PILOT_RECORDS[id], status: 'published', publishedAt: PILOT_PUBLISHED_AT[id] });
/** The page's own reader over each pilot as published: real stories, never samples. */
export const PILOT_OVERVIEW = storyOf('ai-buildout', asPublishedPilot('ai-buildout'));
export const PILOT_DEEP = storyOf('dominion-data-centers', asPublishedPilot('dominion-data-centers'));

/**
 * The stories the jsdom kit and the fixture preview read by default, newest first, as the stories read returns them:
 * the deep story, the overview (the hero), then the three samples (the AI and utilities overviews are cards, the
 * product-led one a tile).
 */
export const KIT_STORIES = Object.freeze([PILOT_DEEP, PILOT_OVERVIEW, ...SAMPLE_STORIES]);

// ── the old shape ────────────────────────────────────────────────────────────────────────────────────────────────

/** A record in Build 1's shape: leads as text; no kind, subject, gap, door, branch or group. */
export function oldShapeOf(record) {
  const { kind: _k, subject: _s, ...rest } = record;
  return {
    ...rest,
    connections: rest.connections.map(({ id: _i, known: _kn, unknown: _u, whereToLook: _w, leadsToStory: _l, leads, ...c }) => ({ ...c, leads: leads.map((x) => (typeof x === 'string' ? x : x.symbol ?? x.name)) })),
    questions: rest.questions.map(({ fromConnection: _f, group: _g, measures: _m, ...q }) => q),
  };
}
export const OLD_SHAPE_RECORD = Object.freeze({ ...oldShapeOf(SAMPLE_AI), id: 'sample-old-shape', publishedAt: '2026-11-16T12:00:00.000Z' });
export const OLD_SHAPE_STORY = previewStoryOf(OLD_SHAPE_RECORD);
