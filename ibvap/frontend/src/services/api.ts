/**
 * API Base Client Configuration for IBVAP
 * Connects to Member 3 FastAPI backend (default: http://localhost:8000/api/v1)
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export class ApiServiceError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiServiceError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Generic fetch wrapper with JSON parsing and standardized error handling.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
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
        // Response body wasn't JSON
      }
      throw new ApiServiceError(errorMessage, response.status, details);
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    // Network errors (e.g. backend offline / connection refused)
    const err = error as Error;
    throw new ApiServiceError(
      err.message || 'Unable to connect to IBVAP Backend API',
      0
    );
  }
}
