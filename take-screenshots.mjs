import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

mkdirSync('public/screenshots', { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL    = 'http://localhost:4174/Suivi-de-Flotte-Engins/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();

// Wait for app to render (skip login if any)
async function snap(width, height, filename) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 15000 });
  // Wait a bit more for React to paint
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `public/screenshots/${filename}`, fullPage: false });
  console.log(`✓ ${filename} (${width}×${height})`);
}

await snap(1280, 800,  'screenshot-desktop.png');
await snap(390,  844,  'screenshot-mobile.png');

await browser.close();
