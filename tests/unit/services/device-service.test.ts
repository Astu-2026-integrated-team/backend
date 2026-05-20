let queryResults: any[] = [];
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
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
  listDevices,
  getDevice,
  registerDevice,
  updateDevice
} from '../../../src/services/device-service';

describe('Device Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
  });

  describe('listDevices', () => {
    it('should list all devices', async () => {
      queryResults.push({ data: [{ deviceId: '1' }] });
      const res = await listDevices();
      expect(res.count).toBe(1);
    });

    it('should throw on error', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await expect(listDevices()).rejects.toThrow('DB Error');
    });
  });

  describe('getDevice', () => {
    it('should get device', async () => {
      queryResults.push({ data: { deviceId: '1' } });
      const res = await getDevice('1');
      expect(res.deviceId).toBe('1');
    });

    it('should throw NOT_FOUND on error', async () => {
      queryResults.push({ error: { message: 'Not found' }, data: null });
      await expect(getDevice('1')).rejects.toThrow('Device not found');
    });
  });

  describe('registerDevice', () => {
    it('should register new device', async () => {
      queryResults.push({ error: null }); 
      queryResults.push({ error: null }); 

      const res = await registerDevice({ deviceId: '1', vehicleId: 'V1' }, 'admin1');
      expect(res.deviceId).toBe('1');
    });

    it('should throw DUPLICATE_DEVICE_ID', async () => {
      queryResults.push({ error: { code: '23505' } });
      await expect(registerDevice({ deviceId: '1' }, 'admin1')).rejects.toThrow('Device 1 already exists');
    });

    it('should throw generic error', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await expect(registerDevice({ deviceId: '1' }, 'admin1')).rejects.toThrow('DB Error');
    });
  });

  describe('updateDevice', () => {
    it('should update device and vehicle assignment', async () => {
      queryResults.push({ error: null }); 
      queryResults.push({ error: null }); 
      queryResults.push({ error: null }); 

      const res = await updateDevice('1', { vehicleId: 'V1' });
      expect(res.deviceId).toBe('1');
    });
    
    it('should update device and unassign vehicle', async () => {
      queryResults.push({ error: null }); 
      queryResults.push({ error: null }); 

      const res = await updateDevice('1', { vehicleId: null });
      expect(res.deviceId).toBe('1');
    });

    it('should throw NOT_FOUND on error', async () => {
      queryResults.push({ error: { message: 'Not found' } });
      await expect(updateDevice('1', {})).rejects.toThrow('Device not found');
    });
  });
});
