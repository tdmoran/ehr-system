import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import * as userService from '../services/user.service.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../errors/index.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await userService.verifyPassword(email, password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = userService.generateToken(user);

  try {
    await logAudit(req, {
      userId: user.id,
      action: 'login',
      resourceType: 'session',
    });
  } catch {
    // Don't fail login for audit errors
  }

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      providerId: user.providerId,
    },
  });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await userService.findById(req.user!.id);
  if (!user) throw new NotFoundError('User not found');

  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    providerId: user.providerId,
  });
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await logAudit(req, {
    action: 'logout',
    resourceType: 'session',
  });

  res.json({ message: 'Logged out successfully' });
}));

export default router;
