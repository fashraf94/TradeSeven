// @vitest-environment jsdom
//
// src/components/shared/AnimatedScore.instant.test.jsx
//
// Shadow vs CPU quote integrity (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
// §5.3 A-1/A-2, V-1, C-1 item 5, B-11; OFF-AS, ON-AS; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// OFF-AS — default-prop parity, frame by frame. Every consumer's exact prop
// shape (ArenaHeader :228/:289, the legacy ScoreHeader :329/:383-387, the
// dashboard card's points and `suffix="%"` forms) is driven through mount,
// change, a mid-ramp change (the overlap), a sub-0.01 change and a small
// negative, with fake timers stepping one animation frame at a time; each
// frame records text, colour, glow, transform and transition. The sequences
// were captured at the pre-build SHA (SHADOW_OFF_CAPTURE_DIR) and are asserted
// here run-length encoded. `instant` and `fractionDigits` absent = today.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import AnimatedScore from './AnimatedScore.jsx';

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `animatedScore.${name}.json`), JSON.stringify(actual));
    return;
  }
  expect(actual).toEqual(expected);
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  // `now` at INSTALL, not setSystemTime: the fake animation-frame clock aligns
  // its 16 ms frames to the install instant, so a real-clock install makes the
  // frame phase (and every captured sequence) vary run to run.
  vi.useFakeTimers({ now: new Date('2026-10-01T15:00:00.000Z') });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container.remove();
  vi.useRealTimers();
});

const FRAME_MS = 16;
const span = () => container.querySelector('span');
const frameOf = () => {
  const s = span();
  return [s.textContent, s.style.color, s.style.textShadow, s.style.transform, s.style.transition].join(' | ');
};
const render = (props) => act(() => { root.render(<AnimatedScore {...props} />); });
/** Step `ms` of frames, recording the DOM after the render and after every frame. */
function frames(ms) {
  const out = [frameOf()];
  for (let t = 0; t < ms; t += FRAME_MS) {
    act(() => { vi.advanceTimersByTime(FRAME_MS); });
    out.push(frameOf());
  }
  return out;
}
/** Run-length encode consecutive identical frames: [[frame, count], …]. */
const rle = (list) => list.reduce((acc, f) => {
  const last = acc[acc.length - 1];
  if (last && last[0] === f) last[1] += 1; else acc.push([f, 1]);
  return acc;
}, []);

/** One consumer's whole default-prop sequence. */
function sequence(base, values) {
  const [a, b, c, d, tiny, neg] = values;
  const out = {};
  render({ ...base, value: a });
  out.mount = rle(frames(1100));
  render({ ...base, value: b });
  out.change = rle(frames(1000));
  render({ ...base, value: c });
  const overlapHead = frames(200);
  render({ ...base, value: d });
  out.overlap = rle([...overlapHead, ...frames(1200)]);
  render({ ...base, value: tiny });
  out.tiny = rle(frames(200));
  render({ ...base, value: neg });
  out.negative = rle(frames(1000));
  return out;
}

