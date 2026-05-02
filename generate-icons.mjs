import sharp from 'sharp';
import { mkdirSync } from 'fs';

mkdirSync('public/icons', { recursive: true });

const src = 'public/images/logo.png';
const sizes = [192, 512];

for (const size of sizes) {
  // Fit logo inside size×size with dark background (#0f172a) to keep it square
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(`public/icons/icon-${size}x${size}.png`);
  console.log(`✓ icon-${size}x${size}.png`);
}

// maskable: logo centred with more padding (safe zone = 80% of canvas)
const maskableSize = 512;
const innerSize = Math.floor(maskableSize * 0.6);
const pad = (maskableSize - innerSize) / 2;
const padA = Math.floor(pad);
const padB = maskableSize - innerSize - padA; // ensures exact total
await sharp(src)
  .resize(innerSize, innerSize, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
  .extend({
    top: padA,
    bottom: padB,
    left: padA,
    right: padB,
    background: { r: 15, g: 23, b: 42, alpha: 1 },
  })
  .png()
  .toFile('public/icons/icon-512x512-maskable.png');
console.log('✓ icon-512x512-maskable.png');
