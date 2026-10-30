import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

export const chatRouter = Router({ mergeParams: true });

// Get conversations for meeting
chatRouter.get('/conversations', optionalAuth, (req, res, next) =>
  chatController.getConversations(req, res, next)
);

// Get messages for a specific conversation
chatRouter.get('/conversations/:conversationId/messages', optionalAuth, (req, res, next) =>
  chatController.getMessages(req, res, next)
);

// Create or find direct conversation between participants
chatRouter.post('/conversations/direct', optionalAuth, (req, res, next) =>
  chatController.createDirectConversation(req, res, next)
);

// Mark messages in conversation as read
chatRouter.post('/conversations/:conversationId/read', optionalAuth, (req, res, next) =>
  chatController.markAsRead(req, res, next)
);
