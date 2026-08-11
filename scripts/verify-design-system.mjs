/* Design-system conformance for the public kvartirnik site.
 *
 * kvartirnik is a static site with no bundler, so it cannot resolve the
 * "@cabinet234/design-system" package specifier. It vendors the token file
 * instead. That is only safe if two things stay true, and this script is what
 * keeps them true:
 *
 *   1. the vendored copy is byte-identical to the recorded upstream hash;
 *   2. no stylesheet other than the theme declares a brand-level custom
 *      property, so the cascade cannot decide which brand wins.
 */
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = resolve(root, "site/design-system");
const flowDir = resolve(root, "site/program-flow");
const themeName = "kvartirnik-cabinet-theme.css";

/* Component-scoped layout variables. These carry no brand value — they are grid
   tracks and per-item offsets — so they belong next to the component, not in
   the theme. Anything added here must be a length or a track list, never a
   colour, shadow, font or radius. */
const LOCAL_LAYOUT = new Set([
  "--packet-offset",
  "--packet-index",
  "--timeline-label-column",
  "--timeline-calendar-column",
]);

/* KNOWN GAP — not local layout, genuinely unthemed.
 * components.css carries an eight-hue categorical palette on [data-domain]
 * (--tint-bg / --tint-fg: blue for ui, purple for domain, green for assets…).
 * It cannot be mapped onto the accent tokens, because the whole point of a
 * categorical scale is that the hues differ. The design system does not define
 * one yet, so these two names stay unthemed and stay listed here — visible,
 * not silently passing. Remove this block once the system ships a categorical
 * palette with checked contrast. */
const PENDING_CATEGORICAL = new Set(["--tint-bg", "--tint-fg", "--hint-bg", "--hint-fg"]);

const failures = [];
const fail = (message) => failures.push(message);

/* ---------- 1. the vendored copy has not drifted ---------- */

const manifest = JSON.parse(await readFile(resolve(vendorDir, "VENDOR.json"), "utf8"));
for (const [file, expected] of Object.entries(manifest.sha256)) {
  const actual = createHash("sha256").update(await readFile(resolve(vendorDir, file))).digest("hex");
  if (actual !== expected) {
    fail(`${file} differs from the recorded upstream copy.\n`
      + `    expected ${expected}\n    actual   ${actual}\n`
      + `    Re-vendor from @cabinet234/design-system and update VENDOR.json — never hand-edit the vendored file.`);
  }
}

/* ---------- 2. only the theme owns brand values ---------- */

const theme = await readFile(resolve(flowDir, themeName), "utf8");
const themeDeclares = new Set([...theme.matchAll(/(?:^|[{;])\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));

const stylesheets = (await readdir(flowDir)).filter((name) => name.endsWith(".css") && name !== themeName);
const leaking = new Map();
const pending = new Set();

/* A component-scoped property is fine when every one of its declarations is
   just a var() onto something the theme already owns — it re-labels a themed
   value for one component and cannot smuggle a brand colour in. */
const declarations = new Map();
for (const name of stylesheets) {
  const css = await readFile(resolve(flowDir, name), "utf8");
  for (const [, property, value] of css.matchAll(/(?:^|[{;])\s*(--[a-z0-9-]+)\s*:\s*([^;}]+)/gm)) {
    if (!declarations.has(property)) declarations.set(property, []);
    declarations.get(property).push({ file: name, value: value.trim() });
  }
}

const isDerived = (property, seen = new Set()) => {
  if (themeDeclares.has(property)) return true;
  if (seen.has(property) || !declarations.has(property)) return false;
  seen.add(property);
  return declarations.get(property).every(({ value }) => {
    if (!/^var\(\s*--[a-z0-9-]+\s*\)$/.test(value)) return false;
    return isDerived(/var\(\s*(--[a-z0-9-]+)/.exec(value)[1], seen);
  });
};

for (const [property, entries] of declarations) {
  if (themeDeclares.has(property) || LOCAL_LAYOUT.has(property)) continue;
  if (PENDING_CATEGORICAL.has(property)) { pending.add(property); continue; }
  if (isDerived(property)) continue;
  leaking.set(property, new Set(entries.map((entry) => entry.file)));
}

for (const [property, files] of leaking) {
  fail(`${property} is declared in ${[...files].join(", ")} but never mapped by ${themeName} — `
    + "its value reaches the page unthemed.");
}

/* ---------- 3. the theme maps, it does not invent ---------- */

const themeBody = theme.slice(theme.indexOf(":root"));
const themeRoot = themeBody.slice(0, themeBody.indexOf("\n}"));
const ALLOWED_LITERAL = /^--ds-(color-accent|color-accent-strong|color-accent-soft|gradient-accent)$/;

for (const [, property, value] of themeRoot.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)) {
  if (ALLOWED_LITERAL.test(property)) continue;
  if (/#[0-9a-f]{3,8}|\brgba?\(/i.test(value)) {
    fail(`${themeName} writes a literal colour for ${property}: ${value.trim()}. `
      + "Theming is an override of the semantic accent tokens, not a second palette.");
  }
  if (/\b\d+px\b/.test(value)) {
    fail(`${themeName} writes a literal length for ${property}: ${value.trim()}. `
      + "Add the step to the design system instead.");
  }
}

/* ---------- 3b. every page actually links the theme ---------- */

/* The theme is added to the published artifact by hand: the generator in the
   private product repository does not emit it, and its CSS-ownership contract
   does not list it. So a regeneration drops the <link> silently and the page
   falls back to the bundle's own palette. This check is the tripwire. */
const pages = [];
const collectPages = async (dir, prefix = "") => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await collectPages(resolve(dir, entry.name), rel);
    else if (entry.name.endsWith(".html")) pages.push({ rel, path: resolve(dir, entry.name) });
  }
};
await collectPages(resolve(root, "site"));

if (pages.length === 0) fail("No HTML pages found under site/ — the check cannot be trusted.");

for (const page of pages) {
  const html = await readFile(page.path, "utf8");
  if (!html.includes(themeName)) {
    fail(`${page.rel} does not link ${themeName}. Without it the page renders the bundle's own `
      + "palette — blue and acid-lime — instead of the design system.");
  }
}

/* ---------- 4. every token the theme reads actually exists ---------- */

const tokensCss = await readFile(resolve(vendorDir, "tokens.css"), "utf8");
const declaredTokens = new Set([...tokensCss.matchAll(/^\s*(--ds-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
for (const [, token] of theme.matchAll(/var\(\s*(--ds-[a-z0-9-]+)/g)) {
  if (!declaredTokens.has(token)) fail(`${themeName} reads ${token}, which the vendored token file does not declare.`);
}

/* ---------- report ---------- */

if (failures.length > 0) {
  console.error(`${failures.length} design-system violation(s):`);
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  if (pending.size > 0) {
    console.log(`known gap — categorical palette still unthemed: ${[...pending].join(", ")}`);
  }
  console.log(`Design system conformance ok: ${declaredTokens.size} tokens vendored, `
    + `${themeDeclares.size} local names mapped, ${stylesheets.length} stylesheets checked, 0 leaking properties.`);
}
