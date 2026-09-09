import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Writable} from 'node:stream';
import gulp from 'gulp';
import pug from 'gulp-pug';
import {favicons} from 'favicons';
import {copyEntries, files, unique, replaceDirectory, writeEntries} from './io.mjs';

export function createViews({rootDir, outputDir}) {
  let cached;
  async function iconData() {
    const inputs = await copyEntries(path.join(rootDir, 'src/img/favicon'));
    if (!inputs.length) return {images: [], html: []};
    if (inputs.length !== 1 || !/\.(png|jpe?g|gif|tiff)$/i.test(inputs[0][0])) throw new Error('Expected one PNG/JPEG/GIF/TIFF favicon source');
    const buffer = inputs[0][1];
    const key = createHash('sha256').update(buffer).digest('hex');
    if (cached?.key === key) return cached.result;
    const result = await favicons(buffer, {
      path: 'img/favicons',
      background: '#ffffff',
      icons: {
        favicons: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png'],
        appleIcon: ['apple-touch-icon-180x180.png'],
        android: false, appleStartup: false, windows: false, yandex: false
      }
    });
    // The generator roots URLs and adds Apple web-app metadata; publish icon links only.
    result.html = result.html.filter(tag => tag.startsWith('<link '))
      .map(tag => tag.replace('href="/img/favicons/', 'href="img/favicons/'));
    cached = {key, result};
    return result;
  }

  return async function views() {
    const icons = await iconData();
    const source = path.join(rootDir, 'src/views');
    const pages = (await files(path.join(source, 'pages'))).filter(name => !name.includes('/') && name.endsWith('.pug'));
    unique(['index.pug', ...pages].map(name => [name.replace(/\.pug$/, '.html'), null]));
    const inputs = [path.join(source, 'index.pug'), ...pages.map(name => path.join(source, 'pages', name))];
    const entries = [];
    await pipeline(
      gulp.src(inputs, {base: source}),
      pug({pretty: true, locals: {faviconHtml: icons.html.join('\n')}}),
      new Writable({objectMode: true, write(file, _encoding, callback) { entries.push([path.basename(file.path), file.contents]); callback(); }})
    );
    unique(entries);
    await replaceDirectory(path.join(outputDir, 'img/favicons'), icons.images.map(item => [item.name, item.contents]));
    await fs.mkdir(outputDir, {recursive: true});
    const existing = await fs.readdir(outputDir);
    for (const name of existing.filter(name => /\.html$/i.test(name))) await fs.rm(path.join(outputDir, name));
    await writeEntries(outputDir, entries);
  };
}
