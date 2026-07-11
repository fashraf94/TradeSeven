// Test #2 — Warmup guard (A6): no bar dated ≥ studyStart is tagged warmup; no warmup bar
// leaks into the study-window selector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { selectStudyWindow } from '../lib/normalize.js';
import { PROBE, loadDaily } from './_helpers.js';

const START = CONFIG.range.studyStart; // 2023-07-10

for (const sym of PROBE) {
  test(`warmup guard: ${sym} tags agree with studyStart; selector leaks no warmup bar`, () => {
    const daily = loadDaily(sym);
    for (const b of daily) {
      assert.equal(b.warmup, b.date < START, `${sym} ${b.date}: warmup=${b.warmup}, date<start=${b.date < START}`);
    }
    assert.equal(daily.filter((b) => b.date >= START && b.warmup).length, 0, `${sym}: a bar ≥ ${START} is tagged warmup`);

    const win = selectStudyWindow(daily);
    assert.equal(win.filter((b) => b.warmup).length, 0, `${sym}: warmup bar leaked into study-window selection`);
    assert.ok(win.every((b) => b.date >= START), `${sym}: selector returned a pre-study bar`);
    assert.ok(win.length > 0, `${sym}: empty study window`);
    // and there IS a warmup segment (all probe symbols listed pre-2021)
    assert.ok(daily.some((b) => b.warmup), `${sym}: no warmup bars at all`);
  });
}
