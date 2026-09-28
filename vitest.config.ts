import { defineConfig } from 'vitest/config';

/** Any stage's real-Chromium files share one scheduling lane; see the sequencing note below. */
const browser = ['tests/stage*.browser-*.test.ts'];

/**
 * The six Chromium files drive a real browser engine; the other files hammer real Git. Measured on
 * this host, sharing one scheduling window is what makes the suite flaky: a Chromium case that takes
 * 2 s alone reports 68 s, and a file queued behind the browser slot parks a worker a real-Git suite
 * needs. Sequencing the projects instead of raising timeouts removes the collision: the browser
 * project starts only once the source project is finished.
 */
export default defineConfig({
  test: {
    environment: 'node',
    reporters: ['default'],
    projects: [
      {
        extends: true,
        test: {
          name: 'source',
          include: ['tests/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', ...browser],
          sequence: { groupOrder: 1 },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: browser,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
