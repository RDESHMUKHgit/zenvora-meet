import { Router } from 'express';
import {
  createMeeting,
  getMeetingByCode,
  getUserMeetingHistory,
  joinMeeting,
  leaveMeeting,
  endMeeting,
} from '../controllers/meeting.controller.js';
import { chatRouter } from './chat.routes.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  createMeetingSchema,
  joinMeetingSchema,
  leaveMeetingSchema,
  endMeetingSchema,
} from '../validators/meeting.validator.js';

export const meetingRouter = Router();

// Create new meeting (authenticated or guest with display name)
meetingRouter.post('/', optionalAuth, validateBody(createMeetingSchema), createMeeting);

// Get user meeting history (authenticated)
meetingRouter.get('/history', requireAuth, getUserMeetingHistory);

// Get meeting details and active participant count
meetingRouter.get('/:code', optionalAuth, getMeetingByCode);

// Join meeting by code (no-account Quick Join supported)
meetingRouter.post('/:code/join', optionalAuth, validateBody(joinMeetingSchema), joinMeeting);

// Leave meeting
meetingRouter.post('/:code/leave', optionalAuth, validateBody(leaveMeetingSchema), leaveMeeting);

// Explicit meeting termination by host (host authentication or host token required)
meetingRouter.post('/:code/end', optionalAuth, validateBody(endMeetingSchema), endMeeting);

// In-meeting chat routes (conversations, messages, direct chat, read receipts)
meetingRouter.use('/:code', chatRouter);
