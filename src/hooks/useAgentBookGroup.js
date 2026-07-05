// src/hooks/useAgentBookGroup.js
//
// V2 Build 6 (Agent-Book Mode) — read-only source hook for the "{Agent}'s book"
// Correlation-Lab chip. Reads the agent's CURRENT live holdings and projects
// them to SYMBOLS ONLY.
//
// FENCE NOTE (elevated for this build): agent holdings live in the agentBattles
// doc, whose createAgentBattle SHAPE is fenced "as a concept" (BUILD_RULES §1).
// Reading is permitted and the build spec pre-authorizes this exact hook. This
// file honors every fence pin BY CONSTRUCTION:
//   • imports NO fenced hook — resolves the battle id via the non-fenced
//     useAgent (agent.activeBattleId), deliberately AVOIDING the fenced
//     useAgentBattleId and the archived useActiveDeployments;
//   • edits NO fenced file;
//   • consumes SYMBOLS ONLY (portfolio.{star,core,support}[].symbol) — never a
//     score, baseline, multiplier, or tier weight;
//   • filters crypto with the Lab's own isCrypto() (inside buildSourceGroup),
//     NOT the doc's isCrypto flag — keeping the projection decoupled from the
//     fenced shape's fields.
//
// Product is one managed agent / one active book per user, so this is one chip.
// Truncation "largest" = slot order star (highest conviction) → core → support
// (there is no non-scoring position-size field; weights are fenced). Returns
// { symbols, label, asOf, truncatedFrom, excludedCrypto, agentName } or null.

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useUser } from '../contexts/UserContext';
import useAgent from './useAgent';
import { buildSourceGroup, tsToMs } from '../components/Research/correlationGroup';

export async function readAgentBookGroup(activeBattleId, agentName) {
  if (!activeBattleId) return null;
  const snap = await getDoc(doc(db, 'agentBattles', activeBattleId));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const p = data.portfolio || {};
  // Symbols only, in conviction (slot) order — the fence-clean truncation proxy.
  const ordered = [
    ...(Array.isArray(p.star) ? p.star : []),
    ...(Array.isArray(p.core) ? p.core : []),
    ...(Array.isArray(p.support) ? p.support : []),
  ].map((pos) => pos?.symbol);
  const name = agentName || 'Agent';
  return buildSourceGroup(ordered, {
    label: `${name}'s book`,
    asOf: tsToMs(data.updatedAt),
    agentName: name,
  });
}

export default function useAgentBookGroup() {
  const { user } = useUser();
  const { agent } = useAgent(user?.uid);
  const activeBattleId = agent?.activeBattleId ?? null;
  const agentName = agent?.name ?? null;
  const [group, setGroup] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!activeBattleId) {
      setGroup(null);
      return;
    }
    readAgentBookGroup(activeBattleId, agentName)
      .then((g) => { if (alive) setGroup(g); })
      .catch((err) => {
        console.warn('[useAgentBookGroup] read failed:', err?.message);
        if (alive) setGroup(null);
      });
    return () => { alive = false; };
  }, [activeBattleId, agentName]);

  return group;
}
