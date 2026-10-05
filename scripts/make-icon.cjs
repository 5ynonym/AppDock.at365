// Run once with sharp on NODE_PATH; the generated application icons are source assets.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
(async () => {
  const directory = path.resolve(__dirname, '../assets');
  const png = await sharp(path.join(directory, 'icon.svg')).png().toBuffer();
  fs.writeFileSync(path.join(directory, 'icon.png'), png);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(directory, 'icon.ico'), Buffer.concat([header, png]));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
