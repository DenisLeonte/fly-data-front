import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import type { Flight, Aggregation, SystemStatus, Insights } from './types/types';
import { Plane, Activity, Database, Download, Play, Square, RefreshCw } from 'lucide-react';

const REFRESH_INTERVAL = 90;

const CircularTimer = ({ countdown, total, isLoading }: { countdown: number, total: number, isLoading: boolean }) => {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (countdown / total) * circumference;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px' }}>
        <div style={{ animation: 'spin 1s linear infinite', display: 'flex' }}>
            <RefreshCw size={20} color="#2563eb" />
        </div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="36" height="36" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          stroke="#e5e7eb"
          strokeWidth="3"
          fill="transparent"
          r={radius}
          cx="18"
          cy="18"
        />
        <circle
          stroke="#2563eb"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx="18"
          cy="18"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span style={{ position: 'absolute', fontSize: '10px', fontWeight: 'bold', color: '#374151' }}>
        {countdown}
      </span>
    </div>
  );
};

// New Heatmap Component
const MobilityHeatmap = ({ data }: { data: Aggregation[] }) => {
  // Extract all unique regions from sources and targets
  const regions = Array.from(new Set([
    ...data.map(d => d.source_region),
    ...data.map(d => d.target_region || 'Unknown')
  ])).sort();

  if (regions.length === 0) return <div style={{color: '#9ca3af', textAlign: 'center', padding: '2rem'}}>No aggregation data available</div>;

  // Create a lookup map for counts: "Source|Target" -> count
  const countMap = new Map<string, number>();
  let maxCount = 0;
  data.forEach(d => {
    const key = `${d.source_region}|${d.target_region || 'Unknown'}`;
    countMap.set(key, d.flight_count);
    if (d.flight_count > maxCount) maxCount = d.flight_count;
  });

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem', width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${regions.length}, 1fr)`, gap: '4px', width: '100%', minWidth: '100%' }}>
        {/* Header Row */}
        <div style={{ fontWeight: 'bold', padding: '8px', fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'end', justifyContent: 'center' }}>Origin \ Dest</div>
        {regions.map(r => (
          <div key={`h-${r}`} style={{ fontWeight: 'bold', padding: '8px', fontSize: '0.75rem', textAlign: 'center', color: '#374151', justifySelf: 'center' }}>
            {r}
          </div>
        ))}

        {/* Data Rows */}
        {regions.map(source => (
          <React.Fragment key={`row-${source}`}>
            {/* Row Label */}
            <div style={{ fontWeight: 'bold', padding: '8px', fontSize: '0.75rem', color: '#374151', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
              {source}
            </div>
            
            {/* Cells */}
            {regions.map(target => {
              const count = countMap.get(`${source}|${target}`) || 0;
              const intensity = maxCount > 0 ? count / maxCount : 0;
              
              return (
                <div 
                  key={`${source}-${target}`}
                  title={`${source} → ${target}: ${count} flights`}
                  style={{ 
                    background: `rgba(37, 99, 235, ${Math.max(intensity, 0.05)})`, // Base blue with dynamic opacity
                    color: intensity > 0.6 ? 'white' : '#1e3a8a',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    opacity: count > 0 ? 1 : 0.1, // Fade out empty cells
                    minHeight: '40px'
                  }}
                >
                  {count > 0 ? count : '-'}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'right' }}>
        * Intensity indicates flight volume (Max: {maxCount})
      </div>
    </div>
  );
};

// New Migration Radar Component
const MigrationRadar = ({ current, historical }: { current: Aggregation[], historical: Aggregation[] }) => {
  // 1. Calculate totals
  const totalCurrent = current.reduce((sum, d) => sum + d.flight_count, 0);
  const totalHistorical = historical.reduce((sum, d) => sum + d.flight_count, 0);

  if (totalCurrent === 0 || totalHistorical === 0) return null;

  // 2. Build Historical Share Map
  const historicalShare = new Map<string, number>();
  historical.forEach(d => {
    const key = `${d.source_region}|${d.target_region || 'Unknown'}`;
    // Average share across all years/records for this route
    // Note: If historical has multiple entries for same route (different years), we should sum them first?
    // For simplicity, we assume unique entries or we sum them up. 
    // Let's handle duplicate keys by summing.
    const existing = historicalShare.get(key) || 0;
    historicalShare.set(key, existing + d.flight_count);
  });
  
  // Normalize historical counts to shares (0 to 1)
  for (const [key, count] of historicalShare) {
    historicalShare.set(key, count / totalHistorical);
  }

  // 3. Analyze Current Flows
  const anomalies = current.map(d => {
    const key = `${d.source_region}|${d.target_region || 'Unknown'}`;
    const currentShare = d.flight_count / totalCurrent;
    const baselineShare = historicalShare.get(key) || 0;
    const deviation = currentShare - baselineShare; // Absolute difference in market share

    return {
      source: d.source_region,
      target: d.target_region || 'Local',
      currentShare,
      baselineShare,
      deviation
    };
  })
  .filter(d => d.deviation > 0.05) // Only show flows with >5% surge in share
  .sort((a, b) => b.deviation - a.deviation)
  .slice(0, 5); // Top 5

  return (
    <section style={{...cardStyle, gridColumn: '1 / -1'}}>
        <h2 style={cardTitleStyle}><Activity size={20} /> Migration Radar <span style={{fontSize:'0.8rem', color:'#6b7280', marginLeft:'auto'}}>Vs Historical Baseline</span></h2>
        
        {anomalies.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                {anomalies.map((item, i) => (
                    <div key={i} style={{ 
                        border: '1px solid #fee2e2', 
                        background: '#fef2f2', 
                        borderRadius: '8px', 
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: '#991b1b' }}>{item.source} ➝ {item.target}</span>
                            <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                +{(item.deviation * 100).toFixed(1)}% Surge
                            </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#7f1d1d' }}>
                            Currently <b>{(item.currentShare * 100).toFixed(1)}%</b> of all traffic
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>(Historical Avg: {(item.baselineShare * 100).toFixed(1)}%)</div>
                        </div>
                        <div style={{ width: '100%', background: '#fca5a5', height: '4px', borderRadius: '2px', marginTop: '4px' }}>
                            <div style={{ width: `${Math.min((item.deviation / 0.2) * 100, 100)}%`, background: '#b91c1c', height: '100%', borderRadius: '2px' }} />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
                No significant migration anomalies detected. Traffic flows are within historical norms.
            </div>
        )}
    </section>
  );
};

const App: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [realtimeFlights, setRealtimeFlights] = useState<Flight[]>([]);
  const [streamingData, setStreamingData] = useState<Aggregation[]>([]);
  const [batchData, setBatchData] = useState<Aggregation[]>([]); // New State
  const [insights, setInsights] = useState<Insights | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isToggling, setIsToggling] = useState(false);

  // Initial Data Load (Batch)
  useEffect(() => {
    api.getBatchRegions(1000).then(res => {
        setBatchData(res.data.data);
    }).catch(e => console.error("Failed to load batch history", e));
  }, []);

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [statusRes, streamRes, flightRes, insightRes] = await Promise.all([
        api.getStatus(),
        api.getStreaming(),
        api.getRealtime(),
        api.getInsights().catch(() => ({ data: null }))
      ]);

      setStatus(statusRes.data);
      setStreamingData(streamRes.data.data);
      setRealtimeFlights(flightRes.data.data);
      if (insightRes.data) setInsights(insightRes.data);
      setCountdown(REFRESH_INTERVAL);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, []);
// ... (rest of App)

  // Handle the 90s polling logic
  useEffect(() => {
    syncData(); // Initial fetch
  }, [syncData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      syncData();
      setCountdown(REFRESH_INTERVAL);
    }
  }, [countdown, syncData]);

  const toggleStreaming = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      if (status?.streaming_active) {
        await api.stopStreaming();
      } else {
        await api.startStreaming();
      }
      // Small delay to ensure backend state propagates if needed, though usually instant for the flag
      await new Promise(r => setTimeout(r, 500));
      await syncData();
    } catch (e) {
      console.error("Toggle failed", e);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#111827' }}>
          <Plane size={32} color="#2563eb" /> Air Traffic Mobility
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Visual Feedback Widget */}
            <div style={timerWidgetStyle}>
                <CircularTimer countdown={countdown} total={REFRESH_INTERVAL} isLoading={isSyncing} />
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', lineHeight: '1.2' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{isSyncing ? 'Updating Data...' : 'Next Update'}</span>
                    <span style={{ color: '#6b7280' }}>{isSyncing ? 'Please wait' : `in ${countdown} seconds`}</span>
                </div>
            </div>

            <div style={statusGroupStyle}>
            <div style={badgeStyle(status?.streaming_active)}>
                {status?.streaming_active ? 'Streaming Active' : 'Streaming Stopped'}
            </div>
            <button 
                style={{...buttonStyle, opacity: isToggling ? 0.7 : 1, cursor: isToggling ? 'wait' : 'pointer'}}
                onClick={toggleStreaming}
                disabled={isToggling}
            >
                {isToggling ? <RefreshCw size={16} className="animate-spin" /> : (status?.streaming_active ? <Square size={16} /> : <Play size={16} />)}
                {isToggling ? ' Processing...' : (status?.streaming_active ? ' Stop' : ' Start')}
            </button>
            <button onClick={api.exportCSV} style={secondaryButtonStyle}>
                <Download size={16} /> Export CSV
            </button>
            </div>
        </div>
      </header>

      <main style={gridStyle}>
        {/* Real-time Section - Powered by /api/realtime */}
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}><Activity size={20} /> Live Flights</h2>
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Callsign</th>
                  <th style={thStyle}>Origin Region</th>
                  <th style={thStyle}>Time</th>
                </tr>
              </thead>
              <tbody>
                {realtimeFlights.length > 0 ? realtimeFlights.map((f, i) => (
                  <tr key={i} style={trStyle}>
                    <td style={tdStyle}>{f.callsign}</td>
                    <td style={tdStyle}>{f.source_region}</td>
                    <td style={tdStyle}>{new Date(f.timestamp).toLocaleTimeString()}</td>
                  </tr>
                )) : (
                    <tr>
                        <td colSpan={3} style={{...tdStyle, textAlign: 'center', color: '#9ca3af'}}>No active flights detected</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Streaming Aggregates Section - Powered by /api/streaming */}
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}><Database size={20} /> Regional Mobility Matrix</h2>
          <MobilityHeatmap data={streamingData} />
        </section>
      </main>

      {/* Migration Radar - Powered by Batch vs Streaming comparison */}
      <div style={{ marginTop: '1.5rem' }}>
        <MigrationRadar current={streamingData} historical={batchData} />
      </div>

      {insights && (
        <section style={{...cardStyle, marginTop: '20px'}}>
          <h3 style={cardTitleStyle}>System Insights</h3>
          <pre style={preStyle}>{JSON.stringify(insights, null, 2)}</pre>
        </section>
      )}
    </div>
  );
};

// --- Styles ---
const containerStyle: React.CSSProperties = { padding: '2rem', margin: '0 auto', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh', boxSizing: 'border-box' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' };
const statusGroupStyle: React.CSSProperties = { display: 'flex', gap: '1rem', alignItems: 'center' };
const timerWidgetStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', background: '#ffffff', padding: '6px 12px', borderRadius: '24px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' };
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const cardTitleStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', color: '#111827' };
const tableWrapper: React.CSSProperties = { maxHeight: '400px', overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: '8px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle: React.CSSProperties = { padding: '12px', background: '#f9fafb', borderBottom: '2px solid #f3f4f6', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', position: 'sticky', top: 0 };
const tdStyle: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem', color: '#374151' };
const trStyle: React.CSSProperties = { transition: 'background 0.2s' };
const preStyle: React.CSSProperties = { background: '#1f2937', color: '#f3f4f6', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.875rem' };
const badgeStyle = (active?: boolean): React.CSSProperties => ({ padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', background: active ? '#def7ec' : '#fde8e8', color: active ? '#03543f' : '#9b1c1c' });
const buttonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' };
const secondaryButtonStyle: React.CSSProperties = { ...buttonStyle, background: '#fff', color: '#374151', border: '1px solid #d1d5db' };

export default App;