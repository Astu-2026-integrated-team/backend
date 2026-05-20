import { supabase  } from '../db/supabase-client';
import { ERROR_CODES  } from '../config/constants';

async function listVehicles({ status, deviceStatus }) {
  let query = supabase.from('vehicles').select(`
    *,
    assignedDriver:drivers(driverId, fullName),
    assignedDevice:devices(deviceId, status)
  `);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: vehicles, error: vError } = await query;
  if (vError) throw vError;

  const { data: states, error: sError } = await supabase.from('vehicle_latest_state').select('*');
  if (sError) throw sError;

  const statesMap = {};
  for (const s of states) {
    statesMap[s.vehicleId] = s;
  }

  let filtered = vehicles.map(v => ({
    vehicleId: v.vehicleId,
    label: v.label,
    plateNumber: v.plateNumber,
    make: v.make,
    model: v.model,
    status: v.status,
    assignedDriver: v.assignedDriver,
    assignedDevice: v.assignedDevice,
    currentState: statesMap[v.vehicleId] || null
  }));

  if (deviceStatus && deviceStatus !== 'all') {
    filtered = filtered.filter(v => v.currentState?.deviceStatus === deviceStatus || v.assignedDevice?.status === deviceStatus);
  }

  return { count: filtered.length, vehicles: filtered };
}

async function registerVehicle(data) {
  const { error } = await supabase.from('vehicles').insert(data);
  if (error) {
    if (error.code === '23505') { // unique violation
      const err = new Error(`Vehicle ${data.vehicleId} already exists`);
      (err as any).code = ERROR_CODES.DUPLICATE_VEHICLE_ID;
      throw err;
    }
    throw error;
  }
  
  if (data.assignedDeviceId) {
    await supabase.from('devices').update({ vehicleId: data.vehicleId }).eq('deviceId', data.assignedDeviceId);
  }

  return { vehicleId: data.vehicleId };
}

async function getVehicle(vehicleId) {
  const { data: vehicle, error } = await supabase.from('vehicles').select(`
    *,
    assignedDriver:drivers(driverId, fullName, licenseNumber),
    assignedDevice:devices(deviceId, firmwareVersion, status, lastSeenAt)
  `).eq('vehicleId', vehicleId).single();

  if (error || !vehicle) {
    const err = new Error('Vehicle not found');
    (err as any).code = ERROR_CODES.NOT_FOUND;
    throw err;
  }

  const { data: currentState } = await supabase.from('vehicle_latest_state').select('*').eq('vehicleId', vehicleId).single();
  const { count } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('vehicleId', vehicleId).eq('status', 'open');

  return { ...vehicle, currentState: currentState || null, openAlertsCount: count || 0 };
}

async function updateVehicle(vehicleId, data) {
  const { data: vehicle, error } = await supabase.from('vehicles').update(data).eq('vehicleId', vehicleId).select().single();
  if (error || !vehicle) {
    const err = new Error('Vehicle not found');
    (err as any).code = ERROR_CODES.NOT_FOUND;
    throw err;
  }
  return vehicle;
}

async function getVehicleHistory(vehicleId, { from, to, limit = 200, offset = 0, fields = 'all' }) {
  let query = supabase.from('telemetry_normalized').select(fields === 'all' ? '*' : fields, { count: 'exact' }).eq('vehicleId', vehicleId);
  
  if (from) query = query.gte('receivedAt', from);
  if (to) query = query.lte('receivedAt', to);

  const { data: records, error, count } = await query.order('receivedAt', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  return { count: records.length, total: count, offset, records };
}

async function listVehicleTrips(vehicleId, { from, to, status, limit = 50, offset = 0 }) {
  let query = supabase.from('trips').select('*, driver:drivers(driverId, fullName)', { count: 'exact' }).eq('vehicleId', vehicleId);
  
  if (from) query = query.gte('startTime', from);
  if (to) query = query.lte('startTime', to);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data: trips, error, count } = await query.order('startTime', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  return { count: trips.length, total: count, trips };
}

async function listVehicleAlerts(vehicleId, { status = 'open', severity, limit = 50, offset = 0 }) {
  let query = supabase.from('alerts').select('*, driver:drivers(driverId, fullName)', { count: 'exact' }).eq('vehicleId', vehicleId);
  
  if (status && status !== 'all') query = query.eq('status', status);
  if (severity && severity !== 'all') query = query.eq('severity', severity);

  const { data: alerts, error, count } = await query.order('createdAt', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  return { count: alerts.length, total: count, alerts };
}

export {
  listVehicles,
  registerVehicle,
  getVehicle,
  updateVehicle,
  getVehicleHistory,
  listVehicleTrips,
  listVehicleAlerts
};
