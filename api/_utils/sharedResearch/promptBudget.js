// api/_utils/sharedResearch/promptBudget.js
//
// Shared Research — THE INPUT BUDGET, pure (spec §6.12 control 2). The prompt
// is sized before any call (characters ÷ 4). The user turn renders at most 40
// current findings, each fact cut to 200 characters IN THE PROMPT (never in the
// record), and at most 5 retrieval items × 2 highlights. Over the SOFT cap,
// retrieval items are dropped from the last, then the oldest findings that are
// neither the target's nor the summary's; the question, the direction and the
// target are never dropped. Over the HARD cap after that → `prompt_too_large`,
// and the step makes no model call.

export const SOFT_CAP_TOKENS = 12_000;
export const HARD_CAP_TOKENS = 16_000;
export const FINDINGS_RENDER_MAX = 40;
export const FACT_PROMPT_CHARS = 200;
export const ITEMS_MAX = 5;
export const HIGHLIGHTS_PER_ITEM = 2;

/** The estimate the budget runs on. */
export const tokensOf = (text) => Math.ceil(String(text ?? '').length / 4);

/**
 * Fit the user turn to the budget.
 * @param {object} p
 * @param {string} p.system          the system prompt (fixed; counted, never trimmed)
 * @param {object[]} p.findings      the record's current findings, in record order
 * @param {object[]} p.items         the retrieval items, in rank order
 * @param {Set<string>|string[]} p.protectedIds  the target's and the summary's finding ids — never dropped
 * @param {(parts: { findings: object[], items: object[] }) => string} p.render  renders the user turn
 * @returns {{ ok: true, user: string, tokens: number, trimmed: { items: number, findings: number } } | { ok: false, error: 'prompt_too_large', tokens: number }}
 */
export function fitPrompt({ system, findings, items, protectedIds, render }) {
  const keep = new Set(protectedIds);
  const all = Array.isArray(findings) ? findings : [];
  // The newest FINDINGS_RENDER_MAX, protected ones always in, record order kept.
  const others = all.filter((f) => !keep.has(f.findingId));
  const room = Math.max(0, FINDINGS_RENDER_MAX - all.filter((f) => keep.has(f.findingId)).length);
  const newestOthers = new Set(others.slice(Math.max(0, others.length - room)).map((f) => f.findingId));
  let fs = all.filter((f) => keep.has(f.findingId) || newestOthers.has(f.findingId))
    .map((f) => ({ ...f, fact: f.fact.length > FACT_PROMPT_CHARS ? `${f.fact.slice(0, FACT_PROMPT_CHARS - 1)}…` : f.fact }));
  let its = (Array.isArray(items) ? items : []).slice(0, ITEMS_MAX)
    .map((it) => ({ ...it, highlights: (Array.isArray(it.highlights) ? it.highlights : []).slice(0, HIGHLIGHTS_PER_ITEM) }));
  const trimmed = { items: (Array.isArray(items) ? items.length : 0) - its.length, findings: all.length - fs.length };
  const size = () => tokensOf(system) + tokensOf(render({ findings: fs, items: its }));
  let tokens = size();
  while (tokens > SOFT_CAP_TOKENS && its.length > 0) {
    its = its.slice(0, -1);
    trimmed.items += 1;
    tokens = size();
  }
  while (tokens > SOFT_CAP_TOKENS) {
    const i = fs.findIndex((f) => !keep.has(f.findingId));
    if (i < 0) break;
    fs = [...fs.slice(0, i), ...fs.slice(i + 1)];
    trimmed.findings += 1;
    tokens = size();
  }
  if (tokens > HARD_CAP_TOKENS) return { ok: false, error: 'prompt_too_large', tokens };
  return { ok: true, user: render({ findings: fs, items: its }), tokens, trimmed, items: its };
}
