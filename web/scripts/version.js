const fs = require('fs');
const path = require('path');
const rootDir = path.join(__dirname, '..', '..');
const packagePath = path.join(rootDir, 'web', 'package.json');
const manifestPath = path.join(rootDir, 'web', 'public', 'manifest.json');
const packageJson = require(packagePath);
const manifestJson = require(manifestPath);
manifestJson.version = packageJson.version;
fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2));
const windowsVersionPath = path.join(rootDir, 'windows', 'Musiche.csproj');
let windowsSlnText = fs.readFileSync(windowsVersionPath, 'utf-8');
windowsSlnText = windowsSlnText.replace(
  /\<Version\>[\d\.]+\<\/Version\>/,
  `<Version>${packageJson.version}</Version>`
);
fs.writeFileSync(windowsVersionPath, windowsSlnText);
const mobileVersionPath = path.join(rootDir, 'mobile', 'pubspec.yaml');
let mobileSpecText = fs.readFileSync(mobileVersionPath, 'utf-8');
mobileSpecText = mobileSpecText.replace(
  /version: [d.]+/,
  `version: ${packageJson.version}`
);
fs.writeFileSync(mobileVersionPath, mobileSpecText);
