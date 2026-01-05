import React, { useState, useEffect } from 'react';
import { FolderOpen, Clock, Trash2, ChevronRight, X } from 'lucide-react';
import { getRecentTemplates, deleteTemplate } from '../../services/templateService';

const TemplateLoader = ({ userId, onLoadTemplate, onClose }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [userId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await getRecentTemplates(userId, 10);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this template?')) return;

    try {
      await deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getRiskStyleEmoji = (style) => {
    const emojis = {
      aggressive: '🚀',
      balanced: '⚖️',
      conservative: '🛡️'
    };
    return emojis[style] || '📊';
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          color: '#8b949e'
        }}>
          Loading templates...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#161b22',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderOpen size={20} color="#00d9ff" />
            <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff' }}>Saved Templates</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {templates.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <FolderOpen size={48} color="#8b949e" style={{ marginBottom: '16px' }} />
            <p style={{ color: '#ffffff', marginBottom: '8px' }}>No saved templates yet</p>
            <p style={{ color: '#8b949e', fontSize: '13px' }}>
              Create a game plan and save it as a template for quick access
            </p>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {templates.map(template => (
              <div
                key={template.id}
                onClick={() => onLoadTemplate(template)}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #21262d',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#21262d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px'
                  }}>
                    <span style={{ fontSize: '16px' }}>{getRiskStyleEmoji(template.riskStyle)}</span>
                    <span style={{ fontWeight: '600', color: '#ffffff' }}>{template.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: '#21262d',
                      borderRadius: '10px',
                      fontSize: '11px',
                      color: '#8b949e',
                      textTransform: 'capitalize'
                    }}>
                      {template.riskStyle}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: '#21262d',
                      borderRadius: '10px',
                      fontSize: '11px',
                      color: '#8b949e'
                    }}>
                      {template.sectors?.length || 0} sectors
                    </span>
                    {template.mustHavePicks?.length > 0 && (
                      <span style={{
                        padding: '2px 8px',
                        backgroundColor: '#00d9ff20',
                        borderRadius: '10px',
                        fontSize: '11px',
                        color: '#00d9ff'
                      }}>
                        {template.mustHavePicks.length} picks
                      </span>
                    )}
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: '#8b949e'
                    }}>
                      <Clock size={10} />
                      {formatDate(template.updatedAt)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={(e) => handleDelete(template.id, e)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#8b949e',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#8b949e'}
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={18} color="#8b949e" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #21262d',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: '#21262d',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateLoader;
