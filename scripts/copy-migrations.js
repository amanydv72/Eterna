const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('📁 Copying migration files...');
copyDir(
  path.join(__dirname, '..', 'src', 'database', 'migrations'),
  path.join(__dirname, '..', 'dist', 'database', 'migrations')
);
console.log('✅ Migration files copied successfully');
