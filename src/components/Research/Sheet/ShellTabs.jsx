// src/components/Research/Sheet/ShellTabs.jsx
//
// The two-view shell's TAB STRIP (Amendment C §3 item 6; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-7): What's moving · Ranks ·
// Smart Money · Sector, under the Analysis view's blocks. The strip sticks under
// the header while its content scrolls — `position: sticky` inside the view's
// own scroll box, no JS scroll listener.
//
// Each tab is TODAY'S component with today's props, in full (cut nothing,
// summarize nothing): Ranks = CompeteTab (plus its R-32 label, one additive
// prop), Smart Money = SmartMoneyTab, Sector = SectorTab; What's moving = the
// Why? popup's content inline (WhatsMoving). Only the spacing around them is the
// shell's. SectorETFRanksTab (today's Ranks for a sector ETF) applies nowhere
// here: a sector ETF keeps today's modal at every flag value (R-35).
// A tab mounts only while it is the one shown, so its reads go out on the
// player's tap, as the drawer's tabs do today.

import React, { useRef } from 'react';
import CompeteTab from '../../draft/CompeteTab';
import SectorTab from '../../draft/SectorTab';
import SmartMoneyTab from '../SmartMoneyTab';
import WhatsMoving from './WhatsMoving.jsx';
import { SHELL_COPY } from './sheetCopy.js';
import { ST } from './sheetTheme.js';

export const SHELL_TABS = Object.freeze(['moving', 'ranks', 'smartMoney', 'sector']);
const LABEL = { moving: SHELL_COPY.tabMoving, ranks: SHELL_COPY.tabRanks, smartMoney: SHELL_COPY.tabSmartMoney, sector: SHELL_COPY.tabSector };

/**
 * @param {object} p
 * @param {'moving'|'ranks'|'smartMoney'|'sector'} p.tab
 * @param {(tab: string) => void} p.onTab
 * @param {string}   p.symbol
 * @param {boolean}  p.isMobile
 * @param {Function} p.onNavigateToStock   the modal's own internal navigation
 * @param {object}   p.moving              WhatsMoving's props (the popup's own, as the modal passes them)
 * @param {number}   [p.bodyMinHeight]     the view's height less the strip's: a short tab still fills the
 *                                         view, so a strip stuck at the top stays there when the tab changes
 */
export default function ShellTabs({ tab, onTab, symbol, isMobile, onNavigateToStock, moving, bodyMinHeight = 0 }) {
  const sectionRef = useRef(null);
  // A tab picked while the strip is stuck under the header: the new tab starts at its top, under the
  // strip, instead of mid-way down at the old tab's scroll (review D3). Measured on the tap — no listener.
  const pick = (t) => {
    const section = sectionRef.current;
    const scroller = section?.closest?.('[data-shell-scroll]');
    if (section && scroller) {
      const delta = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      if (delta < 0) scroller.scrollTop += delta;
    }
    onTab(t);
  };
  return (
    <section ref={sectionRef} data-shell-tabs={tab} style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        role="tablist"
        aria-label={SHELL_COPY.tabsLabel}
        data-shell-strip
        style={{
          // The strip spans the view (margin -16px); each tab carries its own 6 px side padding, so its
          // whole 44 px box takes the tap (review D4) and the first label sits on the 16 px gutter.
          position: 'sticky', top: 0, zIndex: 2, background: ST.bg, display: 'flex', gap: 6,
          margin: '0 -16px', padding: '0 10px', borderBottom: `1px solid ${ST.hair}`,
          overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
        }}
      >
        {SHELL_TABS.map((t) => {
          const on = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              data-shell-tab={t}
              onClick={() => { if (!on) pick(t); }}
              style={{
                all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 44, padding: '0 6px', display: 'flex', alignItems: 'center', flexShrink: 0,
                fontWeight: on ? 700 : 500, color: on ? ST.ink : ST.ink2, whiteSpace: 'nowrap',
                boxShadow: on ? `inset 0 -2px 0 ${ST.teal}` : 'none',
              }}
            >
              {/* src/index.css forces a <button>'s own font-size to 16px: the label's size sits on a span.
                  13.5 px down to 12 px on the narrowest phones, so the four tabs fit 320 px (review D1). */}
              <span style={{ fontSize: 'clamp(12px, 3.6vw, 13.5px)' }}>{LABEL[t]}</span>
            </button>
          );
        })}
      </div>
      <div data-shell-tab-body={tab} style={{ paddingTop: 16, minHeight: bodyMinHeight > 0 ? bodyMinHeight : undefined }}>
        {tab === 'moving' && <WhatsMoving key={symbol} {...moving} />}
        {tab === 'ranks' && <CompeteTab symbol={symbol} isMobile={isMobile} onNavigateToStock={onNavigateToStock} rankLabel />}
        {tab === 'smartMoney' && <SmartMoneyTab symbol={symbol} isMobile={isMobile} />}
        {tab === 'sector' && <SectorTab symbol={symbol} isMobile={isMobile} onNavigateToStock={onNavigateToStock} />}
      </div>
    </section>
  );
}
