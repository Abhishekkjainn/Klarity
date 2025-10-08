import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import LatencyChart from '../components/LatencyChart';
import StatusCodePieChart from '../components/StatusCodePieChart';
import IncidentsList from '../components/IncidentsList';
import HistoryGrid from '../components/HistoryGrid'; // <-- Import new component

// ... (ErrorBreakdown and ChecksLog components are unchanged)
const ErrorBreakdown = ({ data }) => { if (!data || data.length === 0) { return <div className="chart-placeholder">No errors recorded in this period.</div>; } return ( <div className="chart-container"><h3>Top Errors (Last 30d)</h3><ul className="error-list">{data.map((item, index) => ( <li key={index}><span className="error-message-text">{item.error}</span><span className="error-count">{item.count}</span></li> ))}</ul></div> ) };
const ChecksLog = ({ data }) => ( <div><h3>Recent Checks</h3><div className="checks-log-table"><div className="checks-log-header"><span>Status</span><span>Status Code</span><span>Latency</span><span>Timestamp</span></div>{data.map(check => ( <div key={check.id} className="checks-log-row"><span><span className={`status-dot ${check.was_successful ? 'up' : 'down'}`}></span>{check.was_successful ? 'Up' : 'Down'}</span><span>{check.status_code || 'N/A'}</span><span>{check.response_time_ms}ms</span><span title={check.error_message || ''}>{new Date(check.timestamp).toLocaleString()}</span></div> ))}</div></div> );

// New component for showing monitor configuration
const ConfigurationDetails = ({ monitor }) => (
  <div className="config-card">
    <h3>Configuration</h3>
    <div className="config-details">
      <p><strong>Check Interval:</strong> {monitor.check_interval_seconds} seconds</p>
      <p><strong>Status:</strong> {monitor.is_active ? 'Active' : 'Paused'}</p>
      <p><strong>Expected Status:</strong> {monitor.expected_status_code || 'Any 2xx'}</p>
      <p><strong>Expected Body:</strong> {monitor.expected_response_body || 'Not set'}</p>
    </div>
  </div>
);

const MonitorDetailPage = () => {
  const { monitorId } = useParams();
  const [monitor, setMonitor] = useState(null);
  const [overview, setOverview] = useState(null);
  const [latencyData, setLatencyData] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [errorBreakdown, setErrorBreakdown] = useState([]);
  const [checks, setChecks] = useState([]);
  const [history, setHistory] = useState([]); // <-- New state for history
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!monitorId) return;
      
      setLoading(true);
      try {
        const responses = await Promise.allSettled([
          api.get(`/monitors/${monitorId}`),
          api.get(`/analytics/${monitorId}/overview?period=24h`),
          api.get(`/analytics/${monitorId}/latency-series?period=24h`),
          api.get(`/analytics/${monitorId}/incidents?period=30d`),
          api.get(`/analytics/${monitorId}/error-breakdown?period=30d`),
          api.get(`/analytics/${monitorId}/checks?limit=15`),
          api.get(`/analytics/${monitorId}/history`), // <-- Fetch history data
        ]);
        
        if (responses[0].status === 'fulfilled') setMonitor(responses[0].value.data.data.monitor);
        if (responses[1].status === 'fulfilled') setOverview(responses[1].value.data.data);
        if (responses[2].status === 'fulfilled') setLatencyData(responses[2].value.data.data);
        if (responses[3].status === 'fulfilled') setIncidents(responses[3].value.data.data);
        if (responses[4].status === 'fulfilled') setErrorBreakdown(responses[4].value.data.data);
        if (responses[5].status === 'fulfilled') setChecks(responses[5].value.data.data);
        if (responses[6].status === 'fulfilled') setHistory(responses[6].value.data.data); // <-- Set history state

      } catch (error) {
        console.error("Failed to fetch monitor details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [monitorId]);

  if (loading) { return <div>Loading monitor data...</div>; }
  if (!monitor) { return <div>Could not load monitor data.</div>; }

  return (
    <div className="page-container">
      <Header />
      <main className="detail-main">
        <div className="detail-header">
          <Link to="/dashboard" className="back-link">&larr; Back to Dashboard</Link>
          <div className="detail-title-status">
            <h1>{monitor.name}</h1>
            <span className={`status-badge ${monitor.current_status}`}>{monitor.current_status}</span>
          </div>
          <p className="detail-url">{`${monitor.http_method} ${monitor.base_url}${monitor.endpoint}`}</p>
        </div>

        <div className="stats-grid">
          <StatCard title="Uptime (24h)" value={overview?.uptimePercentage} unit="%" />
          <StatCard title="Avg. Latency (24h)" value={overview?.averageLatency} unit="ms" />
          <StatCard title="P95 Latency (24h)" value={overview?.p95Latency} unit="ms" />
          <StatCard title="P99 Latency (24h)" value={overview?.p99Latency} unit="ms" />
          <StatCard title="Total Checks (24h)" value={overview?.totalChecks} />
          <StatCard title="Failures (24h)" value={overview?.totalFailures} />
        </div>

        <div className="top-row-grid">
           <LatencyChart data={latencyData} />
           <HistoryGrid data={history} />
        </div>

        <div className="charts-grid">
          <StatusCodePieChart data={overview?.statusCounts} />
          <ErrorBreakdown data={errorBreakdown} />
          <ConfigurationDetails monitor={monitor} />
        </div>
        
        <div className="logs-grid">
          <div className="incidents-container">
            <IncidentsList data={incidents} />
          </div>
          <div className="checks-log-container">
            <ChecksLog data={checks} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default MonitorDetailPage;