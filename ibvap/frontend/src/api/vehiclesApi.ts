import { apiClient } from './apiClient';

export interface VehicleItem {
  id: number;
  plate_number: string;
  owner_name: string;
  status: 'KNOWN' | 'FLAGGED' | 'WATCHLIST';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleRegisterPayload {
  plate_number: string;
  owner_name?: string;
  status: 'KNOWN' | 'FLAGGED' | 'WATCHLIST';
  notes?: string;
}

export const vehiclesApi = {
  getVehicles: async (): Promise<VehicleItem[]> => {
    const res = await apiClient.get<VehicleItem[]>('/api/v1/vehicles');
    return res.data;
  },

  registerVehicle: async (payload: VehicleRegisterPayload): Promise<VehicleItem> => {
    const res = await apiClient.post<VehicleItem>('/api/v1/vehicles', payload);
    return res.data;
  },

  deleteVehicle: async (id: number): Promise<{ status: string; message: string }> => {
    const res = await apiClient.delete<{ status: string; message: string }>(`/api/v1/vehicles/${id}`);
    return res.data;
  },
};
