import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { iotRouter } from './routes/iot';
import { authRouter } from './routes/auth';
import { ticketRouter } from './routes/ticket';
import { usersRouter } from './routes/users';
import { stationsRouter } from './routes/stations';
import { dataRouter } from './routes/data';
import { logsRouter } from './routes/logs';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { jwt } from 'hono/jwt';
import { HTTPException } from 'hono/http-exception';

type Bindings = {
  HYPERDRIVE: any;
  JWT_SECRET: string;
  RATE_LIMITER: any;
  DATABASE_URL?: string;
}

const app = new Hono<{ Bindings: Bindings, Variables: { db: any } }>();

// Global Middleware
app.use('*', secureHeaders());
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Restrict to production domains only. Localhost is not allowed for security reasons.
    // Local development should use Vite's proxy instead of relying on CORS.
    if (origin && (origin.endsWith('biru-langit.com') || origin.endsWith('pages.dev'))) {
      return origin;
    }
    // Default fallback to strict domain (or null to block)
    return 'https://insight.biru-langit.com';
  },
  credentials: true,
}));

// Routes that don't need DB
app.route('/api/logs', logsRouter);

// Database middleware
app.use('*', async (c, next) => {
  // If we have HYPERDRIVE, use it. Otherwise fallback to DATABASE_URL.
  let uri = c.env?.DATABASE_URL;
  
  if (c.env?.HYPERDRIVE) {
    const hdUri = c.env.HYPERDRIVE.connectionString;
    // In local dev, miniflare currently mocks hyperdrive with a dummy postgres string. 
    // If it returns the mock, fallback to DATABASE_URL for local MySQL development.
    if (!hdUri.startsWith('postgres') || !c.env?.DATABASE_URL) {
      uri = hdUri;
    }
  }

  if (uri && !c.get('db')) {
    try {
      const connection = await mysql.createConnection({
        uri,
        disableEval: true
      });
      const db = drizzle(connection);
      c.set('db', db);
    } catch (error: any) {
      console.error('Database connection error:', error.message);
      return c.json({ error: 'Database connection failed', details: error.message }, 500);
    }
  }
  await next();
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled Exception:', err);

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  // In production, do not leak error details
  return c.json({
    error: 'Internal Server Error'
  }, 500);
});

// Custom middleware to access env variables for JWT
const jwtAuth = async (c: any, next: any) => {
  const secret = c.env?.JWT_SECRET;
  if (!secret) {
    return c.json({ error: 'Server configuration error' }, 500);
  }
  const jwtMiddleware = jwt({ secret, cookie: 'token', alg: 'HS256' });
  return jwtMiddleware(c, next);
};

app.use('/api/tickets/*', jwtAuth);
app.use('/api/users/*', jwtAuth);
app.use('/api/stations/*', jwtAuth);
app.use('/api/data/*', jwtAuth);

// Endpoint to check auth status (so frontend doesn't need to read localStorage)
app.get('/api/auth/me', jwtAuth, (c) => {
  const payload = c.get('jwtPayload');
  return c.json({ user: payload }, 200);
});

// KV-based Rate Limiter
const rateLimiter = async (c: any, next: any) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const kv = c.env?.RATE_LIMITER;

  if (!kv) {
    console.warn('RATE_LIMITER KV namespace not bound. Falling back to allowed.');
    return next();
  }

  const key = `ratelimit:${ip}`;
  const maxRequests = 20; // 20 requests per minute

  const currentCountStr = await kv.get(key);
  let count = currentCountStr ? parseInt(currentCountStr, 10) : 0;

  if (count >= maxRequests) {
    return c.json({ error: 'Too Many Requests' }, 429);
  }

  count++;
  // Set TTL to 60 seconds. Note: expirationTtl minimum is 60 seconds for KV
  await kv.put(key, count.toString(), { expirationTtl: 60 });

  return next();
};

app.use('/api/auth/*', rateLimiter);
app.use('/api/iot/identity', rateLimiter);

// Routes
app.route('/api/iot', iotRouter);
app.route('/api/auth', authRouter);
app.route('/api/tickets', ticketRouter);
app.route('/api/users', usersRouter);
app.route('/api/stations', stationsRouter);
app.route('/api/data', dataRouter);

app.get('/api', (c) => {
  return c.json({ message: 'Welcome to Biru Langit API' });
});

export default app;
