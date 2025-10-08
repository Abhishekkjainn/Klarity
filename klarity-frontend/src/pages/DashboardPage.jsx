// import React, { useState, useEffect } from 'react';
// import { Link } from 'react-router-dom';
// import api from '../services/api';
// import Header from '../components/Header';
// import StatCard from '../components/StatCard';

// // This component can be moved to its own file in /components
// const MonitorListItem = ({ monitor }) => (
//   <Link to={`/monitors/${monitor.id}`} className="monitor-list-item">
//     <div className="status-dot-container">
//       <span className={`status-dot ${monitor.current_status}`}></span>
//     </div>
//     <div className="monitor-name">{monitor.name}</div>
//     <div className="monitor-url">{`${monitor.base_url}${monitor.endpoint}`}</div>
//     <div className="monitor-status">{monitor.current_status}</div>
//   </Link>
// );

// // A new component for the worst performers list
// const WorstPerformers = ({ monitors }) => (
//   <div className="worst-performers-card">
//     <h3>Worst Performers (Last 7d)</h3>
//     {monitors.length === 0 ? <p>No data available.</p> : (
//       <ul>
//         {monitors.map(monitor => (
//           <li key={monitor.id}>
//             <Link to={`/monitors/${monitor.id}`}>
//               <span>{monitor.name}</span>
//               <span>{monitor.uptimePercentage}% Uptime / {monitor.averageLatency}ms</span>
//             </Link>
//           </li>
//         ))}
//       </ul>
//     )}
//   </div>
// );


// const DashboardPage = () => {
//   const [stats, setStats] = useState(null);
//   const [monitors, setMonitors] = useState([]);
//   const [worstPerformers, setWorstPerformers] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         const [statsRes, monitorsRes, worstRes] = await Promise.allSettled([
//           api.get('/analytics/user/overview'),
//           api.get('/monitors'),
//           api.get('/analytics/user/worst-performers?period=7d'),
//         ]);

//         if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data);
//         if (monitorsRes.status === 'fulfilled') setMonitors(monitorsRes.value.data.data.monitors);
//         if (worstRes.status === 'fulfilled') setWorstPerformers(worstRes.value.data.data);

//       } catch (error) {
//         console.error("Failed to fetch dashboard data:", error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, []);

//   if (loading) {
//     return <div>Loading dashboard...</div>;
//   }

//   return (
//     <div className="page-container">
//       <Header />
//       <main className="dashboard-main">
//         <div className="stats-grid">
//           <StatCard title="Overall Uptime (24h)" value={stats?.uptimePercentageAll} unit="%" />
//           <StatCard title="Total Failures (24h)" value={stats?.totalFailuresAll} />
//           <StatCard title="Average Latency (24h)" value={stats?.averageLatencyAll} unit="ms" />
//           <StatCard title="Active Monitors" value={monitors.length} />
//         </div>
        
//         <div className="dashboard-columns">
//           <div className="monitors-list-container main-column">
//             <div className="list-header">
//               <h2>Your Monitors</h2>
//               <button className="add-monitor-btn">+ Add Monitor</button>
//             </div>
//             <div className="monitors-list">
//               {monitors.map(monitor => (
//                 <MonitorListItem key={monitor.id} monitor={monitor} />
//               ))}
//             </div>
//           </div>

//           <div className="sidebar-column">
//             <WorstPerformers monitors={worstPerformers} />
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default DashboardPage;


// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import AddMonitorModal from '../components/AddMonitorModal'; // <-- Import the modal
// import './DashboardPage.css';

// ... (MonitorListItem and WorstPerformers components are unchanged)
const MonitorListItem = ({ monitor }) => ( <Link to={`/monitors/${monitor.id}`} className="monitor-list-item"><div className="status-dot-container"><span className={`status-dot ${monitor.current_status}`}></span></div><div className="monitor-name">{monitor.name}</div><div className="monitor-url">{`${monitor.base_url}${monitor.endpoint}`}</div><div className="monitor-status">{monitor.current_status}</div></Link> );
const WorstPerformers = ({ monitors }) => ( <div className="worst-performers-card"><h3>Worst Performers (Last 7d)</h3>{monitors.length === 0 ? <p>No data available.</p> : (<ul>{monitors.map(monitor => ( <li key={monitor.id}><Link to={`/monitors/${monitor.id}`}><span>{monitor.name}</span><span>{monitor.uptimePercentage}% Uptime / {monitor.averageLatency}ms</span></Link></li>))}</ul>)}</div> );

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [worstPerformers, setWorstPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false); // <-- State for modal

  const fetchMonitors = async () => {
    try {
      const monitorsRes = await api.get('/monitors');
      setMonitors(monitorsRes.data.data.monitors);
    } catch (error) {
       console.error("Failed to fetch monitors:", error);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [statsRes, monitorsRes, worstRes] = await Promise.allSettled([
          api.get('/analytics/user/overview'),
          api.get('/monitors'),
          api.get('/analytics/user/worst-performers?period=7d'),
        ]);

        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data);
        if (monitorsRes.status === 'fulfilled') setMonitors(monitorsRes.value.data.data.monitors);
        if (worstRes.status === 'fulfilled') setWorstPerformers(worstRes.value.data.data);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);
  
  const handleMonitorCreated = (newMonitor) => {
    // Add the new monitor to the top of the list for a great UX
    setMonitors(prevMonitors => [newMonitor, ...prevMonitors]);
  };

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <>
      <div className="page-container">
        <Header />
        <main className="dashboard-main">
          <div className="stats-grid">
            {/* ... stats cards ... */}
            <StatCard title="Overall Uptime (24h)" value={stats?.uptimePercentageAll} unit="%" />
            <StatCard title="Total Failures (24h)" value={stats?.totalFailuresAll} />
            <StatCard title="Average Latency (24h)" value={stats?.averageLatencyAll} unit="ms" />
            <StatCard title="Active Monitors" value={monitors.length} />
          </div>
          
          <div className="dashboard-columns">
            <div className="monitors-list-container main-column">
              <div className="list-header">
                <h2>Your Monitors</h2>
                <button onClick={() => setIsModalOpen(true)} className="add-monitor-btn">
                  + Add Monitor
                </button>
              </div>
              <div className="monitors-list">
                {monitors.map(monitor => (
                  <MonitorListItem key={monitor.id} monitor={monitor} />
                ))}
              </div>
            </div>
            <div className="sidebar-column">
              <WorstPerformers monitors={worstPerformers} />
            </div>
          </div>
        </main>
      </div>

      {/* Conditionally render the modal */}
      {isModalOpen && (
        <AddMonitorModal 
          onClose={() => setIsModalOpen(false)} 
          onMonitorCreated={handleMonitorCreated}
        />
      )}
    </>
  );
};

export default DashboardPage;