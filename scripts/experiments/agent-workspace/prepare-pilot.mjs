// Bounded offline import of the existing EODHD-PILOT-001 review package.
// Reads saved files only. It never runs packaged scripts or requests provider data.
import { createHash } from 'node:crypto';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { INPUT_SCHEMA, validateInput } from './experiment.mjs';
import { expectedCompletedSession } from '../../../api/_utils/setupEvaluator/dailyBarsAdapter.js';
import { MIN_COMPLETED_BARS } from '../../../api/_utils/setupEvaluator/thresholds.js';
import { sourceProvenance } from './run.mjs';

export const SYMBOLS = Object.freeze(['AAPL.US', 'MSFT.US', 'NVDA.US']);
export const DATES = Object.freeze(['2026-10-28', '2026-10-29', '2026-10-30']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const HASH = /^[a-f0-9]{64}$/;
const encode = value => JSON.stringify(value, null, 2) + '\n';

async function savedFile(root, name, expected) {
  const bytes = await readFile(path.join(root, name));
  if (bytes.length > 5 * 1024 * 1024) throw new Error(`Saved file exceeds 5 MiB: ${name}`);
  const hash = sha256(bytes);
  if (expected && (expected.sha256 !== hash || expected.bytes !== bytes.length)) throw new Error(`Package integrity mismatch: ${name}`);
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error(`Invalid saved JSON: ${name}`); }
  return { data, sha256: hash, bytes: bytes.length };
}

export function casesFromSlice(slice, symbol) {
  const source = slice.sources?.eod;
  if (slice.symbol !== symbol || source?.entry?.symbol !== symbol || source?.entry?.kind !== 'eod' || source?.source !== `https://eodhd.com/api/eod/${symbol}` || !HASH.test(source?.sha256)) throw new Error(`Unexpected daily source: ${symbol}`);
  const clock = source.retrieved_at_utc;
  if (typeof clock !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(clock) || !Number.isFinite(Date.parse(clock))) throw new Error(`Invalid retrieval clock: ${symbol}`);
  const recordedAt = new Date(clock).toISOString();
  if (recordedAt.slice(0, 19) !== clock.slice(0, 19)) throw new Error(`Invalid retrieval clock: ${symbol}`);
  if (recordedAt <= `${DATES.at(-1)}T16:00:00.000Z`) throw new Error(`Expected a later historical download: ${symbol}`);
  const rows = slice.datasets?.eod;
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw new Error(`Invalid saved daily rows: ${symbol}`);
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(`${row.date}T00:00:00Z`)) || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date || seen.has(row.date)) throw new Error(`Invalid or duplicate daily date: ${symbol}`);
    seen.add(row.date);
  }
  return DATES.map(asOf => {
    // These three dates are in EDT. The shared calendar selects the prior completed session.
    const observedAt = `${asOf}T16:00:00.000Z`;
    const session = expectedCompletedSession({ asOf, now: new Date(observedAt) });
    if (!session.ok) throw new Error(`Calendar refused ${asOf}: ${session.reason}`);
    const selected = rows.filter(r => r.date <= session.expected).sort((a, b) => b.date.localeCompare(a.date)).slice(0, MIN_COMPLETED_BARS);
    return {
      id: `${symbol}-${asOf}-daily-at-noon`, symbol, asOf, observedAt, recordedAt,
      evidenceKind: 'later_reconstruction',
      source: `EODHD-PILOT-001 saved daily slice; ${symbol}; volume coverage unverified`,
      rows: selected.map(r => ({ date: r.date, open: r.open ?? null, high: r.high ?? null, low: r.low ?? null, rawClose: r.close ?? null, volume: r.volume ?? null, adjustedClose: r.adjusted_close ?? null })),
    };
  });
}

