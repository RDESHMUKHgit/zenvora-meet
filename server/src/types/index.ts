import { Request } from 'express';
import type { SafeUser } from '../services/auth.service.js';
import type { AuthSession } from '../db/schema/sessions.schema.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  session?: AuthSession;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      session?: AuthSession;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */
