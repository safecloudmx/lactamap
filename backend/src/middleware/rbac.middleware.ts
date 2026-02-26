import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

// Role hierarchy: higher index = more permissions
const ROLE_HIERARCHY = ['VISITOR', 'CONTRIBUTOR', 'DISTINGUISHED', 'ELITE', 'OWNER', 'ADMIN'];

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    const hasAccess = roles.some((role) => {
      const requiredIndex = ROLE_HIERARCHY.indexOf(role);
      return userRoleIndex >= requiredIndex;
    });

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};
