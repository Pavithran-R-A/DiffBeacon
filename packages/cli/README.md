# DiffBeacon CLI

The CLI reviews a Git range using the shared local core. It uses argument-vector Git execution with external diff and text-conversion hooks disabled. It does not execute repository scripts, install repository dependencies, run tests, or upload source code.

```bash
npx diffbeacon review main...HEAD
git diff main...HEAD | npx diffbeacon review --stdin --format markdown
```
