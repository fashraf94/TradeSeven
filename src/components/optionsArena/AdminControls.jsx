/**
 * AdminControls
 * Admin-only controls for bot population and tournament management
 */

import React, { useState } from 'react';

const ADMIN_USERS = ['cam', 'flash', 'admin', 'test'];

const AdminControls = ({
  user,
  tournament,
  prices,
  onRefresh
}) => {
  const [isPopulating, setIsPopulating] = useState(false);

  // Only show for admin users
  if (!user || !ADMIN_USERS.includes(user.username?.toLowerCase())) {
    return null;
  }

  const handlePopulateBots = async () => {
    if (!tournament?.tournament) {
      alert('No active tournament');
      return;
    }

    if (!confirm('Populate tournament with 9 bot competitors?')) {
      return;
    }

    setIsPopulating(true);
    try {
      const { populateOptionsTournamentBots } = await import('../../services/optionsBotService');

      // Get current stock prices for bot portfolio generation
      const result = await populateOptionsTournamentBots(
        tournament.tournament.id,
        prices,  // Current stock prices from component state
        9  // Number of bots (you + 9 bots = 10 total)
      );

      alert(`🤖 Created ${result.botsCreated} bot competitors!\n\nRefresh the leaderboard to see them.`);

      // Refresh leaderboard
      onRefresh?.();

    } catch (err) {
      console.error('Error populating bots:', err);
      alert('Error: ' + err.message);
    } finally {
      setIsPopulating(false);
    }
  };

  const handleClearBots = async () => {
    if (!tournament?.tournament) return;

    if (!confirm('Remove all bot entries from this tournament?')) {
      return;
    }

    try {
      const { clearOptionsBots } = await import('../../services/optionsBotService');
      const count = await clearOptionsBots(tournament.tournament.id);
      alert(`🗑️ Removed ${count} bot entries`);
      onRefresh?.();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div style={{
      marginTop: '16px',
      padding: '16px',
      background: '#1a1a2e',
      borderRadius: '12px',
      border: '1px dashed #f59e0b'
    }}>
      <h4 style={{ color: '#f59e0b', margin: '0 0 12px 0', fontSize: '14px' }}>
        ⚙️ Admin Controls
      </h4>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handlePopulateBots}
          disabled={isPopulating || !tournament?.tournament}
          style={{
            padding: '10px 16px',
            background: '#7c3aed',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: '600',
            cursor: isPopulating ? 'not-allowed' : 'pointer',
            opacity: isPopulating || !tournament?.tournament ? 0.7 : 1
          }}
        >
          {isPopulating ? '⏳ Creating Bots...' : '🤖 Add 9 Bots'}
        </button>
        <button
          onClick={handleClearBots}
          disabled={!tournament?.tournament}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#ef4444',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          🗑️ Clear Bots
        </button>
      </div>
      <p style={{
        margin: '10px 0 0 0',
        fontSize: '11px',
        color: '#6b7280'
      }}>
        Bots will create varied portfolios with different strategies.
      </p>
    </div>
  );
};

export default AdminControls;
