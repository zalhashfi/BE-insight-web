import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export function createAuthenticateJWT(jwtSecret: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, jwtSecret) as AuthRequest['user'];
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  };
}

// Thin wrapper agar impor lama tetap jalan; membaca secret saat request (setelah dotenv terisi).
// Step 2 (Hono) akan menghapus wrapper ini dan memakai factory + AppEnv eksplisit.
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  return createAuthenticateJWT(loadEnv(process.env).jwtSecret)(req, res, next);
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privilege required' });
  }
  next();
};
