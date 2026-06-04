import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthUser } from '../types';

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function signToken(user: AuthUser): string {
  if (!config.jwtSecret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return;
  }
  try {
    if (!config.jwtSecret) { res.status(500).json({ error: 'Serverkonfiguration unvollständig' }); return; }
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
  }
}
