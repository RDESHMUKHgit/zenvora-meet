import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';

export const extractToken = (req: Request): string | null => {
  // 1. Try Cookie
  if (req.cookies && req.cookies.session_token) {
    return req.cookies.session_token;
  }

  // 2. Try Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const sessionData = await authService.validateSession(token);
    if (!sessionData) {
      throw new UnauthorizedError('Session invalid or expired');
    }

    req.user = sessionData.user;
    req.session = sessionData.session;
    next();
  } catch (err) {
    next(err);
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (token) {
      const sessionData = await authService.validateSession(token);
      if (sessionData) {
        req.user = sessionData.user;
        req.session = sessionData.session;
      }
    }
    next();
  } catch {
    next();
  }
};

