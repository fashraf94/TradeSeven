import React from 'react';
import { motion } from 'framer-motion';
import { Hammer, ArrowRight, Shield } from 'lucide-react';
import HoloCard from '../shared/HoloCard';

const GOLD = '#F0C75E';

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
      background: `linear-gradient(180deg, ${GOLD}, #A855F7)`,
      borderRadius: 2,
    }} />
    <Hammer size={14} color="#8B949E" />
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

const formatLeverValue = (value) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') {
    // Preserve integers, round floats to 2 decimals
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (Array.isArray(value)) return value.slice(0, 3).join(', ') + (value.length > 3 ? '…' : '');
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 40);
  return String(value);
};

const humanizeKey = (key) => key
  .replace(/([A-Z])/g, ' $1')
  .replace(/_/g, ' ')
  .replace(/^./, c => c.toUpperCase())
  .trim();

const DeployedStrategyCard = ({ agent, onNavigateToForge }) => {
  const deployed = agent?.deployedStrategy || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <SectionHeader label="Deployed Strategy" />

      <HoloCard
        variant="default"
        size="lg"
        style={{
          borderLeft: `3px solid ${GOLD}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {deployed ? (
          <>
            {/* Strategy name + forge score */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#E6EDF3',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {deployed.experimentName || 'Untitled strategy'}
                </div>
                {deployed.deployedAt && (
                  <div style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#8B949E',
                    marginTop: 4,
                  }}>
                    Deployed {new Date(deployed.deployedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              {typeof deployed.forgeScore === 'number' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: GOLD,
                    fontFamily: 'monospace',
                    lineHeight: 1,
                  }}>
                    {deployed.forgeScore.toFixed(1)}
                  </span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#8B949E',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginTop: 2,
                  }}>
                    Forge Score
                  </span>
                </div>
              )}
            </div>

            {/* Top lever values (up to 4) */}
            {deployed.dimensionValues && (() => {
              const levers = Object.entries(deployed.dimensionValues)
                .filter(([k]) => !k.startsWith('_'))
                .slice(0, 4);
              if (levers.length === 0) return null;
              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(139, 148, 158, 0.15)',
                }}>
                  {levers.map(([key, value]) => (
                    <div key={key} style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#8B949E',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {humanizeKey(key)}
                      </div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#E6EDF3',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatLeverValue(value)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Guardrail count */}
            {Array.isArray(deployed.guardrails) && deployed.guardrails.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#8B949E',
              }}>
                <Shield size={12} color={GOLD} />
                <span>
                  {deployed.guardrails.length} active guardrail
                  {deployed.guardrails.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Modify CTA */}
            <button
              type="button"
              onClick={onNavigateToForge}
              disabled={!onNavigateToForge}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 0',
                border: 'none',
                background: 'transparent',
                color: GOLD,
                fontSize: 13,
                fontWeight: 700,
                cursor: onNavigateToForge ? 'pointer' : 'default',
                alignSelf: 'flex-start',
                fontFamily: 'inherit',
              }}
            >
              Modify in Forge <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#E6EDF3',
              lineHeight: 1.4,
            }}>
              No tested strategy deployed.
            </div>
            <div style={{
              fontSize: 13,
              color: '#8B949E',
              lineHeight: 1.5,
            }}>
              Visit the Forge to build and test your first algorithm.
            </div>
            <button
              type="button"
              onClick={onNavigateToForge}
              disabled={!onNavigateToForge}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                border: `1px solid ${GOLD}`,
                borderRadius: 8,
                background: `${GOLD}22`,
                color: GOLD,
                fontSize: 13,
                fontWeight: 700,
                cursor: onNavigateToForge ? 'pointer' : 'default',
                alignSelf: 'flex-start',
                fontFamily: 'inherit',
              }}
            >
              Go to Forge <ArrowRight size={14} />
            </button>
          </>
        )}
      </HoloCard>
    </motion.div>
  );
};

export default DeployedStrategyCard;
