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

    let user;
    try {
      user = await userService.verifyPassword(email, password);
    } catch (verifyError) {
      console.error('Password verification error:', verifyError);
      return res.status(500).json({ error: 'Authentication service error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let token;
    try {
      token = userService.generateToken(user);
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(500).json({ error: 'Token generation error' });
    }

    try {
      await logAudit(req, {
        userId: user.id,
        action: 'login',
        resourceType: 'session',
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
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
      providerId: user.providerId,
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
