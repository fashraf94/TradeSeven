// api/_utils/evidence/newsfilter.js
//
// Huddle S1, evidence layer (e) — newsfilter.io, OPTIONAL (spec V1.1 R-14; prompt §4.5e:
// "env name only"). The Phase 0 found no client, no key and no env name anywhere
// (docs/audits/20261029_PHASE0_HUDDLE_S1_DISCOVERY.md Q7), and no payload of theirs has
// ever been captured, so S1 reads none of it: with NEWSFILTER_API_KEY unset the source
// is `skipped` / `no_api_key`; with it set, still `skipped` / `no_capture` — a reader is
// written against a committed capture, never against assumed keys (C §C11, §C13). The
// founder's newsfilter account, when there is one, starts with that capture.

export const NEWSFILTER_ENV = 'NEWSFILTER_API_KEY';

/** @returns {{ status: 'skipped', items: [], drops: [], reason: 'no_api_key'|'no_capture' }} */
export function newsfilterStatus(env = process.env) {
  return { status: 'skipped', items: [], drops: [], reason: env?.[NEWSFILTER_ENV] ? 'no_capture' : 'no_api_key' };
}
