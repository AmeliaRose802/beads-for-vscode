const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { detectBeadsBackend, getBeadsEnv } = require('../../beads-backend');

suite('Dolt Backend Integration Tests', () => {
  let testDir;

  setup(() => {
    // Create temporary test directory
    testDir = path.join(__dirname, '..', 'tmp', 'dolt-test-' + Date.now());
    fs.mkdirSync(path.dirname(testDir), { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.beads'), { recursive: true });
  });

  teardown(() => {
    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  suite('Dolt Project Detection', () => {
    test('Should detect Dolt project from metadata.json', () => {
      // Create Dolt metadata
      const metadata = {
        backend: 'dolt',
        database: 'beads_db'
      };
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), JSON.stringify(metadata, null, 2));

      const result = detectBeadsBackend(testDir);
      
      assert.strictEqual(result.backend, 'dolt');
      assert.strictEqual(result.beadsDbPath, null); // Should be null for Dolt
      assert.deepStrictEqual(result.metadata, metadata);
    });

    test('Should detect Dolt project from .dolt directory marker', () => {
      // Create Dolt directory marker (no metadata.json)
      fs.mkdirSync(path.join(testDir, '.beads', '.dolt'), { recursive: true });

      const result = detectBeadsBackend(testDir);
      
      assert.strictEqual(result.backend, 'dolt');
      assert.strictEqual(result.beadsDbPath, null);
    });

    test('Should detect Dolt project from nested .dolt in db/', () => {
      // Create nested Dolt marker
      fs.mkdirSync(path.join(testDir, '.beads', 'db'), { recursive: true });
      fs.mkdirSync(path.join(testDir, '.beads', 'db', '.dolt'), { recursive: true });

      const result = detectBeadsBackend(testDir);
      
      assert.strictEqual(result.backend, 'dolt');
    });

    test('Should handle various metadata backend hints', () => {
      const testCases = [
        { backend: 'dolt' },
        { storage: 'Dolt' },
        { engine: 'DOLT' },
        { db_backend: 'dolt' },
        { database_backend: 'dolt' },
        { database: 'dolt_repo' }
      ];

      testCases.forEach((metadata, index) => {
        const currentTestDir = testDir + '_' + index;
        fs.mkdirSync(currentTestDir, { recursive: true });
        fs.mkdirSync(path.join(currentTestDir, '.beads'), { recursive: true });
        
        fs.writeFileSync(
          path.join(currentTestDir, '.beads', 'metadata.json'), 
          JSON.stringify(metadata, null, 2)
        );

        const result = detectBeadsBackend(currentTestDir);
        assert.strictEqual(result.backend, 'dolt', `Failed for metadata: ${JSON.stringify(metadata)}`);
        
        // Cleanup
        fs.rmSync(currentTestDir, { recursive: true, force: true });
      });
    });
  });

  suite('Environment Variable Handling for Dolt', () => {
    test('Should set BEADS_DIR but not BEADS_DB for Dolt projects', () => {
      // Create Dolt project
      const metadata = { backend: 'dolt' };
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), JSON.stringify(metadata));

      const { backend, env } = getBeadsEnv(testDir);
      
      assert.strictEqual(backend, 'dolt');
      assert.ok(env.BEADS_DIR);
      assert.strictEqual(env.BEADS_DIR, path.join(testDir, '.beads'));
      assert.ok(!Object.prototype.hasOwnProperty.call(env, 'BEADS_DB'));
    });

    test('Should set both BEADS_DIR and BEADS_DB for SQLite projects', () => {
      // Create SQLite project
      const metadata = { backend: 'sqlite', database: 'beads.db' };
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), JSON.stringify(metadata));

      const { backend, env } = getBeadsEnv(testDir);
      
      assert.strictEqual(backend, 'sqlite');
      assert.ok(env.BEADS_DIR);
      assert.ok(env.BEADS_DB);
      assert.strictEqual(env.BEADS_DB, path.join(testDir, '.beads', 'beads.db'));
    });

    test('Should handle missing metadata.json gracefully', () => {
      // No metadata.json, but create SQLite db file
      fs.writeFileSync(path.join(testDir, '.beads', 'beads.db'), 'fake db');

      const { backend, env } = getBeadsEnv(testDir);
      
      assert.strictEqual(backend, 'sqlite');
      assert.ok(env.BEADS_DIR);
      assert.ok(env.BEADS_DB);
    });

    test('Should default to unknown backend for empty .beads directory', () => {
      // Empty .beads directory
      
      const { backend, env } = getBeadsEnv(testDir);
      
      assert.strictEqual(backend, 'unknown');
      assert.ok(env.BEADS_DIR);
      assert.ok(!Object.prototype.hasOwnProperty.call(env, 'BEADS_DB'));
    });
  });

  suite('Real-world Dolt Project Scenarios', () => {
    test('Should handle beads v0.50+ default Dolt structure', () => {
      // Simulate beads v0.50+ default structure
      const metadata = {
        backend: 'dolt',
        database: 'beads_db',
        version: '0.50.0'
      };
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), JSON.stringify(metadata));
      
      // Create typical Dolt directory structure
      fs.mkdirSync(path.join(testDir, '.beads', 'db'), { recursive: true });
      fs.mkdirSync(path.join(testDir, '.beads', 'db', '.dolt'), { recursive: true });
      
      const result = detectBeadsBackend(testDir);
      const envResult = getBeadsEnv(testDir);
      
      assert.strictEqual(result.backend, 'dolt');
      assert.strictEqual(envResult.backend, 'dolt');
      assert.ok(envResult.env.BEADS_DIR);
      assert.ok(!envResult.env.BEADS_DB);
    });

    test('Should handle legacy SQLite project correctly', () => {
      // Simulate legacy SQLite project
      const metadata = {
        database: 'beads.db',
        jsonl_export: 'beads.jsonl'
      };
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), JSON.stringify(metadata));
      fs.writeFileSync(path.join(testDir, '.beads', 'beads.db'), 'fake sqlite db');
      
      const result = detectBeadsBackend(testDir);
      const envResult = getBeadsEnv(testDir);
      
      assert.strictEqual(result.backend, 'sqlite');
      assert.strictEqual(envResult.backend, 'sqlite');
      assert.ok(envResult.env.BEADS_DIR);
      assert.ok(envResult.env.BEADS_DB);
      assert.ok(envResult.env.BEADS_DB.includes('beads.db'));
    });

    test('Should handle mixed repository scenarios', () => {
      // Scenario: Both Dolt and SQLite markers present (Dolt should take precedence)
      const metadata = {
        backend: 'dolt',
        database: 'beads.db' // Conflicting info
      };
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), JSON.stringify(metadata));
      fs.writeFileSync(path.join(testDir, '.beads', 'beads.db'), 'fake sqlite db');
      fs.mkdirSync(path.join(testDir, '.beads', '.dolt'), { recursive: true });
      
      const result = detectBeadsBackend(testDir);
      
      assert.strictEqual(result.backend, 'dolt'); // Backend hint takes precedence
      assert.strictEqual(result.beadsDbPath, null); // No DB path for Dolt
    });
  });

  suite('Edge Cases and Error Handling', () => {
    test('Should handle malformed metadata.json', () => {
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), 'invalid json {');
      
      const result = detectBeadsBackend(testDir);
      
      assert.strictEqual(result.backend, 'unknown');
      assert.strictEqual(result.metadata, null);
    });

    test('Should handle non-existent workspace directory', () => {
      const nonExistentDir = path.join(testDir, 'does-not-exist');
      
      const result = detectBeadsBackend(nonExistentDir);
      
      assert.strictEqual(result.backend, 'unknown');
      assert.strictEqual(result.metadata, null);
    });

    test('Should handle permission issues gracefully', () => {
      // Create metadata.json but make it unreadable (skip on Windows due to permission model)
      if (process.platform !== 'win32') {
        fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), '{"backend": "dolt"}');
        fs.chmodSync(path.join(testDir, '.beads', 'metadata.json'), 0o000);
        
        const result = detectBeadsBackend(testDir);
        
        assert.strictEqual(result.backend, 'unknown');
        
        // Restore permissions for cleanup
        fs.chmodSync(path.join(testDir, '.beads', 'metadata.json'), 0o644);
      }
    });
  });

  suite('Integration with Extension Command Execution', () => {
    test('Environment variables should be compatible with bd command execution', () => {
      // Test both backends generate valid environment variables
      const doltMetadata = { backend: 'dolt' };
      const sqliteMetadata = { backend: 'sqlite', database: 'beads.db' };
      
      // Test Dolt environment
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), JSON.stringify(doltMetadata));
      const doltEnv = getBeadsEnv(testDir);
      
      // Environment should be suitable for execFile
      assert.ok(typeof doltEnv.env === 'object');
      assert.ok(typeof doltEnv.env.BEADS_DIR === 'string');
      assert.ok(doltEnv.env.BEADS_DIR.length > 0);
      
      // Test SQLite environment
      fs.writeFileSync(path.join(testDir, '.beads', 'metadata.json'), JSON.stringify(sqliteMetadata));
      const sqliteEnv = getBeadsEnv(testDir);
      
      assert.ok(typeof sqliteEnv.env === 'object');
      assert.ok(typeof sqliteEnv.env.BEADS_DIR === 'string');
      assert.ok(typeof sqliteEnv.env.BEADS_DB === 'string');
      assert.ok(sqliteEnv.env.BEADS_DIR.length > 0);
      assert.ok(sqliteEnv.env.BEADS_DB.length > 0);
    });
  });
});