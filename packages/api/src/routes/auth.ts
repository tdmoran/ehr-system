import { Router } from 'express';
import { z } from 'zod';
import * as userService from '../services/user.service.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userService.verifyPassword(email, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = userService.generateToken(user);

    await logAudit(req, {
      userId: user.id,
      action: 'login',
      resourceType: 'session',
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await userService.findById(req.user!.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  await logAudit(req, {
    action: 'logout',
    resourceType: 'session',
  });

  res.json({ message: 'Logged out successfully' });
});

export default router;
