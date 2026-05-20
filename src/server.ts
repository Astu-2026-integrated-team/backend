require('dotenv').config();
import http from 'http';
import app from './app';
import { initWsServer  } from './websocket/ws-server';
import { sendAllVehiclesState  } from './services/websocket-service';
import { listVehicles  } from './services/vehicle-service';
import { startStaleCheckJob  } from './services/stale-check-job';

const port = Number(process.env.APP_PORT || 8000);
const host = process.env.APP_HOST || '0.0.0.0';

const server = http.createServer(app);

// Initialize WebSocket server and provide onConnect handler
initWsServer(server, async (ws) => {
  try {
    // Fetch all vehicles
    const result = await listVehicles({ status: 'all', deviceStatus: 'all' });
    sendAllVehiclesState(ws, result.vehicles);
  } catch (err) {
    console.error('Error in WS onConnect:', err);
  }
});

server.listen(port, host, () => {
  console.warn(`Server running on http://${host}:${port}`);

  // Start background job
  startStaleCheckJob();
});

export default server;
