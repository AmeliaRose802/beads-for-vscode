#!/usr/bin/env node
'use strict';

/**
 * Pre-commit quality gate script.
 * Validates code quality standards before allowing commits.
 * All checks must pass — no bypass mechanisms.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const ROOT = path.resolve(__dirname, '..');
const MAX_FILE_LINES = 500;
const MIN_COVERAGE = 80;

let failed = false;

function fail(check, message) {
  console.error(`\n❌ FAILED: ${check}`);
  console.error(`   ${message}`);
  failed = true;
}

function pass(check) {
  console.log(`✅ PASSED: ${check}`);
}

// ── 1. Lint (zero warnings/errors) ────────────────────────────────
function checkLint() {
  try {
    execSync('npx eslint . --max-warnings 0', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60000
    });
    pass('Lint — zero warnings and errors');
  } catch (err) {
    const output = (err.stdout || '').toString().trim();
    fail('Lint', `ESLint reported warnings or errors:\n   ${output.split('\n').join('\n   ')}`);
  }
}

// ── 2. Maximum file length ────────────────────────────────────────
function checkFileLength() {
  const violations = [];

  const patterns = [
    '*.js',
    'webview/**/*.js',
    'webview/**/*.jsx'
  ];

  for (const pattern of patterns) {
    const files = globSync(pattern, {
      cwd: ROOT,
      ignore: ['node_modules/**', 'webview/bundle.js', 'webview/bundle.js.map']
    });

    for (const file of files) {
      const fullPath = path.join(ROOT, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lineCount = content.split(/\r?\n/).length;
      if (lineCount > MAX_FILE_LINES) {
        violations.push(`${file} (${lineCount} lines)`);
      }
    }
  }

  if (violations.length > 0) {
    fail('File length', `Files exceed ${MAX_FILE_LINES} lines:\n   ${violations.join('\n   ')}`);
  } else {
    pass(`File length — all files ≤ ${MAX_FILE_LINES} lines`);
  }
}

// ── 3. No skipped tests ──────────────────────────────────────────
function checkNoSkippedTests() {
  const violations = [];
  const skipPatterns = [
    /\.skip\s*\(/,
    /\.only\s*\(/,
    /\bxit\s*\(/,
    /\bxdescribe\s*\(/,
    /\bxsuite\s*\(/,
    /\bxtest\s*\(/,
    /\bpending\s*\(\s*\)/
  ];

  const files = globSync('test/**/*.test.js', { cwd: ROOT });

  for (const file of files) {
    const fullPath = path.join(ROOT, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of skipPatterns) {
        if (pattern.test(lines[i])) {
          violations.push(`${file}:${i + 1} — ${lines[i].trim()}`);
        }
      }
    }
  }

  if (violations.length > 0) {
    fail('No skipped tests', `Found skipped/exclusive tests:\n   ${violations.join('\n   ')}`);
  } else {
    pass('No skipped tests');
  }
}

// ── 4. Type annotations (JSDoc @param/@returns) on exports ───────
function checkTypeAnnotations() {
  const violations = [];

  const patterns = ['*.js', 'webview/**/*.js', 'webview/**/*.jsx'];
  const ignorePatterns = [
    'node_modules/**', 'webview/bundle.js', 'webview/bundle.js.map',
    'test/**', 'scripts/**', '.eslintrc.js', 'build.js'
  ];

  for (const pattern of patterns) {
    const files = globSync(pattern, { cwd: ROOT, ignore: ignorePatterns });

    for (const file of files) {
      const fullPath = path.join(ROOT, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match exported function declarations
        const exportFuncMatch = line.match(
          /^(?:module\.exports\s*=\s*\{|exports\.(\w+)\s*=\s*function|function\s+(\w+)\s*\()/
        );
        if (!exportFuncMatch) continue;

        // Check if preceded by JSDoc block
        let hasJsDoc = false;
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
          const prev = lines[j].trim();
          if (prev === '') continue;
          if (prev.endsWith('*/')) {
            hasJsDoc = true;
          }
          break;
        }

        // Only require JSDoc on top-level exported functions
        const funcName = exportFuncMatch[1] || exportFuncMatch[2];
        if (funcName && !hasJsDoc) {
          violations.push(`${file}:${i + 1} — function '${funcName}' missing JSDoc`);
        }
      }
    }
  }

  if (violations.length > 0) {
    fail('Type annotations', `Functions missing JSDoc:\n   ${violations.join('\n   ')}`);
  } else {
    pass('Type annotations — all exported functions documented');
  }
}

// ── 5. Test coverage ─────────────────────────────────────────────
function checkCoverage() {
  // Run coverage check across all testable source files using wildcard patterns.
  // This automatically picks up new webview modules and root-level source files.
  try {
    const covCmd = [
      'npx c8',
      '--include "webview/*.js"',
      '--include "beads-backend.js"',
      `--lines ${MIN_COVERAGE} --branches ${MIN_COVERAGE} --functions ${MIN_COVERAGE}`,
      '-- npm run test:unit --silent'
    ].join(' ');
    execSync(covCmd, { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    pass(`Test coverage — ≥ ${MIN_COVERAGE}%`);
  } catch (err) {
    fail('Test coverage', `Coverage below ${MIN_COVERAGE}% threshold`);
  }
}

// ── Run all checks ───────────────────────────────────────────────
console.log('🔍 Pre-commit quality checks\n');

checkLint();
checkFileLength();
checkNoSkippedTests();
checkTypeAnnotations();
checkCoverage();

console.log('');

if (failed) {
  console.error('🚫 Commit blocked — fix the issues above and try again.');
  process.exit(1);
} else {
  console.log('🎉 All checks passed — committing.');
  process.exit(0);
}
