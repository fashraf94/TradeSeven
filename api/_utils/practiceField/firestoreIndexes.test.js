// api/_utils/practiceField/firestoreIndexes.test.js
//
// Practice Field T1a-2b-1 §2 — the two index decisions, pinned on the file the founder deploys (firestore.indexes.json):
//   1. THE REASON-FIELD EXEMPTION T0b deferred: the stored manager reason, `rationale` on the `decisions` collection
//      group (api/_utils/mandateRationale.js DECISION_RATIONALE_FIELDS — the only free-text field; up to 3.6 KB), is
//      exempt from single-field indexing (`indexes: []`). Every `decisions` collection is a book's
//      (`mandates/{id}/decisions`), and nothing queries on `rationale`.
//   2. THE DRAINING QUERY (T1a-2a C-3): `status == 'draining'` with `kind == 'idea_book'` is two equality filters and a
//      limit — served by Firestore's merged single-field indexes ("Cloud Firestore can merge the indexes for simple
//      equality filters", firebase.google.com/docs/firestore/query-data/index-overview), so NO composite index is added;
//      and neither field is exempted from single-field indexing on `mandates`, which the merge needs.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_RATIONALE_FIELDS } from '../mandateRationale.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const INDEXES = JSON.parse(readFileSync(join(ROOT, 'firestore.indexes.json'), 'utf8'));

describe('firestore.indexes.json — the reason field and the draining query', () => {
  it('the stored reason on the decisions collection group is exempt from single-field indexing, and nothing else of a decision is', () => {
    expect(DECISION_RATIONALE_FIELDS).toContain('rationale');
    const decisions = INDEXES.fieldOverrides.filter((o) => o.collectionGroup === 'decisions');
    expect(decisions).toEqual([{ collectionGroup: 'decisions', fieldPath: 'rationale', indexes: [] }]);
    // No composite index names the reason either.
    expect(INDEXES.indexes.filter((i) => i.fields.some((f) => f.fieldPath === 'rationale'))).toEqual([]);
  });

  it('nothing in api/ or src/ queries the reason (an exempted field cannot be filtered or ordered on without an index)', () => {
    const hits = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) { walk(path); continue; }
        if (!/\.(m?js|jsx)$/.test(name)) continue;
        const text = readFileSync(path, 'utf8');
        if (/\.(where|orderBy)\(\s*['"`]rationale['"`]/.test(text)) hits.push(relative(ROOT, path).split(sep).join('/'));
      }
    };
    for (const top of ['api', 'src']) walk(join(ROOT, top));
    expect(hits).toEqual([]);
  }, 30_000); // a walk of two trees: the T0b tripwire's own limit

  it('C-3: no composite index for mandates(status, kind) — two equalities merge single-field indexes — and neither field is exempted', () => {
    const composite = INDEXES.indexes.filter((i) => i.collectionGroup === 'mandates'
      && i.fields.some((f) => f.fieldPath === 'kind') && i.fields.some((f) => f.fieldPath === 'status'));
    expect(composite).toEqual([]);
    expect(INDEXES.fieldOverrides.filter((o) => o.collectionGroup === 'mandates' && ['status', 'kind'].includes(o.fieldPath))).toEqual([]);
    // The query itself is still the equality pair and a limit, nothing more (an orderBy or a range would need one).
    const sweep = readFileSync(join(ROOT, 'api/_utils/practiceField/sweep.js'), 'utf8');
    const fn = sweep.slice(sweep.indexOf('async function ideaBooksOfStatus('), sweep.indexOf('/**', sweep.indexOf('async function ideaBooksOfStatus(')));
    expect(fn).toMatch(/\.where\('status', '==', status\)\s*\.where\('kind', '==', IDEA_BOOK_KIND\)\s*\.limit\(MANDATE_SWEEP_PAGE_SIZE\)\s*\.get\(\)/);
    expect(fn).not.toMatch(/orderBy|startAfter|'<'|'>'|'!='|'in'|array-contains/);
  });
});
