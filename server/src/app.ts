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

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
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
