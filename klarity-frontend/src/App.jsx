import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';
import RegisterPage from './pages/RegisterPage';
import MonitorDetailPage from './pages/MonitorDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route for Login */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />}/>

        <Route 
          path="/monitors/:monitorId" 
          element={
            <ProtectedRoute>
              <MonitorDetailPage />
            </ProtectedRoute>
          } 
        />

        {/* Protected Route for Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Redirect any other path to the dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;