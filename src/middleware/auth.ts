import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthEnv {
  Variables: {
    user: AuthUser;
  };
}

export function createAuthenticateJWT(jwtSecret: string) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const authHeader = c.req.header('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Access token required' }, 401);
    }

    const token = authHeader.split(' ')[1];

    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
      c.set('user', {
        id: payload.id as number,
        name: payload.name as string,
        email: payload.email as string,
        role: payload.role as string,
      });
      await next();
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 403);
    }
  });
}

export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin privilege required' }, 403);
  }
  await next();
});
