// @vitest-environment jsdom
//
// src/screens/AgentFormLab.jsdom.test.jsx
//
// Build S0 — the lab page's controls (the readout's numbers are agentFormLabReadout.test.js; real frames are
// measured headless in the build report). jsdom has no WebGL, so every view is its still here: these rows
// prove the four founder presets, the per-view forms and allegiance, the direct path's one-view rule, and
// the "Copy reading" line.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentFormLab from './AgentFormLab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); act(() => root.render(<AgentFormLab />)); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

const views = () => [...host.querySelectorAll('[data-agent-form]')];
const button = (text) => [...host.querySelectorAll('button')].find((b) => b.textContent === text);
const select = (label) => [...host.querySelectorAll('label')].find((l) => l.textContent.startsWith(label)).querySelector('select');
const choose = (label, value) => act(() => { const s = select(label); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, value); s.dispatchEvent(new Event('change', { bubbles: true })); });
const click = (text) => act(() => { button(text).click(); });
const sizes = () => views().map((v) => v.style.width);

describe('the agent form lab', () => {
  it('opens on one hero at 200, the readout on top, every control present', () => {
    expect(host.querySelector('[data-agent-form-readout]')).not.toBeNull();
    expect(sizes()).toEqual(['200px']);
    for (const l of ['Views', 'Size (px)', 'Form', 'Forms across views', 'Mood', 'Core stage', 'Armor stage', 'Allegiance', 'Draw path', 'Plates', 'Bloom', 'Rate', 'Reduced motion']) expect(select(l), l).toBeTruthy();
    for (const b of ['Copy reading', 'Reset readout', 'Play unequip', 'Play equip', 'Lose context (1.5 s)']) expect(button(b), b).toBeTruthy();
  });

  it('the four founder presets: 1 at 200; 2 at 230; 7 at 72 + 1 at 190; 12 at 40', () => {
    click('2 at 230'); expect(sizes()).toEqual(['230px', '230px']);
    click('7 at 72 + 1 at 190'); expect(sizes()).toEqual(['190px', ...Array(7).fill('72px')]);
    click('12 at 40'); expect(sizes()).toEqual(Array(12).fill('40px'));
    click('1 hero at 200'); expect(sizes()).toEqual(['200px']);
  });

  it('the battle preset puts the opponent (copper, mirrored) beside the player; the armory preset shows all seven forms', () => {
    click('2 at 230');
    expect(views().map((v) => v.getAttribute('aria-label'))).toEqual(['Shadow, armored — idle', 'Shadow, armored — idle']);
    expect(views()[1].querySelector('stop').style.stopColor).toBe('var(--ft-agent-copper-core)');
    expect(views()[0].querySelector('stop').style.stopColor).toBe('var(--ft-agent-teal-core)');
    click('7 at 72 + 1 at 190');
    const labels = views().map((v) => v.getAttribute('aria-label'));
    expect(labels.filter((l) => l.startsWith('Shadow, unarmored'))).toHaveLength(1); // bare Shadow is one of the seven
  });

  it('the bloom preset shows the four glows side by side, captioned; the Bloom control returns every view to one glow', () => {
    click('4 blooms side by side');
    expect(sizes()).toEqual(Array(4).fill('180px'));
    expect([...host.querySelectorAll('[data-agent-form-caption]')].map((c) => c.textContent)).toEqual(['canvas filter (design)', 'CSS-blurred overlay', 'WebGL', 'off']);
    choose('Bloom', 'css');
    expect(host.querySelectorAll('[data-agent-form-caption]')).toHaveLength(0);
  });

  it('views and size make a custom layout; the direct path is offered for one view only', () => {
    choose('Views', '5'); choose('Size (px)', '112');
    expect(sizes()).toEqual(Array(5).fill('112px'));
    expect(select('Draw path').disabled).toBe(true);
    choose('Views', '1'); expect(select('Draw path').disabled).toBe(false);
    choose('Draw path', 'direct');
    expect(views()[0].getAttribute('data-agent-form-path')).toBe('direct');
    click('2 at 230');
    expect(views().every((v) => v.getAttribute('data-agent-form-path') === 'shared')).toBe(true);
  });

  it('play unequip / equip flip the one control the views read', () => {
    expect(button('Play equip').disabled).toBe(true);
    click('Play unequip');
    expect(button('Play unequip').disabled).toBe(true);
    expect(button('Play equip').disabled).toBe(false);
  });

  it('Copy reading names the side-by-side preset', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    click('4 blooms side by side');
    await act(async () => { button('Copy reading').click(); await Promise.resolve(); });
    expect(writeText.mock.calls[0][0]).toContain('preset blooms · views 4× 180 px');
    expect(writeText.mock.calls[0][0]).toContain('bloom side by side (filter/css/webgl/off)');
  });

  it('Copy reading: one plain-text line with every setting and number, to the clipboard and on the page', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    choose('Mood', 'worried'); choose('Bloom', 'css'); choose('Rate', 'half'); choose('Plates', 'on');
    await act(async () => { button('Copy reading').click(); await Promise.resolve(); });
    const line = writeText.mock.calls[0][0];
    expect(line.includes('\n')).toBe(false);
    for (const part of ['AgentFormLab S0', 'preset hero200', 'views 1× 200 px', 'form trend', 'mood worried', 'core 1', 'armor 1', 'allegiance player', 'path shared', 'batched on', 'bloom css', 'rate half', 'reduced motion off', 'last second:', '60 s window:', '5 min window:', 'late > 50 ms', 'multiDraw', 'lost 0 restored 0', 'dpr', 'viewport', 'ua ']) expect(line, part).toContain(part);
    expect(host.querySelector('textarea').value).toBe(line);
  });
});

void React;
