import { fileURLToPath as __f } from 'node:url';
import { dirname as __d, resolve as __r } from 'node:path';
const __DIR = __d(__f(import.meta.url));
const __REPO = __r(__DIR, '../..');
// Deterministic assembler for the candidate compat registry.
// Reads the per-batch cell files, evaluates each as a module, merges into one
// object, normalizes (sorts set-like arrays), validates the §1 cell schema,
// and reports coverage + gaps. Emits merged_cells.json for the module build.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { writeFileSync as wf } from 'node:fs';

const DIR = __DIR;
const BATCHES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];
const ARCHES = ['momentum_chaser', 'contrarian', 'degen', 'guardian', 'analyst'];
const STATES = ['native', 'neutral', 'tension', 'core_conflict', 'deferred'];
const NOTE_TOKENS = ['prose_only', 'c21_discretionary', 'board_blind', 'weight_only_construction', 'equal_weight_scope'];

async function loadBatch(label) {
  const path = `${DIR}/cells_${label}.js`;
  if (!existsSync(path)) return null;
  let body = readFileSync(path, 'utf8').trim();
  body = body.replace(/^(?:\s*\/\/[^\n]*\n|\s+)*/, ''); // drop leading comment lines / blank space
  body = body.replace(/^const\s+\w+\s*=\s*\{/, '{');    // strip `const NAME = {`
  if (!body.startsWith('{')) body = `{\n${body}\n}`;    // bare entries → wrap
  body = body.replace(/;\s*$/, '');                     // strip trailing ;
  const tmp = `${DIR}/.mod_${label}.mjs`;
  wf(tmp, `export default ${body};\n`);
  const mod = await import(pathToFileURL(tmp).href + `?t=${label}`);
  return mod.default;
}

function isDomain(v) {
  if (!v || typeof v !== 'object') return false;
  const k = Object.keys(v);
  if ('allow' in v) return Array.isArray(v.allow);
  if ('minOnly' in v) return typeof v.minOnly === 'number';
  if ('min' in v || 'max' in v) return k.every((x) => x === 'min' || x === 'max');
  return false;
}
function validNarrowed(np) {
  if (np === null) return true;
  if (typeof np !== 'object') return false;
  if (isDomain(np)) return true;                 // bare domain
  return Object.values(np).every(isDomain);      // param-keyed map of domains
}
function sortArr(a) { return Array.isArray(a) ? [...a].sort() : a; }
function normCell(c) {
  const out = {
    state: c.state,
    rulingIds: sortArr(c.rulingIds ?? []),
    advisory: c.advisory ?? null,
    narrowedParams: c.narrowedParams ?? null,
    displayReason: c.displayReason ?? null,
    notes: sortArr(c.notes ?? []),
  };
  // sort allow arrays inside narrowedParams for determinism
  if (out.narrowedParams && typeof out.narrowedParams === 'object') {
    const np = out.narrowedParams;
    if (Array.isArray(np.allow)) np.allow = sortArr(np.allow);
    else for (const k of Object.keys(np)) if (np[k] && Array.isArray(np[k].allow)) np[k].allow = sortArr(np[k].allow);
  }
  return out;
}

const merged = {};
const dupes = [];
const perBatch = {};
const ruleToBatch = {};
for (const label of BATCHES) {
  const obj = await loadBatch(label);
  if (!obj) { perBatch[label] = 'MISSING'; continue; }
  let n = 0;
  for (const [ruleId, cols] of Object.entries(obj)) {
    if (merged[ruleId]) dupes.push(`${ruleId} (in ${ruleToBatch[ruleId]} and ${label})`);
    merged[ruleId] = {};
    ruleToBatch[ruleId] = label;
    for (const arch of ARCHES) {
      if (cols[arch]) { merged[ruleId][arch] = normCell(cols[arch]); n++; }
    }
  }
  perBatch[label] = `${Object.keys(obj).length} rules, ${n} cells`;
}

// ── advisory fill from the committed C7 V1.0 governed extract ───────────────
// V1.2's table is already in the ledger cells (the closure-round advisories);
// the extract supplies the "unchanged"/freshly-authored cells' governed text.
// Supersession: V1.2 wins on overlap, so fill ONLY cells whose advisory is still
// null, and expand the table's elided header ("The agent is instructed that…")
// into a full sentence so all cells read consistently.
{
  const extractPath = `${__REPO}/docs/archetype-program/C7_V1_0_ADVISORY_SENTENCES_OF_RECORD.md`;
  const extract = readFileSync(extractPath, 'utf8');
  const normalize = (s) => `the agent is instructed that ${s.trim().replace(/^(?:…|\.\.\.)\s*/, '').replace(/^that\s+/i, '')}`;
  const fillMap = {};
  for (const line of extract.split('\n')) {
    const m = line.match(/^\|\s*([a-z0-9-]+)\/(\w+)\s*\([^)]*\)\s*\|\s*(.+?)\s*\|\s*$/);
    if (m) fillMap[`${m[1]}/${m[2]}`] = m[3];
  }
  let filled = 0, supersededByV12 = 0; const notInRegistry = [];
  for (const [key, sentence] of Object.entries(fillMap)) {
    const [ruleId, arch] = key.split('/');
    const cell = merged[ruleId] && merged[ruleId][arch];
    if (!cell) { notInRegistry.push(key); continue; }
    if (cell.advisory === null || cell.advisory === '') { cell.advisory = normalize(sentence); filled++; }
    else supersededByV12++;
  }
  let normalized = 0; // the V1.2 cells the transcription captured with the elided "…" form
  for (const row of Object.values(merged)) for (const cell of Object.values(row)) {
    if (typeof cell.advisory === 'string' && /^(?:…|\.\.\.)/.test(cell.advisory)) { cell.advisory = normalize(cell.advisory); normalized++; }
  }
  console.log(`advisory fill: filled ${filled}, superseded-by-V1.2 ${supersededByV12}, normalized-ellipsis ${normalized}`
    + (notInRegistry.length ? `, extract-cells-not-in-registry ${notInRegistry.length} (${notInRegistry.join(',')})` : ''));
}

