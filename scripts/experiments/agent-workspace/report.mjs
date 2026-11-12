import { cssVar } from '../../../src/theme/cssTokens.js';
import { DECISIONS, POLICIES, FACTS, CHECKS, label, caseTitle, evidenceLabel, patternLabel, regimeLabel, verdictLabel, reasonText, differenceText } from './labels.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const display = value => value === null || value === undefined ? 'Not available' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const cell = value => `<td>${escape(display(value))}</td>`;
const namedCell = (dictionary, name) => `<td>${escape(label(dictionary, name))}<small>${escape(name)}</small></td>`;

// No browser scripts or external assets. All values come from the verified saved run.
export function renderReport(run, tokenCss) {
  const historical = run.input.cases.some(c => c.evidenceKind === 'later_reconstruction');
  const counts = ['baseline', 'candidate'].map(arm => `<tr>${cell(arm === 'baseline' ? 'Baseline' : 'Candidate')}${cell(run.summary[arm].admitted)}${cell(run.summary[arm].refused)}${cell(run.summary[arm].unknown)}</tr>`).join('');
  const rows = run.cases.map((c, i) => {
    const input = run.input.cases[i];
    const checks = c.entry.checks.map(k => `<tr>${namedCell(CHECKS, k.id)}${cell(k.lhs)}${cell(k.op)}${cell(k.rhs)}${cell(k.result === true ? 'True' : k.result === false ? 'False' : k.result === 'unknown' ? 'Unknown' : k.result)}</tr>`).join('');
    const facts = Object.entries(c.entry.factsUsed).map(([name, fact]) => `<tr>${namedCell(FACTS, name)}${cell(fact.value)}${cell(fact.asOf)}</tr>`).join('');
    const comparison = ['baseline', 'candidate'].map(arm => `<section><h3>${arm === 'baseline' ? 'Baseline' : 'Candidate'}</h3><p>${escape(label(POLICIES, run.policies[arm]))}</p><strong data-decision="${escape(c[arm].decision)}">${escape(label(DECISIONS, c[arm].decision))}</strong><p>${escape(reasonText(c[arm], c.entry))}</p></section>`).join('');
    const session = c.entry.refusal ? c.entry.refusal.expected ?? 'Not established' : c.entry.asOf;
    return `<article><div class="case-title"><h2>${escape(caseTitle(input))}</h2><span class="tag">${c.changed ? 'Decision changed' : 'Decision unchanged'}</span></div>
      <p>${escape(input.symbol)} · Requested date: ${escape(input.asOf)} · ${escape(evidenceLabel(input.evidenceKind))}</p>
      <p>${c.entry.refusal ? 'Expected completed session' : 'Completed session evaluated'}: ${escape(session)}.</p>
      <div class="comparison">${comparison}</div><p class="difference">${escape(differenceText(c))}</p>
      <p>Shared evaluator: ${escape(verdictLabel(c.entry.verdict))} · Pattern: ${escape(patternLabel(c.entry.pattern))} · Trend: ${escape(regimeLabel(c.entry.regime))}</p>
      <p>Market outcome: not observed. Eligibility means meeting this experiment’s entry rules.</p>
      <details><summary>Why this result? Evidence and checks</summary><p>Source: ${escape(input.source)}. Recorded ${escape(input.recordedAt)}. Evaluation clock ${escape(input.observedAt)}.</p><p>Missing facts: ${escape(c.entry.missing.map(x => label(FACTS, x)).join(', ') || 'none')}.</p>
      <div class="scroll"><table><caption>Recorded facts</caption><thead><tr><th>Fact</th><th>Value</th><th>As of</th></tr></thead><tbody>${facts}</tbody></table></div>
      <p>True means the condition holds. False means it does not. A False result is not a software failure. Breakouts and pullbacks use different conditions. Bracketed values compare matching positions.</p>
      <div class="scroll"><table><caption>Recorded checks</caption><thead><tr><th>Check</th><th>Left value</th><th>Operator</th><th>Right value</th><th>Result</th></tr></thead><tbody>${checks}</tbody></table></div>
      <details><summary>Technical record and original identifiers</summary><pre>${escape(JSON.stringify({ id: c.id, baseline: c.baseline, candidate: c.candidate, entry: c.entry }, null, 2))}</pre></details></details></article>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>FantasyTrades Agent Workspace</title><style>
    ${tokenCss}
    *{box-sizing:border-box}body{margin:0;background:${cssVar('bg-app')};color:${cssVar('text-primary')};font:16px/1.55 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:38px 22px}h1{font-size:clamp(28px,5vw,44px);line-height:1.15}h2{font-size:19px;overflow-wrap:anywhere}h3{font-size:14px;font-weight:500;color:${cssVar('text-secondary')}}p{color:${cssVar('text-secondary')}}.eyebrow{color:${cssVar('accent')};letter-spacing:.1em;text-transform:uppercase;font-size:12px}.stats,.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.stats>div,article{background:${cssVar('bg-card')};border:1px solid ${cssVar('border-strong')};border-radius:12px;padding:22px;margin:18px 0}.stats strong{font-size:32px}.stats p{margin:4px 0}.case-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.tag{font-size:12px;padding:5px 10px;border:1px solid ${cssVar('border-strong')};border-radius:20px;white-space:nowrap}.comparison section{padding:12px;background:${cssVar('bg-app')};border-radius:8px}.comparison strong{font-size:22px}details{margin-top:16px}summary{cursor:pointer;color:${cssVar('accent')};padding:8px 0}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}td,th{padding:10px;border-bottom:1px solid ${cssVar('border-strong')}}caption{text-align:left;margin:12px 0;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}footer{overflow-wrap:anywhere;font-size:12px;color:${cssVar('text-muted')}}@media(max-width:600px){.case-title{display:block}.comparison{gap:8px}article{padding:16px}}
    small{display:block;color:${cssVar('text-muted')};font-size:11px;margin-top:4px}.guide{padding:18px;background:${cssVar('bg-card')};border:1px solid ${cssVar('border-strong')};border-radius:12px}.difference{font-weight:600;color:${cssVar('text-primary')}}summary:focus-visible{outline:2px solid ${cssVar('accent')};outline-offset:3px}@media(max-width:600px){.comparison{grid-template-columns:1fr}.stats{gap:8px}.stats>div{padding:14px}.tag{display:inline-block}.scroll{max-width:100%}}
    </style></head><body><main><p class="eyebrow">FantasyTrades · founder experiment</p><h1>Agent Workspace</h1><p>${escape(run.input.title)}</p>
    <p>Evidence: ${escape([...new Set(run.input.cases.map(c => evidenceLabel(c.evidenceKind)))].join(', '))}. Offline comparison. No trades, model calls, or performance score.</p>
    ${historical ? '<p class="guide">Historical downloads were captured after their evaluation dates. Decision-time availability and later revisions are unverified. Volume values retain the saved feed’s fields. This report does not establish consolidated market-volume coverage.</p>' : ''}
    <div class="stats"><div><strong>${run.summary.total}</strong><p>Saved cases</p></div><div><strong>${run.summary.changed}</strong><p>Eligibility decisions changed</p></div></div>
    <div class="guide"><p>Eligible: meets this configuration’s entry rules. Not eligible: fails an entry requirement. Unknown: required evidence is insufficient.</p><p>Baseline: ${escape(label(POLICIES, run.policies.baseline))}. Candidate: ${escape(label(POLICIES, run.policies.candidate))}. Both use the same saved evidence.</p><p>A changed decision is a test result. It does not establish a better strategy.</p></div>
    <div class="scroll"><table><caption>Decision counts</caption><thead><tr><th>Configuration</th><th>Eligible</th><th>Not eligible</th><th>Unknown</th></tr></thead><tbody>${counts}</tbody></table></div>
    ${rows}<details><summary>Run identity and reproduction</summary><pre>${escape(JSON.stringify({ runId: run.runId, fingerprint: run.fingerprint, policies: run.policies, evaluator: run.evaluator, scope: run.scope, provenance: run.provenance, usage: run.usage }, null, 2))}</pre></details>
    <footer><p>Created ${escape(run.createdAt)}. Run ${escape(run.runId)}.</p><p>Open the saved run.json for the complete inputs and results. Future outcomes and reviewed training labels are not part of this run.</p></footer></main></body></html>`;
}
