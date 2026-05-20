const fs = require('fs');
const path = require('path');

function replaceSyntax(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace const { xyz } = require('foo') -> import { xyz } from 'foo'
  content = content.replace(/const\s+\{\s*([^}]+)\s*\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, 'import { $1 } from \'$2\';');

  // Replace const xyz = require('foo') -> import xyz from 'foo'
  content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, 'import $1 from \'$2\';');

  // Replace let xyz = require('foo') -> import xyz from 'foo'
  content = content.replace(/let\s+([a-zA-Z0-9_]+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, 'import $1 from \'$2\';');

  // Replace module.exports = { ... } -> export { ... }
  // Only if it's exporting an object directly, we can change to export
  // BUT module.exports = function is export default function
  content = content.replace(/module\.exports\s*=\s*\{([^}]+)\};?/g, 'export {$1};');
  content = content.replace(/module\.exports\s*=\s*([a-zA-Z0-9_]+);?/g, 'export default $1;');

  fs.writeFileSync(filePath, content, 'utf8');
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      replaceSyntax(fullPath);
    }
  }
}

processDirectory(path.join(__dirname, '..', 'src'));
processDirectory(path.join(__dirname, '..', 'tests'));
console.log('Converted require/exports to import/export in .ts files.');
