import axios, { AxiosError } from 'axios';
import {
  SurveillanceEvent,
  DashboardSummary,
  Camera,
  CameraCreateInput,
  CameraUpdateInput,
  HealthStatus,
  EventFilters,
  EventCount,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
});

/**
 * Format API errors into user-friendly messages
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
      case 404:
        return 'Requested resource not found.';
      case 409:
        return 'Resource conflict. The identifier already exists.';
      case 422:
        return 'Validation error. Please verify input fields.';
      case 500:
        return 'Internal server error occurred on backend.';
      default:
        return `Backend responded with HTTP error ${status}.`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

export const surveillanceApi = {
  // --- Dashboard ---
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get<DashboardSummary>('/api/v1/dashboard/summary');
    return response.data;
  },

  getRecentEvents: async (limit = 10): Promise<SurveillanceEvent[]> => {
    const response = await api.get<SurveillanceEvent[]>('/api/v1/dashboard/recent-events', {
      params: { limit },
    });
    return response.data;
  },

  // --- Events ---
  getEvents: async (filters: EventFilters = {}): Promise<SurveillanceEvent[]> => {
    const params: Record<string, unknown> = {};
    if (filters.event_type) params.event_type = filters.event_type;
    if (filters.camera_id) params.camera_id = filters.camera_id;
    if (filters.confidence_min !== undefined) params.confidence_min = filters.confidence_min;
    if (filters.confidence_max !== undefined) params.confidence_max = filters.confidence_max;
    if (filters.limit !== undefined) params.limit = filters.limit;
    if (filters.offset !== undefined) params.offset = filters.offset;

    const response = await api.get<SurveillanceEvent[]>('/api/v1/events', { params });
    return response.data;
  },

  getEventById: async (id: number): Promise<SurveillanceEvent> => {
    const response = await api.get<SurveillanceEvent>(`/api/v1/events/${id}`);
    return response.data;
  },

  getEventCount: async (filters: EventFilters = {}): Promise<EventCount> => {
    const params: Record<string, unknown> = {};
    if (filters.event_type) params.event_type = filters.event_type;
    if (filters.camera_id) params.camera_id = filters.camera_id;
    if (filters.confidence_min !== undefined) params.confidence_min = filters.confidence_min;
    if (filters.confidence_max !== undefined) params.confidence_max = filters.confidence_max;

    const response = await api.get<EventCount>('/api/v1/events/count', { params });
    return response.data;
  },

  // --- Cameras ---
  getCameras: async (): Promise<Camera[]> => {
    const response = await api.get<Camera[]>('/api/v1/cameras');
    return response.data;
  },

  getCameraById: async (cameraId: string): Promise<Camera> => {
    const response = await api.get<Camera>(`/api/v1/cameras/${encodeURIComponent(cameraId)}`);
    return response.data;
  },

  createCamera: async (data: CameraCreateInput): Promise<Camera> => {
    const response = await api.post<Camera>('/api/v1/cameras', data);
    return response.data;
  },

  updateCamera: async (cameraId: string, data: CameraUpdateInput): Promise<Camera> => {
    const response = await api.put<Camera>(`/api/v1/cameras/${encodeURIComponent(cameraId)}`, data);
    return response.data;
  },

  deleteCamera: async (cameraId: string): Promise<void> => {
    await api.delete(`/api/v1/cameras/${encodeURIComponent(cameraId)}`);
  },

  // --- Health ---
  getHealth: async (): Promise<HealthStatus> => {
    const response = await api.get<HealthStatus>('/api/v1/health');
    return response.data;
  },
};

export default api;
