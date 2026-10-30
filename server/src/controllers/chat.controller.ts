import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { chatService } from '../services/chat.service.js';
import { BadRequestError } from '../utils/errors.js';

const getConversationsSchema = z.object({
  participantId: z.string().min(1, 'participantId is required'),
});

const getMessagesSchema = z.object({
  participantId: z.string().min(1, 'participantId is required'),
});

const createDirectConvSchema = z.object({
  participantId: z.string().min(1, 'participantId is required'),
  targetParticipantId: z.string().min(1, 'targetParticipantId is required'),
});

const markReadSchema = z.object({
  participantId: z.string().min(1, 'participantId is required'),
  messageIds: z.array(z.string()).min(1, 'messageIds must contain at least one ID'),
});

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export class ChatController {
  async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = getParam(req.params.code);
      const parsed = getConversationsSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || 'Invalid query');
      }

      const convs = await chatService.getConversations(code, parsed.data.participantId);

      res.status(200).json({
        success: true,
        data: { conversations: convs },
      });
    } catch (err) {
      next(err);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = getParam(req.params.code);
      const conversationId = getParam(req.params.conversationId);
      const parsed = getMessagesSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || 'Invalid query');
      }

      const messages = await chatService.getMessages(
        code,
        conversationId,
        parsed.data.participantId
      );

      res.status(200).json({
        success: true,
        data: { messages },
      });
    } catch (err) {
      next(err);
    }
  }

  async createDirectConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = getParam(req.params.code);
      const parsed = createDirectConvSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || 'Invalid payload');
      }

      const conv = await chatService.findOrCreateDirectConversation(
        code,
        parsed.data.participantId,
        parsed.data.targetParticipantId,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        data: { conversation: conv },
      });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = getParam(req.params.code);
      const conversationId = getParam(req.params.conversationId);
      const parsed = markReadSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || 'Invalid payload');
      }

      await chatService.markAsRead(
        code,
        conversationId,
        parsed.data.messageIds,
        parsed.data.participantId,
        req.user?.id || null
      );

      res.status(200).json({
        success: true,
        message: 'Messages marked as read',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const chatController = new ChatController();
