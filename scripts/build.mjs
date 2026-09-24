import { runTrustedNpm } from './npm-cli.mjs';

const commands = [['build:core'], ['build:cli'], ['build:action'], ['build:web']];

for (const script of commands) {
  runTrustedNpm(['run', script], { stdio: 'inherit' });
}
