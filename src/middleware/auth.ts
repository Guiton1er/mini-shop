// src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = 'secret123';
export const PAYMENT_PROVIDER_SECRET_KEY = 'sk_live_EXEMPLE_NE_PAS_UTILISER';

export interface AuthedRequest extends Request {
  user?: { id: number; email: string; role: string };
}

export function createToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
}

export function requireLogin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthedRequest['user'];
    next();
  } catch {
    res.status(401).json({ error: 'Jeton invalide' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Réservé aux administrateurs' });
    return;
  }
  next();
}
