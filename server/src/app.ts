import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { httpLogger } from './middlewares/logger.middleware.js';
import { rateLimiter } from './middlewares/rateLimiter.middleware.js';
import { csrfProtection } from './middlewares/csrf.middleware.js';
import { notFoundHandler } from './middlewares/notFound.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { apiRouter } from './routes/index.js';

export const createApp = (): Express => {
  const app = express();

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS configuration supporting localhost and local Wi-Fi / LAN IP access
  const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) return true;
    if (origin === env.CORS_ORIGIN) return true;
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
      if (
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
      ) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (isAllowedOrigin(requestOrigin)) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'x-csrf-token',
        'X-Host-Token',
        'x-host-token',
      ],
    }),
  );

  // Performance & parsers
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP request logging
  app.use(httpLogger);

  // Rate limiting applied to API endpoints
  app.use('/api', rateLimiter);

  // CSRF Protection
  app.use(csrfProtection);

  // Application Routes
  app.use('/api', apiRouter);

  // 404 Handler for undefined routes
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
