import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {startDev} from '../../gulp-tasks/dev.mjs';
import {fixture, nextBuild} from '../helpers.mjs';

test('watch survives initial/runtime errors, tracks resources and shuts down', {timeout: 90000}, async t => {
  const f = await fixture(t);
  await f.put('src/styles/main.scss', '.broken {');
  await f.put('src/js/index.js', 'import "./missing.js";');
  const session = await startDev({rootDir: f.rootDir, port: 0, quiet: true});
  try {
    const address = session.server.instance.server.address();
    assert.equal(address.address, '127.0.0.1');
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/`)).status, 200);
    let ready = nextBuild(session, 'styles');
    await f.put('src/styles/main.scss', '.fixed { color: blue; }');
    await ready;
    ready = nextBuild(session, 'scripts');
    await f.put('src/js/missing.js', 'window.recovered = true;');
    await ready;
    ready = nextBuild(session, 'scripts', 'build-error');
    await f.put('src/js/missing.js', 'export const broken = ;');
    await ready;
    ready = nextBuild(session, 'scripts');
    await f.put('src/js/missing.js', 'window.recovered = true;');
    await ready;
    ready = nextBuild(session, 'styles', 'build-error');
    await f.put('src/styles/main.scss', '.broken {');
    await ready;
    ready = nextBuild(session, 'styles');
    await f.put('src/styles/main.scss', '.fixed { color: red; }');
    await f.put('src/styles/main.scss', '.fixed { color: green; }');
    await f.put('src/styles/main.scss', '.fixed { color: blue; }');
    await ready;
    assert.match(await fs.readFile(path.join(f.outputDir, 'styles/main.css'), 'utf8'), /blue/);
    const icon = await sharp({create: {width: 16, height: 16, channels: 4, background: '#f00'}}).png().toBuffer();
    for (const [name, owner, data, output] of [
      ['src/img/photo.png', 'images', icon, 'img/photo.webp'],
      ['src/img/svg/test.svg', 'sprites', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>', 'img/sprites/sprite.svg'],
      ['src/img/favicon/icon.png', 'views', icon, 'img/favicons/favicon.ico'],
      ['src/files/blob', 'files', Buffer.from([0, 255]), 'files/blob'],
      ['src/fonts/test.woff2', 'fonts', Buffer.from([0, 128]), 'fonts/test.woff2'],
      ['src/views/pages/extra.pug', 'views', 'p extra', 'extra.html']
    ]) {
      ready = nextBuild(session, owner);
      await f.put(name, data);
      await ready;
      assert.ok((await fs.stat(path.join(f.outputDir, output))).isFile());
      if (owner === 'images') {
        ready = nextBuild(session, owner);
        await f.put(name, await sharp(icon).resize(8, 8).png().toBuffer());
        await ready;
        assert.equal((await sharp(await fs.readFile(path.join(f.outputDir, output))).metadata()).width, 8);
      }
      ready = nextBuild(session, owner);
      await fs.rm(path.join(f.rootDir, name));
      await ready;
      await assert.rejects(fs.stat(path.join(f.outputDir, output)), {code: 'ENOENT'});
    }
  } finally { await session.close(); }
});
