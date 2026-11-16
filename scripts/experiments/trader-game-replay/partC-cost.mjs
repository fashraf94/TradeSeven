#!/usr/bin/env node
// scripts/experiments/trader-game-replay/partC-cost.mjs
//
// Part C — the cost census of the trading brain's calls (rulings BB-23, BB-24). Offline and
// deterministic: reads only the local export (tick rows + tick bodies) and Part B's result
// file (results/partB.json — run Part B first). No model call, no token-counting call.
//
// SCOPE: the one model call per check that the tick capture records (the trading brain,
// agent-evaluate.js → anthropic.messages.create). Other model calls (chat, narration,
// meetings, reviews) are not in the export and are not counted.
//
// CACHE ORDER: a prompt cache matches a prefix in the order tools → system → messages, so
// every prefix here is measured in that order, over the raw text of each block:
//   tools (the JSON of the tool list), system, messages[0] (identity + Forge rules),
//   messages[1] (the fixed acknowledgement), messages[2] (the per-check context).
//
// TOKENS: input, output and cache token counts are the stored response usage. A call whose
// response was not stored gets an ESTIMATE: input = its request bytes × the median tokens per
// byte of the stored calls; output = the median stored output. Every table that uses an
// estimate says so. Token shares of a section are its byte share of the request (the tool-use
// system text the API adds is not in the request bytes and is spread across the shares).
//
// USAGE: node scripts/experiments/trader-game-replay/partC-cost.mjs --in <export dir>

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs, bundles, writeResult, round2, sum, median, mean, tally, mdTable, pct, slotKey } from './replayLib.mjs';

