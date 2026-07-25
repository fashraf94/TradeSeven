// api/_utils/wireMetrics.test.js
// Metrics sink acceptance (V1.5 §4.8 F2-5; V1.6 A5 / r2 m5): bounded
// samples with a population-honest sampledCount, failure containment, and
// input guards. The cap test seeds a doc AT the cap rather than looping 500
// transactions — the guard under test reads the stored length, so the seam
// is identical.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFirestoreFake } from './__fixtures__/wireFirestoreFake.js';
import { recordWireSample, METRIC_SAMPLE_CAP } from './wireMetrics.js';
import { WIRE_METRICS_COLLECTION } from './wireContracts.js';

const DATE = '2026-07-24';

let db;
beforeEach(() => {
  db = createFirestoreFake();
});

const metricDoc = async () =>
  (await db.collection(WIRE_METRICS_COLLECTION).doc(DATE).get()).data();

describe('recording', () => {
  it('first sample creates the day doc with count/totalMs/samples/sampledCount in lockstep', async () => {
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'generate_publish', ms: 812.6, marketDate: DATE });
    const m = (await metricDoc()).seams.kai_pulse.generate_publish;
    expect(m.count).toBe(1);
    expect(m.totalMs).toBe(813); // rounded
    expect(m.samples).toEqual([813]);
    expect(m.sampledCount).toBe(1);
  });

  it('samples accumulate per seam+metric without cross-talk', async () => {
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'generate_publish', ms: 100, marketDate: DATE });
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'generate_publish', ms: 200, marketDate: DATE });
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'wire_path', ms: 7, marketDate: DATE });
    await recordWireSample(db, { seam: 'doug_earnings_preview', metric: 'batch_submit', ms: 40, marketDate: DATE });

    const seams = (await metricDoc()).seams;
    expect(seams.kai_pulse.generate_publish).toMatchObject({ count: 2, totalMs: 300, samples: [100, 200], sampledCount: 2 });
    expect(seams.kai_pulse.wire_path).toMatchObject({ count: 1, samples: [7] });
    expect(seams.doug_earnings_preview.batch_submit).toMatchObject({ count: 1, samples: [40] });
  });

  it('days are separate documents', async () => {
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'wire_path', ms: 5, marketDate: '2026-07-23' });
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'wire_path', ms: 6, marketDate: DATE });
    expect((await db.collection(WIRE_METRICS_COLLECTION).doc('2026-07-23').get()).data().seams.kai_pulse.wire_path.count).toBe(1);
    expect((await metricDoc()).seams.kai_pulse.wire_path.count).toBe(1);
  });
});

describe('the sample cap (F2-5) + population honesty (§9 display-agreement)', () => {
  it('past the cap: count/totalMs keep growing, samples[] and sampledCount freeze', async () => {
    // Seed a seam AT the cap.
    await db.collection(WIRE_METRICS_COLLECTION).doc(DATE).set({
      date: DATE,
      seams: {
        kai_pulse: {
          generate_publish: {
            count: METRIC_SAMPLE_CAP,
            totalMs: METRIC_SAMPLE_CAP, // 1ms each
            sampledCount: METRIC_SAMPLE_CAP,
            samples: Array(METRIC_SAMPLE_CAP).fill(1),
          },
        },
      },
    });

    await recordWireSample(db, { seam: 'kai_pulse', metric: 'generate_publish', ms: 999, marketDate: DATE });

    const m = (await metricDoc()).seams.kai_pulse.generate_publish;
    expect(m.count).toBe(METRIC_SAMPLE_CAP + 1);           // the call is counted…
    expect(m.totalMs).toBe(METRIC_SAMPLE_CAP + 999);       // …and its duration
    expect(m.samples).toHaveLength(METRIC_SAMPLE_CAP);     // …but not sampled
    expect(m.samples).not.toContain(999);
    expect(m.sampledCount).toBe(METRIC_SAMPLE_CAP);        // population label stays true
  });

  it('one below the cap still samples — the boundary is exact', async () => {
    await db.collection(WIRE_METRICS_COLLECTION).doc(DATE).set({
      date: DATE,
      seams: {
        kai_pulse: {
          generate_publish: {
            count: METRIC_SAMPLE_CAP - 1,
            totalMs: METRIC_SAMPLE_CAP - 1,
            sampledCount: METRIC_SAMPLE_CAP - 1,
            samples: Array(METRIC_SAMPLE_CAP - 1).fill(1),
          },
        },
      },
    });

    await recordWireSample(db, { seam: 'kai_pulse', metric: 'generate_publish', ms: 42, marketDate: DATE });

    const m = (await metricDoc()).seams.kai_pulse.generate_publish;
    expect(m.samples).toHaveLength(METRIC_SAMPLE_CAP);
    expect(m.samples[METRIC_SAMPLE_CAP - 1]).toBe(42);
    expect(m.sampledCount).toBe(METRIC_SAMPLE_CAP);
  });
});

describe('containment + input guards', () => {
  it('a transaction failure NEVER propagates to the caller — logged, resolved', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.runTransaction = async () => { throw new Error('UNAVAILABLE'); };
    await expect(
      recordWireSample(db, { seam: 'kai_pulse', metric: 'wire_path', ms: 5, marketDate: DATE })
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('garbage input writes nothing at all', async () => {
    await recordWireSample(db, { seam: '', metric: 'wire_path', ms: 5, marketDate: DATE });
    await recordWireSample(db, { seam: 'kai_pulse', metric: '', ms: 5, marketDate: DATE });
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'wire_path', ms: NaN, marketDate: DATE });
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'wire_path', ms: Infinity, marketDate: DATE });
    await recordWireSample(db, { seam: 'kai_pulse', metric: 'wire_path', ms: 5, marketDate: '' });
    expect(await metricDoc()).toBeUndefined();
  });
});
