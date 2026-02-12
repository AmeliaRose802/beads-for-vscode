const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../');

    // The path to test runner
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    const userDataDir = path.resolve(__dirname, '../.vscode-test-user');

    // Download VS Code, unzip it and run the integration test
    await runTests({ 
      version: '1.106.1',
      extensionDevelopmentPath, 
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions', // Disable other extensions during test
        '--disable-updates',
        '--user-data-dir',
        userDataDir
      ]
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
