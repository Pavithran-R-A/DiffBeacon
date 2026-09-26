import path from 'node:path';
import process from 'node:process';

/**
 * Read the restricted `action.yml` shape DiffBeacon ships, without a YAML dependency.
 *
 * The Action metadata is the contract a GitHub runner consumes, so the smoke test and the
 * test suite must launch whatever the metadata names rather than a path hardcoded beside it.
 * This reader deliberately understands only the subset used here: two levels of mappings with
 * scalar values. Anything richer — a `steps:` list, a nested block, a flow mapping — fails
 * loudly instead of being quietly ignored, so metadata can never gain an execution surface
 * that the checks never looked at.
 */
export function readActionMetadata(source) {
  const scalars = {};
  const blocks = {};
  let section = null;
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (indent !== 0 && indent !== 2)
      throw new Error(`action.yml uses unsupported indentation: ${line.trim()}`);
    if (indent === 2 && section === null)
      throw new Error(`action.yml nests a key under nothing: ${line.trim()}`);
    const key = /^([A-Za-z][A-Za-z0-9_-]*):(.*)$/.exec(line.trim());
    if (!key) throw new Error(`action.yml uses unsupported syntax: ${line.trim()}`);
    const value = scalar(key[2], key[1]);
    if (indent === 0) {
      if (key[1] in scalars || key[1] in blocks)
        throw new Error(`action.yml repeats a top-level key: ${key[1]}`);
      if (value === null) {
        section = key[1];
        blocks[section] = {};
      } else {
        section = null;
        scalars[key[1]] = value;
      }
      continue;
    }
    if (key[1] in blocks[section]) throw new Error(`action.yml repeats ${section}.${key[1]}`);
    if (value === null)
      throw new Error(`action.yml nests deeper than this reader supports: ${section}.${key[1]}`);
    blocks[section][key[1]] = value;
  }
  return { scalars, blocks };
}

function scalar(rest, key) {
  const value = rest.trim();
  if (value === '') return null;
  const quoted = /^"([^"]*)"$|^'([^']*)'$/.exec(value);
  if (quoted) return quoted[1] ?? quoted[2];
  if (
    value.startsWith('-') ||
    value.startsWith('{') ||
    value.startsWith('[') ||
    value.startsWith('"')
  )
    throw new Error(`action.yml uses a value form this reader does not support for ${key}`);
  return value;
}

/**
 * Resolve the JavaScript file the metadata tells a runner to execute, and refuse any
 * metadata that adds a lifecycle hook beside it. A `pre:` or `post:` entry is code the
 * repository ships running before the reviewed diff is even read, which Stage 6 does not
 * document or endorse.
 */
export function actionEntrypoint(metadata, repositoryRoot = process.cwd()) {
  const runs = metadata.blocks.runs;
  if (!runs) throw new Error('action.yml has no runs: block, so a runner has nothing to execute.');
  for (const key of Object.keys(runs))
    if (key === 'pre' || key === 'post' || key.startsWith('pre-') || key.startsWith('post-'))
      throw new Error(
        `action.yml declares runs.${key}, which runs code before or after the entrypoint.`,
      );
  if (runs.main === undefined)
    throw new Error('action.yml has no runs.main, so a runner has nothing to execute.');
  if (runs.using !== 'node24')
    throw new Error(
      `action.yml declares runs.using ${String(runs.using)}: the qualified bundle is a Node 24 action.`,
    );
  if (!/^packages\/action\/dist\/[\w./-]+\.js$/.test(runs.main))
    throw new Error(`action.yml runs.main is not a bundled action entrypoint: ${runs.main}`);
  return path.join(repositoryRoot, ...runs.main.split('/'));
}
