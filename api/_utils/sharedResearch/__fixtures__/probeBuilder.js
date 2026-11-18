// api/_utils/sharedResearch/__fixtures__/probeBuilder.js
//
// The B3 recorded probes' fixtures (build prompt K-8; the founder's S-4, Nov 17):
// one live builder turn per distinct schema — the five goals, `strengthen` on
// each of the six parts, and `direction` with nothing else on offer. Each probe
// is a card in a state where that goal is really on offer, with its record and
// retrieval items. Records, cards and items are AUTHORED fixture text, not market
// facts and not a real search result. scripts/sharedResearch/probeBuilder.mjs
// sends them; thesisSchema.recorded.test.js validates the recorded answers.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyCard, openingCardOf, cardContextOf, offeredGoalsOf, blockedNow, applyProposals, applyCardOp } from '../thesis.js';
import { schemaKeyOf, turnShapeOf, validateBuildTurn } from '../thesisSchema.js';
import { companiesOf } from '../companies.js';
import { BASELINE } from '../method.js';

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
  const { recordedShape = null, ...rest } = p;
  const q = { part: null, direction: null, retrieval: 'items', entryKind: 'observation', ...rest };
  const session = { status: 'open', entry: { kind: q.entryKind }, stepBudget: 8, stepsUsed: 1, exchanges: [] };
  const ctx = cardContextOf({ record: q.record, supported: q.supported, session });
  const offered = offeredGoalsOf(q.card, ctx);
  // `recordedShape`: the shape a probe was RECORDED in, when today's offers would ask its card in another (B5, §B13 T-2)
  const shape = recordedShape ?? turnShapeOf({ goal: q.goal, part: q.part }, offered, { deadEnd: blockedNow(q.card, ctx) });
  return { ...q, session, offered, shape, key: schemaKeyOf(shape), asNow: turnShapeOf({ goal: q.goal, part: q.part }, offered, { deadEnd: blockedNow(q.card, ctx) }) };
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
    // B3 recorded this one as bare `direction` (findings and companies only): a suggested theme then held the map back.
    // Under §B13 T-2 the theme gates nothing, so today this card asks direction as map_segments, and no builder card
    // reaches the bare shape (thesisB5.test.js). The recording is replayed in the shape it was made in; the `direction`
    // schema stays compiled and unchanged.
    probe({
      goal: 'direction', direction: 'look at power and cooling', recordedShape: Object.freeze({ goal: 'direction', part: null }),
      card: pending, record: record([{ ...OBSERVATION, fact: longWords }], `Build a thesis on: ${longWords}`), supported: [], items: POWER_ITEMS,
    }),
  ];
}

// ── the B5 probes (Amendment B §B13 T-7): three calls, one chain ───────────────────
//
// Own words "I want to play AI", on the cards §B13 makes: (1) map_segments on the T-1 card (the theme unset); (2)
// find_names on the card that map leaves, the segment set (the map's pick, confirmed) and the theme still unset (T-2);
// (3) build_why on one name (the find_names pick's first, else the first supported). Each card is DERIVED from the
// recorded answer before it — validated, landed and tapped by B3's own functions — so a probe runs only after the one
// before it is recorded (one key per run of the script). Recorded as build.b5.<goal>.recorded.json; the round's own
// ledger is build.b5.probes.ledger.json (at most 3 calls and $0.10, T-7). B3's sixteen calls are untouched.

export const PROBE_B5_READ_AT = '2026-11-17T15:00:00.000Z';
export const PROBE_B5_NOW = '2026-11-17T15:00:05.000Z';
export const PROBE_B5_EXCHANGE_ID = '4c5d6e7f-8091-4a2b-8c3d-4e5f60718294';
export const PROBE_B5_KEYS = Object.freeze(['b5:map_segments', 'b5:find_names', 'b5:build_why']);
const B5_FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../test/fixtures/sharedResearch');
/** A B5 probe's recorded file (`b5:find_names` → build.b5.find_names.recorded.json). */
export const b5FileOf = (key) => resolve(B5_FIXTURES, `build.${key.replace(':', '.')}.recorded.json`);
const b5Recorded = (key) => (existsSync(b5FileOf(key)) ? JSON.parse(readFileSync(b5FileOf(key), 'utf8')) : null);

