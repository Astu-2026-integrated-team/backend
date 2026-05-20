import cron from 'node-cron';
import crypto from 'crypto';
import { supabase  } from '../db/supabase-client';
import thresholds from '../config/thresholds';
import { DEVICE_STATUS, ALERT_TYPES, ALERT_SEVERITY  } from '../config/constants';
import { broadcastDeviceStatusChange, broadcastAlertFired  } from './websocket-service';

async function processDevice(device, now) {
  if (!device.lastSeenAt) return; // Never seen, ignore or keep offline

  const lastSeen = new Date(device.lastSeenAt);
  const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;

  let newStatus = device.status;
  let newAlertType = null;

  if (diffMinutes > thresholds.OFFLINE_THRESHOLD_MINUTES) {
    if (device.status !== DEVICE_STATUS.OFFLINE) {
      newStatus = DEVICE_STATUS.OFFLINE;
      newAlertType = ALERT_TYPES.DEVICE_OFFLINE;
    }
  } else if (diffMinutes > thresholds.STALE_THRESHOLD_MINUTES) {
    if (device.status !== DEVICE_STATUS.STALE && device.status !== DEVICE_STATUS.OFFLINE) {
      newStatus = DEVICE_STATUS.STALE;
      newAlertType = ALERT_TYPES.DEVICE_STALE;
    }
  }

  if (newStatus !== device.status) {
    // Update status
    await supabase.from('devices').update({ status: newStatus }).eq('deviceId', device.deviceId);
    
    // Broadcast status change
    broadcastDeviceStatusChange(device.vehicleId, device.deviceId, device.status, newStatus);

    // Create alert if it has a vehicleId
    if (newAlertType && device.vehicleId) {
      // Check if alert already exists
      const { data: openAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('vehicleId', device.vehicleId)
        .eq('type', newAlertType)
        .eq('status', 'open');

      if (!openAlerts || openAlerts.length === 0) {
        const alertId = crypto.randomUUID();
        const severity = newAlertType === ALERT_TYPES.DEVICE_OFFLINE ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.INFO;
        
        const newAlert = {
          alertId,
          vehicleId: device.vehicleId,
          driverId: null,
          type: newAlertType,
          severity,
          status: 'open',
          message: `Device ${device.deviceId} is now ${newStatus}. Last seen ${Math.floor(diffMinutes)} minutes ago.`,
          evidence: {
            deviceId: device.deviceId,
            lastSeenAt: device.lastSeenAt,
            diffMinutes
          },
          createdAt: now.toISOString()
        };

        await supabase.from('alerts').insert(newAlert);
        broadcastAlertFired(newAlert);
      }
    }
  }
}

async function checkStaleDevices() {
  const now = new Date();
  // We only fetch devices that are online or stale to potentially downgrade them
  // Or fetch all to be safe? Spec says "Query all devices"
  const { data: devices, error } = await supabase.from('devices').select('*');
  
  if (error) {
    console.error('Error fetching devices for stale check:', error);
    return;
  }

  for (const device of devices) {
    try {
      await processDevice(device, now);
    } catch (err) {
      console.error(`Error processing device ${device.deviceId}:`, err);
    }
  }
}

function startStaleCheckJob() {
  // Run every 60 seconds
  cron.schedule('*/60 * * * * *', () => {
    checkStaleDevices().catch(err => console.error('Stale check job error:', err));
  });
}

export {
  startStaleCheckJob,
  checkStaleDevices // exported for testing
};
