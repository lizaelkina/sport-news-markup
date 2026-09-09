import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import stylelint from 'stylelint';
import {ESLint} from 'eslint';
import {SourceMapConsumer} from 'source-map-js';
import {createBuild, projectRoot} from '../../gulp-tasks/index.mjs';
import {createBlock} from '../../scripts/create-block.mjs';
import {files, unique} from '../../gulp-tasks/io.mjs';
import {fixture, serve} from '../helpers.mjs';

test('production build, chunks, HTML integrity, optional assets and partial ownership', async t => {
  const f = await fixture(t);
  await f.tasks.build();
  const html = await fs.readFile(path.join(f.outputDir, 'index.html'), 'utf8');
  assert.match(html, /example\.js/);
  assert.match(html, /data\.json/);
  assert.doesNotMatch(html, /\.min\./);
  assert.ok((await files(path.join(f.outputDir, 'js'))).some(name => /^chunks\/.+\.[a-f0-9]{8}\.js$/.test(name)));
  assert.deepEqual(await files(path.join(f.outputDir, 'styles')), ['main.css']);
  const before = await fs.readFile(path.join(f.outputDir, 'js/main.js'));
  await f.tasks.styles();
  assert.deepEqual(await fs.readFile(path.join(f.outputDir, 'js/main.js')), before);
  await f.tasks.files();
  await f.tasks.apache();
  assert.equal(await fs.readFile(path.join(f.outputDir, '.htaccess'), 'utf8'), '# fixture\n');
  await f.tasks.clean();
  await assert.rejects(fs.stat(path.join(f.outputDir, '.htaccess')), {code: 'ENOENT'});
  for (const outputDir of [f.rootDir, path.join(f.rootDir, 'src'), projectRoot]) {
    await assert.rejects(createBuild({rootDir: f.rootDir, outputDir}).clean(), /Unsafe output/);
  }
  if (process.platform === 'win32') await assert.rejects(createBuild({rootDir: f.rootDir, outputDir: path.join(f.rootDir, 'SRC')}).clean(), /Unsafe output/);
  assert.throws(() => unique([['A.webp'], ['a.webp']]), /collision/);
  assert.throws(() => unique([['asset'], ['asset/file']]), /collision/);
});

test('compilation errors, page collisions and multiple favicon inputs reject', async t => {
  const f = await fixture(t);
  await f.put('src/styles/main.scss', '.broken {');
  await assert.rejects(f.tasks.styles());
  await f.put('src/js/index.js', 'import "./missing.js";');
  await assert.rejects(f.tasks.scripts(), /missing/);
  await f.put('src/views/pages/index.pug', 'p duplicate');
  await assert.rejects(f.tasks.views(), /collision/);
  await fs.rm(path.join(f.rootDir, 'src/views/pages/index.pug'));
  await f.put('src/views/pages/extra.pug', 'p extra');
  await f.tasks.views();
  assert.match(await fs.readFile(path.join(f.outputDir, 'extra.html'), 'utf8'), /extra/);
  await fs.rm(path.join(f.rootDir, 'src/views/pages/extra.pug'));
  await f.tasks.views();
  await assert.rejects(fs.stat(path.join(f.outputDir, 'extra.html')), {code: 'ENOENT'});
  await f.put('src/img/favicon/a.png', 'bad');
  await assert.rejects(f.tasks.favicons());
  await f.put('src/img/favicon/b.png', 'bad');
  await assert.rejects(f.tasks.favicons(), /one PNG/);
});

test('missing optional resources create no empty output directories', async t => {
  const f = await fixture(t);
  // A standalone views task must not depend on the favicon directory creating dist.
  await f.tasks.views();
  assert.ok((await fs.stat(path.join(f.outputDir, 'index.html'))).isFile());
  await f.tasks.build();
  for (const name of ['files', 'fonts', 'img']) {
    await assert.rejects(fs.stat(path.join(f.outputDir, name)), {code: 'ENOENT'});
  }
  for (const [source, output, task] of [['src/files/nested/blob', 'files', 'files'], ['src/fonts/font.woff2', 'fonts', 'fonts']]) {
    await f.put(source, Buffer.from([0, 255]));
    await f.tasks[task]();
    assert.ok((await fs.stat(path.join(f.outputDir, output))).isDirectory());
    await fs.rm(path.join(f.rootDir, source));
    await f.tasks[task]();
    await assert.rejects(fs.stat(path.join(f.outputDir, output)), {code: 'ENOENT'});
  }
});

