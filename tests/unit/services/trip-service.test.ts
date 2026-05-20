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

import { detectTripTransition, openTrip, updateTrip, closeTrip  } from '../../../src/services/trip-service';
import { supabase  } from '../../../src/db/supabase-client';

describe('Trip Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
  });

  describe('openTrip', () => {
    it('should create new trip and update activeTripId', async () => {
      queryResults.push({ error: null }); // insert trip
      queryResults.push({ error: null }); // update activeTripId
      
      await openTrip('V001', { receivedAt: new Date().toISOString(), fuelLiters: 40, latitude: 9.0, longitude: 38.0 }, 'DRV-1');
      
      expect((supabase as any).insert).toHaveBeenCalled();
      expect((supabase as any).update).toHaveBeenCalled();
    });

    it('should throw if insert fails', async () => {
      queryResults.push({ error: new Error('Insert failed') });
      await expect(openTrip('V001', { receivedAt: new Date().toISOString() }, null)).rejects.toThrow('Insert failed');
    });

    it('should throw if update fails', async () => {
      queryResults.push({ error: null }); // insert trip
      queryResults.push({ error: new Error('Update failed') }); // update activeTripId
      await expect(openTrip('V001', { receivedAt: new Date().toISOString() }, null)).rejects.toThrow('Update failed');
    });
  });

  describe('updateTrip', () => {
    it('should calculate distance and max speed and update trip', async () => {
      queryResults.push({ data: { distanceKm: 10, maxSpeedKmh: 40 } }); // trips
      queryResults.push({ data: { latitude: 9.0, longitude: 38.0 } }); // vehicle_latest_state
      queryResults.push({ error: null }); // update trips
      
      await updateTrip('V001', 'TRP-1', { latitude: 9.1, longitude: 38.1, speedKmh: 50 });
      
      expect((supabase as any).update).toHaveBeenCalled();
      const updateCallArgs = (supabase as any).update.mock.calls[0][0];
      expect(updateCallArgs.distanceKm).toBeGreaterThan(10);
      expect(updateCallArgs.maxSpeedKmh).toBe(50);
    });

    it('should throw if fetch trip fails', async () => {
      queryResults.push({ error: new Error('Fetch failed') });
      await expect(updateTrip('V001', 'TRP-1', {})).rejects.toThrow('Fetch failed');
    });

    it('should update correctly when previous state is null', async () => {
      queryResults.push({ data: { distanceKm: 10, maxSpeedKmh: 40 } }); // fetch trip
      queryResults.push({ data: null }); // fetch previousState
      queryResults.push({ error: null }); // update trip

      await updateTrip('V001', 'TRP-1', { latitude: 9.1, longitude: 38.1, speedKmh: 30 });
      
      expect((supabase as any).update).toHaveBeenCalled();
      const updateCallArgs = (supabase as any).update.mock.calls[0][0];
      expect(updateCallArgs.distanceKm).toBe(10);
      expect(updateCallArgs.maxSpeedKmh).toBe(40);
    });

    it('should not calculate distance if previousState has no coordinates', async () => {
      queryResults.push({ data: { distanceKm: 10, maxSpeedKmh: 40 } }); // fetch trip
      queryResults.push({ data: { latitude: null, longitude: null } }); // fetch previousState
      queryResults.push({ error: null }); // update trip

      await updateTrip('V001', 'TRP-1', { latitude: 9.1, longitude: 38.1, speedKmh: 30 });
      
      expect((supabase as any).update).toHaveBeenCalled();
      const updateCallArgs = (supabase as any).update.mock.calls[0][0];
      expect(updateCallArgs.distanceKm).toBe(10);
      expect(updateCallArgs.maxSpeedKmh).toBe(40);
    });

    it('should throw if update fails', async () => {
      queryResults.push({ data: { distanceKm: 10, maxSpeedKmh: 40 } }); // fetch trip
      queryResults.push({ data: null }); // fetch previousState
      queryResults.push({ error: new Error('Update failed') }); // update trip

      await expect(updateTrip('V001', 'TRP-1', {})).rejects.toThrow('Update failed');
    });
  });

  describe('closeTrip', () => {
    it('should compute fuelUsed and avgSpeed and update trip', async () => {
      const startTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      queryResults.push({ data: { startFuelLiters: 40, distanceKm: 50, startTime } }); // fetch trip
      queryResults.push({ error: null }); // update trip
      queryResults.push({ error: null }); // update latest state

      await closeTrip('V001', 'TRP-1', { fuelLiters: 35, latitude: 9.0, longitude: 38.0, receivedAt: new Date().toISOString() });
      
      expect((supabase as any).update).toHaveBeenCalledTimes(2); // once for trips, once for vehicle_latest_state
      const tripUpdateArgs = (supabase as any).update.mock.calls[0][0];
      expect(tripUpdateArgs.fuelUsedLiters).toBe(5);
      expect(tripUpdateArgs.avgSpeedKmh).toBeCloseTo(50);
    });

    it('should throw if fetch fails', async () => {
      queryResults.push({ error: new Error('Fetch failed') });
      await expect(closeTrip('V001', 'TRP-1', {})).rejects.toThrow('Fetch failed');
    });

    it('should throw if trip update fails', async () => {
      queryResults.push({ data: { startFuelLiters: 40, distanceKm: 50, startTime: new Date().toISOString() } }); // fetch trip
      queryResults.push({ error: new Error('Trip update failed') }); // update trip
      await expect(closeTrip('V001', 'TRP-1', { fuelLiters: 35, receivedAt: new Date().toISOString() })).rejects.toThrow('Trip update failed');
    });

    it('should throw if state update fails', async () => {
      queryResults.push({ data: { startFuelLiters: 40, distanceKm: 50, startTime: new Date().toISOString() } }); // fetch trip
      queryResults.push({ error: null }); // update trip
      queryResults.push({ error: new Error('State update failed') }); // update state
      await expect(closeTrip('V001', 'TRP-1', { fuelLiters: 35, receivedAt: new Date().toISOString() })).rejects.toThrow('State update failed');
    });
  });

  describe('detectTripTransition', () => {
    it('should handle OFF -> ON', async () => {
      queryResults.push({ data: { assignedDriverId: 'DRV-1' } }); // vehicles
      queryResults.push({ error: null }); // openTrip: insert
      queryResults.push({ error: null }); // openTrip: update latest state
      
      await detectTripTransition('V001', { engineOn: true, receivedAt: new Date().toISOString() }, { engineOn: false });
      
      expect((supabase as any).insert).toHaveBeenCalled();
    });

    it('should handle OFF -> ON when vehicle has no assigned driver', async () => {
      queryResults.push({ data: null }); // vehicles
      queryResults.push({ error: null }); // openTrip: insert
      queryResults.push({ error: null }); // openTrip: update latest state
      
      await detectTripTransition('V001', { engineOn: true, receivedAt: new Date().toISOString() }, { engineOn: false });
      
      expect((supabase as any).insert).toHaveBeenCalled();
    });

    it('should handle ON -> ON', async () => {
      queryResults.push({ data: { distanceKm: 10 } }); // updateTrip: fetch trip
      queryResults.push({ data: null }); // updateTrip: fetch state
      queryResults.push({ error: null }); // updateTrip: update trip
      
      await detectTripTransition('V001', { engineOn: true, speedKmh: 50 }, { engineOn: true, activeTripId: 'TRP-1' });
      
      expect((supabase as any).update).toHaveBeenCalled();
    });

    it('should handle ON -> OFF', async () => {
      const startTime = new Date(Date.now() - 3600000).toISOString();
      queryResults.push({ data: { startFuelLiters: 40, distanceKm: 50, startTime } }); // closeTrip: fetch trip
      queryResults.push({ error: null }); // closeTrip: update trip
      queryResults.push({ error: null }); // closeTrip: update state
      
      await detectTripTransition('V001', { engineOn: false, fuelLiters: 35, receivedAt: new Date().toISOString() }, { engineOn: true, activeTripId: 'TRP-1' });
      
      expect((supabase as any).update).toHaveBeenCalledTimes(2);
    });

    it('should do nothing on ON -> OFF when there is no active trip', async () => {
      await detectTripTransition('V001', { engineOn: false }, { engineOn: true, activeTripId: null });
      expect((supabase as any).update).not.toHaveBeenCalled();
    });

    it('should do nothing if no previous state', async () => {
      await detectTripTransition('V001', { engineOn: true }, null);
      expect((supabase as any).insert).not.toHaveBeenCalled();
      expect((supabase as any).update).not.toHaveBeenCalled();
    });
  });
});
