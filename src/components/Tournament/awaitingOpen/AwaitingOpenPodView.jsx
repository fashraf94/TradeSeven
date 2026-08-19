// src/components/Tournament/awaitingOpen/AwaitingOpenPodView.jsx
//
// Training Pod Draft V2 — Phase 2. The rebuilt AWAITING-OPEN pod body, rendered
// in place of the video-based composition when the V2 gate is on and the pod is
// awaiting open (the host, LeagueTrainingBattleView, keeps the framing header +
// practice banner and picks this view). Page order (spec §2):
//   Countdown (battle start) → user-layer draftboard → best remaining free
//   agents (+ inline Claim) → claims builder → group feed.
//
// Reads only, client-legal (the same docs the lobby/pod already read): the
// universe (indexIntelligence/stockRankings), the persisted draft stream
// (draft/state — events + humanArchetype), and the claims subcollection. No new
// writes; claims still go through the unchanged place-claim endpoint via
// ClaimFlipWindow. Calibration fence untouched; the fit board is the SAME
// buildFitBoard the lobby uses (podBoard.js).
//
// Claims privacy: this view reads the claims collection once and passes the
// array to ClaimFlipWindow, which renders ONLY the caller's own claims (as
// today). It never renders another seat's pending claim, and it does not widen
// any claim read.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { subscribeDraftState, subscribeClaims } from '../../../services/tournamentGroupService';
import { PICKS_PER_PLAYER, TOURNAMENT_TUNING } from '../../../constants/leagueTournament';
import { DEFAULT_ARCH } from '../../League/draft/boardModel';
import { FONT_VARS } from '../../League/draft/draftTokens';
import {
  buildFreeAgentBoard, sectorMapOf, ownedSectorCountsFrom, heldSymbolsOf, eventsFromPlayers,
  buildMyPicks,
} from './podBoard';
import PodCountdownHero from './PodCountdownHero';
import UserDraftboard from './UserDraftboard';
import FreeAgentsList from './FreeAgentsList';
import ClaimFlipWindow from '../ClaimFlipWindow';
import GroupFeed from '../GroupFeed';
import AssetResearchModal from '../../draft/AssetResearchModal';
import AwaitingOpenShell from './AwaitingOpenShell';
import AwaitCountdownHero from './AwaitCountdownHero';
import AwaitDraftBoard from './AwaitDraftBoard';
import AwaitWire from './AwaitWire';
import AwaitSwapSheet from './AwaitSwapSheet';
import { wireWindowLine } from './awaitTokens';
import { getClaimWindowDisplay } from '../../../utils/tournamentSurfaces';
import { isAwaitingOpenRedesignOn } from '../../../config/featureFlags';

const CLAIM_CAP = TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE; // 3 pending

