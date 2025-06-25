#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Common patterns for API keys and secrets
const SECRET_PATTERNS = [
  /[kK][eE][yY][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[tT][oO][kK][eE][nN][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[sS][eE][cC][rR][eE][tT][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[pP][aA][sS][sS][wW][oO][rR][dD][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[aA][pP][iI][_\-]?[kK][eE][yY][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[aA][pP][iI][_\-]?[sS][eE][cC][rR][eE][tT][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[aA][cC][cC][eE][sS][sS][_\-]?[tT][oO][kK][eE][nN][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[aA][uU][tT][hH][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[cC][rR][eE][dD][eE][nN][tT][iI][aA][lL][sS]?[=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[pP][aA][sS][sS][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[tT][oO][kK][eE][nN][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[sS][eE][sS][sS][iI][oO][nN][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
  /[cC][oO][oO][kK][iI][eE][=:]["']?[a-zA-Z0-9_\-]{20,}["']?/,
];

// Files to ignore
const IGNORE_FILES = [
  /node_modules/,
  /\.git/,
  /package-lock\.json/,
  /yarn\.lock/,
  /\.env/,
  /\.env\.example/,
];

// File extensions to check
const CHECK_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.html',
  '.yaml',
  '.yml',
  '.sh',
  '.bat',
  '.cmd',
  '.ps1',
];

let hasSecrets = false;

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      SECRET_PATTERNS.forEach((pattern) => {
        const matches = line.match(pattern);
        if (matches) {
          console.error(`\x1b[31m[SECRET DETECTED]\x1b[0m ${filePath}:${index + 1}`);
          console.error(`  ${matches[0].substring(0, 10)}... (potential secret)`);
          hasSecrets = true;
        }
      });
    });
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // Skip ignored files/directories
    if (IGNORE_FILES.some(pattern => filePath.match(pattern))) {
      return;
    }
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (CHECK_EXTENSIONS.includes(ext)) {
        checkFile(filePath);
      }
    }
  });
}

// Start checking from the current directory
console.log('Scanning for potential secrets...\n');
walkDir('.');

if (hasSecrets) {
  console.error('\n\x1b[31m❌ Potential secrets found. Please remove or move them to environment variables.\x1b[0m');
  process.exit(1);
} else {
  console.log('\n\x1b[32m✅ No potential secrets found.\x1b[0m');
  process.exit(0);
}
