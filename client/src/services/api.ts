import axios from 'axios';

let cachedCsrfToken: string | null = null;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function setLocalCsrfToken(token: string): void {
  cachedCsrfToken = token;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('rd_csrf_token', token);
    } catch {
      // Ignore localStorage errors
    }
  }
}

export function getLocalCsrfToken(): string | null {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rd_csrf_token');
      if (stored) {
        cachedCsrfToken = stored;
        return stored;
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  return getCookie('csrf_token');
}

function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Use relative '/api' so all requests share the exact origin with Vite dev server/proxy
  return '/api';
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use(
  async (config) => {
    let csrfToken = getLocalCsrfToken();

    // If state-changing request and token not cached yet, proactively fetch it
    const isStateChanging = ['post', 'put', 'patch', 'delete'].includes(
      config.method?.toLowerCase() || ''
    );
    const isCsrfOrAuthInit =
      config.url?.includes('/auth/csrf') ||
      config.url?.includes('/auth/login') ||
      config.url?.includes('/auth/register');

    if (isStateChanging && !csrfToken && !isCsrfOrAuthInit) {
      try {
        const csrfRes = await axios.get(`${getApiBaseUrl()}/auth/csrf`, {
          withCredentials: true,
        });
        const fetchedToken =
          csrfRes.headers?.['x-csrf-token'] ||
          csrfRes.headers?.['X-CSRF-Token'] ||
          csrfRes.data?.data?.csrfToken;
        if (fetchedToken && typeof fetchedToken === 'string') {
          csrfToken = fetchedToken;
          setLocalCsrfToken(fetchedToken);
        }
      } catch {
        // Fall back to continuing request
      }
    }

    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Cache any updated CSRF token returned in headers or response payload
    const headerToken =
      response.headers?.['x-csrf-token'] || response.headers?.['X-CSRF-Token'];
    const bodyToken = response.data?.data?.csrfToken;
    const token = headerToken || bodyToken;
    if (token && typeof token === 'string') {
      setLocalCsrfToken(token);
    }

    return response;
  },
  (error) => {
    // Surface user-friendly error message from backend if available
    const serverMessage = error?.response?.data?.message || error?.response?.data?.error;
    if (serverMessage && typeof serverMessage === 'string') {
      error.message = serverMessage;
    }
    return Promise.reject(error);
  }
);

export default api;
