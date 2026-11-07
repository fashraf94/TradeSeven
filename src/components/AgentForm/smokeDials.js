// src/components/AgentForm/smokeDials.js
//
// SMOKE ONLY (claude/armory-a1-smoke, NEVER MERGE): the founder's four dials for the A1 fix pass's design changes (D-A,
// D-B, D-C), read once from the page's address. A value outside its range, or none, is the PR's shipped value.
//   ?heroPx=      180–280  the phone hub's bare hero box, at every width (the PR: 250 from 375 px of hub width, 245 below)
//   ?core=        0.5–1.0  the core's light at its source, a fraction of today's (the PR: 0.6; on screen 0.6 is about 26 %
//                          darker than today, 0.75 about 15 %, 1.0 today's, because today's centre is blown out past white)
//   ?breathDepth= 0–0.3    how far the breath dips below the core's level (the PR: 0.15)
//   ?breathS=     2–8      the breath's cycle, in seconds (the PR: 4.5)
// The hub hero's corner readout shows the values in use (smokeDialsLine); a * marks each one the address set.

const PR = Object.freeze({ heroPx: null, core: 0.6, breathDepth: 0.15, breathS: 4.5 });
const RANGES = Object.freeze({ heroPx: [180, 280], core: [0.5, 1], breathDepth: [0, 0.3], breathS: [2, 8] });

function read() {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const out = { ...PR }, set = [];
  for (const [name, [lo, hi]] of Object.entries(RANGES)) {
    const raw = q.get(name);
    if (raw === null || raw.trim() === '') continue;
    const v = Number(raw);
    if (Number.isFinite(v) && v >= lo && v <= hi) { out[name] = v; set.push(name); }
  }
  return Object.freeze({ ...out, set: Object.freeze(set) });
}

export const SMOKE_DIALS = read();

/** The readout's line: the values in use (the hero's box as drawn now), a * on each the address set. */
export function smokeDialsLine(heroSize) {
  const d = SMOKE_DIALS, mark = (k) => (d.set.includes(k) ? '*' : '');
  return `dials · hero ${heroSize}px${mark('heroPx')} · core ${d.core}${mark('core')} · depth ${d.breathDepth}${mark('breathDepth')} · breath ${d.breathS}s${mark('breathS')}`;
}
