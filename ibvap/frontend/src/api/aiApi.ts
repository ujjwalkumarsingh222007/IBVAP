import apiClient from './apiClient';
import { AIProcessFrameResponse } from '../types';

export const aiApi = {
  processFrame: async (
    imageBlob: Blob,
    cameraId: string,
    abortSignal?: AbortSignal
  ): Promise<AIProcessFrameResponse> => {
    const formData = new FormData();
    formData.append('file', imageBlob, 'frame.jpg');
    formData.append('camera_id', cameraId);

    const response = await apiClient.post<AIProcessFrameResponse>('/ai/process-frame', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal: abortSignal,
    });
    return response.data;
  },
};
