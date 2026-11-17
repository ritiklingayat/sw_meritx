import { ValidationError } from '../utils/errors.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return next(new ValidationError('Validation failed on request body', details));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return next(new ValidationError('Validation failed on query parameters', details));
    }
    req.query = result.data;
    next();
  };
}
