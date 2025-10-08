import React, { useState } from 'react';
import api from '../services/api';

const AddMonitorModal = ({ onClose, onMonitorCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    base_url: '',
    endpoint: '/',
    http_method: 'GET',
    check_interval_seconds: 300,
    notification_email: '',
    expected_status_code: '',
    expected_response_body: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Prepare data for the backend, converting empty strings to null for optional fields
    const payload = {
      ...formData,
      expected_status_code: formData.expected_status_code ? parseInt(formData.expected_status_code, 10) : null,
      expected_response_body: formData.expected_response_body || null,
      notification_email: formData.notification_email || null,
    };

    try {
      const response = await api.post('/monitors', payload);
      onMonitorCreated(response.data.data.monitor); // Pass the new monitor back to the dashboard
      onClose(); // Close the modal on success
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create monitor. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Monitor</h2>
          <button onClick={onClose} className="close-button">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Monitor Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., Production API" required />
          </div>
          <div className="form-group-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Method</label>
              <select name="http_method" value={formData.http_method} onChange={handleChange}>
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 3 }}>
              <label>Base URL</label>
              <input type="url" name="base_url" value={formData.base_url} onChange={handleChange} placeholder="https://api.example.com" required />
            </div>
          </div>
          <div className="form-group">
            <label>Endpoint</label>
            <input type="text" name="endpoint" value={formData.endpoint} onChange={handleChange} placeholder="/v1/health" required />
          </div>
          <div className="form-group">
            <label>Check Interval</label>
            <select name="check_interval_seconds" value={formData.check_interval_seconds} onChange={handleChange}>
              <option value={60}>Every 1 minute</option>
              <option value={300}>Every 5 minutes</option>
              <option value={600}>Every 10 minutes</option>
              <option value={1800}>Every 30 minutes</option>
            </select>
          </div>
          <p className="advanced-options-title">Advanced (Optional)</p>
          <div className="advanced-options">
            <div className="form-group">
              <label>Alert Email</label>
              <input type="email" name="notification_email" value={formData.notification_email} onChange={handleChange} placeholder="Defaults to your account email" />
            </div>
            <div className="form-group-row">
              <div className="form-group">
                <label>Expected Status Code</label>
                <input type="number" name="expected_status_code" value={formData.expected_status_code} onChange={handleChange} placeholder="e.g., 200" />
              </div>
              <div className="form-group">
                <label>Expected Response Body</label>
                <input type="text" name="expected_response_body" value={formData.expected_response_body} onChange={handleChange} placeholder="Text that must be in the response" />
              </div>
            </div>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="cancel-button" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMonitorModal;