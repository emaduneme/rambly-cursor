import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { env } from './env';
import { authService, GoogleProfile } from '../services/AuthService';
import { logger } from '../utils/logger';

/**
 * Configure Google OAuth Strategy
 */
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleProfile: GoogleProfile = {
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            displayName: profile.displayName,
            picture: profile.photos?.[0]?.value,
          };

          const user = await authService.findOrCreateUser(googleProfile);
          done(null, user);
        } catch (error) {
          logger.error('Google OAuth error', { error });
          done(error as Error);
        }
      }
    )
  );
} else {
  logger.warn('Google OAuth not configured (missing client ID or secret)');
}

/**
 * Configure JWT Strategy
 */
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        done(null, payload);
      } catch (error) {
        done(error);
      }
    }
  )
);

export default passport;
