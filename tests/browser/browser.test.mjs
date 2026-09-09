import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fixture, serve} from '../helpers.mjs';

test('Chromium: executable fixture and actual site work in root and subpath', {timeout: 90000}, async t => {
  let browser;
  try { browser = await chromium.launch(); }
  catch (error) { throw new Error(`Chromium is required: run yarn test:setup. ${error.message}`, {cause: error}); }
  try {
    for (const real of [false, true]) {
      const f = await fixture(t, {real});
      await f.tasks.build();
      for (const prefix of ['/', '/test-landing/']) {
        const server = await serve(f.outputDir, prefix);
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
        page.on('requestfailed', request => errors.push(request.url()));
        try {
          await page.goto(server.url);
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode(); }));
          });
          if (!real) {
            assert.equal(await page.evaluate(() => window.syncValue), 7);
            assert.equal(await page.evaluate(() => window.loadChunk()), 42);
          } else {
            const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
            assert.equal(hrefs.length, 4);
            // Headless Chromium need not request favicons automatically.
            for (const href of hrefs) {
              assert.match(href, /^img\/favicons\//);
              const response = await page.request.get(new URL(href, page.url()).href);
              assert.equal(response.status(), 200);
              assert.ok((await response.body()).length > 0);
            }
            assert.equal(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').count(), 1);
            assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="apple-mobile-web-app-title"]').count(), 0);
            const boxes = await page.locator('svg[data-svg]').evaluateAll(nodes => nodes.map(node => { const box = node.getBBox(); return {width: box.width, height: box.height}; }));
            assert.ok(boxes.length > 0);
            assert.ok(boxes.every(box => box.width > 0 && box.height > 0));
          }
          assert.deepEqual(errors, []);
        } finally { await page.close(); await server.close(); }
      }
    }
  } finally { await browser.close(); }
});
