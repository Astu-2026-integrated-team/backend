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
  replaceFile(path.join(dirSrc, 'app.ts'), [
    { regex: /catch \(e\) {/g, replace: 'catch { // e unused' },
    { regex: /console\.log\(`Failed to load/g, replace: 'console.error(`Failed to load' }
  ]);

  replaceFile(path.join(dirSrc, 'middleware', 'auth-middleware.ts'), [
    { regex: /catch \(err\) {/g, replace: 'catch {' }
  ]);

  replaceFile(path.join(dirSrc, 'middleware', 'device-auth-middleware.ts'), [
    { regex: /catch \(err\) {/g, replace: 'catch {' }
  ]);

  replaceFile(path.join(dirSrc, 'server.ts'), [
    { regex: /console\.log\(/g, replace: 'console.warn(' }
  ]);

  replaceFile(path.join(dirSrc, 'services', 'alert-rule-engine.ts'), [
    { regex: /const openAlerts = await getOpenAlertsForVehicle\(vehicleId\);/g, replace: 'await getOpenAlertsForVehicle(vehicleId);' }
  ]);

  replaceFile(path.join(dirSrc, 'services', 'trip-service.ts'), [
    { regex: /import thresholds from '\.\.\/config\/thresholds';\n/g, replace: '' }
  ]);

  replaceFile(path.join(dirSrc, 'websocket', 'ws-server.ts'), [
    { regex: /\(ws, req\) => {/g, replace: '(ws) => {' }
  ]);

  console.log('Fixed lint errors.');
}

run();
