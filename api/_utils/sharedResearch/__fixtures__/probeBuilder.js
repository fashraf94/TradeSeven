// api/_utils/sharedResearch/__fixtures__/probeBuilder.js
//
// The B3 recorded probes' fixtures (build prompt K-8; the founder's S-4, Nov 17):
// one live builder turn per distinct schema — the five goals, `strengthen` on
// each of the six parts, and `direction` with nothing else on offer. Each probe
// is a card in a state where that goal is really on offer, with its record and
// retrieval items. Records, cards and items are AUTHORED fixture text, not market
// facts and not a real search result. scripts/sharedResearch/probeBuilder.mjs
// sends them; thesisSchema.recorded.test.js validates the recorded answers.

import { emptyCard, cardContextOf, offeredGoalsOf } from '../thesis.js';
import { schemaKeyOf, turnShapeOf } from '../thesisSchema.js';

export const PROBE_B_READ_AT = '2026-11-16T15:00:00.000Z';
export const PROBE_B_NOW = '2026-11-16T15:00:05.000Z';
export const PROBE_B_EXCHANGE_ID = '3b4c5d6e-7f80-4a91-8b2c-3d4e5f607182';
export const PROBE_B_NAMES = Object.freeze({ NVDA: 'NVIDIA Corporation', AMD: 'Advanced Micro Devices, Inc.', AVGO: 'Broadcom Inc.' });

