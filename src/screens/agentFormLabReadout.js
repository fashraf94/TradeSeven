// src/screens/agentFormLabReadout.js
//
// The agent form lab's readout lines (src/screens/AgentFormLab.jsx), in the S7 smoke readout's exact format
// (docs/audits/20261025_BUILD_COMMAND_CENTER_HUB_S7.md §13). Pure: samples in, text out.

/** S7's line over the samples inside `windowMs`, with hidden-page and stopped-loop gaps left out. */
export function readoutLine(samples, now, windowMs, lateMs) {
  const inWin = samples.filter((x) => now - x.t <= windowMs);
  let frames = 0, spanMs = 0, late = 0;
  for (let i = 1; i < inWin.length; i += 1) {
    if (inWin[i].resumed) continue;
    const gap = inWin[i].t - inWin[i - 1].t;
    frames += 1; spanMs += gap; if (gap > lateMs) late += 1;
  }
  if (frames < 1 || spanMs <= 0) return { text: 'collecting…', fps: null };
  const costs = inWin.map((x) => x.cost).sort((a, b) => a - b), n = costs.length;
  const avg = costs.reduce((a, b) => a + b, 0) / n, p95 = costs[Math.min(n - 1, Math.floor(n * 0.95))];
  const win = Math.min(spanMs / 1000, windowMs / 1000).toFixed(0), fps = frames / (spanMs / 1000);
  return { text: `${win} s: ${fps.toFixed(1)} fps · avg ${avg.toFixed(2)} · p95 ${p95.toFixed(2)} ms · late ${((late / frames) * 100).toFixed(1)}%`, fps };
}

/** S7's first line: the frames and the mean cost of the last second. */
export function lastSecondLine(samples, now) {
  const last1 = samples.filter((x) => now - x.t <= 1000);
  return `fps ${last1.length} · cost ${(last1.reduce((a, x) => a + x.cost, 0) / Math.max(1, last1.length)).toFixed(2)} ms`;
}
