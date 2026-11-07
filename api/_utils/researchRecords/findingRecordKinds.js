// api/_utils/researchRecords/findingRecordKinds.js
//
// The Research Record Extension (7 Nov 2026; contract
// docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md §2.2) — the record a
// finding's fact came from (`source.recordKind`), also the record an idea
// version's `evidenceItem` ref names. Closed: grows only with a new schema
// version. A `retrieval` source carries its url. Re-exported by model.js.
//
// DATA ONLY, on purpose (review B1): the list names collections, so this file
// is on the setupEvidence import guard's allowlist by name — and
// extension.test.js pins that it holds this one frozen list and no code (no
// import, no require, no read), so that listing can never cover a caller.

export const FINDING_RECORD_KINDS = Object.freeze([
  'symbolDayEvidence', 'fantasyTimesWire', 'fantasyTimesStories', 'ingestedClaims', 'stockBriefs', 'estimatesCache',
  'setupEvidence', 'activationPointer', 'call', 'hypothesisVersion', 'exchange', 'kb', 'retrieval',
]);
