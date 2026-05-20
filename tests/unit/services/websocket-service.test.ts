jest.mock('../../../src/websocket/ws-server', () => ({
  broadcastToAll: jest.fn()
}));

import {
  broadcastVehicleUpdate,
  broadcastAlertFired,
  broadcastDeviceStatusChange,
  sendAllVehiclesState
} from '../../../src/services/websocket-service';
import { broadcastToAll } from '../../../src/websocket/ws-server';
import { WS_EVENTS } from '../../../src/config/constants';

describe('WebSocket Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('broadcastVehicleUpdate', () => {
    it('should broadcast vehicle update', () => {
      broadcastVehicleUpdate('V1', { speed: 50 });
      expect(broadcastToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WS_EVENTS.VEHICLE_UPDATE,
          payload: { vehicleId: 'V1', speed: 50 }
        })
      );
    });
  });

  describe('broadcastAlertFired', () => {
    it('should broadcast alert fired', () => {
      broadcastAlertFired({ alertId: '1' });
      expect(broadcastToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WS_EVENTS.ALERT_FIRED,
          payload: { alertId: '1' }
        })
      );
    });
  });

  describe('broadcastDeviceStatusChange', () => {
    it('should broadcast status change', () => {
      broadcastDeviceStatusChange('V1', 'D1', 'online', 'offline');
      expect(broadcastToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WS_EVENTS.DEVICE_STATUS_CHANGE,
          payload: expect.objectContaining({
            vehicleId: 'V1',
            deviceId: 'D1',
            prevStatus: 'online',
            newStatus: 'offline'
          })
        })
      );
    });
  });

  describe('sendAllVehiclesState', () => {
    it('should send state when ws is open', () => {
      const mockWs = { readyState: 1, send: jest.fn() };
      sendAllVehiclesState(mockWs as any, [{ vehicleId: 'V1' }]);
      expect(mockWs.send).toHaveBeenCalledTimes(2);
    });

    it('should not send state when ws is closed', () => {
      const mockWs = { readyState: 0, send: jest.fn() };
      sendAllVehiclesState(mockWs as any, [{ vehicleId: 'V1' }]);
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });
});
