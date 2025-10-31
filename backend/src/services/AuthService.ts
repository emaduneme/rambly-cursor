import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface GoogleProfile {
  id: string;
  email: string;
  displayName?: string;
  picture?: string;
}

export class AuthService {
  /**
   * Generate JWT access token
   */
  generateAccessToken(userId: string, email: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      type: 'access',
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(userId: string, email: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      type: 'refresh',
    };

    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

      if (payload.type !== 'access') {
        throw new UnauthorizedError('Invalid token type');
      }

      return payload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;

      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token type');
      }

      return payload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Find or create user from Google OAuth profile
   */
  async findOrCreateUser(profile: GoogleProfile) {
    try {
      let user = await prisma.user.findUnique({
        where: { providerId: profile.id },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            providerId: profile.id,
            email: profile.email,
            settings: {
              displayName: profile.displayName,
              picture: profile.picture,
            },
          },
        });

        logger.info('New user created from Google OAuth', {
          userId: user.id,
          email: user.email,
        });
      } else {
        // Update last seen
        user = await prisma.user.update({
          where: { id: user.id },
          data: { lastSeen: new Date() },
        });
      }

      return user;
    } catch (error: any) {
      logger.error('Failed to find or create user', {
        error: error.message,
        providerId: profile.id,
      });
      throw error;
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(userId: string, email: string) {
    return {
      accessToken: this.generateAccessToken(userId, email),
      refreshToken: this.generateRefreshToken(userId, email),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Generate new access token
    return this.generateAccessToken(user.id, user.email);
  }
}

// Singleton instance
export const authService = new AuthService();
