import { request } from './request';
import type { User } from './types';

export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<User>('/auth/me'),

  logout: () => request('/auth/logout', { method: 'POST' }),
};
