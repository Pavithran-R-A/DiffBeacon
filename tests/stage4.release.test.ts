import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ATTENTION_LEVELS,
  EVIDENCE_KINDS,
  FILE_STATUSES,
  SCHEMA_VERSION,
  SURFACE_IDS,
  analyzeDiff,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';

type SchemaProperty = { enum?: unknown[]; items?: SchemaProperty };
type SchemaDefinition = {
  additionalProperties?: boolean;
  properties: Record<string, SchemaProperty>;
};
type SchemaDocument = {
  $id: string;
  additionalProperties: boolean;
  $defs: Record<string, SchemaDefinition>;
};
type PackageManifest = {
  private?: boolean;
  version?: string;
  engines?: { node?: string };
  scripts?: Record<string, string>;
};

function json<T>(pathname: string): T {
  return JSON.parse(readFileSync(pathname, 'utf8')) as T;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const pathname = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(pathname) : [pathname];
  });
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

describe('Stage 4 release invariants', () => {
  it('keeps the core source free of Node-only runtime facilities', () => {
    const forbidden = [
      /from\s+['"]node:/,
      /require\s*\(\s*['"]node:/,
      /\bprocess\.(env|stdout|stdin)\b/,
      /\b(child_process|filesystem|window|document)\b/,
      /\bfrom\s+['"](?:fs|path|os|url|stream)['"]/,
    ];
    for (const file of sourceFiles('packages/core/src')) {
      const source = withoutComments(readFileSync(file, 'utf8'));
      for (const pattern of forbidden) expect(source, file).not.toMatch(pattern);
    }
  });

  it('executes all core renderers without Node globals', () => {
    const report = analyzeDiff(
      'diff --git a/src/value.ts b/src/value.ts\n--- a/src/value.ts\n+++ b/src/value.ts\n@@ -1 +1 @@\n-old\n+new',
    );
    expect(() => renderJson(report)).not.toThrow();
    expect(() => renderMarkdown(report)).not.toThrow();
    expect(() => renderPretty(report, { color: false })).not.toThrow();
  });

  it('keeps schema enums and strict objects aligned with canonical runtime values', () => {
    const schema = json<SchemaDocument>('packages/core/schema/review-attention-map.schema.json');
    const file = schema.$defs.file!;
    const attention = schema.$defs.attention!;
    const evidence = schema.$defs.evidence!;
    const order = schema.$defs.order!;
    expect(schema.$id).toBe('urn:diffbeacon:schema:review-attention-map:v1');
    expect(schema.additionalProperties).toBe(false);
    expect(file.properties.status!.enum).toEqual([...FILE_STATUSES]);
    expect(file.properties.surfaces!.items!.enum).toEqual([...SURFACE_IDS]);
    expect(attention.properties.surface!.enum).toEqual([...SURFACE_IDS]);
    expect(attention.properties.level!.enum).toEqual([...ATTENTION_LEVELS]);
    expect(evidence.properties.kind!.enum).toEqual([...EVIDENCE_KINDS]);
    expect(order.properties.surface!.enum).toEqual([...SURFACE_IDS]);
    for (const name of ['file', 'attention', 'evidence', 'order'])
      expect(schema.$defs[name]!.additionalProperties).toBe(false);

    const report = analyzeDiff('');
    const serialized = JSON.parse(renderJson(report));
    expect(serialized.schemaVersion).toBe(SCHEMA_VERSION);
    expect(serialized.files).toEqual([]);
    expect(serialized.attention).toEqual([]);
    expect(serialized.evidence).toEqual([]);
    expect(serialized.reviewOrder).toEqual([]);
  });

  it('keeps executable CLI startup isolated from the reusable Git boundary', () => {
    const git = readFileSync('packages/cli/src/git.ts', 'utf8');
    const index = readFileSync('packages/cli/src/index.ts', 'utf8');
    const action = readFileSync('packages/action/src/index.ts', 'utf8');
    expect(git).toContain("from './revisions.js'");
    expect(git).not.toContain("from './index.js'");
    expect(index).toContain("from './revisions.js'");
    expect(action).toContain("from '../../cli/src/git.js'");
    expect(action).not.toContain("from '../../cli/src/index.js'");
  });

  it('keeps v0.1 publication intent explicit and version authority singular', () => {
    const root = json<PackageManifest>('package.json');
    const cli = json<PackageManifest>('packages/cli/package.json');
    const core = json<PackageManifest>('packages/core/package.json');
    const action = json<PackageManifest>('packages/action/package.json');
    expect(root.private).toBe(true);
    expect(core.private).toBe(true);
    expect(action.private).toBe(true);
    expect(cli.private).not.toBe(true);
    expect(cli.engines).toEqual({ node: '>=22' });
    expect(readFileSync('packages/cli/src/index.ts', 'utf8')).not.toContain("VERSION = '0.1.0'");
  });

  it('defaults development and preview to localhost-safe Vite behavior', () => {
    const packageJson = json<PackageManifest>('package.json');
    const vite = readFileSync('vite.config.ts', 'utf8');
    expect(packageJson.scripts!.dev).toBe('vite');
    expect(packageJson.scripts!.preview).toBe('vite preview');
    expect(vite).not.toContain('host: true');
    expect(vite).not.toContain('.manus.computer');
    expect(vite).not.toContain('allowedHosts: true');
  });
});
