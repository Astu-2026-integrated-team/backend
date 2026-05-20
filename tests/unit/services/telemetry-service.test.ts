let queryResults = [];
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  then: jest.fn((resolve, reject) => {
    const next = queryResults.shift() || { data: null, error: null };
    if (next instanceof Error) {
      reject(next);
    } else {
      resolve(next);
    }
  })
};

jest.mock('../../../src/db/supabase-client', () => ({
  supabase: mockSupabase
}));

jest.mock('../../../src/services/trip-service', () => ({
  detectTripTransition: jest.fn()
}));

jest.mock('../../../src/services/alert-rule-engine', () => ({
  runAlertRules: jest.fn().mockResolvedValue([])
}));

jest.mock('../../../src/services/websocket-service', () => ({
  broadcastVehicleUpdate: jest.fn(),
  broadcastAlertFired: jest.fn()
}));

// Require telemetry-service AFTER mocking
import { mapToNormalized, ingestTelemetry  } from '../../../src/services/telemetry-service';
import { supabase  } from '../../../src/db/supabase-client';
import { runAlertRules  } from '../../../src/services/alert-rule-engine';
import { broadcastAlertFired  } from '../../../src/services/websocket-service';

import { basePayload } from '../../fixtures/telemetryPayload';

describe('Telemetry Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
  });

  describe('mapToNormalized', () => {
    it('should correctly map all fields', () => {
      const meta = { telemetryId: 'tel-1', vehicleId: 'V001', deviceId: 'ESP-1', receivedAt: '2026-05-20T12:00:00Z' };
      const normalized = mapToNormalized(basePayload, meta);
      
      expect(normalized.telemetryId).toBe(meta.telemetryId);
      expect(normalized.vehicleId).toBe(meta.vehicleId);
      expect(normalized.fuelLiters).toBe(basePayload.fuel_l);
      expect(normalized.engineOn).toBe(basePayload.engine);
      expect(normalized.speedKmh).toBe(basePayload.speed_kmh);
      expect(normalized.geofenceOk).toBe(basePayload.geofence_ok);
      expect(normalized.deviceAlertText).toBeNull();
    });
  });

  describe('ingestTelemetry', () => {
    it('should run the entire pipeline successfully', async () => {
      queryResults.push({ data: { vehicleId: 'V001' } }); // resolveVehicleFromDevice
      queryResults.push({ error: null }); // insertTelemetryRaw
      queryResults.push({ error: null }); // insertTelemetryNormalized
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // getPreviousState (Step 10)
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // getPreviousState (inside Step 8)
      queryResults.push({ error: null }); // upsert latest state (Step 8)
      queryResults.push({ error: null }); // update device status (Step 9)
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // refetch state

      const result = await ingestTelemetry('ESP-1', basePayload);
      
      expect(result.accepted).toBe(true);
      expect(result.vehicleId).toBe('V001');
      expect(result.telemetryId).toBeDefined();
    });

    it('should handle alerts fired during ingestion and update alert level', async () => {
      (runAlertRules as jest.Mock).mockResolvedValueOnce([
        { type: 'SUSPECTED_FUEL_DROP', severity: 'critical', message: 'Theft detected' }
      ]);

      queryResults.push({ data: { vehicleId: 'V001' } }); // resolveVehicleFromDevice
      queryResults.push({ error: null }); // insertTelemetryRaw
      queryResults.push({ error: null }); // insertTelemetryNormalized
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // getPreviousState (Step 10)
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // getPreviousState (inside Step 8)
      queryResults.push({ error: null }); // upsert latest state (Step 8)
      queryResults.push({ error: null }); // update device status (Step 9)
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // refetch state
      queryResults.push({ error: null }); // update currentAlertLevel to critical

      const result = await ingestTelemetry('ESP-1', basePayload);
      
      expect(result.accepted).toBe(true);
      expect(broadcastAlertFired).toHaveBeenCalled();
    });

    it('should handle other alert severity levels (warning, info)', async () => {
      (runAlertRules as jest.Mock).mockResolvedValueOnce([
        { type: 'LOW_FUEL', severity: 'warning', message: 'Low fuel' },
        { type: 'REFILL_DETECTED', severity: 'info', message: 'Refill' }
      ]);

      queryResults.push({ data: { vehicleId: 'V001' } }); // resolveVehicleFromDevice
      queryResults.push({ error: null }); // insertTelemetryRaw
      queryResults.push({ error: null }); // insertTelemetryNormalized
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // getPreviousState (Step 10)
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // getPreviousState (inside Step 8)
      queryResults.push({ error: null }); // upsert latest state (Step 8)
      queryResults.push({ error: null }); // update device status (Step 9)
      queryResults.push({ data: { engineOn: false, currentAlertLevel: 'none', activeTripId: null } }); // refetch state
      queryResults.push({ error: null }); // update currentAlertLevel to warning

      const result = await ingestTelemetry('ESP-1', basePayload);
      expect(result.accepted).toBe(true);
    });

    it('should throw UNKNOWN_DEVICE if device not found', async () => {
      queryResults.push({ error: new Error('UNKNOWN_DEVICE') });
      await expect(ingestTelemetry('ESP-UNKNOWN', basePayload)).rejects.toThrow('UNKNOWN_DEVICE');
    });

    it('should throw if raw insert fails', async () => {
      queryResults.push({ data: { vehicleId: 'V001' } }); // resolveVehicle
      queryResults.push({ error: new Error('DB Raw Error') }); // insertRaw
      await expect(ingestTelemetry('ESP-1', basePayload)).rejects.toThrow('DB Raw Error');
    });

    it('should throw if normalized insert fails', async () => {
      queryResults.push({ data: { vehicleId: 'V001' } }); // resolveVehicle
      queryResults.push({ error: null }); // insertRaw
      queryResults.push({ error: new Error('DB Norm Error') }); // insertNorm
      await expect(ingestTelemetry('ESP-1', basePayload)).rejects.toThrow('DB Norm Error');
    });

    it('should throw if upsert fails', async () => {
      queryResults.push({ data: { vehicleId: 'V001' } }); // resolveVehicle
      queryResults.push({ error: null }); // insertRaw
      queryResults.push({ error: null }); // insertNorm
      queryResults.push({ data: null }); // getPreviousState (Step 10)
      queryResults.push({ data: null }); // getPreviousState (inside Step 8)
      queryResults.push({ error: new Error('DB Upsert Error') }); // upsert state
      await expect(ingestTelemetry('ESP-1', basePayload)).rejects.toThrow('DB Upsert Error');
    });

    it('should throw if device update fails', async () => {
      queryResults.push({ data: { vehicleId: 'V001' } }); // resolveVehicle
      queryResults.push({ error: null }); // insertRaw
      queryResults.push({ error: null }); // insertNorm
      queryResults.push({ data: null }); // getPreviousState (Step 10)
      queryResults.push({ data: null }); // getPreviousState (inside Step 8)
      queryResults.push({ error: null }); // upsert state
      queryResults.push({ error: new Error('DB Device Error') }); // update device status
      await expect(ingestTelemetry('ESP-1', basePayload)).rejects.toThrow('DB Device Error');
    });
  });
});
