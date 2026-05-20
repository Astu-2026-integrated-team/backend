import crypto from 'crypto';
import { supabase  } from '../db/supabase-client';

async function openTrip(vehicleId, telemetry, driverId) {
  const tripId = crypto.randomUUID();
  const startTime = telemetry.receivedAt;
  
  const { error: insertError } = await supabase.from('trips').insert({
    tripId,
    vehicleId,
    driverId,
    startTime,
    startFuelLiters: telemetry.fuelLiters,
    startLat: telemetry.latitude,
    startLon: telemetry.longitude,
    status: 'active'
  });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase.from('vehicle_latest_state')
    .update({ activeTripId: tripId })
    .eq('vehicleId', vehicleId);
  if (updateError) throw updateError;
}

// Haversine formula
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function updateTrip(vehicleId, tripId, telemetry) {
  // We need current trip to get distanceKm and maxSpeedKmh
  const { data: trip, error: fetchError } = await supabase
    .from('trips')
    .select('distanceKm, maxSpeedKmh')
    .eq('tripId', tripId)
    .single();
    
  if (fetchError) throw fetchError;
  
  const { data: previousState } = await supabase
    .from('vehicle_latest_state')
    .select('latitude, longitude')
    .eq('vehicleId', vehicleId)
    .single();

  let incDist = 0;
  if (previousState && previousState.latitude && previousState.longitude) {
    incDist = calculateDistanceKm(previousState.latitude, previousState.longitude, telemetry.latitude, telemetry.longitude);
  }

  const newDistance = (trip.distanceKm || 0) + incDist;
  const newMaxSpeed = Math.max(trip.maxSpeedKmh || 0, telemetry.speedKmh);

  const { error: updateError } = await supabase.from('trips')
    .update({
      distanceKm: newDistance,
      maxSpeedKmh: newMaxSpeed
    })
    .eq('tripId', tripId);
  if (updateError) throw updateError;
}

async function closeTrip(vehicleId, tripId, telemetry) {
  const { data: trip, error: fetchError } = await supabase
    .from('trips')
    .select('startFuelLiters, distanceKm, startTime')
    .eq('tripId', tripId)
    .single();
  if (fetchError) throw fetchError;

  const fuelUsed = Math.max(0, trip.startFuelLiters - telemetry.fuelLiters);
  const startDate = new Date(trip.startTime);
  const endDate = new Date(telemetry.receivedAt);
  const hours = (endDate.getTime() - startDate.getTime()) / 3600000;
  
  const avgSpeed = (hours > 0 && trip.distanceKm) ? trip.distanceKm / hours : 0;

  const { error: updateError } = await supabase.from('trips')
    .update({
      endTime: telemetry.receivedAt,
      endFuelLiters: telemetry.fuelLiters,
      fuelUsedLiters: fuelUsed,
      avgSpeedKmh: avgSpeed,
      endLat: telemetry.latitude,
      endLon: telemetry.longitude,
      status: 'completed'
    })
    .eq('tripId', tripId);
  if (updateError) throw updateError;

  const { error: clearError } = await supabase.from('vehicle_latest_state')
    .update({ activeTripId: null })
    .eq('vehicleId', vehicleId);
  if (clearError) throw clearError;
}

async function detectTripTransition(vehicleId, incoming, previousState) {
  if (!previousState) return; // No previous state, can't detect transition

  const wasEngineOn = previousState.engineOn;
  const isEngineOn = incoming.engineOn;
  const activeTripId = previousState.activeTripId;

  if (!wasEngineOn && isEngineOn) {
    // Engine OFF -> ON: start trip
    const { data: vehicle } = await supabase.from('vehicles').select('assignedDriverId').eq('vehicleId', vehicleId).single();
    await openTrip(vehicleId, incoming, vehicle ? vehicle.assignedDriverId : null);
  } else if (wasEngineOn && isEngineOn && activeTripId) {
    // Engine ON -> ON: update trip
    await updateTrip(vehicleId, activeTripId, incoming);
  } else if (wasEngineOn && !isEngineOn && activeTripId) {
    // Engine ON -> OFF: close trip
    await closeTrip(vehicleId, activeTripId, incoming);
  }
}

export {
  openTrip,
  updateTrip,
  closeTrip,
  detectTripTransition
};
