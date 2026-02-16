const fs = require('fs');
const path = require('path');

/**
 * @typedef {'sqlite'|'dolt'|'unknown'} BeadsBackend
 */

/**
 * Read and parse `.beads/metadata.json` if present.
 *
 * @param {string} beadsDir - Absolute path to the `.beads` directory
 * @returns {object|null} Parsed metadata JSON, or null if missing/unreadable
 */
function readBeadsMetadata(beadsDir) {
  const metadataPath = path.join(beadsDir, 'metadata.json');
  try {
    if (!fs.existsSync(metadataPath)) return null;
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Infer the backend type from metadata and on-disk markers.
 *
 * @param {object|null} metadata - Parsed metadata.json (if present)
 * @param {string} beadsDir - Absolute path to the `.beads` directory
 * @returns {BeadsBackend}
 */
function inferBackend(metadata, beadsDir) {
  const backendHint = [
    metadata?.backend,
    metadata?.storage,
    metadata?.engine,
    metadata?.db_backend,
    metadata?.database_backend
  ].find(v => typeof v === 'string');

  if (backendHint) {
    const hint = backendHint.toLowerCase();
    if (hint.includes('dolt')) return 'dolt';
    if (hint.includes('sqlite')) return 'sqlite';
  }

  const dbField = typeof metadata?.database === 'string' ? metadata.database : '';
  if (/\.db$/i.test(dbField)) return 'sqlite';
  if (dbField.toLowerCase().includes('dolt')) return 'dolt';

  // On-disk Dolt markers (beads v0.50+ default)
  const doltMarkers = [
    path.join(beadsDir, '.dolt'),
    path.join(beadsDir, 'db', '.dolt'),
    path.join(beadsDir, 'dolt', '.dolt'),
    path.join(beadsDir, 'repo', '.dolt')
  ];
  if (doltMarkers.some(p => fs.existsSync(p))) return 'dolt';

  // Legacy SQLite marker
  const sqliteDb = path.join(beadsDir, dbField || 'beads.db');
  if (fs.existsSync(sqliteDb)) return 'sqlite';

  return 'unknown';
}

/**
 * Detect the beads backend for a workspace.
 *
 * This prefers `.beads/metadata.json` when present, and falls back to
 * filesystem markers for legacy installs.
 *
 * @param {string} workspacePath - Workspace root (directory containing `.beads`)
 * @returns {{ backend: BeadsBackend, beadsDir: string, beadsDbPath: string | null, metadata: object | null }}
 */
function detectBeadsBackend(workspacePath) {
  const beadsDir = path.join(workspacePath, '.beads');
  const metadata = readBeadsMetadata(beadsDir);
  const backend = inferBackend(metadata, beadsDir);

  const dbField = typeof metadata?.database === 'string' ? metadata.database : 'beads.db';
  const beadsDbPath = backend === 'sqlite' ? path.join(beadsDir, dbField) : null;

  return { backend, beadsDir, beadsDbPath, metadata };
}

/**
 * Build environment variables for bd/pokepoke processes that ensures we target
 * the workspace's beads database without forcing the wrong backend.
 *
 * @param {string} workspacePath - Workspace root (directory containing `.beads`)
 * @returns {{ backend: BeadsBackend, env: Record<string, string> }}
 */
function getBeadsEnv(workspacePath) {
  const info = detectBeadsBackend(workspacePath);

  /** @type {Record<string, string>} */
  const env = {
    // Prefer BEADS_DIR (recommended) to avoid split-brain with nested repos.
    BEADS_DIR: info.beadsDir
  };

  // Only set BEADS_DB for legacy SQLite backends.
  if (info.backend === 'sqlite' && info.beadsDbPath) {
    env.BEADS_DB = info.beadsDbPath;
  }

  return { backend: info.backend, env };
}

module.exports = {
  detectBeadsBackend,
  getBeadsEnv
};
