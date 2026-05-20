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
  replaceFile(path.join(dirSrc, 'middleware', 'auth-middleware.ts'), [
    { regex: /\(req as any\)\.admin = decoded\.admin \|\| decoded;/g, replace: '(req as any).admin = (decoded as any).admin || decoded;' }
  ]);

  replaceFile(path.join(dirSrc, 'routes', 'vehicles.ts'), [
    { regex: /fields \n/g, replace: 'fields: fields as string \n' },
    { regex: /fields \r?\n/g, replace: 'fields: fields as string \n' },
    { regex: /fields \n/g, replace: 'fields: fields as string \n' },
    { regex: /fields \r?\n/g, replace: 'fields: fields as string \n' }
  ]);
  
  // Actually regex on vehicles.ts:
  // "fields" on line 96 is just "fields " -> let's just do a string replace
  let vehicles = fs.readFileSync(path.join(dirSrc, 'routes', 'vehicles.ts'), 'utf8');
  vehicles = vehicles.replace('from, to, ', 'from: from as string, to: to as string, ');
  vehicles = vehicles.replace('fields ', 'fields: fields as string ');
  vehicles = vehicles.replace('from, to, status,', 'from: from as string, to: to as string, status: status as string,');
  vehicles = vehicles.replace('status, severity,', 'status: status as string, severity: severity as string,');
  vehicles = vehicles.replace('status, deviceStatus', 'status: status as string, deviceStatus: deviceStatus as string');
  fs.writeFileSync(path.join(dirSrc, 'routes', 'vehicles.ts'), vehicles, 'utf8');

  // drivers.ts
  let drivers = fs.readFileSync(path.join(dirSrc, 'routes', 'drivers.ts'), 'utf8');
  drivers = drivers.replace('status ', 'status: status as string ');
  drivers = drivers.replace('status,', 'status: status as string,');
  fs.writeFileSync(path.join(dirSrc, 'routes', 'drivers.ts'), drivers, 'utf8');

  console.log('Done fourth pass fix.');
}

run();
