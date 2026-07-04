/**
 * Browser UI smoke test — all 16 tools load and merge accepts files.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE_URL || 'http://localhost:5174';

const ALL_TOOLS = [
  'merge', 'split', 'organize', 'rotate', 'extract',
  'add-text', 'add-image', 'signature', 'watermark', 'page-numbers',
  'jpg-to-pdf', 'pdf-to-jpg', 'html-to-pdf', 'protect', 'crop',
]; // 15 tools

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];

  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });

  const cards = await page.locator('.tool-card').count();
  if (cards !== 15) throw new Error(`Expected 15 tool cards on home, got ${cards}`);

  const quickCards = await page.locator('.quick-card').count();
  if (quickCards !== 4) throw new Error(`Expected 4 quick-start cards, got ${quickCards}`);

  for (const toolId of ALL_TOOLS) {
    await page.locator(`.tool-card[data-tool="${toolId}"]`).click();
    await page.waitForSelector('.tool-hero h1', { timeout: 8000 });
    const workspace = page.locator('#tool-workspace');
    const html = await workspace.innerHTML();
    if (!html.trim()) throw new Error(`Tool "${toolId}" has empty workspace`);

    const hasDropzone = await workspace.locator('.dropzone').count();
    const hasCard = await workspace.locator('.card').count();
    if (!hasDropzone && !hasCard) {
      throw new Error(`Tool "${toolId}" has no dropzone or card UI`);
    }

    await page.locator('#back-home').click();
    await page.waitForSelector('.home-hero h1', { timeout: 8000 });
    console.log('PASS UI navigate', toolId);
  }

  // Merge upload flow
  await page.locator('.tool-card[data-tool="merge"]').click();
  await page.waitForSelector('.dropzone');
  const sample = resolve(__dirname, '../test-fixtures/sample.pdf');
  const sample2 = resolve(__dirname, '../test-fixtures/sample2.pdf');
  await page.locator('.dropzone input[type="file"]').setInputFiles([sample, sample2]);
  await page.waitForSelector('.file-item', { timeout: 15000 });
  const files = await page.locator('.file-item').count();
  if (files < 2) throw new Error('Merge file upload failed');
  console.log('PASS UI merge upload');

  // Watermark configure flow
  await page.locator('#back-home').click();
  await page.waitForSelector('.home-hero h1');
  await page.locator('.tool-card[data-tool="watermark"]').click();
  await page.waitForSelector('.dropzone');
  await page.locator('.dropzone input').setInputFiles([sample]);
  await page.waitForSelector('.card', { timeout: 15000 });
  await page.waitForSelector('#preview-wrap canvas', { timeout: 15000 });
  console.log('PASS UI watermark preview');

  if (errors.length) {
    console.error('Console errors:', errors.slice(0, 5));
    throw new Error(`${errors.length} page errors`);
  }

  console.log(`\nUI check passed: 15 tools navigated, merge upload, watermark preview`);
  await browser.close();
}

run().catch((e) => {
  console.error('UI check failed:', e.message);
  process.exit(1);
});