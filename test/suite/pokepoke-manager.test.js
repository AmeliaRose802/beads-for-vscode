const assert = require('assert');
const sinon = require('sinon');
const EventEmitter = require('events');
const child_process = require('child_process');
const { PokePokeManager } = require('../../pokepoke-manager');

suite('PokePokeManager', () => {
  /** @type {PokePokeManager} */
  let manager;
  let spawnStub;

  /**
   * Create a mock child process with event emitter behavior.
   * @returns {object} Mock process
   */
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = sinon.stub();
    proc.killed = false;
    proc.pid = 12345;
    return proc;
  }

  setup(() => {
    spawnStub = sinon.stub(child_process, 'spawn');
    manager = new PokePokeManager({
      pythonPath: '/usr/bin/python3',
      workspacePath: '/test/workspace'
    });
  });

  teardown(() => {
    // Clear instances without trying to kill mock processes
    manager.removeAllListeners();
    manager._instances.clear();
    sinon.restore();
  });

  suite('getInstances', () => {
    test('returns empty array when no instances running', () => {
      assert.deepStrictEqual(manager.getInstances(), []);
    });
  });

  suite('isRunning', () => {
    test('returns false for unknown item', () => {
      assert.strictEqual(manager.isRunning('bd-999'), false);
    });
  });

  suite('getLogs', () => {
    test('returns empty array for unknown item', () => {
      assert.deepStrictEqual(manager.getLogs('bd-999'), []);
    });
  });

  suite('launchForItem', () => {
    test('sets state to running on spawn', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      const result = manager.launchForItem('bd-1', 'Test task');

      assert.strictEqual(result.success, true);
      assert.strictEqual(manager.isRunning('bd-1'), true);

      const instances = manager.getInstances();
      assert.strictEqual(instances.length, 1);
      assert.strictEqual(instances[0].itemId, 'bd-1');
      assert.strictEqual(instances[0].title, 'Test task');
      assert.strictEqual(instances[0].state, 'running');
      assert.strictEqual(instances[0].isTree, false);
    });

    test('rejects duplicate launch for same item', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      manager.launchForItem('bd-1', 'Test task');
      const result = manager.launchForItem('bd-1', 'Test task again');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('already running'));
    });

    test('passes correct arguments to spawn', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      manager.launchForItem('bd-42', 'My task');

      assert.strictEqual(spawnStub.calledOnce, true);
      const [cmd, args] = spawnStub.firstCall.args;
      assert.strictEqual(cmd, '/usr/bin/python3');
      assert.ok(args.includes('--item'));
      assert.ok(args.includes('bd-42'));
      assert.ok(!args.includes('--tree'));
    });
  });

  suite('launchForTree', () => {
    test('passes --tree flag to spawn', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      const result = manager.launchForTree('bd-5', 'Epic task');

      assert.strictEqual(result.success, true);
      const [, args] = spawnStub.firstCall.args;
      assert.ok(args.includes('--tree'));

      const instances = manager.getInstances();
      assert.strictEqual(instances[0].isTree, true);
    });
  });

  suite('stdout/stderr logging', () => {
    test('captures stdout lines', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      manager.launchForItem('bd-1', 'Test');
      mockProc.stdout.emit('data', Buffer.from('line 1\n'));
      mockProc.stdout.emit('data', Buffer.from('line 2\n'));

      const logs = manager.getLogs('bd-1');
      assert.strictEqual(logs.length, 2);
      assert.strictEqual(logs[0], 'line 1\n');
    });

    test('captures stderr with prefix', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      manager.launchForItem('bd-1', 'Test');
      mockProc.stderr.emit('data', Buffer.from('error msg'));

      const logs = manager.getLogs('bd-1');
      assert.strictEqual(logs.length, 1);
      assert.ok(logs[0].includes('[stderr]'));
    });
  });

  suite('process completion', () => {
    test('sets state to completed on exit code 0', (done) => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      let seenRunning = false;
      manager.on('stateChange', (event) => {
        if (event.state === 'running') seenRunning = true;
        if (event.state === 'completed' && seenRunning) {
          assert.strictEqual(event.itemId, 'bd-1');
          assert.strictEqual(event.code, 0);
          assert.strictEqual(manager.isRunning('bd-1'), false);
          done();
        }
      });

      manager.launchForItem('bd-1', 'Test');
      mockProc.emit('close', 0);
    });

    test('sets state to failed on non-zero exit', (done) => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      let seenRunning = false;
      manager.on('stateChange', (event) => {
        if (event.state === 'running') seenRunning = true;
        if (event.state === 'failed' && seenRunning) {
          assert.strictEqual(event.code, 1);
          done();
        }
      });

      manager.launchForItem('bd-1', 'Test');
      mockProc.emit('close', 1);
    });

    test('sets state to failed on process error', (done) => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      let seenRunning = false;
      manager.on('stateChange', (event) => {
        if (event.state === 'running') seenRunning = true;
        if (event.state === 'failed' && event.error && seenRunning) {
          assert.ok(event.error.includes('ENOENT'));
          done();
        }
      });

      manager.launchForItem('bd-1', 'Test');
      mockProc.emit('error', new Error('ENOENT'));
    });
  });

  suite('stop', () => {
    test('sends SIGINT to running process', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      manager.launchForItem('bd-1', 'Test');
      const result = manager.stop('bd-1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(mockProc.kill.calledWith('SIGINT'), true);
    });

    test('returns error for non-running item', () => {
      const result = manager.stop('bd-999');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('No running'));
    });
  });

  suite('stopAll', () => {
    test('stops all running instances', () => {
      const proc1 = createMockProcess();
      const proc2 = createMockProcess();
      spawnStub.onFirstCall().returns(proc1);
      spawnStub.onSecondCall().returns(proc2);

      manager.launchForItem('bd-1', 'Task 1');
      manager.launchForItem('bd-2', 'Task 2');
      manager.stopAll();

      assert.strictEqual(proc1.kill.called, true);
      assert.strictEqual(proc2.kill.called, true);
    });
  });

  suite('remove', () => {
    test('removes completed instance from tracking', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      manager.launchForItem('bd-1', 'Test');
      mockProc.emit('close', 0);
      manager.remove('bd-1');

      assert.strictEqual(manager.getInstances().length, 0);
    });
  });

  suite('output channel', () => {
    test('creates output channel via factory', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      const mockChannel = { show: sinon.stub(), append: sinon.stub(), dispose: sinon.stub() };
      const factory = sinon.stub().returns(mockChannel);

      const mgr = new PokePokeManager({
        pythonPath: 'python',
        workspacePath: '/test',
        outputChannelFactory: factory
      });

      mgr.launchForItem('bd-1', 'Test');

      assert.strictEqual(factory.calledOnce, true);
      assert.strictEqual(mockChannel.show.calledOnce, true);

      mockProc.stdout.emit('data', Buffer.from('hello'));
      assert.strictEqual(mockChannel.append.calledWith('hello'), true);

      mgr._instances.clear();
      mgr.removeAllListeners();
    });
  });

  suite('dispose', () => {
    test('clears all instances and listeners', () => {
      const mockProc = createMockProcess();
      spawnStub.returns(mockProc);

      manager.launchForItem('bd-1', 'Test');
      manager.dispose();

      assert.strictEqual(manager.getInstances().length, 0);
      assert.strictEqual(manager.listenerCount('stateChange'), 0);
    });
  });
});
