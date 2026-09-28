// packages/action/src/index.ts
import { appendFileSync, readFileSync, statSync } from "node:fs";
import process3 from "node:process";

// packages/core/src/model.ts
var MAX_DIFF_BYTES = 8 * 1024 * 1024;
var UNKNOWN_PATH_SENTINEL = "<unknown path>";

// packages/core/src/parser.ts
var NULL_PATH = "/dev/null";
function exceedsDiffLimit(value) {
  if (value.length > MAX_DIFF_BYTES) return true;
  if (value.length * 3 <= MAX_DIFF_BYTES) return false;
  return new TextEncoder().encode(value).length > MAX_DIFF_BYTES;
}
function decodeGitQuoted(value) {
  const trimmed = value.trim();
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed;
  const inner = trimmed.slice(1, -1);
  const bytes = [];
  const encoder = new TextEncoder();
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index] ?? "";
    if (character !== "\\") {
      bytes.push(...encoder.encode(character));
      continue;
    }
    const octal = inner.slice(index + 1, index + 4);
    if (/^[0-7]{3}$/.test(octal)) {
      bytes.push(Number.parseInt(octal, 8));
      index += 3;
      continue;
    }
    const next = inner[index + 1] ?? "";
    const escapes = {
      "\\": 92,
      '"': 34,
      a: 7,
      b: 8,
      f: 12,
      n: 10,
      r: 13,
      t: 9,
      v: 11
    };
    if (escapes[next] !== void 0) {
      bytes.push(escapes[next]);
      index += 1;
      continue;
    }
    bytes.push(...encoder.encode("\\"));
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}
function stripDiffPrefix(value) {
  const withoutTimestamp = value.split("	", 1)[0] ?? value;
  const path = decodeGitQuoted(withoutTimestamp.trim());
  if (path === NULL_PATH) return null;
  if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
  return path;
}
function parseQuotedPair(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"')) return null;
  const tokens = [];
  let cursor = 0;
  while (cursor < trimmed.length && tokens.length < 2) {
    while (trimmed[cursor] === " ") cursor += 1;
    if (trimmed[cursor] !== '"') return null;
    const start = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < trimmed.length) {
      const character = trimmed[cursor] ?? "";
      if (!escaped && character === '"') {
        cursor += 1;
        break;
      }
      escaped = !escaped && character === "\\";
      if (character !== "\\") escaped = false;
      cursor += 1;
    }
    tokens.push(trimmed.slice(start, cursor));
  }
  if (tokens.length !== 2) return null;
  const oldPath = stripDiffPrefix(tokens[0]);
  const newPath = stripDiffPrefix(tokens[1]);
  return oldPath === "" || newPath === "" ? null : [oldPath, newPath];
}
function parseGitPair(value) {
  const trimmed = value.trim();
  const quoted = parseQuotedPair(trimmed);
  if (quoted !== null)
    return {
      reason: "proven",
      pair: { oldPath: quoted[0], newPath: quoted[1] }
    };
  return resolvePair(trimmed, " b/", 2);
}
function parseBinaryPair(value) {
  return resolvePair(value.trim().replace(/ differ$/, ""), " and ", 0);
}
var isOldSide = (value) => value === NULL_PATH || value.startsWith("a/");
var isNewSide = (value) => value === NULL_PATH || value.startsWith("b/");
var isGitHeader = (line) => line.startsWith("diff --git ") || line.trimEnd() === "diff --git";
function resolvePair(value, marker, keep) {
  const accepted = [];
  let offset = 0;
  while (offset < value.length) {
    const index = value.indexOf(marker, offset);
    if (index < 0) break;
    const left = value.slice(0, index);
    const right = value.slice(index + marker.length - keep);
    if (isOldSide(left) && isNewSide(right)) {
      const oldPath = stripDiffPrefix(left);
      const newPath = stripDiffPrefix(right);
      if (oldPath !== "" && newPath !== "") accepted.push({ oldPath, newPath });
    }
    offset = index + 1;
  }
  if (accepted.length === 0) return { reason: "unprovable", pair: null };
  if (accepted.length === 1) return { reason: "proven", pair: accepted[0] };
  const agreeing = accepted.filter(
    (candidate) => candidate.oldPath === candidate.newPath && candidate.oldPath !== null
  );
  const distinct = new Set(agreeing.map((candidate) => candidate.oldPath));
  return distinct.size === 1 ? { reason: "proven", pair: agreeing[0] } : { reason: "ambiguous", pair: null };
}
function parseHunkHeader(line) {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (match === null) return null;
  return {
    oldCount: Number.parseInt(match[2] ?? "1", 10),
    newCount: Number.parseInt(match[4] ?? "1", 10)
  };
}
function inferStatus(file) {
  if (file.isNewFile) return "added";
  if (file.isDeletedFile) return "deleted";
  if (file.isCopy) return "added";
  if (file.oldPath === null && file.newPath !== null) return "added";
  if (file.newPath === null && file.oldPath !== null) return "deleted";
  if (file.renameFrom !== null || file.renameTo !== null || file.similarity !== null)
    return "renamed";
  if (file.hunks.length === 0 && !file.binary && file.oldMode !== null && file.newMode !== null)
    return "mode-only";
  return "modified";
}
function finalize(current) {
  const status = inferStatus(current);
  const modeOnly = status === "mode-only";
  const additions = current.binary || modeOnly ? null : current.hunks.reduce((sum, hunk) => sum + hunk.additions, 0);
  const deletions = current.binary || modeOnly ? null : current.hunks.reduce((sum, hunk) => sum + hunk.deletions, 0);
  const oldPath = current.isNewFile || current.isCopy ? null : current.renameFrom ?? current.oldPath;
  const newPath = current.isDeletedFile ? null : current.renameTo ?? current.copyTo ?? current.newPath;
  return {
    oldPath,
    newPath,
    displayPath: newPath ?? oldPath ?? UNKNOWN_PATH_SENTINEL,
    status,
    additions,
    deletions,
    binary: current.binary,
    modeOnly,
    oldMode: current.oldMode,
    newMode: current.newMode,
    similarity: current.similarity,
    surfaces: [],
    generated: false
  };
}
function openHunk(current, line, lineNumber, counts) {
  const hunk = { header: line, additions: 0, deletions: 0 };
  current.hunks.push(hunk);
  current.activeHunk = {
    hunk,
    headerLine: lineNumber,
    declaredOld: counts.oldCount,
    declaredNew: counts.newCount,
    seenOld: 0,
    seenNew: 0
  };
}
function closeHunk(current, diagnostics) {
  const account = current.activeHunk;
  if (account === null) return;
  if (account.seenOld < account.declaredOld || account.seenNew < account.declaredNew) {
    diagnostics.push({
      code: "truncated-hunk",
      message: `Hunk declared ${account.declaredOld} old and ${account.declaredNew} new lines but only ${account.seenOld} and ${account.seenNew} arrived.`,
      line: account.headerLine
    });
  } else if (account.seenOld > account.declaredOld || account.seenNew > account.declaredNew) {
    diagnostics.push({
      code: "hunk-count-mismatch",
      message: `Hunk body exceeded its declared ${account.declaredOld} old and ${account.declaredNew} new lines with ${account.seenOld} and ${account.seenNew}.`,
      line: account.headerLine
    });
  }
  current.activeHunk = null;
}
var NO_NEWLINE_MARKER = "\\ No newline at end of file";
function consumeHunkLine(line, account) {
  if (line === NO_NEWLINE_MARKER) return;
  if (line.startsWith("+")) {
    account.hunk.additions += 1;
    account.seenNew += 1;
  } else if (line.startsWith("-")) {
    account.hunk.deletions += 1;
    account.seenOld += 1;
  } else if (line.startsWith(" ")) {
    account.seenOld += 1;
    account.seenNew += 1;
  }
}
function isBodyLine(line) {
  return line.startsWith(" ") || line.startsWith("+") || line.startsWith("-") || line === NO_NEWLINE_MARKER || line === "";
}
function hasSatisfiedCounts(account) {
  return account.seenOld === account.declaredOld && account.seenNew === account.declaredNew;
}
function parseUnifiedDiff(input) {
  if (exceedsDiffLimit(input))
    return {
      files: [],
      diagnostics: [
        {
          code: "input-too-large",
          message: `Input is larger than the ${MAX_DIFF_BYTES} byte analysis limit, so nothing was parsed.`,
          line: 1
        }
      ]
    };
  const lines = input.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const files = [];
  const diagnostics = [];
  let current = null;
  let skippingDialect = false;
  const flush = () => {
    if (current !== null) {
      closeHunk(current, diagnostics);
      files.push(finalize(current));
    }
    current = null;
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;
    if (isGitHeader(line)) {
      flush();
      skippingDialect = false;
      const resolution = parseGitPair(line.slice("diff --git".length));
      current = {
        oldPath: resolution.pair?.oldPath ?? null,
        newPath: resolution.pair?.newPath ?? null,
        oldMode: null,
        newMode: null,
        similarity: null,
        binary: false,
        hunks: [],
        renameFrom: null,
        renameTo: null,
        isNewFile: false,
        isDeletedFile: false,
        isCopy: false,
        copyTo: null,
        activeHunk: null
      };
      if (resolution.reason === "ambiguous")
        diagnostics.push({
          code: "ambiguous-path",
          message: "Could not prove which paths the diff --git header names.",
          line: lineNumber
        });
      else if (resolution.reason === "unprovable")
        diagnostics.push({
          code: "malformed-header",
          message: "Could not parse diff --git paths.",
          line: lineNumber
        });
      continue;
    }
    if (line.startsWith("diff --cc ") || line.startsWith("diff --combined ")) {
      flush();
      skippingDialect = true;
      diagnostics.push({
        code: "unsupported-dialect",
        message: "Combined merge diffs are outside the supported patch vector.",
        line: lineNumber
      });
      continue;
    }
    if (skippingDialect) continue;
    if (current === null) {
      if (line.startsWith("@@ "))
        diagnostics.push({
          code: "unrecognized-hunk-header",
          message: "Hunk header appeared without diff --git.",
          line: lineNumber
        });
      else if (line.startsWith("--- ") || line.startsWith("+++ "))
        diagnostics.push({
          code: "unrecognized-file-header",
          message: "File header appeared without diff --git.",
          line: lineNumber
        });
      continue;
    }
    const active = current.activeHunk;
    if (active !== null) {
      const counts = line.startsWith("@@ ") ? parseHunkHeader(line) : null;
      if (counts !== null) {
        closeHunk(current, diagnostics);
        openHunk(current, line, lineNumber, counts);
        continue;
      }
      if (!isBodyLine(line) && hasSatisfiedCounts(active)) {
        diagnostics.push({
          code: "malformed-hunk",
          message: "Line after a completed hunk is neither hunk content nor a known header.",
          line: lineNumber
        });
        closeHunk(current, diagnostics);
        continue;
      }
      if (line.startsWith("@@ ")) {
        diagnostics.push({
          code: "malformed-hunk",
          message: "Hunk-header line inside a hunk body could not be read as a header.",
          line: lineNumber
        });
      }
      consumeHunkLine(line, active);
      continue;
    }
    if (line.startsWith("new file mode ")) {
      current.isNewFile = true;
      current.oldMode = null;
      current.newMode = line.slice("new file mode ".length).trim();
    } else if (line.startsWith("deleted file mode ")) {
      current.isDeletedFile = true;
      current.oldMode = line.slice("deleted file mode ".length).trim();
      current.newMode = null;
    } else if (line.startsWith("old mode "))
      current.oldMode = line.slice("old mode ".length).trim();
    else if (line.startsWith("new mode ")) current.newMode = line.slice("new mode ".length).trim();
    else if (line.startsWith("similarity index ")) {
      const value = Number.parseInt(line.slice("similarity index ".length), 10);
      current.similarity = Number.isFinite(value) ? value : null;
    } else if (line.startsWith("rename from "))
      current.renameFrom = decodeGitQuoted(line.slice("rename from ".length));
    else if (line.startsWith("rename to "))
      current.renameTo = decodeGitQuoted(line.slice("rename to ".length));
    else if (line.startsWith("copy from ") || line.startsWith("copy to ")) {
      if (!current.isCopy) {
        current.isCopy = true;
        diagnostics.push({
          code: "unsupported-dialect",
          message: "Copy detection is outside the supported patch vector.",
          line: lineNumber
        });
      }
      if (line.startsWith("copy to "))
        current.copyTo = decodeGitQuoted(line.slice("copy to ".length));
    } else if (line.startsWith("Binary files ")) {
      current.binary = true;
      const resolution = parseBinaryPair(line.slice("Binary files ".length));
      if (resolution.reason === "proven" && resolution.pair !== null) {
        current.oldPath = resolution.pair.oldPath;
        current.newPath = resolution.pair.newPath;
      } else
        diagnostics.push({
          code: "ambiguous-path",
          message: "Could not prove which paths the Binary files line names.",
          line: lineNumber
        });
    } else if (line === "GIT binary patch") current.binary = true;
    else if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      const path = stripDiffPrefix(line.slice(4));
      if (path === "")
        diagnostics.push({
          code: "malformed-header",
          message: "File header named no path.",
          line: lineNumber
        });
      else if (line.startsWith("--- ")) current.oldPath = path;
      else current.newPath = path;
    } else if (line.startsWith("@@ ")) {
      const counts = parseHunkHeader(line);
      if (counts === null)
        diagnostics.push({
          code: "malformed-hunk",
          message: "Could not parse hunk line counts.",
          line: lineNumber
        });
      else openHunk(current, line, lineNumber, counts);
    }
  }
  flush();
  return { files, diagnostics };
}