// Each consumer's exact prop shape, as the call sites write them.
const CONSUMERS = {
  arenaPlayer: { base: { defaultColor: 'var(--ft-teal)', size: 30 }, values: [12, 15, 30, 45, 45.004, -0.3] },
  arenaCpu: { base: { defaultColor: 'var(--ft-copper)', size: 40 }, values: [3, 1, -4, 8, 8.009, -0.4] },
  legacyPlayer: { base: { defaultColor: '#5eead4', size: 28 }, values: [12, 15, 30, 45, 45.004, -0.3] },
  legacyCpu: { base: { defaultColor: '#64748b', size: 28 }, values: [3, 1, -4, 8, 8.009, -0.4] },
  dashboardPoints: { base: { defaultColor: '#22c55e', size: 44, suffix: '' }, values: [12, 15, 30, 45, 45, -0] },
  dashboardPct: { base: { defaultColor: '#e2e8f0', size: 28, suffix: '%' }, values: [1.5, 2.3, -0.7, 3.1, 3.1, -0.2] },
};

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (8 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "arenaCpu": {
  "change": [
   [
    "+3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    9
   ],
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    39
   ],
   [
    "+1 | var(--ft-copper) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "mount": [
   [
    "+0 | var(--ft-copper) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+1 | var(--ft-copper) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    6
   ],
   [
    "+2 | var(--ft-copper) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    12
   ],
   [
    "+3 | var(--ft-copper) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    49
   ]
  ],
  "negative": [
   [
    "+8 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+7 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+6 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+5 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+4 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    31
   ],
   [
    "0 | var(--ft-copper) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "overlap": [
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "-1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "-2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "-3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "-3 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+3 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+4 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+5 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+6 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+7 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    6
   ],
   [
    "+8 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    19
   ],
   [
    "+8 | var(--ft-copper) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    38
   ]
  ],
  "tiny": [
   [
    "+8 | var(--ft-copper) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ]
  ]
 },
 "arenaPlayer": {
  "change": [
   [
    "+12 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+13 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    5
   ],
   [
    "+14 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    8
   ],
   [
    "+15 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    36
   ],
   [
    "+15 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "mount": [
   [
    "+0 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+3 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+4 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+5 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+6 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+7 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+8 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+9 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+10 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+11 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    8
   ],
   [
    "+12 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    39
   ]
  ],
  "negative": [
   [
    "+45 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+41 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+37 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+33 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+30 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+27 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+24 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+21 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+18 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+16 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+14 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+12 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+10 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+9 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+7 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+6 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+5 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+4 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    25
   ],
   [
    "0 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "overlap": [
   [
    "+15 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+16 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+18 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+19 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+20 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+21 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+22 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+23 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+24 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+25 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+26 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+27 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+18 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+20 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+23 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+25 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+27 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+29 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+31 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+33 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+34 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+36 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+37 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+38 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+39 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+40 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+41 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+42 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+43 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+44 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+45 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ],
   [
    "+45 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    38
   ]
  ],
  "tiny": [
   [
    "+45 | var(--ft-teal) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ]
  ]
 },
 "dashboardPct": {
  "change": [
   [
    "+1.5% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.6% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+1.7% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.8% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+1.9% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+2.0% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+2.1% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+2.2% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    5
   ],
   [
    "+2.3% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    32
   ],
   [
    "+2.3% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "mount": [
   [
    "+0.0% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.1% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.2% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.3% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.4% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.5% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+0.6% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.7% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.8% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+0.9% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+1.0% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+1.1% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+1.2% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+1.3% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+1.4% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    8
   ],
   [
    "+1.5% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    37
   ]
  ],
  "negative": [
   [
    "+3.1% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2.8% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2.5% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2.2% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2.0% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.8% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.5% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.3% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.2% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.0% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.8% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.7% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.6% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.5% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.4% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.3% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.2% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.1% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "-0.0% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "-0.1% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "-0.2% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    27
   ],
   [
    "-0.2% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "overlap": [
   [
    "+2.3% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2.0% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.8% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.5% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.3% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1.1% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.9% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.7% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.5% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.4% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.2% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.1% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+0.0% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "-0.1% | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "-0.1% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2.4% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+2.5% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2.6% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+2.7% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+2.8% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+2.9% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+3.0% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    5
   ],
   [
    "+3.1% | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    19
   ],
   [
    "+3.1% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    38
   ]
  ],
  "tiny": [
   [
    "+3.1% | rgb(226, 232, 240) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ]
  ]
 },
 "dashboardPoints": {
  "change": [
   [
    "+12 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+13 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    5
   ],
   [
    "+14 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    8
   ],
   [
    "+15 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    36
   ],
   [
    "+15 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "mount": [
   [
    "+0 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+3 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+4 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+5 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+6 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+7 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+8 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+9 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+10 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+11 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    8
   ],
   [
    "+12 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    39
   ]
  ],
  "negative": [
   [
    "+45 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+41 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+37 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+33 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+30 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+27 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+24 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+21 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+19 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+16 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+14 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+12 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+11 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+9 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+8 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+6 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+5 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+4 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    26
   ],
   [
    "+0 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "overlap": [
   [
    "+15 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+16 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+18 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+19 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+20 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+21 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+22 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+23 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+24 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+25 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+26 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+27 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+18 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+20 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+23 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+25 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+27 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+29 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+31 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+33 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+34 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+36 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+37 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+38 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+39 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+40 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+41 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+42 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+43 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+44 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+45 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ],
   [
    "+45 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    38
   ]
  ],
  "tiny": [
   [
    "+45 | rgb(34, 197, 94) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ]
  ]
 },
 "legacyCpu": {
  "change": [
   [
    "+3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    9
   ],
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    39
   ],
   [
    "+1 | rgb(100, 116, 139) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "mount": [
   [
    "+0 | rgb(100, 116, 139) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+1 | rgb(100, 116, 139) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    6
   ],
   [
    "+2 | rgb(100, 116, 139) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    12
   ],
   [
    "+3 | rgb(100, 116, 139) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    49
   ]
  ],
  "negative": [
   [
    "+8 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+7 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+6 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+5 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+4 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    31
   ],
   [
    "0 | rgb(100, 116, 139) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "overlap": [
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "-1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "-2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "-3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "-3 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+3 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+4 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+5 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+6 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+7 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    6
   ],
   [
    "+8 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    19
   ],
   [
    "+8 | rgb(100, 116, 139) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    38
   ]
  ],
  "tiny": [
   [
    "+8 | rgb(100, 116, 139) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ]
  ]
 },
 "legacyPlayer": {
  "change": [
   [
    "+12 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+13 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    5
   ],
   [
    "+14 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    8
   ],
   [
    "+15 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    36
   ],
   [
    "+15 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "mount": [
   [
    "+0 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+1 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+3 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+4 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+5 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+6 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+7 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+8 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+9 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+10 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+11 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    8
   ],
   [
    "+12 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    39
   ]
  ],
  "negative": [
   [
    "+45 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+41 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+37 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+33 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+30 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+27 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+24 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+21 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+18 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+16 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+14 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+12 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+10 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+9 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+7 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+6 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+5 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+4 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+3 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+2 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+1 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    3
   ],
   [
    "+0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "0 | rgb(239, 68, 68) | 0 0 16px #ef444499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    25
   ],
   [
    "0 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    13
   ]
  ],
  "overlap": [
   [
    "+15 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+16 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+18 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+19 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+20 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+21 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+22 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+23 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+24 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+25 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+26 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+27 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+18 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+20 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+23 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+25 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+27 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+29 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+31 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+33 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+34 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+36 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+37 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+38 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+39 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+40 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+41 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    1
   ],
   [
    "+42 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+43 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    2
   ],
   [
    "+44 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    4
   ],
   [
    "+45 | rgb(94, 234, 212) | 0 0 16px #5eead499 | scale(1.15) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ],
   [
    "+45 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    38
   ]
  ],
  "tiny": [
   [
    "+45 | rgb(94, 234, 212) | none | scale(1) | color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    14
   ]
  ]
 },
 "smallNegative": "0",
 "ssr": {
  "negative": "<span style=\"font-size:28px;font-weight:700;color:#5eead4;letter-spacing:-0.06em;line-height:1;font-variant-numeric:tabular-nums;display:inline-block;text-shadow:none;transition:color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);transform:scale(1)\">+0</span>",
  "pct": "<span style=\"font-size:28px;font-weight:700;color:#e2e8f0;letter-spacing:-0.06em;line-height:1;font-variant-numeric:tabular-nums;display:inline-block;text-shadow:none;transition:color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);transform:scale(1)\">+0.0<!-- -->%</span>",
  "points": "<span style=\"font-size:28px;font-weight:700;color:#5eead4;letter-spacing:-0.06em;line-height:1;font-variant-numeric:tabular-nums;display:inline-block;text-shadow:none;transition:color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);transform:scale(1)\">+0</span>"
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-AS — default-prop parity for every consumer, frame by frame', () => {
  for (const [name, { base, values }] of Object.entries(CONSUMERS)) {
    it(`OFF ${name}: mount count-up, change+flash, overlap, sub-0.01 skip, small negative`, () => {
      offReference(name, sequence(base, values), OFF[name]);
    });
  }

  it('OFF server-rendered first output is `+0` (the screen goldens rely on it)', () => {
    const html = {
      points: renderToString(<AnimatedScore value={12} defaultColor="#5eead4" size={28} />),
      pct: renderToString(<AnimatedScore value={2.3} defaultColor="#e2e8f0" size={28} suffix="%" />),
      negative: renderToString(<AnimatedScore value={-5} defaultColor="#5eead4" size={28} />),
    };
    offReference('ssr', html, OFF.ssr);
  });

  it('OFF legacy small-negative output is `0`, never `-0` (Math.round(-0.3) after the ramp)', () => {
    render({ value: -0.3, defaultColor: '#5eead4', size: 28 });
    act(() => { vi.advanceTimersByTime(1200); });
    offReference('smallNegative', span().textContent, OFF.smallNegative);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ON-AS — `instant` and `fractionDigits` (V-1, C-1 item 5, B-11).
//
// "First commit" is read by a layout-effect probe rendered AFTER the counter:
// layout effects run after the DOM is mutated and BEFORE any passive effect,
// so the probe sees exactly what the commit painted — an implementation that
// synced the target in an effect would show the old number (or +0) here.
// ─────────────────────────────────────────────────────────────────────────────

let committed;
let rafCount;
function Probe() {
  React.useLayoutEffect(() => {
    const s = container.querySelector('span');
    committed.push({ text: s.textContent, color: s.style.color, shadow: s.style.textShadow, transform: s.style.transform, transition: s.style.transition });
  });
  return null;
}
const renderP = (props) => act(() => {
  root.render(<><AnimatedScore defaultColor="#5eead4" size={28} {...props} /><Probe /></>);
});
const lastCommit = () => committed[committed.length - 1];
const REST = 'rgb(94, 234, 212)';

describe('ON-AS — instant mode', () => {
  beforeEach(() => {
    committed = [];
    rafCount = 0;
    const raf = globalThis.requestAnimationFrame;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { rafCount += 1; return raf(cb); });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('(1) instant on mount: the first commit shows the target; no count-up frame is ever scheduled', () => {
    renderP({ value: 12, instant: true });
    expect(committed[0].text).toBe('+12');
    expect(committed[0].transition).toBe('none');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(rafCount).toBe(0);
    expect(span().textContent).toBe('+12');
  });

  it('(2) instant mid-ramp AND mid-flash, with an OVERLAPPING older ramp: target in the first commit, everything cancelled', () => {
    renderP({ value: 10 });
    act(() => { vi.advanceTimersByTime(1000); });
    renderP({ value: 20 });
    act(() => { vi.advanceTimersByTime(100); });
    renderP({ value: 30 }); // a second loop starts; rafId now names only the newest
    act(() => { vi.advanceTimersByTime(100); });
    expect(span().style.textShadow).not.toBe('none'); // the flash is lit
    renderP({ value: 40, instant: true });
    expect(lastCommit()).toEqual({ text: '+40', color: REST, shadow: 'none', transform: 'scale(1)', transition: 'none' });
    // Instant clears with no value change: nothing the old loops would write may show.
    renderP({ value: 40 });
    for (let i = 0; i < 80; i++) {
      act(() => { vi.advanceTimersByTime(FRAME_MS); });
      expect(span().textContent, `frame ${i}`).toBe('+40');
      expect(span().style.textShadow, `frame ${i}`).toBe('none');
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('(2b) [B-11] instant with an UNCHANGED number (browser 10 → stored 10.00) still cancels the ramp and flash', () => {
    renderP({ value: 0 });
    act(() => { vi.advanceTimersByTime(1000); });
    renderP({ value: 10 });
    act(() => { vi.advanceTimersByTime(120); }); // mid-ramp, flash lit
    expect(span().textContent).not.toBe('+10');
    renderP({ value: 10, instant: true, fractionDigits: 2 });
    expect(lastCommit()).toEqual({ text: '+10.00', color: REST, shadow: 'none', transform: 'scale(1)', transition: 'none' });
    renderP({ value: 10, fractionDigits: 2 });
    for (let i = 0; i < 60; i++) {
      act(() => { vi.advanceTimersByTime(FRAME_MS); });
      expect(span().textContent, `frame ${i}`).toBe('+10.00');
    }
    expect(span().style.textShadow).toBe('none');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('(3) instant, then a NON-instant same-kind change: the ramp starts from the instant target', () => {
    renderP({ value: 10, instant: true });
    renderP({ value: 20 });
    act(() => { vi.advanceTimersByTime(FRAME_MS); });
    const first = Number(span().textContent);
    expect(first).toBeGreaterThanOrEqual(10);
    expect(first).toBeLessThan(20);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(span().textContent).toBe('+20');
  });

  it('(4) instant toggled off with no value change: no ramp, no frame', () => {
    renderP({ value: 10, instant: true });
    rafCount = 0;
    renderP({ value: 10 });
    act(() => { vi.advanceTimersByTime(600); });
    expect(rafCount).toBe(0);
    expect(span().textContent).toBe('+10');
  });

  it('a kind switch changes the digit format in the same commit (integer → two decimals → integer)', () => {
    renderP({ value: 12, instant: true });
    renderP({ value: 10.4, instant: true, fractionDigits: 2 });
    expect(lastCommit().text).toBe('+10.40');
    renderP({ value: 12, instant: true });
    expect(lastCommit().text).toBe('+12');
  });
});

describe('ON-AS (5) — fractionDigits={2}', () => {
  beforeEach(() => { committed = []; });

  it('formats two decimals and normalizes a rounded negative zero (+0.00, never -0.00)', () => {
    renderP({ value: 10.4, instant: true, fractionDigits: 2 });
    expect(span().textContent).toBe('+10.40');
    renderP({ value: -0.001, instant: true, fractionDigits: 2 });
    expect(span().textContent).toBe('+0.00');
    renderP({ value: -0, instant: true, fractionDigits: 2 });
    expect(span().textContent).toBe('+0.00');
    renderP({ value: -0.01, instant: true, fractionDigits: 2 });
    expect(span().textContent).toBe('-0.01');
  });

  it('the displayed-unit threshold keeps 0.03 → 0.02 → 0.03 (the raw < 0.01 test would drop them)', () => {
    expect(0.03 - 0.02 < 0.01).toBe(true); // the float fact the rule exists for
    renderP({ value: 0.03, instant: true, fractionDigits: 2 });
    renderP({ value: 0.02, fractionDigits: 2 });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(span().textContent).toBe('+0.02');
    renderP({ value: 0.03, fractionDigits: 2 });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(span().textContent).toBe('+0.03');
  });

  it('a same-kind two-decimal ramp shows two-decimal in-betweens and ends EXACTLY on the target', () => {
    renderP({ value: 10.2, instant: true, fractionDigits: 2 });
    renderP({ value: 10.4, fractionDigits: 2 });
    const seenTexts = new Set();
    for (let i = 0; i < 40; i++) {
      act(() => { vi.advanceTimersByTime(FRAME_MS); });
      seenTexts.add(span().textContent);
    }
    for (const t of seenTexts) expect(t).toMatch(/^\+10\.\d{2}$/);
    expect([...seenTexts].some((t) => t !== '+10.20' && t !== '+10.40')).toBe(true);
    expect(span().textContent).toBe('+10.40');
  });

  it('absent fractionDigits keeps the legacy sub-0.01 skip and integer format (OFF-AS above pins every frame)', () => {
    renderP({ value: 10, instant: true });
    renderP({ value: 10.004 });
    act(() => { vi.advanceTimersByTime(600); });
    expect(span().textContent).toBe('+10');
  });
});
