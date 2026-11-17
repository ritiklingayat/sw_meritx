import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query?.token) {
      token = req.query.token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required: Token missing');
    }

    // Support dev demo tokens for test scripts
    if (token.startsWith('demo-token-') && env.NODE_ENV !== 'production') {
      const parts = token.split('-');
      const userId = parts[2] ? `${parts[2]}-${parts[3] || ''}`.replace(/-$/, '') : null;
      let user = null;
      if (userId) {
        user = await prisma.user.findFirst({ where: { id: userId } });
      }
      if (!user) {
        user = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
      }
      if (user) {
        req.user = user;
        return next();
      }
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access token expired. Please refresh token.');
      }
      throw new UnauthorizedError('Invalid access token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or suspended');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader && !req.query?.token) {
    return next();
  }
  return authenticate(req, res, (err) => {
    // Non-blocking: if token fails, proceed as unauthenticated
    next();
  });
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRole = String(req.user.role).toUpperCase();
    const upperAllowed = allowedRoles.map((r) => String(r).toUpperCase());

    // SuperAdmin has access to all Admin-level endpoints
    if (userRole === 'SUPERADMIN') {
      return next();
    }

    if (!upperAllowed.includes(userRole)) {
      return next(new ForbiddenError(`Access denied: Requires ${upperAllowed.join(' or ')} permission`));
    }

    next();
  };
}
