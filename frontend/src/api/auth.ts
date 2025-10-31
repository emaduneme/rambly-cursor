import { apiClient } from './client';
import { User, ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const authApi = {
  /**
   * Initiate Google OAuth login
   */
  loginWithGoogle() {
    window.location.href = `${API_URL}/api/auth/google`;
  },

  /**
   * Get current user info
   */
  async getMe() {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    return response.data.data!.user;
  },

  /**
   * Refresh access token
   */
  async refreshToken() {
    const response = await apiClient.post<ApiResponse<{ accessToken: string }>>('/auth/refresh');
    return response.data.data!.accessToken;
  },

  /**
   * Logout
   */
  async logout() {
    await apiClient.post('/auth/logout');
  },
};
