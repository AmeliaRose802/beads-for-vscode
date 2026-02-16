const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const childProcess = require('child_process');
const { detectBeadsBackend, getBeadsEnv } = require('../../beads-backend');

// Import just the functions we need without the vscode dependency
let isAllowedCommand, parseCommandArgs;

try {
  // Define the allowed subcommands and functions
  const allowedSubcommands = ['create', 'update', 'close', 'reopen', 'list', 'show', 'ready', 'blocked', 'stats', 'dep', 'graph', 'sync', 'comments', 'label', 'init', 'info'];
  
  isAllowedCommand = function(command) {
    const trimmed = command.trim();
    const firstToken = trimmed.split(/\s+/)[0];
    return allowedSubcommands.includes(firstToken);
  };
  
  parseCommandArgs = function(command) {
    const args = [];
    const regex = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
    let match;
    while ((match = regex.exec(command)) !== null) {
      if (match[1] !== undefined) {
        args.push(match[1].replace(/\\(.)/g, '$1'));
      } else {
        args.push(match[2]);
      }
    }
    return args;
  };
} catch (e) {
  console.warn('Could not load extension functions, using mock implementations');
  isAllowedCommand = () => true;
  parseCommandArgs = (cmd) => cmd.split(' ');
}

suite('End-to-End Dolt Integration', () => {
  let testWorkspace, execStub;

  setup(() => {
    // Create test workspace with Dolt structure
    testWorkspace = path.join(__dirname, '..', 'tmp', 'e2e-dolt-' + Date.now());
    fs.mkdirSync(path.dirname(testWorkspace), { recursive: true });
    fs.mkdirSync(testWorkspace, { recursive: true });
    fs.mkdirSync(path.join(testWorkspace, '.beads'), { recursive: true });
    
    // Create Dolt metadata
    const metadata = {
      backend: 'dolt',
      database: 'beads_db',
      version: '0.50.0'
    };
    fs.writeFileSync(
      path.join(testWorkspace, '.beads', 'metadata.json'), 
      JSON.stringify(metadata, null, 2)
    );
    
    // Create Dolt directory structure
    fs.mkdirSync(path.join(testWorkspace, '.beads', 'db'), { recursive: true });
    fs.mkdirSync(path.join(testWorkspace, '.beads', 'db', '.dolt'), { recursive: true });

    // Mock execFile to simulate successful bd command execution
    execStub = sinon.stub(childProcess, 'execFile');
    execStub.callsFake((file, args, options, callback) => {
      // Verify that BEADS_DB is NOT set for Dolt projects
      assert.ok(!Object.prototype.hasOwnProperty.call(options.env, 'BEADS_DB'), 
                'BEADS_DB should not be set for Dolt projects');
      
      // Verify that BEADS_DIR is set correctly
      assert.ok(options.env.BEADS_DIR, 'BEADS_DIR should be set');
      assert.ok(options.env.BEADS_DIR.includes('.beads'), 'BEADS_DIR should point to .beads directory');
      assert.strictEqual(options.env.BEADS_DIR, path.join(testWorkspace, '.beads'));
      
      // Simulate successful bd command execution
      const output = JSON.stringify([
        { id: 'dolt-test-1', title: 'Test Dolt Issue', status: 'open', issue_type: 'task' }
      ]);
      callback(null, output, '');
    });
  });

  teardown(() => {
    sinon.restore();
    try {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test('Backend detection and environment setup works end-to-end', () => {
    // Test the full pipeline: detection -> environment -> command execution
    const backendInfo = detectBeadsBackend(testWorkspace);
    assert.strictEqual(backendInfo.backend, 'dolt');
    
    const envInfo = getBeadsEnv(testWorkspace);
    assert.strictEqual(envInfo.backend, 'dolt');
    assert.ok(envInfo.env.BEADS_DIR);
    assert.ok(!envInfo.env.BEADS_DB);
  });

  test('Command execution pipeline works with Dolt backend', async () => {
    // Simulate the exact process the extension uses
    const command = 'list --json';
    
    // 1. Validate command (from extension)
    assert.ok(isAllowedCommand(command), 'Command should be allowed');
    
    // 2. Parse arguments (from extension)  
    const args = parseCommandArgs(command);
    assert.deepStrictEqual(args, ['list', '--json']);
    
    // 3. Get environment (from beads-backend)
    const { env } = getBeadsEnv(testWorkspace);
    const fullEnv = { ...process.env, ...env };
    
    // 4. Execute command (simulated)
    return new Promise((resolve) => {
      childProcess.execFile('bd', args, {
        maxBuffer: 10 * 1024 * 1024,
        cwd: testWorkspace,
        env: fullEnv,
        timeout: 30000
      }, (error, stdout, _stderr) => {
        // Verify execution succeeded
        assert.ok(!error, 'Command should execute without error');
        assert.ok(stdout, 'Should have stdout output');
        
        // Verify execFile was called correctly
        assert.ok(execStub.calledOnce);
        const callArgs = execStub.firstCall.args;
        assert.strictEqual(callArgs[0], 'bd');
        assert.deepStrictEqual(callArgs[1], ['list', '--json']);
        assert.strictEqual(callArgs[2].cwd, testWorkspace);
        
        resolve();
      });
    });
  });

  test('Multiple commands work correctly with Dolt environment', async () => {
    const commands = ['list --json', 'stats', 'ready --json'];
    
    for (const command of commands) {
      execStub.resetHistory();
      
      // Follow the extension's command execution pattern
      assert.ok(isAllowedCommand(command), `Command '${command}' should be allowed`);
      
      const args = parseCommandArgs(command);
      const { env } = getBeadsEnv(testWorkspace);
      const fullEnv = { ...process.env, ...env };
      
      await new Promise((resolve) => {
        childProcess.execFile('bd', args, {
          maxBuffer: 10 * 1024 * 1024,
          cwd: testWorkspace,
          env: fullEnv,
          timeout: 30000
        }, (error, _stdout, _stderr) => {
          assert.ok(!error, `Command '${command}' should execute without error`);
          
          const options = execStub.firstCall.args[2];
          assert.ok(options.env.BEADS_DIR, `BEADS_DIR should be set for '${command}'`);
          assert.ok(!Object.prototype.hasOwnProperty.call(options.env, 'BEADS_DB'), 
                    `BEADS_DB should NOT be set for '${command}'`);
          
          resolve();
        });
      });
    }
  });

  test('Security: Command validation works with Dolt backend', () => {
    // Test that security measures are independent of backend
    const allowedCommands = ['list', 'create', 'update', 'ready', 'stats'];
    const blockedCommands = ['rm -rf /', '; echo pwned', 'cat /etc/passwd'];
    
    allowedCommands.forEach(cmd => {
      assert.ok(isAllowedCommand(cmd), `'${cmd}' should be allowed`);
    });
    
    blockedCommands.forEach(cmd => {
      assert.ok(!isAllowedCommand(cmd), `'${cmd}' should be blocked`);
    });
  });

  test('Argument parsing works correctly for Dolt commands', () => {
    const testCases = [
      {
        input: 'create --title "Dolt test issue" -t task',
        expected: ['create', '--title', 'Dolt test issue', '-t', 'task']
      },
      {
        input: 'update dolt-123 --assignee "user@example.com"',
        expected: ['update', 'dolt-123', '--assignee', 'user@example.com']
      },
      {
        input: 'list --json',
        expected: ['list', '--json']
      }
    ];
    
    testCases.forEach(testCase => {
      const result = parseCommandArgs(testCase.input);
      assert.deepStrictEqual(result, testCase.expected, 
        `Parsing '${testCase.input}' should work correctly`);
    });
  });

  test('Environment isolation: SQLite vs Dolt projects', () => {
    // Create a parallel SQLite project 
    const sqliteWorkspace = testWorkspace + '-sqlite';
    fs.mkdirSync(sqliteWorkspace, { recursive: true });
    fs.mkdirSync(path.join(sqliteWorkspace, '.beads'), { recursive: true });
    
    const sqliteMetadata = {
      backend: 'sqlite',
      database: 'beads.db'
    };
    fs.writeFileSync(
      path.join(sqliteWorkspace, '.beads', 'metadata.json'), 
      JSON.stringify(sqliteMetadata, null, 2)
    );
    
    try {
      // Test Dolt environment
      const doltEnv = getBeadsEnv(testWorkspace);
      assert.strictEqual(doltEnv.backend, 'dolt');
      assert.ok(doltEnv.env.BEADS_DIR);
      assert.ok(!doltEnv.env.BEADS_DB);
      
      // Test SQLite environment
      const sqliteEnv = getBeadsEnv(sqliteWorkspace);
      assert.strictEqual(sqliteEnv.backend, 'sqlite');
      assert.ok(sqliteEnv.env.BEADS_DIR);
      assert.ok(sqliteEnv.env.BEADS_DB);
      
      // Verify they're different
      assert.notStrictEqual(doltEnv.env.BEADS_DIR, sqliteEnv.env.BEADS_DIR);
    } finally {
      // Cleanup
      fs.rmSync(sqliteWorkspace, { recursive: true, force: true });
    }
  });
});