// packages/core/src/detectors/shared.ts
function normalizedPath(path) {
  return path.replaceAll("\\", "/").toLowerCase();
}
function basename(path) {
  const normalized = path.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
}
function hasSegment(path, segment) {
  const normalized = normalizedPath(path);
  const needle = normalizedPath(segment).replace(/^\/+|\/+$/g, "");
  if (needle.includes("/")) {
    return normalized === needle || normalized.startsWith(`${needle}/`) || normalized.endsWith(`/${needle}`) || normalized.includes(`/${needle}/`);
  }
  return normalized.split("/").includes(needle);
}
function hasPathPrefix(path, prefix) {
  const normalized = normalizedPath(path).replace(/^\/+/, "");
  const needle = normalizedPath(prefix).replace(/^\/+|\/+$/g, "");
  return normalized === needle || normalized.startsWith(`${needle}/`);
}
function extension(path) {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot) : "";
}
function isDependencyManifest(path) {
  const name = basename(path);
  return (/* @__PURE__ */ new Set([
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "pipfile",
    "cargo.toml",
    "go.mod",
    "gemfile",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "composer.json"
  ])).has(name);
}
function isLockfile(path) {
  const name = basename(path);
  return (/* @__PURE__ */ new Set([
    "package-lock.json",
    "npm-shrinkwrap.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "pipfile.lock",
    "cargo.lock",
    "go.sum",
    "gemfile.lock",
    "composer.lock",
    "gradle.lockfile"
  ])).has(name);
}
function isConfigFilename(path) {
  const name = basename(path);
  return /^(\w+[-.])?config\.[^.]+$/.test(name) || name === "tsconfig.json" || name === ".env.example";
}
function isTestPath(path) {
  const normalized = normalizedPath(path);
  const name = basename(path);
  return ["test", "tests", "spec", "specs", "__tests__", "fixtures"].some(
    (segment) => hasSegment(normalized, segment)
  ) || /(^|[._-])(test|spec)([._-]|$)/.test(name) || name.endsWith("_test.go") || name.startsWith("test_");
}
function isDocumentationPath(path) {
  const name = basename(path);
  const normalized = normalizedPath(path);
  return hasSegment(normalized, "docs") || /^(readme|changelog|contributing|security|code_of_conduct)(\.|$)/.test(name) || name.startsWith("release-notes") || name.endsWith(".md") || name.endsWith(".mdx");
}
function isGeneratedPath(path) {
  const normalized = normalizedPath(path);
  const name = basename(path);
  if (isLockfile(path)) return false;
  return hasSegment(normalized, "dist") || // Only the repository-root `build/` output directory proves generated output. A
  // nested `build` segment is as often a hand-written module whose domain is
  // building, which would silently vanish from the runtime surface.
  normalized.startsWith("build/") || hasSegment(normalized, "generated") || name.endsWith(".generated.ts") || name.endsWith(".generated.js") || name.endsWith(".min.js") || name.endsWith(".map");
}

