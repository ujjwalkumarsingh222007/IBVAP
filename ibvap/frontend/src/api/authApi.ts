import { apiClient } from './apiClient';
import { AuthUser, LoginCredentials, LoginResponse } from '../types';

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
   * Get current authenticated user profile.
   */
  async getMe(): Promise<AuthUser> {
    const response = await apiClient.get<AuthUser>('/api/v1/auth/me');
    return response.data;
  },
};

export default authApi;