export default function AwaitingOpenPodView({ pod, uid, desktop = false }) {
  const podId = pod?.id;

  const [universe, setUniverse] = useState(null);
  const [draftState, setDraftState] = useState(null);
  const [claims, setClaims] = useState([]);
  const [researchSym, setResearchSym] = useState(null);
  // Inline-Claim → builder pre-fill: bump `nonce` so the same symbol can be
  // re-selected, and scroll the claims section into view.
  const [claimPrefill, setClaimPrefill] = useState(null); // { symbol, nonce }
  const claimsRef = useRef(null);

  // The universe (static reference doc) — read once (client-legal; the same doc
  // useTrainingDraft reads). Degrades to [] so the board simply shows fewer
  // signals rather than breaking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'indexIntelligence', 'stockRankings'));
        if (!cancelled) setUniverse(snap.exists() ? (snap.data().stocks || []) : []);
      } catch (err) {
        console.error('[AwaitingOpenPodView] stockRankings read failed:', err?.message);
        if (!cancelled) setUniverse([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!podId) return undefined;
    const unsubDraft = subscribeDraftState(podId, setDraftState);
    const unsubClaims = subscribeClaims(podId, setClaims);
    return () => { unsubDraft && unsubDraft(); unsubClaims && unsubClaims(); };
  }, [podId]);

  const player = useMemo(() => (pod?.players || []).find((p) => p.odUserId === uid) || null, [pod, uid]);
  const held = useMemo(() => heldSymbolsOf(player), [player]);
  const archKey = draftState?.humanArchetype || DEFAULT_ARCH;

  const events = useMemo(
    () => (draftState?.events?.length ? draftState.events : eventsFromPlayers(pod?.players)),
    [draftState, pod],
  );
  const sectorMap = useMemo(() => sectorMapOf(universe), [universe]);
  const ownedSectorCounts = useMemo(() => ownedSectorCountsFrom(held, universe), [held, universe]);
  const freeAgentBoard = useMemo(
    () => buildFreeAgentBoard({ poolSymbols: pod?.userPool, universe, archKey, ownedSectorCounts, topN: 12 }),
    [pod?.userPool, universe, archKey, ownedSectorCounts],
  );

  const myPendingClaims = useMemo(
    () => claims.filter((c) => c.odUserId === uid && c.status === 'pending'),
    [claims, uid],
  );
  const pendingCount = myPendingClaims.length;
  const capReached = pendingCount >= CLAIM_CAP;
  // The user's OWN pending-claim ADD symbols (self-scoped — the same filter
  // ClaimFlipWindow renders with; no other seat's claims are read). A free-agent
  // row matching one shows a disabled "Pending" pill instead of a live Claim
  // button, so the same name can't be queued twice.
  const pendingClaimSymbols = useMemo(
    () => new Set(myPendingClaims.map((c) => String(c.addSymbol || '').toUpperCase())),
    [myPendingClaims],
  );

  const requestClaim = (symbol) => {
    setClaimPrefill((prev) => ({ symbol, nonce: (prev?.nonce || 0) + 1 }));
    // Let the pre-fill commit, then bring the builder into view.
    requestAnimationFrame(() => claimsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // ── redesign-only state ───────────────────────────────────────────────────
  const redesignOn = isAwaitingOpenRedesignOn();

  // The row whose Claim opened the swap sheet. The sheet is pre-filled with it;
  // the user's only decision is which of their three picks it replaces.
  const [swapRow, setSwapRow] = useState(null);

  // The claim window, re-evaluated on a timer so the "opens in Xh Ym" line
  // stays honest while the page sits open. Display-only — the server's 403
  // window_closed is the sole authority on any submit (ClaimFlipWindow.jsx:6-14).
  //
  // The timer is GATED ON THE FLAG. Left ungated it would re-render the classic
  // tree every 30s, and ClaimFlipWindow recomputes getClaimWindowDisplay during
  // render with no memo (ClaimFlipWindow.jsx:81) — so its countdown line and its
  // colour would start updating live where main leaves them frozen until the
  // next snapshot. That is a visible flag-off behaviour change, which the dark
  // merge forbids.
  const [windowNow, setWindowNow] = useState(() => new Date());
  useEffect(() => {
    if (!redesignOn) return undefined;
    const id = setInterval(() => setWindowNow(new Date()), 30000);
    return () => clearInterval(id);
  }, [redesignOn]);
  const claimWindow = useMemo(
    () => (redesignOn ? getClaimWindowDisplay(windowNow) : null),
    [redesignOn, windowNow],
  );
  const windowLine = useMemo(
    () => (redesignOn ? wireWindowLine(claimWindow, windowNow) : { text: '', isOpen: false }),
    [redesignOn, claimWindow, windowNow],
  );

  // The user's three picks, with the sector each plate is coloured by — the
  // drop options in the swap sheet. Built through the shared podBoard helper so
  // the symbols are normalised exactly as the draftboard normalises them; an
  // inline uppercase would skip the trim and could colour the same ticker
  // differently in the sheet than on the board (BUILD_RULES §9).
  const myPicks = useMemo(() => buildMyPicks({ player, sectorMap }), [player, sectorMap]);

  // Every claim of the caller's own, newest first — pending AND resolved. The
  // classic body surfaces these through ClaimFlipWindow (:200-211); the redesign
  // does not render that panel, so without this an approved or denied claim (and
  // its denialReason) would be visible nowhere and the row would simply revert
  // to a live Claim button after the processing pass.
  const myClaims = useMemo(() => claims.filter((c) => c.odUserId === uid), [claims, uid]);

  const researchSector = researchSym ? (sectorMap.get(researchSym) || null) : null;

  const freeAgents = (
    <FreeAgentsList
      board={freeAgentBoard}
      onResearch={setResearchSym}
      onClaim={requestClaim}
      capReached={capReached}
      pendingCount={pendingCount}
      claimCap={CLAIM_CAP}
      pendingSymbols={pendingClaimSymbols}
    />
  );

  // Claims builder relocated below the free-agents list (L8). Claims-only
  // pre-open — Flips are inert until the battle opens. Cap / waiver priority /
  // wire timing / seat-only render are unchanged (reuse). We pass the already-read
  // claims array so the collection is read once for this view. Same element,
  // same props on both layouts — re-arranged, never re-wired.
  const claimsBuilder = (
    <ClaimFlipWindow group={pod} uid={uid} claimsOnly prefillRequest={claimPrefill} claims={claims} />
  );

  // The research modal is wired ONCE for both the classic and the redesigned
  // body (spec §6.3 — preserve, don't redesign): a ticker tap on either surface
  // lands here, so the two paths can never drift on how research opens.
  const researchModal = researchSym && (
    <AssetResearchModal
      asset={{ symbol: researchSym, name: researchSym, sector: researchSector }}
      sector={researchSector}
      onClose={() => setResearchSym(null)}
    />
  );

  const countdownHero = <PodCountdownHero targetIso={pod?.startAnchor?.anchorIso || null} />;

  const draftboard = (
    <UserDraftboard
      pod={pod}
      uid={uid}
      events={events}
      sectorMap={sectorMap}
      picksPerPlayer={PICKS_PER_PLAYER}
      onResearch={setResearchSym}
    />
  );

  // Awaiting-the-Open REDESIGN (AWAITING_OPEN_REDESIGN_ENABLED or
  // ?awaitingOpenRedesign=1). Same reads, same claim call — the shell owns the
  // layout and atmosphere; the sections are replaced phase by phase. Flag-off
  // falls through to today's body below, byte-identical.
  if (redesignOn) {
    return (
      <>
        <AwaitingOpenShell desktop={desktop}>
          <AwaitCountdownHero
            targetIso={pod?.startAnchor?.anchorIso || null}
            compact={!desktop}
          />
          <AwaitDraftBoard
            pod={pod}
            uid={uid}
            events={events}
            sectorMap={sectorMap}
            picksPerPlayer={PICKS_PER_PLAYER}
            onResearch={setResearchSym}
            compact={!desktop}
          />
          <AwaitWire
            board={freeAgentBoard}
            pendingSymbols={pendingClaimSymbols}
            pendingCount={pendingCount}
            claimCap={CLAIM_CAP}
            windowLine={windowLine.text}
            wireOpen={windowLine.isOpen}
            hasPicks={myPicks.length > 0}
            claims={myClaims}
            onClaim={setSwapRow}
            onResearch={setResearchSym}
            compact={!desktop}
          />
          <GroupFeed feed={pod?.feed} uid={uid} />
        </AwaitingOpenShell>

        <AwaitSwapSheet
          row={swapRow}
          picks={myPicks}
          groupId={podId}
          open={windowLine.isOpen}
          windowLine={windowLine.text}
          capReached={capReached}
          claimCap={CLAIM_CAP}
          pendingCount={pendingCount}
          compact={!desktop}
          onClose={() => setSwapRow(null)}
        />

        {researchModal}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, ...FONT_VARS }}>
      {countdownHero}

      {draftboard}

      {desktop ? (
        // Desktop (D-L3): the two-column interactive body — best-remaining free
        // agents as one wide ranked column (1.7fr) left, the claims builder as a
        // sticky rail (1fr) right. minmax(0, …) tracks avoid min-content overflow;
        // the rail sits in a plain (stretched) grid cell so it has row height to
        // stick within, and pins against the host's bounded-height scroll frame.
        // claimsRef.scrollIntoView stays and no-ops when the rail is already visible.
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: 16 }}>
          <div style={{ minWidth: 0 }}>{freeAgents}</div>
          <div style={{ minWidth: 0 }}>
            <div ref={claimsRef} style={{ position: 'sticky', top: 16 }}>
              {claimsBuilder}
            </div>
          </div>
        </div>
      ) : (
        <>
          {freeAgents}
          <div ref={claimsRef}>
            {claimsBuilder}
          </div>
        </>
      )}

      <GroupFeed feed={pod?.feed} uid={uid} />

      {researchModal}
    </div>
  );
}
