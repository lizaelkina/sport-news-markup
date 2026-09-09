import path from 'node:path';
import fs from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import gulp from 'gulp';
import sharp from 'sharp';
import {optimize} from 'svgo';
import svgSprite from 'gulp-svg-sprite';
import {copyEntries, files, unique, replaceDirectory, writeEntries} from './io.mjs';

const svgoOptions = {plugins: [{name: 'preset-default', params: {overrides: {cleanupIds: false}}}]};
const svg = (buffer, name) => Buffer.from(optimize(buffer.toString(), {...svgoOptions, path: name}).data);
const reserved = name => ['sprites', 'favicons'].includes(name.split('/')[0].toLowerCase());

export async function images({rootDir, outputDir}) {
  const source = path.join(rootDir, 'src/img');
  const names = (await files(source)).filter(name => !['svg', 'favicon'].includes(name.split('/')[0].toLowerCase()));
  const inputs = names.filter(name => /\.(png|jpe?g|tiff|gif|webp|svg)$/i.test(name));
  const jobs = [];
  for (const name of inputs) {
    if (reserved(name)) throw new Error(`Reserved image directory: ${name}`);
    jobs.push([name, name, false]);
    if (/\.(png|jpe?g|tiff)$/i.test(name)) jobs.push([name.replace(/\.[^.]+$/, '.webp'), name, true]);
  }
  unique(jobs);
  const entries = [];
  for (const [name, input, webp] of jobs) {
    const buffer = await fs.readFile(path.join(source, input));
    const data = webp ? await sharp(buffer).autoOrient().webp({quality: 75}).toBuffer() : /\.svg$/i.test(name) ? svg(buffer, input) : buffer;
    entries.push([name, data]);
  }
  const destination = path.join(outputDir, 'img');
  for (const name of await files(destination)) {
    if (!reserved(name)) await fs.rm(path.join(destination, name));
  }
  // Remove empty image directories without touching the other resource owners.
  const prune = async directory => {
    let children;
    try { children = await fs.readdir(directory, {withFileTypes: true}); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of children) {
      if (!entry.isDirectory() || (directory === destination && reserved(entry.name))) continue;
      const child = path.join(directory, entry.name);
      await prune(child);
      await fs.rmdir(child);
    }
  };
  await prune(destination);
  await writeEntries(destination, entries);
}

export async function sprites({rootDir, outputDir}) {
  const source = path.join(rootDir, 'src/img/svg');
  const names = (await files(source)).filter(name => !name.includes('/') && /\.svg$/i.test(name));
  unique(names.map(name => [name.replace(/\.svg$/i, ''), null]));
  const entries = [];
  if (names.length) {
    await pipeline(
      gulp.src(names.map(name => path.join(source, name)), {base: source, encoding: false}),
      new Transform({objectMode: true, transform(file, _encoding, callback) {
        try { file.contents = svg(file.contents, file.path); callback(null, file); } catch (error) { callback(error); }
      }}),
      svgSprite({shape: {transform: [], id: {generator: '%s'}}, svg: {namespaceIDs: true}, mode: {symbol: {dest: '.', sprite: 'sprite.svg'}}}),
      new Transform({objectMode: true, transform(file, _encoding, callback) { entries.push([file.relative, file.contents]); callback(); }})
    );
  }
  await replaceDirectory(path.join(outputDir, 'img/sprites'), entries);
}

export async function copyResource({rootDir, outputDir}, name) {
  const accept = name === 'fonts' ? filename => /\.woff2?$/i.test(filename) : () => true;
  await replaceDirectory(path.join(outputDir, name), await copyEntries(path.join(rootDir, 'src', name), accept));
}
