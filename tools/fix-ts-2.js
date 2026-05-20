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
      { regex: /parsed\.error\.errors/g, replace: '(parsed as any).error.errors' },
      { regex: /req\.query\.status/g, replace: '(req.query.status as string)' },
      { regex: /req\.query\.limit/g, replace: '(req.query.limit as string)' },
      { regex: /req\.query\.offset/g, replace: '(req.query.offset as string)' },
      { regex: /req\.admin/g, replace: '(req as any).admin' }
    ]);
  }

  // auth-service.ts -> jsonwebtoken overload issues
  replaceFile(path.join(dirSrc, 'services', 'auth-service.ts'), [
    { regex: /process\.env\.JWT_EXPIRES_IN/g, replace: '(process.env.JWT_EXPIRES_IN as any)' }
  ]);
  
  // stale-check-job.ts -> diffMinutes = (now - lastSeen) / 60000;
  replaceFile(path.join(dirSrc, 'services', 'stale-check-job.ts'), [
    { regex: /const diffMinutes = \(now - lastSeen\) \/ 60000;/g, replace: 'const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;' }
  ]);
  
  // Clean up any double `as string as string`
  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.ts')) continue;
    replaceFile(path.join(routesDir, file), [
      { regex: /as string\s+as string/g, replace: 'as string' },
      { regex: /\(req\.query\.status as string\)\s+as string/g, replace: '(req.query.status as string)' }
    ]);
  }

  console.log('Done second pass fix.');
}

run();
