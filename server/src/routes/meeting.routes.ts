import { Router } from 'express';
import {
  createMeeting,
  getMeetingByCode,
  getUserMeetingHistory,
  joinMeeting,
} from '../controllers/meeting.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { createMeetingSchema, joinMeetingSchema } from '../validators/meeting.validator.js';

export const meetingRouter = Router();

// Create new meeting (authenticated or guest)
meetingRouter.post('/', optionalAuth, validateBody(createMeetingSchema), createMeeting);

// Get user meeting history (authenticated)
meetingRouter.get('/history', requireAuth, getUserMeetingHistory);

// Get meeting by code
meetingRouter.get('/:code', optionalAuth, getMeetingByCode);

// Join meeting by code
meetingRouter.post('/:code/join', optionalAuth, validateBody(joinMeetingSchema), joinMeeting);
