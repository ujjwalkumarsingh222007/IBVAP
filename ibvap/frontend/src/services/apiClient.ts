/**
 * Centralized API Client for IBVAP
 * Connects to Member 3 FastAPI backend (default: http://localhost:8000/api/v1)
 * Tracks backend connection state and handles network failures gracefully.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number = 0, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

// Global reactive state tracking backend connectivity
let globalBackendOnline: boolean = false;
const listeners = new Set<(online: boolean) => void>();

export function getBackendConnectivity(): boolean {
  return globalBackendOnline;
}

export function subscribeConnectivity(listener: (online: boolean) => void): () => void {
  listeners.add(listener);
  listener(globalBackendOnline);
  return () => {
    listeners.delete(listener);
  };
}

function updateConnectivity(status: boolean) {
  if (globalBackendOnline !== status) {
    globalBackendOnline = status;
    listeners.forEach((fn) => fn(status));
  }
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; isLive: boolean }> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let details;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
        details = errorData;
      } catch {
        // Body wasn't JSON
      }
      // If server responds with HTTP error, connection itself is alive
      updateConnectivity(true);
      throw new ApiClientError(errorMessage, response.status, details);
    }

    updateConnectivity(true);
    const data = (await response.json()) as T;
    return { data, isLive: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    // Network level error (server down / connection refused)
    updateConnectivity(false);
    const err = error as Error;
    throw new ApiClientError(err.message || 'Backend API unreachable', 0);
  }
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
