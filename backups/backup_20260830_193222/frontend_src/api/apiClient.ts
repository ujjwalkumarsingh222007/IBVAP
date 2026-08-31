import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '3000')
    ? '' // Use Vite proxy (/api, /health -> http://127.0.0.1:8000)
    : typeof window !== 'undefined' && window.location.hostname
      ? `http://${window.location.hostname}:8000`
      : 'http://127.0.0.1:8000');

export const TOKEN_STORAGE_KEY = 'ibvap_token';
export const USER_STORAGE_KEY = 'ibvap_user';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
});

// Attach Bearer token to all outgoing requests if present
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration / 401s
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // If we are not already on the login page, handle session expiration
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        // Dispatch custom session-expired event
        window.dispatchEvent(new Event('ibvap:auth-expired'));
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Normalizes HTTP errors into clear, operational messages without stack traces.
 */
export function formatApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string | Array<{ msg: string }> }>;
    if (!axiosError.response) {
      return `Unable to connect to IBVAP Backend at ${API_BASE_URL}. Ensure the backend server is running on port 8000.`;
    }

    const status = axiosError.response.status;
    const data = axiosError.response.data;

    if (data && typeof data === 'object' && 'detail' in data) {
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      if (Array.isArray(data.detail)) {
        return data.detail.map((err) => err.msg).join(', ');
      }
    }

    switch (status) {
      case 400:
        return 'Invalid request parameters.';
      case 401:
        return 'Authentication required or session expired. Please log in.';
      case 403:
        return 'Forbidden: You do not have permission for this action.';
      case 404:
        return 'Requested surveillance entity not found.';
      case 409:
        return 'Conflict: Record or camera ID already exists.';
      case 422:
        return 'Invalid event filter or input parameters.';
      case 500:
        return 'Internal surveillance backend error.';
      default:
        return `Backend communication error (HTTP ${status}).`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected network error occurred.';
}

export default apiClient;
