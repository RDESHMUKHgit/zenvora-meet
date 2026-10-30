import { Request, Response } from 'express';
import { meetingService } from '../services/meeting.service.js';

export const createMeeting = async (req: Request, res: Response): Promise<void> => {
  const hostUserId = req.user?.id || null;
  const hostUserName = req.user?.name || null;
  const result = await meetingService.createMeeting(hostUserId, req.body, hostUserName);

  res.status(201).json({
    success: true,
    message: 'Meeting created successfully',
    data: result,
  });
};

export const getMeetingByCode = async (req: Request, res: Response): Promise<void> => {
  const code = req.params.code as string;
  const result = await meetingService.getMeetingByCode(code);

  res.status(200).json({
    success: true,
    data: result,
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

export const leaveMeeting = async (req: Request, res: Response): Promise<void> => {
  const code = req.params.code as string;
  const participantId = req.body.participantId as string;

  if (participantId) {
    await meetingService.leaveMeeting(code, participantId);
  }

  res.status(200).json({
    success: true,
    message: 'Left meeting successfully',
  });
};

export const endMeeting = async (req: Request, res: Response): Promise<void> => {
  const code = req.params.code as string;
  const hostToken =
    (req.headers['x-host-token'] as string) || (req.body.hostToken as string) || undefined;
  const userId = req.user?.id || null;

  await meetingService.endMeeting(code, { userId, hostToken });

  res.status(200).json({
    success: true,
    message: 'Meeting ended successfully for all participants',
  });
};
