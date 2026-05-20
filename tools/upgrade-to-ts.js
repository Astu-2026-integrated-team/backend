const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace language mentions
  content = content.replace(/Node\.js \+ Express/gi, 'TypeScript + Express');
  content = content.replace(/Node\.js \+ Express \+ Supabase/gi, 'TypeScript + Express + Supabase');
  content = content.replace(/Node\.js/gi, 'TypeScript');
  content = content.replace(/JavaScript/gi, 'TypeScript');
  
  // Replace .js extensions for project files
  content = content.replace(/([a-zA-Z0-9_-]+)\.js/g, (match, p1) => {
    // Only replace if it looks like one of our backend files
    if (!['package', 'package-lock', 'jest.config'].includes(p1)) {
        return p1 + '.ts';
    }
    return match;
  });

  // Replace jest.config.js specifically if we are switching to ts
  // content = content.replace(/jest\.config\.js/g, 'jest.config.ts');
  
  // Also fix import/require examples to standard TS maybe? (Optional for now)
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + filePath);
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'src') { // Don't process src files textually this way
        processDirectory(fullPath);
      }
    } else {
      if (fullPath.endsWith('.md') || fullPath.endsWith('.skill') || fullPath.endsWith('.SKILL.md')) {
        replaceInFile(fullPath);
      }
    }
  }
}

processDirectory(path.join(__dirname, '..', 'docs'));
processDirectory(path.join(__dirname, '..', '.antigravity'));
console.log('Done upgrading docs and skills to TypeScript.');
