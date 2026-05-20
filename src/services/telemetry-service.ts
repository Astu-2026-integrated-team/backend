import crypto from 'crypto';
import { supabase  } from '../db/supabase-client';
import { detectTripTransition  } from './trip-service';
import { runAlertRules  } from './alert-rule-engine';
import { broadcastVehicleUpdate, broadcastAlertFired  } from './websocket-service';

async function resolveVehicleFromDevice(deviceId) {
  const { data, error } = await supabase.from('devices').select('vehicleId').eq('deviceId', deviceId).single();
  if (error || !data) throw new Error('UNKNOWN_DEVICE');
  return data.vehicleId;
}

function generateTelemetryId() {
  return crypto.randomUUID();
}

async function insertTelemetryRaw(deviceId, vehicleId, rawPayload, telemetryId) {
  const receivedAt = new Date().toISOString();
  const { error } = await supabase.from('telemetry_raw').insert({
    telemetryId,
    deviceId,
    vehicleId,
    receivedAt,
    rawPayload,
    source: 'hardware'
  });
  if (error) throw error;
  return receivedAt;
}

function mapToNormalized(raw, meta) {
  return {
    telemetryId: meta.telemetryId,
    vehicleId: meta.vehicleId,
    deviceId: meta.deviceId,
    receivedAt: meta.receivedAt,
    deviceUptimeMs: raw.t,
    fuelLiters: raw.fuel_l,
    fuelPercent: raw.fuel_pct,
    engineOn: raw.engine,
    doorOpen: raw.door,
    tempCelsius: raw.temp_c,
    accelG: raw.accel_g,
    speedKmh: raw.speed_kmh,
    fuelRateLhr: raw.rate_lhr,
    tripSeconds: raw.trip_sec,
    tripFuelUsed: raw.fuel_used,
    latitude: raw.lat,
    longitude: raw.lon,
    locationName: raw.location,
    geofenceOk: raw.geofence_ok,
    lowFuelFlag: raw.low_fuel,
    parkingMode: raw.parking,
    overspeedFlag: raw.overspeed,
    deviceAlertText: raw.alert || null
  };
}

async function insertTelemetryNormalized(normalized) {
  const { error } = await supabase.from('telemetry_normalized').insert(normalized);
  if (error) throw error;
}

async function getPreviousState(vehicleId) {
  const { data } = await supabase.from('vehicle_latest_state').select('*').eq('vehicleId', vehicleId).single();
  return data || null;
}

async function upsertVehicleLatestState(vehicleId, normalized) {
  const latestState = {
    vehicleId,
    lastSeenAt: normalized.receivedAt,
    fuelLiters: normalized.fuelLiters,
    fuelPercent: normalized.fuelPercent,
    engineOn: normalized.engineOn,
    doorOpen: normalized.doorOpen,
    tempCelsius: normalized.tempCelsius,
    speedKmh: normalized.speedKmh,
    accelG: normalized.accelG,
    fuelRateLhr: normalized.fuelRateLhr,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    locationName: normalized.locationName,
    geofenceOk: normalized.geofenceOk,
    parkingMode: normalized.parkingMode,
    overspeedFlag: normalized.overspeedFlag,
    deviceStatus: 'online'
  };

  // Keep existing currentAlertLevel and activeTripId if updating
  const prevState = await getPreviousState(vehicleId);
  if (prevState) {
    (latestState as any).currentAlertLevel = prevState.currentAlertLevel;
    (latestState as any).activeTripId = prevState.activeTripId;
  }

  const { error } = await supabase.from('vehicle_latest_state').upsert(latestState);
  if (error) throw error;
  
  // Return the newly constructed latest state
  return latestState;
}

async function updateDeviceLastSeen(deviceId, receivedAt) {
  const { error } = await supabase.from('devices').update({
    lastSeenAt: receivedAt,
    status: 'online'
  }).eq('deviceId', deviceId);
  if (error) throw error;
}

async function ingestTelemetry(deviceId, rawPayload) {
  // Step 1: device auth middleware already ran
  // Step 2: resolve vehicle
  const vehicleId = await resolveVehicleFromDevice(deviceId);
  
  // Step 3: Zod validation already ran (rawPayload is valid)
  
  // Step 4: generate ID
  const telemetryId = generateTelemetryId();
  
  // Step 5: insert raw
  const receivedAt = await insertTelemetryRaw(deviceId, vehicleId, rawPayload, telemetryId);
  
  // Step 6: map to normalized
  const normalized = mapToNormalized(rawPayload, { telemetryId, vehicleId, deviceId, receivedAt });
  
  // Step 7: insert normalized
  await insertTelemetryNormalized(normalized);
  
  // Step 10: get previous state before upsert
  const previousState = await getPreviousState(vehicleId);
  
  // Step 8: upsert latest state
  const latestState = await upsertVehicleLatestState(vehicleId, normalized);
  
  // Step 9: update device last seen
  await updateDeviceLastSeen(deviceId, receivedAt);
  
  // Step 11: trip transition
  await detectTripTransition(vehicleId, normalized, previousState);
  
  // Refetch latest state to get activeTripId that might have changed
  const updatedState = await getPreviousState(vehicleId);
  const finalState = updatedState || latestState;

  // Step 12: alert rule engine
  const newAlerts = await runAlertRules(normalized, previousState, vehicleId);
  
  // Update currentAlertLevel if there are new alerts
  if (newAlerts.length > 0) {
    let highestSeverity = finalState.currentAlertLevel;
    for (const alert of newAlerts) {
      if (alert.severity === 'critical') highestSeverity = 'critical';
      else if (alert.severity === 'warning' && highestSeverity !== 'critical') highestSeverity = 'warning';
      else if (alert.severity === 'info' && highestSeverity === 'none') highestSeverity = 'info';
    }
    
    if (highestSeverity !== finalState.currentAlertLevel) {
      await supabase.from('vehicle_latest_state').update({ currentAlertLevel: highestSeverity }).eq('vehicleId', vehicleId);
      finalState.currentAlertLevel = highestSeverity;
    }
  }

  // Step 13: broadcast
  broadcastVehicleUpdate(vehicleId, finalState);
  for (const alert of newAlerts) {
    broadcastAlertFired(alert);
  }

  return { accepted: true, telemetryId, vehicleId };
}

export {
  resolveVehicleFromDevice,
  generateTelemetryId,
  insertTelemetryRaw,
  mapToNormalized,
  insertTelemetryNormalized,
  upsertVehicleLatestState,
  updateDeviceLastSeen,
  getPreviousState,
  ingestTelemetry
};
