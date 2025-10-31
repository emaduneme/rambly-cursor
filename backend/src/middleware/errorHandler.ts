import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // Log error
  if (error instanceof AppError && error.isOperational) {
    logger.warn('Operational error', {
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Unexpected error', {
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Handle known operational errors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
      ...(env.isDevelopment && { stack: error.stack }),
    });
  }

  // Handle Prisma errors
  if (error.constructor.name.includes('Prisma')) {
    return res.status(500).json({
      status: 'error',
      message: 'Database error',
      ...(env.isDevelopment && { details: error.message }),
    });
  }

  // Handle validation errors (from express-validator or zod)
  if (error.name === 'ValidationError' || error.name === 'ZodError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      ...(env.isDevelopment && { details: error.message }),
    });
  }

  // Default error response
  res.status(500).json({
    status: 'error',
    message: env.isProduction ? 'Internal server error' : error.message,
    ...(env.isDevelopment && { stack: error.stack }),
  });
};

// Handle 404 routes
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.path} not found`,
  });
};
