import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import webpack from 'webpack';
import webpackConfig from '../webpack.config.mjs';
import {assertOutput, files} from './io.mjs';
import {compileStyles} from './styles.mjs';
import {images, sprites, copyResource} from './resources.mjs';
import {createViews} from './views.mjs';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function createBuild({rootDir = projectRoot, outputDir = path.join(rootDir, 'dist'), mode = 'production'} = {}) {
  const config = {rootDir: path.resolve(rootDir), outputDir: path.resolve(outputDir), mode};
  if (!['production', 'development'].includes(mode)) throw new Error(`Unknown build mode: ${mode}`);
  const guard = action => async () => {
    await assertOutput(config.rootDir, config.outputDir);
    await files(config.outputDir); // Reject junctions/symlinks before writing through existing output paths.
    return action();
  };
  const views = createViews(config);
  const tasks = {
    config,
    clean: guard(() => fs.rm(config.outputDir, {recursive: true, force: true})),
    views: guard(views),
    favicons: guard(views),
    styles: guard(() => compileStyles(config)),
    images: guard(() => images(config)),
    sprites: guard(() => sprites(config)),
    fonts: guard(() => copyResource(config, 'fonts')),
    files: guard(() => copyResource(config, 'files')),
    scripts: guard(() => new Promise((resolve, reject) => {
      const compiler = webpack(webpackConfig(config));
      compiler.run((error, stats) => {
        compiler.close(closeError => {
          if (error || closeError) return reject(error || closeError);
          if (!stats || stats.hasErrors()) return reject(new Error(stats?.toString({all: false, errors: true}) || 'No webpack stats'));
          resolve(stats);
        });
      });
    })),
    apache: guard(async () => {
      await fs.mkdir(config.outputDir, {recursive: true});
      await fs.copyFile(path.join(config.rootDir, 'src/.htaccess'), path.join(config.outputDir, '.htaccess'));
    })
  };
  tasks.build = async () => {
    await tasks.clean();
    const results = await Promise.allSettled(['views', 'styles', 'scripts', 'images', 'sprites', 'fonts', 'files'].map(name => tasks[name]()));
    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join('\n'));
  };
  tasks.buildApache = async () => { await tasks.build(); await tasks.apache(); };
  return tasks;
}
