import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const projectRoot = path.resolve(import.meta.dirname, '..');
const srcRoot = path.join(projectRoot, 'src', 'main');
const packageJsonPath = path.join(projectRoot, 'package.json');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const dependencies = new Set(Object.keys(pkg.dependencies ?? {}));
const optionalDependencies = new Set(Object.keys(pkg.optionalDependencies ?? {}));

const ignoredRuntimeModules = new Set([
  'electron',
  'playwright',
]);

const builtins = new Set(
  builtinModules.map((name) => (name.startsWith('node:') ? name.slice(5) : name))
);

const importMatchers = [
  /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"\n]+)['"]/g,
  /import\(['"]([^'"\n]+)['"]\)/g,
  /require\(['"]([^'"\n]+)['"]\)/g,
];

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ts|js|mts|cts)$/.test(entry.name)) {
      continue;
    }

    if (entry.name.endsWith('.test.ts')) {
      continue;
    }

    files.push(fullPath);
  }
  return files;
}

function getPackageRoot(specifier) {
  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/');
  }
  return specifier.split('/')[0];
}

function collectRuntimeImports(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  for (const matcher of importMatchers) {
    let match;
    while ((match = matcher.exec(source)) !== null) {
      imports.push(match[1]);
    }
  }
  return imports;
}

const files = walkFiles(srcRoot);
const missing = new Map();

for (const file of files) {
  const specs = collectRuntimeImports(file);
  for (const spec of specs) {
    if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) {
      continue;
    }

    const root = getPackageRoot(spec);
    if (builtins.has(root)) {
      continue;
    }

    if (ignoredRuntimeModules.has(root)) {
      continue;
    }

    if (dependencies.has(root) || optionalDependencies.has(root)) {
      continue;
    }

    missing.set(root, (missing.get(root) ?? 0) + 1);
  }
}

if (missing.size === 0) {
  console.log('Runtime dependency check passed.');
  process.exit(0);
}

console.error('Missing runtime dependencies found in src/main:');
for (const [name, count] of [...missing.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.error(`- ${name} (${count} references)`);
}

process.exit(1);
