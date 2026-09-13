export interface AppEnv {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  iotDeviceSecret: string;
  dbHost: string;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  dbPort: number;
  seedAdminEmail?: string;
  seedAdminPassword?: string;
  seedAdminName: string;
}

export function loadEnv(source: Record<string, string | undefined>): AppEnv {
  const nodeEnv = source.NODE_ENV || 'development';
  const port = Number(source.PORT) || 3000;

  if (nodeEnv === 'production' && (!source.JWT_SECRET || !source.IOT_DEVICE_SECRET)) {
    throw new Error('Missing required secrets: JWT_SECRET and IOT_DEVICE_SECRET must be set in production');
  }

  return {
    port,
    nodeEnv,
    jwtSecret: source.JWT_SECRET || 'secret',
    iotDeviceSecret: source.IOT_DEVICE_SECRET || '',
    dbHost: source.DB_HOST || 'localhost',
    dbUser: source.DB_USER || 'root',
    dbPassword: source.DB_PASSWORD || '',
    dbName: source.DB_NAME || 'insight_web_db',
    dbPort: Number(source.DB_PORT) || 3306,
    seedAdminEmail: source.SEED_ADMIN_EMAIL || undefined,
    seedAdminPassword: source.SEED_ADMIN_PASSWORD || undefined,
    seedAdminName: source.SEED_ADMIN_NAME || 'Administrator',
  };
}
