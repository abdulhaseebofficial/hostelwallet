#!/usr/bin/env node
/**
 * Finds a local binding that shadows the module it is initialised from.
 * `npm run check:shadowing`
 *
 *     const expenses = require('../expenses/expenses.service');   // line 14
 *     ...
 *     const [expenses] = await Promise.all([                      // line 127
 *       expenses.listAllForUser(id),                              //   <- throws
 *     ]);
 *
 * The second `expenses` shadows the first for the whole block, so reading it
 * while it is still being declared throws "Cannot access 'expenses' before
 * initialization". It looks right, it loads fine, and it only fails when that
 * line actually runs.
 *
 * Not hypothetical: five of these were written during the module restructure.
 * Four were caught by the end-to-end suite. The fifth sat inside a
 * Promise.allSettled, which turns a rejection into a logged warning - so the
 * endpoint kept answering 200 while one of its four checks failed every single
 * time, for two commits, unnoticed.
 *
 * Exits non-zero on any finding.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const ROOTS = [
  path.join(REPO, 'apps', 'api', 'src'),
  path.join(REPO, 'apps', 'web', 'src'),
  path.join(REPO, 'database'),
  path.join(REPO, 'tests'),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

/** Names bound to a module, and the line each was bound on. */
function moduleBindings(lines) {
  const bound = new Map();
  lines.forEach((line, i) => {
    const req = line.match(/^\s*const\s+(\w+)\s*=\s*(?:lazyModule\(|require\()/);
    if (req && !bound.has(req[1])) bound.set(req[1], i);
    const imp = line.match(/^\s*import\s+(\w+)\s+from/);
    if (imp && !bound.has(imp[1])) bound.set(imp[1], i);
  });
  return bound;
}

/** The names a declaration introduces, destructuring included. */
function declaredNames(line) {
  const m = line.match(/^\s*(?:const|let|var)\s+(\[[^\]]*\]|\{[^}]*\}|\w+)\s*=/);
  if (!m) return [];
  return m[1]
    .replace(/[[\]{}]/g, ' ')
    .split(/[,\s:]+/)
    .map((n) => n.trim())
    .filter((n) => /^\w+$/.test(n));
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const bound = moduleBindings(lines);
    if (!bound.size) continue;

    lines.forEach((line, i) => {
      for (const name of declaredNames(line)) {
        const boundAt = bound.get(name);
        // Only a *re*-declaration can shadow; the binding line itself cannot.
        if (boundAt === undefined || boundAt === i) continue;

        // Does this declaration's initialiser read the module it shadows?
        const initialiser = lines.slice(i, i + 8).join('\n');
        const readsIt = new RegExp('=[\\s\\S]*\\b' + name + '\\s*[.[]').test(initialiser);
        if (!readsIt) continue;

        findings.push({
          file: path.relative(REPO, file).split(path.sep).join('/'),
          line: i + 1,
          name,
          boundAt: boundAt + 1,
          source: line.trim().slice(0, 78),
        });
      }
    });
  }
}

if (findings.length) {
  console.error(`\n${findings.length} shadowed module binding(s):\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`      ${f.source}`);
    console.error(`      '${f.name}' is the module imported on line ${f.boundAt}\n`);
  }
  console.error('Rename the local binding. Reading a module through a name that is being');
  console.error('declared on the same line throws at runtime, not at load.\n');
  process.exit(1);
}

console.log('no shadowed module bindings');