// validate + tally
const counts = { native: 0, neutral: 0, tension: 0, core_conflict: 0, deferred: 0 };
const errors = [];
const advisoryGap = [];          // tension cells with null advisory
const drGap = [];                // core_conflict cells with null displayReason
let cellCount = 0, missingArch = [];
for (const [ruleId, cols] of Object.entries(merged)) {
  const present = ARCHES.filter((a) => cols[a]);
  if (present.length !== 5) missingArch.push(`${ruleId}: ${present.length}/5 (${present.join(',')})`);
  for (const arch of present) {
    const c = cols[arch]; cellCount++;
    if (!STATES.includes(c.state)) errors.push(`${ruleId}/${arch}: bad state ${c.state}`);
    else counts[c.state]++;
    if (!validNarrowed(c.narrowedParams)) errors.push(`${ruleId}/${arch}: bad narrowedParams ${JSON.stringify(c.narrowedParams)}`);
    if (!Array.isArray(c.rulingIds)) errors.push(`${ruleId}/${arch}: rulingIds not array`);
    for (const t of c.notes) if (!NOTE_TOKENS.includes(t)) errors.push(`${ruleId}/${arch}: bad note ${t}`);
    if (c.state === 'tension' && (c.advisory === null || c.advisory === '')) advisoryGap.push(`${ruleId}/${arch}`);
    if (c.state === 'core_conflict' && (c.displayReason === null || c.displayReason === '')) drGap.push(`${ruleId}/${arch}`);
  }
}

writeFileSync(`${DIR}/merged_cells.json`, JSON.stringify(merged, null, 1));

console.log('=== PER BATCH ==='); for (const [k, v] of Object.entries(perBatch)) console.log(`  ${k}: ${v}`);
console.log('\n=== TOTALS ===');
console.log(`  rules: ${Object.keys(merged).length} | cells: ${cellCount}`);
console.log('  states:', JSON.stringify(counts));
console.log(`\n=== duplicates (${dupes.length}) ===`); dupes.forEach((d) => console.log('  ' + d));
console.log(`\n=== rules with !=5 archetype cols (${missingArch.length}) ===`); missingArch.forEach((m) => console.log('  ' + m));
console.log(`\n=== SCHEMA ERRORS (${errors.length}) ===`); errors.slice(0, 40).forEach((e) => console.log('  ' + e));
console.log(`\n=== ADVISORY GAP: tension cells missing verbatim advisory (${advisoryGap.length}) ===`);
console.log('  ' + advisoryGap.join('  '));
console.log(`\n=== core_conflict missing displayReason (${drGap.length}) ===`);
console.log('  ' + drGap.join('  '));
