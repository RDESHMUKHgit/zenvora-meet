import { Request, Response, NextFunction } from 'express';
import { generateCsrfToken } from '../utils/crypto.js';
import { ForbiddenError } from '../utils/errors.js';
import { env } from '../config/env.js';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export const setCsrfCookie = (res: Response, token?: string): string => {
  const csrfToken = token || generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by client JavaScript to set X-CSRF-Token header
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return csrfToken;
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Ensure a CSRF token cookie is present for the client
  if (!req.cookies || !req.cookies[CSRF_COOKIE_NAME]) {
    setCsrfCookie(res);
  }

  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (isSafeMethod) {
    return next();
  }

  // Exempt public auth initialization endpoints from requiring prior CSRF token header
  const isAuthInit = req.originalUrl.includes('/api/auth/login') || req.originalUrl.includes('/api/auth/register');
  if (isAuthInit) {
    return next();
  }

  // 1. Validate Origin / Referer for state-changing requests
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const allowedOriginUrl = new URL(env.CORS_ORIGIN);

      const isAllowedHost =
        originUrl.origin === allowedOriginUrl.origin ||
        originUrl.hostname.endsWith('.netlify.app') ||
        originUrl.hostname.endsWith('.onrender.com') ||
        originUrl.hostname === 'localhost' ||
        originUrl.hostname === '127.0.0.1';

      if (!isAllowedHost && env.NODE_ENV === 'production') {
        throw new ForbiddenError('Cross-origin request rejected');
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      // If invalid URL in production, reject
      if (env.NODE_ENV === 'production') {
        throw new ForbiddenError('Invalid origin header');
      }
    }
  }

  // 2. Double-Submit CSRF check for state-changing requests authenticated via session cookie
  const hasSessionCookie = !!(req.cookies && req.cookies.session_token);
  if (hasSessionCookie) {
    const clientHeader = req.headers[CSRF_HEADER_NAME];
    const cookieToken = req.cookies[CSRF_COOKIE_NAME];

    if (!clientHeader || !cookieToken || clientHeader !== cookieToken) {
      throw new ForbiddenError('Invalid or missing CSRF token');
    }
  }

  next();
};
