/**
 * Copy modules Cloud Functions import from gigin-api/lib into
 * functions/src/shared. Firebase uploads only functions/.
 *
 * By hand, from the repo root:
 *   node functions/syncShared.js
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {isBuiltin} from "node:module";

const functionsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(functionsDir, "..");
const sourceRoot = path.join(repoRoot, "gigin-api", "lib");
const destRoot = path.join(functionsDir, "src", "shared");

/** Entry files under gigin-api/lib. Relative imports are copied too. */
export const SHARED_ROOTS = ["artistEmails.js"];

/**
 * @param {string} source
 * @return {string[]}
 */
function specifiers(source) {
  const specs = [];
  const fromRe = /\bfrom\s+["']([^"']+)["']/g;
  const bareRe = /^\s*import\s+["']([^"']+)["']/gm;
  let match = fromRe.exec(source);
  while (match) {
    specs.push(match[1]);
    match = fromRe.exec(source);
  }
  match = bareRe.exec(source);
  while (match) {
    specs.push(match[1]);
    match = bareRe.exec(source);
  }
  return specs;
}

/**
 * @param {string} spec
 * @return {string}
 */
function packageName(spec) {
  if (spec.startsWith(".") || isBuiltin(spec)) return "";
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return `${scope}/${name}`;
  }
  return spec.split("/")[0];
}

/**
 * @param {string} fromFile
 * @param {string} spec
 * @return {string}
 */
function resolveLocal(fromFile, spec) {
  if (!spec.startsWith(".")) return "";
  const base = path.normalize(path.join(path.dirname(fromFile), spec));
  if (base.startsWith("..") || path.isAbsolute(base)) {
    throw new Error(`${fromFile} imports ${spec}, outside gigin-api/lib`);
  }
  return base.endsWith(".js") ? base : `${base}.js`;
}

/**
 * @return {{files: string[], packages: string[]}}
 */
export function sharedFiles() {
  const pending = [...SHARED_ROOTS];
  const seen = new Set();
  const packages = new Set();
  while (pending.length) {
    const rel = pending.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const text = fs.readFileSync(path.join(sourceRoot, rel), "utf8");
    for (const spec of specifiers(text)) {
      const local = resolveLocal(rel, spec);
      if (local) {
        pending.push(local);
        continue;
      }
      const name = packageName(spec);
      if (name) packages.add(name);
    }
  }
  return {
    files: [...seen].sort(),
    packages: [...packages].sort(),
  };
}

/**
 * @return {string[]}
 */
export function syncShared() {
  const {files, packages} = sharedFiles();
  const pkgPath = path.join(functionsDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = pkg.dependencies || {};
  const missing = packages.filter((name) => !Object.hasOwn(deps, name));
  if (missing.length) {
    const list = missing.join(", ");
    throw new Error(
        `Add to functions/package.json dependencies: ${list}`,
    );
  }
  fs.mkdirSync(destRoot, {recursive: true});
  for (const rel of files) {
    const from = path.join(sourceRoot, rel);
    const to = path.join(destRoot, rel);
    fs.mkdirSync(path.dirname(to), {recursive: true});
    fs.copyFileSync(from, to);
  }
  return files;
}

const invoked = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invoked) {
  for (const rel of syncShared()) {
    process.stdout.write(`copied gigin-api/lib/${rel}\n`);
  }
}
