const fs = require('fs');
const path = require('path');

function replaceFile(file, replaces) {
  let content = fs.readFileSync(file, 'utf8');
  for (const { regex, replace } of replaces) {
    content = content.replace(regex, replace);
  }
  fs.writeFileSync(file, content, 'utf8');
}

const dirSrc = path.join(__dirname, '..', 'tests', 'unit', 'services');

function run() {
  const files = ['trip-service.test.ts', 'telemetry-service.test.ts'];
  for (const file of files) {
    replaceFile(path.join(dirSrc, file), [
      { regex: /supabase\.update/g, replace: '(supabase as any).update' },
      { regex: /supabase\.insert/g, replace: '(supabase as any).insert' },
      { regex: /runAlertRules\.mockResolvedValueOnce/g, replace: '(runAlertRules as jest.Mock).mockResolvedValueOnce' }
    ]);
  }
  
  // also fix fixtures import
  replaceFile(path.join(dirSrc, 'telemetry-service.test.ts'), [
    { regex: /import basePayload from '\.\.\/\.\.\/fixtures\/telemetryPayload';\.basePayload;/g, replace: 'import { basePayload } from \'../../fixtures/telemetryPayload\';' },
    { regex: /const basePayload = require\('\.\.\/\.\.\/fixtures\/telemetryPayload'\)\.basePayload;/g, replace: 'import { basePayload } from \'../../fixtures/telemetryPayload\';' }
  ]);

  console.log('Fixed test errors.');
}

run();
