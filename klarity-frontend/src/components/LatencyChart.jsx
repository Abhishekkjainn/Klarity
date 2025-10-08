import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LatencyChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="chart-placeholder">Not enough data for latency chart.</div>;
  }
  
  const formattedData = data.map(item => ({
    ...item,
    // Format the timestamp for display on the chart's X-axis
    time_bucket: new Date(item.time_bucket).toLocaleTimeString(),
  }));

  return (
    <div className="chart-container">
      <h3>Response Time (ms)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time_bucket" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1f2937', 
              border: '1px solid #4b5563', 
              borderRadius: '8px' 
            }} 
            labelStyle={{ color: '#f9fafb' }}
          />
          <Line type="monotone" dataKey="avg_latency" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LatencyChart;