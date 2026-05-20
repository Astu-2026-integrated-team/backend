import { broadcastToAll  } from '../websocket/ws-server';
import { WS_EVENTS  } from '../config/constants';

function broadcastVehicleUpdate(vehicleId, state) {
  broadcastToAll({
    type: WS_EVENTS.VEHICLE_UPDATE,
    payload: { vehicleId, ...state },
    timestamp: new Date().toISOString()
  });
}

function broadcastAlertFired(alert) {
  broadcastToAll({
    type: WS_EVENTS.ALERT_FIRED,
    payload: alert,
    timestamp: new Date().toISOString()
  });
}

function broadcastDeviceStatusChange(vehicleId, deviceId, prevStatus, newStatus) {
  broadcastToAll({
    type: WS_EVENTS.DEVICE_STATUS_CHANGE,
    payload: { vehicleId, deviceId, prevStatus, newStatus, lastSeenAt: new Date().toISOString() },
    timestamp: new Date().toISOString()
  });
}

function sendAllVehiclesState(ws, vehicles) {
  const now = new Date().toISOString();
  // Send CONNECTED first
  const connectedMsg = JSON.stringify({
    type: WS_EVENTS.CONNECTED,
    payload: {
      connectedVehicles: vehicles.map(v => v.vehicleId),
      serverTime: now
    },
    timestamp: now
  });
  if (ws.readyState === 1 /* WebSocket.OPEN */) {
    ws.send(connectedMsg);
  }

  // Then ALL_VEHICLES_STATE
  const stateMsg = JSON.stringify({
    type: WS_EVENTS.ALL_VEHICLES_STATE,
    payload: { vehicles },
    timestamp: now
  });
  if (ws.readyState === 1) {
    ws.send(stateMsg);
  }
}

export {
  broadcastVehicleUpdate,
  broadcastAlertFired,
  broadcastDeviceStatusChange,
  sendAllVehiclesState
};
