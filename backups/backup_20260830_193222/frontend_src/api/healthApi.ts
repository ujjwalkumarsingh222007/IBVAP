import apiClient from './apiClient';
import { HealthStatus } from '../types';

export const healthApi = {
  getHealth: async (): Promise<HealthStatus> => {
    const response = await apiClient.get<HealthStatus>('/api/v1/health');
    return response.data;
  },
};

export default healthApi;
