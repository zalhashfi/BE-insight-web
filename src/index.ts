import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { iotRouter } from './routes/iot.js';
import { dataRouter } from './routes/data.js';
import { devicesRouter } from './routes/devices.js';
import { firmwareRouter } from './routes/firmware.js';
import { usersRouter } from './routes/users.js';
import { authenticateJWT, requireAdmin } from './middleware/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// IoT device endpoints (x-device-secret / x-api-key)
app.use('/api/iot', iotRouter);

// Auth & User Management
app.use('/api/auth', authRouter);

// Sensor data query — JWT protected
app.use('/api/data', authenticateJWT, dataRouter);

// Device Management Dashboard (JWT auth + admin protected)
app.use('/api/devices', authenticateJWT, requireAdmin, devicesRouter);

// User Management Dashboard (JWT auth + admin protected)
app.use('/api/users', authenticateJWT, requireAdmin, usersRouter);

// Firmware Management (JWT auth + admin protected)
app.use('/api/firmware', authenticateJWT, requireAdmin, firmwareRouter);

const PORT = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`🚀 BE-insight-web listening on :${PORT}`));
}

export default app;
