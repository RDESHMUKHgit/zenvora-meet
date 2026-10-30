import api from './api';
import type { ApiResponse, UserProfile } from '../types';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async register(data: RegisterPayload): Promise<{ user: UserProfile; csrfToken: string }> {
    const res = await api.post<ApiResponse<{ user: UserProfile; csrfToken: string }>>('/auth/register', data);
    if (!res.data.data) throw new Error(res.data.message || 'Registration failed');
    return res.data.data;
  },

  async login(data: LoginPayload): Promise<{ user: UserProfile; csrfToken: string }> {
    const res = await api.post<ApiResponse<{ user: UserProfile; csrfToken: string }>>('/auth/login', data);
    if (!res.data.data) throw new Error(res.data.message || 'Login failed');
    return res.data.data;
  },

  async logout(): Promise<void> {
    await api.post<ApiResponse>('/auth/logout');
  },

  async getMe(): Promise<UserProfile | null> {
    try {
      const res = await api.get<ApiResponse<{ user: UserProfile }>>('/auth/me');
      return res.data.data?.user || null;
    } catch {
      return null;
    }
  },

  async getCsrf(): Promise<string> {
    const res = await api.get<ApiResponse<{ csrfToken: string }>>('/auth/csrf');
    return res.data.data?.csrfToken || '';
  },
};

