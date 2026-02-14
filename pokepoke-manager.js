const child_process = require('child_process');
const path = require('path');
const EventEmitter = require('events');

/**
 * Possible states for a PokePoke process instance.
 * @typedef {'starting'|'running'|'completed'|'failed'|'stopping'} PokePokeState
 */

/**
 * Represents a single running PokePoke instance.
 * @typedef {object} PokePokeInstance
 * @property {string} itemId - The beads item ID being worked on
 * @property {string} title - The item title
 * @property {PokePokeState} state - Current process state
 * @property {import('child_process').ChildProcess|null} process - The child process
 * @property {string[]} logs - Captured log lines
 * @property {number} startTime - Timestamp when started
 * @property {boolean} isTree - Whether this is a tree assignment
 */

/**
 * Manages PokePoke child processes for autonomous work item completion.
 * Supports multiple concurrent instances and lifecycle management.
 */
class PokePokeManager extends EventEmitter {
  /**
   * Create a PokePoke manager.
   * @param {object} options - Manager options
   * @param {string} options.pythonPath - Path to Python executable
   * @param {string} options.workspacePath - Path to workspace root
   * @param {Function} [options.outputChannelFactory] - Factory for VS Code OutputChannels
   */
  constructor(options = {}) {
    super();
    /** @type {string} */
    this._pythonPath = options.pythonPath || 'python';
    /** @type {string} */
    this._workspacePath = options.workspacePath || process.cwd();
    /** @type {Function|null} */
    this._outputChannelFactory = options.outputChannelFactory || null;
    /** @type {Map<string, PokePokeInstance>} */
    this._instances = new Map();
    /** @type {number} */
    this._maxLogLines = 500;
  }

  /**
   * Get all running PokePoke instances.
   * @returns {Array<{itemId: string, title: string, state: PokePokeState, startTime: number, isTree: boolean}>}
   */
  getInstances() {
    return Array.from(this._instances.values()).map(inst => ({
      itemId: inst.itemId,
      title: inst.title,
      state: inst.state,
      startTime: inst.startTime,
      isTree: inst.isTree
    }));
  }

  /**
   * Check if a PokePoke instance is running for the given item.
   * @param {string} itemId - The beads item ID
   * @returns {boolean}
   */
  isRunning(itemId) {
    const inst = this._instances.get(itemId);
    return inst != null && (inst.state === 'running' || inst.state === 'starting');
  }

  /**
   * Get logs for a specific PokePoke instance.
   * @param {string} itemId - The beads item ID
   * @returns {string[]} Log lines
   */
  getLogs(itemId) {
    const inst = this._instances.get(itemId);
    return inst ? [...inst.logs] : [];
  }

  /**
   * Launch PokePoke for a single beads item.
   * @param {string} itemId - The beads item ID to work on
   * @param {string} title - The item title for display
   * @returns {{ success: boolean, error?: string }}
   */
  launchForItem(itemId, title) {
    return this._launch(itemId, title, false);
  }

  /**
   * Launch PokePoke for a dependency tree rooted at the given item.
   * @param {string} itemId - The parent beads item ID
   * @param {string} title - The item title for display
   * @returns {{ success: boolean, error?: string }}
   */
  launchForTree(itemId, title) {
    return this._launch(itemId, title, true);
  }

  /**
   * Internal launch method.
   * @param {string} itemId - The beads item ID
   * @param {string} title - The item title
   * @param {boolean} isTree - Whether to process the full tree
   * @returns {{ success: boolean, error?: string }}
   */
  _launch(itemId, title, isTree) {
    if (this.isRunning(itemId)) {
      return { success: false, error: `PokePoke is already running for ${itemId}` };
    }

    const args = [
      '-m', 'pokepoke.orchestrator',
      '--autonomous', '--continuous',
      '--item', itemId
    ];

    if (isTree) {
      args.push('--tree');
    }

    /** @type {PokePokeInstance} */
    const instance = {
      itemId,
      title,
      state: 'starting',
      process: null,
      logs: [],
      startTime: Date.now(),
      isTree,
      outputChannel: null
    };

    this._instances.set(itemId, instance);

    try {
      const proc = child_process.spawn(this._pythonPath, args, {
        cwd: this._workspacePath,
        env: {
          ...process.env,
          BEADS_DB: path.join(this._workspacePath, '.beads', 'beads.db'),
          POKEPOKE_ITEM_ID: itemId
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      instance.process = proc;
      instance.state = 'running';

      // Create output channel if factory is available
      if (this._outputChannelFactory) {
        instance.outputChannel = this._outputChannelFactory(
          `PokePoke: ${itemId}`
        );
        instance.outputChannel.show(true);
      }

      proc.stdout.on('data', (data) => {
        const line = data.toString();
        this._appendLog(itemId, line);
      });

      proc.stderr.on('data', (data) => {
        const line = data.toString();
        this._appendLog(itemId, `[stderr] ${line}`);
      });

      proc.on('close', (code) => {
        const inst = this._instances.get(itemId);
        if (inst) {
          inst.state = code === 0 ? 'completed' : 'failed';
          inst.process = null;
          this.emit('stateChange', { itemId, state: inst.state, code });
        }
      });

      proc.on('error', (err) => {
        const inst = this._instances.get(itemId);
        if (inst) {
          inst.state = 'failed';
          inst.process = null;
          this._appendLog(itemId, `[error] ${err.message}`);
          this.emit('stateChange', { itemId, state: 'failed', error: err.message });
        }
      });

      this.emit('stateChange', { itemId, state: 'running' });
      return { success: true };
    } catch (err) {
      instance.state = 'failed';
      this.emit('stateChange', { itemId, state: 'failed', error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Append a log line for an instance.
   * @param {string} itemId - The beads item ID
   * @param {string} line - The log line
   */
  _appendLog(itemId, line) {
    const inst = this._instances.get(itemId);
    if (!inst) return;

    inst.logs.push(line);
    if (inst.logs.length > this._maxLogLines) {
      inst.logs.shift();
    }

    if (inst.outputChannel) {
      inst.outputChannel.append(line);
    }

    this.emit('log', { itemId, line });
  }

  /**
   * Stop a running PokePoke instance.
   * @param {string} itemId - The beads item ID
   * @returns {{ success: boolean, error?: string }}
   */
  stop(itemId) {
    const inst = this._instances.get(itemId);
    if (!inst || !inst.process) {
      return { success: false, error: `No running PokePoke instance for ${itemId}` };
    }

    inst.state = 'stopping';
    this.emit('stateChange', { itemId, state: 'stopping' });

    // Try graceful shutdown first (SIGINT), then force (SIGTERM)
    inst.process.kill('SIGINT');

    setTimeout(() => {
      if (inst.process && !inst.process.killed) {
        inst.process.kill('SIGTERM');
      }
    }, 3000);

    return { success: true };
  }

  /**
   * Stop all running PokePoke instances.
   */
  stopAll() {
    for (const [itemId] of this._instances) {
      this.stop(itemId);
    }
  }

  /**
   * Remove a completed/failed instance from tracking.
   * @param {string} itemId - The beads item ID
   */
  remove(itemId) {
    const inst = this._instances.get(itemId);
    if (inst && inst.outputChannel) {
      inst.outputChannel.dispose();
    }
    this._instances.delete(itemId);
  }

  /**
   * Dispose all instances and clean up resources.
   */
  dispose() {
    this.stopAll();
    for (const [, inst] of this._instances) {
      if (inst.outputChannel) {
        inst.outputChannel.dispose();
      }
    }
    this._instances.clear();
    this.removeAllListeners();
  }
}

module.exports = { PokePokeManager };
