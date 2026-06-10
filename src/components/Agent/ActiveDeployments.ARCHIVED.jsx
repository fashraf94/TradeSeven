import React from 'react';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import useActiveDeployments from '../../hooks/useActiveDeployments';
import DeploymentCard from './DeploymentCard';

const SectionHeader = ({ label }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  }}>
    <div style={{
      width: 3,
      height: 16,
      background: 'linear-gradient(180deg, #00d9ff, #A855F7)',
      borderRadius: 2,
    }} />
    <Radio size={14} color="#8B949E" />
    <span style={{
      fontSize: 13,
      fontWeight: 700,
      color: '#8B949E',
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
    }}>
      {label}
    </span>
  </div>
);

const SkeletonCard = () => (
  <div style={{
    height: 72,
    borderRadius: 10,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(139, 148, 158, 0.15)',
    animation: 'deploymentShimmer 1.6s ease-in-out infinite',
  }} />
);

const shimmerKeyframes = `
  @keyframes deploymentShimmer {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
`;

const ActiveDeployments = ({ agentId, onOpenBattle, isDesktop }) => {
  const { deployments, loading } = useActiveDeployments(agentId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <SectionHeader label="Active Deployments" />
      <style>{shimmerKeyframes}</style>

      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
          gap: 12,
        }}>
          <SkeletonCard />
          {isDesktop && <SkeletonCard />}
        </div>
      ) : deployments.length === 0 ? (
        <div style={{
          padding: '20px 16px',
          borderRadius: 10,
          border: '1px dashed rgba(139, 148, 158, 0.3)',
          textAlign: 'center',
          color: '#8B949E',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          No active deployments. Deploy your agent to start competing.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop && deployments.length > 1 ? '1fr 1fr' : '1fr',
          gap: 12,
        }}>
          {deployments.map((battle, index) => (
            <DeploymentCard
              key={battle.id}
              battle={battle}
              onTap={onOpenBattle}
              isDesktop={isDesktop}
              index={index}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ActiveDeployments;
