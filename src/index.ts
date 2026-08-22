import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import Routers (Express-based)
import { iotRouter } from './routes/iot.js';
import { authRouter } from './routes/auth.js';
import { dataRouter } from './routes/data.js';
import { devicesRouter } from './routes/devices.js';
import { firmwareRouter } from './routes/firmware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register API Routes
app.use('/api/iot', iotRouter);
app.use('/api/auth', authRouter);
app.use('/api', dataRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/firmware', firmwareRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`⚡ Server running on http://localhost:${PORT}`);
  });
}

export default app;
