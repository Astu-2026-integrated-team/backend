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

import { checkLowFuel, 
  checkSuspectedFuelDrop, 
  checkOverspeed, 
  checkDoorOpenParked, 
  checkGeofenceViolation, 
  checkRefillDetected, 
  runAlertRules 
 } from '../../../src/services/alert-rule-engine';

import thresholds from '../../../src/config/thresholds';
import { ALERT_TYPES, ALERT_SEVERITY  } from '../../../src/config/constants';
import { supabase  } from '../../../src/db/supabase-client';

describe('Alert Rule Engine - checkLowFuel', () => {
  it('should trigger when fuelPercent < LOW_FUEL_PERCENT', () => {
    const res = checkLowFuel({ fuelPercent: 10, lowFuelFlag: false, vehicleId: 'V001', fuelLiters: 6 }, []);
    expect(res).not.toBeNull();
    expect(res.type).toBe(ALERT_TYPES.LOW_FUEL);
  });

  it('should trigger when lowFuelFlag is true', () => {
    const res = checkLowFuel({ fuelPercent: 20, lowFuelFlag: true, vehicleId: 'V001', fuelLiters: 12 }, []);
    expect(res).not.toBeNull();
    expect(res.type).toBe(ALERT_TYPES.LOW_FUEL);
  });

  it('should not trigger when fuel level is safe', () => {
    const res = checkLowFuel({ fuelPercent: 50, lowFuelFlag: false, vehicleId: 'V001', fuelLiters: 30 }, []);
    expect(res).toBeNull();
  });

  it('should skip if open alert exists', () => {
    const res = checkLowFuel({ fuelPercent: 10, lowFuelFlag: false, vehicleId: 'V001', fuelLiters: 6 }, [{ type: ALERT_TYPES.LOW_FUEL }]);
    expect(res).toBeNull();
  });
});

describe('Alert Rule Engine - checkSuspectedFuelDrop', () => {
  const norm = { engineOn: false, parkingMode: true, fuelLiters: 30, vehicleId: 'V001' };

  it('should trigger on fuel drop > THEFT_DROP_LITERS', () => {
    const recent = [{ fuelLiters: 35 }];
    const res = checkSuspectedFuelDrop(norm, recent);
    expect(res).not.toBeNull();
    expect(res.type).toBe(ALERT_TYPES.SUSPECTED_FUEL_DROP);
  });

  it('should not trigger if drop <= THEFT_DROP_LITERS', () => {
    const recent = [{ fuelLiters: 32 }];
    const res = checkSuspectedFuelDrop(norm, recent);
    expect(res).toBeNull();
  });

  it('should not trigger if recent fuel is less than or equal to current', () => {
    const recent = [{ fuelLiters: 28 }];
    const res = checkSuspectedFuelDrop(norm, recent);
    expect(res).toBeNull();
  });

  it('should skip when engine ON', () => {
    const recent = [{ fuelLiters: 35 }];
    const res = checkSuspectedFuelDrop({ ...norm, engineOn: true }, recent);
    expect(res).toBeNull();
  });

  it('should skip when parkingMode OFF', () => {
    const recent = [{ fuelLiters: 35 }];
    const res = checkSuspectedFuelDrop({ ...norm, parkingMode: false }, recent);
    expect(res).toBeNull();
  });

  it('should not trigger if no recent records', () => {
    const res = checkSuspectedFuelDrop(norm, []);
    expect(res).toBeNull();
  });
});

describe('Alert Rule Engine - checkOverspeed', () => {
  it('should trigger when speedKmh > OVERSPEED_KMH', () => {
    const res = checkOverspeed({ speedKmh: 90, overspeedFlag: false, vehicleId: 'V001' }, []);
    expect(res).not.toBeNull();
  });

  it('should trigger when overspeedFlag is true', () => {
    const res = checkOverspeed({ speedKmh: 70, overspeedFlag: true, vehicleId: 'V001' }, []);
    expect(res).not.toBeNull();
  });

  it('should skip if open alert exists', () => {
    const res = checkOverspeed({ speedKmh: 90, overspeedFlag: false, vehicleId: 'V001' }, [{ type: ALERT_TYPES.OVERSPEED }]);
    expect(res).toBeNull();
  });

  it('should not trigger when safe speed', () => {
    const res = checkOverspeed({ speedKmh: 70, overspeedFlag: false, vehicleId: 'V001' }, []);
    expect(res).toBeNull();
  });
});

describe('Alert Rule Engine - checkDoorOpenParked', () => {
  it('should trigger when door open, engine off, parked', () => {
    const res = checkDoorOpenParked({ doorOpen: true, engineOn: false, parkingMode: true, vehicleId: 'V001' }, []);
    expect(res).not.toBeNull();
  });

  it('should not trigger when engine on', () => {
    const res = checkDoorOpenParked({ doorOpen: true, engineOn: true, parkingMode: true, vehicleId: 'V001' }, []);
    expect(res).toBeNull();
  });

  it('should not trigger when not parked', () => {
    const res = checkDoorOpenParked({ doorOpen: true, engineOn: false, parkingMode: false, vehicleId: 'V001' }, []);
    expect(res).toBeNull();
  });

  it('should skip if open alert exists', () => {
    const res = checkDoorOpenParked({ doorOpen: true, engineOn: false, parkingMode: true, vehicleId: 'V001' }, [{ type: ALERT_TYPES.DOOR_OPEN_PARKED }]);
    expect(res).toBeNull();
  });
});

