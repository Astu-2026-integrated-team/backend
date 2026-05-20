import { supabase  } from '../db/supabase-client';
import { ERROR_CODES  } from '../config/constants';
import crypto from 'crypto';

async function listDrivers() {
  const { data: drivers, error } = await supabase.from('drivers').select('*');
  if (error) throw error;
  return { count: drivers.length, drivers };
}

async function getDriver(driverId) {
  const { data: driver, error } = await supabase.from('drivers').select('*').eq('driverId', driverId).single();
  if (error || !driver) {
    const err = new Error('Driver not found');
    (err as any).code = ERROR_CODES.NOT_FOUND;
    throw err;
  }
  return driver;
}

async function registerDriver(data) {
  const driverId = data.driverId || crypto.randomUUID();
  const newData = { ...data, driverId };
  
  const { error } = await supabase.from('drivers').insert(newData);
  if (error) {
    if (error.code === '23505') {
      const err = new Error(`License number ${data.licenseNumber} already exists`);
      (err as any).code = ERROR_CODES.DUPLICATE_LICENSE;
      throw err;
    }
    throw error;
  }
  return { driverId };
}

async function updateDriver(driverId, data) {
  const { error } = await supabase.from('drivers').update(data).eq('driverId', driverId);
  if (error) {
    const err = new Error('Driver not found');
    (err as any).code = ERROR_CODES.NOT_FOUND;
    throw err;
  }
  return { driverId };
}

async function getDriverViolations(driverId, { from, to, type, limit = 50 }) {
  // First ensure driver exists
  await getDriver(driverId);
  
  let query = supabase.from('driver_violations').select('*', { count: 'exact' }).eq('driverId', driverId);
  
  if (from) query = query.gte('occurredAt', from);
  if (to) query = query.lte('occurredAt', to);
  if (type && type !== 'all') query = query.eq('type', type);
  
  const { data: violations, error, count } = await query.order('occurredAt', { ascending: false }).limit(limit);
  if (error) throw error;
  
  // Attach vehicleLabel if needed - simple map over vehicles
  const vIds = [...new Set(violations.map(v => v.vehicleId))];
  let vehicles = [];
  if (vIds.length > 0) {
    const { data } = await supabase.from('vehicles').select('vehicleId, label').in('vehicleId', vIds);
    vehicles = data || [];
  }
  const vMap = Object.fromEntries(vehicles.map(v => [v.vehicleId, v.label]));
  
  const enriched = violations.map(v => ({
    ...v,
    vehicleLabel: vMap[v.vehicleId] || 'Unknown'
  }));

  return { totalViolations: count, violations: enriched };
}

export {
  listDrivers,
  getDriver,
  registerDriver,
  updateDriver,
  getDriverViolations
};
