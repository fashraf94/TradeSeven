import { cssVar } from '../../../src/theme/cssTokens.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const display = value => value === null || value === undefined ? 'Not available' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const cell = value => `<td>${escape(display(value))}</td>`;

// No browser scripts or external assets. All values come from the verified saved run.
export function renderReport(run, tokenCss) {
  const rows = run.cases.map((c, i) => {
    const input = run.input.cases[i];
    const checks = c.entry.checks.map(k => `<tr>${cell(k.id)}${cell(k.lhs)}${cell(k.op)}${cell(k.rhs)}${cell(k.result)}</tr>`).join('');
    const facts = Object.entries(c.entry.factsUsed).map(([name, fact]) => `<tr>${cell(name)}${cell(fact.value)}${cell(fact.asOf)}</tr>`).join('');
    return `<article><div class="case-title"><h2>${escape(c.id)}</h2><span class="tag">${c.changed ? 'Decision changed' : 'Decision unchanged'}</span></div>
      <p>${escape(input.symbol)} · ${escape(input.asOf)} · ${escape(input.evidenceKind)}</p>
      <div class="comparison"><section><h3>Baseline</h3><strong>${escape(c.baseline.decision)}</strong><p>${escape(c.baseline.reason)}</p></section><section><h3>Candidate</h3><strong>${escape(c.candidate.decision)}</strong><p>${escape(c.candidate.reason)}</p></section></div>
      <p>Shared evaluator: ${escape(c.entry.verdict)} · Pattern: ${escape(c.entry.pattern ?? 'none')} · Regime: ${escape(c.entry.regime)}</p>
      <p>Market outcome: not observed. This comparison changes experiment admission only.</p>
      <details><summary>Evidence and checks</summary><p>Source: ${escape(input.source)}. Recorded ${escape(input.recordedAt)}. Evaluation clock ${escape(input.observedAt)}.</p><p>Completed session: ${escape(c.entry.asOf)}. Missing facts: ${escape(c.entry.missing.join(', ') || 'none')}.</p>
      <div class="scroll"><table><caption>Recorded facts</caption><thead><tr><th>Fact</th><th>Value</th><th>As of</th></tr></thead><tbody>${facts}</tbody></table></div>
      <div class="scroll"><table><caption>Recorded checks</caption><thead><tr><th>Check</th><th>Left value</th><th>Operator</th><th>Right value</th><th>Result</th></tr></thead><tbody>${checks}</tbody></table></div>
      <details><summary>Full evaluator record</summary><pre>${escape(JSON.stringify(c.entry, null, 2))}</pre></details></details></article>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>FantasyTrades Agent Workspace</title><style>
    ${tokenCss}
    *{box-sizing:border-box}body{margin:0;background:${cssVar('bg-app')};color:${cssVar('text-primary')};font:16px/1.55 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:38px 22px}h1{font-size:clamp(28px,5vw,44px);line-height:1.15}h2{font-size:19px;overflow-wrap:anywhere}h3{font-size:14px;font-weight:500;color:${cssVar('text-secondary')}}p{color:${cssVar('text-secondary')}}.eyebrow{color:${cssVar('accent')};letter-spacing:.1em;text-transform:uppercase;font-size:12px}.stats,.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.stats>div,article{background:${cssVar('bg-card')};border:1px solid ${cssVar('border-strong')};border-radius:12px;padding:22px;margin:18px 0}.stats strong{font-size:32px}.stats p{margin:4px 0}.case-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.tag{font-size:12px;padding:5px 10px;border:1px solid ${cssVar('border-strong')};border-radius:20px;white-space:nowrap}.comparison section{padding:12px;background:${cssVar('bg-app')};border-radius:8px}.comparison strong{font-size:22px}details{margin-top:16px}summary{cursor:pointer;color:${cssVar('accent')};padding:8px 0}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}td,th{padding:10px;border-bottom:1px solid ${cssVar('border-strong')}}caption{text-align:left;margin:12px 0;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}footer{overflow-wrap:anywhere;font-size:12px;color:${cssVar('text-muted')}}@media(max-width:600px){.case-title{display:block}.comparison{gap:8px}article{padding:16px}}
    </style></head><body><main><p class="eyebrow">FantasyTrades · founder experiment</p><h1>Agent Workspace</h1><p>${escape(run.input.title)}</p>
    <p>Evidence: ${escape([...new Set(run.input.cases.map(c => c.evidenceKind))].join(', '))}. Offline comparison. No trades, model calls, or performance score.</p>
    <div class="stats"><div><strong>${run.summary.total}</strong><p>Saved cases</p></div><div><strong>${run.summary.changed}</strong><p>Admission decisions changed</p></div></div>
    <p>Baseline: ${escape(run.policies.baseline)}. Candidate: ${escape(run.policies.candidate)}.</p><p>A changed decision is a test result. It does not establish a better strategy.</p>
    ${rows}<details><summary>Run identity and reproduction</summary><pre>${escape(JSON.stringify({ runId: run.runId, fingerprint: run.fingerprint, evaluator: run.evaluator, scope: run.scope, provenance: run.provenance, usage: run.usage }, null, 2))}</pre></details>
    <footer><p>Created ${escape(run.createdAt)}. Run ${escape(run.runId)}.</p><p>Open the saved run.json for the complete inputs and results. Future outcomes and reviewed training labels are not part of this run.</p></footer></main></body></html>`;
}
