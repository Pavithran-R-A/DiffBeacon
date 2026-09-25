// packages/action/src/index.ts
import { appendFileSync, readFileSync } from "node:fs";
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
var reviewPriority = [
  "ci-build",
  "auth-access",
  "database-schema",
  "infrastructure",
  "api-contracts",
  "runtime",
  "dependencies",
  "configuration",
  "tests",
  "documentation",
  "generated"
];
var attentionDescriptions = Object.fromEntries(
  detectors.map((detector) => [
    detector.id,
    { title: detector.title, description: detector.description }
  ])
);
function levelFor(surface) {
  if (["ci-build", "auth-access", "database-schema", "infrastructure"].includes(surface))
    return "FOCUS";
  if (["api-contracts", "runtime", "dependencies", "configuration"].includes(surface))
    return "CHECK";
  return "NOTE";
}
function compareCanonicalText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function sortFiles(files) {
  return [...files].sort((a, b) => compareCanonicalText(a.displayPath, b.displayPath));
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
      title: "Runtime changes without observed test-file changes",
      message: "Runtime files changed, but no test-file content changes were observed in this diff.",
      relatedFiles: names(runtimeFiles)
    });
  }
  if (authFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: "auth-without-tests",
      title: "Authentication/access changes without observed test-file changes",
      message: "Authentication or authorization files changed. No test-file content changes were observed in this diff.",
      relatedFiles: names(authFiles)
    });
  }
  if (databaseFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: "database-without-tests",
      title: "Database/schema changes without observed test-file changes",
      message: "Database or schema files changed. No test-file content changes were observed in this diff.",
      relatedFiles: names(databaseFiles)
    });
  }
  if (manifests.length > 0 && lockfiles.length === 0) {
    observations.push({
      kind: "manifest-without-lockfile",
      title: "Dependency manifest without observed lockfile change",
      message: "A dependency manifest content change was observed. No lockfile content change was observed in this diff.",
      relatedFiles: names(manifests)
    });
  }
  if (lockfiles.length > 0 && manifests.length === 0) {
    observations.push({
      kind: "lockfile-without-manifest",
      title: "Lockfile without observed dependency manifest change",
      message: "A lockfile content change was observed. No dependency manifest content change was observed in this diff.",
      relatedFiles: names(lockfiles)
    });
  }
  if (contracts.length > 0 && docs.length === 0) {
    observations.push({
      kind: "contract-without-docs",
      title: "Contract definition without observed documentation change",
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
      reason: `DiffBeacon recommends looking at ${attentionDescriptions[surface]?.title ?? surface} earlier in this review.`,
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
      (file) => `| ${escapeMarkdown(file.status)} | ${markdownCode(file.displayPath)} | ${number(file.additions)} | ${number(file.deletions)} | ${file.surfaces.map(escapeMarkdown).join(", ") || "unclassified"} |`
    ),
    ""
  ];
  return lines.join("\n");
}

// packages/cli/src/git.ts
import { execFileSync, spawn } from "node:child_process";
import process2 from "node:process";

// packages/cli/src/revisions.ts
var INVALID_REVISION = /[\u0000-\u001f\u007f\s$;|&<>`]/;
function validateRevision(value) {
  if (value.length === 0 || value.length > 240 || value.startsWith("-") || INVALID_REVISION.test(value)) {
    throw new Error(`Invalid revision input: ${JSON.stringify(value)}`);
  }
  return value;
}
function validateRange(value) {
  const range = validateRevision(value);
  const parts = range.split("...");
  if (parts.length === 2) {
    validateRevision(parts[0] ?? "");
    validateRevision(parts[1] ?? "");
  } else if (range.includes("..")) {
    const doubleDot = range.split("..");
    if (doubleDot.length !== 2) throw new Error(`Invalid revision range: ${JSON.stringify(value)}`);
    validateRevision(doubleDot[0] ?? "");
    validateRevision(doubleDot[1] ?? "");
  }
  return range;
}

// packages/cli/src/git.ts
var DiffSizeLimitError = class extends Error {
  constructor(limitBytes = MAX_DIFF_BYTES) {
    super(`DiffBeacon analysis limit exceeded: the diff is larger than ${limitBytes} bytes.`);
    this.limitBytes = limitBytes;
    this.name = "DiffSizeLimitError";
  }
  limitBytes;
};
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
  return gitSmall(["rev-parse", "--show-toplevel"], cwd).trim();
}
function resolveRevision(revision, cwd) {
  validateRevision(revision);
  return gitSmall(
    ["rev-parse", "--verify", "--quiet", "--end-of-options", `${revision}^{commit}`],
    cwd
  ).trim();
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
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (exceeded) {
        reject(new DiffSizeLimitError());
        return;
      }
      if (code !== 0) {
        reject(
          new Error(`git diff failed${signal ? ` with ${signal}` : ""}: ${stderr.join("").trim()}`)
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
function sha(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{7,64}$/i.test(value))
    throw new Error("Pull request event did not contain a valid commit SHA.");
  return value;
}
function pullRequestRange(event) {
  return { base: sha(event.pull_request?.base?.sha), head: sha(event.pull_request?.head?.sha) };
}

// packages/action/src/index.ts
async function runAction(env = process3.env) {
  if (!env.GITHUB_EVENT_PATH) throw new Error("GITHUB_EVENT_PATH is required.");
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const range = pullRequestRange(
    event
  );
  const diff = await collectGitDiffAsync(`${range.base}...${range.head}`);
  const report = analyzeDiff(diff);
  const markdown = renderMarkdown(report);
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}
`, { encoding: "utf8" });
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
