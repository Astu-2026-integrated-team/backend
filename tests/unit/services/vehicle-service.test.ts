let queryResults: any[] = [];
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
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

import {
  listVehicles,
  registerVehicle,
  getVehicle,
  updateVehicle,
  getVehicleHistory,
  listVehicleTrips,
  listVehicleAlerts
} from '../../../src/services/vehicle-service';
import { ERROR_CODES } from '../../../src/config/constants';

describe('Vehicle Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
  });

  describe('listVehicles', () => {
    it('should list vehicles and merge states correctly', async () => {
      queryResults.push({ data: [{ vehicleId: 'V1', status: 'active', assignedDriver: null, assignedDevice: null }] });
      queryResults.push({ data: [{ vehicleId: 'V1', deviceStatus: 'online' }] });

      const res = await listVehicles({ status: 'all', deviceStatus: 'all' });
      expect(res.count).toBe(1);
      expect(res.vehicles[0].currentState.deviceStatus).toBe('online');
    });

    it('should filter by status and deviceStatus', async () => {
      queryResults.push({ data: [{ vehicleId: 'V1', status: 'active' }, { vehicleId: 'V2', status: 'inactive' }] });
      queryResults.push({ data: [{ vehicleId: 'V1', deviceStatus: 'online' }, { vehicleId: 'V2', deviceStatus: 'offline' }] });

      const res = await listVehicles({ status: 'active', deviceStatus: 'online' });
      expect(res.count).toBe(1);
      expect(res.vehicles[0].vehicleId).toBe('V1');
    });
    
    it('should throw error if query fails', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await expect(listVehicles({ status: 'all', deviceStatus: 'all' })).rejects.toThrow('DB Error');
    });
  });

  describe('registerVehicle', () => {
    it('should register a new vehicle successfully', async () => {
      queryResults.push({ error: null }); 
      queryResults.push({ error: null });

      const res = await registerVehicle({ vehicleId: 'V1', assignedDeviceId: 'D1' });
      expect(res.vehicleId).toBe('V1');
      expect(mockSupabase.insert).toHaveBeenCalledWith({ vehicleId: 'V1', assignedDeviceId: 'D1' });
      expect(mockSupabase.update).toHaveBeenCalledWith({ vehicleId: 'V1' });
    });

    it('should throw DUPLICATE_VEHICLE_ID error on 23505', async () => {
      queryResults.push({ error: { code: '23505' } });
      await expect(registerVehicle({ vehicleId: 'V1' })).rejects.toThrow('Vehicle V1 already exists');
    });
    
    it('should throw generic error', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await expect(registerVehicle({ vehicleId: 'V1' })).rejects.toThrow('DB Error');
    });
  });

  describe('getVehicle', () => {
    it('should get vehicle with latest state and alerts count', async () => {
      queryResults.push({ data: { vehicleId: 'V1' } }); 
      queryResults.push({ data: { vehicleId: 'V1', speed: 60 } }); 
      queryResults.push({ count: 2 }); 

      const res = await getVehicle('V1');
      expect(res.vehicleId).toBe('V1');
      expect(res.currentState.speed).toBe(60);
      expect(res.openAlertsCount).toBe(2);
    });

    it('should throw NOT_FOUND if vehicle does not exist', async () => {
      queryResults.push({ error: { message: 'Not found' }, data: null });
      await expect(getVehicle('V2')).rejects.toThrow('Vehicle not found');
    });
  });

  describe('updateVehicle', () => {
    it('should update vehicle successfully', async () => {
      queryResults.push({ data: { vehicleId: 'V1', status: 'inactive' } });
      const res = await updateVehicle('V1', { status: 'inactive' });
      expect(res.status).toBe('inactive');
    });
    
    it('should throw NOT_FOUND if update fails', async () => {
      queryResults.push({ error: { message: 'Not found' }, data: null });
      await expect(updateVehicle('V2', { status: 'inactive' })).rejects.toThrow('Vehicle not found');
    });
  });

  describe('getVehicleHistory', () => {
    it('should fetch history with pagination', async () => {
      queryResults.push({ data: [{ recordId: 1 }], count: 100, error: null });
      const res = await getVehicleHistory('V1', { from: '2023-01-01', to: '2023-12-31', limit: 10, offset: 0, fields: 'all' });
      expect(res.records.length).toBe(1);
      expect(res.total).toBe(100);
    });
    
    it('should fetch specific fields and throw error if fails', async () => {
      queryResults.push({ data: null, error: new Error('DB Error') });
      await expect(getVehicleHistory('V1', { fields: 'speed' })).rejects.toThrow('DB Error');
    });
  });

  describe('listVehicleTrips', () => {
    it('should fetch trips', async () => {
      queryResults.push({ data: [{ tripId: 1 }], count: 50, error: null });
      const res = await listVehicleTrips('V1', { status: 'completed', from: '2023-01-01', to: '2023-12-31' });
      expect(res.trips.length).toBe(1);
      expect(res.total).toBe(50);
    });
    
    it('should throw error if query fails', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await expect(listVehicleTrips('V1', {})).rejects.toThrow('DB Error');
    });
  });

  describe('listVehicleAlerts', () => {
    it('should fetch alerts', async () => {
      queryResults.push({ data: [{ alertId: 1 }], count: 20, error: null });
      const res = await listVehicleAlerts('V1', { severity: 'high' });
      expect(res.alerts.length).toBe(1);
      expect(res.total).toBe(20);
    });
    
    it('should fetch all alerts and throw error if fails', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await expect(listVehicleAlerts('V1', { status: 'all', severity: 'all' })).rejects.toThrow('DB Error');
    });
  });
});