export async function preparePilot(sourceRoot, outputRoot) {
  const packageFile = await savedFile(sourceRoot, 'PACKAGE-MANIFEST.json');
  const metadata = packageFile.data.files;
  const checked = async name => {
    if (!metadata?.[name] || !HASH.test(metadata[name].sha256)) throw new Error(`Missing package hash: ${name}`);
    return savedFile(sourceRoot, name, metadata[name]);
  };
  const sliceManifest = await checked('inputs/slice-manifest.json');
  const cases = [];
  const sources = [];
  for (const symbol of SYMBOLS) {
    const name = `inputs/slices/${symbol}.json`;
    const entries = sliceManifest.data.slices?.filter(s => s.symbol === symbol);
    if (entries?.length !== 1 || entries[0].path !== name) throw new Error(`Missing or ambiguous slice: ${symbol}`);
    const file = await checked(name);
    if (file.sha256 !== entries[0].sha256 || file.data.datasets?.eod?.length !== entries[0].row_counts?.eod) throw new Error(`Slice integrity mismatch: ${symbol}`);
    cases.push(...casesFromSlice(file.data, symbol));
    const eod = file.data.sources.eod;
    sources.push({ symbol, path: name, sha256: file.sha256, bytes: file.bytes, dailyRows: file.data.datasets.eod.length, originalResponseSha256: eod.sha256, retrievedAtOriginal: eod.retrieved_at_utc, endpoint: eod.source });
  }
  const input = validateInput({ schemaVersion: INPUT_SCHEMA, title: 'AAPL, MSFT, NVDA: daily setups available at noon, October 28–30', cases });
  const inputBytes = encode(input);
  const manifest = {
    schemaVersion: 'ft.agent-workspace-pilot-preparation.v1',
    plan: { symbols: [...SYMBOLS], requestedDates: [...DATES], clock: '16:00 UTC / noon EDT on these dates', barsPerCase: MIN_COMPLETED_BARS, selection: 'Fixed symbols and dates from the saved pilot, selected before evaluation. No selection by outcome.' },
    evidenceKind: 'later_reconstruction',
    limitations: ['Historical downloads, not verified decision-time snapshots. Later provider revisions are unknown.', 'Volume coverage remains unverified. Preserve the saved daily feed values without a consolidated-volume claim.', 'Package hashes establish internal consistency, not independent provider authenticity.', 'No market outcomes, return score, or reviewed training labels.'],
    packageManifestSha256: packageFile.sha256, sliceManifestSha256: sliceManifest.sha256, sources,
    mapping: { rawClose: 'close', adjustedClose: 'adjusted_close, used only by the shared adapter split heuristic', volume: 'volume, missing preserved as null', dates: 'newest first, clipped to the shared calendar’s completed session', recordedAt: 'source retrieval instant normalized to UTC milliseconds; original precision retained above' },
    cases: cases.map(c => ({ id: c.id, requestedDate: c.asOf, newestSavedBar: c.rows[0]?.date ?? null, oldestSavedBar: c.rows.at(-1)?.date ?? null, rows: c.rows.length })),
    inputSha256: sha256(inputBytes), importerSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    implementation: await sourceProvenance(),
  };
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const folder = await mkdtemp(path.join(outputRoot, 'saved-pilot-'));
  try {
    await writeFile(path.join(folder, 'input.json'), inputBytes, { flag: 'wx', mode: 0o600 });
    await writeFile(path.join(folder, 'input-manifest.json'), encode(manifest), { flag: 'wx', mode: 0o600 });
  } catch (error) { await rm(folder, { recursive: true, force: true }); throw error; }
  return { input, manifest, folder };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 4 || args[0] !== '--source' || args[2] !== '--out' || !args[1] || !args[3] || args[1].startsWith('--') || args[3].startsWith('--')) throw new Error('Usage: node scripts/experiments/agent-workspace/prepare-pilot.mjs --source EXTRACTED_PACKAGE --out OUTPUT_DIRECTORY');
  const result = await preparePilot(path.resolve(args[1]), path.resolve(args[3]));
  console.log(`Prepared ${result.input.cases.length} saved daily cases.\nInput: ${path.join(result.folder, 'input.json')}\nProvenance: ${path.join(result.folder, 'input-manifest.json')}\nNo market requests or evaluator runs.`);
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
