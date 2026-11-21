// src/components/Explore/__fixtures__/stories.js — fixture support (Explore Build 1, build prompt K-16).
//
// THREE SAMPLE STORIES in the spec's §5.1 shape (docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md), for the jsdom
// rows and the fixture preview ONLY. Each carries `sample: true`, so the page's own reader (exploreView.js storyOf)
// drops it if it ever came from the collection; a sample is never researched and never written anywhere (FQ-1).
// Every sample company is labelled as one where it is named. The real tickers (NVDA, V, MA, NEE, DUK) are named only
// as the kind of company a story is about, never with a quotation.
//
//   1. the Round 1 mockup's AI-buildout story, rewritten so that every sentence resting on the reporter's reading
//      says so in its own words (E-8), and every connection carries one of the three bases (E-1);
//   2. a product-led story, "Who earns when you tap to pay?" (E-2);
//   3. a utilities story with two featured questions (one investigation per story, E-5).

import { storyOf } from '../exploreView';

export const SAMPLE_AI = Object.freeze({
  id: 'sample-ai-buildout',
  version: 2,
  status: 'published',
  publishedAt: '2026-11-20T14:00:00.000Z',
  lead: 'story',
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
      who: 'Chip designers', what: 'Sell the processors that run AI work to data-center operators.', basis: 'source_cited',
      basisLine: 'Two sample company filings cited. Each describes what the company sells.', sourceIds: ['s1', 's2'],
      leads: ['NVDA', 'KSTL · sample company', 'HLDN · sample company'],
    },
    {
      who: 'Networking suppliers', what: 'Sell the switches and cables that link processors together.', basis: 'reporters_reading',
      basisLine: "Kim's reading of how these systems are built. No filing cited.", sourceIds: [], leads: [],
    },
    {
      who: 'Power-equipment makers', what: 'Sell transformers, switchgear and backup systems to new sites.', basis: 'no_source_yet',
      basisLine: 'No source ties a company to this yet. The sample industry overview below describes lead times and names no company.', sourceIds: [],
      leads: ['VLTA · sample company', 'GRDN · sample company'],
    },
  ],
  sources: [
    { id: 's1', name: 'KSTL quarterly report', kind: 'Company filing · sample company', dated: 'Aug 2026', excerpt: 'Accelerator sales to cloud customers grew during the quarter.', url: null },
    { id: 's2', name: 'HLDN quarterly report', kind: 'Company filing · sample company', dated: 'Sep 2026', excerpt: 'The company designs custom chips with its largest customers.', url: null },
    { id: 's3', name: 'Grid equipment overview', kind: 'Industry overview · sample trade body', dated: 'May 2026', excerpt: 'Operators report long lead times for transformers and switchgear.', url: null },
  ],
  questions: [
    {
      id: 'q-chips', angleLabel: 'Chip suppliers', featured: true, sourceIds: ['s1', 's2'], leads: ['NVDA', 'KSTL · sample company', 'HLDN · sample company'],
      text: 'Which chip suppliers have evidence of meaningful exposure to AI spending?',
      unknown: "How much of each supplier's sales depends on AI spending.",
    },
    {
      id: 'q-power', angleLabel: 'Power equipment', featured: false, sourceIds: ['s3'], leads: ['VLTA · sample company', 'GRDN · sample company'],
      text: 'Which power-equipment businesses have a sourced connection to the buildout?',
      unknown: "Whether any filing ties these companies' orders to data centers.",
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
  lead: 'product',
  productName: 'Tap to pay',
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
    { name: 'Issuing bank', job: "Holds the shopper's account", timing: 'Earns part of the fee' },
  ],
  openQuestion: 'Which business in the chain keeps the largest part of the fee?',
  connections: [
    { who: 'Card networks', what: 'Carry the payment between the store and the bank.', basis: 'source_cited', basisLine: 'One sample industry report cited.', sourceIds: ['p1'], leads: ['V', 'MA'] },
    { who: 'Payment processors', what: 'Sell stores the service that accepts taps.', basis: 'reporters_reading', basisLine: "Ari's reading of how stores buy this service. No source cited.", sourceIds: [], leads: ['PAYQ · sample company'] },
    { who: 'Phone makers', what: 'Build the wallet a shopper taps with.', basis: 'no_source_yet', basisLine: 'Named in the story; no source cited yet.', sourceIds: [], leads: [] },
  ],
  sources: [
    { id: 'p1', name: 'Payments industry report', kind: 'Industry report · sample trade body', dated: 'Oct 2026', excerpt: 'Contactless purchases rose as a share of in-store card payments.', url: null },
  ],
  questions: [
    {
      id: 'q-tap', angleLabel: 'The payment chain', featured: true, sourceIds: ['p1'], leads: ['V', 'MA'],
      text: 'Who earns when you tap to pay?',
      unknown: 'How the fee is split between the network, the processor and the bank.',
    },
    {
      id: 'q-fees', angleLabel: 'Fees', featured: false, sourceIds: [], leads: [],
      text: 'Which part of a tap-to-pay purchase carries the largest fee?',
      unknown: 'Whether any filing states the split for a typical store.',
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
  lead: 'story',
  title: 'Data centers ask the local utility for more',
  deck: 'New sites need power before they open. The utilities that serve them plan years ahead.',
  reporter: { name: 'Dana', beat: 'Utilities and infrastructure' },
  evidenceSpan: 'Mar to Aug 2026',
  body: [
    'A large data center can ask its utility for as much power as a small town. The utility has to plan the lines and the plants years before the site switches on.',
    "Dana's reading is that utilities in regions with many new sites tend to raise their long-term plans first. The sample filing behind this story describes one such plan; it does not say how much of the plan the data centers will pay for.",
  ],
  parts: [],
  openQuestion: 'Does the new demand show up in what the utilities earn, or only in what they spend?',
  connections: [
    { who: 'Regional utilities', what: 'Sell power to new data-center sites.', basis: 'source_cited', basisLine: 'One sample utility filing cited.', sourceIds: ['u1'], leads: ['NEE', 'DUK'] },
  ],
  sources: [
    { id: 'u1', name: 'Utility resource plan', kind: 'Regulatory filing · sample utility', dated: 'Aug 2026', excerpt: 'Forecast demand from large customers was revised upward.', url: null },
  ],
  questions: [
    {
      id: 'q-earn', angleLabel: 'Earnings', featured: true, sourceIds: ['u1'], leads: ['NEE', 'DUK'],
      text: 'Which utilities earn more because data centers moved in?',
      unknown: 'Whether regulators let the new spending into the rates.',
    },
    {
      id: 'q-spend', angleLabel: 'Spending', featured: true, sourceIds: ['u1'], leads: ['NEE', 'DUK'],
      text: 'Which utilities are spending ahead of the new demand?',
      unknown: 'How much of the spending the data centers pay for.',
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
