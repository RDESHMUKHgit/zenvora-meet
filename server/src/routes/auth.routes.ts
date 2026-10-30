import { Router } from 'express';
import { register, login, logout, getMe, getCsrfToken } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';

export const authRouter = Router();

authRouter.get('/csrf', getCsrfToken);
authRouter.post('/register', authRateLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authRateLimiter, validateBody(loginSchema), login);
authRouter.post('/logout', requireAuth, logout);
authRouter.get('/me', requireAuth, getMe);