/** Validate a B5 probe's answer as the route would (each probe mints its own finding ids). */
export function validateB5(p, output) {
  let n = 0;
  return validateBuildTurn(output, {
    record: p.record, items: p.items, readAt: PROBE_B5_READ_AT, partnerExchangeId: PROBE_B5_EXCHANGE_ID, partnerAt: PROBE_B5_NOW, nowIso: PROBE_B5_NOW,
    mintFindingId: () => `f_7c0000${String(p.index).padStart(2, '0')}-0000-4000-8000-${String(++n).padStart(12, '0')}`, names: PROBE_B_NAMES, partnerName: 'Atlas', method: BASELINE,
    card: p.card, goal: p.goal, part: p.part, shape: p.shape,
  });
}
/** The record and the card after a probe's recorded answer lands (recordStep's order: findings, then the proposals). */
function landedB5(p, output) {
  const v = validateB5(p, output);
  if (!v.ok) throw new Error(`b5 fixture: the recorded ${p.key} answer does not validate: ${JSON.stringify(v)}`);
  const after = { ...p.record, findings: [...p.record.findings, ...v.findings] };
  const card = applyProposals(p.card, v.proposals, cardContextOf({ record: after, supported: companiesOf(after).supported }));
  return { record: after, card, v };
}
const b5Probe = (index, p) => {
  const q = probe({ ...p, retrieval: 'items', entryKind: 'observation' });
  return { ...q, index, key: PROBE_B5_KEYS[index] };
};

/**
 * The B5 probes whose inputs can be built now: the map always; find_names once the map is recorded; build_why once
 * find_names is. `recordedOf(key)` reads a recorded answer (the files, by default).
 */
export function b5Probes({ recordedOf = b5Recorded } = {}) {
  const out = [];
  const map = b5Probe(0, { goal: 'map_segments', card: openingCardOf({ entryKind: 'observation', observation: 'I want to play AI' }), record: record([OBSERVATION]), supported: [], items: AI_ITEMS });
  out.push(map);
  const mapRec = recordedOf(map.key);
  if (!mapRec?.ok) return out;
  const afterMap = landedB5(map, mapRec.output);
  const ctxMap = cardContextOf({ record: afterMap.record, supported: companiesOf(afterMap.record).supported, session: map.session });
  // the segment: the map's pick, confirmed (the walk's tap); else the map's first label, chosen
  const seg = afterMap.card.pick?.part === 'segment'
    ? applyCardOp(afterMap.card, { op: 'confirm', part: 'segment' }, ctxMap)
    : applyCardOp(afterMap.card, { op: 'set', part: 'segment', value: afterMap.card.segment.map?.[0]?.label }, ctxMap);
  if (!seg.ok) throw new Error(`b5 fixture: the segment could not be set: ${seg.reason}`);
  const names = b5Probe(1, { goal: 'find_names', card: seg.card, record: afterMap.record, supported: companiesOf(afterMap.record, { names: PROBE_B_NAMES }).supported, items: NAMES_ITEMS });
  out.push(names);
  const namesRec = recordedOf(names.key);
  if (!namesRec?.ok) return out;
  const afterNames = landedB5(names, namesRec.output);
  const supported = companiesOf(afterNames.record, { names: PROBE_B_NAMES }).supported;
  const ctxNames = cardContextOf({ record: afterNames.record, supported, session: names.session });
  const pickFirst = afterNames.card.pick?.part === 'names' ? afterNames.card.pick.value[0] : null;
  const one = pickFirst ?? supported[0]?.symbol;
  const named = applyCardOp(afterNames.card, { op: 'set', part: 'names', value: [one] }, ctxNames);
  if (!named.ok) throw new Error(`b5 fixture: the name could not be set: ${named.reason}`);
  out.push(b5Probe(2, { goal: 'build_why', card: named.card, record: afterNames.record, supported, items: WHY_ITEMS }));
  return out;
}
