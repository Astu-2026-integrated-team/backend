export const basePayload = {
  t: 4632,
  fuel_l: 40.0,
  fuel_pct: 66,
  engine: true,
  door: false,
  temp_c: 22.0,
  accel_g: -2.71,
  speed_kmh: 40.0,
  rate_lhr: 5.0,
  trip_sec: 120,
  fuel_used: 0.5,
  lat: 9.0320,
  lon: 38.7469,
  location: "Home",
  geofence_ok: true,
  low_fuel: false,
  parking: false,
  overspeed: false,
  alert: null
};

export const engineOff = { engine: false, parking: true, speed_kmh: 0 };
export const overspeed = { speed_kmh: 90.0, overspeed: true };
export const lowFuel = { fuel_pct: 10, fuel_l: 6.0, low_fuel: true };
export const doorOpenParked = { door: true, engine: false, parking: true };
export const geofenceBreach = { geofence_ok: false, location: '' };
export const refill = { fuel_l: 50.0, fuel_pct: 83 };
