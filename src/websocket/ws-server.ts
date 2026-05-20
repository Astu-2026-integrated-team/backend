import WebSocket from 'ws';
import crypto from 'crypto';

let wss = null;
const clients = new Map();

function initWsServer(server, onConnect) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = crypto.randomUUID();
    clients.set(ws, { connectedAt: new Date().toISOString(), clientId });

    if (onConnect) {
      onConnect(ws).catch(err => console.error('onConnect error:', err));
    }

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  return wss;
}

function broadcastToAll(message) {
  if (!wss) return;
  const msgString = JSON.stringify(message);
  clients.forEach((meta, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msgString);
    }
  });
}

function getWss() {
  return wss;
}

export {
  initWsServer,
  getWss,
  clients,
  broadcastToAll
};
