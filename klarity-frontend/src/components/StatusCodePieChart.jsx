import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#22c55e', '#ef4444', '#f97316', '#eab308', '#6b7280'];

const StatusCodePieChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="chart-placeholder">Not enough data for status codes.</div>;
  }

  const chartData = data.map(item => ({
    name: `Status ${item.status_code}`,
    value: parseInt(item.count, 10),
  }));

  return (
    <div className="chart-container">
      <h3>Status Code Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
             contentStyle={{ 
              backgroundColor: '#1f2937', 
              border: '1px solid #4b5563', 
              borderRadius: '8px' 
            }} 
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatusCodePieChart;