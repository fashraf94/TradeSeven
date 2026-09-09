// src/components/Agent/deriveChatMessages.research.test.js
//
// Phase C §3 — the research exchange, as the chat's derivation sees it: one
// agent-side item carrying the SERVER's card, no user half invented for it, and
// no kind eyebrow (the card wears its own).

import { describe, it, expect } from 'vitest';
import { deriveChatMessages } from './deriveChatMessages';
import { BATTLE_VIEW_COPY } from '../../screens/battleView/battleViewCopy';
import { messageNamesSymbol } from '../../screens/battleView/scopeTape';

const CARD = { symbol: 'MPC', eyebrow: 'Research', platformDataLabel: 'Platform data · not what the check saw' };
const RESEARCH = {
  messageType: 'research',
  symbol: 'MPC',
  card: CARD,
  agentResponse: '',
  suggestedActions: null,
  timestamp: '2026-09-09T14:00:00.000Z',
};

describe('the derivation', () => {
  const items = deriveChatMessages([{ messageType: 'user_initiated', userMessage: 'hi', agentResponse: 'hey' }, RESEARCH]);

  it('emits ONE item for the research exchange — no user bubble is invented', () => {
    const research = items.filter((m) => m._research);
    expect(research).toHaveLength(1);
    expect(research[0].role).toBe('agent');
    expect(items.filter((m) => m.role === 'user')).toHaveLength(1); // the typed one only
  });

  it('carries the SERVER’s card object, not a recomposition of it', () => {
    expect(items.at(-1)._research).toBe(CARD);
    expect(items.at(-1)._researchSymbol).toBe('MPC');
  });

  it('is not grounded and did not run the gate — so no status line can attach', () => {
    const item = items.at(-1);
    expect(item._grounded).toBe(false);
    expect(item._gateRan).toBe(false);
  });

  it('leaves every other exchange without a card (the agent half of the typed turn)', () => {
    const ordinary = items.find((m) => m.role === 'agent' && m.text === 'hey');
    expect(ordinary._research).toBeNull();
    expect(ordinary._researchSymbol).toBeNull();
  });
});

describe('the kind eyebrow', () => {
  it('is NULL for research — the card carries its own (the auto_debrief rule)', () => {
    expect(BATTLE_VIEW_COPY.tapeKindEyebrow('research', false, null, false)).toBeNull();
    expect(BATTLE_VIEW_COPY.tapeKindEyebrow('research', true, null, true)).toBeNull();
  });

  it('the other kinds are untouched', () => {
    expect(BATTLE_VIEW_COPY.tapeKindEyebrow('first_message', false)).toBe('Opener');
    expect(BATTLE_VIEW_COPY.tapeKindEyebrow('trade_narration', false)).toBe('Trade note');
    expect(BATTLE_VIEW_COPY.tapeKindEyebrow('user_initiated', true)).toBe('Reply');
  });
});

describe('the scope', () => {
  const roster = new Set(['MPC', 'NVDA']);

  it('a research card is about ITS OWN piece, from the record — its text is empty', () => {
    const item = { _type: 'message', text: '', _researchSymbol: 'MPC' };
    expect(messageNamesSymbol(item, 'MPC', roster)).toBe(true);
    expect(messageNamesSymbol(item, 'NVDA', roster)).toBe(false);
  });

  it('an ordinary message is still scoped by the detector, unchanged', () => {
    const item = { _type: 'message', text: 'what about NVDA', _researchSymbol: null };
    expect(messageNamesSymbol(item, 'NVDA', roster)).toBe(true);
    expect(messageNamesSymbol(item, 'MPC', roster)).toBe(false);
  });
});
