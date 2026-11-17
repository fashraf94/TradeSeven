// api/_utils/sharedResearch/__fixtures__/probeBuilder.js
//
// The B3 recorded probes' fixtures (build prompt K-8): two thesis builder turns —
// one `map_segments` on an own-words card ("I want to play AI"), one
// `build_why` on a card with its theme, segment and one name set. Records,
// cards and retrieval items are AUTHORED fixture text, not market facts and not a
// real search result. scripts/sharedResearch/probeBuilder.mjs sends them;
// thesisSchema.recorded.test.js validates the recorded answers against them.

import { emptyCard } from '../thesis.js';

export const PROBE_B_READ_AT = '2026-11-16T15:00:00.000Z';
export const PROBE_B_NOW = '2026-11-16T15:00:05.000Z';
export const PROBE_B_EXCHANGE_ID = '3b4c5d6e-7f80-4a91-8b2c-3d4e5f607182';
export const PROBE_B_NAMES = Object.freeze({ NVDA: 'NVIDIA Corporation', AMD: 'Advanced Micro Devices, Inc.', AVGO: 'Broadcom Inc.' });

const id = (n) => `f_7a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SESSION_ID = '5c6d7e8f-9012-4a3b-8c4d-5e6f70819203';
const base = (findings) => ({
  researchWorkId: `sr_${SESSION_ID}`, userId: 'probe-user', origin: 'shared_research', state: 'open',
  host: { collection: 'sharedResearchSessions', id: SESSION_ID }, createdAt: '2026-11-16T14:50:00.000Z',
  question: 'Build a thesis on: I want to play AI', findings, summary: null, summaryRevisions: [],
});
const OBSERVATION = {
  findingId: id(1), kind: 'observation', symbol: null, fact: 'I want to play AI',
  source: { recordKind: 'exchange', recordId: '4c5d6e7f-8091-4a2b-8c3d-4e5f60718293', label: 'Your words' },
  at: '2026-11-16T14:50:00.000Z', asOf: null, status: 'unverified', statusReason: 'player_words', supersedes: null,
};

// ── probe 1: map_segments on an own-words card ──────────────────────────────

export function mapProbe() {
  const card = emptyCard();
  card.theme = { state: 'set', value: 'I want to play AI', by: 'player_wrote', suggestion: null };
  return {
    goal: 'map_segments', part: null, entryKind: 'observation', card, record: base([OBSERVATION]), supported: [],
    items: [
      {
        index: 0, url: 'https://news.example.com/ai-capex', host: 'news.example.com', publishedDate: '2026-11-10T00:00:00.000Z',
        title: 'Cloud companies keep raising AI data-center spending',
        highlights: [
          'The largest cloud companies said they would keep raising spending on AI data centers next year, most of it on accelerator chips.',
          'Executives named chip supply, power and networking as the limits on how fast new capacity comes online.',
        ],
      },
      {
        index: 1, url: 'https://industry.example.org/dc-power', host: 'industry.example.org', publishedDate: '2026-11-04T00:00:00.000Z',
        title: 'Utilities see data centers driving new demand',
        highlights: ['Utilities said data-center projects now make up a large share of requests for new grid connections.'],
      },
      {
        index: 2, url: 'https://news.example.com/ai-networking', host: 'news.example.com', publishedDate: null,
        title: 'The links between AI chips',
        highlights: ['Training clusters need high-speed networking between thousands of accelerators, a market several chip and equipment makers serve.'],
      },
    ],
  };
}

// ── probe 2: build_why on a card with its names set ──────────────────────────

export function whyProbe() {
  const rel = {
    findingId: id(2), kind: 'relationship', symbol: 'NVDA', fact: 'Supplier · Nvidia designs the accelerator chips most AI data centers buy.',
    source: { recordKind: 'retrieval', recordId: 'https://news.example.com/nvda-accel', label: 'news.example.com · Nvidia accelerators', url: 'https://news.example.com/nvda-accel' },
    at: '2026-11-09T00:00:00.000Z', asOf: '2026-11-09T00:00:00.000Z', status: 'verified', statusReason: null, supersedes: null,
  };
  const card = emptyCard();
  card.theme = { state: 'set', value: 'I want to play AI', by: 'player_wrote', suggestion: null };
  card.segment = {
    state: 'set', value: 'GPUs and accelerators', by: 'player_chose', findingIds: [], skipped: false,
    map: [{ label: 'GPUs and accelerators', line: 'The chips that train and run models', findingIds: [] }, { label: 'Data-center power', line: 'Electricity for the buildings', findingIds: [] }],
  };
  card.names = { state: 'set', value: ['NVDA'], by: 'player_chose', blocked: null };
  return {
    goal: 'build_why', part: null, entryKind: 'observation', card, record: base([OBSERVATION, rel]),
    supported: [{ symbol: 'NVDA', name: 'NVIDIA Corporation', role: 'Supplier', relationship: 'Nvidia designs the accelerator chips most AI data centers buy.' }],
    items: [
      {
        index: 0, url: 'https://news.example.com/nvda-results', host: 'news.example.com', publishedDate: '2026-11-12T00:00:00.000Z',
        title: 'Nvidia: data centers are most of the business',
        highlights: [
          'Nvidia said its data-center segment, which sells accelerators and systems to cloud companies, was the large majority of its revenue last quarter.',
          'The company named its largest customers as the big cloud companies.',
        ],
      },
      {
        index: 1, url: 'https://industry.example.org/custom-chips', host: 'industry.example.org', publishedDate: '2026-11-07T00:00:00.000Z',
        title: 'Big buyers design their own AI chips',
        highlights: ['Several of the largest cloud companies design their own AI chips and use them alongside the accelerators they buy.'],
      },
      {
        index: 2, url: 'https://news.example.com/capex-plans', host: 'news.example.com', publishedDate: '2026-11-10T00:00:00.000Z',
        title: 'Spending plans for next year',
        highlights: ['The largest cloud companies said they plan to keep raising AI data-center spending next year.'],
      },
    ],
  };
}
