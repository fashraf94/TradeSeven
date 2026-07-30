// api/scripts/wire-exemplar-shortlist.js
// Phase 2 N2.2 — the exemplar SHORTLIST generator (Spec V1.2 N2, locked).
//
// READ-ONLY. Needs the three server-side Firebase Admin credentials
// (firebaseAdmin.js:15-17), same ones the whole server uses:
//   FIREBASE_PROJECT_ID       e.g. your-project-id
//   FIREBASE_CLIENT_EMAIL     firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
//   FIREBASE_PRIVATE_KEY      "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
//                             (double-quoted, literal \n escapes — format of
//                             record in .env.example:40-42; firebaseAdmin.js
//                             un-escapes the \n at load)
// Your local .env.local is expected to already carry these — it is the same
// file every other api/scripts/* uses; if you have ever run the server or a
// sibling script locally, they are already there. This script does NOT need
// VITE_* (those are the browser SDK; the Admin SDK uses the three above).
//
// Plain `node` does not read .env — Vercel injects env, a shell does not.
// This script SELF-LOADS .env.local (then .env) via Node's built-in loader
// (>=20.6, no dotenv dependency) when the vars aren't already present, and
// fails with an explicit message naming what's missing rather than the
// cryptic FirebaseAppError thrown from deep inside ensureInitialized.
//
// Run from the REPO ROOT (that is where .env.local lives). PowerShell:
//   node api/scripts/wire-exemplar-shortlist.js --days 60 --per 8
//   # explicit-flag equivalent (matches the other api/scripts, also fine):
//   node --env-file=.env.local api/scripts/wire-exemplar-shortlist.js --days 60 --per 8
//
// SPREAD CAP (Kai/Alex re-run): --spread-per-day N keeps at most N candidates
// per ET calendar day so high-volume groups span more days; --scan N raises
// the per-group query ceiling so the cap has runway to reach --per:
//   node api/scripts/wire-exemplar-shortlist.js --days 40 --per 8 --spread-per-day 2 --scan 150
// (--days 40, not 60: the cleanup sweep hard-deletes stories ~30d after
// expiry, so nothing older than ~31-44d per reporter exists to fetch.)
// Read `considered` per group: 0 = the type is never written (production
// defect); >0 with shortlisted=0 = a filter ate them; the table's ET-day
// column shows the achieved spread.
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

import { existsSync } from 'node:fs';

// ── Env self-load + pre-flight (see header) ──────────────────────────────
// No-op when the vars are already set — running WITH --env-file, or on
// Vercel, hits this branch and skips. process.loadEnvFile throws on a
// missing path, so guard with existsSync; relative to the current working
// directory, i.e. the repo root (where .env.local lives).
if (!process.env.FIREBASE_PROJECT_ID) {
  for (const envFile of ['.env.local', '.env']) {
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
      break;
    }
  }
}

const REQUIRED_ENV = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(
    `[ExemplarShortlist] missing required Firebase Admin env: ${missingEnv.join(', ')}\n` +
    'Add them to .env.local at the repo root (format in .env.example:40-42; ' +
    'FIREBASE_PRIVATE_KEY must be double-quoted with literal \\n escapes), then run ' +
    'from the repo root:\n' +
    '  node api/scripts/wire-exemplar-shortlist.js --days 60 --per 8',
  );
  process.exit(1);
}

const { getFirebaseAdmin } = await import('../_utils/firebaseAdmin.js');

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
// --spread-per-day N (default 0 = off): keep at most N candidates per ET
// calendar day, so a high-volume group (Kai fires 3x/day; Alex bursts on
// volatile days) does not fill its whole shortlist from 1-3 recent days.
// --scan N (default 60): the per-group query ceiling. The spread cap skips
// same-day rows, so it needs more scanned docs to reach --per; raise this
// when a capped group comes back short.
const SPREAD_PER_DAY = flag('spread-per-day', 0);
const SCAN = flag('scan', 60);

