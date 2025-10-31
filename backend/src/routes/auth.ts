import express from 'express';
import passport from '../config/passport';
import { authService } from '../services/AuthService';
import { authenticate } from '../middleware/auth';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

const router = express.Router();

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth flow
 */
router.get('/google', passport.authenticate('google', { session: false }));

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    try {
      const user = req.user as any;

      if (!user) {
        throw new UnauthorizedError('Authentication failed');
      }

      // Generate tokens
      const { accessToken, refreshToken } = authService.generateTokenPair(user.id, user.email);

      // Set tokens in cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE,
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to frontend
      const redirectUrl = `${env.CORS_ORIGIN}/auth/callback?success=true`;
      res.redirect(redirectUrl);
    } catch (error) {
      res.redirect(`${env.CORS_ORIGIN}/auth/callback?error=auth_failed`);
    }
  }
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError('No refresh token provided');
    }

    const newAccessToken = await authService.refreshAccessToken(refreshToken);

    // Set new access token in cookie
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      maxAge: 15 * 60 * 1000,
    });

    res.json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (clear cookies)
 */
router.post('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 */
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        lastSeen: true,
        settings: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    res.json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

// Import prisma for use in /me route
import { prisma } from '../config/database';

export default router;
