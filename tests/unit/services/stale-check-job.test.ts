let queryResults: any[] = [];
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
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

jest.mock('../../../src/services/websocket-service', () => ({
  broadcastDeviceStatusChange: jest.fn(),
  broadcastAlertFired: jest.fn()
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

import { checkStaleDevices, startStaleCheckJob } from '../../../src/services/stale-check-job';
import thresholds from '../../../src/config/thresholds';
import { DEVICE_STATUS, ALERT_TYPES } from '../../../src/config/constants';
import * as wsService from '../../../src/services/websocket-service';
import cron from 'node-cron';

describe('Stale Check Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('checkStaleDevices', () => {
    it('should fetch devices and do nothing if no devices', async () => {
      queryResults.push({ data: [] });
      await checkStaleDevices();
      expect(mockSupabase.from).toHaveBeenCalledWith('devices');
    });

    it('should catch error on fetch devices', async () => {
      queryResults.push({ error: new Error('DB Error') });
      await checkStaleDevices();
      expect(console.error).toHaveBeenCalled();
    });

    it('should ignore devices with no lastSeenAt', async () => {
      queryResults.push({ data: [{ deviceId: '1', status: 'online' }] });
      await checkStaleDevices();
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should mark device STALE if > STALE_THRESHOLD_MINUTES', async () => {
      const past = new Date(Date.now() - (thresholds.STALE_THRESHOLD_MINUTES + 1) * 60000);
      queryResults.push({ data: [{ deviceId: '1', status: 'online', lastSeenAt: past.toISOString(), vehicleId: 'V1' }] });
      queryResults.push({ error: null }); // update status
      queryResults.push({ data: [] }); // open alerts
      queryResults.push({ error: null }); // insert alert

      await checkStaleDevices();
      expect(mockSupabase.update).toHaveBeenCalledWith({ status: DEVICE_STATUS.STALE });
      expect(wsService.broadcastDeviceStatusChange).toHaveBeenCalled();
      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(wsService.broadcastAlertFired).toHaveBeenCalled();
    });

    it('should mark device OFFLINE if > OFFLINE_THRESHOLD_MINUTES', async () => {
      const past = new Date(Date.now() - (thresholds.OFFLINE_THRESHOLD_MINUTES + 1) * 60000);
      queryResults.push({ data: [{ deviceId: '1', status: 'stale', lastSeenAt: past.toISOString(), vehicleId: 'V1' }] });
      queryResults.push({ error: null }); // update device
      queryResults.push({ data: [{ alertId: 'existing' }] }); // fetch alerts

      await checkStaleDevices();
      expect(mockSupabase.update).toHaveBeenCalledWith({ status: DEVICE_STATUS.OFFLINE });
      expect(mockSupabase.insert).not.toHaveBeenCalled(); 
    });

    it('should catch error on processDevice', async () => {
      const past = new Date(Date.now() - (thresholds.STALE_THRESHOLD_MINUTES + 1) * 60000);
      queryResults.push({ data: [{ deviceId: '1', status: 'online', lastSeenAt: past.toISOString(), vehicleId: 'V1' }] });
      queryResults.push(new Error('Update Error')); 

      await checkStaleDevices();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('startStaleCheckJob', () => {
    it('should schedule cron job', () => {
      startStaleCheckJob();
      expect(cron.schedule).toHaveBeenCalled();
    });
  });
});
