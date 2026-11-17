import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  // Log unexpected errors
  if (!(err instanceof AppError)) {
    logger.error('Unhandled Server Error:', {
      error: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method
    });
  } else {
    logger.warn('Operational Application Error:', {
      code: err.code,
      message: err.message,
      path: req.originalUrl,
      method: req.method
    });
  }

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected internal error occurred';

  // Never expose raw stack traces in production
  const response = {
    success: false,
    error: errorCode,
    message
  };

  if (err.details) {
    response.details = err.details;
  }

  if (env.NODE_ENV === 'development' && !(err instanceof AppError)) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
