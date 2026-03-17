// AgentDashboard.jsx — Placeholder shell (Phase B-1)
// Full implementation comes in Phase B-2
import { useTheme } from '../../contexts/ThemeContext';

const AgentDashboard = ({ user, setScreen }) => {
  const { tokens } = useTheme();

  return (
    <div style={{
      minHeight: '100vh',
      background: tokens.bgAgent || '#1C1A27',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '16px',
      padding: '40px 20px',
    }}>
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${tokens.teal || '#5eead4'}, ${tokens.purple || '#9333ea'})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
        fontWeight: '700',
        color: '#fff',
      }}>
        A
      </div>
      <div style={{
        fontSize: '22px',
        fontWeight: '700',
        color: tokens.textWhite || '#e6edf3',
        letterSpacing: '-0.02em',
      }}>
        Agent Dashboard
      </div>
      <div style={{
        fontSize: '14px',
        color: tokens.textSecondary || '#8b949e',
        textAlign: 'center',
        maxWidth: '320px',
        lineHeight: '1.6',
      }}>
        Your AI trading agent will live here. Full build coming in Phase B-2.
      </div>
      <div style={{
        fontSize: '11px',
        color: tokens.textMuted || '#6e7681',
        marginTop: '8px',
      }}>
        User: {user?.username || user?.displayName || 'Unknown'} · UID: {user?.odUserId?.slice(0, 8) || 'N/A'}...
      </div>
    </div>
  );
};

export default AgentDashboard;