describe('Alert Rule Engine - checkGeofenceViolation', () => {
  it('should trigger when geofenceOk is false', () => {
    const res = checkGeofenceViolation({ geofenceOk: false, vehicleId: 'V001', locationName: 'Home' }, []);
    expect(res).not.toBeNull();
  });

  it('should not trigger when geofenceOk is true', () => {
    const res = checkGeofenceViolation({ geofenceOk: true, vehicleId: 'V001' }, []);
    expect(res).toBeNull();
  });

  it('should skip if open alert exists', () => {
    const res = checkGeofenceViolation({ geofenceOk: false, vehicleId: 'V001' }, [{ type: ALERT_TYPES.GEOFENCE_VIOLATION }]);
    expect(res).toBeNull();
  });
});

describe('Alert Rule Engine - checkRefillDetected', () => {
  it('should trigger when fuel increase > REFILL_MIN_LITERS', () => {
    const res = checkRefillDetected({ fuelLiters: 40, vehicleId: 'V001' }, { fuelLiters: 30 });
    expect(res).not.toBeNull();
  });

  it('should not trigger when fuel increase <= REFILL_MIN_LITERS', () => {
    const res = checkRefillDetected({ fuelLiters: 34, vehicleId: 'V001' }, { fuelLiters: 30 });
    expect(res).toBeNull();
  });

  it('should handle null previousState safely', () => {
    const res = checkRefillDetected({ fuelLiters: 34, vehicleId: 'V001' }, null);
    expect(res).toBeNull();
  });
});

describe('Alert Rule Engine - runAlertRules orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
  });

  it('should return empty array when no alerts fired', async () => {
    queryResults.push({ data: [] }); // openAlerts
    queryResults.push({ data: [] }); // recentRecords
    
    const res = await runAlertRules({ fuelPercent: 50, speedKmh: 40, geofenceOk: true, receivedAt: new Date().toISOString() }, { fuelLiters: 40 }, 'V001');
    expect(res).toEqual([]);
  });

  it('should insert alerts and violations when alerts fire', async () => {
    queryResults.push({ data: [] }); // openAlerts
    queryResults.push({ data: [] }); // recentRecords
    queryResults.push({ data: { assignedDriverId: 'DRV-001' } }); // vehicleData
    queryResults.push({ data: { activeTripId: 'TRP-123' } }); // stateData
    queryResults.push({ error: null }); // alerts insert
    queryResults.push({ error: null }); // violations insert

    const res = await runAlertRules({
      fuelPercent: 5, lowFuelFlag: true, fuelLiters: 3,
      speedKmh: 90, overspeedFlag: true,
      geofenceOk: true, receivedAt: new Date().toISOString(), vehicleId: 'V001'
    }, { fuelLiters: 10 }, 'V001');

    expect(res.length).toBe(2);
    expect(res.some(a => a.type === ALERT_TYPES.LOW_FUEL)).toBe(true);
    expect(res.some(a => a.type === ALERT_TYPES.OVERSPEED)).toBe(true);
  });

  it('should insert alert and violation with FUEL_DROP type when theft is detected', async () => {
    queryResults.push({ data: [] }); // openAlerts
    queryResults.push({ data: [{ fuelLiters: 35 }] }); // recentRecords
    queryResults.push({ data: { assignedDriverId: 'DRV-001' } }); // vehicleData
    queryResults.push({ data: { activeTripId: 'TRP-123' } }); // stateData
    queryResults.push({ error: null }); // alerts insert
    queryResults.push({ error: null }); // violations insert

    const res = await runAlertRules({
      fuelPercent: 50, engineOn: false, parkingMode: true, fuelLiters: 30,
      speedKmh: 0, geofenceOk: true, receivedAt: new Date().toISOString(), vehicleId: 'V001'
    }, { fuelLiters: 30 }, 'V001');

    expect(res.length).toBe(1);
    expect(res[0].type).toBe(ALERT_TYPES.SUSPECTED_FUEL_DROP);
  });

  it('should skip violations insert if no driver', async () => {
    queryResults.push({ data: [] }); // openAlerts
    queryResults.push({ data: [] }); // recentRecords
    queryResults.push({ data: { assignedDriverId: null } }); // vehicleData
    queryResults.push({ data: { activeTripId: null } }); // stateData
    queryResults.push({ error: null }); // alerts insert

    const res = await runAlertRules({
      fuelPercent: 5, speedKmh: 90, overspeedFlag: true, geofenceOk: true, receivedAt: new Date().toISOString(), vehicleId: 'V001'
    }, { fuelLiters: 10 }, 'V001');

    expect(res.length).toBe(2);
  });
});
