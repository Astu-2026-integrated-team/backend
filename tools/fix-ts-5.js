const fs = require('fs');
const path = require('path');

function fixVehicles() {
  const filePath = path.join(__dirname, '..', 'src', 'routes', 'vehicles.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix the broken destructuring
  content = content.replace(/const { from: from as string, to: to as string, limit, offset, fields: fields as string } = req\.query;/g, 'const { from, to, limit, offset, fields } = req.query;');
  content = content.replace(/from, to, \r?\n\s+limit/g, 'from: from as string, to: to as string, \n      limit');
  
  content = content.replace(/const { from: from as string, to: to as string, status: status as string, limit, offset } = req\.query;/g, 'const { from, to, status, limit, offset } = req.query;');
  content = content.replace(/from, to, status,\r?\n\s+limit/g, 'from: from as string, to: to as string, status: status as string,\n      limit');

  content = content.replace(/const { status: status as string, severity: severity as string, limit, offset } = req\.query;/g, 'const { status, severity, limit, offset } = req.query;');
  content = content.replace(/status, severity,\r?\n\s+limit/g, 'status: status as string, severity: severity as string,\n      limit');
  
  content = content.replace(/const { status: status as string, deviceStatus: deviceStatus as string } = req\.query;/g, 'const { status, deviceStatus } = req.query;');
  content = content.replace(/status, deviceStatus/g, 'status: status as string, deviceStatus: deviceStatus as string');
  
  fs.writeFileSync(filePath, content, 'utf8');
}

function fixDrivers() {
  const filePath = path.join(__dirname, '..', 'src', 'routes', 'drivers.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix drivers.ts broken destructuring
  content = content.replace(/const { status: status as string, limit, offset } = req\.query;/g, 'const { status, limit, offset } = req.query;');
  content = content.replace(/status,\r?\n\s+limit/g, 'status: status as string,\n      limit');
  
  fs.writeFileSync(filePath, content, 'utf8');
}

fixVehicles();
fixDrivers();
console.log('Done 5');
