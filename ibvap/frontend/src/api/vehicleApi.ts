import apiClient from './apiClient';
import { Vehicle, VehicleRegisterPayload } from '../types';

export const vehicleApi = {
  getVehicles: async (): Promise<Vehicle[]> => {
    const response = await apiClient.get<Vehicle[]>('/vehicles');
    return response.data;
  },

  registerVehicle: async (payload: VehicleRegisterPayload): Promise<Vehicle> => {
    const response = await apiClient.post<Vehicle>('/vehicles', payload);
    return response.data;
  },

  deleteVehicle: async (vehicleId: number): Promise<void> => {
    await apiClient.delete(`/vehicles/${vehicleId}`);
  },

  updateVehicle: async (
    vehicleId: number,
    payload: { plate_number?: string; owner_name?: string; status?: 'KNOWN' | 'FLAGGED' | 'WATCHLIST'; notes?: string }
  ): Promise<Vehicle> => {
    const response = await apiClient.put<Vehicle>(`/vehicles/${vehicleId}`, payload);
    return response.data;
  },

  bulkDeleteVehicles: async (ids: number[]): Promise<{ deleted_count: number }> => {
    const response = await apiClient.post<{ deleted_count: number }>('/vehicles/bulk-delete', { ids });
    return response.data;
  },

  bulkUpdateVehicleStatus: async (
    ids: number[],
    status: 'KNOWN' | 'FLAGGED' | 'WATCHLIST'
  ): Promise<{ updated_count: number }> => {
    const response = await apiClient.post<{ updated_count: number }>('/vehicles/bulk-status', { ids, status });
    return response.data;
  },
};
