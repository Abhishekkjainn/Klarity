import React from 'react';

const formatDuration = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

const IncidentsList = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No downtime incidents recorded in this period. Great job!</p>;
  }

  return (
    <div>
      <h3>Downtime Incidents</h3>
      <div className="incidents-list">
        {data.map((incident, index) => (
          <div key={index} className="incident-item">
            <p><strong>Started:</strong> {new Date(incident.start_time).toLocaleString()}</p>
            <p><strong>Ended:</strong> {incident.end_time ? new Date(incident.end_time).toLocaleString() : 'Ongoing'}</p>
            <p><strong>Duration:</strong> {formatDuration(incident.duration_seconds)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IncidentsList;