// useClashCast — React hook for ClashCast AI commentary
// Wraps CommentaryEngine with React state management.
// Returns commentary data for the Live Feed to render.

import { useState, useEffect, useCallback, useRef } from 'react';
import { CommentaryEngine } from '../services/commentaryService';

/**
 * useClashCast — manages ClashCast commentary for an active battle
 *
 * @param {string} battleId - Active battle ID
 * @param {Object} battle - Battle document from Firebase
 * @returns {Object} ClashCast state and controls
 */
export default function useClashCast(battleId, battle) {
  const [commentaryMap, setCommentaryMap] = useState({});     // { eventId: { text, isLoading } }
  const [commentaryCount, setCommentaryCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [syntheticEvents, setSyntheticEvents] = useState([]); // Standalone commentary events
  const engineRef = useRef(null);
  const battleIdRef = useRef(null);

  // Initialize engine when battle becomes active
  useEffect(() => {
    // Skip training battles
    if (battleId && battleId.startsWith('training_')) return;

    const isActiveBattle = battle &&
      (battle.state?.status === 'active' || battle.status === 'active');

    if (isActiveBattle && !engineRef.current && battleId) {
      battleIdRef.current = battleId;

      engineRef.current = new CommentaryEngine(
        battleId,
        battle,
        (eventId, text, isLoading, syntheticEvent) => {
          // Update commentary map for event rows
          setCommentaryMap(prev => ({
            ...prev,
            [eventId]: { text, isLoading },
          }));

          if (text) {
            setCommentaryCount(prev => prev + 1);
          }

          // Update synthetic events list
          if (syntheticEvent) {
            setSyntheticEvents(prev => {
              const idx = prev.findIndex(e => e.id === syntheticEvent.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = syntheticEvent;
                return updated;
              }
              return [...prev, syntheticEvent];
            });
          }
        }
      );
      setIsActive(true);
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
        setIsActive(false);
      }
    };
  }, [battleId, battle?.state?.status, battle?.status]);

  /**
   * Call this from the scoring update loop.
   * Must be called AFTER scores are calculated.
   */
  const processUpdate = useCallback((battleState) => {
    if (engineRef.current) {
      engineRef.current.processStateUpdate(battleState);
    }
  }, []);

  /**
   * Get commentary for a specific event.
   * Returns { text: string|null, isLoading: boolean } | null
   */
  const getEventCommentary = useCallback((eventId) => {
    return commentaryMap[eventId] || null;
  }, [commentaryMap]);

  return {
    isActive,
    commentaryCount,
    processUpdate,
    getEventCommentary,
    commentaryMap,
    syntheticEvents,
  };
}
