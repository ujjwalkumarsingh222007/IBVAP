import apiClient from './apiClient';
import { AIFrameProcessResponse } from '../types';

export const aiApi = {
  /**
   * Send an individual captured webcam frame to the Member 1 CV pipeline.
   */
  processFrame: async (
    camera_id: string,
    imageBlob: Blob,
    signal?: AbortSignal
  ): Promise<AIFrameProcessResponse> => {
    const formData = new FormData();
    formData.append('file', imageBlob, 'webcam_frame.jpg');
    formData.append('camera_id', camera_id);

    const response = await apiClient.post<AIFrameProcessResponse>(
      '/api/v1/ai/process-frame',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal,
      }
    );
    return response.data;
  },
};

export default aiApi;
