export const APP_NAME = 'RD Video Meet';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  MEETING: '/meeting/:id',
  HISTORY: '/history',
  SETTINGS: '/settings',
} as const;

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
