import { Request, Response } from 'express';
import { meetingService } from '../services/meeting.service.js';

export const createMeeting = async (req: Request, res: Response): Promise<void> => {
  const hostUserId = req.user?.id || null;
  const meeting = await meetingService.createMeeting(hostUserId, req.body);

  res.status(201).json({
    success: true,
    message: 'Meeting created successfully',
    data: { meeting },
  });
};

export const getMeetingByCode = async (req: Request, res: Response): Promise<void> => {
  const code = req.params.code as string;
  const meeting = await meetingService.getMeetingByCode(code);

  res.status(200).json({
    success: true,
    data: { meeting },
  });
};

export const getUserMeetingHistory = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(200).json({ success: true, data: { meetings: [] } });
    return;
  }

  const meetings = await meetingService.getUserHistory(req.user.id);

  res.status(200).json({
    success: true,
    data: { meetings },
  });
};

export const joinMeeting = async (req: Request, res: Response): Promise<void> => {
  const code = req.params.code as string;
  const userId = req.user?.id || null;
  const displayName = req.body.displayName;

  const result = await meetingService.joinMeeting(code, userId, displayName);

  res.status(200).json({
    success: true,
    message: 'Joined meeting room successfully',
    data: result,
  });
};
