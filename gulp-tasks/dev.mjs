import path from 'node:path';
import {EventEmitter} from 'node:events';
import net from 'node:net';
import gulp from 'gulp';
import browserSync from 'browser-sync';
import webpack from 'webpack';
import webpackConfig from '../webpack.config.mjs';
import {assertOutput, slash} from './io.mjs';
import {createBuild} from './index.mjs';

// One pending rebuild per owner; webpack maintains its own dependency graph.
function queue(action) {
  let pending = false;
  let running;
  let stopped = false;
  const request = () => {
    if (stopped) return Promise.resolve();
    pending = true;
    if (!running) running = (async () => { while (pending && !stopped) { pending = false; await action(); } })().finally(() => { running = undefined; });
    return running;
  };
  return {request, stop: async () => { stopped = true; await running; }};
}

export async function startDev(options = {}) {
  const tasks = createBuild({...options, mode: 'development'});
  const {rootDir, outputDir} = tasks.config;
  await assertOutput(rootDir, outputDir);
  await tasks.clean();
  const events = new EventEmitter();
  const server = browserSync.create();
  let port = options.port ?? 4000;
  if (port === 0) {
    const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
    port = probe.address().port;
    await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  }
  const watchers = [];
  const queues = [];
  let closing = false;
  let initialized = false;
  const report = (name, error) => {
    if (error) {
      if (!options.quiet) process.stderr.write(`[${name}] ${error.message}\n`);
      events.emit('build-error', {name, error});
    } else {
      events.emit('built', name);
      if (initialized) server.reload();
    }
  };
  const definitions = {
    views: name => /^(views|blocks)\/.*\.pug$/.test(name) || name.startsWith('img/favicon/'),
    styles: name => /^(styles|blocks)\/.*\.scss$/.test(name),
    images: name => /^img\/(?!favicon\/|svg\/).+\.(png|jpe?g|tiff|gif|svg|webp)$/i.test(name),
    sprites: name => /^img\/svg\/[^/]+\.svg$/i.test(name),
    fonts: name => /^fonts\/.+\.woff2?$/i.test(name),
    files: name => name.startsWith('files/')
  };
  for (const [name, matches] of Object.entries(definitions)) {
    const owner = queue(async () => {
      try { await tasks[name](); report(name); } catch (error) { report(name, error); }
    });
    const source = path.join(rootDir, 'src');
    // Watch the existing source root so newly created optional directories are discovered.
    const watcher = gulp.watch(source, {
      ignoreInitial: true,
      ignored: (filename, stat) => stat?.isFile() && !matches(slash(path.relative(source, filename))),
      alwaysStat: true,
      delay: 200,
      awaitWriteFinish: {stabilityThreshold: 100, pollInterval: 20}
    }, () => owner.request());
    watcher.on('error', error => report(name, error));
    watchers.push(watcher);
    queues.push(owner);
  }
  const compiler = webpack(webpackConfig(tasks.config));
  let firstCompilation;
  const first = new Promise(resolve => { firstCompilation = resolve; });
  const watching = compiler.watch({}, (error, stats) => {
    report('scripts', error || (stats?.hasErrors() ? new Error(stats.toString({all: false, errors: true})) : undefined));
    firstCompilation();
  });
  const close = async () => {
    if (closing) return;
    closing = true;
    await Promise.all(watchers.map(watcher => watcher.close()));
    await Promise.all(queues.map(owner => owner.stop()));
    await new Promise((resolve, reject) => watching.close(error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
    server.exit();
  };
  try {
    await Promise.all(watchers.map(watcher => new Promise(resolve => watcher.once('ready', resolve))));
    await Promise.all([...queues.map(owner => owner.request()), first]);
    await new Promise((resolve, reject) => server.init({
      server: outputDir,
      listen: '127.0.0.1',
      port,
      ui: false,
      open: false,
      notify: false,
      online: false,
      logLevel: options.quiet ? 'silent' : 'info',
      serveStatic: [{route: '/src', dir: path.join(rootDir, 'src')}]
    }, error => error ? reject(error) : resolve()));
    initialized = true;
    return {close, events, server, tasks};
  } catch (error) { await close(); throw error; }
}

export async function dev() {
  const session = await startDev();
  await new Promise(resolve => {
    const shutdown = () => {
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      session.close().then(resolve, error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; resolve(); });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
