import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.issues,
    });
    return;
  }

  // Unhandled / Unexpected Errors
  logger.error(err, 'Unhandled Application Error');

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : (err as Error).message;

  res.status(500).json({
    success: false,
    message,
    ...(env.NODE_ENV !== 'production' && { stack: (err as Error).stack }),
  });
};
