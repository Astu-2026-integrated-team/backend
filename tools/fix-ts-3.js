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
    { regex: /payload\.admin/g, replace: '(payload as any).admin' }
  ]);

  const routesDir = path.join(dirSrc, 'routes');
  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.ts')) continue;
    replaceFile(path.join(routesDir, file), [
      { regex: /limit \? parseInt\(limit, 10\) : undefined/g, replace: 'limit ? parseInt(limit as string, 10) : undefined' },
      { regex: /offset \? parseInt\(offset, 10\) : undefined/g, replace: 'offset ? parseInt(offset as string, 10) : undefined' }
    ]);
  }

  replaceFile(path.join(dirSrc, 'server.ts'), [
    { regex: /const port = process\.env\.APP_PORT \|\| 8000;/g, replace: 'const port = Number(process.env.APP_PORT || 8000);' }
  ]);

  console.log('Done third pass fix.');
}

run();
