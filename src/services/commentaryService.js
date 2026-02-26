// commentaryService.js — ClashCast CommentaryEngine
// Monitors battle state changes and generates AI commentary for scoring events.
// Commentary is keyed by event ID so the Live Feed can look up which events have it.

// ── Event type mapping from V3/V4 hook names to ClashCast API names ──
const TYPE_MAP = {
  bagger: 'BAGGERBOMB',
  doubleBagger: 'DOUBLE_BAGGER',
  tenBagger: 'TENBAGGER',
  bust: 'BUST',
  crash: 'CRASH',
  meltdown: 'MELTDOWN',
  BREAKOUT: 'BAGGERBOMB',
  RALLY: 'DOUBLE_BAGGER',
  MOONSHOT: 'TENBAGGER',
  BUST: 'BUST',
  CRASH: 'CRASH',
  MELTDOWN: 'MELTDOWN',
};

// ── Tier classification for throttle cooldowns ──
const TIER1_TYPES = ['BAGGERBOMB', 'DOUBLE_BAGGER', 'TENBAGGER', 'BUST', 'CRASH', 'MELTDOWN', 'LEAD_CHANGE'];
const TIER2_TYPES = ['SESSION_TRANSITION', 'COMEBACK', 'SUBSTITUTION'];
const BYPASS_THROTTLE = ['LEAD_CHANGE', 'BATTLE_START', 'BATTLE_END'];

// ── Fallback templates (used when API call fails) ──
const FALLBACK_TEMPLATES = {
  BAGGERBOMB: (e) => `${e.playerName}'s ${e.asset} just detonated a BaggerBomb! +${e.pointsAwarded} points!`,
  DOUBLE_BAGGER: (e) => `DOUBLE BAGGER! ${e.playerName}'s ${e.asset} is absolutely ripping! +${e.pointsAwarded}!`,
  TENBAGGER: (e) => `TENBAGGER ALERT! ${e.playerName}'s ${e.asset} has gone NUCLEAR! +${e.pointsAwarded}!`,
  BUST: (e) => `${e.playerName}'s ${e.asset} just busted through the floor. -${Math.abs(e.pointsAwarded || 7.5)} points.`,
  CRASH: (e) => `CRASH! ${e.playerName}'s ${e.asset} is in freefall! -${Math.abs(e.pointsAwarded || 15)} points!`,
  MELTDOWN: (e) => `MELTDOWN on ${e.playerName}'s ${e.asset}! Devastating — -${Math.abs(e.pointsAwarded || 35)} points!`,
  LEAD_CHANGE: (e) => `LEAD CHANGE! ${e.playerName} takes the lead by ${e.scoreDifferential || ''} points!`,
  SESSION_TRANSITION: (e) => `The ${(e.newSession || 'next').replace(/_/g, ' ')} session is now underway!`,
  COMEBACK: (e) => `${e.playerName} is mounting a comeback! The gap has closed to just ${e.currentGap || 'a few'} points!`,
  SUBSTITUTION: (e) => `Strategic move — ${e.playerName} swaps out ${e.removedAsset || 'a stock'} and brings ${e.asset || 'a new pick'} off the bench!`,
  BATTLE_START: () => `The battle is LIVE! Let's see who brought the better portfolio today!`,
  BATTLE_END: (e) => `THAT'S THE FINAL BELL! ${e.playerName ? `${e.playerName} takes the win!` : 'What a battle!'}`,
};

export class CommentaryEngine {
  constructor(battleId, battleData, onCommentary) {
    this.battleId = battleId;
    this.previousState = null;
    this.commentaryMap = new Map();       // eventId → commentary string
    this.commentaryLog = [];              // Ordered list for narrative context
    this.pendingCommentary = new Set();   // Event IDs currently being generated
    this.processedEventIds = new Set();  // Firebase event IDs already detected (dedup)
    this.lastCommentaryTime = {};         // Per-tier throttle tracking
    this.onCommentary = onCommentary;     // Callback: (eventId, text, isLoading, synthetic) => void
    this.syntheticEvents = [];            // Standalone commentary events (lead changes, etc.)
    this._destroyed = false;

    // Throttle settings (milliseconds)
    this.TIER1_COOLDOWN = 30000;    // 30 seconds
    this.TIER2_COOLDOWN = 120000;   // 2 minutes
    this.MAX_COMMENTARY = 50;       // Max entries per battle
  }

