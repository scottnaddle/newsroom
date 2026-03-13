/**
 * AgentControlPanel - Control panel for managing selected agent
 * 
 * Displays agent information, state controls, recent activities,
 * and performance statistics.
 */

import React, { useState, useEffect } from 'react';

export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  state: string;
  color: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  lastRun?: string;
  successCount: number;
  failureCount: number;
  totalProcessed: number;
  avgDurationMs: number;
  recentActivities: Array<{
    timestamp: string;
    action: string;
    result: string;
  }>;
}

interface AgentControlPanelProps {
  agent: AgentInfo | null;
  onStateChange?: (agentId: string, newState: string) => void;
  onRetry?: (agentId: string) => void;
  onTerminate?: (agentId: string) => void;
}

export const AgentControlPanel: React.FC<AgentControlPanelProps> = ({
  agent,
  onStateChange,
  onRetry,
  onTerminate
}) => {
  const [selectedState, setSelectedState] = useState<string>('idle');
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (agent) {
      setSelectedState(agent.state);
    }
  }, [agent]);

  if (!agent) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <p>Select an agent to view details</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'processing':
        return '#ff9800';
      case 'completed':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'idle':
      default:
        return '#9e9e9e';
    }
  };

  const getStateOptions = (): string[] => [
    'idle',
    'walking',
    'typing',
    'reading',
    'processing',
    'publishing',
    'error',
    'waiting'
  ];

  const successRate = agent.totalProcessed > 0
    ? ((agent.successCount / agent.totalProcessed) * 100).toFixed(1)
    : '0.0';

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    if (onStateChange) {
      onStateChange(agent.id, newState);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(agent.id);
    }
  };

  const handleTerminate = () => {
    if (onTerminate) {
      onTerminate(agent.id);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div
            style={{
              ...styles.colorDot,
              backgroundColor: agent.color
            }}
          />
          <div style={styles.headerInfo}>
            <h2 style={styles.title}>{agent.name}</h2>
            <p style={styles.subtitle}>{agent.type}</p>
          </div>
        </div>

        <div
          style={{
            ...styles.statusBadge,
            backgroundColor: getStatusColor(agent.status)
          }}
        >
          <span style={styles.statusText}>{agent.status.toUpperCase()}</span>
        </div>
      </div>

      {/* Main Info */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Current State</h3>
        <div style={styles.stateSelector}>
          <select
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
            style={styles.select}
          >
            {getStateOptions().map((state) => (
              <option key={state} value={state}>
                {state.charAt(0).toUpperCase() + state.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Statistics</h3>
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Processed</span>
            <span style={styles.statValue}>{agent.totalProcessed}</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Success Rate</span>
            <span style={styles.statValue}>{successRate}%</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Avg Duration</span>
            <span style={styles.statValue}>{agent.avgDurationMs}ms</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Failures</span>
            <span style={styles.statValue}>{agent.failureCount}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${successRate}%`,
              backgroundColor: '#4caf50'
            }}
          />
        </div>
      </div>

      {/* Recent Activities */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Recent Activities</h3>
        <div style={styles.activityList}>
          {agent.recentActivities.length > 0 ? (
            agent.recentActivities.slice(0, 5).map((activity, index) => (
              <div key={index} style={styles.activityItem}>
                <div style={styles.activityTime}>
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </div>
                <div style={styles.activityAction}>{activity.action}</div>
                <div style={styles.activityResult}>{activity.result}</div>
              </div>
            ))
          ) : (
            <p style={styles.noData}>No recent activities</p>
          )}
        </div>
      </div>

      {/* Last Run */}
      {agent.lastRun && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Last Run</h3>
          <p style={styles.infoText}>{new Date(agent.lastRun).toLocaleString()}</p>
        </div>
      )}

      {/* Controls */}
      <div style={styles.section}>
        <div style={styles.buttonGroup}>
          <button
            onClick={handleRetry}
            style={{
              ...styles.button,
              ...styles.buttonPrimary
            }}
          >
            🔄 Retry
          </button>
          <button
            onClick={handleTerminate}
            style={{
              ...styles.button,
              ...styles.buttonDanger
            }}
          >
            ⛔ Terminate
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    height: '100%',
    overflowY: 'auto',
    backgroundColor: '#f5f5f5',
    borderLeft: '1px solid #ddd',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '14px',
    color: '#333'
  },

  emptyState: {
    padding: '32px',
    textAlign: 'center',
    color: '#999'
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #ddd'
  },

  headerLeft: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    flex: 1
  },

  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    marginTop: '4px',
    flexShrink: 0
  },

  headerInfo: {
    flex: 1
  },

  title: {
    margin: '0 0 4px 0',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#000'
  },

  subtitle: {
    margin: '0',
    fontSize: '12px',
    color: '#666'
  },

  statusBadge: {
    padding: '4px 12px',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap'
  },

  statusText: {
    display: 'block'
  },

  section: {
    marginBottom: '20px',
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #e0e0e0'
  },

  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  stateSelector: {
    display: 'flex',
    gap: '8px'
  },

  select: {
    flex: 1,
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    backgroundColor: '#fff'
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '12px'
  },

  statItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    border: '1px solid #efefef'
  },

  statLabel: {
    fontSize: '11px',
    color: '#666',
    marginBottom: '4px'
  },

  statValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#000'
  },

  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    overflow: 'hidden'
  },

  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
    borderRadius: '4px'
  },

  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },

  activityItem: {
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    borderLeft: '3px solid #2196f3'
  },

  activityTime: {
    fontSize: '11px',
    color: '#999',
    marginBottom: '2px'
  },

  activityAction: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#000',
    marginBottom: '2px'
  },

  activityResult: {
    fontSize: '12px',
    color: '#666'
  },

  noData: {
    margin: '0',
    color: '#999',
    fontSize: '13px'
  },

  infoText: {
    margin: '0',
    color: '#333'
  },

  buttonGroup: {
    display: 'flex',
    gap: '8px'
  },

  button: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#fff'
  },

  buttonPrimary: {
    backgroundColor: '#2196f3',
    ':hover': {
      backgroundColor: '#1976d2'
    }
  },

  buttonDanger: {
    backgroundColor: '#f44336',
    ':hover': {
      backgroundColor: '#da190b'
    }
  }
};

export default AgentControlPanel;
