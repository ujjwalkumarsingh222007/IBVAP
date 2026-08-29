import { apiClient } from './apiClient';

export interface PersonItem {
  id: number;
  person_code: string;
  name: string;
  status: 'KNOWN' | 'FLAGGED';
  face_image_path?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FaceValidationResult {
  valid: boolean;
  message: string;
  faces_count: number;
  face_bbox?: { x: number; y: number; w: number; h: number } | null;
}

export interface PersonRegisterResponse {
  status: string;
  person_id: string;
  name: string;
  person_status: string;
  face_image_url?: string;
  message: string;
}

export const personsApi = {
  getPersons: async (): Promise<PersonItem[]> => {
    const res = await apiClient.get<PersonItem[]>('/api/v1/persons');
    return res.data;
  },

  getPerson: async (id: number): Promise<PersonItem> => {
    const res = await apiClient.get<PersonItem>(`/api/v1/persons/${id}`);
    return res.data;
  },

  validateFace: async (imageBlob: Blob): Promise<FaceValidationResult> => {
    const formData = new FormData();
    formData.append('file', imageBlob, 'frame.jpg');
    const res = await apiClient.post<FaceValidationResult>('/api/v1/persons/validate-face', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  registerPerson: async (
    name: string,
    status: 'KNOWN' | 'FLAGGED',
    imageBlob: Blob,
    notes?: string
  ): Promise<PersonRegisterResponse> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('status', status);
    formData.append('file', imageBlob, 'face.jpg');
    if (notes) {
      formData.append('notes', notes);
    }

    const res = await apiClient.post<PersonRegisterResponse>('/api/v1/persons/register', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  deletePerson: async (id: number): Promise<{ status: string; message: string }> => {
    const res = await apiClient.delete<{ status: string; message: string }>(`/api/v1/persons/${id}`);
    return res.data;
  },
};