// Per million tokens, checked 15 Nov 2026 (the prompt's table).
export const PRICES = {
  'Haiku 4.5': { in: 1.0, out: 5.0, read: 0.10, write1h: 2.0, minCache: 4096, tokenScale: 1 },
  'Haiku 5.5': { in: 0.10, out: 0.50, read: 0.01, write1h: 0.20, minCache: 512, tokenScale: 1.3, ceiling: 100_000 },
};
const TTL_MS = 60 * 60 * 1000;
const bytes = (s) => Buffer.byteLength(typeof s === 'string' ? s : JSON.stringify(s ?? null), 'utf8');
// A section header: a capitalised name, optionally with a note in parentheses that starts in lower
// case ("BENCH (available for swap):"), or a "=== NAME ===" banner. A per-symbol line names its
// sector with a capital ("MMM (Industrials):") and is not a section; "HELD:" and "BENCH:" are
// sub-headings inside FUNDAMENTALS.
const HEADER = /^(?:(?!(?:HELD|BENCH):)[A-Z][A-Z0-9 &/'’,.+-]{2,}(?: \([a-z].*\))?:\s*|=== (?!END)[^=]+ ===)$/;

/** Split a block of text at its section headers: [{ name, text }]. Text before the first header is "(preamble)". */
export function sections(text) {
  const out = [{ name: '(preamble)', text: '' }];
  let inBanner = false;
  for (const line of String(text).split('\n')) {
    if (/^=== END /.test(line)) { out.at(-1).text += `${line}\n`; inBanner = false; continue; }
    if (!inBanner && HEADER.test(line)) { out.push({ name: line.replace(/ \(.*\)/, '').replace(/[:=]/g, '').trim(), text: '' }); inBanner = line.startsWith('==='); }
    out.at(-1).text += `${line}\n`;
  }
  return out.filter((s) => s.text.length);
}

/** The request as cache-ordered blocks, each with its text and its size-map category. */
export function blocksOf(req) {
  const m = req.messages || [];
  const text = (c) => (typeof c === 'string' ? c : (c || []).map((b) => b.text || '').join(''));
  const id = sections(text(m[0]?.content));
  const live = sections(text(m[2]?.content));
  const cat = (name) => (/RULE/.test(name) ? 'rules' : name === 'ACTIVE POSITIONS' ? 'positions table' : name.startsWith('BENCH') ? 'bench' : 'per-check context');
  return [
    { block: 'tools', parts: [{ name: 'tool', cat: 'tool', text: JSON.stringify(req.tools ?? []) }] },
    { block: 'system', parts: [{ name: 'system', cat: 'system', text: text(req.system) }] },
    { block: 'identity', parts: id.map((s) => ({ name: s.name, cat: /RULE/.test(s.name) ? 'rules' : 'identity', text: s.text })) },
    { block: 'ack', parts: [{ name: 'ack', cat: 'other', text: text(m[1]?.content) }] },
    { block: 'context', parts: live.map((s) => ({ name: s.name, cat: cat(s.name), text: s.text })) },
    { block: 'envelope', parts: [{ name: 'envelope', cat: 'other', text: JSON.stringify({ model: req.model, max_tokens: req.max_tokens, temperature: req.temperature, tool_choice: req.tool_choice }) }] },
  ].map((b) => ({ ...b, text: b.parts.map((p) => p.text).join('') }));
}

/** Common prefix of two requests in cache order: bytes, the block where they first differ, and the block-aligned prefix. */
export function commonPrefix(a, b) {
  let common = 0;
  let aligned = 0;
  for (let i = 0; i < a.length - 1; i++) { // the envelope is not a cacheable block
    const x = a[i].text, y = b[i]?.text ?? '';
    if (x === y) { common += bytes(x); aligned = common; continue; }
    let k = 0;
    while (k < x.length && k < y.length && x[k] === y[k]) k++;
    const part = (() => { let n = 0; for (const p of a[i].parts) { n += p.text.length; if (n > k) return p.name; } return a[i].parts.at(-1)?.name; })();
    return { common: common + bytes(x.slice(0, k)), aligned, firstDiff: `${a[i].block} › ${part}` };
  }
  return { common, aligned, firstDiff: 'none' };
}

function callsOf(bundle) {
  const bodies = new Map(bundle.tickBodies.map((t) => [t.tickSeq, t]));
  return bundle.ticks.filter((t) => t.model?.dispatched).sort((a, b) => a.tickSeq - b.tickSeq).map((t) => {
    const body = bodies.get(t.tickSeq);
    let req = null, usage = null;
    try { req = JSON.parse(body.request.body); } catch { /* request not stored */ }
    try { usage = JSON.parse(body.response.body).usage || null; } catch { /* response not stored */ }
    const blocks = req ? blocksOf(req) : null;
    return { seq: t.tickSeq, at: t.callEnvelope?.promptBuiltAt || t.capturedAt, slot: slotKey(t.capturedAt), outcome: t.model?.outcome, req, usage, blocks, reqBytes: blocks ? sum(blocks.map((b) => bytes(b.text))) : null, cacheControl: body?.request?.body?.includes('"cache_control"') ?? null };
  });
}

/** The cost of a battle's calls in order, with a 1-hour cache of `prefixShare` of each call's input when `cached`. */
export function costCalls(calls, price, { cached, prefixShareOf }) {
  let lastStart = null;
  let total = 0;
  for (const c of calls) {
    const I = c.I * price.tokenScale, O = c.O * price.tokenScale;
    const P = cached ? prefixShareOf(c) * I : 0;
    let inCost;
    if (!cached || P < price.minCache) inCost = I * price.in;
    else {
      const warm = lastStart !== null && Date.parse(c.at) - lastStart <= TTL_MS;
      inCost = P * (warm ? price.read : price.write1h) + (I - P) * price.in;
      lastStart = Date.parse(c.at); // a read refreshes the entry; its lifetime runs from the request's start
    }
    total += (inCost + O * price.out) / 1e6;
  }
  return total;
}

function main() {
  const flags = parseArgs(process.argv);
  const partB = JSON.parse(readFileSync(path.join(flags.in, 'results', 'partB.json'), 'utf8'));
  const keptB = new Map(partB.battles.map((b) => [b.label, b.checks]));
  const battles = [];
  let preTick = 0;
  for (const bundle of bundles(flags.in)) {
    if (!bundle.ticks.length) { preTick += (bundle.battle.evaluations || []).length; continue; }
    battles.push({ label: bundle.label, archetype: bundle.row.archetype, calls: callsOf(bundle) });
  }
  const all = battles.flatMap((b) => b.calls.map((c) => ({ ...c, label: b.label, archetype: b.archetype })));
  const stored = all.filter((c) => c.usage);
  const tpb = median(stored.map((c) => c.usage.input_tokens / c.reqBytes));
  const medOut = median(stored.map((c) => c.usage.output_tokens));
  for (const c of all) { c.estimated = !c.usage; c.I = c.usage ? c.usage.input_tokens : Math.round(c.reqBytes * tpb); c.O = c.usage ? c.usage.output_tokens : medOut; }
  for (const b of battles) for (const c of b.calls) Object.assign(c, all.find((x) => x.label === b.label && x.seq === c.seq));

  console.log(`## Part C — ${all.length} model calls in ${battles.length} battle-days with tick rows (Haiku 4.5: ${JSON.stringify(tally(all, (c) => c.req?.model))})`);
  console.log(`Earlier battles (no tick rows): ${preTick} stored evaluations with neither the request nor the usage stored — not costed.`);
  console.log(`Usage stored for ${pct(stored.length, all.length)}; estimated for ${all.length - stored.length} (outcomes: ${JSON.stringify(tally(all.filter((c) => c.estimated), (c) => c.outcome))}). Estimate: ${round2(tpb * 1000)} input tokens per 1,000 request bytes; output ${medOut} (median).\n`);

  console.log('### 1. Tokens per call (ESTIMATES included for the calls without stored usage)\n');
  const stat = (f) => ({ median: median(all.map(f)), mean: mean(all.map(f)), max: Math.max(...all.map(f)), total: sum(all.map(f)) });
  console.log(mdTable([['Input', (c) => c.I], ['Output', (c) => c.O], ['Cache read', (c) => c.usage?.cache_read_input_tokens || 0], ['Cache write', (c) => c.usage?.cache_creation_input_tokens || 0]].map(([k, f]) => ({ k, ...stat(f) })), [['Tokens', (r) => r.k], ['Median', (r) => r.median], ['Mean', (r) => r.mean], ['Max', (r) => r.max], ['Total', (r) => r.total]]));
  console.log(`\n### 2. cache_control on the request today: ${all.filter((c) => c.cacheControl).length} of ${all.length} requests carry it.\n`);

  console.log('### 3. Size map (share of the request\'s text, mean over requests)\n');
  const shares = {};
  const named = {};
  for (const c of all.filter((x) => x.blocks)) {
    for (const p of c.blocks.flatMap((b) => b.parts)) {
      shares[p.cat] = (shares[p.cat] || 0) + bytes(p.text) / c.reqBytes;
      const n = `${p.cat === 'per-check context' ? 'context' : p.cat} › ${p.name}`;
      named[n] = named[n] || { n: 0, share: 0 }; named[n].n++; named[n].share += bytes(p.text) / c.reqBytes;
    }
  }
  const nReq = all.filter((x) => x.blocks).length;
  console.log(mdTable(Object.entries(shares).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v: v / nReq })), [['Part', (r) => r.k], ['Mean share', (r) => `${round2(100 * r.v)}%`], ['≈ tokens per call (by byte share)', (r) => Math.round(r.v * mean(all.map((c) => c.I)))]]));
  console.log('\nLargest named sections:', Object.entries(named).sort((a, b) => b[1].share - a[1].share).slice(0, 12).map(([k, v]) => `${k} ${round2((100 * v.share) / nReq)}% (in ${v.n})`).join('; '));

  console.log('\n### 4. The repeating prefix (cache order: tools → system → messages)\n');
  const pairs = { consecutive: [], sameRun: [], sameArchetype: [] };
  for (const b of battles) for (let i = 1; i < b.calls.length; i++) if (b.calls[i].blocks && b.calls[i - 1].blocks) pairs.consecutive.push(commonPrefix(b.calls[i - 1].blocks, b.calls[i].blocks));
  const firsts = battles.map((b) => ({ b, c: b.calls.find((c) => c.blocks) })).filter((x) => x.c);
  for (let i = 0; i < battles.length; i++) for (let j = i + 1; j < battles.length; j++) {
    for (const ci of battles[i].calls) { const cj = battles[j].calls.find((x) => x.slot === ci.slot); if (cj && ci.blocks && cj.blocks) pairs.sameRun.push(commonPrefix(ci.blocks, cj.blocks)); }
  }
  for (let i = 0; i < firsts.length; i++) for (let j = i + 1; j < firsts.length; j++) if (firsts[i].b.archetype === firsts[j].b.archetype) pairs.sameArchetype.push(commonPrefix(firsts[i].c.blocks, firsts[j].c.blocks));
  const total = median(all.filter((c) => c.blocks).map((c) => c.reqBytes));
  console.log(mdTable(Object.entries(pairs).map(([k, ps]) => ({ k, n: ps.length, common: median(ps.map((p) => p.common)), aligned: median(ps.map((p) => p.aligned)), where: Object.entries(tally(ps, (p) => p.firstDiff)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, n]) => `${w} (${n})`).join('; ') })), [['Between', (r) => r.k], ['Pairs', (r) => r.n], ['Median common prefix', (r) => `${round2((100 * r.common) / total)}%`], ['Block-aligned (cacheable today)', (r) => `${round2((100 * r.aligned) / total)}%`], ['First changing byte, most common', (r) => r.where]]));

  // The prefix moved first: per battle, the parts whose text is identical on every call.
  const ideal = new Map();
  for (const b of battles) {
    const withBlocks = b.calls.filter((c) => c.blocks);
    const key = (p, blk) => `${blk}|${p.name}`;
    const texts = new Map();
    for (const c of withBlocks) for (const blk of c.blocks.slice(0, -1)) for (const p of blk.parts) { const k = key(p, blk.block); if (!texts.has(k)) texts.set(k, new Set()); texts.get(k).add(p.text); }
    for (const c of withBlocks) {
      const same = c.blocks.slice(0, -1).flatMap((blk) => blk.parts.filter((p) => texts.get(key(p, blk.block)).size === 1 && withBlocks.every((o) => o.blocks.some((ob) => ob.block === blk.block && ob.parts.some((op) => op.name === p.name)))));
      ideal.set(`${b.label}#${c.seq}`, sum(same.map((p) => bytes(p.text))) / c.reqBytes);
    }
  }
  const idealOf = (c) => ideal.get(`${c.label}#${c.seq}`) ?? median([...ideal.values()]);
  console.log(`\nMoved first: the parts identical on every call of the battle make up a median ${round2(100 * median([...ideal.values()]))}% of a request (within one battle).`);

  console.log('\n### 5. Cost (list prices per million tokens, 15 Nov 2026)\n');
  const scenarios = (calls, nDays) => ['Haiku 4.5', 'Haiku 5.5'].flatMap((model) => [false, true].map((cached) => {
    const t = sum(battles.map((b) => costCalls(calls.filter((c) => c.label === b.label), PRICES[model], { cached, prefixShareOf: idealOf })));
    return { row: `${model} ${cached ? 'with the repeating prefix first, cached 1 h' : 'as sent today'}`, calls: calls.length, perCall: t / calls.length, perDay: t / nDays, total: t };
  }));
  const costCols = [['Row', (r) => r.row], ['Calls', (r) => r.calls], ['$ per call', (r) => r.perCall.toFixed(5)], ['$ per battle-day', (r) => r.perDay.toFixed(4)], ['$ total', (r) => r.total.toFixed(3)]];
  console.log(`Today (${all.filter((c) => c.estimated).length} of ${all.length} calls ESTIMATED):\n`);
  console.log(mdTable(scenarios(all, battles.length), costCols));
  // Part B's schedule at X = 0.5, the gate still deciding at scheduled checks.
  const sched = [];
  let extra = 0;
  for (const b of battles) {
    const checks = new Map((keptB.get(b.label) || []).map((c) => [c.seq, c]));
    const meanI = mean(b.calls.map((c) => c.I)), meanO = mean(b.calls.map((c) => c.O));
    for (const [seq, k] of checks) {
      const call = b.calls.find((c) => c.seq === seq);
      if (k.scheduled && call) sched.push(call);
      else if (!k.scheduled && k.caught?.['0.5']) {
        if (call) sched.push(call);
        else { extra++; sched.push({ label: b.label, seq, I: meanI, O: meanO, estimated: true, at: k.at }); }
      }
    }
  }
  sched.sort((a, b) => a.label.localeCompare(b.label) || a.seq - b.seq);
  console.log(`\nUnder Part B's schedule at X = 0.5 (gate still decides at scheduled checks; ${extra} event checks where no model ran today use the battle's mean tokens — ESTIMATED; ${sched.filter((c) => c.estimated).length} of ${sched.length} calls estimated):\n`);
  console.log(mdTable(scenarios(sched, battles.length), costCols));
  console.log(`\nHaiku 5.5 price band: largest scaled prompt ${Math.round(Math.max(...all.map((c) => c.I)) * PRICES['Haiku 5.5'].tokenScale)} tokens (ceiling of the lower band: 100,000).`);
  writeResult(flags.in, 'partC.json', { pairs: Object.fromEntries(Object.entries(pairs).map(([k, ps]) => [k, ps.length])), today: scenarios(all, battles.length), schedule: scenarios(sched, battles.length) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