test('binary copies, WebP orientation, collisions and stale outputs', {timeout: 20000}, async t => {
  const f = await fixture(t);
  const png = await sharp({create: {width: 9, height: 5, channels: 3, background: '#f00'}}).png().toBuffer();
  const oriented = await sharp(png).jpeg().withMetadata({orientation: 6}).toBuffer();
  await f.put('src/img/photo.jpg', oriented);
  const binary = Buffer.from([0, 255, 128, 1, 239, 187, 191, 0]);
  await f.put('src/files/blob', binary);
  await f.put('src/fonts/font.woff2', binary);
  await Promise.all([f.tasks.images(), f.tasks.files(), f.tasks.fonts()]);
  assert.deepEqual(await fs.readFile(path.join(f.outputDir, 'img/photo.jpg')), oriented);
  assert.deepEqual(await fs.readFile(path.join(f.outputDir, 'files/blob')), binary);
  assert.deepEqual(await fs.readFile(path.join(f.outputDir, 'fonts/font.woff2')), binary);
  const metadata = await sharp(await fs.readFile(path.join(f.outputDir, 'img/photo.webp'))).metadata();
  assert.equal(metadata.width, 5);
  assert.equal(metadata.height, 9);
  await f.put('src/img/photo.webp', png);
  await assert.rejects(f.tasks.images(), /collision/);
  await fs.rm(path.join(f.rootDir, 'src/img/photo.webp'));
  await f.put('src/img/photo.png', png);
  await assert.rejects(f.tasks.images(), /collision/);
  await fs.rm(path.join(f.rootDir, 'src/img/photo.png'));
  await fs.rm(path.join(f.rootDir, 'src/img/photo.jpg'));
  await f.tasks.images();
  assert.deepEqual(await files(path.join(f.outputDir, 'img')), []);
});