  /**
   * Called every time battle state updates (from scoring interval or Firebase listener).
   * Compares previous state to detect new events worth commentating.
   */
  processStateUpdate(currentState) {
    if (this._destroyed) return;

    console.log('[ClashCast] processStateUpdate called', {
      hasEvents: !!currentState.events,
      eventCount: currentState.events?.length || 0,
      hasPreviousState: !!this.previousState,
      prevEventCount: this.previousState?.events?.length || 0,
    });

    if (!this.previousState) {
      this.previousState = { ...currentState };
      this._triggerCommentary(
        `battle_start_${Date.now()}`,
        { type: 'BATTLE_START' },
        currentState,
        true // synthetic
      );
      return;
    }

    const events = this._detectEvents(this.previousState, currentState);

    console.log('[ClashCast] Detected events:', events.length, events.map(e => ({ type: e.type, asset: e.asset, eventId: e.eventId })));

    for (const event of events) {
      if (this._shouldGenerateCommentary(event)) {
        const isSynthetic = !event.fromFirebase;
        this._triggerCommentary(
          event.eventId || `evt_${Date.now()}`,
          event,
          currentState,
          isSynthetic
        );
      }
    }

    this.previousState = { ...currentState };
  }

  /** Check if a specific event has commentary. */
  getCommentary(eventId) {
    return this.commentaryMap.get(eventId) || null;
  }

  /** Check if commentary is currently being generated for an event. */
  isGenerating(eventId) {
    return this.pendingCommentary.has(eventId);
  }

  /** Get synthetic events (lead changes, session transitions, etc.) */
  getSyntheticEvents() {
    return [...this.syntheticEvents];
  }

  // ── Event Detection ──────────────────────────────────────────

  _detectEvents(prev, current) {
    const events = [];

    // --- BREAKOUT DETECTION (Set-based — robust against reordering/duplicates) ---
    const currentEvents = current.events || [];

    console.log('[ClashCast] _detectEvents scanning:', {
      currentEventsLength: currentEvents.length,
      processedIds: this.processedEventIds.size,
    });

    for (const evt of currentEvents) {
      const eventId = evt.id;

      // Skip events without an ID (can't track them)
      if (!eventId) {
        console.warn('[ClashCast] Event missing id:', { symbol: evt.symbol, type: evt.type });
        continue;
      }

      // Already processed — skip
      if (this.processedEventIds.has(eventId)) continue;

      // Skip redzone/approaching events — they don't get commentary
      if (evt.type === 'redzone' || evt.type === 'approaching') continue;

      // Skip swap events — handled separately by SUBSTITUTION detection below
      if (evt.type === 'swap') continue;

      this.processedEventIds.add(eventId);

      const classifiedType = this._classifyBreakoutEvent(evt);

      console.log('[ClashCast] New breakout event detected:', {
        eventId,
        symbol: evt.symbol,
        type: classifiedType,
        originalType: evt.thresholdName || evt.type,
        points: evt.points,
      });

      events.push({
        eventId: eventId,
        type: classifiedType,
        asset: evt.symbol,
        player: evt.player,
        playerName: evt.player === 'creator' ? current.creatorName : current.opponentName,
        opponentName: evt.player === 'creator' ? current.opponentName : current.creatorName,
        pointsAwarded: evt.points || 15,
        assetMove: evt.movePercent ? `${evt.movePercent > 0 ? '+' : ''}${evt.movePercent.toFixed(1)}%` : null,
        threshold: evt.threshold ? `${evt.threshold}%` : null,
        tier: evt.portfolioTier || null,
        fromFirebase: true,
      });
    }

    // --- LEAD CHANGE DETECTION ---
    const prevLeader = (prev.creatorScore || 0) > (prev.opponentScore || 0) ? 'creator'
      : (prev.opponentScore || 0) > (prev.creatorScore || 0) ? 'opponent' : 'tied';
    const currentLeader = (current.creatorScore || 0) > (current.opponentScore || 0) ? 'creator'
      : (current.opponentScore || 0) > (current.creatorScore || 0) ? 'opponent' : 'tied';

    if (prevLeader !== currentLeader && currentLeader !== 'tied' && prevLeader !== 'tied') {
      const diff = Math.abs((current.creatorScore || 0) - (current.opponentScore || 0));
      events.push({
        eventId: `lead_change_${Date.now()}`,
        type: 'LEAD_CHANGE',
        player: currentLeader,
        playerName: currentLeader === 'creator' ? current.creatorName : current.opponentName,
        opponentName: currentLeader === 'creator' ? current.opponentName : current.creatorName,
        scoreDifferential: diff,
      });
    }

    // --- SESSION TRANSITION ---
    if (prev.currentSession !== current.currentSession && current.currentSession) {
      events.push({
        eventId: `session_${current.currentSession}_${Date.now()}`,
        type: 'SESSION_TRANSITION',
        previousSession: prev.currentSession,
        newSession: current.currentSession,
        playerName: current.creatorName,
        opponentName: current.opponentName,
      });
    }

    // --- COMEBACK DETECTION ---
    const prevGap = Math.abs((prev.creatorScore || 0) - (prev.opponentScore || 0));
    const currentGap = Math.abs((current.creatorScore || 0) - (current.opponentScore || 0));
    if (prevGap > 25 && currentGap < 10 && currentGap > 0) {
      const comebackPlayer = (prev.creatorScore || 0) < (prev.opponentScore || 0) ? 'creator' : 'opponent';
      events.push({
        eventId: `comeback_${Date.now()}`,
        type: 'COMEBACK',
        player: comebackPlayer,
        playerName: comebackPlayer === 'creator' ? current.creatorName : current.opponentName,
        opponentName: comebackPlayer === 'creator' ? current.opponentName : current.creatorName,
        previousGap: prevGap,
        currentGap: currentGap,
      });
    }

    // --- SUBSTITUTION/SWAP DETECTION ---
    const prevSwapCount = (prev.events || []).filter(e => e.type === 'swap').length;
    const currentSwapCount = (current.events || []).filter(e => e.type === 'swap').length;
    if (currentSwapCount > prevSwapCount) {
      const swapEvents = (current.events || []).filter(e => e.type === 'swap');
      const newSwap = swapEvents[swapEvents.length - 1];
      if (newSwap) {
        events.push({
          eventId: `sub_${Date.now()}`,
          type: 'SUBSTITUTION',
          player: newSwap.player,
          playerName: newSwap.player === 'creator' ? current.creatorName : current.opponentName,
          asset: newSwap.addedSymbol || newSwap.symbol,
          removedAsset: newSwap.removedSymbol,
        });
      }
    }

    return events;
  }

