let queryResults: any[] = [];
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
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
  listAlerts,
  getAlert,
  resolveAlert
} from '../../../src/services/alert-service';

describe('Alert Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
  });

  describe('listAlerts', () => {
    it('should list alerts without status filter', async () => {
      queryResults.push({ data: [{ alertId: '1' }], count: 1 });
      const res = await listAlerts({ status: 'all' });
      expect(res.count).toBe(1);
    });

    it('should list alerts with status filter', async () => {
      queryResults.push({ data: [{ alertId: '1' }], count: 1 });
      const res = await listAlerts({ status: 'open' });
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'open');
      expect(res.count).toBe(1);
    });
    
    it('should throw error on DB error', async () => {
      queryResults.push({ error: new Error('DB error') });
      await expect(listAlerts({ status: 'all' })).rejects.toThrow('DB error');
    });
  });

  describe('getAlert', () => {
    it('should return alert', async () => {
      queryResults.push({ data: { alertId: '1' } });
      const res = await getAlert('1');
      expect(res.alertId).toBe('1');
    });

    it('should throw NOT_FOUND on error', async () => {
      queryResults.push({ error: { message: 'Not found' }, data: null });
      await expect(getAlert('1')).rejects.toThrow('Alert not found');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert', async () => {
      queryResults.push({ error: null });
      const res = await resolveAlert('1', 'resolved');
      expect(res.status).toBe('resolved');
    });

    it('should throw VALIDATION_ERROR on invalid status', async () => {
      await expect(resolveAlert('1', 'invalid')).rejects.toThrow('Invalid status');
    });

    it('should throw NOT_FOUND on update error', async () => {
      queryResults.push({ error: { message: 'Not found' } });
      await expect(resolveAlert('1', 'resolved')).rejects.toThrow('Alert not found');
    });
  });
});
