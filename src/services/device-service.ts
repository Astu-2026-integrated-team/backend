import { supabase  } from '../db/supabase-client';
import { ERROR_CODES  } from '../config/constants';

async function listDevices() {
  const { data: devices, error } = await supabase.from('devices').select('*');
  if (error) throw error;
  return { count: devices.length, devices };
}

async function getDevice(deviceId) {
  const { data: device, error } = await supabase.from('devices').select('*').eq('deviceId', deviceId).single();
  if (error || !device) {
    const err = new Error('Device not found');
    (err as any).code = ERROR_CODES.NOT_FOUND;
    throw err;
  }
  return device;
}

async function registerDevice(data, adminId) {
  const newDevice = { ...data, registeredBy: adminId };
  const { error } = await supabase.from('devices').insert(newDevice);
  if (error) {
    if (error.code === '23505') {
      const err = new Error(`Device ${data.deviceId} already exists`);
      (err as any).code = ERROR_CODES.DUPLICATE_DEVICE_ID;
      throw err;
    }
    throw error;
  }
  
  if (data.vehicleId) {
    await supabase.from('vehicles').update({ assignedDeviceId: data.deviceId }).eq('vehicleId', data.vehicleId);
  }
  
  return { deviceId: data.deviceId };
}

async function updateDevice(deviceId, data) {
  const { error } = await supabase.from('devices').update(data).eq('deviceId', deviceId);
  if (error) {
    const err = new Error('Device not found');
    (err as any).code = ERROR_CODES.NOT_FOUND;
    throw err;
  }
  
  if (data.vehicleId !== undefined) {
    // Unassign old
    await supabase.from('vehicles').update({ assignedDeviceId: null }).eq('assignedDeviceId', deviceId);
    
    // Assign new
    if (data.vehicleId !== null) {
      await supabase.from('vehicles').update({ assignedDeviceId: deviceId }).eq('vehicleId', data.vehicleId);
    }
  }

  return { deviceId };
}

export {
  listDevices,
  getDevice,
  registerDevice,
  updateDevice
};
