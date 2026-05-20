import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import telemetryRoutes from './routes/telemetry';
import vehiclesRoutes from './routes/vehicles';
import devicesRoutes from './routes/devices';
import driversRoutes from './routes/drivers';
import alertsRoutes from './routes/alerts';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/alerts', alertsRoutes);

export default app;