// packages/core/src/detectors/registry.ts
var codeExtensions = /* @__PURE__ */ new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".ex",
  ".exs",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".swift",
  ".ts",
  ".tsx"
]);
var detectors = [
  {
    id: "ci-build",
    title: "CI / Build",
    description: "Workflow, pipeline, or build-system files changed.",
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return normalized.startsWith(".github/workflows/") || normalized.startsWith(".github/actions/") || [
        "jenkinsfile",
        "buildkite.yml",
        "azure-pipelines.yml",
        "circle.yml",
        "makefile",
        "taskfile.yml"
      ].includes(name) || hasSegment(normalized, ".circleci");
    }
  },
  {
    id: "auth-access",
    title: "Authentication / Access",
    description: "Authentication, authorization, permissions, or access-control paths changed.",
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return hasSegment(normalized, "auth") || hasSegment(normalized, "authorization") || hasSegment(normalized, "permissions") || hasSegment(normalized, "rbac") || hasSegment(normalized, "acl") || hasSegment(normalized, "access-control") || /(^|[-_.])(auth|identity|session|permission|authorization)([-_.]|$)/.test(name);
    }
  },
  {
    id: "database-schema",
    title: "Database / Schema",
    description: "Schema definitions or migration conventions changed.",
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return hasSegment(normalized, "migrations") || hasSegment(normalized, "migration") || hasSegment(normalized, "alembic") || hasSegment(normalized, "prisma") || hasPathPrefix(normalized, "db/migrate") || hasPathPrefix(normalized, "drizzle") || hasPathPrefix(normalized, "db/drizzle") || name === "schema.prisma" || name === "schema.sql" || name.endsWith(".migration.sql");
    }
  },
  {
    id: "dependencies",
    title: "Dependencies",
    description: "Dependency manifests or lockfiles changed.",
    matches: (path) => isDependencyManifest(path) || isLockfile(path)
  },
  {
    id: "api-contracts",
    title: "API / Contracts",
    description: "Explicit API, GraphQL, protobuf, OpenAPI, or Swagger definitions changed.",
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return name === "openapi.yml" || name === "openapi.yaml" || name === "openapi.json" || name === "swagger.yml" || name === "swagger.yaml" || name === "swagger.json" || extension(path) === ".graphql" || extension(path) === ".gql" || extension(path) === ".proto" || hasSegment(normalized, "openapi") || hasPathPrefix(normalized, "api") && /(^|[-_.])(schema|contract)([-_.]|$)/.test(name);
    }
  },
  {
    id: "configuration",
    title: "Configuration",
    description: "Application, build, or tooling configuration changed.",
    matches: (path) => hasSegment(normalizedPath(path), "config") || isConfigFilename(path)
  },
  {
    id: "infrastructure",
    title: "Infrastructure / Deployment",
    description: "Container, infrastructure-as-code, orchestration, or deployment manifests changed.",
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return name === "dockerfile" || name.startsWith("dockerfile.") || name.startsWith("docker-compose") || extension(path) === ".tf" || extension(path) === ".tfvars" || hasSegment(normalized, "terraform") || hasSegment(normalized, "kubernetes") || hasSegment(normalized, "k8s") || hasSegment(normalized, "helm") || hasSegment(normalized, "deploy") || hasSegment(normalized, "manifests");
    }
  },
  {
    id: "tests",
    title: "Tests",
    description: "Test files or test fixtures changed.",
    matches: (path) => isTestPath(path)
  },
  {
    id: "documentation",
    title: "Documentation / Changelog",
    description: "Documentation, README, changelog, or release-note files changed.",
    matches: (path) => isDocumentationPath(path)
  },
  {
    id: "generated",
    title: "Generated Files",
    description: "Files matching conservative generated-output conventions changed.",
    matches: (path) => isGeneratedPath(path)
  },
  {
    id: "runtime",
    title: "Runtime Implementation",
    description: "Application or library implementation files changed.",
    matches: (path) => codeExtensions.has(extension(path)) && !isTestPath(path) && !isDocumentationPath(path) && !isGeneratedPath(path) && !isConfigFilename(path)
  }
];
function consideredPaths(file) {
  const paths = [file.oldPath, file.newPath];
  return paths.filter((path) => path !== null && path !== UNKNOWN_PATH_SENTINEL);
}
function matchesSurface(file, predicate) {
  return consideredPaths(file).some(predicate);
}
function classifyFile(file) {
  const paths = consideredPaths(file);
  const surfaces = detectors.filter((detector) => paths.some((path) => detector.matches(path))).map((detector) => detector.id);
  return { ...file, surfaces, generated: surfaces.includes("generated") };
}

