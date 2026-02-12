const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

suite('Pre-commit Hook Tests', () => {
  suite('Hook configuration', () => {
    test('Husky pre-commit hook exists', () => {
      const hookPath = path.join(ROOT, '.husky', 'pre-commit');
      assert.ok(fs.existsSync(hookPath), '.husky/pre-commit should exist');
    });

    test('Pre-commit hook runs quality checks', () => {
      const hookContent = fs.readFileSync(
        path.join(ROOT, '.husky', 'pre-commit'), 'utf8'
      );
      assert.ok(
        hookContent.includes('pre-commit-check'),
        'Hook should reference pre-commit-check script'
      );
    });

    test('Pre-commit check script exists', () => {
      const scriptPath = path.join(ROOT, 'scripts', 'pre-commit-check.js');
      assert.ok(fs.existsSync(scriptPath), 'scripts/pre-commit-check.js should exist');
    });

    test('Package.json has prepare script for husky', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      assert.ok(pkg.scripts.prepare, 'prepare script should exist');
      assert.ok(pkg.scripts.prepare.includes('husky'), 'prepare should invoke husky');
    });

    test('Package.json has pre-commit script', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      assert.ok(pkg.scripts['pre-commit'], 'pre-commit script should exist');
    });

    test('Package.json has test:coverage script', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      assert.ok(pkg.scripts['test:coverage'], 'test:coverage script should exist');
    });
  });

  suite('Validation checks', () => {
    test('All source files are ≤ 500 lines', () => {
      const { globSync } = require('glob');
      const patterns = ['*.js', 'webview/**/*.js', 'webview/**/*.jsx'];
      const violations = [];

      for (const pattern of patterns) {
        const files = globSync(pattern, {
          cwd: ROOT,
          ignore: ['node_modules/**', 'webview/bundle.js', 'webview/bundle.js.map']
        });
        for (const file of files) {
          const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
          const lineCount = content.split(/\r?\n/).length;
          if (lineCount > 500) {
            violations.push(`${file} (${lineCount} lines)`);
          }
        }
      }

      assert.strictEqual(violations.length, 0,
        `Files exceeding 500 lines: ${violations.join(', ')}`
      );
    });

    test('No skipped tests in test files', () => {
      const { globSync } = require('glob');
      const files = globSync('test/**/*.test.js', { cwd: ROOT });
      const skipPatterns = [/\.skip\s*\(/, /\.only\s*\(/, /\bxit\s*\(/, /\bxdescribe\s*\(/];
      const violations = [];

      for (const file of files) {
        const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          for (const pattern of skipPatterns) {
            if (pattern.test(lines[i])) {
              violations.push(`${file}:${i + 1}`);
            }
          }
        }
      }

      assert.strictEqual(violations.length, 0,
        `Skipped tests found: ${violations.join(', ')}`
      );
    });

    test('ESLint passes with zero warnings', function () {
      this.timeout(30000);
      try {
        execSync('npx eslint . --max-warnings 0', {
          cwd: ROOT,
          stdio: 'pipe',
          timeout: 30000
        });
      } catch (err) {
        const output = (err.stdout || '').toString();
        assert.fail(`ESLint found issues:\n${output}`);
      }
    });
  });
});
