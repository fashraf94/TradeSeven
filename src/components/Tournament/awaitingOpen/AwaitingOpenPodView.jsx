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
} from './podBoard';
import PodCountdownHero from './PodCountdownHero';
import UserDraftboard from './UserDraftboard';
import FreeAgentsList from './FreeAgentsList';
import ClaimFlipWindow from '../ClaimFlipWindow';
import GroupFeed from '../GroupFeed';
import AssetResearchModal from '../../draft/AssetResearchModal';

const CLAIM_CAP = TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE; // 3 pending

export default function AwaitingOpenPodView({ pod, uid }) {
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

  const pendingCount = useMemo(
    () => claims.filter((c) => c.odUserId === uid && c.status === 'pending').length,
    [claims, uid],
  );
  const capReached = pendingCount >= CLAIM_CAP;

  const requestClaim = (symbol) => {
    setClaimPrefill((prev) => ({ symbol, nonce: (prev?.nonce || 0) + 1 }));
    // Let the pre-fill commit, then bring the builder into view.
    requestAnimationFrame(() => claimsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const researchSector = researchSym ? (sectorMap.get(researchSym) || null) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, ...FONT_VARS }}>
      <PodCountdownHero targetIso={pod?.startAnchor?.anchorIso || null} />

      <UserDraftboard
        pod={pod}
        uid={uid}
        events={events}
        sectorMap={sectorMap}
        picksPerPlayer={PICKS_PER_PLAYER}
        onResearch={setResearchSym}
      />

      <FreeAgentsList
        board={freeAgentBoard}
        onResearch={setResearchSym}
        onClaim={requestClaim}
        capReached={capReached}
        pendingCount={pendingCount}
        claimCap={CLAIM_CAP}
      />

      {/* Claims builder relocated below the free-agents list (L8). Claims-only
          pre-open — Flips are inert until the battle opens. Cap / waiver priority
          / wire timing / seat-only render are unchanged (reuse). We pass the
          already-read claims array so the collection is read once for this view. */}
      <div ref={claimsRef}>
        <ClaimFlipWindow group={pod} uid={uid} claimsOnly prefillRequest={claimPrefill} claims={claims} />
      </div>

      <GroupFeed feed={pod?.feed} uid={uid} />

      {researchSym && (
        <AssetResearchModal
          asset={{ symbol: researchSym, name: researchSym, sector: researchSector }}
          sector={researchSector}
          onClose={() => setResearchSym(null)}
        />
      )}
    </div>
  );
}