// packages/core/src/analyze.ts
var countDiagnostics = [
  "malformed-hunk",
  "truncated-hunk",
  "hunk-count-mismatch"
];
var reviewPolicy = {
  "ci-build": {
    order: 1,
    level: "FOCUS",
    label: "CI/build",
    rationale: "Pipeline and build definitions are read first because they show how the rest of the change is compiled, tested and published."
  },
  "auth-access": {
    order: 2,
    level: "FOCUS",
    label: "authentication/access",
    rationale: "Access-control conventions follow the build frame and precede the code that relies on them, so the authorization boundary is established first."
  },
  "database-schema": {
    order: 3,
    level: "FOCUS",
    label: "database/schema",
    rationale: "Schema and migration files define the shape of persisted data that later surfaces read and write."
  },
  infrastructure: {
    order: 4,
    level: "FOCUS",
    label: "infrastructure/deployment",
    rationale: "Container and deployment definitions describe the environment the change runs in, completing the context before implementation."
  },
  "api-contracts": {
    order: 5,
    level: "CHECK",
    label: "API/contract",
    rationale: "Explicit contract files state what consumers see, so they are read before the implementation that satisfies them."
  },
  runtime: {
    order: 6,
    level: "CHECK",
    label: "runtime implementation",
    rationale: "Implementation files carry the executable behavior of the change and are read after the context-setting surfaces above."
  },
  dependencies: {
    order: 7,
    level: "CHECK",
    label: "dependency",
    rationale: "Manifests and lockfiles name the third-party inputs that the implementation above resolves against."
  },
  configuration: {
    order: 8,
    level: "CHECK",
    label: "configuration",
    rationale: "These files shape how the application and tooling apply the behavior listed above them."
  },
  tests: {
    order: 9,
    level: "NOTE",
    label: "test",
    rationale: "Test files show what this diff verifies directly, which reads most usefully after the implementation context."
  },
  documentation: {
    order: 10,
    level: "NOTE",
    label: "documentation",
    rationale: "Prose files such as guides and changelogs explain the change after the code they describe."
  },
  generated: {
    order: 11,
    level: "NOTE",
    label: "generated",
    rationale: "Generated output is usually a consequence of the source above it, so it is read last."
  }
};
var reviewPriority = Object.keys(reviewPolicy).sort(
  (left, right) => reviewPolicy[left].order - reviewPolicy[right].order
);
var attentionDescriptions = Object.fromEntries(
  detectors.map((detector) => [
    detector.id,
    { title: detector.title, description: detector.description }
  ])
);
function levelFor(surface) {
  return reviewPolicy[surface].level;
}
function reasonFor(surface, fileCount) {
  const policy = reviewPolicy[surface];
  return `${fileCount} ${policy.label} ${fileCount === 1 ? "file" : "files"} changed in this diff. ${policy.rationale}`;
}
function compareCanonicalText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function compareNullableText(left, right) {
  if (left === null) return right === null ? 0 : -1;
  if (right === null) return 1;
  return compareCanonicalText(left, right);
}
function compareNullableCount(left, right) {
  if (left === null) return right === null ? 0 : -1;
  if (right === null) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function compareFlag(left, right) {
  if (left === right) return 0;
  return left ? 1 : -1;
}
var fileComparators = [
  (left, right) => compareCanonicalText(left.displayPath, right.displayPath),
  (left, right) => compareCanonicalText(left.status, right.status),
  (left, right) => compareNullableCount(left.additions, right.additions),
  (left, right) => compareNullableCount(left.deletions, right.deletions),
  (left, right) => compareFlag(left.binary, right.binary),
  (left, right) => compareFlag(left.modeOnly, right.modeOnly),
  (left, right) => compareNullableText(left.oldPath, right.oldPath),
  (left, right) => compareNullableText(left.newPath, right.newPath),
  (left, right) => compareNullableText(left.oldMode, right.oldMode),
  (left, right) => compareNullableText(left.newMode, right.newMode),
  (left, right) => compareNullableCount(left.similarity, right.similarity),
  // Surface ids use only [a-z-], so a comma-joined key cannot conflate two lists.
  (left, right) => compareCanonicalText(left.surfaces.join(","), right.surfaces.join(",")),
  (left, right) => compareFlag(left.generated, right.generated)
];
function compareFileFacts(left, right) {
  for (const compare of fileComparators) {
    const result = compare(left, right);
    if (result !== 0) return result;
  }
  return 0;
}
function sortFiles(files) {
  return [...files].sort(compareFileFacts);
}
function surfaceObservation(surface, files) {
  const matching = sortFiles(files.filter((file) => file.surfaces.includes(surface)));
  return {
    surface,
    title: attentionDescriptions[surface]?.title ?? surface,
    description: attentionDescriptions[surface]?.description ?? "Changed files matched this surface.",
    level: levelFor(surface),
    fileCount: matching.length,
    additions: matching.reduce((sum, file) => sum + (file.additions ?? 0), 0),
    deletions: matching.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
    files: matching.map((file) => file.displayPath)
  };
}
function evidenceFor(files, diagnostics) {
  const sorted = sortFiles(files);
  const contentBearing = sorted.filter((file) => !file.modeOnly);
  const onSurface = (surface) => contentBearing.filter((file) => file.surfaces.includes(surface));
  const testFiles = onSurface("tests");
  const runtimeFiles = onSurface("runtime");
  const authFiles = onSurface("auth-access");
  const databaseFiles = onSurface("database-schema");
  const contracts = onSurface("api-contracts");
  const docs = onSurface("documentation");
  const manifests = contentBearing.filter((file) => matchesSurface(file, isDependencyManifest));
  const lockfiles = contentBearing.filter((file) => matchesSurface(file, isLockfile));
  const generated = contentBearing.filter((file) => file.generated);
  const countsTrustworthy = !diagnostics.some((diagnostic) => countDiagnostics.includes(diagnostic.code)) && contentBearing.every((file) => file.additions !== null && file.deletions !== null);
  const totalChangedLines = contentBearing.reduce(
    (sum, file) => sum + (file.additions ?? 0) + (file.deletions ?? 0),
    0
  );
  const generatedChangedLines = generated.reduce(
    (sum, file) => sum + (file.additions ?? 0) + (file.deletions ?? 0),
    0
  );
  const observations = [];
  const names = (items) => items.map((file) => file.displayPath);
  if (runtimeFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: "runtime-without-tests",
      title: "Runtime changes without observed test-file content changes",
      message: "Runtime files changed, but no test-file content changes were observed in this diff.",
      relatedFiles: names(runtimeFiles)
    });
  }
  if (authFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: "auth-without-tests",
      title: "Authentication/access changes without observed test-file content changes",
      message: "Authentication or authorization files changed. No test-file content changes were observed in this diff.",
      relatedFiles: names(authFiles)
    });
  }
  if (databaseFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: "database-without-tests",
      title: "Database/schema changes without observed test-file content changes",
      message: "Database or schema files changed. No test-file content changes were observed in this diff.",
      relatedFiles: names(databaseFiles)
    });
  }
  if (manifests.length > 0 && lockfiles.length === 0) {
    observations.push({
      kind: "manifest-without-lockfile",
      title: "Dependency manifest content change without observed lockfile content change",
      message: "A dependency manifest content change was observed. No lockfile content change was observed in this diff.",
      relatedFiles: names(manifests)
    });
  }
  if (lockfiles.length > 0 && manifests.length === 0) {
    observations.push({
      kind: "lockfile-without-manifest",
      title: "Lockfile content change without observed dependency manifest content change",
      message: "A lockfile content change was observed. No dependency manifest content change was observed in this diff.",
      relatedFiles: names(lockfiles)
    });
  }
  if (contracts.length > 0 && docs.length === 0) {
    observations.push({
      kind: "contract-without-docs",
      title: "Contract definition content change without observed documentation content change",
      message: "An API or contract definition changed. No documentation or changelog content change was observed in this diff.",
      relatedFiles: names(contracts)
    });
  }
  const fileShare = contentBearing.length === 0 ? 0 : generated.length / contentBearing.length;
  const lineShare = totalChangedLines === 0 ? 0 : generatedChangedLines / totalChangedLines;
  const volumeTriggered = generated.length >= 2 && (fileShare >= 0.5 || countsTrustworthy && lineShare >= 0.5);
  if (volumeTriggered) {
    observations.push({
      kind: "generated-volume",
      title: "Generated-file volume",
      message: countsTrustworthy ? "Generated-file changes account for a large share of this diff and may obscure the smaller hand-written change set." : "Generated files account for a large share of this content-bearing change set by file count. Not every file reports line counts, so no share of changed lines is stated.",
      relatedFiles: names(generated),
      metrics: countsTrustworthy ? {
        generatedFiles: generated.length,
        changedFiles: contentBearing.length,
        generatedFileShare: fileShare,
        generatedChangedLines,
        totalChangedLines,
        generatedLineShare: lineShare
      } : {
        generatedFiles: generated.length,
        changedFiles: contentBearing.length,
        generatedFileShare: fileShare
      }
    });
  }
  return observations;
}
function makeReviewOrder(files) {
  const entries = [];
  for (const surface of reviewPriority) {
    const matching = sortFiles(files.filter((file) => file.surfaces.includes(surface)));
    if (matching.length === 0) continue;
    entries.push({
      position: entries.length + 1,
      surface,
      title: attentionDescriptions[surface]?.title ?? surface,
      reason: reasonFor(surface, matching.length),
      files: matching.map((file) => file.displayPath)
    });
  }
  return entries;
}
function analyzeDiff(input) {
  const parsed = parseUnifiedDiff(input);
  const files = sortFiles(parsed.files.map(classifyFile));
  const attention = reviewPriority.filter((surface) => files.some((file) => file.surfaces.includes(surface))).map((surface) => surfaceObservation(surface, files));
  return {
    schemaVersion: "1",
    summary: {
      changedFiles: files.length,
      additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
      binaryFiles: files.filter((file) => file.binary).length,
      modeOnlyFiles: files.filter((file) => file.modeOnly).length,
      generatedFiles: files.filter((file) => file.generated).length,
      diagnostics: parsed.diagnostics.length
    },
    files,
    attention,
    evidence: evidenceFor(files, parsed.diagnostics),
    reviewOrder: makeReviewOrder(files)
  };
}

