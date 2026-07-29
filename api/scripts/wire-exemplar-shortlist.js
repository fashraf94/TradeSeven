// api/scripts/wire-exemplar-shortlist.js
// Phase 2 N2.2 — the exemplar SHORTLIST generator (Spec V1.2 N2, locked).
//
// READ-ONLY. Run with production Firebase env (FIREBASE_PROJECT_ID,
// FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY):
//
//   node api/scripts/wire-exemplar-shortlist.js [--days 60] [--per 8]
//
// Prints a per-(reporter × storyType) candidate table (markdown) plus a
// JSON block for the picks round-trip. The founder picks from this list —
// selection is a taste call (N2.2); this script applies STRUCTURAL filters
// and ordering only, and judges nothing about prose quality:
//
//   • story types limited to the Wire seams' types (exemplars are embedded
//     in the prompts those seams run)
//   • no wireConflict, not superseded (never exemplify a pipeline casualty)
//   • body present and within the seam's working band (a truncated or
//     bloated body makes a bad few-shot regardless of taste)
//   • dataSnapshot present, with its server-operand fields listed per the
//     Calibration Addendum §1 shape map — a candidate whose facts CAN be
//     recomputed makes N2.1's dual-output qualification gate meaningful
//   • newest first within each group (recency = current voice)
//
// N2.1 (the qualification gate — model-generated typed-facts companion →
// validation → deterministic render → agreement) runs AFTER the founder's
// picks, at embed time, in the build harness. A candidate that cannot
// produce a clean dual output is not an exemplar, however good the prose.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

const GROUPS = [
  { reporter: 'kai', types: ['market_pulse'] },
  { reporter: 'alex', types: ['market_mover'] },
  { reporter: 'neta', types: ['econ_recap', 'econ_preview'] },
  { reporter: 'doug', types: ['earnings_recap', 'earnings_preview'] },
  { reporter: 'kim', types: ['sector_column'] },
];

// Working band for a few-shot body: long enough to carry the voice, short
// enough not to blow the input budget when several embed per prompt.
const BODY_MIN = 400;
const BODY_MAX = 4200;

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
};
const DAYS = flag('days', 60);
const PER_GROUP = flag('per', 8);

function serverOperandFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  // Addendum §1: the fields adapters can actually use, per shape.
  const interesting = [
    'price', 'change', 'percentChange', 'atrMultiple',
    'actual', 'estimate', 'previous',
    'epsActual', 'epsEstimate', 'priceMove', 'surprise',
    'sectorPerformance', 'spy', 'qqq', 'dia', 'iwm',
  ];
  return interesting.filter((k) => snapshot[k] !== undefined && snapshot[k] !== null);
}

async function main() {
  const db = getFirebaseAdmin();
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const out = { generatedAt: new Date().toISOString(), sinceDays: DAYS, groups: [] };

  for (const { reporter, types } of GROUPS) {
    for (const type of types) {
      const snap = await db
        .collection('fantasyTimesStories')
        .where('reporter', '==', reporter)
        .where('type', '==', type)
        .where('publishedAt', '>', since)
        .orderBy('publishedAt', 'desc')
        .limit(60)
        .get();

      const candidates = [];
      for (const doc of snap.docs) {
        const s = doc.data();
        if (s.wireConflict || s.wireSuperseded === true) continue;
        const body = String(s.body || '');
        if (body.length < BODY_MIN || body.length > BODY_MAX) continue;
        if (!s.dataSnapshot) continue;
        candidates.push({
          storyId: doc.id,
          publishedAt: s.publishedAt?.toDate?.()?.toISOString?.() ?? String(s.publishedAt),
          headline: String(s.headline || '').slice(0, 110),
          bodyChars: body.length,
          operandFields: serverOperandFields(s.dataSnapshot),
        });
        if (candidates.length >= PER_GROUP) break;
      }
      out.groups.push({ reporter, type, considered: snap.size, shortlisted: candidates.length, candidates });
    }
  }

  // Markdown for the founder; JSON for the picks round-trip.
  console.log(`# Wire exemplar shortlist — last ${DAYS} days\n`);
  for (const g of out.groups) {
    console.log(`## ${g.reporter} × ${g.type}  (${g.shortlisted} shortlisted of ${g.considered} scanned)\n`);
    console.log('| # | storyId | published | chars | server operands | headline |');
    console.log('|---|---|---|---|---|---|');
    g.candidates.forEach((c, i) => {
      console.log(`| ${i + 1} | \`${c.storyId}\` | ${c.publishedAt?.slice(0, 10)} | ${c.bodyChars} | ${c.operandFields.join(', ') || '—'} | ${c.headline.replace(/\|/g, '\\|')} |`);
    });
    console.log('');
  }
  console.log('\n---\n\n```json');
  console.log(JSON.stringify(out, null, 2));
  console.log('```');
}

main().then(
  () => process.exit(0),
  (err) => { console.error('[ExemplarShortlist] failed:', err); process.exit(1); },
);
