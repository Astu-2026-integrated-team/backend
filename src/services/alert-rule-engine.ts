import crypto from 'crypto';
import { supabase } from '../db/supabase-client';
import { ALERT_TYPES, ALERT_SEVERITY } from '../config/constants';
import thresholds from '../config/thresholds';



function checkLowFuel(normalized: any, openAlerts: any[]) {
  const isOpen = openAlerts.some(a => a.type === ALERT_TYPES.LOW_FUEL);
  if (isOpen) return null;

  if (normalized.fuelPercent < thresholds.LOW_FUEL_PERCENT || normalized.lowFuelFlag) {
    return {
      type: ALERT_TYPES.LOW_FUEL,
      severity: ALERT_SEVERITY.WARNING,
      vehicleId: normalized.vehicleId,
      evidence: {
        fuelLiters: normalized.fuelLiters,
        fuelPercent: normalized.fuelPercent,
        deviceFlag: normalized.lowFuelFlag
      },
      message: `Fuel level at ${normalized.fuelPercent}% (${normalized.fuelLiters} liters). Immediate refuel required.`
    };
  }
  return null;
}

function checkSuspectedFuelDrop(normalized: any, recentRecords: any[]) {
  if (normalized.engineOn || !normalized.parkingMode) return null;

  if (!recentRecords || recentRecords.length === 0) return null;

  let maxFuelBefore = normalized.fuelLiters;
  for (const rec of recentRecords) {
    if (rec.fuelLiters > maxFuelBefore) {
      maxFuelBefore = rec.fuelLiters;
    }
  }

  const dropLiters = maxFuelBefore - normalized.fuelLiters;
  if (dropLiters > thresholds.THEFT_DROP_LITERS) {
    return {
      type: ALERT_TYPES.SUSPECTED_FUEL_DROP,
      severity: ALERT_SEVERITY.CRITICAL,
      vehicleId: normalized.vehicleId,
      evidence: {
        fuelBefore: maxFuelBefore,
        fuelAfter: normalized.fuelLiters,
        dropLiters: dropLiters,
        windowMinutes: thresholds.THEFT_WINDOW_MINUTES,
        engineOn: normalized.engineOn,
        parkingMode: normalized.parkingMode
      },
      message: `Suspected fuel drop of ${dropLiters.toFixed(2)}L detected while parked.`
    };
  }
  return null;
}

function checkOverspeed(normalized: any, openAlerts: any[]) {
  const isOpen = openAlerts.some(a => a.type === ALERT_TYPES.OVERSPEED);
  if (isOpen) {
    return null;
  }

  if (normalized.speedKmh > thresholds.OVERSPEED_KMH || normalized.overspeedFlag) {
    return {
      type: ALERT_TYPES.OVERSPEED,
      severity: ALERT_SEVERITY.WARNING,
      vehicleId: normalized.vehicleId,
      evidence: {
        speedKmh: normalized.speedKmh,
        threshold: thresholds.OVERSPEED_KMH,
        deviceFlag: normalized.overspeedFlag,
        tripId: null 
      },
      message: `Overspeed detected: ${normalized.speedKmh} km/h.`
    };
  }
  return null;
}

function checkDoorOpenParked(normalized: any, openAlerts: any[]) {
  const isOpen = openAlerts.some(a => a.type === ALERT_TYPES.DOOR_OPEN_PARKED);
  if (isOpen) return null;

  if (normalized.doorOpen && !normalized.engineOn && normalized.parkingMode) {
    return {
      type: ALERT_TYPES.DOOR_OPEN_PARKED,
      severity: ALERT_SEVERITY.WARNING,
      vehicleId: normalized.vehicleId,
      evidence: {
        doorOpen: normalized.doorOpen,
        engineOn: normalized.engineOn,
        parkingMode: normalized.parkingMode
      },
      message: `Door opened while vehicle is parked and engine is off.`
    };
  }
  return null;
}

function checkGeofenceViolation(normalized: any, openAlerts: any[]) {
  const isOpen = openAlerts.some(a => a.type === ALERT_TYPES.GEOFENCE_VIOLATION);
  if (isOpen) return null;

  if (!normalized.geofenceOk) {
    return {
      type: ALERT_TYPES.GEOFENCE_VIOLATION,
      severity: ALERT_SEVERITY.WARNING,
      vehicleId: normalized.vehicleId,
      evidence: {
        geofenceOk: normalized.geofenceOk,
        locationName: normalized.locationName
      },
      message: `Vehicle exited authorized geofence.`
    };
  }
  return null;
}

