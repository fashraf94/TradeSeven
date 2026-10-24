// @vitest-environment jsdom
//
// Independent review of slice S2b (Fable, 2026-10-23) — the flag-off probe. Today's
// shells render this surface with the hub flag false. The brief's exit criterion 4
// admits exactly two flag-off changes (R-S2b-9a, R-S2b-9b); this row pins the
// confirmed-refusal words of the merge base and is run on BOTH trees.
//
// Committed from the review's appendix B (docs/audits/20261023_FABLE_REVIEW_S2B_PROVIDER.md)
// with its expectations set to the ruled words: the founder waived FRB-1, because
// rulings Q-S2b-2 and RL-1 extend R-S2b-9b. Before (the merge base): "Deployment
// failed — no battle was created." under the eyebrow "Deployment failed"; after:
// "Deployment refused" in both.

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CeremonyError from './CeremonyError';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

function render(props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CeremonyError accent="#4ea8de" agentName="Nova" onDismiss={() => {}} {...props} />); });
  return container.textContent;
}

describe('flag off — the confirmed refusal surface, as the founder ruled (Q-S2b-2, RL-1; FRB-1 waived)', () => {
  it('eyebrow and generic headline: the ruled words', () => {
    const t = render({ errorTone: 'confirmed', errorKind: 'deploy' });
    expect(t).toContain('Deployment refused — no battle was created.');
    expect(t).toContain('Deployment refused');
    expect(t).not.toContain('Deployment failed');
  });
  it('the server kind too', () => {
    const t = render({ errorTone: 'confirmed', errorKind: 'server' });
    expect(t).toContain('Deployment refused — no battle was created.');
  });
});
