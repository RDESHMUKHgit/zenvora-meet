export const APP_NAME = 'Zenvora Meet';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:5000');

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