  _classifyBreakoutEvent(evt) {
    // Direct mapping from known type names
    const mapped = TYPE_MAP[evt.type] || TYPE_MAP[evt.thresholdName];
    if (mapped) return mapped;

    // Normalized string matching for legacy/variant names
    const raw = (evt.thresholdName || evt.type || '').toLowerCase().replace(/[_\s-]/g, '');
    if (raw.includes('tenbagger') || raw.includes('moonshot')) return 'TENBAGGER';
    if (raw.includes('doublebagger') || raw.includes('rally')) return 'DOUBLE_BAGGER';
    if (raw.includes('bagger') || raw.includes('breakout')) return 'BAGGERBOMB';
    if (raw.includes('meltdown')) return 'MELTDOWN';
    if (raw.includes('crash')) return 'CRASH';
    if (raw.includes('bust')) return 'BUST';

    // Fallback: classify by multiplier/badge/points
    const isPositive = (evt.points || 0) > 0 || evt.multiplier > 0;
    if (isPositive) {
      if (evt.multiplier >= 2.0 || evt.badge === 'TENBAGGER') return 'TENBAGGER';
      if (evt.multiplier >= 1.5 || evt.badge === 'DOUBLE_BAGGER') return 'DOUBLE_BAGGER';
      return 'BAGGERBOMB';
    } else {
      if (evt.multiplier >= 2.0 || evt.badge === 'MELTDOWN') return 'MELTDOWN';
      if (evt.multiplier >= 1.5 || evt.badge === 'CRASH') return 'CRASH';
      return 'BUST';
    }
  }

  // ── Throttle Logic ───────────────────────────────────────────

  _shouldGenerateCommentary(event) {
    if (this.commentaryLog.length >= this.MAX_COMMENTARY) {
      console.log('[ClashCast] _shouldGenerateCommentary: MAX reached', { type: event.type, logLength: this.commentaryLog.length });
      return false;
    }

    // Bypass throttle for critical events
    if (BYPASS_THROTTLE.includes(event.type)) {
      console.log('[ClashCast] _shouldGenerateCommentary: BYPASS', { type: event.type });
      return true;
    }

    const now = Date.now();
    const tier = this._getEventTier(event.type);
    const cooldown = tier === 1 ? this.TIER1_COOLDOWN : tier === 2 ? this.TIER2_COOLDOWN : 0;
    const lastTime = this.lastCommentaryTime[tier] || 0;

    if (now - lastTime < cooldown) {
      console.log('[ClashCast] _shouldGenerateCommentary: THROTTLED', { type: event.type, tier, cooldownRemaining: cooldown - (now - lastTime) });
      return false;
    }

    console.log('[ClashCast] _shouldGenerateCommentary: APPROVED', { type: event.type, tier });
    return true;
  }

