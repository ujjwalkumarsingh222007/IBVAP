import apiClient from './apiClient';
import { Person, PersonRegisterResponse, FaceValidationResponse } from '../types';

export const peopleApi = {
  getPeople: async (): Promise<Person[]> => {
    const response = await apiClient.get<Person[]>('/persons');
    return response.data;
  },

  getPerson: async (personId: string | number): Promise<Person> => {
    const response = await apiClient.get<Person>(`/persons/${encodeURIComponent(personId)}`);
    return response.data;
  },

  validateFace: async (imageBlob: Blob, angle = 'FRONT'): Promise<FaceValidationResponse> => {
    const formData = new FormData();
    formData.append('file', imageBlob, 'frame.jpg');
    formData.append('angle', angle);

    const response = await apiClient.post<FaceValidationResponse>('/persons/validate-face', formData);
    return response.data;
  },

  registerPerson: async (
    name: string,
    status: 'KNOWN' | 'FLAGGED',
    notes: string,
    faceBlobs: Blob[],
    angles: string[],
    allowDuplicate = false
  ): Promise<PersonRegisterResponse> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('status', status);
    if (notes) formData.append('notes', notes);
    formData.append('allow_duplicate', allowDuplicate ? 'true' : 'false');

    faceBlobs.forEach((blob, idx) => {
      formData.append('files', blob, `angle_${idx}.jpg`);
    });

    angles.forEach((angle) => {
      formData.append('angles', angle);
    });

    // Also attach primary file for backward compatibility
    if (faceBlobs.length > 0) {
      formData.append('file', faceBlobs[0], 'primary.jpg');
    }

    const response = await apiClient.post<PersonRegisterResponse>('/persons/register', formData);
    return response.data;
  },

  deletePerson: async (personId: number): Promise<void> => {
    await apiClient.delete(`/persons/${personId}`);
  },

  updatePerson: async (
    personId: number | string,
    payload: { name?: string; status?: 'KNOWN' | 'FLAGGED'; notes?: string }
  ): Promise<Person> => {
    const response = await apiClient.put<Person>(`/persons/${personId}`, payload);
    return response.data;
  },

  bulkDeletePeople: async (ids: number[]): Promise<{ deleted_count: number }> => {
    const response = await apiClient.post<{ deleted_count: number }>('/persons/bulk-delete', { ids });
    return response.data;
  },

  bulkUpdateStatus: async (ids: number[], status: 'KNOWN' | 'FLAGGED'): Promise<{ updated_count: number }> => {
    const response = await apiClient.post<{ updated_count: number }>('/persons/bulk-status', { ids, status });
    return response.data;
  },
};
