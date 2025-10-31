import { apiClient } from './client';
import { Ramble, RambleDetail, PaginatedResponse, ApiResponse } from '../types';

export const ramblesApi = {
  /**
   * Create new ramble with audio upload
   */
  async create(audioBlob: Blob, options?: { language?: string; durationSeconds?: number }) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    if (options?.language) {
      formData.append('language', options.language);
    }
    if (options?.durationSeconds) {
      formData.append('durationSeconds', options.durationSeconds.toString());
    }

    const response = await apiClient.post<ApiResponse<{ ramble: Ramble }>>('/rambles', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data!.ramble;
  },

  /**
   * Get list of rambles
   */
  async list(page = 1, limit = 20) {
    const response = await apiClient.get<
      ApiResponse<{ rambles: Ramble[]; pagination: PaginatedResponse<Ramble>['pagination'] }>
    >('/rambles', {
      params: { page, limit },
    });

    return {
      rambles: response.data.data!.rambles,
      pagination: response.data.data!.pagination,
    };
  },

  /**
   * Get single ramble with full details
   */
  async get(id: string) {
    const response = await apiClient.get<ApiResponse<{ ramble: RambleDetail }>>(`/rambles/${id}`);
    return response.data.data!.ramble;
  },

  /**
   * Get ramble status (for polling)
   */
  async getStatus(id: string) {
    const response = await apiClient.get<ApiResponse<{ ramble: Ramble }>>(`/rambles/${id}/status`);
    return response.data.data!.ramble;
  },

  /**
   * Update ramble (e.g., change title)
   */
  async update(id: string, data: { title: string }) {
    const response = await apiClient.patch<ApiResponse<{ ramble: Ramble }>>(`/rambles/${id}`, data);
    return response.data.data!.ramble;
  },

  /**
   * Delete ramble
   */
  async delete(id: string) {
    await apiClient.delete(`/rambles/${id}`);
  },

  /**
   * Export ramble transcript
   */
  async export(id: string) {
    const response = await apiClient.get(`/rambles/${id}/export`, {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ramble-${id}.txt`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
