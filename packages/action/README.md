# DiffBeacon GitHub Action

The Action analyzes a pull-request diff and writes a job summary. It is read-only, needs no PAT, does not post comments, does not run PR code, and does not require a network API.

```yaml
name: DiffBeacon
on:
  pull_request:
permissions:
  contents: read
jobs:
  attention:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: Pavithran-R-A/diffbeacon@v1
```

The workflow must fetch the base and head commits. DiffBeacon only reads Git data and the trusted pull-request event metadata; it does not execute anything introduced by the pull request.
