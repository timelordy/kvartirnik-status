import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? "site");
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowRoot = path.join(repositoryRoot, ".github", "workflows");
const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".txt"]);
const publicExtensions = new Set([
  ".css", ".html", ".ico", ".jpeg", ".jpg", ".js", ".json", ".png", ".svg", ".webp"
]);
const specialPublicFiles = new Set([".nojekyll", "CNAME"]);
const forbidden = [
  /(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/u,
  /github\.com\/timelordy\/(?!kvartirnik-status(?:[/?#"'<>]|\s|$))/iu,
  /github\.com\/timelordy\/kvartirnik-status\/actions\b/iu,
  /status dispatch:/iu,
  /\b[A-Z][A-Z0-9_]*(?:DEPLOY_KEY|PRIVATE_KEY|TOKEN|SECRET)\b/u,
  /(?:[A-Z]:[\\/]|\/(?:home|Users|workspace|workspaces)\/)/u,
  /\b(?:commitsBehind|revisionDelta)\b/u
];
const privateCopy = [
  /\b(?:docs|fixtures|scripts|src)\/[A-Za-z0-9_.@/\\-]+/iu,
  /(?:закрыт\S*\s+(?:основн\S*\s+ветк\S*|репозитор\S*|source|источник\S*)|приватн\S*\s+(?:репозитор\S*|source|файл\S*|ветк\S*|workflow)|служебн\S*\s+ветк\S*|ключ\S*\s+только\s+для\s+чтения)/iu
];

if (fs.existsSync(workflowRoot) && listFiles(workflowRoot).length > 0) {
  throw new Error("GitHub Actions workflows are forbidden in local-only mode");
}
if (!fs.existsSync(path.join(root, "index.html"))) throw new Error("public site index is missing");

const files = listFiles(root);
const totalBytes = files.reduce((sum, filePath) => sum + fs.lstatSync(filePath).size, 0);
if (files.length === 0 || files.length > 128) throw new Error(`unexpected public file count: ${files.length}`);
if (totalBytes > 30 * 1024 * 1024) throw new Error(`public site exceeds 30 MiB: ${totalBytes}`);

for (const filePath of files) {
  const stats = fs.lstatSync(filePath);
  const relativePath = relative(filePath);
  const extension = path.extname(filePath).toLowerCase();
  if (stats.isSymbolicLink()) throw new Error(`symbolic links are forbidden: ${relativePath}`);
  if (!specialPublicFiles.has(relativePath) && relativePath.split("/").some((part) => part.startsWith("."))) {
    throw new Error(`hidden public path is forbidden: ${relativePath}`);
  }
  if (!specialPublicFiles.has(relativePath) && !publicExtensions.has(extension)) {
    throw new Error(`unsupported public file type: ${relativePath}`);
  }
  if (!textExtensions.has(extension) && relativePath !== "CNAME") continue;
  const content = fs.readFileSync(filePath, "utf8");
  if (forbidden.some((pattern) => pattern.test(content))) {
    throw new Error(`private publication metadata detected: ${relativePath}`);
  }
  if (([".css", ".html", ".json", ".svg", ".txt"].includes(extension) || relativePath === "CNAME")
    && privateCopy.some((pattern) => pattern.test(content))) {
    throw new Error(`private paths or topology detected: ${relativePath}`);
  }
}

console.log(`public site verification: OK (${files.length} files, ${totalBytes} bytes)`);

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}
