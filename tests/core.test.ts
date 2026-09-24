import { describe, expect, it } from 'vitest';
import {
  analyzeDiff,
  parseUnifiedDiff,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';

const fileDiff = (path: string, body: string) =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n${body}\n`;

describe('unified diff parser state machine', () => {
  it('parses ordinary modification, addition, deletion, and multiple files', () => {
    const input = `${fileDiff('src/a.ts', '-old\n+new')}
diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1 @@
+new
diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1 +0,0 @@
-old`;
    const parsed = parseUnifiedDiff(input);
    expect(parsed.files.map((file) => file.status)).toEqual(['modified', 'added', 'deleted']);
    expect(parsed.files.map((file) => [file.additions, file.deletions])).toEqual([
      [1, 1],
      [1, 0],
      [0, 1],
    ]);
  });

  it('treats metadata-looking SQL, YAML, Markdown, Lua, shell, and source lines as hunk content', () => {
    const input = `diff --git a/query.sql b/query.sql
--- a/query.sql
+++ b/query.sql
@@ -1,7 +1,7 @@
--- old comment
+++-- new comment
 select 1;
--- another
+++-- changed
diff --git a/config.yml b/config.yml
--- a/config.yml
+++ b/config.yml
@@ -1,2 +1,2 @@
---
+++++
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,2 +1,2 @@
---
+++++
diff --git a/script.lua b/script.lua
--- a/script.lua
+++ b/script.lua
@@ -1 +1 @@
---
+++--
diff --git a/run.sh b/run.sh
--- a/run.sh
+++ b/run.sh
@@ -1 +1 @@
---
+++++
diff --git a/src/value.ts b/src/value.ts
--- a/src/value.ts
+++ b/src/value.ts
@@ -1 +1 @@
-const value = 'diff --git a/not-a-file b/not-a-file';
+const value = 'index 123';`;
    const parsed = parseUnifiedDiff(input);
    expect(parsed.files).toHaveLength(6);
    expect(parsed.files.every((file) => file.oldPath === file.newPath)).toBe(true);
    expect(parsed.files.map((file) => [file.additions, file.deletions])).toEqual([
      [2, 2],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
  });

  it('handles CRLF, no-newline markers, empty, malformed, and truncated input', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/a.ts b/a.ts\r\n--- a/a.ts\r\n+++ b/a.ts\r\n@@ -1 +1 @@\r\n-old\r\n+new\r\n\\ No newline at end of file',
    );
    expect(parsed.files[0]?.additions).toBe(1);
    expect(parsed.files[0]?.deletions).toBe(1);
    expect(parseUnifiedDiff('').files).toEqual([]);
    expect(parseUnifiedDiff('diff --git malformed').diagnostics).toHaveLength(1);
    expect(parseUnifiedDiff('diff --git a/a.ts b/a.ts\n--- a/a.ts').files).toHaveLength(1);
  });

  it('handles rename-only, rename-with-content, mode-only, and deleted files', () => {
    const input = `diff --git a/old.txt b/new.txt
similarity index 100%
rename from old.txt
rename to new.txt
diff --git a/run.sh b/run.sh
old mode 100644
new mode 100755
diff --git a/changed.txt b/renamed.txt
similarity index 90%
rename from changed.txt
rename to renamed.txt
--- a/changed.txt
+++ b/renamed.txt
@@ -1 +1 @@
-old
+new
diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
--- a/deleted.ts
+++ /dev/null
@@ -1 +0,0 @@
-deleted`;
    const files = parseUnifiedDiff(input).files;
    expect(files.map((file) => file.status)).toEqual([
      'renamed',
      'mode-only',
      'renamed',
      'deleted',
    ]);
    expect(files[1]?.additions).toBeNull();
    expect(files[1]?.deletions).toBeNull();
    expect(files[1]?.modeOnly).toBe(true);
    expect(files[3]?.newPath).toBeNull();
  });

  it('keeps binary state orthogonal for added, deleted, modified, and renamed binaries', () => {
    const input = `diff --git a/changed.bin b/changed.bin
index 0000000..1111111
Binary files a/changed.bin and b/changed.bin differ
diff --git a/new.bin b/new.bin
new file mode 100644
Binary files /dev/null and b/new.bin differ
diff --git a/old.bin b/old.bin
deleted file mode 100644
Binary files a/old.bin and /dev/null differ
diff --git a/old-name.bin b/new-name.bin
similarity index 100%
rename from old-name.bin
rename to new-name.bin
Binary files a/old-name.bin and b/new-name.bin differ`;
    const files = parseUnifiedDiff(input).files;
    expect(files.map((file) => [file.status, file.binary, file.additions, file.deletions])).toEqual(
      [
        ['modified', true, null, null],
        ['added', true, null, null],
        ['deleted', true, null, null],
        ['renamed', true, null, null],
      ],
    );
  });

  it('parses spaces, literal b/ substrings, quoted paths, and Git octal UTF-8 paths', () => {
    const input = `diff --git a/dir b/image.bin b/dir b/image.bin
Binary files a/dir b/image.bin and b/dir b/image.bin differ
diff --git "a/space file.ts" "b/space file.ts"
--- "a/space file.ts"
+++ "b/space file.ts"
@@ -1 +1 @@
-old
+new
diff --git "a/unicod\\303\\251-\\346\\226\\207\\344\\273\\266.ts" "b/unicod\\303\\251-\\346\\226\\207\\344\\273\\266.ts"
--- "a/unicod\\303\\251-\\346\\226\\207\\344\\273\\266.ts"
+++ "b/unicod\\303\\251-\\346\\226\\207\\344\\273\\266.ts"
@@ -1 +1 @@
-old
+new`;
    const files = parseUnifiedDiff(input).files;
    expect(files[0]?.displayPath).toBe('dir b/image.bin');
    expect(files[0]?.oldPath).toBe('dir b/image.bin');
    expect(files[1]?.displayPath).toBe('space file.ts');
    expect(files[2]?.displayPath).toBe('unicodé-文件.ts');
  });
});

describe('detectors and evidence', () => {
  it('detects Rails and Drizzle migrations while avoiding broad schema false positives', () => {
    const report = analyzeDiff(
      `${fileDiff('db/migrate/001_add_users.rb', '-old\n+new')}
${fileDiff('drizzle/0001_users.sql', '-old\n+new')}
${fileDiff('src/schemas/form.ts', '-old\n+new')}
${fileDiff('authentic.ts', '-old\n+new')}
${fileDiff('contest.ts', '-old\n+new')}
${fileDiff('docker-notes.md', '-old\n+new')}
${fileDiff('docs/permission-model.md', '-old\n+new')}`,
    );
    const rails = report.files.find((file) => file.displayPath.includes('db/migrate'));
    const drizzle = report.files.find((file) => file.displayPath.startsWith('drizzle/'));
    const internalSchema = report.files.find((file) => file.displayPath.includes('src/schemas'));
    expect(rails?.surfaces).toContain('database-schema');
    expect(drizzle?.surfaces).toContain('database-schema');
    expect(internalSchema?.surfaces).not.toContain('api-contracts');
  });

  it('keeps evidence neutral and suppresses pure mode-only test relationships', () => {
    const report = analyzeDiff(`diff --git a/run.sh b/run.sh\nold mode 100644\nnew mode 100755\n`);
    expect(report.evidence).toEqual([]);
    expect(report.files[0]?.additions).toBeNull();
    expect(report.files[0]?.deletions).toBeNull();
    expect(renderJson(report)).not.toMatch(/risk|safety|confidence|safe to merge|percent/i);
  });

  it('uses deterministic ordering and reports each relationship with observed language', () => {
    const report = analyzeDiff(
      `${fileDiff('src/auth/session.ts', '-old\n+new')}
${fileDiff('package.json', '-old\n+new')}
${fileDiff('openapi.yaml', '-old\n+new')}`,
    );
    expect(report.evidence.map((item) => item.kind)).toEqual([
      'runtime-without-tests',
      'auth-without-tests',
      'manifest-without-lockfile',
      'contract-without-docs',
    ]);
    expect(report.evidence.every((item) => /observed/i.test(item.message))).toBe(true);
    const repeated = analyzeDiff(
      `${fileDiff('src/auth/session.ts', '-old\n+new')}
${fileDiff('package.json', '-old\n+new')}
${fileDiff('openapi.yaml', '-old\n+new')}`,
    );
    expect(renderJson(report)).toBe(renderJson(repeated));
  });
});

describe('safe renderers', () => {
  it('renders hostile filenames as inert code and never active Markdown/HTML', () => {
    const hostile =
      '![ATTENTION](https://example.com/fake.png) # FAKE <details> | injected | `code`';
    const report = analyzeDiff(fileDiff(`${hostile}.ts`, '-old\n+new'));
    const markdown = renderMarkdown(report);
    const pretty = renderPretty(report);
    expect(markdown).toContain('`![ATTENTION]');
    expect(markdown).not.toMatch(/(^|[^`])!\[ATTENTION\]\(/);
    expect(markdown).not.toMatch(/(^|\n)<details>/);
    expect(markdown).toMatch(/^\| modified \| `.*` \| 1 \| 1 \| runtime \|$/m);
    expect(pretty).not.toContain('\u001b');
  });

  it('keeps JSON byte-stable and represents nullable line counts honestly', () => {
    const report = analyzeDiff(
      `diff --git a/image.png b/image.png\nBinary files a/image.png and b/image.png differ`,
    );
    expect(renderJson(report)).toBe(renderJson(report));
    expect(JSON.parse(renderJson(report)).files[0].status).toBe('modified');
    expect(JSON.parse(renderJson(report)).files[0].binary).toBe(true);
  });
});