// packages/core/src/display.ts
var LINE_SHAPING = /\r\n|[\t\u000a-\u000d\u0085\u2028\u2029]/g;
var EXECUTABLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g;
var REORDERING = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
function neutralizeDisplayControls(value, marker) {
  return value.replace(REORDERING, "").replace(LINE_SHAPING, " ").replace(EXECUTABLE, marker);
}

// packages/core/src/render.ts
function number(value) {
  return value === null ? "\u2014" : new Intl.NumberFormat("en-US").format(value);
}
function escapeMarkdown(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("`", "\\`").replaceAll("*", "\\*").replaceAll("_", "\\_").replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll("(", "\\(").replaceAll(")", "\\)").replaceAll("#", "\\#").replaceAll("!", "\\!").replaceAll(">", "\\>").replaceAll("~", "\\~").replaceAll("<", "&lt;").replaceAll("\n", " ");
}
function markdownCode(value) {
  return `\`${value.replaceAll("\r", " ").replaceAll("\n", " ").replaceAll("`", "&#96;")}\``;
}
function markdownTableCellCode(value) {
  const escapedBackslashes = value.includes("|") ? value.replaceAll("\\", "\\\\") : value;
  return markdownCode(escapedBackslashes.replaceAll("|", "\\|"));
}
function renderMarkdown(report) {
  const lines = [
    "# DiffBeacon review",
    "",
    "> DiffBeacon maps review attention from observable diff evidence. It does not determine whether a pull request is safe to merge.",
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Changed files | ${number(report.summary.changedFiles)} |`,
    `| Additions | +${number(report.summary.additions)} |`,
    `| Deletions | -${number(report.summary.deletions)} |`,
    `| Binary files | ${number(report.summary.binaryFiles)} |`,
    `| Mode-only files | ${number(report.summary.modeOnlyFiles)} |`,
    "",
    "## Review attention",
    "",
    "| Level | Surface | Observation | Files |",
    "| --- | --- | --- | ---: |",
    ...report.attention.map(
      (item) => `| ${escapeMarkdown(item.level)} | ${escapeMarkdown(item.title)} | ${escapeMarkdown(item.description)} | ${number(item.fileCount)} |`
    ),
    ...report.attention.length === 0 ? [
      "| NOTE | No mapped surfaces | No changed-file surfaces were recognized in this diff. | 0 |"
    ] : [],
    "",
    "## Evidence observed",
    "",
    ...report.evidence.length === 0 ? ["No evidence relationships were triggered by this diff."] : report.evidence.flatMap((item) => [
      `### ${markdownCode(item.title)}`,
      "",
      escapeMarkdown(item.message),
      "",
      `Observed in: ${item.relatedFiles.map(markdownCode).join(", ")}`,
      ""
    ]),
    "## Review order",
    "",
    ...report.reviewOrder.length === 0 ? [
      "No review order was produced because the diff was empty or contained no recognized files."
    ] : report.reviewOrder.map(
      (item) => `${item.position}. **${escapeMarkdown(item.title)}** \u2014 ${escapeMarkdown(item.reason)}`
    ),
    "",
    "## Changed files",
    "",
    "| Status | Path | Additions | Deletions | Surfaces |",
    "| --- | --- | ---: | ---: | --- |",
    ...report.files.length === 0 ? ["| \u2014 | No files observed | \u2014 | \u2014 | \u2014 |"] : report.files.map(
      (file) => `| ${escapeMarkdown(file.status)} | ${markdownTableCellCode(file.displayPath)} | ${number(file.additions)} | ${number(file.deletions)} | ${file.surfaces.map(escapeMarkdown).join(", ") || "unclassified"} |`
    ),
    ""
  ];
  return lines.join("\n");
}

