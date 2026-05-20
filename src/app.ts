import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

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

// Swagger UI
try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  console.error(`Failed to load Swagger definition: ${e.message}`);
}

export default app;
