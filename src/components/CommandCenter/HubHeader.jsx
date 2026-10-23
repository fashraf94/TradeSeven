// src/components/CommandCenter/HubHeader.jsx
//
// Command Center hub, slice S1 — the header (the design's CcHeader, ff-app.jsx;
// prompt §4.2): an eyebrow with today's date in ET and the player's name, and
// the title. The mock-up's own top navigation (Compete · News · League ·
// Forge) is prototype chrome and is not built: the desktop sidebar and BottomNav
// stay (ruling R-S1-3). On a PHONE the app's drawer (Battle History,
// Notifications, Rules & How to Play, Logout) opens from a menu button before the
// greeting, where today's phone shell has its hamburger (S5, founder ruling
// Q-S5-1): it calls App's setSidebarOpen(true), with the unread count as its
// badge. Phone only: the desktop site has a persistent sidebar, and without a
// handler the button is not drawn.
//
// On the phone the design's account circle stays as the profile affordance.
// S5 wires it to the profile (spec §2); without a handler it is a disabled
// button with its label, a 44 px target around the 34 px circle.
//
// S5 (ruling R-S5-7) adds "Report a bug": the floating ClashBot button is
// withheld over the hub (it would sit on the phone strip's action), so the
// report opens from here — the widget stays mounted and answers the same open
// event the Battle View's overflow uses. An icon with its name as the label on
// the phone, where a 44 px target is all the room there is; the words on the
// wider compositions. Without a handler the control is not drawn at all.

import React from 'react';
import { cssVar } from '../../theme/cssTokens';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C, PHONE_TARGET, tint } from './hub/hubStyle';
import { Eyebrow, HubLink, Icon } from './HubParts';

/** The badge shows the count up to this, then "9+" (today's phone shell's own rule). */
const BADGE_CAP = 9;

/** The phone's menu button: a 44 px target around the icon, the unread count as a badge on its corner. */
function MenuButton({ onOpenMenu, unreadCount }) {
  const unread = Number.isSafeInteger(unreadCount) && unreadCount > 0 ? unreadCount : 0;
  // One string for the eye and the ear: the text the badge shows is also what the name says (Label in Name).
  const shown = unread > 0 ? COPY.header.unreadBadge(unread, BADGE_CAP) : '';
  return (
    <button
      type="button"
      onClick={onOpenMenu}
      aria-label={shown ? COPY.header.menuUnread(shown) : COPY.header.menu}
      data-hub-menu=""
      style={{ appearance: 'none', font: 'inherit', position: 'relative', background: 'transparent', border: 'none', padding: 0, width: PHONE_TARGET, height: PHONE_TARGET, margin: '0 2px 0 -10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', color: C.ink2 }}
    >
      <Icon name="menu" size={22} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          data-hub-menu-badge=""
          style={{ position: 'absolute', top: 4, right: 2, minWidth: 16, height: 16, padding: '0 4px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: cssVar('red'), color: C.bg, fontSize: 10, fontWeight: 700, lineHeight: 1 }}
        >
          {shown}
        </span>
      )}
    </button>
  );
}

export default function HubHeader({ dateText, name, phone = false, gutter = 28, onOpenProfile, onReportBug, onOpenMenu, unreadCount = 0 }) {
  const initial = name ? name.trim().charAt(0).toUpperCase() : '';
  const canReport = typeof onReportBug === 'function';
  const canMenu = phone && typeof onOpenMenu === 'function';
  const heading = (
    <div style={{ minWidth: 0 }}>
      <Eyebrow>{COPY.header.eyebrow(dateText, name)}</Eyebrow>
      <h1 style={{ margin: '3px 0 0', fontSize: phone ? 21 : 24, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1.1 }}>
        {COPY.header.title}
      </h1>
    </div>
  );
  return (
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, padding: phone ? '10px 14px 0' : `18px ${gutter}px 6px` }}>
      {canMenu ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', minWidth: 0 }}>
          <MenuButton onOpenMenu={onOpenMenu} unreadCount={unreadCount} />
          {heading}
        </div>
      ) : heading}
      {(phone || canReport) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: phone ? 0 : 16, flexShrink: 0 }}>
          {canReport && (phone ? (
            <button
              type="button"
              onClick={onReportBug}
              aria-label={COPY.header.reportBug}
              data-hub-report-bug=""
              style={{ appearance: 'none', font: 'inherit', background: 'transparent', border: 'none', padding: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', color: C.ink2 }}
            >
              <Icon name="bug" size={19} />
            </button>
          ) : (
            <span data-hub-report-bug="">
              <HubLink onPress={onReportBug}>{COPY.header.reportBug}</HubLink>
            </span>
          ))}
          {phone && (
            <button
              type="button"
              onClick={onOpenProfile}
              disabled={typeof onOpenProfile !== 'function'}
              aria-label={COPY.header.profile}
              data-hub-profile=""
              style={{ appearance: 'none', font: 'inherit', background: 'transparent', border: 'none', padding: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: typeof onOpenProfile === 'function' ? 'pointer' : 'default' }}
            >
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${tint('teal', 0.7)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: C.ink }}>
                {initial}
              </span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
