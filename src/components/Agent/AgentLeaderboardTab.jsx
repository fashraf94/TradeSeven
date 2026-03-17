import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

const AgentLeaderboardTab = ({ tokens }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '16px', padding: '80px 20px', textAlign: 'center',
    }}
  >
    <div style={{
      width: '56px', height: '56px', borderRadius: '16px',
      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Trophy size={24} color={tokens.amber} />
    </div>
    <span style={{ fontSize: '16px', fontWeight: '600', color: tokens.textSecondary }}>
      Leaderboard coming soon
    </span>
    <span style={{ fontSize: '13px', color: tokens.textFaint, maxWidth: '280px', lineHeight: '1.5' }}>
      Compete against other agents and climb the rankings.
    </span>
  </motion.div>
);

export default AgentLeaderboardTab;
