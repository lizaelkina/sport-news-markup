import path from 'node:path';
import fs from 'node:fs/promises';

export const slash = value => value.replaceAll('\\', '/');
export const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
};

export async function files(directory) {
  let entries;
  try { entries = await fs.readdir(directory, {withFileTypes: true}); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${absolute}`);
    if (entry.isDirectory()) result.push(...(await files(absolute)).map(name => slash(path.join(entry.name, name))));
    else if (entry.isFile()) result.push(entry.name);
  }
  return result;
}

export function unique(entries) {
  const seen = new Set();
  for (const [name] of entries) {
    const key = slash(name).toLowerCase();
    if (path.isAbsolute(name) || key.split('/').some(part => !part || part === '..')) throw new Error(`Unsafe output name: ${name}`);
    if (seen.has(key)) throw new Error(`Output collision: ${name}`);
    seen.add(key);
  }
  for (const key of seen) {
    const segments = key.split('/');
    segments.pop();
    while (segments.length) {
      if (seen.has(segments.join('/'))) throw new Error(`File/directory collision: ${key}`);
      segments.pop();
    }
  }
  return entries;
}

export async function assertOutput(root, output) {
  if (!inside(root, output) || ['src', 'node_modules', '.git', '.yarn'].some(name => path.relative(path.join(root, name), output) === '' || inside(path.join(root, name), output))) {
    throw new Error(`Unsafe output directory: ${output}`);
  }
  for (let current = output; inside(root, current); current = path.dirname(current)) {
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`Output contains a symbolic link: ${current}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export async function writeEntries(directory, entries) {
  unique(entries);
  for (const [name, data] of entries) {
    const destination = path.join(directory, name);
    await fs.mkdir(path.dirname(destination), {recursive: true});
    await fs.writeFile(destination, data);
  }
}

export async function replaceDirectory(directory, entries) {
  unique(entries);
  await fs.rm(directory, {recursive: true, force: true});
  await writeEntries(directory, entries);
}

export async function copyEntries(directory, accept = () => true) {
  return Promise.all((await files(directory)).filter(accept).map(async name => [name, await fs.readFile(path.join(directory, name))]));
}