function checkRefillDetected(normalized: any, previousState: any) {
  if (!previousState) return null;

  const increase = normalized.fuelLiters - previousState.fuelLiters;
  if (increase > thresholds.REFILL_MIN_LITERS) {
    return {
      type: ALERT_TYPES.REFILL_DETECTED,
      severity: ALERT_SEVERITY.INFO,
      vehicleId: normalized.vehicleId,
      evidence: {
        fuelBefore: previousState.fuelLiters,
        fuelAfter: normalized.fuelLiters,
        increaseLiters: increase
      },
      message: `Fuel refill detected: ${increase.toFixed(2)} liters added.`
    };
  }
  return null;
}

async function runAlertRules(normalized: any, previousState: any, vehicleId: string) {
  const { data: openAlerts } = await (supabase as any)
    .from('alerts')
    .select('*')
    .eq('vehicleId', vehicleId)
    .eq('status', 'open');

  const alertsList = openAlerts || [];

  const windowDate = new Date(new Date(normalized.receivedAt).getTime() - thresholds.THEFT_WINDOW_MINUTES * 60000).toISOString();
  const { data: recentRecords } = await (supabase as any)
    .from('telemetry_normalized')
    .select('fuelLiters, receivedAt')
    .eq('vehicleId', vehicleId)
    .gte('receivedAt', windowDate);

  const generatedAlerts: any[] = [];

  const rules = [
    () => checkLowFuel(normalized, alertsList),
    () => checkSuspectedFuelDrop(normalized, recentRecords || []),
    () => checkOverspeed(normalized, alertsList),
    () => checkDoorOpenParked(normalized, alertsList),
    () => checkGeofenceViolation(normalized, alertsList),
    () => checkRefillDetected(normalized, previousState)
  ];

  for (const rule of rules) {
    const alertData = rule();
    if (alertData) {
      generatedAlerts.push(alertData);
    }
  }

  if (generatedAlerts.length === 0) return [];

  const { data: vehicleData } = await (supabase as any)
    .from('vehicles')
    .select('assignedDriverId, label')
    .eq('vehicleId', vehicleId)
    .single();

  const { data: stateData } = await (supabase as any)
    .from('vehicle_latest_state')
    .select('activeTripId')
    .eq('vehicleId', vehicleId)
    .single();

  const driverId = vehicleData?.assignedDriverId || null;
  const activeTripId = stateData?.activeTripId || null;

  const insertedAlerts: any[] = [];
  const insertedViolations: any[] = [];
  const now = new Date().toISOString();

  for (const alert of generatedAlerts) {
    const alertId = crypto.randomUUID();
    
    if (alert.type === ALERT_TYPES.OVERSPEED && alert.evidence) {
      alert.evidence.tripId = activeTripId;
    }

    const newAlert = {
      alertId,
      vehicleId,
      driverId,
      type: alert.type,
      severity: alert.severity,
      status: 'open',
      message: alert.message,
      evidence: alert.evidence,
      createdAt: now
    };
    insertedAlerts.push(newAlert);

    if ([ALERT_TYPES.OVERSPEED, ALERT_TYPES.SUSPECTED_FUEL_DROP, ALERT_TYPES.DOOR_OPEN_PARKED, ALERT_TYPES.GEOFENCE_VIOLATION].includes(alert.type)) {
      if (driverId) {
        insertedViolations.push({
          violationId: crypto.randomUUID(),
          driverId,
          vehicleId,
          alertId,
          tripId: activeTripId,
          type: alert.type === ALERT_TYPES.SUSPECTED_FUEL_DROP ? 'FUEL_DROP' : alert.type,
          severity: alert.severity,
          description: alert.message,
          occurredAt: now
        });
      }
    }
  }

  if (insertedAlerts.length > 0) {
    await (supabase as any).from('alerts').insert(insertedAlerts);
  }

  if (insertedViolations.length > 0) {
    await (supabase as any).from('driver_violations').insert(insertedViolations);
  }

  return insertedAlerts;
}

export {
  checkLowFuel,
  checkSuspectedFuelDrop,
  checkOverspeed,
  checkDoorOpenParked,
  checkGeofenceViolation,
  checkRefillDetected,
  runAlertRules
};