  _getEventTier(type) {
    if (TIER1_TYPES.includes(type)) return 1;
    if (TIER2_TYPES.includes(type)) return 2;
    return 3;
  }

  // ── Commentary Generation ────────────────────────────────────

  async _triggerCommentary(eventId, event, battleState, isSynthetic = false) {
    if (this._destroyed) return;

    console.log('[ClashCast] TRIGGERING commentary:', { eventId, type: event.type, asset: event.asset, isSynthetic });

    const tier = this._getEventTier(event.type);
    this.lastCommentaryTime[tier] = Date.now();
    this.pendingCommentary.add(eventId);

    // Notify UI: loading state
    this.onCommentary(eventId, null, true, isSynthetic ? this._buildSyntheticEvent(eventId, event) : null);

    try {
      const response = await fetch('/api/battle-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            type: event.type,
            asset: event.asset || null,
            player: event.player || null,
            playerName: event.playerName || battleState.creatorName,
            opponentName: event.opponentName || battleState.opponentName,
            pointsAwarded: event.pointsAwarded || null,
            assetMove: event.assetMove || null,
            threshold: event.threshold || null,
            tier: event.tier || null,
            newSession: event.newSession || null,
            removedAsset: event.removedAsset || null,
            scoreDifferential: event.scoreDifferential || null,
            currentGap: event.currentGap || null,
          },
          battleState: {
            creatorScore: battleState.creatorScore || 0,
            opponentScore: battleState.opponentScore || 0,
            creatorName: battleState.creatorName || 'Player 1',
            opponentName: battleState.opponentName || 'Player 2',
            currentSession: battleState.currentSession || null,
            sessionTimeRemaining: battleState.sessionTimeRemaining || null,
            sessionsCompleted: battleState.sessionsCompleted || [],
            leadChanges: battleState.leadChanges || 0,
            scoreDifferential: (battleState.creatorScore || 0) - (battleState.opponentScore || 0),
            leader: (battleState.creatorScore || 0) > (battleState.opponentScore || 0) ? 'creator' : 'opponent',
          },
          recentCommentary: this.commentaryLog.slice(-3),
        }),
      });

      if (this._destroyed) return;

      const data = await response.json();
      const commentaryText = data.commentary || this._getFallbackCommentary(event, battleState);

      this._deliverCommentary(eventId, event, commentaryText, isSynthetic);
    } catch (error) {
      if (this._destroyed) return;
      console.error('[ClashCast] Commentary generation failed:', error);
      const fallbackText = this._getFallbackCommentary(event, battleState);
      this._deliverCommentary(eventId, event, fallbackText, isSynthetic);
    }
  }

  _deliverCommentary(eventId, event, commentaryText, isSynthetic) {
    console.log('[ClashCast] DELIVERED commentary:', { eventId, type: event.type, textLength: commentaryText?.length, isSynthetic });
    this.commentaryMap.set(eventId, commentaryText);
    this.commentaryLog.push({
      type: event.type,
      asset: event.asset,
      playerName: event.playerName,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      commentary: commentaryText,
    });

    this.pendingCommentary.delete(eventId);

    // For synthetic events, update the stored synthetic event with commentary text
    const syntheticEvent = isSynthetic ? this._buildSyntheticEvent(eventId, event, commentaryText) : null;
    if (isSynthetic) {
      // Replace or add synthetic event
      const idx = this.syntheticEvents.findIndex(e => e.id === eventId);
      if (idx >= 0) {
        this.syntheticEvents[idx] = syntheticEvent;
      } else {
        this.syntheticEvents.push(syntheticEvent);
      }
    }

    this.onCommentary(eventId, commentaryText, false, syntheticEvent);
  }

  _buildSyntheticEvent(eventId, event, commentary = null) {
    return {
      id: eventId,
      type: event.type,
      timestamp: new Date().toISOString(),
      symbol: event.asset || null,
      player: event.playerName || null,
      points: 0,
      isSynthetic: true,
      commentary: commentary,
    };
  }

  _getFallbackCommentary(event) {
    const templateFn = FALLBACK_TEMPLATES[event.type];
    if (templateFn) return templateFn(event);
    return 'Something just happened in this battle!';
  }

  getLog() {
    return [...this.commentaryLog];
  }

  destroy() {
    this._destroyed = true;
    this.commentaryMap.clear();
    this.commentaryLog = [];
    this.pendingCommentary.clear();
    this.processedEventIds.clear();
    this.syntheticEvents = [];
    this.previousState = null;
  }
}
