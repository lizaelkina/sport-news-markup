import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {projectRoot} from '../gulp-tasks/index.mjs';

export async function createBlock(level, name, rootDir = projectRoot) {
  if (!['components', 'modules'].includes(level)) throw new Error('Expected components or modules');
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name || '') || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(name)) throw new Error('Expected one safe kebab-case block name');
  const parent = path.resolve(rootDir, 'src/blocks', level);
  await fs.mkdir(parent, {recursive: true});
  const directory = path.join(parent, name);
  await fs.mkdir(directory);
  const created = [];
  try {
    for (const [extension, contents] of [['pug', `.${name}\n`], ['scss', `// Styles for ${name}.\n`], ['js', `// Behaviour for ${name}.\n`]]) {
      const target = path.join(directory, `${name}.${extension}`);
      const handle = await fs.open(target, 'wx');
      created.push(target);
      try { await handle.writeFile(contents); } finally { await handle.close(); }
    }
  } catch (error) {
    // Only files opened by this invocation belong to us; never recursively remove the block.
    const cleanup = await Promise.allSettled(created.map(target => fs.rm(target, {force: true})));
    const failures = cleanup.filter(result => result.status === 'rejected').map(result => result.reason);
    try { await fs.rmdir(directory); }
    catch (cleanupError) { if (cleanupError.code !== 'ENOENT') failures.push(cleanupError); }
    if (failures.length) throw new AggregateError([error, ...failures], `Block creation failed; cleanup incomplete: ${directory}`, {cause: error});
    throw error;
  }
  return directory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [level, name, ...extra] = process.argv.slice(2);
  try {
    if (extra.length) throw new Error('Expected exactly one block name');
    await createBlock(level, name);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
