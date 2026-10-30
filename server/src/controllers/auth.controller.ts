import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { extractToken } from '../middlewares/auth.middleware.js';
import { setCsrfCookie } from '../middlewares/csrf.middleware.js';
import { env } from '../config/env.js';

export const SESSION_COOKIE_NAME = 'session_token';

const getSessionCookieOptions = (maxAgeMs: number = 7 * 24 * 60 * 60 * 1000) => ({
  httpOnly: true,
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: maxAgeMs,
});

export const register = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.register(req.body);

  // Set secure HTTP-only session cookie
  res.cookie(SESSION_COOKIE_NAME, result.sessionToken, getSessionCookieOptions());

  // Issue CSRF token for client
  const csrfToken = setCsrfCookie(res);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: result.user,
      csrfToken,
    },
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.login(req.body);

  // Set secure HTTP-only session cookie
  res.cookie(SESSION_COOKIE_NAME, result.sessionToken, getSessionCookieOptions());

  // Issue CSRF token for client
  const csrfToken = setCsrfCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: {
      user: result.user,
      csrfToken,
    },
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (token) {
    await authService.logout(token);
  }

  // Clear session cookie
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

export const getMe = (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

export const getCsrfToken = (_req: Request, res: Response): void => {
  const csrfToken = setCsrfCookie(res);
  res.status(200).json({
    success: true,
    data: {
      csrfToken,
    },
  });
};

