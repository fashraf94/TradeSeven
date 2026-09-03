// @vitest-environment jsdom
//
// src/screens/battleView/ChatSheet.motion.jsdom.test.jsx
//
// Phase A (A4) — what the sheet hands framer: the height tweens through the
// `smooth` token on a DETENT change, re-sizes through `instant` on a viewport
// change (the sheet moves when the player moves it — review L1-F9), is
// `instant` under reduced motion (L4-M54), and the grabber's release physics
// is the `gesture` spring in framer's `dragTransition` shape (L2-F7). framer's
// motion elements are stubbed so the props are observable; the DOM
// behaviour is in AgentBattleScreen.layout.jsdom.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const seen = vi.hoisted(() => ({ section: [], grabber: [] }));
const MOTION_PROPS = ['initial', 'animate', 'transition', 'drag', 'dragConstraints', 'dragElastic', 'dragMomentum', 'onDragEnd', 'dragTransition'];
const domProps = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !MOTION_PROPS.includes(k)));
vi.mock('framer-motion', () => ({
  motion: {
    section: React.forwardRef(function SectionStub(props, ref) {
      seen.section.push(props);
      const { children, ...rest } = domProps(props);
      return <section ref={ref} {...rest}>{children}</section>;
    }),
    div: function DivStub(props) {
      if (props['data-sheet-grabber']) seen.grabber.push(props);
      const { children, ...rest } = domProps(props);
      return <div {...rest}>{children}</div>;
    },
  },
}));

import ChatSheet from './ChatSheet';
import { smooth, instant, gesture } from '../../theme/motion';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  seen.section.length = 0;
  seen.grabber.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (props) => act(() => {
  root.render(
    <ChatSheet detent="peek" viewportHeight={800} onDetentChange={() => {}} {...props}>
      <div>chat</div>
    </ChatSheet>,
  );
});
const last = () => seen.section[seen.section.length - 1];

describe('the height and its transition', () => {
  it('peek is auto; a detent change animates the px height through the `smooth` token', () => {
    render({ detent: 'peek' });
    expect(last().animate).toEqual({ height: 'auto' });
    render({ detent: 'half' });
    expect(last().animate).toEqual({ height: 400 });
    expect(last().transition).toBe(smooth);
    render({ detent: 'full' });
    expect(last().animate).toEqual({ height: 744 });
    expect(last().transition).toBe(smooth);
  });

  it('a viewport change with the same detent re-sizes INSTANTLY — never a tween the player did not start', () => {
    render({ detent: 'half', viewportHeight: 800 });
    expect(last().animate).toEqual({ height: 400 });
    render({ detent: 'half', viewportHeight: 600 });
    expect(last().animate).toEqual({ height: 300 });
    expect(last().transition).toBe(instant);
  });

  it('reduced motion: every detent change is the `instant` token', () => {
    render({ detent: 'peek', reducedMotion: true });
    render({ detent: 'half', reducedMotion: true });
    expect(last().animate).toEqual({ height: 400 });
    expect(last().transition).toBe(instant);
    render({ detent: 'full', reducedMotion: true });
    expect(last().transition).toBe(instant);
  });

  it('the section never animates on mount (initial={false})', () => {
    render({ detent: 'half' });
    expect(seen.section[0].initial).toBe(false);
  });
});

describe('the grabber', () => {
  it('hands framer the `gesture` spring as its release physics, in the dragTransition shape', () => {
    render({ detent: 'peek' });
    const g = seen.grabber[seen.grabber.length - 1];
    expect(g.drag).toBe('y');
    expect(g.dragMomentum).toBe(false);
    expect(g.dragTransition).toEqual({ bounceStiffness: gesture.stiffness, bounceDamping: gesture.damping });
    expect(g.transition).toBeUndefined();
  });

  it('under reduced motion it hands framer no spring at all', () => {
    render({ detent: 'peek', reducedMotion: true });
    const g = seen.grabber[seen.grabber.length - 1];
    expect(g.dragTransition).toBeUndefined();
  });
});