// packages/cli/src/git.ts
import { execFileSync, spawn } from "node:child_process";
import process2 from "node:process";

// packages/cli/src/errors.ts
var MAX_ECHO_CHARS = 120;
var MAX_DETAIL_CHARS = 512;
var MESSAGE_MARKER = " ";
function echo(value) {
  const printable = neutralizeDisplayControls(value, MESSAGE_MARKER);
  return printable.length <= MAX_ECHO_CHARS ? JSON.stringify(printable) : `${JSON.stringify(printable.slice(0, MAX_ECHO_CHARS))} ...(truncated)`;
}
function boundedSingleLine(value, limit = MAX_DETAIL_CHARS) {
  const line = neutralizeDisplayControls(value, MESSAGE_MARKER).trim();
  return line.length <= limit ? line : `${line.slice(0, limit)} ...(truncated)`;
}
var UsageError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
};
var DiffUnavailableError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DiffUnavailableError";
  }
};

// packages/cli/src/revisions.ts
var INVALID_REVISION = /[\u0000-\u001f\u007f\s$;|&<>`]/;
var MAX_REVISION_CHARS = 240;
function isUsableRevision(value) {
  return value.length > 0 && value.length <= MAX_REVISION_CHARS && !value.startsWith("-") && !INVALID_REVISION.test(value);
}
function validateRevision(value) {
  if (!isUsableRevision(value))
    throw new UsageError(
      `Invalid revision input: ${echo(value)}. A revision is one opaque Git name with no whitespace, no shell metacharacters, and no leading dash.`
    );
  return value;
}
function rangeOperator(range) {
  if (range.includes("...")) return "...";
  if (range.includes("..")) return "..";
  return null;
}
function validateRange(value) {
  const range = validateRevision(value);
  const operator = rangeOperator(range);
  if (operator === null)
    throw new UsageError(
      `Invalid revision range: ${echo(range)}. DiffBeacon needs a two-endpoint range such as <rev>...<rev> or <rev>..<rev>; a single revision is not accepted because comparing it with the working tree would analyse uncommitted state.`
    );
  const parts = range.split(operator);
  if (parts.length !== 2 || !parts.every((part) => isUsableRevision(part ?? "")))
    throw new UsageError(
      `Invalid revision range: ${echo(range)}. Expected exactly one "${operator}" operator with a usable revision on each side.`
    );
  return range;
}

// packages/cli/src/git.ts
var DiffSizeLimitError = class extends DiffUnavailableError {
  constructor(limitBytes = MAX_DIFF_BYTES) {
    super(
      `No diff available: the diff is larger than the ${limitBytes} byte analysis limit. Narrow the range, or use --stdin with a bounded diff.`
    );
    this.limitBytes = limitBytes;
    this.name = "DiffSizeLimitError";
  }
  limitBytes;
};
function stderrOf(error) {
  if (error instanceof Error) {
    const captured = error.stderr;
    return captured === void 0 ? "" : captured.toString();
  }
  return "";
}
function gitFailure(error, command) {
  const stderr = stderrOf(error);
  if (/not a git repository/i.test(stderr))
    return new DiffUnavailableError(
      "No diff available: the working directory is not a Git repository. Run DiffBeacon inside a repository, or read a prepared diff with --stdin."
    );
  return new DiffUnavailableError(
    `No diff available: git ${command} failed: ${boundedSingleLine(stderr) || boundedSingleLine(String(error))}`
  );
}
function gitArgs(range) {
  return [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-color",
    "--src-prefix=a/",
    "--dst-prefix=b/",
    "--ignore-submodules=none",
    "--submodule=short",
    "--diff-algorithm=myers",
    "--find-renames=50%",
    "-l1000",
    "--unified=3",
    range,
    "--"
  ];
}
function gitSmall(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: false,
    maxBuffer: 256 * 1024
  });
}
function repositoryRoot(cwd) {
  try {
    return gitSmall(["rev-parse", "--show-toplevel"], cwd).trim();
  } catch (error) {
    throw gitFailure(error, "rev-parse --show-toplevel");
  }
}
function resolveRevision(revision, cwd) {
  validateRevision(revision);
  try {
    return gitSmall(
      ["rev-parse", "--verify", "--quiet", "--end-of-options", `${revision}^{commit}`],
      cwd
    ).trim();
  } catch {
    throw new DiffUnavailableError(
      `No diff available: git cannot resolve revision ${echo(revision)}. The ref may not exist, or history may be incomplete, as in a shallow or partial clone. Read a prepared diff with --stdin.`
    );
  }
}
function rangeParts(range) {
  const safeRange = validateRange(range);
  if (safeRange.includes("...")) return safeRange.split("...");
  if (safeRange.includes("..")) return safeRange.split("..");
  return [safeRange];
}
function validateRepositoryRange(range, cwd) {
  const root = repositoryRoot(cwd);
  const safeRange = validateRange(range);
  for (const part of rangeParts(safeRange)) resolveRevision(part ?? "", root);
  return { root, range: safeRange };
}
async function collectGitDiffAsync(range, cwd = process2.cwd()) {
  const { root, range: safeRange } = validateRepositoryRange(range, cwd);
  const child = spawn("git", gitArgs(safeRange), {
    cwd: root,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stdout = [];
  const stderr = [];
  let bytes = 0;
  let exceeded = false;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    if (exceeded) return;
    bytes += Buffer.byteLength(chunk, "utf8");
    if (bytes > MAX_DIFF_BYTES) {
      exceeded = true;
      child.kill();
      return;
    }
    stdout.push(chunk);
  });
  child.stderr.on("data", (chunk) => {
    if (stderr.join("").length < 64 * 1024) stderr.push(chunk);
  });
  return await new Promise((resolve2, reject) => {
    child.once("error", () => {
      reject(new DiffUnavailableError("No diff available: the git process could not be started."));
    });
    child.once("close", (code, signal) => {
      if (exceeded) {
        reject(new DiffSizeLimitError());
        return;
      }
      if (code !== 0) {
        reject(
          new DiffUnavailableError(
            `No diff available: git diff exited ${code === null ? `on signal ${signal}` : `with code ${code}`}: ${boundedSingleLine(stderr.join("")) || "no detail from git"}`
          )
        );
        return;
      }
      resolve2(stdout.join(""));
    });
  });
}

// packages/action/src/entry.ts
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
function isEntrypointUrl(moduleUrl, argvPath, cwd, platform = process.platform) {
  if (!argvPath) return false;
  const argvUrl = pathToFileURL(resolve(cwd, argvPath)).href;
  return platform === "win32" ? moduleUrl.toLowerCase() === argvUrl.toLowerCase() : moduleUrl === argvUrl;
}

// packages/action/src/logic.ts
var SUPPORTED_EVENT_NAME = "pull_request";
function requireEventName(name) {
  if (name === SUPPORTED_EVENT_NAME) return;
  if (name === void 0 || name === "")
    throw new Error(
      "GITHUB_EVENT_NAME is required: DiffBeacon reviews the pull_request event and must know which event the runner delivered."
    );
  if (name === "pull_request_target")
    throw new Error(
      'Unsupported GITHUB_EVENT_NAME "pull_request_target": the pull_request event carries the same pull-request payload, so DiffBeacon reviews only the pull_request event and refuses to run under a base-privileged trigger.'
    );
  throw new Error(
    `Unsupported GITHUB_EVENT_NAME ${echo(name)}: DiffBeacon reviews only the pull_request event.`
  );
}
function objectId(value, endpoint) {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value))
    throw new Error(
      `Pull request event ${endpoint}.sha is not a full commit object ID: DiffBeacon needs the 40-character SHA-1 or 64-character SHA-256 hexadecimal ID from the event, not an abbreviation or a revision name.`
    );
  return value;
}
function pullRequestRange(event) {
  return {
    base: objectId(event.pull_request?.base?.sha, "base"),
    head: objectId(event.pull_request?.head?.sha, "head")
  };
}

// packages/action/src/index.ts
var MAX_STEP_SUMMARY_BYTES = 1 * 1024 * 1024;
function required(env, name) {
  const value = env[name];
  if (typeof value !== "string" || value === "")
    throw new Error(
      `${name} is required: DiffBeacon runs as a workflow step and reads its boundaries from the environment the runner exports.`
    );
  return value;
}
function readEvent(eventPath) {
  let raw;
  try {
    raw = readFileSync(eventPath, "utf8");
  } catch {
    throw new Error(`GITHUB_EVENT_PATH could not be read: ${echo(eventPath)}.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GITHUB_EVENT_PATH is not valid JSON for a workflow event.");
  }
  if (parsed === null || typeof parsed !== "object")
    throw new Error(
      "GITHUB_EVENT_PATH does not hold a JSON object for a workflow event: DiffBeacon reads pull_request.base.sha and pull_request.head.sha from the object the runner wrote."
    );
  return parsed;
}
function summaryBytesBefore(summaryPath) {
  try {
    return statSync(summaryPath).size;
  } catch {
    return 0;
  }
}
function writeSummary(summaryPath, markdown) {
  const addition = Buffer.byteLength(markdown, "utf8");
  const before = summaryBytesBefore(summaryPath);
  if (before + addition > MAX_STEP_SUMMARY_BYTES)
    throw new Error(
      `The step summary already holds ${before} bytes and this review needs ${addition}, which would pass the ${MAX_STEP_SUMMARY_BYTES} bytes GitHub gives GITHUB_STEP_SUMMARY. Nothing was appended, so the file is exactly as it was: narrow the reviewed range, or read the report from the CLI.`
    );
  try {
    appendFileSync(summaryPath, markdown, { encoding: "utf8" });
  } catch {
    throw new Error(
      "The review could not be appended to GITHUB_STEP_SUMMARY: it must name a writable file provided by the runner."
    );
  }
}
async function runAction(env = process3.env) {
  requireEventName(env.GITHUB_EVENT_NAME);
  const event = readEvent(required(env, "GITHUB_EVENT_PATH"));
  const { base, head } = pullRequestRange(event);
  const workspace = required(env, "GITHUB_WORKSPACE");
  const summaryPath = required(env, "GITHUB_STEP_SUMMARY");
  const diff = await collectGitDiffAsync(`${base}...${head}`, workspace);
  const markdown = renderMarkdown(analyzeDiff(diff));
  writeSummary(summaryPath, markdown);
  return markdown;
}
if (isEntrypointUrl(import.meta.url, process3.argv[1], process3.cwd())) {
  try {
    await runAction();
  } catch (error) {
    process3.stderr.write(
      `DiffBeacon Action error: ${error instanceof Error ? error.message : "Unknown failure."}
`
    );
    process3.exitCode = 1;
  }
}
export {
  runAction
};
