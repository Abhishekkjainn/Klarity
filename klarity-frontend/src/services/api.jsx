import axios from 'axios';

// Create a new Axios instance with a custom configuration
const api = axios.create({
  // The base URL of your deployed backend
  baseURL: 'https://klarityy-backend.vercel.app/api/v1',
  
  // This is CRITICAL for handling the httpOnly cookies
  withCredentials: true, 
});

export default api;