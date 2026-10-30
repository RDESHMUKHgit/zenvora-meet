import { Request, Response } from 'express';
import { Temporal } from '@js-temporal/polyfill';

export const getHealth = (_req: Request, res: Response): void => {
  const uptimeSeconds = Math.floor(process.uptime());
  const timestamp = Temporal.Now.instant().toString();

  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp,
      uptime: `${uptimeSeconds}s`,
      environment: process.env.NODE_ENV || 'development',
    },
  });
};