test('image rebuild replaces directories with files and preserves sprites and favicons', async t => {
  const f = await fixture(t);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>';
  await f.put('src/img/mark.svg/nested.svg', svg);
  await f.put('src/img/svg/test.svg', svg);
  await f.put('src/img/favicon/icon.png', await sharp({create: {width: 16, height: 16, channels: 4, background: '#fff'}}).png().toBuffer());
  await Promise.all([f.tasks.images(), f.tasks.sprites(), f.tasks.favicons()]);
  const owned = (await files(path.join(f.outputDir, 'img'))).filter(name => /^(sprites|favicons)\//.test(name));
  const before = await Promise.all(owned.map(name => fs.readFile(path.join(f.outputDir, 'img', name))));
  await fs.rm(path.join(f.rootDir, 'src/img/mark.svg/nested.svg'));
  await fs.rmdir(path.join(f.rootDir, 'src/img/mark.svg'));
  await f.put('src/img/mark.svg', svg);
  await f.tasks.images();
  assert.ok((await fs.stat(path.join(f.outputDir, 'img/mark.svg'))).isFile());
  await fs.rm(path.join(f.rootDir, 'src/img/mark.svg'));
  await f.put('src/img/mark.svg/nested.svg', svg);
  await f.tasks.images();
  assert.ok((await fs.stat(path.join(f.outputDir, 'img/mark.svg/nested.svg'))).isFile());
  await fs.rm(path.join(f.rootDir, 'src/img/mark.svg/nested.svg'));
  await f.tasks.images();
  await assert.rejects(fs.stat(path.join(f.outputDir, 'img/mark.svg')), {code: 'ENOENT'});
  assert.deepEqual(await files(path.join(f.outputDir, 'img')), owned);
  assert.deepEqual(await Promise.all(owned.map(name => fs.readFile(path.join(f.outputDir, 'img', name)))), before);
});

test('four coherent favicons, opaque white Apple icon and deletion', async t => {
  const f = await fixture(t);
  const icon = await sharp({create: {width: 32, height: 32, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).png().toBuffer();
  await f.put('src/img/favicon/icon.png', icon);
  await f.tasks.favicons();
  const names = await files(path.join(f.outputDir, 'img/favicons'));
  assert.deepEqual(names.sort(), ['apple-touch-icon-180x180.png', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon.ico']);
  const html = await fs.readFile(path.join(f.outputDir, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map(match => match[1]).filter(href => href.includes('favicons/'));
  assert.deepEqual(hrefs.toSorted(), names.map(name => `img/favicons/${name}`).toSorted());
  assert.doesNotMatch(html, /<meta\b/);
  for (const prefix of ['/', '/test-landing/']) {
    const server = await serve(f.outputDir, prefix);
    try {
      for (const href of hrefs) {
        const url = new URL(href, server.url);
        assert.equal(url.pathname, `${prefix}${href}`);
        const response = await fetch(url);
        assert.equal(response.status, 200, url.href);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), await fs.readFile(path.join(f.outputDir, href)));
      }
    } finally { await server.close(); }
  }
  const {data} = await sharp(await fs.readFile(path.join(f.outputDir, 'img/favicons/apple-touch-icon-180x180.png'))).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  assert.deepEqual([...data.subarray(0, 4)], [255, 255, 255, 255]);
  await fs.rm(path.join(f.rootDir, 'src/img/favicon/icon.png'));
  await f.tasks.views();
  assert.deepEqual(await files(path.join(f.outputDir, 'img/favicons')), []);
  await assert.rejects(fs.stat(path.join(f.outputDir, 'img/favicons')), {code: 'ENOENT'});
  assert.doesNotMatch(await fs.readFile(path.join(f.outputDir, 'index.html'), 'utf8'), /img\/favicons/);
});

test('sourcemaps include original entrypoint and BEM paths with spaces and Cyrillic', async t => {
  const f = await fixture(t, {label: 'проверка карты '});
  await f.put('src/blocks/components/card/card.scss', '.card {\n  color: blue;\n  user-select: none;\n}\n');
  await f.put('src/styles/main.scss', '@use "../blocks/components/card/card";\n.entry { color: red; }\n');
  await createBuild({...f, mode: 'development'}).styles();
  const stylesheet = path.join(f.outputDir, 'styles/main.css');
  const css = await fs.readFile(stylesheet, 'utf8');
  assert.equal((css.match(/sourceMappingURL=/g) || []).length, 1);
  assert.match(css, /\/\*# sourceMappingURL=main\.css\.map \*\/\n$/);
  const map = JSON.parse(await fs.readFile(`${stylesheet}.map`, 'utf8'));
  assert.equal(map.version, 3);
  assert.equal(map.file, 'main.css');
  assert.equal(map.sourceRoot, undefined);
  assert.ok(map.sources.some(source => source.endsWith('src/styles/main.scss')));
  assert.ok(map.sources.some(source => source.endsWith('src/blocks/components/card/card.scss')));
  assert.equal(map.sourcesContent.length, map.sources.length);
  for (let i = 0; i < map.sources.length; i++) {
    assert.equal(path.isAbsolute(map.sources[i]), false);
    assert.doesNotMatch(map.sources[i], /^(?:file:|data:|[A-Za-z]:)|\\|src\/styles\/main\.css$/);
    assert.equal((await fs.readFile(path.resolve(path.dirname(stylesheet), map.sources[i]), 'utf8')).trim(), map.sourcesContent[i].trim());
  }
  const consumer = new SourceMapConsumer(map);
  for (const [declaration, source, originalLine] of [
    ['color: red', 'src/styles/main.scss', 2],
    ['color: blue', 'src/blocks/components/card/card.scss', 2],
    ['-webkit-user-select: none', 'src/blocks/components/card/card.scss', 3],
    ['user-select: none', 'src/blocks/components/card/card.scss', 3]
  ]) {
    const lineIndex = css.split('\n').findIndex(line => line.trimStart().startsWith(declaration));
    assert.ok(lineIndex >= 0, `Missing declaration: ${declaration}`);
    const column = css.split('\n')[lineIndex].indexOf(declaration);
    const original = consumer.originalPositionFor({line: lineIndex + 1, column});
    assert.ok(original.source?.endsWith(source), `Wrong source for ${declaration}`);
    assert.equal(original.line, originalLine, `Wrong source line for ${declaration}`);
  }
  await f.tasks.styles();
  assert.deepEqual(await files(path.dirname(stylesheet)), ['main.css']);
  assert.doesNotMatch(await fs.readFile(stylesheet, 'utf8'), /sourceMappingURL=/);
});

test('BEM generator rolls back partial writes and preserves unrelated files', async t => {
  const f = await fixture(t);
  const failure = new Error('Simulated write failure');
  const open = fs.open;
  const mocked = t.mock.method(fs, 'open', async (target, flags) => {
    const handle = await open(target, flags);
    if (target.endsWith('failed-card.scss')) {
      t.mock.method(handle, 'writeFile', async contents => {
        await handle.write(contents.slice(0, 3));
        throw failure;
      });
    }
    return handle;
  });
  try {
    await assert.rejects(createBlock('components', 'failed-card', f.rootDir), error => error === failure);
    await assert.rejects(fs.stat(path.join(f.rootDir, 'src/blocks/components/failed-card')), {code: 'ENOENT'});
  } finally { mocked.mock.restore(); }
  const folder = await createBlock('components', 'failed-card', f.rootDir);
  assert.equal((await files(folder)).length, 3);

  const conflict = t.mock.method(fs, 'open', async (target, flags) => {
    if (target.endsWith('other-card.scss')) {
      await f.put('src/blocks/components/other-card/keep.txt', 'unrelated');
      throw failure;
    }
    return open(target, flags);
  });
  try {
    await assert.rejects(createBlock('components', 'other-card', f.rootDir), error => error instanceof AggregateError && error.cause === failure);
    const other = path.join(f.rootDir, 'src/blocks/components/other-card');
    assert.deepEqual(await files(other), ['keep.txt']);
    assert.equal(await fs.readFile(path.join(other, 'keep.txt'), 'utf8'), 'unrelated');
  } finally { conflict.mock.restore(); }
});

test('BEM generator rejects unsafe names and overwrites; linters enforce intended rules', async t => {
  const f = await fixture(t);
  const folder = await createBlock('components', 'new-card', f.rootDir);
  assert.deepEqual((await files(folder)).sort(), ['new-card.js', 'new-card.pug', 'new-card.scss']);
  await assert.rejects(createBlock('components', 'new-card', f.rootDir), {code: 'EEXIST'});
  for (const name of ['../escape', 'CON', 'con', 'a/b', 'two words']) await assert.rejects(createBlock('modules', name, f.rootDir));
  const config = path.join(projectRoot, '.stylelintrc');
  const bad = await stylelint.lint({code: '#bad { color: red; }', codeFilename: path.join(projectRoot, 'src/blocks/components/card/card.scss'), configFile: config});
  assert.ok(bad.results[0].warnings.some(warning => warning.rule === 'selector-max-id'));
  const good = await stylelint.lint({code: '.card {\n  color: #fff;\n}\n', codeFilename: path.join(projectRoot, 'src/blocks/components/card/card.scss'), configFile: config});
  assert.equal(good.errored, false);
  const eslint = new ESLint({cwd: projectRoot});
  assert.equal(await eslint.isPathIgnored(path.join(projectRoot, '.cache/fixture.js')), true);
  const [result] = await eslint.lintText('window.answer = missingVariable;\n', {filePath: 'src/blocks/components/card/card.js'});
  assert.ok(result.messages.some(message => message.ruleId === 'no-undef' && message.message.includes('missingVariable')));
  assert.ok(!result.messages.some(message => message.message.includes("'window'")));
});
