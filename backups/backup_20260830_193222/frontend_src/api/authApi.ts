import { apiClient } from './apiClient';
import {
  AuditLog,
  AuthUser,
  DemoResetResponse,
  LoginCredentials,
  LoginResponse,
} from '../types';

export const authApi = {
  /**
   * Authenticate user credentials and return JWT bearer token.
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      '/api/v1/auth/login',
      credentials
    );
    return response.data;
  },

  /**
   * Terminate active user session.
   */
  async logout(): Promise<{ status: string; message: string }> {
    const response = await apiClient.post<{ status: string; message: string }>(
      '/api/v1/auth/logout'
    );
    return response.data;
  },

  /**
   * Get current authenticated user profile.
   */
  async getMe(): Promise<AuthUser> {
    const response = await apiClient.get<AuthUser>('/api/v1/auth/me');
    return response.data;
  },

  /**
   * Fetch security audit logs (Admin only).
   */
  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    const response = await apiClient.get<AuditLog[]>('/api/v1/auth/audit-logs', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Reset demonstration data and reseed cameras (Admin only).
   */
  async resetDemoData(): Promise<DemoResetResponse> {
    const response = await apiClient.post<DemoResetResponse>('/api/v1/demo/reset', {
      confirm: true,
    });
    return response.data;
  },
};

export default authApi;
