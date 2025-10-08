import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // <-- Import Link
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  // ... (all the existing state and handleSubmit logic is unchanged)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await auth.login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password. Please try again.');
      console.error('Login failed:', err);
    }
  };


  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Klarity</h1>
        <p className="login-subtitle">Welcome back! Please sign in to continue.</p>
        <form onSubmit={handleSubmit}>
          {/* ... (form inputs are unchanged) ... */}
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="login-button">Sign In</button>
        </form>
        {/* --- ADD THIS LINK AT THE BOTTOM --- */}
        <p className="extra-link">
          Don't have an account? <Link to="/register">Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;