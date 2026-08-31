import axios from 'axios';

// Base Axios instance using Vite proxy or direct API base URL
const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Graceful error logging without spamming or crashing the UI
    const message = error?.response?.data?.detail || error?.message || 'Network request failed';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
