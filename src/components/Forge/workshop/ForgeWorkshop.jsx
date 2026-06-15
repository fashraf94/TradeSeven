// src/components/Forge/workshop/ForgeWorkshop.jsx
//
// The Forge — new mobile-first workshop shell. Replaces ForgeLanding on the
// showForge path. Hosts the segmented nav (00 Forge / 01 Lists / 02 Rules /
// 03 Traits), the Overview, and the three build areas. The Forge browses /
// builds / refines / finalizes (marks "ready"); it does NOT equip or deploy —
// equipping lives on the Home.
//
// State (useForge / useTraits / watchlists) is instantiated once here and shared
// down. The build overlay + finalize ceremony render at this level so they cover
// the nav, mirroring the design.

import React, { useEffect, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useForge } from '../../../hooks/useForge';
import { useTraits } from '../../../hooks/useTraits';
import useIsMobile from '../../../hooks/useIsMobile';
import { listWatchlists } from '../../../services/forgeWatchlistService';
import { FORGE_DESKTOP_ENABLED } from '../../../config/featureFlags';
import {
  ForgeKitProvider, fkTokens, injectForgeWorkshopCSS,
  ForgeMark, SegmentSwitcher, ForgeFlash, ForgeToast, Icon,
} from './forgeKit';
import ForgeOverview from './ForgeOverview';
import WatchlistsArea from './WatchlistsArea';
import RulesArea from './RulesArea';
import TraitsArea from './TraitsArea';
import BundleBuildFlow from './BundleBuildFlow';

const FONT_UI = "'Space Grotesk', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

export default function ForgeWorkshop({ onClose, initialArea = 'overview', user, agent, onViewWatchlist }) {
  const { tokens } = useTheme();
  const T = fkTokens(tokens);
  // Desktop layout is flag-gated; OFF → the existing fixed 480 column at every
  // width (mobile + desktop byte-identical). isDesktop is width > 768 (useIsMobile).
  // `?forgeDesktop=1` force-previews the desktop path without flipping the
  // committed flag (the ?leagueClimb=1 / ?tournamentDev=1 dev-preview idiom).
  const { isDesktop, width } = useIsMobile();
  const devForceDesktop =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('forgeDesktop') === '1';
  const desktopOn = (FORGE_DESKTOP_ENABLED || devForceDesktop) && isDesktop;
  // The 01 Lists two-column layout engages only at a real desktop width
  // (isDesktop's 768 floor is too narrow for two columns).
  const twoCol = desktopOn && width >= 1024;
  const agentId = agent?.id || null;
  const hasActiveBattle = !!agent?.activeBattleId;
  const primary = agent?.primaryColor || T.teal;

  const forge = useForge(agentId);
  const traits = useTraits(agentId, forge);

  const normalizeArea = (a) => (['overview', 'watchlists', 'rules', 'traits'].includes(a) ? a : 'overview');
  const [area, setArea] = useState(() => normalizeArea(initialArea));
  const [building, setBuilding] = useState(null); // 'rules' | null
  const [flash, setFlash] = useState(null);       // { name, kindLabel, accent }
  const [toast, setToast] = useState(null);       // { msg, accent }
  const [watchlists, setWatchlists] = useState([]);

  useEffect(() => { injectForgeWorkshopCSS(); }, []);

  // Watchlists for the Overview tallies (the area mounts its own list too).
  useEffect(() => {
    let cancelled = false;
    listWatchlists()
      .then((list) => { if (!cancelled) setWatchlists(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setWatchlists([]); });
    return () => { cancelled = true; };
  }, [user?.uid]);

  const showToast = React.useCallback((msg, accent) => {
    setToast({ msg, accent: accent || primary });
    setTimeout(() => setToast(null), 2400);
  }, [primary]);

  const handleBuild = (areaId) => {
    if (areaId === 'rules') setBuilding('rules');
    else setArea(areaId); // watchlists / traits build via their own area paths
  };

  const handleForgeReady = async (bundleId) => {
    const name = forge.bundles.find((b) => b.id === bundleId)?.name || 'Rule bundle';
    await forge.forgeBundleFn(bundleId);
    setFlash({ name, kindLabel: 'rule bundle', accent: T.gold });
  };

  const navItems = [
    { id: 'overview', n: '00', label: 'Forge', accent: T.copper },
    { id: 'watchlists', n: '01', label: 'Lists', accent: primary },
    { id: 'rules', n: '02', label: 'Rules', accent: T.gold },
    { id: 'traits', n: '03', label: 'Traits', accent: T.allocation },
  ];

  let body;
  if (area === 'overview') {
    body = (
      <ForgeOverview
        agentName={agent?.name}
        primary={primary}
        watchlists={watchlists}
        bundles={forge.bundles}
        equippedTraits={traits.equippedTraits}
        onNav={setArea}
        onBuild={handleBuild}
      />
    );
  } else if (area === 'watchlists') {
    body = (
      <WatchlistsArea
        agentName={agent?.name}
        primary={primary}
        user={user}
        agent={agent}
        showToast={showToast}
        onViewWatchlist={onViewWatchlist}
        twoCol={twoCol}
      />
    );
  } else if (area === 'rules') {
    body = (
      <RulesArea
        forge={forge}
        agent={agent}
        onBuild={() => setBuilding('rules')}
        onForgeReady={handleForgeReady}
      />
    );
  } else {
    body = (
      <TraitsArea
        agent={agent}
        agentName={agent?.name}
        primary={primary}
        traits={traits}
        hasActiveBattle={hasActiveBattle}
        showToast={showToast}
      />
    );
  }

  return (
    <ForgeKitProvider tokens={tokens}>
      <div style={{ height: '100vh', width: '100%', background: T.bg, display: 'flex', justifyContent: 'center', overflow: 'hidden', '--fw-ui': FONT_UI, '--fw-mono': FONT_MONO, fontFamily: FONT_UI }}>
        <div style={{ width: '100%', maxWidth: desktopOn ? (area === 'watchlists' && twoCol ? 1200 : 720) : 480, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', background: T.bg, borderLeft: `1px solid ${T.hair}`, borderRight: `1px solid ${T.hair}` }}>
          {/* top chrome — wordmark + close + segmented switcher */}
          <div style={{ flexShrink: 0, padding: '8px 18px 12px', borderBottom: `1px solid ${T.hair}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
              <ForgeMark />
              <button className="fw-tap" onClick={onClose} aria-label="Close the Forge" style={{ all: 'unset', cursor: 'pointer', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.surface, border: `1px solid ${T.hair2}` }}>
                <Icon name="x" size={16} color={T.ink2} />
              </button>
            </div>
            <SegmentSwitcher items={navItems} active={area} onPick={setArea} />
          </div>

          {/* body */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
            <div key={area} style={{ height: '100%', animation: 'fwFade .25s ease both' }}>{body}</div>
            {building === 'rules' && (
              <BundleBuildFlow
                forge={forge}
                hasActiveBattle={hasActiveBattle}
                onClose={() => setBuilding(null)}
                onFinalized={(name) => { setBuilding(null); setArea('rules'); setFlash({ name, kindLabel: 'rule bundle', accent: T.gold }); }}
                showToast={showToast}
              />
            )}
            {flash && <ForgeFlash name={flash.name} kindLabel={flash.kindLabel} accent={flash.accent} onDone={() => setFlash(null)} />}
          </div>

          {toast && <ForgeToast msg={toast.msg} accent={toast.accent} />}
        </div>
      </div>
    </ForgeKitProvider>
  );
}