const id = (n) => `f_7a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SESSION_ID = '5c6d7e8f-9012-4a3b-8c4d-5e6f70819203';
const record = (findings, question = 'Build a thesis on: I want to play AI') => ({
  researchWorkId: `sr_${SESSION_ID}`, userId: 'probe-user', origin: 'shared_research', state: 'open',
  host: { collection: 'sharedResearchSessions', id: SESSION_ID }, createdAt: '2026-11-16T14:50:00.000Z',
  question, findings, summary: null, summaryRevisions: [],
});
const sourced =(n, kind, symbol, fact, url, label, at) => ({
  findingId: id(n), kind, symbol, fact, source: { recordKind: 'retrieval', recordId: url, label, url },
  at, asOf: at, status: 'verified', statusReason: null, supersedes: null,
});

// ── the record findings the probes share ────────────────────────────────────

const OBSERVATION = {
  findingId: id(1), kind: 'observation', symbol: null, fact: 'I want to play AI',
  source: { recordKind: 'exchange', recordId: '4c5d6e7f-8091-4a2b-8c3d-4e5f60718293', label: 'Your words' },
  at: '2026-11-16T14:50:00.000Z', asOf: null, status: 'unverified', statusReason: 'player_words', supersedes: null,
};
const NVDA_REL = sourced(2, 'relationship', 'NVDA', 'Supplier · Nvidia designs the accelerator chips most AI data centers buy.', 'https://news.example.com/nvda-accel', 'news.example.com · Nvidia accelerators', '2026-11-09T00:00:00.000Z');
const NVDA_SALES = sourced(3, 'earnings_fact', 'NVDA', 'Nvidia said its data-center segment was the large majority of its revenue last quarter.', 'https://news.example.com/nvda-results', 'news.example.com · Nvidia results', '2026-11-12T00:00:00.000Z');
const OWN_CHIPS = sourced(4, 'coverage', null, 'Several of the largest cloud companies design their own AI chips and use them alongside the accelerators they buy.', 'https://industry.example.org/custom-chips', 'industry.example.org · Custom chips', '2026-11-07T00:00:00.000Z');
const SPENDING = sourced(5, 'coverage', null, 'The largest cloud companies said they plan to keep raising AI data-center spending next year.', 'https://news.example.com/capex-plans', 'news.example.com · Spending plans', '2026-11-10T00:00:00.000Z');

const NVDA_SUPPORTED = [{ symbol: 'NVDA', name: 'NVIDIA Corporation', role: 'Supplier', relationship: 'Nvidia designs the accelerator chips most AI data centers buy.' }];
const MAP = () => [
  { label: 'GPUs and accelerators', line: 'The chips that train and run models', findingIds: [] },
  { label: 'Data-center power', line: 'Electricity and cooling for the buildings', findingIds: [] },
  { label: 'Networking', line: 'The links between thousands of chips', findingIds: [] },
];
const themed = () => { const c = emptyCard(); c.theme = { state: 'set', value: 'I want to play AI', by: 'player_wrote', suggestion: null }; return c; };
const segmented = () => { const c = themed(); c.segment = { state: 'set', value: 'GPUs and accelerators', by: 'player_chose', findingIds: [], skipped: false, map: MAP() }; return c; };
const named = () => { const c = segmented(); c.names = { state: 'set', value: ['NVDA'], by: 'player_chose', blocked: null }; return c; };
/** A card with every part set — the state `strengthen` is offered in for each part. */
function fullCard() {
  const c = named();
  c.why = {
    state: 'set', by: 'partner_suggested_confirmed', shared: 'it sells the accelerators AI data centers are buying',
    reasons: [{ symbol: 'NVDA', text: 'Data centers are the large majority of its revenue.', findingIds: [id(3)] }],
    against: { text: 'Several of the largest buyers design their own AI chips.', findingIds: [id(4)] }, proposal: null,
  };
  c.wrongIf = {
    state: 'set', by: 'player_chose', text: 'the largest cloud companies cut AI data-center spending for two quarters', findingIds: [id(5)],
    options: [{ text: 'the largest cloud companies cut AI data-center spending for two quarters', findingIds: [id(5)] }, { text: 'a big buyer moves most of its work to its own chips', findingIds: [id(4)] }],
    priceLines: [],
  };
  c.timeFrame = { state: 'set', by: 'player_chose', value: 'positional', suggestion: null };
  return c;
}

// ── the retrieval items (authored) ───────────────────────────────────────────

const item = (index, url, host, publishedDate, title, highlights) => ({ index, url, host, publishedDate, title, highlights });
const AI_ITEMS = [
  item(0, 'https://news.example.com/ai-capex', 'news.example.com', '2026-11-10T00:00:00.000Z', 'Cloud companies keep raising AI data-center spending', [
    'The largest cloud companies said they would keep raising spending on AI data centers next year, most of it on accelerator chips.',
    'Executives named chip supply, power and networking as the limits on how fast new capacity comes online.',
  ]),
  item(1, 'https://industry.example.org/dc-power', 'industry.example.org', '2026-11-04T00:00:00.000Z', 'Utilities see data centers driving new demand', [
    'Utilities said data-center projects now make up a large share of requests for new grid connections.',
  ]),
  item(2, 'https://news.example.com/ai-networking', 'news.example.com', null, 'The links between AI chips', [
    'Training clusters need high-speed networking between thousands of accelerators, a market several chip and equipment makers serve.',
  ]),
];
const NAMES_ITEMS = [
  item(0, 'https://news.example.com/nvda-accel', 'news.example.com', '2026-11-09T00:00:00.000Z', 'Nvidia accelerators lead AI data centers', [
    'Nvidia designs the accelerator chips most AI data centers buy.',
  ]),
  item(1, 'https://news.example.com/amd-cloud', 'news.example.com', '2026-11-08T00:00:00.000Z', 'AMD wins accelerator orders from cloud buyers', [
    'AMD said cloud companies ordered its accelerator chips for new AI data centers.',
  ]),
  item(2, 'https://industry.example.org/custom-ai-chips', 'industry.example.org', '2026-11-06T00:00:00.000Z', 'Who builds the custom chips', [
    'Broadcom designs custom AI chips for some of the largest cloud companies.',
  ]),
];
const WHY_ITEMS = [
  item(0, 'https://news.example.com/nvda-results', 'news.example.com', '2026-11-12T00:00:00.000Z', 'Nvidia: data centers are most of the business', [
    'Nvidia said its data-center segment, which sells accelerators and systems to cloud companies, was the large majority of its revenue last quarter.',
    'The company named its largest customers as the big cloud companies.',
  ]),
  item(1, 'https://industry.example.org/custom-chips', 'industry.example.org', '2026-11-07T00:00:00.000Z', 'Big buyers design their own AI chips', [
    'Several of the largest cloud companies design their own AI chips and use them alongside the accelerators they buy.',
  ]),
  item(2, 'https://news.example.com/capex-plans', 'news.example.com', '2026-11-10T00:00:00.000Z', 'Spending plans for next year', [
    'The largest cloud companies said they plan to keep raising AI data-center spending next year.',
  ]),
];
const STRENGTHEN_ITEMS = [
  item(0, 'https://news.example.com/inference-demand', 'news.example.com', '2026-11-13T00:00:00.000Z', 'Running models now drives chip orders', [
    'Cloud companies said demand to run AI models, not only to train them, is now a main reason they order accelerators.',
  ]),
  item(1, 'https://industry.example.org/custom-chip-share', 'industry.example.org', '2026-11-11T00:00:00.000Z', 'Custom chips take on more work', [
    'One large cloud company said it now runs more of its own AI work on chips it designs itself.',
  ]),
];
const STORY_ITEMS = [
  item(0, 'https://ir.example.com/cloud-q3', 'ir.example.com', '2026-11-05T00:00:00.000Z', 'Third-quarter results release', [
    'The company said it expects to keep raising capital spending next year, mainly for AI data centers.',
  ]),
  item(1, 'https://news.example.com/cloud-capex', 'news.example.com', '2026-11-06T00:00:00.000Z', 'Cloud spending keeps climbing', [
    'Analysts said the largest cloud companies are raising AI data-center budgets again.',
  ]),
];
const POWER_ITEMS = [
  item(0, 'https://industry.example.org/dc-cooling', 'industry.example.org', '2026-11-03T00:00:00.000Z', 'Cooling becomes a limit for AI data centers', [
    'Operators said cooling and power equipment now set how fast they can add AI capacity.',
  ]),
];

// ── the probes, one per schema ───────────────────────────────────────────────

/**
 * One probe: its goal, card, record and items, the session it is read in (open, one step used of eight), what the card
 * offers there (offeredGoalsOf — the probe's goal must be on it), and the shape the turn is asked in (turnShapeOf).
 */
const probe = (p) => {
  const q = { part: null, direction: null, retrieval: 'items', entryKind: 'observation', ...p };
  const session = { status: 'open', entry: { kind: q.entryKind }, stepBudget: 8, stepsUsed: 1, exchanges: [] };
  const offered = offeredGoalsOf(q.card, cardContextOf({ record: q.record, supported: q.supported, session }));
  const shape = turnShapeOf({ goal: q.goal, part: q.part }, offered);
  return { ...q, session, offered, shape, key: schemaKeyOf(shape) };
};

/** Every probe: the five goals, `strengthen` on each part, `direction` with nothing else on offer (S-4). */
export function builderProbes() {
  const STORY_FINDING = {
    findingId: id(6), kind: 'coverage', symbol: null, fact: 'Cloud companies keep raising AI data-center spending',
    source: { recordKind: 'fantasyTimesStories', recordId: 'story-probe', label: 'FantasyTimes · Kim · Sector Strategist' },
    at: '2026-11-15T13:00:00.000Z', asOf: null, status: 'unverified', statusReason: 'reporter_content', supersedes: null,
  };
  const pickCard = themed();
  pickCard.segment = { ...pickCard.segment, map: MAP().map((m, i) => (i === 0 ? { ...m, findingIds: [id(2)] } : m)) };
  const longWords = 'I want to play AI through the chips, the power and the networking that the largest data centers keep buying';
  const pending = emptyCard();
  pending.theme = { state: 'unset', value: null, by: null, suggestion: 'AI data-center build-out' };
  pending.segment = { ...pending.segment, map: MAP() };
  return [
    probe({
      goal: 'build_why', card: named(), record: record([OBSERVATION, NVDA_REL]), supported: NVDA_SUPPORTED, items: WHY_ITEMS,
    }),
    probe({ goal: 'map_segments', card: themed(), record: record([OBSERVATION]), supported: [], items: AI_ITEMS }),
    probe({
      goal: 'verify_source', entryKind: 'item', card: emptyCard(),
      record: record([STORY_FINDING], 'Which companies earn from cloud AI spending, and how directly?'), supported: [], items: STORY_ITEMS,
    }),
    probe({ goal: 'find_names', card: segmented(), record: record([OBSERVATION]), supported: [], items: NAMES_ITEMS }),
    probe({
      goal: 'pick', part: 'segment', card: pickCard, record: record([OBSERVATION, NVDA_REL, OWN_CHIPS]), supported: NVDA_SUPPORTED, items: [], retrieval: 'none',
    }),
    ...['theme', 'segment', 'names', 'why', 'wrongIf', 'timeFrame'].map((part) => probe({
      goal: 'strengthen', part, card: fullCard(), record: record([OBSERVATION, NVDA_REL, NVDA_SALES, OWN_CHIPS, SPENDING]), supported: NVDA_SUPPORTED, items: STRENGTHEN_ITEMS,
    })),
    probe({
      goal: 'direction', direction: 'look at power and cooling',
      card: pending, record: record([{ ...OBSERVATION, fact: longWords }], `Build a thesis on: ${longWords}`), supported: [], items: POWER_ITEMS,
    }),
  ];
}
