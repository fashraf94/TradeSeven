// Offline-only experiment contract. Production evaluator and thresholds stay unchanged.
import { createHash } from 'node:crypto';
import { buildDailyEvidence } from '../../../api/_utils/setupEvaluator/dailyBarsAdapter.js';
import { evaluateTfEntry } from '../../../api/_utils/setupEvaluator/tfSetupV1.js';
import { MIN_COMPLETED_BARS, describeRuleSet } from '../../../api/_utils/setupEvaluator/thresholds.js';

export const INPUT_SCHEMA = 'ft.agent-workspace-input.v1';
export const RUN_SCHEMA = 'ft.agent-workspace-run.v1';
export const CANDIDATES = Object.freeze(['breakout-only-v1', 'baseline-control-v1']);
const BASELINE = 'tf-entry-admission-v1';

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}
export const digest = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const fail = message => { throw new Error(`Agent workspace: ${message}`); };
function object(value, keys, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(`${label} must be an object`);
  for (const k of Object.keys(value)) if (!keys.includes(k)) fail(`${label}: unsupported field ${k}`);
}
function text(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) fail(`${label} must be nonempty text up to ${max} characters`);
}
function instant(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${label} must be a UTC timestamp`);
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (new Date(value).toISOString() !== normalized) fail(`${label} must be a real UTC timestamp`);
}

// No arbitrary metadata: credential-shaped extras are rejected, never silently saved.
export function validateInput(input) {
  object(input, ['schemaVersion', 'title', 'cases'], 'input');
  if (input.schemaVersion !== INPUT_SCHEMA) fail('unsupported input schema');
  text(input.title, 'title');
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 50) fail('provide 1 to 50 cases');
  const ids = new Set();
  for (const c of input.cases) {
    object(c, ['id', 'symbol', 'asOf', 'observedAt', 'recordedAt', 'evidenceKind', 'source', 'rows'], 'case');
    text(c.id, 'case id', 80);
    if (ids.has(c.id)) fail(`duplicate case id ${c.id}`);
    ids.add(c.id);
    if (typeof c.symbol !== 'string' || !/^[A-Z0-9.^-]{1,20}$/.test(c.symbol)) fail('invalid symbol');
    if (typeof c.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.asOf)) fail('asOf must be YYYY-MM-DD');
    instant(c.observedAt, 'observedAt');
    instant(c.recordedAt, 'recordedAt');
    if (!['synthetic', 'later_reconstruction'].includes(c.evidenceKind)) fail('evidenceKind must be synthetic or later_reconstruction. Decision-time provenance is not verified by this runner');
    text(c.source, 'source');
    if (!Array.isArray(c.rows) || c.rows.length > 260) fail('rows must contain at most 260 bars');
    for (const r of c.rows) {
      object(r, ['date', 'open', 'high', 'low', 'rawClose', 'volume', 'adjustedClose'], 'row');
      if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) fail('invalid row date');
      for (const key of ['open', 'high', 'low', 'rawClose', 'volume', 'adjustedClose']) {
        if (r[key] !== undefined && r[key] !== null && (typeof r[key] !== 'number' || !Number.isFinite(r[key]))) fail(`${key} must be a finite number or null`);
      }
    }
  }
  return input;
}

function admission(entry, policy) {
  if (entry.verdict === 'unknown') return { decision: 'unknown', reason: entry.reason };
  if (entry.verdict !== 'valid') return { decision: 'refused', reason: entry.reason };
  if (policy !== 'breakout-only-v1') return { decision: 'admitted', reason: 'qualified_setup' };
  if (entry.patterns.breakout === 'satisfied') return { decision: 'admitted', reason: 'qualified_breakout' };
  if (entry.patterns.breakout === 'untestable') return { decision: 'unknown', reason: 'breakout_evidence_unavailable' };
  return { decision: 'refused', reason: 'breakout_required' };
}

export function createExperiment({ input, candidate = 'breakout-only-v1', provenance, createdAt }) {
  validateInput(input);
  if (!CANDIDATES.includes(candidate)) fail('unsupported candidate policy');
  instant(createdAt, 'createdAt');
  object(provenance, ['gitCommit', 'dirty', 'nodeVersion', 'sourceDigest', 'files'], 'provenance');
  if (!/^[a-f0-9]{40}$/.test(provenance.gitCommit) || typeof provenance.dirty !== 'boolean' || !/^[a-f0-9]{64}$/.test(provenance.sourceDigest)) fail('invalid source provenance');
  text(provenance.nodeVersion, 'nodeVersion');
  if (!Array.isArray(provenance.files) || !provenance.files.length) fail('source files required');
  for (const f of provenance.files) {
    object(f, ['path', 'sha256'], 'source file');
    text(f.path, 'source path', 240);
    if (!/^[a-f0-9]{64}$/.test(f.sha256)) fail('invalid source hash');
  }
  if (digest(provenance.files) !== provenance.sourceDigest) fail('source digest mismatch');
  const snapshot = JSON.parse(JSON.stringify(input));
  const policies = { baseline: BASELINE, candidate };
  const evaluator = describeRuleSet();
  const cases = snapshot.cases.map(c => {
    const evidence = buildDailyEvidence({
      rows: c.rows, asOf: c.asOf, now: new Date(c.observedAt), minBars: MIN_COMPLETED_BARS,
      source: c.source, sourceMeta: { recordedAt: c.recordedAt }, symbol: c.symbol, barsClass: c.evidenceKind,
    });
    const entry = evaluateTfEntry(evidence);
    const baseline = admission(entry, BASELINE);
    const alternative = admission(entry, candidate);
    return { id: c.id, inputHash: digest(c), entry, baseline, candidate: alternative, changed: baseline.decision !== alternative.decision, outcome: { status: 'not_observed' } };
  });
  const count = arm => Object.fromEntries(['admitted', 'refused', 'unknown'].map(d => [d, cases.filter(c => c[arm].decision === d).length]));
  const summary = { total: cases.length, changed: cases.filter(c => c.changed).length, baseline: count('baseline'), candidate: count('candidate') };
  const fingerprint = digest({ schemaVersion: RUN_SCHEMA, input: snapshot, policies, evaluator, sourceDigest: provenance.sourceDigest, nodeVersion: provenance.nodeVersion });
  const run = {
    schemaVersion: RUN_SCHEMA, runId: `exp_${fingerprint.slice(0,24)}`, fingerprint, createdAt, status: 'completed',
    scope: { owner: 'local-operator', archetype: 'trend-follower', workflow: 'offline-entry-comparison-v1', model: null, knowledgeSnapshot: null, execution: 'none', trainingUse: 'unreviewed', horizon: { resolution: 'daily_completed', holdingPeriod: null, reviewDate: null, gameExpiry: null } },
    provenance: JSON.parse(JSON.stringify(provenance)), policies, evaluator,
    inputHash: digest(snapshot), input: snapshot, cases, summary,
    usage: { modelRequests: 0, marketRequests: 0, databaseWrites: 0 },
  };
  return { ...run, recordHash: digest(run) };
}

// Integrity means reproducible local contents, not authenticated market evidence.
export function verifyExperiment(record, currentProvenance) {
  if (!record || record.schemaVersion !== RUN_SCHEMA) fail('unsupported saved run schema');
  if (record.provenance?.sourceDigest !== currentProvenance.sourceDigest || record.provenance?.nodeVersion !== currentProvenance.nodeVersion) fail('saved run uses different source or Node version. Use the recorded environment to replay it');
  const expected = createExperiment({ input: record.input, candidate: record.policies?.candidate, provenance: record.provenance, createdAt: record.createdAt });
  if (canonicalJson(expected) !== canonicalJson(record)) fail('saved run failed integrity/replay verification');
  return record;
}
