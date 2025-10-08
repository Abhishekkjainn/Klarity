import React from 'react';

const HistoryGrid = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="chart-placeholder">Loading history...</div>;
  }

  return (
    <div className="history-grid-container">
      <h3>90-Day History</h3>
      <div className="history-grid">
        {data.map((day, index) => {
          let statusClass = '';
          if (day.status === 'all_up') statusClass = 'up';
          if (day.status === 'downtime') statusClass = 'down';

          const date = new Date(day.day);
          const tooltip = `${date.toLocaleDateString()}: ${day.status.replace('_', ' ')}`;

          return (
            <div key={index} className={`history-day ${statusClass}`} title={tooltip}></div>
          );
        })}
      </div>
       <div className="legend">
        <div className="legend-item"><span className="history-day up"></span> Healthy</div>
        <div className="legend-item"><span className="history-day down"></span> Downtime</div>
        <div className="legend-item"><span className="history-day"></span> No Data</div>
      </div>
    </div>
  );
};

export default HistoryGrid;