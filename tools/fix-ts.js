const fs = require('fs');
const path = require('path');

function replaceFile(file, replaces) {
  let content = fs.readFileSync(file, 'utf8');
  for (const { regex, replace } of replaces) {
    content = content.replace(regex, replace);
  }
  fs.writeFileSync(file, content, 'utf8');
}

const dirSrc = path.join(__dirname, '..', 'src');

function run() {
  // Routes
  const routesDir = path.join(dirSrc, 'routes');
  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.ts')) continue;
    replaceFile(path.join(routesDir, file), [
      { regex: /err\.errors/g, replace: '(err as any).errors' },
      { regex: /req\.query\.status(?!\s*as)/g, replace: '(req.query.status as string)' },
      { regex: /err\.code/g, replace: '(err as any).code' }
    ]);
  }

  // Services
  const servicesDir = path.join(dirSrc, 'services');
  for (const file of fs.readdirSync(servicesDir)) {
    if (!file.endsWith('.ts')) continue;
    replaceFile(path.join(servicesDir, file), [
      { regex: /err\.code/g, replace: '(err as any).code' }
    ]);
  }

  // auth-service.ts
  replaceFile(path.join(servicesDir, 'auth-service.ts'), [
    { regex: /process\.env\.JWT_SECRET/g, replace: '(process.env.JWT_SECRET as string)' }
  ]);

  // telemetry-service.ts
  replaceFile(path.join(servicesDir, 'telemetry-service.ts'), [
    { regex: /latestState\.currentAlertLevel/g, replace: '(latestState as any).currentAlertLevel' },
    { regex: /latestState\.activeTripId/g, replace: '(latestState as any).activeTripId' }
  ]);

  // trip-service.ts
  replaceFile(path.join(servicesDir, 'trip-service.ts'), [
    { regex: /\(endDate - startDate\)/g, replace: '(endDate.getTime() - startDate.getTime())' }
  ]);

  // stale-check-job.ts
  replaceFile(path.join(servicesDir, 'stale-check-job.ts'), [
    { regex: /now - new Date\(device\.lastSeenAt\)/g, replace: 'now.getTime() - new Date(device.lastSeenAt).getTime()' }
  ]);

  // middleware
  const mwDir = path.join(dirSrc, 'middleware');
  replaceFile(path.join(mwDir, 'auth-middleware.ts'), [
    { regex: /payload\.admin/g, replace: '(payload as any).admin' }
  ]);

  // index.ts
  replaceFile(path.join(dirSrc, 'routes', 'index.ts'), [
    { regex: /import { authRouter }/g, replace: 'import authRouter' },
    { regex: /import { telemetryRouter }/g, replace: 'import telemetryRouter' },
    { regex: /import { vehiclesRouter }/g, replace: 'import vehiclesRouter' },
    { regex: /import { devicesRouter }/g, replace: 'import devicesRouter' },
    { regex: /import { driversRouter }/g, replace: 'import driversRouter' },
    { regex: /import { alertsRouter }/g, replace: 'import alertsRouter' }
  ]);

  // server.ts
  replaceFile(path.join(dirSrc, 'server.ts'), [
    { regex: /app\.listen\(process\.env\.APP_PORT,/g, replace: 'app.listen(Number(process.env.APP_PORT),' }
  ]);
}

run();
console.log('Fixed TS errors.');
