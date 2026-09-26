import { StringDecoder } from 'node:string_decoder';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_DIFF_BYTES } from '../packages/core/src/model.js';
import { DiffSizeLimitError, main, readStdinDiff } from '../packages/cli/src/index.js';

// Stage 5 qualifies stdin as a byte stream, not a text stream. Git emits UTF-8
// bytes and a pipe chooses its own chunk boundaries, so a multi-byte sequence can
// be split across chunks. Decoding per chunk replaces each split half with U+FFFD,
// which corrupts the diff and makes the size limit depend on where the pipe cut.

function slices(buffer: Buffer, size: number): Buffer[] {
  const pieces: Buffer[] = [];
  for (let index = 0; index < buffer.length; index += size)
    pieces.push(buffer.subarray(index, Math.min(index + size, buffer.length)));
  return pieces;
}

async function* stream(...chunks: Buffer[]): AsyncGenerator<Buffer> {
  for (const chunk of chunks) yield chunk;
}

describe('stdin decodes one UTF-8 stream regardless of chunk boundaries', () => {
  it('returns the text unchanged when the whole diff arrives in one chunk', async () => {
    const diff = 'diff --git a/unicodé-文件.ts b/unicodé-文件.ts\n+const x = "héllo wörld" ✨\n';
    expect(await readStdinDiff(stream(Buffer.from(diff, 'utf8')))).toBe(diff);
  });

  it('reassembles multi-byte sequences split across chunks', async () => {
    const diff = 'diff --git a/unicodé-文件.ts b/unicodé-文件.ts\n+const é = "wörld ✨";\n';
    const bytes = Buffer.from(diff, 'utf8');
    for (const size of [1, 2, 3, 7, 11]) {
      const received = await readStdinDiff(stream(...slices(bytes, size)));
      expect(received, `${size}-byte chunks`).toBe(diff);
      expect(received, `${size}-byte chunks`).not.toContain('\uFFFD');
    }
  });

  it('matches the unsplit read for a hunk cut every five bytes', async () => {
    const diff = `diff --git a/ü.ts b/ü.ts\n${Array.from({ length: 400 }, (_, index) => `+const ünicode = ${index};\n`).join('')}`;
    const bytes = Buffer.from(diff, 'utf8');
    const whole = await readStdinDiff(stream(bytes));
    const split = await readStdinDiff(stream(...slices(bytes, 5)));
    expect(whole).toBe(diff);
    expect(split).toBe(whole);
  });

  it('flushes a trailing incomplete sequence once instead of dropping it', async () => {
    const partial = Buffer.from([0xc3]);
    const decoder = new StringDecoder('utf8');
    const expected = `${decoder.write(partial)}${decoder.end()}`;
    expect(await readStdinDiff(stream(partial))).toBe(expected);
  });
});

describe('stdin size bound counts input bytes, not chunk boundaries', () => {
  it('takes the limit exactly in two-byte text whose chunk cuts land mid-sequence', async () => {
    const payload = Buffer.from('é'.repeat(MAX_DIFF_BYTES / 2), 'utf8');
    expect(payload.length).toBe(MAX_DIFF_BYTES);
    // An odd slice length forces most chunk boundaries into the middle of a
    // sequence, so a per-chunk decoder invents extra bytes and rejects this.
    const received = await readStdinDiff(stream(...slices(payload, 1_048_575)));
    expect(received).toBe('é'.repeat(MAX_DIFF_BYTES / 2));
    expect(received).not.toContain('\uFFFD');
  });

  it('rejects one byte over the limit', async () => {
    const over = Buffer.concat([Buffer.alloc(MAX_DIFF_BYTES, 0x61), Buffer.from([0x61])]);
    await expect(readStdinDiff(stream(over))).rejects.toBeInstanceOf(DiffSizeLimitError);
  });

  it('stops reading as soon as the limit is exceeded', async () => {
    let pulled = 0;
    const chunk = Buffer.alloc(1024 * 1024, 0x61);
    async function* endless(): AsyncGenerator<Buffer> {
      for (;;) {
        pulled += 1;
        yield chunk;
      }
    }
    await expect(readStdinDiff(endless())).rejects.toBeInstanceOf(DiffSizeLimitError);
    // Eight chunks reach the limit exactly; the ninth crosses it and stops the read.
    expect(pulled).toBe(9);
  });
});

describe('an empty stdin is a report of nothing rather than a failure', () => {
  const undo: (() => void)[] = [];

  afterEach(() => {
    for (const restore of undo.splice(0)) restore();
  });

  /** Drive the shipped `main()` with an empty pipe, as `: | diffbeacon review --stdin` does. */
  async function reviewEmptyStdin(args: string[]) {
    const previous = process.stdin;
    let stdout = '';
    let stderr = '';
    const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    const err = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
    Object.defineProperty(process, 'stdin', {
      value: stream(),
      configurable: true,
      writable: true,
    });
    undo.push(() => {
      Object.defineProperty(process, 'stdin', {
        value: previous,
        configurable: true,
        writable: true,
      });
      out.mockRestore();
      err.mockRestore();
    });
    return { code: await main(args), stdout, stderr };
  }

  it('reads zero bytes as an empty diff instead of raising', async () => {
    expect(await readStdinDiff(stream())).toBe('');
  });

  it('reports zero changed files with exit 0 for an empty pipe', async () => {
    const result = await reviewEmptyStdin(['review', '--stdin', '--format', 'json']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout).summary.changedFiles).toBe(0);
  });
});
