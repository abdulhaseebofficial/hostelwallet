#!/usr/bin/env node
/**
 * Checks the layering rules the monorepo is built on.  `npm run check:boundaries`
 *
 * The folder structure is only worth having if something stops it being
 * ignored. These four rules are what the restructure bought, and each one was
 * broken somewhere before it was written down:
 *
 *   api   shared/ and infrastructure/ must not import a feature module.
 *         (authenticate.js sat in shared while importing auth's tokens.)
 *   api   a module must not import another module's repository - go through
 *         its service. (Seventeen places did.)
 *   web   shared/ must not import a feature.
 *         (AppLayout sat in shared while importing auth and notifications.)
 *   web   a feature must not reach into another feature's internals - import
 *         its index.js, which is its public API. (Twenty places did.)
 *
 * Exits non-zero on any violation, so CI fails rather than warns.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'apps', 'web', 'src');
const API = path.join(ROOT, 'apps', 'api', 'src');

const IMPORT = /(?:from\s+|import\s*\(\s*|require\(\s*)(['"])(\.[^'"]+)\1/g;

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const rel = (root, file) => path.relative(root, file).split(path.sep).join('/');

/** Every relative import in a file, resolved to a root-relative path. */
function* imports(root, file) {
  const text = fs.readFileSync(file, 'utf8');
  const from = path.posix.dirname(rel(root, file));
  IMPORT.lastIndex = 0;
  let m;
  while ((m = IMPORT.exec(text)) !== null) {
    yield path.posix.normalize(path.posix.join(from, m[2]));
  }
}

const violations = [];

/* ------------------------------- web -------------------------------- */

for (const file of walk(WEB, ['.js', '.jsx'])) {
  const src = rel(WEB, file);
  for (const target of imports(WEB, file)) {
    if (src.startsWith('shared/') && target.startsWith('features/')) {
      violations.push(`web  shared imports a feature:        ${src} -> ${target}`);
    }
    if (src.startsWith('features/') && target.startsWith('features/')) {
      const mine = src.split('/')[1];
      const theirs = target.split('/')[1];
      const isPublicApi =
        target === `features/${theirs}` || target === `features/${theirs}/index`;
      if (mine !== theirs && !isPublicApi) {
        violations.push(`web  feature reaches into another:   ${src} -> ${target}`);
      }
    }
  }
}

/* ------------------------------- api -------------------------------- */

for (const file of walk(API, ['.js'])) {
  const src = rel(API, file);
  for (const target of imports(API, file)) {
    const layer = src.split('/')[0];

    if ((layer === 'shared' || layer === 'infrastructure') && target.startsWith('modules/')) {
      // Scheduling is an adapter whose whole job is to drive features.
      if (!src.startsWith('infrastructure/scheduling/')) {
        violations.push(`api  ${layer} imports a module:${' '.repeat(11 - layer.length)}${src} -> ${target}`);
      }
    }

    if (src.startsWith('modules/') && target.startsWith('modules/')) {
      const mine = src.split('/')[1];
      const theirs = target.split('/')[1];
      if (mine !== theirs && target.endsWith('.repository')) {
        violations.push(`api  module reaches another's SQL:   ${src} -> ${target}`);
      }
    }
  }
}

if (violations.length) {
  console.error(`\n${violations.length} boundary violation(s):\n`);
  [...new Set(violations)].sort().forEach((v) => console.error('  ' + v));
  console.error('');
  process.exit(1);
}

console.log('boundaries ok: shared stays shared, and no module reads another\'s tables');
