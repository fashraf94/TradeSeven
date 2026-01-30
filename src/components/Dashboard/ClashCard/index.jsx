// /src/components/Dashboard/ClashCard/index.jsx
// Smart wrapper that selects the correct Clash Card variant
// Handles data extraction from battle objects and delegates to sub-components

import React, { useState, useEffect } from 'react';
import ClashCard1v1 from './ClashCard1v1';
import ClashCardDraft from './ClashCardDraft';
import ClashCardTraining from './ClashCardTraining';
import { getUsername } from '../../../utils/battleHelpers';
import { getRemainingTime } from '../../../services/battleTimer';

// Calculate 1v1 battle preview data
function calculate1v1PreviewData(battle, username) {
  if (!battle) return null;

  // V3 BaggerBomb battles use totalScore instead of portfolio values
  if (battle._v === 3) {
    const isCreator = battle.creator?.username === username;
    const opponent = isCreator ? battle.opponent?.username : battle.creator?.username;

    // V3 uses totalScore for BaggerBomb scoring
    const myScore = isCreator ? (battle.creator?.totalScore || 0) : (battle.opponent?.totalScore || 0);
    const theirScore = isCreator ? (battle.opponent?.totalScore || 0) : (battle.creator?.totalScore || 0);
    const isWinning = myScore > theirScore;

    return {
      opponent: opponent || 'Opponent',
      myGain: myScore,
      theirGain: theirScore,
      isWinning,
      isV3: true,
      status: battle.state?.status,
    };
  }

  const isCreator = getUsername(battle.creator) === username;
  const opponent = isCreator ? getUsername(battle.opponent) : getUsername(battle.creator);
  const myPortfolio = isCreator ? battle.creatorPortfolio : battle.opponentPortfolio;
  const theirPortfolio = isCreator ? battle.opponentPortfolio : battle.creatorPortfolio;

  if (!myPortfolio || !theirPortfolio) return null;

  let myValue = 0;
  myPortfolio.forEach(asset => {
    const shares = asset.amount / asset.price;
    myValue += shares * asset.price;
  });

  let theirValue = 0;
  theirPortfolio.forEach(asset => {
    const shares = asset.amount / asset.price;
    theirValue += shares * asset.price;
  });

  const myGain = ((myValue - 1000000) / 1000000) * 100;
  const theirGain = ((theirValue - 1000000) / 1000000) * 100;
  const isWinning = myGain > theirGain;

  return { opponent, myGain, theirGain, isWinning, myValue, theirValue };
}

// Get remaining ms from battle object (handles both classic and draft formats)
function getRemainingMs(battle) {
  // Classic battle format
  if (battle.endDate) {
    return Math.max(0, new Date(battle.endDate).getTime() - Date.now());
  }
  // Draft battle format
  if (battle.battleEndTime) {
    return Math.max(0, new Date(battle.battleEndTime).getTime() - Date.now());
  }
  // V3 BaggerBomb format (uses timing.endDate)
  if (battle.timing?.endDate) {
    return Math.max(0, new Date(battle.timing.endDate).getTime() - Date.now());
  }
  // Training format (uses timeline.endDate)
  if (battle.timeline?.endDate) {
    return Math.max(0, new Date(battle.timeline.endDate).getTime() - Date.now());
  }
  return 0;
}

// Build standings for draft battles
function buildDraftStandings(battle, currentUserId) {
  if (!battle.players || battle.players.length === 0) {
    return { standings: [], myPosition: 1, myPoints: 0, leaderPoints: 0 };
  }

  // Map players with basic info - use totalPoints for BaggerBomb scoring
  const players = battle.players.map((p) => ({
    name: p.displayName || p.username || 'Player',
    isCPU: p.isCPU || false,
    isMe: p.odUserId === currentUserId || p.displayName === currentUserId,
    points: p.totalPoints ?? p.cumulativeScore ?? 0,
  }));

  // Sort by points descending (BaggerBomb scoring)
  const sorted = [...players].sort((a, b) => b.points - a.points);

  const myPlayer = sorted.find(p => p.isMe);
  const myPosition = myPlayer ? sorted.indexOf(myPlayer) + 1 : sorted.length;
  const myPoints = myPlayer?.points ?? 0;
  const leaderPoints = sorted.length > 0 ? sorted[0].points : 0;

  return { standings: sorted, myPosition, myPoints, leaderPoints };
}

export default function ClashCard({
  battle,
  battleType, // 'classic' | 'draft' | 'training'
  user,
  onPress,
  isMostUrgent = false,
}) {
  // Live timer that ticks every second
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(battle));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(getRemainingMs(battle));
    }, 1000);
    return () => clearInterval(interval);
  }, [battle]);

  const currentUserId = user?.odUserId || user?.username;

  // TRAINING battles (simplified purple variant)
  if (battleType === 'training') {
    const myReturn = battle.player1?.percentChange || 0;
    const cpuReturn = battle.player2?.percentChange || 0;

    // Check if it's a draft-type training (has players array)
    const isDraftTraining = battle.players && battle.players.length > 2;
    let position = null;
    let totalPlayers = null;

    if (isDraftTraining) {
      const draftData = buildDraftStandings(battle, currentUserId);
      position = draftData.myPosition;
      totalPlayers = battle.players.length;
    }

    return (
      <ClashCardTraining
        battle={battle}
        myReturn={myReturn}
        opponentReturn={cpuReturn}
        position={position}
        totalPlayers={totalPlayers}
        remainingMs={remainingMs}
        onPress={onPress}
      />
    );
  }

  // DRAFT battles (4-player leaderboard)
  if (battleType === 'draft') {
    const { standings, myPosition, myPoints, leaderPoints } = buildDraftStandings(battle, currentUserId);

    return (
      <ClashCardDraft
        battle={battle}
        standings={standings}
        myPosition={myPosition}
        myPoints={myPoints}
        leaderPoints={leaderPoints}
        remainingMs={remainingMs}
        onPress={onPress}
        isMostUrgent={isMostUrgent}
        currentUserId={currentUserId}
      />
    );
  }

  // CLASSIC 1v1 battles (Builder, BaggerBomb)
  const previewData = calculate1v1PreviewData(battle, user.username);
  if (!previewData) return null;

  // Attach username for avatar display
  const battleWithUsername = { ...battle, _myUsername: user.username };

  return (
    <ClashCard1v1
      battle={battleWithUsername}
      previewData={previewData}
      remainingMs={remainingMs}
      onPress={onPress}
      isMostUrgent={isMostUrgent}
    />
  );
}
