import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import vehiclesRoutes from './routes/vehicles';
import devicesRoutes from './routes/devices';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/devices', devicesRoutes);

export default app;
