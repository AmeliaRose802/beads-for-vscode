const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { detectBeadsBackend, getBeadsEnv } = require('../../beads-backend');

suite('beads-backend', () => {
  let tmpDir;
  let beadsDir;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'beads-test-'));
    beadsDir = path.join(tmpDir, '.beads');
    fs.mkdirSync(beadsDir, { recursive: true });
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  suite('detectBeadsBackend', () => {
    test('returns unknown when no metadata or markers exist', () => {
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'unknown');
      assert.strictEqual(result.beadsDir, beadsDir);
      assert.strictEqual(result.beadsDbPath, null);
      assert.strictEqual(result.metadata, null);
    });

    test('detects sqlite from metadata backend field', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ backend: 'sqlite' })
      );
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'sqlite');
      assert.strictEqual(result.beadsDbPath, path.join(beadsDir, 'beads.db'));
    });

    test('detects dolt from metadata backend field', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ backend: 'dolt' })
      );
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'dolt');
      assert.strictEqual(result.beadsDbPath, null);
    });

    test('detects sqlite from metadata storage field', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ storage: 'sqlite' })
      );
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'sqlite');
    });

    test('detects dolt from metadata engine field', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ engine: 'dolt' })
      );
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'dolt');
    });

    test('detects sqlite from database field ending in .db', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ database: 'mydata.db' })
      );
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'sqlite');
      assert.strictEqual(result.beadsDbPath, path.join(beadsDir, 'mydata.db'));
    });

    test('detects dolt from database field containing dolt', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ database: 'dolt-repo' })
      );
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'dolt');
    });

    test('detects dolt from .dolt directory marker', () => {
      fs.mkdirSync(path.join(beadsDir, '.dolt'), { recursive: true });
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'dolt');
    });

    test('detects dolt from db/.dolt directory marker', () => {
      fs.mkdirSync(path.join(beadsDir, 'db', '.dolt'), { recursive: true });
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'dolt');
    });

    test('detects sqlite from beads.db file', () => {
      fs.writeFileSync(path.join(beadsDir, 'beads.db'), '');
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'sqlite');
    });

    test('handles malformed metadata.json gracefully', () => {
      fs.writeFileSync(path.join(beadsDir, 'metadata.json'), '{invalid json');
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.metadata, null);
    });

    test('handles missing .beads directory', () => {
      fs.rmSync(beadsDir, { recursive: true, force: true });
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'unknown');
      assert.strictEqual(result.metadata, null);
    });

    test('prefers metadata hint over on-disk markers', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ backend: 'sqlite' })
      );
      fs.mkdirSync(path.join(beadsDir, '.dolt'), { recursive: true });
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'sqlite');
    });

    test('detects dolt from db_backend field', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ db_backend: 'dolt' })
      );
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'dolt');
    });

    test('detects dolt from database_backend field', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ database_backend: 'dolt' })
      );
      const result = detectBeadsBackend(tmpDir);
      assert.strictEqual(result.backend, 'dolt');
    });
  });

  suite('getBeadsEnv', () => {
    test('returns BEADS_DIR in env', () => {
      const result = getBeadsEnv(tmpDir);
      assert.strictEqual(result.env.BEADS_DIR, beadsDir);
    });

    test('sets BEADS_DB for sqlite backend', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ backend: 'sqlite' })
      );
      const result = getBeadsEnv(tmpDir);
      assert.strictEqual(result.backend, 'sqlite');
      assert.ok(result.env.BEADS_DB, 'BEADS_DB should be set for sqlite');
    });

    test('does not set BEADS_DB for dolt backend', () => {
      fs.writeFileSync(
        path.join(beadsDir, 'metadata.json'),
        JSON.stringify({ backend: 'dolt' })
      );
      const result = getBeadsEnv(tmpDir);
      assert.strictEqual(result.backend, 'dolt');
      assert.strictEqual(result.env.BEADS_DB, undefined);
    });

    test('does not set BEADS_DB for unknown backend', () => {
      const result = getBeadsEnv(tmpDir);
      assert.strictEqual(result.backend, 'unknown');
      assert.strictEqual(result.env.BEADS_DB, undefined);
    });
  });
});
