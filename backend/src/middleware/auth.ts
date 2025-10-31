import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService';
import { UnauthorizedError } from '../utils/errors';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
  isGuest: boolean;
  sessionId?: string;
}

/**
 * Middleware to authenticate JWT token
 * Looks for token in Authorization header or cookies
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Try to get token from Authorization header
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fallback to cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const payload = authService.verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
    };
    req.isGuest = false;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - allows both authenticated and guest users
 * Sets req.user if authenticated, otherwise sets req.isGuest = true
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Try to get token
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        const payload = authService.verifyAccessToken(token);
        req.user = {
          userId: payload.userId,
          email: payload.email,
        };
        req.isGuest = false;
      } catch (error) {
        // Token is invalid, treat as guest
        req.isGuest = true;
      }
    } else {
      req.isGuest = true;
    }

    // Get or create session ID for guests
    if (req.isGuest) {
      req.sessionId = req.cookies?.sessionId;
      if (!req.sessionId) {
        // Generate new session ID
        req.sessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        res.cookie('sessionId', req.sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
