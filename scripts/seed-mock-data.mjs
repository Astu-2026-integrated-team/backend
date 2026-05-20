/**
 * Seed mock data into Supabase using direct PostgreSQL connection (bypasses RLS).
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Use pgbouncer port 6543 with prepare:false for statement-mode pooling
const DB_URL = 'postgresql://postgres.xernqrsxldbfmqtexmbs:GemechuAlemu4922@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  // pgbouncer in transaction mode doesn't support prepared statements
  statement_timeout: 10000,
});

// Helper to run queries without prepared statements (required for pgbouncer)
async function query(sql, params) {
  return pool.query({ text: sql, values: params, rowMode: 'array' });
}

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function minutesAgo(m) { return new Date(Date.now() - m * 60000).toISOString(); }

async function run(sql, params, label) {
  try {
    await pool.query({ text: sql, values: params });
    console.log(`  ✓ ${label}`);
    return true;
  } catch (err) {
    if (err.code === '23505') {
      console.log(`  ⓘ ${label}: already exists (skipped)`);
      return true;
    }
    console.error(`  ⚠ ${label}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   FuelGuard Mock Data Seeder (Direct PG)   ║');
  console.log('╚════════════════════════════════════════════╝');

  // ─── 1. Admin ───
  console.log('\n=== 1. Admin User ===');
  const pwHash = await bcrypt.hash('admin123', 10);
  await run(
    `INSERT INTO admin_users ("adminId", username, "passwordHash") VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET "passwordHash" = $3`,
    ['admin-001', 'admin', pwHash],
    'Admin (admin / admin123)'
  );

  // ─── 2. Drivers ───
  console.log('\n=== 2. Drivers ===');
  const drivers = [
    ['driver-001', 'Abebe Bekele',     'ETH-DL-2024-001', '+251911223344', 'active'],
    ['driver-002', 'Fatima Ahmed',     'ETH-DL-2024-002', '+251922334455', 'active'],
    ['driver-003', 'Dawit Tadesse',    'ETH-DL-2024-003', '+251933445566', 'active'],
    ['driver-004', 'Hana Gebremariam', 'ETH-DL-2024-004', '+251944556677', 'suspended'],
  ];
  for (const [id, name, lic, phone, status] of drivers) {
    await run(
      `INSERT INTO drivers ("driverId", "fullName", "licenseNumber", "phoneNumber", status, "createdAt") VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT ("driverId") DO NOTHING`,
      [id, name, lic, phone, status],
      `Driver: ${name}`
    );
  }

  // ─── 3. Vehicles ───
  console.log('\n=== 3. Vehicles ===');
  const vehicles = [
    ['vehicle-001', 'AA-3-12345', 'Fuel Tanker Alpha',  200, 'Isuzu',    'FTR',     2022, 'White',  'driver-001', 'active'],
    ['vehicle-002', 'AA-3-67890', 'Delivery Truck Beta', 120, 'Toyota',   'Dyna',    2023, 'Blue',   'driver-002', 'active'],
    ['vehicle-003', 'OR-1-54321', 'City Bus Gamma',      300, 'Zhongtong','LCK6125', 2021, 'Green',  'driver-003', 'active'],
    ['vehicle-004', 'OR-1-98765', 'Utility Van Delta',   80,  'Hyundai',  'H100',    2020, 'Silver', null,          'maintenance'],
  ];
  for (const [id, plate, label, tank, make, model, year, color, driver, status] of vehicles) {
    await run(
      `INSERT INTO vehicles ("vehicleId", "plateNumber", label, "tankCapacityLiters", make, model, year, color, "assignedDriverId", status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) ON CONFLICT ("vehicleId") DO NOTHING`,
      [id, plate, label, tank, make, model, year, color, driver, status],
      `Vehicle: ${label}`
    );
  }

  // ─── 4. Devices ───
  console.log('\n=== 4. Devices ===');
  const devices = [
    ['device-001', 'vehicle-001', 'v2.1.0', minutesAgo(2),  'online',  'admin-001'],
    ['device-002', 'vehicle-002', 'v2.1.0', minutesAgo(1),  'online',  'admin-001'],
    ['device-003', 'vehicle-003', 'v2.0.5', minutesAgo(8),  'stale',   'admin-001'],
    ['device-004', 'vehicle-004', 'v1.9.0', minutesAgo(45), 'offline', 'admin-001'],
  ];
  for (const [id, vid, fw, lastSeen, status, regBy] of devices) {
    await run(
      `INSERT INTO devices ("deviceId", "vehicleId", "firmwareVersion", "lastSeenAt", status, "registeredAt", "registeredBy")
       VALUES ($1,$2,$3,$4,$5,NOW(),$6) ON CONFLICT ("deviceId") DO NOTHING`,
      [id, vid, fw, lastSeen, status, regBy],
      `Device: ${id} → ${vid}`
    );
  }

  // Link devices to vehicles
  for (const [devId, vehId] of devices.map(d => [d[0], d[1]])) {
    await pool.query({ text: `UPDATE vehicles SET "assignedDeviceId" = $1 WHERE "vehicleId" = $2`, values: [devId, vehId] });
  }
  console.log('  ✓ Linked devices ↔ vehicles');

  // ─── 5. Telemetry ───
  console.log('\n=== 5. Telemetry ===');
  const telemetryReadings = [
    // Vehicle 1 — normal driving
    { vid: 'vehicle-001', did: 'device-001', min: 30, fuel_l: 160, fuel_pct: 80, spd: 45, lat: 9.0100, lon: 38.7400, eng: true, park: false },
    { vid: 'vehicle-001', did: 'device-001', min: 20, fuel_l: 155, fuel_pct: 77, spd: 60, lat: 9.0150, lon: 38.7450, eng: true, park: false },
    { vid: 'vehicle-001', did: 'device-001', min: 10, fuel_l: 150, fuel_pct: 75, spd: 50, lat: 9.0180, lon: 38.7500, eng: true, park: false },
    { vid: 'vehicle-001', did: 'device-001', min: 2,  fuel_l: 148, fuel_pct: 74, spd: 35, lat: 9.0192, lon: 38.7525, eng: true, park: false },
    // Vehicle 2 — low fuel
    { vid: 'vehicle-002', did: 'device-002', min: 25, fuel_l: 30,  fuel_pct: 25, spd: 70, lat: 8.9800, lon: 38.7300, eng: true, park: false },
    { vid: 'vehicle-002', did: 'device-002', min: 15, fuel_l: 22,  fuel_pct: 18, spd: 55, lat: 8.9850, lon: 38.7350, eng: true, park: false },
    { vid: 'vehicle-002', did: 'device-002', min: 5,  fuel_l: 15,  fuel_pct: 12, spd: 40, lat: 8.9900, lon: 38.7400, eng: true, park: false, lowFuel: true },
    { vid: 'vehicle-002', did: 'device-002', min: 1,  fuel_l: 13,  fuel_pct: 10, spd: 0,  lat: 8.9920, lon: 38.7420, eng: false, park: true, lowFuel: true },
    // Vehicle 3 — stale
    { vid: 'vehicle-003', did: 'device-003', min: 60, fuel_l: 250, fuel_pct: 83, spd: 30, lat: 9.0300, lon: 38.7600, eng: true, park: false },
    { vid: 'vehicle-003', did: 'device-003', min: 45, fuel_l: 245, fuel_pct: 81, spd: 25, lat: 9.0320, lon: 38.7620, eng: true, park: false },
    { vid: 'vehicle-003', did: 'device-003', min: 30, fuel_l: 240, fuel_pct: 80, spd: 0,  lat: 9.0340, lon: 38.7640, eng: false, park: true },
    // Vehicle 4 — offline + overspeed
    { vid: 'vehicle-004', did: 'device-004', min: 120, fuel_l: 60, fuel_pct: 75, spd: 95, lat: 9.0500, lon: 38.7800, eng: true, park: false, overspeed: true },
    { vid: 'vehicle-004', did: 'device-004', min: 100, fuel_l: 55, fuel_pct: 68, spd: 40, lat: 9.0520, lon: 38.7820, eng: false, park: true },
  ];

  for (const t of telemetryReadings) {
    const id = uuid();
    const recAt = minutesAgo(t.min);
    const payload = { fuel_l: t.fuel_l, fuel_pct: t.fuel_pct, speed_kmh: t.spd, engine: t.eng, parking: t.park };

    await run(
      `INSERT INTO telemetry_raw ("telemetryId", "deviceId", "vehicleId", "receivedAt", "rawPayload", source)
       VALUES ($1,$2,$3,$4,$5,'hardware') ON CONFLICT DO NOTHING`,
      [id, t.did, t.vid, recAt, JSON.stringify(payload)],
      `Raw: ${t.vid} @-${t.min}min`
    );

    await run(
      `INSERT INTO telemetry_normalized (
        "telemetryId","vehicleId","deviceId","receivedAt","deviceUptimeMs",
        "fuelLiters","fuelPercent","engineOn","doorOpen","tempCelsius","accelG",
        "speedKmh","fuelRateLhr","tripSeconds","tripFuelUsed",
        latitude,longitude,"locationName","geofenceOk","lowFuelFlag","parkingMode","overspeedFlag","deviceAlertText"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       ON CONFLICT DO NOTHING`,
      [id, t.vid, t.did, recAt, 3600000,
       t.fuel_l, t.fuel_pct, t.eng, false, 28.5, 0.15,
       t.spd, 8.2, 3600, 8.2,
       t.lat, t.lon, 'Addis Ababa', true, t.lowFuel || false, t.park, t.overspeed || false, null],
      `Norm: ${t.vid} @-${t.min}min`
    );
  }

  // ─── 6. Vehicle Latest State ───
  console.log('\n=== 6. Vehicle Latest State ===');
  const states = [
    ['vehicle-001', minutesAgo(2),  148, 74, true,  false, 28.5, 35, 0.15, 8.2, 9.0192, 38.7525, 'Addis Ababa, Bole',     true,  false, false, 'online',  'none',     null],
    ['vehicle-002', minutesAgo(1),  13,  10, false, false, 30.1, 0,  0.0,  0,   8.9920, 38.7420, 'Addis Ababa, Megenagna', true,  true,  false, 'online',  'warning',  null],
    ['vehicle-003', minutesAgo(8),  240, 80, false, false, 26.3, 0,  0.0,  0,   9.0340, 38.7640, 'Addis Ababa, Piazza',    true,  true,  false, 'stale',   'info',     null],
    ['vehicle-004', minutesAgo(45), 55,  68, false, false, 25.0, 0,  0.0,  0,   9.0520, 38.7820, 'Addis Ababa, CMC',       true,  true,  false, 'offline', 'critical', null],
  ];
  for (const s of states) {
    await run(
      `INSERT INTO vehicle_latest_state (
        "vehicleId","lastSeenAt","fuelLiters","fuelPercent","engineOn","doorOpen",
        "tempCelsius","speedKmh","accelG","fuelRateLhr",latitude,longitude,
        "locationName","geofenceOk","parkingMode","overspeedFlag","deviceStatus","currentAlertLevel","activeTripId"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT ("vehicleId") DO UPDATE SET
        "lastSeenAt"=$2,"fuelLiters"=$3,"fuelPercent"=$4,"engineOn"=$5,"doorOpen"=$6,
        "tempCelsius"=$7,"speedKmh"=$8,"accelG"=$9,"fuelRateLhr"=$10,latitude=$11,longitude=$12,
        "locationName"=$13,"geofenceOk"=$14,"parkingMode"=$15,"overspeedFlag"=$16,"deviceStatus"=$17,"currentAlertLevel"=$18,"activeTripId"=$19`,
      s,
      `State: ${s[0]} (${s[16]})`
    );
  }

  // ─── 7. Trips ───
  console.log('\n=== 7. Trips ===');
  const trips = [
    ['trip-001','vehicle-001','driver-001', minutesAgo(90), minutesAgo(30), 170, 160, 10, 25.4, 42.3, 65, 9.005, 38.730, 9.010, 38.740, 'completed'],
    ['trip-002','vehicle-001','driver-001', minutesAgo(25), null,           155, null,null, 8.1, null, 60, 9.015, 38.745, null,  null,   'active'],
    ['trip-003','vehicle-002','driver-002', minutesAgo(60), minutesAgo(5),  40,  15,  25,  35.2, 52.8, 75, 8.975, 38.725, 8.992, 38.742, 'completed'],
    ['trip-004','vehicle-004',null,         minutesAgo(180),minutesAgo(120),70,  60,  10,  18.5, 37.0, 95, 9.045, 38.775, 9.052, 38.782, 'completed'],
  ];
  for (const t of trips) {
    await run(
      `INSERT INTO trips (
        "tripId","vehicleId","driverId","startTime","endTime",
        "startFuelLiters","endFuelLiters","fuelUsedLiters","distanceKm","avgSpeedKmh","maxSpeedKmh",
        "startLat","startLon","endLat","endLon",status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT ("tripId") DO NOTHING`,
      t,
      `Trip: ${t[0]} (${t[15]})`
    );
  }
  // Link active trip
  await pool.query({ text: `UPDATE vehicle_latest_state SET "activeTripId" = 'trip-002' WHERE "vehicleId" = 'vehicle-001'` });
  console.log('  ✓ Set vehicle-001 activeTripId = trip-002');

  // ─── 8. Alerts ───
  console.log('\n=== 8. Alerts ===');
  const alerts = [
    ['alert-001','vehicle-002','driver-002','LOW_FUEL',       'warning', 'open',        'Fuel level at 10% (13 liters). Immediate refuel required.',                    {fuelLiters:13,fuelPercent:10},          minutesAgo(5),  null],
    ['alert-002','vehicle-004',null,        'OVERSPEED',      'warning', 'resolved',    'Overspeed detected: 95 km/h.',                                                {speedKmh:95,threshold:80},              minutesAgo(120),minutesAgo(90)],
    ['alert-003','vehicle-004',null,        'DEVICE_OFFLINE', 'critical','open',        'Device device-004 is now offline. Last seen 45 minutes ago.',                  {deviceId:'device-004',diffMinutes:45},  minutesAgo(30), null],
    ['alert-004','vehicle-003','driver-003','DEVICE_STALE',   'info',    'open',        'Device device-003 is now stale. Last seen 8 minutes ago.',                     {deviceId:'device-003',diffMinutes:8},   minutesAgo(3),  null],
    ['alert-005','vehicle-001','driver-001','REFILL_DETECTED','info',    'acknowledged','Fuel refill detected: 20.00 liters added.',                                   {fuelBefore:140,fuelAfter:160,increase:20}, minutesAgo(35), minutesAgo(30)],
  ];
  for (const a of alerts) {
    await run(
      `INSERT INTO alerts ("alertId","vehicleId","driverId",type,severity,status,message,evidence,"createdAt","resolvedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("alertId") DO NOTHING`,
      [a[0],a[1],a[2],a[3],a[4],a[5],a[6],JSON.stringify(a[7]),a[8],a[9]],
      `Alert: ${a[3]} (${a[4]}) on ${a[1]}`
    );
  }

  // ─── 9. Driver Violations ───
  console.log('\n=== 9. Driver Violations ===');
  await run(
    `INSERT INTO driver_violations ("violationId","driverId","vehicleId","alertId","tripId",type,severity,description,"occurredAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT ("violationId") DO NOTHING`,
    ['violation-001','driver-002','vehicle-004','alert-002','trip-004','OVERSPEED','warning','Overspeed detected: 95 km/h (limit: 80 km/h)',minutesAgo(120)],
    'Violation: OVERSPEED by driver-002'
  );

  // ─── Done ───
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   ✓ Seeding Complete!                      ║');
  console.log('║                                            ║');
  console.log('║   Admin:    admin / admin123                ║');
  console.log('║   Vehicles: 4    Drivers: 4                ║');
  console.log('║   Devices:  4    Alerts: 5                 ║');
  console.log('║   Trips:    4    Telemetry: 13 readings    ║');
  console.log('╚════════════════════════════════════════════╝');

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
