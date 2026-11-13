// api/_utils/sharedResearch/__fixtures__/probe.js
//
// The recorded probe's retrieval items (build prompt K-3): authored fixture text
// for the data-center case, not market facts and not a real search result.
// scripts/sharedResearch/probe.mjs sends them; stepSchema.recorded.test.js
// validates the recorded answer against them.

export const PROBE_READ_AT = '2026-11-12T15:00:00.000Z';
export const PROBE_NEXT_ACTION = 'Find which listed company supplies the power equipment the builders are waiting for — the company link is the weakest one.';
export const PROBE_ITEMS = Object.freeze([
  {
    index: 0, url: 'https://news.example.com/switchgear-wait', host: 'news.example.com', publishedDate: '2026-11-03T00:00:00.000Z',
    title: 'Data-center builders wait a year for switchgear',
    highlights: [
      'Lead times for medium-voltage switchgear and large transformers have stretched past 52 weeks, developers said.',
      'Several hyperscale projects have been re-sequenced around equipment delivery dates.',
    ],
  },
  {
    index: 1, url: 'https://news.example.com/eaton-orders', host: 'news.example.com', publishedDate: '2026-11-05T00:00:00.000Z',
    title: 'Eaton cites data-center demand for its electrical equipment',
    highlights: [
      'Eaton said orders for the switchgear and power distribution equipment it sells to data-center builders rose in the third quarter.',
      'The company does not report data-center revenue as a separate segment.',
    ],
  },
  {
    index: 2, url: 'https://industry.example.org/cdu-makers', host: 'industry.example.org', publishedDate: null,
    title: 'Coolant distribution units: who makes them',
    highlights: [
      'Coolant distribution units are made by several equipment suppliers, including privately held Northfield Thermal.',
    ],
  },
]);