// RETENTION CEILING (cleanup.js:30-58): a story is marked expired at
// expiresAt<now and hard-DELETED ~30 days after that. Effective history is
// therefore expiryHours + ~30d per reporter — kai/alex ~31d, neta ~32d,
// doug ~37d, kim ~44d. --days beyond that ceiling returns nothing older;
// it does not error, it just cannot reach further back than the sweep left.

// ET calendar day (America/New_York) for the spread cap — matches the
// newsroom's own dedup key (getTodayET, generate-pulse.js). en-CA yields
// YYYY-MM-DD.
function etDay(publishedAt) {
  const d = publishedAt?.toDate?.() ?? (publishedAt instanceof Date ? publishedAt : new Date(publishedAt));
  if (Number.isNaN(d?.getTime?.())) return 'unknown';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

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
        .limit(SCAN)
        .get();

      const candidates = [];
      const perDay = new Map(); // ET day -> kept count (spread cap)
      let cappedSkips = 0;      // rows dropped ONLY by the spread cap
      for (const doc of snap.docs) {
        const s = doc.data();
        if (s.wireConflict || s.wireSuperseded === true) continue;
        const body = String(s.body || '');
        if (body.length < BODY_MIN || body.length > BODY_MAX) continue;
        if (!s.dataSnapshot) continue;
        // Spread cap: once an ET day is full, SKIP (keep scanning older) —
        // never break, so selection walks back into earlier days.
        if (SPREAD_PER_DAY > 0) {
          const day = etDay(s.publishedAt);
          const n = perDay.get(day) || 0;
          if (n >= SPREAD_PER_DAY) { cappedSkips++; continue; }
          perDay.set(day, n + 1);
        }
        candidates.push({
          storyId: doc.id,
          publishedAt: s.publishedAt?.toDate?.()?.toISOString?.() ?? String(s.publishedAt),
          etDay: etDay(s.publishedAt),
          headline: String(s.headline || '').slice(0, 110),
          bodyChars: body.length,
          operandFields: serverOperandFields(s.dataSnapshot),
        });
        if (candidates.length >= PER_GROUP) break;
      }
      const group = { reporter, type, considered: snap.size, shortlisted: candidates.length, candidates };
      // Honesty: if the cap left the group short of --per, say why — is it
      // the spread cap biting (raise --scan) or a genuinely thin type?
      if (SPREAD_PER_DAY > 0) {
        group.spreadPerDay = SPREAD_PER_DAY;
        group.daysCovered = perDay.size;
        group.cappedSkips = cappedSkips;
        if (candidates.length < PER_GROUP) {
          group.note = snap.size >= SCAN
            ? `short of --per and scan hit the ${SCAN}-doc ceiling; raise --scan`
            : `short of --per: only ${snap.size} rows exist in-window (retention/sparsity), not a cap artifact`;
        }
      }
      out.groups.push(group);
    }
  }

  // Markdown for the founder; JSON for the picks round-trip.
  console.log(`# Wire exemplar shortlist — last ${DAYS} days\n`);
  for (const g of out.groups) {
    const spread = g.spreadPerDay ? ` · ${g.daysCovered} ET days, cap ${g.spreadPerDay}/day` : '';
    console.log(`## ${g.reporter} × ${g.type}  (${g.shortlisted} shortlisted of ${g.considered} scanned${spread})\n`);
    if (g.note) console.log(`> ⚠️ ${g.note}\n`);
    // considered=0 ⇒ the type is not being written (production defect);
    // considered>0 with shortlisted=0 ⇒ a filter ate them (inspect below).
    if (g.considered === 0) console.log('> ⚠️ considered=0 — no stories of this type in-window (never written, or retention-deleted)\n');
    console.log('| # | storyId | ET day | chars | server operands | headline |');
    console.log('|---|---|---|---|---|---|');
    g.candidates.forEach((c, i) => {
      console.log(`| ${i + 1} | \`${c.storyId}\` | ${c.etDay ?? c.publishedAt?.slice(0, 10)} | ${c.bodyChars} | ${c.operandFields.join(', ') || '—'} | ${c.headline.replace(/\|/g, '\\|')} |`);
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
