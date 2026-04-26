const fs = require('fs');
const path = require('path');
function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = fs.statSync(dirFile).isDirectory() ? walkSync(dirFile, filelist) : filelist.concat(dirFile);
    } catch (err) { }
  });
  return filelist;
}
const allFiles = walkSync('.').filter(f => !f.includes('node_modules') && !f.includes('.git') && !f.includes('.next'));
const fileMap = new Map();
allFiles.forEach(f => fileMap.set(f.replace(/\\/g, '/').toLowerCase(), f));
let hasError = false;
allFiles.filter(f => f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx')).forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /from\s+['"](@\/[^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    let resolvedStr = importPath.replace('@/', './').replace(/\\/g, '/');
    
    // Check if the file exists exactly
    let found = false;
    const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
    for (const ext of extensions) {
      if (allFiles.map(f => f.replace(/\\/g, '/')).includes(resolvedStr + ext)) {
        found = true; break;
      }
    }
    
    // If not found exactly, but found case-insensitively -> CASE ERROR!
    if (!found) {
      for (const ext of extensions) {
        if (fileMap.has((resolvedStr + ext).toLowerCase())) {
          console.log('CASE ERROR in ' + file + ': import "' + importPath + '" resolves to ' + fileMap.get((resolvedStr + ext).toLowerCase()) + ' but requested ' + resolvedStr + ext);
          hasError = true;
          break;
        }
      }
    }
  }
});
if (!hasError) console.log('No case sensitivity errors found.');
