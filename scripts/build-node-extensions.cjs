const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.copyFileSync(
  path.join(root, 'artifacts/node-extensions/extensions/welcome/index.js'),
  path.join(root, 'extensions/welcome/index.js'),
);
