let queryResults: any[] = [];
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
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
  listDrivers,
  getDriver,
  registerDriver,
  updateDriver,
  getDriverViolations
} from '../../../src/services/driver-service';

describe('Driver Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
  });

  describe('listDrivers', () => {
    it('should list all drivers', async () => {
      queryResults.push({ data: [{ driverId: '1' }] });
      const res = await listDrivers();
      expect(res.count).toBe(1);
    });

    it('should throw on error', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await expect(listDrivers()).rejects.toThrow('DB Error');
    });
  });

  describe('getDriver', () => {
    it('should get driver', async () => {
      queryResults.push({ data: { driverId: '1' } });
      const res = await getDriver('1');
      expect(res.driverId).toBe('1');
    });

    it('should throw NOT_FOUND on error', async () => {
      queryResults.push({ error: { message: 'Not found' }, data: null });
      await expect(getDriver('1')).rejects.toThrow('Driver not found');
    });
  });

  describe('registerDriver', () => {
    it('should register new driver', async () => {
      queryResults.push({ error: null }); 
      const res = await registerDriver({ driverId: '1' });
      expect(res.driverId).toBe('1');
    });

    it('should register new driver without driverId', async () => {
      queryResults.push({ error: null }); 
      const res = await registerDriver({ licenseNumber: 'XYZ' });
      expect(res.driverId).toBeDefined();
      expect(res.driverId).not.toBe('1');
    });

    it('should throw DUPLICATE_LICENSE', async () => {
      queryResults.push({ error: { code: '23505' } });
      await expect(registerDriver({ driverId: '1' })).rejects.toThrow('License number undefined already exists');
    });

    it('should throw generic error', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await expect(registerDriver({ driverId: '1' })).rejects.toThrow('DB Error');
    });
  });

  describe('updateDriver', () => {
    it('should update driver', async () => {
      queryResults.push({ error: null }); 
      const res = await updateDriver('1', {});
      expect(res.driverId).toBe('1');
    });
    
    it('should throw NOT_FOUND on error', async () => {
      queryResults.push({ error: { message: 'Not found' } });
      await expect(updateDriver('1', {})).rejects.toThrow('Driver not found');
    });
  });

  describe('getDriverViolations', () => {
    it('should get driver violations', async () => {
      queryResults.push({ data: { driverId: '1' } }); 
      queryResults.push({ data: [{ vehicleId: 'V1' }], count: 1 }); 
      queryResults.push({ data: [{ vehicleId: 'V1', label: 'Truck 1' }] }); 

      const res = await getDriverViolations('1', { from: '2023-01-01', to: '2023-12-31', type: 'speeding' });
      expect(res.totalViolations).toBe(1);
      expect(res.violations[0].vehicleLabel).toBe('Truck 1');
    });

    it('should handle no vehicles', async () => {
      queryResults.push({ data: { driverId: '1' } }); 
      queryResults.push({ data: [{ vehicleId: 'V1' }], count: 1 }); 
      queryResults.push({ data: null }); 

      const res = await getDriverViolations('1', { type: 'all' });
      expect(res.violations[0].vehicleLabel).toBe('Unknown');
    });
    
    it('should throw error on violations query', async () => {
      queryResults.push({ data: { driverId: '1' } }); 
      queryResults.push({ error: new Error('DB Error') }); 

      await expect(getDriverViolations('1', {})).rejects.toThrow('DB Error');
    });
  });
});
