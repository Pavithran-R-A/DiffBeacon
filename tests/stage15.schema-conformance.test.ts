import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeDiff, renderJson } from '../packages/core/src/index.js';
import { MIXED_UNICODE_PATHS, OBJECT_SHAPE_PATHS, diffForPaths } from './stage8.hostile-corpus.js';

/**
 * Stage 15: validate runtime reports against the committed JSON Schema without adding a
 * second schema library to the release toolchain. This validator deliberately supports only
 * the keywords this schema uses, and the first test fails if the schema grows a keyword the
 * harness does not understand.
 */

type Schema = {
  $ref?: string;
  $schema?: string;
  $id?: string;
  $defs?: Record<string, Schema>;
  title?: string;
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean | Schema;
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
};

const rootSchema = JSON.parse(
  readFileSync('packages/core/schema/review-attention-map.schema.json', 'utf8'),
) as Schema;

const supportedKeywords = new Set([
  '$ref',
  '$schema',
  '$id',
  '$defs',
  'title',
  'type',
  'const',
  'enum',
  'minimum',
  'maximum',
  'additionalProperties',
  'required',
  'properties',
  'items',
]);

function schemaNodes(schema: Schema, path = '$'): Array<[string, Schema]> {
  const nodes: Array<[string, Schema]> = [[path, schema]];
  for (const [name, child] of Object.entries(schema.$defs ?? {}))
    nodes.push(...schemaNodes(child, `${path}.$defs.${name}`));
  for (const [name, child] of Object.entries(schema.properties ?? {}))
    nodes.push(...schemaNodes(child, `${path}.properties.${name}`));
  if (schema.items) nodes.push(...schemaNodes(schema.items, `${path}.items`));
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties === 'object')
    nodes.push(...schemaNodes(schema.additionalProperties, `${path}.additionalProperties`));
  return nodes;
}

function resolveReference(reference: string): Schema {
  if (!reference.startsWith('#/')) throw new Error(`Unsupported schema reference: ${reference}`);
  let current: unknown = rootSchema;
  for (const raw of reference.slice(2).split('/')) {
    const segment = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (current === null || typeof current !== 'object' || !(segment in current))
      throw new Error(`Unresolvable schema reference: ${reference}`);
    current = (current as Record<string, unknown>)[segment];
  }
  return current as Schema;
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    default:
      throw new Error(`Unsupported schema type: ${type}`);
  }
}

function validate(value: unknown, schema: Schema, path = '$'): string[] {
  if (schema.$ref) return validate(value, resolveReference(schema.$ref), path);

  const errors: string[] = [];
  if (schema.const !== undefined && !Object.is(value, schema.const))
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((candidate) => Object.is(value, candidate)))
    errors.push(`${path}: value is outside enum`);

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${path}: expected type ${types.join('|')}`);
      return errors;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${path}: ${value} is below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${path}: ${value} is above maximum ${schema.maximum}`);
  }

  if (Array.isArray(value) && schema.items)
    value.forEach((item, index) =>
      errors.push(...validate(item, schema.items as Schema, `${path}[${index}]`)),
    );

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    for (const required of schema.required ?? [])
      if (!Object.prototype.hasOwnProperty.call(object, required))
        errors.push(`${path}: missing required property ${required}`);

    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object))
        if (!(key in properties)) errors.push(`${path}: unexpected property ${key}`);
    }

    for (const [key, child] of Object.entries(properties))
      if (Object.prototype.hasOwnProperty.call(object, key))
        errors.push(...validate(object[key], child, `${path}.${key}`));

    if (
      schema.additionalProperties !== undefined &&
      typeof schema.additionalProperties === 'object'
    ) {
      for (const [key, item] of Object.entries(object))
        if (!(key in properties))
          errors.push(...validate(item, schema.additionalProperties, `${path}.${key}`));
    }
  }

  return errors;
}

const ordinary = [
  'diff --git a/src/auth/session.ts b/src/auth/session.ts',
  '--- a/src/auth/session.ts',
  '+++ b/src/auth/session.ts',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  '',
].join('\n');

const binary = [
  'diff --git a/assets/logo.bin b/assets/logo.bin',
  'Binary files a/assets/logo.bin and b/assets/logo.bin differ',
  '',
].join('\n');

const modeOnly = [
  'diff --git a/src/app.ts b/src/app.ts',
  'old mode 100644',
  'new mode 100755',
  '',
].join('\n');

const generatedVolume = [
  'diff --git a/dist/a.js b/dist/a.js',
  '--- a/dist/a.js',
  '+++ b/dist/a.js',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  'diff --git a/dist/b.js b/dist/b.js',
  '--- a/dist/b.js',
  '+++ b/dist/b.js',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  'diff --git a/src/app.ts b/src/app.ts',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  '',
].join('\n');

const malformedSimilarity = [
  'diff --git a/src/old.ts b/src/new.ts',
  'similarity index 101%',
  'rename from src/old.ts',
  'rename to src/new.ts',
  '',
].join('\n');

describe('runtime JSON conforms to the committed schema', () => {
  it('fails closed if the schema gains a validation keyword this harness does not implement', () => {
    for (const [path, node] of schemaNodes(rootSchema))
      for (const key of Object.keys(node))
        expect(supportedKeywords.has(key), `${path}: unsupported schema keyword ${key}`).toBe(true);
  });

  it('validates representative normal, hostile, nullable and malformed reports', () => {
    const reports = [
      analyzeDiff(''),
      analyzeDiff(ordinary),
      analyzeDiff(binary),
      analyzeDiff(modeOnly),
      analyzeDiff(generatedVolume),
      analyzeDiff(malformedSimilarity),
      analyzeDiff(
        diffForPaths([...OBJECT_SHAPE_PATHS.slice(0, 8), ...MIXED_UNICODE_PATHS.slice(0, 8)]),
      ),
    ];

    for (const report of reports) {
      const serialized = JSON.parse(renderJson(report)) as unknown;
      expect(validate(serialized, rootSchema), JSON.stringify(serialized, null, 2)).toEqual([]);
    }
  });

  it('keeps malformed similarity metadata out of the bounded schema field', () => {
    const report = analyzeDiff(malformedSimilarity);
    expect(report.files[0]?.similarity).toBeNull();
    expect(report.summary.diagnostics).toBeGreaterThan(0);
    expect(validate(report, rootSchema)).toEqual([]);
  });

  it('validates optional evidence metrics when runtime output actually contains them', () => {
    const report = analyzeDiff(generatedVolume);
    const observation = report.evidence.find((item) => item.kind === 'generated-volume');
    expect(observation?.metrics).toMatchObject({
      generatedFiles: 2,
      changedFiles: 3,
      generatedFileShare: 2 / 3,
      generatedChangedLines: 4,
      totalChangedLines: 6,
      generatedLineShare: 4 / 6,
    });
    expect(validate(report, rootSchema)).toEqual([]);
  });
});
